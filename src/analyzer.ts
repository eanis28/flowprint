import type { FlowEvent } from './types';

export interface RepeatedPattern {
  sequence: string[];
  occurrences: number;
  sessionCount: number;
}

export interface TransferSignal {
  from: string;
  to: string;
  count: number;
}

export interface WorkflowSummary {
  sessionId: string;
  startedAt: number;
  endedAt: number;
  complete: boolean;
  durationMs: number;
  eventCount: number;
  toolSequence: string[];
  runSequences: string[][];
  workflowRuns: number;
  uniqueTools: number;
  contextSwitches: number;
  clicks: number;
  copyEvents: number;
  pasteEvents: number;
  backtracks: number;
  transfers: TransferSignal[];
}

export interface Analysis {
  sessions: WorkflowSummary[];
  repeatedPatterns: RepeatedPattern[];
}

const ACTION_TYPES = new Set(['CLICK', 'COPY_EVENT', 'PASTE_EVENT']);
export const IDLE_GAP_MS = 5 * 60_000;

function ordered(events: FlowEvent[]): FlowEvent[] {
  return [...events].sort((a, b) => a.timestamp - b.timestamp);
}

function collapseDomains(events: FlowEvent[]): string[] {
  const sequence: string[] = [];
  for (const event of events) {
    if (!event.domain || (!ACTION_TYPES.has(event.type) && event.type !== 'TAB_SWITCH' && event.type !== 'PAGE_NAVIGATION')) continue;
    if (sequence.at(-1) !== event.domain) sequence.push(event.domain);
  }
  return sequence;
}

export function splitByIdleGap(events: FlowEvent[], idleGapMs = IDLE_GAP_MS): FlowEvent[][] {
  const source = ordered(events);
  const runs: FlowEvent[][] = [];
  let current: FlowEvent[] = [];
  for (const event of source) {
    if (current.length && event.timestamp - current.at(-1)!.timestamp > idleGapMs) {
      runs.push(current);
      current = [];
    }
    current.push(event);
  }
  if (current.length) runs.push(current);
  return runs;
}

function countBacktracks(sequence: string[]): number {
  let count = 0;
  for (let index = 2; index < sequence.length; index += 1) {
    if (sequence[index] === sequence[index - 2]) count += 1;
  }
  return count;
}

function transferSignals(events: FlowEvent[]): TransferSignal[] {
  const pairs = new Map<string, TransferSignal>();
  let pendingCopy: FlowEvent | undefined;
  for (const event of events) {
    if (event.type === 'COPY_EVENT' && event.domain) pendingCopy = event;
    if (event.type !== 'PASTE_EVENT' || !event.domain || !pendingCopy) continue;
    const withinTwoMinutes = event.timestamp - pendingCopy.timestamp <= 120_000;
    if (withinTwoMinutes && event.domain !== pendingCopy.domain) {
      const from = pendingCopy.domain;
      if (!from) continue;
      const key = `${from}\n${event.domain}`;
      const existing = pairs.get(key);
      pairs.set(key, existing ? { ...existing, count: existing.count + 1 } : { from, to: event.domain, count: 1 });
    }
    pendingCopy = undefined;
  }
  return [...pairs.values()].sort((a, b) => b.count - a.count);
}

function summarizeSession(sessionEvents: FlowEvent[]): WorkflowSummary {
  const events = ordered(sessionEvents);
  const start = events.find(event => event.type === 'SESSION_START')?.timestamp ?? events[0]?.timestamp ?? 0;
  const endEvent = [...events].reverse().find(event => event.type === 'SESSION_END');
  const end = endEvent?.timestamp ?? events.at(-1)?.timestamp ?? start;
  const runSequences = splitByIdleGap(events).map(collapseDomains).filter(sequence => sequence.length);
  const toolSequence = runSequences.flat();
  return {
    sessionId: events[0]?.sessionId ?? '',
    startedAt: start,
    endedAt: end,
    complete: Boolean(endEvent),
    durationMs: Math.max(0, end - start),
    eventCount: events.length,
    toolSequence,
    runSequences,
    workflowRuns: runSequences.length,
    uniqueTools: new Set(toolSequence).size,
    contextSwitches: runSequences.reduce((total, sequence) => total + Math.max(0, sequence.length - 1), 0),
    clicks: events.filter(event => event.type === 'CLICK').length,
    copyEvents: events.filter(event => event.type === 'COPY_EVENT').length,
    pasteEvents: events.filter(event => event.type === 'PASTE_EVENT').length,
    backtracks: runSequences.reduce((total, sequence) => total + countBacktracks(sequence), 0),
    transfers: transferSignals(events)
  };
}

function countNonOverlapping(sequence: string[], candidate: string[]): number {
  let count = 0;
  for (let index = 0; index <= sequence.length - candidate.length;) {
    const matches = candidate.every((token, offset) => sequence[index + offset] === token);
    if (matches) {
      count += 1;
      index += candidate.length;
    } else {
      index += 1;
    }
  }
  return count;
}

function canonicalRotation(sequence: string[]): string {
  const rotations = sequence.map((_, index) => [...sequence.slice(index), ...sequence.slice(0, index)].join('\n'));
  return rotations.sort()[0] ?? '';
}

function isExpandedCopy(sequence: string[], shorter: string[]): boolean {
  if (sequence.length <= shorter.length) return false;
  return shorter.some((_, offset) =>
    sequence.every((tool, index) => tool === shorter[(index + offset) % shorter.length])
  );
}

export function detectRepeatedPatterns(sequences: string[][], owners?: string[]): RepeatedPattern[] {
  const candidates = new Map<string, string[]>();
  for (const sequence of sequences) {
    for (let length = 2; length <= Math.min(4, sequence.length); length += 1) {
      for (let index = 0; index <= sequence.length - length; index += 1) {
        const candidate = sequence.slice(index, index + length);
        candidates.set(candidate.join('\n'), candidate);
      }
    }
  }

  const repeated = [...candidates.values()]
    .map(candidate => ({
      sequence: candidate,
      occurrences: sequences.reduce((total, sequence) => total + countNonOverlapping(sequence, candidate), 0),
      sessionCount: new Set(sequences.flatMap((sequence, index) =>
        countNonOverlapping(sequence, candidate) > 0 ? [owners?.[index] ?? String(index)] : []
      )).size
    }))
    .filter(pattern => pattern.occurrences >= 2);

  const simplestRepeated = repeated
    .filter(pattern => !repeated.some(shorter =>
      isExpandedCopy(pattern.sequence, shorter.sequence) &&
      shorter.occurrences >= pattern.occurrences
    ))
    .sort((a, b) => b.sequence.length - a.sequence.length || b.occurrences - a.occurrences);

  const selected: RepeatedPattern[] = [];
  for (const pattern of simplestRepeated) {
    const isShiftedDuplicate = selected.some(existing =>
      existing.sequence.length === pattern.sequence.length &&
      canonicalRotation(existing.sequence) === canonicalRotation(pattern.sequence)
    );
    const isCovered = selected.some(existing =>
      existing.occurrences === pattern.occurrences &&
      existing.sequence.join('\n').includes(pattern.sequence.join('\n'))
    );
    if (!isCovered && !isShiftedDuplicate) selected.push(pattern);
    if (selected.length === 3) break;
  }
  return selected;
}

export function patternSignature(sequence: string[]): string {
  return sequence.join('→');
}

export type OpportunityPriority = 'Emerging' | 'Moderate' | 'High';
export function opportunityPriority(pattern: RepeatedPattern): { label: OpportunityPriority; points: number } {
  const frequencyPoints = Math.min(3, pattern.occurrences);
  const sequencePoints = pattern.sequence.length >= 4 ? 2 : 1;
  const spreadPoints = pattern.sessionCount >= 2 ? 1 : 0;
  const points = frequencyPoints + sequencePoints + spreadPoints;
  return { label: points >= 6 ? 'High' : points >= 4 ? 'Moderate' : 'Emerging', points };
}

export function analyzeEvents(events: FlowEvent[]): Analysis {
  const grouped = new Map<string, FlowEvent[]>();
  for (const event of events) {
    const session = grouped.get(event.sessionId) ?? [];
    session.push(event);
    grouped.set(event.sessionId, session);
  }
  const sessions = [...grouped.values()]
    .map(summarizeSession)
    .sort((a, b) => b.startedAt - a.startedAt);
  const patternInputs = sessions.flatMap(session => session.runSequences.map(sequence => ({ sequence, owner: session.sessionId })));
  return {
    sessions,
    repeatedPatterns: detectRepeatedPatterns(patternInputs.map(item => item.sequence), patternInputs.map(item => item.owner))
  };
}
