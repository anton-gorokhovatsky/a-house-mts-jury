import { displayText, escape } from './views.js?v=12cf3cc5a61e';
import { ProjectSheets } from './sheets.js?v=12cf3cc5a61e';

const retry = '<p class="sheet-status" role="status"></p><button type="button" class="sheet-tool" data-retry-sheet hidden>Повторить загрузку листа</button>';
const failure = 'Не удалось загрузить лист. Вы можете повторить попытку или открыть PDF проекта.';

function status(container, message = '', failed = false) {
  container.querySelector(':scope > .sheet-status').textContent = displayText(message);
  container.querySelector(':scope > [data-retry-sheet]').hidden = !failed;
}

// Keep the second-stage viewer's zoom, drag, pinch and swipe gestures on the enlarged image.
function bindViewer(dialog, step) {
  const pan = dialog.querySelector('.sheet-pan');
  const img = pan.querySelector('img');
  const output = dialog.querySelector('.zoom-value');
  const minus = dialog.querySelector('[data-zoom="out"]');
  const plus = dialog.querySelector('[data-zoom="in"]');
  const pointers = new Map();
  let scale = 1, x = 0, y = 0, width = 0, height = 0;
  let swipe;

  function draw() {
    const maxX = Math.max(0, (width * scale - pan.clientWidth) / 2);
    const maxY = Math.max(0, (height * scale - pan.clientHeight) / 2);
    x = Math.max(-maxX, Math.min(maxX, x));
    y = Math.max(-maxY, Math.min(maxY, y));
    img.style.transform = 'translate(' + x + 'px,' + y + 'px) scale(' + scale + ')';
    output.textContent = Math.round(scale * 100) + ' %';
    minus.disabled = !width || scale <= 1;
    plus.disabled = !width || scale >= 6;
    pan.classList.toggle('magnified', scale > 1);
  }

  function fit() {
    const ratio = Math.min(pan.clientWidth / img.naturalWidth, pan.clientHeight / img.naturalHeight, 1);
    width = img.naturalWidth ? img.naturalWidth * ratio : 0;
    height = img.naturalHeight ? img.naturalHeight * ratio : 0;
    img.style.width = width + 'px';
    img.style.height = height + 'px';
    draw();
  }

  function zoom(next, point) {
    const factor = Math.max(1, Math.min(6, next)) / scale;
    const rect = pan.getBoundingClientRect();
    const px = point ? point.x - rect.left - rect.width / 2 : 0;
    const py = point ? point.y - rect.top - rect.height / 2 : 0;
    x = px - (px - x) * factor;
    y = py - (py - y) * factor;
    scale *= factor;
    draw();
  }

  function reset() {
    pointers.clear();
    swipe = null;
    scale = 1;
    x = y = 0;
    fit();
  }

  function gesture() {
    const [a, b = a] = pointers.values();
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, distance: Math.hypot(a.x - b.x, a.y - b.y) };
  }

  dialog.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button || button.disabled) return;
    if (button.dataset.step) step(Number(button.dataset.step));
    if (button.dataset.zoom === 'out') zoom(scale / 1.3);
    if (button.dataset.zoom === 'in') zoom(scale * 1.3);
    if (button.dataset.zoom === 'reset') reset();
    if (button.hasAttribute('data-close')) dialog.close();
  });
  dialog.addEventListener('keydown', event => {
    if (event.altKey || event.metaKey || event.ctrlKey) return;
    const direction = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
    if (scale === 1 && direction) step(direction);
    else if (['+', '='].includes(event.key)) zoom(scale * 1.3);
    else if (event.key === '-') zoom(scale / 1.3);
    else if (event.key === '0') reset();
    else if (scale > 1 && event.key.startsWith('Arrow')) {
      if (direction) x -= direction * 60;
      else y += event.key === 'ArrowUp' ? 60 : -60;
      draw();
    } else return;
    event.preventDefault();
  });
  pan.addEventListener('wheel', event => {
    event.preventDefault();
    zoom(scale * Math.exp(-event.deltaY * .002), { x: event.clientX, y: event.clientY });
  }, { passive: false });
  pan.addEventListener('dblclick', event => zoom(scale > 1 ? 1 : 2, {x: event.clientX, y: event.clientY}));
  pan.addEventListener('pointerdown', event => {
    if (event.button !== 0 || pointers.size >= 2) return;
    const point = { x: event.clientX, y: event.clientY };
    swipe = !pointers.size && scale === 1 && event.pointerType === 'touch' ? { ...point, id: event.pointerId } : null;
    pointers.set(event.pointerId, point);
    pan.setPointerCapture(event.pointerId);
  });
  pan.addEventListener('pointermove', event => {
    if (!pointers.has(event.pointerId)) return;
    const start = gesture();
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const end = gesture();
    if (start.distance) zoom(scale * end.distance / start.distance, start);
    x += end.x - start.x;
    y += end.y - start.y;
    draw();
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    pan.addEventListener(type, event => {
      const start = swipe;
      swipe = null;
      pointers.delete(event.pointerId);
      if (type !== 'pointerup' || start?.id !== event.pointerId || scale !== 1) return;
      const dx = event.clientX - start.x, dy = event.clientY - start.y;
      if (Math.abs(dx) >= 50 && Math.abs(dx) > Math.abs(dy) * 1.5) step(dx < 0 ? 1 : -1);
    });
  }
  img.addEventListener('load', fit);
  const observer = new ResizeObserver(() => { if (dialog.open) fit(); });
  observer.observe(pan);
  return { reset, disconnect: () => observer.disconnect() };
}

export class FinalGallery {
  constructor(request) {
    this.request = request;
  }

  mount(region, work) {
    const title = escape(work.title);
    region.innerHTML = '<div class="sheet-strip" role="group" aria-label="Листы проекта" aria-describedby="sheet-keys"></div><span id="sheet-keys" class="sr-only">Стрелками влево и вправо можно выбрать лист. Нажмите Enter, чтобы открыть его крупнее.</span>' + retry +
      '<dialog class="sheet-dialog" aria-label="Листы проекта ' + title + '"><div class="sheet-dialog-layout">' +
      '<div class="sheet-dialog-top"><div class="sheet-zoom"><button type="button" class="sheet-arrow" data-zoom="out" aria-label="Уменьшить">−</button>' +
      '<output class="zoom-value" aria-label="Масштаб">100 %</output><button type="button" class="sheet-arrow" data-zoom="in" aria-label="Увеличить">+</button>' +
      '<button type="button" class="sheet-tool" data-zoom="reset" aria-label="Сбросить" title="Сбросить масштаб"><span class="sheet-label">Сбросить</span><span class="sheet-symbol" aria-hidden="true">↺</span></button></div>' +
      '<button type="button" class="sheet-tool" data-close autofocus aria-label="Закрыть" title="Закрыть"><span class="sheet-label">Закрыть</span><span class="sheet-symbol" aria-hidden="true">×</span></button></div>' +
      '<div class="sheet-pan"><img draggable="false" alt=""></div>' + retry +
      '<div class="sheet-controls"><button type="button" class="sheet-arrow" data-step="-1" aria-label="Предыдущий лист">←</button>' +
      '<output class="sheet-number" aria-live="polite" aria-atomic="true"></output>' +
      '<button type="button" class="sheet-arrow" data-step="1" aria-label="Следующий лист">→</button></div></div></dialog>';
    const strip = region.querySelector('.sheet-strip');
    const dialog = region.querySelector('dialog');
    const layout = dialog.querySelector('.sheet-dialog-layout');
    const image = dialog.querySelector('img');
    const previews = new Map();
    let reader, fullRender, fullUrl, opener;
    let index = 0, total = 0, closed = false;
    const viewer = bindViewer(dialog, by => select((index + by + total) % total));

    function releasePreview(button) {
      previews.get(button)?.abort();
      previews.delete(button);
      const img = button.querySelector('img');
      if (img.hasAttribute('src')) {
        URL.revokeObjectURL(img.src);
        img.removeAttribute('src');
      }
    }

    async function thumbnail(button) {
      const img = button.querySelector('img');
      if (closed || previews.has(button) || img.hasAttribute('src') || !reader?.doc) return;
      const job = new AbortController();
      previews.set(button, job);
      const number = Number(button.dataset.page);
      try {
        const resolution = Math.min(1500, Math.max(640, Math.ceil(button.clientWidth * devicePixelRatio)));
        const blob = await reader.image(number, job.signal, resolution);
        if (job.signal.aborted) return;
        img.src = URL.createObjectURL(blob);
        await img.decode();
        if (!job.signal.aborted && number === 1) strip.classList.toggle('portrait', img.naturalHeight > img.naturalWidth);
      } catch {
        if (!job.signal.aborted) {
          releasePreview(button);
          status(region, failure, true);
        }
      } finally {
        if (previews.get(button) === job) previews.delete(button);
      }
    }

    const visible = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.isIntersecting) thumbnail(entry.target);
        else releasePreview(entry.target);
      }
    }, { root: strip, rootMargin: '0px 18%' });

    function clearFull() {
      fullRender?.abort();
      image.removeAttribute('src');
      if (fullUrl) URL.revokeObjectURL(fullUrl);
      fullUrl = null;
    }

    async function select(next) {
      if (closed || !dialog.open || !total) return;
      index = next;
      clearFull();
      const job = new AbortController();
      fullRender = job;
      const number = index + 1;
      const preview = strip.children[index].querySelector('img').getAttribute('src');
      if (preview) image.src = preview;
      image.alt = displayText(work.title + ', лист ' + number);
      const position = dialog.querySelector('.sheet-number');
      position.textContent = number + ' / ' + total;
      position.setAttribute('aria-label', displayText('Лист ' + number + ' из ' + total));
      viewer.reset();
      status(layout, preview ? '' : 'Загружаем лист…');
      try {
        const blob = await reader.image(number, job.signal);
        if (job.signal.aborted) return;
        fullUrl = URL.createObjectURL(blob);
        image.src = fullUrl;
        await image.decode();
        if (!job.signal.aborted) status(layout);
      } catch {
        if (!job.signal.aborted) status(layout, failure, true);
      }
    }

    const openBook = async () => {
      fullRender?.abort();
      visible.disconnect();
      for (const button of previews.keys()) releasePreview(button);
      reader?.close();
      const book = new ProjectSheets(work, this.request);
      reader = book;
      status(region, 'Загружаем листы…');
      if (dialog.open) status(layout, 'Загружаем лист…');
      try {
        const count = await book.open();
        if (closed || reader !== book) return;
        total = count;
        if (!strip.children.length) {
          const buttons = Array.from({ length: total }, (_, i) => '<button type="button" class="sheet-preview" data-page="' + (i + 1) +
            '" tabindex="' + (i === 0 ? '0' : '-1') + '" aria-label="Открыть лист ' + (i + 1) + ' из ' + total + ' крупнее"><span aria-hidden="true">Лист ' + (i + 1) + '</span><img alt=""></button>');
          strip.innerHTML = buttons.join('');
          dialog.querySelector('.sheet-controls').hidden = total < 2;
          strip.classList.toggle('single', total === 1);
        }
        status(region);
        for (const button of strip.children) visible.observe(button);
        if (dialog.open) select(index);
      } catch {
        if (!closed && reader === book) {
          status(region, failure, true);
          if (dialog.open) status(layout, failure, true);
        }
      }
    };

    region.addEventListener('click', event => {
      const button = event.target.closest('button');
      if (button?.hasAttribute('data-retry-sheet')) openBook();
      else if (button?.hasAttribute('data-page')) {
        opener = button;
        opener.focus({ preventScroll: true });
        dialog.showModal();
        select(Number(button.dataset.page) - 1);
      }
    });
    function tabStop(button) {
      const previous = strip.querySelector('[tabindex="0"]');
      if (previous && previous !== button) previous.tabIndex = -1;
      button.tabIndex = 0;
    }
    strip.addEventListener('focusin', event => {
      if (event.target.matches('[data-page]')) tabStop(event.target);
    });
    strip.addEventListener('scrollend', () => {
      if (closed || dialog.open || strip.contains(document.activeElement) || !strip.firstElementChild) return;
      const left = strip.getBoundingClientRect().left;
      const nearest = [...strip.children].reduce((a, b) =>
        Math.abs(a.getBoundingClientRect().left - left) <= Math.abs(b.getBoundingClientRect().left - left) ? a : b);
      tabStop(nearest);
    });
    strip.addEventListener('keydown', event => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const by = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
      const current = event.target.closest('[data-page]');
      if (by && current) {
        event.preventDefault();
        strip.children[Number(current.dataset.page) - 1 + by]?.focus();
      }
    });
    dialog.addEventListener('close', () => {
      clearFull();
      viewer.reset();
      if (!closed && opener?.isConnected && (document.activeElement === document.body || dialog.contains(document.activeElement))) {
        opener.focus({ preventScroll: true });
      }
    });
    openBook();
    return () => {
      closed = true;
      visible.disconnect();
      viewer.disconnect();
      clearFull();
      for (const button of strip.children) releasePreview(button);
      reader?.close();
      if (dialog.open) dialog.close();
    };
  }
}
