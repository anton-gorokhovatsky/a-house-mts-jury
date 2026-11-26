import { escape } from './views.js?v=811b70d00447';

const generalScale = [
  'Отсутствует или невозможно оценить', 'Соответствует в минимальной степени',
  'Соответствует в меньшей степени', 'Соответствует не полностью', 'Соответствует в большой степени', 'Полностью соответствует'
];
const feasibilityScale = ['Невозможно оценить', 'Не реализуемо', 'Скорее не реализуемо', 'Частично реализуемо', 'Скорее реализуемо', 'Реализуемо'];
const descriptions = {
  brief: 'Глубина проработки идеи и сила заложенных смыслов.',
  art: 'Оцените визуальное воплощение идеи с учётом выбранного подхода: интеграция в среду или выраженный акцент.',
  economics: 'CAPEX — затраты на строительство, OPEX — расходы на эксплуатацию.'
};

function scaleDetails(title, scale, note = '') {
  return '<details class="scale"><summary>' + title + '</summary><ul>' +
    scale.map((meaning, i) => '<li><b>' + i + '</b> — ' + meaning + '</li>').join('') +
    '</ul>' + (note ? '<p>' + note + '</p>' : '') + '</details>';
}

function field(criterion, answers) {
  const key = escape(criterion.key);
  const selected = answers[criterion.key];
  const choices = (criterion.key === 'feasibility' ? feasibilityScale : generalScale).map((meaning, i) =>
    '<label class="score-choice"><input type="radio" name="' + key + '" value="' + i +
    '" aria-label="' + i + ' — ' + escape(meaning) + '" required' + (selected === i ? ' checked' : '') +
    '><span>' + i + '</span></label>').join('');
  const site = criterion.site_only ? '<label class="no-site"><input type="radio" name="' + key +
    '" value="na"' + (selected === null ? ' checked' : '') + '> Место размещения не определено</label>' : '';
  const help = descriptions[criterion.key];
  const specialScale = criterion.key === 'feasibility'
    ? scaleDetails('Шкала реализуемости', feasibilityScale, 'Средний балл ниже 4 исключает призовое место и рекомендацию к реализации. При среднем балле ниже 2 работа также не рекомендуется к выставке.')
    : '';
  return '<fieldset class="criterion"><legend>' + escape(criterion.label) +
    ' <small>Вес ' + criterion.weight + ' %</small></legend>' +
    (help ? '<p class="criterion-help">' + escape(help) + '</p>' : '') + specialScale +
    '<div class="score-choices">' + choices + '</div>' + site + '</fieldset>';
}

export class FinalVoting {
  constructor(call, onSaved) {
    this.call = call;
    this.onSaved = onSaved;
    this.data = null;
    this.saved = new Map();
    this.drafts = new Map();
  }

  get scored() {
    return this.data && this.data.role !== 'observer' ? this.saved : null;
  }

  async load() {
    const response = await this.call('jury_final_sheet', {});
    if (!response.ok) throw new Error('Sheet unavailable');
    const data = await response.json();
    if (!data || !['juror', 'technical', 'observer'].includes(data.role) || !Array.isArray(data.criteria) ||
        !Array.isArray(data.ballots) || typeof data.accepting !== 'boolean' ||
        (data.role !== 'observer' && !data.criteria.length)) throw new Error('Invalid score sheet');
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
      draft = { answers: { ...saved?.answers }, comment: saved?.comment ?? '', revision: saved?.revision ?? 0 };
      this.drafts.set(id, draft);
    }
    const closed = !this.data.accepting;
    const message = draft.message ?? (saved ? 'Оценка сохранена.' : '');
    const rules = this.data.regulations_url;
    const rulesLink = typeof rules === 'string' && /^https:\/\/disk\.360\.yandex\.ru\/d\/[\w-]+$/.test(rules)
      ? '<a class="ballot-rules" href="' + escape(rules) + '" target="_blank" rel="noopener noreferrer">Положение о работе жюри</a>' : '';
    region.innerHTML = '<h2>Ваша оценка</h2>' +
      (closed ? '<p class="ballot-note">Голосование закрыто.</p>' : '') +
      scaleDetails('Как выставлять баллы', generalScale) +
      rulesLink +
      '<form><fieldset class="ballot-fields"' + (closed || draft.saving ? ' disabled' : '') + '><legend class="sr-only">Оценочный лист</legend>' +
      this.data.criteria.map(c => field(c, draft.answers)).join('') +
      '<label class="comment-label" for="ballot-comment">Комментарий <small>по желанию</small></label>' +
      '<textarea id="ballot-comment" name="comment" rows="3" maxlength="5000">' + escape(draft.comment) + '</textarea></fieldset>' +
      (closed ? '' : '<button class="primary save-ballot" type="submit"' + (draft.saving ? ' disabled' : '') + '>' +
        (draft.saving ? 'Сохраняем…' : saved ? 'Сохранить изменения' : 'Сохранить оценку') + '</button>') +
      '<p class="ballot-feedback" role="status" aria-live="polite"></p>' +
      (draft.conflict ? '<button type="button" class="secondary" data-reload>Загрузить сохранённую версию</button>' : '') + '</form>';
    const form = region.querySelector('form');
    const feedback = form.querySelector('[role="status"]');
    feedback.textContent = message;
    form.addEventListener('input', event => {
      const input = event.target;
      if (input.name === 'comment') draft.comment = input.value;
      else if (input.type === 'radio') draft.answers[input.name] = input.value === 'na' ? null : Number(input.value);
      if (!draft.conflict) draft.message = feedback.textContent = 'Есть несохранённые изменения.';
    });
    form.addEventListener('submit', event => {
      event.preventDefault();
      if (draft.conflict || draft.saving || !this.data.accepting || !form.reportValidity()) return;
      this.save(id, draft, region);
    });
    const reload = form.querySelector('[data-reload]');
    if (reload) reload.onclick = async () => {
      reload.disabled = true;
      try {
        await this.load();
        this.drafts.delete(id);
        if (region.isConnected) this.mount(id, region);
      } catch {
        feedback.textContent = 'Загрузить сохранённую версию не удалось. Ваш ввод остался в форме.';
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
      const response = await this.call('jury_save_final_ballot', {
        p_work_id: id, p_answers: draft.answers, p_comment: draft.comment, p_revision: draft.revision
      });
      if (response.status === 409) {
        draft.conflict = true;
        draft.message = 'Оценка была изменена в другой вкладке. Ваш ввод сохранён в этой форме. Загрузите актуальную версию перед редактированием.';
      } else if (response.status === 403 && (await response.json()).message === 'VOTING_CLOSED') {
        this.data.accepting = false;
        draft.message = 'Голосование закрыто. Изменения не сохранены.';
      } else {
        if (!response.ok) throw new Error('Save unavailable');
        const ballot = await response.json();
        if (ballot?.work_id !== id || !Number.isInteger(ballot.revision) || ballot.revision < 1) throw new Error('Unconfirmed save');
        this.saved.set(id, ballot);
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
