/**
 * browser.ts — Browser automation tool via Playwright
 *
 * Wraps Playwright's chromium browser as agent tools.
 * Playwright must be installed: pnpm add -D playwright
 * Browser binaries: npx playwright install chromium
 */

import type { ToolDefinition } from '@aide/shared';
import type { ToolResult } from './registry.js';

// ---------------------------------------------------------------------------
// BrowserSession — manages a single Playwright browser instance
// ---------------------------------------------------------------------------

export class BrowserSession {
  private browser: unknown = null;
  private page: unknown = null;
  private available = false;

  async init(): Promise<boolean> {
    try {
      // Dynamic import so the tool degrades gracefully if playwright isn't installed
      const { chromium } = await import('playwright');
      this.browser = await (chromium as any).launch({ headless: true });
      this.page = await (this.browser as any).newPage();
      this.available = true;
      return true;
    } catch {
      return false;
    }
  }

  isAvailable(): boolean { return this.available; }

  async navigate(url: string): Promise<string> {
    await (this.page as any).goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    return await (this.page as any).title();
  }

  async getContent(): Promise<string> {
    return await (this.page as any).evaluate(() => document.body.innerText);
  }

  async getHtml(): Promise<string> {
    return await (this.page as any).content();
  }

  async click(selector: string): Promise<void> {
    await (this.page as any).click(selector, { timeout: 10_000 });
  }

  async fill(selector: string, value: string): Promise<void> {
    await (this.page as any).fill(selector, value);
  }

  async screenshot(): Promise<string> {
    const buf: Buffer = await (this.page as any).screenshot({ type: 'png' });
    return buf.toString('base64');
  }

  async evaluate(script: string): Promise<unknown> {
    return await (this.page as any).evaluate(script);
  }

  async close(): Promise<void> {
    if (this.browser) {
      await (this.browser as any).close();
      this.browser = null;
      this.page = null;
      this.available = false;
    }
  }
}

// ---------------------------------------------------------------------------
// Tool factories
// ---------------------------------------------------------------------------

export function createBrowserNavigateTool(session: BrowserSession): ToolDefinition & {
  execute: (args: Record<string, unknown>) => Promise<ToolResult>;
} {
  return {
    name: 'browser_navigate',
    description: 'Navigate the browser to a URL and return the page title.',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to navigate to' },
      },
      required: ['url'],
    },
    async execute(args) {
      if (!session.isAvailable()) {
        const ok = await session.init();
        if (!ok) return { output: 'Playwright is not installed. Run: pnpm add playwright && npx playwright install chromium', isError: true };
      }
      try {
        const title = await session.navigate(args.url as string);
        return { output: `Navigated to: ${args.url}\nPage title: ${title}`, isError: false };
      } catch (err) {
        return { output: `Navigation failed: ${err instanceof Error ? err.message : String(err)}`, isError: true };
      }
    },
  };
}

export function createBrowserGetContentTool(session: BrowserSession): ToolDefinition & {
  execute: (args: Record<string, unknown>) => Promise<ToolResult>;
} {
  return {
    name: 'browser_get_content',
    description: 'Get the visible text content of the current browser page.',
    parameters: { type: 'object', properties: {}, required: [] },
    async execute(_args) {
      if (!session.isAvailable()) return { output: 'Browser not initialized. Use browser_navigate first.', isError: true };
      try {
        const content = await session.getContent();
        return { output: content.slice(0, 50_000), isError: false };
      } catch (err) {
        return { output: `Failed to get content: ${err instanceof Error ? err.message : String(err)}`, isError: true };
      }
    },
  };
}

export function createBrowserClickTool(session: BrowserSession): ToolDefinition & {
  execute: (args: Record<string, unknown>) => Promise<ToolResult>;
} {
  return {
    name: 'browser_click',
    description: 'Click an element on the current page using a CSS selector.',
    parameters: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector of the element to click' },
      },
      required: ['selector'],
    },
    async execute(args) {
      if (!session.isAvailable()) return { output: 'Browser not initialized. Use browser_navigate first.', isError: true };
      try {
        await session.click(args.selector as string);
        return { output: `Clicked: ${args.selector}`, isError: false };
      } catch (err) {
        return { output: `Click failed: ${err instanceof Error ? err.message : String(err)}`, isError: true };
      }
    },
  };
}

export function createBrowserFillTool(session: BrowserSession): ToolDefinition & {
  execute: (args: Record<string, unknown>) => Promise<ToolResult>;
} {
  return {
    name: 'browser_fill',
    description: 'Fill an input field on the current page.',
    parameters: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector of the input field' },
        value: { type: 'string', description: 'Value to fill in' },
      },
      required: ['selector', 'value'],
    },
    async execute(args) {
      if (!session.isAvailable()) return { output: 'Browser not initialized. Use browser_navigate first.', isError: true };
      try {
        await session.fill(args.selector as string, args.value as string);
        return { output: `Filled "${args.selector}" with value.`, isError: false };
      } catch (err) {
        return { output: `Fill failed: ${err instanceof Error ? err.message : String(err)}`, isError: true };
      }
    },
  };
}

export function createBrowserScreenshotTool(session: BrowserSession): ToolDefinition & {
  execute: (args: Record<string, unknown>) => Promise<ToolResult>;
} {
  return {
    name: 'browser_screenshot',
    description: 'Take a screenshot of the current browser page. Returns base64-encoded PNG.',
    parameters: { type: 'object', properties: {}, required: [] },
    async execute(_args) {
      if (!session.isAvailable()) return { output: 'Browser not initialized. Use browser_navigate first.', isError: true };
      try {
        const b64 = await session.screenshot();
        return { output: `data:image/png;base64,${b64}`, isError: false };
      } catch (err) {
        return { output: `Screenshot failed: ${err instanceof Error ? err.message : String(err)}`, isError: true };
      }
    },
  };
}

export function createBrowserEvaluateTool(session: BrowserSession): ToolDefinition & {
  execute: (args: Record<string, unknown>) => Promise<ToolResult>;
} {
  return {
    name: 'browser_evaluate',
    description: 'Execute JavaScript in the browser page context and return the result.',
    parameters: {
      type: 'object',
      properties: {
        script: { type: 'string', description: 'JavaScript expression to evaluate' },
      },
      required: ['script'],
    },
    async execute(args) {
      if (!session.isAvailable()) return { output: 'Browser not initialized. Use browser_navigate first.', isError: true };
      try {
        const result = await session.evaluate(args.script as string);
        return { output: JSON.stringify(result, null, 2), isError: false };
      } catch (err) {
        return { output: `Evaluation failed: ${err instanceof Error ? err.message : String(err)}`, isError: true };
      }
    },
  };
}

export const browserToolNames = [
  'browser_navigate',
  'browser_get_content',
  'browser_click',
  'browser_fill',
  'browser_screenshot',
  'browser_evaluate',
] as const;
