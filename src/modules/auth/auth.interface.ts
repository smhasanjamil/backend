export interface ISignupRequest {
  email: string;
  password: string;
  name: string;
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
  email: string;
  oldPassword: string;
  newPassword: string;
}

export interface IVerifyChangePasswordRequest {
  email: string;
  otp: string;
  newPassword: string;
}
