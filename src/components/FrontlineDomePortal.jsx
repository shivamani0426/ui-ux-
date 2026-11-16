import React, {useRef} from 'react';
import './FrontlineDomePortal.css';

// A single, original, 3D F-shaped architectural sculpture.
// Entire entrance is visual only; the button keeps its accessible name.
const F_PATH='M91 45 Q80 45 80 57 V300 Q80 313 93 313 H126 Q139 313 139 300 V207 H227 Q238 207 238 196 V165 Q238 154 227 154 H139 V108 H264 Q276 108 276 96 V57 Q276 45 264 45 Z';

export default function FrontlineDomePortal({phase='idle',onEnter}){
  const started=useRef(false);
  const enter=()=>{
    if(started.current||phase!=='idle')return;
    started.current=true;
    onEnter?.();
  };
  return <section className={'fl-dome-portal'+(phase==='charging'?' is-charging':'')+(phase==='opening'?' is-opening':'')}
    role="region" aria-label="Frontline entrance" data-phase={phase}>
    <div className="fl-dome-ambient" aria-hidden="true"/>
    <div className="fl-dome-centre">
      <button type="button" className="fl-dome-trigger"
        aria-label="Click the black F sculpture to enter Frontline"
        onClick={enter} disabled={phase!=='idle'}>
        <span className="fl-dome-disc" aria-hidden="true">
          <span className="fl-dome-white-aura"/>
          <span className="fl-dome-ring fl-dome-ring-outer"/>
          <span className="fl-dome-ring fl-dome-ring-middle"/>
          <span className="fl-dome-ring fl-dome-ring-inner"/>
          <span className="fl-dome-portal-orb">
            <svg className="fl-dome-f-sculpture" viewBox="0 0 360 370" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <defs>
                <linearGradient id="fl-f-front" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#242528"/>
                  <stop offset=".26" stopColor="#101113"/>
                  <stop offset=".57" stopColor="#090a0c"/>
                  <stop offset="1" stopColor="#010102"/>
                </linearGradient>
                <linearGradient id="fl-f-bevel" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#45474b"/>
                  <stop offset=".3" stopColor="#222428"/>
                  <stop offset=".68" stopColor="#111214"/>
                  <stop offset="1" stopColor="#050506"/>
                </linearGradient>
                <linearGradient id="fl-f-side" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#202124"/>
                  <stop offset=".5" stopColor="#0b0c0e"/>
                  <stop offset="1" stopColor="#010102"/>
                </linearGradient>
                <linearGradient id="fl-f-light-streak" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#ffffff" stopOpacity=".40"/>
                  <stop offset=".42" stopColor="#e5e8ed" stopOpacity=".10"/>
                  <stop offset="1" stopColor="#ffffff" stopOpacity="0"/>
                </linearGradient>
              </defs>
              <g className="fl-f-extrusion">
                <path d={F_PATH} transform="translate(15 19)" fill="#010101" stroke="#0a0a0b" strokeWidth="2"/>
                <path d={F_PATH} transform="translate(11 14)" fill="url(#fl-f-side)" stroke="#202125" strokeWidth="1.5"/>
              </g>
              <g className="fl-f-body">
                <path d={F_PATH} fill="url(#fl-f-bevel)" stroke="#3b3d41" strokeWidth="2.8" strokeLinejoin="round"/>
                <path d={F_PATH} transform="translate(3.2 3.3) scale(.971 .976)" fill="url(#fl-f-front)" stroke="#070808" strokeWidth="1.7" strokeLinejoin="round"/>
                <path d="M93 53 L93 299 M94 56 H262 M136 160 H227 M136 202 H225"
                  fill="none" stroke="url(#fl-f-light-streak)" strokeWidth="2.2" strokeLinecap="round"/>
                <path d="M133 302 V203 H230 M139 104 H266"
                  fill="none" stroke="#08090b" strokeOpacity=".85" strokeWidth="3" strokeLinecap="round"/>
              </g>
            </svg>
          </span>
          <span className="fl-dome-floor-reflection"/>
        </span>
      </button>
    </div>
    <div className="fl-dome-aperture-flare" aria-hidden="true"/>
  </section>;
}
