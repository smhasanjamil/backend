import { Router } from "express";
import { authLimiter } from "../../middlewares/rateLimiter";
import { AuthController } from "./auth.controller";
import validateRequest from "../../middlewares/validateRequest";
import { changePasswordValidation, forgotPasswordValidation, loginValidation, refreshTokenValidation, resetPasswordValidation, signupValidation, verifyChangePasswordValidation, verifyOTPValidation } from "./auth.validation";

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
  authLimiter,
  validateRequest(changePasswordValidation),
  AuthController.changePassword
);

router.post(
  "/verify-change-password",
  authLimiter,
  validateRequest(verifyChangePasswordValidation),
  AuthController.verifyChangePassword
);

export const AuthRoutes = router;
