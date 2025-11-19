# Implementation Plan - Code Review Improvements

## Goal Description
Implement the improvements identified in the code review to enhance maintainability, type safety, and resource management of the `emst` project.

## User Review Required
> [!IMPORTANT]
> This plan involves refactoring core components. While no external API changes are planned, internal behavior (like User-Agent handling) will be standardized.

## Proposed Changes

### Infrastructure

#### [MODIFY] [constants.ts](file:///Users/rodin/Workspace/algovate/emst/src/infra/constants.ts)
- [x] Add `USER_AGENT` constant.
- [x] Add `BROWSER_CONFIG` constants for viewport and other settings.

#### [MODIFY] [types.ts](file:///Users/rodin/Workspace/algovate/emst/src/infra/types.ts)
- [x] Improve `RealtimeQuoteResponse` and `SSEQuoteData` interfaces to reduce `any` usage.
- [x] Add specific types for API response fields where possible.

### Core Logic

#### [MODIFY] [crawler.ts](file:///Users/rodin/Workspace/algovate/emst/src/core/crawler.ts)
- [x] Use centralized `USER_AGENT`.
- [x] Update `parseQuoteData` to use stricter types.
- [x] (Optional) Implement page reuse logic in `browserFetchUrl` if feasible without major restructuring.

#### [MODIFY] [browser-manager.ts](file:///Users/rodin/Workspace/algovate/emst/src/core/browser-manager.ts)
- [x] Use centralized `USER_AGENT` and `BROWSER_CONFIG`.

#### [MODIFY] [sse-client.ts](file:///Users/rodin/Workspace/algovate/emst/src/core/sse-client.ts)
- [x] Use centralized `USER_AGENT`.

#### [MODIFY] [sse-stream-manager.ts](file:///Users/rodin/Workspace/algovate/emst/src/core/sse-stream-manager.ts)
- [x] Refactor `mergeQuoteData` to use a data-driven approach (loop over field mappings) instead of repetitive `if` statements.
- [x] Update `getLatestData` return type.

## Verification Plan

### Automated Tests
- [x] Run existing tests to ensure no regression: `npm test`
- [x] Verify build: `npm run build`

### Manual Verification
- [x] Test CLI commands to ensure data fetching still works:
    - `emst stock fetch --symbol 688005`
    - `emst stock quote --symbol 688005`
    - `emst stock stream --symbol 688005` (verify SSE)
