// A page only reads the authenticated original. The worker and its support files live alongside the cabinet.
const engine = new URL('./pdfjs-6.5.438/', import.meta.url);
const chunkSize = 262144;

export class ProjectSheets {
  constructor(work, request) {
    this.work = work;
    this.request = request;
    this.controller = new AbortController();
    this.failure = new Promise((_, reject) => { this.fail = reject; });
    this.failure.catch(() => {}); // A range may fail between page selections.
  }

  async bytes(begin, end) {
    const response = await this.request('/storage/v1/object/authenticated/jury-final/' + this.work.id + '.pdf', {
      range: 'bytes=' + begin + '-' + (end - 1),
      signal: AbortSignal.any([this.controller.signal, AbortSignal.timeout(30000)])
    });
    if (![200, 206].includes(response.status)) throw new Error('Could not read the PDF');
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (response.status === 200 && bytes.length === this.work.bytes) return { bytes, entire: true };
    if (response.status !== 206 || bytes.length !== end - begin) throw new Error('Incomplete PDF range');
    return { bytes, entire: end - begin === this.work.bytes };
  }

  async open() {
    const [lib, first] = await Promise.all([
      import(new URL('pdf.min.mjs', engine).href),
      this.bytes(0, Math.min(chunkSize, this.work.bytes))
    ]);
    this.controller.signal.throwIfAborted();
    lib.GlobalWorkerOptions.workerSrc = new URL('pdf.worker.min.mjs', engine).href;
    const options = {
      cMapUrl: new URL('cmaps/', engine).href, cMapPacked: true, standardFontDataUrl: new URL('standard_fonts/', engine).href,
      wasmUrl: new URL('wasm/', engine).href, iccUrl: new URL('iccs/', engine).href,
      isEvalSupported: false, enableXfa: false, disableAutoFetch: true, disableStream: true, rangeChunkSize: chunkSize
    };
    if (first.entire) options.data = first.bytes;
    else {
      const transport = new lib.PDFDataRangeTransport(this.work.bytes, first.bytes);
      transport.requestDataRange = (begin, end) => {
        this.bytes(begin, end).then(({ bytes, entire }) => {
          if (!this.controller.signal.aborted) transport.onDataRange(begin, entire ? bytes.subarray(begin, end) : bytes);
        }).catch(this.fail);
      };
      options.range = transport;
    }
    this.task = lib.getDocument(options);
    this.doc = await Promise.race([this.task.promise, this.failure]);
    return this.doc.numPages;
  }

  async image(number, signal, maxSide = 2000) {
    const page = await Promise.race([this.doc.getPage(number), this.failure]);
    signal.throwIfAborted();
    const size = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: maxSide / Math.max(size.width, size.height) });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const render = page.render({ canvas, viewport, background: '#fff' });
    const cancel = () => render.cancel();
    signal.addEventListener('abort', cancel, { once: true });
    try {
      await Promise.race([render.promise, this.failure]);
      signal.throwIfAborted();
      return await new Promise((resolve, reject) => canvas.toBlob(blob =>
        blob ? resolve(blob) : reject(new Error('Sheet render failed')), 'image/png'));
    } finally {
      signal.removeEventListener('abort', cancel);
      canvas.width = canvas.height = 0;
      page.cleanup();
    }
  }

  close() {
    this.controller.abort();
    this.fail(new DOMException('Closed', 'AbortError'));
    this.task?.destroy().catch(() => {});
  }
}
