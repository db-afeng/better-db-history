/**
 * Better Databricks History - Chart Data Parser
 * Parses the history table DOM to extract structured data
 */

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
 * Expand collapsed JSON viewers in a cell
 * Databricks uses a JSON viewer that collapses data by default
 * We need to click to expand it before we can parse the values
 */
async function expandJsonInCell(cell) {
  // Look for collapsed JSON indicators - the clickable toggle or collapsed root
  const collapsedRoots = cell.querySelectorAll('.jvi-root.jvi-object');
  const toggles = cell.querySelectorAll('.jvi-toggle, .jvi-collapser');
  
  let expanded = false;
  
  // Try clicking on toggle elements first
  for (const toggle of toggles) {
    // Check if this is a "collapsed" state toggle
    const parent = toggle.closest('.jvi-root, .jvi-item');
    if (parent && parent.classList.contains('jvi-collapsed')) {
      toggle.click();
      expanded = true;
    }
  }
  
  // If no toggles found, try clicking on the collapsed root element itself
  if (!expanded) {
    for (const root of collapsedRoots) {
      // Check if it's collapsed (doesn't have expanded child items visible)
      const hasExpandedItems = root.querySelector('.jvi-item:not(.jvi-collapsed)');
      if (!hasExpandedItems) {
        // Try to find and click the expand control
        const expandControl = root.querySelector('.jvi-toggle, .jvi-collapser, [role="button"]');
        if (expandControl) {
          expandControl.click();
          expanded = true;
        }
      }
    }
  }
  
  // Wait briefly for DOM to update after expansion
  if (expanded) {
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  
  return expanded;
}

/**
 * Try to parse JSON from the cell's text content
 * This handles cases where the JSON viewer is collapsed but the raw JSON is visible as text
 */
function parseJsonFromText(text) {
  if (!text) return null;
  
  // Try to find JSON object pattern in the text
  // The text might look like: {"numDeletedFiles": "268","numVacuumedDirectories": "1"}
  // Or it might have extra whitespace/formatting
  
  // First, try direct parse
  try {
    const parsed = JSON.parse(text.trim());
    if (typeof parsed === 'object' && parsed !== null) {
      return parsed;
    }
  } catch (e) {
    // Not valid JSON, try to extract it
  }
  
  // Try to find a JSON object in the text using regex
  const jsonMatch = text.match(/\{[^{}]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (typeof parsed === 'object' && parsed !== null) {
        return parsed;
      }
    } catch (e) {
      // Still not valid
    }
  }
  
  return null;
}

/**
 * Parse the Operation Metrics JSON from a cell
 * Tries multiple methods:
 * 1. Parse from jvi-item DOM elements (expanded JSON viewer)
 * 2. Parse from raw text content (collapsed JSON or plain text)
 */
async function parseOperationMetrics(cell, debug = false) {
  let metrics = {};
  
  // First, try to expand any collapsed JSON
  await expandJsonInCell(cell);
  
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
  
  // Method 2: If no metrics found via DOM, try parsing the text content directly as JSON
  if (Object.keys(metrics).length === 0) {
    const cellText = cell.textContent;
    
    if (debug) {
      console.log(`[Better DB History] Method 2: Trying to parse text as JSON: ${cellText.substring(0, 100)}`);
    }
    
    const parsed = parseJsonFromText(cellText);
    if (parsed) {
      // Convert parsed values to numbers where possible
      for (const [key, value] of Object.entries(parsed)) {
        const numValue = parseFloat(value);
        metrics[key] = isNaN(numValue) ? value : numValue;
      }
      
      if (debug) {
        console.log(`[Better DB History] Method 2: Parsed ${Object.keys(metrics).length} keys from text`);
      }
    }
  }
  
  // Method 3: If still no metrics, try looking for jvi-value elements more broadly
  if (Object.keys(metrics).length === 0) {
    const allKeys = cell.querySelectorAll('.jvi-object-key .jvi-value.jvi-string');
    
    if (debug) {
      console.log(`[Better DB History] Method 3: Found ${allKeys.length} keys`);
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
 * Find the metrics cell for a given row
 * Looks for the Operation Metrics column by checking for data-testid="jvi-toggle-operationMetrics-X"
 * This is a scalable approach that doesn't rely on hardcoded metric names
 */
function findMetricsCell(cells) {
  // Search all cells for one with the operationMetrics data-testid
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    const toggle = cell.querySelector('[data-testid*="operationMetrics"]');
    if (toggle) {
      return cell;
    }
  }
  
  // Fallback: try column 12 (typical position) if it has JSON structure
  if (cells[12] && cells[12].querySelector('.jvi-root')) {
    return cells[12];
  }
  
  // Last fallback: find any cell with JSON viewer structure (but not operationParameters)
  for (let i = cells.length - 1; i >= 5; i--) {
    const cell = cells[i];
    // Skip if this is operationParameters
    if (cell.querySelector('[data-testid*="operationParameters"]')) {
      continue;
    }
    // Check if it has JSON structure
    if (cell.querySelector('.jvi-root .jvi-object-key')) {
      return cell;
    }
  }
  
  return null;
}

/**
 * Find the scrollable container for the table
 * This is needed to scroll through all rows to force virtualized content to render
 */
function findScrollableContainer(table) {
  // Look for common scrollable container patterns
  let element = table.parentElement;
  while (element) {
    const style = window.getComputedStyle(element);
    if (style.overflow === 'auto' || style.overflow === 'scroll' ||
        style.overflowY === 'auto' || style.overflowY === 'scroll') {
      return element;
    }
    element = element.parentElement;
  }
  // Fallback: try common Databricks container classes
  return document.querySelector('.databricks-dataexplorer-table-container') || 
         document.querySelector('[class*="table-container"]') ||
         table.parentElement;
}

/**
 * Scroll through the table to force all virtualized rows to render
 * This ensures we can parse metrics from all rows, not just visible ones
 */
async function scrollToLoadAllRows(table) {
  const container = findScrollableContainer(table);
  if (!container) {
    console.log('[Better DB History] No scrollable container found');
    return;
  }
  
  console.log('[Better DB History] Scrolling to load all rows...');
  
  const originalScrollTop = container.scrollTop;
  const scrollHeight = container.scrollHeight;
  const clientHeight = container.clientHeight;
  
  // If content is not scrollable, nothing to do
  if (scrollHeight <= clientHeight) {
    console.log('[Better DB History] Table is not scrollable, all rows should be visible');
    return;
  }
  
  // Scroll through the table in steps to trigger virtualized row rendering
  const scrollStep = clientHeight * 0.8; // Scroll 80% of viewport at a time
  let currentScroll = 0;
  
  while (currentScroll < scrollHeight) {
    container.scrollTop = currentScroll;
    // Wait for content to render
    await new Promise(resolve => setTimeout(resolve, 100));
    currentScroll += scrollStep;
  }
  
  // Scroll to bottom to ensure last rows are rendered
  container.scrollTop = scrollHeight;
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Scroll back to top
  container.scrollTop = originalScrollTop;
  await new Promise(resolve => setTimeout(resolve, 100));
  
  console.log('[Better DB History] Finished scrolling to load all rows');
}

/**
 * Parse all rows from the history table
 * Returns array of { timestamp, version, operation, metrics }
 */
async function parseTableData() {
  const table = document.querySelector('div[role="table"]');
  if (!table) {
    console.log('[Better DB History] No table found');
    return null;
  }
  
  // First, scroll through the table to ensure all virtualized rows are rendered
  await scrollToLoadAllRows(table);
  
  const rows = table.querySelectorAll('div[role="row"]:not(.table-isHeader)');
  if (rows.length === 0) {
    console.log('[Better DB History] No data rows found');
    return null;
  }
  
  console.log(`[Better DB History] Found ${rows.length} rows to parse`);
  
  const data = [];
  const allMetricKeys = new Set();
  let rowsWithMetrics = 0;
  let rowsWithoutMetricsCell = 0;
  let rowsWithEmptyMetrics = 0;
  
  // Process rows sequentially to avoid overwhelming the DOM
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];
    const cells = row.querySelectorAll('div[role="cell"]');
    
    // The number of cells can vary - let's be more flexible
    if (cells.length < 5) {
      console.log(`[Better DB History] Row ${rowIndex}: Only ${cells.length} cells, skipping`);
      continue;
    }
    
    // Column indices based on the table structure:
    // 0: Version, 1: Timestamp, 2: User Id, 3: Username, 4: Operation
    // 5: Operation Parameters, 6: Job, 7: Notebook, 8: Cluster Id
    // 9: Read Version, 10: Isolation Level, 11: Is Blind Append
    // 12: Operation Metrics, 13: User Metadata, 14: Engine Info
    
    const version = cells[0]?.textContent?.trim();
    const timestampStr = cells[1]?.textContent?.trim();
    const operation = cells[4]?.textContent?.trim();
    
    const metricsCell = findMetricsCell(cells);
    const timestamp = parseTimestamp(timestampStr);
    
    // Debug logging for all rows to diagnose parsing issues
    const shouldDebug = rowIndex < 5; // Log first 5 rows for debugging
    
    if (!metricsCell) {
      rowsWithoutMetricsCell++;
      if (shouldDebug) {
        console.log(`[Better DB History] Row ${rowIndex} (v${version}): No metrics cell found`);
      }
    }
    
    // Parse metrics (async to allow for JSON expansion)
    const metrics = metricsCell ? await parseOperationMetrics(metricsCell, shouldDebug) : {};
    
    const metricsCount = Object.keys(metrics).length;
    if (metricsCount > 0) {
      rowsWithMetrics++;
    } else if (metricsCell) {
      rowsWithEmptyMetrics++;
      if (shouldDebug) {
        console.log(`[Better DB History] Row ${rowIndex} (v${version}): Metrics cell found but no metrics parsed. Cell text: "${metricsCell.textContent.substring(0, 100)}"`);
      }
    }
    
    if (shouldDebug) {
      console.log(`[Better DB History] Row ${rowIndex} - Version: ${version}, Time: ${timestampStr}, Op: ${operation}, Metrics: ${metricsCount}`);
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
  }
  
  console.log(`[Better DB History] Parsing summary:`);
  console.log(`  - Total rows: ${rows.length}`);
  console.log(`  - Rows with metrics: ${rowsWithMetrics}`);
  console.log(`  - Rows without metrics cell: ${rowsWithoutMetricsCell}`);
  console.log(`  - Rows with empty metrics: ${rowsWithEmptyMetrics}`);
  console.log(`  - Unique metric keys: ${allMetricKeys.size} (${Array.from(allMetricKeys).join(', ')})`);
  
  // Sort by timestamp ascending (oldest first for chart)
  data.sort((a, b) => a.timestamp - b.timestamp);
  
  return {
    rows: data,
    metricKeys: Array.from(allMetricKeys).sort()
  };
}
