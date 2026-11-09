import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  mkdtempSync, readFileSync, rmSync, truncateSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import analysisDownloadFixture from '../../src/storage/tests/fixtures/cedar-watch-analysis-download.json' with { type: 'json' };
import analysisDownloadConfig from '../../src/storage/tests/fixtures/cedar-watch-analysis-config.json' with { type: 'json' };
import { convertCedarWatchExport, parseBoundedJson, SCHEMA_VERSION } from '../convert-cedar-watch-preview.mjs';

const clone = (value) => structuredClone(value);
// The download fixture is a sanitized derivative. Strip its analysis-only wrapper for single-record tests.
const participant = Object.fromEntries(Object.entries(analysisDownloadFixture.participants[0])
  .filter(([key]) => key !== 'qualitativeCodes'));
const config = analysisDownloadConfig;
const answered = (value) => ({ state: 'answered', value });
const expectedComponent = (componentName, sequenceIndex, values) => ({
  componentName,
  sequenceIndex,
  capture: 'ended',
  timingAnomaly: false,
  responses: Object.fromEntries(Object.entries(values).map(([id, value]) => [id, answered(value)])),
});

test('converts a single participant record derived from the sanitized UI download', () => {
  const result = convertCedarWatchExport(participant, config);
  assert.equal(result.schemaVersion, SCHEMA_VERSION);
  assert.equal(result.participants.length, 1);
  const [record] = result.participants;
  assert.equal(record.participantPseudonym, participant.participantId);
  assert.equal(record.trials.length, 10);
  assert.equal(record.practice.componentName, 'practice');
  assert.equal(record.survey.componentName, 'usability');
  assert.equal(record.debrief.componentName, 'debrief');
  assert.equal(record.trials[1].responses['q-corr-b'].value, 'unknown');
  assert.equal(record.trials[2].responses['q-conflict-a'].value, 'unknown-not-zero');
  assert.equal(result.diagnostics.acceptedCount, 1);
  assert.equal(result.sourceContentSha256, null);
  assert.equal(convertCedarWatchExport.length, 2);
});

test('goldens all 13 response components from the sanitized UI analysis-download array', () => {
  assert.equal(analysisDownloadFixture.fixtureDescription.includes('not a raw exact analysis download'), true);
  assert.equal(analysisDownloadFixture.participants.length, 1);
  assert.equal(Object.keys(analysisDownloadFixture.participants[0].answers).length, 13);
  const result = convertCedarWatchExport(analysisDownloadFixture.participants, analysisDownloadConfig);
  const trialExpected = [
    ['trial-corroboration-a', 'corroboration-A-baseline', 'corroboration', 'A', 'baseline', 'q-corr-a', 'same-items', 'confidence-corr-a', 'difficulty-corr-a'],
    ['trial-corroboration-b', 'corroboration-B-recommended', 'corroboration', 'B', 'recommended', 'q-corr-b', 'unknown', 'confidence-corr-b', 'difficulty-corr-b'],
    ['trial-conflict-a', 'conflict-A-recommended', 'conflict', 'A', 'recommended', 'q-conflict-a', 'unknown-not-zero', 'confidence-conflict-a', 'difficulty-conflict-a'],
    ['trial-conflict-b', 'conflict-B-baseline', 'conflict', 'B', 'baseline', 'q-conflict-b', 'six-vs-four', 'confidence-conflict-b', 'difficulty-conflict-b'],
    ['trial-uncertain-a', 'uncertain-A-baseline', 'uncertain', 'A', 'baseline', 'q-uncertain-a', 'four-hours', 'confidence-uncertain-a', 'difficulty-uncertain-a'],
    ['trial-uncertain-b', 'uncertain-B-recommended', 'uncertain', 'B', 'recommended', 'q-uncertain-b', 'observation-not-receipt', 'confidence-uncertain-b', 'difficulty-uncertain-b'],
    ['trial-quality-a', 'quality-A-recommended', 'quality', 'A', 'recommended', 'q-quality-a', 'not-verified', 'confidence-quality-a', 'difficulty-quality-a'],
    ['trial-quality-b', 'quality-B-baseline', 'quality', 'B', 'baseline', 'q-quality-b', 'unresolved-range', 'confidence-quality-b', 'difficulty-quality-b'],
    ['trial-anomaly-a', 'anomaly-A-baseline', 'anomaly', 'A', 'baseline', 'q-anomaly-a', 'no-proof', 'confidence-anomaly-a', 'difficulty-anomaly-a'],
    ['trial-anomaly-b', 'anomaly-B-recommended', 'anomaly', 'B', 'recommended', 'q-anomaly-b', 'frequency-and-coverage', 'confidence-anomaly-b', 'difficulty-anomaly-b'],
  ];
  const trials = trialExpected.map((row, index) => {
    const [componentName, trialId, scenarioFamily, taskVariant, condition, questionId, answer, confidenceId, difficultyId] = row;
    return {
      ...expectedComponent(componentName, index + 1, {
        [questionId]: answer,
        [confidenceId]: '1',
        [difficultyId]: '1',
      }),
      configuredTrial: {
        contractVersion: 1,
        trialId,
        scenarioFamily,
        taskVariant,
        condition,
        stimulusSeed: 271828,
      },
      observedExposure: null,
    };
  });
  const expected = {
    schemaVersion: 'cedar-watch-research-preview/1',
    sourceStudyId: null,
    configuredInstrument: 'Cedar Watch Visualization Pilot — Synthetic Preview',
    verifiedConfigHash: '80d5196e20bbb0bb176122315bb06619ef0b1aeed87e47ff7a15f4251896d89e',
    sourceContentSha256: null,
    researchUseLimitations: ['synthetic_preview_only', 'consent_not_recorded', 'visualization_interactions_not_captured', 'child_timing_not_captured'],
    visualizationInteractions: { availability: 'not_captured' },
    childTiming: { availability: 'not_captured' },
    participants: [{
      participantPseudonym: 'synthetic-pid-001',
      participantConfigHash: '80d5196e20bbb0bb176122315bb06619ef0b1aeed87e47ff7a15f4251896d89e',
      completed: true,
      rejectedStatus: 'not_rejected',
      sourceRecordIndex: 0,
      practice: expectedComponent('practice', 0, { 'practice-understanding': 'No' }),
      trials,
      survey: expectedComponent('usability', 11, {
        'evidence-clarity': '1',
        'condition-preference': 'baseline',
        'easier-condition': 'baseline',
      }),
      debrief: expectedComponent('debrief', 12, { 'preview-acknowledgement': 'Understood' }),
    }],
    diagnostics: {
      inputCount: 1,
      acceptedCount: 1,
      quarantinedCount: 0,
      incompleteCount: 0,
      quarantined: [],
    },
  };
  assert.deepEqual(result, expected);
  assert.equal(result.participants[0].completed, true);
  assert.equal(result.participants[0].trials[1].responses['q-corr-b'].value, 'unknown');
  assert.equal(Object.hasOwn(result.participants[0], 'sessionId'), false);
  assert.equal(Object.hasOwn(result.participants[0], 'consent'), false);
  assert.equal(Object.hasOwn(result, 'studyId'), false);
  assert.equal(result.sourceStudyId, null);
  assert.equal(result.participants[0].trials[0].observedExposure, null);
});

test('rejects mutated analysis-download config and participant content', () => {
  const mutatedConfig = clone(analysisDownloadConfig);
  mutatedConfig.components['trial-corroboration-a'].parameters.condition = 'recommended';
  assert.throws(() => convertCedarWatchExport(analysisDownloadFixture.participants, mutatedConfig), /unapproved_config_hash/);
  const mutatedExport = clone(analysisDownloadFixture.participants);
  mutatedExport[0].answers['trial-corroboration-a_1'].parameters.condition = 'recommended';
  const result = convertCedarWatchExport(mutatedExport, analysisDownloadConfig);
  assert.equal(result.diagnostics.quarantined[0].code, 'trial_parameters_mismatch');
  assert.equal(result.participants.length, 0);
});

test('accepts analysis arrays and preserves incomplete fields without treating missing as unknown', () => {
  const partial = clone(participant);
  delete partial.answers['trial-corroboration-a_1'].answer['q-corr-a'];
  delete partial.answers['trial-corroboration-a_1'].answer['confidence-corr-a'];
  partial.answers['trial-corroboration-a_1'].endTime = -1;
  const result = convertCedarWatchExport([{ ...partial, completed: false, qualitativeCodes: { participantTags: [], taskTags: {} } }], config);
  const trial = result.participants[0].trials[0];
  assert.deepEqual(trial.responses['q-corr-a'], { state: 'missing', value: null });
  assert.deepEqual(trial.responses['confidence-corr-a'], { state: 'missing', value: null });
  assert.equal(trial.capture, 'in_progress');
  assert.equal(result.diagnostics.incompleteCount, 1);
  assert.equal(result.participants[0].completed, false);
  assert.equal(result.participants[0].rejectedStatus, 'not_rejected');
  assert.equal(result.participants[0].trials[1].responses['q-corr-b'].value, 'unknown');
  assert.equal(result.participants[0].trials[0].observedExposure, null);

  const noTrialRecord = clone(participant);
  noTrialRecord.completed = false;
  delete noTrialRecord.answers['trial-corroboration-a_1'];
  const notObserved = convertCedarWatchExport(noTrialRecord, config).participants[0].trials[0];
  assert.equal(notObserved.capture, 'not_observed');
  assert.deepEqual(notObserved.responses['q-corr-a'], { state: 'missing', value: null });
  assert.deepEqual(notObserved.configuredTrial, config.components['trial-corroboration-a'].parameters);
  assert.equal(notObserved.observedExposure, null);
});

test('quarantines an illegal configured choice', () => {
  const malformed = clone(participant);
  malformed.answers['trial-corroboration-a_1'].answer['q-corr-a'] = 'not-a-choice';
  const result = convertCedarWatchExport(malformed, config);
  assert.equal(result.diagnostics.quarantined[0].code, 'invalid_legal_choice');
  assert.equal(result.participants.length, 0);
});

test('rejects unapproved or mutated config and participant hash mismatch', () => {
  const changedConfig = clone(config);
  changedConfig.studyMetadata.version = 'draft-2';
  assert.throws(() => convertCedarWatchExport(participant, changedConfig), /unapproved_config_hash/);
  const mismatch = clone(participant);
  mismatch.participantConfigHash = '0'.repeat(64);
  assert.equal(convertCedarWatchExport(mismatch, config).diagnostics.quarantined[0].code, 'unsupported_participant_config_hash');
});

test('quarantines malformed data schema and a participant sequence mismatch', () => {
  assert.equal(convertCedarWatchExport({ participantId: 'p' }, config).diagnostics.quarantined[0].code, 'malformed_participant');
  const wrongSequence = clone(participant);
  wrongSequence.sequence.components.reverse();
  assert.equal(convertCedarWatchExport(wrongSequence, config).diagnostics.quarantined[0].code, 'participant_sequence_mismatch');
});

test('quarantines all duplicate pseudonyms and unknown component identifiers', () => {
  const duplicate = clone(participant);
  assert.equal(convertCedarWatchExport([participant, duplicate], config).diagnostics.quarantined.length, 2);
  const unknown = clone(participant);
  unknown.answers.mystery_1 = { componentName: 'mystery', identifier: 'mystery_1', answer: {} };
  assert.equal(convertCedarWatchExport(unknown, config).diagnostics.quarantined[0].code, 'unknown_component');
});

test('rejects mismatched trial parameters and does not fabricate consent, session, pilotSession, or telemetry', () => {
  const mismatch = clone(participant);
  mismatch.answers['trial-corroboration-a_1'].parameters = { ...config.components['trial-corroboration-a'].parameters, condition: 'recommended' };
  assert.equal(convertCedarWatchExport(mismatch, config).diagnostics.quarantined[0].code, 'trial_parameters_mismatch');
  const result = convertCedarWatchExport(participant, config);
  const encoded = JSON.stringify(result);
  assert.equal(result.visualizationInteractions.availability, 'not_captured');
  assert.equal(result.childTiming.availability, 'not_captured');
  assert.equal(encoded.includes('pilotSession'), false);
  assert.equal(encoded.includes('sessionId'), false);
  assert.equal(Object.hasOwn(result.participants[0], 'consent'), false);
});

test('preserves absent completion as unknown and rejects completed records with missing or unended required responses', () => {
  const participantWithoutStatus = clone(participant);
  delete participantWithoutStatus.completed;
  const noStatus = convertCedarWatchExport(participantWithoutStatus, config).participants[0];
  assert.equal(noStatus.completed, 'unknown');
  assert.equal(noStatus.rejectedStatus, 'not_rejected');
  const nullStatus = clone(participant);
  nullStatus.completed = null;
  assert.equal(convertCedarWatchExport(nullStatus, config).participants[0].completed, null);
  const complete = clone(participant);
  complete.completed = true;
  assert.equal(convertCedarWatchExport(complete, config).participants[0].completed, true);
  const completed = clone(participant);
  completed.completed = true;
  delete completed.answers['trial-corroboration-a_1'].answer['q-corr-a'];
  assert.equal(convertCedarWatchExport(completed, config).diagnostics.quarantined[0].code, 'completed_with_missing_responses');
  const unfinished = clone(participant);
  unfinished.completed = true;
  unfinished.answers.debrief_12.endTime = -1;
  assert.equal(convertCedarWatchExport(unfinished, config).diagnostics.quarantined[0].code, 'completed_with_missing_responses');
});

test('maps rejected objects to a status without leaking reason or timestamp', () => {
  const rejected = clone(participant);
  rejected.rejected = { reason: 'sensitive rejection detail', timestamp: 42 };
  const result = convertCedarWatchExport(rejected, config);
  assert.equal(result.participants[0].rejectedStatus, 'rejected');
  assert.equal(JSON.stringify(result).includes('sensitive rejection detail'), false);
  assert.equal(JSON.stringify(result).includes('timestamp'), false);
});

test('rejects rejected:true and non-finite rejection timestamps', () => {
  for (const rejected of [true, { reason: 'rejected', timestamp: parseBoundedJson('1e999') }]) {
    const malformed = clone(participant);
    malformed.rejected = rejected;
    assert.equal(convertCedarWatchExport(malformed, config).diagnostics.quarantined[0].code, 'malformed_rejected_status');
  }
});

test('does not quarantine unexpected internal exceptions as bad input rows', () => {
  const broken = clone(participant);
  Object.defineProperty(broken.answers['trial-corroboration-a_1'], 'optionOrders', {
    get() { throw new Error('unexpected_internal_failure'); },
  });
  assert.throws(() => convertCedarWatchExport(broken, config), /unexpected_internal_failure/);
});

test('requires exact trial parameter key/value structure and analysis wrapper only in arrays', () => {
  const extraParam = clone(participant);
  extraParam.answers['trial-corroboration-a_1'].parameters = { ...config.components['trial-corroboration-a'].parameters, extra: false };
  assert.equal(convertCedarWatchExport(extraParam, config).diagnostics.quarantined[0].code, 'trial_parameters_mismatch');
  const fabricatedSingleWrapper = convertCedarWatchExport({ ...participant, qualitativeCodes: { participantTags: [], taskTags: {} } }, config);
  assert.equal(fabricatedSingleWrapper.diagnostics.quarantined[0].code, 'malformed_participant');
  assert.throws(() => convertCedarWatchExport(Array(101).fill(participant), config), /participant_limit_exceeded/);
});

test('validates stored optionOrders against configured labels and values while allowing randomized order', () => {
  const reordered = clone(participant);
  Object.values(reordered.answers).forEach((stored) => {
    Object.values(stored.optionOrders ?? {}).forEach((options) => options.reverse());
  });
  assert.equal(convertCedarWatchExport(reordered, config).diagnostics.acceptedCount, 1);

  const changedLabel = clone(participant);
  changedLabel.answers['trial-corroboration-a_1'].optionOrders['q-corr-a'][0].label = 'not the configured label';
  assert.equal(convertCedarWatchExport(changedLabel, config).diagnostics.quarantined[0].code, 'invalid_option_orders');

  const contradictoryInfoText = clone(participant);
  contradictoryInfoText.answers['trial-corroboration-a_1'].optionOrders['q-corr-a'][0].infoText = 'contradictory tooltip';
  assert.equal(convertCedarWatchExport(contradictoryInfoText, config).diagnostics.quarantined[0].code, 'invalid_option_orders');

  const unsupportedProperty = clone(participant);
  unsupportedProperty.answers['trial-corroboration-a_1'].optionOrders['q-corr-a'][0].tooltip = 'unsupported field';
  assert.equal(convertCedarWatchExport(unsupportedProperty, config).diagnostics.quarantined[0].code, 'invalid_option_orders');

  const missingChoice = clone(participant);
  missingChoice.answers['trial-corroboration-a_1'].optionOrders['q-corr-a'].pop();
  assert.equal(convertCedarWatchExport(missingChoice, config).diagnostics.quarantined[0].code, 'invalid_option_orders');

  const partialOptionOrders = clone(participant);
  delete partialOptionOrders.answers['trial-corroboration-a_1'].optionOrders['confidence-corr-a'];
  assert.equal(convertCedarWatchExport(partialOptionOrders, config).diagnostics.quarantined[0].code, 'invalid_option_orders');

  const duplicateChoice = clone(participant);
  duplicateChoice.answers['trial-corroboration-a_1'].optionOrders['q-corr-a'][1] = clone(duplicateChoice.answers['trial-corroboration-a_1'].optionOrders['q-corr-a'][0]);
  assert.equal(convertCedarWatchExport(duplicateChoice, config).diagnostics.quarantined[0].code, 'invalid_option_orders');

  const absentOrder = clone(participant);
  delete absentOrder.answers['trial-corroboration-a_1'].optionOrders;
  assert.equal(convertCedarWatchExport(absentOrder, config).diagnostics.acceptedCount, 1);
});

test('labels the host unvisited sentinel without claiming a visit and validates ended intervals', () => {
  const unvisited = clone(participant);
  unvisited.completed = false;
  unvisited.answers['trial-corroboration-a_1'].startTime = 0;
  unvisited.answers['trial-corroboration-a_1'].endTime = -1;
  const converted = convertCedarWatchExport(unvisited, config);
  assert.equal(converted.participants[0].trials[0].capture, 'unstarted_or_unsaved');
  const invalidEnded = clone(participant);
  invalidEnded.answers['trial-corroboration-a_1'].startTime = 0;
  invalidEnded.answers['trial-corroboration-a_1'].endTime = 0;
  assert.equal(convertCedarWatchExport(invalidEnded, config).diagnostics.quarantined[0].code, 'malformed_capture_state');
  const zeroEnded = clone(participant);
  zeroEnded.answers['trial-corroboration-a_1'].endTime = 0;
  assert.equal(convertCedarWatchExport(zeroEnded, config).diagnostics.quarantined[0].code, 'malformed_capture_state');
  const invalidOrder = clone(participant);
  invalidOrder.answers['trial-corroboration-a_1'].endTime = 1999;
  invalidOrder.completed = true;
  const clockRollback = convertCedarWatchExport(invalidOrder, config);
  assert.equal(clockRollback.diagnostics.acceptedCount, 1);
  assert.equal(clockRollback.participants[0].trials[0].capture, 'ended');
  assert.equal(clockRollback.participants[0].trials[0].timingAnomaly, true);
  assert.equal(clockRollback.participants[0].completed, true);
});

test('an empty array is a valid empty export with accurate zero counts', () => {
  const result = convertCedarWatchExport([], config);
  assert.equal(result.diagnostics.inputCount, 0);
  assert.equal(result.diagnostics.acceptedCount, 0);
  assert.equal(result.diagnostics.quarantinedCount, 0);
  assert.deepEqual(result.participants, []);
});

test('bounded parser rejects duplicate keys, malformed top-level JSON, excessive depth and size', () => {
  assert.throws(() => parseBoundedJson('{"a":1,"a":2}'), /duplicate_json_key/);
  assert.throws(() => parseBoundedJson('{"a":1,"\\u0061":2}'), /duplicate_json_key/);
  assert.throws(() => parseBoundedJson('{"a":'), /invalid_json/);
  assert.throws(() => parseBoundedJson('\u00a0{}'), /invalid_json/);
  assert.throws(() => parseBoundedJson('[[[0]]]', { bytes: 100, depth: 1, nodes: 10 }), /nesting_limit_exceeded/);
  assert.throws(() => parseBoundedJson('12345', { bytes: 2, depth: 1, nodes: 10 }), /input_too_large/);
  assert.throws(() => convertCedarWatchExport(12, config), /invalid_top_level_shape/);
});

test('CLI hashes original bytes, refuses overwrite, and emits only fixed errors', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'cedar-preview-'));
  try {
    const inputPath = path.join(directory, 'raw.json');
    const configPath = path.join(directory, 'config.json');
    const outputPath = path.join(directory, 'result.json');
    const rawText = `${JSON.stringify(participant, null, 2)}\n`;
    writeFileSync(inputPath, rawText);
    writeFileSync(configPath, JSON.stringify(config));
    const scriptPath = path.resolve('scripts/convert-cedar-watch-preview.mjs');
    const run = spawnSync(process.execPath, [scriptPath, inputPath, configPath, outputPath], { encoding: 'utf8' });
    assert.equal(run.status, 0);
    const result = JSON.parse(readFileSync(outputPath, 'utf8'));
    assert.equal(result.sourceContentSha256, createHash('sha256').update(rawText).digest('hex'));
    writeFileSync(outputPath, 'keep existing');
    const overwrite = spawnSync(process.execPath, [scriptPath, inputPath, configPath, outputPath], { encoding: 'utf8' });
    assert.equal(overwrite.status, 1);
    assert.equal(overwrite.stderr, 'Conversion failed: conversion_failed\n');
    assert.equal(readFileSync(outputPath, 'utf8'), 'keep existing');
    const alias = spawnSync(process.execPath, [scriptPath, inputPath, configPath, inputPath], { encoding: 'utf8' });
    assert.equal(alias.status, 1);
    assert.equal(alias.stderr, 'Conversion failed: output_aliases_input\n');
    assert.equal(readFileSync(inputPath, 'utf8'), rawText);
    const oversizedPath = path.join(directory, 'oversized.json');
    writeFileSync(oversizedPath, 'x');
    truncateSync(oversizedPath, 10 * 1024 * 1024 + 1);
    const oversized = spawnSync(process.execPath, [scriptPath, oversizedPath, configPath, path.join(directory, 'oversized-out.json')], { encoding: 'utf8', timeout: 5000 });
    assert.equal(oversized.status, 1);
    assert.equal(oversized.stderr, 'Conversion failed: input_too_large\n');
    const nonRegular = spawnSync(process.execPath, [scriptPath, directory, configPath, path.join(directory, 'dir-out.json')], { encoding: 'utf8', timeout: 5000 });
    assert.equal(nonRegular.status, 1);
    assert.equal(nonRegular.stderr, 'Conversion failed: input_not_regular\n');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
