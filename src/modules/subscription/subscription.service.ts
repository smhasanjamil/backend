import status from "http-status";
import prisma from "../../config/prisma";
import AppError from "../../errors/AppError";
import {
  ICancelSubscriptionRequest,
  ICreateSubscriptionRequest,
} from "./subscription.interface";
import { stripe } from "../../config/stripe";
import config from "../../config";

/* -------------------------------------------------------------------------- */
/*                        SUBSCRIPTION OPERATIONS                             */
/* -------------------------------------------------------------------------- */

const createSubscription = async (
  userId: string,
  payload: ICreateSubscriptionRequest
) => {
  // 1. Verify Plan
  const plan = await prisma.plan.findUnique({
    where: { id: payload.planId, isActive: true },
  });

  if (!plan) {
    throw new AppError(status.NOT_FOUND, "Plan not found or inactive");
  }

  // 2. Get User
  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user) {
    throw new AppError(status.NOT_FOUND, "User not found");
  }

  // 3. Check existing active subscription
  const existingSubscription = await prisma.subscription.findFirst({
    where: {
      userId,
      status: { in: ["ACTIVE", "TRIALING"] },
    },
  });

  if (existingSubscription) {
    throw new AppError(
      status.CONFLICT,
      "User already has an active subscription"
    );
  }

  try {
    let stripeCustomerId = user.stripeCustomerId;

    // 4. Create or Get Stripe Customer
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name,
        metadata: { userId: user.id },
      });
      stripeCustomerId = customer.id;

      await prisma.user.update({
        where: { id: userId },
        data: { stripeCustomerId },
      });
    }

    // 5. Attach Payment Method to Customer
    await stripe.paymentMethods.attach(payload.paymentMethodId, {
      customer: stripeCustomerId,
    });

    // 6. Set as default payment method
    await stripe.customers.update(stripeCustomerId, {
      invoice_settings: {
        default_payment_method: payload.paymentMethodId,
      },
    });

    // 7. Create Stripe Subscription with trial and auto-payment
    const stripeSubscription = await stripe.subscriptions.create({
      customer: stripeCustomerId,
      items: [{ price: plan.stripePriceId }],
      trial_period_days: plan.trialDays,
      payment_behavior: "default_incomplete", // This ensures no immediate charge
      payment_settings: {
        payment_method_types: ["card"],
        save_default_payment_method: "on_subscription",
      },
      expand: ["latest_invoice.payment_intent"],
    });

    // 8. Confirm the setup (no charge during trial)
    const invoice = stripeSubscription.latest_invoice as any;

    let clientSecret = null;
    if (invoice?.payment_intent) {
      const paymentIntent = invoice.payment_intent as any;
      clientSecret = paymentIntent.client_secret;
    }

    // 9. Save to Database
    const subscription = await prisma.subscription.create({
      data: {
        userId,
        planId: plan.id,
        stripeSubscriptionId: stripeSubscription.id,
        stripeCustomerId,
        status: stripeSubscription.status.toUpperCase() as any,
        currentPeriodStart: new Date(
          stripeSubscription.current_period_start * 1000
        ),
        currentPeriodEnd: new Date(
          stripeSubscription.current_period_end * 1000
        ),
        trialStart: stripeSubscription.trial_start
          ? new Date(stripeSubscription.trial_start * 1000)
          : null,
        trialEnd: stripeSubscription.trial_end
          ? new Date(stripeSubscription.trial_end * 1000)
          : null,
      },
      include: {
        plan: true,
      },
    });

    return {
      subscription,
      clientSecret, // Return this for frontend confirmation if needed
      message: `Subscription created successfully. ${plan.trialDays}-day trial started. Auto-payment will begin after trial.`,
    };
  } catch (error: any) {
    throw new AppError(
      status.INTERNAL_SERVER_ERROR,
      `Failed to create subscription: ${error.message}`
    );
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
          name: true,
        },
      },
    },
  });

  if (!subscription) {
    throw new AppError(status.NOT_FOUND, "Subscription not found");
  }

  return subscription;
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
    // Cancel in Stripe
    const stripeSubscription = await stripe.subscriptions.update(
      subscription.stripeSubscriptionId,
      {
        cancel_at_period_end: payload.cancelAtPeriodEnd ?? true,
      }
    );

    // Update in Database
    const updatedSubscription = await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        cancelAtPeriodEnd: payload.cancelAtPeriodEnd ?? true,
        canceledAt: payload.cancelAtPeriodEnd ? null : new Date(),
        status: payload.cancelAtPeriodEnd ? subscription.status : "CANCELED",
      },
      include: {
        plan: true,
      },
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
    // Resume in Stripe
    await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      cancel_at_period_end: false,
    });

    // Update in Database
    const updatedSubscription = await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        cancelAtPeriodEnd: false,
        canceledAt: null,
      },
      include: {
        plan: true,
      },
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
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      config.stripe.stripe_webhook_secret!
    );
  } catch (error: any) {
    throw new AppError(status.BAD_REQUEST, `Webhook Error: ${error.message}`);
  }

  console.log(`Received event: ${event.type}`);

  switch (event.type) {
    // Subscription created (trial starts)
    case "customer.subscription.created": {
      const subscription = event.data.object as any;
      await prisma.subscription.updateMany({
        where: { stripeSubscriptionId: subscription.id },
        data: {
          status: subscription.status.toUpperCase(),
          currentPeriodStart: new Date(
            subscription.current_period_start * 1000
          ),
          currentPeriodEnd: new Date(subscription.current_period_end * 1000),
          trialStart: subscription.trial_start
            ? new Date(subscription.trial_start * 1000)
            : null,
          trialEnd: subscription.trial_end
            ? new Date(subscription.trial_end * 1000)
            : null,
        },
      });
      console.log(`✅ Subscription created with trial: ${subscription.id}`);
      break;
    }

    // Subscription updated (trial ending, status changes)
    case "customer.subscription.updated": {
      const subscription = event.data.object as any;
      await prisma.subscription.updateMany({
        where: { stripeSubscriptionId: subscription.id },
        data: {
          status: subscription.status.toUpperCase(),
          currentPeriodStart: new Date(
            subscription.current_period_start * 1000
          ),
          currentPeriodEnd: new Date(subscription.current_period_end * 1000),
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          canceledAt: subscription.canceled_at
            ? new Date(subscription.canceled_at * 1000)
            : null,
        },
      });
      console.log(`✅ Subscription updated: ${subscription.id}`);
      break;
    }

    // Trial will end soon (3 days before)
    case "customer.subscription.trial_will_end": {
      const subscription = event.data.object as any;

      // Get user info for notification
      const dbSubscription = await prisma.subscription.findFirst({
        where: { stripeSubscriptionId: subscription.id },
        include: { user: true, plan: true },
      });

      if (dbSubscription) {
        // TODO: Send email notification to user
        console.log(
          `⚠️ Trial ending soon for user: ${dbSubscription.user.email}`
        );
        // You can implement email notification here:
        // await sendTrialEndingEmail(dbSubscription.user.email, dbSubscription);
      }
      break;
    }

    // First payment after trial (auto-charge)
    case "invoice.payment_succeeded": {
      const invoice = event.data.object as any;

      if (invoice.billing_reason === "subscription_cycle") {
        console.log(
          `✅ Auto-payment successful for subscription: ${invoice.subscription}`
        );

        // Update subscription status to ACTIVE after first payment
        await prisma.subscription.updateMany({
          where: { stripeSubscriptionId: invoice.subscription },
          data: { status: "ACTIVE" },
        });

        // TODO: Send payment success email
        // const subscription = await prisma.subscription.findFirst({...});
        // await sendPaymentSuccessEmail(subscription.user.email, invoice.amount_paid);
      }
      break;
    }

    // Payment failed after trial
    case "invoice.payment_failed": {
      const invoice = event.data.object as any;

      console.log(
        `❌ Payment failed for subscription: ${invoice.subscription}`
      );

      // Update subscription status to PAST_DUE
      await prisma.subscription.updateMany({
        where: { stripeSubscriptionId: invoice.subscription },
        data: { status: "PAST_DUE" },
      });

      // TODO: Send payment failed email
      // const subscription = await prisma.subscription.findFirst({...});
      // await sendPaymentFailedEmail(subscription.user.email, invoice.amount_due);
      break;
    }

    // Subscription deleted/canceled
    case "customer.subscription.deleted": {
      const subscription = event.data.object as any;
      await prisma.subscription.updateMany({
        where: { stripeSubscriptionId: subscription.id },
        data: {
          status: "CANCELED",
          canceledAt: new Date(),
        },
      });
      console.log(`✅ Subscription canceled: ${subscription.id}`);
      break;
    }

    // Payment method attached
    case "payment_method.attached": {
      const paymentMethod = event.data.object as any;
      console.log(
        `✅ Payment method attached: ${paymentMethod.id} to customer ${paymentMethod.customer}`
      );
      break;
    }

    default:
      console.log(`Unhandled event type: ${event.type}`);
  }

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
