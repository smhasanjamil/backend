import config from "../../config";
import prisma from "../../config/prisma";
import { stripe } from "../../config/stripe";
import logger from "../../utils/logger";

interface HealthChecks {
  database: boolean;
  stripe: boolean;
  environment: boolean;
}

export class HealthService {
  static async check(): Promise<{
    status: "healthy" | "degraded" | "unhealthy";
    checks: HealthChecks;
    uptime: number;
  }> {
    const checks: HealthChecks = {
      database: false,
      stripe: false,
      environment: false,
    };

    let status: "healthy" | "degraded" | "unhealthy" = "healthy";

    // 1. Database
    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.database = true;
    } catch (err) {
      checks.database = false;
      status = "unhealthy";
      logger.warn("Health check: Database failed", { error: err });
    }

    // 2. Stripe
    try {
      await stripe.products.list({ limit: 1 });
      checks.stripe = true;
    } catch (err) {
      checks.stripe = false;
      if (status !== "unhealthy") status = "degraded";
      logger.warn("Health check: Stripe failed", { error: err });
    }

    // 3. Environment
    checks.environment = ["development", "production"].includes(config.env);
    if (!checks.environment && status !== "unhealthy") {
      status = "degraded";
    }

    return {
      status,
      checks,
      uptime: process.uptime(),
    };
  }
}
