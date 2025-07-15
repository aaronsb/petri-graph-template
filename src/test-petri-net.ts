/**
 * Test file demonstrating the Colored Petri Net concepts
 */

import { ColoredPetriNet } from './colored-petri-net';

// Simple task management workflow
function createTaskWorkflow(): ColoredPetriNet {
  const net = new ColoredPetriNet();

  // Places
  net.addPlace({ id: 'backlog', name: 'Backlog', tokens: [] });
  net.addPlace({ id: 'in_progress', name: 'In Progress', tokens: [] });
  net.addPlace({ id: 'review', name: 'In Review', tokens: [] });
  net.addPlace({ id: 'done', name: 'Done', tokens: [] });

  // Transitions with verb:noun pattern
  net.addTransition({
    id: 'start_task',
    name: 'start:task',
    description: 'Start working on a task',
    handler: async (binding) => {
      console.log('Starting task:', binding.backlog_token);
      return { ...binding.backlog_token, status: 'in_progress' };
    }
  });

  net.addTransition({
    id: 'complete_task',
    name: 'complete:task',
    description: 'Mark task as complete and ready for review',
    handler: async (binding) => {
      console.log('Completing task:', binding.in_progress_token);
      return { ...binding.in_progress_token, status: 'review' };
    }
  });

  net.addTransition({
    id: 'review_approve',
    name: 'review:task:approve',
    description: 'Approve the task in review',
    handler: async (binding) => {
      console.log('Approving task:', binding.review_token);
      return { ...binding.review_token, status: 'done', approved: true };
    }
  });

  net.addTransition({
    id: 'review_reject',
    name: 'review:task:reject',
    description: 'Reject the task and send back to in progress',
    handler: async (binding) => {
      console.log('Rejecting task:', binding.review_token);
      return { ...binding.review_token, status: 'in_progress', rejected: true };
    }
  });

  // Arcs
  net.addArc({ id: 'a1', source: 'backlog', target: 'start_task' });
  net.addArc({ id: 'a2', source: 'start_task', target: 'in_progress' });
  net.addArc({ id: 'a3', source: 'in_progress', target: 'complete_task' });
  net.addArc({ id: 'a4', source: 'complete_task', target: 'review' });
  net.addArc({ id: 'a5', source: 'review', target: 'review_approve' });
  net.addArc({ id: 'a6', source: 'review', target: 'review_reject' });
  net.addArc({ id: 'a7', source: 'review_approve', target: 'done' });
  net.addArc({ id: 'a8', source: 'review_reject', target: 'in_progress' });

  return net;
}

async function runDemo() {
  console.log('=== Colored Petri Net Demo ===\n');
  
  const net = createTaskWorkflow();
  
  // Add some tasks to backlog
  net.addToken('backlog', { id: 1, title: 'Implement login', priority: 'high' });
  net.addToken('backlog', { id: 2, title: 'Fix bug #123', priority: 'medium' });
  net.addToken('in_progress', { id: 3, title: 'Update README', priority: 'low' });
  
  console.log('Initial state:');
  console.log('- Backlog: 2 tasks');
  console.log('- In Progress: 1 task');
  console.log('- Review: 0 tasks');
  console.log('- Done: 0 tasks\n');

  // Show semantic hints
  console.log('Available actions (semantic hints):');
  let hints = net.getEnabledTransitions();
  hints.forEach(hint => {
    console.log(`- ${hint.transitionName}: ${hint.description}`);
    console.log(`  Confidence: ${(hint.confidence * 100).toFixed(0)}%`);
    console.log(`  Example: ${hint.example}\n`);
  });

  // Execute some transitions
  console.log('Executing workflow...\n');
  
  // Start a task
  await net.fireTransition('start_task');
  console.log('✓ Started task from backlog\n');

  // Complete a task
  await net.fireTransition('complete_task');
  console.log('✓ Completed task in progress\n');

  // Show new state
  console.log('Current semantic hints:');
  hints = net.getEnabledTransitions();
  hints.forEach(hint => {
    console.log(`- ${hint.transitionName}: ${hint.description}`);
  });

  // Review the task
  console.log('\nReviewing task...');
  await net.fireTransition('review_approve');
  console.log('✓ Task approved and moved to done\n');

  // Final state
  const state = net.getState();
  console.log('Final state:');
  state.places.forEach(place => {
    console.log(`- ${place.name}: ${place.tokens.length} task(s)`);
  });
}

// Run the demo
runDemo().catch(console.error);