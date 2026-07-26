import type { IncomingEvent } from './types';

export interface MessageRuntime {
  id?: string;
  sendMessage(message: { event: IncomingEvent }): Promise<unknown> | undefined;
}

export function sendEventSafely(getRuntime: () => MessageRuntime | undefined, event: IncomingEvent): void {
  try {
    const runtime = getRuntime();
    // `runtime.id` becomes undefined immediately when Chrome invalidates an
    // already-injected content script after an unpacked extension reload.
    if (!runtime?.id || typeof runtime.sendMessage !== 'function') return;
    const response = runtime.sendMessage({ event });
    if (response && typeof response.catch === 'function') void response.catch(() => undefined);
  } catch {
    // Chrome invalidates content-script contexts when an unpacked extension reloads.
    // Existing tabs should quietly stop emitting until they are refreshed.
  }
}
