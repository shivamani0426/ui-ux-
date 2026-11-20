import test from 'node:test';
import assert from 'node:assert/strict';
import {aiFallbackGuidance} from '../ai-failure-guidance.mjs';

test('Groq exhaustion shows correct free-only guidance, never mentions OpenRouter',()=>{
  const result=aiFallbackGuidance({provider:'groq',
    reason:'billing-required',retryAfterSeconds:900});
  assert.match(result.note,/Groq/);
  assert.match(result.note,/No paid service has been activated/);
  assert.doesNotMatch(result.note+result.retry,/OpenRouter|buy|upgrade/i);
  assert.match(result.retry,/Do not repeatedly/);
});
test('Real fallback provider timeout is attributed to NVIDIA, not the configured primary',()=>{
  const result=aiFallbackGuidance({provider:'nvidia',reason:'timeout'});
  assert.match(result.note,/NVIDIA/);
  assert.doesNotMatch(result.note,/Groq|OpenRouter/);
});
test('Legacy OpenRouter displays compatible retry guidance in existing test-mode chat',()=>{
  const result=aiFallbackGuidance({provider:'openrouter',reason:'provider-unavailable'});
  assert.match(result.retry,/Retry with OpenRouter/);
});
test('Rate limits show a bounded cooldown and suppress rapid retry',()=>{
  const result=aiFallbackGuidance({provider:'groq',reason:'rate-limited',
    retryAfterSeconds:120});
  assert.match(result.note,/about 2 minute/);
  assert.match(result.retry,/Do not repeatedly/);
});
test('Out-of-scope AI output is never presented as a provider-generated recommendation',()=>{
  const result=aiFallbackGuidance({provider:'groq',reason:'scope-conflict'});
  assert.match(result.note,/explicitly excluded/);
});
