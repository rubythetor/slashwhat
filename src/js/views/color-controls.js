/*\! © 2026 slashwhat. MIT License. */
// color-controls.js — Color mode picker and theme picker UI.
// Renders the control strip below the table (next to padding) and
// wires up popup menus for mode selection, theme selection, and
// alternating-mode color pickers. Reuses popup helpers from header-menus.

import { COLOR_MODES, COLOR_MODE_LABELS, THEMES, getThemeColors } from '../core/color-themes.js';
import { anchorAndShow, createOption, createSectionHeader, closeHeaderMenu } from './header-menus.js';
import { renderFooter } from './about-modal.js';

// --- HTML generation ---

// Reusable +/-/reset button group template. prefix distinguishes row-font vs hdr-font for CSS class targeting.
function fontSizeControlHtml(prefix, label, extraClass = '') {
  return `<span class="table-control-group${extraClass ? ' ' + extraClass : ''}">`
    + `<button class="padding-btn ${prefix}-down" title="Decrease ${label}" aria-label="Decrease ${label}">&minus;</button> `
    + label
    + ` <button class="padding-btn ${prefix}-up" title="Increase ${label}" aria-label="Increase ${label}">+</button>`
    + ` <button class="padding-btn ${prefix}-reset" title="Reset ${label}" aria-label="Reset ${label}">\u21BA</button>`
    + '</span>';
}

// Render the full below-table control strip: font sizes, padding, tooltips, color controls.
export function renderBelowTableControls(colorConfig, showTooltips, showWarnings = true) {
  return '<div class="table-below-controls">'
    + fontSizeControlHtml('hdr-font', 'HEADER FONT', 'control-hdr-font')
    + fontSizeControlHtml('row-font', 'ROW FONT', 'control-row-font')
    + '<span class="table-control-group control-padding">'
    + '<button class="padding-btn padding-down" title="Decrease padding" aria-label="Decrease padding">&minus;</button> '
    + 'PADDING'
    + ' <button class="padding-btn padding-up" title="Increase padding" aria-label="Increase padding">+</button>'
    + ' <button class="padding-btn padding-reset" title="Reset padding" aria-label="Reset padding">\u21BA</button>'
    + '</span>'
    + `<span class="table-control-group tooltip-toggle-label">TOOLTIPS<span class="control-value">${showTooltips ? 'On' : 'Off'}</span></span>`
    + `<span class="table-control-group warnings-toggle-label">WARNINGS<span class="control-value">${showWarnings ? 'On' : 'Off'}</span></span>`
    + renderColorControls(colorConfig)
    + '</div>'
    + renderFooter();
}

// Render the color control strip HTML (inline within the padding-control div).
function renderColorControls(colorConfig) {
  const { mode, theme, altColors } = colorConfig;
  const modeLabel = COLOR_MODE_LABELS[mode] || mode;
  const palette = getThemeColors(theme);

  let html = '<span class="table-control-group color-mode-label">COLOR MODE'
    + `<span class="control-value">${modeLabel}</span></span>`;

  // Show theme label for modes that use the palette (not alternating —
  // alternating picks individual colors, not a whole theme).
  if (mode !== 'zebra' && mode !== 'none' && mode !== 'alternating') {
    html += '<span class="table-control-group color-theme-label">THEME'
      + `<span class="control-value">${theme}</span></span>`;
  }

  // Alternating mode: two clickable swatch buttons to pick colors.
  if (mode === 'alternating') {
    html += '<span class="table-control-group alt-color-pickers">';
    html += `<button class="alt-color-btn" data-alt-idx="0" style="background:${altColors[0]}" title="Color A"></button>`;
    html += `<button class="alt-color-btn" data-alt-idx="1" style="background:${altColors[1]}" title="Color B"></button>`;
    html += '</span>';
  }
  return html;
}

// --- Event wiring ---

// Wire font-size +/−/reset buttons. prefix is the CSS class prefix
// (e.g. '.row-font' matches '.row-font-up', '.row-font-down', '.row-font-reset').
export function attachFontSizeHandlers(container, prefix, size, opts, renderTable) {
  const up = container.querySelector(`${prefix}-up`);
  const down = container.querySelector(`${prefix}-down`);
  const reset = container.querySelector(`${prefix}-reset`);
  if (up) up.addEventListener('click', () => {
    if (size.value < opts.max) { size.value = Math.round((size.value + opts.step) * 100) / 100; renderTable(); }
  });
  if (down) down.addEventListener('click', () => {
    if (size.value > opts.min) { size.value = Math.round((size.value - opts.step) * 100) / 100; renderTable(); }
  });
  if (reset) reset.addEventListener('click', () => {
    if (size.value !== opts.default) { size.value = opts.default; renderTable(); }
  });
}

// Wire padding up/down/reset buttons inside the below-table control strip.
export function attachPaddingHandlers(container, padding, opts, renderTable) {
  const padUp = container.querySelector('.padding-up');
  const padDown = container.querySelector('.padding-down');
  const padReset = container.querySelector('.padding-reset');
  if (padUp) padUp.addEventListener('click', () => {
    if (padding.value < opts.max) { padding.value += opts.step; renderTable(); }
  });
  if (padDown) padDown.addEventListener('click', () => {
    if (padding.value > opts.min) { padding.value -= opts.step; renderTable(); }
  });
  if (padReset) padReset.addEventListener('click', () => {
    if (padding.value !== opts.default) { padding.value = opts.default; renderTable(); }
  });
}

// Attach click handlers to the color control elements. onChange is called
// with the updated colorConfig whenever the user changes a setting.
export function attachColorControlHandlers(container, colorConfig, onChange) {
  const modeLabel = container.querySelector('.color-mode-label');
  const themeLabel = container.querySelector('.color-theme-label');

  if (modeLabel) {
    modeLabel.addEventListener('click', (e) => {
      e.stopPropagation();
      showModeMenu(modeLabel, colorConfig, onChange);
    });
  }

  if (themeLabel) {
    themeLabel.addEventListener('click', (e) => {
      e.stopPropagation();
      showThemeMenu(themeLabel, colorConfig, onChange);
    });
  }

  // Alternating mode: color picker buttons
  const altBtns = container.querySelectorAll('.alt-color-btn');
  altBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.altIdx);
      showAltColorPicker(btn, idx, colorConfig, onChange);
    });
  });
}

// Wire paint bucket click delegation on a parent container (typically the
// table wrapper). Separated from attachColorControlHandlers because buckets
// live inside the table body, not the below-table control strip.
export function attachBucketHandlers(container, onBucketClick) {
  container.addEventListener('click', (e) => {
    const bucket = e.target.closest('.color-bucket');
    if (!bucket) return;
    e.stopPropagation();
    onBucketClick(bucket, bucket.dataset.nodeId);
  });
}

// Show a popup for selecting the manual-mode row color. Reuses the same
// theme-row layout as the theme picker so the user sees all 11 palettes
// with individually clickable swatches.
export function showManualColorPicker(anchor, nodeId, colorConfig, currentColor, onPick) {
  closeHeaderMenu();
  const menu = document.createElement('div');
  menu.className = 'range-style-menu';
  menu.appendChild(createSectionHeader('Pick Color'));

  buildThemeRows(menu, {
    currentColor,
    onSwatchClick: (color) => { onPick(nodeId, color); closeHeaderMenu(); },
  });

  // Clear row at the bottom to remove the custom color.
  const clearRow = document.createElement('div');
  clearRow.className = 'theme-picker-row color-clear-row';
  const clearName = document.createElement('span');
  clearName.className = 'theme-picker-name';
  clearName.textContent = 'Clear';
  const clearIcon = document.createElement('span');
  clearIcon.className = 'color-swatch-clear-inline';
  clearIcon.textContent = '\u2715';
  clearRow.appendChild(clearName);
  clearRow.appendChild(clearIcon);
  clearRow.addEventListener('click', (e) => {
    e.stopPropagation();
    onPick(nodeId, null);
    closeHeaderMenu();
  });
  menu.appendChild(clearRow);

  anchorAndShow(menu, anchor);
}

// --- Shared theme-row builder ---

// Build theme rows (name + 8 swatches) and append to menu. Two modes:
//   onRowClick(themeName) — whole row selects a theme (theme picker)
//   onSwatchClick(color)  — each swatch is individually clickable (manual picker)
// activeTheme highlights the current theme row; currentColor highlights
// the matching swatch with a border.
function buildThemeRows(menu, { activeTheme, currentColor, onRowClick, onSwatchClick }) {
  for (const theme of THEMES) {
    const row = document.createElement('div');
    row.className = 'theme-picker-row' + (activeTheme === theme.name ? ' active' : '');

    const name = document.createElement('span');
    name.className = 'theme-picker-name';
    name.textContent = theme.name;
    row.appendChild(name);

    const swatches = document.createElement('span');
    swatches.className = 'theme-picker-swatches';
    for (const c of theme.colors) {
      const sw = document.createElement('span');
      sw.className = 'theme-picker-swatch' + (currentColor === c ? ' active' : '');
      sw.style.background = c;
      if (onSwatchClick) {
        sw.classList.add('theme-picker-swatch-clickable');
        sw.addEventListener('click', (e) => { e.stopPropagation(); onSwatchClick(c); });
      }
      swatches.appendChild(sw);
    }
    row.appendChild(swatches);

    if (onRowClick) {
      row.addEventListener('click', (e) => { e.stopPropagation(); onRowClick(theme.name); });
    }

    menu.appendChild(row);
  }
}

// --- Popup menus ---

// Mode picker popup — lists all 6 modes with the current one highlighted.
function showModeMenu(anchor, colorConfig, onChange) {
  closeHeaderMenu();
  const menu = document.createElement('div');
  menu.className = 'range-style-menu';
  menu.appendChild(createSectionHeader('Color Mode'));

  for (const mode of COLOR_MODES) {
    const label = COLOR_MODE_LABELS[mode];
    menu.appendChild(createOption(label, '', mode === colorConfig.mode, () => {
      onChange({ ...colorConfig, mode });
      closeHeaderMenu();
    }));
  }

  anchorAndShow(menu, anchor);
}

// Theme picker popup — shows all themes with name and 8 color swatches.
// Clicking the row selects the whole theme.
function showThemeMenu(anchor, colorConfig, onChange) {
  closeHeaderMenu();
  const menu = document.createElement('div');
  menu.className = 'range-style-menu';
  menu.appendChild(createSectionHeader('Theme'));

  buildThemeRows(menu, {
    activeTheme: colorConfig.theme,
    onRowClick: (themeName) => {
      onChange({ ...colorConfig, theme: themeName });
      closeHeaderMenu();
    },
  });

  anchorAndShow(menu, anchor);
}

// Alternating color picker — reuses the theme-row layout so the user
// sees all 11 palettes and can pick any individual color.
function showAltColorPicker(anchor, idx, colorConfig, onChange) {
  closeHeaderMenu();
  const menu = document.createElement('div');
  menu.className = 'range-style-menu';
  menu.appendChild(createSectionHeader(`Color ${idx === 0 ? 'A' : 'B'}`));

  buildThemeRows(menu, {
    currentColor: colorConfig.altColors[idx],
    onSwatchClick: (color) => {
      const newAlt = [...colorConfig.altColors];
      newAlt[idx] = color;
      onChange({ ...colorConfig, altColors: newAlt });
      closeHeaderMenu();
    },
  });

  anchorAndShow(menu, anchor);
}
