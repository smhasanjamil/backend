interface IErrorResponse {
  statusCode: number;
  message: string;
  errorMessages: Array<{ path: string; message: string }>;
}

const handleValidationError = (error: any): IErrorResponse => {
  const errors = Object.values(error.errors || {}).map((err: any) => ({
    path: err.path || "",
    message: err.message || "Validation error",
  }));

  return {
    statusCode: 400,
    message: "Validation Error",
    errorMessages: errors,
  };
};

export default handleValidationError;
