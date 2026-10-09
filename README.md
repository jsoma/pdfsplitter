# PDF Splitter

Split a packet of PDFs into separate documents, entirely in your browser.

**[Open PDF Splitter](https://jsoma.github.io/pdfsplitter/)**

1. Drop in a PDF and check its existing text.
2. Mark document starts manually, look for matching text, or use visual similarity to find pages that resemble your examples.
3. Review suggestions, adjust filenames, and download all documents as a ZIP.

Only confirmed starts create new documents. The original PDF is never changed, and exported pages retain their existing text and graphics. Visual similarity is a suggestion, not a certainty: review the proposed starts before accepting them.

Files stay on your computer. There is no server processing, OCR, account, or analytics. Scanned documents without a text layer can still use visual or manual matching. Password-protected PDFs are not supported. Very large PDFs may exceed your browser's available memory; downloads are assembled in memory.

## Development

Requires Node.js 22.13 or later.

```sh
npm ci
npm run dev
```

```sh
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

GitHub Actions tests each pull request and publishes `main` to GitHub Pages. PDF.js and its fonts, character maps, and rendering assets are served with the app. Production files are in `dist/`.

Built with React, PDF.js, pdf-lib, and zip.js. The design and matching approach grew out of [Frisket](https://github.com/frisket-dev/frisket).
