/**
 * Colored Petri Net implementation for MCP tool orchestration
 * 
 * This implementation focuses on modeling tool execution flows where:
 * - Places represent states/contexts in the workflow
 * - Transitions represent tool operations (verb:noun or verb:noun:verb)
 * - Tokens carry colored data (tool parameters and context)
 * - Semantic hints are generated based on enabled transitions
 */

// Custom error that includes semantic hints
export class TransitionNotEnabledError extends Error {
  constructor(
    message: string,
    public transitionName: string,
    public availableTransitions: SemanticHint[]
  ) {
    super(message);
    this.name = 'TransitionNotEnabledError';
  }
}

// Token carries typed data through the net
export interface Token<T = any> {
  id: string;
  color: T; // The actual data/context
  place: string; // Current location
}

// Place represents a state or context in the workflow
export interface Place {
  id: string;
  name: string;
  description?: string;
  tokens: Token[];
}

// Arc connects places to transitions or vice versa
export interface Arc {
  id: string;
  source: string; // Place or Transition ID
  target: string; // Place or Transition ID
  weight?: number; // How many tokens required/produced (default 1)
  pattern?: (token: Token) => boolean; // Pattern matching for input arcs
  expression?: (binding: any) => any; // Transform function for output arcs
}

// Transition represents a tool operation
export interface Transition {
  id: string;
  name: string; // verb:noun or verb:noun:verb format
  description?: string;
  guard?: (binding: any) => boolean; // Additional firing condition
  handler?: (binding: any) => Promise<any>; // The actual tool implementation
}

// Binding maps variable names to token values for a transition
export interface Binding {
  [variable: string]: any;
}

// Semantic hint for next possible actions
export interface SemanticHint {
  transitionId: string;
  transitionName: string;
  description?: string;
  confidence: number; // 0-1, how likely this is the next step
  requiredTokens?: string[]; // What tokens/data are needed
  example?: string; // Example invocation
}

export class ColoredPetriNet {
  private places: Map<string, Place> = new Map();
  private transitions: Map<string, Transition> = new Map();
  private arcs: Arc[] = [];
  private tokenCounter = 0;

  constructor() {}

  // Add a place to the net
  addPlace(place: Place): void {
    this.places.set(place.id, place);
  }

  // Add a transition to the net
  addTransition(transition: Transition): void {
    this.transitions.set(transition.id, transition);
  }

  // Add an arc to the net
  addArc(arc: Arc): void {
    this.arcs.push(arc);
  }

  // Add a token to a place
  addToken<T>(placeId: string, color: T): string {
    const place = this.places.get(placeId);
    if (!place) {
      throw new Error(`Place ${placeId} not found`);
    }
    
    const tokenId = `token-${++this.tokenCounter}`;
    const token: Token<T> = {
      id: tokenId,
      color,
      place: placeId
    };
    
    place.tokens.push(token);
    return tokenId;
  }

  // Get all enabled transitions (semantic hints)
  getEnabledTransitions(): SemanticHint[] {
    const hints: SemanticHint[] = [];

    for (const transition of this.transitions.values()) {
      const inputArcs = this.getInputArcs(transition.id);
      const bindings = this.findValidBindings(inputArcs);

      for (const binding of bindings) {
        // Check guard condition if present
        if (transition.guard && !transition.guard(binding)) {
          continue;
        }

        hints.push({
          transitionId: transition.id,
          transitionName: transition.name,
          description: transition.description,
          confidence: this.calculateConfidence(transition, binding),
          requiredTokens: Object.keys(binding),
          example: this.generateExample(transition, binding)
        });
      }
    }

    // Sort by confidence
    return hints.sort((a, b) => b.confidence - a.confidence);
  }

  // Fire a transition (execute a tool)
  async fireTransition(transitionId: string, selectedBinding?: Binding): Promise<any> {
    const transition = this.transitions.get(transitionId);
    if (!transition) {
      throw new Error(`Transition ${transitionId} not found`);
    }

    // Find valid bindings if not provided
    const inputArcs = this.getInputArcs(transitionId);
    const bindings = selectedBinding ? [selectedBinding] : this.findValidBindings(inputArcs);

    if (bindings.length === 0) {
      // Get available transitions to help the user
      const availableHints = this.getEnabledTransitions();
      throw new TransitionNotEnabledError(
        `Transition ${transitionId} is not enabled`,
        transition.name,
        availableHints
      );
    }

    const binding = bindings[0]; // Use first valid binding

    // Check guard
    if (transition.guard && !transition.guard(binding)) {
      const availableHints = this.getEnabledTransitions();
      throw new TransitionNotEnabledError(
        `Guard condition failed for transition ${transitionId}`,
        transition.name,
        availableHints
      );
    }

    // Remove tokens from input places
    for (const arc of inputArcs) {
      const place = this.places.get(arc.source);
      if (place) {
        const tokensToRemove = arc.weight || 1;
        for (let i = 0; i < tokensToRemove; i++) {
          const tokenIndex = place.tokens.findIndex(t => 
            !arc.pattern || arc.pattern(t)
          );
          if (tokenIndex !== -1) {
            place.tokens.splice(tokenIndex, 1);
          }
        }
      }
    }

    // Execute the transition handler if present
    let result = binding;
    if (transition.handler) {
      result = await transition.handler(binding);
    }

    // Add tokens to output places
    const outputArcs = this.getOutputArcs(transitionId);
    for (const arc of outputArcs) {
      const tokensToAdd = arc.weight || 1;
      for (let i = 0; i < tokensToAdd; i++) {
        const tokenColor = arc.expression ? arc.expression(result) : result;
        this.addToken(arc.target, tokenColor);
      }
    }

    return result;
  }

  // Helper: Get input arcs for a transition
  private getInputArcs(transitionId: string): Arc[] {
    return this.arcs.filter(arc => arc.target === transitionId);
  }

  // Helper: Get output arcs for a transition
  private getOutputArcs(transitionId: string): Arc[] {
    return this.arcs.filter(arc => arc.source === transitionId);
  }

  // Helper: Find all valid bindings for input arcs
  private findValidBindings(inputArcs: Arc[]): Binding[] {
    if (inputArcs.length === 0) return [{}];

    const bindings: Binding[] = [];
    
    // Simple implementation - can be optimized
    const checkBinding = (arcIndex: number, currentBinding: Binding): void => {
      if (arcIndex >= inputArcs.length) {
        bindings.push({ ...currentBinding });
        return;
      }

      const arc = inputArcs[arcIndex];
      const place = this.places.get(arc.source);
      if (!place) return;

      for (const token of place.tokens) {
        if (!arc.pattern || arc.pattern(token)) {
          const variableName = `${arc.source}_token`;
          currentBinding[variableName] = token.color;
          checkBinding(arcIndex + 1, currentBinding);
          delete currentBinding[variableName];
        }
      }
    };

    checkBinding(0, {});
    return bindings;
  }

  // Helper: Calculate confidence score for a transition
  private calculateConfidence(transition: Transition, binding: Binding): number {
    // Simple heuristic - can be made more sophisticated
    let confidence = 0.5;

    // Boost confidence based on token availability
    const bindingSize = Object.keys(binding).length;
    if (bindingSize > 0) {
      confidence += 0.1 * bindingSize;
    }

    // Boost for specific patterns (verb:noun:verb has higher confidence)
    const parts = transition.name.split(':');
    if (parts.length === 3) {
      confidence += 0.2;
    }

    return Math.min(confidence, 1.0);
  }

  // Helper: Generate example usage for a transition
  private generateExample(transition: Transition, binding: Binding): string {
    const parts = transition.name.split(':');
    if (parts.length === 2) {
      return `${parts[0]}("${parts[1]}")`;
    } else if (parts.length === 3) {
      return `${parts[0]}("${parts[1]}", "${parts[2]}")`;
    }
    return transition.name;
  }

  // Visualization helper - get current state
  getState(): { places: Place[], transitions: Transition[], arcs: Arc[] } {
    return {
      places: Array.from(this.places.values()),
      transitions: Array.from(this.transitions.values()),
      arcs: this.arcs
    };
  }
}