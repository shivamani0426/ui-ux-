import React from 'react';
import {ArrowLeft,ArrowUpRight,LockKeyhole,ShieldCheck,Sparkles} from 'lucide-react';
import StarBorder from './StarBorder.jsx';
import FrontlineMark from './FrontlineMark.jsx';
import './FrontlineLogin.css';

/**
 * Cinematic account entry. Until the verified account identity / guest migration
 * backend is connected, Google sign-in is deliberately disabled rather than
 * treating a browser-local guest identity as a real account.
 */
export default function FrontlineLogin({onBack,onGuest,onGoogle,googleReady=false}){
  return <section className="fl-login-page" aria-label="Frontline login and guest entry">
    <div className="fl-login-atmosphere" aria-hidden="true">
      <div className="fl-login-horizon"/>
      <div className="fl-login-orb"><span className="fl-login-orb-inner"/></div>
      <div className="fl-login-ring fl-login-ring-one"/>
      <div className="fl-login-ring fl-login-ring-two"/>
      <div className="fl-login-starfield"/>
    </div>
    <header className="fl-login-header">
      <div className="fl-login-signature"><FrontlineMark size={30}/><span>FRONTLINE <small>UX / UI</small></span></div>
      <button type="button" className="fl-login-back" onClick={onBack}>
        <ArrowLeft size={15} aria-hidden="true"/> Back to the story
      </button>
    </header>
    <main className="fl-login-layout">
      <div className="fl-login-editorial">
        <span className="fl-login-overline"><span className="fl-login-overline-dot"/>THE NEXT CHAPTER / 2026</span>
        <h1>Design starts <em>with you.</em></h1>
        <p>Step inside a space where inspiration becomes direction, ideas find form, and every detail has a reason to exist.</p>
        <div className="fl-login-editorial-footer" aria-label="Frontline design workflows">
          <span>01 / SELECT</span><span>02 / GENERATE</span><span>03 / FUSE</span>
        </div>
      </div>
      <div className="fl-login-card-area">
        <div className="fl-login-card">
          <span className="fl-login-card-kicker"><Sparkles size={14} aria-hidden="true"/> YOUR CREATIVE SPACE</span>
          <h2>Welcome to <em>Frontline.</em></h2>
          <p className="fl-login-card-copy">Your next great interface begins here. Enter as a guest, or connect your account when secure sign-in is available.</p>
          <StarBorder as="div" className="fl-login-google-star" theme="dark"
            backgroundColor="#2b2325" textColor="#f7ead6" borderColor="#b98a61"
            color="#ffdfaa" trailColor="#c58155" radius={19} thickness={1.5}
            duration={4.8} trailLength={0.35} glow={0.85} stars={2} hover="lap" sparkle>
            <button type="button" className="fl-login-google" disabled={!googleReady} onClick={onGoogle}>
              <span className="fl-google-letter" aria-hidden="true">G</span>
              Continue with Google
              <ArrowUpRight size={17} aria-hidden="true"/>
            </button>
          </StarBorder>
          {!googleReady&&<p className="fl-login-availability" role="status"><LockKeyhole size={14} aria-hidden="true"/> Secure Google sign-in will be enabled after account setup. It is not active yet.</p>}
          <div className="fl-login-separator"><span/>OR STEP INTO THE STUDIO<span/></div>
          <button type="button" className="fl-login-guest" onClick={onGuest}>
            <span>Enter Studio as Guest</span><ArrowUpRight size={18} aria-hidden="true"/>
          </button>
          <div className="fl-login-privacy"><ShieldCheck size={16} aria-hidden="true"/>
            <span>Guest work stays private to this browser. Cross-device sync requires a future account connection.</span>
          </div>
        </div>
        <p className="fl-login-under-card">A LITTLE CURIOSITY. AN INFINITE CANVAS.</p>
      </div>
    </main>
    <div className="fl-login-bottomline"><span>CRAFTED FOR THE CURIOUS</span><span>FRONTLINE / DESIGN INTELLIGENCE</span></div>
  </section>;
}
