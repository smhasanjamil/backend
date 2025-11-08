import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env") });

export default {
  env: process.env.NODE_ENV || "development",
  port: process.env.PORT || 5000,
  database_url: process.env.DATABASE_URL,

  client_url: process.env.CLIENT_URL!,
  backend_url: process.env.BACKEND_URL!,

  jwt: {
    access_secret: process.env.JWT_ACCESS_SECRET!,
    refresh_secret: process.env.JWT_REFRESH_SECRET!,
    access_expires_in: process.env.JWT_ACCESS_EXPIRES_IN || "7d",
    refresh_expires_in: process.env.JWT_REFRESH_EXPIRES_IN || "30d",
  },

  stripe: {
    stripe_secret_key: process.env.STRIPE_SECRET_KEY,
    stripe_webhook_secret: process.env.STRIPE_WEBHOOK_SECRET,
    client_url: process.env.CLIENT_URL!,
  },

  brevo: {
    api_key: process.env.BREVO_API_KEY!,
    sender_email: process.env.BREVO_SENDER_EMAIL!,
    sender_name: process.env.BREVO_SENDER_NAME || "App",
  },

  otp_expiry_minutes: parseInt(process.env.OTP_EXPIRY_MINUTES || "10", 10),

  super_admin: {
    email: process.env.SUPER_ADMIN_EMAIL!,
    password: process.env.SUPER_ADMIN_PASSWORD!,
    firstName: process.env.SUPER_ADMIN_FIRST_NAME || "Super",
    lastName: process.env.SUPER_ADMIN_LAST_NAME || "Admin",
  },
};
