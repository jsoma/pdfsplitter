# PDF Splitter
Small React + Vite app for GitHub Pages. All PDF processing stays in the browser; no backend, OCR, external model, analytics, or document uploads. Keep dependencies bundled locally.

Use `npm test`, `npm run build`, and `npm run test:e2e`. PDF rendering/text reads use PDF.js; split/export preserves original PDF pages. Only confirmed starts produce output boundaries. Page 1 is always a start. Test public behavior and real exports, not source text. Never commit FOIA fixture documents; tests may generate simple PDFs for mechanics and manual trials use local fixtures.
