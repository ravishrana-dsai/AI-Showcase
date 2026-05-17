# PRD: Analytics Dashboard

## Problem
Business stakeholders have no visibility into key product metrics without requesting reports from the data team. We need a self-service analytics dashboard that surfaces the most important KPIs at a glance.

## Users
- Product managers tracking feature adoption and engagement
- Executives reviewing high-level business metrics
- Marketing team monitoring acquisition and conversion funnels

## Goals
- Display key metrics in a visually clear, scannable dashboard.
- Support a date range picker for filtering data.
- Show trends over time with charts.
- Allow comparing current period to previous period.

## Acceptance criteria
1. The dashboard page shows a top row of 4 KPI summary cards: Total Users (with % change vs. previous period), Active Users (daily active), Revenue (current period total), Conversion Rate (signup to paid %).
2. Each KPI card shows: metric name, current value, percentage change with green (up) or red (down) arrow, a mini sparkline chart showing the 7-day trend.
3. Below the KPI cards, a large area chart displays "Users Over Time" with the selected date range. The chart has a tooltip on hover showing exact values.
4. A date range picker in the top-right corner lets users select: Last 7 days, Last 30 days, Last 90 days, or a custom date range.
5. Below the main chart, a two-column layout shows: Left — "Top Pages" table (page name, views, avg. time on page) for the top 10 pages. Right — "Traffic Sources" doughnut/pie chart showing source breakdown (Direct, Organic, Referral, Social, Paid).
6. All data is placeholder/mock data for the prototype.
7. The dashboard is responsive — cards and charts stack on smaller screens.

## Out of scope (v1)
- Real data integration or API connections
- Export to PDF/CSV
- Custom dashboard builder (drag-and-drop widgets)
- User-level drill-down views
