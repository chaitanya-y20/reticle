/**
 * A plain navigation link is not a destructive control, however its URL is spelled.
 *
 * The destructive-label pattern reads a control's `href` along with its text, which is right for a
 * button whose label is an icon — its `formAction` is the only place it says what it does. On an
 * anchor the href is an ADDRESS, and addresses carry the pattern's words: `Orders & invoices`
 * pointing at `/billing/payment` was refused for the `payment` in the URL.
 *
 * A same-origin `<a href>` with no click handler, form or method changes nothing by itself; it is a
 * GET navigation. Refusing it costs a turn, and the way past is `confirmDangerous: true`, passed
 * reflexively — which is how a guard becomes decoration. The two controls that CAN act through a
 * link keep their block: one with an inline handler, and one inside a form.
 *
 * The link exemption is `classifyActionText`, told about the element by its caller. It is not
 * `isDangerousActionText` with a role: a `role` is a free string any page can write, so a role-only
 * exemption would let `<div role="link">Delete account</div>` through.
 */
import { describe, expect, it } from 'vitest';
import { classifyActionText, isDangerousActionText, isPlainNavigationLink } from './security.js';

describe('a plain navigation link is not destructive', () => {
  it('does not block a link whose text and href carry a money word', () => {
    expect(
      classifyActionText('Orders & invoices /billing/payment', 'link', {
        href: '/billing/payment',
      }),
    ).toBe(false);
    expect(classifyActionText('Purchase history', 'link', { href: '/purchase/history' })).toBe(
      false,
    );
  });

  it('still blocks a link with an inline handler, which can do anything', () => {
    expect(
      classifyActionText('Orders & invoices /billing/payment', 'link', {
        href: '/billing/payment',
        inlineHandler: true,
      }),
    ).toBe(true);
  });

  it('still blocks a link inside a form, whose href is not its whole effect', () => {
    expect(
      classifyActionText('Purchase history', 'link', {
        href: '/purchase/history',
        insideForm: true,
      }),
    ).toBe(true);
  });

  it('still blocks a role=link on an element that is not an anchor', () => {
    // No href attribute at all: the role is a claim, and nothing in the element supports it.
    expect(classifyActionText('Delete account /purchase/now', 'link', {})).toBe(true);
  });

  it('does not exempt an anchor that navigates nowhere', () => {
    // An `<a>` without the attribute is role `generic` and moves nowhere, so its label decides.
    expect(classifyActionText('Delete account', 'generic', { href: '' })).toBe(true);
    expect(isPlainNavigationLink('generic', { href: '' })).toBe(false);
  });

  it('still blocks a BUTTON whose label is money-moving', () => {
    // The button case the href was added for: it has no href, and its label alone decides.
    expect(classifyActionText('Pay /api/charge', 'button', {})).toBe(true);
  });

  it('leaves the text-only classifier exactly as it was', () => {
    // The descriptor paths call this one; they have no element to answer the link question from.
    expect(isDangerousActionText('Delete account')).toBe(true);
    expect(isDangerousActionText('Orders & invoices /billing/payment', 'link')).toBe(true);
  });
});

describe('isPlainNavigationLink', () => {
  it('accepts an anchor with an href and nothing wired to it', () => {
    expect(isPlainNavigationLink('link', { href: '/refund-policy' })).toBe(true);
    expect(isPlainNavigationLink('generic', { href: '/refund-policy' })).toBe(true);
    expect(isPlainNavigationLink('LINK', { href: '/refund-policy' })).toBe(true);
  });

  it('refuses href="#" — the inert-pairing idiom, not evidence of a plain navigation', () => {
    expect(isPlainNavigationLink('link', { href: '#' })).toBe(false);
  });

  it('refuses every other role', () => {
    for (const role of ['button', 'menuitem', 'checkbox', 'option', 'radio', undefined]) {
      expect(isPlainNavigationLink(role, { href: '/billing/payment' })).toBe(false);
    }
  });

  it('refuses an anchor with a handler or a form around it', () => {
    expect(isPlainNavigationLink('link', { href: '/pay', inlineHandler: true })).toBe(false);
    expect(isPlainNavigationLink('link', { href: '/pay', insideForm: true })).toBe(false);
    expect(isPlainNavigationLink('link', {})).toBe(false);
  });
});
