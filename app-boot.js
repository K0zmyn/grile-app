// app-boot.js
import { PDFViewer } from './pdf-viewer.js';
import { StorageDB } from './storage.js';
window.StorageDB = StorageDB; // <— adaugă linia asta
window.dispatchEvent(new Event('app-boot-ready')); // <— adaugă asta

// 4.1. Service Worker + PWA
if ('serviceWorker' in navigator) {
  try { navigator.serviceWorker.register('./service-worker.js'); } catch {}
}

// 4.2. Cere persistență pentru stocare (evită ștergerea cache-ului)
try {
  if (navigator.storage && navigator.storage.persist) {
    const persisted = await navigator.storage.persisted();
    if (!persisted) await navigator.storage.persist();
  }
} catch {}

// 4.3. Expune funcții globale ca să NU trebuiască să refaci toată aplicația
// Înlocuiești *oriunde* făceai window.open(pdf + '#page=...') cu window.jumpToPage(bookKey, page)
window.jumpToPage = async function(bookKey, pageNumber) {
  // 1) Asigură-te că avem cartea local (URL din IndexedDB)
  let url = await StorageDB.getBookURL(bookKey);
  if (!url) {
    // fallback: dacă aplicația ta are deja un URL din carti.json, îl poți încărca și apoi salva
    const library = await StorageDB.getMeta('libraryIndex'); // ex: { "medicina": "medicina.pdf", ... }
    const path = library?.[bookKey];
    if (!path) {
      alert(`Cartea "${bookKey}" nu e importată încă. Încarc-o o dată din meniul de import.`);
      return;
    }
    // fetch, punem în IDB, apoi refacem url
    const resp = await fetch(path);
    const blob = await resp.blob();
    await StorageDB.putBook(bookKey, blob);
    url = await StorageDB.getBookURL(bookKey);
  }
  // 2) Deschide/reutilizează viewerul unic și sari la pagină
  await PDFViewer.openOrReuse(bookKey, url);
  await PDFViewer.goTo(pageNumber);
};

// 4.4. Hook pentru importul inițial al bibliotecii (apelează asta din butonul tău existent „Importă”)
window.saveLibraryOnce = async function({ booksMap, jsonsMap, libraryIndex }) {
  // booksMap: { cheieCarte: File/Blob | URL }, jsonsMap: { numeJson: object }, libraryIndex: { cheieCarte: "pathSauUrl" }
  // 1) JSON-uri
  for (const [k, obj] of Object.entries(jsonsMap || {})) {
    await StorageDB.putJSON(k, obj);
  }
  // 2) Cărți
  for (const [k, src] of Object.entries(booksMap || {})) {
    let blob;
    if (src instanceof Blob) blob = src;
    else {
      const r = await fetch(src);
      blob = await r.blob();
    }
    await StorageDB.putBook(k, blob);
  }
  // 3) Index (cheie -> URL relativ original, pentru fallback)
  if (libraryIndex) await StorageDB.setMeta('libraryIndex', libraryIndex);

  alert('Biblioteca a fost salvată local. Data viitoare pornești direct, fără upload.');
};

// 4.5. Restaurare automată la pornire (un „single click” experience)
(async function autoRestore() {
  // dacă avem un index salvat, considerăm că biblioteca e gata
  const idx = await StorageDB.getMeta('libraryIndex');
  if (idx) {
    // poți seta aici UI-ul tău în starea „gata de lucru”
    // ex: document.body.classList.add('lib-ready');
  }
})();

// 4.6. UX: butonul ✕ din viewer
document.getElementById('pdf-close')?.addEventListener('click', () => {
  const panel = document.getElementById('pdf-viewer-panel');
  panel.style.display = 'none';
});

