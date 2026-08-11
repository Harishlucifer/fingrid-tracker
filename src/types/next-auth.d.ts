/**
 * Module augmentation so `session.user.role` is typed everywhere instead of
 * being cast at each call site.
 */

import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      /** Org role: ADMIN | MEMBER | VIEWER. See src/lib/constants.ts. */
      role: string;
      isActive: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    role?: string;
    isActive?: boolean;
  }
}
