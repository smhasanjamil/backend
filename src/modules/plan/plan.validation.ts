import { z } from "zod";

export const createPlanValidation = {
  body: z.object({
    name: z.string().min(3, "Name must be at least 3 characters"),
    description: z.string().optional(),
    price: z.number().positive("Price must be positive"),
    interval: z.enum(["MONTH", "YEAR"]),
    trialDays: z.number().min(1).max(365).optional(),
    features: z.array(z.string()).optional(),
  }),
};

export const updatePlanValidation = {
  body: z.object({
    name: z.string().min(3, "Name must be at least 3 characters").optional(),
    description: z.string().optional(),
    price: z.number().positive("Price must be positive").optional(),
    interval: z.enum(["MONTH", "YEAR"]).optional(),
    trialDays: z.number().min(1).max(365).optional(),
    isActive: z.boolean().optional(),
    features: z.array(z.string()).optional(),
  }),
};
