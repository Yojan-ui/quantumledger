import { createLegacyApp } from "./app";

const port = Number(process.env.PORT ?? 4000);
createLegacyApp().listen(port, "127.0.0.1", () =>
  console.log(`[legacy-app] listening on http://127.0.0.1:${port}`),
);
