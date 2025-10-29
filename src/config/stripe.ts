import Stripe from "stripe";
import config from "./index";

if (!config.stripe.stripe_secret_key) {
  throw new Error("Stripe secret key is not defined in environment variables");
}

export const stripe = new Stripe(config.stripe.stripe_secret_key, {
  apiVersion: "2025-09-30.clover",
  typescript: true,
});
