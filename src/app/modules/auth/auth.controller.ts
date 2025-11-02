import { Request, Response } from "express";
import status from "http-status";
import catchAsync from "../../utils/catchAsync";
import { AuthService } from "./auth.service";
import sendResponse from "../../utils/sendResponse";

const signup = catchAsync(async (req: Request, res: Response) => {
  const result = await AuthService.signup(req.body);

  // 200 when we only resend OTP, 201 for a brand-new user
  const statusCode = result.message.includes("new OTP")
    ? status.OK
    : status.CREATED;

  sendResponse(res, {
    statusCode,
    success: true,
    message: result.message,
    data: { email: result.email },
  });
});

const verifyOTP = catchAsync(async (req: Request, res: Response) => {
  const result = await AuthService.verifyOTP(req.body);
  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "OTP verified successfully",
    data: result,
  });
});

const login = catchAsync(async (req: Request, res: Response) => {
  const result = await AuthService.login(req.body);
  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: result.message,
    data: { email: result.email },
  });
});

const refreshToken = catchAsync(async (req: Request, res: Response) => {
  const result = await AuthService.refreshToken(req.body);
  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Access token refreshed successfully",
    data: result,
  });
});

const logout = catchAsync(async (req: Request, res: Response) => {
  const result = await AuthService.logout(req.body);
  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: result.message,
  });
});

const forgotPassword = catchAsync(async (req: Request, res: Response) => {
  const result = await AuthService.forgotPassword(req.body);
  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: result.message,
    data: { email: result.email },
  });
});

const resetPassword = catchAsync(async (req: Request, res: Response) => {
  const result = await AuthService.resetPassword(req.body);
  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: result.message,
  });
});

const changePassword = catchAsync(async (req: Request, res: Response) => {
  const { oldPassword } = req.body;
  const user = req.user!;

  const result = await AuthService.changePassword({
    userId: user.userId,
    oldPassword,
  });

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: result.message,
  });
});

const verifyChangePassword = catchAsync(async (req: Request, res: Response) => {
  const { otp, newPassword } = req.body;
  const user = req.user!;

  const result = await AuthService.verifyChangePassword({
    userId: user.userId,
    otp,
    newPassword,
  });

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: result.message,
  });
});

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
};
