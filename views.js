import { russianSpacing, typesetText } from './typography.js?v=ae28e7489f06';

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
  ['работ', 'ра\u00adбот'],
  ['конкурса!', 'кон\u00adкур\u00adса!']
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

export const projectsId = 'projects';

export function headerContent({ logo = '/logo.svg', method = 'post', action = '/logout', section, showRanking = false } = {}) {
  const link = (href, name, current) => '<a href="' + href + '"' + (section === current ? ' aria-current="page"' : '') + '>' + name + '</a>';
  const menu = section ? '<nav aria-label="Меню жюри">' + link('#' + projectsId, 'Работы', 'works') +
    (showRanking ? link('#rating', 'Мой рейтинг работ', 'rating') : '') + '</nav>' : '';
  return '<header class="masthead"><div class="wrap masthead-inner"><img src="' + logo +
    '" width="320" alt="МТС и A–House">' + menu + '<form method="' + method + '" action="' + action +
    '"><button>Выйти</button></form></div></header>';
}

export function regulationsDocument(url) {
  return typeof url === 'string' && /^https:\/\/disk\.360\.yandex\.ru\/[di]\/[\w-]+$/.test(url) ? url : null;
}

function juryIntroduction() {
  return `<section class="jury-introduction" aria-labelledby="jury-introduction-heading">
    <h2 class="jury-introduction-subtitle" id="jury-introduction-heading">3 этап конкурса «Меняя привычное»</h2>
    <div class="jury-introduction-stages">
      <p>Наш конкурс состоит из трёх этапов:</p>
      <ol class="jury-stages" role="list">
        <li><p class="jury-stage-heading"><strong>На первом этапе</strong> <span class="jury-stage-dates">(19.05–17.06)</span></p>
          <p>мы отобрали сильнейшие бюро по предоставленному ими портфолио.</p></li>
        <li><p class="jury-stage-heading"><strong>На втором этапе</strong> <span class="jury-stage-dates">(18.08–29.09)</span></p>
          <p>выбрали лучшие архитектурные концепции и эскизные работы.</p></li>
        <li><p class="jury-stage-heading"><strong>На третьем (текущем) этапе</strong> <span class="jury-stage-dates">(20.10–22.11)</span></p>
          <p>лучшие эскизные работы получили задание на детальную архитектурно-инженерную проработку своей концепции.</p></li>
      </ol>
    </div>
    <p>По итогам конкурса мы проведем выставку лучших работ, а одну или несколько представленных концепций МТС планирует реализовать.</p>
  </section>`;
}

function welcomeContent(sheet, rulesUrl) {
  let instruction;
  if (sheet?.role === 'observer') {
    instruction = '<p>Вам доступны листы проектов и полные версии работ в PDF.</p>';
  } else if (sheet && !sheet.accepting) {
    instruction = '<p>Приём оценок закрыт. Вы можете посмотреть проекты и свои сохранённые оценки.</p>';
  } else if (!sheet) {
    instruction = '<p>Откройте работу, чтобы посмотреть листы проекта.</p>';
  } else {
    instruction = '<p>У вас есть доступ ко всем работам текущего этапа. <strong>До 9 декабря</strong> включительно необходимо самостоятельно ознакомиться со всеми представленными концепциями, выставить оценки по заданным критериям и определить фаворитов в четырех номинациях.</p>' +
      '<p>После индивидуальной оценки работ мы проведем общую встречу с членами жюри 14 декабря в Доме <span class="word-group">A-House</span>. На встрече обсудим фаворитов, рассмотрим проекты, набравшие наибольшее количество баллов, а также разберём спорные и интересные решения.</p>' +
      '<p>В случае равенства голосов финальное решение остаётся за Председателем жюри.</p>';
  }
  const url = rulesUrl ?? regulationsDocument(sheet?.regulations_url);
  const rulesButton = url
    ? '<a class="primary rules-button" data-regulations href="' + escape(url) + '" target="_blank" rel="noopener noreferrer">Регламент жюри</a>'
    : '';
  return '<section class="welcome"><div class="wrap content pagehead">' +
    heading('Рады видеть вас в составе жюри конкурса!') + juryIntroduction() +
    '<div class="intro"><div class="step"><div class="step-head"><span class="num" aria-hidden="true">01</span>' + rulesButton + '</div>' +
    (url ? '<p>Перед началом оценки вы можете ознакомиться с подробным регламентом жюри.</p>' : '<p>Регламент пока недоступен.</p>') +
    '</div><div class="step"><div class="step-head"><span class="num" aria-hidden="true">02</span>' +
    '<div class="materials"><button type="button" class="primary rules-button" data-brief>Задание третьего этапа</button></div></div>' +
    instruction +
    '</div></div></div></section>';
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
      <div class="cover-subtitle">
        <h2>Третий этап конкурса</h2>
        <p>Оценка архитектурных концепций опор базовых станций связи</p>
      </div>
    </div>
  </section>
  <section class="login-section" aria-labelledby="sign-in">
    <form class="login-card" method="` + method + `" action="` + action + `">
      <h2 id="sign-in" ` + opticalEdges('Вход для жюри') + `>Вход <span class="word-group">для<wbr> жюри</span></h2>
      <input type="hidden" name="next" value="` + escape(next) + `">
      <label class="sr-only" for="login">Логин</label>
      <input id="login" name="login" placeholder="Логин" autocomplete="username" autocapitalize="none" spellcheck="false" required maxlength="254" value="` + escape(login) + `">
      <label class="sr-only" for="password">Пароль</label>
      <input id="password" name="password" placeholder="Пароль" type="password" autocomplete="current-password" required maxlength="1024"` + passwordAttributes + `>` + feedback + `
      <button class="primary"` + (ready ? '' : ' disabled') + `>Войти</button>
    </form>
    <p class="login-hint">Войдите с логином и паролем, выданными для участия в жюри.</p>
  </section>
</main>`);
}

export function workNumber(index) {
  return String(index + 1).padStart(2, '0');
}

export const checkIcon = '<svg viewBox="0 0 65 65" focusable="false"><path d="m15.04 30.04 12.42 12.32 22.72-22.71" fill="none" stroke="currentColor" stroke-width="4"/></svg>';

export function catalogueContent(works, href = id => '/works/' + id, scored = null, sheet, rulesUrl) {
  const links = works.map((work, index) => {
    const saved = scored?.has(work.id);
    let status = '';
    if (saved !== undefined) {
      const tick = saved ? checkIcon : '';
      status = '<span class="work-mark' + (saved ? ' is-scored' : '') + '" aria-hidden="true">' + tick + '</span>' +
        '<span class="sr-only">' + (saved ? 'Оценена' : 'Ожидает оценки') + '</span>';
    }
    return '<li><a class="work-link" id="' + work.id + '" href="' + href(work.id) + '"><span class="work-number">' +
      workNumber(index) + '</span><span ' +
      opticalEdges(work.title) + '>' + escape(work.title) + '</span>' + status + '</a></li>';
  }).join('');
  const progress = scored ? '<p class="sheet-progress">Оценено ' + scored.size + ' из ' + works.length + '</p>' : '';
  return cabinetMarkup('<main class="scene catalogue">' + (sheet === undefined ? '' : welcomeContent(sheet, rulesUrl)) +
    '<section class="projects-section" id="' + projectsId + '" aria-labelledby="projects-heading" tabindex="-1">' +
    '<div class="wrap content projects"><div class="section-head">' +
    heading('Проекты\nучаст\u00adни\u00adков', sheet === undefined ? 1 : 2, 'projects-heading') + progress +
    '</div><ul class="works project-list">' + links + '</ul></div></section></main>');
}

export function workNavigation({ previousHref, nextHref }) {
  const arrow = '<span class="work-neighbor-arrow" aria-hidden="true"></span>';
  const link = (href, direction, label) => href
    ? '<a rel="' + direction + '" href="' + escape(href) + '" aria-label="' + label + ' работа">' +
      arrow + '<span class="work-neighbor-label">' + label + '<span class="work-neighbor-noun"> работа</span></span></a>'
    : '';
  const previous = link(previousHref, 'prev', 'Предыдущая');
  const next = link(nextHref, 'next', 'Следующая');
  return previous || next
    ? cabinetMarkup('<nav class="work-neighbors" aria-label="Соседние работы">' + previous + next + '</nav>') : '';
}

export function workContent(work, {
  catalogueHref = '/works#' + work.id,
  returnLabel = 'К списку работ', galleryContent = '',
  navigationContent = '', hostedPdf = false,
  votingContent = '<p class="status">Оценивание пока недоступно.</p>'
} = {}) {
  const megabytes = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 }).format(work.bytes / 1_000_000);
  const pdfTag = hostedPdf ? 'button' : 'a';
  const pdfAttributes = hostedPdf ? ' type="button" id="open-pdf"' : ' href="/pdf/' + work.id + '"';
  return cabinetMarkup(`
<main class="scene work-scene"><div class="work-gallery"><div class="wrap content">
  ` + heading(work.title) + `
  ` + galleryContent + `
  <div class="materials"><div class="work-pdf-group">
    <` + pdfTag + pdfAttributes + ` class="primary work-pdf" aria-labelledby="work-pdf-label" aria-describedby="work-pdf-size">
      <span id="work-pdf-label">Открыть PDF</span>
    </` + pdfTag + `>
    <small id="work-pdf-size">` + megabytes + ` МБ</small>
  </div></div>
  <a class="return work-return" href="` + catalogueHref + `">` + escape(returnLabel) + `</a>
</div></div>
<div class="work-ballot"><div class="wrap content">
  ` + votingContent + navigationContent + `
</div></div></main>`);
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
