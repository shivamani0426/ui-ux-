import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('The black dome enters only on click or tap, never on pointer contact or hover',()=>{
  const portal=read('src/components/FrontlineDomePortal.jsx');
  const app=read('src/App.jsx');
  assert.match(portal,/onClick=\{enter\}/);
  assert.ok(!portal.includes('onPointerEnter='));
  assert.ok(!portal.includes('onPointerDown='));
  assert.ok(!portal.includes('onTouchStart='));
  assert.ok(!portal.includes('onMouseOver='));
  assert.ok(portal.includes('phase===\'charging\''));
  assert.ok(portal.includes('phase===\'opening\''));
  assert.ok(app.includes('setPortalState(\'charging\')'));
  assert.ok(app.includes('setPortalState(\'opening\')'));
  assert.ok(app.includes('setPortalState(\'done\')'));
  assert.match(app,/reduced\?220:2700/);
  assert.match(app,/reduced\?220:3000/);
  assert.match(app,/FrontlineLanding locked=/);
  assert.ok(app.includes('setMode(\'chat\')'),'Original studio entry must remain intact');
});
test('White halo charges on an all-black screen before the slow centre-out reveal',()=>{
  const css=read('src/components/FrontlineDomePortal.css');
  const app=read('src/App.jsx');
  assert.match(css,/\.fl-dome-portal\{/);
  assert.match(css,/background:#030303/);
  assert.match(css,/linear-gradient\(145deg,#171717/);
  assert.match(css,/\.fl-dome-portal\.is-charging \.fl-dome-ring-outer/);
  assert.match(css,/2700ms/);
  assert.match(css,/3000ms/);
  assert.match(css,/rgba\(255,255,255/);
  assert.match(css,/\.app\.portal-idle \.fl-world,\.app\.portal-charging \.fl-world/);
  assert.match(css,/clip-path:circle\(0% at 50% 50%\)/);
  assert.match(css,/\.app\.portal-opening \.fl-world/);
  assert.match(css,/clip-path:circle\(76vmax at 50% 50%\)/);
  assert.match(css,/prefers-reduced-motion/);
  assert.match(app,/document\.documentElement\.style\.overflow='hidden'/);
  assert.match(app,/document\.documentElement\.style\.overflow=oldHTML/);
  assert.ok(app.includes('<FrontlineLanding'));
  assert.ok(app.includes('spiral-emerging'));
  assert.ok(app.includes('InspirationExplorer'));
});

test('Intro has no visible text and uses a custom sculpted F, not a font glyph',()=>{
  const component=read('src/components/FrontlineDomePortal.jsx');
  const css=read('src/components/FrontlineDomePortal.css');
  assert.match(component,/className="fl-dome-f-sculpture"/);
  assert.match(component,/const F_PATH=/);
  assert.match(component,/path d=\{F_PATH\}/);
  assert.match(component,/aria-label="Click the black F sculpture to enter Frontline"/);
  for(const old of ['<h1','<p ','fl-dome-title','fl-dome-instruction','fl-dome-subline',
    'fl-dome-gate-copy','fl-dome-bottom','<text']){
    assert.ok(!component.includes(old),'Old visible entrance item: '+old);
  }
  assert.match(css,/fl-f-white-charge/);
  assert.match(css,/background:transparent!important/);
});
