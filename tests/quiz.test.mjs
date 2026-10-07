import test from 'node:test';
import assert from 'node:assert/strict';
import { quizzes, createAttempt, validAttempt, calculateResult } from '../dist/quiz-data.mjs';
for (const quiz of Object.values(quizzes)) {
  test(`${quiz.id}: 15 questions with unique IDs and four valid options`, () => {
    assert.equal(quiz.questions.length, 15);
    assert.equal(new Set(quiz.questions.map(q => q.id)).size, 15);
    for (const q of quiz.questions) {
      assert.equal(q.options.length, 4);
      assert.equal(new Set(q.options.map(o => o.id)).size, 4);
      assert.equal(new Set(q.options.map(o => o.text)).size, 4);
      assert.ok(q.options.some(o => o.id === q.correctId));
    }
  });
  test(`${quiz.id}: all correct, all wrong, and all skipped`, () => {
    const correct = Object.fromEntries(quiz.questions.map(q => [q.id, q.correctId]));
    const wrong = Object.fromEntries(quiz.questions.map(q => [q.id, q.options.find(o => o.id !== q.correctId).id]));
    assert.deepEqual([calculateResult(quiz, correct).correct, calculateResult(quiz, correct).percent], [15, 100]);
    assert.deepEqual([calculateResult(quiz, wrong).wrong, calculateResult(quiz, wrong).percent], [15, 0]);
    assert.equal(calculateResult(quiz, {}).skipped, 15);
  });
  test(`${quiz.id}: mixed result distinguishes errors from skips`, () => {
    const answers = Object.fromEntries(quiz.questions.slice(0, 12).map((q, index) => [q.id, index < 8 ? q.correctId : q.options.find(o => o.id !== q.correctId).id]));
    const result = calculateResult(quiz, answers);
    assert.deepEqual([result.correct, result.wrong, result.skipped, result.percent], [8, 4, 3, 53]);
    const twelve = Object.fromEntries(quiz.questions.slice(0, 12).map(q => [q.id, q.correctId]));
    assert.equal(calculateResult(quiz, twelve).percent, 80);
  });
  test(`${quiz.id}: persisted shuffle remains valid; corrupted storage is rejected`, () => {
    const attempt = createAttempt(quiz.id);
    attempt.answers[quiz.questions[0].id] = quiz.questions[0].correctId;
    assert.ok(validAttempt(JSON.parse(JSON.stringify(attempt)), quiz.id));
    attempt.order[quiz.questions[0].id] = Array(4).fill(quiz.questions[0].correctId);
    assert.equal(validAttempt(attempt, quiz.id), false);
    assert.equal(validAttempt({ ...createAttempt(quiz.id), index: 15 }, quiz.id), false);
    assert.equal(validAttempt({ ...createAttempt(quiz.id), answers: { other: 'invalid' } }, quiz.id), false);
  });
}
test('restarting one quiz preserves the other attempt', () => {
  const attempts = { her: createAttempt('her'), him: createAttempt('him') };
  attempts.her.answers.food = 'food-1';
  attempts.him.answers.flowers = 'flowers-0';
  const her = attempts.her;
  attempts.him = createAttempt('him');
  assert.equal(attempts.her, her);
  assert.equal(attempts.her.answers.food, 'food-1');
  assert.deepEqual(attempts.him.answers, {});
});
