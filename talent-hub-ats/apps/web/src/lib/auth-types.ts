import type { UserRole } from "@talent-hub/shared";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole;
      organizationId: string;
      avatar: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    role: UserRole;
    organizationId: string;
    avatar: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: UserRole;
    organizationId: string;
    avatar: string | null;
  }
}
