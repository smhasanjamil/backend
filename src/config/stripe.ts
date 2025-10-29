import Stripe from "stripe";
import config from "./index";

if (!config.stripe.stripe_secret_key) {
  throw new Error("Stripe secret key is missing");
}

export const stripe = new Stripe(config.stripe.stripe_secret_key, {
  apiVersion: "2024-06-20",
  typescript: true,
});
