import { cabinetMarkup, checkIcon, displayText, escape, heading, regulationsDocument } from './views.js?v=61207dc59179';
import {
  approachesIntro, approachRules, conceptHeading, conceptIntro, conceptQuestions, conceptScale, conceptScaleIntro,
  criterionTitles, distinction, distinctionHeading, nominations, nominationsTitle, technicalNotes
} from './criteria.js?v=61207dc59179';

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
  '<p>' + escape(approachesIntro) + ' <a href="' + approachRules + '" target="_blank" rel="noopener noreferrer">Пункт&nbsp;6.1 правил конкурса</a></p>');
const nominationsGuide = disclosure(nominationsTitle,
  nominations.map(item => '<section>' + heading(item.name, 3) + paragraphs(item.paragraphs) + '</section>').join('') +
  '<section><h4>' + escape(distinctionHeading) + '</h4>' + paragraphs([distinction]) + '</section>', 'nominations');

function nominationSelection(keys) {
  return Array.isArray(keys) ? nominations.map(({ key }) => key).filter(key => keys.includes(key)) : [];
}

function recommendationFields(selected) {
  const choices = nominations.map(({ key, name }) =>
    '<label class="nomination-option"><input class="sr-only" type="checkbox" name="nomination_keys" value="' + key +
    '"' + (selected.includes(key) ? ' checked' : '') + '><span class="work-mark" aria-hidden="true">' + checkIcon +
    '</span><span>' + escape(name.replace(/^\d+\.\s*/, '')) + '</span></label>').join('');
  return '<fieldset class="recommendations"><legend>Рекомендовать на номинации <small>по желанию</small></legend>' +
    nominationsGuide + choices + '</fieldset>';
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

// Optional breaks for the approved Russian headings on devices without a Russian dictionary.
const criterionSyllables = new Map([
  'потен-циал', 'кон-цеп-ции', 'зало-жен-ных', 'худо-же-ствен-ного', 'эмо-цио-наль-ного',
  'эффек-та', 'визу-аль-ного', 'вопло-ще-ния', 'выбран-ного', 'Фина-ли-стом',
  'Реа-ли-зуе-мость', 'эффек-тив-ность', 'кон-струк-тив-ная', 'соот-вет-ствие',
  'тех-ни-че-ским', 'тре-бо-ва-ни-ям', 'ком-плекс-ный', 'рас-ши-рен-ный'
].map(word => [word.replaceAll('-', ''), word.replaceAll('-', '\u00ad')]));

class CriterionTitle extends HTMLElement {
  #copy;
  #lastMeasure;
  #ruler = document.createElement('canvas').getContext('2d');
  #observer = new ResizeObserver(() => this.#fit());

  connectedCallback() {
    this.#copy ??= this.textContent;
    this.#observer.observe(this.closest('fieldset'));
    this.#fit();
    document.fonts.ready.then(() => this.#fit());
  }

  disconnectedCallback() {
    this.#observer.disconnect();
  }

  #fit() {
    if (!this.isConnected) return;
    const width = this.closest('fieldset').clientWidth;
    const style = getComputedStyle(this);
    this.#ruler.font = style.fontWeight + ' ' + style.fontSize + ' ' + style.fontFamily;
    const measure = text => this.#ruler.measureText(text).width;
    const metrics = [width, this.#ruler.font, measure(this.#copy)].join('/');
    if (metrics === this.#lastMeasure) return;
    this.#lastMeasure = metrics;

    const fragment = document.createDocumentFragment();
    const unbroken = (text, tracking = 0) => {
      const span = document.createElement('span');
      span.className = 'whole-word';
      span.textContent = text;
      if (tracking) span.style.letterSpacing = -tracking + 'px';
      return span;
    };
    for (const group of this.#copy.split(' ')) {
      if (fragment.firstChild) fragment.append(' ');
      if (measure(group) <= width) {
        fragment.append(unbroken(group));
        continue;
      }
      const words = group.split('\u00a0');
      const last = words.pop();
      const prefix = words.join('\u00a0');
      const word = last.replace(/^[«(]+|[.,:;!?)»]+$/gu, '');
      if (measure(word) <= width) {
        // First use a thin glue space. Tighten only the few pixels needed by a short
        // conjunction or adjoining punctuation, keeping the letters at their chosen size.
        const tight = prefix ? prefix + '\u202f' + last : last;
        const tracking = Math.max(0, measure(tight) - width + .5) / tight.length;
        if (tracking <= parseFloat(style.fontSize) * .055) {
          fragment.append(unbroken(tight, tracking));
        } else {
          if (prefix) fragment.append(prefix + ' ');
          fragment.append(unbroken(last));
        }
      } else {
        const parts = group.replace(/[А-Яа-яЁё]+/gu, term => criterionSyllables.get(term) ?? term);
        fragment.append(parts);
      }
    }
    this.replaceChildren(fragment);
  }
}

customElements.define('criterion-title', CriterionTitle);


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
      source: regulationsUrl ? '<a data-regulations href="' + escape(regulationsUrl) +
        '" target="_blank" rel="noopener noreferrer">Положение о работе жюри, п. 7.4</a>' : ''
    })
    : criterion.key === 'concept' ? conceptGuide : '';
  return '<fieldset class="criterion"><legend><criterion-title>' + escape((updated && criterionTitles[criterion.key]) || criterion.label) + '</criterion-title>' +
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
  return b && a.comment === b.comment && (a.nomination_keys ?? []).join() === (b.nomination_keys ?? []).join() &&
    criteria.every(({ key }) => a.answers[key] === b.answers[key]);
}

function answersFor(answers, criteria) {
  return Object.fromEntries(criteria.filter(({ key }) => Object.hasOwn(answers, key)).map(({ key }) => [key, answers[key]]));
}

function readDraft(key, criteria, savedNominations, canRecommend) {
  for (const store of stores) {
    try {
      const raw = window[store].getItem(key);
      if (!raw) continue;
      const item = JSON.parse(raw);
      if (!Number.isSafeInteger(item.revision) || item.revision < 0 ||
          typeof item.comment !== 'string' || item.comment.length > 5000 ||
          !item.answers || typeof item.answers !== 'object' || Array.isArray(item.answers)) continue;
      // A draft from the previous sheet can contain an answer outside the current role.
      const answers = answersFor(item.answers, criteria);
      const valid = criteria.every(({ key, site_only }) => {
        if (!Object.hasOwn(answers, key)) return true;
        const value = answers[key];
        return (value === null && site_only) || (Number.isInteger(value) && value >= 0 && value <= 5);
      });
      if (valid) return { answers, comment: item.comment, revision: item.revision, raw,
        nomination_keys: canRecommend ? nominationSelection(item.nomination_keys ?? savedNominations) : [],
        message: store === 'localStorage' || readLocalCopy(key) === raw ? draftMessage : tabDraftMessage };
    } catch { /* The other storage or the server copy may still be available. */ }
  }
}

function readLocalCopy(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}

function rememberDraft(draft) {
  const { revision, answers, comment, nomination_keys } = draft;
  draft.raw = JSON.stringify({ revision, answers, comment, nomination_keys });
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
  constructor(call, onSaved, userId, loadRegulations) {
    this.call = call;
    this.onSaved = onSaved;
    this.userId = userId;
    this.loadRegulations = loadRegulations;
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
    if (this.data && (this.data.rubric !== data.rubric || this.data.criteria.length !== data.criteria.length ||
        this.data.nomination_recommendations !== data.nomination_recommendations ||
        this.data.criteria.some(({ key }, i) => key !== data.criteria[i].key))) this.drafts.clear();
    this.regulationsUrl = await this.loadRegulations(regulationsDocument(data.regulations_url));
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
    const canRecommend = this.data.nomination_recommendations === true;
    let draft = this.drafts.get(id);
    if (!draft) {
      const rubric = this.data.rubric;
      const key = 'jury.draft.v1/' + this.userId + '/' + rubric + '/' + id;
      const nomination_keys = canRecommend ? nominationSelection(saved?.nomination_keys) : [];
      draft = { key, rubric, answers: { ...saved?.answers }, comment: saved?.comment ?? '', revision: saved?.revision ?? 0,
        nomination_keys };
      const pending = readDraft(key, this.data.criteria, nomination_keys, canRecommend);
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
    const showStandardScale = !updated || this.data.criteria.some(({ key }) => key === 'concept');
    const message = draft.message ?? (saved ? 'Оценка сохранена.' : '');
    const rules = this.regulationsUrl;
    const rulesLink = rules
      ? '<a class="ballot-rules" data-regulations href="' + escape(rules) + '" target="_blank" rel="noopener noreferrer">Положение о работе жюри</a>' : '';
    region.innerHTML = cabinetMarkup(heading('Ваша оценка', 2) +
      (closed ? '<p class="ballot-note">Голосование закрыто.</p>' : '') +
      (showStandardScale ? scaleDetails(updated ? 'Шкала оценки концепции' : 'Как выставлять баллы', standardScale, {
        intro: updated ? conceptScaleIntro : '', descending: updated
      }) : '') +
      (updated ? '' : rulesLink) +
      '<form><fieldset class="ballot-fields"' + (closed || draft.saving ? ' disabled' : '') + '><legend class="sr-only">Оценочный лист</legend>' +
      this.data.criteria.map(c => field(c, draft.answers, standardScale, updated, rules)).join('') +
      '<label class="comment-label" for="ballot-comment">Комментарий <small>по желанию</small></label>' +
      '<textarea id="ballot-comment" name="comment" rows="3" maxlength="5000">\n' + escape(draft.comment) + '</textarea>' +
      (canRecommend ? recommendationFields(draft.nomination_keys) : '') + '</fieldset>' +
      (closed ? '' : '<button class="primary save-ballot" type="submit"' + (draft.saving || draft.conflict ? ' disabled' : '') + '>' +
        (draft.saving ? 'Сохраняем…' : saved ? 'Сохранить изменения' : 'Сохранить оценку') + '</button>') +
      '<p class="ballot-feedback" role="status" aria-live="polite"></p>' +
      (draft.conflict ? '<button type="button" class="secondary" data-reload>' +
        (draft.rubricChanged ? 'Открыть действующий лист' : 'Загрузить сохранённую версию') + '</button>' : '') + '</form>' +
      (updated ? (canRecommend ? '' : nominationsGuide) + rulesLink : ''));
    const form = region.querySelector('form');
    const feedback = form.querySelector('[role="status"]');
    feedback.textContent = displayText(message);
    form.addEventListener('input', event => {
      const input = event.target;
      if (input.name === 'comment') draft.comment = input.value;
      else if (input.name === 'nomination_keys') {
        draft.nomination_keys = Array.from(form.querySelectorAll('[name="nomination_keys"]:checked'), choice => choice.value);
      } else if (input.type === 'radio') draft.answers[input.name] = input.value === 'na' ? null : Number(input.value);
      let message;
      if (!draft.conflict && sameBallot(draft, saved, this.data.criteria)) {
        forgetDraft(draft);
        message = 'Оценка сохранена.';
      } else if (!saved && !draft.comment && !draft.nomination_keys.length && !Object.keys(draft.answers).length) {
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
        if (draft.rubricChanged && this.data.rubric === draft.rubric) {
          draft.answers = answersFor(draft.answers, this.data.criteria);
          if (!this.data.nomination_recommendations) draft.nomination_keys = [];
          draft.rubricChanged = false;
          draft.conflict = draft.revision !== (this.saved.get(id)?.revision ?? 0);
          draft.message = draft.conflict ? conflictMessage : rememberDraft(draft);
          this.drafts.set(id, draft);
        } else {
          forgetDraft(draft);
          this.drafts.delete(id);
        }
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
        p_rubric: draft.rubric, p_work_id: id, p_answers: draft.answers, p_comment: draft.comment, p_revision: draft.revision,
        ...(this.data.nomination_recommendations ? { p_nomination_keys: draft.nomination_keys } : {})
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
