import app from "./app";
import config from "./app/config";
import logger from "./app/utils/logger";

const PORT = config.port;

async function startServer() {
  try {
    app.listen(PORT, () => {
      logger.info(`Server is running on port ${PORT}`);
      logger.info(`Environment: ${config.env}`);
      logger.info(`Health check: ${config.backend_url}/health`);
      logger.info(`API Docs: ${config.backend_url}/api-docs`);
    });
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
}

process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled Rejection:", reason);
  process.exit(1);
});

process.on("uncaughtException", (error) => {
  logger.error("Uncaught Exception:", error);
  process.exit(1);
});

startServer();
