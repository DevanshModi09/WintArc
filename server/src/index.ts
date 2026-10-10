import { setDefaultResultOrder } from "node:dns";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import compression from "compression";
import express from "express";
import { rateLimit } from "express-rate-limit";
import helmet from "helmet";
import { requireAuth, requireProfile } from "./auth";
import { startProofCleanup } from "./cleanup";
import { prisma } from "./db";
import { env, isProduction } from "./env";
import { errorHandler } from "./errors";
import { logRequests, receiveReports, startLogs } from "./logs";
import { pushRouter, startReminders } from "./push";
import { adminRouter } from "./routes/admin";
import { arcRouter } from "./routes/arc";
import { authRouter } from "./routes/auth";
import { avatarRouter } from "./routes/avatars";
import { publicRouter } from "./routes/public";
import { socialRouter } from "./routes/social";

// Some networks hand out IPv6 routes to Supabase that time out, which would
// make token checks fail at random. Trying IPv4 first avoids that.
setDefaultResultOrder("ipv4first");

const app = express();
app.disable("x-powered-by");
// Hosts like Render, Railway and Fly put one proxy in front of the app.
app.set("trust proxy", env.TRUST_PROXY ?? (isProduction ? 1 : 0));

const supabaseOrigin = new URL(env.SUPABASE_URL).origin;
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        // Google's sign-in button is a script, a stylesheet and a frame of theirs.
        scriptSrc: ["'self'", "https://accounts.google.com/gsi/client"],
        frameSrc: ["https://accounts.google.com/gsi/"],
        // React sets inline style attributes (progress bars).
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://accounts.google.com/gsi/style"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        // Proof photos are served straight from Supabase Storage.
        imgSrc: ["'self'", "data:", "blob:", supabaseOrigin],
        connectSrc: ["'self'", supabaseOrigin, supabaseOrigin.replace(/^http/, "ws"), "https://accounts.google.com/gsi/"],
        frameAncestors: ["'none'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
      },
    },
  }),
);
app.use(compression());

app.use("/api", logRequests);

app.get("/api/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true });
  } catch {
    res.status(503).json({ ok: false });
  }
});

const tooMany = { error: "Too many requests. Give it a minute and try again." };
const limiter = (limit: number) =>
  rateLimit({ windowMs: 60_000, limit, standardHeaders: "draft-8", legacyHeaders: false, message: tooMany });

// Avatars are immutable and cached by the browser, so they get their own,
// roomier budget: a friends list can load dozens at once.
app.use("/api/avatars", limiter(600), avatarRouter);
app.use("/api", limiter(240), (_req, res, next) => {
  // Everything else under /api is personal and must never be cached.
  res.set("Cache-Control", "no-store");
  next();
});
// Roomy enough for a profile photo sent as a base64 data URL.
app.use("/api", express.json({ limit: "400kb" }));
// Browsers report what went wrong for them here, signed in or not.
app.post("/api/logs", limiter(30), receiveReports);
app.use("/api/auth", authRouter);
app.use("/api/public", publicRouter);
app.use("/api/admin", requireAuth, requireProfile, adminRouter);
app.use("/api", requireAuth, requireProfile, arcRouter, socialRouter, pushRouter);
app.use("/api", (_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// In production the server also hands out the built client, so the whole app
// is one process on one origin. In development Vite does this instead.
const clientDist = fileURLToPath(new URL("../../client/dist", import.meta.url));
if (isProduction && existsSync(clientDist)) {
  // Files under /assets have a content hash in their name.
  app.use("/assets", express.static(`${clientDist}/assets`, { immutable: true, maxAge: "1y", fallthrough: false }));
  app.use(express.static(clientDist, { index: false }));
  // Every other URL is a client-side route.
  app.use((req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    res.set("Cache-Control", "no-cache").sendFile("index.html", { root: clientDist });
  });
}

app.use(errorHandler);

const server = app.listen(env.PORT, () => {
  console.log(`API listening on http://localhost:${env.PORT}`);
  startLogs();
  startProofCleanup();
  startReminders();
});

// Let requests in flight finish before the process goes away on a deploy.
function shutdown() {
  server.close(() => {
    prisma.$disconnect().finally(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
