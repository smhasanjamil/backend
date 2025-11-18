// src/modules/auth/auth.validation.ts
import { z } from "zod";

export const signupValidation = {
  body: z.object({
    email: z
      .string({ required_error: "Email is required" })
      .email("Please enter a valid email address"),

    password: z
      .string({ required_error: "Password is required" })
      .min(8, "Password must be at least 8 characters long")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      .regex(/[a-z]/, "Password must contain at least one lowercase letter")
      .regex(/[0-9]/, "Password must contain at least one number"),

    firstName: z
      .string({ required_error: "First name is required" })
      .min(2, "First name must be at least 2 characters")
      .max(50, "First name cannot exceed 50 characters")
      .regex(/^[^0-9]+$/, "First name cannot contain numbers"),

    lastName: z
      .string({ required_error: "Last name is required" })
      .min(2, "Last name must be at least 2 characters")
      .max(50, "Last name cannot exceed 50 characters")
      .regex(/^[^0-9]+$/, "Last name cannot contain numbers"),
  }),
};

export const verifyOTPValidation = {
  body: z.object({
    email: z
      .string({ required_error: "Email is required" })
      .email("Please enter a valid email address"),

    otp: z
      .string({ required_error: "OTP code is required" })
      .length(6, "OTP must be exactly 6 digits")
      .regex(/^\d+$/, "OTP must contain only numbers"),

    type: z.enum(["SIGNUP", "LOGIN", "FORGOT_PASSWORD", "CHANGE_PASSWORD"], {
      required_error: "OTP type is required",
      invalid_type_error: "Invalid OTP type",
    }),
  }),
};

export const loginValidation = {
  body: z.object({
    email: z
      .string({ required_error: "Email is required" })
      .email("Please enter a valid email address"),

    password: z
      .string({ required_error: "Password is required" })
      .min(1, "Password cannot be empty"),
  }),
};

export const refreshTokenValidation = {
  body: z.object({
    refreshToken: z
      .string({ required_error: "Refresh token is required" })
      .min(1, "Refresh token cannot be empty"),
  }),
};

export const forgotPasswordValidation = {
  body: z.object({
    email: z
      .string({ required_error: "Email is required" })
      .email("Please enter a valid email address"),
  }),
};

export const resetPasswordValidation = {
  body: z.object({
    email: z
      .string({ required_error: "Email is required" })
      .email("Please enter a valid email address"),

    otp: z
      .string({ required_error: "OTP code is required" })
      .length(6, "OTP must be exactly 6 digits")
      .regex(/^\d+$/, "OTP must contain only numbers"),

    newPassword: z
      .string({ required_error: "New password is required" })
      .min(8, "Password must be at least 8 characters long")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      .regex(/[a-z]/, "Password must contain at least one lowercase letter")
      .regex(/[0-9]/, "Password must contain at least one number"),
  }),
};

export const changePasswordValidation = {
  body: z.object({
    oldPassword: z
      .string({ required_error: "Current password is required" })
      .min(1, "Current password cannot be empty"),
  }),
};

export const verifyChangePasswordValidation = {
  body: z.object({
    otp: z
      .string({ required_error: "OTP code is required" })
      .length(6, "OTP must be exactly 6 digits")
      .regex(/^\d+$/, "OTP must contain only numbers"),

    newPassword: z
      .string({ required_error: "New password is required" })
      .min(8, "Password must be at least 8 characters long")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      .regex(/[a-z]/, "Password must contain at least one lowercase letter")
      .regex(/[0-9]/, "Password must contain at least one number"),
  }),
};

export const resendOTPValidation = {
  body: z.object({
    email: z
      .string({ required_error: "Email is required" })
      .email("Please enter a valid email address"),
  }),
};
