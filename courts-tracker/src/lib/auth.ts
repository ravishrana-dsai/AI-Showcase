import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import type { UserRole } from "@prisma/client";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        const dbUser = await prisma.user.findUnique({
          where: { email: session.user.email! },
          select: { id: true, role: true, isActive: true },
        });
        session.user.id = dbUser?.id ?? user.id;
        session.user.role = (dbUser?.role ?? "OPS") as UserRole;
        session.user.isActive = dbUser?.isActive ?? true;
      }
      return session;
    },
    async signIn({ user }) {
      // Auto-create user with OPS role on first sign-in
      if (user.email) {
        const existing = await prisma.user.findUnique({
          where: { email: user.email },
        });
        if (!existing) {
          await prisma.user.upsert({
            where: { email: user.email },
            create: {
              email: user.email,
              name: user.name ?? undefined,
              image: user.image ?? undefined,
              role: "OPS",
            },
            update: {},
          });
        }
        // Block inactive users
        if (existing && !existing.isActive) return false;
      }
      return true;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "database",
  },
});

// Role check helpers
export function canEdit(role: UserRole): boolean {
  return role === "ADMIN" || role === "OPS";
}

export function isAdmin(role: UserRole): boolean {
  return role === "ADMIN";
}
