import Link from "next/link";
import { ShieldX } from "lucide-react";

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <div className="text-center">
        <ShieldX className="w-16 h-16 mx-auto text-destructive/50 mb-4" />
        <h1 className="text-2xl font-bold">Access Denied</h1>
        <p className="text-muted-foreground mt-2 max-w-md">
          You don&apos;t have permission to access this page. Contact your
          administrator if you believe this is an error.
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center mt-6 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
