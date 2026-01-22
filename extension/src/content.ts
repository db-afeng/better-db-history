/**
 * Better Databricks History - Content Script
 * Detects history tab and replaces table with shared-ui component
 */

import { GREETING } from '../../shared-ui/test';

function isHistoryTab() {
  const url = new URL(window.location.href);
  return url.searchParams.get('activeTab') === 'history';
}

function replaceTable() {
  if (!isHistoryTab()) return;

  const table = document.querySelector('div[role="table"]');
  if (!table || document.getElementById('bdbh-replacement')) return;

  // Hide the table instead of destroying its contents
  (table as HTMLElement).style.display = 'none';

  // Hide the toolbar/header element
  const toolbar = document.querySelector('#rc-tabs-0-panel-history > div.databricks-dataexplorer-1lakyo5');
  if (toolbar) {
    (toolbar as HTMLElement).style.display = 'none';
  }

  // Insert our content as a sibling
  const replacement = document.createElement('div');
  replacement.id = 'bdbh-replacement';
  replacement.style.padding = '20px';
  replacement.style.fontSize = '18px';
  replacement.textContent = GREETING;

  table.parentNode?.insertBefore(replacement, table);

  console.log('[Better DB History] Table replaced');
}

// Watch for dynamic content
const observer = new MutationObserver(() => {
  if (isHistoryTab()) {
    replaceTable();
  }
});

observer.observe(document.body, { childList: true, subtree: true });

// Initial check
if (isHistoryTab()) {
  replaceTable();
}

console.log('[Better DB History] Extension loaded');
