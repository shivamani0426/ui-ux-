import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const read = p => readFileSync(new URL('../'+p, import.meta.url),'utf8');

test('Frontline landing retains all chapters and real studio entrypoints', () => {
  const jsx=read('src/components/FrontlineLanding.jsx');
  for(const item of ['FRONTLINE','UX / UI','SELECT UI & UX','GENERATE UI & UX','DESIGN FUSION','DESIGN PREFERENCES','onMode','onBegin','requestAnimationFrame','pointermove','scroll']) {
    assert.ok(jsx.includes(item), 'missing: '+item);
  }
  assert.ok(jsx.includes("onSceneChange?.(next)"));
});

test('Frontend still serves the chat-first workspace rather than replacing its functions', () => {
  const app=read('src/App.jsx');
  for(const item of ['FrontlineLanding','/api/projects','/api/catalog','/api/feedback','/api/profile','/api/config','copyPrompt','openProject','setDesignMode','TechText','StarBorder']) {
    assert.ok(app.includes(item), 'missing: '+item);
  }
  assert.ok(app.includes('FRONTLINE'));
  assert.ok(!app.includes('text="UI COMPASS"'));
});

test('Story respects reduced-motion preferences and uses original CSS geometry', () => {
  const css=read('src/components/FrontlineLanding.css');
  for(const item of ['prefers-reduced-motion','fl-sun','fl-ripple','fl-basin','fl-chapter-0','fl-chapter-4','fl-headline','fl-cta']) {
    assert.ok(css.includes(item), 'missing: '+item);
  }
  assert.ok(!css.includes('casadisolare.com'));
});

test('Frontline document metadata and loading fallback are branded', () => {
  const html=read('index.html');
  assert.ok(html.includes('Frontline UX/UI'));
  assert.ok(html.includes('/src/App.jsx'));
});
