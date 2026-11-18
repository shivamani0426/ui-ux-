import React from 'react';
import {ArrowLeft,ArrowUpRight,LockKeyhole,ShieldCheck,Sparkles} from 'lucide-react';
import StarBorder from './StarBorder.jsx';
import FrontlineMark from './FrontlineMark.jsx';
import './FrontlineLogin.css';

/** Branded account entry; the server verifies Google identity and private data ownership. */
export default function FrontlineLogin({onBack,onGuest,onGoogle,googleReady=false,authError='',onRetrySync}){
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
        <ArrowLeft size={15} aria-hidden="true"/> Back to home
      </button>
    </header>
    <main className="fl-login-layout">
      <div className="fl-login-editorial">
        <span className="fl-login-overline"><span className="fl-login-overline-dot"/>WELCOME TO FRONTLINE</span>
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
          <p className="fl-login-card-copy">Continue with Google to log in or create your Frontline account. Or explore the studio as a guest.</p>
          <StarBorder as="div" className="fl-login-google-star" theme="light"
            backgroundColor="#ffffff" textColor="#223858" borderColor="#b5c9f3"
            color="#a9c7ff" trailColor="#6e96e5" radius={19} thickness={1.5}
            duration={4.8} trailLength={0.35} glow={0.85} stars={2} hover="lap" sparkle>
            <button type="button" className="fl-login-google" disabled={!googleReady} onClick={onGoogle}>
              <span className="fl-google-letter" aria-hidden="true">G</span>
              Continue with Google
              <ArrowUpRight size={17} aria-hidden="true"/>
            </button>
          </StarBorder>
          {!googleReady&&<p className="fl-login-availability" role="status"><LockKeyhole size={14} aria-hidden="true"/> Google sign-in is awaiting secure provider configuration. Guest access remains available.</p>}
          {authError&&<div className="fl-login-availability" role={['signed_out','account_deleted'].includes(authError)?'status':'alert'}>
            <LockKeyhole size={14} aria-hidden="true"/>
            <span>{authError==='signed_out'?'You have signed out of Frontline. Your private projects remain saved.':
              authError==='account_deleted'?'Your Frontline account and workspace have been deleted. Your Google account remains untouched.':
              authError==='sync_failed'?'Your Google sign-in succeeded, but guest projects could not be transferred. Your guest data is still safe.':
              authError==='not_configured'?'Google sign-in is not configured yet.':
              'Google sign-in was cancelled or could not complete. Please try again.'}</span>
          </div>}
          {authError==='sync_failed'&&<button type="button" className="fl-login-guest" onClick={onRetrySync}>Retry private project sync <ArrowUpRight size={18} aria-hidden="true"/></button>}
          <div className="fl-login-separator"><span/>OR TRY THE STUDIO FIRST<span/></div>
          <button type="button" className="fl-login-guest" onClick={onGuest}>
            <span>Enter Studio as Guest</span><ArrowUpRight size={18} aria-hidden="true"/>
          </button>
          <div className="fl-login-privacy"><ShieldCheck size={16} aria-hidden="true"/>
            <span>Guest work stays private to this browser. Google sign-in securely syncs your account projects across devices after connecting.</span>
          </div>
        </div>
        <p className="fl-login-under-card">A BETTER WAY TO DESIGN, TOGETHER.</p>
      </div>
    </main>
    <div className="fl-login-bottomline"><span>DESIGN MADE SIMPLE</span><span>FRONTLINE / DESIGN INTELLIGENCE</span></div>
  </section>;
}
