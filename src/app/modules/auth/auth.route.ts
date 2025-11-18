import { Router } from "express";
import { authLimiter } from "../../middlewares/rateLimiter";
import validateRequest from "../../middlewares/validateRequest";
import {
  changePasswordValidation,
  forgotPasswordValidation,
  loginValidation,
  refreshTokenValidation,
  resendOTPValidation,
  resetPasswordValidation,
  signupValidation,
  verifyChangePasswordValidation,
  verifyOTPValidation,
} from "./auth.validation";
import { AuthController } from "./auth.controller";
import auth from "../../middlewares/authMiddleware";

const router = Router();

router.post(
  "/signup",
  authLimiter,
  validateRequest(signupValidation),
  AuthController.signup
);

router.post(
  "/verify-otp",
  authLimiter,
  validateRequest(verifyOTPValidation),
  AuthController.verifyOTP
);

router.post(
  "/login",
  authLimiter,
  validateRequest(loginValidation),
  AuthController.login
);

router.post(
  "/refresh-token",
  validateRequest(refreshTokenValidation),
  AuthController.refreshToken
);

router.post(
  "/logout",
  validateRequest(refreshTokenValidation),
  AuthController.logout
);

router.post(
  "/forgot-password",
  authLimiter,
  validateRequest(forgotPasswordValidation),
  AuthController.forgotPassword
);

router.post(
  "/reset-password",
  authLimiter,
  validateRequest(resetPasswordValidation),
  AuthController.resetPassword
);

router.post(
  "/change-password",
  auth(),
  validateRequest(changePasswordValidation),
  AuthController.changePassword
);

router.post(
  "/verify-change-password",
  auth(),
  validateRequest(verifyChangePasswordValidation),
  AuthController.verifyChangePassword
);

// RESEND OTP ENDPOINTS
router.post(
  "/resend-otp/signup",
  authLimiter,
  validateRequest(resendOTPValidation),
  AuthController.resendSignupOTP
);

router.post(
  "/resend-otp/login",
  authLimiter,
  validateRequest(resendOTPValidation),
  AuthController.resendLoginOTP
);

router.post(
  "/resend-otp/forgot-password",
  authLimiter,
  validateRequest(resendOTPValidation),
  AuthController.resendForgotPasswordOTP
);

router.post(
  "/resend-otp/change-password",
  auth(),
  AuthController.resendChangePasswordOTP
);

export const AuthRoutes = router;
