import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Mock localStorage and document before importing the module.
const storage = new Map();
globalThis.localStorage = {
  getItem: (k) => storage.get(k) ?? null,
  setItem: (k, v) => storage.set(k, String(v)),
  removeItem: (k) => storage.delete(k),
  clear: () => storage.clear(),
};

const attrs = new Map();
let _mockToggle = null;
globalThis.document = {
  documentElement: {
    setAttribute: (k, v) => attrs.set(k, v),
    getAttribute: (k) => attrs.get(k) ?? null,
  },
  getElementById: (id) => id === 'mode-toggle' ? _mockToggle : null,
};

// Single static import so Node's coverage tracks all lines.
import {
  isSimpleMode, setSimpleMode,
  saveAdvancedState, loadAdvancedState,
  initSimpleMode,
} from '../src/js/ui/simple-mode.js';

beforeEach(() => {
  storage.clear();
  attrs.clear();
  _mockToggle = null;
  // Reset to known state via the public API.
  setSimpleMode(false);
});

describe('isSimpleMode', () => {
  it('returns false after reset', () => {
    assert.equal(isSimpleMode(), false);
  });

  it('returns true after setSimpleMode(true)', () => {
    setSimpleMode(true);
    assert.equal(isSimpleMode(), true);
  });
});

describe('setSimpleMode', () => {
  it('sets data-simple-mode attribute to true', () => {
    setSimpleMode(true);
    assert.equal(attrs.get('data-simple-mode'), 'true');
  });

  it('persists to localStorage', () => {
    setSimpleMode(true);
    assert.equal(storage.get('slashwhat-simple-mode'), 'true');
  });

  it('sets attribute to false and updates localStorage', () => {
    setSimpleMode(true);
    setSimpleMode(false);
    assert.equal(attrs.get('data-simple-mode'), 'false');
    assert.equal(storage.get('slashwhat-simple-mode'), 'false');
  });

  it('syncs checkbox when toggle element exists', () => {
    _mockToggle = { checked: true, addEventListener: () => {} };
    // Re-init so the module picks up the mock toggle.
    initSimpleMode(() => {});
    setSimpleMode(true);
    assert.equal(_mockToggle.checked, false);
    setSimpleMode(false);
    assert.equal(_mockToggle.checked, true);
  });
});

describe('saveAdvancedState / loadAdvancedState', () => {
  it('round-trips state through localStorage', () => {
    const state = {
      colOrder: ['subnet', 'name', 'ips'],
      visibleCols: ['subnet', 'name'],
      cellPad: 3,
      rowFontSize: 0.875,
      hdrFontSize: 0.975,
    };
    saveAdvancedState(state);
    const loaded = loadAdvancedState();
    assert.deepEqual(loaded, state);
  });

  it('returns null when no state saved', () => {
    assert.equal(loadAdvancedState(), null);
  });

  it('returns null for corrupted JSON', () => {
    storage.set('slashwhat-advanced-state', '{broken');
    assert.equal(loadAdvancedState(), null);
  });
});

describe('initSimpleMode', () => {
  it('reads stored preference of true', () => {
    storage.set('slashwhat-simple-mode', 'true');
    _mockToggle = null;
    initSimpleMode(() => {});
    assert.equal(isSimpleMode(), true);
    assert.equal(attrs.get('data-simple-mode'), 'true');
  });

  it('reads stored preference of false', () => {
    storage.set('slashwhat-simple-mode', 'false');
    _mockToggle = null;
    initSimpleMode(() => {});
    assert.equal(isSimpleMode(), false);
  });

  it('defaults to advanced when no stored preference', () => {
    _mockToggle = null;
    initSimpleMode(() => {});
    assert.equal(isSimpleMode(), false);
  });

  it('wires checkbox and fires callback with correct value', () => {
    let changeHandler = null;
    _mockToggle = {
      checked: true,
      addEventListener: (event, handler) => { changeHandler = handler; },
    };
    let callbackValue = null;
    initSimpleMode((wantSimple) => { callbackValue = wantSimple; });

    // Simulate unchecking (switching to simple)
    _mockToggle.checked = false;
    changeHandler();
    assert.equal(callbackValue, true);

    // Simulate checking (switching to advanced)
    _mockToggle.checked = true;
    changeHandler();
    assert.equal(callbackValue, false);
  });

  it('sets initial checkbox state based on stored preference', () => {
    storage.set('slashwhat-simple-mode', 'true');
    _mockToggle = { checked: true, addEventListener: () => {} };
    initSimpleMode(() => {});
    // Simple mode = unchecked
    assert.equal(_mockToggle.checked, false);
  });
});
