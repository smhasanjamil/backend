import app from "./app";
import config from "./app/config";
import prisma from "./app/config/prisma";
import logger from "./app/utils/logger";

const PORT = config.port;

async function checkDatabaseConnection() {
  try {
    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;
    logger.info("✅ Database connection verified");
    return true;
  } catch (error: any) {
    logger.error("❌ Database connection failed:", error.message);
    return false;
  }
}

async function startServer() {
  try {
    // Check database connection before starting server
    const dbConnected = await checkDatabaseConnection();

    if (!dbConnected) {
      logger.error("Cannot start server without database connection");
      process.exit(1);
    }

    // Start server
    const server = app.listen(PORT, () => {
      logger.info(`🚀 Server is running on port ${PORT}`);
      logger.info(`📦 Environment: ${config.env}`);
      logger.info(`🏥 Health check: ${config.backend_url}/health`);
      // logger.info(`📚 API Docs: ${config.backend_url}/api-docs`);
    });

    // Graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      logger.info(`${signal} received. Shutting down gracefully...`);

      server.close(async () => {
        logger.info("HTTP server closed");

        try {
          await prisma.$disconnect();
          logger.info("Database connection closed");
          process.exit(0);
        } catch (error) {
          logger.error("Error during shutdown:", error);
          process.exit(1);
        }
      });

      // Force shutdown after 10 seconds
      setTimeout(() => {
        logger.error("Forcing shutdown after timeout");
        process.exit(1);
      }, 10000);
    };

    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
}

// Handle unhandled rejections
process.on("unhandledRejection", (reason: any) => {
  logger.error("Unhandled Rejection:", reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on("uncaughtException", (error: Error) => {
  logger.error("Uncaught Exception:", error);
  process.exit(1);
});

startServer();
