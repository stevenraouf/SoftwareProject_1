import { mkdir, writeFile, access } from "node:fs/promises";
import { resolve } from "node:path";
import selfsigned from "selfsigned";
const dir = resolve("../.certs");
await mkdir(dir, { recursive: true });
try {
  await access(resolve(dir, "localhost.pem"));
  console.log("Local certificate already exists; left unchanged.");
} catch {
  const result = await selfsigned.generate(
    [{ name: "commonName", value: "localhost" }],
    {
      keySize: 2048,
      days: 365,
      extensions: [
        { name: "basicConstraints", cA: false },
        { name: "keyUsage", digitalSignature: true, keyEncipherment: true },
        { name: "extKeyUsage", serverAuth: true },
        {
          name: "subjectAltName",
          altNames: [
            { type: 2, value: "localhost" },
            { type: 7, ip: "127.0.0.1" },
          ],
        },
      ],
    },
  );
  await writeFile(resolve(dir, "localhost-key.pem"), result.private, {
    flag: "wx",
  });
  await writeFile(resolve(dir, "localhost.pem"), result.cert, { flag: "wx" });
  console.log(
    "Generated local HTTPS certificate in ../.certs. Open localhost in the browser and trust it for local development.",
  );
}
