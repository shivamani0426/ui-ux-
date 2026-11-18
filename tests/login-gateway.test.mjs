import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('Frontline landing centers permanent Log In and Google Sign Up while preserving the original spiral',()=>{
  const app=read('src/App.jsx');
  const landing=read('src/components/FrontlineLanding.jsx');
  const css=read('src/components/FrontlineAutoLanding.css');
  const loginCss=read('src/components/FrontlineLogin.css');
  for(const part of ["onLogin={()=>enterGateway('login')}","onSignup={startGoogleSignup}",
    "<FrontlineOrbIntro/>","enterGateway('studio')","enterGateway('login')","<StarBorder"]){
    assert.ok(app.includes(part),'Missing entry detail: '+part);
  }
  assert.ok(app.includes("{active&&<div ref={composerDockRef}"),
    'Chat remains docked only inside studio');
  assert.ok(!app.includes('composer-position.spiral-emerging'),'Former landing chat birth must stay removed');
  assert.ok(!app.includes('landing-scrollspace scroll-story-space'),'No scrolling tour track');
  assert.match(landing,/className="fl-auto-entry-actions"/);
  assert.match(landing,/fl-spiral-stage/);
  assert.match(landing,/SPIRAL_PATH/);
  assert.match(css,/\.fl-auto-login/);
  assert.match(css,/\.fl-auto-signup/);
  assert.ok(loginCss.includes('.fl-blackhole-transition.is-expanding'),'Preserve existing login transition');
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
  assert.match(login,/Back to home/);
  assert.match(login,/Continue with Google/);
  assert.match(login,/disabled=\{!googleReady\}/,'Google must not pretend to log in until configured');
  assert.ok(!login.includes('type="password"'),'No insecure placeholder credential collection');
});


test('Login orb and both orbital rings breathe gently without changing the layout',()=>{
  const css=read('src/components/FrontlineLogin.css');
  const jsx=read('src/components/FrontlineLogin.jsx');
  assert.match(jsx,/fl-login-orb/);
  assert.match(jsx,/fl-login-ring-one/);
  assert.match(jsx,/fl-login-ring-two/);
  assert.match(css,/fl-login-orb-drift 13s ease-in-out infinite alternate,\s*fl-login-orb-breathe 8\.4s/);
  assert.match(css,/\.fl-login-ring\{\s*animation:fl-login-ring-breathe/);
  assert.match(css,/@keyframes fl-login-orb-breathe/);
  assert.match(css,/@keyframes fl-login-ring-breathe/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)\{\s*\.fl-login-orb,\.fl-login-ring,\.fl-login-ring-two/);
  assert.ok(!css.includes('filter:blur(22px)'),'Breathing should avoid new animated blur repainting');
});
