import "reflect-metadata";
import {
  BadRequestException,
  INestApplication,
  ValidationPipe,
} from "@nestjs/common";
import { ModulesContainer, NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { Request, Response, NextFunction } from "express";
import { AppModule } from "./app.module.js";
import { ApiErrors } from "./common.js";
import { Db } from "./database.js";
import type { NestExpressApplication } from "@nestjs/platform-express";

export function configureApp(app: INestApplication) {
  app.setGlobalPrefix("api");
  app.use(cookieParser());
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:"],
        },
      },
    }),
  );
  const origins = (
    process.env.CORS_ORIGINS ||
    process.env.APP_ORIGIN ||
    "https://localhost:3443"
  )
    .split(",")
    .map((x) => x.trim());
  app.enableCors({
    origin: origins,
    credentials: true,
    allowedHeaders: ["Content-Type", "X-CSRF-Token"],
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  });
  const counters = new Map<string, { start: number; count: number }>();
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      req.headers.origin &&
      !origins.includes(req.headers.origin)
    ) {
      res
        .status(403)
        .json({ statusCode: 403, message: "Origin is not allowed" });
      return;
    }
    const authPath =
      /^\/api\/auth\/(login|register|forgot-password|reset-password)$/.test(
        req.path,
      );
    if (authPath && process.env.NODE_ENV !== "test") {
      const key = `${req.ip}:${req.path}`,
        time = Date.now();
      const old = counters.get(key);
      const current =
        old && time - old.start < 60000 ? old : { start: time, count: 0 };
      current.count++;
      counters.set(key, current);
      if (counters.size > 10000)
        for (const [k, v] of counters)
          if (time - v.start >= 60000) counters.delete(k);
      if (current.count > 20) {
        res.status(429).json({
          statusCode: 429,
          message: "Too many requests; try again in one minute",
        });
        return;
      }
    }
    next();
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      validationError: { target: false, value: false },
      exceptionFactory: (errors) => {
        const flatten = (items: typeof errors, prefix = ""): any[] =>
          items.flatMap((e) => [
            ...(e.constraints
              ? [
                  {
                    field: `${prefix}${e.property}`,
                    messages: Object.values(e.constraints),
                  },
                ]
              : []),
            ...flatten(e.children || [], `${prefix}${e.property}.`),
          ]);
        return new BadRequestException({
          message: "Validation failed",
          errors: flatten(errors),
        });
      },
    }),
  );
  app.useGlobalFilters(new ApiErrors());
}
export function openApi(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle("Travel Planning and Booking API")
    .setDescription(
      "Milestone 1 REST API. Log in to set secure httpOnly cookies. Swagger reads the separate CSRF cookie for write requests. Tokens are never stored in JavaScript storage. Requirement IDs appear in operation summaries. [Bonus] operations extend mandatory coverage.",
    )
    .setVersion("1.0.0")
    .addCookieAuth("access_token")
    .addCookieAuth("refresh_token", undefined, "refreshCookie")
    .addSecurity("csrf", { type: "apiKey", in: "header", name: "X-CSRF-Token" })
    .build();
  const document = SwaggerModule.createDocument(app, config);
  const permissions = new Map<string, { public: boolean; roles: string[] }>();
  for (const module of app.get(ModulesContainer).values())
    for (const wrapper of module.controllers.values()) {
      const cls = wrapper.metatype;
      if (!cls) continue;
      for (const name of Object.getOwnPropertyNames(cls.prototype)) {
        const method = cls.prototype[name];
        if (typeof method !== "function") continue;
        permissions.set(`${cls.name}_${name}`, {
          public: !!(
            Reflect.getMetadata("public", method) ??
            Reflect.getMetadata("public", cls)
          ),
          roles:
            Reflect.getMetadata("roles", method) ??
            Reflect.getMetadata("roles", cls) ??
            [],
        });
      }
    }
  document.components ||= {};
  document.components.schemas ||= {};
  document.components.schemas.ApiError = {
    type: "object",
    properties: {
      statusCode: { type: "integer", example: 400 },
      message: { type: "string", example: "Validation failed" },
      errors: {
        type: "array",
        items: {
          type: "object",
          properties: {
            field: { type: "string", example: "email" },
            messages: { type: "array", items: { type: "string" } },
          },
        },
      },
      timestamp: { type: "string", format: "date-time" },
    },
  };
  document.components.schemas.BookingResponse = {
    type: "object",
    properties: {
      _id: { type: "string" },
      type: { type: "string", enum: ["flight", "hotel"] },
      status: {
        type: "string",
        enum: [
          "Pending Payment",
          "Confirmed",
          "Completed",
          "Expired",
          "Cancelled",
        ],
      },
      amount: { type: "number", example: 100 },
      currency: { type: "string", example: "USD" },
      holdExpiresAt: { type: "string", format: "date-time" },
      reference: {
        type: "string",
        description: "Generated after verified payment confirmation",
      },
      snapshot: { type: "object", additionalProperties: true },
      policySnapshot: { type: "object", additionalProperties: true },
      policyAcceptedAt: { type: "string", format: "date-time" },
    },
  };
  document.components.schemas.PageResponse = {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: { type: "object", additionalProperties: true },
      },
      page: { type: "integer", example: 1 },
      pageSize: { type: "integer", example: 10 },
      total: { type: "integer", example: 0 },
      pages: { type: "integer", example: 0 },
    },
  };
  for (const item of Object.values(document.paths))
    for (const [verb, operation] of Object.entries(item || {})) {
      if (
        !operation ||
        typeof operation !== "object" ||
        !("responses" in operation)
      )
        continue;
      const op = operation as any;
      const access = permissions.get(op.operationId);
      if (access) {
        op["x-access"] = access.public
          ? "Public (authentication optional)"
          : access.roles.length
            ? access.roles.join(", ")
            : "Any authenticated account";
        op.security = access.public
          ? []
          : [
              { cookie: [] },
              ...(!["get", "head", "options"].includes(verb)
                ? [{ csrf: [] }]
                : []),
            ];
        // Cookie and CSRF must be supplied together, rather than representing alternatives.
        if (!access.public && !["get", "head", "options"].includes(verb))
          op.security = [{ cookie: [], csrf: [] }];
        op.description =
          `${op.description || ""}\nAccess: ${op["x-access"]}. Ownership and provider assignment are enforced in services.`.trim();
      }
      if (op.operationId === "AuthController_refresh") {
        op["x-access"] = "Valid refresh cookie and matching CSRF header";
        op.security = [{ refreshCookie: [], csrf: [] }];
      }
      if (op.operationId === "PaymentsController_webhook")
        op["x-access"] = "Valid Stripe signature; test-mode events only";
      for (const code of ["400", "401", "403", "404", "409", "500", "503"])
        op.responses[code] = {
          description:
            code === "500"
              ? "Unexpected server error (details withheld)"
              : "See common API error; operation-specific message explains the rejected rule",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ApiError" },
              example: {
                statusCode: Number(code),
                message: (
                  {
                    "400": "Validation failed",
                    "401": "Authentication required",
                    "403": "You do not have permission for this operation",
                    "404": "Resource not found",
                    "409":
                      "The request conflicts with the current resource state",
                    "500": "Internal server error",
                    "503":
                      "Required external service is unavailable or not configured",
                  } as Record<string, string>
                )[code],
                ...(code === "400"
                  ? {
                      errors: [
                        {
                          field: "email",
                          messages: ["email must be an email"],
                        },
                      ],
                    }
                  : {}),
                timestamp: "2026-01-01T00:00:00.000Z",
              },
            },
          },
        };
      if (
        [
          "FlightBookingsController_hold",
          "HotelBookingsController_hold",
        ].includes(op.operationId)
      )
        op.responses["201"] = {
          description:
            "Atomic inventory hold created; expires after ten minutes",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/BookingResponse" },
            },
          },
        };
      if (
        [
          "FlightBookingsController_get",
          "HotelBookingsController_get",
        ].includes(op.operationId)
      )
        op.responses["200"] = {
          description: "Own booking including refund records",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/BookingResponse" },
            },
          },
        };
      if (
        [
          "PostsController_list",
          "ItinerariesController_search",
          "HotelsController_search",
          "AdminController_accounts",
        ].includes(op.operationId)
      )
        op.responses["200"] = {
          description:
            "Ten-item page; items is empty when there are no matches",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/PageResponse" },
            },
          },
        };
      op["x-requirements"] = [
        ...new Set(
          (op.summary || "").match(
            /(?:ACC|FLT|HTL|PAY|ITN|BLG|GEN|BON)-\d+(?:-B|a)?/g,
          ) || [],
        ),
      ];
    }
  SwaggerModule.setup("api/docs", app, document, {
    jsonDocumentUrl: "/api/openapi.json",
    swaggerOptions: {
      withCredentials: true,
      persistAuthorization: false,
      requestInterceptor: function (req: any) {
        const cookies = (globalThis as any).document?.cookie || "";
        const value = cookies
          .split("; ")
          .find((v: string) => v.startsWith("csrf_token="));
        if (value)
          req.headers["X-CSRF-Token"] = decodeURIComponent(
            value.slice("csrf_token=".length),
          );
        return req;
      },
    },
  });
  return document;
}
export async function createApp(
  options: {
    httpsOptions?: { key: Buffer; cert: Buffer };
    logger?: false;
  } = {},
) {
  if (!process.env.MONGODB_URI)
    throw new Error("Set MONGODB_URI in backend/.env before starting");
  if (
    !["USD", "EUR", "GBP", "EGP", "AED", "SAR"].includes(
      process.env.PLATFORM_CURRENCY || "USD",
    )
  )
    throw new Error(
      "Platform payments require a supported two-decimal currency. JPY is supported for itinerary display, not platform settlement.",
    );
  if (
    !process.env.JWT_SECRET ||
    process.env.JWT_SECRET.length < 32 ||
    process.env.JWT_SECRET.includes("REPLACE")
  )
    throw new Error("Set JWT_SECRET to at least 32 random characters");
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    ...options,
    rawBody: true,
    bodyParser: true,
  });
  app.useBodyParser("json", { limit: "1mb" });
  configureApp(app);
  const document = openApi(app);
  await app.init();
  const db = app.get(Db);
  const initialized = await Promise.allSettled(
    db.connection.modelNames().map((name) => db.model(name).init()),
  );
  const failed = initialized.find((result) => result.status === "rejected");
  if (failed?.status === "rejected") {
    await app.close();
    throw failed.reason;
  }
  return { app, document };
}
