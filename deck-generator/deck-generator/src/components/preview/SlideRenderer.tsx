'use client';

import React, { useMemo } from 'react';
import type {
  SlideTemplate,
  TemplateElement,
  ColorTheme,
  FillSpec,
} from '@/lib/templates/types';
import type { ChartDataPayload } from '@/types/deck';

interface SlideRendererProps {
  template: SlideTemplate;
  content: Record<string, string>;
  colorTheme: ColorTheme;
  chartData?: ChartDataPayload;
  scale?: number;
  interactive?: boolean;
  onElementClick?: (elementId: string) => void;
  className?: string;
}

// Canvas dimensions in inches (16:9 widescreen)
const CANVAS_WIDTH = 13.333;
const CANVAS_HEIGHT = 7.5;
// Pixels per inch for rendering
const PPI = 96;

// ---------------------------------------------------------------------------
// SVG Icon Library (~30 common presentation icons, 24x24 viewBox)
// ---------------------------------------------------------------------------
const ICON_PATHS: Record<string, string> = {
  rocket: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.94-.49-7-3.85-7-7.93 0-.62.08-1.22.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z',
  'chart-bar': 'M5 9.2h3V19H5V9.2zM10.6 5h2.8v14h-2.8V5zm5.6 8H19v6h-2.8v-6z',
  users: 'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z',
  lightbulb: 'M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7z',
  target: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm0-14c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm0 10c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm0-6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z',
  shield: 'M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z',
  globe: 'M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zm6.93 6h-2.95a15.65 15.65 0 0 0-1.38-3.56A8.03 8.03 0 0 1 18.92 8zM12 4.04c.83 1.2 1.48 2.53 1.91 3.96h-3.82c.43-1.43 1.08-2.76 1.91-3.96zM4.26 14C4.1 13.36 4 12.69 4 12s.1-1.36.26-2h3.38c-.08.66-.14 1.32-.14 2 0 .68.06 1.34.14 2H4.26zm.82 2h2.95c.32 1.25.78 2.45 1.38 3.56A7.987 7.987 0 0 1 5.08 16zm2.95-8H5.08a7.987 7.987 0 0 1 4.33-3.56A15.65 15.65 0 0 0 8.03 8zM12 19.96c-.83-1.2-1.48-2.53-1.91-3.96h3.82c-.43 1.43-1.08 2.76-1.91 3.96zM14.34 14H9.66c-.09-.66-.16-1.32-.16-2 0-.68.07-1.35.16-2h4.68c.09.65.16 1.32.16 2 0 .68-.07 1.34-.16 2zm.25 5.56c.6-1.11 1.06-2.31 1.38-3.56h2.95a8.03 8.03 0 0 1-4.33 3.56zM16.36 14c.08-.66.14-1.32.14-2 0-.68-.06-1.34-.14-2h3.38c.16.64.26 1.31.26 2s-.1 1.36-.26 2h-3.38z',
  zap: 'M7 2v11h3v9l7-12h-4l4-8z',
  heart: 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z',
  star: 'M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z',
  'check-circle': 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z',
  'trending-up': 'M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z',
  award: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-4h2v2h-2v-2zm0-10h2v8h-2V6z',
  briefcase: 'M20 7h-4V5l-2-2h-4L8 5v2H4c-1.1 0-2 .9-2 2v5c0 .75.4 1.38 1 1.73V19c0 1.11.89 2 2 2h14c1.11 0 2-.89 2-2v-3.28c.59-.35 1-.99 1-1.72V9c0-1.1-.9-2-2-2zM10 5h4v2h-4V5zM4 9h16v5h-5v-2H9v2H4V9zm5 7h6v2H9v-2zm10 3H5v-2h4v1h6v-1h4v2z',
  clock: 'M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z',
  code: 'M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z',
  cpu: 'M15 7H9v8h6V7zm-2 6h-2V9h2v4zm8-2V9h-2V7c0-1.1-.9-2-2-2h-2V3h-2v2h-2V3H9v2H7c-1.1 0-2 .9-2 2v2H3v2h2v2H3v2h2v2c0 1.1.9 2 2 2h2v2h2v-2h2v2h2v-2h2c1.1 0 2-.9 2-2v-2h2v-2h-2v-2h2zm-4 6H7V7h10v10z',
  database: 'M12 3C7.58 3 4 4.79 4 7v10c0 2.21 3.58 4 8 4s8-1.79 8-4V7c0-2.21-3.58-4-8-4zm0 2c3.87 0 6 1.5 6 2s-2.13 2-6 2-6-1.5-6-2 2.13-2 6-2zm6 12c0 .5-2.13 2-6 2s-6-1.5-6-2v-2.23c1.61.78 3.72 1.23 6 1.23s4.39-.45 6-1.23V17zm0-5c0 .5-2.13 2-6 2s-6-1.5-6-2V9.77C7.61 10.55 9.72 11 12 11s4.39-.45 6-1.23V12z',
  'dollar-sign': 'M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z',
  eye: 'M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z',
  flag: 'M14.4 6L14 4H5v17h2v-7h5.6l.4 2h7V6z',
  gift: 'M20 6h-2.18c.11-.31.18-.65.18-1a2.996 2.996 0 0 0-5.5-1.65l-.5.67-.5-.68C10.96 2.54 10.05 2 9 2 7.34 2 6 3.34 6 5c0 .35.07.69.18 1H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-5-2c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zM9 4c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm11 15H4v-2h16v2zm0-5H4V8h5.08L7 10.83 8.62 12 11 8.76l1-1.36 1 1.36L15.38 12 17 10.83 14.92 8H20v6z',
  key: 'M12.65 10C11.83 7.67 9.61 6 7 6c-3.31 0-6 2.69-6 6s2.69 6 6 6c2.61 0 4.83-1.67 5.65-4H17v4h4v-4h2v-4H12.65zM7 14c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z',
  layers: 'M11.99 18.54l-7.37-5.73L3 14.07l9 7 9-7-1.63-1.27-7.38 5.74zM12 16l7.36-5.73L21 9l-9-7-9 7 1.63 1.27L12 16z',
  link: 'M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z',
  mail: 'M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z',
  'map-pin': 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z',
  'message-circle': 'M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z',
  phone: 'M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z',
  search: 'M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z',
};

function resolveColor(
  colorValue: string | undefined,
  theme: ColorTheme
): string {
  if (!colorValue) return theme.textPrimary;

  const match = colorValue.match(/^\{\{(\w+)\}\}$/);
  if (match) {
    const token = match[1] as keyof ColorTheme;
    const resolved = theme[token];
    return typeof resolved === 'string' ? resolved : theme.textPrimary;
  }

  // Ensure it has a # prefix
  if (colorValue.startsWith('#')) return colorValue;
  return `#${colorValue}`;
}

function getFillStyle(
  fill: FillSpec | undefined,
  theme: ColorTheme
): React.CSSProperties {
  if (!fill) return {};

  const color = resolveColor(fill.color, theme);
  const styles: React.CSSProperties = {};

  if (fill.type === 'gradient' && fill.gradientTo) {
    const toColor = resolveColor(fill.gradientTo, theme);
    const angle = fill.gradientAngle ?? 180;
    if (fill.gradientType === 'radial') {
      styles.background = `radial-gradient(circle, ${color}, ${toColor})`;
    } else {
      styles.background = `linear-gradient(${angle}deg, ${color}, ${toColor})`;
    }
    styles.opacity = fill.transparency ? 1 - fill.transparency / 100 : 1;
  } else {
    styles.backgroundColor = color;
    styles.opacity = fill.transparency ? 1 - fill.transparency / 100 : 1;
  }

  if (fill.backdropBlur) {
    styles.backdropFilter = `blur(${fill.backdropBlur}px)`;
    styles.WebkitBackdropFilter = `blur(${fill.backdropBlur}px)`;
  }

  return styles;
}

function getTextAlign(
  align: string | undefined
): React.CSSProperties['textAlign'] {
  switch (align) {
    case 'left':
      return 'left';
    case 'center':
      return 'center';
    case 'right':
      return 'right';
    default:
      return 'left';
  }
}

function getVerticalAlign(valign: string | undefined): React.CSSProperties {
  switch (valign) {
    case 'top':
      return { justifyContent: 'flex-start' };
    case 'middle':
      return { justifyContent: 'center' };
    case 'bottom':
      return { justifyContent: 'flex-end' };
    default:
      return { justifyContent: 'flex-start' };
  }
}

function getShapeStyle(
  shapeType: string | undefined
): React.CSSProperties {
  switch (shapeType) {
    case 'ellipse':
      return { borderRadius: '50%' };
    case 'roundRect':
      return { borderRadius: '12px' };
    case 'diamond':
      return { transform: 'rotate(45deg)' };
    case 'rightArrow':
      return {
        clipPath: 'polygon(0 20%, 70% 20%, 70% 0, 100% 50%, 70% 100%, 70% 80%, 0 80%)',
      };
    case 'triangle':
      return {
        clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)',
      };
    case 'pentagon':
      return {
        clipPath: 'polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)',
      };
    case 'hexagon':
      return {
        clipPath: 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)',
      };
    case 'trapezoid':
      return {
        clipPath: 'polygon(20% 0%, 80% 0%, 100% 100%, 0% 100%)',
      };
    default:
      return {};
  }
}

function RenderElement({
  element,
  content,
  theme,
  chartData,
  interactive,
  onElementClick,
}: {
  element: TemplateElement;
  content: Record<string, string>;
  theme: ColorTheme;
  chartData?: ChartDataPayload;
  interactive?: boolean;
  onElementClick?: (elementId: string) => void;
}) {
  const pos = element.position;
  const contentText = content[element.id] || element.placeholder?.label || '';

  const baseStyle: React.CSSProperties = {
    position: 'absolute',
    left: `${(pos.x / CANVAS_WIDTH) * 100}%`,
    top: `${(pos.y / CANVAS_HEIGHT) * 100}%`,
    width: `${(pos.w / CANVAS_WIDTH) * 100}%`,
    height: `${(pos.h / CANVAS_HEIGHT) * 100}%`,
    zIndex: element.zIndex ?? 'auto',
    ...(pos.rotate ? { transform: `rotate(${pos.rotate}deg)` } : {}),
    ...(interactive
      ? { cursor: 'pointer', transition: 'box-shadow 0.2s' }
      : {}),
  };

  const handleClick = (e: React.MouseEvent) => {
    if (interactive && onElementClick) {
      e.stopPropagation();
      onElementClick(element.id);
    }
  };

  switch (element.type) {
    case 'text': {
      const font = element.font;
      const textStyle: React.CSSProperties = {
        ...baseStyle,
        display: 'flex',
        flexDirection: 'column',
        ...getVerticalAlign(font?.valign),
        fontFamily: font?.family || 'Inter, system-ui, sans-serif',
        fontSize: `${((font?.size || 16) / 16) * 1}em`,
        color: resolveColor(font?.color, theme),
        fontWeight: font?.bold ? 700 : 400,
        fontStyle: font?.italic ? 'italic' : 'normal',
        textDecoration: font?.underline ? 'underline' : 'none',
        textAlign: getTextAlign(font?.align),
        lineHeight: font?.lineSpacing || 1.3,
        textTransform: font?.textTransform || 'none',
        letterSpacing: font?.letterSpacing ? `${font.letterSpacing}px` : 'normal',
        overflow: 'hidden',
        wordWrap: 'break-word',
        padding: '2px 4px',
      };

      // Check if content is placeholder text (no real content provided)
      const isPlaceholder = !content[element.id] && element.placeholder?.label;

      return (
        <div
          key={element.id}
          style={textStyle}
          onClick={handleClick}
          className={interactive ? 'hover:ring-2 hover:ring-blue-400 hover:ring-offset-1 rounded' : ''}
        >
          <span style={{ opacity: isPlaceholder ? 0.4 : 1 }}>
            {contentText}
          </span>
        </div>
      );
    }

    case 'shape': {
      const shapeStyle: React.CSSProperties = {
        ...baseStyle,
        ...getFillStyle(element.fill, theme),
        ...getShapeStyle(element.shapeType),
        ...(element.border
          ? {
              border: `${element.border.width || 1}px ${element.border.dashType || 'solid'} ${resolveColor(element.border.color, theme)}`,
              ...(element.border.radius
                ? { borderRadius: `${element.border.radius}px` }
                : {}),
            }
          : {}),
        ...(element.shadow
          ? {
              boxShadow: `${element.shadow.type === 'inner' ? 'inset ' : ''}${element.shadow.offset}px ${element.shadow.offset}px ${element.shadow.blur}px ${resolveColor(element.shadow.color, theme)}`,
            }
          : {}),
      };

      // If shape has text content (like a number in a circle)
      if (content[element.id] && element.font) {
        return (
          <div
            key={element.id}
            style={{
              ...shapeStyle,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: element.font.family || 'Inter, system-ui, sans-serif',
              fontSize: `${((element.font.size || 16) / 16)}em`,
              color: resolveColor(element.font.color, theme),
              fontWeight: element.font.bold ? 700 : 400,
            }}
            onClick={handleClick}
          >
            {content[element.id]}
          </div>
        );
      }

      return (
        <div
          key={element.id}
          style={shapeStyle}
          onClick={handleClick}
        />
      );
    }

    case 'line': {
      const lineStyle: React.CSSProperties = {
        ...baseStyle,
        borderTop: `${element.border?.width || 1}px ${element.border?.dashType || 'solid'} ${resolveColor(element.border?.color, theme)}`,
        height: '0px',
      };

      return <div key={element.id} style={lineStyle} />;
    }

    case 'image-placeholder': {
      return (
        <div
          key={element.id}
          style={{
            ...baseStyle,
            backgroundColor: resolveColor(theme.surface, theme),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: element.shapeType === 'ellipse' ? '50%' : '8px',
            border: `1px solid ${resolveColor(theme.textSecondary, theme)}22`,
          }}
          onClick={handleClick}
          className={interactive ? 'hover:ring-2 hover:ring-blue-400 rounded' : ''}
        >
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke={`${resolveColor(theme.textSecondary, theme)}66`}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
        </div>
      );
    }

    case 'icon-placeholder': {
      const iconColor = resolveColor(element.fill?.color || theme.accent, theme);
      const iconPath = element.iconName ? ICON_PATHS[element.iconName] : null;

      return (
        <div
          key={element.id}
          style={{
            ...baseStyle,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={handleClick}
        >
          <div
            style={{
              width: '80%',
              height: '80%',
              borderRadius: '12px',
              backgroundColor: iconColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: 0.15,
            }}
          >
            <svg
              width="55%"
              height="55%"
              viewBox="0 0 24 24"
              fill={iconColor}
              style={{ opacity: 1 / 0.15 }}
            >
              {iconPath ? (
                <path d={iconPath} />
              ) : (
                <circle cx="12" cy="12" r="10" />
              )}
            </svg>
          </div>
        </div>
      );
    }

    case 'chart-placeholder': {
      // Simple chart placeholder visualization
      const chartType = element.chartType || 'bar';

      return (
        <div
          key={element.id}
          style={{
            ...baseStyle,
            backgroundColor: `${resolveColor(theme.surface, theme)}33`,
            borderRadius: '8px',
            border: `1px solid ${resolveColor(theme.textSecondary, theme)}22`,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            padding: '8%',
            gap: '4%',
          }}
          onClick={handleClick}
        >
          {chartType === 'bar' && (
            <>
              {[0.6, 0.85, 0.45, 0.75, 0.9, 0.55].map((h, i) => (
                <div
                  key={i}
                  style={{
                    width: '12%',
                    height: `${h * 100}%`,
                    backgroundColor: resolveColor(
                      i % 2 === 0 ? theme.primary : theme.accent,
                      theme
                    ),
                    borderRadius: '3px 3px 0 0',
                    opacity: 0.7,
                  }}
                />
              ))}
            </>
          )}
          {chartType === 'pie' && (
            <div
              style={{
                width: '70%',
                height: '70%',
                borderRadius: '50%',
                background: `conic-gradient(
                  ${resolveColor(theme.primary, theme)} 0deg 120deg,
                  ${resolveColor(theme.accent, theme)} 120deg 210deg,
                  ${resolveColor(theme.secondary, theme)} 210deg 300deg,
                  ${resolveColor(theme.textSecondary, theme)} 300deg 360deg
                )`,
                opacity: 0.7,
              }}
            />
          )}
          {chartType === 'line' && (
            <svg
              width="90%"
              height="80%"
              viewBox="0 0 200 100"
              fill="none"
              style={{ opacity: 0.7 }}
            >
              <polyline
                points="10,80 40,45 80,60 120,25 160,35 190,15"
                stroke={resolveColor(theme.primary, theme)}
                strokeWidth="3"
                fill="none"
              />
              <polyline
                points="10,90 40,70 80,75 120,50 160,55 190,40"
                stroke={resolveColor(theme.accent, theme)}
                strokeWidth="3"
                fill="none"
                strokeDasharray="5,5"
              />
            </svg>
          )}
        </div>
      );
    }

    case 'group': {
      return (
        <div key={element.id} style={baseStyle}>
          {element.children?.map((child) => (
            <RenderElement
              key={child.id}
              element={child}
              content={content}
              theme={theme}
              chartData={chartData}
              interactive={interactive}
              onElementClick={onElementClick}
            />
          ))}
        </div>
      );
    }

    default:
      return null;
  }
}

export default function SlideRenderer({
  template,
  content,
  colorTheme,
  chartData,
  scale,
  interactive = false,
  onElementClick,
  className = '',
}: SlideRendererProps) {
  // Calculate the render dimensions
  const renderWidth = CANVAS_WIDTH * PPI;

  const backgroundStyle = useMemo((): React.CSSProperties => {
    if (template.backgroundFill) {
      return getFillStyle(template.backgroundFill, colorTheme);
    }
    return { backgroundColor: colorTheme.background };
  }, [template.backgroundFill, colorTheme]);

  return (
    <div
      className={`slide-renderer ${className}`}
      style={{
        position: 'relative',
        width: '100%',
        paddingBottom: `${(CANVAS_HEIGHT / CANVAS_WIDTH) * 100}%`,
        overflow: 'hidden',
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        ...(scale ? { transform: `scale(${scale})`, transformOrigin: 'top left' } : {}),
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          ...backgroundStyle,
          fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
          fontSize: `${renderWidth / 1280 * 16}px`,
        }}
      >
        {template.elements.map((element) => (
          <RenderElement
            key={element.id}
            element={element}
            content={content}
            theme={colorTheme}
            chartData={chartData}
            interactive={interactive}
            onElementClick={onElementClick}
          />
        ))}
      </div>
    </div>
  );
}
