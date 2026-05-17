// =============================================================================
// Template Validation System — Deck Generator
// =============================================================================
// Pure validation functions that catch visual bugs (overflow, poor contrast,
// clipping, broken icons, structural issues) at build time and during dev.
// =============================================================================

import type { SlideTemplate, TemplateElement, FillSpec } from './types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CANVAS_WIDTH = 13.333;
const CANVAS_HEIGHT = 7.5;
const OVERFLOW_TOLERANCE = 0.5; // inches — warn within tolerance, error beyond

const VALID_ICON_NAMES = new Set([
  'rocket',
  'chart-bar',
  'users',
  'lightbulb',
  'target',
  'shield',
  'globe',
  'zap',
  'heart',
  'star',
  'check-circle',
  'trending-up',
  'award',
  'briefcase',
  'clock',
  'code',
  'cpu',
  'database',
  'dollar-sign',
  'eye',
  'flag',
  'gift',
  'key',
  'layers',
  'link',
  'mail',
  'map-pin',
  'message-circle',
  'phone',
  'search',
]);

// Theme token patterns used for color references
const DARK_COLOR_TOKENS = new Set(['{{primary}}', '{{secondary}}']);
const TEXT_TOKENS_NEEDING_ON_PRIMARY = new Set([
  '{{textPrimary}}',
  '{{textSecondary}}',
]);

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface ValidationIssue {
  templateId: string;
  elementId?: string;
  severity: 'error' | 'warning';
  rule: string;
  message: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Estimate the relative luminance of a hex colour string.
 * Returns a value between 0 (black) and 1 (white).
 * For theme tokens ({{primary}}, etc.) we return -1 to signal "unknown".
 */
function hexLuminance(hex: string): number {
  // Strip leading '#'
  const cleaned = hex.replace(/^#/, '');
  if (!/^[0-9a-fA-F]{6}$/.test(cleaned) && !/^[0-9a-fA-F]{3}$/.test(cleaned)) {
    return -1; // not a valid hex colour (likely a theme token)
  }

  let r: number, g: number, b: number;
  if (cleaned.length === 3) {
    r = parseInt(cleaned[0] + cleaned[0], 16) / 255;
    g = parseInt(cleaned[1] + cleaned[1], 16) / 255;
    b = parseInt(cleaned[2] + cleaned[2], 16) / 255;
  } else {
    r = parseInt(cleaned.substring(0, 2), 16) / 255;
    g = parseInt(cleaned.substring(2, 4), 16) / 255;
    b = parseInt(cleaned.substring(4, 6), 16) / 255;
  }

  // sRGB → linear
  const toLinear = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/**
 * Determine whether a FillSpec represents a "dark background".
 * - Theme tokens {{primary}} / {{secondary}} are considered dark.
 * - Hex colours with luminance < 0.4 are considered dark.
 * - Transparency >= 50 means the fill is mostly see-through → not dark.
 */
function isDarkFill(fill: FillSpec): boolean {
  if ((fill.transparency ?? 0) >= 50) return false;

  const color = fill.color;
  if (DARK_COLOR_TOKENS.has(color)) return true;

  const lum = hexLuminance(color);
  if (lum >= 0 && lum < 0.4) return true;

  return false;
}

/**
 * Check if an element is a full-slide background shape.
 */
function isFullSlideBackground(el: TemplateElement): boolean {
  return (
    el.type === 'shape' &&
    el.position.w >= 12 &&
    el.position.h >= 6 &&
    (el.zIndex ?? 0) === 0 &&
    !!el.fill &&
    (el.fill.transparency ?? 0) < 50
  );
}

/**
 * Collect all element IDs (recursively descending into groups).
 */
function collectElementIds(
  elements: TemplateElement[],
  ids: Map<string, number> = new Map()
): Map<string, number> {
  for (const el of elements) {
    ids.set(el.id, (ids.get(el.id) ?? 0) + 1);
    if (el.children) {
      collectElementIds(el.children, ids);
    }
  }
  return ids;
}

/**
 * Collect all elements (flat, recursively including group children).
 */
function flattenElements(elements: TemplateElement[]): TemplateElement[] {
  const result: TemplateElement[] = [];
  for (const el of elements) {
    result.push(el);
    if (el.children) {
      result.push(...flattenElements(el.children));
    }
  }
  return result;
}

/**
 * Count placeholder elements (elements with a placeholder field).
 */
function countPlaceholders(elements: TemplateElement[]): number {
  let count = 0;
  for (const el of elements) {
    if (el.placeholder) count++;
    if (el.children) count += countPlaceholders(el.children);
  }
  return count;
}

// ---------------------------------------------------------------------------
// Bounds / Overflow Validation
// ---------------------------------------------------------------------------

/**
 * Detect if an element is an intentional full-bleed / decorative overflow.
 * Common patterns:
 *  - Negative x/y positions (element starts off-canvas for bleed effect)
 *  - Decorative role with high transparency (visual accents)
 *  - Shape elements used as background gradients
 * These are legitimate design techniques and should be warnings at most.
 */
function isIntentionalBleed(el: TemplateElement): boolean {
  // Negative position means the designer intentionally extended beyond canvas
  if (el.position.x < 0 || el.position.y < 0) return true;

  // Decorative shapes with high transparency (>= 80%) are visual accents
  if (
    el.role === 'decorative' &&
    el.type === 'shape' &&
    el.fill &&
    (el.fill.transparency ?? 0) >= 80
  ) {
    return true;
  }

  return false;
}

function checkBounds(
  templateId: string,
  elements: TemplateElement[]
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const el of elements) {
    const right = el.position.x + el.position.w;
    const bottom = el.position.y + el.position.h;
    const bleed = isIntentionalBleed(el);

    if (right > CANVAS_WIDTH + OVERFLOW_TOLERANCE) {
      issues.push({
        templateId,
        elementId: el.id,
        // Downgrade to warning if this is an intentional bleed element
        severity: bleed ? 'warning' : 'error',
        rule: 'bounds/overflow-x',
        message: `Element "${el.id}" overflows horizontally: x(${el.position.x}) + w(${el.position.w}) = ${right.toFixed(3)}, max ${CANVAS_WIDTH} + ${OVERFLOW_TOLERANCE} tolerance${bleed ? ' (intentional bleed)' : ''}`,
      });
    } else if (right > CANVAS_WIDTH) {
      issues.push({
        templateId,
        elementId: el.id,
        severity: 'warning',
        rule: 'bounds/overflow-x',
        message: `Element "${el.id}" is within overflow tolerance horizontally: x(${el.position.x}) + w(${el.position.w}) = ${right.toFixed(3)}, max ${CANVAS_WIDTH}`,
      });
    }

    if (bottom > CANVAS_HEIGHT + OVERFLOW_TOLERANCE) {
      issues.push({
        templateId,
        elementId: el.id,
        severity: bleed ? 'warning' : 'error',
        rule: 'bounds/overflow-y',
        message: `Element "${el.id}" overflows vertically: y(${el.position.y}) + h(${el.position.h}) = ${bottom.toFixed(3)}, max ${CANVAS_HEIGHT} + ${OVERFLOW_TOLERANCE} tolerance${bleed ? ' (intentional bleed)' : ''}`,
      });
    } else if (bottom > CANVAS_HEIGHT) {
      issues.push({
        templateId,
        elementId: el.id,
        severity: 'warning',
        rule: 'bounds/overflow-y',
        message: `Element "${el.id}" is within overflow tolerance vertically: y(${el.position.y}) + h(${el.position.h}) = ${bottom.toFixed(3)}, max ${CANVAS_HEIGHT}`,
      });
    }

    // Recursively check children in group elements
    if (el.children) {
      issues.push(...checkBounds(templateId, el.children));
    }
  }

  return issues;
}

// ---------------------------------------------------------------------------
// Contrast / Readability Validation
// ---------------------------------------------------------------------------

function checkContrast(template: SlideTemplate): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const { backgroundFill, elements, id: templateId } = template;

  // Determine if the slide has a dark background
  let hasDarkBackground = false;

  // Check backgroundFill
  if (backgroundFill && isDarkFill(backgroundFill)) {
    hasDarkBackground = true;
  }

  // Check for full-slide background shapes
  if (!hasDarkBackground) {
    for (const el of elements) {
      if (isFullSlideBackground(el) && el.fill && isDarkFill(el.fill)) {
        hasDarkBackground = true;
        break;
      }
    }
  }

  if (!hasDarkBackground) return issues;

  // Check all text elements for contrast issues
  const allElements = flattenElements(elements);
  for (const el of allElements) {
    if (el.type === 'text' && el.font?.color) {
      if (TEXT_TOKENS_NEEDING_ON_PRIMARY.has(el.font.color)) {
        issues.push({
          templateId,
          elementId: el.id,
          severity: 'warning',
          rule: 'contrast/readability',
          message: `Text element "${el.id}" uses "${el.font.color}" on a dark background — consider using "{{textOnPrimary}}" for better readability`,
        });
      }
    }
  }

  return issues;
}

// ---------------------------------------------------------------------------
// Structural Integrity Validation
// ---------------------------------------------------------------------------

function checkStructure(template: SlideTemplate): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const { elements, id: templateId, contentCapacity } = template;

  // 1. Duplicate element IDs (error)
  const idCounts = collectElementIds(elements);
  for (const [elId, count] of idCounts) {
    if (count > 1) {
      issues.push({
        templateId,
        elementId: elId,
        severity: 'error',
        rule: 'structure/duplicate-id',
        message: `Duplicate element ID "${elId}" appears ${count} times in template "${templateId}"`,
      });
    }
  }

  // 2. Must have at least one element with role: 'title' (error)
  //    Some categories (quote, testimonial, statistic) are content-focused
  //    templates that legitimately omit a title role — downgrade to warning.
  const TITLE_EXEMPT_CATEGORIES = new Set([
    'quote',
    'testimonial',
    'statistic',
  ]);
  const allElements = flattenElements(elements);
  const hasTitleRole = allElements.some((el) => el.role === 'title');
  if (!hasTitleRole) {
    const isExempt = TITLE_EXEMPT_CATEGORIES.has(template.category);
    issues.push({
      templateId,
      severity: isExempt ? 'warning' : 'error',
      rule: 'structure/missing-title',
      message: `Template "${templateId}" has no element with role: 'title'${isExempt ? ' (category exempt — may be intentional)' : ''}`,
    });
  }

  // 3. Icon name validation (warning)
  for (const el of allElements) {
    if (el.type === 'icon-placeholder' && el.iconName) {
      if (!VALID_ICON_NAMES.has(el.iconName)) {
        issues.push({
          templateId,
          elementId: el.id,
          severity: 'warning',
          rule: 'structure/invalid-icon',
          message: `Icon placeholder "${el.id}" references unknown icon "${el.iconName}" — valid icons: ${Array.from(VALID_ICON_NAMES).join(', ')}`,
        });
      }
    }
  }

  // 4. Placeholder count vs contentCapacity (warning)
  const placeholderCount = countPlaceholders(elements);
  if (placeholderCount < contentCapacity.minElements) {
    issues.push({
      templateId,
      severity: 'warning',
      rule: 'structure/placeholder-count',
      message: `Template "${templateId}" has ${placeholderCount} placeholders but contentCapacity.minElements is ${contentCapacity.minElements}`,
    });
  }
  if (placeholderCount > contentCapacity.maxElements) {
    issues.push({
      templateId,
      severity: 'warning',
      rule: 'structure/placeholder-count',
      message: `Template "${templateId}" has ${placeholderCount} placeholders but contentCapacity.maxElements is ${contentCapacity.maxElements}`,
    });
  }

  return issues;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Validate a single template and return all issues found.
 */
export function validateTemplate(template: SlideTemplate): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  issues.push(...checkBounds(template.id, template.elements));
  issues.push(...checkContrast(template));
  issues.push(...checkStructure(template));

  return issues;
}

/**
 * Validate all registered templates.
 * Imports templates from the data layer and runs all checks.
 */
export function validateAllTemplates(): {
  issues: ValidationIssue[];
  passed: number;
  failed: number;
} {
  // Dynamic import to avoid circular dependency issues
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { allTemplates } = require('@/data/templates');
  const templates = allTemplates as SlideTemplate[];

  const allIssues: ValidationIssue[] = [];
  let passed = 0;
  let failed = 0;

  for (const template of templates) {
    const issues = validateTemplate(template);
    allIssues.push(...issues);

    const hasErrors = issues.some((i) => i.severity === 'error');
    if (hasErrors) {
      failed++;
    } else {
      passed++;
    }
  }

  return { issues: allIssues, passed, failed };
}
