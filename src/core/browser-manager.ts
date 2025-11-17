import puppeteer, { Browser, Page } from 'puppeteer';
import { addExtra } from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

/**
 * Singleton browser manager for Puppeteer
 * Handles browser lifecycle and provides pages for scraping
 */
class BrowserManager {
  private static instance: BrowserManager | null = null;
  private browser: Browser | null = null;
  private isInitializing: boolean = false;
  private initPromise: Promise<Browser> | null = null;

  private constructor() {}

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

        console.log('Launching browser with stealth plugin...');
        
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
            '--window-size=1920,1080',
          ],
        });

        console.log('Browser launched successfully');

        // Handle browser disconnect
        this.browser.on('disconnected', () => {
          console.log('Browser disconnected');
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
    await page.setViewport({
      width: 1920,
      height: 1080,
    });

    // Set realistic user agent (macOS Chrome)
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36'
    );

    // Set extra HTTP headers
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
    });

    return page;
  }

  /**
   * Close the browser and clean up
   */
  public async close(): Promise<void> {
    if (this.browser) {
      console.log('Closing browser...');
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
    console.log('Process exiting, cleaning up browser...');
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

