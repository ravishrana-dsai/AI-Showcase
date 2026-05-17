'use client';

import { useSession, signIn, signOut } from 'next-auth/react';
import { LogIn, LogOut, User } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function AuthButton() {
  const { data: session, status } = useSession();

  if (status === 'loading') {
    return (
      <Button disabled className="flex items-center gap-2">
        <User className="h-4 w-4" />
        Loading...
      </Button>
    );
  }

  if (session?.user) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-sm text-gray-700">
          {session.user.image && (
            <img
              src={session.user.image}
              alt={session.user.name || 'User'}
              className="h-8 w-8 rounded-full"
            />
          )}
          <span className="hidden sm:inline">
            {session.user.name || session.user.email}
          </span>
        </div>
        <Button
          onClick={() => signOut()}
          variant="secondary"
          className="flex items-center gap-2"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </Button>
      </div>
    );
  }

  return (
    <Button
      onClick={() => signIn('google')}
      className="flex items-center gap-2"
    >
      <LogIn className="h-4 w-4" />
      Sign in with Google
    </Button>
  );
}
