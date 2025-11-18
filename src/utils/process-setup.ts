/**
 * Process-level setup and initialization utilities
 */

/**
 * Suppress known deprecation warnings from dependencies
 * 
 * This suppresses warnings that come from third-party dependencies
 * that we cannot directly fix without updating those dependencies.
 * 
 * Currently suppresses:
 * - DEP0169: url.parse() deprecation from axios-cookiejar-support/tough-cookie
 */
export function suppressKnownDeprecationWarnings(): void {
  // Intercept process.emitWarning to filter out specific deprecation warnings
  const originalEmitWarning = process.emitWarning;
  process.emitWarning = (warning: string | Error, type?: string, code?: string, ...args: any[]) => {
    if (shouldSuppressWarning(warning, code)) {
      return; // Suppress this warning
    }
    // Forward all other warnings
    return originalEmitWarning.call(process, warning, type, code, ...args);
  };

  // Also handle warning events as a fallback
  process.on('warning', (warning) => {
    if (shouldSuppressWarning(warning, warning.code)) {
      return; // Suppress this warning
    }
    // Other warnings will be handled by the default behavior
  });
}

/**
 * Check if a warning should be suppressed
 */
function shouldSuppressWarning(warning: string | Error, code?: string): boolean {
  // Suppress DEP0169 (url.parse() deprecation)
  if (code === 'DEP0169') {
    return true;
  }

  // Check warning message for url.parse() references
  const message = typeof warning === 'string' 
    ? warning 
    : warning instanceof Error 
      ? warning.message 
      : '';

  if (message.includes('url.parse()')) {
    return true;
  }

  return false;
}

