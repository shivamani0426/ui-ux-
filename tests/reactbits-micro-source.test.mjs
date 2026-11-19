import test from 'node:test';
import assert from 'node:assert/strict';
import {parseReactBitsPublisherCatalogue,rankReactBitsOriginalComponents} from '../reactbits-official.mjs';

test('publisher Micro section preserves real original link and component metadata',()=>{
  const publisherIndex=[
    '## Micro',
    '- [Prompt Bar](https://www.reactbits.dev/micro/prompt-bar): Chat composer with sources and commands. CLI: `PromptBar`.',
    '- [Hold Button](https://www.reactbits.dev/micro/hold-button): Hold-to-confirm action button. CLI: `HoldButton`.'
  ].join('\n');
  const entries=parseReactBitsPublisherCatalogue(publisherIndex);
  assert.equal(entries.length,2);
  const hits=rankReactBitsOriginalComponents('chat prompt bar composer',entries,{limit:3});
  assert.equal(hits[0].site,'https://www.reactbits.dev/micro/prompt-bar');
  assert.equal(hits[0].componentName,'PromptBar');
  assert.equal(hits[0].originalPrompt,null);
  assert.equal(hits[0].originalPromptStatus,'not-published');
});

test('Micro publisher index rejects fake host and mismatched category',()=>{
  const entries=parseReactBitsPublisherCatalogue([
    '## Micro',
    '- [Prompt Bar](https://fake.reactbits.dev/micro/prompt-bar): Chat composer with commands. CLI: `PromptBar`.',
    '- [Fake Path](https://www.reactbits.dev/animations/prompt-bar): Chat composer with commands. CLI: `PromptBar`.'
  ].join('\n'));
  assert.deepEqual(entries,[]);
});
