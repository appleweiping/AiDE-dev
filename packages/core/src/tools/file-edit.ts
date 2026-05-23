import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { RegisteredTool, ToolResult } from './registry.js';

const DEFINITION = {
  name: 'file_edit',
  description:
    'Perform an exact string replacement in a file. ' +
    'The old_string must match exactly (including whitespace and indentation). ' +
    'If replace_all is true, all occurrences are replaced; otherwise only the first. ' +
    'The edit fails if old_string is not found in the file.',
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Absolute or relative path to the file to edit.',
      },
      old_string: {
        type: 'string',
        description: 'The exact text to find and replace.',
      },
      new_string: {
        type: 'string',
        description: 'The replacement text.',
      },
      replace_all: {
        type: 'boolean',
        description: 'If true, replace all occurrences. Defaults to false (replace first only).',
      },
    },
    required: ['path', 'old_string', 'new_string'],
  },
};

async function handler(args: Record<string, unknown>): Promise<ToolResult> {
  const filePath = String(args.path ?? '');
  if (!filePath) {
    return { output: 'Error: path is required', isError: true };
  }

  const oldString = typeof args.old_string === 'string' ? args.old_string : String(args.old_string ?? '');
  const newString = typeof args.new_string === 'string' ? args.new_string : String(args.new_string ?? '');
  const replaceAll = Boolean(args.replace_all);

  const absPath = resolve(filePath);

  let content: string;
  try {
    content = await readFile(absPath, 'utf-8');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { output: `Error reading file: ${message}`, isError: true };
  }

  if (!content.includes(oldString)) {
    // Provide a helpful diff-style hint
    const preview = oldString.slice(0, 120).replace(/\n/g, '\\n');
    return {
      output: `Error: old_string not found in ${absPath}.\nSearched for: "${preview}"`,
      isError: true,
    };
  }

  // Count occurrences
  let occurrences = 0;
  let idx = 0;
  while ((idx = content.indexOf(oldString, idx)) !== -1) {
    occurrences++;
    idx += oldString.length;
  }

  if (occurrences > 1 && !replaceAll) {
    return {
      output:
        `Error: old_string appears ${occurrences} times in ${absPath}. ` +
        `Provide more surrounding context to make it unique, or set replace_all=true.`,
      isError: true,
    };
  }

  let newContent: string;
  if (replaceAll) {
    newContent = content.split(oldString).join(newString);
  } else {
    const pos = content.indexOf(oldString);
    newContent = content.slice(0, pos) + newString + content.slice(pos + oldString.length);
  }

  try {
    await writeFile(absPath, newContent, 'utf-8');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { output: `Error writing file: ${message}`, isError: true };
  }

  const replaced = replaceAll ? occurrences : 1;
  return {
    output: `Replaced ${replaced} occurrence(s) in ${absPath}`,
    isError: false,
  };
}

export const fileEditTool: RegisteredTool = {
  definition: DEFINITION,
  handler,
};
