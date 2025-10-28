import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcrypt";
import config from "../src/config";

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash(config.super_admin.password, 12);

  const superAdmin = await prisma.user.upsert({
    where: { email: config.super_admin.email },
    update: {
      name: config.super_admin.name,
      // Don't update password on upsert unless needed
    },
    create: {
      email: config.super_admin.email,
      password: hashedPassword,
      name: config.super_admin.name,
      role: UserRole.SUPER_ADMIN,
      isVerified: true,
    },
  });

  console.log("Super Admin ensured:", {
    email: superAdmin.email,
    name: superAdmin.name,
    role: superAdmin.role,
  });
}

main()
  .catch((e) => {
    console.error("Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
