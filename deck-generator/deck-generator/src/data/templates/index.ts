import type { SlideTemplate } from '@/lib/templates/types';

import { titleSlideTemplates } from './title-slides';
import { agendaTemplates } from './agenda';
import { processFlowTemplates } from './process-flows';
import { timelineTemplates } from './timelines';
import { comparisonTemplates } from './comparison';
import { bulletLayoutTemplates } from './bullet-layouts';
import { chartTemplates } from './charts';
import { teamAboutTemplates } from './team-about';
import { swotTemplates } from './swot';
import { closingTemplates } from './closing';
import { quoteTemplates } from './quotes';
import { metricsKpiTemplates } from './metrics-kpi';
import { iconLayoutTemplates } from './icon-layouts';
import { imageLayoutTemplates } from './image-layouts';
import { hierarchyTemplates } from './hierarchy';
import { vennTemplates } from './venn';
import { matrixTemplates } from './matrix';
import { funnelTemplates } from './funnel';
import { roadmapTemplates } from './roadmap';
import { featureTemplates } from './features';
import { pricingTemplates } from './pricing';
import { testimonialTemplates } from './testimonials';
import { sectionDividerTemplates } from './section-dividers';
import { dashboardTemplates } from './dashboards';
import { statisticTemplates } from './statistics';
import { companyProfileTemplates } from './company-profiles';
import { customerJourneyTemplates } from './customer-journeys';
import { staircaseTemplates } from './staircases';
import { targetTemplates } from './targets';
import { gaugeTemplates } from './gauges';
import { puzzleTemplates } from './puzzles';
import { pestelTemplates } from './pestels';
import { cycleDiagramTemplates } from './cycle-diagrams';
import { mindMapTemplates } from './mind-maps';
import { flowchartTemplates } from './flowcharts';
import { infographicTemplates } from './infographics';
import { pillarTemplates } from './pillars';

export const allTemplates: SlideTemplate[] = [
  ...titleSlideTemplates,
  ...agendaTemplates,
  ...processFlowTemplates,
  ...timelineTemplates,
  ...comparisonTemplates,
  ...bulletLayoutTemplates,
  ...chartTemplates,
  ...teamAboutTemplates,
  ...swotTemplates,
  ...closingTemplates,
  ...quoteTemplates,
  ...metricsKpiTemplates,
  ...iconLayoutTemplates,
  ...imageLayoutTemplates,
  ...hierarchyTemplates,
  ...vennTemplates,
  ...matrixTemplates,
  ...funnelTemplates,
  ...roadmapTemplates,
  ...featureTemplates,
  ...pricingTemplates,
  ...testimonialTemplates,
  ...sectionDividerTemplates,
  ...dashboardTemplates,
  ...statisticTemplates,
  ...companyProfileTemplates,
  ...customerJourneyTemplates,
  ...staircaseTemplates,
  ...targetTemplates,
  ...gaugeTemplates,
  ...puzzleTemplates,
  ...pestelTemplates,
  ...cycleDiagramTemplates,
  ...mindMapTemplates,
  ...flowchartTemplates,
  ...infographicTemplates,
  ...pillarTemplates,
];
