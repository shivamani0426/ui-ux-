import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('The golden dome is a pre-landing, input-first entry, never a click-only gate',()=>{
  const portal=read('src/components/FrontlineDomePortal.jsx');
  const app=read('src/App.jsx');
  assert.match(portal,/onPointerEnter=/);
  assert.match(portal,/onPointerDown=/);
  assert.match(portal,/onTouchStart=\{enter\}/);
  assert.match(portal,/onKeyDown=/);
  assert.ok(!portal.includes('onClick='),'Portal should open by contact, not clicking');
  assert.match(app,/portalState/);
  assert.match(app,/portalState==='opening'/);
  assert.match(app,/portalState!=='done'/);
  assert.match(app,/FrontlineLanding locked=/);
  assert.ok(app.includes('setMode(\'chat\')'),'Studio entry must remain intact');
});
test('Dome reveals the unchanged Frontline landing from an inside-out aperture',()=>{
  const portal=read('src/components/FrontlineDomePortal.css');
  const app=read('src/App.jsx');
  assert.match(portal,/\.app\.portal-idle \.fl-world\{clip-path:circle\(0%/);
  assert.match(portal,/\.app\.portal-opening \.fl-world/);
  assert.match(portal,/clip-path:circle\(160vmax at 50% 50%\)/);
  assert.match(portal,/prefers-reduced-motion/);
  assert.match(app,/document\.documentElement\.style\.overflow='hidden'/);
  assert.match(app,/document\.documentElement\.style\.overflow=oldHTML/);
  assert.ok(app.includes('<FrontlineLanding'));
  assert.ok(app.includes('spiral-emerging'));
  assert.ok(app.includes('InspirationExplorer'));
});
