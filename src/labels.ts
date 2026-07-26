const DEMO_TOOL_LABELS: Record<string, string> = {
  'email.flowprint-demo': 'Email',
  'calendar.flowprint-demo': 'Calendar',
  'maps.flowprint-demo': 'Maps',
  'course.flowprint-demo': 'Course website'
};

const EVENT_LABELS: Record<string, string> = {
  SESSION_START: 'Started observation',
  SESSION_END: 'Stopped observation',
  PAGE_NAVIGATION: 'Opened page',
  TAB_SWITCH: 'Switched tab',
  CLICK: 'Clicked',
  COPY_EVENT: 'Copied',
  PASTE_EVENT: 'Pasted',
  PAGE_FOCUS: 'Returned to page',
  PAGE_BLUR: 'Left page'
};

export function displayTool(domain: string): string {
  return DEMO_TOOL_LABELS[domain] ?? domain;
}

export function isDemoSession(sessionId: string): boolean {
  return sessionId.startsWith('demo-');
}

export function displayEventType(type: string): string {
  return EVENT_LABELS[type] ?? type.toLowerCase().replaceAll('_', ' ');
}
