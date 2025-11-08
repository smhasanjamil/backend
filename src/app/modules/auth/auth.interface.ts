export interface ISignupRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface IVerifyOTPRequest {
  email: string;
  otp: string;
  type: string;
}

export interface ILoginRequest {
  email: string;
  password: string;
}

export interface IRefreshTokenRequest {
  refreshToken: string;
}

export interface IForgotPasswordRequest {
  email: string;
}

export interface IResetPasswordRequest {
  email: string;
  otp: string;
  newPassword: string;
}

export interface IChangePasswordRequest {
  oldPassword: string;
}

export interface IVerifyChangePasswordRequest {
  otp: string;
  newPassword: string;
}