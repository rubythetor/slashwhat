import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isSameTabInternalNavigation, isTextEditingTarget } from '../src/js/views/navigation-guards.js';

function makeAnchor({
  origin = 'https://slashwhat.net',
  href = '/about.html',
  target = '',
  download = false,
} = {}) {
  return {
    origin,
    target,
    getAttribute: (name) => {
      if (name === 'href') return href;
      if (name === 'target') return target || null;
      return null;
    },
    hasAttribute: (name) => name === 'download' && download,
  };
}

describe('isTextEditingTarget', () => {
  it('returns false for nullish values', () => {
    assert.equal(isTextEditingTarget(null), false);
    assert.equal(isTextEditingTarget(undefined), false);
  });

  it('returns true for text inputs and textareas', () => {
    assert.equal(isTextEditingTarget({ tagName: 'input', type: 'text' }), true);
    assert.equal(isTextEditingTarget({ tagName: 'TEXTAREA' }), true);
  });

  it('returns false for non-text input controls', () => {
    assert.equal(isTextEditingTarget({ tagName: 'input', type: 'checkbox' }), false);
    assert.equal(isTextEditingTarget({ tagName: 'input', type: 'range' }), false);
  });

  it('returns true for contenteditable nodes or ancestors', () => {
    assert.equal(isTextEditingTarget({ isContentEditable: true }), true);
    const nested = {
      tagName: 'SPAN',
      closest: (sel) => sel.includes('contenteditable') ? { tagName: 'DIV' } : null,
    };
    assert.equal(isTextEditingTarget(nested), true);
  });
});

describe('isSameTabInternalNavigation', () => {
  it('returns true for unmodified left-click same-origin anchor', () => {
    const anchor = makeAnchor();
    const event = {
      target: { closest: () => anchor },
      button: 0,
      defaultPrevented: false,
      metaKey: false, ctrlKey: false, shiftKey: false, altKey: false,
    };
    assert.equal(isSameTabInternalNavigation(event, 'https://slashwhat.net'), true);
  });

  it('returns false for modified clicks or non-left button', () => {
    const anchor = makeAnchor();
    const mod = {
      target: { closest: () => anchor },
      button: 0,
      defaultPrevented: false,
      metaKey: true, ctrlKey: false, shiftKey: false, altKey: false,
    };
    const middle = {
      target: { closest: () => anchor },
      button: 1,
      defaultPrevented: false,
      metaKey: false, ctrlKey: false, shiftKey: false, altKey: false,
    };
    assert.equal(isSameTabInternalNavigation(mod, 'https://slashwhat.net'), false);
    assert.equal(isSameTabInternalNavigation(middle, 'https://slashwhat.net'), false);
  });

  it('returns false for external, target-blank, hash, or download links', () => {
    const external = {
      target: { closest: () => makeAnchor({ origin: 'https://example.com' }) },
      button: 0,
      defaultPrevented: false,
      metaKey: false, ctrlKey: false, shiftKey: false, altKey: false,
    };
    const blank = {
      target: { closest: () => makeAnchor({ target: '_blank' }) },
      button: 0,
      defaultPrevented: false,
      metaKey: false, ctrlKey: false, shiftKey: false, altKey: false,
    };
    const hash = {
      target: { closest: () => makeAnchor({ href: '#docs' }) },
      button: 0,
      defaultPrevented: false,
      metaKey: false, ctrlKey: false, shiftKey: false, altKey: false,
    };
    const download = {
      target: { closest: () => makeAnchor({ download: true }) },
      button: 0,
      defaultPrevented: false,
      metaKey: false, ctrlKey: false, shiftKey: false, altKey: false,
    };
    assert.equal(isSameTabInternalNavigation(external, 'https://slashwhat.net'), false);
    assert.equal(isSameTabInternalNavigation(blank, 'https://slashwhat.net'), false);
    assert.equal(isSameTabInternalNavigation(hash, 'https://slashwhat.net'), false);
    assert.equal(isSameTabInternalNavigation(download, 'https://slashwhat.net'), false);
  });

  it('returns false for prevented events or missing anchors', () => {
    const prevented = {
      target: { closest: () => makeAnchor() },
      button: 0,
      defaultPrevented: true,
      metaKey: false, ctrlKey: false, shiftKey: false, altKey: false,
    };
    const missing = {
      target: { closest: () => null },
      button: 0,
      defaultPrevented: false,
      metaKey: false, ctrlKey: false, shiftKey: false, altKey: false,
    };
    assert.equal(isSameTabInternalNavigation(prevented, 'https://slashwhat.net'), false);
    assert.equal(isSameTabInternalNavigation(missing, 'https://slashwhat.net'), false);
  });
});
