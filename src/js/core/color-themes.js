/*\! © 2026 slashwhat. MIT License. */
// color-themes.js — Color theme definitions and mode constants.
// Pure data module, no DOM. Defines the built-in themes (11 palettes of
// 8 colors each), the six color modes, and zebra stripe colors that
// adapt to dark/light themes.

// Seven modes for row coloring, from structured to freeform.
export const COLOR_MODES = [
  'sibling', 'cousins', 'cycle', 'alternating', 'zebra', 'manual', 'none',
];

// Human-readable labels for the mode picker UI.
export const COLOR_MODE_LABELS = {
  sibling:     'Sibling',
  cousins:     'Siblings & Cousins',
  cycle:       'Cycle',
  alternating: 'Alternating Colors',
  zebra:       'Zebra',
  manual:      'Manual',
  none:        'None',
};

// Built-in themes, each with 8 visually distinct colors. Pastel uses
// the first 8 colors from the legacy 32-color PALETTE so existing users
// see familiar colors by default. Flag themes use colors from national flags.
export const THEMES = [
  { name: 'Pastel',    colors: ['#7DD3FC','#CBD5E1','#FCA5A5','#99F6E4','#BEF264','#DDD6FE','#FDE68A','#FECDD3'] },
  { name: 'Moody',     colors: ['#6B7280','#9CA3AF','#7C3AED','#4B5563','#A78BFA','#374151','#8B5CF6','#6D28D9'] },
  { name: 'Neon',      colors: ['#22D3EE','#A3E635','#F472B6','#FACC15','#818CF8','#FB923C','#34D399','#E879F9'] },
  { name: 'Mid-Mod',   colors: ['#D97706','#0891B2','#B91C1C','#65A30D','#4338CA','#A16207','#0E7490','#9F1239'] },
  { name: 'Terminal',  colors: ['#4ADE80','#22D3EE','#FACC15','#F87171','#C084FC','#FB923C','#2DD4BF','#E879F9'] },
  { name: 'Rainbow',   colors: ['#EF4444','#F97316','#EAB308','#22C55E','#3B82F6','#8B5CF6','#EC4899','#06B6D4'] },
  { name: 'Forest',    colors: ['#166534','#15803D','#4D7C0F','#A16207','#854D0E','#365314','#14532D','#713F12'] },
  { name: 'Ocean',     colors: ['#0EA5E9','#06B6D4','#14B8A6','#0284C7','#0891B2','#0D9488','#0369A1','#0E7490'] },
  { name: 'Mountain',  colors: ['#78716C','#A8A29E','#6B7280','#9CA3AF','#57534E','#D6D3D1','#44403C','#E7E5E3'] },
  { name: 'Desert',    colors: ['#F59E0B','#D97706','#DC2626','#EA580C','#CA8A04','#B91C1C','#92400E','#991B1B'] },
  { name: 'Polar',     colors: ['#BAE6FD','#E0F2FE','#CFFAFE','#A5F3FC','#DBEAFE','#F0F9FF','#ECFEFF','#EFF6FF'] },
  { name: 'Canada',      colors: ['#EF4444','#F87171','#FCA5A5','#FECACA','#DC2626','#FEE2E2','#FFE4E6','#FDA4AF'] },
  { name: 'USA',         colors: ['#3B82F6','#EF4444','#60A5FA','#F87171','#93C5FD','#FCA5A5','#DBEAFE','#FECACA'] },
  { name: 'Nigeria',     colors: ['#059669','#34D399','#6EE7B7','#A7F3D0','#10B981','#BBF7D0','#D1FAE5','#047857'] },
  { name: 'Cuba',        colors: ['#2563EB','#EF4444','#3B82F6','#F87171','#60A5FA','#FCA5A5','#93C5FD','#FECACA'] },
  { name: 'India',       colors: ['#F97316','#059669','#FB923C','#34D399','#FDBA74','#6EE7B7','#2563EB','#FED7AA'] },
  { name: 'South Korea', colors: ['#DC2626','#2563EB','#EF4444','#3B82F6','#F87171','#60A5FA','#6B7280','#D1D5DB'] },
];

// Name→theme lookup for fast access.
export const THEME_MAP = Object.fromEntries(THEMES.map(t => [t.name, t]));

// Zebra stripe colors adapt to the current theme so they blend with
// the page background rather than clashing.
export const ZEBRA_COLORS = {
  dark:  ['#d1d5db', '#e5e7eb'],
  light: ['#e5e7eb', '#f3f4f6'],
};

// Default configuration for new sessions or reset.
export const DEFAULT_COLOR_CONFIG = {
  mode: 'sibling',
  theme: 'Neon',
  altColors: ['#22D3EE', '#F472B6'],
};

// Look up a theme's 8-color array by name, falling back to Pastel
// if the name is unrecognized (e.g. config from a newer version).
export function getThemeColors(name) {
  const theme = THEME_MAP[name];
  return theme ? theme.colors : THEMES[0].colors;
}
