import { Prisma } from "@prisma/client";

interface IErrorResponse {
  statusCode: number;
  message: string;
  errorMessages: Array<{ path: string; message: string }>;
}

const handlePrismaError = (error: any): IErrorResponse => {
  let statusCode = 500;
  let message = "Database Error";
  const errorMessages: Array<{ path: string; message: string }> = [];

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      statusCode = 409;
      message = "Unique constraint violation";
      const field = (error.meta?.target as string[]) || [];
      errorMessages.push({
        path: field.join("."),
        message: `${field.join(", ")} already exists`,
      });
    } else if (error.code === "P2025") {
      statusCode = 404;
      message = "Record not found";
      errorMessages.push({
        path: "",
        message: error.message,
      });
    }
  }

  return { statusCode, message, errorMessages };
};

export default handlePrismaError;
