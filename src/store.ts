import { DEFAULT_SETTINGS, type FlowEvent, type PatternReview, type RetentionDays, type SessionLabel, type Settings } from './types';
export interface StorageArea { get(keys?: string | string[] | object | null): Promise<Record<string, unknown>>; set(items: object): Promise<void>; remove(keys: string | string[]): Promise<void>; }
export class Store {
  constructor(private area: StorageArea) {}
  async settings(): Promise<Settings> { const result = await this.area.get('settings'); return { ...DEFAULT_SETTINGS, ...(result.settings as Partial<Settings> | undefined) }; }
  async setSettings(settings: Settings) { await this.area.set({ settings }); }
  async events(): Promise<FlowEvent[]> { return ((await this.area.get('events')).events as FlowEvent[] | undefined) ?? []; }
  async append(event: FlowEvent) { const events = await this.events(); await this.area.set({ events: [...events, event] }); }
  async appendMany(newEvents: FlowEvent[]) { const events = await this.events(); await this.area.set({ events: [...events, ...newEvents] }); }
  async replaceDemo(newEvents: FlowEvent[]) {
    const events = (await this.events()).filter(event => !event.sessionId.startsWith('demo-'));
    await this.area.set({ events: [...events, ...newEvents] });
    const sessionLabels = (await this.sessionLabels()).filter(label => !label.sessionId.startsWith('demo-'));
    await this.area.set({ sessionLabels });
  }
  async clear() { await this.area.remove(['events', 'reviews', 'sessionLabels']); }
  async reviews(): Promise<PatternReview[]> { return ((await this.area.get('reviews')).reviews as PatternReview[] | undefined) ?? []; }
  async setReview(review: PatternReview) {
    const current = (await this.reviews()).find(item => item.signature === review.signature);
    const reviews = (await this.reviews()).filter(item => item.signature !== review.signature);
    await this.area.set({ reviews: [...reviews, { ...current, ...review }] });
  }
  async renameReview(signature: string, name: string) {
    const review = (await this.reviews()).find(item => item.signature === signature);
    if (review) await this.setReview({ ...review, name: name.trim().slice(0, 80), updatedAt: Date.now() });
  }
  async sessionLabels(): Promise<SessionLabel[]> { return ((await this.area.get('sessionLabels')).sessionLabels as SessionLabel[] | undefined) ?? []; }
  async setSessionLabel(label: SessionLabel) {
    const labels = (await this.sessionLabels()).filter(item => item.sessionId !== label.sessionId);
    await this.area.set({ sessionLabels: [...labels, label] });
  }
  async prune(retentionDays: RetentionDays, now = Date.now()): Promise<number> {
    if (retentionDays === null) return 0;
    const events = await this.events();
    const cutoff = now - retentionDays * 86_400_000;
    const latestBySession = new Map<string, number>();
    for (const event of events) latestBySession.set(event.sessionId, Math.max(latestBySession.get(event.sessionId) ?? 0, event.timestamp));
    const kept = events.filter(event => (latestBySession.get(event.sessionId) ?? 0) >= cutoff);
    if (kept.length !== events.length) {
      const keptSessionIds = new Set(kept.map(event => event.sessionId));
      const sessionLabels = (await this.sessionLabels()).filter(label => keptSessionIds.has(label.sessionId));
      await this.area.set({ events: kept, sessionLabels });
    }
    return events.length - kept.length;
  }
}
