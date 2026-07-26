<p align="center">
  <img src="icons/icon-128.png" width="88" alt="Flowprint logo">
</p>

<h1 align="center">Flowprint</h1>

<p align="center"><strong>Find the repetitive work hiding in your workflow.</strong></p>

Flowprint is a privacy-conscious Chrome extension that identifies repeated browser routines before the user decides whether to simplify, automate, or keep them manual.

## Why I built it

Most automation tools ask users what they want to automate. That assumes they already know where the friction is. Flowprint starts one step earlier by observing browser activity and explaining recurring paths in plain language.

It is designed for people who work across several websites but do not necessarily think in terms of process maps or automation.

## What it does

- Observes browser activity only when the user starts a session
- Finds repeated paths between websites
- Explains patterns in plain language
- Saves confirmed workflows in a personal library
- Learns locally from user feedback
- Includes a fictional demo for quick evaluation

When a user reviews a detected path:

- **Same task** confirms and prioritizes the workflow
- **Different tasks** dismisses it from future suggestions
- **Not sure** keeps it unconfirmed

All learning happens locally.

## Privacy

Flowprint saves website names, action types, and timing locally in Chrome. It never saves typed or copied words, page content, form values, full URLs, passwords, or screenshots.

There is no account, cloud sync, analytics service, or remote backend. Sensitive websites are excluded automatically, and users can exclude additional websites or delete their data at any time.

## How it works

```text
Browser activity → privacy checks → local storage → pattern analysis → user review
```

The analysis intentionally treats repetition as evidence to review, not proof that a workflow should be automated.

## Try it locally

Requirements: Node.js 20.19+ or 22.12+.

```bash
pnpm install
pnpm build
```

Then:

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Select **Load unpacked**.
4. Choose the generated `dist` folder.
5. Open Flowprint and select **See example** for the fictional walkthrough.

## Quality

The project includes 40 automated tests covering privacy, storage, workflow detection, local learning, and demo safety.

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

Run the complete check with:

```bash
pnpm verify
```

## Built with

TypeScript, Chrome Extension Manifest V3, Vite, Vitest, ESLint, and `chrome.storage.local`.

## Scope

Flowprint analyzes browser workflows. It does not monitor desktop applications, inspect work content, or automate actions.
