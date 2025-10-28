import express, { Application } from "express";
import corsHandler from "./middlewares/corsHandler";
import securityHeaders from "./middlewares/securityHeaders";
import { generalLimiter } from "./middlewares/rateLimiter";
import requestLogger from "./middlewares/requestLogger";
import notFoundHandler from "./middlewares/notFoundHandler";
import router from "./routes";
import globalErrorHandler from "./middlewares/globalErrorHandler";
import config from "./config";

const app: Application = express();

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(corsHandler);
app.use(securityHeaders);
app.use(generalLimiter);
app.use(requestLogger);

// === ROOT & HEALTH ===
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Welcome to Your API",
    version: "1.0.0",
    // docs: "https://your-api.com/docs",
    health: `http://localhost:${config.port}/health`,
  });
});

app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Server is healthy",
    timestamp: new Date().toISOString(),
    env: config.env,
  });
});

// === API ROUTES ===
app.use("/api/v1", router);

// 404 - Not Found
app.use(notFoundHandler);

// Global Error Handler - LAST
app.use(globalErrorHandler);

export default app;