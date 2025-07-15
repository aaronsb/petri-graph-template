#!/usr/bin/env node

/**
 * Workflow Analytics Tool
 * 
 * Analyzes workflow logs to understand how language models navigate
 * the semantic space and discover patterns in tool usage.
 */

import { WorkflowLogger } from './workflow-logger';
import { createLoggerConfig } from './logger-config';

async function analyzeWorkflows() {
  const logger = new WorkflowLogger(createLoggerConfig());
  
  console.log('🔍 Workflow Analytics Report');
  console.log('============================\n');

  // Session statistics
  const sessionStats = await logger.getSessionStats();
  console.log('📊 Session Statistics:');
  console.log(`  Active sessions: ${sessionStats.activeSessions}`);
  console.log(`  Total tool calls: ${sessionStats.totalToolCalls}`);
  console.log(`  Avg tools per session: ${sessionStats.avgSessionLength.toFixed(2)}`);
  console.log();

  // Path pattern analysis
  const pathAnalysis = await logger.analyzePathPatterns();
  console.log('🛤️  Path Patterns:');
  console.log(`  Average confidence: ${(pathAnalysis.averageConfidence * 100).toFixed(1)}%`);
  console.log(`  Path efficiency: ${(pathAnalysis.pathEfficiency * 100).toFixed(1)}%`);
  console.log();

  if (pathAnalysis.commonPaths.length > 0) {
    console.log('📈 Most Common Workflows:');
    pathAnalysis.commonPaths.slice(0, 5).forEach((path, index) => {
      console.log(`  ${index + 1}. ${path.sequence.join(' → ')} (${path.frequency}x)`);
    });
  } else {
    console.log('📈 No workflow patterns found yet. Use the MCP server to generate data.');
  }

  logger.shutdown();
}

// Petri net insights
function printPetriNetInsights() {
  console.log('\n🎯 Petri Net Design Insights:');
  console.log('==============================');
  console.log('This analytics tool demonstrates key Petri net principles:');
  console.log();
  console.log('• Token Flow: Each tool call represents a token moving through places');
  console.log('• Concurrent States: Multiple sessions can exist simultaneously');
  console.log('• Semantic Hints: Confidence scores guide transition selection');
  console.log('• Path Discovery: Models find different routes through the same net');
  console.log('• Information Flow: Patterns emerge from information optimization');
  console.log();
  console.log('The logs capture how different language models navigate the semantic');
  console.log('space, validating the information-theoretic foundation of the approach.');
}

async function main() {
  const command = process.argv[2];

  switch (command) {
    case 'analyze':
    case undefined:
      await analyzeWorkflows();
      break;
    
    case 'insights':
      printPetriNetInsights();
      break;
    
    case 'help':
    default:
      console.log('Workflow Analytics Tool');
      console.log('Usage: npm run analytics [command]');
      console.log();
      console.log('Commands:');
      console.log('  analyze    Show workflow analysis (default)');
      console.log('  insights   Show Petri net design insights');
      console.log('  help       Show this help message');
      break;
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { analyzeWorkflows };