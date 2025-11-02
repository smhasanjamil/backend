interface IErrorResponse {
  statusCode: number;
  message: string;
  errorMessages: Array<{ path: string; message: string }>;
}

const handleClientError = (error: any): IErrorResponse => {
  return {
    statusCode: error.response?.status || 500,
    message: error.message || "Client Error",
    errorMessages: [
      {
        path: "",
        message: error.response?.data?.message || error.message,
      },
    ],
  };
};

export default handleClientError;
