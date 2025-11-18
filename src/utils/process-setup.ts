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
  // Use type assertion to handle the complex overloaded signature
  process.emitWarning = ((warning: string | Error, ...args: any[]) => {
    // Extract code from different call signatures
    let warningCode: string | undefined;
    
    // Check if second argument is an options object
    if (args.length > 0 && args[0] && typeof args[0] === 'object' && 'code' in args[0]) {
      warningCode = args[0].code;
    } else if (args.length > 1 && typeof args[1] === 'string') {
      // Second argument is code (when first is type string)
      warningCode = args[1];
    }

    if (shouldSuppressWarning(warning, warningCode)) {
      return; // Suppress this warning
    }
    // Forward all other warnings using original function
    return (originalEmitWarning as any).apply(process, [warning, ...args]);
  }) as typeof process.emitWarning;

  // Also handle warning events as a fallback
  process.on('warning', (warning: Error & { code?: string }) => {
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

