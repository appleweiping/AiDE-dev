import { webSearchDefinition } from './definitions-extra.js';
import type { ToolDefinition } from '@aide/shared';

const SEARCH_API_URL = 'https://html.duckduckgo.com/html/';

export const webSearchTool = {
  definition: webSearchDefinition,

  async execute(args: Record<string, unknown>): Promise<string> {
    const query = args.query as string;
    const maxResults = (args.maxResults as number) || 5;

    try {
      const params = new URLSearchParams({ q: query });
      const response = await fetch(`${SEARCH_API_URL}?${params}`, {
        headers: {
          'User-Agent': 'AiDE/0.1 (Desktop Coding Agent)',
        },
      });

      if (!response.ok) {
        return `Search failed: HTTP ${response.status}`;
      }

      const html = await response.text();
      const results = parseSearchResults(html, maxResults);

      if (results.length === 0) {
        return `No results found for: ${query}`;
      }

      return results
        .map((r, i) => `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.snippet}`)
        .join('\n\n');
    } catch (error) {
      return `Search error: ${(error as Error).message}`;
    }
  },
};

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

function parseSearchResults(html: string, max: number): SearchResult[] {
  const results: SearchResult[] = [];
  const resultRegex = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>[\s\S]*?<a[^>]*class="result__snippet"[^>]*>(.*?)<\/a>/g;

  let match: RegExpExecArray | null;
  while ((match = resultRegex.exec(html)) !== null && results.length < max) {
    results.push({
      url: decodeURIComponent(match[1].replace(/.*uddg=/, '').replace(/&.*/, '')),
      title: stripHtml(match[2]),
      snippet: stripHtml(match[3]),
    });
  }

  return results;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').trim();
}
