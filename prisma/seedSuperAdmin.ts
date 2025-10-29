import { PrismaClient, UserRole } from "@prisma/client";
import hashPassword from "../src/utils/hashPassword";
import config from "../src/config";

const prisma = new PrismaClient();

async function main() {
  const { email, password, name } = config.super_admin;

  // Only hash if we're creating or resetting
  const hashedPassword = await hashPassword(password);

  // Allow password reset only in development AND if explicitly enabled
  const isDev = config.env === "development";
  const shouldResetPassword =
    isDev && process.env.RESET_SUPER_ADMIN_PASSWORD === "true";

  const superAdmin = await prisma.user.upsert({
    where: { email },
    update: {
      name,
      role: UserRole.SUPER_ADMIN,
      isVerified: true,
      // Only update password if explicitly allowed
      ...(shouldResetPassword && { password: hashedPassword }),
    },
    create: {
      email,
      password: hashedPassword,
      name,
      role: UserRole.SUPER_ADMIN,
      isVerified: true,
    },
  });

  console.log(`Super Admin ${superAdmin.email} is ready.`);
  if (shouldResetPassword) {
    console.log("Password has been reset (dev only).");
  }
}

main()
  .catch((e) => {
    console.error("Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
