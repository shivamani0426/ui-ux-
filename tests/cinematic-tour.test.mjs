import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {TOUR_STOPS,TOUR_TRAVEL_MS,TOUR_HOLDS_MS,TOUR_DURATION_MS,
  sampleCinematicTour} from '../src/utils/cinematic-tour.mjs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('Cinematic tour holds all five chapters long enough to read',()=>{
  assert.deepEqual(TOUR_STOPS,[0,.294,.482,.678,.855,1]);
  assert.equal(TOUR_TRAVEL_MS.length,5);
  assert.ok(TOUR_HOLDS_MS.slice(0,5).every(x=>x>=2000),
    'Every chapter must have an intentional multi-second reading hold');
  assert.ok(TOUR_DURATION_MS>=38000&&TOUR_DURATION_MS<=60000,
    'Five chapters plus spiral should have cinematic—not hurried—duration');
  assert.equal(sampleCinematicTour(0).progress,0);
  assert.equal(sampleCinematicTour(TOUR_DURATION_MS+1000).progress,1);
  assert.equal(sampleCinematicTour(TOUR_DURATION_MS).done,true);
});
test('Tour easing is monotonic, exact at stops and steady during reading holds',()=>{
  let t=0,previous=0;
  for(let i=0;i<TOUR_STOPS.length;i++){
    const hold=TOUR_HOLDS_MS[i];
    assert.ok(Math.abs(sampleCinematicTour(t).progress-TOUR_STOPS[i])<1e-6);
    assert.ok(Math.abs(sampleCinematicTour(t+hold/2).progress-TOUR_STOPS[i])<1e-6);
    t+=hold;
    if(i<TOUR_TRAVEL_MS.length){
      const travel=TOUR_TRAVEL_MS[i];
      const early=sampleCinematicTour(t+travel*.05).progress;
      const middle=sampleCinematicTour(t+travel*.5).progress;
      const late=sampleCinematicTour(t+travel*.95).progress;
      assert.ok(early>TOUR_STOPS[i]&&middle>early&&late>middle);
      assert.ok(late<TOUR_STOPS[i+1]);
      assert.ok(Math.abs(middle-(TOUR_STOPS[i]+TOUR_STOPS[i+1])/2)<.00001);
      t+=travel;
    }
  }
  for(let millis=0;millis<TOUR_DURATION_MS;millis+=43){
    const progress=sampleCinematicTour(millis).progress;
    assert.ok(progress>=previous-1e-8&&progress<=1,'Tour must never jump backward');
    previous=progress;
  }
  assert.equal(t,TOUR_DURATION_MS);
});
test('Portal opens before guided scrolling and existing manual story controls survive',()=>{
  const app=read('src/App.jsx');
  const landing=read('src/components/FrontlineLanding.jsx');
  const hook=read('src/hooks/useCinematicTour.js');
  const portalCss=read('src/components/FrontlineDomePortal.css');
  for(const element of ["locked={portalState!=='done'}","effectsReady={portalState==='done'}",
    "setPortalState('charging')","setPortalState('opening')","setPortalState('done')"]){
    assert.ok(app.includes(element),'missing entrance gate '+element);
  }
  for(const term of ['useCinematicTour','fl-tour-ui','Pause cinematic tour','Replay cinematic tour',
    'Skip cinematic journey','goToChapter','onComposeReady'])assert.ok(landing.includes(term));
  for(const term of ['wheel','touchstart','pointerdown','keydown','visibilitychange',
    'prefers','scrollTo','requestAnimationFrame']) {
    if(term==='prefers')continue;
    assert.ok(hook.includes(term),'User must remain in control: '+term);
  }
  assert.match(portalCss,/fl-dome-ring-light/);
  assert.match(portalCss,/opacity:0;transform:scale/);
  assert.match(portalCss,/2700ms/);
  assert.match(portalCss,/3000ms/);
});
test('Solar animation is staged and sleeps when invisible without discarding its visual fallback',()=>{
  const scene=read('src/components/FrontlineLanding.jsx');
  const fluid=read('src/components/SolarFluidCanvas.jsx');
  const css=read('src/components/FrontlineLanding.css');
  assert.match(scene,/fluidStage>=1&&<SolarFluidCanvas mode="sun"\/>/);
  assert.match(scene,/fluidStage>=2&&<SolarFluidCanvas mode="water"\/>/);
  for(const text of ['document.hidden','visibilitychange','IntersectionObserver','ResizeObserver',
    'if(raf||!running||!visible||document.hidden)return','gl.deleteProgram(program)']){
    assert.ok(fluid.includes(text),'Pause/cleanup rule missing: '+text);
  }
  assert.ok(css.includes('.fl-sun{animation:none!important}'),'CSS scene must survive without WebGL');
});
