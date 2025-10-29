import { Request, Response } from "express";
import status from "http-status";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { PlanService } from "./plan.service";
/* -------------------------------------------------------------------------- */
/*                            PLAN CONTROLLERS                                */
/* -------------------------------------------------------------------------- */

const createPlan = catchAsync(async (req: Request, res: Response) => {
  const result = await PlanService.createPlan(req.body);

  sendResponse(res, {
    statusCode: status.CREATED,
    success: true,
    message: "Plan created successfully",
    data: result,
  });
});

const getAllPlans = catchAsync(async (req: Request, res: Response) => {
  const { isActive } = req.query;

  const filters: any = {};
  if (isActive !== undefined) {
    filters.isActive = isActive === "true";
  }

  const result = await PlanService.getAllPlans(filters);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Plans retrieved successfully",
    data: result,
  });
});

const getPlanById = catchAsync(async (req: Request, res: Response) => {
  const result = await PlanService.getPlanById(req.params.id);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Plan retrieved successfully",
    data: result,
  });
});

const updatePlan = catchAsync(async (req: Request, res: Response) => {
  const result = await PlanService.updatePlan(req.params.id, req.body);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Plan updated successfully",
    data: result,
  });
});

const deletePlan = catchAsync(async (req: Request, res: Response) => {
  const result = await PlanService.deletePlan(req.params.id);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: result.message,
  });
});

export const PlanController = {
  createPlan,
  getAllPlans,
  getPlanById,
  updatePlan,
  deletePlan,
};
