import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('Frontline studio has both solar themes and scoped screen-level styling',()=>{
  const css=read('src/frontline-studio.css');
  for(const token of ['--fl-gold','--fl-studio-glow','--fl-nav-surface','--lav','#261e23','#f7f0e4'])assert.ok(css.includes(token),token);
  for(const part of ['.app.in-chat .topbar','.app.in-chat .conversation-empty','.app.in-chat .chat-star.star-border','.app.in-chat .result-message','.app.in-chat .design-option','.app.in-chat .preview-app.fusion','.menu-panel .tool-mode','.menu-panel .learning-box','.app.in-welcome .chat-star.star-border'])assert.ok(css.includes(part),part);
  assert.ok(css.includes('prefers-reduced-motion'));
  assert.ok(css.includes('@media(max-width:750px)'));
});

test('Original features, privacy, AI state and navigation are not removed in visual upgrade',()=>{
  const app=read('src/App.jsx');
  for(const token of ["api('/api/catalog')","api('/api/projects')","api('/api/profile')","'/api/feedback'","/api/projects/","<FrontlineLanding","<StarBorder","<TechText","setDesignMode","eraseEverything","globalOptIn","designMode","viewPreview","mobilePreview","selected","feedbackSave","copyPrompt"]) assert.ok(app.includes(token),'missing '+token);
  assert.ok(app.includes("import './frontline-studio.css'"));
  assert.ok(app.includes('Optional refinement notes'));
  assert.ok(app.includes('studio-title'));
  assert.ok(app.includes('studio-starters'));
  assert.ok(!app.includes('#b0a3ff'), 'No previous lavender chat light');
});
