import express from "express";
import { requireAuth, requireProfile } from "./auth";
import { errorHandler } from "./errors";
import { arcRouter } from "./routes/arc";
import { authRouter } from "./routes/auth";
import { socialRouter } from "./routes/social";

const app = express();
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});
app.use("/api/auth", authRouter);
app.use("/api", requireAuth, requireProfile, arcRouter, socialRouter);
app.use(errorHandler);

const port = Number(process.env.PORT) || 4000;
app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
