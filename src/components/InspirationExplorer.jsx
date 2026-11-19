import React,{useEffect,useMemo,useState} from 'react';
import {ArrowUpRight,Bookmark,Check,Copy,ExternalLink,Globe2,Info,
  RefreshCw,Search,ShieldCheck,Sparkles} from 'lucide-react';

// M08: these are actual URLs returned by an authorized search index, NOT
// generated mockups, stored leaderboards, or invented publisher prompts.
export default function InspirationExplorer({project,api,notice}){
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [data,setData]=useState({matches:[],componentMatches:[],selected:[],sources:[],discovery:null,componentDiscovery:null,librarySize:0});
  const [search,setSearch]=useState('');
  const [kind,setKind]=useState('all');
  const [savedOnly,setSavedOnly]=useState(false);
  const [saving,setSaving]=useState('');
  const [retry,setRetry]=useState(0);
  useEffect(()=>{
    let active=true;
    setLoading(true);setError('');
    api('/api/projects/'+encodeURIComponent(project.id)+'/inspirations')
      .then(result=>{if(active)setData(result)})
      .catch(e=>{if(active)setError('Source discovery failed: '+e.message)})
      .finally(()=>{if(active)setLoading(false)});
    return()=>{active=false};
  },[project.id,api,retry]);
  const selected=useMemo(()=>new Set(data.selected||[]),[data.selected]);
  const matches=useMemo(()=>{
    const q=search.trim().toLowerCase();
    return (data.matches||[]).filter(x=>
      (kind==='all'||x.sourceKind===kind)&&
      (!savedOnly||selected.has(x.id))&&
      (!q||[x.name,x.category,x.provider,...(x.tags||[])].join(' ').toLowerCase().includes(q))
    ).slice(0,30);
  },[data.matches,kind,search,savedOnly,selected]);
  const componentMatches=useMemo(()=>{
    const q=search.trim().toLowerCase();
    if(kind==='inspiration')return [];
    return (data.componentMatches||[]).filter(x=>
      (!savedOnly||selected.has(x.id))&&
      (!q||[x.name,x.summary,x.category,...(x.tags||[])].join(' ').toLowerCase().includes(q))
    ).slice(0,16);
  },[data.componentMatches,kind,search,savedOnly,selected]);
  const sources=data.sources||[];
  const status=data.discovery?.status||'pending';
  async function toggle(item){
    const next=!selected.has(item.id);
    if(next&&selected.size>=8){notice('Save no more than eight source links per project.');return;}
    setSaving(item.id);
    try{
      const response=await api('/api/projects/'+encodeURIComponent(project.id)+'/inspirations',{
        method:'PUT',body:JSON.stringify({sourceId:item.id,selected:next})
      });
      setData(response);
      window.dispatchEvent(new CustomEvent('frontline:inspiration-change',{
        detail:{projectId:project.id}}));
      notice(next?'Original source link saved.':'Source link removed.');
    }catch(e){notice('Could not save source: '+e.message)}
    finally{setSaving('')}
  }
  return <section className="inspiration-explorer" aria-label="Live original-source design discoveries">
    <div className="inspiration-intro">
      <div className="inspiration-topline"><Sparkles size={15}/>
        <span>SELECT UI/UX / ORIGINAL PUBLISHER SOURCES</span></div>
      <div className="inspiration-title-line">
        <div>
          <h2>Discover real design <em>sources.</em></h2>
          <p>Kage recommendations come directly from its official publisher MCP,
            with real design links and exact original prompts when verified.
            Original React Bits components are presented separately, using its
            own publisher-maintained index. Other sites remain source links
            until their official retrieval interfaces are authorized.</p>
        </div>
        <span className="inspiration-collection-count">{data.librarySize||0}
          <small>verified design prompts</small></span>
      </div>
    </div>
    <div className="inspiration-discovery-state" role="status">
      <div><Globe2 size={16}/><strong>{status==='ready'?'Publisher prompt verified':
        status==='partial'?'Original publisher results':status==='no-matches'?'No matching source pages':
        status==='not-configured'?'Source retrieval disabled for tests':
        status==='rate-limited'?'Hourly search limit reached':
        status==='unavailable'?'Live source search unavailable':'Searching source websites'}</strong></div>
      {data.discovery?.note&&<p>{data.discovery.note}</p>}
      {error&&<p>{error}</p>}
      {data.discovery?.query&&<p>Only limited project keywords were sent to publisher MCP:
        <strong> {data.discovery.query}</strong>. Private chats, accounts and feedback were not sent.</p>}
      <button type="button" onClick={()=>setRetry(n=>n+1)} disabled={loading}>
        <RefreshCw size={14}/>{loading?'Searching…':'Retry source discovery'}
      </button>
    </div>
    <div className="inspiration-controls">
      <label className="inspiration-search"><Search size={16}/>
        <input value={search} onChange={e=>setSearch(e.target.value)}
          placeholder="Filter real source matches…" aria-label="Filter original website results"/>
      </label>
      <div className="inspiration-filters" role="group" aria-label="Type of source">
        {[['all','All sources'],['inspiration','UI/UX inspiration'],['animation','Components & animation']]
          .map(([id,label])=><button key={id} type="button"
            className={kind===id?'is-active':''} aria-pressed={kind===id}
            onClick={()=>setKind(id)}>{label}</button>)}
      </div>
      <div className="inspiration-advanced-controls">
        <label className="inspiration-saved-only">
          <input type="checkbox" checked={savedOnly} onChange={e=>setSavedOnly(e.target.checked)}/>
          Saved only
        </label>
        <span role="status" className="inspiration-result-count">{matches.length+componentMatches.length} shown</span>
      </div>
    </div>
    {loading?<div className="inspiration-loading" role="status">
      <span className="inspiration-pulse"/>Asking original publisher tools for real designs and prompts…
    </div>:matches.length? <div className="inspiration-grid">
      {matches.map(item=><article className={'inspiration-card '+(selected.has(item.id)?'is-saved':'')} key={item.id}>
        <div className="inspiration-card-body">
          <div className="inspiration-meta">
            <span>{item.sourceKind==='animation'?'ANIMATION / COMPONENT':'DESIGN REFERENCE'}</span>
            <span className="inspiration-signal">{item.matchLabel}</span>
          </div>
          <h3>{item.name}</h3>
          <p className="inspiration-publisher"><Globe2 size={13}/>{item.provider} · Official source link</p>
          <div className="inspiration-reasons">{(item.reasons||[]).slice(0,3).map((reason,i)=>
            <p key={i}><Check size={12}/>{reason}</p>)}</div>
          <details className="inspiration-evidence">
            <summary><Info size={13}/> Source provenance & ranking</summary>
            <p>{item.provenance}</p>
            <p>Relevance is heuristic metadata matching, not verified usability quality.
              Search results may change or become unavailable.</p>
          </details>
          {item.originalPromptStatus==='verified-publisher'&&item.originalPrompt?
            <details className="inspiration-prompt-verbatim">
              <summary><ShieldCheck size={15}/> Original {item.provider} prompt — verified from publisher</summary>
              <p>Verbatim text from {item.originalPromptOrigin}. No AI rewrite.
                Hash: <code>{item.originalPromptHash?.slice(0,18)}</code></p>
              <pre>{item.originalPrompt}</pre>
              <button type="button" onClick={async()=>{
                try{await navigator.clipboard.writeText(item.originalPrompt);
                  notice('Exact original '+item.provider+' prompt copied.');}
                catch{notice('Copy unavailable; select the publisher prompt text instead.');}
              }}><Copy size={15}/> Copy exact original publisher prompt</button>
            </details>:
            <div className="inspiration-original-prompt">
              <ShieldCheck size={15}/>
              <span>Original publisher prompt: <strong>Not verified or not available from this source.</strong>
                {' '}Visit the original site; Frontline does not manufacture it.</span>
            </div>}
          <div className="inspiration-actions">
            <button type="button" className={'inspiration-save '+(selected.has(item.id)?'selected':'')}
              onClick={()=>toggle(item)} disabled={Boolean(saving)}
              aria-pressed={selected.has(item.id)}>
              {selected.has(item.id)?<Check size={15}/>:<Bookmark size={15}/>}
              {saving===item.id?'Saving…':selected.has(item.id)?'Saved source':'Save source'}
            </button>
            <a href={item.originalPromptUrl||item.site} target="_blank" rel="noopener noreferrer"
              aria-label={'Open original '+item.provider+' source for '+item.name}>
              Open original source <ArrowUpRight size={15}/>
            </a>
          </div>
        </div>
      </article>)}
    </div>:componentMatches.length?null:
    <div className="inspiration-none">
      <Info size={18}/>
      {savedOnly?'No saved source links match these filters.':
        status==='not-configured'?'Source calls are disabled in automated test mode. No matches were invented.':
        'No verified original publisher pages match this project right now. Open a publisher below or try another brief.'}
    </div>}
    {!loading&&componentMatches.length>0&&<section className="inspiration-original-components"
      aria-label="Verified original UI components and animations">
      <div className="inspiration-components-head">
        <h3>Original React Bits components & animations</h3>
        <p>These are real component pages listed by React Bits itself.
          They are original source links and descriptions, <strong>not Kage prompts,
          generated UI, or republished component code.</strong> Open each original
          page for installation details and license conditions.</p>
        <small>{componentMatches.length} official-index matches</small>
      </div>
      <div className="inspiration-grid">
        {componentMatches.map(item=><article key={item.id}
          className={'inspiration-card inspiration-component-card '+(selected.has(item.id)?'is-saved':'')}>
          <div className="inspiration-card-body">
            <div className="inspiration-meta">
              <span>{item.componentCategory||'ORIGINAL COMPONENT'}</span>
              <span className="inspiration-signal">React Bits official index</span>
            </div>
            <h3>{item.name}</h3>
            <p className="inspiration-publisher"><Globe2 size={13}/>React Bits</p>
            {item.summary&&<p>{item.summary}</p>}
            <p className="inspiration-original-component-disclosure">
              <ShieldCheck size={14}/>
              The original component link is listed in React Bits' official catalogue.
              No publisher-authored design prompt was provided for this component.
            </p>
            <div className="inspiration-actions">
              <button type="button" className={'inspiration-save '+(selected.has(item.id)?'selected':'')}
                onClick={()=>toggle(item)} disabled={Boolean(saving)} aria-pressed={selected.has(item.id)}>
                {selected.has(item.id)?<Check size={15}/>:<Bookmark size={15}/>}
                {saving===item.id?'Saving…':selected.has(item.id)?'Saved component':'Save component link'}
              </button>
              <a href={item.site} target="_blank" rel="noopener noreferrer"
                aria-label={'Open original React Bits '+item.name}>
                Open original component <ArrowUpRight size={15}/>
              </a>
            </div>
          </div>
        </article>)}
      </div>
    </section>}
    <div className="inspiration-source-directory">
      <h3>Original websites covered</h3>
      <p>Each opens the original publisher. Listings below are a source directory,
        <strong> not fabricated matches for your project.</strong></p>
      <div className="inspiration-source-links">
        {sources.filter(s=>kind==='all'||s.kind===kind).map(source=>
          <a key={source.id} href={source.website} target="_blank" rel="noopener noreferrer">
            <span>{source.name}</span><ExternalLink size={14}/>
          </a>)}
      </div>
    </div>
    <div className="inspiration-bottom">
      <div className="inspiration-saved-counter"><Bookmark size={17}/>
        <span><strong>{selected.size} saved original source links</strong>
          <small>Private to this project. Review publisher permissions before reuse.</small>
        </span>
      </div>
    </div>
    <p className="inspiration-disclosure">No pre-loaded website suggestions, scraped
      screenshots or Frontline-generated “original publisher prompts.”
      Publisher prompts require authorized source access and reuse rights.
      Generate UI/UX and Design Fusion remain separate Frontline-original workflows.</p>
  </section>;
}
