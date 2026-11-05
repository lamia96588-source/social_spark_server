import "dotenv/config";
import express from "express";
import cors from "cors";
import { toNodeHandler } from "better-auth/node";
import { auth, appUrl, githubEnabled } from "./src/auth.js";
import { connectDatabase, db } from "./src/db.js";
import { eventRoutes } from "./src/events.js";

const app = express();
const allowedOrigins = [appUrl, ...(process.env.ALLOWED_ORIGINS || "").split(",")]
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(async (_req, _res, next) => {
  await connectDatabase();
  next();
});
// Better Auth must receive the original request body before express.json().
app.all("/api/auth/*splat", toNodeHandler(auth));
app.use(express.json({ limit: "64kb" }));

app.get("/health", async (_req, res) => {
  try {
    await db.command({ ping: 1 });
    res.json({ status: "healthy" });
  } catch {
    res.status(503).json({ status: "database unavailable" });
  }
});

app.get("/api/config", (_req, res) => res.json({ githubEnabled }));
app.use("/api", eventRoutes);
app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: "Something went wrong. Please try again." });
});

export default app;

if (!process.env.VERCEL) {
  const port = Number(process.env.PORT) || 5000;
  connectDatabase()
    .then(() => app.listen(port, () => console.log(`SocialSpark API listening on ${port}`)))
    .catch((error) => {
      console.error("MongoDB connection failed:", error);
      process.exitCode = 1;
    });
}
