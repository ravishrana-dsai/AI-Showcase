#!/usr/bin/env npx tsx
// =============================================================================
// Template Validation CLI Script — Deck Generator
// =============================================================================
// Standalone script that validates all slide templates and prints a formatted
// report. Exits with code 1 if any errors are found (warnings are OK).
//
// Usage:  npx tsx scripts/validate-templates.ts
// =============================================================================

import path from 'node:path';

// ---------------------------------------------------------------------------
// Register tsconfig paths so @/ aliases resolve correctly with tsx
// ---------------------------------------------------------------------------
const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');

// We need to resolve @/ imports manually for the CLI context.
// tsx supports tsconfig paths when run from the project root, but the
// dynamic require in validate.ts uses @/data/templates which needs resolving.
// Instead, we import the templates and validator directly via relative paths.

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { allTemplates } = require(path.join(SRC, 'data', 'templates', 'index.ts'));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { validateTemplate } = require(path.join(SRC, 'lib', 'templates', 'validate.ts'));

import type { SlideTemplate } from '../src/lib/templates/types';
import type { ValidationIssue } from '../src/lib/templates/validate';

// ---------------------------------------------------------------------------
// Run validation
// ---------------------------------------------------------------------------
const templates = allTemplates as SlideTemplate[];
const issuesByTemplate = new Map<string, ValidationIssue[]>();
let totalErrors = 0;
let totalWarnings = 0;
let passed = 0;
let failed = 0;

for (const template of templates) {
  const issues = validateTemplate(template) as ValidationIssue[];
  if (issues.length > 0) {
    issuesByTemplate.set(template.id, issues);
  }

  const errors = issues.filter((i: ValidationIssue) => i.severity === 'error');
  const warnings = issues.filter(
    (i: ValidationIssue) => i.severity === 'warning'
  );
  totalErrors += errors.length;
  totalWarnings += warnings.length;

  if (errors.length > 0) {
    failed++;
  } else {
    passed++;
  }
}

// ---------------------------------------------------------------------------
// Formatted report
// ---------------------------------------------------------------------------
console.log('');
console.log('='.repeat(72));
console.log('  Template Validation Report — Deck Generator');
console.log('='.repeat(72));
console.log('');

if (issuesByTemplate.size === 0) {
  console.log('  ✓ All templates passed validation with no issues.');
} else {
  for (const [templateId, issues] of issuesByTemplate) {
    console.log(`  ┌─ ${templateId}`);
    for (const issue of issues) {
      const icon = issue.severity === 'error' ? '✖' : '⚠';
      const label = issue.severity === 'error' ? 'ERROR  ' : 'WARNING';
      const elementPart = issue.elementId ? ` [${issue.elementId}]` : '';
      console.log(`  │  ${icon} ${label} ${issue.rule}${elementPart}`);
      console.log(`  │    ${issue.message}`);
    }
    console.log('  └─');
    console.log('');
  }
}

console.log('-'.repeat(72));
console.log(
  `  Templates: ${templates.length} total, ${passed} passed, ${failed} failed`
);
console.log(
  `  Issues:    ${totalErrors + totalWarnings} total (${totalErrors} errors, ${totalWarnings} warnings)`
);
console.log('-'.repeat(72));
console.log('');

if (totalErrors > 0) {
  console.log('  ✖ Validation FAILED — fix the errors above before building.');
  console.log('');
  process.exit(1);
} else {
  console.log('  ✓ Validation PASSED — no errors found.');
  if (totalWarnings > 0) {
    console.log(
      `    (${totalWarnings} warnings — review above for potential improvements)`
    );
  }
  console.log('');
  process.exit(0);
}
