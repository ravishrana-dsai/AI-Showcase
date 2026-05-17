// =============================================================================
// PPTX Renderer — Deck Generator
// =============================================================================
// Renders a RenderableDeck to a PowerPoint (.pptx) file using pptxgenjs.
// =============================================================================

import PptxGenJS from 'pptxgenjs';
import type { RenderableDeck, RenderableSlide } from '@/types/export';
import type { TemplateElement, ColorTheme } from '@/lib/templates/types';
import { resolveColor, mapShapeType, getAlignValue, getValignValue } from './shared-renderer';

// ---------------------------------------------------------------------------
// Main Render Function
// ---------------------------------------------------------------------------

/**
 * Renders a RenderableDeck to a PowerPoint (.pptx) file blob.
 */
export async function renderToPptx(deck: RenderableDeck): Promise<Blob> {
  const pptx = new PptxGenJS();

  // Set slide layout to wide (16:9)
  pptx.layout = 'LAYOUT_WIDE';

  // Set presentation metadata
  pptx.author = 'Deck Generator';
  pptx.company = 'Deck Generator';
  pptx.title = deck.title;

  // Process each slide
  for (const slide of deck.slides) {
    const pptxSlide = pptx.addSlide();

    // Set slide background
    if (slide.template.backgroundFill) {
      const bgColor = resolveColor(slide.template.backgroundFill.color, slide.colorTheme);
      pptxSlide.background = {
        color: bgColor,
        transparency: slide.template.backgroundFill.transparency || 0,
      };
    } else {
      const bgColor = resolveColor(slide.colorTheme.background, slide.colorTheme);
      pptxSlide.background = { color: bgColor };
    }

    // Render all elements
    renderElements(pptxSlide, slide.template.elements, slide, slide.colorTheme);

    // Add speaker notes
    if (slide.speakerNotes) {
      pptxSlide.addNotes(slide.speakerNotes);
    }
  }

  // Generate and return blob
  const result = await pptx.write({ outputType: 'blob' });
  return result as Blob;
}

// ---------------------------------------------------------------------------
// Element Rendering
// ---------------------------------------------------------------------------

function renderElements(
  slide: PptxGenJS.Slide,
  elements: TemplateElement[],
  renderableSlide: RenderableSlide,
  theme: ColorTheme
): void {
  // Sort elements by zIndex for correct rendering order
  const sortedElements = [...elements].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
  for (const element of sortedElements) {
    try {
      switch (element.type) {
        case 'text':
          renderTextElement(slide, element, renderableSlide, theme);
          break;
        case 'shape':
          renderShapeElement(slide, element, renderableSlide, theme);
          break;
        case 'line':
          renderLineElement(slide, element, theme);
          break;
        case 'chart-placeholder':
          renderChartElement(slide, element, renderableSlide, theme);
          break;
        case 'image-placeholder':
          renderImagePlaceholder(slide, element);
          break;
        case 'icon-placeholder':
          renderIconPlaceholder(slide, element, theme);
          break;
        case 'group':
          if (element.children) {
            renderElements(slide, element.children, renderableSlide, theme);
          }
          break;
        default:
          break;
      }
    } catch (error) {
      console.error(`Error rendering element ${element.id}:`, error);
    }
  }
}

function applyTextTransform(content: string, textTransform?: 'uppercase' | 'capitalize' | 'lowercase'): string {
  if (!textTransform) return content;
  switch (textTransform) {
    case 'uppercase': return content.toUpperCase();
    case 'lowercase': return content.toLowerCase();
    case 'capitalize': return content.replace(/\b\w/g, c => c.toUpperCase());
    default: return content;
  }
}

function renderTextElement(
  slide: PptxGenJS.Slide,
  element: TemplateElement,
  renderableSlide: RenderableSlide,
  theme: ColorTheme
): void {
  const rawContent = renderableSlide.content[element.id] || '';
  const font = element.font;
  const content = applyTextTransform(rawContent, font?.textTransform);
  const color = resolveColor(font?.color, theme);
  const pos = element.position;

  const textOptions: PptxGenJS.TextPropsOptions = {
    x: pos.x,
    y: pos.y,
    w: pos.w,
    h: pos.h,
    fontFace: font?.family || 'Arial',
    fontSize: font?.size || 12,
    color: color,
    bold: font?.bold || false,
    italic: font?.italic || false,
    underline: font?.underline
      ? { style: 'sng' as const }
      : undefined,
    align: getAlignValue(font?.align) as PptxGenJS.TextPropsOptions['align'],
    valign: getValignValue(font?.valign) as PptxGenJS.TextPropsOptions['valign'],
    lineSpacingMultiple: font?.lineSpacing || 1.2,
    charSpacing: font?.letterSpacing || undefined,
    rotate: pos.rotate || 0,
  };

  slide.addText(content, textOptions);
}

function renderShapeElement(
  slide: PptxGenJS.Slide,
  element: TemplateElement,
  renderableSlide: RenderableSlide,
  theme: ColorTheme
): void {
  const pos = element.position;
  const shapeType = mapShapeType(element.shapeType);

  const fillColor = resolveColor(element.fill?.color || '{{surface}}', theme);
  const borderColor = element.border
    ? resolveColor(element.border.color, theme)
    : undefined;

  // If shape has text content, use addText with a shape
  const content = renderableSlide.content[element.id];
  if (content && element.font) {
    const textColor = resolveColor(element.font.color, theme);
    slide.addText(content, {
      shape: shapeType as PptxGenJS.TextPropsOptions['shape'],
      x: pos.x,
      y: pos.y,
      w: pos.w,
      h: pos.h,
      fill: {
        color: fillColor,
        transparency: element.fill?.transparency || 0,
      },
      line: borderColor
        ? { color: borderColor, width: element.border?.width || 1 }
        : undefined,
      fontFace: element.font.family || 'Arial',
      fontSize: element.font.size || 12,
      color: textColor,
      bold: element.font.bold || false,
      italic: element.font.italic || false,
      align: getAlignValue(element.font.align) as PptxGenJS.TextPropsOptions['align'],
      valign: getValignValue(element.font.valign) as PptxGenJS.TextPropsOptions['valign'],
      rotate: pos.rotate || 0,
    });
  } else {
    // Pure shape without text
    slide.addShape(shapeType as PptxGenJS.SHAPE_NAME, {
      x: pos.x,
      y: pos.y,
      w: pos.w,
      h: pos.h,
      fill: {
        color: fillColor,
        transparency: element.fill?.transparency || 0,
      },
      line: borderColor
        ? { color: borderColor, width: element.border?.width || 1 }
        : undefined,
      shadow: element.shadow
        ? {
            type: element.shadow.type === 'outer' ? 'outer' : 'inner',
            angle: element.shadow.angle || 0,
            blur: element.shadow.blur || 0,
            offset: element.shadow.offset || 0,
            opacity: element.shadow.opacity || 0.5,
            color: resolveColor(element.shadow.color, theme),
          }
        : undefined,
      rotate: pos.rotate || 0,
    });
  }
}

function renderLineElement(
  slide: PptxGenJS.Slide,
  element: TemplateElement,
  theme: ColorTheme
): void {
  const pos = element.position;
  const lineColor = element.border
    ? resolveColor(element.border.color, theme)
    : resolveColor('{{textSecondary}}', theme);

  slide.addShape('line', {
    x: pos.x,
    y: pos.y,
    w: pos.w,
    h: pos.h,
    line: {
      color: lineColor,
      width: element.border?.width || 1,
    },
    rotate: pos.rotate || 0,
  });
}

function renderChartElement(
  slide: PptxGenJS.Slide,
  element: TemplateElement,
  renderableSlide: RenderableSlide,
  theme: ColorTheme
): void {
  const pos = element.position;
  const chartData = renderableSlide.chartData;

  if (chartData && chartData.labels.length > 0 && chartData.datasets.length > 0) {
    const chartType = element.chartType || 'bar';
    let pptxChartType: PptxGenJS.CHART_NAME;

    switch (chartType.toLowerCase()) {
      case 'bar':
      case 'column':
        pptxChartType = 'bar';
        break;
      case 'line':
        pptxChartType = 'line';
        break;
      case 'pie':
        pptxChartType = 'pie';
        break;
      case 'area':
        pptxChartType = 'area';
        break;
      default:
        pptxChartType = 'bar';
    }

    const chartDataArray = chartData.datasets.map((dataset) => ({
      name: dataset.name,
      labels: chartData.labels,
      values: dataset.values,
    }));

    try {
      slide.addChart(pptxChartType, chartDataArray, {
        x: pos.x,
        y: pos.y,
        w: pos.w,
        h: pos.h,
      });
    } catch (error) {
      console.error('Error adding chart, falling back to placeholder:', error);
      renderImagePlaceholder(slide, element);
    }
  } else {
    renderImagePlaceholder(slide, element);
  }
}

function renderImagePlaceholder(
  slide: PptxGenJS.Slide,
  element: TemplateElement
): void {
  const pos = element.position;
  slide.addShape('rect', {
    x: pos.x,
    y: pos.y,
    w: pos.w,
    h: pos.h,
    fill: { color: 'CCCCCC' },
    line: { color: '999999', width: 1 },
  });
}

function renderIconPlaceholder(
  slide: PptxGenJS.Slide,
  element: TemplateElement,
  theme: ColorTheme
): void {
  const pos = element.position;
  const accentColor = resolveColor(element.fill?.color || '{{accent}}', theme);

  slide.addShape('ellipse', {
    x: pos.x,
    y: pos.y,
    w: pos.w,
    h: pos.h,
    fill: { color: accentColor },
  });
}
