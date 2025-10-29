import status from "http-status";
import prisma from "../../config/prisma";
import { stripe } from "../../config/stripe";
import AppError from "../../errors/AppError";
import { ICreatePlanRequest, IUpdatePlanRequest } from "./plan.interface";

/* -------------------------------------------------------------------------- */
/*                            PLAN CRUD OPERATIONS                            */
/* -------------------------------------------------------------------------- */

const createPlan = async (payload: ICreatePlanRequest) => {
  try {
    // 1. Create Stripe Product
    const stripeProduct = await stripe.products.create({
      name: payload.name,
      description: payload.description || undefined,
    });

    // 2. Create Stripe Price
    const stripePrice = await stripe.prices.create({
      product: stripeProduct.id,
      unit_amount: Math.round(payload.price * 100), // Convert to cents
      currency: "usd",
      recurring: {
        interval: payload.interval.toLowerCase() as "month" | "year",
        trial_period_days: payload.trialDays || 1,
      },
    });

    // 3. Save to Database
    const plan = await prisma.plan.create({
      data: {
        name: payload.name,
        description: payload.description,
        price: payload.price,
        interval: payload.interval,
        trialDays: payload.trialDays || 1,
        stripePriceId: stripePrice.id,
        stripeProductId: stripeProduct.id,
        features: payload.features || [],
      },
    });

    return plan;
  } catch (error: any) {
    throw new AppError(
      status.INTERNAL_SERVER_ERROR,
      `Failed to create plan: ${error.message}`
    );
  }
};

const getAllPlans = async (filters?: { isActive?: boolean }) => {
  const where: any = {};

  if (filters?.isActive !== undefined) {
    where.isActive = filters.isActive;
  }

  const plans = await prisma.plan.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  return plans;
};

const getPlanById = async (id: string) => {
  const plan = await prisma.plan.findUnique({
    where: { id },
    include: {
      subscriptions: {
        select: {
          id: true,
          status: true,
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
      },
    },
  });

  if (!plan) {
    throw new AppError(status.NOT_FOUND, "Plan not found");
  }

  return plan;
};

const updatePlan = async (id: string, payload: IUpdatePlanRequest) => {
  const existingPlan = await prisma.plan.findUnique({ where: { id } });

  if (!existingPlan) {
    throw new AppError(status.NOT_FOUND, "Plan not found");
  }

  // Check if plan has active subscriptions
  const activeSubscriptions = await prisma.subscription.count({
    where: {
      planId: id,
      status: { in: ["ACTIVE", "TRIALING"] },
    },
  });

  // If trying to update price and has active subscriptions, prevent it
  if (payload.price && activeSubscriptions > 0) {
    throw new AppError(
      status.BAD_REQUEST,
      "Cannot update price for plan with active subscriptions. Create a new plan instead."
    );
  }

  try {
    let newStripePriceId = existingPlan.stripePriceId;

    // 1. Update Stripe Product (name, description)
    if (payload.name || payload.description) {
      await stripe.products.update(existingPlan.stripeProductId, {
        name: payload.name || existingPlan.name,
        description:
          payload.description !== undefined
            ? payload.description
            : existingPlan.description || undefined,
      });
    }

    // 2. Update Price in Stripe (create new price, archive old one)
    if (payload.price !== undefined || payload.interval !== undefined) {
      // Archive old price
      await stripe.prices.update(existingPlan.stripePriceId, {
        active: false,
      });

      // Create new price
      const newStripePrice = await stripe.prices.create({
        product: existingPlan.stripeProductId,
        unit_amount: Math.round((payload.price || existingPlan.price) * 100),
        currency: "usd",
        recurring: {
          interval: (
            payload.interval || existingPlan.interval
          ).toLowerCase() as "month" | "year",
          trial_period_days: payload.trialDays || existingPlan.trialDays,
        },
      });

      newStripePriceId = newStripePrice.id;
    }

    // 3. Update in Database
    const updatedPlan = await prisma.plan.update({
      where: { id },
      data: {
        name: payload.name,
        description: payload.description,
        price: payload.price,
        interval: payload.interval,
        trialDays: payload.trialDays,
        stripePriceId: newStripePriceId,
        isActive: payload.isActive,
        features: payload.features,
      },
    });

    return updatedPlan;
  } catch (error: any) {
    throw new AppError(
      status.INTERNAL_SERVER_ERROR,
      `Failed to update plan: ${error.message}`
    );
  }
};

const deletePlan = async (id: string) => {
  const existingPlan = await prisma.plan.findUnique({
    where: { id },
    include: {
      subscriptions: {
        where: {
          status: { in: ["ACTIVE", "TRIALING"] },
        },
      },
    },
  });

  if (!existingPlan) {
    throw new AppError(status.NOT_FOUND, "Plan not found");
  }

  if (existingPlan.subscriptions.length > 0) {
    throw new AppError(
      status.BAD_REQUEST,
      "Cannot delete plan with active subscriptions. Deactivate it instead."
    );
  }

  try {
    // Archive Stripe Product
    await stripe.products.update(existingPlan.stripeProductId, {
      active: false,
    });

    // Delete from Database
    await prisma.plan.delete({ where: { id } });

    return { message: "Plan deleted successfully" };
  } catch (error: any) {
    throw new AppError(
      status.INTERNAL_SERVER_ERROR,
      `Failed to delete plan: ${error.message}`
    );
  }
};

export const PlanService = {
  createPlan,
  getAllPlans,
  getPlanById,
  updatePlan,
  deletePlan,
};
