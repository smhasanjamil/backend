import { Request, Response } from "express";
import catchAsync from "../../utils/catchAsync";
import { SubscriptionService } from "./subscription.service";
import sendResponse from "../../utils/sendResponse";
import status from "http-status";

/* -------------------------------------------------------------------------- */
/*                        SUBSCRIPTION CONTROLLERS                            */
/* -------------------------------------------------------------------------- */

const createSubscription = catchAsync(async (req: Request, res: Response) => {
  const user = req.user!;
  const result = await SubscriptionService.createSubscription(
    user.userId,
    req.body
  );

  sendResponse(res, {
    statusCode: status.CREATED,
    success: true,
    message: "Subscription created successfully",
    data: result,
  });
});

const getUserSubscriptions = catchAsync(async (req: Request, res: Response) => {
  const user = req.user!;
  const result = await SubscriptionService.getUserSubscriptions(user.userId);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Subscriptions retrieved successfully",
    data: result,
  });
});

const getSubscriptionById = catchAsync(async (req: Request, res: Response) => {
  const user = req.user!;
  const result = await SubscriptionService.getSubscriptionById(
    req.params.id,
    user.userId
  );

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Subscription retrieved successfully",
    data: result,
  });
});

const cancelSubscription = catchAsync(async (req: Request, res: Response) => {
  const user = req.user!;
  const result = await SubscriptionService.cancelSubscription(
    user.userId,
    req.body
  );

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Subscription canceled successfully",
    data: result,
  });
});

const resumeSubscription = catchAsync(async (req: Request, res: Response) => {
  const user = req.user!;
  const result = await SubscriptionService.resumeSubscription(
    user.userId,
    req.params.id
  );

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Subscription resumed successfully",
    data: result,
  });
});

/* -------------------------------------------------------------------------- */
/*                           WEBHOOK CONTROLLER                               */
/* -------------------------------------------------------------------------- */

const handleWebhook = catchAsync(async (req: Request, res: Response) => {
  const signature = req.headers["stripe-signature"] as string;
  const result = await SubscriptionService.handleStripeWebhook(
    req.body,
    signature
  );

  res.status(status.OK).json(result);
});

export const SubscriptionController = {
  createSubscription,
  getUserSubscriptions,
  getSubscriptionById,
  cancelSubscription,
  resumeSubscription,
  handleWebhook,
};
