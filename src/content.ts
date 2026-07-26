import { sendEventSafely, type MessageRuntime } from './emitter';

type AllowedType = 'CLICK'|'COPY_EVENT'|'PASTE_EVENT'|'PAGE_FOCUS'|'PAGE_BLUR';
const emit = (type: AllowedType) => {
  sendEventSafely(
    () => typeof chrome === 'undefined' ? undefined : chrome.runtime as MessageRuntime | undefined,
    { type, url: location.href }
  );
};
document.addEventListener('click', () => emit('CLICK'), { capture: true, passive: true });
document.addEventListener('copy', () => emit('COPY_EVENT'), { capture: true, passive: true });
document.addEventListener('paste', () => emit('PASTE_EVENT'), { capture: true, passive: true });
if (window.top === window) document.addEventListener('visibilitychange', () => emit(document.hidden ? 'PAGE_BLUR' : 'PAGE_FOCUS'), { passive: true });
