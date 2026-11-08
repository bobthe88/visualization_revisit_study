import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseStudyConfig } from '../parser';

// Regression fixture transcribed from the sibling study's questions.ts and protocol.ts.
const groupZero = [
  ['corroboration-A-baseline', 'Do similar reports establish a count of distinct vehicles?', ['same-items', 'sum-counts', 'single-source'], ['No. The reports may describe the same items, so their counts should not be added.', 'Yes. Add each source-reported count to obtain distinct vehicles.', 'Yes. Only one source made a report.']],
  ['corroboration-B-recommended', 'Which sources are recorded as independently reporting similar counts?', ['four-sources', 'one-source', 'all-sources'], ['Observation Team Cedar, Imagery Review Desk, Road Patrol Log, and Community Contact Network.', 'Observation Team Cedar only.', 'Every source in the dataset.']],
  ['conflict-A-recommended', 'How should the missing count from the Radio Log Monitor be interpreted?', ['unknown-not-zero', 'zero-count', 'same-as-six'], ['No count was recorded; missing is not zero.', 'The source reported zero vehicles.', 'The source confirmed the count of about six.']],
  ['conflict-B-baseline', 'What do the available East Depot reports establish about the differing counts?', ['six-vs-four', 'total-sixteen', 'all-six'], ['Sources reported about six and four; the evidence does not establish a total inventory.', 'The reports establish sixteen distinct vehicles.', 'Every source reported about six vehicles.']],
  ['uncertain-A-baseline', 'How long after observation did the Field Report Liaison report arrive?', ['four-hours', 'one-hour', 'eight-hours'], ['About four exercise hours.', 'About one exercise hour.', 'About eight exercise hours.']],
  ['uncertain-B-recommended', 'What does the report’s receipt time tell you about when the observation occurred?', ['observation-not-receipt', 'activity-at-receipt', 'same-time'], ['Observation and receipt are separate; late receipt does not move the observation time.', 'The reported activity necessarily continued until receipt.', 'Observation and receipt always occurred at the same time.']],
  ['quality-A-recommended', 'Was the translated personnel-count range human verified?', ['not-verified', 'verified', 'exact-count'], ['No. Human verification is not recorded.', 'Yes. The range is human verified.', 'Yes. The range establishes an exact count.']],
  ['quality-B-baseline', 'How should the ambiguous translated range be represented?', ['unresolved-range', 'midpoint', 'zero'], ['As an unresolved, source-reported range—not a precise count or a calibrated interval.', 'As its midpoint, which is an exact count.', 'As zero because the translation is unresolved.']],
  ['anomaly-A-baseline', 'Does rising report volume establish increased vehicle activity?', ['no-proof', 'activity-increased', 'activity-decreased'], ['No. Report frequency and coverage increased; activity is not established.', 'Yes. More reports prove more vehicle activity.', 'Yes. The reports prove activity decreased.']],
  ['anomaly-B-recommended', 'Which change is supported by the scripted reports?', ['frequency-and-coverage', 'activity-and-coverage', 'activity-only'], ['Report frequency and reporting coverage increased; underlying activity remains unknown.', 'Underlying vehicle activity and reporting coverage increased.', 'Underlying vehicle activity increased; report coverage did not change.']],
] as const;

describe('Cedar Watch synthetic host configuration', () => {
  it('parses a fixed group-0 schedule with native answers and the visualization contract', async () => {
    const config = JSON.parse(
      readFileSync('public/cedar-watch-pilot/StudyConfig.json', 'utf8'),
    ) as {
      components: Record<string, {
        type: string;
        path?: string;
        parameters?: Record<string, unknown>;
        provideFeedback?: boolean;
        trainingAttempts?: number;
        allowFailedTraining?: boolean;
        instruction?: string;
        instructionLocation?: string;
        nextButtonLocation?: string;
        nextButtonText?: string;
        response?: Array<{
          id: string;
          prompt?: string;
          type?: string;
          location?: string;
          options?: Array<string | { value?: string; label?: string }>;
        }>;
      }>;
      sequence: { order: string; components: string[] };
      studyMetadata: { description: string };
    };

    const trials = config.sequence.components.filter((id) => id.startsWith('trial-'));
    expect(config.sequence.order).toBe('fixed');
    expect(trials).toHaveLength(10);
    expect(config.studyMetadata.description).toContain('not randomized');

    for (const [trialId, expectedPrompt, expectedOptionIds, expectedLabels] of groupZero) {
      const componentId = trials.find((id) => config.components[id].parameters?.trialId === trialId);
      expect(componentId).toBeDefined();
      const trial = config.components[componentId as string];
      expect(trial.path).toBe('cedar-watch-pilot/app/visualization.html');
      expect(trial.parameters).toMatchObject({ contractVersion: 1, stimulusSeed: 271828 });
      expect(trial.parameters?.trialId).toBe(trialId);
      const [scenarioFamily, taskVariant, condition] = trialId.split('-');
      expect(trial.parameters).toMatchObject({ scenarioFamily, taskVariant, condition });
      const choice = trial.response?.[0];
      expect(choice?.prompt).toBe(expectedPrompt);
      expect(choice?.options?.slice(0, expectedOptionIds.length).map((option) => (
        typeof option === 'string' ? option : option.value
      ))).toEqual(expectedOptionIds);
      expect(choice?.options?.slice(0, expectedLabels.length).map((option) => (
        typeof option === 'string' ? option : option.label
      ))).toEqual(expectedLabels);
      expect(choice?.options?.at(-1)).toEqual({
        label: 'I cannot determine an answer from the available reports.',
        value: 'unknown',
      });
      expect(trial.response?.[1].prompt).toBe('Confidence (1 = not confident, 5 = very confident)');
      expect(trial.response?.[2].prompt).toBe('Perceived difficulty (1 = very easy, 5 = very difficult)');
    }
    expect(trials.map((id) => config.components[id].parameters?.trialId)).toEqual(groupZero.map(([id]) => id));

    expect(config.components.practice.response?.[0].prompt).toContain('Fictional Harbor Lane practice reports');
    expect(config.components.practice.response?.[0].prompt).toContain('Practice log A | 09:00 | 09:12 | Not recorded');
    expect(config.components.practice.response?.[0].prompt).toContain('Reports can overlap and should not be added into a total.');
    expect(config.components.practice.response?.[0]).toMatchObject({ type: 'textOnly', location: 'aboveStimulus' });
    expect(config.components.practice.response?.[1]).toMatchObject({
      id: 'practice-understanding',
      location: 'sidebar',
      prompt: 'Does “not recorded” mean the source reported zero?',
    });
    expect(config.components.practice).toMatchObject({
      provideFeedback: true,
      trainingAttempts: 1,
      allowFailedTraining: true,
      instructionLocation: 'aboveStimulus',
      nextButtonLocation: 'belowStimulus',
      nextButtonText: 'Continue synthetic preview',
    });
    expect(config.components.practice.instruction).toContain('does not request or record research consent');
    expect(config.components.practice.instruction).toContain('records the practice answer as a practice response');
    expect(config.components.usability.response?.map((response) => response.prompt)).toEqual([
      'How clear was the evidence overall? (1 = not clear, 5 = very clear)',
      'Which view did you prefer overall?',
      'Which view felt easier to use?',
    ]);
    expect(config.components.usability.response?.[1].options).toEqual([
      { label: 'Evidence-only view', value: 'baseline' },
      { label: 'Task-aware recommended view', value: 'recommended' },
      { label: 'No preference', value: 'no-preference' },
    ]);
    expect(config.components.usability.response?.[2].options).toEqual([
      { label: 'Evidence-only view', value: 'baseline' },
      { label: 'Task-aware recommended view', value: 'recommended' },
      { label: 'No difference', value: 'no-difference' },
    ]);

    const parsed = await parseStudyConfig(JSON.stringify(config));
    expect(parsed.errors).toEqual([]);
  });
});
