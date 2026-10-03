/// <reference types="vite/client" />

// Vite's `?url` suffix imports (used for the pdf.js worker) resolve to a URL string.
declare module "*?url" {
  const url: string;
  export default url;
}
