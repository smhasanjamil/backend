import app from "./app";
import config from "./app/config";
import prisma from "./app/config/prisma";
import logger from "./app/utils/logger";

const PORT = config.port;

async function startServer() {
  try {
    // Start server WITHOUT checking database first
    const server = app.listen(PORT, () => {
      logger.info(`🚀 Server is running on port ${PORT}`);
      logger.info(`📦 Environment: ${config.env}`);
      logger.info(`🏥 Server: ${config.backend_url}`);
      logger.info(`🏥 Health check: ${config.backend_url}/health`);
    });

    // Graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      logger.info(`\n${signal} received. Shutting down gracefully...`);

      server.close(async () => {
        logger.info("✅ HTTP server closed");

        try {
          await prisma.$disconnect();
          logger.info("✅ Database connections closed");
          process.exit(0);
        } catch (error) {
          logger.error("❌ Error during database disconnect:", error);
          process.exit(1);
        }
      });

      setTimeout(() => {
        logger.error("⚠️ Forced shutdown after 10s timeout");
        process.exit(1);
      }, 10000);
    };

    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));
  } catch (error) {
    logger.error("❌ Failed to start server:", error);
    process.exit(1);
  }
}

process.on("unhandledRejection", (reason: any) => {
  logger.error("❌ Unhandled Rejection:", reason);
  process.exit(1);
});

process.on("uncaughtException", (error: Error) => {
  logger.error("❌ Uncaught Exception:", error);
  process.exit(1);
});

startServer();
