import { readFileSync } from "node:fs";
import { createServer } from "node:https";
import next from "next";

const port = Number(process.env.FRONTEND_PORT || 3000);
const app = next({ dev: false, hostname: "localhost", port });
await app.prepare();
const handle = app.getRequestHandler();
createServer(
  {
    key: readFileSync(
      process.env.FRONTEND_TLS_KEY || "../.certs/localhost-key.pem",
    ),
    cert: readFileSync(
      process.env.FRONTEND_TLS_CERT || "../.certs/localhost.pem",
    ),
  },
  handle,
).listen(port, "127.0.0.1", () =>
  console.log(`AERIS: https://localhost:${port}`),
);
