/*\! © 2026 slashwhat. MIT License. */
// column-controls.js — Hover-revealed column controls.
// Wires click handlers for reorder arrows, hide/restore buttons, and
// the "settings" label that opens format menus. Replaces the old
// drag-and-drop system with simple click-based interactions.

// Reorder visible columns without affecting hidden ones. Mutates colOrder by reference.
function swapColumn(col, direction, colOrder, visibleCols) {
  const visCols = colOrder.filter(k => visibleCols.has(k) && k !== 'join');
  const visIdx = visCols.indexOf(col);
  const isLeft = direction === 'left';

  if (isLeft && visIdx <= 0) return false;
  if (!isLeft && visIdx >= visCols.length - 1) return false;

  const swapWith = isLeft ? visCols[visIdx - 1] : visCols[visIdx + 1];
  const aIdx = colOrder.indexOf(col);
  const bIdx = colOrder.indexOf(swapWith);
  [colOrder[aIdx], colOrder[bIdx]] = [colOrder[bIdx], colOrder[aIdx]];
  return true;
}

// Attach all column control handlers to the current <thead>.
// Called after every renderTable() on the fresh DOM. Mutates colOrder
// and visibleCols by reference (same pattern as the old drag system).
export function attachColumnControls(tableEl, colOrder, visibleCols, onChange, menuCallbacks) {
  const thead = tableEl.querySelector('thead');
  if (!thead) return;

  // Reorder arrows — move column one position left or right
  for (const btn of thead.querySelectorAll('.col-arrow')) {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const col = btn.dataset.col;
      const dir = btn.classList.contains('col-arrow-left') ? 'left' : 'right';
      if (swapColumn(col, dir, colOrder, visibleCols)) onChange();
    });
  }

  // Hide buttons — remove column from visible set
  for (const btn of thead.querySelectorAll('.col-hide-btn')) {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const col = btn.dataset.col;
      if (col && col !== 'join') {
        visibleCols.delete(col);
        onChange();
      }
    });
  }

  // Restore buttons — insert column at the position the down-arrow
  // points to by finding which visible column header is closest
  // horizontally and splicing into colOrder just before it.
  for (const btn of thead.querySelectorAll('.col-restore-btn')) {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const col = btn.dataset.col;
      if (!col) return;

      const btnCenter = btn.getBoundingClientRect().left + btn.getBoundingClientRect().width / 2;
      const ths = [...thead.querySelectorAll('.col-labels-row th[data-col]')];
      let insertBeforeCol = null;
      for (const th of ths) {
        const thCenter = th.getBoundingClientRect().left + th.getBoundingClientRect().width / 2;
        if (thCenter >= btnCenter) { insertBeforeCol = th.dataset.col; break; }
      }

      // Remove from current colOrder position, then re-insert
      const curIdx = colOrder.indexOf(col);
      if (curIdx !== -1) colOrder.splice(curIdx, 1);

      if (insertBeforeCol) {
        const targetIdx = colOrder.indexOf(insertBeforeCol);
        colOrder.splice(targetIdx, 0, col);
      } else {
        // Arrow is past all columns — append before 'join'
        const joinIdx = colOrder.indexOf('join');
        colOrder.splice(joinIdx === -1 ? colOrder.length : joinIdx, 0, col);
      }

      visibleCols.add(col);
      onChange();
    });
  }

  // Reset button — confirm then restore default column order/visibility
  const resetBtn = thead.querySelector('.col-reset-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!confirm('Reset columns to default layout?')) return;
      if (menuCallbacks?.onResetLayout) menuCallbacks.onResetLayout();
    });
  }

  // Settings labels — delegate to caller for menu display
  for (const label of thead.querySelectorAll('.col-settings-label')) {
    label.addEventListener('click', (e) => {
      e.stopPropagation();
      const th = label.closest('th');
      const col = th.dataset.col;
      if (menuCallbacks?.onSettingsClick) {
        menuCallbacks.onSettingsClick(th, col);
      }
    });
  }
}
