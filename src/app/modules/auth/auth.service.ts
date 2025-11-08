import status from "http-status";
import {
  IForgotPasswordRequest,
  ILoginRequest,
  IRefreshTokenRequest,
  IResetPasswordRequest,
  ISignupRequest,
  IVerifyOTPRequest,
} from "./auth.interface";
import prisma from "../../config/prisma";
import AppError from "../../errors/AppError";
import generateOTP from "../../utils/otpGenerator";
import config from "../../config";
import { sendOTPEmail } from "../../utils/emailSender";
import hashPassword from "../../utils/hashPassword";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from "../../utils/generateToken";
import comparePassword from "../../utils/comparePassword";

/* -------------------------------------------------------------------------- */
/*                                 HELPERS                                    */
/* -------------------------------------------------------------------------- */
const parseJwtExpiry = (expiresIn: string): number => {
  const match = expiresIn.match(/^(\d+)([dh])$/);
  if (!match) return 15 * 60;
  const value = parseInt(match[1], 10);
  const unit = match[2];
  const multipliers: Record<string, number> = {
    d: 24 * 60 * 60 * 1000,
    h: 60 * 60 * 1000,
  };
  return value * multipliers[unit];
};

/* -------------------------------------------------------------------------- */
/*                                 SIGNUP                                    */
/* -------------------------------------------------------------------------- */
const signup = async (payload: ISignupRequest) => {
  return prisma.$transaction(async (tx) => {
    const existingUser = await tx.user.findUnique({
      where: { email: payload.email },
      select: { id: true, isVerified: true },
    });

    if (existingUser?.isVerified) {
      throw new AppError(
        status.CONFLICT,
        "Email already registered and verified"
      );
    }

    if (existingUser && !existingUser.isVerified) {
      await tx.oTP.updateMany({
        where: { userId: existingUser.id, type: "SIGNUP", isUsed: false },
        data: { isUsed: true },
      });

      const otp = generateOTP();
      const expiresAt = new Date(
        Date.now() + config.otp_expiry_minutes * 60 * 1000
      );

      await tx.oTP.create({
        data: { userId: existingUser.id, otp, type: "SIGNUP", expiresAt },
      });

      await sendOTPEmail(payload.email, otp, "SIGNUP");

      return {
        message:
          "Account already exists but not verified. A new OTP has been sent to your e-mail.",
        email: payload.email,
      };
    }

    const hashedPass = await hashPassword(payload.password);
    const user = await tx.user.create({
      data: {
        email: payload.email,
        password: hashedPass,
        firstName: payload.firstName,
        lastName: payload.lastName,
      },
    });

    const otp = generateOTP();
    const expiresAt = new Date(
      Date.now() + config.otp_expiry_minutes * 60 * 1000
    );

    await tx.oTP.create({
      data: { userId: user.id, otp, type: "SIGNUP", expiresAt },
    });

    await sendOTPEmail(user.email, otp, "SIGNUP");

    return {
      message:
        "Signup successful. Please verify your e-mail with the OTP sent.",
      email: user.email,
    };
  });
};

/* -------------------------------------------------------------------------- */
/*                                 VERIFY OTP                                 */
/* -------------------------------------------------------------------------- */
const verifyOTP = async (payload: IVerifyOTPRequest) => {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { email: payload.email },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
      },
    });

    if (!user) throw new AppError(status.NOT_FOUND, "User not found");

    const otpRecord = await tx.oTP.findFirst({
      where: {
        userId: user.id,
        otp: payload.otp,
        type: payload.type as any,
        isUsed: false,
        expiresAt: { gte: new Date() },
      },
    });

    if (!otpRecord)
      throw new AppError(status.BAD_REQUEST, "Invalid or expired OTP");

    await tx.oTP.update({
      where: { id: otpRecord.id },
      data: { isUsed: true },
    });

    if (payload.type === "SIGNUP") {
      await tx.user.update({
        where: { id: user.id },
        data: { isVerified: true },
      });
    }

    const tokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);
    const refreshExpiresAt = new Date(
      Date.now() + parseJwtExpiry(config.jwt.refresh_expires_in)
    );

    await tx.refreshToken.create({
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
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    };
  });
};

/* -------------------------------------------------------------------------- */
/*                                 LOGIN                                      */
/* -------------------------------------------------------------------------- */
const login = async (payload: ILoginRequest) => {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { email: payload.email } });
    if (!user) throw new AppError(401, "Invalid credentials");

    const isPasswordValid = await comparePassword(
      payload.password,
      user.password
    );
    if (!isPasswordValid) throw new AppError(401, "Invalid credentials");

    if (!user.isVerified)
      throw new AppError(403, "Please verify your email first");

    const otp = generateOTP();
    const expiresAt = new Date(
      Date.now() + config.otp_expiry_minutes * 60 * 1000
    );

    await tx.oTP.create({
      data: { userId: user.id, otp, type: "LOGIN", expiresAt },
    });

    await sendOTPEmail(user.email, otp, "LOGIN");

    return {
      message: "OTP sent to your email. Please verify to complete login.",
      email: user.email,
    };
  });
};

/* -------------------------------------------------------------------------- */
/*                                 REFRESH TOKEN                              */
/* -------------------------------------------------------------------------- */
const refreshToken = async (payload: IRefreshTokenRequest) => {
  let decoded;
  try {
    decoded = verifyRefreshToken(payload.refreshToken);
  } catch {
    throw new AppError(401, "Invalid refresh token");
  }

  const tokenRecord = await prisma.refreshToken.findUnique({
    where: { token: payload.refreshToken },
  });

  if (!tokenRecord || tokenRecord.expiresAt < new Date())
    throw new AppError(401, "Refresh token expired or invalid");

  const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
  if (!user) throw new AppError(404, "User not found");

  const tokenPayload = { userId: user.id, email: user.email, role: user.role };
  const accessToken = generateAccessToken(tokenPayload);

  return { accessToken };
};

/* -------------------------------------------------------------------------- */
/*                                 LOGOUT                                     */
/* -------------------------------------------------------------------------- */
const logout = async (payload: IRefreshTokenRequest) => {
  const tokenRecord = await prisma.refreshToken.findUnique({
    where: { token: payload.refreshToken },
  });

  if (!tokenRecord) throw new AppError(404, "Refresh token not found");

  await prisma.refreshToken.delete({ where: { token: payload.refreshToken } });
  return { message: "Logout successful" };
};

/* -------------------------------------------------------------------------- */
/*                                 FORGOT PASSWORD                            */
/* -------------------------------------------------------------------------- */
const forgotPassword = async (payload: IForgotPasswordRequest) => {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { email: payload.email } });
    if (!user) throw new AppError(404, "User not found");

    const otp = generateOTP();
    const expiresAt = new Date(
      Date.now() + config.otp_expiry_minutes * 60 * 1000
    );

    await tx.oTP.create({
      data: { userId: user.id, otp, type: "FORGOT_PASSWORD", expiresAt },
    });

    await sendOTPEmail(user.email, otp, "FORGOT_PASSWORD");

    return {
      message: "Password reset OTP sent to your email",
      email: user.email,
    };
  });
};

/* -------------------------------------------------------------------------- */
/*                                 RESET PASSWORD                             */
/* -------------------------------------------------------------------------- */
const resetPassword = async (payload: IResetPasswordRequest) => {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { email: payload.email } });
    if (!user) throw new AppError(404, "User not found");

    const otpRecord = await tx.oTP.findFirst({
      where: {
        userId: user.id,
        otp: payload.otp,
        type: "FORGOT_PASSWORD",
        isUsed: false,
        expiresAt: { gte: new Date() },
      },
    });

    if (!otpRecord) throw new AppError(400, "Invalid or expired OTP");

    const hashedPass = await hashPassword(payload.newPassword);

    await tx.user.update({
      where: { id: user.id },
      data: { password: hashedPass },
    });

    await tx.oTP.update({
      where: { id: otpRecord.id },
      data: { isUsed: true },
    });

    await tx.refreshToken.deleteMany({ where: { userId: user.id } });

    return { message: "Password reset successful" };
  });
};

/* -------------------------------------------------------------------------- */
/*                                 CHANGE PASSWORD                            */
/* -------------------------------------------------------------------------- */
const changePassword = async (payload: {
  userId: string;
  oldPassword: string;
}) => {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: payload.userId } });
    if (!user) throw new AppError(404, "User not found");

    const isValid = await comparePassword(payload.oldPassword, user.password);
    if (!isValid) throw new AppError(401, "Invalid old password");

    await tx.oTP.updateMany({
      where: { userId: user.id, type: "CHANGE_PASSWORD", isUsed: false },
      data: { isUsed: true },
    });

    const otp = generateOTP();
    const expiresAt = new Date(
      Date.now() + config.otp_expiry_minutes * 60 * 1000
    );

    await tx.oTP.create({
      data: { userId: user.id, otp, type: "CHANGE_PASSWORD", expiresAt },
    });

    await sendOTPEmail(user.email, otp, "CHANGE_PASSWORD");

    return {
      message: "OTP sent to your email. Verify to complete password change.",
    };
  });
};

const verifyChangePassword = async (payload: {
  userId: string;
  otp: string;
  newPassword: string;
}) => {
  return prisma.$transaction(async (tx) => {
    const otpRecord = await tx.oTP.findFirst({
      where: {
        userId: payload.userId,
        otp: payload.otp,
        type: "CHANGE_PASSWORD",
        isUsed: false,
        expiresAt: { gte: new Date() },
      },
    });

    if (!otpRecord) throw new AppError(400, "Invalid or expired OTP");

    const hashedPass = await hashPassword(payload.newPassword);

    await tx.user.update({
      where: { id: payload.userId },
      data: { password: hashedPass },
    });

    await tx.oTP.update({
      where: { id: otpRecord.id },
      data: { isUsed: true },
    });

    await tx.refreshToken.deleteMany({ where: { userId: payload.userId } });

    return { message: "Password changed successfully" };
  });
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
