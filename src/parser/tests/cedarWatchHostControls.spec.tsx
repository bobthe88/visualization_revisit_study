import { readFileSync } from 'node:fs';
import {
  render,
  screen,
} from '@testing-library/react';
import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { MantineProvider } from '@mantine/core';
import type { RadioResponse } from '../types';
import { RadioInput } from '../../components/response/RadioInput';

// Isolate the response control from app/store initialization: this test checks
// rendering of a synthetic response, not Redux or trrack integration.
vi.mock('../../store/hooks/useStoredAnswer', () => ({ useStoredAnswer: () => undefined }));

// Exercises the host's real radio response control against the synthetic host
// config, while keeping the test independent of participant data or services.
describe('Cedar Watch synthetic host controls', () => {
  const config = JSON.parse(readFileSync('public/cedar-watch-pilot/StudyConfig.json', 'utf8'));

  it('renders the practice/sidebar response with its exact configured options', () => {
    const response = config.components.practice.response.find(({ id }: { id: string }) => id === 'practice-understanding') as RadioResponse;
    expect(response.location).toBe('sidebar');
    expect(response.required).not.toBe(false);

    vi.stubGlobal('matchMedia', () => ({
      matches: false,
      media: '',
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }));
    render(
      <MantineProvider forceColorScheme="light">
        <RadioInput
          response={response}
          disabled={false}
          answer={{ value: undefined, onChange: () => {} }}
          index={0}
          enumerateQuestions={false}
        />
      </MantineProvider>,
    );
    vi.unstubAllGlobals();

    expect(screen.getByText('Does “not recorded” mean the source reported zero?')).toBeTruthy();
    expect(screen.getByLabelText('Yes')).toBeTruthy();
    expect(screen.getByLabelText('No')).toBeTruthy();
    expect(screen.getAllByRole('radio')).toHaveLength(2);
    expect(config.components.practice.correctAnswer).toEqual([{ id: 'practice-understanding', answer: 'No' }]);
  });

  it('retains required sidebar usability questions and exact response options', () => {
    const responses = config.components.usability.response;
    expect(responses.every((response: { location: string; required?: boolean }) => response.location === 'sidebar'
      && response.required !== false)).toBe(true);
    expect(responses[1].options).toEqual([
      { label: 'Evidence-only view', value: 'baseline' },
      { label: 'Task-aware recommended view', value: 'recommended' },
      { label: 'No preference', value: 'no-preference' },
    ]);
    expect(responses[2].options).toEqual([
      { label: 'Evidence-only view', value: 'baseline' },
      { label: 'Task-aware recommended view', value: 'recommended' },
      { label: 'No difference', value: 'no-difference' },
    ]);
  });
});
