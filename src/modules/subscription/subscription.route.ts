import { Router } from "express";
import auth from "../../middlewares/authMiddleware";
import validateRequest from "../../middlewares/validateRequest";
import {
  cancelSubscriptionValidation,
  createSubscriptionValidation,
} from "./subscription.validation";
import { SubscriptionController } from "./subscription.controller";

const router = Router();

router.post(
  "/",
  auth(),
  validateRequest(createSubscriptionValidation),
  SubscriptionController.createSubscription
);

router.get(
  "/my-subscriptions",
  auth(),
  SubscriptionController.getUserSubscriptions
);

router.get("/:id", auth(), SubscriptionController.getSubscriptionById);

router.post(
  "/cancel",
  auth(),
  validateRequest(cancelSubscriptionValidation),
  SubscriptionController.cancelSubscription
);

router.post("/:id/resume", auth(), SubscriptionController.resumeSubscription);

export const SubscriptionRoutes = router;
