/*\! © 2026 slashwhat. MIT License. */
// hero-animation-utils.js — Shared constants and helpers for hero typing UI.
// Keeps deterministic text assets and lightweight DOM helpers out of the
// animation state machine so the main animation module stays easier to reason about.

// Three taglines typed in sequence, then the subnet demo loop starts.
export const TAGLINES = [
  'Advanced subnet planning for network engineers.',
  'An experiment with vibe coding.',
  'Enter your first subnet to get started.',
];

// Demo types a bad subnet first, then corrects it to teach validation feedback.
export const TYPO_TEXT = '192.168.1.1.0/24';
export const DELETE_COUNT = 6;
export const RETYPE_SUFFIX = '0/24';

// Randomize timing to mimic human keystroke rhythm.
export function humanDelay(base) {
  return base + Math.floor(Math.random() * base * 0.6) - base * 0.2;
}

// Show all taglines instantly and reveal the input line.
// Used for reduced-motion mode and early user interaction.
export function showAllTaglines(terminal, inputWrapper) {
  if (!terminal) return;
  const lines = terminal.querySelectorAll('.hero-tagline-line');
  lines.forEach((line, i) => {
    line.classList.remove('hero-hidden');
    const span = line.querySelector('.hero-tagline');
    if (span && i < TAGLINES.length) span.textContent = TAGLINES[i];
    const cur = line.querySelector('.hero-tagline-cursor');
    if (cur) cur.style.display = 'none';
  });
  if (inputWrapper) inputWrapper.classList.remove('hero-hidden');
}

// Detect whether the static tagline phase already completed.
// Needed when restarting animation after a blur event.
export function allTaglinesDone(terminal) {
  if (!terminal) return false;
  const spans = terminal.querySelectorAll('.hero-tagline');
  return TAGLINES.every((text, i) => spans[i] && spans[i].textContent === text);
}
