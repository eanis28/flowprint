import { describe, expect, it, vi } from 'vitest';
import { sendEventSafely, type MessageRuntime } from '../src/emitter';

describe('content-script event emission', () => {
  it('quietly ignores a missing extension runtime after reload', () => {
    expect(() => sendEventSafely(() => undefined, { type: 'CLICK', url: 'https://example.com' })).not.toThrow();
  });

  it('catches failure while retrieving an invalidated runtime', () => {
    expect(() => sendEventSafely(() => {
      throw new TypeError("Cannot read properties of undefined (reading 'sendMessage')");
    }, { type: 'CLICK', url: 'https://example.com' })).not.toThrow();
  });

  it('catches a synchronously invalidated extension context', () => {
    const runtime = {
      id: 'flowprint',
      sendMessage: vi.fn(() => {
        throw new Error('Extension context invalidated.');
      })
    } as unknown as MessageRuntime;
    expect(() => sendEventSafely(() => runtime, { type: 'CLICK', url: 'https://example.com' })).not.toThrow();
  });

  it('handles an asynchronously rejected message without an unhandled error', async () => {
    const runtime: MessageRuntime = { id: 'flowprint', sendMessage: vi.fn().mockRejectedValue(new Error('Receiving end does not exist')) };
    sendEventSafely(() => runtime, { type: 'CLICK', url: 'https://example.com' });
    await Promise.resolve();
    expect(runtime.sendMessage).toHaveBeenCalledOnce();
  });

  it('accepts a runtime that returns no promise', () => {
    const runtime: MessageRuntime = { id: 'flowprint', sendMessage: vi.fn(() => undefined) };
    expect(() => sendEventSafely(() => runtime, { type: 'CLICK', url: 'https://example.com' })).not.toThrow();
  });

  it('does not call sendMessage after Chrome removes the runtime ID', () => {
    const runtime: MessageRuntime = { sendMessage: vi.fn() };
    sendEventSafely(() => runtime, { type: 'CLICK', url: 'https://example.com' });
    expect(runtime.sendMessage).not.toHaveBeenCalled();
  });
});
