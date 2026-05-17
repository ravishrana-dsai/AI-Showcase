import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

export const { handlers, auth, signIn, signOut } = NextAuth({
  cookies: {
    pkceCodeVerifier: {
      name: "authjs.pkce.code_verifier",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
    }),
  ],
  callbacks: {
    signIn({ profile }) {
      const allowedDomain = process.env.ALLOWED_EMAIL_DOMAIN;
      // If no domain restriction is configured, allow all Google accounts
      if (!allowedDomain) return true;
      // Only allow accounts from the configured GSuite domain
      return profile?.email?.endsWith(`@${allowedDomain}`) ?? false;
    },
    session({ session, token }) {
      if (token.picture) {
        session.user.image = token.picture as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
});
