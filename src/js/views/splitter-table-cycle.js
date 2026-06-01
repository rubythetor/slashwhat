/*\! © 2026 slashwhat. MIT License. */
// splitter-table-cycle.js — Full table render cycle for splitter view.
// Centralizes DOM rebuild + input/hero restoration so the main orchestrator
// can focus on state transitions and app-level wiring.

import { getLeaves } from '../core/splitter.js';
import { computeAllOverlaps } from '../core/forest.js';
import { getThemeColors } from '../core/color-themes.js';
import { getTheme } from '../ui/theme.js';
import { computeJoinBars, renderInputRow, renderTableHeader, renderEmptyState } from './table-render.js';
import { renderTreeHeader, renderTreeDataRows } from './tree-rows.js';
import { attachInputRowHandlers } from './table-events.js';
import { wireHeroInput } from './hero-animation.js';
import { renderBelowTableControls } from './color-controls.js';

// Rebuild the splitter table from current forest entries.
// Handles the empty-hero fade path and then applies shared post-render wiring.
export function renderSplitterTable({
  tableContainer,
  getEntries,
  getDisplaySettings,
  colOrder,
  visibleCols,
  cellPad,
  rowFontSize,
  hdrFontSize,
  heroState,
  onSubnetSubmit,
  onAfterRender,
}) {
  const entries = getEntries();

  // Cancel pending hero fade renders so rapid updates don't apply stale state.
  if (heroState.fadeTimer) {
    clearTimeout(heroState.fadeTimer);
    heroState.fadeTimer = null;
  }

  // Fade the hero before first real table render so the transition is visible.
  const existingHero = tableContainer.querySelector('.empty-hero');
  if (existingHero && entries.length > 0) {
    heroState.dismissed = true;
    existingHero.classList.add('empty-hero--fading');
    if (!heroState.heroFadeMs) {
      heroState.heroFadeMs = parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue('--hero-fade-duration')
      ) || 300;
    }
    heroState.fadeTimer = setTimeout(() => {
      heroState.fadeTimer = null;
      doRender(entries);
    }, heroState.heroFadeMs);
    return;
  }

  doRender(entries);

  // Shared render body for immediate and delayed (hero fade) paths.
  function doRender(currentEntries) {
    const ds = getDisplaySettings();
    const themeColors = getThemeColors(ds.colorConfig.theme);
    const root = document.documentElement;
    root.style.setProperty('--orb-c1', themeColors[0]);
    root.style.setProperty('--orb-c2', themeColors[2]);

    let maxBarDepth = 0;
    for (const entry of currentEntries) {
      if (entry.collapsed) continue;
      const leaves = getLeaves(entry.tree);
      const { maxDepth } = computeJoinBars(entry.tree, leaves);
      if (maxDepth > maxBarDepth) maxBarDepth = maxDepth;
    }
    const globalMaxDepth = maxBarDepth + 1;

    // Preserve input values/focus because full-table rerenders replace nodes.
    const existingInput = tableContainer.querySelector('.forest-input');
    const existingSid = tableContainer.querySelector('.forest-input-sid');
    const existingName = tableContainer.querySelector('.forest-input-name');
    const savedInputValue = existingInput ? existingInput.value : '';
    const savedSidValue = existingSid ? existingSid.value : '';
    const savedNameValue = existingName ? existingName.value : '';
    const focusedClass = document.activeElement?.classList;
    const savedFocusTarget = focusedClass?.contains('forest-input') ? 'subnet'
      : focusedClass?.contains('forest-input-sid') ? 'sid'
      : focusedClass?.contains('forest-input-name') ? 'name' : null;

    let html = `<table class="splitter-table" aria-label="Subnet split results" style="--cell-pad-v:${cellPad.value}px;--cell-pad-h:${cellPad.value}px;--row-font-size:${rowFontSize.value}rem;--header-font-size:${hdrFontSize.value}rem">`;
    const isDarkTheme = getTheme() === 'dark';

    html += renderTableHeader(colOrder, visibleCols, globalMaxDepth, ds.colorConfig, ds.showTooltips);

    // Overlap detection is O(n^2), so skip it when warnings are disabled.
    const warnings = ds.showWarnings
      ? { overlappingIds: computeAllOverlaps(currentEntries), entries: currentEntries, showTooltips: ds.showTooltips }
      : null;

    html += '<tbody>';
    html += renderInputRow(colOrder, visibleCols, globalMaxDepth);
    currentEntries.forEach((entry, idx) => {
      html += renderTreeHeader(
        entry,
        colOrder,
        visibleCols,
        globalMaxDepth,
        idx === 0,
        idx === currentEntries.length - 1,
        ds,
        warnings
      );
      if (!entry.collapsed) {
        const { html: rowsHtml } = renderTreeDataRows(entry, globalMaxDepth, colOrder, visibleCols, ds, isDarkTheme);
        html += rowsHtml;
      }
    });
    html += '</tbody></table>';

    if (currentEntries.length > 0) {
      html += renderBelowTableControls(ds.colorConfig, ds.showTooltips, ds.showWarnings);
    }
    if (currentEntries.length === 0 && !heroState.dismissed) {
      html += renderEmptyState();
    }

    tableContainer.innerHTML = html;

    const inputRow = tableContainer.querySelector('.forest-input-row');
    const newInput = tableContainer.querySelector('.forest-input');
    const newSid = tableContainer.querySelector('.forest-input-sid');
    const newName = tableContainer.querySelector('.forest-input-name');
    if (inputRow) {
      if (newInput) newInput.value = savedInputValue;
      if (newSid) newSid.value = savedSidValue;
      if (newName) newName.value = savedNameValue;
      attachInputRowHandlers(inputRow, onSubnetSubmit);
      if (savedInputValue && newInput) newInput.dispatchEvent(new Event('input'));
      const focusMap = { subnet: newInput, sid: newSid, name: newName };
      const restoreEl = focusMap[savedFocusTarget];
      if (restoreEl) {
        restoreEl.focus();
        restoreEl.setSelectionRange(restoreEl.value.length, restoreEl.value.length);
      }
    }

    const heroInput = tableContainer.querySelector('.hero-input');
    if (heroInput) {
      const dismissHero = wireHeroInput(heroInput, onSubnetSubmit);
      if (inputRow) {
        inputRow.querySelectorAll('input').forEach(el => {
          el.addEventListener('focus', () => {
            dismissHero();
            heroState.dismissed = true;
            if (!heroState.heroFadeMs) {
              heroState.heroFadeMs = parseFloat(
                getComputedStyle(document.documentElement).getPropertyValue('--hero-fade-duration')
              ) || 300;
            }
            const hero = tableContainer.querySelector('.empty-hero');
            if (hero) setTimeout(() => hero.remove(), heroState.heroFadeMs);
          }, { once: true });
        });
      }
    }

    onAfterRender(currentEntries, ds);
  }
}
