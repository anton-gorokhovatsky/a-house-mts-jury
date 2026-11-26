// Only visible HTML text is formatted. Attributes, artwork and native values
// stay literal in both the editorial homepage and the imported pages.
const htmlTokens = /<!--[\s\S]*?-->|<(script|style|svg|textarea|select)\b(?:[^>"']|"[^"]*"|'[^']*')*>[\s\S]*?<\/\1\s*>|<\/?[a-z][\w:-]*\b(?:[^>"']|"[^"]*"|'[^']*')*>|[^<]+|</gi;
const names = 'House|News|Index|School|Fest|Presence|Friend|Member|Patron|Board|Press|Seasons|Kids|Shop|Media|State|Pass|Gallery|Sport|Focus|Private|Book|Concierge|Room';
const namePattern = suffixes => new RegExp('(?<![\\p{L}\\p{N}@./_-])[AА][-‑–—](?:' + suffixes + ')(?![\\p{L}\\p{N}_/-])', 'giu');
const projectName = namePattern(names);
const homeProjectName = namePattern(names + '|Forum|Guide|Industry|Membership');

const month = '(?:январ[ья]|феврал[ья]|марта?|апрел[ья]|ма[йя]|июн[ья]|июл[ья]|августа?|сентябр[ья]|октябр[ья]|ноябр[ья]|декабр[ья])';
const dayMonth = new RegExp('(?<=\\d) (?=' + month + '(?!\\p{L}))', 'giu');
const monthYear = new RegExp('(?<!\\p{L})(' + month + ') (?=\\d{4}(?!\\d))', 'giu');
const shortWord = /(?<![\p{L}\p{N}@./_–-])(а|в|и|к|о|с|у|во|до|за|из|ко|на|не|ни|но|об|от|по|со|без|для|над|обо|под|при|про) (?=[«„“(]?[\p{L}\d№])/giu;

// A number may also be an issue number, an address or a clause reference.
// Bind counts in editorial prose using the things the site actually counts.
const countedTerms = [
  'бюро', 'архитектор(?:а|ов)?', 'участник(?:а|ов)?', 'человек(?:а)?', 'команд(?:а|ы)?',
  'куратор(?:а|ов)?', 'компани[яиюй]', 'галере[яиюй]', 'победител(?:ь|я|ей)',
  'экскурси[яиюй]', 'лекци[яиюй]', 'встреч[ауи]?', 'выстав(?:ка|ки|ок)', 'событи[еяй]',
  'проект(?:а|ов)?', 'работ[ауые]?', 'издани[еяй]', 'выпуск(?:а|ов)?', 'стат(?:ья|ьи|ей)',
  'страниц[ауые]?', 'пункт(?:а|ов)?', 'мест[ао]?', 'объект(?:а|ов)?', 'высказывани[еяй]',
  'д(?:ень|ня|ней)', 'недел[яиюь]', 'месяц(?:а|ев)?', 'век(?:а|ов)?',
  'миллион(?:а|ов)?', 'тысяч[аиу]?', 'млн', 'тыс', 'смерт(?:ь|и|ей)'
].join('|');
const adjective = '[а-яё-]+(?:ая|яя|ый|ой|ий|ое|ее|ые|ие|ую|юю|ых|их|ого|его)';
const count = new RegExp('(?<![\\p{L}\\p{N}.,:/_])' +
  '(\\d+(?:[ \\u00a0\\u202f]\\d{3})*(?:[.,]\\d+)?) (?=(?:' + adjective + ' )?(?:' +
  countedTerms + ')(?!\\p{L}))', 'giu');

function formatCount(match, number, offset, text) {
  if (/(?:№|(?:пп?|подп|абз|ч|ст|стр|д)\.)\s$/iu.test(text.slice(Math.max(0, offset - 12), offset))) return match;
  return number.replace(/[ \u00a0]/gu, '\u202f') + '\u00a0';
}

function wrapNames(text, pattern) {
  return text.replace(pattern, name => '<span class="project-name">' + name + '</span>')
    .replace(/«([АA][-‑–—]ком)(мью)(ни)(кейшнс)»([.,;:!?…])?/giu,
      '<span class="legal-name"><span>«$1</span>&shy;$2&shy;$3&shy;$4»$5</span>');
}

export function russianSpacing(text) {
  // Each replacement changes one space in place. The break after a date's
  // comma, after a punctuation dash, or between quantities stays available.
  return text.replace(shortWord, '$1\u00a0')
    .replace(/(?<![\p{L}\p{N}.,])12 (?=STOREEZ(?![\p{L}\p{N}]))/giu, '12\u00a0')
    .replace(dayMonth, '\u00a0')
    .replace(monthYear, '$1\u00a0')
    .replace(count, formatCount)
    .replace(/(?<=№)[ \u00a0](?=\d)/gu, '\u202f')
    .replace(/(?<=\d)[ \u00a0](?=\d{3}(?:[ \u00a0\u202f]\d{3})*(?:[,.]\d+)?[ \u00a0]₽)/gu, '\u202f')
    .replace(/(?<=\d) (?=₽|%|(?:минут[ауы]?|час(?:а|ов)?|год(?:а|у)?|лет|г\.)(?!\p{L}))/giu, '\u00a0')
    .replace(/(?<!\p{L})((?:пер|д|стр|ст|ч|п|пп|подп|абз)\.,?) (?=\d)/giu, '$1\u00a0')
    .replace(/(?<=\S) (?=[—·](?:\s|$))/gu, '\u00a0');
}

function headingHyphens(text) {
  return text.replace(/(?<!\p{L})(изда)(тель)(ство)(?!\p{L})/giu, '$1\u00ad$2\u00ad$3')
    .replace(/(?<!\p{L})(партнёр)(ств[оа])(?!\p{L})/giu, '<span class="wrap-group">$1\u00ad$2</span>')
    .replace(/(?<!\p{L})(мета)(будущее)(?!\p{L})/giu, '$1\u00ad$2');
}

// Old rich-text imports wrapped links in <u> or added <u> inside the link.
// Let the link own its underline, keeping independent annotations and their attributes.
function cleanLinkUnderlines(tokens) {
  let linkStart = -1;
  const underlines = [];
  let changed = false;
  for (const [i, tag] of tokens.entries()) {
    if (/^<a\s/i.test(tag) && /\shref\s*=/i.test(tag)) {
      linkStart = i;
      changed = false;
    } else if (/^<u\b/i.test(tag)) {
      underlines.push(i);
    } else if (/^<\/u\s*>$/i.test(tag)) {
      const start = underlines.pop();
      if (linkStart >= 0 && start > linkStart && /^<u\s*>$/i.test(tokens[start])) {
        tokens[start] = tokens[i] = '';
        changed = true;
      }
    } else if (linkStart >= 0 && /^<\/a\s*>$/i.test(tag)) {
      if (underlines.at(-1) === linkStart - 1 && /^<u\s*>$/i.test(tokens[linkStart - 1]) && /^<\/u\s*>$/i.test(tokens[i + 1])) {
        tokens[underlines.pop()] = tokens[i + 1] = '';
        changed = true;
      }
      if (changed) {
        const content = tokens.slice(linkStart + 1, i).join('');
        const [, before, label, after] = content.match(/^((?:\s|&nbsp;)*)([\s\S]*?)((?:\s|&nbsp;)*)$/i);
        tokens[linkStart] = before + tokens[linkStart] + label + tag + after;
        tokens.fill('', linkStart + 1, i + 1);
      }
      linkStart = -1;
    }
  }
  return tokens.join('');
}

// Join a paragraph's text across inline tags, including links and <time>,
// then put its characters back in the original text nodes. This keeps both
// sides of a link and its complete opening tag exactly where the author put them.
export function typesetText(html, { formatFormText = false } = {}) {
  const protectedTags = formatFormText ? /^(dialog|pre|code)$/ : /^(dialog|form|pre|code)$/;
  const tokens = html.match(htmlTokens) ?? [];
  const run = [];
  let excludedDepth = 0;
  let heading = false;

  function finishRun() {
    if (!run.length) return;
    // A source newline and its indentation render as a single ordinary space.
    const parts = run.map(index => tokens[index].replace(/[\t\r\n ]+/g, ' ')
      .replace(/&(?:nbsp|#160|#xa0);/gi, '\u00a0').replace(/&#(?:8239|x202f);/gi, '\u202f'));
    const formatted = russianSpacing(parts.join(''));
    let offset = 0;
    for (const [part, index] of run.entries()) {
      const end = offset + parts[part].length;
      const result = formatted.slice(offset, end);
      // Keep the original whitespace and entities of an unchanged text node.
      const visible = result === parts[part] ? tokens[index] : result;
      // The festival description, project directory and About page share this compound.
      // Give narrow measures a word boundary before the browser breaks off its last letter.
      tokens[index] = wrapNames(heading ? headingHyphens(visible) : visible, homeProjectName)
        .replace(/(?<![\p{L}\p{N}@./_-])(строй)(?=площад[ко])/giu, '$1\u00ad');
      offset = end;
    }
    run.length = 0;
  }

  for (const [index, token] of tokens.entries()) {
    if (token.startsWith('<')) {
      if (!/^<\/?(?:a|abbr|b|em|i|small|span|strong|sub|sup|time|u)\b/i.test(token)) finishRun();
      if (/^<\/?h[1-6]\b/i.test(token)) heading = token[1] !== '/';
      const tag = /^<(\/?)(dialog|form|pre|code)\b/i.exec(token);
      if (tag && protectedTags.test(tag[2].toLowerCase())) excludedDepth += tag[1] ? -1 : 1;
    } else if (excludedDepth) {
      // Keep the original rendering of the imported subscription dialog.
      tokens[index] = wrapNames(token, projectName);
    } else {
      run.push(index);
    }
  }
  finishRun();
  return cleanLinkUnderlines(tokens);
}
