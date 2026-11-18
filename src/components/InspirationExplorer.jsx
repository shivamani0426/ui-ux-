import React,{useEffect,useMemo,useState} from 'react';
import {ArrowUpRight,Bookmark,Check,Copy,Layers3,Search,
  SlidersHorizontal,Sparkles,Info,ArrowUpDown} from 'lucide-react';

const labels={
  minimal:'Calm structure',glass:'Atmospheric layers',creative:'Expressive editorial'
};
const maxCards=30;
function subset(items,search,filter,onlySaved,selected,sort){
  const q=search.trim().toLowerCase();
  const found=(Array.isArray(items)?items:[]).filter(item=>{
    const styleOk=filter==='all'||item.styles?.includes(filter);
    const savedOk=!onlySaved||selected.has(item.id);
    const searchOk=!q||[item.name,item.category,item.summary,...(item.tags||[]),
      ...(item.styles||[])].join(' ').toLowerCase().includes(q);
    return styleOk&&savedOk&&searchOk;
  });
  if(sort==='name')found.sort((a,b)=>a.name.localeCompare(b.name));
  if(sort==='reference')found.sort((a,b)=>(a.rank??Infinity)-(b.rank??Infinity)||a.name.localeCompare(b.name));
  return found.slice(0,maxCards);
}

export default function InspirationExplorer({project,api,notice}){
  const [loading,setLoading]=useState(true);
  const [data,setData]=useState({matches:[],selected:[],librarySize:0});
  const [search,setSearch]=useState('');
  const [filter,setFilter]=useState('all');
  const [onlySaved,setOnlySaved]=useState(false);
  const [sort,setSort]=useState('relevance');
  const [saving,setSaving]=useState('');
  const [exporting,setExporting]=useState(false);
  useEffect(()=>{
    let cancelled=false;
    setLoading(true);setSearch('');setFilter('all');setOnlySaved(false);setSort('relevance');
    api('/api/projects/'+encodeURIComponent(project.id)+'/inspirations')
      .then(response=>{if(!cancelled)setData(response)})
      .catch(e=>{if(!cancelled)notice('Could not load inspirations: '+e.message)})
      .finally(()=>{if(!cancelled)setLoading(false)});
    return()=>{cancelled=true};
  },[project.id,api]);
  const chosen=useMemo(()=>new Set(data.selected||[]),[data.selected]);
  const matches=useMemo(()=>subset(data.matches,search,filter,onlySaved,chosen,sort),
    [data.matches,search,filter,onlySaved,chosen,sort]);
  const selectedCount=chosen.size;
  const toggle=async item=>{
    const next=!chosen.has(item.id);
    if(next&&selectedCount>=8){
      notice('Save up to eight references per project so the design handoff remains focused.');return;
    }
    setSaving(item.id);
    try{
      const response=await api('/api/projects/'+encodeURIComponent(project.id)+'/inspirations',{
        method:'PUT',body:JSON.stringify({sourceId:item.id,selected:next})
      });
      setData(response);
      window.dispatchEvent(new CustomEvent('frontline:inspiration-change',{detail:{projectId:project.id}}));
      notice(next?item.name+' saved to your inspirations.':item.name+' removed from your selections.');
    }catch(e){notice('Could not save inspiration: '+e.message)}
    finally{setSaving('')}
  };
  const copy=async()=>{
    if(!selectedCount||exporting)return;
    setExporting(true);
    try{
      const response=await api('/api/projects/'+encodeURIComponent(project.id)+'/inspirations/prompt',{method:'POST'});
      await navigator.clipboard.writeText(response.prompt);
      notice('Original UI/UX prompt copied from '+response.references.length+' references.');
    }catch(e){notice('Could not copy prompt: '+e.message)}
    finally{setExporting(false)}
  };
  return <section className="inspiration-explorer" aria-label="Select UI/UX design inspirations">
    <div className="inspiration-intro">
      <div className="inspiration-topline"><Sparkles size={15}/> <span>SELECT UI/UX / CURATED DESIGN INTELLIGENCE</span></div>
      <div className="inspiration-title-line">
        <div>
          <h2>Find a design worth <em>exploring.</em></h2>
          <p>Ranked from relevant metadata, explicit constraints and limited private preferences.
            The current brief always takes priority.</p>
        </div>
        <span className="inspiration-collection-count">{data.librarySize||'—'}<small>curated references</small></span>
      </div>
    </div>
    <div className="inspiration-controls">
      <label className="inspiration-search"><Search size={16}/>
        <input value={search} onChange={e=>setSearch(e.target.value)}
          placeholder="Search education, agency, dashboard, motion…" aria-label="Search recommended inspirations"/>
      </label>
      <div className="inspiration-filters" role="group" aria-label="Filter design inspirations by style">
        {['all','minimal','glass','creative'].map(t=><button key={t} type="button"
          className={filter===t?'is-active':''} onClick={()=>setFilter(t)}
          aria-pressed={filter===t}>{t==='all'?'All styles':t==='minimal'?'Minimal':t==='glass'?'Glass':'Creative'}</button>)}
      </div>
      <div className="inspiration-advanced-controls">
        <label className="inspiration-saved-only">
          <input type="checkbox" checked={onlySaved} onChange={e=>setOnlySaved(e.target.checked)}/>
          Saved only
        </label>
        <label className="inspiration-order"><ArrowUpDown size={14}/>
          <span>Order</span>
          <select value={sort} onChange={e=>setSort(e.target.value)} aria-label="Sort design inspirations">
            <option value="relevance">Brief relevance</option>
            <option value="name">Name A–Z</option>
            <option value="reference">Archived source rank</option>
          </select>
        </label>
        <span role="status" className="inspiration-result-count">{matches.length} shown</span>
      </div>
    </div>
    {loading?<div className="inspiration-loading" role="status"><span className="inspiration-pulse"/><span>Matching curated references…</span></div>:
      matches.length===0?<div className="inspiration-none"><SlidersHorizontal size={18}/>
        No references match these filters. Try another keyword, uncheck Saved only or choose All styles.
      </div>:
      <div className="inspiration-grid">
        {matches.map((item,index)=>{
          const saved=chosen.has(item.id);
          const primary=item.styles?.[0]||'minimal';
          return <article className={'inspiration-card '+(saved?'is-saved':'')} key={item.id}>
            <div className={'inspiration-art art-'+primary} aria-hidden="true">
              <span className="inspiration-art-orbit"/><span className="inspiration-art-grid"/>
              <span className="inspiration-art-index">{String(index+1).padStart(2,'0')}</span>
              <span className="inspiration-art-label">{labels[primary]||'Original direction'}</span>
            </div>
            <div className="inspiration-card-body">
              <div className="inspiration-meta"><span>{item.category}</span>
                <span className="inspiration-signal">{item.matchLabel}</span></div>
              <h3>{item.name}</h3>
              <div className="inspiration-reasons">
                {(item.reasons||[]).map((reason,i)=><p key={i}><Check size={12}/>{reason}</p>)}
              </div>
              {item.summary&&<p className="inspiration-summary">{item.summary}</p>}
              <details className="inspiration-evidence">
                <summary><Info size={13}/> Why this result?</summary>
                <p>Brief match: {item.evidence?.direct??0} metadata points.
                  {item.evidence?.personal>0?' Private taste adjustment: +'+item.evidence.personal+'.':''}
                  {item.evidence?.excludedPenalty>0?' Exclusion caution: −'+item.evidence.excludedPenalty+'.':''}
                  {' '}These are heuristic ranking signals, not verified site quality or usability scores.</p>
                <p>{item.provenance||'Curated metadata; no live website inspection.'}</p>
              </details>
              <div className="inspiration-tags">{(item.tags||[]).slice(0,3).map(t=><span key={t}>{t}</span>)}</div>
              <div className="inspiration-actions">
                <button type="button" className={'inspiration-save '+(saved?'selected':'')}
                  disabled={Boolean(saving)} aria-pressed={saved} onClick={()=>toggle(item)}>
                  {saved?<Check size={15}/>:<Bookmark size={15}/>}
                  {saving===item.id?'Saving…':saved?'Saved':'Save inspiration'}
                </button>
                <a href={item.site} target="_blank" rel="noopener noreferrer" aria-label={'Visit '+item.name+' website'}>
                  Visit site <ArrowUpRight size={15}/>
                </a>
              </div>
            </div>
          </article>;
        })}
      </div>}
    <div className="inspiration-bottom">
      <div className="inspiration-saved-counter"><Layers3 size={18}/>
        <span><strong>{selectedCount} saved</strong>
          <small>Up to 8 used for a prompt. Private to this guest or signed-in account.</small>
        </span>
      </div>
      <button type="button" className="inspiration-export" disabled={!selectedCount||exporting} onClick={copy}>
        <Copy size={16}/>{exporting?'Preparing…':'Copy design prompt'}
      </button>
    </div>
    <p className="inspiration-disclosure">
      Matching uses stored reference metadata only. Decorated artwork is illustrative, not screenshots.
      Archived awards or ranks are not live rankings. Verify licensing before reusing any third-party assets.
    </p>
  </section>;
}
