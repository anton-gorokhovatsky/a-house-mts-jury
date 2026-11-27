import { cabinetMarkup, escape, heading, projectsId, workNumber } from './views.js?v=85bd5bb13dc7';

function columnTitle(criterion) {
  if (criterion.key === 'concept') return 'Концепция';
  if (criterion.key === 'technical_review') return 'Техническая оценка';
  return criterion.label;
}

export function rankingContent(works, sheet, selectedKey) {
  let content = '';
  let note = '';
  if (!sheet.data) {
    content += '<p class="status" role="status">Не удалось загрузить ваши оценки.</p><button type="button" class="secondary" data-retry>Повторить загрузку</button>';
  } else if (sheet.data.role === 'observer') {
    content += '<p class="status">Ваш аккаунт даёт доступ к просмотру работ.</p>';
  } else if (!sheet.saved.size) {
    const [criterion] = sheet.data.criteria;
    if (criterion) {
      note = '<p class="ranking-description">Рейтинг по вашей оценке в разделе «' + escape(columnTitle(criterion)) + '».</p>';
    }
    content += '<p class="status">Здесь появятся работы, которым вы поставили и сохранили оценку.</p>';
  } else {
    const { criteria } = sheet.data;
    const criterion = criteria.find(c => c.key === selectedKey) || criteria.find(c => c.key === 'concept') || criteria[0];
    note = criteria.length > 1
      ? '<label class="ranking-order">Упорядочить по критерию<span class="ranking-select"><span class="ranking-select-label" aria-hidden="true">' + escape(columnTitle(criterion)) + '</span><select id="ranking-order">' +
        criteria.map(c => '<option value="' + escape(c.key) + '"' + (c === criterion ? ' selected' : '') + '>' + escape(columnTitle(c)) + '</option>').join('') + '</select></span></label>'
      : '<p class="ranking-description">' + (criterion.key === 'technical_review'
        ? 'Работы расположены по вашей технической оценке, от большей к меньшей.'
        : 'Работы расположены по вашей оценке концепции, от большей к меньшей.') + '</p>';
    const suffix = selectedKey === criterion.key ? '?by=' + encodeURIComponent(criterion.key) : '';
    const rows = works.map((work, index) => ({ work, number: workNumber(index), ballot: sheet.saved.get(work.id) }))
      .filter(({ ballot }) => ballot && (sheet.data.rubric !== 'final_50_50' || Number.isInteger(ballot.answers[criterion.key])))
      .map(({ work, number, ballot }) => ({ work, number, score: ballot.answers[criterion.key] }))
      .sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
    let place = 0;
    let previous;
    content += '<table class="ranking"><caption class="sr-only">Сохранённые личные оценки</caption>' +
      '<colgroup><col><col><col><col></colgroup>' +
      '<thead><tr><th scope="col">Место</th><th scope="col">№</th><th scope="col">Работа</th><th scope="col">Балл</th></tr></thead><tbody>' +
      rows.map(({ work, number, score }, i) => {
        if (i === 0 || score !== previous) place = i + 1;
        previous = score;
        return '<tr><td>' + (Number.isInteger(score) ? place : '—') + '</td><td>' + number + '</td><td><a id="rank-' + work.id +
          '" href="#rating/work/' + work.id + suffix + '">' + escape(work.title) + '</a></td><td>' +
          (Number.isInteger(score) ? score : '—') + '</td></tr>';
      }).join('') + '</tbody></table>';
  }
  const headingBlock = '<div class="ranking-heading">' + heading('Мой рейтинг работ') +
    (note ? '<div class="ranking-note"><span class="ranking-arrow" aria-hidden="true"></span>' + note + '</div>' : '') + '</div>';
  return cabinetMarkup('<main class="scene rating-scene"><div class="wrap content">' + headingBlock + content +
    '<a class="return ranking-back" href="#' + projectsId + '">К списку работ</a></div></main>');
}
