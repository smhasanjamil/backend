import jwt, { Secret, SignOptions } from "jsonwebtoken";
import config from "../config";

interface ITokenPayload {
  userId: string;
  email: string;
  role: string;
}

export const generateAccessToken = (payload: ITokenPayload): string => {
  return jwt.sign(
    payload,
    config.jwt.access_secret as Secret,
    {
      expiresIn: config.jwt.access_expires_in,
    } as SignOptions
  );
};

export const generateRefreshToken = (payload: ITokenPayload): string => {
  return jwt.sign(
    payload,
    config.jwt.refresh_secret as Secret,
    {
      expiresIn: config.jwt.refresh_expires_in,
    } as SignOptions
  );
};

export const verifyAccessToken = (token: string): ITokenPayload => {
  return jwt.verify(token, config.jwt.access_secret as Secret) as ITokenPayload;
};

export const verifyRefreshToken = (token: string): ITokenPayload => {
  return jwt.verify(
    token,
    config.jwt.refresh_secret as Secret
  ) as ITokenPayload;
};
