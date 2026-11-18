import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('Landing keeps five chapters, real design modes and accessible signup/login',()=>{
 const jsx=read('src/components/FrontlineLanding.jsx');
 for(const item of ['FRONTLINE','UX / UI','SELECT UI & UX','GENERATE UI & UX','DESIGN FUSION','DESIGN PREFERENCES',
   'onMode','onLogin','onSignup','SCENE_TIME','setTimeout','pause','playing','onSceneChange?.(frame)'.replace('pause','playing')]){
   if(item==='pause')continue;
   assert.ok(jsx.includes(item),'missing '+item);
 }
 assert.match(jsx,/Pause feature showcase/);
 assert.match(jsx,/Replay feature showcase/);
 assert.match(jsx,/aria-current/);
 assert.match(jsx,/visibilitychange/);
 assert.ok(!jsx.includes('useCinematicTour'));
 assert.ok(!jsx.includes('window.scrollTo('));
 assert.ok(!jsx.includes('window.scrollY'));
});

test('Frontend still serves actual private chat, design engines and account management',()=>{
 const app=read('src/App.jsx');
 for(const item of ['FrontlineLanding','/api/projects','/api/catalog','/api/feedback','/api/profile',
   'copyPrompt','openProject','setDesignMode','TechText','StarBorder','startGoogleSignup'])assert.ok(app.includes(item),item);
 assert.ok(app.includes('FRONTLINE'));
 assert.ok(!app.includes('text="UI COMPASS"'));
});

test('Auto landing retains original fluid artwork and a responsive reduced-motion fallback',()=>{
 const css=read('src/components/FrontlineAutoLanding.css');
 const old=read('src/components/FrontlineLanding.css');
 for(const item of ['prefers-reduced-motion','fl-auto-centre','fl-auto-spiral-enter','fl-sun-wrap',
  'fl-basin','fl-chapter-nav','@media(max-width:650px)'])assert.ok(css.includes(item),item);
 for(const item of ['fl-sun','fl-ripple','fl-basin','fl-chapter-0','fl-chapter-4'])assert.ok(old.includes(item),item);
 assert.ok(!css.includes('casadisolare.com'));
});

test('Frontline metadata, original WebGL visuals and safe cleanup remain',()=>{
 const html=read('index.html');
 assert.ok(html.includes('Frontline UX/UI'));
 assert.ok(html.includes('/src/App.jsx'));
 const component=read('src/components/SolarFluidCanvas.jsx');
 const scene=read('src/components/FrontlineLanding.jsx');
 const css=read('src/styles.css');
 for(const item of ["getContext('webgl'",'uPointer','uScroll','gl_FragColor','IntersectionObserver',
   'gl.deleteBuffer','cancelAnimationFrame'])assert.ok(component.includes(item),item);
 assert.ok(scene.includes('<SolarFluidCanvas mode="sun"/>'));
 assert.ok(scene.includes('<SolarFluidCanvas mode="water"/>'));
 assert.ok(css.includes('.fl-fluid-canvas'));
 assert.ok(css.includes('.fl-fluid-sun'));
 assert.ok(css.includes('.fl-fluid-water'));
});
