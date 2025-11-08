import status from "http-status";

import Stripe from "stripe";
import { SubscriptionStatus } from "@prisma/client";
import {
  ICancelSubscriptionRequest,
  ICreateSubscriptionRequest,
} from "./subscription.interface";
import prisma from "../../config/prisma";
import AppError from "../../errors/AppError";
import { stripe } from "../../config/stripe";
import config from "../../config";

/* -------------------------------------------------------------------------- */
/*                        SUBSCRIPTION OPERATIONS                             */
/* -------------------------------------------------------------------------- */

const createSubscription = async (
  userId: string,
  payload: ICreateSubscriptionRequest
) => {
  const plan = await prisma.plan.findUnique({
    where: { id: payload.planId, isActive: true },
  });
  if (!plan) throw new AppError(status.NOT_FOUND, "Plan not found or inactive");

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(status.NOT_FOUND, "User not found");

  const activeSub = await prisma.subscription.findFirst({
    where: { userId, status: { in: ["ACTIVE", "TRIALING"] } },
  });
  if (activeSub)
    throw new AppError(
      status.CONFLICT,
      "User already has an active subscription"
    );

  try {
    let stripeCustomerId = user.stripeCustomerId;
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
        metadata: { userId: user.id },
      });
      stripeCustomerId = customer.id;
      await prisma.user.update({
        where: { id: userId },
        data: { stripeCustomerId },
      });
    }

    await stripe.paymentMethods.attach(payload.paymentMethodId, {
      customer: stripeCustomerId,
    });

    await stripe.customers.update(stripeCustomerId, {
      invoice_settings: { default_payment_method: payload.paymentMethodId },
    });

    const stripeSub = await stripe.subscriptions.create({
      customer: stripeCustomerId,
      items: [{ price: plan.stripePriceId }],
      trial_period_days: plan.trialDays > 0 ? plan.trialDays : undefined,
      payment_behavior: "default_incomplete",
      payment_settings: {
        payment_method_types: ["card"],
        save_default_payment_method: "on_subscription",
      },
      expand: ["latest_invoice.payment_intent"],
    });

    let clientSecret: string | null = null;
    const invoice = stripeSub.latest_invoice as Stripe.Invoice | null;
    if (invoice?.payment_intent && typeof invoice.payment_intent === "object") {
      clientSecret = invoice.payment_intent.client_secret;
    }

    const statusMap: Record<string, SubscriptionStatus> = {
      active: SubscriptionStatus.ACTIVE,
      trialing: SubscriptionStatus.TRIALING,
      past_due: SubscriptionStatus.PAST_DUE,
      canceled: SubscriptionStatus.CANCELED,
      unpaid: SubscriptionStatus.UNPAID,
      incomplete: SubscriptionStatus.INCOMPLETE,
      incomplete_expired: SubscriptionStatus.INCOMPLETE_EXPIRED,
    };

    const dbStatus =
      statusMap[stripeSub.status] ?? SubscriptionStatus.INCOMPLETE;

    const subscription = await prisma.subscription.create({
      data: {
        userId,
        planId: plan.id,
        stripeSubscriptionId: stripeSub.id,
        stripeCustomerId,
        status: dbStatus,
        currentPeriodStart: new Date(stripeSub.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
        trialStart: stripeSub.trial_start
          ? new Date(stripeSub.trial_start * 1000)
          : null,
        trialEnd: stripeSub.trial_end
          ? new Date(stripeSub.trial_end * 1000)
          : null,
      },
      include: { plan: true },
    });

    return {
      subscription,
      clientSecret,
      message: `Subscription created. ${
        plan.trialDays > 0 ? `${plan.trialDays}-day trial started.` : ""
      } First payment due on ${new Date(
        stripeSub.current_period_end * 1000
      ).toLocaleDateString()}.`,
    };
  } catch (err: any) {
    console.error("Subscription error:", err);
    throw new AppError(status.INTERNAL_SERVER_ERROR, `Failed: ${err.message}`);
  }
};

const getUserSubscriptions = async (userId: string) => {
  const subscriptions = await prisma.subscription.findMany({
    where: { userId },
    include: {
      plan: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return subscriptions;
};

const getSubscriptionById = async (id: string, userId: string) => {
  const subscription = await prisma.subscription.findFirst({
    where: { id, userId },
    include: {
      plan: true,
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  if (!subscription) {
    throw new AppError(status.NOT_FOUND, "Subscription not found");
  }

  // Add virtual fullName for convenience
  return {
    ...subscription,
    user: subscription.user && {
      ...subscription.user,
      fullName: `${subscription.user.firstName} ${subscription.user.lastName}`.trim(),
    },
  };
};

const cancelSubscription = async (
  userId: string,
  payload: ICancelSubscriptionRequest
) => {
  const subscription = await prisma.subscription.findFirst({
    where: {
      id: payload.subscriptionId,
      userId,
    },
  });

  if (!subscription) {
    throw new AppError(status.NOT_FOUND, "Subscription not found");
  }

  if (subscription.status === "CANCELED") {
    throw new AppError(status.BAD_REQUEST, "Subscription already canceled");
  }

  try {
    const stripeSubscription = await stripe.subscriptions.update(
      subscription.stripeSubscriptionId,
      {
        cancel_at_period_end: payload.cancelAtPeriodEnd ?? true,
      }
    );

    const updatedSubscription = await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        cancelAtPeriodEnd: payload.cancelAtPeriodEnd ?? true,
        canceledAt: payload.cancelAtPeriodEnd ? null : new Date(),
        status: payload.cancelAtPeriodEnd ? subscription.status : "CANCELED",
      },
      include: { plan: true },
    });

    return updatedSubscription;
  } catch (error: any) {
    throw new AppError(
      status.INTERNAL_SERVER_ERROR,
      `Failed to cancel subscription: ${error.message}`
    );
  }
};

const resumeSubscription = async (userId: string, subscriptionId: string) => {
  const subscription = await prisma.subscription.findFirst({
    where: {
      id: subscriptionId,
      userId,
    },
  });

  if (!subscription) {
    throw new AppError(status.NOT_FOUND, "Subscription not found");
  }

  if (!subscription.cancelAtPeriodEnd) {
    throw new AppError(status.BAD_REQUEST, "Subscription is not set to cancel");
  }

  try {
    await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      cancel_at_period_end: false,
    });

    const updatedSubscription = await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        cancelAtPeriodEnd: false,
        canceledAt: null,
      },
      include: { plan: true },
    });

    return updatedSubscription;
  } catch (error: any) {
    throw new AppError(
      status.INTERNAL_SERVER_ERROR,
      `Failed to resume subscription: ${error.message}`
    );
  }
};

/* -------------------------------------------------------------------------- */
/*                           STRIPE WEBHOOK HANDLER                           */
/* -------------------------------------------------------------------------- */

const handleStripeWebhook = async (rawBody: Buffer, signature: string) => {
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      config.stripe.stripe_webhook_secret!
    );
  } catch (err: any) {
    throw new AppError(400, `Webhook Error: ${err.message}`);
  }

  // IDEMPOTENCY
  const existing = await prisma.webhookEvent.findUnique({
    where: { id: event.id },
  });
  if (existing) {
    return { received: true, id: event.id };
  }

  const STATUS_MAP: Record<string, SubscriptionStatus> = {
    active: SubscriptionStatus.ACTIVE,
    trialing: SubscriptionStatus.TRIALING,
    past_due: SubscriptionStatus.PAST_DUE,
    canceled: SubscriptionStatus.CANCELED,
    unpaid: SubscriptionStatus.UNPAID,
    incomplete: SubscriptionStatus.INCOMPLETE,
    incomplete_expired: SubscriptionStatus.INCOMPLETE_EXPIRED,
  };

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const dbSub = await prisma.subscription.findUnique({
        where: { stripeSubscriptionId: sub.id },
      });

      if (dbSub) {
        await prisma.subscription.update({
          where: { id: dbSub.id },
          data: {
            status: STATUS_MAP[sub.status] ?? SubscriptionStatus.INCOMPLETE,
            currentPeriodStart: new Date(sub.current_period_start * 1000),
            currentPeriodEnd: new Date(sub.current_period_end * 1000),
            trialStart: sub.trial_start
              ? new Date(sub.trial_start * 1000)
              : null,
            trialEnd: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
            cancelAtPeriodEnd: sub.cancel_at_period_end,
            canceledAt: sub.canceled_at
              ? new Date(sub.canceled_at * 1000)
              : null,
          },
        });
      }
      break;
    }

    case "invoice.payment_succeeded":
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      if (invoice.subscription) {
        const dbSub = await prisma.subscription.findUnique({
          where: { stripeSubscriptionId: invoice.subscription as string },
        });
        if (dbSub) {
          await prisma.subscription.update({
            where: { id: dbSub.id },
            data: {
              status:
                event.type === "invoice.payment_succeeded"
                  ? SubscriptionStatus.ACTIVE
                  : SubscriptionStatus.PAST_DUE,
            },
          });
        }
      }
      break;
    }

    // Optional: Add trial reminder
    case "customer.subscription.trial_will_end": {
      const sub = event.data.object as Stripe.Subscription;
      // You can send email reminder here
      break;
    }
  }

  // Mark as processed
  await prisma.webhookEvent.create({
    data: { id: event.id, type: event.type },
  });

  return { received: true };
};

export const SubscriptionService = {
  createSubscription,
  getUserSubscriptions,
  getSubscriptionById,
  cancelSubscription,
  resumeSubscription,
  handleStripeWebhook,
};