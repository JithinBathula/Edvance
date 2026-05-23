/// <reference types="vite/client" />
interface ImportMetaEnv {
    readonly VITE_API_URL: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}

declare module 'https://cdn.jsdelivr.net/pyodide/v0.27.7/full/pyodide.mjs' {
  export function loadPyodide(options?: Record<string, unknown>): Promise<any>;
}
