import { displayText, escape, heading } from './views.js?v=454ecd2efb3b';

import { ProjectSheets } from './sheets.js?v=454ecd2efb3b';

const controls = () => '<div class="sheet-controls"><button type="button" class="sheet-arrow" data-step="-1" aria-label="Предыдущий лист"><span aria-hidden="true">←</span></button>' +
  '<span class="sheet-number" aria-live="polite" aria-atomic="true"></span>' +
  '<button type="button" class="sheet-arrow" data-step="1" aria-label="Следующий лист"><span aria-hidden="true">→</span></button></div>';

export class FinalGallery {
  constructor(request) {
    this.request = request;
  }

  mount(region, work) {
    const urls = new Map();
    let index = 1;
    let total;
    let reader;
    let opening;
    let pending;
    let opener;
    let closed = false;
    const name = escape(work.title);
    region.innerHTML = heading('Листы проекта', 2, 'sheets-heading') + '<div class="sheet-stage"><button type="button" class="sheet-preview" data-expand ' +
      'aria-label="Открыть лист крупнее"><img alt=""></button></div><div class="sheet-bar">' + controls() +
      '<button type="button" class="sheet-tool" data-expand>На весь экран</button></div>' +
      '<p class="sheet-status" role="status"></p><button type="button" class="sheet-tool" data-retry-sheet hidden>Повторить загрузку листа</button>' +
      '<dialog class="sheet-dialog" aria-label="Листы проекта ' + name + '"><div class="sheet-dialog-layout">' +
      '<div class="sheet-dialog-top"><button type="button" class="sheet-tool" data-zoom aria-pressed="false">Увеличить</button>' +
      '<button type="button" class="sheet-tool" data-close autofocus>Закрыть</button></div>' +
      '<div class="sheet-pan"><img alt=""></div>' + controls() + '<p class="sheet-status" role="status"></p>' +
      '<button type="button" class="sheet-tool" data-retry-sheet hidden>Повторить загрузку листа</button></div></dialog>';
    const dialog = region.querySelector('dialog');
    const pan = dialog.querySelector('.sheet-pan');
    const zoom = dialog.querySelector('[data-zoom]');
    const images = [...region.querySelectorAll('img')];

    function magnify(on) {
      pan.classList.toggle('magnified', on);
      zoom.setAttribute('aria-pressed', String(on));
      zoom.textContent = on ? 'Уместить' : 'Увеличить';
      pan.scrollTo(0, 0);
    }

    function controlsState(message = '', failed = false) {
      const ready = images[0].hasAttribute('src');
      for (const n of region.querySelectorAll('.sheet-number')) n.textContent = total ? displayText('Лист ' + index + ' из ' + total) : '';
      for (const b of region.querySelectorAll('[data-step]')) {
        const next = index + Number(b.dataset.step);
        b.setAttribute('aria-disabled', String(!total || next < 1 || next > total));
      }
      for (const b of region.querySelectorAll('[data-expand]')) b.disabled = !total;
      zoom.disabled = !ready;
      for (const n of region.querySelectorAll('.sheet-status')) n.textContent = displayText(message);
      for (const b of region.querySelectorAll('[data-retry-sheet]')) b.hidden = !failed;
    }

    const select = async number => {
      if (closed || number < 1 || (total && number > total)) return;
      index = number;
      pending?.abort();
      const current = new AbortController();
      pending = current;
      magnify(false);
      for (const img of images) { img.removeAttribute('src'); img.alt = ''; }
      controlsState('Загружаем лист…');
      try {
        reader ??= new ProjectSheets(work, this.request);
        opening ??= reader.open();
        total = await opening;
        if (current.signal.aborted) return;
        controlsState('Загружаем лист…');
        let url = urls.get(index);
        if (!url) {
          const file = await reader.image(number, current.signal);
          if (current.signal.aborted) return;
          url = URL.createObjectURL(file);
          urls.set(number, url);
        }
        for (const img of images) {
          img.alt = displayText(work.title + ', лист ' + number);
          img.src = url;
        }
        await images[0].decode();
        if (current.signal.aborted) return;
        region.querySelector('.sheet-stage').classList.toggle('sheet-portrait', images[0].naturalHeight > images[0].naturalWidth);
        for (const [n, oldUrl] of urls) if (Math.abs(n - number) > 1) { URL.revokeObjectURL(oldUrl); urls.delete(n); }
        controlsState();
      } catch {
        if (current.signal.aborted) return;
        reader?.close();
        reader = null;
        opening = null;
        if (urls.has(number)) { URL.revokeObjectURL(urls.get(number)); urls.delete(number); }
        for (const img of images) { img.removeAttribute('src'); img.alt = ''; }
        controlsState('Не удалось загрузить лист. Вы можете повторить попытку или открыть PDF проекта.', true);
      }
    };
    region.addEventListener('click', event => {
      const b = event.target.closest('button');
      if (!b || b.disabled || b.getAttribute('aria-disabled') === 'true') return;
      if (b.hasAttribute('data-step')) select(index + Number(b.dataset.step));
      if (b.hasAttribute('data-expand') && !dialog.open) { opener = b; dialog.showModal(); }
      if (b.hasAttribute('data-close')) dialog.close();
      if (b.hasAttribute('data-zoom')) magnify(!pan.classList.contains('magnified'));
      if (b.hasAttribute('data-retry-sheet')) select(index);
    });
    dialog.addEventListener('close', () => {
      magnify(false);
      if (!closed && opener?.isConnected) opener.focus({ preventScroll: true });
    });
    region.addEventListener('keydown', event => {
      if (pan.classList.contains('magnified') || event.altKey || event.metaKey || event.ctrlKey) return;
      const step = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
      if (step && total) { event.preventDefault(); select(index + step); }
    });
    for (const surface of [region.querySelector('.sheet-stage'), pan]) {
      let start;
      let suppressClick = false;
      surface.addEventListener('touchstart', event => {
        const t = event.touches[0];
        start = event.touches.length === 1 && !pan.classList.contains('magnified') ? [t.clientX, t.clientY] : null;
        suppressClick = false;
      }, { passive: true });
      surface.addEventListener('touchcancel', () => { start = null; });
      surface.addEventListener('touchend', event => {
        if (!start || event.touches.length) return;
        const t = event.changedTouches[0];
        const dx = t.clientX - start[0], dy = t.clientY - start[1];
        start = null;
        if (Math.abs(dx) > 40 && Math.abs(dx) > 1.5 * Math.abs(dy)) {
          suppressClick = true;
          select(index + (dx < 0 ? 1 : -1));
        }
      }, { passive: true });
      surface.addEventListener('click', event => {
        if (suppressClick) { event.preventDefault(); event.stopPropagation(); suppressClick = false; }
      }, true);
    }
    select(1);
    return () => {
      closed = true;
      pending?.abort();
      reader?.close();
      if (dialog.open) dialog.close();
      for (const img of images) img.removeAttribute('src');
      for (const url of urls.values()) URL.revokeObjectURL(url);
    };
  }
}
