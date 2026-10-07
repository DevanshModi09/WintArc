import cookieParser from "cookie-parser";
import express from "express";
import { errorHandler } from "./errors";
import { arcRouter } from "./routes/arc";
import { authRouter } from "./routes/auth";
import { socialRouter } from "./routes/social";

const app = express();
app.use(express.json());
app.use(cookieParser());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});
app.use("/api/auth", authRouter);
app.use("/api", arcRouter);
app.use("/api", socialRouter);
app.use(errorHandler);

const port = Number(process.env.PORT) || 4000;
app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
