// // types/global.d.ts
// import { UserRole } from "@prisma/client";

// declare global {
//   namespace Express {
//     interface Request {
//       user?: {
//         userId: string;
//         email: string;
//         role: UserRole;
//       };
//     }
//   }
// }

// // Also augment the module (optional but safe)
// declare module "express-serve-static-core" {
//   interface Request {
//     user?: {
//       userId: string;
//       email: string;
//       role: UserRole;
//     };
//   }
// }

// export {};

// types/global.d.ts
import { UserRole } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
        role: UserRole;
      };
    }
  }
}

export {};