import { EVENT_TYPES, type FlowEvent, type IncomingEvent } from './types';

const AUTH_PATH = /(^|\/)(login|log-in|signin|sign-in|oauth|authorize|auth)(\/|$)/i;
const AUTH_HOST = /(^|\.)(accounts\.google\.com|login\.microsoftonline\.com|login\.live\.com|appleid\.apple\.com|auth0\.com|okta\.com)$/i;
const SENSITIVE_HOST = /(^|\.)(1password|bitwarden|lastpass|dashlane|keepersecurity|chase|bankofamerica|wellsfargo|paypal|mychart)\./i;
const SAFE_PATH_CATEGORIES: Record<string, Array<[RegExp, string]>> = {
  'mail.google.com': [[/^\/mail\//, 'mail']], 'docs.google.com': [[/^\/spreadsheets\//, 'sheets'], [/^\/document\//, 'docs']],
  'calendar.google.com': [[/^\/calendar\//, 'calendar']]
};
export function normalizedDomain(rawUrl: string): string | null {
  try { const url = new URL(rawUrl); return ['http:', 'https:'].includes(url.protocol) ? url.hostname.toLowerCase().replace(/^www\./, '') : null; } catch { return null; }
}
export function exclusionDomain(input: string): string | null {
  const value = input.trim();
  if (!value) return null;
  return normalizedDomain(/^[a-z][a-z\d+.-]*:\/\//i.test(value) ? value : `https://${value}`);
}
export function pageCategory(rawUrl: string): string | undefined {
  try { const url = new URL(rawUrl); const host = normalizedDomain(rawUrl); if (!host) return undefined; return SAFE_PATH_CATEGORIES[host]?.find(([pattern]) => pattern.test(url.pathname))?.[1]; } catch { return undefined; }
}
export function isExcluded(rawUrl: string, userExcluded: string[]): boolean {
  try { const url = new URL(rawUrl); const host = normalizedDomain(rawUrl); if (!host) return true; return AUTH_HOST.test(host) || SENSITIVE_HOST.test(host) || AUTH_PATH.test(url.pathname) || userExcluded.some(d => host === d || host.endsWith(`.${d}`)); } catch { return true; }
}
export function makeEvent(input: IncomingEvent, sessionId: string, timestamp = Date.now()): FlowEvent | null {
  if (!EVENT_TYPES.includes(input.type)) return null;
  const domain = input.url ? normalizedDomain(input.url) : undefined;
  if (input.url && !domain) return null;
  return { id: crypto.randomUUID(), timestamp, sessionId, type: input.type, ...(domain ? { domain } : {}), ...(input.url && pageCategory(input.url) ? { pageCategory: pageCategory(input.url) } : {}), ...(input.tabId !== undefined ? { tabId: input.tabId } : {}) };
}
export function isValidEvent(value: unknown): value is FlowEvent {
  if (!value || typeof value !== 'object') return false; const e = value as Record<string, unknown>;
  return typeof e.id === 'string' && typeof e.timestamp === 'number' && typeof e.sessionId === 'string' && EVENT_TYPES.includes(e.type as FlowEvent['type']) && (e.domain === undefined || (typeof e.domain === 'string' && !/[/?#]/.test(e.domain)));
}
