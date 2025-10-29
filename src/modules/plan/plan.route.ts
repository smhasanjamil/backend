import { Router } from "express";
import auth from "../../middlewares/authMiddleware";
import validateRequest from "../../middlewares/validateRequest";
import { createPlanValidation, updatePlanValidation } from "./plan.validation";
import { PlanController } from "./plan.controller";

const router = Router();

/* -------------------------------------------------------------------------- */
/*                              PLAN ROUTES                                   */
/* -------------------------------------------------------------------------- */

// Admin only routes
router.post(
  "/",
  auth("ADMIN", "SUPER_ADMIN"),
  validateRequest(createPlanValidation),
  PlanController.createPlan
);

router.patch(
  "/:id",
  auth("ADMIN", "SUPER_ADMIN"),
  validateRequest(updatePlanValidation),
  PlanController.updatePlan
);

router.delete("/:id", auth("ADMIN", "SUPER_ADMIN"), PlanController.deletePlan);

// Public routes
router.get("/", PlanController.getAllPlans);
router.get("/:id", PlanController.getPlanById);

export const PlanRoutes = router;
