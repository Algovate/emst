import { getConfig } from './config.js';
import { createWriteStream, WriteStream } from 'fs';
import { join } from 'path';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

class Logger {
  private level: LogLevel;
  private consoleEnabled: boolean;
  private quiet: boolean = false;
  private fileStream: WriteStream | null = null;

  constructor() {
    const config = getConfig();
    this.level = config.logging?.level || 'info';
    this.consoleEnabled = config.logging?.console !== false;
    
    if (config.logging?.file) {
      try {
        this.fileStream = createWriteStream(config.logging.file, { flags: 'a' });
      } catch (error) {
        // If file logging fails, continue with console only
        console.error('Failed to initialize file logging:', error);
      }
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.level];
  }

  private formatMessage(level: LogLevel, message: string, ...args: any[]): string {
    const timestamp = new Date().toISOString();
    const formattedArgs = args.length > 0 ? ' ' + args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(' ') : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${formattedArgs}`;
  }

  private write(level: LogLevel, message: string, ...args: any[]): void {
    // Error messages are always shown, even in quiet mode
    if (this.quiet && level !== 'error') {
      return;
    }

    if (!this.shouldLog(level)) {
      return;
    }

    const formatted = this.formatMessage(level, message, ...args);

    if (this.consoleEnabled) {
      // All logs go to stderr to separate from data output (stdout)
      switch (level) {
        case 'debug':
          console.error(formatted);
          break;
        case 'info':
          console.error(formatted);
          break;
        case 'warn':
          console.error(formatted);
          break;
        case 'error':
          console.error(formatted);
          break;
      }
    }

    if (this.fileStream) {
      this.fileStream.write(formatted + '\n');
    }
  }

  debug(message: string, ...args: any[]): void {
    this.write('debug', message, ...args);
  }

  info(message: string, ...args: any[]): void {
    this.write('info', message, ...args);
  }

  warn(message: string, ...args: any[]): void {
    this.write('warn', message, ...args);
  }

  error(message: string, ...args: any[]): void {
    this.write('error', message, ...args);
  }

  /**
   * Set log level dynamically
   */
  setLevel(level: LogLevel): void {
    this.level = level;
  }

  /**
   * Set console output enabled/disabled
   */
  setConsoleEnabled(enabled: boolean): void {
    this.consoleEnabled = enabled;
  }

  /**
   * Set quiet mode (disable all output except errors)
   */
  setQuiet(quiet: boolean): void {
    this.quiet = quiet;
  }

  close(): void {
    if (this.fileStream) {
      this.fileStream.end();
      this.fileStream = null;
    }
  }
}

// Singleton instance
let loggerInstance: Logger | null = null;

export function getLogger(): Logger {
  if (!loggerInstance) {
    loggerInstance = new Logger();
  }
  return loggerInstance;
}

// Convenience functions for direct use
export const logger = {
  debug: (message: string, ...args: any[]) => getLogger().debug(message, ...args),
  info: (message: string, ...args: any[]) => getLogger().info(message, ...args),
  warn: (message: string, ...args: any[]) => getLogger().warn(message, ...args),
  error: (message: string, ...args: any[]) => getLogger().error(message, ...args),
  setLevel: (level: LogLevel) => getLogger().setLevel(level),
  setConsoleEnabled: (enabled: boolean) => getLogger().setConsoleEnabled(enabled),
  setQuiet: (quiet: boolean) => getLogger().setQuiet(quiet),
  close: () => {
    if (loggerInstance) {
      loggerInstance.close();
      loggerInstance = null;
    }
  },
};

