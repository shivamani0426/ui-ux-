import React,{useState} from 'react';
import {AlertTriangle,ArrowUpRight,CheckCircle2,CloudOff,KeyRound,LockKeyhole,
  LogOut,RefreshCw,ShieldAlert,ShieldCheck,Smartphone,UserRoundX} from 'lucide-react';
import './FrontlineSecurity.css';

const phrase='DELETE FRONTLINE ACCOUNT';

export default function FrontlineSecurity({auth,security,onRefresh,onReverify,onOtherDevices,
  onEveryDevice,onDeleteAccount,onLearning,loading=false,busy=false}){
  const [email,setEmail]=useState('');
  const [confirmation,setConfirmation]=useState('');
  const [understood,setUnderstood]=useState(false);
  const [showDelete,setShowDelete]=useState(false);
  const account=auth?.authenticated===true;
  const canDelete=account&&security?.accountDeletionAvailable===true;
  const recent=security?.recentGoogleVerification===true;
  const valid=canDelete&&recent&&understood&&email===auth.user?.email&&confirmation===phrase;
  return <section className="fl-security-root" aria-label="Account security and privacy">
    <div className="fl-security-hero">
      <div className="fl-account-eyebrow"><ShieldCheck size={14}/> ACCOUNT PROTECTION</div>
      <h3>In your <em>control.</em></h3>
      <p>Manage connected sessions, recover access with Google, and control what happens to your private designs.</p>
      <span className="fl-security-status">{account?<><CheckCircle2 size={14}/> Google identity verified</>:
        <><CloudOff size={14}/> Guest session · sign in to manage devices</>}</span>
    </div>
    {account?<div className="fl-security-section">
      <h4><Smartphone size={17}/> Device sessions</h4>
      <p>Sign out of another device you've lost, or end all of your Frontline sessions. Your saved projects stay in your account.</p>
      <button className="fl-security-action" type="button" onClick={onOtherDevices} disabled={busy}>
        <RefreshCw size={17}/><span><strong>Sign out other devices</strong><small>Keep this browser signed in</small></span><ArrowUpRight size={16}/>
      </button>
      <button className="fl-security-action fl-security-warn" type="button" onClick={onEveryDevice} disabled={busy}>
        <LogOut size={17}/><span><strong>Sign out everywhere</strong><small>End this device and every other session</small></span><ArrowUpRight size={16}/>
      </button>
      <p className="fl-security-note">Revoked access tokens may remain usable until expiry unless strict session checks are enabled. Use sign out everywhere if a device is lost.</p>
    </div>:<div className="fl-security-section">
      <h4><KeyRound size={17}/> Recover your workspace</h4>
      <p>Sign in with the same Google account on any device to restore your projects, design preferences and chat history.</p>
      <button className="fl-security-action" type="button" onClick={onReverify} disabled={busy}>
        <KeyRound size={17}/><span><strong>Continue with Google</strong><small>Return to your existing Frontline account</small></span><ArrowUpRight size={16}/>
      </button>
    </div>}
    <div className="fl-security-section">
      <h4><ShieldCheck size={17}/> Private data</h4>
      <p>Your conversations are account-scoped and never made public. You can export your data or erase your workspace separately from your Google account.</p>
      <button className="fl-security-action" type="button" onClick={onLearning}>
        <ShieldCheck size={17}/><span><strong>Learning & privacy controls</strong><small>Export, reset or delete your workspace data</small></span><ArrowUpRight size={16}/>
      </button>
    </div>
    {account&&<div className="fl-security-section fl-security-danger">
      <h4><UserRoundX size={17}/> Permanently delete Frontline account</h4>
      <p>This is different from deleting your designs. Once confirmed, Frontline will remove your workspace, personal preferences and Supabase sign-in identity. It does not delete your Google account.</p>
      {!canDelete?<div className="fl-security-unavailable" role="status">
        <LockKeyhole size={18}/>
        <span>Permanent account deletion is not available until the server-only Supabase administrator credential and verification key are configured. Your account and data have not been changed. You can still erase your workspace in Learning & privacy.</span>
      </div>:<>
        <div className="fl-security-verification">
          <span>{recent?<CheckCircle2 size={16}/>:<ShieldAlert size={16}/>}
            {recent?'Recent Google verification confirmed':'Verify your Google account again before account deletion'}
          </span>
          <button type="button" onClick={onReverify} disabled={busy}>
            {recent?'Verify again':'Reverify with Google'} <ArrowUpRight size={13}/>
          </button>
        </div>
        <button className="fl-security-delete-toggle" type="button" onClick={()=>setShowDelete(x=>!x)}
          aria-expanded={showDelete} disabled={busy}>
          <AlertTriangle size={16}/> {showDelete?'Hide permanent deletion confirmation':'I want to permanently delete my account'}
        </button>
        {showDelete&&<form className="fl-security-confirmation" onSubmit={event=>{
          event.preventDefault();
          if(valid)onDeleteAccount({email,confirmation});
        }}>
          <p>Before deleting, download your workspace archive from My Google account. This action cannot be undone.</p>
          <label>Type your signed-in email
            <input type="email" autoComplete="off" spellCheck={false}
              value={email} onChange={e=>setEmail(e.target.value)}
              placeholder={auth.user?.email||'Your account email'}/>
          </label>
          <label>Type <code>{phrase}</code>
            <input autoComplete="off" spellCheck={false}
              value={confirmation} onChange={e=>setConfirmation(e.target.value)}
              placeholder={phrase}/>
          </label>
          <label className="fl-security-checkbox">
            <input type="checkbox" checked={understood} onChange={e=>setUnderstood(e.target.checked)}/>
            <span>I understand that my projects, saved chats, preferences and Frontline login identity will be permanently removed.</span>
          </label>
          <button type="submit" className="fl-security-delete" disabled={!valid||busy}>
            <UserRoundX size={17}/> {busy?'Processing deletion…':'Permanently delete my Frontline account'}
          </button>
        </form>}
      </>}
    </div>}
    <div className="fl-security-footer">
      <button type="button" onClick={onRefresh} disabled={loading||busy}>
        <RefreshCw size={14} className={loading?'spin':''}/> {loading?'Checking security status':'Refresh security status'}
      </button>
      <p>Google controls recovery of your Google identity. Frontline does not store Google passwords.</p>
    </div>
  </section>;
}
