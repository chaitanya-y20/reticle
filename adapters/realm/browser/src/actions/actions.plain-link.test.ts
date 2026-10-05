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
 *
 * The handler reading is three-valued, and only a definite `false` exempts. A page with no adapter
 * leaves every element unreadable, so the positive cases install a probe that reads the element,
 * exactly as a registered framework adapter does in an app, and the controls below cover the
 * unreadable case the guard has to refuse.
 */
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { executeAction } from './actions.js';
import { refs } from '@/dom/addressing/refs.js';
import { registerAdapter, type ReticleAdapter } from '@/registry/stores/adapters.js';

const refTo = (selector: string): string => {
  const el = document.querySelector(selector);
  if (!(el instanceof HTMLElement)) throw new Error(`no element for ${selector}`);
  return refs.refFor(el);
};

const adapters = ((
  globalThis as unknown as { __reticleAdapters?: ReticleAdapter[] }
).__reticleAdapters ??= []);

/**
 * A probe that READS the element and reports no handler, which is what a registered framework
 * adapter answers for an element it can inspect but that declares no `onClick`. Without it the
 * reading is `undefined` — "nothing could look" — which the guard refuses, so a positive case has
 * to model a page where a handlerless reading is actually obtainable.
 */
const handlerlessProbe = (): ReticleAdapter => ({
  name: 'plain-link-probe',
  identify: () => null,
  hasClickHandler: () => false,
});

describe('a plain navigation link is clicked without confirming', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });
  afterEach(() => {
    adapters.length = 0;
  });

  it('does not block a same-origin link whose href carries the money word', async () => {
    registerAdapter(handlerlessProbe());
    document.body.innerHTML = '<a id="orders" href="/billing/payment">Orders &amp; invoices</a>';
    await expect(executeAction(refTo('#orders'), 'click')).resolves.toBeDefined();
  });

  it('does not block a footer link whose TEXT carries the word', async () => {
    registerAdapter(handlerlessProbe());
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

  it('still blocks a link whose href is executable rather than navigation', async () => {
    document.body.innerHTML = '<a id="js" href="javascript:void 0">Delete account</a>';
    await expect(executeAction(refTo('#js'), 'click')).rejects.toThrow(/confirmDangerous/);
  });

  /**
   * A plain link whose TEXT also matches is still exempted — that is the issue's own wording
   * ("whose href or text contains 'payment'"), and the act is still only a GET.
   */
  it('does not block a plain link whose text reads destructively', async () => {
    registerAdapter(handlerlessProbe());
    document.body.innerHTML = '<a id="t" href="/help/delete-account">Delete account</a>';
    await expect(executeAction(refTo('#t'), 'click')).resolves.toBeDefined();
  });

  it('still blocks a role=link on a div, which is not an anchor', async () => {
    document.body.innerHTML = '<div id="fake" role="link" tabindex="0">Delete account</div>';
    await expect(executeAction(refTo('#fake'), 'click')).rejects.toThrow(/confirmDangerous/);
  });

  /**
   * A drag END is not navigation. A drop target is exactly what a link looks like, so the end of a
   * drag keeps the text-only answer — dropping a row onto a plainly-styled "Pay" is still a payment.
   */
  it('still blocks a DRAG onto a plain-looking link', async () => {
    document.body.innerHTML =
      '<div id="row" draggable="true">Row</div>' +
      '<a id="drop" href="/billing/payment">Pay now</a>';
    await expect(executeAction(refTo('#row'), 'drag', { toRef: refTo('#drop') })).rejects.toThrow(
      /confirmDangerous/,
    );
  });

  it('still blocks a submit control inside a money-moving form', async () => {
    document.body.innerHTML =
      '<form action="/api/refund"><button type="submit" id="go">Issue refund</button></form>';
    await expect(executeAction(refTo('#go'), 'click')).rejects.toThrow(/confirmDangerous/);
  });

  /**
   * The negative control for the three-state handler reading.
   *
   * `elementHandlesClick` answers `undefined` when no adapter can inspect the element, which is
   * what a link wired up with a plain `addEventListener` looks like: nothing in the DOM records
   * that handler, so an unread element and a handlerless one are indistinguishable from outside.
   * Collapsing the unread case to `false` let exactly this link take the exemption, so the case is
   * pinned here — and no probe is installed, which is the page shape that produces the unknown
   * reading in the first place.
   */
  it('still blocks a link with a handler installed via addEventListener', async () => {
    document.body.innerHTML = '<a id="wired" href="/account/delete">Delete account</a>';
    const wired = document.querySelector('#wired');
    if (!(wired instanceof HTMLAnchorElement)) throw new Error('fixture element missing');

    // A real handler the DOM will not report through any attribute.
    wired.addEventListener('click', (event) => event.preventDefault());

    await expect(executeAction(refTo('#wired'), 'click')).rejects.toThrow(/confirmDangerous/);
  });

  /**
   * A framework that rewrites the click into a non-GET request.
   *
   * Rails' `link_to method: :delete`, Turbo and UJS all render an href that reads as a GET, with no
   * handler any attribute check can find, and intercept the click in script to issue a DELETE. The
   * probe below answers "handlerless" exactly as it does for a genuinely plain link, so the marker
   * is the only thing standing between this anchor and the exemption.
   */
  it('blocks a link marked data-method="delete" even when a probe reads it handlerless', async () => {
    registerAdapter(handlerlessProbe());
    document.body.innerHTML =
      '<a id="rails" href="/account" data-method="delete">Delete account</a>';
    await expect(executeAction(refTo('#rails'), 'click')).rejects.toThrow(/confirmDangerous/);
  });

  it('blocks a link marked data-turbo-method="delete"', async () => {
    registerAdapter(handlerlessProbe());
    document.body.innerHTML =
      '<a id="turbo" href="/account" data-turbo-method="delete">Delete account</a>';
    await expect(executeAction(refTo('#turbo'), 'click')).rejects.toThrow(/confirmDangerous/);
  });

  it('blocks a link marked hx-delete', async () => {
    registerAdapter(handlerlessProbe());
    document.body.innerHTML =
      '<a id="htmx" href="/account" hx-delete="/account">Delete account</a>';
    await expect(executeAction(refTo('#htmx'), 'click')).rejects.toThrow(/confirmDangerous/);
  });

  it('still exempts a plain link that carries no marker', async () => {
    registerAdapter(handlerlessProbe());
    document.body.innerHTML = '<a id="plain" href="/billing/payment">Orders &amp; invoices</a>';
    await expect(executeAction(refTo('#plain'), 'click')).resolves.toBeDefined();
  });
});
