import express, { Application } from "express";
import corsHandler from "./middlewares/corsHandler";
import securityHeaders from "./middlewares/securityHeaders";
import { generalLimiter } from "./middlewares/rateLimiter";
import requestLogger from "./middlewares/requestLogger";
import notFoundHandler from "./middlewares/notFoundHandler";
import router from "./routes";
import globalErrorHandler from "./middlewares/globalErrorHandler";
import config from "./config";
import { SubscriptionController } from "./modules/subscription/subscription.controller";

const app: Application = express();

// === RAW BODY FOR STRIPE WEBHOOK (MUST BE BEFORE express.json()) ===
const webhookRawBody = express.raw({ type: "application/json" });

// Apply raw body parser ONLY to the webhook route
app.post(
  "/api/v1/subscriptions/webhook",
  webhookRawBody,
  (req, res, next) => {
    // Save raw body for Stripe verification
    (req as any).rawBody = req.body;
    next();
  },
  SubscriptionController.handleWebhook
);

// === NOW apply JSON parser for ALL other routes ===
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// === Global Middlewares ===
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

// === 404 & Error Handler ===
app.use(notFoundHandler);
app.use(globalErrorHandler);

export default app;
