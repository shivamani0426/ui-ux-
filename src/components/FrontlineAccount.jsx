import React from 'react';
import {CheckCircle2,Cloud,CloudOff,Download,FolderKanban,Heart,Images,KeyRound,LockKeyhole,LogOut,RefreshCw,ShieldCheck,Sparkles,UserRound} from 'lucide-react';
import './FrontlineAccount.css';

const initials=(name)=>{
  const parts=String(name||'').trim().split(/\s+/).filter(Boolean);
  return (parts.length>1?parts[0][0]+parts.at(-1)[0]:parts[0]?.slice(0,2)||'G').toUpperCase();
};
const syncLabel=(lastSynced)=>{
  if(!lastSynced)return 'Not refreshed in this session';
  const date=new Date(lastSynced);
  return Number.isNaN(date.getTime())?'Not refreshed in this session':
    'Verified '+date.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
};

export default function FrontlineAccount({auth,overview,loading=false,lastSynced=null,
  onRefresh,onExport,onSignOut,onSignIn,onLearn,onClaim,onSecurity,exportBusy=false}){
  const account=auth?.authenticated===true;
  const user=auth?.user||{};
  const name=user.name?.trim()||user.email?.split('@')[0]||'Guest designer';
  const counts=[
    {icon:FolderKanban,label:'Design projects',value:overview?.projectCount},
    {icon:Images,label:'Saved inspirations',value:overview?.inspirationCount},
    {icon:Sparkles,label:'Design prompts',value:overview?.promptCount},
    {icon:Heart,label:'Feedback entries',value:overview?.feedbackCount}
  ];
  return <section className="fl-account-root" aria-label="My Frontline account">
    <div className="fl-account-hero">
      <div className="fl-account-eyebrow">{account?'YOUR CREATIVE IDENTITY':'YOUR PRIVATE SESSION'}</div>
      <div className="fl-account-person">
        <div className="fl-account-avatar" aria-hidden="true">
          {account&&user.picture?<img src={user.picture} alt="" referrerPolicy="no-referrer" loading="lazy"
            onError={e=>{e.currentTarget.style.display='none';}}/>:null}
          <span>{account?initials(name):<UserRound size={24}/>}</span>
        </div>
        <div className="fl-account-person-text">
          <strong title={name}>{name}</strong>
          <span title={user.email||''}>{account?user.email:'Continue designing without signing in'}</span>
        </div>
      </div>
      <div className="fl-account-status">
        {account?<><CheckCircle2 size={15}/> Connected with Google</>:<><CloudOff size={15}/> Browser-only guest identity</>}
      </div>
    </div>
    <div className="fl-account-sync" role="status">
      <div><Cloud size={17}/><span>{account?'Cross-device workspace':'Private browser workspace'}
        <small>{account?syncLabel(lastSynced):'Sign in to continue on another device'}</small></span></div>
      <button type="button" onClick={onRefresh} disabled={loading} aria-label="Refresh synced workspace">
        <RefreshCw size={16} className={loading?'spin':''}/>{loading?'Checking':'Refresh'}
      </button>
    </div>
    <div className="fl-account-stats" aria-label="Saved workspace summary">
      {counts.map(({icon:Icon,label,value})=><div className="fl-account-stat" key={label}>
        <Icon size={17} aria-hidden="true"/>
        <strong>{value===undefined?'—':value.toLocaleString()}</strong>
        <span>{label}</span>
      </div>)}
    </div>
    <p className="fl-account-section-label">YOUR CONTROLS</p>
    <div className="fl-account-actions">
      <button type="button" onClick={onExport} disabled={exportBusy}>
        <Download size={18}/><span><strong>{exportBusy?'Preparing your archive':'Download my private data'}</strong>
          <small>Projects, chats, prompts, feedback and preferences · JSON</small></span>
      </button>
      <button type="button" onClick={onSecurity}>
        <LockKeyhole size={18}/><span><strong>Account security & recovery</strong>
          <small>Connected devices, sign-out and protected account deletion</small></span>
      </button>
      <button type="button" onClick={onLearn}>
        <ShieldCheck size={18}/><span><strong>Learning & privacy</strong>
          <small>Personalization, aggregate consent and data deletion</small></span>
      </button>
      {account?<button type="button" onClick={onClaim}>
        <RefreshCw size={18}/><span><strong>Import this browser’s guest designs</strong>
          <small>Recover any unsynced local guest workspace safely</small></span>
      </button>:<button type="button" onClick={onSignIn}>
        <KeyRound size={18}/><span><strong>Sign in with Google</strong>
          <small>Access saved projects from your other devices</small></span>
      </button>}
      {account&&<button className="fl-account-logout" type="button" onClick={onSignOut}>
        <LogOut size={18}/><span><strong>Sign out of this device</strong><small>Keep sessions on other devices active</small></span>
      </button>}
    </div>
    <p className="fl-account-privacy-note">Your private conversations are never shared between accounts. Google authentication confirms your identity; deleting Frontline workspace data does not delete your Google account.</p>
  </section>;
}
