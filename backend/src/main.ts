import "dotenv/config";
import { readFileSync } from "node:fs";
import { createApp } from "./bootstrap.js";

async function main() {
  if (!process.env.TLS_KEY_PATH || !process.env.TLS_CERT_PATH)
    throw new Error(
      "Local HTTPS is required: run npm run certs and set TLS_KEY_PATH/TLS_CERT_PATH",
    );
  const { app } = await createApp({
    httpsOptions: {
      key: readFileSync(process.env.TLS_KEY_PATH),
      cert: readFileSync(process.env.TLS_CERT_PATH),
    },
  });
  app.enableShutdownHooks();
  await app.listen(Number(process.env.PORT || 3443), "127.0.0.1");
  console.log(
    `Swagger: ${process.env.APP_ORIGIN || "https://localhost:3443"}/api/docs`,
  );
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
