import { backend } from './config.js';
import { catalogueContent, headerContent, signInContent, workContent } from './views.js';

const cabinet = document.querySelector('#cabinet');
const formOptions = { logo: './logo.svg', method: 'dialog', action: '#' };
const workId = /^[a-f0-9]{24}$/;
const authError = 'Проверьте логин и пароль для кабинета жюри.';
let session;
let works = [];
let pendingPdf;
let pdfUrl;

function request(route, { method = 'GET', token, body, signal = AbortSignal.timeout(12000) } = {}) {
  const headers = { apikey: backend.publishableKey };
  if (token) headers.authorization = 'Bearer ' + token;
  if (body) headers['content-type'] = 'application/json';
  return fetch(backend.origin + route, {
    method, headers, signal, credentials: 'omit', cache: 'no-store', redirect: 'error',
    body: body ? JSON.stringify(body) : undefined
  });
}

function setSession({ access_token, refresh_token, expires_in }) {
  if (!access_token || !refresh_token || !Number.isFinite(expires_in)) throw new Error('Invalid session');
  session = { token: access_token, refresh: refresh_token, validUntil: Date.now() + expires_in * 1000 };
}

async function accessToken() {
  if (!session) return null;
  if (session.validUntil > Date.now() + 30000) return session.token;
  const starting = session;
  const response = await request('/auth/v1/token?grant_type=refresh_token', {
    method: 'POST', body: { refresh_token: starting.refresh }
  });
  if (session !== starting || !response.ok) return null;
  const refreshed = await response.json();
  if (session !== starting) return null;
  setSession(refreshed);
  return session.token;
}

function showSignIn({ login = '', message = '' } = {}) {
  cabinet.innerHTML = signInContent({ ...formOptions, login, message });
  document.title = 'Вход для жюри · Меняя привычное';
  const form = cabinet.querySelector('form');
  form.addEventListener('submit', signIn);
  if (message) form.querySelector('#password').focus();
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
  let message = authError;
  try {
    const response = await request('/auth/v1/token?grant_type=password', {
      method: 'POST', body: { email, password: fields.get('password') }
    });
    if ([400, 401, 403].includes(response.status)) return showSignIn({ login, message });
    if (!response.ok) throw new Error('Sign-in unavailable');
    setSession(await response.json());
    const result = await request('/rest/v1/jury_works?select=id,title,bytes&order=position', { token: session.token });
    if (!result.ok) throw new Error('Catalogue unavailable');
    const items = await result.json();
    if (Array.isArray(items) && items.length === 0) {
      message = 'Для этого аккаунта доступ к работам закрыт.';
    } else {
      if (!Array.isArray(items) || items.length !== 15 || !items.every(item =>
        workId.test(item.id) && typeof item.title === 'string' && Number.isSafeInteger(item.bytes) && item.bytes > 0)) {
        throw new Error('Incomplete catalogue');
      }
      works = items;
      showCatalogue();
      return;
    }
  } catch {
    message = 'Кабинет временно недоступен. Попробуйте войти ещё раз.';
  }
  leave({ login, message });
}

function clearPdf() {
  if (pendingPdf) {
    pendingPdf.abort.abort();
    pendingPdf.preview?.close();
    pendingPdf = null;
  }
  if (pdfUrl) {
    URL.revokeObjectURL(pdfUrl);
    pdfUrl = null;
  }
}

function showCatalogue() {
  clearPdf();
  if (!session || !works.length) return;
  const [, kind, id] = /^#(work|list)\/([a-f0-9]{24})$/.exec(location.hash) ?? [];
  const work = kind === 'work' ? works.find(item => item.id === id) : null;
  const content = work ? workContent(work, {
    catalogueHref: '#list/' + work.id,
    pdfControl: '<button type="button" class="primary" id="open-pdf">Открыть PDF</button>'
  }) : catalogueContent(works, workId => '#work/' + workId);
  cabinet.innerHTML = headerContent(formOptions) + content;
  document.title = (work?.title ?? 'Работы финалистов') + ' · Меняя привычное';
  cabinet.querySelector('header form').addEventListener('submit', event => {
    event.preventDefault();
    leave();
  });
  const focus = (kind === 'list' && document.getElementById(id)) || cabinet.querySelector('main h1');
  if (focus.tagName === 'H1') focus.tabIndex = -1;
  focus.focus();
  if (work) cabinet.querySelector('#open-pdf').addEventListener('click', event => openPdf(work, event.currentTarget));
}

function leave(feedback) {
  const token = session?.token;
  session = null;
  works = [];
  clearPdf();
  if (token) request('/auth/v1/logout?scope=local', { method: 'POST', token }).catch(() => {});
  showSignIn(feedback);
}

async function openPdf(work, button) {
  if (pendingPdf) return;
  if (pdfUrl) URL.revokeObjectURL(pdfUrl);
  pdfUrl = null;
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
    const token = await accessToken();
    if (pendingPdf !== download) return;
    if (!token) return leave({ message: 'Войдите ещё раз, чтобы открыть работу.' });
    const response = await request('/storage/v1/object/authenticated/jury-final/' + work.id + '.pdf', {
      token, signal: download.abort.signal
    });
    if (!response.ok) throw new Error('PDF unavailable');
    const body = await response.blob();
    if (pendingPdf !== download) return;
    if (body.size !== work.bytes || body.type !== 'application/pdf') throw new Error('PDF incomplete');
    pdfUrl = URL.createObjectURL(body);
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
    notice.textContent = 'PDF не загрузился. Попробуйте открыть его ещё раз.';
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
showSignIn();
