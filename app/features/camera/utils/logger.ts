import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  context: string;
  level: LogLevel;
  message: string;
  data?: any;
  stackTrace?: string;
}

class Logger {
  private static instance: Logger;
  private context: string = 'Camera';
  private logFilePath: string;
  private isInitialized: boolean = false;
  private logQueue: LogEntry[] = [];
  private isWriting: boolean = false;

  private constructor() {
    // Create a new log file for each session with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.logFilePath = `${FileSystem.documentDirectory}camera_logs_${timestamp}.log`;
    this.initializeLogger();
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private async initializeLogger() {
    try {
      // Ensure the logs directory exists
      const dirInfo = await FileSystem.getInfoAsync(FileSystem.documentDirectory!);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(FileSystem.documentDirectory!, { intermediates: true });
      }

      // Create the log file
      await FileSystem.writeAsStringAsync(this.logFilePath, '', { encoding: 'utf8' });
      this.isInitialized = true;
      
      // Process any queued logs
      this.processQueue();
    } catch (error) {
      console.error('Failed to initialize logger:', error);
    }
  }

  private async processQueue() {
    if (this.isWriting || !this.isInitialized || this.logQueue.length === 0) return;

    this.isWriting = true;
    try {
      const entries = this.logQueue.splice(0);
      const logString = entries.map(entry => JSON.stringify(entry)).join('\n') + '\n';
      
      // Read existing content and append new logs
      let existingContent = '';
      try {
        const fileInfo = await FileSystem.getInfoAsync(this.logFilePath);
        if (fileInfo.exists) {
          existingContent = await FileSystem.readAsStringAsync(this.logFilePath, { encoding: 'utf8' });
        }
      } catch (error) {
        console.warn('Failed to read existing logs, creating new file');
      }

      // Write combined content
      await FileSystem.writeAsStringAsync(
        this.logFilePath, 
        existingContent + logString,
        { encoding: 'utf8' }
      );
    } catch (error) {
      console.error('Failed to write to log file:', error);
    } finally {
      this.isWriting = false;
      if (this.logQueue.length > 0) {
        this.processQueue();
      }
    }
  }

  private createLogEntry(level: LogLevel, message: string, data?: any): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      context: this.context,
      level,
      message,
      data: data ? this.sanitizeData(data) : undefined,
    };

    if (level === 'error') {
      entry.stackTrace = new Error().stack;
    }

    return entry;
  }

  private sanitizeData(data: any): any {
    try {
      // Remove sensitive data, circular references, etc.
      return JSON.parse(JSON.stringify(data, (key, value) => {
        if (key.toLowerCase().includes('password') || 
            key.toLowerCase().includes('token') || 
            key.toLowerCase().includes('secret')) {
          return '[REDACTED]';
        }
        return value;
      }));
    } catch {
      return '[Unable to serialize data]';
    }
  }

  private async writeToFile(entry: LogEntry) {
    this.logQueue.push(entry);
    this.processQueue();
  }

  private getConsoleMessage(entry: LogEntry): string {
    // Simplified console output
    const prefix = entry.level === 'error' ? '❌ ' : entry.level === 'warn' ? '⚠️ ' : '';
    return `[${entry.context}] ${prefix}${entry.message}`;
  }

  public setContext(context: string): void {
    this.context = context;
  }

  public async getLogFilePath(): Promise<string | null> {
    try {
      const fileInfo = await FileSystem.getInfoAsync(this.logFilePath);
      return fileInfo.exists ? this.logFilePath : null;
    } catch {
      return null;
    }
  }

  public async clearLogs(): Promise<void> {
    try {
      await FileSystem.deleteAsync(this.logFilePath);
      await this.initializeLogger();
    } catch (error) {
      console.error('Failed to clear logs:', error);
    }
  }

  public debug(message: string, data?: any): void {
    if (__DEV__) {
      const entry = this.createLogEntry('debug', message, data);
      console.debug(this.getConsoleMessage(entry));
      this.writeToFile(entry);
    }
  }

  public info(message: string, data?: any): void {
    const entry = this.createLogEntry('info', message, data);
    console.info(this.getConsoleMessage(entry));
    this.writeToFile(entry);
  }

  public warn(message: string, data?: any): void {
    const entry = this.createLogEntry('warn', message, data);
    console.warn(this.getConsoleMessage(entry));
    this.writeToFile(entry);
  }

  public error(message: string, error?: Error | any): void {
    const entry = this.createLogEntry('error', message, {
      error: error instanceof Error ? {
        message: error.message,
        name: error.name,
        stack: error.stack,
      } : error
    });
    console.error(this.getConsoleMessage(entry));
    this.writeToFile(entry);
  }

  public async getLogs(options: { 
    level?: LogLevel, 
    context?: string, 
    search?: string,
    limit?: number 
  } = {}): Promise<LogEntry[]> {
    try {
      const fileContent = await FileSystem.readAsStringAsync(this.logFilePath);
      let logs = fileContent
        .split('\n')
        .filter(line => line.trim())
        .map(line => JSON.parse(line) as LogEntry);

      // Apply filters
      if (options.level) {
        logs = logs.filter(log => log.level === options.level);
      }
      if (options.context) {
        logs = logs.filter(log => log.context === options.context);
      }
      if (options.search) {
        const searchLower = options.search.toLowerCase();
        logs = logs.filter(log => 
          log.message.toLowerCase().includes(searchLower) ||
          JSON.stringify(log.data).toLowerCase().includes(searchLower)
        );
      }
      if (options.limit) {
        logs = logs.slice(-options.limit);
      }

      return logs;
    } catch (error) {
      console.error('Failed to read logs:', error);
      return [];
    }
  }
}

export const logger = Logger.getInstance();

// Helper function to view logs in development
if (__DEV__) {
  (global as any).viewCameraLogs = async (options = {}) => {
    const logs = await logger.getLogs(options);
    console.log('Camera Logs:', logs);
    return logs;
  };
} 