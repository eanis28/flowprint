# Flowprint

**Find the repetitive work hiding in your workflow.**

Flowprint is a privacy-conscious Chrome extension that helps people discover repeated browser workflows before deciding whether to automate, simplify, integrate, or intentionally leave them manual.

## Who it is for

Flowprint is designed for people who do everyday work across several websites and may not think of themselves as technical: coordinators, freelancers, students, operations staff, and small-business owners. It explains repeated browser routines in plain language, without requiring process-mapping or automation knowledge.

Answers actively shape future results on the device: confirmed workflows are prioritized, unrelated paths are hidden, and uncertain paths remain unconfirmed. No remote backend receives this feedback.

## Product case study

### The problem

Most automation tools begin with “What do you want to automate?” That assumes users already know where their repetitive work is. Flowprint starts earlier:

> Where is friction occurring, how often does it happen, and which workflow improvements deserve attention?

The product question for this portfolio project was whether minimal, privacy-safe interaction metadata could reconstruct useful workflow patterns without capturing the content of someone’s work.

### Scope

Flowprint observes browser workflows only. It does not monitor native applications, execute actions, scrape browser history, record screens, score employees, or provide an employer dashboard. There is no backend, account, cloud sync, LLM, or automation engine.

The release includes:

- Explicit start/stop observation, off by default
- Normalized-domain navigation and abstract action events
- Built-in and user-managed sensitive-domain exclusions
- Local retention and deletion controls
- Deterministic workflow-run and repeated-sequence analysis
- Explainable manual-transfer, switching, backtracking, and repetition signals
- Local “same task / different tasks / not sure” feedback
- Optional local session names
- Confirmed workflow library with rename and dismiss controls
- A completely fictional portfolio demo

### Privacy model

The content script emits only an event type and current URL. The background worker applies exclusions before normalizing and storing anything.

| Stored locally | Never stored |
| --- | --- |
| Timestamp | Typed or copied text |
| Random session/event ID | Page body or clicked text |
| Abstract event type | Form values or passwords |
| Normalized domain | Raw URL, query, or fragment |
| Allowlisted coarse page category | Screenshots or documents |
| Ephemeral tab ID | Authentication tokens |

Observation requires informed first-run onboarding and an explicit start. Incognito is unsupported. Authentication-like paths and common banking, password-manager, payment, and healthcare hosts are paused automatically. Users can exclude any additional domain and choose 7-day, 30-day, or manual retention.

### Event schema

```ts
type FlowEvent = {
  id: string;
  timestamp: number;
  sessionId: string;
  type:
    | 'SESSION_START' | 'SESSION_END' | 'PAGE_NAVIGATION'
    | 'TAB_SWITCH' | 'CLICK' | 'COPY_EVENT' | 'PASTE_EVENT'
    | 'PAGE_FOCUS' | 'PAGE_BLUR';
  domain?: string;
  pageCategory?: string;
  tabId?: number;
};
```

### Architecture

```text
Content script
  abstract event + current URL
          ↓
Manifest V3 service worker
  consent → exclusion → normalization → validation
          ↓
chrome.storage.local
          ↓
Deterministic on-device analyzer
          ↓
Workflow evidence + user review
```

The service worker owns consent, normalization, exclusions, retention, and storage. The analysis page derives summaries in memory; it does not add new captured fields.

### Detection approach

1. Explicit observation creates a session boundary.
2. Gaps longer than five minutes create separate likely workflow runs.
3. Adjacent same-domain activity collapses into one tool step.
4. Contiguous 2–4-step sequences are counted without overlap.
5. Shifted rotations of the same loop are consolidated.
6. Copy followed by paste in another tool within two minutes becomes a manual-transfer signal.
7. A–B–A transitions become neutral return/backtracking signals.

Review priority is not an opaque productivity score. It uses only three displayed factors: occurrence count, sequence length, and number of sessions containing the pattern. Repetition is presented as evidence to review, not proof that automation is appropriate.

### Validation

The implementation is covered by automated tests for consent boundaries, privacy normalization, sensitive exclusions, schema validation, deletion, retention, extension reloads, workflow segmentation, transfers, backtracking, repeated patterns, cyclic consolidation, opportunity priority, and synthetic demo safety.

Manual testing validated:

- Copy/paste actions are detected without copied content
- User-excluded domains produce no workflow events
- Authentication domains are paused
- Repeated four-step workflows are detected
- Raw events remain available when derived analysis fails
- Reloaded extensions do not continue emitting from invalidated contexts

## Reviewer walkthrough

1. Load `dist/` from `chrome://extensions` using **Developer mode → Load unpacked**.
2. Open Flowprint and complete the privacy onboarding.
3. Select **See example**. The fictional example shows a student adding four assignment deadlines from a course website to Calendar one at a time. Flowprint suggests checking for a calendar export—an option that could genuinely remove repeated entry. This replaces earlier demo sessions but preserves observed sessions.
4. Inspect the fictional course website → Calendar workflow.
5. Review the calendar-export shortcut and the evidence behind it.
6. Answer whether the websites were part of the **same task**, **different tasks**, or if you are **not sure**.
7. Expand the raw timeline to verify every derived claim.

For a live test, start observation, switch through a harmless tool sequence twice, stop observation, and open the analysis page. Refresh already-open webpages once after reloading an unpacked extension.

## Development

```bash
npm run build
npm run test
npm run typecheck
npm run lint
```

Run every check with:

```bash
npm run verify
```

The project also includes a `pnpm-lock.yaml` for reproducible pnpm installs.
