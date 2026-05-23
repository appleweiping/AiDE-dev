/**
 * desktop-control.ts — Desktop screenshot/click/type automation
 *
 * Uses @nut-tree-fork/nut-js for cross-platform desktop control.
 * Install: pnpm add @nut-tree-fork/nut-js
 *
 * Falls back gracefully if the library is not installed.
 */

import type { ToolDefinition } from '@aide/shared';
import type { ToolResult } from './registry.js';

async function getNut(): Promise<typeof import('@nut-tree-fork/nut-js') | null> {
  try {
    return await import('@nut-tree-fork/nut-js');
  } catch {
    return null;
  }
}

export function createScreenshotTool(): ToolDefinition & {
  execute: (args: Record<string, unknown>) => Promise<ToolResult>;
} {
  return {
    name: 'desktop_screenshot',
    description: 'Take a screenshot of the entire desktop or a specific region. Returns base64-encoded PNG.',
    parameters: {
      type: 'object',
      properties: {
        region: {
          type: 'object',
          description: 'Optional region to capture: { x, y, width, height }',
          properties: {
            x: { type: 'number' },
            y: { type: 'number' },
            width: { type: 'number' },
            height: { type: 'number' },
          },
        },
      },
      required: [],
    },
    async execute(args) {
      const nut = await getNut();
      if (!nut) {
        return {
          output: 'Desktop control requires @nut-tree-fork/nut-js. Run: pnpm add @nut-tree-fork/nut-js',
          isError: true,
        };
      }
      try {
        const { screen, Region } = nut;
        let img;
        if (args.region) {
          const r = args.region as { x: number; y: number; width: number; height: number };
          img = await screen.grabRegion(new Region(r.x, r.y, r.width, r.height));
        } else {
          img = await screen.grab();
        }
        const png = await img.toRGB();
        const b64 = Buffer.from(png).toString('base64');
        return { output: `data:image/png;base64,${b64}`, isError: false };
      } catch (err) {
        return { output: `Screenshot failed: ${err instanceof Error ? err.message : String(err)}`, isError: true };
      }
    },
  };
}

export function createMouseClickTool(): ToolDefinition & {
  execute: (args: Record<string, unknown>) => Promise<ToolResult>;
} {
  return {
    name: 'desktop_click',
    description: 'Move the mouse to a position and click.',
    parameters: {
      type: 'object',
      properties: {
        x: { type: 'number', description: 'X coordinate' },
        y: { type: 'number', description: 'Y coordinate' },
        button: { type: 'string', description: 'Mouse button: left (default), right, middle' },
        double: { type: 'boolean', description: 'Double-click if true' },
      },
      required: ['x', 'y'],
    },
    async execute(args) {
      const nut = await getNut();
      if (!nut) return { output: 'Desktop control requires @nut-tree-fork/nut-js.', isError: true };
      try {
        const { mouse, Point, Button } = nut;
        await mouse.move([new Point(args.x as number, args.y as number)]);
        const btn = args.button === 'right' ? Button.RIGHT
          : args.button === 'middle' ? Button.MIDDLE
          : Button.LEFT;
        if (args.double) {
          await mouse.doubleClick(btn);
        } else {
          await mouse.click(btn);
        }
        return { output: `Clicked at (${args.x}, ${args.y})`, isError: false };
      } catch (err) {
        return { output: `Click failed: ${err instanceof Error ? err.message : String(err)}`, isError: true };
      }
    },
  };
}

export function createKeyboardTypeTool(): ToolDefinition & {
  execute: (args: Record<string, unknown>) => Promise<ToolResult>;
} {
  return {
    name: 'desktop_type',
    description: 'Type text using the keyboard.',
    parameters: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Text to type' },
      },
      required: ['text'],
    },
    async execute(args) {
      const nut = await getNut();
      if (!nut) return { output: 'Desktop control requires @nut-tree-fork/nut-js.', isError: true };
      try {
        const { keyboard } = nut;
        await keyboard.type(args.text as string);
        return { output: `Typed: ${(args.text as string).slice(0, 50)}${(args.text as string).length > 50 ? '...' : ''}`, isError: false };
      } catch (err) {
        return { output: `Type failed: ${err instanceof Error ? err.message : String(err)}`, isError: true };
      }
    },
  };
}

export function createKeyPressTool(): ToolDefinition & {
  execute: (args: Record<string, unknown>) => Promise<ToolResult>;
} {
  return {
    name: 'desktop_key_press',
    description: 'Press a keyboard key or key combination (e.g. "Enter", "Ctrl+C", "Alt+Tab").',
    parameters: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'Key name or combination like "Enter", "Ctrl+C", "Escape"' },
      },
      required: ['key'],
    },
    async execute(args) {
      const nut = await getNut();
      if (!nut) return { output: 'Desktop control requires @nut-tree-fork/nut-js.', isError: true };
      try {
        const { keyboard, Key } = nut;
        const keyStr = args.key as string;
        const parts = keyStr.split('+').map((k) => k.trim());
        const keys = parts.map((k) => {
          const upper = k.toUpperCase();
          return (Key as Record<string, unknown>)[upper] ?? (Key as Record<string, unknown>)[k];
        }).filter(Boolean);
        if (keys.length === 0) return { output: `Unknown key: ${keyStr}`, isError: true };
        await keyboard.pressKey(...(keys as Parameters<typeof keyboard.pressKey>));
        await keyboard.releaseKey(...(keys as Parameters<typeof keyboard.releaseKey>));
        return { output: `Pressed: ${keyStr}`, isError: false };
      } catch (err) {
        return { output: `Key press failed: ${err instanceof Error ? err.message : String(err)}`, isError: true };
      }
    },
  };
}

export function createScrollTool(): ToolDefinition & {
  execute: (args: Record<string, unknown>) => Promise<ToolResult>;
} {
  return {
    name: 'desktop_scroll',
    description: 'Scroll the mouse wheel at the current position.',
    parameters: {
      type: 'object',
      properties: {
        direction: { type: 'string', description: 'Scroll direction: up or down' },
        amount: { type: 'number', description: 'Number of scroll steps (default 3)' },
      },
      required: ['direction'],
    },
    async execute(args) {
      const nut = await getNut();
      if (!nut) return { output: 'Desktop control requires @nut-tree-fork/nut-js.', isError: true };
      try {
        const { mouse } = nut;
        const amount = (args.amount as number) ?? 3;
        if (args.direction === 'up') {
          await mouse.scrollUp(amount);
        } else {
          await mouse.scrollDown(amount);
        }
        return { output: `Scrolled ${args.direction} by ${amount}`, isError: false };
      } catch (err) {
        return { output: `Scroll failed: ${err instanceof Error ? err.message : String(err)}`, isError: true };
      }
    },
  };
}

export const desktopToolNames = [
  'desktop_screenshot',
  'desktop_click',
  'desktop_type',
  'desktop_key_press',
  'desktop_scroll',
] as const;
