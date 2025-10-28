// config.ts
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env") });

export default {
  env: process.env.NODE_ENV || "development",
  port: process.env.PORT || 5000,
  database_url: process.env.DATABASE_URL,

  jwt: {
    access_secret: process.env.JWT_ACCESS_SECRET!,
    refresh_secret: process.env.JWT_REFRESH_SECRET!,
    access_expires_in: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
    refresh_expires_in: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
  },

  brevo: {
    api_key: process.env.BREVO_API_KEY!,
    sender_email: process.env.BREVO_SENDER_EMAIL!,
    sender_name: process.env.BREVO_SENDER_NAME || "App",
  },

  otp_expiry_minutes: parseInt(process.env.OTP_EXPIRY_MINUTES || "10", 10),

  // Super Admin
  super_admin: {
    email: process.env.SUPER_ADMIN_EMAIL!,
    password: process.env.SUPER_ADMIN_PASSWORD!,
    name: process.env.SUPER_ADMIN_NAME || "Super Admin",
  },
};