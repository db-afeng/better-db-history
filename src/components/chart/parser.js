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
