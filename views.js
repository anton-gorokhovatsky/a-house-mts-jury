import { russianSpacing, typesetText } from './typography.js?v=3fcc07c97127';

export const displayText = russianSpacing;
export const cabinetMarkup = html => typesetText(html, { formatFormText: true });

export const escape = value => String(value).replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[character]));

// The MTS faces have wider left sidebearings on upright stems than on open or round initials.
function edgeGroup(word) {
  const first = word.charAt(0).toUpperCase();
  if ('АТУХЛДЖATXVYW'.includes(first)) return 'tight';
  if ('СОФЭЗЯЧCGOQSZ'.includes(first)) return 'medium';
  return 'stem';
}

function opticalEdges(text) {
  const words = text.trim().split(/\s+/u);
  return 'data-edges="' + edgeGroup(words[0]) + ' ' + edgeGroup(words.at(-1)) + '"';
}

const headingBreaks = new Map([
  ['Работы', 'Ра\u00adбо\u00adты'],
  ['финалистов', 'фи\u00adна\u00adлис\u00adтов'],
  ['рейтинг', 'рей\u00adтинг'],
  ['работ', 'ра\u00adбот']
]);

export function heading(text, level = 1, id = '') {
  const tag = 'h' + level;
  let content = escape(text);
  let label = '';
  if (level === 1 && text.includes(' ')) {
    const words = displayText(text).split(' ');
    content = words.map(word => {
      const marked = headingBreaks.get(word);
      const lastPart = marked?.split('\u00ad').at(-1);
      const afterBreak = lastPart && edgeGroup(lastPart) === 'tight' ? ' hang-after-break' : '';
      return '<span class="heading-word' + afterBreak + '">' + escape(marked ?? word) + '</span>';
    }).join(' ');
    label = ' aria-label="' + escape(text) + '"';
  }
  return '<' + tag + (id ? ' id="' + escape(id) + '"' : '') + label + ' ' + opticalEdges(text) + '>' + content + '</' + tag + '>';
}

function page(title, content, signedIn = false) {
  const navigation = signedIn ? headerContent() : '';
  return '<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow"><title>' +
    escape(title) + ' · Меняя привычное</title><link rel="stylesheet" href="/cabinet.css"></head><body>' +
    navigation + content + '</body></html>';
}

export function headerContent({ logo = '/logo.svg', method = 'post', action = '/logout', section, showRanking = false } = {}) {
  const link = (href, name, current) => '<a href="' + href + '"' + (section === current ? ' aria-current="page"' : '') + '>' + name + '</a>';
  const menu = section ? '<nav aria-label="Меню жюри">' + link('#works', 'Работы', 'works') +
    (showRanking ? link('#rating', 'Мой рейтинг работ', 'rating') : '') + '</nav>' : '';
  return '<header class="masthead"><div class="wrap masthead-inner"><img src="' + logo +
    '" width="320" alt="МТС и A–House">' + menu + '<form method="' + method + '" action="' + action +
    '"><button>Выйти</button></form></div></header>';
}

export function regulationsDocument(url) {
  return typeof url === 'string' && /^https:\/\/disk\.360\.yandex\.ru\/[di]\/[\w-]+$/.test(url) ? url : null;
}

function welcomeContent(sheet, rulesUrl) {
  let instruction = 'Откройте работу, чтобы посмотреть листы проекта.';
  if (sheet?.role === 'observer') instruction = 'Вам доступны листы проектов и полные версии работ в PDF.';
  else if (sheet && !sheet.accepting) instruction = 'Приём оценок закрыт. Вы можете посмотреть проекты и свои сохранённые оценки.';
  else if (sheet?.rubric === 'final_50_50') {
    instruction = sheet.role === 'technical'
      ? 'Оцените концепцию каждой работы по шкале от 0 до 5. Отдельно по той же шкале оцените реализуемость, эффективность, конструктивную логику и соответствие техническим требованиям объекта.'
      : 'Изучите проекты финалистов и оцените концепцию каждой работы по шкале от 0 до 5.';
  } else if (sheet) instruction = 'Изучите проекты и заполните оценочный лист в карточке каждой работы.';
  const url = rulesUrl ?? regulationsDocument(sheet?.regulations_url);
  return '<div class="jury-welcome"><p>Рады видеть вас в жюри конкурса «Меняя привычное»!</p><p>' + instruction + '</p>' +
    (url ? '<a class="regulations-link" data-regulations href="' + escape(url) + '" target="_blank" rel="noopener noreferrer">Регламент жюри</a>' : '') + '</div>';
}

export function signInContent({ next = '', login = '', message = '', logo = '/logo.svg',
  method = 'post', action = '/login', ready = true } = {}) {
  const feedback = message ? '<p id="login-error" class="form-error" role="alert">' + escape(message) + '</p>' : '';
  const passwordAttributes = message ? ' autofocus aria-describedby="login-error"' : '';
  return cabinetMarkup(`
<main class="sign-in-page">
  <section class="cover" aria-labelledby="contest">
    <div class="wrap hero">
      <img src="` + logo + `" width="398" alt="МТС и A–House">
      <h1 id="contest">Меняя<br>привычное</h1>
      <p>Третий этап конкурса</p>
    </div>
  </section>
  <section class="login-section" aria-labelledby="sign-in">
    <form class="login-card" method="` + method + `" action="` + action + `">
      <h2 id="sign-in" ` + opticalEdges('Вход для жюри') + `>Вход <span class="word-group">для<wbr> жюри</span></h2>
      <input type="hidden" name="next" value="` + escape(next) + `">
      <label for="login">Логин</label>
      <input id="login" name="login" autocomplete="username" autocapitalize="none" spellcheck="false" required maxlength="254" value="` + escape(login) + `">
      <label for="password">Пароль</label>
      <input id="password" name="password" type="password" autocomplete="current-password" required maxlength="1024"` + passwordAttributes + `>` + feedback + `
      <button class="primary"` + (ready ? '' : ' disabled') + `>Войти</button>
    </form>
  </section>
</main>`);
}

export function catalogueContent(works, href = id => '/works/' + id, scored = null, sheet, rulesUrl) {
  const links = works.map(work => {
    const saved = scored?.has(work.id);
    let status = '';
    if (saved !== undefined) {
      const tick = saved ? '<svg viewBox="0 0 65 65" focusable="false"><path d="m15.04 30.04 12.42 12.32 22.72-22.71" fill="none" stroke="currentColor" stroke-width="4"/></svg>' : '';
      status = '<span class="work-mark' + (saved ? ' is-scored' : '') + '" aria-hidden="true">' + tick + '</span>' +
        '<span class="sr-only">' + (saved ? 'Оценена' : 'Ожидает оценки') + '</span>';
    }
    return '<li><a class="work-link" id="' + work.id + '" href="' + href(work.id) + '"><span ' +
      opticalEdges(work.title) + '>' + escape(work.title) + '</span>' + status + '</a></li>';
  }).join('');
  const progress = scored ? '<p class="sheet-progress">Оценено ' + scored.size + ' из ' + works.length + '</p>' : '';
  return cabinetMarkup('<main class="scene"><div class="wrap content"><p class="stage">Третий этап</p>' + heading('Работы финалистов') + (sheet === undefined ? '' : welcomeContent(sheet, rulesUrl)) + progress + '<ul class="works">' + links + '</ul></div></main>');
}

export function workContent(work, {
  catalogueHref = '/works#' + work.id,
  returnLabel = 'К списку работ', galleryContent = '',
  pdfControl = '<a class="primary" href="/pdf/' + work.id + '">Открыть PDF</a>',
  votingContent = '<p class="status">Оценивание пока недоступно.</p>'
} = {}) {
  const megabytes = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 }).format(work.bytes / 1_000_000);
  return cabinetMarkup(`
<main class="scene"><div class="wrap content">
  <a class="return" href="` + catalogueHref + `">` + escape(returnLabel) + `</a>
  ` + heading(work.title) + `
  ` + galleryContent + `
  <div class="materials">
    ` + pdfControl + `
    <span>` + megabytes + ` МБ</span>
  </div>
  ` + votingContent + `
</div></main>`);
}

export function signInPage(options) {
  return page('Вход для жюри', signInContent(options));
}

export function cataloguePage(works) {
  return page('Работы финалистов', catalogueContent(works), true);
}

export function workPage(work) {
  return page(work.title, workContent(work), true);
}

export function statusPage(title, message) {
  return page(title, cabinetMarkup('<main class="scene"><div class="wrap content">' + heading(title) +
    '<p class="status">' + escape(message) + '</p><a href="/works">К работам</a></div></main>'));
}
