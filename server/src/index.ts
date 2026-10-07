import { setDefaultResultOrder } from "node:dns";
import express from "express";
import { requireAuth, requireProfile } from "./auth";
import { errorHandler } from "./errors";
import { arcRouter } from "./routes/arc";
import { authRouter } from "./routes/auth";
import { avatarRouter } from "./routes/avatars";
import { socialRouter } from "./routes/social";

// Some networks hand out IPv6 routes to Supabase that time out, which would
// make token checks fail at random. Trying IPv4 first avoids that.
setDefaultResultOrder("ipv4first");

const app = express();
// Roomy enough for a profile photo sent as a base64 data URL.
app.use(express.json({ limit: "400kb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});
app.use("/api/avatars", avatarRouter);
app.use("/api/auth", authRouter);
app.use("/api", requireAuth, requireProfile, arcRouter, socialRouter);
app.use(errorHandler);

const port = Number(process.env.PORT) || 4000;
app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
