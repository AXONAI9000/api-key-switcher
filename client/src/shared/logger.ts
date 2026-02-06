/**
 * 日志系统
 * 支持日志级别过滤和敏感信息脱敏
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  SILENT = 4,
}

let globalLogLevel: LogLevel = LogLevel.INFO;

export function setGlobalLogLevel(level: LogLevel): void {
  globalLogLevel = level;
}

export function getGlobalLogLevel(): LogLevel {
  return globalLogLevel;
}

/**
 * 敏感信息匹配模式
 * 每个模式包含一个正则表达式和对应的替换字符串
 */
const SENSITIVE_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  // sk-ant-* API keys (Anthropic)
  {
    pattern: /sk-ant-[A-Za-z0-9_-]+/g,
    replacement: 'sk-ant-***',
  },
  // sk-* API keys (OpenAI, 20+ chars)
  {
    pattern: /sk-[A-Za-z0-9_-]{20,}/g,
    replacement: 'sk-***',
  },
  // AIza* Google API keys
  {
    pattern: /AIza[A-Za-z0-9_-]+/g,
    replacement: 'AIza***',
  },
  // Bearer tokens
  {
    pattern: /Bearer\s+[A-Za-z0-9._-]+/g,
    replacement: 'Bearer ***',
  },
  // JSON password/secret/token/apiKey/api_key fields
  {
    pattern: /"(password|secret|token|apiKey|api_key)"\s*:\s*"[^"]*"/g,
    replacement: '"$1":"***"',
  },
];

export class Logger {
  private context: string;

  constructor(context: string) {
    this.context = context;
  }

  /**
   * 对敏感信息进行脱敏处理
   */
  static sanitize(input: string): string {
    let result = input;
    for (const { pattern, replacement } of SENSITIVE_PATTERNS) {
      // 重置 lastIndex，因为使用了全局标志 g
      pattern.lastIndex = 0;
      result = result.replace(pattern, replacement);
    }
    return result;
  }

  debug(message: string, meta?: unknown): void {
    if (globalLogLevel > LogLevel.DEBUG) return;
    const prefix = this.formatPrefix('DEBUG');
    console.debug(prefix, meta !== undefined ? meta : '');
  }

  info(message: string, meta?: unknown): void {
    if (globalLogLevel > LogLevel.INFO) return;
    const prefix = this.formatPrefix('INFO');
    console.info(prefix, meta !== undefined ? meta : '');
  }

  warn(message: string, meta?: unknown): void {
    if (globalLogLevel > LogLevel.WARN) return;
    const prefix = this.formatPrefix('WARN');
    console.warn(prefix, meta !== undefined ? meta : '');
  }

  error(message: string, error?: unknown): void {
    if (globalLogLevel > LogLevel.ERROR) return;
    const sanitizedMessage = Logger.sanitize(message);
    const prefix = this.formatPrefix('ERROR');
    let errorInfo: string = '';
    if (error instanceof Error) {
      errorInfo = `${error.message}\n${error.stack || ''}`;
    } else if (error !== undefined) {
      errorInfo = String(error);
    }
    console.error(prefix, errorInfo ? `${sanitizedMessage} | ${errorInfo}` : sanitizedMessage);
  }

  private formatPrefix(level: string): string {
    const timestamp = new Date().toISOString();
    return `${timestamp} [${level}] [${this.context}]`;
  }
}
