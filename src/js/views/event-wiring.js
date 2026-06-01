/*! © 2026 slashwhat. MIT License. */
// event-wiring.js — Attaches all event handlers after each table rebuild.
// Extracted from splitter-view.js to keep the orchestrator under 300 lines.
// Each handler group is wired with minimal coupling: the ctx object carries
// references to shared state and callbacks so this module never imports
// app-level singletons.

import { getEntries, findNodeAcrossForest } from '../core/forest.js';
import { COLUMN_DEFS } from './table-render.js';
import { attachDivideHandlers, attachJoinHandlers, attachNameEditHandlers, attachSeparatorEditHandlers, attachDescriptionEditHandlers, attachNotesEditHandlers, attachTreeHeaderHandlers, attachInputRowHandlers } from './table-events.js';
import { attachHeaderNameEditHandlers, attachHeaderDescEditHandlers, attachHeaderNotesEditHandlers, attachHeaderSectionIdEditHandlers, attachHeaderVlanEditHandlers } from './header-edit.js';
import { attachColumnControls } from './column-controls.js';
import { showRangeStyleMenu, showNumberFormatMenu, showNotesFormatMenu, showNameFormatMenu, showNameConvertMenu } from './header-menus.js';
import { convertManualToAutomatic, convertAutomaticToManual, clearAllNames } from '../core/naming.js';
import { showVlanMenu } from './vlan-menu.js';
import { serializeForest } from '../core/config.js';
import { autoSave } from './config-io.js';
import { attachFontSizeHandlers, attachPaddingHandlers, attachColorControlHandlers, attachBucketHandlers, showManualColorPicker } from './color-controls.js';

// Wire all event handlers to the rebuilt DOM after innerHTML replacement.
// ctx carries shared state and callbacks from the orchestrator so this
// module stays decoupled from app-level singletons.
export function wireEventHandlers(tableContainer, entries, ds, ctx) {
  const { renderTable, colOrder, visibleCols, colorConfig, vlanDisplay,
    cellPad, PAD_OPTS, rowFontSize, ROW_FONT_OPTS, hdrFontSize, HDR_FONT_OPTS,
    undoMgr, skipUndoCapture, setColorConfig, setVlanDisplay } = ctx;

  const getNode = (id) => findNodeAcrossForest(id);

  const autoLabel = ds.nameDisplay.mode === 'automatic';
  attachDivideHandlers(tableContainer, getNode, renderTable, autoLabel);
  attachJoinHandlers(tableContainer, getNode, renderTable);
  attachNameEditHandlers(tableContainer, getNode, renderTable);
  attachSeparatorEditHandlers(tableContainer, getNode, renderTable);
  attachDescriptionEditHandlers(tableContainer, getNode, renderTable);
  attachNotesEditHandlers(tableContainer, getNode, renderTable);

  const getEntry = (fid) => getEntries().find(e => e.id === fid);
  attachHeaderSectionIdEditHandlers(tableContainer, getEntry, renderTable);
  attachHeaderNameEditHandlers(tableContainer, getEntry, renderTable);
  attachHeaderDescEditHandlers(tableContainer, getEntry, renderTable);
  attachHeaderNotesEditHandlers(tableContainer, getEntry, renderTable);

  // Wire VLAN tree header click-to-edit for per-section template override.
  attachHeaderVlanEditHandlers(tableContainer, getEntry, vlanDisplay.template, renderTable);

  attachTreeHeaderHandlers(tableContainer, {
    onCollapse: (forestId) => { ctx.toggleCollapse(forestId); renderTable(); },
    onDelete: (forestId) => {
      if (!confirm('Delete this section and all its subnets?')) return;
      ctx.removeTree(forestId); renderTable();
    },
    onMoveUp: (forestId) => { ctx.moveTree(forestId, -1); renderTable(); },
    onMoveDown: (forestId) => { ctx.moveTree(forestId, 1); renderTable(); },
  });

  // Wire column controls: reorder arrows, hide/restore, settings labels
  wireColumnSettings(tableContainer, colOrder, visibleCols, renderTable, ctx);

  // Wire padding, font size, and color controls below the table
  attachFontSizeHandlers(tableContainer, '.hdr-font', hdrFontSize, HDR_FONT_OPTS, renderTable);
  attachFontSizeHandlers(tableContainer, '.row-font', rowFontSize, ROW_FONT_OPTS, renderTable);
  attachPaddingHandlers(tableContainer, cellPad, PAD_OPTS, renderTable);

  // Wire tooltip toggle: click to flip on/off.
  const tooltipLabel = tableContainer.querySelector('.tooltip-toggle-label');
  if (tooltipLabel) {
    tooltipLabel.style.cursor = 'pointer';
    tooltipLabel.addEventListener('click', () => {
      ctx.setShowTooltips(!ctx.showTooltips);
      renderTable();
    });
  }

  // Wire warnings toggle: click to flip on/off.
  const warningsLabel = tableContainer.querySelector('.warnings-toggle-label');
  if (warningsLabel) {
    warningsLabel.style.cursor = 'pointer';
    warningsLabel.addEventListener('click', () => {
      ctx.setShowWarnings(!ctx.showWarnings);
      renderTable();
    });
  }

  // Wire color controls: mode picker, theme picker, alt color pickers
  const belowControls = tableContainer.querySelector('.table-below-controls');
  if (belowControls) {
    attachColorControlHandlers(belowControls, colorConfig, (updated) => {
      setColorConfig(updated);
      renderTable();
    });
  }

  // Wire paint bucket clicks (manual color mode). Delegated on tableContainer
  // because buckets live inside the table body, not the below-table strip.
  attachBucketHandlers(tableContainer, (bucket, nodeId) => {
    const node = findNodeAcrossForest(parseInt(nodeId));
    if (!node) return;
    showManualColorPicker(bucket, nodeId, colorConfig, node.color || null, (id, color) => {
      const n = findNodeAcrossForest(parseInt(id));
      if (n) { n.color = color; renderTable(); }
    });
  });

  // Capture state for undo before persisting to localStorage.
  if (!skipUndoCapture()) {
    undoMgr.push(JSON.stringify(
      serializeForest(entries, colOrder, [...visibleCols], ds)
    ));
  }

  autoSave(entries, colOrder, [...visibleCols], ds);
}

// Wire column controls with settings popups for range, number, notes,
// name, and VLAN columns. Separated to keep wireEventHandlers readable.
function wireColumnSettings(tableContainer, colOrder, visibleCols, renderTable, ctx) {
  const tableEl = tableContainer.querySelector('.splitter-table');
  attachColumnControls(tableEl, colOrder, visibleCols, renderTable, {
    onSettingsClick: (thEl, col) => {
      if (col === 'range' || col === 'usable') {
        showRangeStyleMenu(thEl, col, ctx.rangeDisplay[col], (updated) => {
          ctx.rangeDisplay[col] = updated;
          renderTable();
        });
      } else if (col === 'ips' || col === 'hosts') {
        showNumberFormatMenu(thEl, col, ctx.numberDisplay[col], (fmt) => {
          ctx.numberDisplay[col] = fmt;
          renderTable();
        });
      } else if (col === 'notes') {
        showNotesFormatMenu(thEl, ctx.notesDisplay, (updated) => {
          ctx.setNotesDisplay(updated);
          renderTable();
        });
      } else if (col === 'name') {
        const hasLabels = getEntries().some(e => {
          const check = (n) => (n.label ?? '') !== '' || (n.children && (check(n.children[0]) || check(n.children[1])));
          return check(e.tree);
        });
        const needsConvert = ctx.nameDisplay.mode === 'manual' && hasLabels;
        showNameFormatMenu(thEl, ctx.nameDisplay, (updated) => {
          // Flatten hierarchical names into leaf labels when leaving automatic mode
          if (ctx.nameDisplay.mode === 'automatic' && updated.mode === 'manual' && hasLabels) {
            convertAutomaticToManual(getEntries());
          }
          ctx.setNameDisplay(updated);
          renderTable();
        }, needsConvert ? (anchorEl) => {
          showNameConvertMenu(anchorEl,
            () => { convertManualToAutomatic(getEntries()); ctx.setNameDisplay({ ...ctx.nameDisplay, mode: 'automatic' }); renderTable(); },
            () => { clearAllNames(getEntries()); ctx.setNameDisplay({ ...ctx.nameDisplay, mode: 'automatic' }); renderTable(); },
            () => {},
          );
        } : undefined);
      } else if (col === 'vlan') {
        showVlanMenu(thEl, ctx.vlanDisplay,
          () => { getEntries().forEach(e => { e.vlanTemplate = ''; }); renderTable(); },
          (updated) => { ctx.setVlanDisplay(updated); renderTable(); },
        );
      }
    },
    onResetLayout: () => {
      colOrder.length = 0;
      COLUMN_DEFS.map(c => c.key).forEach(k => colOrder.push(k));
      visibleCols.clear();
      COLUMN_DEFS.filter(c => c.defaultOn).forEach(c => visibleCols.add(c.key));
      // Resetting columns returns to simple mode as the default experience.
      if (ctx.resetToSimpleMode) ctx.resetToSimpleMode();
      renderTable();
    },
  });
}
