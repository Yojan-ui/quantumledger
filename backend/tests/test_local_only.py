"""LocalOnly: the bridge answers this machine's own UI, not other web pages (see local_only.py)."""

from fastapi import FastAPI, WebSocket
from fastapi.testclient import TestClient
import pytest
from starlette.websockets import WebSocketDisconnect

from local_only import LocalOnly

app = FastAPI()
app.add_middleware(LocalOnly)


@app.post("/api/ql/remediate")
async def remediate() -> dict:
    return {"ok": True}


@app.websocket("/ws")
async def ws(sock: WebSocket) -> None:
    await sock.accept()
    await sock.send_text("hello")
    await sock.close()


client = TestClient(app, base_url="http://127.0.0.1:8000")
APP = {"origin": "http://localhost:5173", "sec-fetch-site": "same-origin"}
# The test client's WebSocket handshakes say Host: testserver; a real one from the UI is local.
WS = {**APP, "host": "127.0.0.1:8000"}


def test_the_ui_and_local_tools_get_through():
    assert client.post("/api/ql/remediate", headers=APP).status_code == 200
    assert client.post("/api/ql/remediate").status_code == 200  # curl: no browser headers
    assert client.post("/api/ql/remediate", headers={"host": "localhost:5173"}).status_code == 200


@pytest.mark.parametrize("headers", [
    {"origin": "https://evil.example"},                       # cross-site fetch / form POST
    {"sec-fetch-site": "cross-site"},                          # <img>/<form> with no Origin
    {"host": "evil.example:8000"},                             # DNS rebinding onto 127.0.0.1
    {"host": "evil.example", "origin": "http://evil.example"},
])
def test_other_pages_are_refused(headers):
    assert client.post("/api/ql/remediate", headers=headers).status_code == 403


def test_websocket_only_from_the_ui():
    with client.websocket_connect("/ws", headers=WS) as s:
        assert s.receive_text() == "hello"
    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect("/ws", headers={**WS, "origin": "https://evil.example"}) as s:
            s.receive_text()
