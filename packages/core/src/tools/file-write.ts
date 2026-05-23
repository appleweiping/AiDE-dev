import { writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { RegisteredTool, ToolResult } from './registry.js';
import { validateWritePath, resolvePath } from './path-guard.js';

const DEFINITION = {
  name: 'file_write',
  description:
    'Create or overwrite a file with the given content. ' +
    'Parent directories are created automatically. ' +
    'Use this for new files or complete rewrites; prefer file_edit for targeted changes.',
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Absolute or relative path to the file to write.',
      },
      content: {
        type: 'string',
        description: 'Full content to write to the file.',
      },
    },
    required: ['path', 'content'],
  },
};

async function handler(args: Record<string, unknown>): Promise<ToolResult> {
  const filePath = String(args.path ?? '');
  if (!filePath) {
    return { output: 'Error: path is required', isError: true };
  }

  const content = typeof args.content === 'string' ? args.content : String(args.content ?? '');

  const pathError = validateWritePath(filePath);
  if (pathError) return { output: pathError, isError: true };

  const absPath = resolvePath(filePath);

  try {
    await mkdir(dirname(absPath), { recursive: true });
    await writeFile(absPath, content, 'utf-8');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { output: `Error writing file: ${message}`, isError: true };
  }

  const lineCount = content.split('\n').length;
  return {
    output: `Written ${content.length} bytes (${lineCount} lines) to ${absPath}`,
    isError: false,
  };
}

export const fileWriteTool: RegisteredTool = {
  definition: DEFINITION,
  handler,
};
