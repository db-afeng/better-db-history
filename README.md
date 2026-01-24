# Better Databricks History

Enhanced table history visualization for Databricks Unity Catalog — available as both a Chrome extension and a Databricks App.

## Project Structure

```
better-db-history/
├── extension/           # Chrome extension
│   ├── src/
│   │   └── content.ts   # Content script (bundled with esbuild)
│   ├── dist/            # Build output
│   └── manifest.json
├── db-app/              # Databricks App
│   ├── frontend/        # React + Vite frontend
│   └── app.py           # Python backend
├── shared-ui/           # Shared components (used by both)
├── databricks.yml       # Bundle configuration
└── package.json         # Workspace scripts
```

## Quick Start

```bash
# Install dependencies
npm install

# Build everything
npm run build
```

## Chrome Extension

The extension injects into Databricks and enhances the History tab directly in the browser.

### Installation

1. Build the extension:
   ```bash
   npm run build:ext
   ```

2. Open Chrome and go to `chrome://extensions/`

3. Enable **Developer mode** (toggle in top right)

4. Click **Load unpacked** and select the `extension/` folder

5. Navigate to any Databricks UC table → History tab

### Development

Rebuild after changes:
```bash
npm run build:ext
```

Then reload the extension in Chrome (`chrome://extensions/` → refresh icon).

## Databricks App

A standalone app deployed to your Databricks workspace.

### Prerequisites

- [Databricks CLI](https://docs.databricks.com/dev-tools/cli/index.html) configured with authentication
- Access to a Databricks workspace

### Deployment

```bash
# Deploy to dev target
npm run deploy

# Deploy to a specific target
npm run deploy -- --target prod
```

### Running the App

```bash
npm run app
```

### Local Development

1. **Get an OAuth token** using the Databricks CLI:
   ```bash
   # Login first (one-time setup)
   databricks auth login --host https://your-workspace.cloud.databricks.com --profile my-local-dev

   # Get the token
   databricks auth token --profile my-local-dev
   ```

2. **Create a `.env` file** in the project root with your token:
   ```env
   DATABRICKS_TOKEN=<paste-token-here>
   ```

3. **Start the dev server**:
   ```bash
   npm run dev
   ```

   The frontend runs at `http://localhost:5173` and proxies API requests to the deployed Databricks App.

> **Note:** OAuth tokens expire. If you get 401 errors, refresh your token by running `databricks auth token --profile my-local-dev` again.

## Scripts Reference

| Command | Description |
|---------|-------------|
| `npm run build` | Build both extension and frontend |
| `npm run build:ext` | Build Chrome extension only |
| `npm run build:web` | Build Databricks App frontend only |
| `npm run dev` | Start frontend dev server |
| `npm run deploy` | Deploy bundle to Databricks |
| `npm run app` | Run the Databricks App |


