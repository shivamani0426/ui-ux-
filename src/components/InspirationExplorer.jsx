import React, {useEffect,useMemo,useState} from 'react';
import {ArrowUpRight, Bookmark, Check, Copy, Layers3, Search, SlidersHorizontal, Sparkles} from 'lucide-react';

const labels={
  minimal:'Calm structure',
  glass:'Atmospheric layers',
  creative:'Expressive editorial'
};
const maxCards=15;
const subset=(items,search,filter)=>{
  const q=search.trim().toLowerCase();
  return items.filter(item=>{
    const categoryOk=filter==='all'||item.styles.includes(filter);
    const queryOk=!q||[item.name,item.category,item.summary,...item.tags,...item.styles].join(' ').toLowerCase().includes(q);
    return categoryOk&&queryOk;
  }).slice(0,maxCards);
};

export default function InspirationExplorer({project,api,notice}){
  const [loading,setLoading]=useState(true);
  const [data,setData]=useState({matches:[],selected:[],librarySize:0});
  const [search,setSearch]=useState('');
  const [filter,setFilter]=useState('all');
  const [saving,setSaving]=useState('');
  const [exporting,setExporting]=useState(false);
  useEffect(()=>{
    let cancelled=false;
    setLoading(true);setSearch('');setFilter('all');
    api('/api/projects/'+encodeURIComponent(project.id)+'/inspirations')
      .then(response=>{if(!cancelled)setData(response)})
      .catch(e=>{if(!cancelled)notice('Could not load inspirations: '+e.message)})
      .finally(()=>{if(!cancelled)setLoading(false)});
    return()=>{cancelled=true};
  },[project.id,api]);
  const matches=useMemo(()=>subset(data.matches||[],search,filter),[data.matches,search,filter]);
  const chosen=new Set(data.selected||[]);
  const selectedCount=chosen.size;
  const toggle=async item=>{
    const next=!chosen.has(item.id);
    setSaving(item.id);
    try{
      const response=await api('/api/projects/'+encodeURIComponent(project.id)+'/inspirations',{
        method:'PUT',body:JSON.stringify({sourceId:item.id,selected:next})
      });
      setData(response);
      notice(next?item.name+' saved to your inspirations.':item.name+' removed from your selections.');
    }catch(e){notice('Could not save inspiration: '+e.message)}
    finally{setSaving('')}
  };
  const copy=async()=>{
    if(!selectedCount)return;
    setExporting(true);
    try{
      const response=await api('/api/projects/'+encodeURIComponent(project.id)+'/inspirations/prompt',{method:'POST'});
      await navigator.clipboard.writeText(response.prompt);
      notice('Original UI/UX design prompt copied from '+response.references.length+' inspirations.');
    }catch(e){notice('Could not copy prompt: '+e.message)}
    finally{setExporting(false)}
  };
  return (
    <section className="inspiration-explorer" aria-label="Select UI/UX design inspirations">
      <div className="inspiration-intro">
        <div className="inspiration-topline"><Sparkles size={15}/> <span>SELECT UI/UX / CURATED DESIGN INTELLIGENCE</span></div>
        <div className="inspiration-title-line">
          <div>
            <h2>Find a design worth <em>exploring.</em></h2>
            <p>References ranked by your project brief, style signals, and private saved choices. Open the original websites for a closer look.</p>
          </div>
          <span className="inspiration-collection-count">{data.librarySize||'—'}<small>references in library</small></span>
        </div>
      </div>
      <div className="inspiration-controls">
        <label className="inspiration-search"><Search size={16}/><input
          value={search} onChange={e=>setSearch(e.target.value)}
          placeholder="Search agency, dashboard, portfolio, 3D…" aria-label="Search recommended inspirations"/></label>
        <div className="inspiration-filters" role="group" aria-label="Filter design inspirations by style">
          {['all','minimal','glass','creative'].map(t=><button key={t} type="button"
            className={filter===t?'is-active':''} onClick={()=>setFilter(t)}
            aria-pressed={filter===t}>{t==='all'?'All styles':t==='minimal'?'Minimal':t==='glass'?'Glass':'Creative'}</button>)}
        </div>
      </div>
      {loading?<div className="inspiration-loading" role="status"><span className="inspiration-pulse"/><span>Matching design directions…</span></div>:
       matches.length===0?<div className="inspiration-none"><SlidersHorizontal size={18}/> No references match these filters. Try another keyword or choose All styles.</div>:
       <div className="inspiration-grid">
         {matches.map((item,index)=>{
           const saved=chosen.has(item.id);
           const primary=item.styles[0]||'minimal';
           return <article className={'inspiration-card '+(saved?'is-saved':'')} key={item.id}>
             <div className={'inspiration-art art-'+primary} aria-hidden="true">
               <span className="inspiration-art-orbit"/>
               <span className="inspiration-art-grid"/>
               <span className="inspiration-art-index">{String(index+1).padStart(2,'0')}</span>
               <span className="inspiration-art-label">{labels[primary]||'Original direction'}</span>
             </div>
             <div className="inspiration-card-body">
               <div className="inspiration-meta"><span>{item.category}</span><span className="inspiration-signal">{item.matchLabel}</span></div>
               <h3>{item.name}</h3>
               <div className="inspiration-reasons">
                 {item.reasons.map((reason,i)=><p key={i}><Check size={12}/>{reason}</p>)}
               </div>
               <div className="inspiration-tags">{item.tags.slice(0,3).map(t=><span key={t}>{t}</span>)}</div>
               <div className="inspiration-actions">
                 <button type="button" className={'inspiration-save '+(saved?'selected':'')}
                   disabled={Boolean(saving)} aria-pressed={saved}
                   onClick={()=>toggle(item)}>
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
        <div className="inspiration-saved-counter"><Layers3 size={18}/><span><strong>{selectedCount} saved</strong><small>Selections stay private to this browser's guest session.</small></span></div>
        <button type="button" className="inspiration-export" disabled={!selectedCount||exporting} onClick={copy}>
          <Copy size={16}/>{exporting?'Preparing…':'Copy design prompt'}
        </button>
      </div>
      <p className="inspiration-disclosure">Matching uses curated reference metadata, not a live visual scan. Artwork shown here is a decorative style illustration, not a screenshot of the linked site.</p>
    </section>
  );
}
