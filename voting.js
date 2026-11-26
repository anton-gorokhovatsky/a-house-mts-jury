import { escape } from './views.js?v=cfa66d84a2c5';

const generalScale = [
  'Отсутствует или невозможно оценить', 'Соответствует в минимальной степени',
  'Соответствует в меньшей степени', 'Соответствует не полностью', 'Соответствует в большой степени', 'Полностью соответствует'
];
const finalRubric = 'final_50_50';
const conceptScale = ['Отсутствует', 'Плохо / не соответствует', 'Неудовлетворительно / соответствует в меньшей степени',
  'Удовлетворительно / соответствует не полностью', 'Хорошо / соответствует в большой степени', 'Отлично / полностью соответствует'];
const feasibilityScale = ['Невозможно оценить', 'Не реализуемо', 'Скорее не реализуемо', 'Частично реализуемо', 'Скорее реализуемо', 'Реализуемо'];
const descriptions = {
  brief: 'Глубина проработки идеи и сила заложенных смыслов.',
  art: 'Оцените визуальное воплощение идеи с учётом выбранного подхода: интеграция в среду или выраженный акцент.',
  economics: 'CAPEX — затраты на строительство, OPEX — расходы на эксплуатацию.',
  concept: 'Оцените силу и потенциал идеи, заложенные смыслы и их визуальное воплощение с учётом выбранного подхода к интеграции объекта в пространство.',
  technical_review: 'Поставьте один балл за техническое решение в целом. Этот критерий заполняет представитель технического блока МТС.'
};
const conceptGuide = '<details class="scale"><summary>Что учитывать при оценке концепции</summary><ul class="guide-list">' +
  '<li>Чем авторы обосновали выбор концепции и что в ней нового?</li>' +
  '<li>Вызывает ли идея интерес и может ли стать предметом архитектурной или культурной дискуссии?</li>' +
  '<li>Насколько выразителен образ и какие эмоции он вызывает?</li>' +
  '<li>Передаёт ли визуальное решение заложенные смыслы? В чём его оригинальность?</li>' +
  '<li>Воспринимается ли объект как понятный, безопасный и дружелюбный? Ассоциируется ли он с комфортом?</li></ul></details>';
const nominations = [
  ['Лучшее контекстуальное решение', 'Как вышка становится естественной частью конкретного городского или природного ландшафта?'],
  ['Лучшее архитектурное высказывание', 'Оригинальный, запоминающийся образ переосмысляет облик телекоммуникационной инфраструктуры и может стать ориентиром или символом места.'],
  ['Лучшее масштабируемое решение', 'Оцените потенциал тиражирования, адаптацию к разным локациям и рациональное использование ресурсов при монтаже и эксплуатации.'],
  ['Лучший архитектурный эксперимент / виртуальное решение', 'Смелая концепция предлагает новую функцию, типологию, материал или пространственное решение. Для этой номинации реализуемость необязательна.']
];
const nominationsGuide = '<details class="scale nominations"><summary>Четыре номинации конкурса</summary><dl>' +
  nominations.map(([name, description]) => '<dt>' + escape(name) + '</dt><dd>' + escape(description) + '</dd>').join('') + '</dl></details>';

function scaleDetails(title, scale, note = '') {
  return '<details class="scale"><summary>' + title + '</summary><ul>' +
    scale.map((meaning, i) => '<li><b>' + i + '</b> — ' + meaning + '</li>').join('') +
    '</ul>' + (note ? '<p>' + note + '</p>' : '') + '</details>';
}

function field(criterion, answers, standardScale) {
  const key = escape(criterion.key);
  const selected = answers[criterion.key];
  const feasibility = criterion.key === 'feasibility' || criterion.key === 'technical_review';
  const choices = (feasibility ? feasibilityScale : standardScale).map((meaning, i) =>
    '<label class="score-choice"><input type="radio" name="' + key + '" value="' + i +
    '" aria-label="' + i + ' — ' + escape(meaning) + '" required' + (selected === i ? ' checked' : '') +
    '><span>' + i + '</span></label>').join('');
  const site = criterion.site_only ? '<label class="no-site"><input type="radio" name="' + key +
    '" value="na"' + (selected === null ? ' checked' : '') + '> Место размещения не определено</label>' : '';
  const help = descriptions[criterion.key];
  const specialScale = feasibility
    ? scaleDetails('Шкала реализуемости', feasibilityScale, 'По пункту 7.4 положения балл ниже 4 исключает призовое место и рекомендацию к реализации. При среднем балле ниже 2 работа также не рекомендуется к выставке.')
    : criterion.key === 'concept' ? conceptGuide : '';
  return '<fieldset class="criterion"><legend>' + escape(criterion.label) +
    ' <small>Вес ' + criterion.weight + ' %</small></legend>' +
    (help ? '<p class="criterion-help">' + escape(help) + '</p>' : '') + specialScale +
    '<div class="score-choices">' + choices + '</div>' + site + '</fieldset>';
}

const draftMessage = 'Черновик сохранён в этом браузере. Изменения ещё не отправлены.';
const tabDraftMessage = 'Черновик сохранён в этой вкладке до её закрытия. Изменения ещё не отправлены.';
const memoryDraftMessage = 'Браузер не может записать черновик. Оставьте страницу открытой до отправки оценки.';
const conflictMessage = 'Сохранённая оценка изменилась. Ваш черновик остался в форме. Можно скопировать свой текст перед загрузкой сохранённой версии.';
const stores = ['sessionStorage', 'localStorage'];

function sameBallot(a, b, criteria) {
  return b && a.comment === b.comment && criteria.every(({ key }) => a.answers[key] === b.answers[key]);
}

function readDraft(key, criteria) {
  for (const store of stores) {
    try {
      const raw = window[store].getItem(key);
      if (!raw) continue;
      const item = JSON.parse(raw);
      if (!Number.isSafeInteger(item.revision) || item.revision < 0 ||
          typeof item.comment !== 'string' || item.comment.length > 5000 ||
          !item.answers || typeof item.answers !== 'object' || Array.isArray(item.answers)) continue;
      const valid = Object.entries(item.answers).every(([name, value]) => {
        const criterion = criteria.find(c => c.key === name);
        return criterion && ((value === null && criterion.site_only) || (Number.isInteger(value) && value >= 0 && value <= 5));
      });
      if (valid) return { answers: item.answers, comment: item.comment, revision: item.revision, raw,
        message: store === 'localStorage' || readLocalCopy(key) === raw ? draftMessage : tabDraftMessage };
    } catch { /* The other storage or the server copy may still be available. */ }
  }
}

function readLocalCopy(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}

function rememberDraft(draft) {
  const { revision, answers, comment } = draft;
  draft.raw = JSON.stringify({ revision, answers, comment });
  let message = memoryDraftMessage;
  for (const store of stores) {
    try {
      window[store].setItem(draft.key, draft.raw);
      message = store === 'localStorage' ? draftMessage : tabDraftMessage;
    } catch { /* Keep the editable copy in memory when storage is full or blocked. */ }
  }
  return message;
}

function forgetDraft(draft) {
  if (!draft.raw) return;
  for (const store of stores) {
    try {
      const storage = window[store];
      if (storage.getItem(draft.key) === draft.raw) storage.removeItem(draft.key);
    } catch { /* A matching server ballot also supersedes a stale copy on next sign-in. */ }
  }
  delete draft.raw;
}

export class FinalVoting {
  constructor(call, onSaved, userId) {
    this.call = call;
    this.onSaved = onSaved;
    this.userId = userId;
    this.data = null;
    this.saved = new Map();
    this.drafts = new Map();
  }

  get scored() {
    return this.data && this.data.role !== 'observer' ? this.saved : null;
  }

  async load() {
    const response = await this.call('jury_final_rubric_sheet', { p_rubric: null });
    if (!response.ok) throw new Error('Sheet unavailable');
    const data = await response.json();
    if (!data || !['original', finalRubric].includes(data.rubric) ||
        !['juror', 'technical', 'observer'].includes(data.role) || !Array.isArray(data.criteria) ||
        !Array.isArray(data.ballots) || typeof data.accepting !== 'boolean' ||
        (data.role !== 'observer' && !data.criteria.length)) throw new Error('Invalid score sheet');
    if (this.data && this.data.rubric !== data.rubric) this.drafts.clear();
    this.data = data;
    this.saved = new Map(data.ballots.map(ballot => [ballot.work_id, ballot]));
  }

  mount(id, region) {
    this.current = { id, region };
    if (!this.data) {
      region.innerHTML = '<p role="status">Не удалось загрузить оценочный лист.</p><button type="button" class="secondary">Повторить загрузку</button>';
      region.querySelector('button').onclick = async event => {
        event.currentTarget.disabled = true;
        try { await this.load(); } catch { /* A fresh retry remains available. */ }
        if (region.isConnected) this.mount(id, region);
      };
      return;
    }
    if (this.data.role === 'observer') {
      region.innerHTML = '<p class="status">Этот аккаунт даёт доступ к просмотру работ.</p>';
      return;
    }
    const saved = this.saved.get(id);
    let draft = this.drafts.get(id);
    if (!draft) {
      const rubric = this.data.rubric;
      const key = 'jury.draft.v1/' + this.userId + '/' + rubric + '/' + id;
      draft = { key, rubric, answers: { ...saved?.answers }, comment: saved?.comment ?? '', revision: saved?.revision ?? 0 };
      const pending = readDraft(key, this.data.criteria);
      if (pending && sameBallot(pending, saved, this.data.criteria)) {
        forgetDraft({ key, raw: pending.raw });
      } else if (pending) {
        Object.assign(draft, pending);
        if (draft.revision !== (saved?.revision ?? 0)) {
          draft.conflict = true;
          draft.message = conflictMessage;
        }
      }
      this.drafts.set(id, draft);
    }
    const closed = !this.data.accepting;
    const updated = this.data.rubric === finalRubric;
    const standardScale = updated ? conceptScale : generalScale;
    const message = draft.message ?? (saved ? 'Оценка сохранена.' : '');
    const rules = this.data.regulations_url;
    const rulesLink = typeof rules === 'string' && /^https:\/\/disk\.360\.yandex\.ru\/d\/[\w-]+$/.test(rules)
      ? '<a class="ballot-rules" href="' + escape(rules) + '" target="_blank" rel="noopener noreferrer">Положение о работе жюри</a>' : '';
    const source = this.data.criteria_url;
    const criteriaLink = updated && typeof source === 'string' && /^https:\/\/docs\.google\.com\/document\/d\/[\w-]+(?:\/edit)?$/.test(source)
      ? '<a class="ballot-rules" href="' + escape(source) + '" target="_blank" rel="noopener noreferrer">Критерии третьего этапа</a>' : '';
    region.innerHTML = '<h2>Ваша оценка</h2>' +
      (closed ? '<p class="ballot-note">Голосование закрыто.</p>' : '') +
      (updated ? '<p class="ballot-note">Половину итогового балла даёт средняя оценка концепции членами жюри, вторую половину — техническая оценка МТС.</p>' : '') +
      scaleDetails(updated ? 'Шкала оценки концепции' : 'Как выставлять баллы', standardScale) +
      (updated ? '' : rulesLink) +
      '<form><fieldset class="ballot-fields"' + (closed || draft.saving ? ' disabled' : '') + '><legend class="sr-only">Оценочный лист</legend>' +
      this.data.criteria.map(c => field(c, draft.answers, standardScale)).join('') +
      '<label class="comment-label" for="ballot-comment">Комментарий <small>по желанию</small></label>' +
      '<textarea id="ballot-comment" name="comment" rows="3" maxlength="5000">' + escape(draft.comment) + '</textarea></fieldset>' +
      (closed ? '' : '<button class="primary save-ballot" type="submit"' + (draft.saving || draft.conflict ? ' disabled' : '') + '>' +
        (draft.saving ? 'Сохраняем…' : saved ? 'Сохранить изменения' : 'Сохранить оценку') + '</button>') +
      '<p class="ballot-feedback" role="status" aria-live="polite"></p>' +
      (draft.conflict ? '<button type="button" class="secondary" data-reload>' +
        (draft.rubricChanged ? 'Открыть действующий лист' : 'Загрузить сохранённую версию') + '</button>' : '') + '</form>' +
      (updated ? nominationsGuide + '<div class="ballot-sources">' + criteriaLink + rulesLink + '</div>' : '');
    const form = region.querySelector('form');
    const feedback = form.querySelector('[role="status"]');
    feedback.textContent = message;
    form.addEventListener('input', event => {
      const input = event.target;
      if (input.name === 'comment') draft.comment = input.value;
      else if (input.type === 'radio') draft.answers[input.name] = input.value === 'na' ? null : Number(input.value);
      let message;
      if (!draft.conflict && sameBallot(draft, saved, this.data.criteria)) {
        forgetDraft(draft);
        message = 'Оценка сохранена.';
      } else if (!saved && !draft.comment && !Object.keys(draft.answers).length) {
        forgetDraft(draft);
        message = '';
      } else {
        message = rememberDraft(draft);
      }
      if (!draft.conflict && feedback.textContent !== message) draft.message = feedback.textContent = message;
    });
    form.addEventListener('submit', event => {
      event.preventDefault();
      if (draft.conflict || draft.saving || !this.data.accepting || !form.reportValidity()) return;
      this.save(id, draft, region);
    });
    const reload = form.querySelector('[data-reload]');
    if (reload) reload.onclick = async () => {
      reload.disabled = true;
      form.querySelector('.ballot-fields').disabled = true;
      try {
        await this.load();
        forgetDraft(draft);
        this.drafts.delete(id);
        if (region.isConnected) this.mount(id, region);
      } catch {
        feedback.textContent = 'Загрузить сохранённую версию не удалось. Ваш ввод остался в форме.';
        form.querySelector('.ballot-fields').disabled = closed;
        reload.disabled = false;
      }
    };
  }

  async save(id, draft, region) {
    draft.saving = true;
    draft.message = 'Сохраняем…';
    const form = region.querySelector('form');
    form.querySelector('.ballot-fields').disabled = true;
    const button = form.querySelector('.save-ballot');
    button.disabled = true;
    button.textContent = 'Сохраняем…';
    form.querySelector('[role="status"]').textContent = draft.message;
    try {
      const response = await this.call('jury_save_rubric_ballot', {
        p_rubric: draft.rubric, p_work_id: id, p_answers: draft.answers, p_comment: draft.comment, p_revision: draft.revision
      });
      if (this.data.rubric !== draft.rubric) return;
      if (response.status === 412) {
        draft.conflict = true;
        draft.rubricChanged = true;
        draft.message = 'Организатор обновил критерии. Эта оценка не сохранена. Откройте действующий лист, чтобы оценить работу по новым правилам.';
      } else if (response.status === 409) {
        draft.conflict = true;
        draft.message = conflictMessage;
      } else if (response.status === 403 && (await response.json()).message === 'VOTING_CLOSED') {
        this.data.accepting = false;
        draft.message = 'Голосование закрыто. Изменения не сохранены.';
      } else {
        if (!response.ok) throw new Error('Save unavailable');
        const ballot = await response.json();
        if (ballot?.rubric !== draft.rubric || ballot.work_id !== id || !Number.isInteger(ballot.revision) ||
            ballot.revision < 1 || !ballot.answers || !sameBallot(draft, ballot, this.data.criteria)) throw new Error('Unconfirmed save');
        this.saved.set(id, ballot);
        forgetDraft(draft);
        draft.revision = ballot.revision;
        draft.message = 'Оценка сохранена.';
        this.onSaved();
      }
    } catch {
      draft.message = 'Сервер не подтвердил сохранение. Ваши ответы остались в форме. Попробуйте ещё раз.';
    } finally {
      draft.saving = false;
      if (this.current?.id === id && this.current.region.isConnected) {
        const target = this.current.region;
        this.mount(id, target);
        const feedback = target.querySelector('.ballot-feedback');
        if (feedback) {
          feedback.tabIndex = -1;
          feedback.focus({ preventScroll: true });
        }
      }
    }
  }
}
