import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('student detail route has a renderer implementation', () => {
  const source = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');

  assert.match(source, /#student\//);
  assert.match(source, /function renderStudentDetail\s*\(/);
});

test('student detail uses dedicated term state instead of shared page filter state', () => {
  const source = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  const renderStudentDetailBlock = source.match(/function renderStudentDetail[\s\S]*?function summaryStat/)?.[0] ?? '';

  assert.match(source, /studentTermKey/);
  assert.match(renderStudentDetailBlock, /state\.studentTermKey = value/);
  assert.doesNotMatch(renderStudentDetailBlock, /state\.termKey = value/);
});

test('class summary follows selected subject scope', () => {
  const source = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');

  assert.match(source, /const summaryRecords = state\.classSubjectScope === 'all'/);
  assert.match(source, /classRecords\.filter\(\(record\) => record\.subjectName === state\.classSubjectScope\)/);
});

test('student detail provides return links to rankings and class analysis', () => {
  const source = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  const renderStudentDetailBlock = source.match(/function renderStudentDetail[\s\S]*?function summaryStat/)?.[0] ?? '';

  assert.match(renderStudentDetailBlock, /查看同班/);
  assert.match(renderStudentDetailBlock, /回全校排名/);
  assert.match(source, /function navigateToClassView\s*\(/);
  assert.match(source, /location\.hash = '#classes'/);
});

test('ranking table supports direct jump from class column to class analysis', () => {
  const source = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');

  assert.match(source, /function classLink\s*\(/);
  assert.match(source, /label: '班級', render: \(row\) => classLink\(row\.className\)/);
  assert.match(source, /location\.hash = '#classes'/);
});

test('student detail lower sections use dense detail lists', () => {
  const source = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');

  assert.match(source, /function studentWeakSubjectList/);
  assert.match(source, /class: 'detail-list detail-list-dense'/);
  assert.match(source, /class: 'detail-card detail-card-dense'/);
});

test('students and watchlist pages use workbench-style section classes', () => {
  const source = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');

  assert.match(source, /search-workbench/);
  assert.match(source, /watchlist-workbench/);
});
