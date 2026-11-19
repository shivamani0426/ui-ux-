import React, {useEffect, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {ArrowUp, Check, CheckCheck, ChevronLeft, ChevronRight, Copy, Download, ExternalLink, Heart, Layers3, Menu, Moon, Plus, RotateCcw, Search, ShieldCheck, Sparkles, Sun, WifiOff, X} from 'lucide-react';
import TechText from './components/TechText.jsx';
import StarBorder from './components/StarBorder.jsx';
import FrontlineLanding from './components/FrontlineLanding.jsx';
import FrontlineLogin from './components/FrontlineLogin.jsx';
import FrontlineAccount from './components/FrontlineAccount.jsx';
import FrontlineSecurity from './components/FrontlineSecurity.jsx';
import FrontlineProjectLibrary from './components/FrontlineProjectLibrary.jsx';
import FrontlineOrbIntro from './components/FrontlineOrbIntro.jsx';
import FrontlineMark from './components/FrontlineMark.jsx';
import InspirationExplorer from './components/InspirationExplorer.jsx';
import DesignPromptPanel from './components/DesignPromptPanel.jsx';
import ProjectIntelligencePanel from './components/ProjectIntelligencePanel.jsx';
import ProjectWorkbench from './components/ProjectWorkbench.jsx';
import usePwaExperience from './hooks/usePwaExperience.js';
import MessageMarkdown from './components/MessageMarkdown.jsx';
import LearningPreferencesPanel from './components/LearningPreferencesPanel.jsx';
import './styles.css';
import './frontline-studio.css';
import './inspiration-explorer.css';
import './frontline-friendly-theme.css';

const api=async (path,options={})=>{
  const r=await fetch(path,{credentials:'same-origin',...options,headers:{...(options.body?{'Content-Type':'application/json'}:{}),...(options.headers||{})}});
  const data=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(data.error||'The request could not be completed.');
  return data;
};
const formats={minimal:'Minimal SaaS',glass:'Glass UI',creative:'Creative UI'};
const styleKeys=['minimal','glass','creative'];
const starterNotes=[
  'Design a minimalist student learning platform with an AI tutor and study dashboard.',
  'Create a modern portfolio with cinematic typography and delightful transitions.',
  'Plan an accessible health dashboard for appointments, patient care, and analytics.'
];
const safeRead=(key,fallback)=>{try{return localStorage.getItem(key)||fallback}catch{return fallback}};

function App(){
  // Compatibility view for legacy integration acceptance. Hidden from the
  // ordinary public journey; advanced features and stored data are preserved.
  const [advancedMode]=useState(()=>{
    try{
      if(new URLSearchParams(window.location.search).get('advanced')==='1')
        sessionStorage.setItem('frontline-advanced-view','1');
      return sessionStorage.getItem('frontline-advanced-view')==='1';
    }catch{return false;}
  });
  const pwa=usePwaExperience();
  const syncAttemptRef=useRef(0);
  const [theme,setTheme]=useState(()=>safeRead('uic-theme','light')==='dark'?'dark':'light');
  const [menuOpen,setMenuOpen]=useState(false);
  const [panel,setPanel]=useState('menu');
  const [mode,setMode]=useState(()=>location.pathname==='/login'?'login':location.pathname==='/studio'?'chat':'welcome');
  const [brief,setBrief]=useState('');
  const [project,setProject]=useState(null);
  const [messages,setMessages]=useState([]);
  const [retryClock,setRetryClock]=useState(()=>Date.now());
  const [catalog,setCatalog]=useState({styles:[],references:[]});
  const [projects,setProjects]=useState([]);
  const [profile,setProfile]=useState({styleWeights:{},globalOptIn:false,personalization:{enabled:true}});
  const [preferenceEvidence,setPreferenceEvidence]=useState([]);
  const [learningOverview,setLearningOverview]=useState(null);
  const [preferencesBusy,setPreferencesBusy]=useState(false);
  const [composerClearance,setComposerClearance]=useState(138);
  const [config,setConfig]=useState({aiEnabled:false,persistent:false});
  const [authState,setAuthState]=useState({googleEnabled:false,authenticated:false,user:null});
  const [authSecurity,setAuthSecurity]=useState(null);
  const [securityBusy,setSecurityBusy]=useState(false);
  const [securityLoading,setSecurityLoading]=useState(false);
  const [workspaceOverview,setWorkspaceOverview]=useState(null);
  const [nextProjectOffset,setNextProjectOffset]=useState(null);
  const [workspaceSyncing,setWorkspaceSyncing]=useState(false);
  const [workspaceLoadingMore,setWorkspaceLoadingMore]=useState(false);
  const [workspaceExporting,setWorkspaceExporting]=useState(false);
  const [lastSynced,setLastSynced]=useState(null);
  const [selected,setSelected]=useState(styleKeys);
  const [working,setWorking]=useState(false);
  const [intelligenceBusy,setIntelligenceBusy]=useState(false);
  const [toast,setToast]=useState('');
  const [feedback,setFeedback]=useState('');
  const [reaction,setReaction]=useState('like');
  const [designMode,setDesignMode]=useState('select');
  const [viewPreview,setViewPreview]=useState(false);
  const [mobilePreview,setMobilePreview]=useState(false);
  const [search,setSearch]=useState('');
  const [historyQuery,setHistoryQuery]=useState('');
  const [rise,setRise]=useState(false);
  const [landingFrame,setLandingFrame]=useState(0);
  const [landingComposerReady,setLandingComposerReady]=useState(false);
  const [portalState,setPortalState]=useState('opening');
  const [gatePhase,setGatePhase]=useState('');
  const endRef=useRef(null),textareaRef=useRef(null),scrollTimer=useRef(null),toastTimer=useRef(null),portalTimer=useRef(null),portalFinishTimer=useRef(null),composerDockRef=useRef(null),gateTimer=useRef(null);

  const notice=(message)=>{
    setToast(message);clearTimeout(toastTimer.current);
    toastTimer.current=setTimeout(()=>setToast(''),3800);
  };
  // GitHub OAuth status lives in a transient URL parameter. Never trust that
  // parameter as proof of account connection: verify against owner-scoped server
  // state before showing a success notification.
  useEffect(()=>{
    const url=new URL(window.location.href);
    const outcome=url.searchParams.get('github');
    if(!outcome)return;
    url.searchParams.delete('github');
    window.history.replaceState(window.history.state,'',url.pathname+url.search+url.hash);
    if(outcome==='connected'){
      api('/api/integrations/github').then(status=>{
        notice(status.connected&&status.login?
          'GitHub connected as '+status.login+'. Your approved designs can now be published.':
          'GitHub connection was not verified. Open Design handoff to reconnect.');
      }).catch(()=>notice('GitHub connection could not be verified. Try again.'));
      return;
    }
    const failures={
      invalid_state:'GitHub sign-in expired or was interrupted. Please reconnect securely.',
      login_required:'Sign in with Google before connecting GitHub.',
      connect_failed:'GitHub could not be connected. Check App installation and try again.',
      cancelled:'GitHub authorization was cancelled. Nothing was shared.'
    };
    if(Object.hasOwn(failures,outcome))notice(failures[outcome]);
  },[]);
  useEffect(()=>{
    const onHistory=()=>{
      clearTimeout(gateTimer.current);setGatePhase('');
      const path=window.location.pathname;
      setMode(path==='/login'?'login':path==='/studio'?'chat':'welcome');
      if(path!='/login'&&path!='/studio')setPortalState('done');
    };
    window.addEventListener('popstate',onHistory);
    return ()=>window.removeEventListener('popstate',onHistory);
  },[]);
  useEffect(()=>{
    document.documentElement.setAttribute('data-theme',theme);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content',theme==='dark'?'#151e32':'#f5f8ff');
    try{localStorage.setItem('uic-theme',theme)}catch{}
  },[theme]);
  useEffect(()=>{
    Promise.allSettled([
      api('/api/catalog').then(setCatalog),
      api('/api/projects').then(v=>{setProjects(v.projects||[]);setNextProjectOffset(v.nextOffset??null);}),
      api('/api/profile').then(setProfile),
      api('/api/config').then(setConfig),
      api('/api/auth/me').then(setAuthState),
      api('/api/auth/security').then(setAuthSecurity),
      api('/api/workspace/overview').then(setWorkspaceOverview)
    ]).then(results=>{
      if(results.some(x=>x.status==='rejected'))notice('Some workspace data could not be loaded. Open Account to refresh.');
      else setLastSynced(Date.now());
    });
    return ()=>{clearTimeout(scrollTimer.current);clearTimeout(toastTimer.current);clearTimeout(portalTimer.current);clearTimeout(portalFinishTimer.current);clearTimeout(gateTimer.current);};
  },[]);

  // M15: same-account project summaries reconcile on focus, reconnection and
  // a cross-tab change signal. Never overwrite a live editor or unsaved board.
  useEffect(()=>{
    if(!authState.authenticated)return;
    let disposed=false;
    let channel=null;
    const sync=async(force=false)=>{
      if(disposed||document.visibilityState==='hidden'||navigator.onLine===false)return;
      const now=Date.now();
      if(now-syncAttemptRef.current<(force?1500:45000))return;
      syncAttemptRef.current=now;
      try{
        const [list,summary]=await Promise.all([
          api('/api/projects'),api('/api/workspace/overview')
        ]);
        if(disposed)return;
        setProjects(list.projects||[]);
        setNextProjectOffset(list.nextOffset??null);
        setWorkspaceOverview(summary);
        setLastSynced(Date.now());
        window.dispatchEvent(new Event('frontline:workspace-maybe-updated'));
      }catch{/* Keep existing data and manual retry; never claim a successful sync. */}
    };
    const onFocus=()=>sync();
    const onVisible=()=>{if(document.visibilityState==='visible')sync()};
    const onOnline=()=>sync(true);
    try{
      if('BroadcastChannel' in window){
        channel=new BroadcastChannel('frontline-workspace-revisions');
        channel.onmessage=event=>{
          if(event.data?.type==='workspace-updated')sync(true);
        };
      }
    }catch{channel=null;}
    window.addEventListener('focus',onFocus);
    window.addEventListener('online',onOnline);
    document.addEventListener('visibilitychange',onVisible);
    return ()=>{
      disposed=true;channel?.close();
      window.removeEventListener('focus',onFocus);
      window.removeEventListener('online',onOnline);
      document.removeEventListener('visibilitychange',onVisible);
    };
  },[authState.authenticated]);

  // Only tick while a user-visible, rate-limited retry button is cooling down.
  // This does not make network requests or persist any API credentials.
  useEffect(()=>{
    if(!messages.some(m=>m.retryAfterUntil&&Date.parse(m.retryAfterUntil)>Date.now()))return;
    const ticker=setInterval(()=>setRetryClock(Date.now()),15000);
    return ()=>clearInterval(ticker);
  },[messages]);
  // ChatGPT-like one-line composer, expanding only for longer text; the existing
  // StarBorder, colors and cinematic landing use the same components as before.
  useEffect(()=>{
    if(mode!=='chat'||!textareaRef.current)return;
    const textarea=textareaRef.current;
    textarea.style.height='auto';
    textarea.style.height=Math.min(126,Math.max(36,textarea.scrollHeight))+'px';
  },[brief,mode]);
  useEffect(()=>{
    if(mode!=='chat'||!composerDockRef.current)return;
    const container=composerDockRef.current;
    const measure=()=>{
      const top=container.getBoundingClientRect().top;
      const next=Math.max(110,Math.ceil(window.innerHeight-top+8));
      setComposerClearance(previous=>previous===next?previous:next);
    };
    const observer=typeof ResizeObserver==='function'?new ResizeObserver(measure):null;
    observer?.observe(container);
    window.addEventListener('resize',measure);
    const frame=requestAnimationFrame(measure);
    return ()=>{observer?.disconnect();window.removeEventListener('resize',measure);cancelAnimationFrame(frame)};
  },[mode]);
  // One automatic centre-black-orb opening. No click, F-shaped sculpture,
  // scroll tour or delayed manual gate. Deep links to login/studio skip it.
  useEffect(()=>{
    if(mode!=='welcome'||portalState==='done')return undefined;
    const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    const beforeHTML=document.documentElement.style.overflow;
    const beforeBody=document.body.style.overflow;
    document.documentElement.style.overflow='hidden';
    document.body.style.overflow='hidden';
    const timer=setTimeout(()=>setPortalState('done'),reduced?300:1950);
    return ()=>{
      clearTimeout(timer);
      document.documentElement.style.overflow=beforeHTML;
      document.body.style.overflow=beforeBody;
    };
  },[mode,portalState]);
  useEffect(()=>{endRef.current?.scrollIntoView({behavior:'smooth',block:'end'});},[messages,working,viewPreview]);
  const active=mode==='chat';
  const isLanding=mode==='welcome';
  const routeTo=path=>{if(window.location.pathname!==path)window.history.pushState({},'',path);};
  const startGoogleLogin=()=>{if(authState.googleEnabled)window.location.assign('/auth/google/start');};
  // Supabase Google OAuth signs in returning users and securely creates the
  // account for first-time users; no separate password form or fake signup.
  const startGoogleSignup=()=>{
    if(authState.authenticated){enterGateway('studio');return;}
    if(authState.googleEnabled)window.location.assign('/auth/google/start?intent=signup');
    else enterGateway('login');
  };
  const signOut=async()=>{
    try{
      await api('/api/auth/logout',{method:'POST',body:JSON.stringify({scope:'local'})});
      window.location.assign('/login?auth=signed_out');
    }catch(error){notice(error.message);}
  };
  const refreshAuthSecurity=async()=>{
    setSecurityLoading(true);
    try{setAuthSecurity(await api('/api/auth/security'));}
    catch(error){notice('Unable to check your account security: '+error.message);}
    finally{setSecurityLoading(false);}
  };
  const openAccountSecurity=()=>{setPanel('security');refreshAuthSecurity();};
  const reverifyGoogle=()=>{
    if(authState.googleEnabled)window.location.assign('/auth/google/start?reauth=1');
    else notice('Google sign-in is currently unavailable. Retry from the login page.');
  };
  const signOutOtherDevices=async()=>{
    if(securityBusy)return;
    if(!window.confirm('Sign out of Frontline on your OTHER devices? You will remain signed in here.'))return;
    setSecurityBusy(true);
    try{
      await api('/api/auth/logout',{method:'POST',body:JSON.stringify({scope:'others'})});
      notice('Other sessions have been revoked. Their existing access tokens may remain valid until expiry.');
    }catch(error){notice('Could not revoke other sessions: '+error.message);}
    finally{setSecurityBusy(false);}
  };
  const signOutEveryDevice=async()=>{
    if(securityBusy)return;
    if(!window.confirm('Sign out of Frontline on EVERY device? Saved designs will be kept.'))return;
    setSecurityBusy(true);
    try{
      await api('/api/auth/logout',{method:'POST',body:JSON.stringify({
        scope:'global',confirmation:'SIGN OUT EVERYWHERE'
      })});
      window.location.assign('/login?auth=signed_out');
    }catch(error){notice('Could not sign out other devices: '+error.message);}
    finally{setSecurityBusy(false);}
  };
  const permanentlyDeleteAccount=async({email,confirmation})=>{
    if(securityBusy)return;
    setSecurityBusy(true);
    try{
      const result=await api('/api/auth/account',{method:'DELETE',body:JSON.stringify({email,confirmation})});
      if(result.accountDeleted)window.location.assign('/login?auth=account_deleted');
    }catch(error){
      // Do not hide the potential partial-deletion recovery instructions in
      // a short toast. Keep the modal and let the user retry safely.
      window.alert(error.message);
      refreshAuthSecurity();
    }finally{setSecurityBusy(false);}
  };
  const refreshWorkspace=async()=>{
    if(workspaceSyncing)return;
    setWorkspaceSyncing(true);
    try{
      const [me,history,preferences,summary]=await Promise.all([
        api('/api/auth/me'),api('/api/projects'),api('/api/preferences'),
        api('/api/workspace/overview')
      ]);
      setAuthState(me);
      setProjects(history.projects||[]);
      setNextProjectOffset(history.nextOffset??null);
      setProfile(preferences.profile);
      setPreferenceEvidence(preferences.evidence||[]);
      setLearningOverview(preferences.learning||null);
      setWorkspaceOverview(summary);
      setLastSynced(Date.now());
      notice('Your private workspace is up to date.');
    }catch(error){notice('Workspace refresh failed: '+error.message);}
    finally{setWorkspaceSyncing(false);}
  };
  const loadEarlierProjects=async()=>{
    if(nextProjectOffset===null||workspaceLoadingMore)return;
    setWorkspaceLoadingMore(true);
    try{
      const history=await api('/api/projects?offset='+nextProjectOffset);
      setProjects(previous=>{
        const found=new Set(previous.map(p=>p.id));
        return [...previous,...(history.projects||[]).filter(p=>!found.has(p.id))];
      });
      setNextProjectOffset(history.nextOffset??null);
    }catch(error){notice('Earlier projects could not be loaded: '+error.message);}
    finally{setWorkspaceLoadingMore(false);}
  };
  const exportWorkspace=async()=>{
    if(workspaceExporting)return;
    setWorkspaceExporting(true);
    try{
      const archive=await api('/api/workspace/export');
      const file=new Blob([JSON.stringify(archive,null,2)],{type:'application/json'});
      const url=URL.createObjectURL(file);
      const anchor=document.createElement('a');
      anchor.href=url;
      anchor.download='frontline-private-data-'+new Date().toISOString().slice(0,10)+'.json';
      document.body.appendChild(anchor);anchor.click();anchor.remove();
      setTimeout(()=>URL.revokeObjectURL(url),2000);
      notice('Your private Frontline data export is ready.');
    }catch(error){notice('Data export failed: '+error.message);}
    finally{setWorkspaceExporting(false);}
  };
  const retryGuestSync=async()=>{
    try{
      await api('/api/auth/claim',{method:'POST',body:'{}'});
      window.location.assign('/studio');
    }catch(error){notice('Could not sync your guest work: '+error.message);}
  };
  // Animate one composited portal, then reveal the destination. Authentication
  // is intentionally not simulated; the studio entry remains a genuine guest mode.
  const enterGateway=destination=>{
    if(gatePhase)return;
    const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    setGatePhase('expand-'+destination);
    clearTimeout(gateTimer.current);
    gateTimer.current=setTimeout(()=>{
      setMode(destination==='login'?'login':'chat');
      routeTo(destination==='login'?'/login':'/studio');
      window.scrollTo({top:0,behavior:'instant'});
      setGatePhase('reveal-'+destination);
      gateTimer.current=setTimeout(()=>setGatePhase(''),reduced?20:760);
    },reduced?20:1050);
  };
  const backToStory=()=>{
    clearTimeout(gateTimer.current);setGatePhase('');setMode('welcome');setPortalState('done');
    routeTo('/');window.scrollTo({top:0,behavior:'instant'});
  };
  const focusChat=()=>{
    if(!active){
      setMode('chat');setRise(false);routeTo('/studio');
      window.scrollTo({top:0,behavior:'instant'});
    }
  };
  const send=async(rawInput=brief)=>{
    // Read the focused textarea's value on submit. A welcome-to-studio focus
    // transition can render before React's brief state catches up in Firefox.
    const raw=String(rawInput??'').trim();
    if(working||raw.length<2){if(raw.length<2)notice('Describe what you want to design.');return;}
    focusChat();
    setBrief('');
    setWorking(true);
    setMenuOpen(false);
    setMessages(prev=>[...prev,{role:'user',content:raw,time:new Date().toISOString()}]);
    try{
      let current=project;
      const lastStage=messages.at(-1)?.flowStage;
      const consentReply=/^(yes|yes please|no|no thanks|no thank you|not now|nah|ok|okay|sure|yep|maybe)$/i.test(raw);
      // If a user enters a different problem after an offer, search the new
      // problem in a new private project instead of reusing stale old sources.
      if(!current||(!advancedMode&&(lastStage==='complete'||
        (lastStage==='offer-combination'&&!consentReply)))){
        const fullBrief=raw.length<15?'Design a thoughtful user interface based on this request: '+raw:raw;
        const r=await api('/api/projects',{method:'POST',body:JSON.stringify({brief:fullBrief})});
        current=r.project;
        setProject(current);
        setProjects(p=>[current,...p]);
        setViewPreview(false);
      }
      const out=await api('/api/projects/'+encodeURIComponent(current.id)+'/messages',{method:'POST',body:JSON.stringify({message:raw,styles:selected,simpleDiscovery:!advancedMode})});
      setMessages(out.messages||[]);
    }catch(e){
      setMessages(prev=>[...prev,{role:'assistant',content:'Something went wrong: '+e.message,source:'error'}]);
    }finally{setWorking(false);}
  };
  const newChat=()=>{
    setProject(null);setMessages([]);setBrief('');setSelected(styleKeys);setMode('welcome');setPanel('menu');routeTo('/');
    setMenuOpen(false);setViewPreview(false);setFeedback('');setRise(false);setLandingFrame(0);setLandingComposerReady(false);
    window.scrollTo({top:0,behavior:'smooth'});
    setTimeout(()=>textareaRef.current?.focus({preventScroll:true}),150);
  };
  const openProject=async p=>{
    try{
      const r=await api('/api/projects/'+encodeURIComponent(p.id));
      setProject(r.project);setMessages(r.project.messages||[]);
      setSelected(Array.isArray(r.project.recommendations?._workspace?.selectedStyles)?
        r.project.recommendations._workspace.selectedStyles:styleKeys);
      setMode('chat');routeTo('/studio');setMenuOpen(false);setViewPreview(false);setBrief('');
      window.scrollTo({top:0,behavior:'instant'});
    }catch(e){notice(e.message);}
  };
  const toggleStyle=id=>{
    setSelected(current=>current.includes(id)?current.filter(s=>s!==id):[...current,id]);
  };
  const saveWorkbenchState=workspace=>{
    setProject(current=>current?{...current,
      recommendations:{...current.recommendations,_workspace:workspace}}:current);
    setProjects(previous=>previous.map(item=>item.id===project?.id?{...item,
      recommendations:{...item.recommendations,_workspace:workspace}}:item));
  };
  const restoreWorkbench=nextRecommendations=>{
    setProject(current=>current?{...current,recommendations:nextRecommendations}:current);
    setProjects(previous=>previous.map(item=>item.id===project?.id?
      {...item,recommendations:nextRecommendations}:item));
    setViewPreview(false);
  };
  const refineIntelligence=async refinement=>{
    if(!project||intelligenceBusy||working)return;
    setIntelligenceBusy(true);
    try{
      const response=await api('/api/projects/'+encodeURIComponent(project.id)+'/intelligence',{
        method:'POST',body:JSON.stringify({refinement})
      });
      setProject(current=>current?.id===response.project.id?{...current,
        recommendations:response.project.recommendations}:current);
      setProjects(previous=>previous.map(item=>item.id===response.project.id?
        {...item,recommendations:response.project.recommendations}:item));
      setViewPreview(false);
      notice(refinement?'Recommendations updated and saved to your private project.':
        'Recommendation refinement reset. Original brief restored.');
    }catch(error){notice('Could not update recommendations: '+error.message);}
    finally{setIntelligenceBusy(false);}
  };
  const feedbackSave=async()=>{
    if(!project){notice('Start a design conversation first.');return;}
    if(!selected.length){notice('Select at least one direction first.');return;}
    try{
      const r=await api('/api/feedback',{method:'POST',body:JSON.stringify({projectId:project.id,styles:selected,reaction,detail:feedback})});
      setProfile(r.profile);
      setFeedback('');
      notice(r.changed===0?'That feedback was already saved; no extra preference points were added.':
        'Feedback updated for '+r.changed+' design '+(r.changed===1?'direction.':'directions.'));
    }catch(e){notice(e.message);}
  };
  const copyPrompt=async()=>{
    if(!project||!selected.length){notice('Select a design direction first.');return;}
    try{
      const endpoint=designMode==='select'?'export':'design-prompt';
      const payload=designMode==='select'?{styles:selected}:{mode:designMode,styles:selected};
      const r=await api('/api/projects/'+encodeURIComponent(project.id)+'/'+endpoint,{method:'POST',body:JSON.stringify(payload)});
      await navigator.clipboard.writeText(r.prompt);
      notice('Implementation prompt copied to clipboard.');
    }catch(e){notice(e.message);}
  };
  const openLearning=()=>{
    setPanel('learning');setMenuOpen(true);
    api('/api/preferences').then(data=>{
      setProfile(data.profile);setPreferenceEvidence(data.evidence||[]);
      setLearningOverview(data.learning||null);
    }).catch(error=>notice(error.message));
  };
  const saveLearning=async changes=>{
    if(preferencesBusy)return;
    const previous=profile;
    // Controlled fields must respond immediately, not snap back while the
    // server saves. If the request fails, restore the last verified profile.
    setProfile(current=>({
      ...current,
      styleWeights:{...(current.styleWeights||{}),...(changes.styleWeights||{})},
      personalization:{...(current.personalization||{enabled:true}),
        ...Object.fromEntries(Object.entries(changes).filter(([key])=>key!=='styleWeights'))},
      globalOptIn:changes.enabled===false?false:current.globalOptIn,
    }));
    setPreferencesBusy(true);
    try{
      const r=await api('/api/preferences',{method:'PUT',body:JSON.stringify(changes)});
      setProfile(r.profile);setPreferenceEvidence(r.evidence||[]);
      setLearningOverview(r.learning||null);
      notice('Your private design preferences were updated.');
    }catch(error){setProfile(previous);notice(error.message)}
    finally{setPreferencesBusy(false)}
  };
  const resetLearning=async()=>{
    if(!window.confirm('Clear ONLY your design preferences and feedback? Saved projects and chats will stay.'))return;
    setPreferencesBusy(true);
    try{
      const r=await api('/api/preferences',{method:'DELETE'});
      setProfile(r.profile);setPreferenceEvidence(r.evidence||[]);
      setLearningOverview(r.learning||null);
      notice('Your design preferences and feedback were cleared. Projects preserved.');
    }catch(error){notice(error.message)}
    finally{setPreferencesBusy(false)}
  };
  const saveOptIn=async e=>{
    try{setProfile(await api('/api/profile',{method:'PUT',body:JSON.stringify({globalOptIn:e.target.checked})}));notice('Your learning preference was saved.');}
    catch(err){notice(err.message);}
  };
  const eraseEverything=async()=>{
    if(!window.confirm('Delete all your saved projects, history, and preferences? This cannot be undone.'))return;
    try{
      await api('/api/profile',{method:'DELETE'});
      setProjects([]);setNextProjectOffset(null);
      setWorkspaceOverview({projectCount:0,inspirationCount:0,promptCount:0,feedbackCount:0,lastUpdatedAt:null});
      setProfile({styleWeights:{},globalOptIn:false,personalization:{enabled:true}});
      setPreferenceEvidence([]);newChat();notice('Your private workspace data has been deleted.');
    }catch(e){notice(e.message);}
  };
  const filteredProjects=projects.filter(p=>(String(p.title||'')+' '+String(p.brief||'')).toLowerCase().includes(historyQuery.trim().toLowerCase()));
  const recommendations=project?.recommendations?.designs||[];
  const references=(catalog.references||[]).filter(x=>(x.name+' '+x.category+' '+x.tags.join(' ')).toLowerCase().includes(search.toLowerCase()));
  const showMenu=next=>{setPanel(next);setMenuOpen(true);};
  const sendPreset=text=>{setBrief(text);focusChat();setTimeout(()=>textareaRef.current?.focus(),100);};
  const topTitle=panel==='menu'?'Workspace':panel==='projects'?'Your projects':panel==='account'?'Your account':panel==='security'?'Account & security':panel==='references'?'Design library':panel==='learning'?'Learning & privacy':'Design tools';
  const enterLandingMode=key=>{setDesignMode(key);if(key==='fusion')setSelected(styleKeys);focusChat();};

  return <div style={{'--chat-clearance':composerClearance+'px'}} className={'app '+(active?'in-chat':mode==='login'?'in-login':'in-welcome')+(isLanding&&landingFrame>0?' exploring':'')+(isLanding&&landingFrame===4?' story-end':'')+(isLanding?' portal-'+portalState:'')+(gatePhase==='reveal-studio'?' studio-arriving':'')}>
    {mode!=='login'&&<header className="topbar" inert={isLanding&&portalState!=='done'}>
      <button className="brand" onClick={newChat} title="New chat" aria-label="Frontline UX/UI — new chat">
        <span className="brand-mark"><FrontlineMark size={29}/></span>
        <span className="brand-tech"><span className="brand-word">FRONTLINE</span><span className="brand-sub">UX / UI STUDIO</span></span>
      </button>
      <div className="top-right">
        {active&&<button className="top-new" onClick={newChat}><Plus size={15}/> New chat</button>}
        <button className={'menu-button '+(menuOpen?'on':'')} onClick={()=>{setMenuOpen(v=>!v);setPanel('menu')}} aria-expanded={menuOpen} aria-label="Open navigation menu">
          <Menu size={18}/><span>Menu</span>
        </button>
      </div>
    </header>}

    {isLanding&&<FrontlineLanding locked={portalState!=='done'} effectsReady={portalState==='done'}
      onSceneChange={setLandingFrame} onComposeReady={setLandingComposerReady}
      onBegin={focusChat} onMode={enterLandingMode}
      onLogin={()=>enterGateway('login')} onSignup={startGoogleSignup}/>}
    {isLanding&&portalState!=='done'&&<FrontlineOrbIntro/>}
    {!pwa.online&&<div className="fl-network-banner" role="status">
      <WifiOff size={15}/> Offline: public app shell may be available, but AI and private workspace edits require a connection.
    </div>}
    <main className={'scene '+(active?'conversation-scene':'landing-scene')}>
      {active&&<section className="conversation" aria-label="Design conversation">
        <div className="conversation-inner">
          {!messages.length&&<div className="conversation-empty">
            <span className="floating-symbol"><FrontlineMark size={53}/></span>
            <span className="studio-eyebrow">THE FRONTLINE DESIGN ATELIER</span>
            <h1 className="studio-title">Design beyond <em>the ordinary.</em></h1>
            <p>Describe what you want to build. Get original design prompts and links. Combine with components only if you choose.</p>
            <div className="studio-starters" aria-label="Try a design brief">
              {starterNotes.map((note,i)=><button type="button" key={note} onClick={()=>sendPreset(note)}>
                <Sparkles size={13} aria-hidden="true"/>
                {['Learning dashboard','Cinematic portfolio','Health experience'][i]}
              </button>)}
            </div>
            <span>Real designs. Original prompts. Direct publisher links.</span>
          </div>}
          {messages.map((message,i)=><div className={'message-row '+(message.role==='user'?'outgoing':'incoming')} key={i}>
            {message.role!=='user'&&<div className="message-avatar"><FrontlineMark size={25}/></div>}
            <div className={'bubble '+(message.role==='user'?'user-bubble':'ai-bubble')}>
              {message.role!=='user'&&<div className="bubble-label">Frontline UX/UI <span>{message.source==='publisher'?'Original publisher results':message.source==='guide'?(message.failureReason==='rate-limited'?'OpenRouter rate-limited · guided response':message.failureReason==='timeout'?'OpenRouter timeout · guided response':message.failureReason==='incomplete-output'?'Incomplete AI reply · complete guidance':'Guided recommendations · AI fallback'):message.source==='error'?'Error':message.provider==='gemini'?'Gemini AI':message.provider==='openrouter'?'OpenRouter AI':message.provider==='groq'?'Groq AI':message.source==='ai'?'AI design consultant':'Design advisor'}</span></div>}
              {message.role==='user'?<p>{message.content}</p>:<MessageMarkdown content={message.content}/>}
              {message.flowStage==='offer-combination'&&i===messages.length-1&&<div className="simple-source-choices">
                <button type="button" disabled={working} onClick={()=>send('Yes')}>Yes, combine them</button>
                <button type="button" disabled={working} onClick={()=>send('No')}>No, thanks</button>
              </div>}
              {message.source==='guide'&&<button type="button" className="message-retry"
                disabled={working||(message.failureReason==='rate-limited'&&!!message.retryAfterUntil&&Date.parse(message.retryAfterUntil)>retryClock)}
                onClick={()=>{
                  const prior=messages.slice(0,i).reverse().find(m=>m.role==='user');
                  if(prior?.content)send(prior.content);
                }} title={message.failureReason==='rate-limited'?'Wait for the free provider rate-limit cooldown before retrying':'Make another OpenRouter attempt in this conversation'}>
                <RotateCcw size={13} aria-hidden="true"/>
                {message.failureReason==='rate-limited'&&message.retryAfterUntil&&Date.parse(message.retryAfterUntil)>retryClock
                  ?'OpenRouter rate-limited · retry later':'Retry with OpenRouter'}
              </button>}
            </div>
          </div>)}
          {working&&<div className="message-row incoming"><div className="message-avatar"><FrontlineMark size={25}/></div><div className="bubble ai-bubble thinking" aria-label="Analyzing your request"><i/><i/><i/></div></div>}
          {advancedMode&&project&&<section className="result-message">
            <div className="result-header">
              <span className="small-eyebrow">DESIGN EXPLORER / {project.recommendations.category?.toUpperCase()}</span>
              <strong>Explore. Select. Make it yours.</strong>
              <p>Explore real inspiration sites first, then combine complementary style directions. We never copy other websites.</p>
            </div>
            <ProjectIntelligencePanel project={project} onRefine={refineIntelligence}
              busy={intelligenceBusy||working}/>
            {(designMode==='select'||designMode==='fusion')&&<InspirationExplorer key={project.id} project={project} api={api} notice={notice}/>}
            <div className="result-actions">
              <button className={selected.length===3?'quiet-active':''} onClick={()=>setSelected(styleKeys)}><CheckCheck size={15}/> Select all three</button>
              <button onClick={()=>setSelected([])}><X size={13}/> Clear</button>
              <span>{selected.length} selected</span>
            </div>
            <div className="design-list">
              {recommendations.map((d,index)=><button key={d.id} className={'design-option '+(selected.includes(d.id)?'picked':'')} onClick={()=>toggleStyle(d.id)} aria-pressed={selected.includes(d.id)}>
                <span className={'color-orb '+d.id} aria-hidden="true"><span/></span>
                <span className="design-description"><span className="design-rank">{String(index+1).padStart(2,'0')} / RECOMMENDED</span><strong>{d.name}</strong><small>{d.description}</small></span>
                <span className="design-score" title="Heuristic match indicator; not a measured usability score">{d.match}/100 match</span>
                <span className="select-check">{selected.includes(d.id)?<Check size={13}/>:null}</span>
              </button>)}
            </div>
            <ProjectWorkbench key={project.id} project={project}
              selected={selected} onSelectedChange={setSelected} api={api}
              notice={notice} authenticated={authState.authenticated} onWorkspaceChange={saveWorkbenchState}
              onRestore={restoreWorkbench}/>
            <div className="result-footer">
              <button className="text-action" disabled={!selected.length} onClick={()=>{setViewPreview(v=>!v);setMobilePreview(false)}}><Layers3 size={15}/>{viewPreview?'Hide fusion preview':'Preview selected design'} <ChevronRight size={14}/></button>
              <button className="text-action" disabled={!selected.length} onClick={copyPrompt}><Copy size={15}/> Copy build prompt</button>
            </div>
            {viewPreview&&<div className="design-preview">
              <div className="preview-menu"><span>ORIGINAL UI CONCEPT · {selected.length===3?'FUSION':selected.map(s=>formats[s]).join(' + ')}</span><button onClick={()=>setMobilePreview(v=>!v)}>{mobilePreview?'Desktop':'Mobile'} view</button></div>
              <div className={'preview-app '+(mobilePreview?'mobile':'')+' '+(selected.length>1?'fusion':selected[0])}>
                <div className="preview-side"><span><FrontlineMark size={24}/></span><i/><i/><i/></div>
                <div className="preview-content"><div className="preview-heading"><span>Workspace overview</span><span>•••</span></div><div className="preview-hero"><small>{project.recommendations.category} / CONCEPT</small><strong>Design with intention.</strong><p>{project.brief.slice(0,100)}</p></div><div className="preview-stats"><div><small>Experience</small><b>01</b><i/></div><div><small>Interface</small><b>02</b><i/></div></div></div>
              </div><small>Illustrative composition only. Not exported working application code.</small>
            </div>}
            {(designMode==='generate'||designMode==='fusion')&&<DesignPromptPanel
              key={project.id+':'+designMode+':'+(project.recommendations?.refinement||'')}
              project={project} mode={designMode}
              styles={selected} api={api} notice={notice}/>}
            <details className="feedback-details">
              <summary>Optional refinement notes</summary>
              <div className="feedback-line">
              <span>Fine-tune these directions</span>
              <div className="reaction-set" role="group" aria-label="Feedback reaction">
                {['like','dislike','edit'].map(value=><button key={value} className={reaction===value?'reaction-current':''} aria-pressed={reaction===value} onClick={()=>setReaction(value)}>{value==='like'?'Like':value==='dislike'?'Dislike':'Improve'}</button>)}
              </div>
              <input value={feedback} onChange={e=>setFeedback(e.target.value)} placeholder="Optional feedback on your selections" maxLength={500} aria-label="Feedback detail"/>
              <button className="save-feedback" onClick={feedbackSave} disabled={!selected.length||profile.personalization?.enabled===false} title={profile.personalization?.enabled===false?'Enable learning in Learning & privacy to save feedback':'Save private design feedback'}>Save refinement <ArrowUp size={14}/></button>
              </div>
            </details>
          </section>}
          <div ref={endRef}/>
        </div>
      </section>}
      {active&&<div ref={composerDockRef} className="composer-position docked">
        <StarBorder as="div" theme={theme}
          backgroundColor={theme==='dark'?'#263450':'#ffffff'}
          textColor={theme==='dark'?'#eef3ff':'#243858'}
          borderColor={theme==='dark'?'#8eabec':'#b6c9f6'}
          color={theme==='dark'?'#bdd0ff':'#7e9cf2'}
          trailColor={theme==='dark'?'#6e93de':'#9dc6ff'}
          radius={26} thickness={1.7} duration={4.8} stars={2} trailLength={0.34} glow={0.95}
          hover="lap" sparkle clickPulse className="chat-star">
          <form className="composer" onSubmit={e=>{e.preventDefault();send(e.currentTarget.querySelector('textarea')?.value??brief);}}>
            {!active&&<div className="composer-wordmark"><div className="composer-tech"><TechText text="DESIGN BEGINS WITH YOU" fontSize={38} fontWeight={650} reveal="letter" reach={0} labels={false} selection={false} draggable={false} specks={0} sweep={false} clickKick={false} color="currentColor" accentColor="#bd7444" /></div></div>}
            <textarea ref={textareaRef} value={brief} onChange={e=>setBrief(e.target.value)} onFocus={focusChat} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent?.isComposing){e.preventDefault();send(e.currentTarget.value);}}} placeholder="Describe your website, app, or design idea…" rows={active?1:3} maxLength={1200} aria-label="Ask the Frontline UX/UI design advisor" />
            <div className="composer-toolbar">
              <span className="composer-status"><span className="live-dot"/>{config.aiEnabled?(config.aiPrimary==='openrouter'?'OpenRouter configured':'AI configured'):'Design guidance ready'}</span>
              <div className="composer-buttons">
                {advancedMode&&<button type="button" className="tool-button" title="Explore tools" onClick={()=>showMenu('tools')} aria-label="Open design tools"><Plus size={19}/></button>}
                <button className="submit-button" type="submit" disabled={working||brief.trim().length<2} aria-label="Send message">{working?<RotateCcw size={18} className="spin"/>:<ArrowUp size={19}/>}</button>
              </div>
            </div>
          </form>
          </StarBorder>
        <p className="composer-disclaimer">Frontline UX/UI can make mistakes. Validate recommendations before building.</p>
      </div>}

    </main>

    {mode==='login'&&<FrontlineLogin onBack={backToStory} onGuest={()=>enterGateway('studio')}
      onGoogle={startGoogleLogin} googleReady={authState.googleEnabled}
      authError={new URLSearchParams(window.location.search).get('auth')}
      onRetrySync={retryGuestSync}/>} 
    {gatePhase&&<div className={'fl-blackhole-transition '+(gatePhase.startsWith('expand')?'is-expanding':'is-revealing')} aria-hidden="true"><div className="fl-blackhole-disc"/></div>}

    {menuOpen&&<div className="menu-layer">
      <button className="menu-shade" onClick={()=>setMenuOpen(false)} aria-label="Close menu"/>
      <aside className="menu-panel" aria-label="Workspace navigation">
        <div className="panel-head">
          <div className="panel-head-title">{panel!=='menu'&&<button className="icon-back" onClick={()=>setPanel('menu')} aria-label="Back to menu"><ChevronLeft size={19}/></button>}<strong>{topTitle}</strong></div>
          <button className="close-menu" onClick={()=>setMenuOpen(false)} aria-label="Close menu"><X size={19}/></button>
        </div>
        {panel==='menu'&&<div className="menu-group">
          <p className="menu-eyebrow">DESIGN WORKSPACE</p>
          <button className="nav-primary" onClick={newChat}><Plus size={17}/> New conversation <ArrowUp size={15}/></button>
          {projects.length>0&&<button className="nav-resume" onClick={()=>openProject(projects[0])}><Layers3 size={17}/> Continue recent conversation <ChevronRight size={15}/></button>}
          
          {advancedMode&&<button onClick={()=>setPanel('tools')}><Sparkles size={17}/> Select / Generate / Fusion <ChevronRight size={15}/></button>}
          <button onClick={()=>{setPanel('projects');refreshWorkspace();}}><Layers3 size={17}/> My projects & conversations <ChevronRight size={15}/></button>
          
          {advancedMode&&<button onClick={()=>setPanel('references')}><Search size={17}/> UI/UX inspiration library <ChevronRight size={15}/></button>}
          <button onClick={openLearning}><ShieldCheck size={17}/> Learning & privacy <ChevronRight size={15}/></button>
          <div className="menu-bottom">
            <p className="menu-eyebrow">ACCOUNT</p>
            <button onClick={()=>setPanel('account')}><ShieldCheck size={17}/>
              {authState.authenticated?'My Google account':'Guest account & privacy'} <ChevronRight size={15}/>
            </button>
            {authState.authenticated?<p className="menu-fineprint">Connected as {authState.user?.email||'Google account'} · private cross-device projects</p>
            :<button onClick={()=>{setMenuOpen(false);enterGateway('login')}}>
              <ShieldCheck size={17}/> Sign in to sync designs <ChevronRight size={15}/>
            </button>}
            <p className="menu-eyebrow">THIS DEVICE</p>
            {pwa.installed?<p className="menu-fineprint">Frontline is installed on this device.</p>:
              pwa.installAvailable?<button type="button" onClick={async()=>{
                const installed=await pwa.install();
                if(!installed)notice('You can also install Frontline from your browser menu.');
              }}><Download size={17}/> Install Frontline app <ChevronRight size={15}/></button>:
              <p className="menu-fineprint">To install: use your browser's Install app option,
                or on iPhone open Share → Add to Home Screen.</p>}
            <p className="menu-eyebrow">APPEARANCE</p>
            <button onClick={()=>setTheme(t=>t==='dark'?'light':'dark')}>{theme==='dark'?<Sun size={18}/>:<Moon size={18}/>} Switch to {theme==='dark'?'light':'dark'} theme <span className="theme-chip">{theme==='dark'?'Dark':'Light'}</span></button>
            <p className="menu-fineprint">{config.persistent?'Project memory is connected':'Guest preview · project memory resets on server restart'}<br/>{config.aiEnabled?'AI provider connected':'Rule-based design guidance · AI generation not yet connected'}</p>
          </div>
        </div>}
        {panel==='tools'&&<div className="menu-subcontent">
          <p className="menu-intro">Choose your design workflow. All three share the same chat experience.</p>
          {[
            {key:'select',name:'Select UI/UX',description:'Explore, save and combine matching inspiration websites from our library.'},
            {key:'generate',name:'Generate UI/UX',description:'Create three original design directions and a detailed copyable prompt.'},
            {key:'fusion',name:'Design Fusion',description:'Fuse saved inspirations and chosen styles into one original prompt.'}
          ].map(item=><button className={'tool-mode '+(designMode===item.key?'active':'')} key={item.key} onClick={()=>{setDesignMode(item.key);setSelected(item.key==='fusion'?styleKeys:selected);setMenuOpen(false);focusChat();notice(item.name+' ready. '+(project?'Use the design panel to create your specification.':'Describe your idea in chat.'));if(project&&item.key!=='select')setTimeout(()=>document.querySelector('.di-panel')?.scrollIntoView({behavior:'smooth',block:'start'}),180);}}>
            <span className="mode-symbol">{item.key==='select'?'◈':item.key==='generate'?'✧':<FrontlineMark size={23}/>}</span>
            <span><strong>{item.name}</strong><small>{item.description}</small></span>
            {designMode===item.key&&<Check size={17}/>}
          </button>)}
          {project&&<button className="menu-copy" onClick={()=>{setMenuOpen(false);copyPrompt();}}><Copy size={16}/> Copy selected design build prompt</button>}
        </div>}
        {panel==='projects'&&<div className="menu-subcontent">
          <FrontlineProjectLibrary projects={projects} overview={workspaceOverview}
            account={authState.authenticated} query={historyQuery} onQuery={setHistoryQuery}
            onOpen={openProject} onRefresh={refreshWorkspace} onLoadMore={loadEarlierProjects}
            nextOffset={nextProjectOffset} loading={workspaceSyncing} moreBusy={workspaceLoadingMore}/>
        </div>}
        {panel==='account'&&<div className="menu-subcontent">
          <FrontlineAccount auth={authState} overview={workspaceOverview}
            loading={workspaceSyncing} lastSynced={lastSynced} onRefresh={refreshWorkspace}
            onExport={exportWorkspace} exportBusy={workspaceExporting}
            onSignOut={signOut} onSignIn={()=>{setMenuOpen(false);enterGateway('login')}}
            onLearn={openLearning} onClaim={retryGuestSync} onSecurity={openAccountSecurity}/>
        </div>}
        {panel==='security'&&<div className="menu-subcontent">
          <FrontlineSecurity auth={authState} security={authSecurity}
            onRefresh={refreshAuthSecurity} onReverify={reverifyGoogle}
            onOtherDevices={signOutOtherDevices} onEveryDevice={signOutEveryDevice}
            onDeleteAccount={permanentlyDeleteAccount} onLearning={openLearning}
            loading={securityLoading} busy={securityBusy}/>
        </div>}
        {panel==='references'&&<div className="menu-subcontent">
          <p className="menu-intro">Explore credited reference sites. Patterns inspire original results, not exact reproductions.</p>
          <label className="search-box"><Search size={15}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search award-winning designs"/></label>
          <div className="refs-list">{references.map(r=><a key={r.id} href={r.site} target="_blank" rel="noreferrer noopener" className="reference-row"><span><strong>{r.name}</strong><small>{r.category} · {r.rank?'Leaderboard #'+r.rank:'Additional reference'}</small></span><ExternalLink size={14}/></a>)}</div>
        </div>}
        {panel==='learning'&&<div className="menu-subcontent">
          <p className="menu-intro">Feedback helps tailor future recommendations. Your projects stay private.</p>
          <LearningPreferencesPanel profile={profile} evidence={preferenceEvidence}
            learning={learningOverview} busy={preferencesBusy}
            onChange={saveLearning} onClear={resetLearning}/>
          <label className="opt-in"><input type="checkbox" checked={profile.globalOptIn===true}
          disabled={preferencesBusy||profile.personalization?.enabled===false||!authState.authenticated}
          onChange={saveOptIn}/><span><strong>Contribute opt-in shared trends</strong>
          <small>{authState.authenticated?
            'Only confirmed Google-linked accounts count; at least ten accounts per trend. Trends are display-only and never share private projects or chats.':
            'Sign in with Google before contributing to shared trends. Guest feedback remains private.'}</small></span></label>
          <button type="button" className="menu-copy" onClick={exportWorkspace} disabled={workspaceExporting}>
            <Copy size={16}/> {workspaceExporting?'Preparing archive…':'Download all my private data (JSON)'}
          </button>
          <button className="danger-action" onClick={eraseEverything}>Delete all my projects, chats and preferences</button>
        </div>}
      </aside>
    </div>}
    {toast&&<div className="toast" role="status">{toast}</div>}
  </div>;
}
createRoot(document.getElementById('root')).render(<App/>);
