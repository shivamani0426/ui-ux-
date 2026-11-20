import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {aiConfig} from '../ai-providers.mjs';

test('checked-in free-tier Render blueprint does not silently select a paid OpenRouter model',()=>{
  const blueprint=fs.readFileSync(new URL('../render.yaml',import.meta.url),'utf8');
  assert.match(blueprint,/AI_PRIMARY_PROVIDER\n\s+value: groq/);
  assert.match(blueprint,/AI_FALLBACK_ENABLED\n\s+value: "false"/);
  assert.doesNotMatch(blueprint,/openai\/gpt-4o-mini|OPENROUTER_MODEL/);
  assert.doesNotMatch(blueprint,/NVIDIA_PRODUCTION_LICENSE_APPROVED\n\s+value: true/);
});
test('free-only production Groq settings never call NVIDIA trial or OpenRouter automatically',()=>{
  const settings=aiConfig({NODE_ENV:'production',AI_PRIMARY_PROVIDER:'groq',
    AI_FALLBACK_ENABLED:'false',GROQ_API_KEY:'test',
    OPENROUTER_API_KEY:'legacy',NVIDIA_API_KEY:'trial'});
  assert.equal(settings.aiEnabled,true);
  assert.equal(settings.aiPrimary,'groq');
  assert.equal(settings.aiFallbackProvider,null);
  assert.equal(settings.aiFallbackEnabled,false);
  assert.equal(settings.aiProviders.nvidia,false);
});
