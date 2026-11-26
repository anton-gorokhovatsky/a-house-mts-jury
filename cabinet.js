import { backend } from './config.js?v=ad245327f1c2';
import { cabinetMarkup, displayText, catalogueContent, headerContent, signInContent, workContent } from './views.js?v=ad245327f1c2';
import { FinalVoting } from './voting.js?v=ad245327f1c2';
import { FinalGallery } from './gallery.js?v=ad245327f1c2';
import { rankingContent } from './ranking.js?v=ad245327f1c2';

const cabinet = document.querySelector('#cabinet');
const formOptions = { logo: './logo.svg', method: 'dialog', action: '#' };
const workId = /^[a-f0-9]{24}$/;
const authError = 'Проверьте логин и пароль для кабинета жюри.';
let session;
let works = [];
let pendingPdf;
let cachedPdf;
let voting;
let gallery;
let closeGallery;
const loginKey = 'jury.login.v1';
const sessionKey = 'jury.session.v1/' + backend.origin;
const validUserId = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
let sessionEpoch = 0;

class AccessEnded extends Error {}

function readSession() {
  try {
    const item = JSON.parse(sessionStorage.getItem(sessionKey));
    if (typeof item?.token === 'string' && item.token && typeof item.refresh === 'string' && item.refresh &&
        Number.isFinite(item.validUntil) && validUserId.test(item.userId)) return item;
  } catch { /* Storage may be unavailable in this browser. */ }
  return null;
}

function request(route, { method = 'GET', token, body, range, signal = AbortSignal.timeout(12000) } = {}) {
  const headers = { apikey: backend.publishableKey };
  if (token) headers.authorization = 'Bearer ' + token;
  if (range) headers.range = range;
  if (body) headers['content-type'] = 'application/json';
  return fetch(backend.origin + route, {
    method, headers, signal, credentials: 'omit', cache: 'no-store', redirect: 'error',
    body: body ? JSON.stringify(body) : undefined
  });
}

function setSession({ access_token, refresh_token, expires_in, user }) {
  if (typeof access_token !== 'string' || !access_token || typeof refresh_token !== 'string' || !refresh_token ||
      !Number.isFinite(expires_in) || expires_in <= 0 || !validUserId.test(user?.id)) throw new Error('Invalid session');
  session = { token: access_token, refresh: refresh_token, userId: user.id, validUntil: Date.now() + expires_in * 1000 };
  try { sessionStorage.setItem(sessionKey, JSON.stringify(session)); } catch { /* In-memory sign-in still works. */ }
}

async function accessToken(force = false) {
  if (!session) return null;
  if (!force && session.validUntil > Date.now() + 30000) return session.token;
  const starting = session;
  starting.refreshing ??= (async () => {
    try {
      const response = await request('/auth/v1/token?grant_type=refresh_token', {
        method: 'POST', body: { refresh_token: starting.refresh }
      });
      if (session !== starting) return null;
      if ([400, 401, 403].includes(response.status)) throw new AccessEnded();
      if (!response.ok) throw new Error('Session refresh unavailable');
      const refreshed = await response.json();
      if (session !== starting) return null;
      setSession(refreshed);
      return session.token;
    } finally {
      starting.refreshing = null;
    }
  })();
  return starting.refreshing;
}

async function authorizedRequest(route, options = {}) {
  const epoch = sessionEpoch;
  try {
    const token = await accessToken();
    if (!token || epoch !== sessionEpoch) throw new AccessEnded();
    let response = await request(route, { ...options, token });
    if (response.status === 401 && epoch === sessionEpoch) {
      const renewed = await accessToken(session?.token === token);
      if (!renewed || epoch !== sessionEpoch) throw new AccessEnded();
      response = await request(route, { ...options, token: renewed });
      if (response.status === 401) throw new AccessEnded();
    }
    return response;
  } catch (error) {
    if (error instanceof AccessEnded && epoch === sessionEpoch) leave({ message: 'Срок входа истёк. Войдите ещё раз.' });
    throw error;
  }
}

function showSignIn({ message = '', initial = false } = {}) {
  if (!initial || !cabinet.querySelector('.login-card')) cabinet.innerHTML = signInContent({ ...formOptions, message });
  document.title = 'Вход для жюри · Меняя привычное';
  const form = cabinet.querySelector('form');
  const login = form.elements.login;
  try { if (!login.value) login.value = sessionStorage.getItem(loginKey) || ''; } catch { /* Optional on a shared device. */ }
  login.addEventListener('input', () => {
    try { sessionStorage.setItem(loginKey, login.value); } catch { /* The current form stays editable. */ }
  });
  form.querySelector('button').disabled = false;
  form.addEventListener('submit', signIn);
  if (message) form.querySelector('#password').focus();
}

function signInError(form, message, field) {
  const button = form.querySelector('button');
  button.disabled = false;
  button.textContent = 'Войти';
  let error = form.querySelector('#login-error');
  if (!error) {
    error = document.createElement('p');
    error.id = 'login-error';
    error.className = 'form-error';
    error.setAttribute('role', 'alert');
    button.before(error);
  }
  error.textContent = displayText(message);
  const target = field || button;
  target.setAttribute('aria-describedby', error.id);
  target.focus();
}

async function signIn(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button');
  if (button.disabled) return;
  const fields = new FormData(form);
  const login = fields.get('login').trim();
  const email = login.includes('@') ? login : login.toLowerCase() + '@jury.example.com';
  button.disabled = true;
  button.textContent = 'Входим…';
  form.querySelector('#login-error')?.remove();
  for (const element of form.querySelectorAll('[aria-describedby="login-error"]')) element.removeAttribute('aria-describedby');
  try {
    const response = await request('/auth/v1/token?grant_type=password', {
      method: 'POST', body: { email, password: fields.get('password') }
    });
    if ([400, 401, 403].includes(response.status)) return signInError(form, authError, form.elements.password);
    if (!response.ok) throw new Error('Sign-in unavailable');
    setSession(await response.json());
  } catch {
    return signInError(form, 'Кабинет временно недоступен. Попробуйте войти ещё раз.');
  }
  await openCabinet();
}

function sessionNotice(message, retry) {
  cabinet.innerHTML = headerContent(formOptions) + cabinetMarkup('<main class="scene"><div class="wrap content">' +
    '<p role="status">' + message + '</p>' + (retry ? '<button class="secondary" data-retry>Повторить загрузку</button>' : '') +
    '</div></main>');
  bindLogout();
  if (retry) cabinet.querySelector('[data-retry]').onclick = openCabinet;
}

async function openCabinet() {
  const epoch = sessionEpoch;
  sessionNotice('Открываем кабинет…', false);
  const sheet = new FinalVoting((rpc, body) => authorizedRequest('/rest/v1/rpc/' + rpc, { method: 'POST', body }), () => {
    if (voting === sheet && (cabinet.querySelector('.works') || location.hash.startsWith('#rating') && !cabinet.querySelector('#voting'))) showCatalogue();
  }, session.userId);
  try {
    const [result] = await Promise.all([
      authorizedRequest('/rest/v1/jury_works?select=id,title,bytes&order=position'),
      sheet.load().catch(() => {}) // A work can retry its score sheet independently.
    ]);
    if (epoch !== sessionEpoch) return;
    if (result.status === 403) return leave({ message: 'Для этого аккаунта доступ к работам закрыт.' });
    if (!result.ok) throw new Error('Catalogue unavailable');
    const items = await result.json();
    if (epoch !== sessionEpoch) return;
    if (Array.isArray(items) && items.length === 0) return leave({ message: 'Для этого аккаунта доступ к работам закрыт.' });
    if (!Array.isArray(items) || items.length !== 15 || !items.every(item =>
      workId.test(item.id) && typeof item.title === 'string' && Number.isSafeInteger(item.bytes) && item.bytes > 0)) {
      throw new Error('Incomplete catalogue');
    }
    works = items;
    voting = sheet;
    gallery = new FinalGallery(authorizedRequest);
    showCatalogue();
  } catch {
    if (epoch === sessionEpoch) sessionNotice('Не удалось загрузить кабинет. Можно повторить попытку.', true);
  }
}

function bindLogout() {
  cabinet.querySelector('header form').addEventListener('submit', event => {
    event.preventDefault();
    try { sessionStorage.removeItem(loginKey); } catch { /* Optional remembered login. */ }
    leave(undefined, true);
  });
}

function cancelDownload() {
  if (pendingPdf) {
    pendingPdf.abort.abort();
    pendingPdf.preview?.close();
    pendingPdf = null;
  }
}

function forgetPdf() {
  if (cachedPdf) URL.revokeObjectURL(cachedPdf.url);
  cachedPdf = null;
}

let rulesLookup;

function linkRegulations() {
  const folder = voting?.data?.regulations_url;
  if (typeof folder !== 'string' || !/^https:\/\/disk\.360\.yandex\.ru\/d\/[\w-]+$/.test(folder)) return;
  if (rulesLookup?.folder !== folder) {
    const api = new URL('https://cloud-api.yandex.net/v1/disk/public/resources');
    api.searchParams.set('public_key', folder);
    api.searchParams.set('fields', '_embedded.items.name,_embedded.items.mime_type,_embedded.items.public_url');
    const file = fetch(api, { credentials: 'omit', referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(6000) })
      .then(async response => response.ok ? (await response.json())._embedded?.items : null)
      .then(items => items?.find(item => item.name === 'Положение_о_работе_Жюри_Меняя_привычное.pdf' &&
        item.mime_type === 'application/pdf')?.public_url)
      .catch(() => null);
    rulesLookup = { folder, file };
  }
  const current = rulesLookup;
  current.file.then(url => {
    if (rulesLookup !== current) return;
    if (typeof url !== 'string' || !/^https:\/\/(?:yadi\.sk|disk\.(?:360\.)?yandex\.ru)\/i\/[\w-]+$/.test(url)) return;
    for (const link of cabinet.querySelectorAll('a[data-regulations]')) if (link.href === folder) link.href = url;
  });
}

function showCatalogue() {
  cancelDownload();
  closeGallery?.();
  closeGallery = null;
  if (!session || !works.length) return;
  const [route, query = ''] = location.hash.slice(1).split('?');
  const [area, part, detail] = route.split('/');
  const fromRanking = area === 'rating' && part === 'work';
  const id = fromRanking ? detail : part;
  const work = (area === 'work' || fromRanking) && works.find(item => item.id === id);
  const ranked = area === 'rating' && !work;
  const sort = new URLSearchParams(query).get('by');
  const suffix = sort && voting.data?.criteria.some(c => c.key === sort) ? '?by=' + encodeURIComponent(sort) : '';
  let content;
  if (work) {
    if (cachedPdf && cachedPdf.id !== work.id) forgetPdf();
    content = workContent(work, {
      catalogueHref: fromRanking ? '#rating/' + work.id + suffix : '#list/' + work.id,
      returnLabel: fromRanking ? 'К моему рейтингу' : 'К списку работ',
      galleryContent: '<section class="sheets" aria-label="Материалы проекта"></section>',
      pdfControl: '<button type="button" class="primary" id="open-pdf">Открыть PDF</button>',
      votingContent: '<section class="ballot" id="voting" aria-label="Оценка работы"></section>'
    });
  } else if (ranked) {
    content = rankingContent(works, voting, sort);
  } else {
    content = catalogueContent(works, key => '#work/' + key, voting.scored, voting.data);
    if (!voting.data) content = content.replace('</ul>', '</ul><p class="status">Не удалось загрузить регламент и ваши оценки.</p>' +
      '<button type="button" class="secondary" data-retry>Повторить загрузку</button>');
  }
  const section = work ? 'work' : ranked ? 'rating' : 'works';
  cabinet.innerHTML = headerContent({ ...formOptions, section, showRanking: voting.data?.role !== 'observer' }) + content;
  document.title = (work?.title ?? (ranked ? 'Мой рейтинг работ' : 'Работы финалистов')) + ' · Меняя привычное';
  bindLogout();
  const focusId = area === 'list' ? id : ranked && workId.test(part || '') ? 'rank-' + part : null;
  const focus = (focusId && document.getElementById(focusId)) || cabinet.querySelector('main h1');
  if (focus.tagName === 'H1') focus.tabIndex = -1;
  focus.focus();
  const retry = cabinet.querySelector('[data-retry]');
  if (retry) retry.onclick = openCabinet;
  const order = cabinet.querySelector('#ranking-order');
  if (order) order.onchange = () => {
    history.replaceState(null, '', '#rating?by=' + encodeURIComponent(order.value));
    showCatalogue();
    cabinet.querySelector('#ranking-order')?.focus();
  };
  if (work) {
    cabinet.querySelector('#open-pdf').addEventListener('click', event => openPdf(work, event.currentTarget));
    closeGallery = gallery.mount(cabinet.querySelector('.sheets'), work);
    voting.mount(work.id, cabinet.querySelector('#voting'));
  }
  linkRegulations();
}

function resetSession(revoke) {
  sessionEpoch++;
  try { sessionStorage.removeItem(sessionKey); } catch { /* Storage may be disabled. */ }
  const token = session?.token;
  session = null;
  works = [];
  voting = null;
  closeGallery?.();
  closeGallery = null;
  gallery = null;
  rulesLookup = null;
  cancelDownload();
  forgetPdf();
  if (revoke && token) request('/auth/v1/logout?scope=local', { method: 'POST', token }).catch(() => {});
}

function leave(feedback, revoke = false) {
  resetSession(revoke);
  showSignIn(feedback);
}

async function openPdf(work, button) {
  if (pendingPdf) return;
  const oldLink = cabinet.querySelector('#pdf-link');
  oldLink?.remove();
  const preview = window.open('about:blank', '_blank');
  if (preview) {
    preview.opener = null;
    preview.document.title = 'Загрузка PDF';
    preview.document.body.textContent = 'Загружаем PDF…';
  }
  const download = { preview, abort: new AbortController() };
  pendingPdf = download;
  button.disabled = true;
  button.textContent = 'Загружаем PDF…';
  let notice = cabinet.querySelector('#pdf-notice');
  if (!notice) {
    notice = document.createElement('p');
    notice.id = 'pdf-notice';
    notice.className = 'status';
    notice.setAttribute('role', 'status');
    button.closest('.materials').after(notice);
  }
  notice.textContent = '';
  try {
    if (!cachedPdf || cachedPdf.id !== work.id) {
      const response = await authorizedRequest('/storage/v1/object/authenticated/jury-final/' + work.id + '.pdf', {
        signal: download.abort.signal
      });
      if (!response.ok) throw new Error('PDF unavailable');
      const body = await response.blob();
      if (pendingPdf !== download) return;
      if (body.size !== work.bytes || body.type !== 'application/pdf') throw new Error('PDF incomplete');
      forgetPdf();
      cachedPdf = { id: work.id, url: URL.createObjectURL(body) };
    }
    const pdfUrl = cachedPdf.url;
    if (preview && !preview.closed) preview.location.replace(pdfUrl);
    else {
      const link = document.createElement('a');
      link.id = 'pdf-link';
      link.href = pdfUrl;
      link.target = '_blank';
      link.rel = 'noopener';
      link.textContent = 'Открыть загруженный PDF';
      notice.append(link);
      link.focus();
    }
  } catch {
    if (pendingPdf !== download) return;
    preview?.close();
    notice.textContent = displayText('PDF не загрузился. Попробуйте открыть его ещё раз.');
  } finally {
    if (pendingPdf === download) {
      pendingPdf = null;
      button.disabled = false;
      button.textContent = 'Открыть PDF';
      if (!notice.textContent) notice.remove();
    }
  }
}

window.addEventListener('hashchange', showCatalogue);
session = readSession();
if (session) openCabinet();
else showSignIn({ initial: true });
