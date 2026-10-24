const {test}=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const source=fs.readFileSync(path.join(__dirname,'../src/presentation/assistantMarkdown.ts'),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;
const output={exports:{}};new Function('require','module','exports',compiled)(require,output,output.exports);
const {renderAssistantMarkdown:render}=output.exports;
test('assistant Markdown renders headings, lists, emphasis, tables, code and citations',()=>{
 const html=render('## Invoice review\n\n**Overdue** and *disputed*.\n\n1. Check payment\n2. Contact buyer\n\n| Invoice | Balance |\n| --- | --- |\n| INV-1 | SGD 100 |\n\n```sql\nSELECT * FROM invoices;\n```\n\n[View invoice](#/invoices?invoice=inv-1)');
 for(const fragment of ['<h2>Invoice review</h2>','<strong>Overdue</strong>','<em>disputed</em>','<ol>','<table>','<th>Balance</th>','<pre><code class="language-sql">','href="#/invoices?invoice=inv-1"'])assert.ok(html.includes(fragment),fragment);
});
test('untrusted output cannot inject HTML, execute unsafe links or load remote images',()=>{
 const html=render('<script>alert(1)</script>\n<img src=x onerror=alert(1)>\n\n[click](javascript:alert(1))\n[encoded](jav&#x61;script:alert(1))\n[data](data:text/html;base64,PHNjcmlwdD4=)\n\n![tracking](https://example.com/pixel.png)');
 assert.ok(!/<script|<img|<iframe|href="(?:javascript|data):/i.test(html));assert.ok(html.includes('&lt;script&gt;'));
 assert.ok(render('```html\n<img src=x onerror=alert(1)>\n```').includes('&lt;img'));
});
test('plain text remains readable with paragraph and line breaks',()=>{assert.equal(render('Hello\nworld'),'\u003cp>Hello<br>\nworld</p>\n');});
