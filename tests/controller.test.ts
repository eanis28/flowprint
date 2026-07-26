import { describe, expect, it, beforeEach, vi } from 'vitest';
import { ObservationController } from '../src/controller'; import { Store, type StorageArea } from '../src/store'; import { exclusionDomain, isExcluded, isValidEvent, makeEvent, normalizedDomain, pageCategory } from '../src/privacy';
class MemoryStorage implements StorageArea { data: Record<string, unknown> = {}; async get(key?: string|string[]|object|null) { if (typeof key === 'string') return { [key]: this.data[key] }; return { ...this.data }; } async set(items: object) { Object.assign(this.data, items); } async remove(keys: string|string[]) { for (const k of typeof keys === 'string' ? [keys] : keys) delete this.data[k]; } }
describe('Flowprint observation', () => { let area: MemoryStorage; let store: Store; let controller: ObservationController; beforeEach(() => { area = new MemoryStorage(); store = new Store(area); controller = new ObservationController(store, () => 1000); vi.stubGlobal('crypto', { randomUUID: vi.fn().mockReturnValueOnce('session-1').mockReturnValue('event-1') }); });
  it('defaults off and records nothing before explicit start', async () => { expect((await store.settings()).observing).toBe(false); expect(await controller.capture({ type:'CLICK', url:'https://example.com/private?q=secret' })).toBe(false); expect(await store.events()).toEqual([]); });
  it('creates clear session boundaries and ignores events after stop', async () => { await controller.start(); await controller.capture({ type:'CLICK', url:'https://example.com/a?q=secret#x' }); await controller.stop(); await controller.capture({ type:'COPY_EVENT', url:'https://example.com' }); expect((await store.events()).map(e=>e.type)).toEqual(['SESSION_START','CLICK','SESSION_END']); });
  it('does not persist query strings, paths, clipboard content, or typed text', async () => { await controller.start(); await controller.capture({ type:'COPY_EVENT', url:'https://www.example.com/payroll?salary=84000#secret', ...({ clipboard:'secret', text:'typed' } as object) }); const event=(await store.events())[1] as unknown as Record<string,unknown>; expect(event.domain).toBe('example.com'); expect(event).not.toHaveProperty('url'); expect(event).not.toHaveProperty('clipboard'); expect(event).not.toHaveProperty('text'); });
  it('excludes sensitive, authentication, and user-defined domains including subdomains', async () => { await controller.start(); area.data.settings={...(await store.settings()),excludedDomains:['private.example']}; expect(await controller.capture({type:'CLICK',url:'https://vault.private.example/x'})).toBe(false); expect(isExcluded('https://secure.chase.com/home',[])).toBe(true); expect(isExcluded('https://login.microsoftonline.com/common/oauth2',[])).toBe(true); expect(isExcluded('https://example.okta.com/app',[])).toBe(true); expect(isExcluded('https://example.com/oauth/authorize',[])).toBe(true); });
  it('deletes all events and learned answers without changing settings', async () => { await controller.start(); await store.setReview({ signature:'mail→calendar', status:'same_task', updatedAt:1 }); await store.clear(); expect(await store.events()).toEqual([]); expect(await store.reviews()).toEqual([]); expect((await store.settings()).observing).toBe(true); }); });
describe('local retention and review controls', () => {
  it('defaults to a 30-day local retention period', async () => {
    const store = new Store(new MemoryStorage());
    expect((await store.settings()).retentionDays).toBe(30);
    expect((await store.settings()).hasSeenOnboarding).toBe(false);
  });

  it('prunes whole expired sessions without cutting a recent session', async () => {
    const area = new MemoryStorage();
    const store = new Store(area);
    area.data.events = [
      { id:'1', timestamp:1, sessionId:'old', type:'SESSION_START' },
      { id:'2', timestamp:2, sessionId:'old', type:'SESSION_END' },
      { id:'3', timestamp:99, sessionId:'new', type:'SESSION_START' },
      { id:'4', timestamp:100, sessionId:'new', type:'CLICK', domain:'example.com' }
    ];
    const removed = await store.prune(7, 7 * 86_400_000 + 100);
    expect(removed).toBe(2);
    expect((await store.events()).map(event => event.sessionId)).toEqual(['new', 'new']);
  });

  it('keeps all sessions when retention is user-controlled', async () => {
    const area = new MemoryStorage();
    const store = new Store(area);
    area.data.events = [{ id:'1', timestamp:1, sessionId:'old', type:'SESSION_START' }];
    expect(await store.prune(null, Date.now())).toBe(0);
    expect(await store.events()).toHaveLength(1);
  });

  it('stores one current review per pattern signature', async () => {
    const store = new Store(new MemoryStorage());
    await store.setReview({ signature:'mail→sheets', status:'same_task', updatedAt:1 });
    await store.setReview({ signature:'mail→sheets', status:'different_tasks', updatedAt:2 });
    expect(await store.reviews()).toEqual([{ signature:'mail→sheets', status:'different_tasks', updatedAt:2 }]);
  });

  it('stores optional session names and workflow names locally', async () => {
    const store = new Store(new MemoryStorage());
    await store.setSessionLabel({ sessionId:'session-1', label:'Planning next week', createdAt:1 });
    await store.setReview({ signature:'mail→calendar', status:'same_task', updatedAt:1 });
    await store.renameReview('mail→calendar', 'Weekly planning');
    expect(await store.sessionLabels()).toEqual([{ sessionId:'session-1', label:'Planning next week', createdAt:1 }]);
    expect((await store.reviews())[0].name).toBe('Weekly planning');
  });

  it('replaces older fictional demo sessions without changing observed sessions', async () => {
    const area = new MemoryStorage();
    const store = new Store(area);
    area.data.events = [
      { id:'1', timestamp:1, sessionId:'observed', type:'SESSION_START' },
      { id:'2', timestamp:2, sessionId:'demo-old', type:'SESSION_START' }
    ];
    await store.replaceDemo([{ id:'3', timestamp:3, sessionId:'demo-new', type:'SESSION_START' }]);
    expect((await store.events()).map(event => event.sessionId)).toEqual(['observed', 'demo-new']);
  });
});
describe('schema and normalization', () => { it('accepts bare domains and full URLs for exclusions', () => { expect(exclusionDomain('reddit.com')).toBe('reddit.com'); expect(exclusionDomain('https://www.reddit.com/r/privacy?x=1')).toBe('reddit.com'); expect(exclusionDomain('')).toBeNull(); }); it('keeps only normalized host and allowlisted category', () => { expect(normalizedDomain('https://www.Example.com/a?token=x')).toBe('example.com'); expect(pageCategory('https://docs.google.com/spreadsheets/d/secret')).toBe('sheets'); expect(pageCategory('https://example.com/customer/42')).toBeUndefined(); }); it('validates the persisted event schema', () => { vi.stubGlobal('crypto',{randomUUID:()=> 'id'}); expect(isValidEvent(makeEvent({type:'TAB_SWITCH',url:'https://example.com'},'s',1))).toBe(true); expect(isValidEvent({id:'x',timestamp:1,sessionId:'s',type:'CLICK',domain:'example.com/path'})).toBe(false); }); });
