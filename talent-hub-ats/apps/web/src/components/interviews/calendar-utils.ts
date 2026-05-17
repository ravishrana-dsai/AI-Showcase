export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export const TYPE_COLORS: Record<string, string> = {
  VIDEO: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  PHONE: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  IN_PERSON: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  TECHNICAL: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  CULTURAL: "bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300",
  HR: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300",
  TAKE_HOME: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
};

export const DAY_NAMES: string[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
