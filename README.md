# Better Databricks History

A Chrome extension that enhances the Databricks Unity Catalog table history tab with custom functionality.

## Features

- 🔍 Detects when you're on a UC table history tab
- 📊 Provides quick analysis tools for table history
- 📥 Export history changes (placeholder for custom logic)
- 🔄 Compare different versions (placeholder for custom logic)

## Installation

### Developer Mode (Recommended for Development)

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in the top-right corner)
3. Click **Load unpacked**
4. Select the `better-db-history` folder
5. The extension is now installed!

### Optional: Add Custom Icons

Icons are optional. To add custom icons:

1. Open `generate-icons.html` in a browser
2. Right-click each canvas and save as PNG to the `icons/` folder
3. Add this to `manifest.json`:

```json
"icons": {
  "16": "icons/icon16.png",
  "48": "icons/icon48.png",
  "128": "icons/icon128.png"
}
```

## Usage

1. Navigate to any Databricks workspace
2. Go to a Unity Catalog table (e.g., `Catalog Explorer > catalog > schema > table`)
3. Click on the **History** tab
4. The "Better History" panel will appear in the top-right corner

### URL Pattern

The extension activates on URLs matching:
```
https://*.cloud.databricks.com/explore/data/{catalog}/{schema}/{table}?activeTab=history
```

## Customization

Edit `content.js` to add your custom functionality:

- **`analyzeHistory(tableInfo)`** - Add custom history analysis logic
- **`exportChanges(tableInfo)`** - Implement export functionality
- **`compareVersions(tableInfo)`** - Add version comparison features

The `tableInfo` object contains:
```javascript
{
  catalog: "alex_feng",
  schema: "tpch",
  table: "customer",
  fullName: "alex_feng.tpch.customer"
}
```

## Development

### File Structure

```
better-db-history/
├── manifest.json    # Extension configuration
├── content.js       # Main content script (runs on Databricks pages)
├── styles.css       # Panel styling
├── icons/           # Extension icons
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
```

### Reloading Changes

After modifying the extension:
1. Go to `chrome://extensions/`
2. Click the refresh icon on the extension card
3. Reload the Databricks page

## License

MIT
