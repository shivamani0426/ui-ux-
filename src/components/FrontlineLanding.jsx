import React, {useEffect,useRef,useState} from 'react';
import {ArrowDown,ArrowUpRight,Pause,RotateCcw,SkipForward} from 'lucide-react';
import {useCinematicTour} from '../hooks/useCinematicTour.js';
import SolarFluidCanvas from './SolarFluidCanvas.jsx';
import FrontlineMark from './FrontlineMark.jsx';
import './FrontlineLanding.css';
import './FrontlineScrollStory.css';
import './FrontlineCinematicTour.css';

/* Original Frontline composition: user-provided Solare recording informs pacing,
 * oversized kinetic typography, golden sphere and editorial spiral, not source assets. */
const CHAPTERS=[
  {no:'00',overline:'A NEW ERA OF DESIGN INTELLIGENCE',headline:['FRONTLINE'],accent:'UX / UI',description:'A universe of extraordinary interfaces starts with one thought.',subtitle:'YOUR NEXT DESIGN BEGINS HERE',mode:null},
  {no:'01',overline:'01 / SELECT UI & UX',headline:['FIND YOUR','DIRECTION.'],accent:'Discover what fits.',description:'Explore curated real-world references. Understand the visual ideas behind every match. Save the inspirations worth carrying forward.',subtitle:'REAL REFERENCES · PERSONAL CHOICES',mode:'select'},
  {no:'02',overline:'02 / GENERATE UI & UX',headline:['A THOUGHT','BECOMES','A VISION.'],accent:'Words into wonder.',description:'Bring a simple brief. Shape an original, detailed design direction with structure, typography, interactions, and the human experience in mind.',subtitle:'FROM A BRIEF TO A CREATIVE BLUEPRINT',mode:'generate'},
  {no:'03',overline:'03 / DESIGN FUSION',headline:['MANY IDEAS.','ONE VISION.'],accent:'Designed to belong.',description:'Select different references and styles. Combine their strongest ideas into one cohesive, original direction—without copying another website.',subtitle:'SELECT · COMBINE · REFINE',mode:'fusion'},
  {no:'04',overline:'04 / DESIGN PREFERENCES · THE CREATIVE SPIRAL',headline:['IMAGINE','WHAT’S NEXT.'],accent:'Your story begins here.',description:'Every direction, every possibility, one space to create. Keep scrolling to reveal your design studio.',subtitle:'SCROLL TO REVEAL YOUR CANVAS',mode:null}
];
const clamp=(n,min=0,max=1)=>Math.max(min,Math.min(max,n));
// Quintic easing keeps each chapter still long enough to read, then softly hands
// the scene over. It is always driven by scroll position, never wall-clock time.
const ease=(a,b,p)=>{const t=clamp((p-a)/(b-a));return t*t*t*(t*(t*6-15)+10)};
// Extended chapters: slow entrances, a readable hold and a separate exit.
 // No simultaneous fade-in/fade-out between neighbouring feature headlines.
const SCENES=[
  {inStart:-1,inEnd:0,outStart:.158,outEnd:.195},
  {inStart:.203,inEnd:.285,outStart:.351,outEnd:.380},
  {inStart:.388,inEnd:.470,outStart:.535,outEnd:.568},
  {inStart:.576,inEnd:.662,outStart:.728,outEnd:.765},
  {inStart:.773,inEnd:.855,outStart:2,outEnd:3}
];
const CHAPTER_STARTS=[0,.203,.388,.576,.773];
const CHAPTER_STOPS=[0,.294,.482,.678,.855];

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

export default function FrontlineLanding({locked=false,effectsReady=false,onBegin,onMode,onSceneChange,onComposeReady}){
  const root=useRef(null),frameRef=useRef(0),readyRef=useRef(false);
  const [frame,setFrame]=useState(0);
  const [reduceMotion,setReduceMotion]=useState(false);
  const [fluidStage,setFluidStage]=useState(0);
  useEffect(()=>{
    const query=window.matchMedia?.('(prefers-reduced-motion: reduce)');
    setReduceMotion(Boolean(query?.matches));
    const onChange=()=>setReduceMotion(Boolean(query?.matches));
    query?.addEventListener?.('change',onChange);
    return()=>query?.removeEventListener?.('change',onChange);
  },[]);
  useEffect(()=>{
    if(!effectsReady){setFluidStage(0);return undefined;}
    // Do not compile either GPU shader behind the black portal. Stage the
    // subtle embellishments after reveal, while the CSS sun/water are complete.
    const sun=window.setTimeout(()=>setFluidStage(1),380);
    const water=window.setTimeout(()=>setFluidStage(2),1030);
    return ()=>{clearTimeout(sun);clearTimeout(water)};
  },[effectsReady]);
  const tour=useCinematicTour({enabled:!locked,reducedMotion});
  useEffect(()=>{
    let raf=0,pointerFrame=0,tx=0,ty=0,sx=0,sy=0;
    let scrollRange=1,previousReveal='';
    const previousStyles=new Map();
    const setStyle=(el,name,value)=>{if(previousStyles.get(name)!==value){el.style.setProperty(name,value);previousStyles.set(name,value)}};
    const update=()=>{
      raf=0;
      if(!root.current)return;
      const p=clamp(window.scrollY/scrollRange);
      const el=root.current;
      setStyle(el,'--fl-progress',p.toFixed(5));
      setStyle(el,'--fl-paper-progress',ease(.145,.206,p).toFixed(5));
      // Keep the original golden sphere steady during its own opening chapter.
      setStyle(el,'--fl-scroll-lift',(p*15).toFixed(2)+'vh');
      setStyle(el,'--fl-cloud-drift',(p*28).toFixed(2)+'vw');
      setStyle(el,'--fl-orb-scale',(1-p*.35).toFixed(4));
      // The spiral starts as a seed and takes almost two viewport heights
      // to mature. The chat starts much later, after the spiral has grown.
      const spiral=ease(.767,.947,p);
      setStyle(el,'--fl-spiral-progress',spiral.toFixed(5));
      setStyle(el,'--fl-spiral-opacity',ease(.773,.827,p).toFixed(5));
      setStyle(el,'--fl-spiral-turn',(spiral*316).toFixed(2)+'deg');
      const reveal=ease(.914,.999,p);
      const ready=reveal>=.75;
      if(ready!==readyRef.current){readyRef.current=ready;onComposeReady?.(ready);}
      const revealText=reveal.toFixed(5);
      if(revealText!==previousReveal){
        previousReveal=revealText;
        document.documentElement.style.setProperty('--fl-compose-reveal',revealText);
      }
      setStyle(el,'--fl-compose-reveal',revealText);
      for(let i=0;i<SCENES.length;i++){
        const s=SCENES[i];
        const enter=i===0?1:ease(s.inStart,s.inEnd,p);
        const exit=i===4?0:ease(s.outStart,s.outEnd,p);
        setStyle(el,'--fl-scene-enter-'+i,enter.toFixed(5));
        setStyle(el,'--fl-scene-opacity-'+i,((1-exit)*enter).toFixed(5));
        setStyle(el,'--fl-scene-shift-'+i,((1-enter)*108).toFixed(2)+'px');
        setStyle(el,'--fl-letter-shift-'+i,((1-enter)*112).toFixed(2)+'%');
        setStyle(el,'--fl-scene-scale-'+i,(0.966+enter*.034).toFixed(5));
      }
      const next=p>=CHAPTER_STARTS[4]?4:p>=CHAPTER_STARTS[3]?3:p>=CHAPTER_STARTS[2]?2:p>=CHAPTER_STARTS[1]?1:0;
      if(next!==frameRef.current){
        frameRef.current=next;
        setFrame(next);
        onSceneChange?.(next);
      }
    };
    const queue=()=>{if(!raf)raf=window.requestAnimationFrame(update)};
    const onResize=()=>{
      scrollRange=Math.max(1,document.documentElement.scrollHeight-window.innerHeight);
      queue();
    };
    const smoothPointer=()=>{
      pointerFrame=0;
      if(!root.current)return;
      sx+=(tx-sx)*.24;sy+=(ty-sy)*.24;
      root.current.style.setProperty('--fl-mx',(sx*13).toFixed(2)+'px');
      root.current.style.setProperty('--fl-my',(sy*9).toFixed(2)+'px');
      root.current.style.setProperty('--fl-arch-x',(-sx*12).toFixed(2)+'px');
      root.current.style.setProperty('--fl-arch-y',(-sy*6).toFixed(2)+'px');
      if(Math.abs(tx-sx)>.006||Math.abs(ty-sy)>.006)pointerFrame=requestAnimationFrame(smoothPointer);
    };
    const move=event=>{
      if(locked||reduceMotion||event.pointerType==='touch'||!root.current)return;
      tx=(event.clientX/Math.max(1,window.innerWidth)-.5)*2;
      ty=(event.clientY/Math.max(1,window.innerHeight)-.5)*2;
      if(!pointerFrame)pointerFrame=requestAnimationFrame(smoothPointer);
    };
    window.addEventListener('scroll',queue,{passive:true});
    window.addEventListener('resize',onResize,{passive:true});
    window.addEventListener('pointermove',move,{passive:true});
    scrollRange=Math.max(1,document.documentElement.scrollHeight-window.innerHeight);
    update();
    return()=>{
      window.removeEventListener('scroll',queue);
      window.removeEventListener('resize',onResize);
      window.removeEventListener('pointermove',move);
      if(raf)cancelAnimationFrame(raf);
      if(pointerFrame)cancelAnimationFrame(pointerFrame);
      document.documentElement.style.removeProperty('--fl-compose-reveal');
    };
  },[onSceneChange,onComposeReady,reduceMotion,locked]);
  const available=()=>Math.max(0,document.documentElement.scrollHeight-window.innerHeight);
  const goToChapter=n=>{
    tour.pause();
    window.scrollTo({top:available()*CHAPTER_STOPS[n],behavior:reduceMotion?'instant':'smooth'});
  };
  return <section ref={root} inert={locked} aria-hidden={locked} className={'fl-world fl-scroll-story fl-chapter-'+frame} aria-label="Frontline UX/UI cinematic scroll introduction">
    <div className="fl-atmosphere" aria-hidden="true">
      <div className="fl-sky"/><div className="fl-grain"/><div className="fl-aura"/>
      <div className="fl-architecture">
        <div className="fl-outer-arch"/><div className="fl-inner-arch"/>
        <div className="fl-cliff fl-cliff-left"/><div className="fl-cliff fl-cliff-right"/>
        <div className="fl-column fl-column-left"/><div className="fl-column fl-column-right"/>
        <div className="fl-floor"/>
      </div>
      <div className="fl-sun-wrap">
        <div className="fl-sun-halo"/><div className="fl-sun">{fluidStage>=1&&<SolarFluidCanvas mode="sun"/>}</div>
      </div>
      <div className="fl-basin"><div className="fl-water">
        {fluidStage>=2&&<SolarFluidCanvas mode="water"/>}<div className="fl-sun-reflection"/>
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
        '--fl-this-enter':'var(--fl-scene-enter-'+i+')',
        '--fl-this-rise':'var(--fl-scene-shift-'+i+')',
        '--fl-this-scale':'var(--fl-scene-scale-'+i+')',
        '--fl-this-letter-shift':'var(--fl-letter-shift-'+i+')'
      }}>
      <div className="fl-story-scene-inner">
        <p className="fl-story-kicker"><span className="fl-overline-dot"/>{chapter.overline}</p>
        <h1 className="fl-story-heading">
          {chapter.headline.map((line,j)=><span className={'fl-story-heading-line'+(i===0?' fl-headline-main':'')+(j===1?' fl-story-italic-line':'')} key={j}>
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
    <div className="fl-story-corner fl-story-corner-left">DESIGN, IN AN INFINITE FIELD <span className="fl-corner-monogram"><FrontlineMark size={21}/></span></div>
    <div className="fl-story-corner fl-story-corner-right">THINK · CHOOSE · CREATE</div>
    <nav className="fl-chapter-nav fl-story-nav" aria-label="Landing page chapters">
      {CHAPTERS.map((c,i)=><button type="button" key={c.no} onClick={()=>goToChapter(i)}
        className={frame===i?'is-current':''} title={c.overline}
        aria-label={'Go to '+c.overline} aria-current={frame===i?'step':undefined}>
        <span className="fl-nav-line"/><span className="fl-nav-number">{c.no}</span>
      </button>)}
    </nav>
    <div className="fl-story-scroll-guide" aria-hidden="true">
      <span>{tour.status==='playing'?'A GUIDED JOURNEY THROUGH DESIGN':
        frame===4?'YOUR STUDIO IS EMERGING':'SCROLL TO EXPLORE'}</span><ArrowDown size={14}/>
    </div>
    {!locked&&!reduceMotion&&<div className="fl-tour-ui" data-tour-state={tour.status}
      aria-label="Cinematic introduction controls">
      <span className="fl-tour-caption">{tour.status==='playing'?'CINEMATIC TOUR':
        tour.status==='completed'?'YOUR DESIGN STUDIO':'EXPLORE AT YOUR PACE'}</span>
      {tour.status==='playing'?
        <button type="button" onClick={tour.pause} aria-label="Pause cinematic tour">
          <Pause size={13} aria-hidden="true"/> Pause
        </button>:
        <button type="button" onClick={tour.replay} aria-label="Replay cinematic tour from beginning">
          <RotateCcw size={13} aria-hidden="true"/> Replay
        </button>}
      {tour.status==='playing'&&<button type="button" onClick={tour.skip}
        aria-label="Skip cinematic journey to design studio">
        <SkipForward size={13} aria-hidden="true"/> Skip
      </button>}
    </div>}
  </section>;
}
