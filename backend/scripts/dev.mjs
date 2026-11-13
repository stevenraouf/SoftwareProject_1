import { spawn, spawnSync } from "node:child_process";
const tsc = "node_modules/typescript/bin/tsc";
const build = spawnSync(process.execPath, [tsc, "-p", "tsconfig.build.json"], {
  stdio: "inherit",
});
if (build.status !== 0) process.exit(build.status || 1);
const compiler = spawn(
  process.execPath,
  [tsc, "-p", "tsconfig.build.json", "--watch", "--preserveWatchOutput"],
  { stdio: "inherit" },
);
const server = spawn(process.execPath, ["--watch", "dist/main.js"], {
  stdio: "inherit",
});
function close() {
  compiler.kill();
  server.kill();
}
process.on("SIGINT", close);
process.on("SIGTERM", close);
