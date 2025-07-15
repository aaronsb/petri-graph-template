# Hint Format Options for Petri Net Tool Errors

When a tool cannot be executed due to missing preconditions, we need to provide helpful guidance. Here are different formatting options:

## Option 1: Ultra-terse
```
write_file unavailable. Try: search_files (60%)
```
- **Pros**: Minimal tokens, fast to read
- **Cons**: May be too cryptic for new users

## Option 2: Structured but brief
```
write_file: Missing prerequisites
Available: search_files (60%)
```
- **Pros**: Clear structure, easy to parse, still concise
- **Cons**: Doesn't show the path to the goal

## Option 3: Contextual hints
```
write_file needs: file content
Try instead: search_files → read_file → write_file
```
- **Pros**: Shows what's missing and how to get there
- **Cons**: Requires path-finding logic, more complex to implement

## Option 4: State-focused
```
Current state: No file loaded
write_file requires: File in memory
Next: search_files (recommended)
```
- **Pros**: Educational, helps users understand the system
- **Cons**: More verbose

## Option 5: Workflow position
```
❌ write_file (no file selected)
✓ search_files (start here)
```
- **Pros**: Visual, clear yes/no
- **Cons**: Doesn't scale well with many options

## Option 6: Single line with path
```
write_file blocked • Required path: search_files → read_file → write_file
```
- **Pros**: All info in one line
- **Cons**: Can get long with complex paths

## Current (verbose) format
```
Cannot execute write_file at this time.

**Why?** This action requires certain preconditions that aren't met.

**Available actions you can take:**

1. **search_files**
   Search for files by pattern
   Confidence: 60%

**Hint:** The workflow requires you to complete certain steps before write_file becomes available.
```
- **Pros**: Very clear for beginners
- **Cons**: Too many tokens, repetitive