import status from "http-status";
import config from "../../config";
import prisma from "../../config/prisma";
import AppError from "../../errors/AppError";
import comparePassword from "../../utils/comparePassword";
import { sendOTPEmail } from "../../utils/emailSender";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from "../../utils/generateToken";
import hashPassword from "../../utils/hashPassword";
import generateOTP from "../../utils/otpGenerator";
import {
  IChangePasswordRequest,
  IForgotPasswordRequest,
  ILoginRequest,
  IRefreshTokenRequest,
  IResetPasswordRequest,
  ISignupRequest,
  IVerifyChangePasswordRequest,
  IVerifyOTPRequest,
} from "./auth.interface";

/* -------------------------------------------------------------------------- */
/*                                 SIGNUP                                    */
/* -------------------------------------------------------------------------- */
const signup = async (payload: ISignupRequest) => {
  const existingUser = await prisma.user.findUnique({
    where: { email: payload.email },
    select: { id: true, isVerified: true },
  });

  // ── 1. Already verified → block ────────────────────────────────────────
  if (existingUser?.isVerified) {
    throw new AppError(
      status.CONFLICT,
      "Email already registered and verified"
    );
  }

  // ── 2. Exists but NOT verified → resend OTP ─────────────────────────────
  if (existingUser && !existingUser.isVerified) {
    // Invalidate any pending SIGNUP OTPs (prevents spam)
    await prisma.oTP.updateMany({
      where: {
        userId: existingUser.id,
        type: "SIGNUP",
        isUsed: false,
      },
      data: { isUsed: true },
    });

    const otp = generateOTP();
    const expiresAt = new Date(
      Date.now() + config.otp_expiry_minutes * 60 * 1000
    );

    await prisma.oTP.create({
      data: {
        userId: existingUser.id,
        otp,
        type: "SIGNUP",
        expiresAt,
      },
    });

    await sendOTPEmail(payload.email, otp, "SIGNUP");

    return {
      message:
        "Account already exists but not verified. A new OTP has been sent to your e-mail.",
      email: payload.email,
    };
  }

  // ── 3. Brand-new user → create + send OTP ───────────────────────────────
  const hashedPass = await hashPassword(payload.password);

  const user = await prisma.user.create({
    data: {
      email: payload.email,
      password: hashedPass,
      name: payload.name,
      // isVerified defaults to false in the schema
    },
  });

  const otp = generateOTP();
  const expiresAt = new Date(
    Date.now() + config.otp_expiry_minutes * 60 * 1000
  );

  await prisma.oTP.create({
    data: {
      userId: user.id,
      otp,
      type: "SIGNUP",
      expiresAt,
    },
  });

  await sendOTPEmail(user.email, otp, "SIGNUP");

  return {
    message: "Signup successful. Please verify your e-mail with the OTP sent.",
    email: user.email,
  };
};

/* -------------------------------------------------------------------------- */
/*                                 VERIFY OTP                                 */
/* -------------------------------------------------------------------------- */
const verifyOTP = async (payload: IVerifyOTPRequest) => {
  const user = await prisma.user.findUnique({
    where: { email: payload.email },
    select: { id: true, email: true, name: true, role: true },
  });

  if (!user) {
    throw new AppError(status.NOT_FOUND, "User not found");
  }

  const otpRecord = await prisma.oTP.findFirst({
    where: {
      userId: user.id,
      otp: payload.otp,
      type: payload.type as any, // Prisma enum is string-based
      isUsed: false,
      expiresAt: { gte: new Date() },
    },
  });

  if (!otpRecord) {
    throw new AppError(status.BAD_REQUEST, "Invalid or expired OTP");
  }

  // Mark OTP as used
  await prisma.oTP.update({
    where: { id: otpRecord.id },
    data: { isUsed: true },
  });

  // For SIGNUP flow – mark the account verified
  if (payload.type === "SIGNUP") {
    await prisma.user.update({
      where: { id: user.id },
      data: { isVerified: true },
    });
  }

  // Issue tokens (same for all OTP types)
  const tokenPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
  };

  const accessToken = generateAccessToken(tokenPayload);
  const refreshToken = generateRefreshToken(tokenPayload);
  const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      token: refreshToken,
      expiresAt: refreshExpiresAt,
    },
  });

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
  };
};

const login = async (payload: ILoginRequest) => {
  const user = await prisma.user.findUnique({
    where: { email: payload.email },
  });

  if (!user) {
    throw new AppError(401, "Invalid credentials");
  }

  const isPasswordValid = await comparePassword(
    payload.password,
    user.password
  );

  if (!isPasswordValid) {
    throw new AppError(401, "Invalid credentials");
  }

  if (!user.isVerified) {
    throw new AppError(403, "Please verify your email first");
  }

  const otp = generateOTP();
  const expiresAt = new Date(
    Date.now() + config.otp_expiry_minutes * 60 * 1000
  );

  await prisma.oTP.create({
    data: {
      userId: user.id,
      otp,
      type: "LOGIN",
      expiresAt,
    },
  });

  await sendOTPEmail(user.email, otp, "LOGIN");

  return {
    message: "OTP sent to your email. Please verify to complete login.",
    email: user.email,
  };
};

const refreshToken = async (payload: IRefreshTokenRequest) => {
  let decoded;
  try {
    decoded = verifyRefreshToken(payload.refreshToken);
  } catch (error) {
    throw new AppError(401, "Invalid refresh token");
  }

  const tokenRecord = await prisma.refreshToken.findUnique({
    where: { token: payload.refreshToken },
  });

  if (!tokenRecord || tokenRecord.expiresAt < new Date()) {
    throw new AppError(401, "Refresh token expired or invalid");
  }

  const user = await prisma.user.findUnique({
    where: { id: decoded.userId },
  });

  if (!user) {
    throw new AppError(404, "User not found");
  }

  const tokenPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
  };

  const accessToken = generateAccessToken(tokenPayload);

  return { accessToken };
};

const logout = async (payload: IRefreshTokenRequest) => {
  const tokenRecord = await prisma.refreshToken.findUnique({
    where: { token: payload.refreshToken },
  });

  if (!tokenRecord) {
    throw new AppError(404, "Refresh token not found");
  }

  await prisma.refreshToken.delete({
    where: { token: payload.refreshToken },
  });

  return { message: "Logout successful" };
};

const forgotPassword = async (payload: IForgotPasswordRequest) => {
  const user = await prisma.user.findUnique({
    where: { email: payload.email },
  });

  if (!user) {
    throw new AppError(404, "User not found");
  }

  const otp = generateOTP();
  const expiresAt = new Date(
    Date.now() + config.otp_expiry_minutes * 60 * 1000
  );

  await prisma.oTP.create({
    data: {
      userId: user.id,
      otp,
      type: "FORGOT_PASSWORD",
      expiresAt,
    },
  });

  await sendOTPEmail(user.email, otp, "FORGOT_PASSWORD");

  return {
    message: "Password reset OTP sent to your email",
    email: user.email,
  };
};

const resetPassword = async (payload: IResetPasswordRequest) => {
  const user = await prisma.user.findUnique({
    where: { email: payload.email },
  });

  if (!user) {
    throw new AppError(404, "User not found");
  }

  const otpRecord = await prisma.oTP.findFirst({
    where: {
      userId: user.id,
      otp: payload.otp,
      type: "FORGOT_PASSWORD",
      isUsed: false,
      expiresAt: { gte: new Date() },
    },
  });

  if (!otpRecord) {
    throw new AppError(400, "Invalid or expired OTP");
  }

  const hashedPass = await hashPassword(payload.newPassword);

  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashedPass },
  });

  await prisma.oTP.update({
    where: { id: otpRecord.id },
    data: { isUsed: true },
  });

  await prisma.refreshToken.deleteMany({
    where: { userId: user.id },
  });

  return { message: "Password reset successful" };
};

const changePassword = async (payload: IChangePasswordRequest) => {
  const user = await prisma.user.findUnique({
    where: { email: payload.email },
  });

  if (!user) {
    throw new AppError(404, "User not found");
  }

  const isPasswordValid = await comparePassword(
    payload.oldPassword,
    user.password
  );

  if (!isPasswordValid) {
    throw new AppError(401, "Invalid old password");
  }

  const otp = generateOTP();
  const expiresAt = new Date(
    Date.now() + config.otp_expiry_minutes * 60 * 1000
  );

  await prisma.oTP.create({
    data: {
      userId: user.id,
      otp,
      type: "CHANGE_PASSWORD",
      expiresAt,
    },
  });

  await sendOTPEmail(user.email, otp, "CHANGE_PASSWORD");

  return {
    message:
      "OTP sent to your email. Please verify to complete password change.",
    email: user.email,
  };
};

const verifyChangePassword = async (payload: IVerifyChangePasswordRequest) => {
  const user = await prisma.user.findUnique({
    where: { email: payload.email },
  });

  if (!user) {
    throw new AppError(404, "User not found");
  }

  const otpRecord = await prisma.oTP.findFirst({
    where: {
      userId: user.id,
      otp: payload.otp,
      type: "CHANGE_PASSWORD",
      isUsed: false,
      expiresAt: { gte: new Date() },
    },
  });

  if (!otpRecord) {
    throw new AppError(400, "Invalid or expired OTP");
  }

  const hashedPass = await hashPassword(payload.newPassword);

  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashedPass },
  });

  await prisma.oTP.update({
    where: { id: otpRecord.id },
    data: { isUsed: true },
  });

  await prisma.refreshToken.deleteMany({
    where: { userId: user.id },
  });

  return { message: "Password changed successfully" };
};

export const AuthService = {
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
