/*\! © 2026 slashwhat. MIT License. */
// hero-animation.js — Multi-line typing demo for the empty-state hero.
// Types three taglines sequentially, then loops a subnet typing demo
// with a typo correction sequence. Clicking the input stops everything
// and lets the user type a real subnet.

import { parseSubnetInput } from '../core/parse.js';
import { Subnet } from '../core/subnet.js';
import { applySubnetValidation } from './input-validation.js';

// Three taglines typed in sequence, then the subnet demo loops.
const TAGLINES = [
  'Advanced subnet planning for network engineers.',
  'An experiment with vibe coding.',
  'Enter your first subnet to get started.',
];

// Demo types '192.168.1.1.0/24' (intentional typo), pauses, deletes 6 chars, retypes '0/24' — showing real-time validation.
const TYPO_TEXT = '192.168.1.1.0/24';
const DELETE_COUNT = 6;
const RETYPE_SUFFIX = '0/24';

// Randomize timing to mimic human keystroke rhythm.
function humanDelay(base) {
  return base + Math.floor(Math.random() * base * 0.6) - base * 0.2;
}

// Position the blinking cursor span right after the last character.
// Uses canvas text measurement to convert the string length into a
// pixel offset from the left edge of the input.
let _measureCanvas = null;
function updateCursor(input) {
  const cursor = input.parentElement?.querySelector('.hero-cursor');
  if (!cursor) return;

  cursor.style.display = 'block';
  const style = getComputedStyle(input);
  const paddingLeft = parseFloat(style.paddingLeft);

  if (!_measureCanvas) _measureCanvas = document.createElement('canvas');
  const ctx = _measureCanvas.getContext('2d');

  // The input is offset from the wrapper's left edge by the $ prompt + gap.
  const inputOffset = input.offsetLeft;

  // When empty, cursor sits at the left edge of the input.
  if (!input.value) {
    cursor.style.left = `${inputOffset + paddingLeft}px`;
    return;
  }

  // Measure rendered text width and place cursor right after it.
  ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  const textWidth = ctx.measureText(input.value).width;
  cursor.style.left = `${inputOffset + paddingLeft + textWidth + 1}px`;
}

function hideCursor(input) {
  const cursor = input.parentElement?.querySelector('.hero-cursor');
  if (cursor) cursor.style.display = 'none';
}

// Show all taglines instantly and reveal the input line. Used when
// the user interacts before the animation finishes, and for reduced-motion.
function showAllTaglines(terminal, inputWrapper) {
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

// Check if all taglines are already typed (animation restart after blur).
function allTaglinesDone(terminal) {
  if (!terminal) return false;
  const spans = terminal.querySelectorAll('.hero-tagline');
  return TAGLINES.every((text, i) => spans[i] && spans[i].textContent === text);
}

// Start the multi-phase hero animation. Returns a handle with stop() and skipToInput().
export function startHeroAnimation(input) {
  const terminal = input.closest('.hero-terminal');
  const inputWrapper = input.closest('.hero-input-wrapper');
  const taglineLines = terminal ? [...terminal.querySelectorAll('.hero-tagline-line')] : [];

  // Skip animation entirely for users who prefer reduced motion.
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    showAllTaglines(terminal, inputWrapper);
    return { stop() {}, skipToInput() {} };
  }

  let stopped = false;
  let timer = null;
  let phase, charIdx, lineIdx;

  // If taglines were already typed (animation restart after blur), skip to subnet loop.
  if (allTaglinesDone(terminal)) {
    taglineLines.forEach(line => {
      line.classList.remove('hero-hidden');
      const cur = line.querySelector('.hero-tagline-cursor');
      if (cur) cur.style.display = 'none';
    });
    if (inputWrapper) inputWrapper.classList.remove('hero-hidden');
    phase = 'typing';
    charIdx = 0;
    updateCursor(input);
    timer = setTimeout(step, 1500);
  } else {
    // Start fresh: hide all lines, begin typing line 0.
    taglineLines.forEach((line, i) => {
      if (i > 0) line.classList.add('hero-hidden');
      const span = line.querySelector('.hero-tagline');
      if (span) span.textContent = '';
      const cur = line.querySelector('.hero-tagline-cursor');
      if (cur) cur.style.display = i === 0 ? 'block' : 'none';
    });
    if (inputWrapper) inputWrapper.classList.add('hero-hidden');
    phase = 'tagline';
    lineIdx = 0;
    charIdx = 0;
    timer = setTimeout(step, 1500);
  }

  function step() {
    if (stopped) return;

    switch (phase) {
      // Type taglines one line at a time.
      case 'tagline': {
        const text = TAGLINES[lineIdx];
        const line = taglineLines[lineIdx];
        const span = line?.querySelector('.hero-tagline');
        const cur = line?.querySelector('.hero-tagline-cursor');

        if (charIdx <= text.length) {
          if (span) span.textContent = text.slice(0, charIdx);
          charIdx++;
          timer = setTimeout(step, humanDelay(50));
        } else {
          // Line done — hide its cursor, move to next line or input.
          if (cur) cur.style.display = 'none';
          lineIdx++;
          charIdx = 0;
          if (lineIdx < TAGLINES.length) {
            // Reveal next line and start typing it.
            const nextLine = taglineLines[lineIdx];
            if (nextLine) {
              nextLine.classList.remove('hero-hidden');
              const nextCur = nextLine.querySelector('.hero-tagline-cursor');
              if (nextCur) nextCur.style.display = 'block';
            }
            timer = setTimeout(step, 600);
          } else {
            // All taglines done — show the input line.
            if (inputWrapper) inputWrapper.classList.remove('hero-hidden');
            phase = 'typing';
            charIdx = 0;
            updateCursor(input);
            timer = setTimeout(step, 1000);
          }
        }
        break;
      }

      // Subnet typing loop (type → pause → delete → retype → pause → clear → repeat).
      case 'typing':
        if (charIdx <= TYPO_TEXT.length) {
          input.value = TYPO_TEXT.slice(0, charIdx);
          applySubnetValidation(input);
          updateCursor(input);
          charIdx++;
          timer = setTimeout(step, humanDelay(150));
        } else {
          phase = 'pause-typo';
          timer = setTimeout(step, 1500);
        }
        break;

      case 'pause-typo':
        phase = 'deleting';
        step();
        break;

      case 'deleting': {
        const target = TYPO_TEXT.length - DELETE_COUNT;
        if (input.value.length > target) {
          input.value = input.value.slice(0, -1);
          applySubnetValidation(input);
          updateCursor(input);
          timer = setTimeout(step, humanDelay(100));
        } else {
          phase = 'retyping';
          charIdx = 0;
          timer = setTimeout(step, 300);
        }
        break;
      }

      case 'retyping':
        if (charIdx < RETYPE_SUFFIX.length) {
          input.value += RETYPE_SUFFIX[charIdx];
          applySubnetValidation(input);
          updateCursor(input);
          charIdx++;
          timer = setTimeout(step, humanDelay(140));
        } else {
          phase = 'pause-fixed';
          timer = setTimeout(step, 2500);
        }
        break;

      case 'pause-fixed':
        input.value = '';
        applySubnetValidation(input);
        updateCursor(input);
        phase = 'typing';
        charIdx = 0;
        timer = setTimeout(step, 3000);
        break;
    }
  }

  return {
    stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
      hideCursor(input);
    },
    // Jump straight to the input line, completing all taglines instantly.
    skipToInput() {
      stopped = true;
      if (timer) clearTimeout(timer);
      showAllTaglines(terminal, inputWrapper);
      hideCursor(input);
    },
  };
}

// Wire up the hero input as a real functional subnet entry.
// On focus or keypress, stops the animation and lets the user type.
// Returns a dismiss() function that the table input row can call to
// fade out the hero when the user clicks there instead.
export function wireHeroInput(input, onSubmit) {
  let animation = startHeroAnimation(input);
  let userActive = false;
  const heroEl = input.closest('.empty-hero');

  // Activate the hero input: complete taglines, stop animation, focus.
  function activate() {
    animation.skipToInput();
    input.value = '';
    applySubnetValidation(input);
    userActive = true;
    input.focus();
  }

  // Dismiss the entire hero (called when user clicks the table input row).
  function dismiss() {
    animation.skipToInput();
    userActive = true;
    document.removeEventListener('keydown', onGlobalKey);
    if (heroEl) heroEl.classList.add('empty-hero--fading');
  }

  // Any printable keypress anywhere on the page immediately focuses the
  // hero subnet input, even during the tagline typing phase. Exception:
  // if an input already has focus (e.g. the table row), don't steal it.
  function onGlobalKey(e) {
    if (!input.isConnected) {
      document.removeEventListener('keydown', onGlobalKey);
      return;
    }
    if (userActive) return;
    if (e.target.tagName === 'INPUT') return;
    if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return;
    activate();
  }
  document.addEventListener('keydown', onGlobalKey);

  input.addEventListener('focus', () => {
    if (!userActive) activate();
  });

  // Re-validate on every keystroke once the user is typing
  input.addEventListener('input', () => {
    applySubnetValidation(input);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const val = input.value.trim();
    if (!val) return;
    try {
      const { addr, prefix } = parseSubnetInput(val);
      const subnet = new Subnet(addr, prefix);
      onSubmit(subnet);
    } catch {
      // Invalid — do nothing
    }
  });

  // If user blurs without typing anything, restart the animation
  // (taglines stay, only the subnet loop restarts).
  input.addEventListener('blur', () => {
    if (userActive && !input.value.trim()) {
      userActive = false;
      animation = startHeroAnimation(input);
    }
  });

  return dismiss;
}
