/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Databricks Apps environment variable (production) */
  readonly DATABRICKS_APP_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
