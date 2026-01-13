# Better Databricks History

A Chrome extension that replaces the Databricks Unity Catalog table history tab with an interactive chart visualization.

## What It Does

When you navigate to a UC table's **History** tab, this extension:

1. **Replaces the history table with a chart** - Visualizes Operation Metrics over time
2. **Lets you select different metrics** - Choose from all available metrics like:
   - `numDeletedFiles`, `numAddedFiles`, `numRemovedBytes`
   - `minFileSize`, `maxFileSize`, `p50FileSize`
   - And any other metrics present in your table's history
3. **Toggle between views** - Switch back to the original table anytime with the Table button
4. **Replaces email addresses with names** - Customize the `EMAIL_TO_NAME` mapping in `content.js`

## Screenshot

The extension transforms this:
```
| Version | Timestamp | Operation | Metrics {json} |
```

Into an interactive line chart with time on the X-axis and your selected metric on the Y-axis.

## How It Works

- Detects when you're on a history tab (`?activeTab=history`)
- Waits for the table data to fully load
- Parses the Operation Metrics JSON from each row
- Renders an interactive Chart.js visualization
- Hover over points to see version, operation type, and exact values

## Customization

### Email Replacement

Edit the mapping in `content.js`:

```javascript
const EMAIL_TO_NAME = {
  'alex.feng@databricks.com': 'Alex Feng',
  'jane.doe@databricks.com': 'Jane Doe',
};
```

## Installation

1. Clone this repo
2. Go to `chrome://extensions/`
3. Enable **Developer mode**
4. Click **Load unpacked** and select this folder
5. Navigate to any Databricks table → History tab

## License

MIT
