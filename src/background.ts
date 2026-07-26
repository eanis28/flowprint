import { ObservationController } from './controller';
import { exclusionDomain } from './privacy';
import { fictionalDemoEvents } from './demo';
import { Store } from './store';
import type { IncomingEvent } from './types';
const store = new Store(chrome.storage.local); const controller = new ObservationController(store);
chrome.runtime.onInstalled.addListener(async () => { const settings = await store.settings(); await store.setSettings({ ...settings, observing: false, sessionId: null }); await chrome.action.setBadgeText({ text: '' }); });
async function badge(on: boolean) { await chrome.action.setBadgeBackgroundColor({ color: '#2F6B5F' }); await chrome.action.setBadgeText({ text: on ? 'ON' : '' }); await chrome.action.setTitle({ title: `Flowprint — Observation ${on ? 'on' : 'off'}` }); }
chrome.runtime.onMessage.addListener((message: { command?: string; event?: IncomingEvent }, _sender, sendResponse) => { (async () => {
  if (message.command === 'START') { const settings = await store.settings(); await store.prune(settings.retentionDays); const next = await controller.start(); const label = String((message as { label?: string }).label ?? '').trim().slice(0,80); if (label && next.sessionId) await store.setSessionLabel({ sessionId:next.sessionId,label,createdAt:Date.now() }); sendResponse(next); await badge(true); }
  else if (message.command === 'STOP') { sendResponse(await controller.stop()); await badge(false); }
  else if (message.command === 'STATE') { const settings = await store.settings(); await store.prune(settings.retentionDays); sendResponse({ settings, events: await store.events(), reviews: await store.reviews(), sessionLabels: await store.sessionLabels() }); }
  else if (message.command === 'EXCLUDE') { const settings = await store.settings(); const domain = exclusionDomain(String((message as { domain?: string }).domain ?? '')); if (!domain) sendResponse({ error: 'Enter a valid domain or URL' }); else { const excludedDomains = [...new Set([...settings.excludedDomains, domain])]; await store.setSettings({ ...settings, excludedDomains }); sendResponse({ excludedDomains, domain }); } }
  else if (message.command === 'REMOVE_EXCLUSION') { const settings = await store.settings(); const domain = String((message as { domain?: string }).domain ?? ''); const excludedDomains = settings.excludedDomains.filter(item => item !== domain); await store.setSettings({ ...settings, excludedDomains }); sendResponse({ excludedDomains }); }
  else if (message.command === 'RETENTION') { const settings = await store.settings(); const requested = (message as { days?: unknown }).days; const retentionDays = requested === null ? null : requested === 7 ? 7 : 30; await store.setSettings({ ...settings, retentionDays }); await store.prune(retentionDays); sendResponse({ retentionDays }); }
  else if (message.command === 'ONBOARD') { const settings = await store.settings(); await store.setSettings({ ...settings, hasSeenOnboarding: true }); sendResponse({ ok: true }); }
  else if (message.command === 'REVIEW') { const signature = String((message as { signature?: string }).signature ?? ''); const status = (message as { status?: string }).status; if (!signature || !['same_task','different_tasks','unsure'].includes(String(status))) sendResponse({ error: 'Invalid review' }); else { await store.setReview({ signature, status: status as 'same_task' | 'different_tasks' | 'unsure', updatedAt: Date.now() }); sendResponse({ ok: true }); } }
  else if (message.command === 'RENAME_WORKFLOW') { const signature = String((message as { signature?: string }).signature ?? ''); const name = String((message as { name?: string }).name ?? '').trim(); if (!signature || !name) sendResponse({ error:'Enter a workflow name' }); else { await store.renameReview(signature,name); sendResponse({ ok:true }); } }
  else if (message.command === 'LOAD_DEMO') { const sessionId = `demo-${crypto.randomUUID()}`; const events = fictionalDemoEvents(sessionId); await store.replaceDemo(events); await store.setSessionLabel({ sessionId,label:'Adding assignment deadlines',createdAt:Date.now() }); sendResponse({ added: events.length, sessionId }); }
  else if (message.command === 'CLEAR') { await store.clear(); sendResponse({ ok: true }); }
  else if (message.event) sendResponse({ captured: await controller.capture(message.event) });
})().catch(() => sendResponse({ error: 'Request failed' })); return true; });
chrome.webNavigation.onCommitted.addListener(details => { if (details.frameId === 0) void controller.capture({ type: 'PAGE_NAVIGATION', url: details.url, tabId: details.tabId }); });
chrome.tabs.onActivated.addListener(async ({ tabId }) => { try { const tab = await chrome.tabs.get(tabId); if (tab.url) await controller.capture({ type: 'TAB_SWITCH', url: tab.url, tabId }); } catch { /* tab disappeared */ } });
chrome.runtime.onStartup.addListener(async () => { const s = await store.settings(); if (s.observing) await controller.stop(); await badge(false); });
