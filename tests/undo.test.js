import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createUndoManager } from '../src/js/core/undo.js';

let mgr;

beforeEach(() => {
  mgr = createUndoManager(8);
});

describe('createUndoManager', () => {
  it('returns an object with the expected API', () => {
    assert.equal(typeof mgr.push, 'function');
    assert.equal(typeof mgr.undo, 'function');
    assert.equal(typeof mgr.redo, 'function');
    assert.equal(typeof mgr.canUndo, 'function');
    assert.equal(typeof mgr.canRedo, 'function');
    assert.equal(typeof mgr.clear, 'function');
  });
});

describe('push + undo', () => {
  it('returns previous state on undo', () => {
    mgr.push('A');
    mgr.push('B');
    const result = mgr.undo('C');
    assert.equal(result, 'B');
  });

  it('returns null when nothing to undo', () => {
    assert.equal(mgr.undo('X'), null);
  });

  it('walks back through multiple states', () => {
    mgr.push('A');
    mgr.push('B');
    mgr.push('C');
    assert.equal(mgr.undo('D'), 'C');
    assert.equal(mgr.undo('C'), 'B');
    assert.equal(mgr.undo('B'), 'A');
    assert.equal(mgr.undo('A'), null);
  });
});

describe('redo', () => {
  it('returns forward state after undo', () => {
    mgr.push('A');
    mgr.push('B');
    mgr.undo('C');
    const result = mgr.redo('B');
    assert.equal(result, 'C');
  });

  it('returns null when nothing to redo', () => {
    assert.equal(mgr.redo('X'), null);
  });

  it('walks forward through multiple undone states', () => {
    mgr.push('A');
    mgr.push('B');
    mgr.push('C');
    mgr.undo('D');
    mgr.undo('C');
    mgr.undo('B');
    assert.equal(mgr.redo('A'), 'B');
    assert.equal(mgr.redo('B'), 'C');
    assert.equal(mgr.redo('C'), 'D');
    assert.equal(mgr.redo('D'), null);
  });
});

describe('new push clears redo', () => {
  it('discards redo stack on new push', () => {
    mgr.push('A');
    mgr.push('B');
    mgr.undo('C');
    assert.equal(mgr.canRedo(), true);
    mgr.push('D');
    assert.equal(mgr.canRedo(), false);
    assert.equal(mgr.redo('D'), null);
  });
});

describe('buffer cap', () => {
  it('drops oldest entries when exceeding maxLevels', () => {
    const small = createUndoManager(3);
    small.push('A');
    small.push('B');
    small.push('C');
    small.push('D');
    // A should have been dropped, only B, C, D remain
    assert.equal(small.undo('E'), 'D');
    assert.equal(small.undo('D'), 'C');
    assert.equal(small.undo('C'), 'B');
    assert.equal(small.undo('B'), null);
  });

  it('respects default cap of 8', () => {
    for (let i = 0; i < 13; i++) mgr.push(`s${i}`);
    // Only the last 8 should remain (s5..s12)
    const fresh = createUndoManager(8);
    for (let i = 0; i < 13; i++) fresh.push(`s${i}`);
    let undoCount = 0;
    let cur = 'end';
    while (true) {
      const prev = fresh.undo(cur);
      if (prev === null) break;
      cur = prev;
      undoCount++;
    }
    assert.equal(undoCount, 8);
  });
});

describe('canUndo / canRedo', () => {
  it('both false on empty manager', () => {
    assert.equal(mgr.canUndo(), false);
    assert.equal(mgr.canRedo(), false);
  });

  it('canUndo true after push', () => {
    mgr.push('A');
    assert.equal(mgr.canUndo(), true);
    assert.equal(mgr.canRedo(), false);
  });

  it('canRedo true after undo', () => {
    mgr.push('A');
    mgr.undo('B');
    assert.equal(mgr.canUndo(), false);
    assert.equal(mgr.canRedo(), true);
  });

  it('both true with partial undo', () => {
    mgr.push('A');
    mgr.push('B');
    mgr.undo('C');
    assert.equal(mgr.canUndo(), true);
    assert.equal(mgr.canRedo(), true);
  });
});

describe('clear', () => {
  it('empties both stacks', () => {
    mgr.push('A');
    mgr.push('B');
    mgr.undo('C');
    assert.equal(mgr.canUndo(), true);
    assert.equal(mgr.canRedo(), true);
    mgr.clear();
    assert.equal(mgr.canUndo(), false);
    assert.equal(mgr.canRedo(), false);
    assert.equal(mgr.undo('X'), null);
    assert.equal(mgr.redo('X'), null);
  });
});

describe('memory cap', () => {
  it('drops oldest entries when byte limit exceeded', () => {
    // Each char is 2 bytes in JS. 10-char string = 20 bytes.
    // Cap at 100 bytes = room for ~5 entries of 10 chars each.
    const small = createUndoManager(50, 100);
    for (let i = 0; i < 10; i++) small.push('x'.repeat(10));
    // Should have trimmed to stay under 100 bytes
    let count = 0;
    let cur = 'end';
    while (true) {
      const prev = small.undo(cur);
      if (prev === null) break;
      cur = prev;
      count++;
    }
    assert.ok(count <= 5, `expected at most 5 entries, got ${count}`);
    assert.ok(count >= 1, 'should retain at least 1 entry');
  });

  it('tracks totalBytes correctly', () => {
    const m = createUndoManager(50, 1024 * 1024);
    m.push('hello');       // 5 chars × 2 = 10 bytes
    assert.equal(m.totalBytes(), 10);
    m.push('world');       // +10 = 20
    assert.equal(m.totalBytes(), 20);
    m.undo('current');     // undo pops 10, pushes 'current' (7×2=14) → 24
    assert.equal(m.totalBytes(), 24);
    m.clear();
    assert.equal(m.totalBytes(), 0);
  });
});

describe('round-trip sequences', () => {
  it('undo then redo returns to same state', () => {
    mgr.push('A');
    mgr.push('B');
    const afterUndo = mgr.undo('C');
    assert.equal(afterUndo, 'B');
    const afterRedo = mgr.redo('B');
    assert.equal(afterRedo, 'C');
  });

  it('multiple undo/redo cycles are consistent', () => {
    mgr.push('A');
    mgr.push('B');
    mgr.push('C');
    // Undo twice
    assert.equal(mgr.undo('D'), 'C');
    assert.equal(mgr.undo('C'), 'B');
    // Redo once
    assert.equal(mgr.redo('B'), 'C');
    // New push wipes redo
    mgr.push('E');
    assert.equal(mgr.canRedo(), false);
    // Undo back
    assert.equal(mgr.undo('F'), 'E');
    assert.equal(mgr.undo('E'), 'B');
    assert.equal(mgr.undo('B'), 'A');
    assert.equal(mgr.undo('A'), null);
  });
});
