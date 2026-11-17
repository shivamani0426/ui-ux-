import React, {useEffect, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {ArrowUp, Check, CheckCheck, ChevronLeft, ChevronRight, Copy, ExternalLink, Heart, Layers3, Menu, Moon, Plus, RotateCcw, Search, ShieldCheck, Sparkles, Sun, X} from 'lucide-react';
import TechText from './components/TechText.jsx';
import StarBorder from './components/StarBorder.jsx';
import FrontlineLanding from './components/FrontlineLanding.jsx';
import FrontlineDomePortal from './components/FrontlineDomePortal.jsx';
import FrontlineMark from './components/FrontlineMark.jsx';
import InspirationExplorer from './components/InspirationExplorer.jsx';
import DesignPromptPanel from './components/DesignPromptPanel.jsx';
import ProjectIntelligencePanel from './components/ProjectIntelligencePanel.jsx';
import MessageMarkdown from './components/MessageMarkdown.jsx';
import LearningPreferencesPanel from './components/LearningPreferencesPanel.jsx';
import './styles.css';
import './frontline-studio.css';
import './inspiration-explorer.css';

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
  const [theme,setTheme]=useState(()=>safeRead('uic-theme','dark')==='dark'?'dark':'light');
  const [menuOpen,setMenuOpen]=useState(false);
  const [panel,setPanel]=useState('menu');
  const [mode,setMode]=useState('welcome');
  const [brief,setBrief]=useState('');
  const [project,setProject]=useState(null);
  const [messages,setMessages]=useState([]);
  const [retryClock,setRetryClock]=useState(()=>Date.now());
  const [catalog,setCatalog]=useState({styles:[],references:[]});
  const [projects,setProjects]=useState([]);
  const [profile,setProfile]=useState({styleWeights:{},globalOptIn:false,personalization:{enabled:true}});
  const [preferenceEvidence,setPreferenceEvidence]=useState([]);
  const [preferencesBusy,setPreferencesBusy]=useState(false);
  const [composerClearance,setComposerClearance]=useState(138);
  const [config,setConfig]=useState({aiEnabled:false,persistent:false});
  const [selected,setSelected]=useState(styleKeys);
  const [working,setWorking]=useState(false);
  const [toast,setToast]=useState('');
  const [feedback,setFeedback]=useState('');
  const [reaction,setReaction]=useState('like');
  const [designMode,setDesignMode]=useState('select');
  const [viewPreview,setViewPreview]=useState(false);
  const [mobilePreview,setMobilePreview]=useState(false);
  const [search,setSearch]=useState('');
  const [rise,setRise]=useState(false);
  const [landingFrame,setLandingFrame]=useState(0);
  const [landingComposerReady,setLandingComposerReady]=useState(false);
  const [portalState,setPortalState]=useState('idle');
  const endRef=useRef(null),textareaRef=useRef(null),scrollTimer=useRef(null),toastTimer=useRef(null),portalTimer=useRef(null),portalFinishTimer=useRef(null),composerDockRef=useRef(null);

  const notice=(message)=>{
    setToast(message);clearTimeout(toastTimer.current);
    toastTimer.current=setTimeout(()=>setToast(''),3800);
  };
  useEffect(()=>{
    document.documentElement.setAttribute('data-theme',theme);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content',theme==='dark'?'#261e23':'#f7f0e4');
    try{localStorage.setItem('uic-theme',theme)}catch{}
  },[theme]);
  useEffect(()=>{
    Promise.allSettled([
      api('/api/catalog').then(setCatalog),
      api('/api/projects').then(v=>setProjects(v.projects||[])),
      api('/api/profile').then(setProfile),
      api('/api/config').then(setConfig)
    ]).then(results=>{if(results.some(x=>x.status==='rejected'))notice('Some workspace data could not be loaded.');});
    return ()=>{clearTimeout(scrollTimer.current);clearTimeout(toastTimer.current);clearTimeout(portalTimer.current);clearTimeout(portalFinishTimer.current);};
  },[]);
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
  // The pre-landing portal locks scrolling only until the inside-out reveal ends.
  // It doesn't change saved projects, user preferences, the studio or any APIs.
  useEffect(()=>{
    if(mode==='chat'||portalState==='done')return;
    const oldHTML=document.documentElement.style.overflow;
    const oldBody=document.body.style.overflow;
    document.documentElement.style.overflow='hidden';
    document.body.style.overflow='hidden';
    return ()=>{
      document.documentElement.style.overflow=oldHTML;
      document.body.style.overflow=oldBody;
    };
  },[mode,portalState]);
  const enterPortal=()=>{
    if(portalState!=='idle')return;
    // A deliberate click starts a real, separate white-light charge.
    // Only after that hold does the existing landing expand from its centre.
    setPortalState('charging');
    const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    clearTimeout(portalTimer.current);clearTimeout(portalFinishTimer.current);
    portalTimer.current=setTimeout(()=>{
      setPortalState('opening');
      portalFinishTimer.current=setTimeout(()=>setPortalState('done'),reduced?220:3000);
    },reduced?220:2700);
  };
  useEffect(()=>{endRef.current?.scrollIntoView({behavior:'smooth',block:'end'});},[messages,working,viewPreview]);
  const active=mode==='chat';
  const focusChat=()=>{
    if(!active){
      setMode('chat');setRise(false);
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
      if(!current){
        const fullBrief=raw.length<15?'Design a thoughtful user interface based on this request: '+raw:raw;
        const r=await api('/api/projects',{method:'POST',body:JSON.stringify({brief:fullBrief})});
        current=r.project;
        setProject(current);
        setProjects(p=>[current,...p]);
        setViewPreview(false);
      }
      const out=await api('/api/projects/'+encodeURIComponent(current.id)+'/messages',{method:'POST',body:JSON.stringify({message:raw,styles:selected})});
      setMessages(out.messages||[]);
    }catch(e){
      setMessages(prev=>[...prev,{role:'assistant',content:'Something went wrong: '+e.message,source:'error'}]);
    }finally{setWorking(false);}
  };
  const newChat=()=>{
    setProject(null);setMessages([]);setBrief('');setSelected(styleKeys);setMode('welcome');setPanel('menu');
    setMenuOpen(false);setViewPreview(false);setFeedback('');setRise(false);setLandingFrame(0);setLandingComposerReady(false);
    window.scrollTo({top:0,behavior:'smooth'});
    setTimeout(()=>textareaRef.current?.focus({preventScroll:true}),150);
  };
  const openProject=async p=>{
    try{
      const r=await api('/api/projects/'+encodeURIComponent(p.id));
      setProject(r.project);setMessages(r.project.messages||[]);setSelected(styleKeys);
      setMode('chat');setMenuOpen(false);setViewPreview(false);setBrief('');
      window.scrollTo({top:0,behavior:'instant'});
    }catch(e){notice(e.message);}
  };
  const toggleStyle=id=>{
    setSelected(current=>current.includes(id)?current.filter(s=>s!==id):[...current,id]);
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
      setProjects([]);setProfile({styleWeights:{},globalOptIn:false,personalization:{enabled:true}});setPreferenceEvidence([]);newChat();notice('Your workspace data has been deleted.');
    }catch(e){notice(e.message);}
  };
  const recommendations=project?.recommendations?.designs||[];
  const references=(catalog.references||[]).filter(x=>(x.name+' '+x.category+' '+x.tags.join(' ')).toLowerCase().includes(search.toLowerCase()));
  const showMenu=next=>{setPanel(next);setMenuOpen(true);};
  const sendPreset=text=>{setBrief(text);focusChat();setTimeout(()=>textareaRef.current?.focus(),100);};
  const topTitle=panel==='menu'?'Workspace':panel==='projects'?'Your projects':panel==='references'?'Design library':panel==='learning'?'Learning & privacy':'Design tools';
  const enterLandingMode=key=>{setDesignMode(key);if(key==='fusion')setSelected(styleKeys);focusChat();};

  return <div style={{'--chat-clearance':composerClearance+'px'}} className={'app '+(active?'in-chat':'in-welcome')+(!active&&landingFrame>0?' exploring':'')+(!active&&landingFrame===4?' story-end':'')+(!active?' portal-'+portalState:'')}>
    <header className="topbar" inert={!active&&portalState!=='done'}>
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
    </header>

    {!active&&<FrontlineLanding locked={portalState!=='done'} effectsReady={portalState==='done'} onSceneChange={setLandingFrame} onComposeReady={setLandingComposerReady} onBegin={focusChat} onMode={enterLandingMode}/>}
    {!active&&<div className="landing-scrollspace scroll-story-space" aria-hidden="true"/>}
    {!active&&portalState!=='done'&&<FrontlineDomePortal phase={portalState} onEnter={enterPortal}/>}
    <main className={'scene '+(active?'conversation-scene':'landing-scene')}>
      {active&&<section className="conversation" aria-label="Design conversation">
        <div className="conversation-inner">
          {!messages.length&&<div className="conversation-empty">
            <span className="floating-symbol"><FrontlineMark size={53}/></span>
            <span className="studio-eyebrow">THE FRONTLINE DESIGN ATELIER</span>
            <h1 className="studio-title">Design beyond <em>the ordinary.</em></h1>
            <p>Every extraordinary interface begins with a thought. Tell me what you imagine, and we’ll find its visual direction together.</p>
            <div className="studio-starters" aria-label="Try a design brief">
              {starterNotes.map((note,i)=><button type="button" key={note} onClick={()=>sendPreset(note)}>
                <Sparkles size={13} aria-hidden="true"/>
                {['Learning dashboard','Cinematic portfolio','Health experience'][i]}
              </button>)}
            </div>
            <span>Select. Generate. Fuse. Your vision leads the way.</span>
          </div>}
          {messages.map((message,i)=><div className={'message-row '+(message.role==='user'?'outgoing':'incoming')} key={i}>
            {message.role!=='user'&&<div className="message-avatar"><FrontlineMark size={25}/></div>}
            <div className={'bubble '+(message.role==='user'?'user-bubble':'ai-bubble')}>
              {message.role!=='user'&&<div className="bubble-label">Frontline UX/UI <span>{message.source==='guide'?(message.failureReason==='rate-limited'?'OpenRouter rate-limited · guided response':message.failureReason==='timeout'?'OpenRouter timeout · guided response':message.failureReason==='incomplete-output'?'Incomplete AI reply · complete guidance':'Guided recommendations · AI fallback'):message.source==='error'?'Error':message.provider==='gemini'?'Gemini AI':message.provider==='openrouter'?'OpenRouter AI':message.provider==='groq'?'Groq AI':message.source==='ai'?'AI design consultant':'Design advisor'}</span></div>}
              {message.role==='user'?<p>{message.content}</p>:<MessageMarkdown content={message.content}/>}
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
          {project&&<section className="result-message">
            <div className="result-header">
              <span className="small-eyebrow">DESIGN EXPLORER / {project.recommendations.category?.toUpperCase()}</span>
              <strong>Explore. Select. Make it yours.</strong>
              <p>Explore real inspiration sites first, then combine complementary style directions. We never copy other websites.</p>
            </div>
            <ProjectIntelligencePanel project={project}/>
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
              key={project.id+':'+designMode} project={project} mode={designMode}
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
      {(active||landingFrame===4)&&<div inert={!active&&!landingComposerReady} ref={composerDockRef} className={'composer-position '+(active?'docked':'spiral-emerging'+(landingComposerReady?' is-ready':''))}>
        <StarBorder as="div" theme={theme}
          backgroundColor={active?(theme==='dark'?'#382a2b':'#fff8ec'):'#fff8eb'}
          textColor={active?(theme==='dark'?'#f9e7ce':'#4b312b'):'#45302a'}
          borderColor={active?'#d79e64':'#f3cf94'}
          color={active?(theme==='dark'?'#ffe3aa':'#c77e3e'):'#ffe6b0'}
          trailColor={active?(theme==='dark'?'#df935c':'#d6a263'):'#dc8f54'}
          radius={26} thickness={1.7} duration={4.8} stars={2} trailLength={0.34} glow={0.95}
          hover="lap" sparkle clickPulse className="chat-star">
          <form className="composer" onSubmit={e=>{e.preventDefault();send(e.currentTarget.querySelector('textarea')?.value??brief);}}>
            {!active&&<div className="composer-wordmark"><div className="composer-tech"><TechText text="DESIGN BEGINS WITH YOU" fontSize={38} fontWeight={650} reveal="letter" reach={0} labels={false} selection={false} draggable={false} specks={0} sweep={false} clickKick={false} color="currentColor" accentColor="#bd7444" /></div></div>}
            <textarea ref={textareaRef} value={brief} onChange={e=>setBrief(e.target.value)} onFocus={focusChat} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent?.isComposing){e.preventDefault();send(e.currentTarget.value);}}} placeholder="Describe your website, app, or design idea…" rows={active?1:3} maxLength={1200} aria-label="Ask the Frontline UX/UI design advisor" />
            <div className="composer-toolbar">
              <span className="composer-status"><span className="live-dot"/>{config.aiEnabled?(config.aiPrimary==='openrouter'?'OpenRouter configured':'AI configured'):'Design guidance ready'}</span>
              <div className="composer-buttons">
                <button type="button" className="tool-button" title="Explore tools" onClick={()=>showMenu('tools')} aria-label="Open design tools"><Plus size={19}/></button>
                <button className="submit-button" type="submit" disabled={working||brief.trim().length<2} aria-label="Send message">{working?<RotateCcw size={18} className="spin"/>:<ArrowUp size={19}/>}</button>
              </div>
            </div>
          </form>
          </StarBorder>
        {!active&&<div className="landing-hint">A design universe, shaped by you. Tap to begin.</div>}
        {active&&<p className="composer-disclaimer">Frontline UX/UI can make mistakes. Validate recommendations before building.</p>}
      </div>}
    </main>

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
          <button onClick={()=>setPanel('tools')}><Sparkles size={17}/> Select / Generate / Fusion <ChevronRight size={15}/></button>
          <button onClick={()=>{setPanel('projects');api('/api/projects').then(v=>setProjects(v.projects||[])).catch(e=>notice(e.message));}}><Layers3 size={17}/> My conversations <ChevronRight size={15}/></button>
          <button onClick={()=>setPanel('references')}><Search size={17}/> UI/UX inspiration library <ChevronRight size={15}/></button>
          <button onClick={openLearning}><ShieldCheck size={17}/> Learning & privacy <ChevronRight size={15}/></button>
          <div className="menu-bottom">
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
          <p className="menu-intro">Continue an earlier design conversation in this browser.</p>
          {projects.length===0?<p className="empty-panel">No conversations yet. Describe an idea to start one.</p>:projects.map(p=><button className="history-item" key={p.id} onClick={()=>openProject(p)}><span>{p.title}</span><small>{new Date(p.createdAt).toLocaleDateString()}</small><ChevronRight size={14}/></button>)}
        </div>}
        {panel==='references'&&<div className="menu-subcontent">
          <p className="menu-intro">Explore credited reference sites. Patterns inspire original results, not exact reproductions.</p>
          <label className="search-box"><Search size={15}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search award-winning designs"/></label>
          <div className="refs-list">{references.map(r=><a key={r.id} href={r.site} target="_blank" rel="noreferrer noopener" className="reference-row"><span><strong>{r.name}</strong><small>{r.category} · {r.rank?'Leaderboard #'+r.rank:'Additional reference'}</small></span><ExternalLink size={14}/></a>)}</div>
        </div>}
        {panel==='learning'&&<div className="menu-subcontent">
          <p className="menu-intro">Feedback helps tailor future recommendations. Your projects stay private.</p>
          <LearningPreferencesPanel profile={profile} evidence={preferenceEvidence} busy={preferencesBusy}
            onChange={saveLearning} onClear={resetLearning}/>
          <label className="opt-in"><input type="checkbox" checked={profile.globalOptIn===true}
          disabled={preferencesBusy||profile.personalization?.enabled===false} onChange={saveOptIn}/><span><strong>Contribute anonymous patterns</strong><small>Opt in to privacy-safe aggregated feedback, never raw private chats.</small></span></label>
          <button className="danger-action" onClick={eraseEverything}>Delete all my projects and preferences</button>
        </div>}
      </aside>
    </div>}
    {toast&&<div className="toast" role="status">{toast}</div>}
  </div>;
}
createRoot(document.getElementById('root')).render(<App/>);
