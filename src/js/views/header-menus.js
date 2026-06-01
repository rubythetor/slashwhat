/*\! © 2026 slashwhat. MIT License. */
// header-menus.js — Popup menus for column header style pickers.
// Range/Usable headers open a format + separator picker; IPs/Hosts
// headers open a number format picker. Each column tracks settings
// independently. The caller provides current state and an onChange
// callback to apply the selected option and re-render.

// --- Range style options ---

const RANGE_STYLES = [
  { key: 'short',   label: 'Short',   example: 'x.x.0.0' },
  { key: 'shorter', label: 'Shorter', example: 'x.0.0' },
  { key: 'full',    label: 'Full',    example: '192.168.0.0' },
  { key: 'tail',    label: 'Tail',    example: '0.0' },
  { key: 'dots',    label: 'Dots',    example: '..0.0' },
];

const RANGE_SEPS = [
  { key: '-',      label: 'x-x' },
  { key: ' - ',    label: 'x - x' },
  { key: '\u2013', label: 'x\u2013x', desc: 'en dash' },
  { key: '\u2014', label: 'x\u2014x', desc: 'em dash' },
  { key: ' to ',   label: 'x to x' },
  { key: ' To ',   label: 'x To x' },
  { key: ':',      label: 'x:x' },
  { key: '_',      label: 'x_x' },
  { key: ' ',      label: 'x x' },
];

// --- Number format options ---

const NUMBER_FORMATS = [
  { key: 'locale', label: '4,096',  desc: 'Locale' },
  { key: 'si',     label: '4K',     desc: 'SI' },
  { key: 'si1',    label: '4.1K',   desc: 'SI .1' },
  { key: 'raw',    label: '4096',   desc: 'Raw' },
];

// --- Menu lifecycle ---

// Remove any open header menu and its document-level close listener.
export function closeHeaderMenu() {
  const existing = document.querySelector('.range-style-menu');
  if (existing) existing.remove();
}

// Position a menu element near a trigger element. Opens below by default;
// flips above when the menu would overflow the viewport bottom. A max-height
// with overflow scroll acts as a safety net for very small viewports.
export function anchorAndShow(menu, thEl) {
  const rect = thEl.getBoundingClientRect();
  menu.style.position = 'fixed';
  menu.style.left = rect.left + 'px';
  menu.style.maxHeight = '70vh';
  menu.style.overflowY = 'auto';
  document.body.appendChild(menu);

  // Measure after appending so the menu has its real dimensions.
  const menuRect = menu.getBoundingClientRect();
  const spaceBelow = window.innerHeight - rect.bottom - 4;
  if (menuRect.height > spaceBelow && rect.top > spaceBelow) {
    // Flip above the trigger when more room exists above.
    menu.style.top = (rect.top - menuRect.height - 2) + 'px';
  } else {
    menu.style.top = (rect.bottom + 2) + 'px';
  }

  requestAnimationFrame(() => {
    document.addEventListener('click', closeHeaderMenu, { once: true });
  });
}

// Build a clickable option row for a popup menu.
// Uses textContent instead of innerHTML to prevent XSS if label/detail
// values ever come from user-controlled sources.
export function createOption(label, detail, isActive, onClick) {
  const opt = document.createElement('div');
  opt.setAttribute('role', 'menuitem');
  opt.className = 'range-style-option' + (isActive ? ' active' : '');
  const labelSpan = document.createElement('span');
  labelSpan.className = 'range-style-label';
  labelSpan.textContent = label;
  opt.appendChild(labelSpan);
  if (detail) {
    const detailSpan = document.createElement('span');
    detailSpan.className = 'range-style-example';
    detailSpan.textContent = detail;
    opt.appendChild(detailSpan);
  }
  opt.addEventListener('click', (e) => {
    // Prevent the document-level listener (from anchorAndShow) from
    // closing the menu before the option callback has a chance to run.
    e.stopPropagation();
    onClick();
  });
  return opt;
}

// Build a section header divider inside a popup menu.
export function createSectionHeader(text) {
  const el = document.createElement('div');
  el.className = 'range-style-section-header';
  el.textContent = text;
  return el;
}

// --- Public API ---

// Show a dropdown popup for Range or Usable column format + separator.
// col: 'range' | 'usable', current: { style, sep }, onChange(newSettings).
export function showRangeStyleMenu(thEl, col, current, onChange) {
  closeHeaderMenu();

  const menu = document.createElement('div');
  menu.className = 'range-style-menu';

  menu.appendChild(createSectionHeader('Format'));
  for (const s of RANGE_STYLES) {
    menu.appendChild(createOption(s.label, s.example, s.key === current.style, () => {
      onChange({ ...current, style: s.key });
      closeHeaderMenu();
    }));
  }

  menu.appendChild(createSectionHeader('Separator'));
  for (const s of RANGE_SEPS) {
    menu.appendChild(createOption(s.label, s.desc || '', s.key === current.sep, () => {
      onChange({ ...current, sep: s.key });
      closeHeaderMenu();
    }));
  }

  anchorAndShow(menu, thEl);
}

// Show a dropdown popup for IPs or Hosts number format.
// col: 'ips' | 'hosts', currentFmt: string key, onChange(newFmt).
export function showNumberFormatMenu(thEl, col, currentFmt, onChange) {
  closeHeaderMenu();

  const menu = document.createElement('div');
  menu.className = 'range-style-menu';

  menu.appendChild(createSectionHeader('Format'));
  for (const f of NUMBER_FORMATS) {
    menu.appendChild(createOption(f.label, f.desc, f.key === currentFmt, () => {
      onChange(f.key);
      closeHeaderMenu();
    }));
  }

  anchorAndShow(menu, thEl);
}

// --- Notes display options ---

const NOTES_LINES = [
  { key: '1',   label: '1-Line' },
  { key: '2',   label: '2-Line Wrap' },
  { key: '3',   label: '3-Line Wrap' },
  { key: 'all', label: 'Everything' },
];

const NOTES_SIZES = [
  { key: 'normal',   label: 'Normal' },
  { key: 'small',    label: 'Small' },
  { key: 'smallest', label: 'Smallest' },
];

// Show a dropdown popup for Notes column line mode and font size.
// current: { lines, fontSize }, onChange(newSettings).
export function showNotesFormatMenu(thEl, current, onChange) {
  closeHeaderMenu();

  const menu = document.createElement('div');
  menu.className = 'range-style-menu';

  menu.appendChild(createSectionHeader('Preview'));
  for (const n of NOTES_LINES) {
    menu.appendChild(createOption(n.label, '', n.key === current.lines, () => {
      onChange({ ...current, lines: n.key });
      closeHeaderMenu();
    }));
  }

  menu.appendChild(createSectionHeader('Font Size'));
  for (const s of NOTES_SIZES) {
    menu.appendChild(createOption(s.label, '', s.key === current.fontSize, () => {
      onChange({ ...current, fontSize: s.key });
      closeHeaderMenu();
    }));
  }

  anchorAndShow(menu, thEl);
}

// --- Name display options ---

const NAME_MODES = [
  { key: 'manual',    label: 'Manual',    desc: 'Flat, user-typed names' },
  { key: 'automatic', label: 'Automatic', desc: 'Editable, Hierarchical Auto Naming' },
];

// Show a dropdown popup for Name column naming mode.
// current: { mode }, onChange(newSettings), onBeforeAutomatic(proceed) optional.
// When switching manual→automatic, onBeforeAutomatic is called instead of
// onChange so the caller can show a conversion popup first.
export function showNameFormatMenu(thEl, current, onChange, onBeforeAutomatic) {
  closeHeaderMenu();

  const menu = document.createElement('div');
  menu.className = 'range-style-menu';

  menu.appendChild(createSectionHeader('Naming Mode'));
  for (const m of NAME_MODES) {
    menu.appendChild(createOption(m.label, m.desc, m.key === current.mode, () => {
      const switchingToAuto = m.key === 'automatic' && current.mode !== 'automatic';
      if (switchingToAuto && onBeforeAutomatic) {
        closeHeaderMenu();
        onBeforeAutomatic(thEl);
      } else {
        onChange({ ...current, mode: m.key });
        closeHeaderMenu();
      }
    }));
  }

  anchorAndShow(menu, thEl);
}

// Show a second popup for converting existing manual labels when switching
// to automatic mode. Offers Convert / Clear / Cancel.
export function showNameConvertMenu(thEl, onConvert, onClear, onCancel) {
  closeHeaderMenu();

  const menu = document.createElement('div');
  menu.className = 'range-style-menu';

  menu.appendChild(createSectionHeader('Existing Names'));
  menu.appendChild(createOption('Convert Names', 'Strip parent prefixes', false, () => {
    closeHeaderMenu();
    onConvert();
  }));
  menu.appendChild(createOption('Clear All Names', 'Blank every label', false, () => {
    closeHeaderMenu();
    onClear();
  }));
  menu.appendChild(createOption('Cancel', 'Keep manual mode', false, () => {
    closeHeaderMenu();
    onCancel();
  }));

  anchorAndShow(menu, thEl);
}
