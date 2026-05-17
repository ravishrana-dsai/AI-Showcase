/**
 * Lightweight server-side HTML sanitizer for rich-text content (job descriptions).
 * Strips script tags, dangerous event handlers, javascript: and data:text/html URIs.
 * Not a full-featured sanitizer — use only for content from trusted internal authors
 * rendered in public-facing pages.
 */

// Matches <script ...>...</script> blocks including multiline content
const SCRIPT_TAGS = /<script\b[\s\S]*?<\/script\s*>/gi;

// Matches dangerous void/block tags that should never appear in job descriptions
const DANGEROUS_TAGS = /<\s*(iframe|object|embed|form|input|button|base|meta|link)\b[^>]*\/?>/gi;

// Matches inline event handler attributes: onclick=, onload=, onerror=, etc.
const EVENT_HANDLERS = /\s+on[a-z]{1,20}\s*=\s*(?:"[^"]*"|'[^']*'|`[^`]*`|[^\s>]*)/gi;

// Matches javascript: protocol in href/src/action/formaction attributes
const JAVASCRIPT_PROTOCOL = /(\b(?:href|src|action|formaction|data)\s*=\s*["']?\s*)javascript\s*:/gi;

// Matches data:text/html URIs which can execute scripts in some browsers
const DATA_HTML_URI = /(\b(?:href|src)\s*=\s*["']?\s*)data\s*:\s*text\/html/gi;

export function sanitizeHtml(html: string): string {
  return html
    .replace(SCRIPT_TAGS, "")
    .replace(DANGEROUS_TAGS, "")
    .replace(EVENT_HANDLERS, "")
    .replace(JAVASCRIPT_PROTOCOL, '$1#')
    .replace(DATA_HTML_URI, '$1#');
}
