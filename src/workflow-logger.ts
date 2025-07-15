/**
 * Workflow Analytics Logger for Petri Net MCP Servers
 * 
 * Captures tool call statistics, confidence scores, and workflow paths
 * to analyze how different language models navigate the semantic space.
 * 
 * Philosophy: Lightweight analytics that align with Petri net principles
 * without adding heavyweight dependencies or complex abstractions.
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';

export interface WorkflowLoggerConfig {
  /** Filesystem path for log storage */
  logPath: string;
  /** Session timeout in minutes (default: 10) */
  sessionTimeoutMinutes?: number;
  /** Enable/disable logging (default: true) */
  enabled?: boolean;
  /** Log level for debugging (default: 'info') */
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

export interface SessionInfo {
  sessionId: string;
  startTime: number;
  lastActivity: number;
  toolCallCount: number;
  model?: string;
  userContext?: string;
}

export interface ToolCallEvent {
  timestamp: number;
  sessionId: string;
  toolName: string;
  transitionId: string;
  confidence: number;
  success: boolean;
  errorType?: 'missing_tokens' | 'guard_failed' | 'handler_error' | 'other';
  errorMessage?: string;
  inputTokens?: string[];
  outputTokens?: string[];
  nextEnabledTransitions?: string[];
  executionTimeMs: number;
  contextData?: any;
}

export interface WorkflowPath {
  sessionId: string;
  sequence: string[];
  confidenceScores: number[];
  totalTools: number;
  uniqueTools: number;
  avgConfidence: number;
  pathEfficiency: number; // ratio of successful to total calls
}

export class WorkflowLogger {
  private config: Required<WorkflowLoggerConfig>;
  private activeSessions: Map<string, SessionInfo> = new Map();
  private sessionCleanupInterval: NodeJS.Timeout | null = null;

  constructor(config: WorkflowLoggerConfig) {
    this.config = {
      sessionTimeoutMinutes: 10,
      enabled: true,
      logLevel: 'info',
      ...config
    };

    this.ensureLogDirectory();
    this.startSessionCleanup();
  }

  private async ensureLogDirectory(): Promise<void> {
    if (!this.config.enabled) return;
    
    try {
      await fs.mkdir(this.config.logPath, { recursive: true });
    } catch (error) {
      console.error('Failed to create log directory:', error);
    }
  }

  private generateSessionId(): string {
    const now = new Date();
    const datePrefix = now.toISOString().slice(0, 10).replace(/-/g, '');
    const timePrefix = now.toTimeString().slice(0, 8).replace(/:/g, '');
    const randomSuffix = createHash('sha256')
      .update(`${Date.now()}-${Math.random()}`)
      .digest('hex')
      .slice(0, 8);
    
    return `${datePrefix}-${timePrefix}-${randomSuffix}`;
  }

  private getOrCreateSession(contextHint?: string): SessionInfo {
    const now = Date.now();
    const timeoutMs = this.config.sessionTimeoutMinutes * 60 * 1000;

    // Find existing session within timeout window
    for (const [sessionId, session] of this.activeSessions.entries()) {
      if (now - session.lastActivity < timeoutMs) {
        session.lastActivity = now;
        return session;
      }
    }

    // Create new session
    const sessionId = this.generateSessionId();
    const session: SessionInfo = {
      sessionId,
      startTime: now,
      lastActivity: now,
      toolCallCount: 0,
      userContext: contextHint
    };

    this.activeSessions.set(sessionId, session);
    return session;
  }

  private startSessionCleanup(): void {
    if (!this.config.enabled) return;

    // Clean up expired sessions every minute
    this.sessionCleanupInterval = setInterval(() => {
      const now = Date.now();
      const timeoutMs = this.config.sessionTimeoutMinutes * 60 * 1000;

      for (const [sessionId, session] of this.activeSessions.entries()) {
        if (now - session.lastActivity > timeoutMs) {
          this.activeSessions.delete(sessionId);
          if (this.config.logLevel === 'debug') {
            console.log(`Session ${sessionId} expired and cleaned up`);
          }
        }
      }
    }, 60000); // Run every minute
  }

  async logToolCall(event: Omit<ToolCallEvent, 'timestamp' | 'sessionId'>): Promise<void> {
    if (!this.config.enabled) return;

    const session = this.getOrCreateSession(event.contextData?.userContext);
    session.toolCallCount++;

    const toolCallEvent: ToolCallEvent = {
      ...event,
      timestamp: Date.now(),
      sessionId: session.sessionId
    };

    await this.writeLogEntry('tool_calls', toolCallEvent);

    if (this.config.logLevel === 'debug') {
      console.log(`Logged tool call: ${event.toolName} (confidence: ${event.confidence})`);
    }
  }

  async logWorkflowPath(sessionId: string): Promise<void> {
    if (!this.config.enabled) return;

    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    try {
      const toolCalls = await this.getSessionToolCalls(sessionId);
      const path = this.analyzeWorkflowPath(toolCalls);
      
      await this.writeLogEntry('workflow_paths', path);
    } catch (error) {
      console.error('Failed to log workflow path:', error);
    }
  }

  private async getSessionToolCalls(sessionId: string): Promise<ToolCallEvent[]> {
    const logFile = join(this.config.logPath, 'tool_calls.jsonl');
    
    try {
      const content = await fs.readFile(logFile, 'utf-8');
      const lines = content.trim().split('\n');
      
      return lines
        .map(line => JSON.parse(line) as ToolCallEvent)
        .filter(event => event.sessionId === sessionId)
        .sort((a, b) => a.timestamp - b.timestamp);
    } catch (error) {
      return [];
    }
  }

  private analyzeWorkflowPath(toolCalls: ToolCallEvent[]): WorkflowPath {
    const sequence = toolCalls.map(call => call.toolName);
    const confidenceScores = toolCalls.map(call => call.confidence);
    const uniqueTools = new Set(sequence).size;
    const successfulCalls = toolCalls.filter(call => call.success).length;
    
    return {
      sessionId: toolCalls[0]?.sessionId || '',
      sequence,
      confidenceScores,
      totalTools: toolCalls.length,
      uniqueTools,
      avgConfidence: confidenceScores.reduce((sum, conf) => sum + conf, 0) / confidenceScores.length || 0,
      pathEfficiency: successfulCalls / toolCalls.length || 0
    };
  }

  private async writeLogEntry(type: string, data: any): Promise<void> {
    const logFile = join(this.config.logPath, `${type}.jsonl`);
    const logEntry = JSON.stringify(data) + '\n';
    
    try {
      await fs.appendFile(logFile, logEntry);
    } catch (error) {
      console.error(`Failed to write ${type} log entry:`, error);
    }
  }

  async getSessionStats(): Promise<{
    activeSessions: number;
    totalToolCalls: number;
    avgSessionLength: number;
  }> {
    const activeSessions = this.activeSessions.size;
    const totalToolCalls = Array.from(this.activeSessions.values())
      .reduce((sum, session) => sum + session.toolCallCount, 0);
    const avgSessionLength = activeSessions > 0 ? totalToolCalls / activeSessions : 0;

    return {
      activeSessions,
      totalToolCalls,
      avgSessionLength
    };
  }

  async analyzePathPatterns(): Promise<{
    commonPaths: Array<{ sequence: string[]; frequency: number }>;
    averageConfidence: number;
    pathEfficiency: number;
  }> {
    if (!this.config.enabled) {
      return { commonPaths: [], averageConfidence: 0, pathEfficiency: 0 };
    }

    try {
      const pathsFile = join(this.config.logPath, 'workflow_paths.jsonl');
      const content = await fs.readFile(pathsFile, 'utf-8');
      const paths = content.trim().split('\n').map(line => JSON.parse(line) as WorkflowPath);

      // Analyze common patterns
      const pathFrequency = new Map<string, number>();
      let totalConfidence = 0;
      let totalEfficiency = 0;

      for (const path of paths) {
        const pathKey = path.sequence.join(' → ');
        pathFrequency.set(pathKey, (pathFrequency.get(pathKey) || 0) + 1);
        totalConfidence += path.avgConfidence;
        totalEfficiency += path.pathEfficiency;
      }

      const commonPaths = Array.from(pathFrequency.entries())
        .map(([sequence, frequency]) => ({
          sequence: sequence.split(' → '),
          frequency
        }))
        .sort((a, b) => b.frequency - a.frequency)
        .slice(0, 10);

      return {
        commonPaths,
        averageConfidence: totalConfidence / paths.length || 0,
        pathEfficiency: totalEfficiency / paths.length || 0
      };
    } catch (error) {
      return { commonPaths: [], averageConfidence: 0, pathEfficiency: 0 };
    }
  }

  shutdown(): void {
    if (this.sessionCleanupInterval) {
      clearInterval(this.sessionCleanupInterval);
    }
  }
}

export default WorkflowLogger;