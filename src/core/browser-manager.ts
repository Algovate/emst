import puppeteer, { Browser, Page } from 'puppeteer';
import { addExtra } from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { logger } from '../infra/logger.js';
import { USER_AGENT, BROWSER_CONFIG } from '../infra/constants.js';

/**
 * Singleton browser manager for Puppeteer
 * Handles browser lifecycle and provides pages for scraping
 */
class BrowserManager {
  private static instance: BrowserManager | null = null;
  private browser: Browser | null = null;
  private isInitializing: boolean = false;
  private initPromise: Promise<Browser> | null = null;

  private constructor() { }

  /**
   * Get the singleton instance
   */
  public static getInstance(): BrowserManager {
    if (!BrowserManager.instance) {
      BrowserManager.instance = new BrowserManager();
    }
    return BrowserManager.instance;
  }

  /**
   * Initialize the browser with stealth plugin
   */
  private async initBrowser(): Promise<Browser> {
    if (this.browser && this.browser.connected) {
      return this.browser;
    }

    if (this.isInitializing && this.initPromise) {
      return this.initPromise;
    }

    this.isInitializing = true;
    this.initPromise = (async () => {
      try {
        // Add stealth plugin to puppeteer
        const puppeteerExtra = addExtra(puppeteer);
        puppeteerExtra.use(StealthPlugin());

        logger.info('Launching browser with stealth plugin...');

        this.browser = await puppeteerExtra.launch({
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
            // Set a realistic window size
            `--window-size=${BROWSER_CONFIG.VIEWPORT.width},${BROWSER_CONFIG.VIEWPORT.height}`,
          ],
        });

        logger.info('Browser launched successfully');

        // Handle browser disconnect
        this.browser.on('disconnected', () => {
          logger.info('Browser disconnected');
          this.browser = null;
          this.isInitializing = false;
          this.initPromise = null;
        });

        return this.browser;
      } catch (error) {
        this.isInitializing = false;
        this.initPromise = null;
        throw error;
      }
    })();

    return this.initPromise;
  }

  /**
   * Get a browser instance (creates one if needed)
   */
  public async getBrowser(): Promise<Browser> {
    return this.initBrowser();
  }

  /**
   * Create a new page with optimal settings
   */
  public async newPage(): Promise<Page> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();

    // Set viewport to realistic size
    await page.setViewport(BROWSER_CONFIG.VIEWPORT);

    // Set realistic user agent (macOS Chrome)
    await page.setUserAgent(USER_AGENT);

    // Set extra HTTP headers
    await page.setExtraHTTPHeaders({
      'Accept-Language': BROWSER_CONFIG.LOCALE,
    });

    return page;
  }

  /**
   * Close the browser and clean up
   */
  public async close(): Promise<void> {
    if (this.browser) {
      logger.info('Closing browser...');
      await this.browser.close();
      this.browser = null;
      this.isInitializing = false;
      this.initPromise = null;
    }
  }

  /**
   * Check if browser is running
   */
  public isRunning(): boolean {
    return this.browser !== null && this.browser.connected;
  }
}

// Handle process exit
process.on('exit', () => {
  const manager = BrowserManager.getInstance();
  if (manager.isRunning()) {
    logger.info('Process exiting, cleaning up browser...');
  }
});

process.on('SIGINT', async () => {
  const manager = BrowserManager.getInstance();
  await manager.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  const manager = BrowserManager.getInstance();
  await manager.close();
  process.exit(0);
});

export default BrowserManager;

