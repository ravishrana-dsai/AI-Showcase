// =============================================================================
// Template Type System — Deck Generator
// =============================================================================
// Foundational types for the slide-template engine.
// All spatial values are in **inches**. The canonical slide canvas is
// 13.333 × 7.5 in (16:9 widescreen, matching PowerPoint / Google Slides).
// =============================================================================

// ---------------------------------------------------------------------------
// Enums / Union Types
// ---------------------------------------------------------------------------

/** High-level visual language applied across an entire deck. */
export type VisualStyle = 'minimal' | 'corporate' | 'creative' | 'bold';

/** Semantic category that describes the *purpose* of a slide layout. */
export type TemplateCategory =
  | 'title'
  | 'agenda'
  | 'process-flow'
  | 'timeline'
  | 'comparison'
  | 'chart'
  | 'team'
  | 'swot'
  | 'closing'
  | 'quote'
  | 'metrics-kpi'
  | 'icon-layout'
  | 'image-layout'
  | 'bullet-layout'
  | 'hierarchy'
  | 'venn'
  | 'matrix'
  | 'funnel'
  | 'roadmap'
  | 'feature-highlight'
  | 'pricing'
  | 'testimonial'
  | 'section-divider'
  | 'cycle-diagram'
  | 'mind-map'
  | 'flowchart'
  | 'infographic'
  | 'pillar'
  | 'staircase'
  | 'target'
  | 'gauge'
  | 'puzzle'
  | 'pestel'
  | 'dashboard'
  | 'statistic'
  | 'company-profile'
  | 'customer-journey';

/** Primitive element types that can be placed on a slide. */
export type ElementType =
  | 'text'
  | 'shape'
  | 'image-placeholder'
  | 'icon-placeholder'
  | 'chart-placeholder'
  | 'line'
  | 'group';

/** Semantic role a piece of content plays within the slide narrative. */
export type ContentRole =
  | 'title'
  | 'subtitle'
  | 'body'
  | 'heading'
  | 'label'
  | 'number'
  | 'caption'
  | 'speaker-notes'
  | 'decorative';

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

/** Bounding box for any element — all values in inches. */
export interface Position {
  /** Horizontal offset from the left edge of the slide (inches). */
  x: number;
  /** Vertical offset from the top edge of the slide (inches). */
  y: number;
  /** Width (inches). */
  w: number;
  /** Height (inches). */
  h: number;
  /** Clockwise rotation in degrees (0–360). */
  rotate?: number;
}

// ---------------------------------------------------------------------------
// Styling Specs
// ---------------------------------------------------------------------------

/** Typography specification for a text element. */
export interface FontSpec {
  /** Font family name (e.g. "Inter", "Roboto"). */
  family: string;
  /** Font size in points. */
  size: number;
  /** Hex colour string (e.g. "#1A1A2E"). */
  color: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  /** Line spacing multiplier (e.g. 1.2). */
  lineSpacing?: number;
  /** Horizontal text alignment. */
  align?: 'left' | 'center' | 'right' | 'justify';
  /** Vertical text alignment within the bounding box. */
  valign?: 'top' | 'middle' | 'bottom';
  /** CSS text-transform value. */
  textTransform?: 'uppercase' | 'capitalize' | 'lowercase';
  /** Letter spacing in pixels. */
  letterSpacing?: number;
}

/** Fill specification for shapes and backgrounds. */
export interface FillSpec {
  type: 'solid' | 'gradient';
  /** Primary fill colour (hex). */
  color: string;
  /** End colour for gradient fills (hex). */
  gradientTo?: string;
  /** Gradient angle in degrees (0 = left-to-right). */
  gradientAngle?: number;
  /** Transparency percentage (0–100). */
  transparency?: number;
  /** Gradient type — defaults to 'linear' if not specified. */
  gradientType?: 'linear' | 'radial';
  /** Backdrop blur in pixels (for glassmorphism effects). */
  backdropBlur?: number;
}

/** Border / outline specification. */
export interface BorderSpec {
  /** Border colour (hex). */
  color: string;
  /** Border width in points. */
  width: number;
  /** Dash style. */
  dashType?: 'solid' | 'dash' | 'dot' | 'dashDot';
  /** Corner radius in points (rounded rectangles). */
  radius?: number;
}

/** Drop-shadow / inner-shadow specification. */
export interface ShadowSpec {
  type: 'outer' | 'inner';
  /** Shadow colour (hex). */
  color: string;
  /** Blur radius in points. */
  blur: number;
  /** Shadow offset distance in points. */
  offset: number;
  /** Shadow angle in degrees. */
  angle: number;
  /** Opacity (0–1). */
  opacity: number;
}

// ---------------------------------------------------------------------------
// Template Element
// ---------------------------------------------------------------------------

/** A single element within a slide template. */
export interface TemplateElement {
  /** Unique identifier within the template (e.g. "title-text", "icon-1"). */
  id: string;
  /** Primitive element type. */
  type: ElementType;
  /** Semantic content role. */
  role: ContentRole;
  /** Position and size on the slide canvas. */
  position: Position;
  /** Typography (text elements only). */
  font?: FontSpec;
  /** Background fill. */
  fill?: FillSpec;
  /** Border / outline. */
  border?: BorderSpec;
  /** Shadow effect. */
  shadow?: ShadowSpec;
  /** Shape sub-type when type is 'shape' (e.g. "rect", "roundRect", "ellipse"). */
  shapeType?: string;
  /** Placeholder metadata — guides content generation. */
  placeholder?: {
    /** Human-readable label for the placeholder. */
    label: string;
    /** Minimum recommended character count. */
    minChars?: number;
    /** Maximum recommended character count. */
    maxChars?: number;
    /** Whether this placeholder must be filled. */
    required?: boolean;
  };
  /** Chart sub-type when type is 'chart-placeholder'. */
  chartType?: string;
  /** Nested elements (for 'group' type). */
  children?: TemplateElement[];
  /** Z-index for layering control (higher = on top). */
  zIndex?: number;
  /** Named icon for icon-placeholder type (e.g. 'rocket', 'chart-bar', 'users'). */
  iconName?: string;
}

// ---------------------------------------------------------------------------
// Colour Theme
// ---------------------------------------------------------------------------

/** A cohesive colour palette applied to an entire deck. */
export interface ColorTheme {
  id: string;
  name: string;
  /** Primary brand / accent colour (hex). */
  primary: string;
  /** Secondary brand colour (hex). */
  secondary: string;
  /** Tertiary accent colour (hex). */
  accent: string;
  /** Slide background colour (hex). */
  background: string;
  /** Surface colour for cards / panels (hex). */
  surface: string;
  /** Primary text colour (hex). */
  textPrimary: string;
  /** Secondary / muted text colour (hex). */
  textSecondary: string;
  /** Text colour used on top of the primary colour (hex). */
  textOnPrimary: string;
}

// ---------------------------------------------------------------------------
// Slide Template
// ---------------------------------------------------------------------------

/** A complete slide template definition. */
export interface SlideTemplate {
  /** Unique template identifier (e.g. "title-minimal-01"). */
  id: string;
  /** Human-readable name. */
  name: string;
  /** Short description of the template's intended use. */
  description: string;
  /** Semantic category. */
  category: TemplateCategory;
  /** Optional sub-category for further specificity. */
  subcategory?: string;
  /** Visual style this template is designed for. */
  visualStyle: VisualStyle;
  /** Free-form tags for search / filtering. */
  tags: string[];
  /** Describes how much content the template can comfortably hold. */
  contentCapacity: {
    minElements: number;
    maxElements: number;
    idealElements: number;
  };
  /** Ordered list of elements that make up the template. */
  elements: TemplateElement[];
  /** Default colour theme applied when no override is provided. */
  defaultColorTheme: ColorTheme;
  /** Optional background fill for the slide. */
  backgroundFill?: FillSpec;
  /** Optional base-64 or URL thumbnail preview of the template. */
  thumbnail?: string;
  /** Descriptive tags for matching templates to content use-cases. */
  useCaseTags: string[];
  /** Presentation purposes this template is well-suited for. */
  compatiblePurposes: string[];
}
