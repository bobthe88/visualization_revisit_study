import { initializeTrrack } from '@trrack/core';
import type { ConfigureTrrackOptions, Trrack } from '@trrack/core';
import { useRef } from 'react';
import { BrushParams, BrushState } from '../../example-brush-interactions/assets/types';
import { BrushPlot } from '../../example-brush-interactions/assets/BrushPlot';
import { ParticipantData } from '../../../storage/types';
import type { UseTrrack } from '../../../store/types';

const useTutorialTrrack: UseTrrack = <State, Event extends string = string>(options: ConfigureTrrackOptions<State, Event>): Trrack<State, Event> => {
  const trrackRef = useRef<Trrack<State, Event> | null>(null);
  if (!trrackRef.current) {
    trrackRef.current = initializeTrrack(options);
  }
  return trrackRef.current;
};

export default function BrushPlotWrapper({
  state, params, answers, onStateChange,
}: { state?: BrushState, params: BrushParams, answers: ParticipantData['answers'], onStateChange?: (b: BrushState) => void }) {
  return <BrushPlot parameters={params} setAnswer={() => null} provenanceState={state ? { all: { brush: state } } : undefined} useTrrack={useTutorialTrrack} updateState={onStateChange || (() => null)} answers={answers} />;
}
