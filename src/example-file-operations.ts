/**
 * Example: File Operations Workflow using Colored Petri Net
 * 
 * This demonstrates how a language model can navigate file operations
 * using the Petri net to track state and suggest next actions.
 */

import { ColoredPetriNet, Token, Place, Transition, Arc } from './colored-petri-net';

// Define token types for our file operations
interface FileToken {
  path: string;
  content?: string;
  exists?: boolean;
  error?: string;
}

interface SearchToken {
  query: string;
  results?: string[];
}

// Create a file operations workflow
export function createFileOperationsNet(): ColoredPetriNet {
  const net = new ColoredPetriNet();

  // Define places (states in our workflow)
  net.addPlace({
    id: 'start',
    name: 'Start',
    description: 'Initial state - no context',
    tokens: []
  });

  net.addPlace({
    id: 'file_found',
    name: 'File Found',
    description: 'A file has been located',
    tokens: []
  });

  net.addPlace({
    id: 'file_read',
    name: 'File Read',
    description: 'File content is available',
    tokens: []
  });

  net.addPlace({
    id: 'search_results',
    name: 'Search Results',
    description: 'Search has returned results',
    tokens: []
  });

  net.addPlace({
    id: 'file_written',
    name: 'File Written',
    description: 'File has been written/updated',
    tokens: []
  });

  net.addPlace({
    id: 'error_state',
    name: 'Error State',
    description: 'An error occurred',
    tokens: []
  });

  // Define transitions (tools/operations)
  net.addTransition({
    id: 'search_files',
    name: 'search:files',
    description: 'Search for files by pattern',
    handler: async (binding) => {
      // For initial transitions, we might not have tokens
      const query = binding.query || '*.ts';
      console.log(`Searching for files matching: ${query}`);
      // Simulate search
      return {
        query: query,
        results: ['file1.ts', 'file2.ts', 'README.md']
      };
    }
  });

  net.addTransition({
    id: 'read_file',
    name: 'read:file',
    description: 'Read file content',
    handler: async (binding) => {
      const fileToken = binding.file_found_token as FileToken;
      if (!fileToken || !fileToken.path) {
        throw new Error('No file token found. You must find a file first using search:files');
      }
      console.log(`Reading file: ${fileToken.path}`);
      // Simulate file read
      return {
        path: fileToken.path,
        content: `// Content of ${fileToken.path}\nexport function example() { return 42; }`,
        exists: true
      };
    }
  });

  net.addTransition({
    id: 'write_file',
    name: 'write:file',
    description: 'Write content to file',
    handler: async (binding) => {
      const fileToken = binding.file_read_token as FileToken;
      console.log(`Writing to file: ${fileToken.path}`);
      // Simulate file write
      return {
        path: fileToken.path,
        content: fileToken.content,
        exists: true
      };
    }
  });

  net.addTransition({
    id: 'search_read',
    name: 'search:file:read',
    description: 'Search for a file and read it',
    handler: async (binding) => {
      const searchToken = binding.search_results_token as SearchToken;
      if (searchToken.results && searchToken.results.length > 0) {
        const firstFile = searchToken.results[0];
        console.log(`Reading first search result: ${firstFile}`);
        return {
          path: firstFile,
          content: `// Content of ${firstFile}`,
          exists: true
        };
      }
      throw new Error('No files found');
    }
  });

  net.addTransition({
    id: 'modify_write',
    name: 'modify:file:write',
    description: 'Modify and write file content',
    guard: (binding) => {
      const fileToken = binding.file_read_token as FileToken;
      return fileToken.content !== undefined;
    },
    handler: async (binding) => {
      const fileToken = binding.file_read_token as FileToken;
      console.log(`Modifying and writing file: ${fileToken.path}`);
      return {
        path: fileToken.path,
        content: fileToken.content + '\n// Modified by AI',
        exists: true
      };
    }
  });

  // Define arcs (connections between places and transitions)
  
  // From start, we can search
  net.addArc({
    id: 'start_to_search',
    source: 'start',
    target: 'search_files'
  });

  // Search produces results
  net.addArc({
    id: 'search_to_results',
    source: 'search_files',
    target: 'search_results',
    expression: (result) => result
  });

  // From search results, we can read a file
  net.addArc({
    id: 'results_to_search_read',
    source: 'search_results',
    target: 'search_read',
    pattern: (token: Token<SearchToken>) => 
      token.color.results !== undefined && token.color.results.length > 0
  });

  // Search-read produces file content
  net.addArc({
    id: 'search_read_to_file_read',
    source: 'search_read',
    target: 'file_read'
  });

  // If we have a found file, we can read it
  net.addArc({
    id: 'found_to_read',
    source: 'file_found',
    target: 'read_file'
  });

  // Read produces file content
  net.addArc({
    id: 'read_to_content',
    source: 'read_file',
    target: 'file_read'
  });

  // From read content, we can modify and write
  net.addArc({
    id: 'content_to_modify',
    source: 'file_read',
    target: 'modify_write'
  });

  // From read content, we can write
  net.addArc({
    id: 'content_to_write',
    source: 'file_read',
    target: 'write_file'
  });

  // Write produces written state
  net.addArc({
    id: 'write_to_written',
    source: 'write_file',
    target: 'file_written'
  });

  // Modify-write produces written state
  net.addArc({
    id: 'modify_to_written',
    source: 'modify_write',
    target: 'file_written'
  });

  return net;
}

// Example usage demonstrating the workflow
export async function demonstrateFileWorkflow() {
  console.log('=== File Operations Workflow Demo ===\n');
  
  const net = createFileOperationsNet();
  
  // Start with an empty context
  net.addToken('start', {});
  
  console.log('Initial state - What can we do?');
  let hints = net.getEnabledTransitions();
  hints.forEach(hint => {
    console.log(`- ${hint.transitionName}: ${hint.description} (confidence: ${hint.confidence})`);
    console.log(`  Example: ${hint.example}`);
  });
  
  // Execute a search
  console.log('\nExecuting: search_files');
  await net.fireTransition('search_files', { query: '*.ts' });
  
  console.log('\nAfter search - What can we do next?');
  hints = net.getEnabledTransitions();
  hints.forEach(hint => {
    console.log(`- ${hint.transitionName}: ${hint.description} (confidence: ${hint.confidence})`);
  });
  
  // Execute search_file_read
  console.log('\nExecuting: search_file_read');
  await net.fireTransition('search_read');
  
  console.log('\nAfter reading file - What can we do next?');
  hints = net.getEnabledTransitions();
  hints.forEach(hint => {
    console.log(`- ${hint.transitionName}: ${hint.description} (confidence: ${hint.confidence})`);
  });
  
  // Execute modify_file_write
  console.log('\nExecuting: modify_file_write');
  await net.fireTransition('modify_write');
  
  console.log('\nFinal state:');
  const state = net.getState();
  state.places.forEach(place => {
    if (place.tokens.length > 0) {
      console.log(`Place "${place.name}" has ${place.tokens.length} token(s)`);
    }
  });
}

// Run the demo if this file is executed directly
if (require.main === module) {
  demonstrateFileWorkflow().catch(console.error);
}