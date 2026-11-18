import React,{useEffect,useMemo,useState} from 'react';
import {ArrowLeftRight,BookOpen,Check,CheckCircle2,FolderKanban,
  GitCompareArrows,History,Layers3,Plus,RefreshCw,RotateCcw,Save,
  ShieldCheck,Trash2,Download,FileJson,FileText,Copy,GitPullRequest,ExternalLink} from 'lucide-react';
import {buildDesignHandoff,designHandoffMarkdown,designHandoffFilename} from '../../design-handoff.mjs';
import './ProjectWorkbench.css';

const STAGES=[
  {id:'ideas',title:'Ideas',hint:'Options worth exploring'},
  {id:'explore',title:'Explore',hint:'Compare and refine'},
  {id:'approved',title:'Approved',hint:'Ready for design handoff'}
];
const STYLE_NAMES={minimal:'Minimal SaaS',glass:'Glass UI',creative:'Creative UI'};
const makeId=()=>globalThis.crypto?.randomUUID?.()||
  ('card_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8));
const stamp=value=>{
  const date=new Date(value||'');
  return Number.isFinite(date.getTime())?date.toLocaleString(undefined,{
    month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'}):'Unknown date';
};

/** Private board and checkpoint UI; never changes project chat or prompt history. */
export default function ProjectWorkbench({
  project,selected=[],onSelectedChange,api,notice,onWorkspaceChange,onRestore,authenticated=false
}){
  const [tab,setTab]=useState('board');
  const [workspace,setWorkspace]=useState(null);
  const [items,setItems]=useState([]);
  const [savedSources,setSavedSources]=useState([]);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [conflict,setConflict]=useState(false);
  const [pageName,setPageName]=useState('');
  const [decision,setDecision]=useState('');
  const [sourceId,setSourceId]=useState('');
  const [versionTitle,setVersionTitle]=useState('');
  const [comparison,setComparison]=useState(null);
  const [remoteRevision,setRemoteRevision]=useState(null);
  const [githubRepository,setGithubRepository]=useState('');
  const [githubToken,setGithubToken]=useState('');
  const [githubBusy,setGithubBusy]=useState(false);
  const [githubConnection,setGithubConnection]=useState({available:false,connected:false,login:null});
  const [publishedPr,setPublishedPr]=useState(null);
  useEffect(()=>{
    if(!authenticated){setGithubConnection({available:false,connected:false,login:null});return;}
    let active=true;
    api('/api/integrations/github').then(info=>{if(active)setGithubConnection(info)})
      .catch(()=>{if(active)setGithubConnection({available:false,connected:false,login:null})});
    return ()=>{active=false};
  },[authenticated,project.id,api]);
  const disconnectGitHub=async()=>{
    if(!authenticated||githubBusy||!window.confirm(
      'Disconnect GitHub from Frontline? Previously published pull requests remain on GitHub.'))return;
    setGithubBusy(true);
    try{
      const result=await api('/api/integrations/github',{method:'DELETE',body:'{}'});
      setGithubConnection({available:true,connected:false,login:null});
      notice(result.revocationNotice||'GitHub disconnected from Frontline.');
    }catch(e){notice('GitHub disconnect failed: '+e.message)}
    finally{setGithubBusy(false)}
  };
  const selectedKey=selected.join('|');
  const dirty=!!workspace&&(JSON.stringify(items)!==JSON.stringify(workspace.items)||
    JSON.stringify(selected)!==JSON.stringify(workspace.selectedStyles));
  const versions=workspace?.versions||[];
  const approvedItems=items.filter(item=>item.stage==='approved');
  const handoffReady=!!workspace&&!dirty&&!loading&&!busy&&approvedItems.length>0;

  const announceRevision=revision=>{
    try{
      const channel=new BroadcastChannel('frontline-workspace-revisions');
      channel.postMessage({type:'workspace-updated',projectId:project.id,revision});
      channel.close();
    }catch{/* BroadcastChannel is optional; server revision checks still apply. */}
  };
  useEffect(()=>{
    let cancelled=false;
    setRemoteRevision(null);
    setLoading(true);setError('');setWorkspace(null);setItems([]);
    setComparison(null);setTab('board');
    api('/api/projects/'+encodeURIComponent(project.id)+'/workspace').then(data=>{
      if(cancelled)return;
      setWorkspace(data.workspace);setItems(data.workspace.items||[]);
      setSavedSources(data.savedInspirations||[]);
      onSelectedChange(data.workspace.selectedStyles||['minimal','glass','creative']);
    }).catch(e=>{if(!cancelled)setError('Could not open your saved board: '+e.message);})
      .finally(()=>{if(!cancelled)setLoading(false);});
    return ()=>{cancelled=true};
  },[project.id]);
  // Refresh just the curated reference choices; never reset unsaved board cards.
  useEffect(()=>{
    let active=true;
    const refreshSources=event=>{
      if(event?.detail?.projectId!==project.id)return;
      api('/api/projects/'+encodeURIComponent(project.id)+'/workspace')
        .then(data=>{if(active)setSavedSources(data.savedInspirations||[]);})
        .catch(()=>{});
    };
    window.addEventListener('frontline:inspiration-change',refreshSources);
    return ()=>{active=false;window.removeEventListener('frontline:inspiration-change',refreshSources)};
  },[project.id,api]);

  // Multi-device change detection is read-only and never replaces unsaved
  // local edits. Each user explicitly chooses when to refresh.
  useEffect(()=>{
    if(!workspace)return;
    let alive=true,channel=null;
    const check=()=>{
      if(document.visibilityState==='hidden'||navigator.onLine===false)return;
      api('/api/projects/'+encodeURIComponent(project.id)+'/workspace').then(result=>{
        if(alive&&result.workspace?.revision>workspace.revision)
          setRemoteRevision(result.workspace.revision);
      }).catch(()=>{});
    };
    const onVisible=()=>{if(document.visibilityState==='visible')check()};
    const onMessage=event=>{
      if(event.data?.type==='workspace-updated'&&
        event.data?.projectId===project.id&&
        event.data?.revision>workspace.revision)
        setRemoteRevision(event.data.revision);
    };
    try{
      if('BroadcastChannel' in window){
        channel=new BroadcastChannel('frontline-workspace-revisions');
        channel.onmessage=onMessage;
      }
    }catch{channel=null;}
    window.addEventListener('focus',check);
    window.addEventListener('online',check);
    window.addEventListener('frontline:workspace-maybe-updated',check);
    document.addEventListener('visibilitychange',onVisible);
    return ()=>{
      alive=false;channel?.close();
      window.removeEventListener('focus',check);
      window.removeEventListener('online',check);
      window.removeEventListener('frontline:workspace-maybe-updated',check);
      document.removeEventListener('visibilitychange',onVisible);
    };
  },[project.id,workspace?.revision,api]);

  const refresh=async()=>{
    if(busy)return;
    if(dirty&&!window.confirm('Reload the saved board? Unsaved changes in this browser will be discarded.'))return;
    setLoading(true);setError('');setConflict(false);
    try{
      const data=await api('/api/projects/'+encodeURIComponent(project.id)+'/workspace');
      setWorkspace(data.workspace);setItems(data.workspace.items||[]);
      setRemoteRevision(null);
      setSavedSources(data.savedInspirations||[]);
      onSelectedChange(data.workspace.selectedStyles||[]);
      setComparison(null);
      onWorkspaceChange?.(data.workspace);
      notice('Design board refreshed from your private workspace.');
    }catch(e){setError(e.message);}
    finally{setLoading(false)}
  };
  const fail=e=>{
    setError(e.message);
    if(/another device|revision|changed elsewhere/i.test(e.message))setConflict(true);
    notice(e.message);
  };
  const save=async()=>{
    if(!workspace||busy||loading||!dirty)return;
    setBusy(true);setError('');setConflict(false);
    try{
      const result=await api('/api/projects/'+encodeURIComponent(project.id)+'/workspace',{
        method:'PUT',body:JSON.stringify({
          revision:workspace.revision,items,selectedStyles:selected
        })
      });
      setWorkspace(result.workspace);setItems(result.workspace.items);
      setRemoteRevision(null);announceRevision(result.workspace.revision);
      onWorkspaceChange?.(result.workspace);setComparison(null);
      notice('Your design board was saved privately.');
    }catch(e){fail(e)}
    finally{setBusy(false)}
  };
  const addCard=(type,title,source='')=>{
    if(items.length>=24){notice('One board supports up to 24 cards.');return;}
    const trimmed=title.trim();
    if(trimmed.length<2){notice('Give the card a short title.');return;}
    if(type==='inspiration'&&!source){notice('Select a saved inspiration.');return;}
    if(type==='inspiration'&&items.some(item=>item.sourceId===source)){
      notice('That inspiration is already on your board.');return;
    }
    setItems(old=>[...old,{
      id:makeId(),type,stage:'ideas',title:trimmed,notes:'',
      ...(type==='inspiration'?{sourceId:source}:{})
    }]);
    setPageName('');setDecision('');setSourceId('');
  };
  const changeCard=(id,change)=>setItems(old=>old.map(item=>item.id===id?{...item,...change}:item));
  const removeCard=id=>setItems(old=>old.filter(item=>item.id!==id));
  const checkpoint=async()=>{
    if(!workspace||busy||dirty||versionTitle.trim().length<2)return;
    setBusy(true);setError('');
    try{
      const result=await api('/api/projects/'+encodeURIComponent(project.id)+'/workspace/versions',{
        method:'POST',body:JSON.stringify({revision:workspace.revision,title:versionTitle.trim()})
      });
      setWorkspace(result.workspace);setVersionTitle('');setComparison(null);
      setRemoteRevision(null);announceRevision(result.workspace.revision);
      onWorkspaceChange?.(result.workspace);
      notice('Design checkpoint saved. Previous project chats and prompts remain untouched.');
    }catch(e){fail(e)}
    finally{setBusy(false)}
  };
  const compare=async(version)=>{
    setBusy(true);setError('');
    try{
      const result=await api('/api/projects/'+encodeURIComponent(project.id)+'/workspace/versions/'+
        encodeURIComponent(version.id)+'/compare');
      setComparison({...result.comparison,title:version.title});
    }catch(e){fail(e)}
    finally{setBusy(false)}
  };
  const restore=async version=>{
    if(busy||!workspace)return;
    if(dirty){notice('Save your board or reload the saved version before restoring.');return;}
    if(!window.confirm('Restore "'+version.title+'"? The current board and approved refinement will change. Your original brief, chat, previous prompts and checkpoints will remain saved.'))return;
    setBusy(true);setError('');setConflict(false);
    try{
      const response=await api('/api/projects/'+encodeURIComponent(project.id)+'/workspace/versions/'+
        encodeURIComponent(version.id)+'/restore',{
        method:'POST',body:JSON.stringify({revision:workspace.revision})
      });
      setWorkspace(response.workspace);setItems(response.workspace.items);
      setRemoteRevision(null);announceRevision(response.workspace.revision);
      onSelectedChange(response.workspace.selectedStyles);
      onRestore?.(response.recommendations);
      setComparison(null);
      notice('Checkpoint restored without deleting your conversations or design history.');
    }catch(e){fail(e)}
    finally{setBusy(false)}
  };


  const prepareHandoff=()=>{
    if(!handoffReady){
      notice(dirty?'Save your changes before exporting the approved design.':
        'Move at least one board card to Approved and save the board first.');
      return null;
    }
    try{
      return buildDesignHandoff({project,workspace,references:savedSources});
    }catch(e){setError(e.message);notice(e.message);return null;}
  };
  const downloadHandoff=extension=>{
    const handoff=prepareHandoff();
    if(!handoff)return;
    const payload=extension==='json'?JSON.stringify(handoff,null,2)+'\n':
      designHandoffMarkdown(handoff);
    const blob=new Blob([payload],{type:extension==='json'?'application/json':'text/markdown'});
    const url=URL.createObjectURL(blob);
    const anchor=document.createElement('a');
    anchor.href=url;anchor.download=designHandoffFilename(project.title,extension);
    document.body.appendChild(anchor);anchor.click();anchor.remove();
    setTimeout(()=>URL.revokeObjectURL(url),2000);
    notice('Approved design handoff downloaded locally. Review it before sharing.');
  };
  const publishGitHub=async(event)=>{
    event.preventDefault();
    if(!handoffReady||!authenticated||githubBusy)return;
    if(!/^[a-zA-Z0-9-]+\/[a-zA-Z0-9_.-]+$/.test(githubRepository.trim())){
      notice('Use an exact GitHub owner/repository name.');return;
    }
    if(!window.confirm('Publish ONLY approved decisions to '+githubRepository.trim()+
      ' as a draft GitHub pull request? This writes a new branch and Markdown file.'))return;
    setGithubBusy(true);setPublishedPr(null);
    try{
      const response=await api('/api/projects/'+encodeURIComponent(project.id)+'/github-handoff',{
        method:'POST',body:JSON.stringify({
          repository:githubRepository.trim(),token:githubToken,revision:workspace.revision
        })
      });
      setPublishedPr(response);
      notice('Draft GitHub pull request created. Review it before merging.');
    }catch(e){notice('GitHub publish not completed: '+e.message)}
    finally{setGithubToken('');setGithubBusy(false)}
  };
  const copyHandoff=async()=>{
    const handoff=prepareHandoff();
    if(!handoff)return;
    try{
      await navigator.clipboard.writeText(designHandoffMarkdown(handoff));
      notice('Approved design handoff copied. Share only with people you trust.');
    }catch{notice('Clipboard unavailable. Use Download Markdown instead.');}
  };

  const pages=(project.recommendations?.analysis?.pages||[]).filter(
    page=>!items.some(item=>item.type==='page'&&item.title===page)).slice(0,24);
  const sources=savedSources.filter(source=>!items.some(item=>item.sourceId===source.id));
  const directions=project.recommendations?.designs||[];
  const ordered=useMemo(()=>STAGES.map(stage=>({
    ...stage,cards:items.filter(item=>item.stage===stage.id)
  })),[items]);

  return <section className="pw-workbench" aria-label="Advanced design workspace">
    <header className="pw-heading">
      <div className="pw-heading-icon"><FolderKanban size={22} aria-hidden="true"/></div>
      <div>
        <span className="pw-eyebrow">FRONTLINE / DESIGN WORKBENCH</span>
        <h3>Shape the work. Keep the decisions.</h3>
        <p>Organize ideas, compare the three directions and save checkpoints before you refine.</p>
      </div>
      <button type="button" className="pw-refresh" onClick={refresh} disabled={busy||loading}
        aria-label="Refresh design workbench"><RefreshCw size={16}/></button>
    </header>
    <div className="pw-tabs" role="group" aria-label="Design workbench views">
      <button type="button" className={tab==='board'?'is-active':''}
        aria-pressed={tab==='board'} onClick={()=>setTab('board')}>
        <FolderKanban size={15}/> Design board
      </button>
      <button type="button" className={tab==='compare'?'is-active':''}
        aria-pressed={tab==='compare'} onClick={()=>setTab('compare')}>
        <GitCompareArrows size={15}/> Compare styles
      </button>
      <button type="button" className={tab==='handoff'?'is-active':''}
        aria-pressed={tab==='handoff'} onClick={()=>setTab('handoff')}>
        <Download size={15}/> Design handoff
      </button>
      <button type="button" className={tab==='versions'?'is-active':''}
        aria-pressed={tab==='versions'} onClick={()=>setTab('versions')}>
        <History size={15}/> Checkpoints <span className="pw-tab-count">{versions.length}</span>
      </button>
    </div>
    {remoteRevision!==null&&remoteRevision>workspace?.revision&&
      <div className="pw-device-warning" role="status">
        This project was updated on another tab or device. Your current edits are preserved.
        <button type="button" onClick={refresh} disabled={busy}>Review latest saved board</button>
      </div>}
    {error&&<div className="pw-error" role="alert">
      {error}{conflict&&<button type="button" onClick={refresh}>Review latest board</button>}
    </div>}
    {loading?<p className="pw-empty" role="status">Loading your private project workspace…</p>:
      !workspace?<p className="pw-empty">Your board is unavailable. Refresh to try again.</p>:
      <>
        {tab==='board'&&<div className="pw-board-view">
          <div className="pw-add-tools">
            <label>Suggested page
              <select aria-label="Choose suggested page" value={pageName}
                onChange={e=>setPageName(e.target.value)}>
                <option value="">Choose from this brief</option>
                {pages.map(page=><option key={page} value={page}>{page}</option>)}
              </select>
              <button type="button" disabled={!pageName||items.length>=24}
                onClick={()=>addCard('page',pageName)}><Plus size={14}/> Add page</button>
            </label>
            <label>Saved inspiration
              <select aria-label="Choose saved inspiration" value={sourceId}
                onChange={e=>setSourceId(e.target.value)}>
                <option value="">Choose a saved reference</option>
                {sources.map(source=><option key={source.id} value={source.id}>{source.name}</option>)}
              </select>
              <button type="button" disabled={!sourceId||items.length>=24}
                onClick={()=>{const source=sources.find(s=>s.id===sourceId);
                  if(source)addCard('inspiration',source.name,source.id);}}>
                <Plus size={14}/> Pin reference
              </button>
            </label>
            <form onSubmit={e=>{e.preventDefault();addCard('decision',decision);}}>
              <label htmlFor="pw-new-decision">Design decision or task</label>
              <input id="pw-new-decision" maxLength={100} value={decision}
                placeholder="e.g. Confirm mobile navigation" onChange={e=>setDecision(e.target.value)}/>
              <button type="submit" disabled={decision.trim().length<2||items.length>=24}>
                <Plus size={14}/> Add decision
              </button>
            </form>
          </div>
          <div className="pw-columns">
            {ordered.map(column=><div className="pw-column" key={column.id}>
              <div className="pw-column-head">
                <strong>{column.title}</strong><span>{column.cards.length}</span>
                <small>{column.hint}</small>
              </div>
              <div className="pw-card-stack">
                {column.cards.length===0&&<p className="pw-column-empty">Drop ideas here through the card controls.</p>}
                {column.cards.map(item=><article className="pw-card" key={item.id}>
                  <div className="pw-card-top">
                    <span className="pw-card-kind">{item.type}</span>
                    <button type="button" aria-label={'Remove '+item.title}
                      onClick={()=>removeCard(item.id)}><Trash2 size={14}/></button>
                  </div>
                  <strong>{item.title}</strong>
                  {item.type==='inspiration'&&<small>Curated reference · {item.sourceId}</small>}
                  <label>Move to
                    <select value={item.stage}
                      aria-label={'Move '+item.title+' to column'}
                      onChange={e=>changeCard(item.id,{stage:e.target.value})}>
                      {STAGES.map(stage=><option key={stage.id} value={stage.id}>{stage.title}</option>)}
                    </select>
                  </label>
                  <label>Notes
                    <textarea rows={2} maxLength={360} value={item.notes}
                      aria-label={'Notes for '+item.title} placeholder="Why this choice matters…"
                      onChange={e=>changeCard(item.id,{notes:e.target.value})}/>
                  </label>
                </article>)}
              </div>
            </div>)}
          </div>
          <div className="pw-save-row">
            <small>{items.length}/24 cards · {dirty?'Unsaved edits':'Saved board is up to date'}</small>
            <button className="pw-primary" disabled={!dirty||busy} onClick={save}>
              <Save size={15}/>{busy?'Saving…':'Save design board'}
            </button>
          </div>
        </div>}
        {tab==='compare'&&<div className="pw-comparison">
          <p className="pw-comparison-intro">These are original design directions, compared by a heuristic—not tested layouts. Your selections also control Generate and Design Fusion.</p>
          <div className="pw-style-grid">
            {directions.map(direction=><article className="pw-style-card" key={direction.id}>
              <div className="pw-style-preview" aria-hidden="true"
                style={{background:direction.colors?.[0]||'#f4f7ff'}}>
                <div style={{background:direction.colors?.[2]||'#5675cf'}}/>
                <span style={{background:direction.colors?.[1]||'#fff'}}/>
                <i style={{background:direction.colors?.[2]||'#5675cf'}}/>
                <small style={{background:direction.colors?.[1]||'#fff'}}/>
              </div>
              <div className="pw-style-heading">
                <strong>{direction.name}</strong><span>{direction.match}/100</span>
              </div>
              <p>{direction.description}</p>
              <dl>
                <div><dt>Layout</dt><dd>{direction.layout}</dd></div>
                <div><dt>Typography</dt><dd>{direction.fonts}</dd></div>
                <div><dt>Motion</dt><dd>{direction.motion}</dd></div>
                <div><dt>Strength</dt><dd>{direction.strengths}</dd></div>
                <div><dt>Tradeoff</dt><dd>{direction.tradeoff}</dd></div>
              </dl>
              <button className={'pw-style-choice '+(selected.includes(direction.id)?'selected':'')}
                type="button" aria-pressed={selected.includes(direction.id)}
                onClick={()=>onSelectedChange(selected.includes(direction.id)?
                  selected.filter(id=>id!==direction.id):[...selected,direction.id])}>
                {selected.includes(direction.id)?<CheckCircle2 size={15}/>:<Plus size={15}/>}
                {selected.includes(direction.id)?'Selected for this project':'Add to selected directions'}
              </button>
            </article>)}
          </div>
          <p className="pw-comparison-note"><ShieldCheck size={14}/>
            Pick a direction or a fusion, then use Save design board to preserve your selections for another device. No untested accessibility or conversion claims.
          </p>
          <button className="pw-primary" onClick={save} disabled={!dirty||busy}>
            <Save size={15}/> {busy?'Saving…':'Save selected directions'}
          </button>
        </div>}
        {tab==='handoff'&&<div className="pw-handoff">
          <span className="pw-eyebrow">MILESTONE 14 / LOCAL EXPORT</span>
          <h4>Hand off only what you approved.</h4>
          <p>Prepare a lightweight developer brief from your saved project, selected design
            directions and cards explicitly moved to Approved. Ideas, Explore cards,
            chat messages, private feedback and checkpoint history stay out of the export.</p>
          <div className="pw-handoff-summary">
            <div><strong>{approvedItems.length}</strong><span>Approved cards</span></div>
            <div><strong>{workspace.selectedStyles.length}</strong><span>Saved directions</span></div>
            <div><strong>#{workspace.revision}</strong><span>Board revision</span></div>
          </div>
          {approvedItems.length>0&&<ul className="pw-handoff-list" aria-label="Cards included in handoff">
            {approvedItems.map(item=><li key={item.id}>
              <span>{item.type}</span><strong>{item.title}</strong>
            </li>)}
          </ul>}
          {!handoffReady&&<p className="pw-unsaved" role="status">
            {dirty?'Save the board before exporting; unsaved decisions cannot be handed off.':
              'Move at least one card to Approved and save the board to unlock exports.'}
          </p>}
          <div className="pw-handoff-actions">
            <button type="button" className="pw-primary" disabled={!handoffReady}
              onClick={()=>downloadHandoff('md')}><FileText size={15}/> Download Markdown</button>
            <button type="button" disabled={!handoffReady}
              onClick={()=>downloadHandoff('json')}><FileJson size={15}/> Download JSON</button>
            <button type="button" disabled={!handoffReady}
              onClick={copyHandoff}><Copy size={15}/> Copy Markdown</button>
          </div>
          <div className="pw-github">
            <h5><GitPullRequest size={17}/> Publish as a GitHub draft PR</h5>
            <p>Optional account integration. Uses a one-time fine-grained token
              with Contents and Pull requests write access to just your chosen repository.
              One-time tokens are never stored. Connected GitHub App tokens are encrypted server-side. GitHub may retain the published design specification.</p>
            {!authenticated?<p role="status">Sign in with Google before publishing a project to GitHub.</p>:
              <form onSubmit={publishGitHub}>
                {githubConnection.connected?<div className="pw-github-connected" role="status">
                  Connected to GitHub as <strong>{githubConnection.login}</strong>.
                  <button type="button" onClick={disconnectGitHub} disabled={githubBusy}>Disconnect GitHub</button>
                </div>:githubConnection.available?<div className="pw-github-connected">
                  Connect with GitHub to publish without pasting a token.
                  <button type="button" onClick={()=>window.location.assign('/auth/github/start')}>
                    Connect GitHub account
                  </button>
                </div>:<p className="pw-github-connected">
                  Account linking awaits administrator GitHub App configuration. One-time tokens still work.
                </p>}
                <label>Target repository
                  <input value={githubRepository} maxLength={140}
                    onChange={e=>setGithubRepository(e.target.value)}
                    placeholder="owner/repository" autoComplete="off"
                    aria-label="GitHub target repository" required/>
                </label>
                <label>One-time fine-grained GitHub token
                  <input value={githubToken} type="password" maxLength={500}
                    onChange={e=>setGithubToken(e.target.value)}
                    placeholder={githubConnection.connected?'Optional one-time token override':'Paste a scoped token for this publish only'} autoComplete="off"
                    aria-label="One-time GitHub access token" required={!githubConnection.connected}/>
                </label>
                <button type="submit" disabled={!handoffReady||githubBusy||(!githubConnection.connected&&githubToken.length<20)}>
                  <GitPullRequest size={15}/>{githubBusy?'Publishing…':'Create draft pull request'}
                </button>
              </form>}
            {publishedPr&&<p role="status">Created draft PR:
              <a href={publishedPr.pullRequestUrl} target="_blank" rel="noopener noreferrer">
                Review on GitHub <ExternalLink size={13}/></a>
            </p>}
          </div>
          <div className="pw-figma">
            <h5>Editable Figma handoff</h5>
            <p>Download JSON and import it with the Frontline Figma development plugin.
              This creates editable frames, colors and labeled decision cards in your
              selected Figma file. It does not copy third-party site layouts or send
              a private chat transcript to Figma.</p>
            <a href="https://github.com/shivamani0426/ui-ux-/tree/main/integrations/figma"
              target="_blank" rel="noopener noreferrer">
              Figma plugin setup instructions <ExternalLink size={13}/>
            </a>
          </div>
          <p className="pw-handoff-privacy"><ShieldCheck size={15}/>
            Nothing is shared with GitHub or Figma until you approve publishing or importing. Exports contain
            project briefs and approved decisions, so inspect them before sharing.
            They are specifications, not tested layouts, executable code or Figma files.
          </p>
        </div>}
        {tab==='versions'&&<div className="pw-versions">
          <form className="pw-checkpoint-form" onSubmit={e=>{e.preventDefault();checkpoint();}}>
            <div><strong>Save a named checkpoint</strong>
              <p>Capture the approved refinement, selected directions and current board. Chats, full prompts and other history stay in their original storage.</p></div>
            <label htmlFor="pw-checkpoint-title">Checkpoint name
              <input id="pw-checkpoint-title" maxLength={64} value={versionTitle}
                placeholder="e.g. Mobile navigation approved"
                onChange={e=>setVersionTitle(e.target.value)}/>
            </label>
            <button className="pw-primary" type="submit"
              disabled={busy||dirty||versionTitle.trim().length<2}>
              <Save size={15}/>{busy?'Saving…':'Save checkpoint'}
            </button>
          </form>
          {dirty&&<p className="pw-unsaved" role="status">
            Save your board changes before creating or restoring a checkpoint.
          </p>}
          {versions.length===0?<p className="pw-empty">No checkpoints yet. Save the board first, then name your first design decision.</p>:
          <ol className="pw-version-list">
            {[...versions].reverse().map((version,index)=><li key={version.id}>
              <div className="pw-version-num">{versions.length-index}</div>
              <div className="pw-version-info"><strong>{version.title}</strong>
                <small>{stamp(version.createdAt)} · {version.snapshot.items.length} cards ·
                  {version.snapshot.selectedStyles.map(s=>STYLE_NAMES[s]||s).join(' + ')||'No style chosen'}</small>
                {version.snapshot.refinement&&<p>Scope: {version.snapshot.refinement}</p>}
              </div>
              <div className="pw-version-actions">
                <button type="button" onClick={()=>compare(version)} disabled={busy}>
                  <ArrowLeftRight size={14}/> Compare
                </button>
                <button type="button" onClick={()=>restore(version)} disabled={busy||dirty}>
                  <RotateCcw size={14}/> Restore
                </button>
              </div>
            </li>)}
          </ol>}
          {comparison&&<div className="pw-change-report" role="status">
            <strong>Changes since “{comparison.title}”</strong>
            <div><span>Added cards</span><p>{comparison.added.join(', ')||'None'}</p></div>
            <div><span>Removed cards</span><p>{comparison.removed.join(', ')||'None'}</p></div>
            <div><span>Edited or moved</span><p>{comparison.changed.join(', ')||'None'}</p></div>
            <div><span>Styles added</span><p>{comparison.addedStyles.map(s=>STYLE_NAMES[s]||s).join(', ')||'None'}</p></div>
            <div><span>Styles removed</span><p>{comparison.removedStyles.map(s=>STYLE_NAMES[s]||s).join(', ')||'None'}</p></div>
            <div><span>Approved refinement changed</span>
              <p>{comparison.refinementChanged?'Yes':'No'}</p></div>
          </div>}
        </div>}
        <footer className="pw-footnote"><BookOpen size={14}/>
          Private to this project. Max 24 board cards and 12 checkpoints. Saving a checkpoint never overwrites chat messages or generated prompts.
        </footer>
      </>}
  </section>;
}
