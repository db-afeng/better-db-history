/**
 * Better Databricks History - Content Script Entry Point
 * Initializes the extension and sets up observers for dynamic content
 * 
 * Dependencies (loaded via manifest.json before this file):
 * - lib/chart.min.js
 * - lib/chartjs-adapter-date-fns.min.js
 * - src/components/chart/parser.js
 * - src/components/chart/renderer.js
 * - src/injection/table-replacer.js
 */

// ============================================================================
// INITIALIZATION
// ============================================================================

// Watch for dynamic content
let lastUrl = window.location.href;
let chartInitTimeout = null;

const observer = new MutationObserver(() => {
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
