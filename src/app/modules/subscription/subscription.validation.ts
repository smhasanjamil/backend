import { z } from "zod";

export const createSubscriptionValidation = {
  body: z.object({
    planId: z.string().uuid("Invalid plan ID"),
    paymentMethodId: z
      .string()
      .min(1, "Payment method ID is required")
      .startsWith("pm_", "Invalid payment method ID format"),
  }),
};

export const cancelSubscriptionValidation = {
  body: z.object({
    subscriptionId: z.string().uuid("Invalid subscription ID"),
    cancelAtPeriodEnd: z.boolean().optional(),
  }),
};
