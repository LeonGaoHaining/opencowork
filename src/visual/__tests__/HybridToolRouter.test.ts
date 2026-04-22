import { describe, expect, it } from 'vitest';
import { HybridToolRouter } from '../policy/HybridToolRouter';

describe('HybridToolRouter', () => {
  const router = new HybridToolRouter();

  it('defaults strict extraction tasks to DOM mode', () => {
    const decision = router.decide({
      task: 'extract search results',
      action: 'extract',
      selector: '#results .item',
      requiresStrictExtraction: true,
    });

    expect(decision.mode).toBe('dom');
  });

  it('routes to hybrid mode after prior DOM failure', () => {
    const decision = router.decide({
      task: 'click submit button',
      action: 'click',
      selector: '#submit',
      hasPriorDomFailure: true,
    });

    expect(decision.mode).toBe('hybrid');
  });

  it('routes generic click selectors to CUA mode', () => {
    const decision = router.decide({
      task: 'click the button',
      action: 'click',
      selector: 'button',
    });

    expect(decision.mode).toBe('cua');
  });

  it('routes comma-separated selectors to CUA mode', () => {
    const decision = router.decide({
      task: 'click likely action button',
      action: 'click',
      selector: 'button, a, [role="button"]',
    });

    expect(decision.mode).toBe('cua');
  });

  it('keeps specific selectors on DOM mode', () => {
    const decision = router.decide({
      task: 'type in search input',
      action: 'input',
      selector: '#search-input',
    });

    expect(decision.mode).toBe('dom');
  });
});
