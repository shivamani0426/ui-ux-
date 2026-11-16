import React, {useRef} from 'react';
import FrontlineMark from './FrontlineMark.jsx';
import './FrontlineDomePortal.css';

/**
 * An original, pre-landing golden dome portal.
 * Enter by hovering (mouse/pen) or touching (touchscreen) — no click required.
 * Keyboard users can focus the dome and press Enter/Space.
 * The parent owns the opening/done state so the cinematic story is preserved.
 */
export default function FrontlineDomePortal({opening=false,onEnter}){
  const opened=useRef(false);
  const enter=()=>{
    if(opened.current)return;
    opened.current=true;
    onEnter?.();
  };
  return <section className={'fl-dome-portal'+(opening?' is-opening':'')} role="region"
    aria-label="Frontline golden dome entrance">
    <div className="fl-dome-ambient" aria-hidden="true"/>
    <div className="fl-dome-gate-copy">
      <span className="fl-dome-edition">FRONTLINE / THE DESIGN UNIVERSE</span>
      <span className="fl-dome-index">EST. MMXXVI · ORIGINAL EXPERIENCE</span>
    </div>
    <div className="fl-dome-centre">
      <span className="fl-dome-overline">THE BEGINNING OF SOMETHING EXTRAORDINARY</span>
      <h1 className="fl-dome-title">An idea becomes <em>a universe.</em></h1>
      <button type="button" className="fl-dome-trigger"
        aria-label="Touch or hover over the golden dome to enter Frontline"
        disabled={opening}
        onPointerEnter={e=>{if(e.pointerType==='mouse'||e.pointerType==='pen')enter();}}
        onPointerDown={e=>{if(e.pointerType==='touch')enter();}}
        onTouchStart={enter}
        onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();enter();}}}>
        <span className="fl-dome-disc" aria-hidden="true">
          <span className="fl-dome-radial-lines"/>
          <span className="fl-dome-outer-ring"/>
          <span className="fl-dome-portal-orb">
            <span className="fl-dome-specular"/>
            <span className="fl-dome-contour fl-dome-contour-one"/>
            <span className="fl-dome-contour fl-dome-contour-two"/>
            <span className="fl-dome-contour fl-dome-contour-three"/>
            <span className="fl-dome-emblem"><FrontlineMark size={56}/></span>
          </span>
          <span className="fl-dome-base"/>
          <span className="fl-dome-light"/>
        </span>
      </button>
      <p className="fl-dome-instruction"><span className="fl-dome-instruction-pulse"/> HOVER OR TOUCH THE LIGHT <span className="fl-dome-instruction-pulse"/></p>
      <p className="fl-dome-subline">A golden gateway to your next design.</p>
      <span className="fl-dome-keyboard-hint">Keyboard: Tab to the dome, then Enter</span>
    </div>
    <div className="fl-dome-bottom"><span>DESIGN BEYOND THE ORDINARY</span><span>01 / ∞</span></div>
    <div className="fl-dome-aperture-flare" aria-hidden="true"/>
  </section>;
}
