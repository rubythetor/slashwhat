/*! © 2026 slashwhat. MIT License. */
// page-utils.js — Shared setup utilities for secondary pages.
// Eliminates the tab-switching, theme toggle, and ambient background boilerplate
// that about.js, docs.js, strategy.js, and getting-started.js previously each
// re-implemented verbatim. Each secondary page imports and calls these three
// functions in its own script.

// Three representative colors per theme for ambient background orbs.
// Intentionally a smaller palette than core/color-themes.js, which provides
// 8 colors per theme for row coloring. Orbs only need three accent tones.
const AMBIENT_THEMES = {
  'Pastel':      ['#7DD3FC', '#FCA5A5', '#BEF264'],
  'Moody':       ['#7C3AED', '#A78BFA', '#6B7280'],
  'Neon':        ['#22D3EE', '#F472B6', '#A3E635'],
  'Mid-Mod':     ['#D97706', '#0891B2', '#B91C1C'],
  'Terminal':    ['#4ADE80', '#22D3EE', '#FACC15'],
  'Rainbow':     ['#EF4444', '#22C55E', '#3B82F6'],
  'Forest':      ['#166534', '#4D7C0F', '#A16207'],
  'Ocean':       ['#0EA5E9', '#14B8A6', '#0284C7'],
  'Mountain':    ['#78716C', '#A8A29E', '#6B7280'],
  'Desert':      ['#F59E0B', '#DC2626', '#EA580C'],
  'Polar':       ['#BAE6FD', '#CFFAFE', '#DBEAFE'],
  'Canada':      ['#EF4444', '#FCA5A5', '#DC2626'],
  'USA':         ['#3B82F6', '#EF4444', '#60A5FA'],
  'Nigeria':     ['#059669', '#6EE7B7', '#34D399'],
  'Cuba':        ['#2563EB', '#EF4444', '#3B82F6'],
  'India':       ['#F97316', '#059669', '#2563EB'],
  'South Korea': ['#DC2626', '#2563EB', '#6B7280'],
};

// Darken a hex color by a fraction (0–1) so accent colors stay visible
// on light-theme backgrounds, where full-brightness colors may wash out.
function darken(hex, amount) {
  const f = 1 - amount;
  return '#' + [1, 3, 5].map(i =>
    Math.round(parseInt(hex.slice(i, i + 2), 16) * f).toString(16).padStart(2, '0')
  ).join('');
}

// Wire the tab-switching delegated click handler on the single .tab-bar element.
// Clicking a .tab button shows its corresponding #panel-{tab} content panel.
export function initTabs() {
  document.querySelector('.tab-bar').addEventListener('click', (e) => {
    const tab = e.target.closest('.tab');
    if (!tab) return;
    document.querySelectorAll('.tab').forEach(t => {
      t.classList.remove('active');
      t.setAttribute('aria-selected', 'false');
    });
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    tab.setAttribute('aria-selected', 'true');
    document.getElementById('panel-' + tab.dataset.tab).classList.add('active');
  });
}

// Read the stored theme preference and wire the toggle checkbox so users
// can switch dark/light mode on secondary pages without returning to the app.
// Persists under the same 'theme' key as the main app's theme.js so preference
// stays consistent across all pages.
export function initTheme() {
  const theme = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', theme);
  const toggle = document.getElementById('theme-toggle');
  if (!toggle) return;
  toggle.checked = theme === 'dark';
  toggle.addEventListener('change', () => {
    const next = toggle.checked ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
  });
}

// Tint the floating ambient orbs with colors from whichever palette the user
// has active in the main app. Reads the autosave config from localStorage so
// secondary pages reflect the same visual theme without importing core modules.
// Must be called after initTheme() so the light/dark check is accurate.
export function initAmbient() {
  let colors = AMBIENT_THEMES['Pastel'];
  try {
    const raw = localStorage.getItem('slashwhat-autosave');
    if (raw) {
      const cfg = JSON.parse(raw);
      const name = cfg && cfg.colorConfig && cfg.colorConfig.theme;
      if (name && AMBIENT_THEMES[name]) colors = AMBIENT_THEMES[name];
    }
  } catch (_) { /* use default */ }

  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  const accents = isLight ? colors.map(c => darken(c, 0.35)) : colors;

  const bg = document.querySelector('.ambient-bg');
  if (!bg) return;

  bg.style.setProperty('--ambient-c1', colors[0]);
  bg.style.setProperty('--ambient-c2', colors[1]);
  bg.style.setProperty('--ambient-c3', colors[2]);

  const root = document.documentElement;
  root.style.setProperty('--accent-c1', accents[0]);
  root.style.setProperty('--accent-c2', accents[1]);
  root.style.setProperty('--accent-c3', accents[2]);

  // Third orb injected as a real element; first two use CSS pseudo-elements.
  const orb = document.createElement('span');
  orb.className = 'ambient-orb';
  bg.appendChild(orb);

  // Dot wave — CSS background grid of theme-colored dots masked by a diagonal gradient.
  const wave = document.createElement('div');
  wave.className = 'dot-wave';
  bg.appendChild(wave);
}
