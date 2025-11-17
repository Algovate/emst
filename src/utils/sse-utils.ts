import { Page } from 'puppeteer';
import BrowserManager from '../core/browser-manager.js';
import { Market } from '../infra/types.js';
import { logger } from '../infra/logger.js';
import { SSE_CONSTANTS } from '../infra/sse-constants.js';

/**
 * Get UT token from East Money page
 * The token is typically found in the page's JavaScript code or network requests
 */
export async function getUtToken(code: string, market: Market): Promise<string> {
  const browserManager = BrowserManager.getInstance();
  const browser = await browserManager.getBrowser();
  const page = await browser.newPage();

  try {
    // Build referer URL
    let refererUrl: string;
    if (market === Market.Shanghai && code.startsWith('688')) {
      refererUrl = `https://quote.eastmoney.com/kcb/${code}.html`;
    } else if (market === Market.Shenzhen) {
      refererUrl = `https://quote.eastmoney.com/sz${code}.html`;
    } else {
      refererUrl = `https://quote.eastmoney.com/sh${code}.html`;
    }

    logger.debug(`Fetching UT token from ${refererUrl}`);

    await page.goto(refererUrl, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });

      // Try to extract UT token from page
      // The token is often in window variables or can be extracted from network requests
      const utToken = await page.evaluate(() => {
        // @ts-ignore - window and document are available in browser context
        const win = window as any;
        
        // Check common token locations
        if (win.ut) return win.ut;
        if (win._ut) return win._ut;
        if (win.token) return win.token;
        
        // Try to extract from script tags
        // @ts-ignore - document is available in browser context
        const scripts = Array.from(document.querySelectorAll('script'));
        for (const script of scripts) {
          const content = (script as any).textContent || '';
          // Look for ut= pattern in script content
          const match = content.match(/ut[=:]['"]([^'"]+)['"]/i);
          if (match && match[1]) {
            return match[1];
          }
          // Look for ut: pattern
          const match2 = content.match(/['"]ut['"]\s*:\s*['"]([^'"]+)['"]/i);
          if (match2 && match2[1]) {
            return match2[1];
          }
        }
        
        // Default token (commonly used)
        return SSE_CONSTANTS.DEFAULT_UT_TOKEN;
      });

    if (utToken && utToken.length > 10) {
      logger.debug(`UT token extracted: ${utToken.substring(0, 10)}...`);
      return utToken;
    }

    // Fallback to default token
    logger.warn('Could not extract UT token from page, using default');
    return SSE_CONSTANTS.DEFAULT_UT_TOKEN;
  } catch (error) {
    logger.warn('Failed to fetch UT token from page, using default:', error instanceof Error ? error.message : String(error));
    // Return default token as fallback
    return SSE_CONSTANTS.DEFAULT_UT_TOKEN;
  } finally {
    await page.close();
  }
}

/**
 * Get a random server number for load balancing
 */
export function getRandomServer(): number {
  // Common server numbers observed: 13, 16, 23, 53, 57, 60, 93
  const servers = [13, 16, 23, 53, 57, 60, 93];
  return servers[Math.floor(Math.random() * servers.length)];
}

/**
 * Generate cname hash for news SSE connection
 */
export function generateCnameHash(): string {
  // Generate a random hex string (32 chars)
  return Array.from({ length: 32 }, () => 
    Math.floor(Math.random() * 16).toString(16)
  ).join('');
}

