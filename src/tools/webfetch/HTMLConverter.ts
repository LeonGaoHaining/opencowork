/**
 * HTMLConverter - HTML格式转换
 * 支持 HTML -> Markdown 和 HTML -> Text 转换
 */

import TurndownService from 'turndown';

const SKIP_TAGS = ['script', 'style', 'meta', 'link', 'noscript', 'iframe', 'object', 'embed'];

export class HTMLConverter {
  private turndownService: TurndownService;

  constructor() {
    this.turndownService = new TurndownService({
      headingStyle: 'atx',
      hr: '---',
      bulletListMarker: '-',
      codeBlockStyle: 'fenced',
      emDelimiter: '*',
    });

    for (const tag of SKIP_TAGS) {
      (this.turndownService as any).remove(tag);
    }
  }

  toMarkdown(html: string): string {
    return this.turndownService.turndown(html);
  }

  toText(html: string): string {
    let text = html;

    for (const tag of SKIP_TAGS) {
      const regex = new RegExp(`<${tag}[^>]*>[\\s\\S]*?</${tag}>`, 'gi');
      text = text.replace(regex, '');
      const unaryRegex = new RegExp(`<${tag}[^>]*/?>`, 'gi');
      text = text.replace(unaryRegex, '');
    }

    text = text.replace(/<[^>]+>/g, '\n');
    text = text.replace(/&nbsp;/g, ' ');
    text = text.replace(/&amp;/g, '&');
    text = text.replace(/&lt;/g, '<');
    text = text.replace(/&gt;/g, '>');
    text = text.replace(/&quot;/g, '"');
    text = text.replace(/&#39;/g, "'");
    text = text.replace(/\n{3,}/g, '\n\n');
    text = text.replace(/[ \t]+/g, ' ');

    return text.trim();
  }
}
