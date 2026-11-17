import test from 'node:test';
import assert from 'node:assert/strict';
import {parseMessageMarkdown,parseInlineMarkdown} from '../src/utils/message-markdown.mjs';

test('assistant replies render headings, paragraphs, Markdown tables and bullet lists as blocks',()=>{
  const source=[
    '## Style comparison','','| | Minimal SaaS | Glass UI | Creative UI |',
    '|---|---|---|---|','| Strengths | **Clear hierarchy** | Blur depth | Expressive layouts |',
    '| Costs | Low | High GPU | Medium |','','### Recommendation','Choose **Minimal SaaS**.',
    '- Accessible labels','- Reduced motion',
  ].join('\n');
  const blocks=parseMessageMarkdown(source);
  assert.deepEqual(blocks.map(b=>b.type),['heading','table','heading','paragraph','list']);
  assert.equal(blocks[1].headers.length,4);
  assert.equal(blocks[1].rows[0][1],'**Clear hierarchy**');
  assert.deepEqual(parseInlineMarkdown(blocks[3].text).map(x=>x.type),['text','strong','text']);
});
test('escaped Markdown headings and code fences still produce readable safe text',()=>{
  const source='\\\\## Title\\n\\n\x60\x60\x60js\\nconst x=1;\\n\x60\x60\x60';
  const blocks=parseMessageMarkdown(source.replace(/\\n/g,'\n'));
  assert.equal(blocks[0].type,'heading');
  assert.equal(blocks[1].type,'code');
  assert.equal(blocks[1].text,'const x=1;');
});
test('untrusted HTML and unsafe javascript links remain plain text, not active markup',()=>{
  const payload='**Important** <img src=x onerror=alert(1)> [unsafe](javascript:alert(1)) [safe](https://example.org/docs)';
  const parts=parseInlineMarkdown(payload);
  assert.ok(parts.some(x=>x.type==='text'&&x.text.includes('<img src=x')));
  assert.ok(parts.some(x=>x.type==='text'&&x.text.includes('javascript:alert(1)')));
  assert.deepEqual(parts.filter(x=>x.type==='link').map(x=>x.url),['https://example.org/docs']);
});
test('no infinite loops on malformed table, blank text, unclosed fences or giant content',()=>{
  assert.deepEqual(parseMessageMarkdown(''),[]);
  assert.equal(parseMessageMarkdown('| A | B |\\n| :--- | ---: |\\n| A | B |')[0].type,'table');
  assert.equal(parseMessageMarkdown('\x60\x60\x60\\nHello'.replace(/\\n/g,'\n'))[0].type,'code');
  assert.ok(parseMessageMarkdown('a'.repeat(30000))[0].text.length<=16000);
});
