import { describe, expect, it } from 'vitest';
import { analyzeEvents, detectRepeatedPatterns, opportunityPriority, splitByIdleGap } from '../src/analyzer';
import type { EventType, FlowEvent } from '../src/types';

let id = 0;
function event(sessionId: string, timestamp: number, type: EventType, domain?: string): FlowEvent {
  id += 1;
  return { id: String(id), sessionId, timestamp, type, ...(domain ? { domain } : {}) };
}

describe('local workflow analysis', () => {
  it('collapses same-tool noise and summarizes a completed session', () => {
    const analysis = analyzeEvents([
      event('s1', 0, 'SESSION_START'),
      event('s1', 100, 'TAB_SWITCH', 'mail.example'),
      event('s1', 200, 'CLICK', 'mail.example'),
      event('s1', 300, 'CLICK', 'mail.example'),
      event('s1', 400, 'TAB_SWITCH', 'sheets.example'),
      event('s1', 1_000, 'SESSION_END')
    ]);
    expect(analysis.sessions[0]).toMatchObject({
      complete: true,
      durationMs: 1_000,
      eventCount: 6,
      toolSequence: ['mail.example', 'sheets.example'],
      uniqueTools: 2,
      contextSwitches: 1,
      clicks: 2
    });
  });

  it('detects neutral cross-tool transfer and backtracking signals', () => {
    const summary = analyzeEvents([
      event('s1', 0, 'SESSION_START'),
      event('s1', 100, 'TAB_SWITCH', 'mail.example'),
      event('s1', 200, 'COPY_EVENT', 'mail.example'),
      event('s1', 300, 'TAB_SWITCH', 'sheets.example'),
      event('s1', 400, 'PASTE_EVENT', 'sheets.example'),
      event('s1', 500, 'TAB_SWITCH', 'mail.example'),
      event('s1', 600, 'SESSION_END')
    ]).sessions[0];
    expect(summary.backtracks).toBe(1);
    expect(summary.transfers).toEqual([{ from: 'mail.example', to: 'sheets.example', count: 1 }]);
  });

  it('does not pair stale or same-domain copy and paste actions', () => {
    const summary = analyzeEvents([
      event('s1', 0, 'SESSION_START'),
      event('s1', 100, 'COPY_EVENT', 'mail.example'),
      event('s1', 200, 'PASTE_EVENT', 'mail.example'),
      event('s1', 300, 'COPY_EVENT', 'mail.example'),
      event('s1', 130_301, 'PASTE_EVENT', 'sheets.example')
    ]).sessions[0];
    expect(summary.transfers).toEqual([]);
  });

  it('marks a session without SESSION_END as incomplete', () => {
    const summary = analyzeEvents([
      event('s1', 1_000, 'SESSION_START'),
      event('s1', 3_000, 'CLICK', 'example.com')
    ]).sessions[0];
    expect(summary.complete).toBe(false);
    expect(summary.durationMs).toBe(2_000);
  });

  it('detects repeated non-overlapping tool sequences', () => {
    expect(detectRepeatedPatterns([
      ['mail', 'sheets', 'portal', 'mail', 'sheets', 'portal']
    ])).toContainEqual({
      sequence: ['mail', 'sheets', 'portal'],
      occurrences: 2,
      sessionCount: 1
    });
  });

  it('detects a repeated four-tool sequence in one session', () => {
    expect(detectRepeatedPatterns([
      ['crave', 'chatgpt', 'claude', 'github', 'crave', 'chatgpt', 'claude', 'github']
    ])).toContainEqual({
      sequence: ['crave', 'chatgpt', 'claude', 'github'],
      occurrences: 2,
      sessionCount: 1
    });
  });

  it('shows the simplest version of a repeated loop only once', () => {
    expect(detectRepeatedPatterns([
      ['course', 'calendar', 'course', 'calendar', 'course', 'calendar', 'course', 'calendar']
    ])).toEqual([{
      sequence: ['course', 'calendar'],
      occurrences: 4,
      sessionCount: 1
    }]);
  });

  it('consolidates shifted rotations of the same repeated loop', () => {
    const patterns = detectRepeatedPatterns([
      ['email', 'sheet', 'portal', 'sheet', 'email', 'sheet', 'portal', 'sheet'],
      ['email', 'sheet', 'portal', 'sheet', 'email', 'sheet', 'portal', 'sheet']
    ]);
    expect(patterns).toContainEqual({
      sequence: ['email', 'sheet', 'portal', 'sheet'],
      occurrences: 4,
      sessionCount: 2
    });
    expect(patterns.filter(pattern => pattern.sequence.length === 4)).toHaveLength(1);
  });

  it('can detect repetition across separate sessions', () => {
    const analysis = analyzeEvents([
      event('s1', 0, 'SESSION_START'),
      event('s1', 1, 'TAB_SWITCH', 'mail'),
      event('s1', 2, 'TAB_SWITCH', 'sheets'),
      event('s1', 3, 'SESSION_END'),
      event('s2', 10, 'SESSION_START'),
      event('s2', 11, 'TAB_SWITCH', 'mail'),
      event('s2', 12, 'TAB_SWITCH', 'sheets'),
      event('s2', 13, 'SESSION_END')
    ]);
    expect(analysis.repeatedPatterns[0]).toEqual({
      sequence: ['mail', 'sheets'],
      occurrences: 2,
      sessionCount: 2
    });
  });

  it('does not create patterns across a five-minute idle boundary', () => {
    const events = [
      event('s1', 0, 'TAB_SWITCH', 'mail'),
      event('s1', 1, 'TAB_SWITCH', 'sheets'),
      event('s1', 300_002, 'TAB_SWITCH', 'portal'),
      event('s1', 300_003, 'TAB_SWITCH', 'mail')
    ];
    expect(splitByIdleGap(events)).toHaveLength(2);
    const summary = analyzeEvents(events).sessions[0];
    expect(summary.runSequences).toEqual([['mail', 'sheets'], ['portal', 'mail']]);
    expect(summary.workflowRuns).toBe(2);
    expect(summary.contextSwitches).toBe(2);
  });

  it('uses only transparent frequency, length, and session-spread priority factors', () => {
    expect(opportunityPriority({ sequence:['mail','sheets'], occurrences:2, sessionCount:1 })).toEqual({ label:'Emerging', points:3 });
    expect(opportunityPriority({ sequence:['mail','sheets','portal','sheets'], occurrences:2, sessionCount:1 })).toEqual({ label:'Moderate', points:4 });
    expect(opportunityPriority({ sequence:['mail','sheets','portal','sheets'], occurrences:3, sessionCount:2 })).toEqual({ label:'High', points:6 });
  });
});
