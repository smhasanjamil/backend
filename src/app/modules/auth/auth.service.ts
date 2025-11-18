// import { Prisma } from "@prisma/client";
// import prisma from "../../config/prisma";
// import AppError from "../../errors/AppError";
// import generateOTP from "../../utils/otpGenerator";
// import config from "../../config";
// import { sendOTPEmail } from "../../utils/emailSender";
// import hashPassword from "../../utils/hashPassword";
// import {
//   generateAccessToken,
//   generateRefreshToken,
//   verifyRefreshToken,
// } from "../../utils/generateToken";
// import comparePassword from "../../utils/comparePassword";

// type OTPType = "SIGNUP" | "LOGIN" | "FORGOT_PASSWORD" | "CHANGE_PASSWORD";

// // Reusable selects
// const userBasicSelect = {
//   id: true,
//   email: true,
//   firstName: true,
//   lastName: true,
//   role: true,
//   isActive: true,
//   isDeleted: true,
//   isVerified: true,
// } satisfies Prisma.UserSelect;

// const userAuthSelect = {
//   ...userBasicSelect,
//   password: true,
// } satisfies Prisma.UserSelect;

// // Friendly context for messages
// const getOTPContext = (type: OTPType): string => {
//   const map: Record<OTPType, string> = {
//     SIGNUP: "verification",
//     LOGIN: "login",
//     FORGOT_PASSWORD: "password reset",
//     CHANGE_PASSWORD: "password change",
//   };
//   return map[type];
// };

// /* ============================= REUSABLE RESEND OTP ============================= */
// const resendOTP = async (email: string, type: OTPType) => {
//   // Step 1: Validate user and create OTP in transaction
//   const result = await prisma.$transaction(async (tx) => {
//     const user = await tx.user.findUnique({
//       where: { email },
//       select: userBasicSelect,
//     });

//     if (!user) throw new AppError(404, "No account found with this email");
//     if (user.isDeleted)
//       throw new AppError(410, "This account has been deleted");
//     if (!user.isActive) throw new AppError(403, "Your account is suspended");

//     if (type === "SIGNUP" && user.isVerified) {
//       throw new AppError(400, "Your account is already verified");
//     }
//     if (type === "LOGIN" && !user.isVerified) {
//       throw new AppError(403, "Please verify your email before logging in");
//     }

//     // Mark old OTPs as used
//     await tx.oTP.updateMany({
//       where: { userId: user.id, type, isUsed: false },
//       data: { isUsed: true },
//     });

//     // Generate and save new OTP
//     const otp = generateOTP();
//     await tx.oTP.create({
//       data: {
//         userId: user.id,
//         otp,
//         type,
//         expiresAt: new Date(Date.now() + config.otp_expiry_minutes * 60 * 1000),
//       },
//     });

//     return { email: user.email, otp };
//   });

//   // Step 2: Send email OUTSIDE transaction (async, no await in transaction)
//   // Fire and forget - or handle separately
//   sendOTPEmail(result.email, result.otp, type).catch((error) => {
//     console.error("Failed to send OTP email:", error);
//     // You might want to log this to a monitoring service
//   });

//   return {
//     message: `New ${getOTPContext(type)} OTP sent to your email`,
//     email: result.email,
//   };
// };

// /* ============================= SIGNUP ============================= */
// const signup = async (payload: Prisma.UserCreateInput) => {
//   // Step 1: Database operations in transaction
//   const result = await prisma.$transaction(async (tx) => {
//     const existingUser = await tx.user.findUnique({
//       where: { email: payload.email },
//       select: { id: true, isVerified: true, isDeleted: true },
//     });

//     if (existingUser?.isDeleted) {
//       throw new AppError(
//         410,
//         "This account was previously deleted. Contact support."
//       );
//     }

//     if (existingUser?.isVerified) {
//       throw new AppError(409, "An account with this email already exists");
//     }

//     if (existingUser) {
//       // User exists but not verified - generate new OTP
//       await tx.oTP.updateMany({
//         where: { userId: existingUser.id, type: "SIGNUP", isUsed: false },
//         data: { isUsed: true },
//       });

//       const otp = generateOTP();
//       await tx.oTP.create({
//         data: {
//           userId: existingUser.id,
//           otp,
//           type: "SIGNUP",
//           expiresAt: new Date(
//             Date.now() + config.otp_expiry_minutes * 60 * 1000
//           ),
//         },
//       });

//       return { email: payload.email, otp, isNewUser: false };
//     }

//     // Create new user
//     const hashedPassword = await hashPassword(payload.password as string);
//     const user = await tx.user.create({
//       data: {
//         email: payload.email,
//         password: hashedPassword,
//         firstName: payload.firstName,
//         lastName: payload.lastName,
//       },
//     });

//     const otp = generateOTP();
//     await tx.oTP.create({
//       data: {
//         userId: user.id,
//         otp,
//         type: "SIGNUP",
//         expiresAt: new Date(Date.now() + config.otp_expiry_minutes * 60 * 1000),
//       },
//     });

//     return { email: user.email, otp, isNewUser: true };
//   });

//   // Step 2: Send email OUTSIDE transaction
//   sendOTPEmail(result.email, result.otp, "SIGNUP").catch((error) => {
//     console.error("Failed to send signup OTP email:", error);
//   });

//   return {
//     message: result.isNewUser
//       ? "Signup successful! Please check your email for verification OTP"
//       : "New verification OTP sent to your email",
//     email: result.email,
//   };
// };

// /* ============================= VERIFY OTP ============================= */
// const verifyOTP = async (payload: {
//   email: string;
//   otp: string;
//   type: OTPType;
// }) => {
//   return prisma.$transaction(async (tx) => {
//     const user = await tx.user.findUnique({
//       where: { email: payload.email },
//       select: userBasicSelect,
//     });

//     if (!user) throw new AppError(404, "User not found");
//     if (user.isDeleted) throw new AppError(410, "Account deleted");
//     if (!user.isActive) throw new AppError(403, "Account suspended");

//     const otpRecord = await tx.oTP.findFirst({
//       where: {
//         userId: user.id,
//         otp: payload.otp,
//         type: payload.type,
//         isUsed: false,
//         expiresAt: { gte: new Date() },
//       },
//     });

//     if (!otpRecord) throw new AppError(400, "Invalid or expired OTP");

//     await tx.oTP.update({
//       where: { id: otpRecord.id },
//       data: { isUsed: true },
//     });

//     if (payload.type === "SIGNUP") {
//       await tx.user.update({
//         where: { id: user.id },
//         data: { isVerified: true },
//       });
//     }

//     const accessToken = generateAccessToken({
//       userId: user.id,
//       email: user.email,
//       role: user.role,
//     });

//     const refreshToken = generateRefreshToken({
//       userId: user.id,
//       email: user.email,
//       role: user.role,
//     });

//     await tx.refreshToken.create({
//       data: {
//         userId: user.id,
//         token: refreshToken,
//         expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
//       },
//     });

//     return {
//       accessToken,
//       refreshToken,
//       user: {
//         id: user.id,
//         email: user.email,
//         firstName: user.firstName,
//         lastName: user.lastName,
//         role: user.role,
//       },
//     };
//   });
// };

// /* ============================= LOGIN ============================= */
// const login = async (payload: { email: string; password: string }) => {
//   // Step 1: Validate credentials and create OTP in transaction
//   const result = await prisma.$transaction(async (tx) => {
//     const user = await tx.user.findUnique({
//       where: { email: payload.email },
//       select: userAuthSelect,
//     });

//     if (!user || user.isDeleted)
//       throw new AppError(401, "Invalid email or password");
//     if (!user.isActive) throw new AppError(403, "Your account is suspended");

//     const isValid = await comparePassword(payload.password, user.password);
//     if (!isValid) throw new AppError(401, "Invalid email or password");

//     if (!user.isVerified)
//       throw new AppError(403, "Please verify your email first");

//     // Mark old OTPs as used
//     await tx.oTP.updateMany({
//       where: { userId: user.id, type: "LOGIN", isUsed: false },
//       data: { isUsed: true },
//     });

//     // Generate new OTP
//     const otp = generateOTP();
//     await tx.oTP.create({
//       data: {
//         userId: user.id,
//         otp,
//         type: "LOGIN",
//         expiresAt: new Date(Date.now() + config.otp_expiry_minutes * 60 * 1000),
//       },
//     });

//     return { email: user.email, otp };
//   });

//   // Step 2: Send email OUTSIDE transaction
//   sendOTPEmail(result.email, result.otp, "LOGIN").catch((error) => {
//     console.error("Failed to send login OTP email:", error);
//   });

//   return {
//     message: `Login OTP sent to your email`,
//     email: result.email,
//   };
// };

// /* ============================= REFRESH TOKEN ============================= */
// const refreshToken = async (token: string) => {
//   const decoded = verifyRefreshToken(token);

//   const tokenRecord = await prisma.refreshToken.findUnique({
//     where: { token },
//     include: {
//       user: {
//         select: {
//           id: true,
//           email: true,
//           role: true,
//           isActive: true,
//           isDeleted: true,
//         },
//       },
//     },
//   });

//   if (!tokenRecord || tokenRecord.expiresAt < new Date()) {
//     throw new AppError(401, "Refresh token expired or invalid");
//   }

//   if (
//     !tokenRecord.user ||
//     tokenRecord.user.isDeleted ||
//     !tokenRecord.user.isActive
//   ) {
//     throw new AppError(401, "Account no longer valid");
//   }

//   return {
//     accessToken: generateAccessToken({
//       userId: tokenRecord.user.id,
//       email: tokenRecord.user.email,
//       role: tokenRecord.user.role,
//     }),
//   };
// };

// /* ============================= LOGOUT ============================= */
// const logout = async (token: string) => {
//   await prisma.refreshToken.deleteMany({ where: { token } });
// };

// /* ============================= FORGOT PASSWORD ============================= */
// const forgotPassword = async (email: string) => {
//   // Step 1: Validate and create OTP in transaction
//   const result = await prisma.$transaction(async (tx) => {
//     const user = await tx.user.findUnique({
//       where: { email },
//       select: userBasicSelect,
//     });

//     if (!user) throw new AppError(404, "No account found with this email");
//     if (user.isDeleted)
//       throw new AppError(410, "This account has been deleted");
//     if (!user.isActive) throw new AppError(403, "Your account is suspended");

//     // Mark old OTPs as used
//     await tx.oTP.updateMany({
//       where: { userId: user.id, type: "FORGOT_PASSWORD", isUsed: false },
//       data: { isUsed: true },
//     });

//     // Generate new OTP
//     const otp = generateOTP();
//     await tx.oTP.create({
//       data: {
//         userId: user.id,
//         otp,
//         type: "FORGOT_PASSWORD",
//         expiresAt: new Date(Date.now() + config.otp_expiry_minutes * 60 * 1000),
//       },
//     });

//     return { email: user.email, otp };
//   });

//   // Step 2: Send email OUTSIDE transaction
//   sendOTPEmail(result.email, result.otp, "FORGOT_PASSWORD").catch((error) => {
//     console.error("Failed to send forgot password OTP email:", error);
//   });

//   return {
//     message: "Password reset OTP sent to your email",
//     email: result.email,
//   };
// };

// /* ============================= RESET PASSWORD ============================= */
// const resetPassword = async (payload: {
//   email: string;
//   otp: string;
//   newPassword: string;
// }) => {
//   return prisma.$transaction(async (tx) => {
//     const user = await tx.user.findUnique({
//       where: { email: payload.email },
//       select: { id: true },
//     });
//     if (!user) throw new AppError(404, "User not found");

//     const otpRecord = await tx.oTP.findFirst({
//       where: {
//         userId: user.id,
//         otp: payload.otp,
//         type: "FORGOT_PASSWORD",
//         isUsed: false,
//         expiresAt: { gte: new Date() },
//       },
//     });

//     if (!otpRecord) throw new AppError(400, "Invalid or expired OTP");

//     const hashed = await hashPassword(payload.newPassword);
//     await tx.user.update({
//       where: { id: user.id },
//       data: { password: hashed },
//     });
//     await tx.oTP.update({
//       where: { id: otpRecord.id },
//       data: { isUsed: true },
//     });
//     await tx.refreshToken.deleteMany({ where: { userId: user.id } });
//   });
// };

// /* ============================= CHANGE PASSWORD (INIT) ============================= */
// const changePassword = async (userId: string, oldPassword: string) => {
//   // Step 1: Validate and create OTP in transaction
//   const result = await prisma.$transaction(async (tx) => {
//     const user = await tx.user.findUnique({
//       where: { id: userId },
//       select: { id: true, email: true, password: true },
//     });

//     if (!user) throw new AppError(404, "User not found");

//     const isValid = await comparePassword(oldPassword, user.password);
//     if (!isValid) throw new AppError(401, "Current password is incorrect");

//     // Mark old OTPs as used
//     await tx.oTP.updateMany({
//       where: { userId: user.id, type: "CHANGE_PASSWORD", isUsed: false },
//       data: { isUsed: true },
//     });

//     // Generate new OTP
//     const otp = generateOTP();
//     await tx.oTP.create({
//       data: {
//         userId: user.id,
//         otp,
//         type: "CHANGE_PASSWORD",
//         expiresAt: new Date(Date.now() + config.otp_expiry_minutes * 60 * 1000),
//       },
//     });

//     return { email: user.email, otp };
//   });

//   // Step 2: Send email OUTSIDE transaction
//   sendOTPEmail(result.email, result.otp, "CHANGE_PASSWORD").catch((error) => {
//     console.error("Failed to send change password OTP email:", error);
//   });

//   return {
//     message: "Verification OTP sent to your email",
//     email: result.email,
//   };
// };

// /* ============================= VERIFY CHANGE PASSWORD ============================= */
// const verifyChangePassword = async (
//   userId: string,
//   otp: string,
//   newPassword: string
// ) => {
//   return prisma.$transaction(async (tx) => {
//     const otpRecord = await tx.oTP.findFirst({
//       where: {
//         userId,
//         otp,
//         type: "CHANGE_PASSWORD",
//         isUsed: false,
//         expiresAt: { gte: new Date() },
//       },
//     });

//     if (!otpRecord) throw new AppError(400, "Invalid or expired OTP");

//     const hashed = await hashPassword(newPassword);
//     await tx.user.update({ where: { id: userId }, data: { password: hashed } });
//     await tx.oTP.update({
//       where: { id: otpRecord.id },
//       data: { isUsed: true },
//     });
//     await tx.refreshToken.deleteMany({ where: { userId } });
//   });
// };

// export const AuthService = {
//   signup,
//   verifyOTP,
//   login,
//   refreshToken,
//   logout,
//   forgotPassword,
//   resetPassword,
//   changePassword,
//   verifyChangePassword,
//   resendOTP,
// };

import { Prisma } from "@prisma/client";
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

type OTPType = "SIGNUP" | "LOGIN" | "FORGOT_PASSWORD" | "CHANGE_PASSWORD";

// Reusable selects
const userBasicSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  role: true,
  isActive: true,
  isDeleted: true,
  isVerified: true,
} satisfies Prisma.UserSelect;

const userAuthSelect = {
  ...userBasicSelect,
  password: true,
} satisfies Prisma.UserSelect;

// Friendly context for messages
const getOTPContext = (type: OTPType): string => {
  const map: Record<OTPType, string> = {
    SIGNUP: "verification",
    LOGIN: "login",
    FORGOT_PASSWORD: "password reset",
    CHANGE_PASSWORD: "password change",
  };
  return map[type];
};

/* ============================= REUSABLE RESEND OTP ============================= */
const resendOTP = async (email: string, type: OTPType) => {
  // Step 1: Validate user and create OTP in transaction
  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { email },
      select: userBasicSelect,
    });

    if (!user) throw new AppError(404, "No account found with this email");
    if (user.isDeleted)
      throw new AppError(410, "This account has been deleted");
    if (!user.isActive) throw new AppError(403, "Your account is suspended");

    if (type === "SIGNUP" && user.isVerified) {
      throw new AppError(400, "Your account is already verified");
    }
    if (type === "LOGIN" && !user.isVerified) {
      throw new AppError(403, "Please verify your email before logging in");
    }

    // Mark old OTPs as used
    await tx.oTP.updateMany({
      where: { userId: user.id, type, isUsed: false },
      data: { isUsed: true },
    });

    // Generate and save new OTP
    const otp = generateOTP();
    await tx.oTP.create({
      data: {
        userId: user.id,
        otp,
        type,
        expiresAt: new Date(Date.now() + config.otp_expiry_minutes * 60 * 1000),
      },
    });

    return { email: user.email, otp };
  });

  // Step 2: Send email OUTSIDE transaction (async, no await in transaction)
  // Fire and forget - or handle separately
  sendOTPEmail(result.email, result.otp, type).catch((error) => {
    console.error("Failed to send OTP email:", error);
    // You might want to log this to a monitoring service
  });

  return {
    message: `New ${getOTPContext(type)} OTP sent to your email`,
    email: result.email,
  };
};

/* ============================= SIGNUP ============================= */
const signup = async (payload: Prisma.UserCreateInput) => {
  // Step 1: Database operations in transaction
  const result = await prisma.$transaction(async (tx) => {
    const existingUser = await tx.user.findUnique({
      where: { email: payload.email },
      select: { id: true, isVerified: true, isDeleted: true },
    });

    if (existingUser?.isDeleted) {
      throw new AppError(
        410,
        "This account was previously deleted. Contact support."
      );
    }

    if (existingUser?.isVerified) {
      throw new AppError(409, "An account with this email already exists");
    }

    if (existingUser) {
      // User exists but not verified - generate new OTP
      await tx.oTP.updateMany({
        where: { userId: existingUser.id, type: "SIGNUP", isUsed: false },
        data: { isUsed: true },
      });

      const otp = generateOTP();
      await tx.oTP.create({
        data: {
          userId: existingUser.id,
          otp,
          type: "SIGNUP",
          expiresAt: new Date(
            Date.now() + config.otp_expiry_minutes * 60 * 1000
          ),
        },
      });

      return { email: payload.email, otp, isNewUser: false };
    }

    // Create new user
    const hashedPassword = await hashPassword(payload.password as string);
    const user = await tx.user.create({
      data: {
        email: payload.email,
        password: hashedPassword,
        firstName: payload.firstName,
        lastName: payload.lastName,
      },
    });

    const otp = generateOTP();
    await tx.oTP.create({
      data: {
        userId: user.id,
        otp,
        type: "SIGNUP",
        expiresAt: new Date(Date.now() + config.otp_expiry_minutes * 60 * 1000),
      },
    });

    return { email: user.email, otp, isNewUser: true };
  });

  // Step 2: Send email OUTSIDE transaction
  sendOTPEmail(result.email, result.otp, "SIGNUP").catch((error) => {
    console.error("Failed to send signup OTP email:", error);
  });

  return {
    message: result.isNewUser
      ? "Signup successful! Please check your email for verification OTP"
      : "New verification OTP sent to your email",
    email: result.email,
  };
};

/* ============================= VERIFY OTP ============================= */
const verifyOTP = async (payload: {
  email: string;
  otp: string;
  type: OTPType;
}) => {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { email: payload.email },
      select: userBasicSelect,
    });

    if (!user) throw new AppError(404, "User not found");
    if (user.isDeleted) throw new AppError(410, "Account deleted");
    if (!user.isActive) throw new AppError(403, "Account suspended");

    const otpRecord = await tx.oTP.findFirst({
      where: {
        userId: user.id,
        otp: payload.otp,
        type: payload.type,
        isUsed: false,
        expiresAt: { gte: new Date() },
      },
    });

    if (!otpRecord) throw new AppError(400, "Invalid or expired OTP");

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

    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    const refreshToken = generateRefreshToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    await tx.refreshToken.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
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

/* ============================= LOGIN ============================= */
const login = async (payload: { email: string; password: string }) => {
  // Step 1: Validate credentials and create OTP in transaction
  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { email: payload.email },
      select: userAuthSelect,
    });

    if (!user || user.isDeleted)
      throw new AppError(401, "Invalid email or password");
    if (!user.isActive) throw new AppError(403, "Your account is suspended");

    const isValid = await comparePassword(payload.password, user.password);
    if (!isValid) throw new AppError(401, "Invalid email or password");

    if (!user.isVerified)
      throw new AppError(403, "Please verify your email first");

    // Mark old OTPs as used
    await tx.oTP.updateMany({
      where: { userId: user.id, type: "LOGIN", isUsed: false },
      data: { isUsed: true },
    });

    // Generate new OTP
    const otp = generateOTP();
    await tx.oTP.create({
      data: {
        userId: user.id,
        otp,
        type: "LOGIN",
        expiresAt: new Date(Date.now() + config.otp_expiry_minutes * 60 * 1000),
      },
    });

    return { email: user.email, otp };
  });

  // Step 2: Send email OUTSIDE transaction
  sendOTPEmail(result.email, result.otp, "LOGIN").catch((error) => {
    console.error("Failed to send login OTP email:", error);
  });

  return {
    message: `Login OTP sent to your email`,
    email: result.email,
  };
};

/* ============================= REFRESH TOKEN ============================= */
const refreshToken = async (token: string) => {
  const decoded = verifyRefreshToken(token);

  const tokenRecord = await prisma.refreshToken.findUnique({
    where: { token },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          role: true,
          isActive: true,
          isDeleted: true,
        },
      },
    },
  });

  if (!tokenRecord || tokenRecord.expiresAt < new Date()) {
    throw new AppError(401, "Refresh token expired or invalid");
  }

  if (
    !tokenRecord.user ||
    tokenRecord.user.isDeleted ||
    !tokenRecord.user.isActive
  ) {
    throw new AppError(401, "Account no longer valid");
  }

  return {
    accessToken: generateAccessToken({
      userId: tokenRecord.user.id,
      email: tokenRecord.user.email,
      role: tokenRecord.user.role,
    }),
  };
};

/* ============================= LOGOUT ============================= */
const logout = async (token: string) => {
  await prisma.refreshToken.deleteMany({ where: { token } });
};

/* ============================= FORGOT PASSWORD ============================= */
const forgotPassword = async (email: string) => {
  // Step 1: Validate and create OTP in transaction
  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { email },
      select: userBasicSelect,
    });

    if (!user) throw new AppError(404, "No account found with this email");
    if (user.isDeleted)
      throw new AppError(410, "This account has been deleted");
    if (!user.isActive) throw new AppError(403, "Your account is suspended");

    // Mark old OTPs as used
    await tx.oTP.updateMany({
      where: { userId: user.id, type: "FORGOT_PASSWORD", isUsed: false },
      data: { isUsed: true },
    });

    // Generate new OTP
    const otp = generateOTP();
    await tx.oTP.create({
      data: {
        userId: user.id,
        otp,
        type: "FORGOT_PASSWORD",
        expiresAt: new Date(Date.now() + config.otp_expiry_minutes * 60 * 1000),
      },
    });

    return { email: user.email, otp };
  });

  // Step 2: Send email OUTSIDE transaction
  sendOTPEmail(result.email, result.otp, "FORGOT_PASSWORD").catch((error) => {
    console.error("Failed to send forgot password OTP email:", error);
  });

  return {
    message: "Password reset OTP sent to your email",
    email: result.email,
  };
};

/* ============================= RESET PASSWORD ============================= */
const resetPassword = async (payload: {
  email: string;
  otp: string;
  newPassword: string;
}) => {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { email: payload.email },
      select: { id: true },
    });
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

    const hashed = await hashPassword(payload.newPassword);
    await tx.user.update({
      where: { id: user.id },
      data: { password: hashed },
    });
    await tx.oTP.update({
      where: { id: otpRecord.id },
      data: { isUsed: true },
    });
    await tx.refreshToken.deleteMany({ where: { userId: user.id } });
  });
};

/* ============================= CHANGE PASSWORD (INIT) ============================= */
const changePassword = async (userId: string, oldPassword: string) => {
  // Step 1: Validate and create OTP in transaction
  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, password: true },
    });

    if (!user) throw new AppError(404, "User not found");

    const isValid = await comparePassword(oldPassword, user.password);
    if (!isValid) throw new AppError(401, "Current password is incorrect");

    // Mark old OTPs as used
    await tx.oTP.updateMany({
      where: { userId: user.id, type: "CHANGE_PASSWORD", isUsed: false },
      data: { isUsed: true },
    });

    // Generate new OTP
    const otp = generateOTP();
    await tx.oTP.create({
      data: {
        userId: user.id,
        otp,
        type: "CHANGE_PASSWORD",
        expiresAt: new Date(Date.now() + config.otp_expiry_minutes * 60 * 1000),
      },
    });

    return { email: user.email, otp };
  });

  // Step 2: Send email OUTSIDE transaction
  sendOTPEmail(result.email, result.otp, "CHANGE_PASSWORD").catch((error) => {
    console.error("Failed to send change password OTP email:", error);
  });

  return {
    message: "Verification OTP sent to your email",
    email: result.email,
  };
};

/* ============================= VERIFY CHANGE PASSWORD ============================= */
const verifyChangePassword = async (
  userId: string,
  otp: string,
  newPassword: string
) => {
  return prisma.$transaction(async (tx) => {
    const otpRecord = await tx.oTP.findFirst({
      where: {
        userId,
        otp,
        type: "CHANGE_PASSWORD",
        isUsed: false,
        expiresAt: { gte: new Date() },
      },
    });

    if (!otpRecord) throw new AppError(400, "Invalid or expired OTP");

    const hashed = await hashPassword(newPassword);
    await tx.user.update({ where: { id: userId }, data: { password: hashed } });
    await tx.oTP.update({
      where: { id: otpRecord.id },
      data: { isUsed: true },
    });
    await tx.refreshToken.deleteMany({ where: { userId } });
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
  resendOTP,
};
