/**
 * PDF Thumbnail Generator Utility
 * Dynamically loads Mozilla's PDF.js from CDN to generate crisp, high-fidelity
 * page 1 thumbnails for PDFs client-side without bundling bloat.
 */

let pdfjsLoadingPromise = null;

export async function loadPdfJs() {
  if (typeof window === 'undefined') return null;
  if (window.pdfjsLib) return window.pdfjsLib;
  if (pdfjsLoadingPromise) return pdfjsLoadingPromise;

  pdfjsLoadingPromise = new Promise((resolve, reject) => {
    // Check if script is already injected
    const existing = document.querySelector('script[data-pdfjs="true"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(window.pdfjsLib));
      existing.addEventListener('error', reject);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.async = true;
    script.setAttribute('data-pdfjs', 'true');

    script.onload = () => {
      if (window.pdfjsLib) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        resolve(window.pdfjsLib);
      } else {
        reject(new Error('pdfjsLib not found on window after script load'));
      }
    };

    script.onerror = (err) => {
      console.warn('Failed to load PDF.js from CDN:', err);
      reject(err);
    };

    document.head.appendChild(script);
  });

  return pdfjsLoadingPromise;
}

/**
 * Generate a thumbnail DataURL and page count for page 1 of a PDF.
 * Accepts File, Blob, base64 DataURL, or HTTP URL.
 *
 * @param {File|Blob|string|ArrayBuffer} source
 * @param {number} maxDimension - Max width or height of the generated preview
 * @returns {Promise<{ thumbnailUrl: string, pageCount: number, width: number, height: number } | null>}
 */
export async function generatePdfThumbnail(source, maxDimension = 640) {
  try {
    const pdfjs = await loadPdfJs();
    if (!pdfjs) return null;

    let loadingTask;

    if (source instanceof File || source instanceof Blob) {
      const arrayBuffer = await source.arrayBuffer();
      loadingTask = pdfjs.getDocument({ data: arrayBuffer });
    } else if (typeof source === 'string' && source.startsWith('data:')) {
      // Decode base64 dataURL
      const base64Data = source.split(',')[1];
      const binaryString = atob(base64Data);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      loadingTask = pdfjs.getDocument({ data: bytes.buffer });
    } else if (typeof source === 'string') {
      loadingTask = pdfjs.getDocument({
        url: source,
        withCredentials: false,
      });
    } else {
      loadingTask = pdfjs.getDocument({ data: source });
    }

    const pdf = await loadingTask.promise;
    const pageCount = pdf.numPages || 1;
    const page = await pdf.getPage(1);

    const unscaledViewport = page.getViewport({ scale: 1 });
    const scale = Math.min(
      maxDimension / unscaledViewport.width,
      maxDimension / unscaledViewport.height,
      2.0
    );
    const viewport = page.getViewport({ scale: Math.max(scale, 0.75) });

    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);

    const context = canvas.getContext('2d', { alpha: false });
    // Fill white paper background
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({
      canvasContext: context,
      viewport,
    }).promise;

    const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.88);

    return {
      thumbnailUrl,
      pageCount,
      width: canvas.width,
      height: canvas.height,
    };
  } catch (err) {
    console.warn('generatePdfThumbnail notice (falling back gracefully):', err?.message || err);
    return null;
  }
}
