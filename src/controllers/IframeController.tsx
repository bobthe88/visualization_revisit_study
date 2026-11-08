import {
  useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import { useDispatch } from 'react-redux';
import { useCurrentComponent, useCurrentIdentifier } from '../routes/utils';
import { useStoreDispatch, useStoreActions, useStoreSelector } from '../store/store';
import { ParticipantData, WebsiteComponent } from '../parser/types';
import { PREFIX as BASE_PREFIX } from '../utils/Prefix';
import { useIsAnalysis } from '../store/hooks/useIsAnalysis';
import { ReplayContext } from '../store/hooks/useReplay';

const PREFIX = '@REVISIT_COMMS';

export function IframeController({ currentConfig, provState, answers }: { currentConfig: WebsiteComponent; provState?: unknown, answers: ParticipantData['answers'] }) {
  const {
    setReactiveAnswers, updateProvenance, updateResponseBlockValidation,
  } = useStoreActions();
  const storeDispatch = useStoreDispatch();
  const dispatch = useDispatch();
  const identifier = useCurrentIdentifier();
  const isAnalysis = useIsAnalysis();
  const replay = useContext(ReplayContext);
  const initialReplayTime = useRef(replay?.seekTime ?? 0);
  const [hasReplayStarted, setHasReplayStarted] = useState(false);
  const stimulusValidation = useStoreSelector((state) => state.trialValidation[identifier]?.stimulus);
  const existingReactiveAnswers = useStoreSelector((state) => state.reactiveAnswers);

  useEffect(() => {
    if (replay && (replay.isPlaying || replay.seekTime !== initialReplayTime.current)) {
      setHasReplayStarted(true);
    }
  }, [replay]);

  const shouldSendProvenance = !isAnalysis || !replay || hasReplayStarted;

  const ref = useRef<HTMLIFrameElement>(null);
  const stimulusValidationRef = useRef(stimulusValidation);
  const reactiveAnswersRef = useRef(existingReactiveAnswers);

  useEffect(() => {
    stimulusValidationRef.current = stimulusValidation;
  }, [stimulusValidation]);

  useEffect(() => {
    reactiveAnswersRef.current = existingReactiveAnswers;
  }, [existingReactiveAnswers]);

  const iframeId = useMemo(
    () => (crypto.randomUUID ? crypto.randomUUID() : `testID-${Date.now()}`),
    [],
  );

  // navigation
  const currentComponent = useCurrentComponent();
  const currentComponentAnswers = useMemo(() => {
    const stored = answers?.[identifier]?.answer;
    if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return undefined;
    const responseIds = new Set(currentConfig.response.map((response) => response.id));
    const scoped = Object.fromEntries(
      Object.entries(stored).filter(([responseId]) => responseIds.has(responseId)),
    );
    return Object.keys(scoped).length ? scoped : undefined;
  }, [answers, identifier, currentConfig.response]);
  const isPilotStudy = currentConfig.path.toLowerCase().includes('cedar-watch-pilot')
    && currentConfig.response.some((response) => response.id === 'pilotSession');

  const iframeUrl = useMemo(() => {
    const isExternal = /^https?:\/\//i.test(currentConfig.path);
    const relativePath = currentConfig.path.replace(/^\/+/, '');
    const resolved = isExternal
      ? new URL(currentConfig.path)
      : new URL(`${BASE_PREFIX}${relativePath}`, window.location.origin);
    resolved.searchParams.set('trialid', currentComponent);
    resolved.searchParams.set('id', iframeId);
    resolved.searchParams.set('parentOrigin', window.location.origin);
    return resolved;
  }, [currentConfig.path, currentComponent, iframeId]);
  const expectedOrigin = iframeUrl.origin;

  const isCompletePilotSession = useCallback((message: unknown) => {
    if (!message || typeof message !== 'object' || Array.isArray(message)) return false;
    const value = message as Record<string, unknown>;
    if (Object.keys(value).length !== 1 || typeof value.pilotSession !== 'string') return false;
    try {
      const session = JSON.parse(value.pilotSession) as Record<string, unknown>;
      const usability = session.usability as Record<string, unknown> | null;
      const { assignedOrder, responses } = session;
      return session.schemaVersion === 1
        && session.protocolVersion === 'draft-1'
        && session.consentAccepted === true
        && typeof session.participantId === 'string' && session.participantId.length > 0
        && typeof session.sessionId === 'string' && session.sessionId.length > 0
        && typeof session.sourceCommit === 'string'
        && Number.isInteger(session.stimulusSeed)
        && typeof session.stimulusVersion === 'string'
        && Number.isInteger(session.counterbalanceGroup)
        && Number(session.counterbalanceGroup) >= 0 && Number(session.counterbalanceGroup) <= 3
        && session.status === 'complete'
        && Array.isArray(responses)
        && responses.length === 10
        && Array.isArray(assignedOrder)
        && assignedOrder.length === 10
        && assignedOrder.every((trialId) => typeof trialId === 'string')
        && new Set(assignedOrder).size === 10
        && responses.every((response, index) => (
          response !== null && typeof response === 'object'
          && !Array.isArray(response)
          && (response as Record<string, unknown>).trialIndex === index
          && typeof (response as Record<string, unknown>).trialId === 'string'
          && (response as Record<string, unknown>).trialId === assignedOrder[index]
          && ['corroboration', 'conflict', 'uncertain', 'quality', 'anomaly'].includes(String((response as Record<string, unknown>).scenarioFamily))
          && ['A', 'B'].includes(String((response as Record<string, unknown>).taskVariant))
          && ['baseline', 'recommended'].includes(String((response as Record<string, unknown>).condition))
          && (typeof (response as Record<string, unknown>).recommendedVisualization === 'string'
            || (response as Record<string, unknown>).recommendedVisualization === null)
          && typeof (response as Record<string, unknown>).selectedVisualization === 'string'
          && ['choice', 'unknown'].includes(String((response as Record<string, unknown>).answerKind))
          && ((response as Record<string, unknown>).answerKind === 'unknown'
            ? (response as Record<string, unknown>).answerId === null
            : typeof (response as Record<string, unknown>).answerId === 'string')
          && Number.isInteger((response as Record<string, unknown>).confidence)
          && Number((response as Record<string, unknown>).confidence) >= 1
          && Number((response as Record<string, unknown>).confidence) <= 5
          && Number.isInteger((response as Record<string, unknown>).perceivedDifficulty)
          && Number((response as Record<string, unknown>).perceivedDifficulty) >= 1
          && Number((response as Record<string, unknown>).perceivedDifficulty) <= 5
          && Number.isInteger((response as Record<string, unknown>).activeTrialTimeMs)
          && Number.isInteger((response as Record<string, unknown>).visibilityInterruptions)
          && Number((response as Record<string, unknown>).visibilityInterruptions) >= 0
          && Array.isArray((response as Record<string, unknown>).selectedReports)
          && ((response as Record<string, unknown>).selectedReports as unknown[])
            .every((item: unknown) => typeof item === 'string')
          && Array.isArray((response as Record<string, unknown>).evidenceInteractions)
          && ((response as Record<string, unknown>).evidenceInteractions as unknown[]).every((event: unknown) => (
            event !== null && typeof event === 'object'
            && ['report_select', 'visualization_select'].includes(String((event as Record<string, unknown>).type))
            && typeof (event as Record<string, unknown>).value === 'string'
            && Number.isInteger((event as Record<string, unknown>).elapsedMs)
            && Number((event as Record<string, unknown>).elapsedMs) >= 0
          ))
        ))
        && usability !== null
        && typeof usability === 'object'
        && Number.isInteger(usability.evidenceClarity)
        && Number(usability.evidenceClarity) >= 1 && Number(usability.evidenceClarity) <= 5
        && ['baseline', 'recommended', 'no-preference'].includes(String(usability.conditionPreference))
        && ['baseline', 'recommended', 'no-difference'].includes(String(usability.easierCondition));
    } catch {
      return false;
    }
  }, []);

  const sendMessage = useCallback(
    (tag: string, message: unknown) => {
      ref.current?.contentWindow?.postMessage(
        {
          error: false,
          type: `${PREFIX}/${tag}`,
          iframeId,
          message,
        },
        expectedOrigin,
      );
    },
    [ref, iframeId, expectedOrigin],
  );

  useEffect(() => {
    if (provState && shouldSendProvenance) {
      sendMessage('PROVENANCE', provState);
    }
  }, [provState, sendMessage, shouldSendProvenance]);

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      const { data } = e;
      if (data && typeof data === 'object' && !Array.isArray(data)
        && iframeId === data.iframeId
        && e.origin === expectedOrigin
        && e.source === ref.current?.contentWindow) {
        switch (data.type) {
          case `${PREFIX}/WINDOW_READY`:
            sendMessage('STUDY_DATA', currentConfig.parameters ?? {});
            if (currentComponentAnswers) {
              sendMessage('ANSWERS', currentComponentAnswers);
            }
            if (provState && shouldSendProvenance) {
              sendMessage('PROVENANCE', provState);
            }
            break;
          case `${PREFIX}/READY`:
            break;
          case `${PREFIX}/ANSWERS`: {
            if (isAnalysis) return;
            if (!data.message || typeof data.message !== 'object' || Array.isArray(data.message)) return;
            if (isPilotStudy) {
              if (!isCompletePilotSession(data.message)) return;
            } else if (!Object.keys(data.message).length
              || Object.keys(data.message).some((id) => !currentConfig.response.some((response) => response.id === id))) return;
            const mergedAnswers = isPilotStudy
              ? data.message
              : { ...reactiveAnswersRef.current, ...data.message };
            reactiveAnswersRef.current = mergedAnswers;
            stimulusValidationRef.current = {
              valid: true,
              values: mergedAnswers,
            };
            storeDispatch(setReactiveAnswers(mergedAnswers));
            storeDispatch(updateResponseBlockValidation({
              location: 'stimulus',
              identifier,
              status: true,
              values: mergedAnswers,
            }));
            break;
          }
          case `${PREFIX}/PROVENANCE`: {
            if (isAnalysis) return;
            storeDispatch(updateProvenance({
              location: 'stimulus',
              identifier,
              provenanceGraph: data.message,
            }));
            break;
          }
          default:
            break;
        }
      }
    };

    window.addEventListener('message', handler);

    return () => window.removeEventListener('message', handler);
  }, [storeDispatch, dispatch, iframeId, currentConfig, sendMessage, setReactiveAnswers, updateProvenance, updateResponseBlockValidation, identifier, isAnalysis, provState, shouldSendProvenance, expectedOrigin, isCompletePilotSession, existingReactiveAnswers, isPilotStudy, currentComponentAnswers]);

  return (
    <iframe
      ref={ref}
      inert={(isAnalysis ? '' : undefined) as never}
      aria-disabled={isAnalysis}
      style={{
        width: '100%',
        flexGrow: 1,
        border: 0,
        pointerEvents: isAnalysis ? 'none' : undefined,
      }}
      src={/^https?:\/\//i.test(currentConfig.path) ? iframeUrl.toString() : `${iframeUrl.pathname}${iframeUrl.search}`}
    />
  );
}
