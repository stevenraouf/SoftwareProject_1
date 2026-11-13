import type { Server } from "node:http";

/** Observe completed HTTP requests, without retaining bodies, cookies or tokens. */
export function apiCoverage(document: any, server: Server) {
  const operations = new Map<string, any>();
  for (const [path, item] of Object.entries(document.paths))
    for (const [method, operation] of Object.entries(item as any)) {
      if (!["get", "post", "patch", "put", "delete"].includes(method)) continue;
      operations.set(`${method.toUpperCase()} ${path}`, {
        method: method.toUpperCase(),
        path,
        operationId: (operation as any).operationId,
        access: (operation as any)["x-access"],
        requiresAuthentication: Boolean((operation as any).security?.length),
        statuses: {} as Record<string, number>,
        authorizationChecks: {} as Record<string, number>,
      });
    }
  server.prependListener("request", (req: any, res) => {
    res.once("finish", () => {
      const path = req.route?.path;
      if (typeof path !== "string") return;
      const normalized = path.replace(/:([A-Za-z0-9_]+)/g, "{$1}");
      const operation = operations.get(`${req.method} ${normalized}`);
      if (operation) {
        operation.statuses[res.statusCode] =
          (operation.statuses[res.statusCode] || 0) + 1;
        const context = req.headers["x-api-test-context"];
        if (["anonymous", "wrong-role", "missing-csrf"].includes(context))
          operation.authorizationChecks[context] = res.statusCode;
      }
    });
  });
  return () => {
    const rows = [...operations.values()].map((operation) => ({
      ...operation,
      exercised: Object.keys(operation.statuses).length > 0,
      successfulResponse: Object.keys(operation.statuses).some(
        (s) => +s >= 200 && +s < 300,
      ),
    }));
    return {
      clientDate: "2026-11-14",
      database:
        "Isolated disposable MongoDB 8.2.6 replica set, not the Atlas application database",
      externalServices:
        "Stripe and SMTP adapters use test fixtures; account-backed integration remains separate",
      totalOperations: rows.length,
      exercisedOperations: rows.filter((r) => r.exercised).length,
      successfulOperations: rows.filter((r) => r.successfulResponse).length,
      operations: rows,
    };
  };
}
