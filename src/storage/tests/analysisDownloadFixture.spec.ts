import {
  describe, expect, test,
} from 'vitest';
import analysisDownloadFixture from './fixtures/cedar-watch-analysis-download.json';
import analysisConfigFixture from './fixtures/cedar-watch-analysis-config.json';
import { hash } from '../engines/utils/storageEngineHelpers';

const participant = analysisDownloadFixture.participants[0];
type ConfigOption = string | { label: string; value: string };
type ConfigResponse = { id: string; type: string; options?: ConfigOption[] };
type ConfigComponent = {
  response: ConfigResponse[];
  correctAnswer?: { id: string; answer: string }[];
  parameters?: Record<string, unknown>;
};

const normalizeOptions = (options: ConfigOption[]) => options.map(
  (option) => (typeof option === 'string' ? { label: option, value: option } : option),
);

function configuredComponent(componentName: string): ConfigComponent | undefined {
  return Object.entries(analysisConfigFixture.components)
    .find(([name]) => name === componentName)?.[1];
}

function expectedSyntheticResponse(response: ConfigResponse, component: ConfigComponent) {
  if (response.type === 'textOnly') return '';

  const options = normalizeOptions(response.options ?? []);
  const configuredCorrectAnswer = component.correctAnswer?.find((item) => item.id === response.id)?.answer;

  if (configuredCorrectAnswer !== undefined) return configuredCorrectAnswer;
  if (response.id === 'q-corr-b') return options.find((option) => option.value === 'unknown')?.value;
  return options[0]?.value;
}

function expectNoUrlsOrUnredactedUuid(value: unknown) {
  if (typeof value === 'string') {
    expect(value).not.toMatch(/https?:\/\/|www\./i);
    expect(value).not.toMatch(/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i);
  } else if (Array.isArray(value)) {
    value.forEach(expectNoUrlsOrUnredactedUuid);
  } else if (value !== null && typeof value === 'object') {
    Object.values(value).forEach(expectNoUrlsOrUnredactedUuid);
  }
}

describe('sanitized local analysis JSON download fixture', () => {
  test('documents actual-download provenance and fabricated response derivation', () => {
    expect(analysisDownloadFixture.fixtureDescription).toContain('actual local DownloadButtons JSON output shape');
    expect(analysisDownloadFixture.fixtureDescription).toContain('not a raw exact analysis download');
    expect(analysisDownloadFixture.downloadFormat).toBe('DownloadButtons JSON participant array; one participant');
    expect(analysisDownloadFixture.responseProvenance).toContain('first configured option');
    expect(analysisDownloadFixture.responseProvenance).toContain('q-corr-b');
    expect(analysisDownloadFixture.participants).toHaveLength(1);
  });

  test('retains completion, answer/config relationships, unknown response, and config hash', async () => {
    expect(participant.completed).toBe(true);
    expect(participant.participantConfigHash).toBe(await hash(JSON.stringify(analysisConfigFixture)));
    expect(participant.sequence.components).toHaveLength(14);
    expect(Object.values(participant.answers)).toHaveLength(13);
    expect(Object.values(participant.answers).map((answer) => answer.componentName)).toEqual(
      participant.sequence.components.filter((componentName) => componentName !== 'end'),
    );
    Object.values(participant.answers).forEach((answer) => {
      const matchingComponent = configuredComponent(answer.componentName);
      expect(matchingComponent).toBeDefined();
      if (!matchingComponent) return;

      expect(Object.keys(answer.answer).sort()).toEqual(
        matchingComponent.response.map((response) => response.id).sort(),
      );
      const expectedAnswer = Object.fromEntries(matchingComponent.response.map((response) => [
        response.id,
        expectedSyntheticResponse(response, matchingComponent),
      ]));
      expect(answer.answer).toEqual(expectedAnswer);
      expect(answer.parameters).toEqual(matchingComponent.parameters ?? {});
      expect(answer.correctAnswer).toEqual(matchingComponent.correctAnswer ?? []);
      expect(answer.formOrder.response).toEqual(matchingComponent.response.map((response) => response.id));
      const expectedOptionOrders = Object.fromEntries(matchingComponent.response
        .filter((response) => response.type === 'radio')
        .map((response) => [response.id, normalizeOptions(response.options ?? [])]));
      expect(answer.optionOrders).toEqual(expectedOptionOrders);
      expect(Object.keys(answer).sort()).toEqual([
        'answer',
        'componentName',
        'correctAnswer',
        'endTime',
        'formOrder',
        'helpButtonClickedCount',
        'identifier',
        'incorrectAnswers',
        'optionOrders',
        'parameters',
        'questionOrders',
        'responseSubmitAttempted',
        'startTime',
        'timedOut',
        'trialOrder',
        'windowEvents',
        ...(answer.componentName === 'practice' ? ['checkAnswer'] : []),
      ].sort());
    });
    expect(participant.answers['trial-corroboration-b_2'].answer['q-corr-b']).toBe('unknown');
    expect(participant.answers.debrief_12.answer['preview-acknowledgement']).toBe('Understood');
    const selectedValues = Object.values(participant.answers).flatMap((answer) => Object.values(answer.answer));
    expect(selectedValues.filter((value) => value === 'unknown')).toHaveLength(1);
  });

  test('preserves the actual download qualitative-code schema and component identifiers', () => {
    expect(participant.qualitativeCodes.participantTags).toEqual([]);
    expect(Object.keys(participant.qualitativeCodes.taskTags)).toEqual(Object.keys(participant.answers));
    expect(Object.values(participant.qualitativeCodes.taskTags).every((tags) => tags.length === 0)).toBe(true);
  });

  test('uses obvious synthetic identity, normalized timestamps, and no browser/event traces', () => {
    expect(Object.keys(analysisDownloadFixture).sort()).toEqual([
      'downloadFormat', 'fixtureDescription', 'participantIdRedaction', 'participants', 'responseProvenance',
    ].sort());
    expect(Object.keys(participant).sort()).toEqual([
      'answers',
      'completed',
      'createdTime',
      'metadata',
      'participantConfigHash',
      'participantId',
      'participantIndex',
      'participantTags',
      'qualitativeCodes',
      'rejected',
      'searchParams',
      'sequence',
      'stage',
    ].sort());
    expect(participant.participantId).toBe('synthetic-pid-001');
    expect(participant.createdTime).toBe(0);
    expect(participant.metadata).toEqual({
      userAgent: 'REDACTED',
      resolution: { width: 'REDACTED', height: 'REDACTED' },
      language: 'REDACTED',
      ip: null,
    });
    expect(participant.searchParams).toEqual({});
    expect(Object.keys(participant.sequence).sort()).toEqual(['components', 'interruptions', 'order', 'orderPath', 'skip'].sort());
    expect(participant.participantTags).toEqual([]);
    expect(participant.rejected).toBe(false);
    expect(participant.completed).toBe(true);
    Object.values(participant.answers).forEach((answer, index) => {
      expect(answer.startTime).toBe((index + 1) * 1000);
      expect(answer.endTime).toBe(answer.startTime + 500);
      expect(answer.windowEvents).toEqual([]);
    });
    expect(Object.keys(participant.metadata).sort()).toEqual(['ip', 'language', 'resolution', 'userAgent'].sort());
    expect(Object.keys(participant.metadata.resolution).sort()).toEqual(['height', 'width']);
    expect(Object.keys(participant.qualitativeCodes).sort()).toEqual(['participantTags', 'taskTags']);
    expect(Object.keys(participant.qualitativeCodes.taskTags).sort()).toEqual(Object.keys(participant.answers).sort());
    Object.values(participant.answers).forEach((answer) => {
      expect(Object.keys(answer.incorrectAnswers)).toEqual([]);
      expect(answer.timedOut).toBe(false);
      expect(answer.helpButtonClickedCount).toBe(0);
      expect(answer.questionOrders).toEqual({});
      expect(answer.responseSubmitAttempted).toBe(false);
      if ('checkAnswer' in answer) {
        expect(Object.keys(answer.checkAnswer).sort()).toEqual(['attemptsUsed', 'correct', 'responses']);
        expect(answer.checkAnswer).toEqual({
          attemptsUsed: 1,
          correct: true,
          responses: { 'practice-understanding': true },
        });
      }
    });
    expectNoUrlsOrUnredactedUuid(analysisDownloadFixture);
  });
});
