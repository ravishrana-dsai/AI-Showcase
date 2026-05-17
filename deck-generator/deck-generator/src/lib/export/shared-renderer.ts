// =============================================================================
// Shared Renderer Utilities — Deck Generator
// =============================================================================
// Common utilities used by both PPTX and Google Slides renderers.
// =============================================================================

import type { ColorTheme } from '@/lib/templates/types';
import { resolveThemeColor } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Color Resolution
// ---------------------------------------------------------------------------

/**
 * Resolves a color value (theme token or hex) to a hex color string without the # prefix.
 * Theme tokens like {{primary}} are resolved using the provided theme.
 * 
 * @param colorValue - Theme token (e.g., "{{primary}}") or hex color (e.g., "#FF0000")
 * @param theme - Color theme to resolve tokens against
 * @returns Hex color string without # prefix (e.g., "FF0000")
 */
export function resolveColor(
  colorValue: string | undefined,
  theme: ColorTheme
): string {
  if (!colorValue) {
    return theme.textPrimary.replace(/^#/, '');
  }
  return resolveThemeColor(colorValue, theme);
}

// ---------------------------------------------------------------------------
// Shape Type Mapping
// ---------------------------------------------------------------------------

/**
 * Maps abstract shape types to pptxgenjs shape names.
 * pptxgenjs uses specific shape names like 'rect', 'roundRect', 'ellipse', etc.
 * 
 * @param abstractType - Abstract shape type (e.g., "rect", "roundRect", "ellipse")
 * @returns pptxgenjs shape name, defaults to 'rect'
 */
export function mapShapeType(abstractType: string | undefined): string {
  if (!abstractType) {
    return 'rect';
  }

  const mapping: Record<string, string> = {
    rect: 'rect',
    roundRect: 'roundRect',
    ellipse: 'ellipse',
    circle: 'ellipse', // Circle is just an ellipse with equal width/height
    diamond: 'diamond',
    rightArrow: 'rightArrow',
    leftArrow: 'leftArrow',
    upArrow: 'upArrow',
    downArrow: 'downArrow',
    triangle: 'rightTriangle', // pptxgenjs uses rightTriangle as the basic triangle
    rightTriangle: 'rightTriangle',
    pentagon: 'pentagon',
    hexagon: 'hexagon',
    octagon: 'octagon',
    star: 'star5', // 5-pointed star
    star5: 'star5',
    star6: 'star6',
    star7: 'star7',
    star8: 'star8',
    star10: 'star10',
    star12: 'star12',
    star16: 'star16',
    star24: 'star24',
    star32: 'star32',
  };

  return mapping[abstractType.toLowerCase()] || 'rect';
}

/**
 * Maps abstract shape types to Google Slides API shape types.
 * Google Slides API uses enum values like 'RECTANGLE', 'ROUND_RECTANGLE', etc.
 * 
 * @param abstractType - Abstract shape type (e.g., "rect", "roundRect", "ellipse")
 * @returns Google Slides API shape type, defaults to 'RECTANGLE'
 */
export function mapToGoogleShapeType(abstractType: string | undefined): string {
  if (!abstractType) {
    return 'RECTANGLE';
  }

  const mapping: Record<string, string> = {
    rect: 'RECTANGLE',
    rectangle: 'RECTANGLE',
    roundRect: 'ROUND_RECTANGLE',
    roundRectangle: 'ROUND_RECTANGLE',
    ellipse: 'ELLIPSE',
    circle: 'ELLIPSE', // Circle is just an ellipse with equal width/height
    diamond: 'DIAMOND',
    rightArrow: 'RIGHT_ARROW',
    leftArrow: 'LEFT_ARROW',
    upArrow: 'UP_ARROW',
    downArrow: 'DOWN_ARROW',
    triangle: 'TRIANGLE',
    rightTriangle: 'TRIANGLE',
    pentagon: 'PENTAGON',
    hexagon: 'HEXAGON',
    octagon: 'OCTAGON',
    star: 'STAR', // Google Slides has a generic STAR type
    star5: 'STAR',
    star6: 'STAR',
    star7: 'STAR',
    star8: 'STAR',
    star10: 'STAR',
    star12: 'STAR',
    star16: 'STAR',
    star24: 'STAR',
    star32: 'STAR',
  };

  return mapping[abstractType.toLowerCase()] || 'RECTANGLE';
}

// ---------------------------------------------------------------------------
// Alignment Mapping
// ---------------------------------------------------------------------------

/**
 * Maps text alignment values to pptxgenjs alignment values.
 * 
 * @param align - Alignment value ('left' | 'center' | 'right' | 'justify')
 * @returns pptxgenjs alignment value
 */
export function getAlignValue(align: string | undefined): 'left' | 'center' | 'right' | 'justify' {
  if (!align) {
    return 'left';
  }

  const normalized = align.toLowerCase();
  if (normalized === 'center' || normalized === 'centre') {
    return 'center';
  }
  if (normalized === 'right') {
    return 'right';
  }
  if (normalized === 'justify') {
    return 'justify';
  }
  return 'left';
}

/**
 * Maps vertical alignment values to pptxgenjs vertical alignment values.
 * 
 * @param valign - Vertical alignment value ('top' | 'middle' | 'bottom')
 * @returns pptxgenjs vertical alignment value
 */
export function getValignValue(valign: string | undefined): 'top' | 'middle' | 'bottom' {
  if (!valign) {
    return 'top';
  }

  const normalized = valign.toLowerCase();
  if (normalized === 'middle' || normalized === 'center' || normalized === 'centre') {
    return 'middle';
  }
  if (normalized === 'bottom') {
    return 'bottom';
  }
  return 'top';
}
