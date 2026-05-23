import { webFetchDefinition } from './definitions-extra.js';

export const webFetchTool = {
  definition: webFetchDefinition,

  async execute(args: Record<string, unknown>): Promise<string> {
    const url = args.url as string;
    const maxLength = (args.maxLength as number) || 50000;

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'AiDE/0.1 (Desktop Coding Agent)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        return `Fetch failed: HTTP ${response.status} ${response.statusText}`;
      }

      const contentType = response.headers.get('content-type') || '';
      const text = await response.text();

      let content: string;
      if (contentType.includes('text/html') || contentType.includes('application/xhtml')) {
        content = htmlToText(text);
      } else {
        content = text;
      }

      if (content.length > maxLength) {
        content = content.slice(0, maxLength) + `\n\n[Content truncated at ${maxLength} characters]`;
      }

      return content;
    } catch (error) {
      const err = error as Error;
      if (err.name === 'TimeoutError') {
        return `Fetch timeout: request took longer than 30 seconds`;
      }
      return `Fetch error: ${err.message}`;
    }
  },
};

function htmlToText(html: string): string {
  let text = html;

  text = text.replace(/<script[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[\s\S]*?<\/style>/gi, '');
  text = text.replace(/<nav[\s\S]*?<\/nav>/gi, '');
  text = text.replace(/<footer[\s\S]*?<\/footer>/gi, '');
  text = text.replace(/<header[\s\S]*?<\/header>/gi, '');

  text = text.replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi, '\n## $1\n');
  text = text.replace(/<p[^>]*>(.*?)<\/p>/gi, '\n$1\n');
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n');
  text = text.replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)');
  text = text.replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`');
  text = text.replace(/<pre[^>]*>(.*?)<\/pre>/gis, '\n```\n$1\n```\n');
  text = text.replace(/<[^>]*>/g, '');

  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)));

  text = text.replace(/\n{3,}/g, '\n\n');
  text = text.replace(/[ \t]+/g, ' ');

  return text.trim();
}
