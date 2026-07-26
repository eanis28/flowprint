import { analyzeEvents, detectRepeatedPatterns, opportunityPriority, patternSignature, type RepeatedPattern, type WorkflowSummary } from './analyzer';
import { displayEventType, displayTool, isDemoSession } from './labels';
import { choosePattern } from './learning';
import type { FlowEvent, PatternReview, ReviewStatus, SessionLabel } from './types';

let cachedEvents: FlowEvent[] = [];
let cachedReviews: PatternReview[] = [];
let cachedSessionLabels: SessionLabel[] = [];
let selectedSessionId: string | undefined;
let recentlyReviewedSignature: string | undefined;

function durationLabel(milliseconds: number): string {
  const seconds = Math.round(milliseconds / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${seconds % 60}s`;
}

function metric(value: string | number, label: string): HTMLElement {
  const card = document.createElement('div');
  card.className = 'metric';
  const number = document.createElement('strong');
  number.textContent = String(value);
  const caption = document.createElement('span');
  caption.textContent = label;
  card.append(number, caption);
  return card;
}

function signal(title: string, description: string): HTMLElement {
  const item = document.createElement('div');
  item.className = 'signal';
  const heading = document.createElement('strong');
  heading.textContent = title;
  const copy = document.createElement('span');
  copy.textContent = description;
  item.append(heading, copy);
  return item;
}

function renderSequence(summary: WorkflowSummary): void {
  const container = document.querySelector<HTMLElement>('#sequence')!;
  container.replaceChildren();
  container.className = 'sequence';
  if (!summary.toolSequence.length) {
    container.textContent = 'No tool transitions were observed.';
    container.classList.add('neutral');
    return;
  }
  summary.runSequences.forEach((run, runIndex) => {
    if (runIndex) {
      const boundary = document.createElement('span');
      boundary.className = 'run-break';
      boundary.textContent = 'idle gap · new likely workflow';
      container.append(boundary);
    }
    run.forEach((domain, index) => {
      if (index) {
        const arrow = document.createElement('span');
        arrow.className = 'arrow';
        arrow.textContent = '→';
        container.append(arrow);
      }
      const tool = document.createElement('span');
      tool.className = 'tool';
      tool.textContent = displayTool(domain);
      container.append(tool);
    });
  });
}

function reviewButton(label: string, status: ReviewStatus, pattern: RepeatedPattern, selected?: ReviewStatus): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.classList.toggle('selected', selected === status);
  button.setAttribute('aria-pressed', String(selected === status));
  button.addEventListener('click', async () => {
    recentlyReviewedSignature = patternSignature(pattern.sequence);
    await chrome.runtime.sendMessage({ command: 'REVIEW', signature: recentlyReviewedSignature, status });
    await render();
  });
  return button;
}

function renderOpportunity(pattern: RepeatedPattern, reviews: PatternReview[] = [], improvement?: string): HTMLElement {
  const selected = reviews.find(review => review.signature === patternSignature(pattern.sequence))?.status;
  const title = selected === 'same_task' ? 'Confirmed workflow'
    : selected === 'different_tasks' ? 'Dismissed pattern'
      : selected === 'unsure' ? 'Unconfirmed pattern'
        : 'This browsing path appeared more than once';
  const item = signal(title, `You visited ${pattern.sequence.map(displayTool).join(' → ')} in this order ${pattern.occurrences} times${pattern.sessionCount > 1 ? ` across ${pattern.sessionCount} recorded sessions` : ' in this recorded session'}.`);
  const evidence = document.createElement('span');
  evidence.className = 'evidence';
  const priority = opportunityPriority(pattern);
  evidence.textContent = `${priority.label === 'High' ? 'Strong repeated pattern' : priority.label === 'Moderate' ? 'Worth a closer look' : 'Early pattern'} · repeated ${pattern.occurrences} times · ${pattern.sequence.length} steps`;
  if (selected) {
    const learning = document.createElement('div');
    learning.className = `learning-state ${selected}`;
    const heading = document.createElement('strong');
    const copy = document.createElement('span');
    if (selected === 'same_task') {
      heading.textContent = 'Flowprint learned: this is one workflow';
      copy.textContent = 'This path will be prioritized when it appears again.';
    } else if (selected === 'different_tasks') {
      heading.textContent = 'Flowprint learned: these visits were unrelated';
      copy.textContent = 'This path will be hidden from future suggestions.';
    } else {
      heading.textContent = 'Kept as unconfirmed';
      copy.textContent = 'Flowprint will not treat this path as a confirmed workflow yet.';
    }
    learning.append(heading, copy);
    item.append(learning);
  }
  const actions = document.createElement('div');
  actions.className = 'review-actions';
  const question = document.createElement('strong');
  question.className = 'review-question';
  question.textContent = 'Were these sites part of the same task?';
  actions.append(
    reviewButton('Same task', 'same_task', pattern, selected),
    reviewButton('Different tasks', 'different_tasks', pattern, selected),
    reviewButton('Not sure', 'unsure', pattern, selected)
  );
  item.append(evidence);
  if (improvement) {
    const recommendation = document.createElement('div');
    recommendation.className = 'recommendation';
    const label = document.createElement('strong');
    label.textContent = 'A shortcut to check';
    const copy = document.createElement('span');
    copy.textContent = improvement;
    recommendation.append(label, copy);
    item.append(recommendation);
  }
  item.append(question, actions);
  return item;
}

function sessionLabel(sessionId: string, labels: SessionLabel[]): string | undefined {
  return labels.find(item => item.sessionId === sessionId)?.label;
}

function populateSessionPicker(sessions: WorkflowSummary[] = [], labels: SessionLabel[] = []): WorkflowSummary | undefined {
  const select = document.querySelector<HTMLSelectElement>('#session-select')!;
  if (!selectedSessionId || !sessions.some(session => session.sessionId === selectedSessionId)) selectedSessionId = sessions[0]?.sessionId;
  select.replaceChildren();
  for (const session of sessions) {
    const option = document.createElement('option');
    option.value = session.sessionId;
    option.textContent = sessionLabel(session.sessionId, labels)
      ?? (isDemoSession(session.sessionId)
        ? 'Assignment deadline example'
        : `${new Date(session.startedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })} · ${durationLabel(session.durationMs)}`);
    option.selected = session.sessionId === selectedSessionId;
    select.append(option);
  }
  return sessions.find(session => session.sessionId === selectedSessionId);
}

function sequenceAppears(sequence: string[], candidate: string[]): boolean {
  return sequence.some((_, index) => candidate.every((tool, offset) => sequence[index + offset] === tool));
}

function renderLibrary(patterns: RepeatedPattern[], reviews: PatternReview[], sessions: WorkflowSummary[]): void {
  const library = document.querySelector<HTMLElement>('#workflow-library')!;
  library.replaceChildren();
  const confirmed = reviews.filter(review => review.status === 'same_task');
  for (const review of confirmed) {
    const sequence = review.signature.split('→');
    const pattern = patterns.find(item => patternSignature(item.sequence) === review.signature);
    const matchingSessions = sessions.filter(session => session.runSequences.some(run => sequenceAppears(run, sequence)));
    const lastSeen = matchingSessions.length ? Math.max(...matchingSessions.map(session => session.endedAt)) : undefined;
    const card = document.createElement('article');
    card.className = 'workflow-card';
    const heading = document.createElement('strong');
    heading.textContent = review.name || sequence.map(displayTool).join(' → ');
    const path = document.createElement('span');
    path.textContent = sequence.map(displayTool).join(' → ');
    const meta = document.createElement('small');
    meta.textContent = [
      pattern ? `${pattern.occurrences} times observed` : undefined,
      lastSeen ? `Last seen ${new Date(lastSeen).toLocaleDateString([], { dateStyle:'medium' })}` : undefined
    ].filter(Boolean).join(' · ');
    const actions = document.createElement('div');
    actions.className = 'workflow-actions';
    const rename = document.createElement('button');
    rename.type = 'button';
    rename.textContent = 'Rename';
    rename.addEventListener('click', async () => {
      const name = prompt('Name this workflow', review.name || sequence.map(displayTool).join(' → '));
      if (name?.trim()) {
        await chrome.runtime.sendMessage({ command:'RENAME_WORKFLOW', signature:review.signature, name:name.trim() });
        await render();
      }
    });
    const dismiss = document.createElement('button');
    dismiss.type = 'button';
    dismiss.textContent = 'Dismiss';
    dismiss.addEventListener('click', async () => {
      recentlyReviewedSignature = review.signature;
      await chrome.runtime.sendMessage({ command:'REVIEW', signature:review.signature, status:'different_tasks' });
      await render();
    });
    actions.append(rename, dismiss);
    card.append(heading, path, meta, actions);
    library.append(card);
  }
  if (!library.children.length) library.append(signal('No confirmed workflows yet', 'When you mark a repeated path as the same task, it will appear here.'));
}

function renderAnalysis(events: FlowEvent[], reviews: PatternReview[], labels: SessionLabel[]): void {
  const analysis = analyzeEvents(events);
  const section = document.querySelector<HTMLElement>('#analysis')!;
  const selected = populateSessionPicker(analysis.sessions, labels);
  section.hidden = !selected;
  if (!selected) return;

  document.querySelector('#session-title')!.textContent = sessionLabel(selected.sessionId, labels)
    ?? new Date(selected.startedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
  document.querySelector('#session-state')!.textContent = isDemoSession(selected.sessionId) ? 'Example' : selected.complete ? 'Complete' : 'Recording';
  const metrics = document.querySelector<HTMLElement>('#metrics')!;
  metrics.replaceChildren(
    metric(durationLabel(selected.durationMs), 'time observed'),
    metric(selected.uniqueTools, 'apps used'),
    metric(selected.contextSwitches, 'app switches')
  );
  renderSequence(selected);

  const signals = document.querySelector<HTMLElement>('#signals')!;
  signals.replaceChildren();
  for (const transfer of selected.transfers) signals.append(signal('You copied details between apps', `You copied something in ${displayTool(transfer.from)} and pasted it into ${displayTool(transfer.to)} ${transfer.count} time${transfer.count === 1 ? '' : 's'}. Flowprint did not save what you copied.`));
  if (selected.backtracks) signals.append(signal('You went back and forth', `You returned to an app you had just used ${selected.backtracks} time${selected.backtracks === 1 ? '' : 's'}.`));
  if (selected.contextSwitches) signals.append(signal('You changed apps several times', `You moved between ${selected.uniqueTools} apps ${selected.contextSwitches} time${selected.contextSwitches === 1 ? '' : 's'}.`));
  if (selected.clicks >= 3) signals.append(signal('Several clicks happened in this workflow', `${selected.clicks} clicks were recorded. Flowprint did not save what you clicked.`));
  if (!signals.children.length) signals.append(signal('Nothing repeated enough yet', 'Try recording a longer task or doing the same task twice.'));

  const patterns = document.querySelector<HTMLElement>('#patterns')!;
  patterns.replaceChildren();
  const isDemo = isDemoSession(selected.sessionId);
  document.querySelector('#opportunity-title')!.textContent = isDemo ? 'A shortcut to check' : 'Pattern to review';
  document.querySelector('#opportunity-intro')!.textContent = isDemo
    ? 'This fictional example includes enough context to suggest a specific shortcut.'
    : 'Your answer changes which patterns Flowprint shows. It stays in this browser.';
  const demoImprovement = isDemo ? 'Check whether the course website has an “Export calendar” or “Add to calendar” option. If it does, the student could import all four deadlines together instead of entering them one at a time.' : undefined;
  const sessionPatterns = detectRepeatedPatterns(selected.runSequences, selected.runSequences.map(() => selected.sessionId));
  const strongestPattern = choosePattern(sessionPatterns, reviews, recentlyReviewedSignature);
  if (strongestPattern) patterns.append(renderOpportunity(strongestPattern, reviews, demoImprovement));
  if (!patterns.children.length) {
    const hasRepeatedPatterns = sessionPatterns.length > 0;
    patterns.append(signal(
      hasRepeatedPatterns ? 'No active suggestions' : 'No repeated sequence yet',
      hasRepeatedPatterns ? 'The repeated paths found here were marked as different tasks, so Flowprint has hidden them.' : 'A sequence must occur at least twice before Flowprint reports it as repeated.'
    ));
  }
  renderLibrary(analysis.repeatedPatterns, reviews, analysis.sessions);
}

function renderTimeline(events: FlowEvent[]): void {
  const list = document.querySelector<HTMLOListElement>('#events')!;
  list.replaceChildren();
  document.querySelector('#count')!.textContent = `(${events.length} event${events.length === 1 ? '' : 's'})`;
  document.querySelector<HTMLElement>('#empty')!.hidden = events.length > 0;
  for (const event of [...events].reverse()) {
    const item = document.createElement('li');
    const time = document.createElement('time');
    time.textContent = new Date(event.timestamp).toLocaleTimeString();
    const body = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = displayEventType(event.type);
    const meta = document.createElement('span');
    meta.textContent = [event.domain ? displayTool(event.domain) : undefined, event.pageCategory].filter(Boolean).join(' · ');
    body.append(title, meta);
    item.append(time, body);
    list.append(item);
  }
}

async function render(): Promise<void> {
  const result = await chrome.runtime.sendMessage({ command: 'STATE' });
  cachedEvents = Array.isArray(result?.events) ? result.events as FlowEvent[] : [];
  cachedReviews = Array.isArray(result?.reviews) ? result.reviews as PatternReview[] : [];
  cachedSessionLabels = Array.isArray(result?.sessionLabels) ? result.sessionLabels as SessionLabel[] : [];
  renderTimeline(cachedEvents);
  const error = document.querySelector<HTMLElement>('#analysis-error')!;
  try {
    renderAnalysis(cachedEvents, cachedReviews, cachedSessionLabels);
    error.hidden = true;
  } catch {
    document.querySelector<HTMLElement>('#analysis')!.hidden = true;
    error.hidden = false;
  }
}

document.querySelector('#session-select')!.addEventListener('change', event => {
  selectedSessionId = (event.target as HTMLSelectElement).value;
  renderAnalysis(cachedEvents, cachedReviews, cachedSessionLabels);
});
document.querySelector('#refresh')!.addEventListener('click', () => window.location.reload());
document.querySelector('#clear')!.addEventListener('click', async () => {
  if (confirm('Delete all captured events?')) {
    await chrome.runtime.sendMessage({ command: 'CLEAR' });
    selectedSessionId = undefined;
    await render();
  }
});
void render();
