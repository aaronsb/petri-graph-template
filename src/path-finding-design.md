# Path Finding for Contextual Hints (Option 3)

## Goal
Generate hints like: `write_file needs: file content\nTry instead: search_files → read_file → write_file`

## Challenges

### 1. Identifying Missing Requirements
For `write_file`, we need to:
- Look at input arcs to find required places (e.g., `file_read`)
- Check if those places have tokens
- Translate place names to human-readable requirements

### 2. Path Finding
We need a graph traversal algorithm to find the shortest path from current state to goal:

```
Current State: [start token]
Goal: [token in file_read place]

Path finding:
1. What transitions can fire now? → search_files
2. What does search_files produce? → token in search_results
3. What can fire with search_results? → search_file_read
4. What does search_file_read produce? → token in file_read
5. Now write_file can fire!

Result: search_files → search_file_read → write_file
```

### 3. Complexity Considerations

**Simple approach**: Hard-code common paths
```typescript
const commonPaths = {
  'write_file': ['search_files', 'read_file', 'write_file'],
  'modify_file_write': ['search_files', 'read_file', 'modify_file_write']
};
```

**Dynamic approach**: Use BFS/DFS to find paths
```typescript
function findPath(net: ColoredPetriNet, targetTransition: string): string[] {
  // BFS from current state to find shortest path
  // that enables targetTransition
}
```

**Hybrid approach**: Pre-compute paths when net is created
```typescript
class ColoredPetriNet {
  private pathCache: Map<string, Map<string, string[]>>;
  
  computeAllPaths() {
    // At initialization, compute paths between all states
  }
}
```

## Implementation Options

### Option A: Simple Static Mapping
```typescript
const requirements = {
  'write_file': 'file content',
  'read_file': 'found file',
  'modify_file_write': 'file content'
};

const paths = {
  'write_file': 'search_files → read_file → write_file',
  'read_file': 'search_files → read_file'
};
```

### Option B: Dynamic from Net Structure
```typescript
function getMissingRequirement(transition: Transition): string {
  const inputPlaces = getInputPlaces(transition);
  const emptyPlaces = inputPlaces.filter(p => p.tokens.length === 0);
  return emptyPlaces.map(p => humanReadable(p)).join(', ');
}

function getPathToTransition(net: ColoredPetriNet, target: string): string[] {
  // BFS implementation
}
```

### Option C: Semantic Annotations
Add metadata to places and transitions:
```typescript
net.addPlace({
  id: 'file_read',
  name: 'File Read',
  description: 'File content loaded in memory',
  semanticName: 'file content' // Used in hints
});
```

## Recommendation
Start with Option A (static mapping) for common cases, then gradually add Option B (dynamic) for flexibility.