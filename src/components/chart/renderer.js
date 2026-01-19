/**
 * Better Databricks History - Chart Renderer
 * Creates and renders the Chart.js visualization
 */

// Use var for cross-file accessibility in content scripts
var CHART_CONTAINER_ID = 'bdbh-chart-container';
var chartInstance = null;

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
 * Render the Chart.js chart
 * @param {string} selectedMetric - The metric key to display
 * @param {Object} parsedData - The parsed table data from parser.js
 */
function renderChart(selectedMetric, parsedData) {
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
  
  // Get min/max timestamps from ALL rows (not just filtered) for consistent X-axis
  const allTimestamps = parsedData.rows.map(row => row.timestamp.getTime());
  const minTime = Math.min(...allTimestamps);
  const maxTime = Math.max(...allTimestamps);
  
  // Create data points with x (timestamp) and y (value)
  const dataPoints = filteredData.map(row => ({
    x: row.timestamp,
    y: row.metrics[selectedMetric],
    version: row.version,
    operation: row.operation,
    timestampStr: row.timestampStr
  }));
  
  chartInstance = new Chart(canvasEl, {
    type: 'line',
    data: {
      datasets: [{
        label: formatMetricName(selectedMetric),
        data: dataPoints,
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
              const point = context[0].raw;
              return `Version ${point.version} - ${point.operation}`;
            },
            label: function(context) {
              return `${formatMetricName(selectedMetric)}: ${formatNumber(context.raw.y)}`;
            },
            afterLabel: function(context) {
              return `Time: ${context.raw.timestampStr}`;
            }
          }
        }
      },
      scales: {
        x: {
          type: 'time',
          min: minTime,
          max: maxTime,
          display: true,
          title: {
            display: true,
            text: 'Timestamp',
            color: '#8b949e'
          },
          time: {
            displayFormats: {
              hour: 'MMM d, h a',
              day: 'MMM d',
              week: 'MMM d',
              month: 'MMM yyyy'
            }
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
 * Check if Chart.js is available (loaded via manifest as content script)
 */
function ensureChartJs() {
  return new Promise((resolve, reject) => {
    // Chart.js is loaded via manifest.json content_scripts, so it should be available
    // In content script context, it's available as `Chart` (not window.Chart)
    if (typeof Chart !== 'undefined') {
      console.log('[Better DB History] Chart.js is available');
      resolve();
    } else {
      console.error('[Better DB History] Chart.js not found - check manifest.json');
      reject(new Error('Chart.js not loaded'));
    }
  });
}
