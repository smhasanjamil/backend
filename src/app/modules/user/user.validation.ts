import { z } from "zod";

export const updateUserValidation = {
  body: z.object({
    name: z.string().min(2, "Name must be at least 2 characters").optional(),
  }),
};

export const getUsersValidation = {
  query: z.object({
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(100).optional().default(10),
    sortBy: z.string().optional(),
    sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
    searchTerm: z.string().optional(),
    role: z.string().optional(),
  }),
};
