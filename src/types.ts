export const EVENT_TYPES = ['SESSION_START','SESSION_END','PAGE_NAVIGATION','TAB_SWITCH','CLICK','COPY_EVENT','PASTE_EVENT','PAGE_FOCUS','PAGE_BLUR'] as const;
export type EventType = typeof EVENT_TYPES[number];
export interface FlowEvent { id: string; timestamp: number; sessionId: string; type: EventType; domain?: string; pageCategory?: string; tabId?: number; durationMs?: number; }
export type RetentionDays = 7 | 30 | null;
export interface Settings { observing: boolean; sessionId: string | null; excludedDomains: string[]; retentionDays: RetentionDays; hasSeenOnboarding: boolean; }
export const DEFAULT_SETTINGS: Settings = { observing: false, sessionId: null, excludedDomains: [], retentionDays: 30, hasSeenOnboarding: false };
export type ReviewStatus = 'same_task' | 'different_tasks' | 'unsure';
export interface PatternReview { signature: string; status: ReviewStatus; updatedAt: number; name?: string; }
export interface SessionLabel { sessionId: string; label: string; createdAt: number; }
export type IncomingEvent = { type: EventType; url?: string; tabId?: number };
