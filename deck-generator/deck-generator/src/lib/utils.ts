import { v4 as uuidv4 } from "uuid";
import type { ColorTheme } from "@/lib/templates/types";

// ---------------------------------------------------------------------------
// ClassValue helper type (lightweight alternative to clsx)
// ---------------------------------------------------------------------------

type ClassValue = string | number | boolean | undefined | null;

/**
 * Merge class names together, filtering out falsy values.
 * A lightweight alternative to `clsx` + `tailwind-merge`.
 */
export function cn(...inputs: ClassValue[]): string {
  return inputs.filter(Boolean).join(" ");
}

// ---------------------------------------------------------------------------
// Color helpers
// ---------------------------------------------------------------------------

/**
 * Convert a hex colour string (with or without leading `#`) to an RGB object
 * whose channel values are **0 – 1 floats** as required by the Google Slides
 * API (`RgbColor`).
 */
export function hexToRgb(hex: string): {
  red: number;
  green: number;
  blue: number;
} {
  // Strip leading # if present
  const sanitised = hex.replace(/^#/, "");

  const bigint = parseInt(sanitised, 16);

  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;

  return {
    red: r / 255,
    green: g / 255,
    blue: b / 255,
  };
}

/**
 * Resolve theme tokens such as `{{primary}}` or `{{accent}}` to their
 * corresponding hex colour values (without the `#` prefix).
 *
 * If `colorValue` is already a plain hex string it is returned as-is (with any
 * leading `#` stripped).  If the token cannot be resolved the function falls
 * back to the theme's `text` colour.
 */
export function resolveThemeColor(
  colorValue: string | undefined,
  theme: ColorTheme
): string {
  if (!colorValue) {
    return theme.textPrimary.replace(/^#/, "");
  }

  // Check for {{token}} pattern
  const match = colorValue.match(/^\{\{(\w+)\}\}$/);

  if (match) {
    const token = match[1] as keyof ColorTheme;
    const resolved = theme[token];
    return typeof resolved === 'string'
      ? resolved.replace(/^#/, "")
      : theme.textPrimary.replace(/^#/, "");
  }

  // Already a raw hex value
  return colorValue.replace(/^#/, "");
}

// ---------------------------------------------------------------------------
// ID generation
// ---------------------------------------------------------------------------

/**
 * Generate a new UUID (v4).
 */
export function generateId(): string {
  return uuidv4();
}

// ---------------------------------------------------------------------------
// Text helpers
// ---------------------------------------------------------------------------

/**
 * Truncate `text` to at most `maxChars` characters, appending an ellipsis
 * (`…`) when truncation occurs.
 */
export function truncateText(text: string, maxChars: number): string {
  if (text.length <= maxChars) {
    return text;
  }

  return text.slice(0, maxChars) + "…";
}

// ---------------------------------------------------------------------------
// Unit conversion helpers
// ---------------------------------------------------------------------------

/** Convert inches to typographic points (1 in = 72 pt). */
export function inchesToPoints(inches: number): number {
  return inches * 72;
}

/** Convert typographic points to inches (1 pt = 1/72 in). */
export function pointsToInches(points: number): number {
  return points / 72;
}
