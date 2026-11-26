import { backend } from './config.js?v=3a58cc80d9eb';
import { catalogueContent, headerContent, signInContent, workContent } from './views.js?v=3a58cc80d9eb';
import { FinalVoting } from './voting.js?v=3a58cc80d9eb';

const cabinet = document.querySelector('#cabinet');
const formOptions = { logo: './logo.svg', method: 'dialog', action: '#' };
const workId = /^[a-f0-9]{24}$/;
const authError = 'Проверьте логин и пароль для кабинета жюри.';
let session;
let works = [];
let pendingPdf;
let cachedPdf;
let voting;
const loginKey = 'jury.login.v1';

function request(route, { method = 'GET', token, body, signal = AbortSignal.timeout(12000) } = {}) {
  const headers = { apikey: backend.publishableKey };
  if (token) headers.authorization = 'Bearer ' + token;
  if (body) headers['content-type'] = 'application/json';
  return fetch(backend.origin + route, {
    method, headers, signal, credentials: 'omit', cache: 'no-store', redirect: 'error',
    body: body ? JSON.stringify(body) : undefined
  });
}

function setSession({ access_token, refresh_token, expires_in, user }) {
  if (!access_token || !refresh_token || !Number.isFinite(expires_in) ||
      !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(user?.id)) throw new Error('Invalid session');
  session = { token: access_token, refresh: refresh_token, userId: user.id, validUntil: Date.now() + expires_in * 1000 };
}

async function accessToken() {
  if (!session) return null;
  if (session.validUntil > Date.now() + 30000) return session.token;
  const starting = session;
  starting.refreshing ??= (async () => {
    try {
      const response = await request('/auth/v1/token?grant_type=refresh_token', {
        method: 'POST', body: { refresh_token: starting.refresh }
      });
      if (session !== starting || !response.ok) return null;
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
  error.textContent = message;
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
    const sheet = new FinalVoting(async (rpc, body) => {
      const token = await accessToken();
      if (!token) throw new Error('Session expired');
      return request('/rest/v1/rpc/' + rpc, { method: 'POST', body, token });
    }, () => {
      if (voting === sheet && cabinet.querySelector('.works')) showCatalogue();
    }, session.userId);
    const [result] = await Promise.all([
      request('/rest/v1/jury_works?select=id,title,bytes&order=position', { token: session.token }),
      sheet.load().catch(() => {}) // Each work offers a retry if its score sheet was unavailable.
    ]);
    if (!result.ok) throw new Error('Catalogue unavailable');
    const items = await result.json();
    if (Array.isArray(items) && items.length === 0) {
      resetSession();
      signInError(form, 'Для этого аккаунта доступ к работам закрыт.', form.elements.login);
    } else {
      if (!Array.isArray(items) || items.length !== 15 || !items.every(item =>
        workId.test(item.id) && typeof item.title === 'string' && Number.isSafeInteger(item.bytes) && item.bytes > 0)) {
        throw new Error('Incomplete catalogue');
      }
      works = items;
      voting = sheet;
      showCatalogue();
    }
  } catch {
    resetSession();
    signInError(form, 'Кабинет временно недоступен. Попробуйте войти ещё раз.');
  }
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

function showCatalogue() {
  cancelDownload();
  if (!session || !works.length) return;
  const [, kind, id] = /^#(work|list)\/([a-f0-9]{24})$/.exec(location.hash) ?? [];
  const work = kind === 'work' ? works.find(item => item.id === id) : null;
  if (work && cachedPdf && cachedPdf.id !== work.id) forgetPdf();
  const content = work ? workContent(work, {
    catalogueHref: '#list/' + work.id,
    pdfControl: '<button type="button" class="primary" id="open-pdf">Открыть PDF</button>',
    votingContent: '<section class="ballot" id="voting" aria-label="Оценка работы"></section>'
  }) : catalogueContent(works, workId => '#work/' + workId, voting?.scored);
  cabinet.innerHTML = headerContent(formOptions) + content;
  document.title = (work?.title ?? 'Работы финалистов') + ' · Меняя привычное';
  cabinet.querySelector('header form').addEventListener('submit', event => {
    event.preventDefault();
    try { sessionStorage.removeItem(loginKey); } catch { /* Optional remembered login. */ }
    leave();
  });
  const focus = (kind === 'list' && document.getElementById(id)) || cabinet.querySelector('main h1');
  if (focus.tagName === 'H1') focus.tabIndex = -1;
  focus.focus();
  if (work) {
    cabinet.querySelector('#open-pdf').addEventListener('click', event => openPdf(work, event.currentTarget));
    voting?.mount(work.id, cabinet.querySelector('#voting'));
  }
}

function resetSession() {
  const token = session?.token;
  session = null;
  works = [];
  voting = null;
  cancelDownload();
  forgetPdf();
  if (token) request('/auth/v1/logout?scope=local', { method: 'POST', token }).catch(() => {});
}

function leave(feedback) {
  resetSession();
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
    const token = await accessToken();
    if (pendingPdf !== download) return;
    if (!token) return leave({ message: 'Войдите ещё раз, чтобы открыть работу.' });
    if (!cachedPdf || cachedPdf.id !== work.id) {
      const response = await request('/storage/v1/object/authenticated/jury-final/' + work.id + '.pdf', {
        token, signal: download.abort.signal
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
showSignIn({ initial: true });
