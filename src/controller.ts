import { makeEvent, isExcluded } from './privacy';
import { Store } from './store';
import type { IncomingEvent, Settings } from './types';
export class ObservationController {
  constructor(private store: Store, private now = () => Date.now()) {}
  async start(): Promise<Settings> { const current = await this.store.settings(); if (current.observing) return current; const next = { ...current, observing: true, sessionId: crypto.randomUUID() }; await this.store.setSettings(next); const event = makeEvent({ type: 'SESSION_START' }, next.sessionId, this.now()); if (event) await this.store.append(event); return next; }
  async stop(): Promise<Settings> { const current = await this.store.settings(); if (!current.observing || !current.sessionId) return current; const event = makeEvent({ type: 'SESSION_END' }, current.sessionId, this.now()); if (event) await this.store.append(event); const next = { ...current, observing: false, sessionId: null }; await this.store.setSettings(next); return next; }
  async capture(input: IncomingEvent): Promise<boolean> { const settings = await this.store.settings(); if (!settings.observing || !settings.sessionId) return false; if (input.url && isExcluded(input.url, settings.excludedDomains)) return false; const event = makeEvent(input, settings.sessionId, this.now()); if (!event) return false; await this.store.append(event); return true; }
}
