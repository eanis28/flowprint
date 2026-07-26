import { describe, expect, it, vi } from 'vitest';
import { analyzeEvents } from '../src/analyzer';
import { fictionalDemoEvents } from '../src/demo';
import { isValidEvent } from '../src/privacy';

describe('fictional portfolio demo', () => {
  it('contains only schema-valid synthetic metadata', () => {
    vi.stubGlobal('crypto', { randomUUID: vi.fn().mockReturnValue('demo-event') });
    const events = fictionalDemoEvents('demo-session', 1_000);
    expect(events.every(isValidEvent)).toBe(true);
    expect(JSON.stringify(events)).not.toMatch(/clipboard|password|typed|pageText|query|fragment/i);
    expect(new Set(events.filter(event => event.domain).map(event => event.domain))).toEqual(new Set([
      'course.flowprint-demo',
      'calendar.flowprint-demo'
    ]));
  });

  it('demonstrates repeatedly moving deadlines from a course site to a calendar', () => {
    vi.stubGlobal('crypto', { randomUUID: vi.fn().mockReturnValue('demo-event') });
    const analysis = analyzeEvents(fictionalDemoEvents('demo-session', 1_000));
    expect(analysis.repeatedPatterns).toContainEqual({
      sequence: ['course.flowprint-demo', 'calendar.flowprint-demo'],
      occurrences: 4,
      sessionCount: 1
    });
    expect(analysis.sessions[0].transfers).toHaveLength(1);
  });
});
