/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly DATABRICKS_APP_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
