import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('Milestone 10 retains cinematic spiral but replaces chat birth with two entry paths',()=>{
  const app=read('src/App.jsx');
  const landing=read('src/components/FrontlineLanding.jsx');
  const css=read('src/components/FrontlineLogin.css');
  for(const part of ["isLanding&&landingFrame===4","className={'fl-landing-gateway'","Enter Studio","Login","enterGateway('studio')","enterGateway('login')","<StarBorder","inert={!landingComposerReady}"]){
    assert.ok(app.includes(part),'Missing cinematic gateway detail: '+part);
  }
  assert.ok(app.includes("{active&&<div ref={composerDockRef}"),'Chat must be docked only inside studio');
  assert.ok(!app.includes('composer-position.spiral-emerging'),'Former chat birth must not be re-enabled');
  assert.match(landing,/--fl-spiral-progress/);
  assert.match(landing,/--fl-compose-reveal/);
  assert.ok(css.includes('.fl-landing-gateway.is-ready'),'Gateway should become interactive only after full reveal');
});

test('Bottom-centre black-hole motion leads to branded login and guest studio',()=>{
  const app=read('src/App.jsx');
  const login=read('src/components/FrontlineLogin.jsx');
  const css=read('src/components/FrontlineLogin.css');
  for(const part of ["routeTo('/studio')","setMode('welcome')","'reveal-'","'expand-'","location.pathname==='/login'","window.addEventListener('popstate'","mode==='login'&&<FrontlineLogin"]){
    assert.ok(app.includes(part),'Missing route or transition: '+part);
  }
  for(const part of ['.fl-blackhole-transition.is-expanding','.fl-blackhole-transition.is-revealing','@keyframes fl-blackhole-expand','@keyframes fl-studio-emerge','prefers-reduced-motion']){
    assert.ok(css.includes(part),'Missing entrance motion: '+part);
  }
  assert.match(login,/Enter Studio as Guest/);
  assert.match(login,/Back to the story/);
  assert.match(login,/Continue with Google/);
  assert.match(login,/disabled=\{!googleReady\}/,'Google must not pretend to log in until configured');
  assert.ok(!login.includes('type="password"'),'No insecure placeholder credential collection');
});
