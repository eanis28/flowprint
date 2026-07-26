import type { EventType, FlowEvent } from './types';

const DEMO_SEQUENCE: Array<[EventType, string?, number?]> = [
  ['SESSION_START'],
  ['TAB_SWITCH', 'course.flowprint-demo', 1],
  ['COPY_EVENT', 'course.flowprint-demo'],
  ['TAB_SWITCH', 'calendar.flowprint-demo', 2],
  ['PASTE_EVENT', 'calendar.flowprint-demo'],
  ['TAB_SWITCH', 'course.flowprint-demo', 1],
  ['COPY_EVENT', 'course.flowprint-demo'],
  ['TAB_SWITCH', 'calendar.flowprint-demo', 2],
  ['PASTE_EVENT', 'calendar.flowprint-demo'],
  ['TAB_SWITCH', 'course.flowprint-demo', 1],
  ['COPY_EVENT', 'course.flowprint-demo'],
  ['TAB_SWITCH', 'calendar.flowprint-demo', 2],
  ['PASTE_EVENT', 'calendar.flowprint-demo'],
  ['TAB_SWITCH', 'course.flowprint-demo', 1],
  ['COPY_EVENT', 'course.flowprint-demo'],
  ['TAB_SWITCH', 'calendar.flowprint-demo', 2],
  ['PASTE_EVENT', 'calendar.flowprint-demo'],
  ['SESSION_END']
];

export function fictionalDemoEvents(sessionId: string, startedAt = Date.now() - 180_000): FlowEvent[] {
  return DEMO_SEQUENCE.map(([type, domain, tabId], index) => ({
    id: crypto.randomUUID(),
    sessionId,
    timestamp: startedAt + index * 10_000,
    type,
    ...(domain ? { domain } : {}),
    ...(tabId !== undefined ? { tabId } : {})
  }));
}
