/*! © 2026 slashwhat. MIT License. */
// strategy.js — Tab switching, theme toggle, and ambient background for the strategy page.

// Tab switching: clicking a tab button shows its corresponding panel.
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

// Honor the theme chosen on the main page (no toggle here — read-only).
// The main app's theme.js stores the choice under the key 'theme'.
const stored = localStorage.getItem('theme');
if (stored) document.documentElement.setAttribute('data-theme', stored);

// Ambient background — reads the user's active color theme from the
// autosave config and tints the floating orbs with those colors.
(function initAmbient() {
  var THEMES = {
    'Pastel':    ['#7DD3FC','#FCA5A5','#BEF264'],
    'Moody':     ['#7C3AED','#A78BFA','#6B7280'],
    'Neon':      ['#22D3EE','#F472B6','#A3E635'],
    'Mid-Mod':   ['#D97706','#0891B2','#B91C1C'],
    'Terminal':  ['#4ADE80','#22D3EE','#FACC15'],
    'Rainbow':   ['#EF4444','#22C55E','#3B82F6'],
    'Forest':    ['#166534','#4D7C0F','#A16207'],
    'Ocean':     ['#0EA5E9','#14B8A6','#0284C7'],
    'Mountain':  ['#78716C','#A8A29E','#6B7280'],
    'Desert':    ['#F59E0B','#DC2626','#EA580C'],
    'Polar':     ['#BAE6FD','#CFFAFE','#DBEAFE'],
    'Canada':    ['#EF4444','#FCA5A5','#DC2626'],
    'USA':       ['#3B82F6','#EF4444','#60A5FA'],
    'Nigeria':   ['#059669','#6EE7B7','#34D399'],
    'Cuba':      ['#2563EB','#EF4444','#3B82F6'],
    'India':     ['#F97316','#059669','#2563EB'],
    'South Korea': ['#DC2626','#2563EB','#6B7280'],
  };

  // Darken a hex color by a fraction (0-1) for better contrast on light backgrounds.
  function darken(hex, amount) {
    var f = 1 - amount;
    return '#' + [1, 3, 5].map(function(i) {
      return Math.round(parseInt(hex.slice(i, i + 2), 16) * f).toString(16).padStart(2, '0');
    }).join('');
  }

  // Read theme name from the main app's autosave config.
  var colors = THEMES['Pastel'];
  try {
    var raw = localStorage.getItem('slashwhat-autosave');
    if (raw) {
      var cfg = JSON.parse(raw);
      var name = cfg && cfg.colorConfig && cfg.colorConfig.theme;
      if (name && THEMES[name]) colors = THEMES[name];
    }
  } catch (_) { /* use default */ }

  // In light mode, darken accent colors so borders/badges stay visible
  // against the white/light-gray backgrounds.
  var isLight = document.documentElement.getAttribute('data-theme') === 'light';
  var accents = isLight ? colors.map(function(c) { return darken(c, 0.35); }) : colors;

  var bg = document.querySelector('.ambient-bg');
  if (!bg) return;

  // Set CSS custom properties for the pseudo-element orbs (full-brightness colors).
  bg.style.setProperty('--ambient-c1', colors[0]);
  bg.style.setProperty('--ambient-c2', colors[1]);
  bg.style.setProperty('--ambient-c3', colors[2]);

  // Expose (possibly darkened) accent colors globally so CSS accent rules
  // on tabs, cards, layers, pipeline badges, and module hover states stay visible.
  var root = document.documentElement;
  root.style.setProperty('--accent-c1', accents[0]);
  root.style.setProperty('--accent-c2', accents[1]);
  root.style.setProperty('--accent-c3', accents[2]);

  // Inject third orb as a real element (pseudo-elements are used for the first two).
  var orb = document.createElement('span');
  orb.className = 'ambient-orb';
  bg.appendChild(orb);

  // Dot wave — a single div whose CSS background is a grid of theme-colored
  // dots, masked by a diagonal gradient that rolls upper-left to lower-right.
  var wave = document.createElement('div');
  wave.className = 'dot-wave';
  bg.appendChild(wave);
})();
