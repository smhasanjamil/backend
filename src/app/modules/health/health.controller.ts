import { Request, Response } from "express";
import { HealthService } from "./health.service";

export const healthCheckController = async (req: Request, res: Response) => {
  const start = Date.now();
  const { status, checks, uptime } = await HealthService.check();

  const response = {
    status,
    checks,
    timestamp: new Date().toISOString(),
    uptime,
    version: "1.0.0",
  };

  const duration = Date.now() - start;
  res.status(status === "unhealthy" ? 503 : 200).json(response);
};
