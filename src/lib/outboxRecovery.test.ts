import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';
import { createOutboxItem, isOutboxItemDue, requeueInterruptedOutboxSends, type OutboxItem } from './outbox';

// Exercise the page's actual effect without mounting its unrelated chat UI.
const page = ts.createSourceFile('page.tsx', readFileSync(new URL('../app/hi-its-me/page.tsx', import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let effectSource = '';
function findRecoveryEffect(node: ts.Node) {
  if (ts.isCallExpression(node) && node.expression.getText(page) === 'useEffect') {
    const callback = node.arguments[0];
    if (callback?.getText(page).includes('const loaded = loadOutbox(userId)')) {
      effectSource = callback.getText(page);
    }
  }
  ts.forEachChild(node, findRecoveryEffect);
}
findRecoveryEffect(page);
if (!effectSource) throw new Error('Outbox recovery effect not found');
const effectJs = ts.transpile(`const effect = ${effectSource};`, { target: ts.ScriptTarget.ES2022 });
const runEffect = new Function('userId', 'loadOutbox', 'setOutboxItems', 'requeueInterruptedOutboxSends', 'supportsRoomMessageDeduplication', 'window', `${effectJs}\nreturn effect();`);

const room = (id: string) => createOutboxItem({ type: 'room', targetId: 'room-1', content: 'hello', clientMessageId: id, status: 'sending' });
function setup(loaded: OutboxItem[], probe = vi.fn<() => Promise<boolean>>()) {
  const window = new EventTarget();
  let items: OutboxItem[] = [];
  const setItems = (update: OutboxItem[] | ((previous: OutboxItem[]) => OutboxItem[])) => {
    items = typeof update === 'function' ? update(items) : update;
  };
  const cleanup = runEffect('user-1', () => loaded, setItems, requeueInterruptedOutboxSends, probe, window) as () => void;
  return { probe, cleanup, setItems, items: () => items, online: () => window.dispatchEvent(new Event('online')) };
}

// A microtask turn lets the probe's promise callback finish.
const settle = () => Promise.resolve();

describe('outbox room recovery effect', () => {
  it('retries after reconnect and only requeues interrupted room sends from this load', async () => {
    const interrupted = room('interrupted');
    const completed = room('completed');
    const failed = room('failed');
    const probe = vi.fn<() => Promise<boolean>>().mockResolvedValueOnce(false).mockResolvedValue(true);
    const state = setup([interrupted, completed, failed], probe);
    await settle();
    expect(state.items()[0]).toBe(interrupted);

    const fresh = room('fresh');
    const failedNow = { ...failed, status: 'failed' as const, nextAttemptAt: '2099-01-01T00:00:00Z' };
    state.setItems([interrupted, failedNow, fresh]);
    state.online();
    await settle();
    expect(probe).toHaveBeenCalledTimes(2);
    expect(state.items().map((item) => [item.id, item.status])).toEqual([
      ['interrupted', 'queued'], ['failed', 'failed'], ['fresh', 'sending'],
    ]);
    expect(isOutboxItemDue(state.items()[0])).toBe(true);
    expect(state.items()[1]).toBe(failedNow);
    expect(state.items()[2]).toBe(fresh);
    state.online();
    expect(probe).toHaveBeenCalledTimes(2);
    state.cleanup();
  });

  it('leaves unsupported room sends untouched on repeated reconnects', async () => {
    const interrupted = room('interrupted');
    const state = setup([interrupted], vi.fn<() => Promise<boolean>>().mockResolvedValue(false));
    await settle();
    state.online();
    await settle();
    expect(state.items()[0]).toBe(interrupted);
    state.cleanup();
    state.online();
    expect(state.probe).toHaveBeenCalledTimes(2);
  });

  it('ignores a pending result after cleanup and removes the reconnect listener', async () => {
    let resolve!: (supported: boolean) => void;
    const interrupted = room('interrupted');
    const state = setup([interrupted], vi.fn(() => new Promise<boolean>((done) => { resolve = done; })));
    state.cleanup();
    resolve(true);
    await settle();
    state.online();
    expect(state.items()[0]).toBe(interrupted);
    expect(state.probe).toHaveBeenCalledTimes(1);
  });

  it('recovers once even when reconnect overlaps a pending probe', async () => {
    const pending: Array<(supported: boolean) => void> = [];
    const state = setup([room('interrupted')], vi.fn(() => new Promise<boolean>((done) => pending.push(done))));
    state.online();
    pending[1](true);
    await settle();
    expect(state.items()[0].status).toBe('queued');
    const sendingAgain = { ...state.items()[0], status: 'sending' as const };
    state.setItems([sendingAgain]);
    pending[0](true);
    await settle();
    expect(state.items()[0]).toBe(sendingAgain);
    state.cleanup();
  });

  it('does not probe when there are no interrupted room sends', () => {
    const dm = { ...room('dm'), type: 'dm' as const };
    const state = setup([dm, { ...room('queued'), status: 'queued' as const }]);
    state.online();
    expect(state.probe).not.toHaveBeenCalled();
    expect(state.items()[0].status).toBe('queued');
    state.cleanup();
  });
});
