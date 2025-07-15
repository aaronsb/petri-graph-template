# Workflow Analytics Logger

## Overview

The Workflow Analytics Logger captures detailed information about how language models navigate through the Petri net semantic space. This enables empirical analysis of the patterns described in the research paper.

## Philosophy

This logger follows the same lightweight philosophy as the rest of the codebase:

- **Standard patterns**: Uses filesystem JSON lines format, not heavyweight databases
- **Petri net aligned**: Captures tokens, transitions, and confidence scores naturally
- **Session-aware**: Soft-fences sessions based on activity timeouts
- **Non-intrusive**: Doesn't impact tool execution performance

## Configuration

The logger is configured via environment variables or defaults:

```bash
# Log storage location (default: ~/.mcp-workflow-logs)
export MCP_LOG_PATH=/path/to/logs

# Session timeout in minutes (default: 10)
export MCP_SESSION_TIMEOUT_MINUTES=15

# Enable/disable logging (default: true)
export MCP_LOGGING_ENABLED=true

# Log level (default: info)
export MCP_LOG_LEVEL=debug
```

## Data Captured

### Tool Call Events (`tool_calls.jsonl`)

Each tool execution generates a log entry with:

- **Session tracking**: UUID with date encoding
- **Petri net state**: Current confidence scores and enabled transitions
- **Execution details**: Success/failure, timing, error types
- **Token information**: Input/output tokens representing data flow
- **Context**: Arguments and results for pattern analysis

### Workflow Paths (`workflow_paths.jsonl`)

Session-level analysis including:

- **Path sequences**: Ordered list of tools used
- **Confidence patterns**: How confidence scores influenced choices
- **Efficiency metrics**: Success rates and path optimization
- **Discovery patterns**: How models found solutions

## Analytics

### Real-time Analysis

```bash
# View current session statistics
npm run analytics

# Show Petri net design insights
npm run analytics insights
```

### Pattern Discovery

The analytics reveal:

- **Common workflows**: Most frequent tool sequences
- **Model preferences**: How different LLMs navigate the space
- **Confidence correlation**: Relationship between hints and success
- **Error patterns**: Where transitions fail and why

## Integration with Research

This logger validates the theoretical claims in the research paper:

1. **Multi-entry validation**: Shows tools accessed from various starting points
2. **Semantic hint effectiveness**: Measures confidence score impact on success
3. **Path diversity**: Demonstrates multiple routes to the same goal
4. **Information flow**: Captures how context flows through the net

## Example Usage

```typescript
// The logger is automatically integrated into MCPPetriNetServer
// No additional code needed - it captures all tool interactions

// For custom implementations:
import { WorkflowLogger } from './workflow-logger';

const logger = new WorkflowLogger({
  logPath: './workflow-logs',
  sessionTimeoutMinutes: 10
});

// Log tool executions
await logger.logToolCall({
  toolName: 'search_files',
  transitionId: 'search_files_transition',
  confidence: 0.85,
  success: true,
  // ... other fields
});

// Analyze patterns
const patterns = await logger.analyzePathPatterns();
```

## File Structure

```
~/.mcp-workflow-logs/
├── tool_calls.jsonl        # Individual tool executions
├── workflow_paths.jsonl    # Session-level path analysis
└── sessions/              # Session metadata (future)
```

## Lightweight Design

The logger intentionally avoids:

- ❌ Heavy databases or ORMs
- ❌ Complex query languages
- ❌ Real-time dashboards
- ❌ External dependencies

Instead, it provides:

- ✅ Simple JSON Lines format
- ✅ Standard filesystem operations
- ✅ Built-in Node.js libraries only
- ✅ Easy analysis with standard tools

## Future Extensions

For developers implementing this pattern:

1. **Custom metrics**: Add domain-specific measurements
2. **Export formats**: Convert to CSV, Parquet, or other formats
3. **Visualization**: Build simple charts from the JSON data
4. **Correlation analysis**: Study relationships between variables

The logger provides the foundation for empirical validation of Petri net patterns without adding architectural complexity.