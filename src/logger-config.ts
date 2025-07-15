/**
 * Configuration for Workflow Analytics Logger
 * 
 * Provides default configuration and environment-based overrides
 * for the workflow logger following the lightweight philosophy.
 */

import { WorkflowLoggerConfig } from './workflow-logger';
import { join } from 'path';
import { homedir } from 'os';

export function createLoggerConfig(): WorkflowLoggerConfig {
  const defaultLogPath = join(homedir(), '.mcp-workflow-logs');
  
  return {
    logPath: process.env.MCP_LOG_PATH || defaultLogPath,
    sessionTimeoutMinutes: parseInt(process.env.MCP_SESSION_TIMEOUT_MINUTES || '10'),
    enabled: process.env.MCP_LOGGING_ENABLED !== 'false',
    logLevel: (process.env.MCP_LOG_LEVEL as any) || 'info'
  };
}

export const DEFAULT_LOGGER_CONFIG = createLoggerConfig();