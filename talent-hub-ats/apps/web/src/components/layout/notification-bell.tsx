"use client";

import { useState, useEffect, useRef } from "react";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/utils";
import { getApiUrl } from "@/lib/api";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  useEffect(() => {
    fetch(getApiUrl("/api/notifications")).then((r) => r.json()).then((d) => setNotifications(Array.isArray(d) ? d : (d?.notifications ?? []))).catch(() => {});
    const interval = setInterval(() => {
      fetch(getApiUrl("/api/notifications")).then((r) => r.json()).then((d) => setNotifications(Array.isArray(d) ? d : (d?.notifications ?? []))).catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const markAllRead = async () => {
    const unreadIds = notifications.filter((n) => !n.isRead).map((n) => n.id);
    if (unreadIds.length === 0) return;
    await fetch(getApiUrl("/api/notifications"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ notificationIds: unreadIds }) });
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => { setOpen(!open); if (!open) markAllRead(); }}
        aria-label={open ? "Close notifications" : "Open notifications"}
        aria-expanded={open}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4.5 h-4.5 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center min-w-[18px] h-[18px]">{unreadCount > 9 ? "9+" : unreadCount}</span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-card rounded-xl border shadow-lg z-50 max-h-96 overflow-y-auto">
          <div className="p-3 border-b flex items-center justify-between">
            <h3 className="text-sm font-semibold">Notifications</h3>
            {unreadCount > 0 && <button onClick={markAllRead} className="text-xs text-primary hover:underline">Mark all read</button>}
          </div>
          {notifications.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">No notifications</div>
          ) : (
            <div className="divide-y">
              {notifications.slice(0, 20).map((n) => (
                <a key={n.id} href={n.link || "#"} className={cn("block p-3 hover:bg-muted/50 transition-colors", !n.isRead && "bg-primary/5")}>
                  <p className="text-sm font-medium">{n.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
                  <p className="text-xs text-muted-foreground mt-1">{formatRelativeTime(n.createdAt)}</p>
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
