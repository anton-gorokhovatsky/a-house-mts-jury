import { cabinetMarkup, escape, heading } from './views.js?v=1d919db49b0e';

function columnTitle(criterion) {
  if (criterion.key === 'concept') return 'Концепция';
  if (criterion.key === 'technical_review') return 'Техническая оценка';
  return criterion.label;
}

export function rankingContent(works, sheet, selectedKey) {
  let content = '<p class="stage">Третий этап</p>' + heading('Мой рейтинг работ');
  if (!sheet.data) {
    content += '<p class="status" role="status">Не удалось загрузить ваши оценки.</p><button type="button" class="secondary" data-retry>Повторить загрузку</button>';
  } else if (sheet.data.role === 'observer') {
    content += '<p class="status">Ваш аккаунт даёт доступ к просмотру работ.</p>';
  } else if (!sheet.saved.size) {
    content += '<p class="status">Здесь появятся работы, которым вы поставили и сохранили оценку.</p>';
  } else {
    const { criteria } = sheet.data;
    const criterion = criteria.find(c => c.key === selectedKey) || criteria.find(c => c.key === 'concept') || criteria[0];
    content += criteria.length > 1
      ? '<label class="ranking-order">Упорядочить по критерию<select id="ranking-order">' +
        criteria.map(c => '<option value="' + escape(c.key) + '"' + (c === criterion ? ' selected' : '') + '>' + escape(columnTitle(c)) + '</option>').join('') + '</select></label>'
      : '<p class="ranking-description">Работы расположены по вашей оценке концепции, от большей к меньшей.</p>';
    const suffix = selectedKey === criterion.key ? '?by=' + encodeURIComponent(criterion.key) : '';
    const rows = works.filter(work => sheet.saved.has(work.id)).map(work => ({
      work, score: sheet.saved.get(work.id).answers[criterion.key]
    })).sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
    let place = 0;
    let previous;
    content += '<table class="ranking"><caption class="sr-only">Сохранённые личные оценки</caption>' +
      '<thead><tr><th scope="col">Место</th><th scope="col">Работа</th><th scope="col">Балл</th></tr></thead><tbody>' +
      rows.map(({ work, score }, i) => {
        if (i === 0 || score !== previous) place = i + 1;
        previous = score;
        return '<tr><td>' + (Number.isInteger(score) ? place : '—') + '</td><td><a id="rank-' + work.id +
          '" href="#rating/work/' + work.id + suffix + '">' + escape(work.title) + '</a></td><td>' +
          (Number.isInteger(score) ? score : '—') + '</td></tr>';
      }).join('') + '</tbody></table>';
  }
  return cabinetMarkup('<main class="scene"><div class="wrap content">' + content +
    '<a class="return ranking-back" href="#works">К списку работ</a></div></main>');
}
