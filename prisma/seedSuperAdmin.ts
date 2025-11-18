import prisma from "../src/app/config/prisma";
import hashPassword from "../src/app/utils/hashPassword";
import config from "../src/app/config/index";
import { UserRole } from "@prisma/client";

const SUPER_ADMIN_FIXED_ID = "super-admin-0001";

async function main() {
  const { email, password, firstName, lastName } = config.super_admin;

  if (!email || !password) {
    throw new Error("SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD are required");
  }

  const hashedPassword = await hashPassword(password);

  const superAdmin = await prisma.user.upsert({
    where: { id: SUPER_ADMIN_FIXED_ID },
    update: {
      email,
      password: hashedPassword,
      firstName,
      lastName,
      role: UserRole.SUPER_ADMIN,
      isVerified: true,
      isActive: true,
      isDeleted: false,
    },
    create: {
      id: SUPER_ADMIN_FIXED_ID,
      email,
      password: hashedPassword,
      firstName,
      lastName,
      role: UserRole.SUPER_ADMIN,
      isVerified: true,
      isActive: true,
      isDeleted: false,
    },
  });

  console.log(
    `✅ Super Admin ready: ${superAdmin.email} (${superAdmin.firstName} ${superAdmin.lastName})`
  );
}

main()
  .catch((e) => {
    console.error("❌ Super Admin seeding failed:", e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
