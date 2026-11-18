import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('Frontline opens automatically with one black center orb and no F entrance',()=>{
  const component=read('src/components/FrontlineOrbIntro.jsx');
  const css=read('src/components/FrontlineOrbIntro.css');
  const app=read('src/App.jsx');
  assert.match(component,/className="fl-orb-intro-disc"/);
  assert.match(component,/data-opening="black-orb"/);
  assert.ok(!component.includes('FrontlineMark'));
  assert.ok(!component.includes('<svg'));
  assert.ok(!component.includes('<button'));
  assert.ok(!component.includes('onClick'));
  assert.ok(app.includes('isLanding&&portalState!==\'done\'&&<FrontlineOrbIntro/>'));
  assert.ok(!app.includes('<FrontlineDomePortal'));
  assert.ok(!app.includes("setPortalState('charging')"));
  assert.ok(!app.includes('onEnter={enterPortal}'));
  assert.match(css,/@keyframes fl-intro-singularity/);
  assert.match(css,/left:50%;top:50%/);
  assert.match(css,/prefers-reduced-motion:reduce/);
  assert.ok(app.includes('setTimeout(()=>setPortalState(\'done\')'),
    'Opening should finish automatically without interaction');
});

test('The friendly landing must not restore a scroll gate or spiral-only signup',()=>{
  const app=read('src/App.jsx');
  const scene=read('src/components/FrontlineLanding.jsx');
  const css=read('src/components/FrontlineAutoLanding.css');
  assert.match(app,/onLogin=\{\(\)=>enterGateway\('login'\)\}/);
  assert.match(app,/onSignup=\{startGoogleSignup\}/);
  assert.ok(!app.includes('landing-scrollspace scroll-story-space'));
  assert.ok(!app.includes('<FrontlineDomePortal'));
  assert.ok(!app.includes("isLanding&&landingFrame===4&&<div inert="));
  assert.match(scene,/className="fl-auto-entry-actions"/);
  assert.match(scene,/Log In/);
  assert.match(scene,/Sign Up/);
  assert.match(css,/\.fl-auto-centre/);
  assert.match(css,/\.fl-auto-entry-actions/);
  assert.match(css,/\.fl-auto-landing \.fl-story-scene/);
});
