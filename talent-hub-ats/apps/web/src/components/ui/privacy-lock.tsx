import { Lock } from "lucide-react";

interface PrivacyLockProps {
  visible: boolean;
  children: React.ReactNode;
  label?: string;
}

/**
 * Wraps content with a blur overlay when visible=false.
 * Admins control visibility per-role via the visibility settings page.
 */
export function PrivacyLock({
  visible,
  children,
  label = "Hidden by admin settings",
}: PrivacyLockProps) {
  if (visible) {
    return <>{children}</>;
  }

  return (
    <div className="relative rounded-xl overflow-hidden">
      <div className="select-none pointer-events-none blur-sm opacity-40" aria-hidden="true">
        {children}
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-card/60 backdrop-blur-[2px]">
        <Lock className="w-5 h-5 text-muted-foreground" />
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
