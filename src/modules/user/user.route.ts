import { Router } from "express";
import auth from "../../middlewares/authMiddleware";
import { UserController } from "./user.controller";
import validateRequest from "../../middlewares/validateRequest";
import { getUsersValidation, updateUserValidation } from "./user.validation";

const router = Router();

// Public profile (logged-in user only)
router.get("/profile", auth(), UserController.getProfile);

// Update own profile
router.patch(
  "/profile",
  auth(),
  validateRequest(updateUserValidation),
  UserController.updateProfile
);

// Admin-only: get all users
router.get(
  "/",
  auth("SUPER_ADMIN", "ADMIN"),
  validateRequest(getUsersValidation),
  UserController.getAllUsers
);

// Super admin only: delete user
router.delete("/:id", auth("SUPER_ADMIN"), UserController.deleteUser);

export const UserRoutes = router;
