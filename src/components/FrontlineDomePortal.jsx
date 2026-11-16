import React, {useRef} from 'react';
import FrontlineMark from './FrontlineMark.jsx';
import './FrontlineDomePortal.css';

/**
 * Frontline's original pre-landing cinematic dome.
 * A deliberate click/tap (not hover or pointer-down) charges a white halo,
 * then the parent progressively reveals the existing landing inside-out.
 */
export default function FrontlineDomePortal({phase='idle',onEnter}){
  const started=useRef(false);
  const enter=()=>{
    if(started.current||phase!=='idle')return;
    started.current=true;
    onEnter?.();
  };
  const charging=phase==='charging';
  const opening=phase==='opening';
  return <section className={'fl-dome-portal'+(charging?' is-charging':'')+(opening?' is-opening':'')}
    role="region" aria-label="Frontline cinematic black dome entrance" data-phase={phase}>
    <div className="fl-dome-ambient" aria-hidden="true"/>
    <div className="fl-dome-gate-copy" aria-hidden="true">
      <span>FRONTLINE / DESIGN UNIVERSE</span>
      <span>THE FIRST LIGHT · MMXXVI</span>
    </div>
    <div className="fl-dome-centre">
      <span className="fl-dome-overline">AN EXPERIENCE BEYOND THE ORDINARY</span>
      <h1 className="fl-dome-title">Beyond the <em>visible.</em></h1>
      <button type="button" className="fl-dome-trigger"
        aria-label="Click the black dome to ignite its white light and enter Frontline"
        onClick={enter} disabled={phase!=='idle'}>
        <span className="fl-dome-disc" aria-hidden="true">
          <span className="fl-dome-ring fl-dome-ring-outer"/>
          <span className="fl-dome-ring fl-dome-ring-middle"/>
          <span className="fl-dome-ring fl-dome-ring-inner"/>
          <span className="fl-dome-white-aura"/>
          <span className="fl-dome-portal-orb">
            <span className="fl-dome-shell-shine"/>
            <span className="fl-dome-embossed-mark"><FrontlineMark size={57}/></span>
          </span>
          <span className="fl-dome-floor-reflection"/>
        </span>
      </button>
      <p className="fl-dome-instruction" aria-live="polite">
        {charging?'LIGHT IS GATHERING…':opening?'A UNIVERSE IS UNFOLDING…':'CLICK THE DOME TO ENTER'}
      </p>
      <p className="fl-dome-subline">A single touch. An infinite horizon.</p>
      <span className="fl-dome-keyboard-hint">Use Enter or Space to enter</span>
    </div>
    <div className="fl-dome-bottom" aria-hidden="true">
      <span>THE ART OF A NEW BEGINNING</span><span>001 / ∞</span>
    </div>
    <div className="fl-dome-aperture-flare" aria-hidden="true"/>
  </section>;
}
