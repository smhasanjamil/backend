import { UserRole } from "@prisma/client";
import { Request, Response, NextFunction } from "express";
import catchAsync from "../utils/catchAsync";
import AppError from "../errors/AppError";
import { verifyAccessToken } from "../utils/generateToken";
import prisma from "../config/prisma";

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
      let decoded;
      try {
        decoded = verifyAccessToken(token);
      } catch (error) {
        throw new AppError(401, "Invalid or expired access token");
      }

      // 3. Find user in DB with status checks
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          email: true,
          role: true,
          isActive: true,
          isDeleted: true,
        },
      });

      if (!user) {
        throw new AppError(401, "User no longer exists");
      }

      if (user.isDeleted) {
        throw new AppError(401, "User account has been deleted");
      }

      if (!user.isActive) {
        throw new AppError(403, "User account is inactive");
      }

      // 4. Role check with better error message
      if (requiredRoles.length > 0 && !requiredRoles.includes(user.role)) {
        const requiredRolesStr = requiredRoles.join(" or ");
        throw new AppError(403, `Access denied. Insufficient permissions`);
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
