import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {recommend} from '../design-engine.mjs';
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');

test('Frontline branding stays in navigation, chat and favicon but leaves the opening F-free',()=>{
  const app=read('src/App.jsx');
  const mark=read('src/components/FrontlineMark.jsx');
  const intro=read('src/components/FrontlineOrbIntro.jsx');
  const favicon=read('public/favicon.svg');
  assert.ok(app.includes('import FrontlineMark'));
  assert.ok(app.includes('<FrontlineMark size={29}/>'));
  assert.ok(app.includes('<FrontlineMark size={25}/>'));
  assert.ok(app.includes('<FrontlineMark size={53}/>'));
  assert.ok(!intro.includes('FrontlineMark'),'Old F opening should be removed, not site branding');
  assert.ok(!intro.includes('<svg'));
  assert.ok(mark.includes('linearGradient')&&mark.includes('Frontline F monogram'));
  assert.ok(favicon.includes('id="metal"'));
  assert.ok(!app.includes('✳'));
});

test('Original WebGL layer and pointer interactions degrade gracefully on mobile and reduced motion',()=>{
  const fluid=read('src/components/SolarFluidCanvas.jsx');
  const landing=read('src/components/FrontlineLanding.jsx');
  const css=read('src/components/FrontlineLanding.css');
  const auto=read('src/components/FrontlineAutoLanding.css');
  assert.ok(fluid.includes('(max-width: 700px)'));
  assert.ok(fluid.includes('navigator.connection?.saveData'));
  assert.ok(fluid.includes('1.25'));
  assert.ok(landing.includes('requestAnimationFrame(smooth)'));
  assert.ok(landing.includes('cancelAnimationFrame(raf)'));
  assert.ok(landing.includes("event.pointerType==='touch'"));
  assert.ok(landing.includes('prefers-reduced-motion'));
  assert.ok(auto.includes('prefers-reduced-motion'));
  assert.ok(css.includes('fl-reflect-transform'));
  assert.ok(css.includes('fl-content-fast'));
  assert.ok(css.includes('fl-intro-fast'));
});

test('Select UI/UX recommendations support a persisted inspiration library',()=>{
  const sources=[{id:'frontline-test',name:'Editorial Education',site:'https://example.org',award:null,rank:null,score:null,styles:['minimal'],tags:['education','dashboard']}];
  const result=recommend('education dashboard with careful typography',{},sources);
  assert.equal(result.designs.length,3);
  assert.equal(result.designs.find(d=>d.id==='minimal').references[0].id,'frontline-test');
  assert.equal(result.designs.find(d=>d.id==='glass').references.length,0);
});

test('Backend loads private Supabase schema and retains owner-scoped APIs',()=>{
  const server=read('server.mjs');
  const docs=read('docs/FRONTLINE-SUPABASE.md');
  for(const token of ['frontline.uic_projects','frontline.uic_profiles','frontline.uic_feedback','frontline.design_sources','frontline.generated_prompts','listReferences()','visitor_id=$2','DB_SSL','/api/health','/api/config'])assert.ok(server.includes(token),'missing '+token);
  assert.ok(!server.includes('CREATE TABLE IF NOT EXISTS uic_projects'));
  assert.ok(docs.includes('Session pooler'));
  assert.ok(docs.includes('DATABASE_URL'));
  assert.ok(docs.includes('JobPulse'));
});
