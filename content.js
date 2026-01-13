/**
 * Better Databricks History - Content Script
 * Replaces history table with interactive Chart.js visualization
 */

// ============================================================================
// EMAIL REPLACEMENT (existing functionality)
// ============================================================================

const EMAIL_TO_NAME = {
  'alex.feng@databricks.com': 'Alex (the goat 🐐) Feng',
  'john.doe@databricks.com': 'John Doe',
  // Add more mappings as needed
};

function replaceEmails() {
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    null,
    false
  );

  const textNodes = [];
  while (walker.nextNode()) {
    textNodes.push(walker.currentNode);
  }

  textNodes.forEach(node => {
    let text = node.textContent;
    for (const [email, name] of Object.entries(EMAIL_TO_NAME)) {
      if (text.includes(email)) {
        text = text.replace(email, name);
      }
    }
    if (text !== node.textContent) {
      node.textContent = text;
    }
  });
}

// ============================================================================
// CHART VISUALIZATION
// ============================================================================

const CHART_CONTAINER_ID = 'bdbh-chart-container';
let chartInstance = null;
let chartJsLoaded = false;
let parsedData = null;

/**
 * Check if we're on a history tab
 */
function isHistoryTab() {
  const url = new URL(window.location.href);
  return url.searchParams.get('activeTab') === 'history';
}

/**
 * Parse a timestamp string like "Dec 18, 2025, 07:48 AM" to Date object
 */
function parseTimestamp(str) {
  if (!str) return null;
  try {
    return new Date(str);
  } catch (e) {
    return null;
  }
}

/**
 * Parse the Operation Metrics JSON from a cell
 * The metrics are stored in span.jvi-value elements within the cell
 * 
 * Structure when expanded:
 * <span class="jvi-item">
 *   <span class="jvi-object-key">
 *     <span class="jvi-value jvi-string">keyName</span>
 *   </span>
 *   <span class="jvi-value jvi-string">value</span>  <- direct child, NOT inside object-key
 * </span>
 */
function parseOperationMetrics(cell, debug = false) {
  const metrics = {};
  
  if (debug) {
    console.log('[Better DB History] Parsing cell HTML:', cell.innerHTML.substring(0, 500));
  }
  
  // Method 1: Find all .jvi-item elements with nested structure
  const items = cell.querySelectorAll('.jvi-item.jvi-nested-first, .jvi-item.jvi-nested-last, .jvi-item:not(.jvi-root)');
  
  if (debug) {
    console.log(`[Better DB History] Found ${items.length} jvi-items`);
  }
  
  items.forEach((item, idx) => {
    // Get the key from .jvi-object-key
    const keyContainer = item.querySelector('.jvi-object-key');
    if (!keyContainer) return;
    
    const keyEl = keyContainer.querySelector('.jvi-value.jvi-string');
    if (!keyEl) return;
    
    const keyText = keyEl.textContent;
    
    // The value is a .jvi-value.jvi-string that is a direct child of item but NOT inside object-key
    // We need to iterate through direct children
    let valueText = null;
    
    for (const child of item.children) {
      if (child.classList.contains('jvi-value') && 
          child.classList.contains('jvi-string') &&
          !child.closest('.jvi-object-key')) {
        valueText = child.textContent;
        break;
      }
    }
    
    if (debug && idx < 3) {
      console.log(`[Better DB History] Item ${idx}: key="${keyText}", value="${valueText}"`);
    }
    
    if (valueText && keyText) {
      const numValue = parseFloat(valueText);
      metrics[keyText] = isNaN(numValue) ? valueText : numValue;
    }
  });
  
  // Method 2: If no metrics found, try a simpler approach - look for all key-value pairs
  if (Object.keys(metrics).length === 0) {
    const allKeys = cell.querySelectorAll('.jvi-object-key .jvi-value.jvi-string');
    
    if (debug) {
      console.log(`[Better DB History] Method 2: Found ${allKeys.length} keys`);
    }
    
    allKeys.forEach(keyEl => {
      const keyText = keyEl.textContent;
      const item = keyEl.closest('.jvi-item');
      if (!item) return;
      
      // Find the value - it's a sibling span with jvi-value jvi-string
      const allSpans = item.querySelectorAll('.jvi-value.jvi-string');
      for (const span of allSpans) {
        // Skip if it's inside object-key (that's the key, not value)
        if (span.closest('.jvi-object-key')) continue;
        
        const valueText = span.textContent;
        const numValue = parseFloat(valueText);
        metrics[keyText] = isNaN(numValue) ? valueText : numValue;
        break;
      }
    });
  }
  
  if (debug) {
    console.log('[Better DB History] Parsed metrics:', metrics);
  }
  
  return metrics;
}

/**
 * Parse all rows from the history table
 * Returns array of { timestamp, version, operation, metrics }
 */
function parseTableData() {
  const table = document.querySelector('div[role="table"]');
  if (!table) {
    console.log('[Better DB History] No table found');
    return null;
  }
  
  const rows = table.querySelectorAll('div[role="row"]:not(.table-isHeader)');
  if (rows.length === 0) {
    console.log('[Better DB History] No data rows found');
    return null;
  }
  
  console.log(`[Better DB History] Found ${rows.length} rows to parse`);
  
  const data = [];
  const allMetricKeys = new Set();
  
  rows.forEach((row, rowIndex) => {
    const cells = row.querySelectorAll('div[role="cell"]');
    
    // The number of cells can vary - let's be more flexible
    if (cells.length < 5) {
      console.log(`[Better DB History] Row ${rowIndex}: Only ${cells.length} cells, skipping`);
      return;
    }
    
    // Column indices based on the table structure:
    // 0: Version, 1: Timestamp, 2: User Id, 3: Username, 4: Operation
    // 5: Operation Parameters, 6: Job, 7: Notebook, 8: Cluster Id
    // 9: Read Version, 10: Isolation Level, 11: Is Blind Append
    // 12: Operation Metrics, 13: User Metadata, 14: Engine Info
    
    const version = cells[0]?.textContent?.trim();
    const timestampStr = cells[1]?.textContent?.trim();
    const operation = cells[4]?.textContent?.trim();
    
    // Operation Metrics is column 12 (0-indexed)
    // But there are multiple JSON columns (Operation Parameters at 5, Operation Metrics at 12)
    // We specifically want Operation Metrics which contains keys like numDeletedFiles, numAddedFiles, etc.
    let metricsCell = null;
    
    // First, try the expected column index (12)
    if (cells[12] && cells[12].querySelector('.jvi-item')) {
      metricsCell = cells[12];
    } else {
      // Fallback: find the LAST cell with .jvi-item (Operation Metrics comes after Operation Parameters)
      // Or find the one with typical metric keys
      for (let i = cells.length - 1; i >= 5; i--) {
        const cell = cells[i];
        if (cell.querySelector('.jvi-item')) {
          // Check if this looks like Operation Metrics (has typical metric key names)
          const text = cell.textContent;
          if (text.includes('numDeleted') || text.includes('numAdded') || 
              text.includes('numRemoved') || text.includes('numFiles') ||
              text.includes('FileSize') || text.includes('Bytes')) {
            metricsCell = cell;
            break;
          }
        }
      }
      // If still not found, try column 12 anyway
      if (!metricsCell && cells[12]) {
        metricsCell = cells[12];
      }
    }
    
    const timestamp = parseTimestamp(timestampStr);
    const shouldDebug = rowIndex === 0;
    const metrics = metricsCell ? parseOperationMetrics(metricsCell, shouldDebug) : {};
    
    if (rowIndex === 0) {
      console.log(`[Better DB History] Row 0 - Version: ${version}, Time: ${timestampStr}, Op: ${operation}`);
      console.log(`[Better DB History] Row 0 - Cell count: ${cells.length}, MetricsCell found: ${!!metricsCell}`);
      if (metricsCell) {
        console.log(`[Better DB History] Row 0 - MetricsCell text preview:`, metricsCell.textContent.substring(0, 200));
      }
    }
    
    // Collect all metric keys
    Object.keys(metrics).forEach(key => allMetricKeys.add(key));
    
    if (timestamp) {
      data.push({
        version,
        timestamp,
        timestampStr,
        operation,
        metrics
      });
    }
  });
  
  // Sort by timestamp ascending (oldest first for chart)
  data.sort((a, b) => a.timestamp - b.timestamp);
  
  return {
    rows: data,
    metricKeys: Array.from(allMetricKeys).sort()
  };
}

/**
 * Check if Chart.js is available (loaded via manifest as content script)
 */
function ensureChartJs() {
  return new Promise((resolve, reject) => {
    // Chart.js is loaded via manifest.json content_scripts, so it should be available
    // In content script context, it's available as `Chart` (not window.Chart)
    if (typeof Chart !== 'undefined') {
      chartJsLoaded = true;
      console.log('[Better DB History] Chart.js is available');
      resolve();
    } else {
      console.error('[Better DB History] Chart.js not found - check manifest.json');
      reject(new Error('Chart.js not loaded'));
    }
  });
}

/**
 * Create the chart container UI
 */
function createChartUI(metricKeys, hasData = true) {
  const container = document.createElement('div');
  container.id = CHART_CONTAINER_ID;
  
  const hasMetrics = metricKeys && metricKeys.length > 0;
  
  container.innerHTML = `
    <div class="bdbh-chart-header">
      <div class="bdbh-chart-title">
        <span class="bdbh-chart-icon">📊</span>
        <span>Operation Metrics Over Time</span>
      </div>
      <div class="bdbh-chart-controls">
        ${hasMetrics ? `
          <label for="bdbh-metric-select">Metric:</label>
          <select id="bdbh-metric-select">
            ${metricKeys.map(key => `<option value="${key}">${formatMetricName(key)}</option>`).join('')}
          </select>
        ` : ''}
        <button id="bdbh-show-table" class="bdbh-chart-btn" title="Show original table">
          <span>📋</span> Table
        </button>
      </div>
    </div>
    <div class="bdbh-chart-body">
      ${hasMetrics && hasData ? '<canvas id="bdbh-metrics-chart"></canvas>' : `
        <div class="bdbh-no-data">
          <div class="bdbh-no-data-icon">📉</div>
          <div>No metrics data found</div>
          <div style="font-size: 12px; opacity: 0.7; margin-top: 4px;">
            The metrics JSON might be collapsed in the table.<br>
            Click "Table" to view the original data.
          </div>
        </div>
      `}
    </div>
    <div class="bdbh-chart-footer">
      <span class="bdbh-chart-hint">${hasMetrics ? 'Hover over points for details' : 'Switch to table view to see raw data'}</span>
    </div>
  `;
  
  return container;
}

/**
 * Format metric key to human-readable name
 */
function formatMetricName(key) {
  // Convert camelCase to Title Case with spaces
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();
}

/**
 * Format large numbers for display
 */
function formatNumber(num) {
  if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
  return num.toString();
}

/**
 * Render the Chart.js chart
 */
function renderChart(selectedMetric) {
  const chartBody = document.querySelector('.bdbh-chart-body');
  if (!chartBody) return;
  
  // Destroy existing chart
  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }
  
  // Check if we have data
  if (!parsedData || !parsedData.rows || parsedData.rows.length === 0) {
    chartBody.innerHTML = `
      <div class="bdbh-no-data">
        <div class="bdbh-no-data-icon">📊</div>
        <div>No data available</div>
        <div style="font-size: 12px; opacity: 0.7;">The table data could not be parsed</div>
      </div>
    `;
    return;
  }
  
  // Check if Chart.js is loaded (it's loaded as content script, available as `Chart`)
  if (typeof Chart === 'undefined') {
    chartBody.innerHTML = `
      <div class="bdbh-no-data">
        <div class="bdbh-no-data-icon">⚠️</div>
        <div>Chart library not loaded</div>
      </div>
    `;
    return;
  }
  
  // Ensure canvas exists
  if (!chartBody.querySelector('canvas')) {
    chartBody.innerHTML = '<canvas id="bdbh-metrics-chart"></canvas>';
  }
  
  const canvas = document.getElementById('bdbh-metrics-chart');
  if (!canvas) return;
  
  // Filter data to only rows that have this metric
  const filteredData = parsedData.rows.filter(row => 
    row.metrics[selectedMetric] !== undefined && 
    typeof row.metrics[selectedMetric] === 'number'
  );
  
  console.log(`[Better DB History] Rendering ${filteredData.length} data points for metric: ${selectedMetric}`);
  
  if (filteredData.length === 0) {
    // Show "no data" message
    chartBody.innerHTML = `
      <div class="bdbh-no-data">
        <div class="bdbh-no-data-icon">📉</div>
        <div>No numeric data for "${formatMetricName(selectedMetric)}"</div>
        <div style="font-size: 12px; opacity: 0.7; margin-top: 4px;">
          The metrics JSON might be collapsed. Try expanding it in the table first.
        </div>
      </div>
    `;
    return;
  }
  
  // Restore canvas if we had shown a message
  if (!chartBody.querySelector('canvas')) {
    chartBody.innerHTML = '<canvas id="bdbh-metrics-chart"></canvas>';
  }
  
  const canvasEl = document.getElementById('bdbh-metrics-chart');
  if (!canvasEl) return;
  
  const labels = filteredData.map(row => row.timestampStr);
  const values = filteredData.map(row => row.metrics[selectedMetric]);
  const operations = filteredData.map(row => row.operation);
  const versions = filteredData.map(row => row.version);
  
  chartInstance = new Chart(canvasEl, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: formatMetricName(selectedMetric),
        data: values,
        borderColor: '#ff6b35',
        backgroundColor: 'rgba(255, 107, 53, 0.1)',
        borderWidth: 2,
        fill: true,
        tension: 0.3,
        pointRadius: 5,
        pointHoverRadius: 8,
        pointBackgroundColor: '#ff6b35',
        pointBorderColor: '#fff',
        pointBorderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        intersect: false,
        mode: 'index'
      },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            color: '#e6edf3',
            font: { size: 12 }
          }
        },
        tooltip: {
          backgroundColor: 'rgba(22, 27, 34, 0.95)',
          titleColor: '#e6edf3',
          bodyColor: '#8b949e',
          borderColor: '#30363d',
          borderWidth: 1,
          padding: 12,
          displayColors: false,
          callbacks: {
            title: function(context) {
              const idx = context[0].dataIndex;
              return `Version ${versions[idx]} - ${operations[idx]}`;
            },
            label: function(context) {
              return `${formatMetricName(selectedMetric)}: ${formatNumber(context.raw)}`;
            },
            afterLabel: function(context) {
              return `Time: ${labels[context.dataIndex]}`;
            }
          }
        }
      },
      scales: {
        x: {
          display: true,
          title: {
            display: true,
            text: 'Timestamp',
            color: '#8b949e'
          },
          ticks: {
            color: '#8b949e',
            maxRotation: 45,
            minRotation: 45,
            font: { size: 10 }
          },
          grid: {
            color: 'rgba(48, 54, 61, 0.5)'
          }
        },
        y: {
          display: true,
          title: {
            display: true,
            text: formatMetricName(selectedMetric),
            color: '#8b949e'
          },
          ticks: {
            color: '#8b949e',
            callback: function(value) {
              return formatNumber(value);
            }
          },
          grid: {
            color: 'rgba(48, 54, 61, 0.5)'
          }
        }
      }
    }
  });
}

/**
 * Store reference to original table for toggle
 */
let originalTable = null;
let tableParent = null;

/**
 * Replace the table with the chart
 */
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
  
  // Parse the table data
  parsedData = parseTableData();
  
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
  
  // Create chart UI (show even if no metrics, so user can toggle back)
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
      renderChart(e.target.value);
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
    renderChart(parsedData.metricKeys[0]);
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

// ============================================================================
// INITIALIZATION
// ============================================================================

// Run email replacement
replaceEmails();

// Watch for dynamic content
let lastUrl = window.location.href;
let chartInitTimeout = null;

const observer = new MutationObserver(() => {
  // Run email replacement
  replaceEmails();
  
  // Check for URL changes
  if (window.location.href !== lastUrl) {
    lastUrl = window.location.href;
    cleanup();
  }
  
  // Try to initialize chart (debounced)
  if (isHistoryTab() && !document.getElementById(CHART_CONTAINER_ID)) {
    clearTimeout(chartInitTimeout);
    chartInitTimeout = setTimeout(() => {
      replaceTableWithChart();
    }, 300); // Short debounce since we check for loading state
  }
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});

// Initial chart setup with retries
if (isHistoryTab()) {
  // Try multiple times as data loads asynchronously
  const tryInit = (attempt = 1) => {
    if (document.getElementById(CHART_CONTAINER_ID)) return; // Already done
    
    replaceTableWithChart();
    
    // If still not initialized after attempt, try again
    if (!document.getElementById(CHART_CONTAINER_ID) && attempt < 10) {
      setTimeout(() => tryInit(attempt + 1), 500 * attempt);
    }
  };
  
  setTimeout(() => tryInit(1), 1000);
}

console.log('[Better DB History] Extension loaded');
