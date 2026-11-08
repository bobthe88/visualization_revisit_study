import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { preparePagesStudyEntry } from './prepare-pages-study-entry.mjs';

test('copies the generated root SPA entry into the Pages study directory', async () => {
  const distDirectory = await mkdtemp(join(tmpdir(), 'revisit-pages-entry-'));
  const rootHtml = '<html><script src="/repository/assets/app.js"></script></html>';
  const studyDirectory = join(distDirectory, 'cedar-watch-pilot');
  await mkdir(studyDirectory);
  await writeFile(join(distDirectory, 'index.html'), rootHtml);

  try {
    await preparePagesStudyEntry(distDirectory);
    assert.equal(await readFile(join(studyDirectory, 'index.html'), 'utf8'), rootHtml);
  } finally {
    await rm(distDirectory, { recursive: true, force: true });
  }
});

test('does not create a missing study directory', async () => {
  const distDirectory = await mkdtemp(join(tmpdir(), 'revisit-pages-entry-'));
  await writeFile(join(distDirectory, 'index.html'), '<html></html>');

  try {
    await assert.rejects(preparePagesStudyEntry(distDirectory));
    await assert.rejects(readFile(join(distDirectory, 'cedar-watch-pilot', 'index.html')));
  } finally {
    await rm(distDirectory, { recursive: true, force: true });
  }
});
