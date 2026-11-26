import { cabinetMarkup, displayText, escape } from './views.js?v=c8ea598cdf1b';
import {
  approachesIntro, approachRules, conceptHeading, conceptIntro, conceptQuestions, conceptScale, conceptScaleIntro,
  criterionTitles, distinction, distinctionHeading, nominations, nominationsTitle, technicalNotes
} from './criteria.js?v=c8ea598cdf1b';

const generalScale = [
  'Отсутствует или невозможно оценить', 'Соответствует в минимальной степени',
  'Соответствует в меньшей степени', 'Соответствует не полностью', 'Соответствует в большой степени', 'Полностью соответствует'
];
const finalRubric = 'final_50_50';
const feasibilityScale = ['Невозможно оценить', 'Не реализуемо', 'Скорее не реализуемо / нет уверенности в реализации', 'Частично реализуемо', 'Скорее реализуемо', 'Реализуемо'];
const descriptions = {
  brief: 'Глубина проработки идеи и сила заложенных смыслов.',
  art: 'Оцените визуальное воплощение идеи с учётом выбранного подхода: интеграция в среду или выраженный акцент.',
  economics: 'CAPEX — затраты на строительство, OPEX — расходы на эксплуатацию.'
};

function disclosure(title, content, className = '') {
  return '<details class="scale ' + className + '"><summary>' + escape(title) + '</summary><div class="scale-body">' + content + '</div></details>';
}

const paragraphs = lines => lines.map(line => '<p>' + escape(line) + '</p>').join('');
const conceptGuide = disclosure('Что учитывать при оценке концепции', paragraphs([conceptHeading, conceptIntro]) +
  '<ul class="guide-list">' + conceptQuestions.map(text => '<li>' + escape(text) + '</li>').join('') + '</ul>' +
  paragraphs([approachesIntro]) + '<a href="' + approachRules + '" target="_blank" rel="noopener noreferrer">Пункт 6.1 правил конкурса</a>');
const nominationsGuide = disclosure(nominationsTitle,
  nominations.map(item => '<section><h3>' + escape(item.name) + '</h3>' + paragraphs(item.paragraphs) + '</section>').join('') +
  '<section><h4>' + escape(distinctionHeading) + '</h4>' + paragraphs([distinction]) + '</section>', 'nominations');

function weightTable(criteria) {
  const rows = Object.entries(criterionTitles).map(([key, title], i) => {
    // A juror only receives their own fields. Both published weights are in the source table.
    const weight = criteria.find(item => item.key === key)?.weight ?? 50;
    return '<tr><th scope="row">' + (i + 1) + '</th><td>' + escape(title) +
      (key === 'technical_review' ? paragraphs(technicalNotes) : '') + '</td><td>' + weight + '</td></tr>';
  });
  return disclosure('Критерии оценки', '<table class="rubric-weights"><thead><tr><th>№</th><th>Критерий оценки</th><th>Вес (%)</th></tr></thead>' +
    '<tbody>' + rows.join('') + '</tbody><tfoot><tr><td></td><th scope="row">ИТОГО</th><td>100</td></tr></tfoot></table>');
}

function scaleDetails(title, scale, { intro = '', descending = false, notes, source = '' } = {}) {
  const rows = scale.map((meaning, i) =>
    '<li><span class="scale-number">' + i + '</span> <span aria-hidden="true">–</span> <span>' + escape(meaning) + (notes ? '<span class="scale-explanation">' + escape(notes[i]) + '</span>' : '') + '</span></li>');
  if (descending) rows.reverse();
  return disclosure(title, (intro ? paragraphs([intro]) : '') + '<ul class="scale-values">' + rows.join('') + '</ul>' +
    source);
}

const feasibilityNote = 'Критерий «реализуемость и конструктивная логика» является первичным. Невозможность реализации Конкурсной Работы является блокирующим фактором для признания ее автора Победителем Конкурса независимо от оценок по иным критериям. Критерий оценивает член Жюри – представитель технического блока Партнера Конкурса по следующей шкале. Работа, средняя оценка которой по данному критерию (пункт 7.6 настоящего Положения) составляет менее 4 (четырех) баллов, не может занять призовое место и быть рекомендована к реализации; работа со средней оценкой менее 2 (двух) баллов также не рекомендуется к участию в выставке:';

// Section 7.4 of the jury regulations gives the consequences for each feasibility score.
const noPrize = 'не дает возможности стать Победителем Конкурса и претендовать на реализацию,';
const prize = 'дает возможность стать Победителем Конкурса и претендовать на реализацию,';
const noExhibition = 'не дает возможности участвовать в выставке при соответствующем решении Партнера и Организатора.';
const exhibition = 'дает возможность участвовать в выставке при соответствующем решении Партнера и Организатора.';
const feasibilityDetails = [
  noPrize + ' ' + noExhibition, noPrize + ' ' + noExhibition,
  noPrize + ' ' + exhibition, noPrize + ' ' + exhibition,
  prize + ' ' + exhibition, prize + ' ' + exhibition
];

function field(criterion, answers, standardScale, updated, regulationsUrl) {
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
    ? scaleDetails('Шкала реализуемости', feasibilityScale, {
      intro: feasibilityNote, notes: feasibilityDetails,
      source: regulationsUrl ? '<a href="' + escape(regulationsUrl) +
        '" target="_blank" rel="noopener noreferrer">Положение о работе жюри, п. 7.4</a>' : ''
    })
    : criterion.key === 'concept' ? conceptGuide : '';
  return '<fieldset class="criterion"><legend>' + escape((updated && criterionTitles[criterion.key]) || criterion.label) +
    ' <small>Вес ' + criterion.weight + ' %</small></legend>' +
    (help ? '<p class="criterion-help">' + escape(help) + '</p>' : '') +
    (updated && criterion.key === 'technical_review' ? paragraphs(technicalNotes) : '') + specialScale +
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
      region.innerHTML = cabinetMarkup('<p role="status">Не удалось загрузить оценочный лист.</p><button type="button" class="secondary">Повторить загрузку</button>');
      region.querySelector('button').onclick = async event => {
        event.currentTarget.disabled = true;
        try { await this.load(); } catch { /* A fresh retry remains available. */ }
        if (region.isConnected) this.mount(id, region);
      };
      return;
    }
    if (this.data.role === 'observer') {
      region.innerHTML = cabinetMarkup('<p class="status">Этот аккаунт даёт доступ к просмотру работ.</p>');
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
    const validRules = typeof rules === 'string' && /^https:\/\/disk\.360\.yandex\.ru\/d\/[\w-]+$/.test(rules);
    const rulesLink = validRules
      ? '<a class="ballot-rules" href="' + escape(rules) + '" target="_blank" rel="noopener noreferrer">Положение о работе жюри</a>' : '';
    const source = this.data.criteria_url;
    const criteriaLink = updated && typeof source === 'string' && /^https:\/\/docs\.google\.com\/document\/d\/[\w-]+(?:\/edit)?$/.test(source)
      ? '<a class="ballot-rules" href="' + escape(source) + '" target="_blank" rel="noopener noreferrer">Критерии третьего этапа</a>' : '';
    region.innerHTML = cabinetMarkup('<h2>Ваша оценка</h2>' +
      (closed ? '<p class="ballot-note">Голосование закрыто.</p>' : '') +
      (updated ? weightTable(this.data.criteria) : '') +
      scaleDetails(updated ? 'Шкала оценки концепции' : 'Как выставлять баллы', standardScale, { intro: updated ? conceptScaleIntro : '', descending: updated }) +
      (updated ? '' : rulesLink) +
      '<form><fieldset class="ballot-fields"' + (closed || draft.saving ? ' disabled' : '') + '><legend class="sr-only">Оценочный лист</legend>' +
      this.data.criteria.map(c => field(c, draft.answers, standardScale, updated, validRules ? rules : null)).join('') +
      '<label class="comment-label" for="ballot-comment">Комментарий <small>по желанию</small></label>' +
      '<textarea id="ballot-comment" name="comment" rows="3" maxlength="5000">\n' + escape(draft.comment) + '</textarea></fieldset>' +
      (closed ? '' : '<button class="primary save-ballot" type="submit"' + (draft.saving || draft.conflict ? ' disabled' : '') + '>' +
        (draft.saving ? 'Сохраняем…' : saved ? 'Сохранить изменения' : 'Сохранить оценку') + '</button>') +
      '<p class="ballot-feedback" role="status" aria-live="polite"></p>' +
      (draft.conflict ? '<button type="button" class="secondary" data-reload>' +
        (draft.rubricChanged ? 'Открыть действующий лист' : 'Загрузить сохранённую версию') + '</button>' : '') + '</form>' +
      (updated ? nominationsGuide + '<div class="ballot-sources">' + criteriaLink + rulesLink + '</div>' : ''));
    const form = region.querySelector('form');
    const feedback = form.querySelector('[role="status"]');
    feedback.textContent = displayText(message);
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
      if (!draft.conflict && draft.message !== message) {
        draft.message = message;
        feedback.textContent = displayText(message);
      }
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
        feedback.textContent = displayText('Загрузить сохранённую версию не удалось. Ваш ввод остался в форме.');
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
