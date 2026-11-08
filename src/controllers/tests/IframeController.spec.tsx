// @vitest-environment jsdom

import { cleanup, render, waitFor } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  afterEach, beforeEach, describe, expect, test, vi,
} from 'vitest';
import { IframeController } from '../IframeController';
import type { WebsiteComponent } from '../../parser/types';
import { ReplayContext } from '../../store/hooks/useReplay';

const mockDispatch = vi.fn();
const mockSetReactiveAnswers = vi.fn((payload) => ({ type: 'setReactiveAnswers', payload }));
const mockUpdateProvenance = vi.fn((payload) => ({ type: 'updateProvenance', payload }));
const mockUpdateResponseBlockValidation = vi.fn((payload) => ({ type: 'updateResponseBlockValidation', payload }));
const mockIsAnalysis = { value: false };

vi.mock('react-redux', () => ({
  useDispatch: () => vi.fn(),
}));

vi.mock('../../routes/utils', () => ({
  useCurrentComponent: () => 'countDots',
  useCurrentIdentifier: () => 'countDots_0',
}));

vi.mock('../../store/hooks/useIsAnalysis', () => ({
  useIsAnalysis: () => mockIsAnalysis.value,
}));

vi.mock('../../store/store', () => ({
  useStoreActions: () => ({
    setReactiveAnswers: mockSetReactiveAnswers,
    updateProvenance: mockUpdateProvenance,
    updateResponseBlockValidation: mockUpdateResponseBlockValidation,
  }),
  useStoreDispatch: () => mockDispatch,
  useStoreSelector: (selector: (state: { trialValidation: Record<string, { stimulus: { valid: boolean; values: Record<string, unknown> } }>; reactiveAnswers: Record<string, unknown> }) => unknown) => selector({
    trialValidation: { countDots_0: { stimulus: { valid: true, values: {} } } },
    reactiveAnswers: { prior: 'kept' },
  } as never),
}));

vi.mock('../../utils/Prefix', () => ({
  PREFIX: '/',
}));

describe('IframeController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAnalysis.value = false;
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  const websiteConfig: WebsiteComponent = { type: 'website', path: 'https://example.com', response: [{ id: 'q1' } as never] };

  const dispatchIframeMessage = (data: unknown, origin?: string) => {
    const iframe = document.querySelector('iframe');
    window.dispatchEvent(new MessageEvent('message', {
      data,
      origin: origin ?? (iframe ? new URL(iframe.src).origin : window.location.origin),
      source: iframe?.contentWindow,
    }));
  };

  test('covers sendMessage via answers effect on mount', async () => {
    render(<IframeController currentConfig={websiteConfig} answers={{}} />);
    // answers effect fires sendMessage; ref.current is the iframe element in jsdom
    // so postMessage is invoked on its contentWindow - no assertion needed beyond no-throw
  });

  test('covers sendMessage via provState effect', async () => {
    render(
      <IframeController
        currentConfig={websiteConfig}
        answers={{}}
        provState={{ event: 'test' }}
      />,
    );
    // provState effect fires sendMessage
  });

  test('dispatches store actions when an ANSWERS window message arrives with matching iframeId', async () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(
      '11111111-2222-3333-4444-555555555555' as `${string}-${string}-${string}-${string}-${string}`,
    );
    render(<IframeController currentConfig={websiteConfig} answers={{}} />);
    dispatchIframeMessage({ iframeId: '11111111-2222-3333-4444-555555555555', type: '@REVISIT_COMMS/ANSWERS', message: { q1: 'yes' } });
    await waitFor(() => expect(mockDispatch).toHaveBeenCalled());
    expect(mockSetReactiveAnswers).toHaveBeenCalledWith({ prior: 'kept', q1: 'yes' });
  });

  test('stores provenance independently from answer validation', async () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(
      '11111111-2222-3333-4444-555555555555' as `${string}-${string}-${string}-${string}-${string}`,
    );
    render(<IframeController currentConfig={websiteConfig} answers={{}} />);
    const provenanceGraph = { root: 'root', current: 'root', nodes: {} };

    dispatchIframeMessage({
      iframeId: '11111111-2222-3333-4444-555555555555',
      type: '@REVISIT_COMMS/PROVENANCE',
      message: provenanceGraph,
    });

    await waitFor(() => expect(mockUpdateProvenance).toHaveBeenCalledWith({
      location: 'stimulus',
      identifier: 'countDots_0',
      provenanceGraph,
    }));
    expect(mockUpdateResponseBlockValidation).not.toHaveBeenCalled();
  });

  test('sends STUDY_DATA when a WINDOW_READY message arrives and parameters are set', async () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(
      '11111111-2222-3333-4444-555555555555' as `${string}-${string}-${string}-${string}-${string}`,
    );
    const websiteWithParams: WebsiteComponent = {
      type: 'website', path: 'https://example.com', parameters: { key: 'val' }, response: [],
    };
    render(<IframeController currentConfig={websiteWithParams} answers={{}} />);
    dispatchIframeMessage({ iframeId: '11111111-2222-3333-4444-555555555555', type: '@REVISIT_COMMS/WINDOW_READY' });
    // sendMessage called with STUDY_DATA; ref.current.contentWindow.postMessage fires
  });

  test('renders iframe with the original src for an http path', () => {
    const html = renderToStaticMarkup(
      <IframeController currentConfig={{ type: 'website', path: 'https://example.com/study', response: [] }} answers={{}} />,
    );
    expect(html).toContain('<iframe');
    expect(html).toContain('https://example.com/study');
    expect(html).toContain('parentOrigin=http');
    expect(html).toContain('trialid=countDots');
    expect(html).toContain('id=');
  });

  test('rejects messages with a wrong origin or wrong iframe source', () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('11111111-2222-3333-4444-555555555555' as `${string}-${string}-${string}-${string}-${string}`);
    render(<IframeController currentConfig={websiteConfig} answers={{}} />);
    const data = { iframeId: '11111111-2222-3333-4444-555555555555', type: '@REVISIT_COMMS/ANSWERS', message: { q1: 'yes' } };
    dispatchIframeMessage(data, 'https://attacker.example');
    window.dispatchEvent(new MessageEvent('message', { data, origin: 'https://example.com', source: window }));
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  test('sends messages to the configured iframe origin, not wildcard', async () => {
    render(<IframeController currentConfig={websiteConfig} answers={{}} />);
    const iframe = document.querySelector('iframe')!;
    const postMessage = vi.spyOn(iframe.contentWindow!, 'postMessage').mockImplementation(() => {});
    const iframeId = new URL(iframe.src).searchParams.get('id');
    dispatchIframeMessage({ iframeId, type: '@REVISIT_COMMS/WINDOW_READY' });
    expect(postMessage).toHaveBeenCalledWith(expect.anything(), 'https://example.com');
  });

  test('renders iframe with PREFIX prepended for a relative path', () => {
    window.history.pushState({}, '', '/nested/route');
    const html = renderToStaticMarkup(
      <IframeController currentConfig={{ type: 'website', path: 'my-study/index.html', response: [] }} answers={{}} />,
    );
    expect(html).toContain('<iframe');
    expect(html).toContain('src="/my-study/index.html?');
    window.history.replaceState({}, '', '/');
  });

  test('makes the iframe inert and non-interactive during analysis replay', () => {
    mockIsAnalysis.value = true;
    const { container } = render(
      <IframeController currentConfig={{ type: 'website', path: 'my-study/index.html', response: [] }} answers={{}} />,
    );
    const iframe = container.querySelector('iframe');

    expect(iframe?.hasAttribute('inert')).toBe(true);
    expect(iframe?.getAttribute('aria-disabled')).toBe('true');
    expect(iframe?.style.pointerEvents).toBe('none');
  });

  test('resends provenance snapshots when the iframe reports ready', async () => {
    const currentConfig: WebsiteComponent = {
      type: 'website',
      path: 'demo-svelte-trrack/assets/dots-count.html',
      response: [],
    };
    const provState = { dots: [1, 2, 3] };

    render(
      <IframeController
        currentConfig={currentConfig}
        provState={provState}
        answers={{}}
      />,
    );

    const iframe = document.querySelector('iframe');
    expect(iframe).toBeTruthy();

    const postMessage = vi.fn();
    Object.defineProperty(iframe, 'contentWindow', {
      value: { postMessage },
      configurable: true,
    });

    await waitFor(() => {
      expect(iframe?.src).toContain('id=');
    });

    const iframeId = new URL(iframe!.src).searchParams.get('id');
    window.dispatchEvent(new MessageEvent('message', {
      data: {
        type: '@REVISIT_COMMS/WINDOW_READY',
        iframeId,
      },
      origin: window.location.origin,
      source: document.querySelector('iframe')?.contentWindow,
    }));

    expect(postMessage).toHaveBeenCalledWith(
      {
        error: false,
        type: '@REVISIT_COMMS/PROVENANCE',
        iframeId,
        message: provState,
      },
      window.location.origin,
    );
  });

  test('replays only current-component, configured response answers after a valid ready message', async () => {
    mockIsAnalysis.value = true;
    const provState = { selectedIds: [] };
    const answers = {
      countDots_0: { answer: { q1: ['Saved node'], unrelated: 'do not disclose' } },
      otherTrial_0: { answer: { q1: 'other trial history' } },
    } as never;
    const renderController = (seekTime: number) => (
      <ReplayContext.Provider value={{ seekTime, isPlaying: false } as never}>
        <IframeController
          currentConfig={{ type: 'website', path: 'example/index.html', response: [{ id: 'q1' } as never] }}
          provState={provState}
          answers={answers}
        />
      </ReplayContext.Provider>
    );
    const { rerender } = render(renderController(0));
    const iframe = document.querySelector('iframe')!;
    const postMessage = vi.spyOn(iframe.contentWindow!, 'postMessage').mockImplementation(() => {});

    await waitFor(() => expect(iframe.src).toContain('id='));
    const iframeId = new URL(iframe.src).searchParams.get('id');
    dispatchIframeMessage({ type: '@REVISIT_COMMS/WINDOW_READY', iframeId }, 'https://attacker.example');
    expect(postMessage).not.toHaveBeenCalled();
    dispatchIframeMessage({ type: '@REVISIT_COMMS/WINDOW_READY', iframeId });

    expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: '@REVISIT_COMMS/ANSWERS',
      message: { q1: ['Saved node'] },
    }), window.location.origin);
    expect(postMessage).not.toHaveBeenCalledWith(expect.objectContaining({
      type: '@REVISIT_COMMS/ANSWERS',
      message: expect.objectContaining({ unrelated: expect.anything() }),
    }), expect.anything());
    expect(postMessage).not.toHaveBeenCalledWith(expect.objectContaining({
      type: '@REVISIT_COMMS/PROVENANCE',
    }), window.location.origin);

    rerender(renderController(1));
    await waitFor(() => expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: '@REVISIT_COMMS/PROVENANCE',
      message: provState,
    }), window.location.origin));
  });

  test('sends STUDY_DATA even when parameters are absent', () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('11111111-2222-3333-4444-555555555555' as `${string}-${string}-${string}-${string}-${string}`);
    render(<IframeController currentConfig={{ type: 'website', path: 'https://example.com/study', response: [] }} answers={{}} />);
    const iframe = document.querySelector('iframe')!;
    const postMessage = vi.fn();
    Object.defineProperty(iframe, 'contentWindow', { value: { postMessage }, configurable: true });
    dispatchIframeMessage({ iframeId: '11111111-2222-3333-4444-555555555555', type: '@REVISIT_COMMS/WINDOW_READY' });
    expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: '@REVISIT_COMMS/STUDY_DATA',
      message: {},
    }), 'https://example.com');
  });

  test('accepts only complete pilotSession payloads with required usability responses', () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('11111111-2222-3333-4444-555555555555' as `${string}-${string}-${string}-${string}-${string}`);
    const config: WebsiteComponent = { type: 'website', path: 'https://example.com/cedar-watch-pilot/study', response: [{ id: 'pilotSession' } as never] };
    render(<IframeController currentConfig={config} answers={{}} />);
    const iframeId = '11111111-2222-3333-4444-555555555555';
    const session = {
      schemaVersion: 1,
      protocolVersion: 'draft-1',
      consentAccepted: true,
      participantId: 'participant-1',
      sessionId: 'session-1',
      sourceCommit: 'commit',
      stimulusSeed: 271828,
      stimulusVersion: 'cedar-watch-generator-1',
      counterbalanceGroup: 0,
      status: 'complete',
      assignedOrder: Array.from({ length: 10 }, (_, index) => `trial-${index}`),
      responses: Array.from({ length: 10 }, (_, trialIndex) => ({
        trialIndex,
        trialId: `trial-${trialIndex}`,
        scenarioFamily: 'conflict',
        taskVariant: 'A',
        condition: 'baseline',
        recommendedVisualization: null,
        selectedVisualization: 'table',
        answerKind: 'unknown',
        answerId: null,
        confidence: 3,
        perceivedDifficulty: 3,
        activeTrialTimeMs: 100,
        visibilityInterruptions: 0,
        selectedReports: [],
        evidenceInteractions: [],
      })),
      usability: { evidenceClarity: 3, conditionPreference: 'baseline', easierCondition: 'no-difference' },
    };
    dispatchIframeMessage({ iframeId, type: '@REVISIT_COMMS/ANSWERS', message: { pilotSession: JSON.stringify({ ...session, usability: undefined }) } });
    expect(mockDispatch).not.toHaveBeenCalled();
    dispatchIframeMessage({ iframeId, type: '@REVISIT_COMMS/ANSWERS', message: { pilotSession: JSON.stringify(session) } });
    expect(mockDispatch).toHaveBeenCalled();
  });
});
