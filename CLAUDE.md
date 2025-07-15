# Claude MCP Colored Petri Net Integration

This project provides a Colored Petri Net based MCP server that enables AI agents to navigate complex workflows with semantic guidance.

## How It Works

The MCP server presents tools as transitions in a Petri net, where:
- **Places** represent workflow states
- **Transitions** are your tools (following verb:noun or verb:noun:verb patterns)
- **Tokens** carry context through the workflow
- **Semantic hints** guide the AI to appropriate next actions

## Key Benefits

1. **Concurrent Workflows** - Multiple operations can happen simultaneously
2. **Creative Tool Use** - Different models find different paths through the same net
3. **Context Preservation** - State flows naturally between tool calls
4. **Emergent Patterns** - The AI discovers efficient workflows rather than following rigid paths

## Tool Patterns

Tools follow semantic naming conventions:
- `search:files` - Simple verb:noun pattern
- `modify:file:write` - Composite verb:noun:verb pattern
- `get_next_actions` - Special tool to see available transitions

## Workflow Example

When you start working with files:
1. Initially only `search:files` is available
2. After searching, `search:file:read` becomes highly weighted
3. After reading, both `write:file` and `modify:file:write` are available
4. The AI chooses based on context and its own capabilities

## Integration with Claude

The server has been added to your project configuration. You may need to restart Claude for it to load the new MCP server.

When Claude starts, it will:
1. Initialize the Petri net with a start token
2. Present available tools based on current state
3. Update the net as you execute tools
4. Provide semantic hints in tool responses

## Customization

To adapt this for your own workflows:

1. Modify `example-file-operations.ts` to define your places and transitions
2. Update tool handlers with your actual API calls
3. Adjust confidence scoring in `colored-petri-net.ts`
4. Add domain-specific guards and expressions

## Philosophy

This approach embraces the diversity of language models. Instead of forcing all models down the same path, the Petri net creates an "attractive field" where each model's training and biases help it find creative solutions to problems.

The colored tokens allow rich context to flow through the workflow, enabling sophisticated multi-step operations while maintaining the flexibility for models to approach problems in their own way.