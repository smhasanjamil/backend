import { Request, Response } from "express";
import catchAsync from "../../utils/catchAsync";
import { AuthService } from "./auth.service";
import sendResponse from "../../utils/sendResponse";
import status from "http-status";

const signup = catchAsync(async (req: Request, res: Response) => {
  const result = await AuthService.signup(req.body);

  sendResponse(res, {
    statusCode: result.message.includes("new OTP") ? status.OK : status.CREATED,
    success: true,
    message: result.message,
    data: { email: result.email }, // Safe: always has email
  });
});

const verifyOTP = catchAsync(async (req: Request, res: Response) => {
  const result = await AuthService.verifyOTP(req.body);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Login successful",
    data: result, // Full user + tokens
  });
});

const login = catchAsync(async (req: Request, res: Response) => {
  const result = await AuthService.login(req.body);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: result.message,
    data: { email: result.email }, // Safe: always has email
  });
});

const refreshToken = catchAsync(async (req: Request, res: Response) => {
  const result = await AuthService.refreshToken(req.body.refreshToken);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Token refreshed successfully",
    data: result, // { accessToken }
  });
});

const logout = catchAsync(async (req: Request, res: Response) => {
  await AuthService.logout(req.body.refreshToken);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Logged out successfully",
  });
});

const forgotPassword = catchAsync(async (req: Request, res: Response) => {
  const result = await AuthService.forgotPassword(req.body.email);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: result.message,
    data: { email: result.email }, // Safe: always has email
  });
});

const resetPassword = catchAsync(async (req: Request, res: Response) => {
  await AuthService.resetPassword(req.body);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Password reset successful. You can now log in.",
  });
});

const changePassword = catchAsync(async (req: Request, res: Response) => {
  const result = await AuthService.changePassword(
    req.user!.userId,
    req.body.oldPassword
  );

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: result.message,
    data: { email: result.email }, // Safe: always has email
  });
});

const verifyChangePassword = catchAsync(async (req: Request, res: Response) => {
  await AuthService.verifyChangePassword(
    req.user!.userId,
    req.body.otp,
    req.body.newPassword
  );

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Password changed successfully",
  });
});

// RESEND OTP ENDPOINTS — ALL NOW SAFE
const resendSignupOTP = catchAsync(async (req: Request, res: Response) => {
  const result = await AuthService.resendOTP(req.body.email, "SIGNUP");

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: result.message,
    data: { email: result.email }, // Safe
  });
});

const resendLoginOTP = catchAsync(async (req: Request, res: Response) => {
  const result = await AuthService.resendOTP(req.body.email, "LOGIN");

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: result.message,
    data: { email: result.email }, // Safe
  });
});

const resendForgotPasswordOTP = catchAsync(
  async (req: Request, res: Response) => {
    const result = await AuthService.resendOTP(
      req.body.email,
      "FORGOT_PASSWORD"
    );

    sendResponse(res, {
      statusCode: status.OK,
      success: true,
      message: result.message,
      data: { email: result.email }, // Safe
    });
  }
);

const resendChangePasswordOTP = catchAsync(
  async (req: Request, res: Response) => {
    const result = await AuthService.resendOTP(
      req.user!.email,
      "CHANGE_PASSWORD"
    );

    sendResponse(res, {
      statusCode: status.OK,
      success: true,
      message: result.message,
      data: { email: result.email }, // Safe
    });
  }
);

export const AuthController = {
  signup,
  verifyOTP,
  login,
  refreshToken,
  logout,
  forgotPassword,
  resetPassword,
  changePassword,
  verifyChangePassword,
  resendSignupOTP,
  resendLoginOTP,
  resendForgotPasswordOTP,
  resendChangePasswordOTP,
};
