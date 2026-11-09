import test from 'node:test';
import assert from 'node:assert/strict';
import {
  linkSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import analysisDownloadFixture from '../../src/storage/tests/fixtures/cedar-watch-analysis-download.json' with { type: 'json' };
import config from '../../src/storage/tests/fixtures/cedar-watch-analysis-config.json' with { type: 'json' };
import { convertCedarWatchExport, parseBoundedJson } from '../convert-cedar-watch-preview.mjs';

const participant = Object.fromEntries(Object.entries(analysisDownloadFixture.participants[0])
  .filter(([key]) => key !== 'qualitativeCodes'));
const clone = (value) => structuredClone(value);
const scriptPath = path.resolve('scripts/convert-cedar-watch-preview.mjs');

test('bounded parser rejects duplicate keys at every nesting level, including escaped-equivalent keys', () => {
  for (const json of [
    '{"outer":{"key":1,"key":2}}',
    '{"outer":[{"key":1,"\\u006bey":2}]}',
    '[{"x":1,"x":null}]',
    '{"__proto__":{"safe":true},"__proto__":{}}',
  ]) {
    assert.throws(() => parseBoundedJson(json), { message: 'duplicate_json_key' }, json);
  }
  const safe = parseBoundedJson('{"__proto__":{"safe":true}}');
  assert.equal(Object.getPrototypeOf(safe), null);
  assert.equal(Object.getOwnPropertyDescriptor(safe, '__proto__').value.safe, true);
});

test('completion and rejection status distinguish false, valid rejected objects, and legitimate incomplete records', () => {
  const partial = clone(participant);
  partial.completed = false;
  partial.rejected = { reason: 'screened', timestamp: 123 };
  partial.answers['trial-corroboration-a_1'].endTime = -1;
  delete partial.answers['trial-corroboration-a_1'].answer['q-corr-a'];
  const result = convertCedarWatchExport(partial, config);
  assert.equal(result.diagnostics.acceptedCount, 1);
  assert.equal(result.diagnostics.incompleteCount, 1);
  assert.equal(result.participants[0].completed, false);
  assert.equal(result.participants[0].rejectedStatus, 'rejected');
  assert.deepEqual(result.participants[0].trials[0].responses['q-corr-a'], { state: 'missing', value: null });

  for (const rejected of [null, true, 'no', { reason: 5, timestamp: 1 }, { reason: 'x', timestamp: '1' }]) {
    const malformed = clone(participant);
    malformed.rejected = rejected;
    assert.equal(convertCedarWatchExport(malformed, config).diagnostics.quarantined[0].code, 'malformed_rejected_status');
  }
  const malformedCompletion = clone(participant);
  malformedCompletion.completed = 'false';
  assert.equal(convertCedarWatchExport(malformedCompletion, config).diagnostics.quarantined[0].code, 'malformed_completed_status');
});

test('CLI detects output aliases through symlink and hard link without changing source bytes', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'cedar-alias-'));
  try {
    const input = path.join(directory, 'raw.json');
    const configFile = path.join(directory, 'config.json');
    const symlinkOutput = path.join(directory, 'raw-symlink.json');
    const hardlinkOutput = path.join(directory, 'raw-hardlink.json');
    const inputBytes = `${JSON.stringify(participant)}\n`;
    writeFileSync(input, inputBytes);
    writeFileSync(configFile, JSON.stringify(config));
    symlinkSync(input, symlinkOutput);
    linkSync(input, hardlinkOutput);

    for (const [alias, expectedError] of [
      [symlinkOutput, 'Conversion failed: output_aliases_input\n'],
      // The CLI's path-based alias check cannot identify hard links, but exclusive creation
      // must still refuse to replace the linked file.
      [hardlinkOutput, 'Conversion failed: conversion_failed\n'],
    ]) {
      const run = spawnSync(process.execPath, [scriptPath, input, configFile, alias], { encoding: 'utf8' });
      assert.equal(run.status, 1, run.stderr);
      assert.equal(run.stderr, expectedError);
      assert.equal(readFileSync(input, 'utf8'), inputBytes);
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
