import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { compare } from "bcryptjs";
import { prisma } from "@talent-hub/db";

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email and password are required");
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          include: { organization: true },
        });

        if (!user || !user.passwordHash) {
          throw new Error("Invalid email or password");
        }

        if (!user.isActive) {
          throw new Error("Your account has been deactivated");
        }

        const isValid = await compare(credentials.password, user.passwordHash);
        if (!isValid) {
          throw new Error("Invalid email or password");
        }

        // Update last login
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role as any,
          organizationId: user.organizationId,
          avatar: user.avatar,
        } as any;
      },
    }),
    // Google OAuth (only enabled if credentials are set)
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
        token.organizationId = (user as any).organizationId;
        token.avatar = (user as any).avatar;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        // Re-check DB on every session read so deactivated users lose access
        // immediately rather than waiting for the 30-day JWT to expire.
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { isActive: true, role: true },
        });

        if (!dbUser?.isActive) {
          // Returning a session with no user causes NextAuth to treat it as
          // unauthenticated, triggering a redirect to sign-in.
          return { ...session, user: undefined as any };
        }

        (session.user as any).id = token.id as string;
        (session.user as any).role = dbUser.role; // always fresh from DB
        (session.user as any).organizationId = token.organizationId as string;
        (session.user as any).avatar = token.avatar as string | null;
      }
      return session;
    },
    async signIn({ user, account }) {
      // Handle Google OAuth sign-in
      if (account?.provider === "google" && user.email) {
        const emailDomain = user.email.split("@")[1];

        let existingUser = await prisma.user.findUnique({
          where: { email: user.email },
        });

        if (!existingUser) {
          // Check if the email domain matches an org with SSO enabled.
          // Checks googleDomains array first (multi-domain), falls back to legacy googleDomain.
          const ssoOrg = emailDomain
            ? await prisma.organization.findFirst({
                where: {
                  ssoEnabled: true,
                  OR: [
                    { googleDomains: { has: emailDomain } },
                    { googleDomain: emailDomain },
                  ],
                },
              })
            : null;

          if (ssoOrg) {
            // Auto-provision: create user for this org
            existingUser = await prisma.user.create({
              data: {
                email: user.email,
                name: user.name ?? user.email.split("@")[0],
                organizationId: ssoOrg.id,
                role: ssoOrg.ssoDefaultRole,
                isActive: true,
              },
            });
          } else {
            // No SSO match: user must be pre-invited
            return false;
          }
        }

        if (!existingUser.isActive) {
          return false;
        }

        // Link account if not already linked
        const existingAccount = await prisma.account.findUnique({
          where: {
            provider_providerAccountId: {
              provider: account.provider,
              providerAccountId: account.providerAccountId,
            },
          },
        });

        if (!existingAccount) {
          await prisma.account.create({
            data: {
              userId: existingUser.id,
              type: account.type,
              provider: account.provider,
              providerAccountId: account.providerAccountId,
              access_token: account.access_token,
              refresh_token: account.refresh_token,
              expires_at: account.expires_at,
              token_type: account.token_type,
              scope: account.scope,
              id_token: account.id_token,
            },
          });
        }

        // Update last login
        await prisma.user.update({
          where: { id: existingUser.id },
          data: { lastLoginAt: new Date() },
        });

        // Patch the user object so the JWT callback gets the right data
        user.id = existingUser.id;
        (user as unknown as Record<string, unknown>).role = existingUser.role;
        (user as unknown as Record<string, unknown>).organizationId = existingUser.organizationId;
      }

      return true;
    },
  },
};
