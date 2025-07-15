/**
 * Contextual hint generation for Petri net transitions
 */

import { ColoredPetriNet, Place, Transition, Arc } from './colored-petri-net';

export interface ContextualHint {
  missingRequirements: string[];
  suggestedPath: string[];
  readable: string;
}

export function generateContextualHint(
  net: ColoredPetriNet,
  desiredTransitionId: string
): ContextualHint {
  const state = net.getState();
  const transition = state.transitions.find(t => t.id === desiredTransitionId);
  
  if (!transition) {
    return {
      missingRequirements: [],
      suggestedPath: [],
      readable: 'Unknown transition'
    };
  }

  // Find input places for this transition
  const inputArcs = state.arcs.filter(arc => arc.target === desiredTransitionId);
  const missingPlaces: string[] = [];
  
  // Check which input places are empty
  for (const arc of inputArcs) {
    const place = state.places.find(p => p.id === arc.source);
    if (place && place.tokens.length === 0) {
      missingPlaces.push(place.id);
    }
  }

  // Convert place IDs to human-readable requirements
  const missingRequirements = missingPlaces.map(placeId => {
    const place = state.places.find(p => p.id === placeId);
    return humanReadablePlace(place);
  });

  // Find path to fulfill requirements
  const suggestedPath = findPathToFulfill(state, missingPlaces);
  
  // Build readable hint
  const readable = buildReadableHint(transition, missingRequirements, suggestedPath);
  
  return {
    missingRequirements,
    suggestedPath,
    readable
  };
}

function humanReadablePlace(place?: Place): string {
  if (!place) return 'unknown requirement';
  
  // Map place IDs to human-readable descriptions
  const placeDescriptions: Record<string, string> = {
    'file_found': 'a found file',
    'file_read': 'file content',
    'search_results': 'search results',
    'file_written': 'a written file',
    'start': 'initial state'
  };
  
  return placeDescriptions[place.id] || place.name || place.id;
}

function findPathToFulfill(
  state: { places: Place[], transitions: Transition[], arcs: Arc[] },
  targetPlaces: string[]
): string[] {
  const path: string[] = [];
  
  // Simple implementation - find transitions that output to target places
  for (const placeId of targetPlaces) {
    // Find transitions that produce tokens for this place
    const producingArcs = state.arcs.filter(arc => arc.target === placeId);
    
    for (const arc of producingArcs) {
      const transition = state.transitions.find(t => t.id === arc.source);
      if (transition) {
        // Check if this transition is currently enabled
        const isEnabled = checkTransitionEnabled(state, transition.id);
        if (isEnabled) {
          path.push(transition.name);
        } else {
          // Recursively find path to enable this transition
          const priorPath = findPathToFulfill(state, getInputPlaces(state, transition.id));
          path.push(...priorPath, transition.name);
        }
      }
    }
  }
  
  // Remove duplicates and return
  return [...new Set(path)];
}

function getInputPlaces(
  state: { arcs: Arc[] },
  transitionId: string
): string[] {
  return state.arcs
    .filter(arc => arc.target === transitionId)
    .map(arc => arc.source);
}

function checkTransitionEnabled(
  state: { places: Place[], arcs: Arc[] },
  transitionId: string
): boolean {
  const inputArcs = state.arcs.filter(arc => arc.target === transitionId);
  
  for (const arc of inputArcs) {
    const place = state.places.find(p => p.id === arc.source);
    if (!place || place.tokens.length === 0) {
      return false;
    }
  }
  
  return true;
}

function buildReadableHint(
  transition: Transition,
  missingRequirements: string[],
  suggestedPath: string[]
): string {
  if (missingRequirements.length === 0) {
    return `${transition.name} is ready to execute`;
  }
  
  const needs = missingRequirements.join(', ');
  const path = suggestedPath.join(' → ');
  
  return `${transition.name} needs: ${needs}\nTry instead: ${path}`;
}

export function integrateContextualHints(net: ColoredPetriNet): void {
  // Monkey-patch or extend the ColoredPetriNet class to use contextual hints
  const originalFireTransition = net.fireTransition.bind(net);
  
  (net as any).fireTransition = async function(transitionId: string, selectedBinding?: any) {
    try {
      return await originalFireTransition(transitionId, selectedBinding);
    } catch (error) {
      if (error instanceof Error && error.name === 'TransitionNotEnabledError') {
        const hint = generateContextualHint(net, transitionId);
        error.message = hint.readable;
      }
      throw error;
    }
  };
}