import React from 'react';
import './FrontlineOrbIntro.css';

/**
 * Automatic, content-free opening: a single black singularity at screen
 * centre, adapted from our existing login's fl-blackhole-disc transition.
 * No F sculpture, no instructions and no click or scroll gate.
 */
export default function FrontlineOrbIntro(){
  return <div className="fl-orb-intro" aria-hidden="true" data-opening="black-orb">
    <div className="fl-orb-intro-glow"/>
    <div className="fl-orb-intro-disc"/>
  </div>;
}
