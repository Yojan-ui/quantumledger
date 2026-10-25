"""Keeps the bridge to this machine's own UI.

The bridge listens on 127.0.0.1, but any web page open in the same browser can still reach it:
a cross-site POST with no body (no CORS preflight), a GET that records something, a WebSocket
(CORS doesn't apply to those), or a hostile name DNS-rebound onto 127.0.0.1, after which every
answer is same-origin to that page. So for HTTP and WebSocket alike:

- the Host must be a loopback name (stops DNS rebinding);
- an Origin, when sent, must be the app's own (the Vite dev server);
- a Sec-Fetch-Site of cross-site or same-site is refused (covers <img>/<form> requests with no
  Origin).

Requests without browser headers (curl, scripts on this machine) are unaffected.
"""

from __future__ import annotations

LOCAL_HOSTS = {"localhost", "127.0.0.1", "[::1]"}
APP_ORIGINS = {"http://localhost:5173", "http://127.0.0.1:5173"}


def _host_name(host: str) -> str:
    """'127.0.0.1:8000' → '127.0.0.1'; '[::1]:8000' → '[::1]'."""
    if host.startswith("["):
        return host.split("]", 1)[0] + "]"
    return host.rsplit(":", 1)[0] if ":" in host else host


def allowed(headers: dict[str, str]) -> bool:
    if _host_name(headers.get("host", "")).lower() not in LOCAL_HOSTS:
        return False
    origin = headers.get("origin")
    if origin is not None and origin not in APP_ORIGINS:
        return False
    return headers.get("sec-fetch-site") not in ("cross-site", "same-site")


class LocalOnly:
    """Pure ASGI middleware (it has to see WebSocket handshakes too, not only HTTP)."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] in ("http", "websocket"):
            headers = {k.decode("latin-1").lower(): v.decode("latin-1") for k, v in scope["headers"]}
            if not allowed(headers):
                if scope["type"] == "websocket":
                    await receive()  # websocket.connect
                    await send({"type": "websocket.close", "code": 1008})  # served as HTTP 403
                    return
                body = b'{"detail":"forbidden"}'
                await send({"type": "http.response.start", "status": 403,
                            "headers": [(b"content-type", b"application/json"),
                                        (b"content-length", str(len(body)).encode())]})
                await send({"type": "http.response.body", "body": body})
                return
        await self.app(scope, receive, send)
