/*! © 2026 slashwhat. MIT License. */
// undo.js — Pure undo/redo stack manager.
// Stores opaque snapshots (strings) with a configurable depth cap
// and a memory byte-size cap to prevent unbounded growth (F-11).
// No DOM, no imports — fully testable in isolation.

// Default memory cap: 5MB prevents large configs from consuming
// excessive RAM over long sessions (8 snapshots × 100KB each).
const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;

// Estimate memory footprint of a snapshot string (2 bytes per char in JS).
function sizeOf(s) { return typeof s === 'string' ? s.length * 2 : 0; }

// Factory for an undo manager that caps history at maxLevels entries
// AND maxBytes total memory across both stacks. The caller is responsible
// for creating and applying snapshots; this module only manages the two
// stacks and the push/pop lifecycle.
export function createUndoManager(maxLevels = 8, maxBytes = DEFAULT_MAX_BYTES) {
  let stack = [];
  let redoStack = [];
  let totalBytes = 0;

  // Drop oldest undo entries until memory is within the cap.
  function trimMemory() {
    while (totalBytes > maxBytes && stack.length > 1) {
      totalBytes -= sizeOf(stack.shift());
    }
  }

  return {
    // Record a new state. Clears the redo future (standard UX: a new
    // action after undo discards the forward history).
    push(snapshot) {
      totalBytes += sizeOf(snapshot);
      stack.push(snapshot);
      if (stack.length > maxLevels) totalBytes -= sizeOf(stack.shift());
      // Clear redo stack and reclaim its memory.
      for (const s of redoStack) totalBytes -= sizeOf(s);
      redoStack.length = 0;
      trimMemory();
    },

    // Move one step backward. Caller passes the current state so it
    // can be saved to the redo stack. Returns the previous snapshot,
    // or null if nothing to undo.
    undo(currentSnapshot) {
      if (stack.length === 0) return null;
      totalBytes += sizeOf(currentSnapshot);
      redoStack.push(currentSnapshot);
      const popped = stack.pop();
      totalBytes -= sizeOf(popped);
      return popped;
    },

    // Move one step forward. Caller passes the current state so it
    // can be saved to the undo stack. Returns the next snapshot,
    // or null if nothing to redo.
    redo(currentSnapshot) {
      if (redoStack.length === 0) return null;
      totalBytes += sizeOf(currentSnapshot);
      stack.push(currentSnapshot);
      const popped = redoStack.pop();
      totalBytes -= sizeOf(popped);
      return popped;
    },

    canUndo() { return stack.length > 0; },
    canRedo() { return redoStack.length > 0; },
    totalBytes() { return totalBytes; },

    // Discard all history (e.g. on full reset).
    clear() {
      stack = [];
      redoStack = [];
      totalBytes = 0;
    },
  };
}
