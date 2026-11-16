import React, {useEffect,useRef,useState} from 'react';
import {ArrowDown,ArrowUpRight} from 'lucide-react';
import SolarFluidCanvas from './SolarFluidCanvas.jsx';
import FrontlineMark from './FrontlineMark.jsx';
import './FrontlineLanding.css';
import './FrontlineScrollStory.css';

/* Original Frontline composition: user-provided Solare recording informs pacing,
 * oversized kinetic typography, golden sphere and editorial spiral, not source assets. */
const CHAPTERS=[
  {no:'00',overline:'A NEW ERA OF DESIGN INTELLIGENCE',headline:['FRONTLINE'],accent:'UX / UI',description:'A universe of extraordinary interfaces starts with one thought.',subtitle:'YOUR NEXT DESIGN BEGINS HERE',mode:null},
  {no:'01',overline:'01 / SELECT UI & UX',headline:['FIND YOUR','DIRECTION.'],accent:'Discover what fits.',description:'Explore curated real-world references. Understand the visual ideas behind every match. Save the inspirations worth carrying forward.',subtitle:'REAL REFERENCES · PERSONAL CHOICES',mode:'select'},
  {no:'02',overline:'02 / GENERATE UI & UX',headline:['A THOUGHT','BECOMES','A VISION.'],accent:'Words into wonder.',description:'Bring a simple brief. Shape an original, detailed design direction with structure, typography, interactions, and the human experience in mind.',subtitle:'FROM A BRIEF TO A CREATIVE BLUEPRINT',mode:'generate'},
  {no:'03',overline:'03 / DESIGN FUSION',headline:['MANY IDEAS.','ONE VISION.'],accent:'Designed to belong.',description:'Select different references and styles. Combine their strongest ideas into one cohesive, original direction—without copying another website.',subtitle:'SELECT · COMBINE · REFINE',mode:'fusion'},
  {no:'04',overline:'04 / THE CREATIVE SPIRAL',headline:['IMAGINE','WHAT’S NEXT.'],accent:'Your story begins here.',description:'Every direction, every possibility, one space to create. Keep scrolling to reveal your design studio.',subtitle:'SCROLL TO REVEAL YOUR CANVAS',mode:null}
];
const clamp=(n,min=0,max=1)=>Math.max(min,Math.min(max,n));
const ease=(a,b,p)=>{const t=clamp((p-a)/(b-a));return t*t*(3-2*t)};
const SCENES=[
  {inStart:-1,inEnd:0,outStart:.10,outEnd:.23},
  {inStart:.14,inEnd:.26,outStart:.33,outEnd:.44},
  {inStart:.34,inEnd:.45,outStart:.53,outEnd:.64},
  {inStart:.54,inEnd:.66,outStart:.73,outEnd:.83},
  {inStart:.77,inEnd:.87,outStart:2,outEnd:3}
];
function KineticText({value,base=0}){
  const chars=Array.from(value);
  return <span className="fl-kinetic-line" aria-label={value}>
    {chars.map((c,i)=><span className="fl-kinetic-glyph" aria-hidden="true"
      key={i} style={{'--fl-letter-i':i+base}}>{c===' '?'\u00a0':c}</span>)}
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
const SPIRAL_WORDS=('FRONTLINE  ·  SELECT  ·  GENERATE  ·  FUSE  ·  DESIGN INTELLIGENCE  ·  ').repeat(24);

export default function FrontlineLanding({onBegin,onMode,onSceneChange}){
  const root=useRef(null),frameRef=useRef(0);
  const [frame,setFrame]=useState(0);
  const [reduceMotion,setReduceMotion]=useState(false);
  useEffect(()=>{
    const query=window.matchMedia?.('(prefers-reduced-motion: reduce)');
    setReduceMotion(Boolean(query?.matches));
    const onChange=()=>setReduceMotion(Boolean(query?.matches));
    query?.addEventListener?.('change',onChange);
    return()=>query?.removeEventListener?.('change',onChange);
  },[]);
  useEffect(()=>{
    let raf=0,pointerRaf=0,tx=0,ty=0,sx=0,sy=0;
    const update=()=>{
      raf=0;
      if(!root.current)return;
      const available=Math.max(1,document.documentElement.scrollHeight-window.innerHeight);
      const p=clamp(window.scrollY/available);
      const el=root.current;
      el.style.setProperty('--fl-progress',p.toFixed(5));
      el.style.setProperty('--fl-paper-progress',ease(.11,.28,p).toFixed(5));
      el.style.setProperty('--fl-scroll-lift',(p*15).toFixed(2)+'vh');
      el.style.setProperty('--fl-cloud-drift',(p*28).toFixed(2)+'vw');
      el.style.setProperty('--fl-orb-scale',(1-p*.35).toFixed(4));
      el.style.setProperty('--fl-spiral-progress',ease(.75,.91,p).toFixed(5));
      el.style.setProperty('--fl-spiral-turn',((p-.76)*270).toFixed(2)+'deg');
      const reveal=ease(.86,.99,p);
      document.documentElement.style.setProperty('--fl-compose-reveal',reveal.toFixed(5));
      el.style.setProperty('--fl-compose-reveal',reveal.toFixed(5));
      for(let i=0;i<SCENES.length;i++){
        const s=SCENES[i];
        const enter=i===0?1:ease(s.inStart,s.inEnd,p);
        const exit=i===4?0:ease(s.outStart,s.outEnd,p);
        el.style.setProperty('--fl-scene-enter-'+i,enter.toFixed(5));
        el.style.setProperty('--fl-scene-opacity-'+i,((1-exit)*enter).toFixed(5));
      }
      const next=Math.min(4,Math.floor(p*5));
      if(next!==frameRef.current){
        frameRef.current=next;
        setFrame(next);
        onSceneChange?.(next);
      }
    };
    const queue=()=>{if(!raf)raf=window.requestAnimationFrame(update)};
    const smoothPointer=()=>{
      pointerRaf=0;
      if(!root.current)return;
      sx+=(tx-sx)*.24;sy+=(ty-sy)*.24;
      root.current.style.setProperty('--fl-mx',(sx*13).toFixed(2)+'px');
      root.current.style.setProperty('--fl-my',(sy*9).toFixed(2)+'px');
      root.current.style.setProperty('--fl-arch-x',(-sx*12).toFixed(2)+'px');
      root.current.style.setProperty('--fl-arch-y',(-sy*6).toFixed(2)+'px');
      if(Math.abs(tx-sx)>.006||Math.abs(ty-sy)>.006)pointerRaf=requestAnimationFrame(smoothPointer);
    };
    const move=event=>{
      if(reduceMotion||event.pointerType==='touch'||!root.current)return;
      tx=(event.clientX/Math.max(1,window.innerWidth)-.5)*2;
      ty=(event.clientY/Math.max(1,window.innerHeight)-.5)*2;
      if(!pointerRaf)pointerRaf=requestAnimationFrame(smoothPointer);
    };
    window.addEventListener('scroll',queue,{passive:true});
    window.addEventListener('resize',queue,{passive:true});
    window.addEventListener('pointermove',move,{passive:true});
    update();
    return()=>{
      window.removeEventListener('scroll',queue);
      window.removeEventListener('resize',queue);
      window.removeEventListener('pointermove',move);
      if(raf)cancelAnimationFrame(raf);
      if(pointerRaf)cancelAnimationFrame(pointerRaf);
      document.documentElement.style.removeProperty('--fl-compose-reveal');
    };
  },[onSceneChange,reduceMotion]);
  const available=()=>Math.max(0,document.documentElement.scrollHeight-window.innerHeight);
  const goToChapter=n=>window.scrollTo({top:available()*[0,.26,.46,.67,.875][n],behavior:reduceMotion?'instant':'smooth'});
  return <section ref={root} className={'fl-world fl-scroll-story fl-chapter-'+frame} aria-label="Frontline UX/UI cinematic scroll introduction">
    <div className="fl-atmosphere" aria-hidden="true">
      <div className="fl-sky"/><div className="fl-grain"/><div className="fl-aura"/>
      <div className="fl-architecture">
        <div className="fl-outer-arch"/><div className="fl-inner-arch"/>
        <div className="fl-cliff fl-cliff-left"/><div className="fl-cliff fl-cliff-right"/>
        <div className="fl-column fl-column-left"/><div className="fl-column fl-column-right"/>
        <div className="fl-floor"/>
      </div>
      <div className="fl-sun-wrap">
        <div className="fl-sun-halo"/><div className="fl-sun"><SolarFluidCanvas mode="sun"/></div>
      </div>
      <div className="fl-basin"><div className="fl-water">
        <SolarFluidCanvas mode="water"/><div className="fl-sun-reflection"/>
        <div className="fl-ripple fl-ripple-a"/><div className="fl-ripple fl-ripple-b"/><div className="fl-ripple fl-ripple-c"/>
      </div></div>
      <div className="fl-clouds"/><div className="fl-shimmer"/>
    </div>
    <div className="fl-story-paper" aria-hidden="true">
      <div className="fl-story-paper-light"/>
      <div className="fl-story-paper-grid"/>
    </div>
    <div className="fl-story-topline" aria-hidden="true"><span>FRONTLINE / AN ORIGINAL DESIGN EXPERIENCE</span><span>EST. MMXXVI</span></div>
    {CHAPTERS.map((chapter,i)=><article key={chapter.no} className={'fl-story-scene fl-story-scene-'+i+(frame===i?' is-current':'')}
      aria-hidden={frame!==i} style={{
        '--fl-this-opacity':'var(--fl-scene-opacity-'+i+')',
        '--fl-this-enter':'var(--fl-scene-enter-'+i+')'
      }}>
      <div className="fl-story-scene-inner">
        <p className="fl-story-kicker"><span className="fl-overline-dot"/>{chapter.overline}</p>
        <h1 className="fl-story-heading">
          {chapter.headline.map((line,j)=><span className={'fl-story-heading-line'+(j===1?' fl-story-italic-line':'')} key={j}>
            <KineticText value={line} base={j*4}/>
          </span>)}
          {i===0&&<span className="fl-story-first-accent"><KineticText value={chapter.accent} base={5}/></span>}
        </h1>
        <p className="fl-story-accent">{chapter.accent}</p>
        <p className="fl-story-description">{chapter.description}</p>
        {i>0&&i<4&&<button className="fl-story-action" type="button" tabIndex={frame===i?0:-1}
          onClick={()=>onMode?.(chapter.mode)}>Explore {chapter.mode==='fusion'?'Design Fusion':chapter.mode==='select'?'Select UI/UX':'Generate UI/UX'}
          <ArrowUpRight size={16} aria-hidden="true"/></button>}
      </div>
      <div className="fl-story-footnote">{chapter.subtitle}<span>0{Math.min(i+1,5)} / 05</span></div>
    </article>)}
    <div className="fl-spiral-stage" aria-hidden="true">
      <div className="fl-spiral-aura"/>
      <svg className="fl-spiral-art" viewBox="0 0 900 900" role="img" aria-label="Rotating Frontline typographic golden spiral">
        <defs>
          <path id="fl-spiral-type-path" d={SPIRAL_PATH}/>
          <radialGradient id="fl-spiral-centre" cx="33%" cy="27%" r="76%">
            <stop offset="0%" stopColor="#fff8c5"/><stop offset="38%" stopColor="#ffda86"/>
            <stop offset="76%" stopColor="#d99a5f"/><stop offset="100%" stopColor="#a86746"/>
          </radialGradient>
        </defs>
        {[133,235,322,412].map(r=><circle key={r} cx="450" cy="450" r={r} fill="none"
          stroke="#a57754" strokeOpacity={r===412?.20:.36} strokeWidth={r===412?1.5:1}/>)}
        <path d={SPIRAL_PATH} stroke="#b58c6c" strokeOpacity=".14" strokeWidth="26" fill="none"/>
        <text className="fl-spiral-type">
          <textPath href="#fl-spiral-type-path" startOffset="0%">{SPIRAL_WORDS}</textPath>
        </text>
        <circle cx="450" cy="450" r="70" fill="url(#fl-spiral-centre)"/>
        <circle cx="450" cy="450" r="83" stroke="#d8a16c" strokeOpacity=".5" strokeWidth="1" fill="none"/>
        <circle cx="450" cy="450" r="4" fill="#fff1cb"/>
      </svg>
    </div>
    <div className="fl-story-corner fl-story-corner-left">DESIGN, IN AN INFINITE FIELD <FrontlineMark size={21}/></div>
    <div className="fl-story-corner fl-story-corner-right">THINK · CHOOSE · CREATE</div>
    <nav className="fl-chapter-nav fl-story-nav" aria-label="Landing page chapters">
      {CHAPTERS.map((c,i)=><button type="button" key={c.no} onClick={()=>goToChapter(i)}
        className={frame===i?'is-current':''} title={c.overline}
        aria-label={'Go to '+c.overline} aria-current={frame===i?'step':undefined}>
        <span className="fl-nav-line"/><span className="fl-nav-number">{c.no}</span>
      </button>)}
    </nav>
    <div className="fl-story-scroll-guide" aria-hidden="true">
      <span>{frame===4?'KEEP SCROLLING · YOUR STUDIO IS EMERGING':'SCROLL TO EXPLORE'}</span><ArrowDown size={14}/>
    </div>
  </section>;
}
