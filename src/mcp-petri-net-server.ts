/**
 * MCP Server with Colored Petri Net for Tool Orchestration
 * 
 * This server presents tools to language models using the Model Context Protocol,
 * with a Petri net backend that tracks workflow state and provides semantic hints
 * for next actions.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  TextContentSchema,
  ImageContentSchema
} from '@modelcontextprotocol/sdk/types.js';
import { ColoredPetriNet, SemanticHint, TransitionNotEnabledError } from './colored-petri-net';
import { createFileOperationsNet } from './example-file-operations';

// Extended tool schema to include semantic hints
interface PetriNetTool {
  name: string;
  description?: string;
  inputSchema?: {
    type: string;
    properties?: any;
    required?: string[];
  };
  transitionId: string;
}

export class MCPPetriNetServer {
  private server: Server;
  private net: ColoredPetriNet;
  private toolsMap: Map<string, PetriNetTool> = new Map();
  private nameMapping: Map<string, string> = new Map(); // MCP name -> original name
  
  // Static mappings for contextual hints (Option 3)
  private requirementDescriptions: Map<string, string> = new Map([
    ['write_file', 'file content'],
    ['read_file', 'found file'],
    ['modify_file_write', 'file content'],
    ['search_file_read', 'search results']
  ]);
  
  private suggestedPaths: Map<string, string[]> = new Map([
    ['write_file', ['search_files', 'read_file', 'write_file']],
    ['read_file', ['search_files', 'read_file']],
    ['modify_file_write', ['search_files', 'read_file', 'modify_file_write']],
    ['search_file_read', ['search_files', 'search_file_read']]
  ]);

  // Hint format options
  private hintFormat: 'verbose' | 'brief' | 'contextual' = 'contextual';

  constructor() {
    this.server = new Server(
      {
        name: 'petri-net-tools',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Initialize with file operations example
    this.net = createFileOperationsNet();
    this.initializeTools();
    this.setupHandlers();
  }

  private initializeTools() {
    // Convert Petri net transitions to MCP tools
    const state = this.net.getState();
    
    for (const transition of state.transitions) {
      // Convert verb:noun:verb to MCP-compatible name
      const mcpName = this.convertToMcpName(transition.name);
      
      const tool: PetriNetTool = {
        name: mcpName,
        description: transition.description || `Execute ${transition.name}`,
        transitionId: transition.id,
        inputSchema: {
          type: 'object',
          properties: this.generateInputSchema(transition.name),
        }
      };
      
      this.toolsMap.set(mcpName, tool);
      this.nameMapping.set(mcpName, transition.name);
    }

    // Add a special tool for getting semantic hints
    this.toolsMap.set('get_next_actions', {
      name: 'get_next_actions',
      description: 'Get semantically appropriate next actions based on current workflow state',
      transitionId: 'meta_hints',
      inputSchema: {
        type: 'object',
        properties: {}
      }
    });
  }

  private convertToMcpName(originalName: string): string {
    // Convert verb:noun:verb to verb_noun_verb for MCP compatibility
    return originalName.replace(/:/g, '_');
  }

  private generateInputSchema(transitionName: string): any {
    const parts = transitionName.split(':');
    const properties: any = {};

    if (parts.length >= 2) {
      // For verb:noun pattern
      properties[parts[1]] = {
        type: 'string',
        description: `The ${parts[1]} to ${parts[0]}`
      };
    }

    if (parts.length === 3) {
      // For verb:noun:verb pattern
      properties.action = {
        type: 'string',
        enum: [parts[2]],
        description: `Action to perform after ${parts[0]}ing the ${parts[1]}`
      };
    }

    // Add optional context parameter
    properties.context = {
      type: 'object',
      description: 'Optional context from previous operations',
      properties: {}
    };

    return properties;
  }

  private setupHandlers() {
    // Handle tool listing
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      // Get current semantic hints
      const hints = this.net.getEnabledTransitions();
      
      // Prioritize tools based on semantic hints
      const tools = Array.from(this.toolsMap.values());
      const prioritizedTools = this.prioritizeTools(tools, hints);

      return {
        tools: prioritizedTools
      };
    });

    // Handle tool execution
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      const tool = this.toolsMap.get(name);
      if (!tool) {
        throw new Error(`Tool ${name} not found`);
      }

      // Special handling for semantic hints tool
      if (name === 'get_next_actions') {
        const hints = this.net.getEnabledTransitions();
        return {
          content: [
            {
              type: 'text',
              text: this.formatSemanticHints(hints)
            }
          ]
        };
      }

      try {
        // Execute the transition in the Petri net
        // Don't pass args as binding - let the Petri net validate preconditions
        const result = await this.net.fireTransition(tool.transitionId);
        
        // Get new semantic hints after execution
        const newHints = this.net.getEnabledTransitions();
        
        return {
          content: [
            {
              type: 'text',
              text: this.formatToolResult(name, result, newHints)
            }
          ]
        };
      } catch (error) {
        // Handle TransitionNotEnabledError with helpful guidance
        if (error instanceof TransitionNotEnabledError) {
          return {
            content: [
              {
                type: 'text',
                text: this.formatTransitionError(name, error)
              }
            ]
          };
        }
        
        // Handle other errors
        return {
          content: [
            {
              type: 'text',
              text: `Error executing ${name}: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    });
  }

  private prioritizeTools(tools: PetriNetTool[], hints: SemanticHint[]): any[] {
    // Create a map of transition IDs to confidence scores
    const confidenceMap = new Map<string, number>();
    hints.forEach(hint => {
      confidenceMap.set(hint.transitionId, hint.confidence);
    });

    // Sort tools by confidence, with enabled transitions first
    return tools.sort((a, b) => {
      const confA = confidenceMap.get(a.transitionId) || 0;
      const confB = confidenceMap.get(b.transitionId) || 0;
      return confB - confA;
    }).map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema
    }));
  }

  private formatSemanticHints(hints: SemanticHint[]): string {
    if (hints.length === 0) {
      return 'No actions are currently available. You may need to start with an initial action.';
    }

    let output = 'Based on the current workflow state, here are the recommended next actions:\n\n';
    
    hints.forEach((hint, index) => {
      const mcpName = this.convertToMcpName(hint.transitionName);
      output += `${index + 1}. **${mcpName}** (${hint.transitionName})\n`;
      output += `   Description: ${hint.description}\n`;
      output += `   Confidence: ${(hint.confidence * 100).toFixed(0)}%\n`;
      if (hint.example) {
        output += `   Example: \`${mcpName}\`\n`;
      }
      output += '\n';
    });

    return output;
  }

  private formatToolResult(toolName: string, result: any, nextHints: SemanticHint[]): string {
    let output = `Successfully executed: ${toolName}\n\n`;
    
    if (result) {
      output += 'Result:\n```json\n';
      output += JSON.stringify(result, null, 2);
      output += '\n```\n\n';
    }

    if (nextHints.length > 0) {
      output += 'Suggested next actions:\n';
      nextHints.slice(0, 3).forEach(hint => {
        const mcpName = this.convertToMcpName(hint.transitionName);
        output += `- ${mcpName}: ${hint.description}\n`;
      });
    }

    return output;
  }

  private formatTransitionError(toolName: string, error: TransitionNotEnabledError): string {
    switch (this.hintFormat) {
      case 'verbose':
        return this.formatVerboseError(toolName, error);
      case 'contextual':
        return this.formatContextualError(toolName, error);
      case 'brief':
      default:
        return this.formatBriefError(toolName, error);
    }
  }

  private formatBriefError(toolName: string, error: TransitionNotEnabledError): string {
    let output = `${toolName}: Missing prerequisites\n`;
    
    if (error.availableTransitions.length > 0) {
      output += 'Available: ';
      output += error.availableTransitions
        .map(hint => {
          const mcpName = this.convertToMcpName(hint.transitionName);
          return `${mcpName} (${(hint.confidence * 100).toFixed(0)}%)`;
        })
        .join(', ');
    } else {
      output += 'No actions available';
    }
    
    return output;
  }

  private formatContextualError(toolName: string, error: TransitionNotEnabledError): string {
    const requirement = this.requirementDescriptions.get(toolName) || 'prerequisites';
    const path = this.suggestedPaths.get(toolName);
    
    let output = `${toolName} needs: ${requirement}\n`;
    
    if (path) {
      output += `Try instead: ${path.join(' → ')}`;
    } else if (error.availableTransitions.length > 0) {
      // Fallback to showing available actions
      const firstAction = this.convertToMcpName(error.availableTransitions[0].transitionName);
      output += `Try: ${firstAction} first`;
    }
    
    return output;
  }

  private formatVerboseError(toolName: string, error: TransitionNotEnabledError): string {
    let output = `Cannot execute ${toolName} at this time.\n\n`;
    output += `**Why?** This action requires certain preconditions that aren't met.\n\n`;
    
    if (error.availableTransitions.length > 0) {
      output += `**Available actions you can take:**\n\n`;
      error.availableTransitions.forEach((hint, index) => {
        const mcpName = this.convertToMcpName(hint.transitionName);
        output += `${index + 1}. **${mcpName}**\n`;
        output += `   ${hint.description}\n`;
        output += `   Confidence: ${(hint.confidence * 100).toFixed(0)}%\n\n`;
      });
      output += `**Hint:** The workflow requires you to complete certain steps before ${toolName} becomes available.`;
    } else {
      output += `**No actions are currently available.** You may need to start with an initial action or reset the workflow.`;
    }
    
    return output;
  }

  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    
    // Initialize the workflow with a starting token
    this.net.addToken('start', {});
    
    // Server is ready
  }
}

// Start the server
if (require.main === module) {
  const server = new MCPPetriNetServer();
  server.start().catch(console.error);
}