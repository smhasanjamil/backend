import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import handleZodError from "../errors/handleZodError";
import { Prisma } from "@prisma/client";
import handlePrismaError from "../errors/handlePrismaError";
import handleValidationError from "../errors/handleValidationError";
import handleClientError from "../errors/handleClientError";
import AppError from "../errors/AppError";
import logger from "../utils/logger";
import config from "../config";

interface IErrorResponse {
  success: boolean;
  message: string;
  errorMessages?: Array<{ path: string; message: string }>;
  stack?: string;
}

const globalErrorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let statusCode = 500;
  let message = "Internal Server Error";
  let errorMessages: Array<{ path: string; message: string }> = [];

  if (err instanceof ZodError) {
    const simplified = handleZodError(err);
    statusCode = simplified.statusCode;
    message = simplified.message;
    errorMessages = simplified.errorMessages;
  } else if (
    err instanceof Prisma.PrismaClientKnownRequestError ||
    err instanceof Prisma.PrismaClientValidationError
  ) {
    const simplified = handlePrismaError(err);
    statusCode = simplified.statusCode;
    message = simplified.message;
    errorMessages = simplified.errorMessages;
  } else if (err.name === "ValidationError") {
    const simplified = handleValidationError(err);
    statusCode = simplified.statusCode;
    message = simplified.message;
    errorMessages = simplified.errorMessages;
  } else if (err.name === "JsonWebTokenError") {
    statusCode = 401;
    message = "Invalid token";
    errorMessages = [{ path: "", message: "Invalid token" }];
  } else if (err.name === "TokenExpiredError") {
    statusCode = 401;
    message = "Token expired";
    errorMessages = [{ path: "", message: "Token has expired" }];
  } else if (err.isAxiosError) {
    const simplified = handleClientError(err);
    statusCode = simplified.statusCode;
    message = simplified.message;
    errorMessages = simplified.errorMessages;
  } else if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    errorMessages = [{ path: "", message: err.message }];
  } else if (err instanceof Error) {
    message = err.message;
    errorMessages = [{ path: "", message: err.message }];
  }

  logger.error("Error:", {
    statusCode,
    message,
    errorMessages,
    stack: err.stack,
  });

  const response: IErrorResponse = {
    success: false,
    message,
    errorMessages,
  };

  if (config.env === "development") {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
};

export default globalErrorHandler;
