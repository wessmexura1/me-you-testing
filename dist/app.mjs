import { quizzes, createAttempt, validAttempt, calculateResult } from './quiz-data.mjs';

const app = document.querySelector('#app');
const landingMarkup = app.innerHTML;
const STORAGE_KEY = 'know-me.attempts.v1';
const attempts = readAttempts();
const needsResume = new Set(Object.keys(attempts).filter(id => !attempts[id].complete));
let busyUntil = 0;
let storageWarning = false;

function readAttempts() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY)) || {};
    return Object.fromEntries(Object.keys(quizzes).filter(id => validAttempt(saved[id], id)).map(id => [id, saved[id]]));
  } catch { return {}; }
}
function save() {
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(attempts)); }
  catch {
    storageWarning = true;
    document.querySelector('#status').textContent = 'Браузер не разрешил сохранение. После обновления страницы ответы потеряются.';
  }
}
function route() {
  const [quizId, screen] = location.hash.slice(1).split('/');
  return Object.hasOwn(quizzes, quizId) ? { quizId, screen: ['start', 'quiz', 'result', 'review'].includes(screen) ? screen : 'start' } : { screen: 'home' };
}
function navigate(quizId = '', screen = '') {
  const hash = quizId ? `#${quizId}/${screen}` : '';
  if (location.hash === hash) render();
  else location.hash = hash;
}
function escape(value) { return String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }
function label(quiz) { return `${quiz.label} · ${quiz.subtitle.toLowerCase()}`; }
function warning() { return storageWarning ? '<p class="storage-warning" role="status">Ответы сохранятся до обновления этой страницы.</p>' : ''; }
function shell(quiz, markup, back = true) {
  return `<section class="screen ${quiz.id === 'him' ? 'blue' : ''} enter">${back ? '<button class="back-link" data-action="home">На главную</button>' : ''}${markup}${warning()}</section>`;
}
function startScreen(quiz) {
  const attempt = attempts[quiz.id];
  const resume = attempt ? `<div class="resume"><p>${attempt.complete ? 'Твой результат уже готов' : `Продолжить с вопроса ${attempt.index + 1}?`}</p><div class="button-row"><button class="btn" data-action="${attempt.complete ? 'result' : 'continue'}">${attempt.complete ? 'Посмотреть результат' : 'Продолжить'}</button><button class="btn secondary" data-action="restart">Начать заново</button></div></div>` : '<button class="btn" data-action="restart">Начать тест</button>';
  return shell(quiz, `<div class="panel start-panel"><span class="pill">${label(quiz)}</span><h1 tabindex="-1" data-focus>${quiz.title}</h1><p class="description">Выбери один ответ в каждом вопросе. До завершения теста ответы можно менять. В конце увидишь результат и правильные варианты.</p><p class="description compact">Можно пропустить любой вопрос и вернуться к нему позже. Время не ограничено.</p>${resume}</div>`);
}
function questionScreen(quiz) {
  const attempt = attempts[quiz.id];
  const q = quiz.questions[attempt.index];
  const selected = attempt.answers[q.id];
  const answered = Object.keys(attempt.answers).length;
  const last = attempt.index === quiz.questions.length - 1;
  const options = attempt.order[q.id].map(id => q.options.find(o => o.id === id));
  return shell(quiz, `<div class="quiz-header"><strong>${label(quiz)}</strong><span>Вопрос ${attempt.index + 1} из 15</span></div><div class="progress-track" role="progressbar" aria-label="Позиция в тесте" aria-valuemin="0" aria-valuemax="15" aria-valuenow="${attempt.index + 1}"><div class="progress-fill" style="width:${(attempt.index + 1) / 15 * 100}%"></div></div><p class="answered-count">Отвечено: <span id="answered">${answered}</span> из 15</p><div class="panel quiz-panel"><h1 class="question-heading" id="question-heading" tabindex="-1" data-focus>${q.text}</h1><fieldset class="answers" aria-labelledby="question-heading"><legend class="sr-only">Выбери один вариант</legend>${options.map(o => `<label class="answer"><input type="radio" name="answer" value="${o.id}" ${selected === o.id ? 'checked' : ''}><span>${escape(o.text)}</span></label>`).join('')}</fieldset><div class="quiz-navigation">${attempt.index > 0 ? '<button class="text-btn" data-action="back">Назад</button>' : ''}<div class="navigation-end"><button class="text-btn" data-action="skip">Пропустить</button><button class="btn" id="next" data-action="next" ${selected ? '' : 'disabled'}>${last ? 'Проверить ответы' : 'Далее'}</button></div></div></div><button class="quit-link" data-action="home">Сохранить и вернуться на главную</button>`, false);
}
function resultScreen(quiz) {
  const result = calculateResult(quiz, attempts[quiz.id].answers);
  return shell(quiz, `<div class="panel result-panel"><span class="pill">${label(quiz)}</span><p class="score">${result.correct}<span>из 15</span></p><p class="percentage">${result.percent}% правильных ответов</p><h1 tabindex="-1" data-focus>${result.title}</h1><div class="stats"><span><b>${result.correct}</b>верных</span><span><b>${result.wrong}</b>ошибок</span><span><b>${result.skipped}</b>пропусков</span></div><p class="description compact">Вспомнить детали — ещё один повод поговорить.</p><div class="button-row"><button class="btn" data-action="review">Посмотреть ответы</button><button class="btn secondary" data-action="restart">Пройти ещё раз</button></div></div>`);
}
function reviewScreen(quiz) {
  const result = calculateResult(quiz, attempts[quiz.id].answers);
  const outcomes = { correct: 'Верно', wrong: 'Неверно', skipped: 'Пропущено' };
  return shell(quiz, `<h1 class="review-title" tabindex="-1" data-focus>Вспомним детали</h1><p class="review-intro">${label(quiz)} · ${result.correct} из 15 правильных ответов</p><div class="review-list">${result.rows.map((row, index) => `<article class="review-item"><div class="review-meta"><span>Вопрос ${index + 1} из 15</span><span class="outcome ${row.outcome}">${outcomes[row.outcome]}</span></div><h2>${escape(row.question.text)}</h2>${row.outcome === 'correct' ? `<p class="review-answer"><strong>${escape(row.correct.text)}</strong></p>` : `<p class="review-answer">Твой ответ: <strong>${row.selected ? escape(row.selected.text) : 'Пропущен'}</strong></p><p class="review-answer">Правильный ответ: <strong>${escape(row.correct.text)}</strong></p>`}${row.question.note ? `<p class="review-note">${escape(row.question.note)}</p>` : ''}</article>`).join('')}</div><div class="button-row review-actions"><button class="btn" data-action="restart">Пройти ещё раз</button><button class="btn secondary" data-action="home">На главную</button></div>`);
}
function render() {
  const previousProgress = app.querySelector('.progress-fill')?.style.width ?? '0%';
  let { quizId, screen } = route();
  const quiz = quizzes[quizId];
  const attempt = attempts[quizId];
  if (screen === 'quiz' && (!attempt || needsResume.has(quizId))) screen = 'start';
  if (screen === 'quiz' && attempt?.complete) screen = 'result';
  if (['result', 'review'].includes(screen) && !attempt?.complete) screen = 'start';
  document.title = screen === 'home' ? 'Насколько хорошо ты меня знаешь?' : screen === 'quiz' ? `Вопрос ${attempt.index + 1} из 15 · ${quiz.label}` : quiz.title;
  app.innerHTML = screen === 'home' ? landingMarkup : screen === 'start' ? startScreen(quiz) : screen === 'quiz' ? questionScreen(quiz) : screen === 'review' ? reviewScreen(quiz) : resultScreen(quiz);
  app.querySelector('.progress-fill')?.style.setProperty('--progress-from', previousProgress);
  window.scrollTo({ top: 0, behavior: 'instant' });
  const heading = app.querySelector('[data-focus]');
  if (heading) heading.focus({ preventScroll: true });
}
function current() {
  const { quizId } = route();
  return { quiz: quizzes[quizId], attempt: attempts[quizId] };
}
function move(index) {
  const { attempt } = current();
  attempt.index = index;
  busyUntil = performance.now() + 250;
  save();
  render();
}
function complete() {
  const { quiz, attempt } = current();
  attempt.complete = true;
  save();
  navigate(quiz.id, 'result');
}
function closeDialog() {
  const dialog = document.querySelector('#finish-dialog');
  dialog?.close();
  dialog?.remove();
  app.querySelector('#next')?.focus();
}
function confirmFinish() {
  const { quiz, attempt } = current();
  const remaining = quiz.questions.filter(q => !attempt.answers[q.id]).length;
  if (!remaining) { complete(); return; }
  const noun = remaining === 1 ? 'вопрос' : remaining < 5 ? 'вопроса' : 'вопросов';
  const verb = remaining === 1 ? 'Остался' : 'Осталось';
  app.insertAdjacentHTML('beforeend', `<dialog id="finish-dialog" class="finish-dialog" aria-labelledby="finish-title" aria-describedby="finish-description"><div class="modal-panel"><h2 id="finish-title">${verb} ${remaining} ${noun} без ответа</h2><p id="finish-description">Можно вернуться и ответить на них или завершить тест сейчас. Пропуски будут показаны отдельно.</p><div class="button-row"><button class="btn" data-action="missing" autofocus>Вернуться к вопросам</button><button class="btn secondary" data-action="finish">Завершить с пропусками</button></div><button class="text-btn" data-action="close-dialog">Закрыть</button></div></dialog>`);
  const dialog = document.querySelector('#finish-dialog');
  dialog.addEventListener('cancel', event => { event.preventDefault(); closeDialog(); });
  dialog.showModal();
}
app.addEventListener('change', event => {
  if (!event.target.matches('input[name="answer"]')) return;
  const { quiz, attempt } = current();
  if (!quiz || !attempt || attempt.complete) return;
  const question = quiz.questions[attempt.index];
  if (!question.options.some(o => o.id === event.target.value)) return;
  attempt.answers[question.id] = event.target.value;
  save();
  document.querySelector('#next').disabled = false;
  document.querySelector('#answered').textContent = Object.keys(attempt.answers).length;
});
app.addEventListener('click', event => {
  const button = event.target.closest('button[data-action]');
  if (!button || button.disabled) return;
  const action = button.dataset.action;
  if (action === 'choose') { navigate(button.dataset.quiz, 'start'); return; }
  if (action === 'home') { navigate(); return; }
  const { quiz, attempt } = current();
  if (!quiz) return;
  if (action === 'restart') { attempts[quiz.id] = createAttempt(quiz.id); needsResume.delete(quiz.id); save(); navigate(quiz.id, 'quiz'); }
  else if (action === 'continue') { needsResume.delete(quiz.id); navigate(quiz.id, 'quiz'); }
  else if (action === 'result' || action === 'review') navigate(quiz.id, action);
  else if (action === 'close-dialog') closeDialog();
  else if (action === 'finish') { closeDialog(); complete(); }
  else if (action === 'missing') { const index = quiz.questions.findIndex(q => !attempt.answers[q.id]); closeDialog(); move(index); }
  else if (['back', 'next', 'skip'].includes(action)) {
    if (!attempt || attempt.complete || performance.now() < busyUntil || document.querySelector('#finish-dialog')) return;
    if (action === 'back') { if (attempt.index > 0) move(attempt.index - 1); return; }
    const q = quiz.questions[attempt.index];
    if (action === 'next' && !attempt.answers[q.id]) return;
    if (action === 'skip') { delete attempt.answers[q.id]; save(); }
    if (attempt.index === quiz.questions.length - 1) confirmFinish();
    else move(attempt.index + 1);
  }
});
window.addEventListener('hashchange', render);
render();

if (document.modelContext?.registerTool) {
  const lifecycle = new AbortController();
  const register = tool => {
    try { Promise.resolve(document.modelContext.registerTool(tool, { signal: lifecycle.signal })).catch(() => {}); } catch {}
  };
  register({ name: 'read_quiz_progress', description: 'Read the visible quiz position and answer options. Correct answers are returned only after completion.', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true }, execute: () => {
    const { quiz, attempt } = current();
    if (!quiz) return { screen: 'home', quizzes: Object.values(quizzes).map(q => ({ id: q.id, title: q.title })) };
    if (!attempt) return { screen: 'start', quiz: quiz.id };
    if (attempt.complete) { const { correct, wrong, skipped, percent } = calculateResult(quiz, attempt.answers); return { screen: route().screen, quiz: quiz.id, correct, wrong, skipped, percent }; }
    const q = quiz.questions[attempt.index];
    return { screen: route().screen, quiz: quiz.id, position: attempt.index + 1, answered: Object.keys(attempt.answers).length, question: q.text, options: attempt.order[q.id].map(id => q.options.find(o => o.id === id)), selected: attempt.answers[q.id] ?? null };
  } });
  register({ name: 'select_current_quiz_answer', description: 'Select or change an answer to the current visible question without advancing or finishing the quiz.', inputSchema: { type: 'object', properties: { optionId: { type: 'string' } }, required: ['optionId'], additionalProperties: false }, annotations: { readOnlyHint: false }, execute: input => {
    const { quiz, attempt } = current();
    if (!input || typeof input.optionId !== 'string' || Object.keys(input).some(key => key !== 'optionId')) throw new Error('Укажи optionId');
    if (route().screen !== 'quiz' || !attempt || attempt.complete || needsResume.has(quiz.id) || document.querySelector('#finish-dialog')) throw new Error('Сначала открой вопрос теста');
    const option = quiz.questions[attempt.index].options.find(o => o.id === input.optionId);
    if (!option) throw new Error('Такого варианта нет в текущем вопросе');
    const radio = [...app.querySelectorAll('input[name="answer"]')].find(input => input.value === option.id);
    radio.checked = true;
    radio.dispatchEvent(new Event('change', { bubbles: true }));
    return { selected: option.id, position: attempt.index + 1 };
  } });
  window.addEventListener('pagehide', () => lifecycle.abort(), { once: true });
}
