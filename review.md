# Code Review: emst

## Overview

The `emst` project is a TypeScript-based crawler and library for fetching stock data from East Money. It supports both direct HTTP requests (Axios) and browser-based scraping (Puppeteer) to bypass anti-scraping measures. It also features real-time data streaming via Server-Sent Events (SSE).

## Key Findings

### Strengths

1.  **Robust Fallback Mechanism**: The `EastMoneyCrawler` class intelligently switches from Axios to Puppeteer when it detects TLS fingerprinting or other blocking mechanisms.
2.  **Real-time Data Support**: The SSE implementation (`SSEClient`, `SSEStreamManager`) is well-designed, handling reconnections, heartbeats, and partial data updates.
3.  **Stealth Techniques**: The `BrowserManager` uses `puppeteer-extra-plugin-stealth` and realistic User-Agent/viewport settings to minimize detection.
4.  **Modular Architecture**: The code is well-organized into core logic, infrastructure, and CLI components.

### Areas for Improvement

#### 1. Centralized User-Agent Management
**Issue**: The User-Agent string is hardcoded in multiple places:
- `src/core/crawler.ts` (line 54)
- `src/core/browser-manager.ts` (line 107)
- `src/core/sse-client.ts` (via `SSE_CONSTANTS`)

**Recommendation**: Define the User-Agent in a single constant file (e.g., `src/infra/constants.ts`) and reference it everywhere. Consider implementing a User-Agent rotator for better stealth.

#### 2. Cookie Initialization Strategy
**Issue**: `crawler.ts` manually constructs tracking cookies (`st_si`, `st_pvi`, etc.) using random number generation.
**Risk**: This approach mimics current behavior but is fragile. If East Money changes their tracking logic, this will break.
**Recommendation**: Rely more on the browser to generate valid cookies initially, or document the reverse-engineered logic clearly. The current fallback to browser mode mitigates this risk but is heavier.

#### 3. Type Safety
**Issue**: There are several instances of `any` usage, particularly in data parsing and event handling.
- `src/core/crawler.ts`: `parseQuoteData` takes `any`.
- `src/core/sse-stream-manager.ts`: `getLatestData` returns `any`.

**Recommendation**: Define stricter interfaces for API responses and internal data structures to improve type safety and developer experience.

#### 4. Resource Management
**Issue**: `browserFetchUrl` in `crawler.ts` creates a new browser page for every single request.
**Impact**: This adds significant overhead (CPU/RAM) and latency.
**Recommendation**: Reuse pages where possible, similar to how `browserFetchKlineDataBatch` works. Implement a page pool or reuse a single page for sequential requests.

#### 5. Code Duplication in `mergeQuoteData`
**Issue**: `src/core/sse-stream-manager.ts` contains a very long `mergeQuoteData` function with repetitive `if (hasField(...))` blocks.
**Recommendation**: Refactor this using a mapping configuration or a loop over a field definition object to reduce boilerplate and improve maintainability.

## specific File Comments

### `src/core/crawler.ts`
- **Lines 445-495**: The error handling logic for switching to browser mode is good but could be extracted into a separate method to keep the main `fetchKlineDataWithMarket` method cleaner.
- **Line 52**: `proxy: false` is set to avoid warnings. Ensure this doesn't prevent legitimate proxy usage if the user configures one.

### `src/core/browser-manager.ts`
- **Singleton Pattern**: Correctly implemented.
- **Lifecycle Management**: Good handling of process exit signals.

### `src/core/sse-client.ts`
- **Reconnection Logic**: Exponential backoff is correctly implemented.
- **Error Handling**: `onmessage` catches errors but swallows them (logs only). Consider if some parsing errors should be fatal or reported up.

## Conclusion

The codebase is solid and functional. The recommended improvements focus on maintainability, performance, and robustness against future API changes.
