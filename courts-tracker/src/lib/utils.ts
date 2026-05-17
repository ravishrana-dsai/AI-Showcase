import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { formatDistanceToNow, format, differenceInMinutes, differenceInHours } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return format(new Date(date), "dd MMM yyyy, HH:mm");
}

export function formatDateShort(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return format(new Date(date), "dd MMM yyyy");
}

export function timeAgo(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

export function formatDuration(minutes: number | null | undefined): string {
  if (minutes == null) return "—";
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function getSlaStatus(
  startedAt: Date | null,
  completedAt: Date | null,
  slaHours: number
): "ok" | "warning" | "breached" | "pending" {
  if (!startedAt) return "pending";
  const refDate = completedAt ?? new Date();
  const elapsedHours = differenceInMinutes(refDate, startedAt) / 60;
  if (elapsedHours >= slaHours) return "breached";
  if (elapsedHours >= slaHours * 0.8) return "warning";
  return "ok";
}

export function getElapsedMinutes(startedAt: Date | null, endedAt?: Date | null): number {
  if (!startedAt) return 0;
  return differenceInMinutes(endedAt ?? new Date(), startedAt);
}

export function bytesToMB(bytes: bigint | number | null | undefined): string {
  if (bytes == null) return "—";
  const mb = Number(bytes) / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

export function truncate(str: string, length = 50): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + "…";
}

export function slugify(str: string): string {
  return str.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
}
