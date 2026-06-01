/*\! © 2026 slashwhat. MIT License. */
// vlan-menu.js — VLAN macro settings popup menu.
// Extracted from header-menus.js to keep files under 300 lines.
// Provides the global VLAN template picker with presets, live preview,
// reference guide, and "Apply to all" functionality.

import { VLAN_PRESETS, computeVlan } from '../core/vlan-macro.js';
import { Subnet } from '../core/subnet.js';
import { closeHeaderMenu, anchorAndShow, createOption, createSectionHeader } from './header-menus.js';

// Build a reference section with token/operator listing and examples.
function createReferenceBlock() {
  const el = document.createElement('div');
  el.className = 'menu-help-text';

  const lines = [
    'Macros compute a VLAN ID from subnet properties.',
    'Evaluation is left-to-right, no precedence.',
    'Result must be an integer between 1 and 4094.',
    '',
    '{o1}  first octet        {mask}  prefix length',
    '{o2}  second octet       {id}    section ID',
    '{o3}  third octet',
    '{o4}  fourth octet',
    '',
    'Digit slicing (octets only):',
    '  {o3 r}   rightmost digit     {o3 l}   leftmost digit',
    '  {o3 rr}  rightmost 2 digits  {o3 ll}  leftmost 2 digits',
    '',
    '100  literal number (any integer)',
    '',
    '*  multiply    +  add    -  subtract',
    'Adjacent tokens with no operator are joined.',
    '',
    '{seq start:step}  auto-increment per row.',
    '  {seq 100:1} \u2192 100, 101, 102, ...',
    '  {seq 200:10} \u2192 200, 210, 220, ...',
    '',
    '10.1.50.0/24, site 5:',
    '  {o3}           \u2192  50',
    '  {o3}1          \u2192  501',
    '  {id}*100+{o3}  \u2192  550',
    '  {o3}+100       \u2192  150',
    '  {o3 l}         \u2192  5',
  ];

  el.textContent = lines.join('\n');
  return el;
}

// Show a dropdown popup for VLAN macro configuration.
// vlanDisplay: { template, presetName }, onApplyAll(), onChange(newSettings).
export function showVlanMenu(thEl, vlanDisplay, onApplyAll, onChange) {
  closeHeaderMenu();

  const menu = document.createElement('div');
  menu.className = 'range-style-menu vlan-menu-wide';

  // Section: Global VLAN Macro input
  menu.appendChild(createSectionHeader('Global VLAN Macro'));
  const inputWrap = document.createElement('div');
  inputWrap.style.padding = '4px 12px';
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'vlan-macro-input';
  input.value = vlanDisplay.template || '';
  input.placeholder = '{o3}';
  input.style.cssText = 'width:100%;font-family:var(--font-mono);font-size:0.8rem;padding:4px 6px;border:1px solid var(--border);border-radius:3px;background:var(--bg-primary);color:var(--text-primary);box-sizing:border-box;';

  // Hint that sections can override the global template.
  const hint = document.createElement('div');
  hint.style.cssText = 'font-size:0.65rem;color:var(--text-muted);padding:2px 0;';
  hint.textContent = 'Can be overridden per section by clicking its VLAN cell.';

  // Live preview using a sample subnet so users see immediate feedback.
  const preview = document.createElement('div');
  preview.style.cssText = 'font-size:0.7rem;color:var(--text-muted);padding:2px 0;min-height:1.2em;';

  // Validate the template and update both the input color and preview text.
  function updatePreview(tpl) {
    if (!tpl) {
      preview.textContent = '';
      input.style.color = 'var(--text-primary)';
      return;
    }
    try {
      const sample = Subnet.parse('10.1.50.0/24');
      const result = computeVlan(tpl, sample, '5', 0);
      if (result.valid) {
        preview.textContent = `Preview: ${result.value}`;
        preview.style.color = 'var(--success)';
        input.style.color = 'var(--success)';
      } else {
        preview.textContent = result.error || 'Invalid';
        preview.style.color = 'var(--error)';
        input.style.color = 'var(--error)';
      }
    } catch {
      preview.textContent = 'Parse error';
      preview.style.color = 'var(--error)';
      input.style.color = 'var(--error)';
    }
  }
  updatePreview(input.value);

  input.addEventListener('input', () => updatePreview(input.value));

  // Apply on Enter; Escape closes without saving.
  const apply = () => {
    onChange({ template: input.value, presetName: '' });
    closeHeaderMenu();
  };
  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') { e.preventDefault(); apply(); }
    if (e.key === 'Escape') closeHeaderMenu();
  });

  inputWrap.appendChild(hint);
  inputWrap.appendChild(input);
  inputWrap.appendChild(preview);
  menu.appendChild(inputWrap);

  // Action buttons between the input and presets.
  if (onApplyAll) {
    const applyAllBtn = document.createElement('div');
    applyAllBtn.className = 'range-style-option vlan-apply-all';
    applyAllBtn.textContent = 'Apply to all sections';
    applyAllBtn.style.cssText = 'text-align:center;color:var(--accent);cursor:pointer;padding:6px 12px;font-size:0.75rem;';
    applyAllBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      onApplyAll();
      closeHeaderMenu();
    });
    menu.appendChild(applyAllBtn);
  }

  menu.appendChild(createOption('Clear', 'Remove global template', !vlanDisplay.template, () => {
    onChange({ template: '', presetName: '' });
    closeHeaderMenu();
  }));

  // Section: Presets — clickable common patterns showing actual macro.
  menu.appendChild(createSectionHeader('Presets'));
  for (const p of VLAN_PRESETS) {
    const isActive = vlanDisplay.template === p.template;
    menu.appendChild(createOption(p.name, p.description, isActive, () => {
      onChange({ template: p.template, presetName: p.name });
      closeHeaderMenu();
    }));
  }

  // Section: Reference — token listing, operators, explanation, examples.
  menu.appendChild(createSectionHeader('Reference'));
  menu.appendChild(createReferenceBlock());

  anchorAndShow(menu, thEl);

  // Focus the input after menu is positioned.
  requestAnimationFrame(() => input.focus());
}
