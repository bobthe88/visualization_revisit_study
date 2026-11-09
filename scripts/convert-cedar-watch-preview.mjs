import { createHash, randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import {
  link, open, realpath, unlink, writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const APPROVED_CONFIG_HASH = '80d5196e20bbb0bb176122315bb06619ef0b1aeed87e47ff7a15f4251896d89e';
export const SCHEMA_VERSION = 'cedar-watch-research-preview/1';
export const LIMITS = Object.freeze({
  bytes: 10 * 1024 * 1024,
  depth: 64,
  participants: 100,
  outputBytes: 10 * 1024 * 1024,
  nodes: 1_000_000,
});

const trialComponents = [
  'trial-corroboration-a', 'trial-corroboration-b', 'trial-conflict-a', 'trial-conflict-b',
  'trial-uncertain-a', 'trial-uncertain-b', 'trial-quality-a', 'trial-quality-b',
  'trial-anomaly-a', 'trial-anomaly-b',
];
const componentOrder = ['practice', ...trialComponents, 'usability', 'debrief'];
const parameterKeys = ['contractVersion', 'trialId', 'scenarioFamily', 'taskVariant', 'condition', 'stimulusSeed'];
const participantFields = new Set(['participantId', 'participantConfigHash', 'sequence', 'participantIndex', 'answers', 'searchParams', 'metadata', 'rejected', 'participantTags', 'stage', 'conditions', 'createdTime', 'completed', 'qualitativeCodes']);
const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const digest = (value) => createHash('sha256').update(value).digest('hex');
const recordErrorCodes = new Set(['malformed_participant', 'unsupported_participant_config_hash', 'malformed_completed_status', 'malformed_rejected_status', 'participant_sequence_mismatch', 'unknown_component', 'component_order_mismatch', 'malformed_capture_state', 'unexpected_response_id', 'trial_parameters_mismatch', 'invalid_option_orders', 'invalid_legal_choice', 'duplicate_component', 'completed_with_missing_responses']);

class ValidationError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

const fail = (code) => { throw new ValidationError(code); };

// A small JSON parser keeps native JSON.parse's semantics while rejecting duplicate keys and
// bounding nesting. Strings/numbers/escapes are delegated to JSON.parse on their exact token.
export function parseBoundedJson(source, limits = LIMITS) {
  if (typeof source !== 'string') fail('invalid_json');
  if (Buffer.byteLength(source, 'utf8') > limits.bytes) fail('input_too_large');
  let cursor = 0;
  let nodes = 0;
  const whitespace = () => {
    while (cursor < source.length && [' ', '\t', '\r', '\n'].includes(source[cursor])) cursor += 1;
  };
  const stringToken = () => {
    const start = cursor;
    cursor += 1;
    while (cursor < source.length) {
      const character = source[cursor];
      if (character === '\\') cursor += 2;
      else if (character === '"') {
        cursor += 1;
        try { return JSON.parse(source.slice(start, cursor)); } catch { fail('invalid_json'); }
      } else cursor += 1;
    }
    return fail('invalid_json');
  };
  const value = (depth) => {
    whitespace();
    nodes += 1;
    if (nodes > limits.nodes || depth > limits.depth) fail(depth > limits.depth ? 'nesting_limit_exceeded' : 'input_too_complex');
    const character = source[cursor];
    if (character === '"') return stringToken();
    if (character === '{') {
      cursor += 1;
      whitespace();
      const result = Object.create(null);
      const keys = new Set();
      if (source[cursor] === '}') { cursor += 1; return result; }
      while (cursor < source.length) {
        whitespace();
        if (source[cursor] !== '"') fail('invalid_json');
        const key = stringToken();
        if (keys.has(key)) fail('duplicate_json_key');
        keys.add(key);
        whitespace();
        if (source[cursor] !== ':') fail('invalid_json');
        cursor += 1;
        result[key] = value(depth + 1);
        whitespace();
        if (source[cursor] === '}') { cursor += 1; return result; }
        if (source[cursor] !== ',') fail('invalid_json');
        cursor += 1;
      }
      fail('invalid_json');
    }
    if (character === '[') {
      cursor += 1;
      whitespace();
      const result = [];
      if (source[cursor] === ']') { cursor += 1; return result; }
      while (cursor < source.length) {
        result.push(value(depth + 1));
        whitespace();
        if (source[cursor] === ']') { cursor += 1; return result; }
        if (source[cursor] !== ',') fail('invalid_json');
        cursor += 1;
      }
      fail('invalid_json');
    }
    const rest = source.slice(cursor);
    const literal = /^(?:true|false|null)/.exec(rest)?.[0];
    if (literal) { cursor += literal.length; return JSON.parse(literal); }
    const number = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(rest)?.[0];
    if (number) { cursor += number.length; return JSON.parse(number); }
    return fail('invalid_json');
  };
  const parsed = value(0);
  whitespace();
  if (cursor !== source.length) fail('invalid_json');
  return parsed;
}

function responseDefinitions(config, componentName) {
  const component = config.components[componentName];
  if (!component || !Array.isArray(component.response)) fail('unsupported_config_structure');
  return component.response.filter((response) => response.type !== 'textOnly').map((response) => {
    if (typeof response.id !== 'string' || !Array.isArray(response.options)) fail('unsupported_config_structure');
    const choices = response.options.map((option) => {
      const choice = typeof option === 'string'
        ? { label: option, value: option }
        : {
          label: option?.label,
          value: option?.value ?? option?.label,
          ...(option?.infoText === undefined ? {} : { infoText: option.infoText }),
        };
      if (typeof choice.label !== 'string' || typeof choice.value !== 'string'
        || (choice.infoText !== undefined && typeof choice.infoText !== 'string')) fail('unsupported_config_structure');
      return choice;
    });
    return { id: response.id, choices, options: choices.map(({ value }) => value) };
  });
}

function validateConfig(config) {
  if (!isRecord(config) || !isRecord(config.components)) fail('unsupported_config_structure');
  if (digest(Buffer.from(JSON.stringify(config), 'utf8')) !== APPROVED_CONFIG_HASH) fail('unapproved_config_hash');
  if (config.studyMetadata?.title !== 'Cedar Watch Visualization Pilot — Synthetic Preview'
    || config.studyMetadata?.version !== 'draft-1' || config.sequence?.order !== 'fixed'
    || JSON.stringify(config.sequence?.components) !== JSON.stringify(componentOrder)) fail('unsupported_config_structure');
  const expected = ['practice', ...trialComponents, 'usability', 'debrief'];
  if (Object.keys(config.components).length !== expected.length
    || expected.some((name) => !config.components[name])) fail('unsupported_config_structure');
  for (const name of trialComponents) {
    const component = config.components[name];
    if (component.type !== 'website' || !isRecord(component.parameters)
      || Object.keys(component.parameters).sort().join(',') !== [...parameterKeys].sort().join(',')) fail('unsupported_config_structure');
    const params = component.parameters;
    if (params.contractVersion !== 1 || params.stimulusSeed !== 271828
      || !['baseline', 'recommended'].includes(params.condition)
      || !['A', 'B'].includes(params.taskVariant) || typeof params.trialId !== 'string'
      || typeof params.scenarioFamily !== 'string') fail('unsupported_config_structure');
  }
}

function normalizeAnswer(stored, id, options) {
  if (!stored || !Object.hasOwn(stored.answer, id)) return { state: 'missing', value: null };
  const answer = stored.answer[id];
  if (typeof answer !== 'string' || !options.includes(answer)) fail('invalid_legal_choice');
  return { state: 'answered', value: answer };
}

function deepEqual(left, right) {
  if (Object.is(left, right)) return true;
  if (!isRecord(left) || !isRecord(right)) return false;
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  return leftKeys.length === rightKeys.length && leftKeys.every((key) => Object.hasOwn(right, key) && deepEqual(left[key], right[key]));
}

function validateOptionOrders(stored, definitions) {
  if (stored.optionOrders === undefined) return;
  if (!isRecord(stored.optionOrders)) fail('invalid_option_orders');
  const expectedById = new Map(definitions.map(({ id, choices }) => [id, choices]));
  if (Object.keys(stored.optionOrders).length !== expectedById.size
    || Object.keys(stored.optionOrders).some((id) => !expectedById.has(id))) fail('invalid_option_orders');
  for (const [id, choices] of expectedById) {
    const observed = stored.optionOrders[id];
    if (!Array.isArray(observed) || observed.length !== choices.length) fail('invalid_option_orders');
    const expected = new Map(choices.map((choice) => [JSON.stringify([choice.label, choice.value]), choice]));
    const seenLabels = new Set();
    const seenValues = new Set();
    for (const option of observed) {
      if (!isRecord(option) || typeof option.label !== 'string' || typeof option.value !== 'string'
        || Object.keys(option).some((key) => !['label', 'value', 'infoText'].includes(key))
        || option.infoText !== choices.find((choice) => choice.value === option.value)?.infoText
        || seenLabels.has(option.label) || seenValues.has(option.value)) fail('invalid_option_orders');
      seenLabels.add(option.label);
      seenValues.add(option.value);
      const key = JSON.stringify([option.label, option.value]);
      if (!expected.has(key)) fail('invalid_option_orders');
      expected.delete(key);
    }
    if (expected.size) fail('invalid_option_orders');
  }
}

function normalizeComponent(record, name, index, config) {
  const instances = Object.values(record.answers).filter((answer) => answer?.componentName === name);
  if (instances.length > 1) fail('duplicate_component');
  const stored = instances[0];
  const definitions = responseDefinitions(config, name);
  if (stored) {
    if (!isRecord(stored) || !isRecord(stored.answer) || stored.identifier !== `${name}_${index}`
      || stored.componentName !== name || stored.trialOrder !== String(index)) fail('component_order_mismatch');
    if (typeof stored.startTime !== 'number' || !Number.isFinite(stored.startTime) || stored.startTime < 0
      || (stored.endTime !== -1 && (typeof stored.endTime !== 'number' || !Number.isFinite(stored.endTime)
        || stored.endTime <= 0 || stored.startTime <= 0))) fail('malformed_capture_state');
    const expectedIds = config.components[name].response.map(({ id }) => id);
    if (Object.keys(stored.answer).some((id) => !expectedIds.includes(id))) fail('unexpected_response_id');
    validateOptionOrders(stored, definitions);
    if (name.startsWith('trial-') && stored.parameters !== undefined
      && !deepEqual(stored.parameters, config.components[name].parameters)) fail('trial_parameters_mismatch');
  }
  const capture = !stored ? 'not_observed'
    : stored.endTime !== -1 ? 'ended'
      : stored.startTime === 0 ? 'unstarted_or_unsaved' : 'in_progress';
  const timingAnomaly = stored && stored.endTime !== -1 ? stored.endTime < stored.startTime : null;
  const responses = Object.fromEntries(definitions.map(({ id, options }) => [id, normalizeAnswer(stored, id, options)]));
  return {
    componentName: name,
    sequenceIndex: index,
    capture,
    timingAnomaly,
    responses,
  };
}

function normalizeParticipant(record, config, inputIndex) {
  if (!isRecord(record) || typeof record.participantId !== 'string' || !record.participantId
    || typeof record.participantConfigHash !== 'string' || !isRecord(record.sequence)
    || !Array.isArray(record.sequence.components) || !isRecord(record.answers)) fail('malformed_participant');
  if (Object.keys(record).some((key) => !participantFields.has(key) || key === 'qualitativeCodes')) fail('malformed_participant');
  if (record.participantConfigHash !== APPROVED_CONFIG_HASH) fail('unsupported_participant_config_hash');
  if (record.completed !== undefined && record.completed !== null && typeof record.completed !== 'boolean') fail('malformed_completed_status');
  if (record.rejected !== undefined && record.rejected !== false
    && (!isRecord(record.rejected) || typeof record.rejected.reason !== 'string'
      || typeof record.rejected.timestamp !== 'number' || !Number.isFinite(record.rejected.timestamp))) fail('malformed_rejected_status');
  if (JSON.stringify(record.sequence.components) !== JSON.stringify([...componentOrder, 'end'])) fail('participant_sequence_mismatch');
  for (const [key, answer] of Object.entries(record.answers)) {
    if (!isRecord(answer) || typeof answer.componentName !== 'string' || !componentOrder.includes(answer.componentName)) fail('unknown_component');
    if (key !== answer.identifier || answer.identifier !== `${answer.componentName}_${componentOrder.indexOf(answer.componentName)}`) fail('component_order_mismatch');
  }
  const components = componentOrder.map((name, index) => normalizeComponent(record, name, index, config));
  const trials = components.slice(1, 11).map((entry) => ({
    ...entry,
    configuredTrial: { ...config.components[entry.componentName].parameters },
    observedExposure: null,
  }));
  const completeFieldsMissing = components.some((component) => component.capture !== 'ended'
    || Object.values(component.responses).some((response) => response.state === 'missing'));
  if (record.completed === true && completeFieldsMissing) fail('completed_with_missing_responses');
  const rejectedStatus = record.rejected === undefined ? 'unknown'
    : record.rejected === false ? 'not_rejected' : 'rejected';
  return {
    participantPseudonym: record.participantId,
    participantConfigHash: record.participantConfigHash,
    completed: record.completed === undefined ? 'unknown' : record.completed,
    rejectedStatus,
    sourceRecordIndex: inputIndex,
    practice: components[0],
    trials,
    survey: components[11],
    debrief: components[12],
  };
}

function inputParticipants(input, limits) {
  const isAnalysisArray = Array.isArray(input);
  if (!isAnalysisArray && (!isRecord(input) || !Object.hasOwn(input, 'participantId'))) fail('invalid_top_level_shape');
  const candidates = isAnalysisArray ? input : [input];
  if (candidates.length > limits.participants) fail('participant_limit_exceeded');
  return candidates;
}

function unwrapAnalysisParticipant(candidate, isAnalysisArray) {
  if (!isRecord(candidate)) return candidate;
  if (Object.keys(candidate).some((key) => !participantFields.has(key))) fail('malformed_participant');
  if (!Object.hasOwn(candidate, 'qualitativeCodes')) return candidate;
  if (!isAnalysisArray) fail('malformed_participant');
  const { qualitativeCodes, ...participantRecord } = candidate;
  if (!isRecord(qualitativeCodes) || !Array.isArray(qualitativeCodes.participantTags) || !isRecord(qualitativeCodes.taskTags)) fail('malformed_participant');
  return participantRecord;
}

function convertParsedCedarWatchExport(input, config, sourceContentSha256) {
  validateConfig(config);
  const records = inputParticipants(input, LIMITS);
  const occurrences = new Map();
  records.forEach((record) => {
    if (isRecord(record) && typeof record.participantId === 'string') occurrences.set(record.participantId, (occurrences.get(record.participantId) ?? 0) + 1);
  });
  const participants = [];
  const quarantined = [];
  records.forEach((record, index) => {
    if (isRecord(record) && occurrences.get(record.participantId) > 1) {
      quarantined.push({ sourceRecordIndex: index, code: 'duplicate_participant' });
      return;
    }
    try {
      participants.push(normalizeParticipant(unwrapAnalysisParticipant(record, Array.isArray(input)), config, index));
    } catch (error) {
      if (!(error instanceof ValidationError) || !recordErrorCodes.has(error.code)) throw error;
      quarantined.push({ sourceRecordIndex: index, code: error.code });
    }
  });
  return {
    schemaVersion: SCHEMA_VERSION,
    sourceStudyId: null,
    configuredInstrument: config.studyMetadata.title,
    verifiedConfigHash: APPROVED_CONFIG_HASH,
    sourceContentSha256,
    researchUseLimitations: ['synthetic_preview_only', 'consent_not_recorded', 'visualization_interactions_not_captured', 'child_timing_not_captured'],
    visualizationInteractions: { availability: 'not_captured' },
    childTiming: { availability: 'not_captured' },
    participants,
    diagnostics: {
      inputCount: records.length,
      acceptedCount: participants.length,
      quarantinedCount: quarantined.length,
      incompleteCount: participants.filter((participant) => participant.completed !== true
        || [...participant.trials, participant.practice, participant.survey, participant.debrief]
          .some((component) => component.capture !== 'ended' || Object.values(component.responses).some((response) => response.state === 'missing'))).length,
      quarantined,
    },
  };
}

export function convertCedarWatchExport(input, config) {
  return convertParsedCedarWatchExport(input, config, null);
}

async function parseFile(filePath) {
  // Nonblocking open prevents FIFOs from hanging before fstat can reject them.
  // eslint-disable-next-line no-bitwise
  const handle = await open(filePath, constants.O_RDONLY | constants.O_NONBLOCK);
  try {
    const before = await handle.stat({ bigint: true });
    if (!before.isFile()) fail('input_not_regular');
    if (before.size > BigInt(LIMITS.bytes)) fail('input_too_large');
    const chunks = [];
    let byteLength = 0;
    const stream = handle.createReadStream({
      start: 0,
      end: LIMITS.bytes,
      highWaterMark: 64 * 1024,
      autoClose: false,
    });
    for await (const chunk of stream) {
      byteLength += chunk.byteLength;
      if (byteLength > LIMITS.bytes) {
        stream.destroy();
        fail('input_too_large');
      }
      chunks.push(chunk);
    }
    const after = await handle.stat({ bigint: true });
    if (before.dev !== after.dev || before.ino !== after.ino || before.size !== after.size
      || before.mtimeNs !== after.mtimeNs || before.ctimeNs !== after.ctimeNs) fail('input_changed');
    const bytes = Buffer.concat(chunks, byteLength);
    let text;
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { fail('invalid_encoding'); }
    return { value: parseBoundedJson(text), bytes };
  } finally {
    await handle.close();
  }
}

async function writeOutputExclusively(outputPath, content) {
  if (Buffer.byteLength(content, 'utf8') > LIMITS.outputBytes) fail('output_too_large');
  const absolute = path.resolve(outputPath);
  const temporary = `${absolute}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, content, { flag: 'wx', mode: 0o600 });
    await link(temporary, absolute);
  } finally {
    await unlink(temporary).catch(() => {});
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [, , inputPath, configPath, outputPath] = process.argv;
  const codes = new Set(['input_too_large', 'output_too_large', 'input_not_regular', 'input_changed', 'nesting_limit_exceeded', 'input_too_complex', 'duplicate_json_key', 'invalid_json', 'invalid_encoding', 'unapproved_config_hash', 'unsupported_config_structure', 'participant_limit_exceeded', 'invalid_top_level_shape', 'invalid_analysis_export_shape', 'output_aliases_input', 'malformed_participant', 'unsupported_participant_config_hash', 'malformed_completed_status', 'malformed_rejected_status', 'participant_sequence_mismatch', 'unknown_component', 'component_order_mismatch', 'malformed_capture_state', 'unexpected_response_id', 'trial_parameters_mismatch', 'invalid_option_orders', 'invalid_legal_choice', 'duplicate_component', 'completed_with_missing_responses', 'duplicate_participant']);
  if (!inputPath || !configPath || !outputPath || process.argv.length !== 5) {
    process.stderr.write('Usage: node scripts/convert-cedar-watch-preview.mjs <participant.json> <stored-config.json> <new-output.json>\n');
    process.exitCode = 2;
  } else {
    try {
      const [inputFile, configFile] = await Promise.all([parseFile(inputPath), parseFile(configPath)]);
      const [inputRealPath, configRealPath] = await Promise.all([realpath(inputPath), realpath(configPath)]);
      const outputAbsolute = path.resolve(outputPath);
      const outputRealPath = await realpath(outputPath).catch(() => null);
      const outputParent = await realpath(path.dirname(outputAbsolute));
      const outputIdentity = path.join(outputParent, path.basename(outputAbsolute));
      if ([inputRealPath, configRealPath].includes(outputIdentity) || [inputRealPath, configRealPath].includes(outputRealPath)) fail('output_aliases_input');
      const result = convertParsedCedarWatchExport(inputFile.value, configFile.value, digest(inputFile.bytes));
      await writeOutputExclusively(outputPath, `${JSON.stringify(result, null, 2)}\n`);
    } catch (error) {
      const code = error instanceof ValidationError && codes.has(error.code) ? error.code : 'conversion_failed';
      process.stderr.write(`Conversion failed: ${code}\n`);
      process.exitCode = 1;
    }
  }
}
