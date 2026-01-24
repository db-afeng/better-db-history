/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Databricks Apps environment variable (production) */
  readonly DATABRICKS_APP_URL?: string;
  /** Local dev fallback */
  readonly VITE_DATABRICKS_APP_URL?: string;
  /** Bearer token for local dev authentication */
  readonly VITE_DATABRICKS_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
