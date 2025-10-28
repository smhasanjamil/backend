import { UserRole } from "@prisma/client";
import catchAsync from "../utils/catchAsync";
import { Request, Response, NextFunction } from "express";
import AppError from "../errors/AppError";
import { verifyAccessToken } from "../utils/generateToken";
import prisma from "../config/prisma";

// Optional: Define payload shape
interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
}

// Unified auth middleware
const auth = (...requiredRoles: UserRole[]) => {
  return catchAsync(
    async (req: Request, _res: Response, next: NextFunction) => {
      // 1. Get token
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith("Bearer ")) {
        throw new AppError(401, "Access token is required");
      }

      const token = authHeader.split(" ")[1];
      if (!token) throw new AppError(401, "Access token is required");

      // 2. Verify token
      let decoded: JwtPayload;
      try {
        decoded = verifyAccessToken(token) as JwtPayload;
      } catch (error) {
        throw new AppError(401, "Invalid or expired access token");
      }

      // 3. Find user in DB (optional: for freshness)
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, email: true, role: true },
      });

      if (!user) {
        throw new AppError(401, "User no longer exists");
      }

      // 4. Role check
      if (requiredRoles.length > 0 && !requiredRoles.includes(user.role)) {
        throw new AppError(403, "Forbidden: Insufficient permissions");
      }

      // 5. Attach user to request
      req.user = {
        userId: user.id,
        email: user.email,
        role: user.role,
      };

      next();
    }
  );
};

export default auth;
