// =============================================================================
// Google Slides Renderer — Deck Generator
// =============================================================================
// Renders a RenderableDeck to a Google Slides presentation using the Google Slides API.
// =============================================================================

import { google } from 'googleapis';
import type { RenderableDeck, RenderableSlide } from '@/types/export';
import type { TemplateElement, FillSpec, BorderSpec, FontSpec } from '@/lib/templates/types';
import { resolveColor, mapToGoogleShapeType, getAlignValue, getValignValue } from './shared-renderer';
import { hexToRgb } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Conversion factor: inches to EMU (English Metric Units) */
const INCHES_TO_EMU = 914400;

/** Maximum number of requests per batchUpdate call */
const MAX_BATCH_SIZE = 50;

// ---------------------------------------------------------------------------
// Main Render Function
// ---------------------------------------------------------------------------

/**
 * Renders a RenderableDeck to a Google Slides presentation.
 * 
 * @param deck - The renderable deck to export
 * @param accessToken - OAuth2 access token for Google API
 * @returns Promise resolving to presentation ID and URL
 */
export async function renderToGoogleSlides(
  deck: RenderableDeck,
  accessToken: string
): Promise<{ presentationId: string; presentationUrl: string }> {
  // Create OAuth2 client
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });

  // Create Slides API client
  const slides = google.slides({ version: 'v1', auth });

  // Create blank presentation
  const createResponse = await slides.presentations.create({
    requestBody: {
      title: deck.title,
    },
  });

  const presentationId = createResponse.data.presentationId;
  if (!presentationId) {
    throw new Error('Failed to create Google Slides presentation');
  }

  // Delete the default first slide
  const defaultSlideId = createResponse.data.slides?.[0]?.objectId;
  if (defaultSlideId) {
    await slides.presentations.batchUpdate({
      presentationId,
      requestBody: {
        requests: [
          {
            deleteObject: {
              objectId: defaultSlideId,
            },
          },
        ],
      },
    });
  }

  // Process each slide
  const slideObjectIds: string[] = [];
  const allRequests: any[] = [];
  const notesRequests: any[] = [];

  for (let i = 0; i < deck.slides.length; i++) {
    const slide = deck.slides[i];
    const slideObjectId = `slide_${i}_${Date.now()}`;
    slideObjectIds.push(slideObjectId);

    // Create slide request
    allRequests.push({
      createSlide: {
        objectId: slideObjectId,
        insertionIndex: i,
        slideLayoutReference: {
          predefinedLayout: 'BLANK',
        },
      },
    });

    // Build element requests for this slide
    const elementRequests = buildElementRequests(
      slide,
      slideObjectId,
      deck.slides[i]
    );
    allRequests.push(...elementRequests);

    // Store speaker notes request (will be processed after slides are created)
    if (slide.speakerNotes) {
      notesRequests.push({
        updatePageProperties: {
          objectId: slideObjectId,
          pageProperties: {
            pageElements: [
              {
                objectId: `notes_${slideObjectId}`,
                shape: {
                  shapeType: 'TEXT_BOX',
                  text: {
                    textElements: [
                      {
                        textRun: {
                          content: slide.speakerNotes,
                        },
                      },
                    ],
                  },
                },
                size: {
                  width: { magnitude: deck.slideSize.width * INCHES_TO_EMU, unit: 'EMU' },
                  height: { magnitude: deck.slideSize.height * INCHES_TO_EMU, unit: 'EMU' },
                },
                transform: {
                  scaleX: 1,
                  scaleY: 1,
                  translateX: 0,
                  translateY: 0,
                  unit: 'EMU',
                },
              },
            ],
          },
          fields: 'pageElements',
        },
      });
    }
  }

  // Execute batch updates in chunks
  await executeBatchUpdates(slides, presentationId, allRequests);

  // Add speaker notes in a separate batch (after slides are created)
  if (notesRequests.length > 0) {
    // Note: Speaker notes require accessing the notesPage, which is more complex
    // For now, we'll add notes as a text box at the bottom of each slide
    // A more complete implementation would use the notesPage API
    const notesElementRequests: any[] = [];
    
    for (let i = 0; i < deck.slides.length; i++) {
      const slide = deck.slides[i];
      if (slide.speakerNotes) {
        const slideObjectId = slideObjectIds[i];
        const notesObjectId = `notes_${slideObjectId}_${Date.now()}`;
        
        // Add notes as a small text box at the bottom
        notesElementRequests.push({
          createShape: {
            objectId: notesObjectId,
            shapeType: 'TEXT_BOX',
            elementProperties: {
              pageObjectId: slideObjectId,
              size: {
                width: { magnitude: deck.slideSize.width * INCHES_TO_EMU * 0.9, unit: 'EMU' },
                height: { magnitude: deck.slideSize.height * INCHES_TO_EMU * 0.1, unit: 'EMU' },
              },
              transform: {
                scaleX: 1,
                scaleY: 1,
                translateX: deck.slideSize.width * INCHES_TO_EMU * 0.05,
                translateY: deck.slideSize.height * INCHES_TO_EMU * 0.9,
                unit: 'EMU',
              },
            },
          },
        });

        notesElementRequests.push({
          insertText: {
            objectId: notesObjectId,
            insertionIndex: 0,
            text: slide.speakerNotes,
          },
        });

        notesElementRequests.push({
          updateTextStyle: {
            objectId: notesObjectId,
            style: {
              fontSize: {
                magnitude: 10,
                unit: 'PT',
              },
              foregroundColor: {
                rgbColor: hexToRgb(deck.slides[i].colorTheme.textSecondary),
              },
            },
            fields: 'fontSize,foregroundColor',
          },
        });
      }
    }

    if (notesElementRequests.length > 0) {
      await executeBatchUpdates(slides, presentationId, notesElementRequests);
    }
  }

  return {
    presentationId,
    presentationUrl: `https://docs.google.com/presentation/d/${presentationId}/edit`,
  };
}

// ---------------------------------------------------------------------------
// Element Request Building
// ---------------------------------------------------------------------------

/**
 * Builds Google Slides API requests for rendering template elements.
 */
function buildElementRequests(
  slide: RenderableSlide,
  slideObjectId: string,
  renderableSlide: RenderableSlide
): any[] {
  const requests: any[] = [];
  let elementCounter = 0;

  const processElement = (element: TemplateElement, parentObjectId?: string): void => {
    const objectId = `elem_${slideObjectId}_${elementCounter++}`;
    const position = element.position;

    switch (element.type) {
      case 'text':
        requests.push(...buildTextElementRequests(element, slideObjectId, objectId, slide));
        break;
      case 'shape':
        requests.push(...buildShapeElementRequests(element, slideObjectId, objectId, slide));
        break;
      case 'line':
        requests.push(...buildLineElementRequests(element, slideObjectId, objectId, slide));
        break;
      case 'chart-placeholder':
        requests.push(...buildChartPlaceholderRequests(element, slideObjectId, objectId, slide));
        break;
      case 'image-placeholder':
        requests.push(...buildImagePlaceholderRequests(element, slideObjectId, objectId, slide));
        break;
      case 'icon-placeholder':
        requests.push(...buildIconPlaceholderRequests(element, slideObjectId, objectId, slide));
        break;
      case 'group':
        if (element.children) {
          for (const child of element.children) {
            processElement(child, objectId);
          }
        }
        break;
    }
  };

  for (const element of slide.template.elements) {
    processElement(element);
  }

  return requests;
}

/**
 * Builds requests for a text element.
 */
function buildTextElementRequests(
  element: TemplateElement,
  slideObjectId: string,
  objectId: string,
  slide: RenderableSlide
): any[] {
  const requests: any[] = [];
  const content = slide.content[element.id] || '';
  const position = element.position;
  const font = element.font || {
    family: 'Arial',
    size: 12,
    color: slide.colorTheme.textPrimary,
  };

  const color = resolveColor(font.color, slide.colorTheme);
  const rgbColor = hexToRgb(color);

  // Create text box shape
  requests.push({
    createShape: {
      objectId,
      shapeType: 'TEXT_BOX',
      elementProperties: {
        pageObjectId: slideObjectId,
        size: {
          width: { magnitude: position.w * INCHES_TO_EMU, unit: 'EMU' },
          height: { magnitude: position.h * INCHES_TO_EMU, unit: 'EMU' },
        },
        transform: {
          scaleX: 1,
          scaleY: 1,
          translateX: position.x * INCHES_TO_EMU,
          translateY: position.y * INCHES_TO_EMU,
          unit: 'EMU',
        },
      },
    },
  });

  // Insert text
  if (content) {
    requests.push({
      insertText: {
        objectId,
        insertionIndex: 0,
        text: content,
      },
    });
  }

  // Update text style
  const alignment = getAlignValue(font.align);
  const googleAlignment = alignment === 'center' ? 'CENTER' : alignment === 'right' ? 'RIGHT' : 'LEFT';

  requests.push({
    updateTextStyle: {
      objectId,
      style: {
        fontFamily: font.family || 'Arial',
        fontSize: {
          magnitude: font.size || 12,
          unit: 'PT',
        },
        foregroundColor: {
          rgbColor,
        },
        bold: font.bold || false,
        italic: font.italic || false,
        underline: font.underline || false,
      },
      fields: 'fontFamily,fontSize,foregroundColor,bold,italic,underline',
    },
  });

  // Update paragraph style (alignment)
  requests.push({
    updateParagraphStyle: {
      objectId,
      style: {
        alignment: googleAlignment,
        lineSpacing: font.lineSpacing ? font.lineSpacing * 100 : 120, // Percentage
      },
      fields: 'alignment,lineSpacing',
    },
  });

  // Update shape properties (fill, border)
  const fill = element.fill;
  const border = element.border;

  if (fill || border) {
    const shapeProperties: any = {};

    if (fill) {
      const fillColor = resolveColor(fill.color, slide.colorTheme);
      shapeProperties.solidFill = {
        color: {
          rgbColor: hexToRgb(fillColor),
        },
      };
      if (fill.transparency !== undefined) {
        shapeProperties.solidFill.color.alpha = fill.transparency / 100;
      }
    }

    if (border) {
      const borderColor = resolveColor(border.color, slide.colorTheme);
      shapeProperties.outline = {
        weight: {
          magnitude: border.width || 1,
          unit: 'PT',
        },
        dashStyle: mapGoogleDashStyle(border.dashType),
        outlineFill: {
          solidFill: {
            color: {
              rgbColor: hexToRgb(borderColor),
            },
          },
        },
      };
    }

    if (Object.keys(shapeProperties).length > 0) {
      requests.push({
        updateShapeProperties: {
          objectId,
          shapeProperties,
          fields: Object.keys(shapeProperties).join(','),
        },
      });
    }
  }

  return requests;
}

/**
 * Builds requests for a shape element.
 */
function buildShapeElementRequests(
  element: TemplateElement,
  slideObjectId: string,
  objectId: string,
  slide: RenderableSlide
): any[] {
  const requests: any[] = [];
  const position = element.position;
  const shapeType = mapToGoogleShapeType(element.shapeType);

  // Create shape
  requests.push({
    createShape: {
      objectId,
      shapeType,
      elementProperties: {
        pageObjectId: slideObjectId,
        size: {
          width: { magnitude: position.w * INCHES_TO_EMU, unit: 'EMU' },
          height: { magnitude: position.h * INCHES_TO_EMU, unit: 'EMU' },
        },
        transform: {
          scaleX: 1,
          scaleY: 1,
          translateX: position.x * INCHES_TO_EMU,
          translateY: position.y * INCHES_TO_EMU,
          unit: 'EMU',
        },
      },
    },
  });

  // Add text content if present
  const content = slide.content[element.id];
  if (content) {
    requests.push({
      insertText: {
        objectId,
        insertionIndex: 0,
        text: content,
      },
    });

    const font = element.font || {
      family: 'Arial',
      size: 12,
      color: slide.colorTheme.textPrimary,
    };
    const textColor = resolveColor(font.color, slide.colorTheme);

    requests.push({
      updateTextStyle: {
        objectId,
        style: {
          fontFamily: font.family || 'Arial',
          fontSize: {
            magnitude: font.size || 12,
            unit: 'PT',
          },
          foregroundColor: {
            rgbColor: hexToRgb(textColor),
          },
          bold: font.bold || false,
          italic: font.italic || false,
        },
        fields: 'fontFamily,fontSize,foregroundColor,bold,italic',
      },
    });
  }

  // Update shape properties (fill, border)
  const fill = element.fill || {
    type: 'solid',
    color: slide.colorTheme.surface,
  };
  const border = element.border;

  const shapeProperties: any = {};

  if (fill.type === 'solid') {
    const fillColor = resolveColor(fill.color, slide.colorTheme);
    shapeProperties.solidFill = {
      color: {
        rgbColor: hexToRgb(fillColor),
      },
    };
    if (fill.transparency !== undefined) {
      shapeProperties.solidFill.color.alpha = fill.transparency / 100;
    }
  } else if (fill.type === 'gradient') {
    // Google Slides gradient support
    const startColor = resolveColor(fill.color, slide.colorTheme);
    const endColor = resolveColor(fill.gradientTo, slide.colorTheme);
    shapeProperties.gradientFill = {
      gradientStops: [
        {
          color: { rgbColor: hexToRgb(startColor) },
          position: 0,
        },
        {
          color: { rgbColor: hexToRgb(endColor) },
          position: 1,
        },
      ],
    };
  }

  if (border) {
    const borderColor = resolveColor(border.color, slide.colorTheme);
    shapeProperties.outline = {
      weight: {
        magnitude: border.width || 1,
        unit: 'PT',
      },
      dashStyle: mapGoogleDashStyle(border.dashType),
      outlineFill: {
        solidFill: {
          color: {
            rgbColor: hexToRgb(borderColor),
          },
        },
      },
    };
  }

  if (Object.keys(shapeProperties).length > 0) {
    requests.push({
      updateShapeProperties: {
        objectId,
        shapeProperties,
        fields: Object.keys(shapeProperties).join(','),
      },
    });
  }

  return requests;
}

/**
 * Builds requests for a line element.
 */
function buildLineElementRequests(
  element: TemplateElement,
  slideObjectId: string,
  objectId: string,
  slide: RenderableSlide
): any[] {
  const requests: any[] = [];
  const position = element.position;
  const border = element.border || {
    color: slide.colorTheme.primary,
    width: 1,
  };

  const lineColor = resolveColor(border.color, slide.colorTheme);

  // Calculate line endpoints
  const startX = position.x * INCHES_TO_EMU;
  const startY = position.y * INCHES_TO_EMU;
  const endX = (position.x + position.w) * INCHES_TO_EMU;
  const endY = (position.y + position.h) * INCHES_TO_EMU;

  requests.push({
    createLine: {
      objectId,
      elementProperties: {
        pageObjectId: slideObjectId,
        size: {
          width: { magnitude: Math.abs(endX - startX), unit: 'EMU' },
          height: { magnitude: Math.abs(endY - startY), unit: 'EMU' },
        },
        transform: {
          scaleX: 1,
          scaleY: 1,
          translateX: startX,
          translateY: startY,
          unit: 'EMU',
        },
      },
      lineCategory: 'STRAIGHT_LINE',
    },
  });

  requests.push({
    updateLineProperties: {
      objectId,
      lineProperties: {
        lineFill: {
          solidFill: {
            color: {
              rgbColor: hexToRgb(lineColor),
            },
          },
        },
        weight: {
          magnitude: border.width || 1,
          unit: 'PT',
        },
        dashStyle: mapGoogleDashStyle(border.dashType),
      },
      fields: 'lineFill,weight,dashStyle',
    },
  });

  return requests;
}

/**
 * Builds requests for a chart placeholder element.
 */
function buildChartPlaceholderRequests(
  element: TemplateElement,
  slideObjectId: string,
  objectId: string,
  slide: RenderableSlide
): any[] {
  // For now, render as a placeholder rectangle with text
  // Full chart support would require Google Sheets integration
  const requests: any[] = [];
  const position = element.position;

  requests.push({
    createShape: {
      objectId,
      shapeType: 'RECTANGLE',
      elementProperties: {
        pageObjectId: slideObjectId,
        size: {
          width: { magnitude: position.w * INCHES_TO_EMU, unit: 'EMU' },
          height: { magnitude: position.h * INCHES_TO_EMU, unit: 'EMU' },
        },
        transform: {
          scaleX: 1,
          scaleY: 1,
          translateX: position.x * INCHES_TO_EMU,
          translateY: position.y * INCHES_TO_EMU,
          unit: 'EMU',
        },
      },
    },
  });

  const placeholderText = slide.chartData
    ? `Chart: ${element.chartType || 'bar'}`
    : 'Chart Placeholder';

  requests.push({
    insertText: {
      objectId,
      insertionIndex: 0,
      text: placeholderText,
    },
  });

  requests.push({
    updateShapeProperties: {
      objectId,
      shapeProperties: {
        solidFill: {
          color: {
            rgbColor: { red: 0.9, green: 0.9, blue: 0.9 },
          },
        },
        outline: {
          outlineFill: {
            solidFill: {
              color: {
                rgbColor: { red: 0.7, green: 0.7, blue: 0.7 },
              },
            },
          },
        },
      },
      fields: 'solidFill,outline',
    },
  });

  return requests;
}

/**
 * Builds requests for an image placeholder element.
 */
function buildImagePlaceholderRequests(
  element: TemplateElement,
  slideObjectId: string,
  objectId: string,
  slide: RenderableSlide
): any[] {
  const requests: any[] = [];
  const position = element.position;

  requests.push({
    createShape: {
      objectId,
      shapeType: 'RECTANGLE',
      elementProperties: {
        pageObjectId: slideObjectId,
        size: {
          width: { magnitude: position.w * INCHES_TO_EMU, unit: 'EMU' },
          height: { magnitude: position.h * INCHES_TO_EMU, unit: 'EMU' },
        },
        transform: {
          scaleX: 1,
          scaleY: 1,
          translateX: position.x * INCHES_TO_EMU,
          translateY: position.y * INCHES_TO_EMU,
          unit: 'EMU',
        },
      },
    },
  });

  requests.push({
    updateShapeProperties: {
      objectId,
      shapeProperties: {
        solidFill: {
          color: {
            rgbColor: { red: 0.8, green: 0.8, blue: 0.8 },
          },
        },
        outline: {
          outlineFill: {
            solidFill: {
              color: {
                rgbColor: { red: 0.6, green: 0.6, blue: 0.6 },
              },
            },
          },
        },
      },
      fields: 'solidFill,outline',
    },
  });

  return requests;
}

/**
 * Builds requests for an icon placeholder element.
 */
function buildIconPlaceholderRequests(
  element: TemplateElement,
  slideObjectId: string,
  objectId: string,
  slide: RenderableSlide
): any[] {
  const requests: any[] = [];
  const position = element.position;
  const accentColor = resolveColor(slide.colorTheme.accent, slide.colorTheme);

  requests.push({
    createShape: {
      objectId,
      shapeType: 'ELLIPSE',
      elementProperties: {
        pageObjectId: slideObjectId,
        size: {
          width: { magnitude: position.w * INCHES_TO_EMU, unit: 'EMU' },
          height: { magnitude: position.h * INCHES_TO_EMU, unit: 'EMU' },
        },
        transform: {
          scaleX: 1,
          scaleY: 1,
          translateX: position.x * INCHES_TO_EMU,
          translateY: position.y * INCHES_TO_EMU,
          unit: 'EMU',
        },
      },
    },
  });

  requests.push({
    updateShapeProperties: {
      objectId,
      shapeProperties: {
        solidFill: {
          color: {
            rgbColor: hexToRgb(accentColor),
          },
        },
      },
      fields: 'solidFill',
    },
  });

  return requests;
}

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

/**
 * Executes batch updates in chunks to respect API limits.
 */
async function executeBatchUpdates(
  slides: any,
  presentationId: string,
  requests: any[]
): Promise<void> {
  for (let i = 0; i < requests.length; i += MAX_BATCH_SIZE) {
    const chunk = requests.slice(i, i + MAX_BATCH_SIZE);
    await slides.presentations.batchUpdate({
      presentationId,
      requestBody: {
        requests: chunk,
      },
    });
  }
}

/**
 * Maps dash type to Google Slides API dash style.
 */
function mapGoogleDashStyle(dashType: string | undefined): string {
  if (!dashType) {
    return 'SOLID';
  }

  const normalized = dashType.toLowerCase();
  if (normalized === 'dash') {
    return 'DASH';
  }
  if (normalized === 'dot') {
    return 'DOT';
  }
  if (normalized === 'dashdot' || normalized === 'dash-dot') {
    return 'DASH_DOT';
  }
  return 'SOLID';
}
