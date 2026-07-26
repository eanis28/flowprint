import { describe, expect, it } from 'vitest';
import { displayEventType, displayTool, isDemoSession } from '../src/labels';

describe('plain-language tool labels', () => {
  it('shows friendly names for fictional demo tools', () => {
    expect(displayTool('email.flowprint-demo')).toBe('Email');
    expect(displayTool('calendar.flowprint-demo')).toBe('Calendar');
    expect(displayTool('maps.flowprint-demo')).toBe('Maps');
    expect(displayTool('course.flowprint-demo')).toBe('Course website');
  });

  it('keeps real normalized domains unchanged', () => {
    expect(displayTool('github.com')).toBe('github.com');
  });

  it('clearly identifies fictional demo sessions', () => {
    expect(isDemoSession('demo-123')).toBe(true);
    expect(isDemoSession('observed-123')).toBe(false);
  });

  it('shows event types as readable actions', () => {
    expect(displayEventType('TAB_SWITCH')).toBe('Switched tab');
    expect(displayEventType('SESSION_START')).toBe('Started observation');
  });
});
