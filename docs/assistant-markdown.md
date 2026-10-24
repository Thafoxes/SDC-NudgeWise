# Assistant reply formatting

AI Assistant replies render Markdown headings, emphasis, lists, tables, blockquotes, links and fenced code blocks. User messages remain plain text. Previously saved assistant messages use the same renderer when reopened. Tables and code blocks scroll horizontally when needed.

Model output is untrusted. Raw HTML and image rendering are disabled, and markdown-it's default unsafe-link validation stays enabled. Source links remain available below assistant replies.

Run `npm run test:markdown` for formatting and unsafe-content checks. The backend prompt requests readable Markdown; restart the backend to apply that prompt change.

## Third-party attribution

- **markdown-it 14.3.3**: Markdown parser, MIT license, [markdown-it contributors](https://github.com/markdown-it/markdown-it).
- **@types/markdown-it 14.2.0**: development TypeScript definitions, MIT license, [DefinitelyTyped contributors](https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/markdown-it).

Retain the upstream license notices when distributing these dependencies. Exact dependency versions are recorded in `package-lock.json`.
