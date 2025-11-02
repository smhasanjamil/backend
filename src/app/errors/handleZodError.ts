import { ZodError } from "zod";

interface IErrorResponse {
  statusCode: number;
  message: string;
  errorMessages: Array<{ path: string; message: string }>;
}

const handleZodError = (error: ZodError): IErrorResponse => {
  const errors = error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));

  return {
    statusCode: 400,
    message: "Validation Error",
    errorMessages: errors,
  };
};

export default handleZodError;
