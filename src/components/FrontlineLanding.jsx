import React, {useEffect,useRef,useState} from 'react';
import {ArrowRight,ArrowUpRight,Pause,Play,RotateCcw,Sparkles} from 'lucide-react';
import SolarFluidCanvas from './SolarFluidCanvas.jsx';
import FrontlineMark from './FrontlineMark.jsx';
import './FrontlineLanding.css';
import './FrontlineScrollStory.css';
import './FrontlineCinematicTour.css';
import './FrontlineAutoLanding.css';

/* Original Frontline composition: user-provided Solare recording informs pacing,
 * oversized kinetic typography, golden sphere and editorial spiral, not source assets. */
const CHAPTERS=[
  {no:'00',overline:'A NEW ERA OF DESIGN INTELLIGENCE',headline:['FRONTLINE'],accent:'UX / UI',description:'A universe of extraordinary interfaces starts with one thought.',subtitle:'YOUR NEXT DESIGN BEGINS HERE',mode:null},
  {no:'01',overline:'01 / SELECT UI & UX',headline:['FIND YOUR','DIRECTION.'],accent:'Discover what fits.',description:'Explore curated real-world references. Understand the visual ideas behind every match. Save the inspirations worth carrying forward.',subtitle:'REAL REFERENCES · PERSONAL CHOICES',mode:'select'},
  {no:'02',overline:'02 / GENERATE UI & UX',headline:['A THOUGHT','BECOMES','A VISION.'],accent:'Words into wonder.',description:'Bring a simple brief. Shape an original, detailed design direction with structure, typography, interactions, and the human experience in mind.',subtitle:'FROM A BRIEF TO A CREATIVE BLUEPRINT',mode:'generate'},
  {no:'03',overline:'03 / DESIGN FUSION',headline:['MANY IDEAS.','ONE VISION.'],accent:'Designed to belong.',description:'Select different references and styles. Combine their strongest ideas into one cohesive, original direction—without copying another website.',subtitle:'SELECT · COMBINE · REFINE',mode:'fusion'},
  {no:'04',overline:'04 / DESIGN PREFERENCES · THE CREATIVE SPIRAL',headline:['IMAGINE','WHAT’S NEXT.'],accent:'Your story begins here.',description:'Explore your design style, save your inspiration, and keep all your projects together.',subtitle:'YOUR DESIGNS, ONE FRIENDLY WORKSPACE',mode:null}
];
function KineticText({value,base=0}){
  const chars=Array.from(value);
  return <span className="fl-kinetic-line" aria-label={value}>
    {chars.map((c,i)=><span className="fl-kinetic-glyph" aria-hidden="true"
      key={i} style={{transitionDelay:Math.min(450,(i+base)*18)+'ms'}}>{c===' '?'\u00a0':c}</span>)}
  </span>;
}
function spiralPath(){
  const out=[];
  for(let i=0;i<=690;i++){
    const theta=i/690*Math.PI*11.7;
    const r=12+theta*10.9;
    const x=450+r*Math.cos(theta-.6),y=450+r*Math.sin(theta-.6);
    out.push((i?'L':'M')+x.toFixed(2)+' '+y.toFixed(2));
  }
  return out.join(' ');
}
const SPIRAL_PATH=spiralPath();
const SPIRAL_WORDS=('FRONTLINE  ·  SELECT  ·  GENERATE  ·  FUSE  ·  DESIGN INTELLIGENCE  ·  ').repeat(12);


const SCENE_TIME=[5200,5800,5800,5800,8500];
export default function FrontlineLanding({locked=false,effectsReady=false,onBegin,onMode,onSceneChange,
  onComposeReady,onLogin,onSignup}){
  const root=useRef(null);
  const [frame,setFrame]=useState(0);
  const [playing,setPlaying]=useState(true);
  const [reduceMotion,setReduceMotion]=useState(false);
  const [visible,setVisible]=useState(true);
  const [fluidStage,setFluidStage]=useState(0);
  useEffect(()=>{
    const query=window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const refresh=()=>setReduceMotion(Boolean(query?.matches));
    refresh();
    query?.addEventListener?.('change',refresh);
    return()=>query?.removeEventListener?.('change',refresh);
  },[]);
  useEffect(()=>{
    const onVisibility=()=>setVisible(!document.hidden);
    onVisibility();
    document.addEventListener('visibilitychange',onVisibility);
    return()=>document.removeEventListener('visibilitychange',onVisibility);
  },[]);
  useEffect(()=>{
    if(!effectsReady){setFluidStage(0);return undefined;}
    const sun=setTimeout(()=>setFluidStage(1),400);
    const water=setTimeout(()=>setFluidStage(2),1060);
    return()=>{clearTimeout(sun);clearTimeout(water)};
  },[effectsReady]);
  useEffect(()=>{
    if(!effectsReady||locked||!playing||reduceMotion||!visible)return undefined;
    // A wall-clock sequence changes only content state; the page never
    // scrolls or steals the user's scroll position.
    const timer=setTimeout(()=>{
      setFrame(prev=>(prev+1)%CHAPTERS.length);
    },SCENE_TIME[frame]);
    return()=>clearTimeout(timer);
  },[frame,playing,reduceMotion,locked,effectsReady,visible]);
  useEffect(()=>{onSceneChange?.(frame)},[frame,onSceneChange]);
  useEffect(()=>{onComposeReady?.(effectsReady&&!locked)},[effectsReady,locked,onComposeReady]);
  useEffect(()=>{
    if(locked||reduceMotion)return undefined;
    let raf=0,tx=0,ty=0,sx=0,sy=0;
    const smooth=()=>{
      raf=0;
      if(!root.current)return;
      sx+=(tx-sx)*.18;sy+=(ty-sy)*.18;
      root.current.style.setProperty('--fl-mx',(sx*11).toFixed(2)+'px');
      root.current.style.setProperty('--fl-my',(sy*8).toFixed(2)+'px');
      root.current.style.setProperty('--fl-arch-x',(-sx*10).toFixed(2)+'px');
      root.current.style.setProperty('--fl-arch-y',(-sy*5).toFixed(2)+'px');
      if(Math.abs(tx-sx)>.005||Math.abs(ty-sy)>.005)raf=requestAnimationFrame(smooth);
    };
    const move=event=>{
      if(event.pointerType==='touch')return;
      tx=(event.clientX/Math.max(1,innerWidth)-.5)*2;
      ty=(event.clientY/Math.max(1,innerHeight)-.5)*2;
      if(!raf)raf=requestAnimationFrame(smooth);
    };
    window.addEventListener('pointermove',move,{passive:true});
    return()=>{window.removeEventListener('pointermove',move);if(raf)cancelAnimationFrame(raf)};
  },[locked,reduceMotion]);
  const goToChapter=i=>{setFrame(i);setPlaying(false)};
  const replay=()=>{setFrame(0);setPlaying(!reduceMotion)};
  const current=CHAPTERS[frame];
  return <section ref={root} inert={locked} aria-hidden={locked}
    className={'fl-world fl-scroll-story fl-auto-landing fl-chapter-'+frame}
    aria-label="Frontline UX/UI automatic feature introduction"
    data-auto-features={playing&&!reduceMotion?'playing':'paused'}
    style={{'--fl-paper-progress':'0','--fl-spiral-progress':frame===4?'1':'0',
      '--fl-spiral-opacity':frame>=3?'1':'0','--fl-compose-reveal':'0'}}>
    <div className="fl-atmosphere" aria-hidden="true">
      <div className="fl-sky"/><div className="fl-grain"/><div className="fl-aura"/>
      <div className="fl-architecture">
        <div className="fl-outer-arch"/><div className="fl-inner-arch"/>
        <div className="fl-cliff fl-cliff-left"/><div className="fl-cliff fl-cliff-right"/>
        <div className="fl-column fl-column-left"/><div className="fl-column fl-column-right"/>
        <div className="fl-floor"/>
      </div>
      <div className="fl-sun-wrap"><div className="fl-sun-halo"/>
        <div className="fl-sun">{fluidStage>=1&&<SolarFluidCanvas mode="sun"/>}</div>
      </div>
      <div className="fl-basin"><div className="fl-water">
        {fluidStage>=2&&<SolarFluidCanvas mode="water"/>}
        <div className="fl-sun-reflection"/>
        <div className="fl-ripple fl-ripple-a"/><div className="fl-ripple fl-ripple-b"/>
        <div className="fl-ripple fl-ripple-c"/>
      </div></div>
      <div className="fl-clouds"/><div className="fl-shimmer"/>
    </div>
    <div className="fl-auto-topline" aria-hidden="true">
      <span>FRONTLINE / UX & UI MADE EASIER</span><span>DESIGN TOGETHER</span>
    </div>
    {CHAPTERS.map((chapter,i)=><article key={chapter.no}
      className={'fl-story-scene fl-story-scene-'+i+(frame===i?' is-current':'')}
      aria-hidden={frame!==i}
      style={{
        '--fl-this-opacity':frame===i?'1':'0',
        '--fl-this-enter':frame===i?'1':'0',
        '--fl-this-rise':frame===i?'0px':'28px',
        '--fl-this-scale':frame===i?'1':'.98',
        '--fl-this-letter-shift':frame===i?'0%':'105%'
      }}>
      <div className="fl-story-scene-inner">
        <p className="fl-story-kicker"><span className="fl-overline-dot"/>{chapter.overline}</p>
        <h1 className="fl-story-heading">
          {chapter.headline.map((line,j)=><span
            className={'fl-story-heading-line'+(i===0?' fl-headline-main':'')+
              (j===1?' fl-story-italic-line':'')} key={j}>
            <KineticText value={line} base={j*4}/>
          </span>)}
          {i===0&&<span className="fl-story-first-accent"><KineticText value={chapter.accent} base={5}/></span>}
        </h1>
        <p className="fl-story-accent">{chapter.accent}</p>
        <p className="fl-story-description">{chapter.description}</p>
        {i>0&&i<4&&<button type="button" className="fl-story-action"
          tabIndex={frame===i?0:-1}
          onClick={()=>onMode?.(chapter.mode)}>
          Explore {chapter.mode==='fusion'?'Design Fusion':chapter.mode==='select'?'Select UI/UX':'Generate UI/UX'}
          <ArrowUpRight size={16} aria-hidden="true"/>
        </button>}
      </div>
      <div className="fl-story-footnote">{chapter.subtitle}<span>0{i+1} / 05</span></div>
    </article>)}
    {frame===4&&<div className="fl-spiral-stage" aria-hidden="true">
      <div className="fl-spiral-aura"/>
      <svg className="fl-spiral-art" viewBox="0 0 900 900" role="img"
        aria-label="Animated Frontline typographic spiral">
        <defs>
          <path id="fl-spiral-type-path" d={SPIRAL_PATH}/>
          <radialGradient id="fl-spiral-centre" cx="33%" cy="27%" r="76%">
            <stop offset="0%" stopColor="#d8e5ff"/>
            <stop offset="38%" stopColor="#b6cafd"/>
            <stop offset="76%" stopColor="#8b9fe0"/>
            <stop offset="100%" stopColor="#586ba9"/>
          </radialGradient>
        </defs>
        {[133,235,322,412].map(r=><circle key={r} cx="450" cy="450" r={r}
          fill="none" stroke="#7483b9" strokeOpacity={r===412?.2:.33}
          strokeWidth={r===412?1.5:1}/>)}
        <path d={SPIRAL_PATH} stroke="#909fd3" strokeOpacity=".15" strokeWidth="26" fill="none"/>
        <text className="fl-spiral-type"><textPath href="#fl-spiral-type-path"
          startOffset="0%">{SPIRAL_WORDS}</textPath></text>
        <circle cx="450" cy="450" r="70" fill="url(#fl-spiral-centre)"/>
        <circle cx="450" cy="450" r="83" stroke="#bac9fb" strokeOpacity=".5"
          strokeWidth="1" fill="none"/>
        <circle cx="450" cy="450" r="4" fill="#fff"/>
      </svg>
    </div>}
    <div className="fl-auto-centre" aria-label="Account options">
      <div className="fl-auto-centre-label"><Sparkles size={15} aria-hidden="true"/>
        Simple ideas. Beautiful experiences.</div>
      <div className="fl-auto-entry-actions">
        <button type="button" className="fl-auto-login" onClick={onLogin}>
          Log In <ArrowRight size={18} aria-hidden="true"/>
        </button>
        <button type="button" className="fl-auto-signup" onClick={onSignup}>
          Sign Up <ArrowUpRight size={18} aria-hidden="true"/>
        </button>
      </div>
      <p>New here? Sign up with Google. Already have an account? Log in.</p>
    </div>
    <nav className="fl-chapter-nav fl-story-nav" aria-label="Feature highlights">
      {CHAPTERS.map((chapter,i)=><button type="button" key={chapter.no}
        onClick={()=>goToChapter(i)} aria-label={'Show '+chapter.overline}
        aria-current={frame===i?'step':undefined} className={frame===i?'is-current':''}>
        <span className="fl-nav-line"/><span className="fl-nav-number">{chapter.no}</span>
      </button>)}
    </nav>
    {!locked&&<div className="fl-auto-play-controls" aria-label="Feature animation controls">
      <span aria-live="off">{frame===0?'Welcome':current.mode==='select'?'Select UI/UX':
        current.mode==='generate'?'Generate UI/UX':current.mode==='fusion'?'Design Fusion':'Personal preferences'}</span>
      {!reduceMotion?<button type="button" onClick={()=>setPlaying(p=>!p)}
        aria-label={playing?'Pause feature showcase':'Play feature showcase'}>
        {playing?<><Pause size={14}/> Pause</>:<><Play size={14}/> Play</>}
      </button>:<span>Choose a feature below</span>}
      <button type="button" onClick={replay} aria-label="Replay feature showcase">
        <RotateCcw size={14}/> Replay
      </button>
    </div>}
  </section>;
}
