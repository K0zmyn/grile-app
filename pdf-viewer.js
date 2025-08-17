// pdf-viewer.js
// Viewer unic, încarcă o singură dată cartea și sare instant la pagini.
// API public: PDFViewer.openOrReuse(bookKey, blobOrUrl), PDFViewer.goTo(pageNumber)

const USE_CDN = true; // setează false după ce pui fișierele în /vendor/pdfjs/
const PDFJS_CDN = 'https://unpkg.com/pdfjs-dist@4.6.82/build/pdf.mjs';

let pdfjsLib, pdfDoc = null, currentBookKey = null;
let rendering = new Map();       // page -> Promise de randare în curs
let rendered = new Map();        // page -> {canvas, scale}
const MAX_CACHE = 12;            // cât de multe pagini păstrăm randate
let scale = 1.25;

const panel = () => document.getElementById('pdf-viewer-panel');
const host  = () => document.getElementById('pdf-canvas-host');

async function ensurePdfJsLoaded() {
  if (pdfjsLib) return;
  if (USE_CDN) {
    pdfjsLib = await import(PDFJS_CDN);
  } else {
    pdfjsLib = await import('./vendor/pdfjs/pdf.mjs');
  }
  // set worker
  const workerSrc = USE_CDN
    ? 'https://unpkg.com/pdfjs-dist@4.6.82/build/pdf.worker.mjs'
    : './vendor/pdfjs/pdf.worker.mjs';
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;
}

function showPanel() {
  panel().style.display = 'block';
}

function hidePanel() {
  if (!document.getElementById('pdf-pin').checked) {
    panel().style.display = 'none';
  }
}

function lruTrim() {
  // ținem MAX_CACHE pagini; eliminăm cele mai vechi
  while (rendered.size > MAX_CACHE) {
    const [firstKey] = rendered.keys();
    const entry = rendered.get(firstKey);
    if (entry?.canvas) entry.canvas.remove();
    rendered.delete(firstKey);
  }
}

async function renderPage(pageNumber) {
  if (!pdfDoc) return;
  if (rendered.has(pageNumber)) return rendered.get(pageNumber);

  if (!rendering.has(pageNumber)) {
    rendering.set(pageNumber, (async () => {
      const page = await pdfDoc.getPage(pageNumber);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = viewport.width | 0;
      canvas.height = viewport.height | 0;
      canvas.style.display = 'block';
      canvas.style.margin = '0 auto 8px auto';
      canvas.dataset.page = pageNumber;

      // Inserăm în ordine corectă
      const existing = Array.from(host().children).map(c => parseInt(c.dataset.page,10));
      let inserted = false;
      for (let i = 0; i < existing.length; i++) {
        if (existing[i] > pageNumber) {
          host().insertBefore(canvas, host().children[i]);
          inserted = true;
          break;
        }
      }
      if (!inserted) host().appendChild(canvas);

      await page.render({ canvasContext: ctx, viewport }).promise;

      const entry = { canvas, scale };
      rendered.set(pageNumber, entry);
      lruTrim();

      // prefetch vecini
      void renderNeighbor(pageNumber + 1);
      void renderNeighbor(pageNumber - 1);

      return entry;
    })().finally(() => rendering.delete(pageNumber)));
  }
  return rendering.get(pageNumber);
}

async function renderNeighbor(p) {
  if (!pdfDoc) return;
  if (p < 1 || p > pdfDoc.numPages) return;
  if (rendered.has(p) || rendering.has(p)) return;
  try { await renderPage(p); } catch {}
}

function clearAll() {
  rendered.forEach(v => v.canvas?.remove());
  rendered.clear();
  rendering.clear();
  host().innerHTML = '';
}

async function openDocumentFromBlobOrUrl(blobOrUrl) {
  await ensurePdfJsLoaded();
  const params = typeof blobOrUrl === 'string'
    ? { url: blobOrUrl }
    : { data: await blobOrUrl.arrayBuffer() };
  pdfDoc = await pdfjsLib.getDocument(params).promise;
}

async function goTo(pageNumber) {
  if (!pdfDoc) return;
  showPanel();
  pageNumber = Math.max(1, Math.min(pdfDoc.numPages, pageNumber));
  // randăm pagina cerută
  await renderPage(pageNumber);
  // scroll la canvasul paginii
  const c = host().querySelector(`canvas[data-page="${pageNumber}"]`);
  if (c) c.scrollIntoView({ behavior: 'smooth', block: 'start' });
  // prefetch buffer mic
  for (const p of [pageNumber+1, pageNumber+2, pageNumber-1, pageNumber-2]) {
    void renderNeighbor(p);
  }
}

document.addEventListener('click', (e) => {
  if (e.target?.id === 'pdf-close') {
    hidePanel();
  }
});

export const PDFViewer = {
  async openOrReuse(bookKey, blobOrUrl) {
    showPanel();
    if (bookKey !== currentBookKey) {
      currentBookKey = bookKey;
      clearAll();
      await openDocumentFromBlobOrUrl(blobOrUrl);
      // set scale pentru lățimea panoului
      try {
        const first = await pdfDoc.getPage(1);
        const v = first.getViewport({ scale: 1 });
        const target = Math.max(420, panel().clientWidth - 24);
        scale = Math.min(2.0, Math.max(0.7, target / v.width));
      } catch {}
    }
  },
  async goTo(pageNumber) {
    await goTo(pageNumber);
  },
  isOpen() { return !!pdfDoc; },
  currentBookKey() { return currentBookKey; },
  pageCount() { return pdfDoc?.numPages ?? 0; }
};
