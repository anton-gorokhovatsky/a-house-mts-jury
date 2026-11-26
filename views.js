const escape = value => String(value).replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[character]));

function page(title, content, signedIn = false) {
  const navigation = signedIn ? headerContent() : '';
  return '<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow"><title>' +
    escape(title) + ' · Меняя привычное</title><link rel="stylesheet" href="/cabinet.css"></head><body>' +
    navigation + content + '</body></html>';
}

export function headerContent({ logo = '/logo.svg', method = 'post', action = '/logout' } = {}) {
  return '<header class="masthead"><div class="wrap masthead-inner"><img src="' + logo +
    '" width="320" alt="МТС и A–House"><form method="' + method + '" action="' + action +
    '"><button>Выйти</button></form></div></header>';
}

export function signInContent({ next = '', login = '', message = '', logo = '/logo.svg',
  method = 'post', action = '/login' } = {}) {
  const feedback = message ? '<p id="login-error" class="form-error" role="alert">' + escape(message) + '</p>' : '';
  const passwordAttributes = message ? ' autofocus aria-describedby="login-error"' : '';
  return `
<main>
  <section class="cover" aria-labelledby="contest">
    <div class="wrap hero">
      <img src="` + logo + `" width="398" alt="МТС и A–House">
      <h1 id="contest">Меняя<br>привычное</h1>
      <p>Третий этап конкурса</p>
    </div>
  </section>
  <section class="login-section" aria-labelledby="sign-in">
    <form class="login-card" method="` + method + `" action="` + action + `">
      <h2 id="sign-in">Вход для жюри</h2>
      <input type="hidden" name="next" value="` + escape(next) + `">
      <label for="login">Логин</label>
      <input id="login" name="login" autocomplete="username" autocapitalize="none" spellcheck="false" required maxlength="254" value="` + escape(login) + `">
      <label for="password">Пароль</label>
      <input id="password" name="password" type="password" autocomplete="current-password" required maxlength="1024"` + passwordAttributes + `>
      ` + feedback + `
      <button class="primary">Войти</button>
    </form>
  </section>
</main>`;
}

export function catalogueContent(works, href = id => '/works/' + id) {
  const links = works.map(work => '<li><a class="work-link" id="' + work.id + '" href="' + href(work.id) + '">' +
    escape(work.title) + '</a></li>').join('');
  return '<main class="scene"><div class="wrap content"><p class="stage">Третий этап</p><h1>Работы финалистов</h1><ul class="works">' + links + '</ul></div></main>';
}

export function workContent(work, {
  catalogueHref = '/works#' + work.id,
  pdfControl = '<a class="primary" href="/pdf/' + work.id + '">Открыть PDF</a>'
} = {}) {
  const megabytes = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 }).format(work.bytes / 1_000_000);
  return `
<main class="scene"><div class="wrap content">
  <a class="return" href="` + catalogueHref + `">К списку работ</a>
  <h1>` + escape(work.title) + `</h1>
  <div class="materials">
    ` + pdfControl + `
    <span>` + megabytes + ` МБ</span>
  </div>
  <p class="status">Оценивание пока недоступно.</p>
</div></main>`;
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
  return page(title, '<main class="scene"><div class="wrap content"><h1>' + escape(title) +
    '</h1><p class="status">' + escape(message) + '</p><a href="/works">К работам</a></div></main>');
}
