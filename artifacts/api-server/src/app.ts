import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "path";
import { fileURLToPath } from "url";
import router from "./routes/index.js";
import { logger } from "./lib/logger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app: Express = express();
app.set('trust proxy', 1);
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

const BUILT_IN_ORIGINS = [
  "https://salman67.netlify.app",
  "https://kiarkomu.pages.dev",
];

const extraOrigins = (process.env["ALLOWED_ORIGINS"] ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const ALLOWED_ORIGINS = new Set([...BUILT_IN_ORIGINS, ...extraOrigins]);

const ALLOWED_PATTERNS = [
  /^https?:\/\/[a-z0-9-]+\.netlify\.app$/,
  /^https?:\/\/[a-z0-9-]+\.pages\.dev$/,
  /^https:\/\/[a-z0-9-]+\.onrender\.com$/,
  /^https?:\/\/[a-z0-9.-]+\.replit\.dev$/,
  /^https?:\/\/[a-z0-9-]+\.repl\.co$/,
  /^http:\/\/localhost(:\d+)?$/,
];

function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return true;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  return ALLOWED_PATTERNS.some((re) => re.test(origin));
}

app.use(
  cors({
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) {
        callback(null, true);
      } else {
        logger.warn({ origin }, "CORS request blocked");
        callback(new Error(`Origin not allowed: ${origin}`));
      }
    },
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.use("/api/uploads", express.static(path.join(__dirname, "../public/uploads")));

app.get("/.well-known/assetlinks.json", (_req, res) => {
  const fingerprint = process.env["ANDROID_CERT_FINGERPRINT"] ?? "";
  res.json([{
    relation: ["delegate_permission/common.handle_all_urls"],
    target: {
      namespace: "android_app",
      package_name: "com.shohure.mobile",
      sha256_cert_fingerprints: fingerprint ? [fingerprint] : [],
    },
  }]);
});

app.get("/.well-known/apple-app-site-association", (_req, res) => {
  const teamId = process.env["APPLE_TEAM_ID"] ?? "TEAMID";
  res.type("application/json").json({
    applinks: {
      apps: [],
      details: [{
        appID: `${teamId}.com.shohure.mobile`,
        paths: ["/product/*", "/"],
      }],
    },
  });
});

app.use("/api", router);

// Global error handler — catches any unhandled errors thrown by route handlers.
// Without this, Express sends its default HTML error page and may leave the
// response open. Always keep this as the LAST middleware registered.
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ err }, "Unhandled route error");
  if (!res.headersSent) {
    // Never expose raw DB or internal error messages to the client — they can
    // contain table names, SQL fragments, or credential hints. Log the real
    // error server-side and return a safe generic message instead.
    const isDev = process.env["NODE_ENV"] === "development";
    const message = isDev ? (err?.message ?? "Internal server error") : "Internal server error";
    res.status(500).json({ error: message });
  }
});

export default app;
