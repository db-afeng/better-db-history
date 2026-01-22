/**
 * Better Databricks History - Content Script
 * Detects history tab and replaces table with shared-ui component
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { TableHistoryView } from 'shared-ui';

function isHistoryTab() {
  const url = new URL(window.location.href);
  return url.searchParams.get('activeTab') === 'history';
}

function getTableNameFromUrl(): string | null {
  // Extract table name from Databricks URL
  // Example: /explore/data/catalog/schema/table?activeTab=history
  const pathMatch = window.location.pathname.match(
    /\/explore\/data\/([^/]+)\/([^/]+)\/([^/?]+)/
  );
  if (pathMatch) {
    const [, catalog, schema, table] = pathMatch;
    return `${catalog}.${schema}.${table}`;
  }
  return null;
}

function replaceTable() {
  if (!isHistoryTab()) return;

  const table = document.querySelector('div[role="table"]');
  if (!table || document.getElementById('bdbh-replacement')) return;

  const tableName = getTableNameFromUrl();
  if (!tableName) {
    console.warn('[Better DB History] Could not extract table name from URL');
    return;
  }

  // Hide the original table
  (table as HTMLElement).style.display = 'none';

  // Hide the toolbar/header element
  const toolbar = document.querySelector(
    '#rc-tabs-0-panel-history > div.databricks-dataexplorer-1lakyo5'
  );
  if (toolbar) {
    (toolbar as HTMLElement).style.display = 'none';
  }

  // Create container for React component
  const container = document.createElement('div');
  container.id = 'bdbh-replacement';
  table.parentNode?.insertBefore(container, table);

  // Render React component
  const root = createRoot(container);
  root.render(
    React.createElement(TableHistoryView, {
      tableName,
      baseUrl: window.location.origin, // Use current Databricks host
    })
  );

  console.log('[Better DB History] Table replaced with TableHistoryView');
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
