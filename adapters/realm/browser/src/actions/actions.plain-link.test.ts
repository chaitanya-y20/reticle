/**
 * The reported case, driven the way an agent drives it.
 *
 * From the issue: `Orders & invoices` is an `<a href>`, and clicking it was refused with
 * `potentially destructive action blocked` for a money word in its href. The pattern's `payment`
 * matches the singular `/billing/payment` rather than the plural the issue quotes, so that is what
 * the fixture uses — the defect is the same either way: the guard read an ADDRESS as a label.
 *
 * The negative controls below are the point of the narrowing. A guard that fires on navigation
 * teaches an agent to pass `confirmDangerous: true` reflexively, so the block has to be exactly as
 * wide as the acts it protects: a button labelled Delete, and a link the page wired up itself.
 */
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { dispatchWebMcp, executeAction } from './actions.js';
import { refs } from '@/dom/addressing/refs.js';

const refTo = (selector: string): string => {
  const el = document.querySelector(selector);
  if (!(el instanceof HTMLElement)) throw new Error(`no element for ${selector}`);
  return refs.refFor(el);
};

describe('a plain navigation link is clicked without confirming', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('does not block a same-origin link whose href carries the money word', async () => {
    document.body.innerHTML = '<a id="orders" href="/billing/payment">Orders &amp; invoices</a>';
    await expect(executeAction(refTo('#orders'), 'click')).resolves.toBeDefined();
  });

  it('does not block a footer link whose TEXT carries the word', async () => {
    document.body.innerHTML = '<a id="refunds" href="/help/refunds">Refund policy</a>';
    await expect(executeAction(refTo('#refunds'), 'click')).resolves.toBeDefined();
  });

  it('still blocks a button labelled Delete', async () => {
    document.body.innerHTML = '<button id="del">Delete account</button>';
    await expect(executeAction(refTo('#del'), 'click')).rejects.toThrow(/confirmDangerous/);
  });

  it('still blocks a link the page wired up with an inline handler', async () => {
    document.body.innerHTML =
      '<a id="pay" href="/purchase/confirm" onclick="void 0">Purchase now</a>';
    await expect(executeAction(refTo('#pay'), 'click')).rejects.toThrow(/confirmDangerous/);
  });

  it('still blocks a submit control inside a money-moving form', async () => {
    document.body.innerHTML =
      '<form action="/api/refund"><button type="submit" id="go">Issue refund</button></form>';
    await expect(executeAction(refTo('#go'), 'click')).rejects.toThrow(/confirmDangerous/);
  });
});

/**
 * A tool NAME is not an element, and the guard has to keep accepting one.
 *
 * `dispatchWebMcp` classified `navigator.modelContext` tool names through the same entry point, and
 * the element-aware form reached for `el.closest` on a string. The exemption is for a link the
 * browser can inspect; a name has nothing to inspect, so the text decides there as it always did.
 */
describe('a WebMCP tool name is still classified by its text alone', () => {
  it('blocks a destructive tool name and lets a named one through once confirmed', async () => {
    const callTool = vi.fn(() => Promise.resolve({ ok: true }));
    (navigator as unknown as Record<string, unknown>)['modelContext'] = { callTool };
    await expect(dispatchWebMcp('delete_account', {})).rejects.toThrow(/confirmDangerous/);
    await expect(dispatchWebMcp('delete_account', {}, true)).resolves.toEqual({ ok: true });
  });

  it('does not block a harmless tool name', async () => {
    const callTool = vi.fn(() => Promise.resolve({ ok: true }));
    (navigator as unknown as Record<string, unknown>)['modelContext'] = { callTool };
    await expect(dispatchWebMcp('search', { q: 'x' })).resolves.toEqual({ ok: true });
  });
});
