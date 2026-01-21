/**
 * Better Databricks History - Table Replacer
 * Handles DOM substitution - finding the history table and replacing it with visualization
 */

// State for table/chart toggle (use var for cross-file accessibility)
var originalTable = null;
var tableParent = null;
var parsedData = null;

/**
 * Check if we're on a history tab
 */
function isHistoryTab() {
  const url = new URL(window.location.href);
  return url.searchParams.get('activeTab') === 'history';
}

/**
 * Check if the table data has finished loading (not showing skeletons)
 */
function isTableDataLoaded() {
  const table = document.querySelector('div[role="table"]');
  if (!table) return false;
  
  // Check for loading skeletons - they have aria-busy="true"
  const loadingElements = table.querySelectorAll('[aria-busy="true"]');
  if (loadingElements.length > 0) {
    return false;
  }
  
  // Check that we have actual data rows with content
  const rows = table.querySelectorAll('div[role="row"]:not(.table-isHeader)');
  if (rows.length === 0) return false;
  
  // Check that the first row has actual text content (not just loading)
  const firstRow = rows[0];
  const firstCell = firstRow.querySelector('div[role="cell"]');
  if (!firstCell) return false;
  
  const cellText = firstCell.textContent.trim();
  // If cell is empty or contains loading skeleton classes, data not ready
  if (!cellText || cellText.length === 0) return false;
  
  return true;
}

/**
 * Replace the table with the chart visualization
 */
async function replaceTableWithChart() {
  // Only run on history tab
  if (!isHistoryTab()) return;
  
  // Check if already replaced
  if (document.getElementById(CHART_CONTAINER_ID)) return;
  
  const table = document.querySelector('div[role="table"]');
  if (!table) return;
  
  // Wait for data to load (not just the table structure)
  if (!isTableDataLoaded()) {
    console.log('[Better DB History] Table found but data still loading, waiting...');
    return; // Will retry via MutationObserver
  }
  
  console.log('[Better DB History] Table data loaded, parsing...');
  
  // Parse the table data (from parser.js) - async to allow JSON expansion
  parsedData = await parseTableData();
  
  const hasRows = parsedData && parsedData.rows && parsedData.rows.length > 0;
  const hasMetrics = parsedData && parsedData.metricKeys && parsedData.metricKeys.length > 0;
  
  console.log(`[Better DB History] Parsed ${hasRows ? parsedData.rows.length : 0} rows with ${hasMetrics ? parsedData.metricKeys.length : 0} metric types`);
  
  // Verify Chart.js is loaded (only if we have metrics to show)
  if (hasMetrics) {
    try {
      await ensureChartJs();
    } catch (e) {
      console.error('[Better DB History] Chart.js not available:', e);
    }
  }
  
  // Store original table reference
  originalTable = table;
  tableParent = table.parentNode;
  
  // Create chart UI (from renderer.js - show even if no metrics, so user can toggle back)
  const chartContainer = createChartUI(hasMetrics ? parsedData.metricKeys : [], hasRows);
  
  // Find the history panel to insert chart into (e.g., #rc-tabs-0-panel-history)
  // The ID might be dynamic, so we look for a panel with ID ending in -panel-history
  const historyPanel = document.querySelector('[id$="-panel-history"]') || tableParent;
  
  // Hide the scrollable table container and insert chart at the panel level
  table.style.display = 'none';
  if (tableParent !== historyPanel) {
    tableParent.style.display = 'none'; // Hide the scrollable wrapper too
  }
  historyPanel.insertBefore(chartContainer, historyPanel.firstChild);
  
  // Set up event listeners
  const metricSelect = document.getElementById('bdbh-metric-select');
  if (metricSelect) {
    metricSelect.addEventListener('change', (e) => {
      renderChart(e.target.value, parsedData);
    });
  }
  
  const showTableBtn = document.getElementById('bdbh-show-table');
  if (showTableBtn) {
    showTableBtn.addEventListener('click', () => {
      toggleView();
    });
  }
  
  // Render initial chart with first metric (only if we have metrics)
  if (hasMetrics && parsedData.metricKeys.length > 0) {
    renderChart(parsedData.metricKeys[0], parsedData);
  }
  
  console.log('[Better DB History] Chart visualization active');
}

/**
 * Toggle between chart and table view
 */
function toggleView() {
  const chartContainer = document.getElementById(CHART_CONTAINER_ID);
  const showTableBtn = document.getElementById('bdbh-show-table');
  
  if (!chartContainer || !originalTable) return;
  
  const isShowingChart = chartContainer.style.display !== 'none';
  
  if (isShowingChart) {
    // Show table, hide chart
    originalTable.style.display = '';
    if (tableParent) tableParent.style.display = '';
    chartContainer.style.display = 'none';
    showTableBtn.innerHTML = '<span>📊</span> Chart';
  } else {
    // Show chart, hide table
    originalTable.style.display = 'none';
    if (tableParent) tableParent.style.display = 'none';
    chartContainer.style.display = '';
    showTableBtn.innerHTML = '<span>📋</span> Table';
  }
}

/**
 * Clean up when navigating away
 */
function cleanup() {
  const chartContainer = document.getElementById(CHART_CONTAINER_ID);
  if (chartContainer) {
    chartContainer.remove();
  }
  if (originalTable) {
    originalTable.style.display = '';
  }
  if (tableParent) {
    tableParent.style.display = '';
  }
  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }
  parsedData = null;
  originalTable = null;
  tableParent = null;
}
