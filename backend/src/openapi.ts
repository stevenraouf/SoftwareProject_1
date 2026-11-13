import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createApp } from "./bootstrap.js";
async function main() {
  process.env.ENABLE_JOBS = "false";
  const { app, document } = await createApp({ logger: false });
  try {
    const dir = resolve("../docs/api");
    await mkdir(dir, { recursive: true });
    await writeFile(
      resolve(dir, "openapi.json"),
      JSON.stringify(document, null, 2),
    );
    console.log("Exported docs/api/openapi.json");
  } finally {
    await app.close();
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
