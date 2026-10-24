import MarkdownIt from 'markdown-it';

// Model output is untrusted: keep raw HTML and remote image loading disabled.
const markdown = new MarkdownIt({ html: false, breaks: true, linkify: false }).disable('image');
export function renderAssistantMarkdown(content: string): string {
  return markdown.render(content);
}
