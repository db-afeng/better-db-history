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

## Project Structure

```
better-db-history/
├── src/
│   ├── injection/              # DOM substitution logic
│   │   └── table-replacer.js   # Finds and replaces the history table
│   │
│   └── components/             # UI components and services
│       ├── chart/              # Chart visualization
│       │   ├── parser.js       # Parse table data
│       │   └── renderer.js     # Render Chart.js visualization
│       │
│       ├── backend/            # Databricks app API (planned)
│       │   └── databricks-api.js
│       │
│       └── interceptor/        # API interception (planned)
│           └── network.js
│
├── lib/                        # External libraries
│   ├── chart.min.js
│   └── chartjs-adapter-date-fns.min.js
│
├── icons/
├── styles.css
├── content.js                  # Entry point
└── manifest.json
```

## Installation

1. Clone this repo
2. Go to `chrome://extensions/`
3. Enable **Developer mode**
4. Click **Load unpacked** and select this folder
5. Navigate to any Databricks table → History tab

## License

MIT
