import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import catchAsync from "../utils/catchAsync";

// Define a type for your request validation object (replaces AnyZodObject/ZodEffects)
type RequestValidation = {
  body?: z.Schema;
  query?: z.Schema;
  params?: z.Schema;
};

const validateRequest = (schema: RequestValidation) => {
  return catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    // Build the validation object
    const validationData = {
      body: req.body,
      query: req.query,
      params: req.params,
    };

    // Parse each part if a schema is provided
    if (schema.body) {
      await schema.body.parseAsync(validationData.body);
    }
    if (schema.query) {
      await schema.query.parseAsync(validationData.query);
    }
    if (schema.params) {
      await schema.params.parseAsync(validationData.params);
    }

    next();
  });
};

export default validateRequest;
