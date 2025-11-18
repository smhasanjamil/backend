// src/app.ts
import express, { Application } from "express";
import { SubscriptionController } from "./app/modules/subscription/subscription.controller";
import corsHandler from "./app/middlewares/corsHandler";
import securityHeaders from "./app/middlewares/securityHeaders";
import { generalLimiter } from "./app/middlewares/rateLimiter";
import requestLogger from "./app/middlewares/requestLogger";
import config from "./app/config";
import router from "./app/routes";
import notFoundHandler from "./app/middlewares/notFoundHandler";
import globalErrorHandler from "./app/middlewares/globalErrorHandler";
import { healthRoutes } from "./app/modules/health/health.route";

const app: Application = express();

// === STRIPE WEBHOOK RAW BODY ===
const webhookRawBody = express.raw({ type: "application/json" });

app.post(
  "/api/v1/subscriptions/webhook",
  webhookRawBody,
  (req, res, next) => {
    (req as any).rawBody = req.body;
    next();
  },
  SubscriptionController.handleWebhook
);

// === BODY PARSERS ===
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// === GLOBAL MIDDLEWARES ===
app.use(corsHandler);
app.use(securityHeaders);
app.use(generalLimiter);
app.use(requestLogger);

// === ROOT ===
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Welcome to Your API",
    version: "1.0.0",
    health: `${config.backend_url}/health`,
    server: `${config.backend_url}`,
  });
});

// === HEALTH CHECK ===
app.use("/health", healthRoutes);

// === API ROUTES ===
app.use("/api/v1", router);

// === ERROR HANDLERS ===
app.use(notFoundHandler);
app.use(globalErrorHandler);

export default app;
