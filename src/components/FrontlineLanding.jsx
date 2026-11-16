import React, { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUpRight } from 'lucide-react';
import SolarFluidCanvas from './SolarFluidCanvas.jsx';
import './FrontlineLanding.css';

// Original Frontline visual scene: no artwork, fonts or animation code copied from the reference.
const CHAPTERS = [
  { no: '00', overline: 'AN INTRODUCTION TO DESIGN INTELLIGENCE', title: 'FRONTLINE', accent: 'UX / UI', note: 'Every extraordinary interface starts with a direction.', action: 'Enter the studio', mode: null },
  { no: '01', overline: 'DISCOVER / SELECT UI & UX', title: 'Find your', accent: 'direction.', note: 'Explore curated design references, see why they fit, and choose the visual language that feels right.', action: 'Explore design directions', mode: 'select' },
  { no: '02', overline: 'IMAGINE / GENERATE UI & UX', title: 'Shape the', accent: 'unexpected.', note: 'Turn a plain-language brief into original design guidance, visual possibilities, and an inspired starting point.', action: 'Explore creative ideas', mode: 'generate' },
  { no: '03', overline: 'COMBINE / DESIGN FUSION', title: 'Better', accent: 'together.', note: 'Select your favorite ideas, bring their strengths into one composition, and carry forward a unified build brief.', action: 'Try Design Fusion', mode: 'fusion' },
  { no: '04', overline: 'REFINE / DESIGN PREFERENCES', title: 'Make it', accent: 'yours.', note: 'Compare concepts, shape your own design preferences, and continue where your last conversation left off.', action: 'Start designing', mode: null }
];

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
export default function FrontlineLanding({ onBegin, onMode, onSceneChange }) {
  const root = useRef(null);
  const frameRef = useRef(0);
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    let raf = 0;
    let lastPointerX = 0, lastPointerY = 0;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    const update = () => {
      raf = 0;
      const available = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const p = clamp(window.scrollY / available, 0, 1);
      root.current?.style.setProperty('--fl-progress', p.toFixed(5));
      root.current?.style.setProperty('--fl-scroll-lift', (p * 15).toFixed(2) + 'vh');
      root.current?.style.setProperty('--fl-cloud-drift', (p * 28).toFixed(2) + 'vw');
      root.current?.style.setProperty('--fl-orb-scale', (1 - p * .37).toFixed(4));
      const next = Math.min(4, Math.floor(p * 5));
      if (next !== frameRef.current) {
        frameRef.current = next;
        setFrame(next);
        onSceneChange?.(next);
      }
    };
    const queue = () => { if (!raf) raf = window.requestAnimationFrame(update); };
    const move = event => {
      if (reduce || !root.current || event.pointerType === 'touch') return;
      const x = (event.clientX / window.innerWidth - .5) * 2;
      const y = (event.clientY / window.innerHeight - .5) * 2;
      if (Math.abs(x-lastPointerX) < .005 && Math.abs(y-lastPointerY) < .005) return;
      lastPointerX = x; lastPointerY = y;
      root.current.style.setProperty('--fl-pointer-x', x.toFixed(3));
      root.current.style.setProperty('--fl-pointer-y', y.toFixed(3));
      root.current.style.setProperty('--fl-mx', (x * 13).toFixed(2) + 'px');
      root.current.style.setProperty('--fl-my', (y * 9).toFixed(2) + 'px');
      root.current.style.setProperty('--fl-arch-x', (-x * 12).toFixed(2) + 'px');
      root.current.style.setProperty('--fl-arch-y', (-y * 6).toFixed(2) + 'px');
    };
    window.addEventListener('scroll', queue, { passive: true });
    window.addEventListener('resize', queue, { passive: true });
    window.addEventListener('pointermove', move, { passive: true });
    queue();
    return () => {
      window.removeEventListener('scroll', queue);
      window.removeEventListener('resize', queue);
      window.removeEventListener('pointermove', move);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [onSceneChange]);
  const chapter = CHAPTERS[frame];
  const choose = (mode) => { if (mode) onMode?.(mode); else onBegin?.(); };
  const goToChapter = n => {
    const available = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    window.scrollTo({ top: n === 4 ? available : (n + .05) / 5 * available, behavior: 'smooth' });
  };
  return <section ref={root} className={`fl-world fl-chapter-${frame}`} aria-label="Frontline UX/UI immersive design introduction">
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
        <SolarFluidCanvas mode="water"/>
        <div className="fl-sun-reflection"/>
        <div className="fl-ripple fl-ripple-a"/><div className="fl-ripple fl-ripple-b"/><div className="fl-ripple fl-ripple-c"/>
      </div></div>
      <div className="fl-clouds"/>
      <div className="fl-shimmer"/>
    </div>
    <div className="fl-corner-label fl-corner-left">AN INFINITE FIELD OF POSSIBILITY <span>✳</span></div>
    <div className="fl-corner-label fl-corner-right">DESIGN INTELLIGENCE — EST. 2026</div>
    <div className="fl-chapter-content" key={chapter.no} aria-live="off">
      <p className="fl-overline"><span className="fl-overline-dot"/> {chapter.overline}</p>
      <div className="fl-headline" aria-label={chapter.title + ' ' + chapter.accent}>
        <span className="fl-headline-main">{chapter.title}</span>
        <span className="fl-headline-accent">{chapter.accent}</span>
      </div>
      <p className="fl-note">{chapter.note}</p>
      <button className="fl-cta" onClick={() => choose(chapter.mode)}>
        <span>{chapter.action}</span><ArrowUpRight size={17} aria-hidden="true"/>
      </button>
    </div>
    <div className="fl-edge-counter"><strong>{chapter.no}</strong><span>/ 04</span></div>
    <nav className="fl-chapter-nav" aria-label="Landing page chapters">
      {CHAPTERS.map((c,i) => <button type="button" key={c.no} onClick={() => goToChapter(i)}
        className={frame===i?'is-current':''} title={c.overline} aria-label={'Go to '+c.overline} aria-current={frame===i?'step':undefined}>
        <span className="fl-nav-line"/><span className="fl-nav-number">{c.no}</span>
      </button>)}
    </nav>
    <div className="fl-scroll-guide" aria-hidden="true"><span>{frame===4?'YOUR IDEAS, IN MOTION':'SCROLL TO DISCOVER'}</span><ArrowDown size={15}/></div>
  </section>;
}
