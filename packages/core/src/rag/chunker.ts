/**
 * Smart code chunker that respects language boundaries.
 * Splits files into semantically meaningful chunks for indexing.
 */

export interface Chunk {
  content: string;
  filePath: string;
  startLine: number; // 1-based
  endLine: number;   // 1-based, inclusive
  language: string;
}

export interface ChunkOptions {
  /** Target chunk size in approximate tokens (1 token ≈ 4 chars). Default: 512 */
  chunkSize?: number;
  /** Overlap between consecutive chunks in approximate tokens. Default: 50 */
  overlap?: number;
}

// ---------------------------------------------------------------------------
// Language detection
// ---------------------------------------------------------------------------

const EXTENSION_LANGUAGE: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  py: 'python',
  rs: 'rust',
  go: 'go',
  java: 'java',
  kt: 'kotlin',
  cs: 'csharp',
  cpp: 'cpp',
  cc: 'cpp',
  cxx: 'cpp',
  c: 'c',
  h: 'c',
  hpp: 'cpp',
  rb: 'ruby',
  php: 'php',
  swift: 'swift',
  md: 'markdown',
  json: 'json',
  yaml: 'yaml',
  yml: 'yaml',
  toml: 'toml',
  sh: 'shell',
  bash: 'shell',
  zsh: 'shell',
  sql: 'sql',
  html: 'html',
  css: 'css',
  scss: 'scss',
  less: 'less',
};

export function detectLanguage(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
  return EXTENSION_LANGUAGE[ext] ?? 'text';
}

// ---------------------------------------------------------------------------
// Token estimation (1 token ≈ 4 chars, rough approximation)
// ---------------------------------------------------------------------------

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// ---------------------------------------------------------------------------
// Language-aware top-level boundary detection
// ---------------------------------------------------------------------------

/**
 * Returns line indices (0-based) that represent top-level block boundaries
 * for the given language. These are preferred split points.
 */
function findBlockBoundaries(lines: string[], language: string): Set<number> {
  const boundaries = new Set<number>();

  switch (language) {
    case 'typescript':
    case 'javascript': {
      // Top-level: function/class/const/export declarations, blank lines after blocks
      const topLevelRe = /^(?:export\s+)?(?:async\s+)?(?:function|class|const|let|var|interface|type|enum|abstract)\s/;
      const decoratorRe = /^@\w+/;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trimStart();
        if (topLevelRe.test(line) || decoratorRe.test(line)) {
          boundaries.add(i);
        }
      }
      break;
    }

    case 'python': {
      // Top-level: def/class at column 0
      const topLevelRe = /^(?:def|class|async\s+def)\s/;
      const decoratorRe = /^@\w+/;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (topLevelRe.test(line) || decoratorRe.test(line)) {
          boundaries.add(i);
        }
      }
      break;
    }

    case 'rust': {
      // fn, impl, struct, enum, trait, mod at column 0
      const topLevelRe = /^(?:pub\s+)?(?:async\s+)?(?:fn|impl|struct|enum|trait|mod|type|const|static)\s/;
      const attrRe = /^#\[/;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (topLevelRe.test(line) || attrRe.test(line)) {
          boundaries.add(i);
        }
      }
      break;
    }

    case 'go': {
      // func, type, var, const at column 0
      const topLevelRe = /^(?:func|type|var|const)\s/;
      for (let i = 0; i < lines.length; i++) {
        if (topLevelRe.test(lines[i])) {
          boundaries.add(i);
        }
      }
      break;
    }

    case 'java':
    case 'kotlin':
    case 'csharp': {
      // class, interface, enum, method-like patterns
      const topLevelRe = /^\s*(?:public|private|protected|static|abstract|final|override|sealed)?\s*(?:class|interface|enum|record|struct|void|int|String|bool|async)\s/;
      for (let i = 0; i < lines.length; i++) {
        if (topLevelRe.test(lines[i])) {
          boundaries.add(i);
        }
      }
      break;
    }

    default: {
      // For unknown languages: blank lines are boundaries
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim() === '') {
          boundaries.add(i);
        }
      }
    }
  }

  return boundaries;
}

// ---------------------------------------------------------------------------
// Core chunking logic
// ---------------------------------------------------------------------------

/**
 * Split file content into overlapping chunks, respecting code boundaries.
 */
export function chunkFile(
  content: string,
  filePath: string,
  options: ChunkOptions = {},
): Chunk[] {
  const chunkSize = options.chunkSize ?? 512;
  const overlap = options.overlap ?? 50;
  const language = detectLanguage(filePath);

  const lines = content.split('\n');
  if (lines.length === 0) return [];

  // For very small files, return as a single chunk
  if (estimateTokens(content) <= chunkSize) {
    return [
      {
        content,
        filePath,
        startLine: 1,
        endLine: lines.length,
        language,
      },
    ];
  }

  const boundaries = findBlockBoundaries(lines, language);
  const chunks: Chunk[] = [];

  let chunkStart = 0;
  let currentTokens = 0;

  for (let i = 0; i < lines.length; i++) {
    currentTokens += estimateTokens(lines[i]) + 1; // +1 for newline

    const isAtBoundary = boundaries.has(i + 1) || i === lines.length - 1;
    const isOverLimit = currentTokens >= chunkSize;

    if ((isOverLimit && isAtBoundary) || i === lines.length - 1) {
      // Emit chunk from chunkStart to i (inclusive)
      const chunkLines = lines.slice(chunkStart, i + 1);
      const chunkContent = chunkLines.join('\n');

      if (chunkContent.trim().length > 0) {
        chunks.push({
          content: chunkContent,
          filePath,
          startLine: chunkStart + 1,
          endLine: i + 1,
          language,
        });
      }

      // Compute overlap: back up by `overlap` tokens worth of lines
      if (i < lines.length - 1) {
        let overlapTokens = 0;
        let overlapStart = i;
        while (overlapStart > chunkStart && overlapTokens < overlap) {
          overlapTokens += estimateTokens(lines[overlapStart]) + 1;
          overlapStart--;
        }
        chunkStart = overlapStart + 1;
        currentTokens = overlapTokens;
      }
    } else if (isOverLimit) {
      // Over limit but not at a boundary — find the nearest preceding boundary
      let splitAt = i;
      for (let j = i; j > chunkStart; j--) {
        if (boundaries.has(j)) {
          splitAt = j - 1;
          break;
        }
      }

      const chunkLines = lines.slice(chunkStart, splitAt + 1);
      const chunkContent = chunkLines.join('\n');

      if (chunkContent.trim().length > 0) {
        chunks.push({
          content: chunkContent,
          filePath,
          startLine: chunkStart + 1,
          endLine: splitAt + 1,
          language,
        });
      }

      // Overlap
      let overlapTokens = 0;
      let overlapStart = splitAt;
      while (overlapStart > chunkStart && overlapTokens < overlap) {
        overlapTokens += estimateTokens(lines[overlapStart]) + 1;
        overlapStart--;
      }
      chunkStart = overlapStart + 1;
      currentTokens = overlapTokens + estimateTokens(lines[i]) + 1;
      // Re-process line i in the new chunk context
      // (already counted above, so just continue)
    }
  }

  // If no chunks were emitted (e.g. no boundaries found), fall back to line-based splitting
  if (chunks.length === 0) {
    return lineBasedChunk(lines, filePath, language, chunkSize, overlap);
  }

  return chunks;
}

/**
 * Simple line-based chunking fallback.
 */
function lineBasedChunk(
  lines: string[],
  filePath: string,
  language: string,
  chunkSize: number,
  overlap: number,
): Chunk[] {
  const chunks: Chunk[] = [];
  const overlapLines = Math.max(1, Math.floor(overlap / 4)); // rough lines per overlap
  const linesPerChunk = Math.max(10, Math.floor(chunkSize / 4));

  let start = 0;
  while (start < lines.length) {
    const end = Math.min(start + linesPerChunk, lines.length);
    const content = lines.slice(start, end).join('\n');
    if (content.trim().length > 0) {
      chunks.push({
        content,
        filePath,
        startLine: start + 1,
        endLine: end,
        language,
      });
    }
    start = end - overlapLines;
    if (start >= end) start = end; // prevent infinite loop
  }

  return chunks;
}
