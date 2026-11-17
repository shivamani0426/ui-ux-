import React,{useMemo,useState} from 'react';
import {ArrowUpRight,BookOpen,ChevronRight,Clock3,Cloud,FolderKanban,Images,LayoutGrid,MessageCircleMore,RefreshCw,Search,Sparkles} from 'lucide-react';
import './FrontlineAccount.css';

const safeDate=value=>{
  const date=new Date(value||'');
  return Number.isFinite(date.valueOf())?date.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}):'Date unavailable';
};
const projectName=project=>String(project.title||'Untitled project').trim();
export default function FrontlineProjectLibrary({projects=[],overview,account=false,
  query='',onQuery,onOpen,onRefresh,onLoadMore,nextOffset=null,
  loading=false,moreBusy=false}){
  const [sort,setSort]=useState('recent');
  const [filter,setFilter]=useState('all');
  const shown=useMemo(()=>{
    const search=String(query).trim().toLowerCase();
    return projects.filter(p=>(projectName(p)+' '+String(p.brief||'')).toLowerCase().includes(search))
      .filter(p=>filter==='prompts'?Number(p.promptCount)>0:filter==='inspirations'?Number(p.inspirationCount)>0:true)
      .sort((a,b)=>sort==='alphabetical'?projectName(a).localeCompare(projectName(b)):
        (sort==='oldest'?1:-1)*(new Date(a.updatedAt||a.createdAt).getTime()-new Date(b.updatedAt||b.createdAt).getTime()));
  },[projects,query,sort,filter]);
  return <section className="fl-project-library" aria-label="My design projects">
    <div className="fl-library-hero">
      <span className="fl-account-eyebrow">YOUR DESIGN ARCHIVE</span>
      <h3>Ideas worth <em>keeping.</em></h3>
      <p>{account?'Your saved projects follow your Google account across devices.':
        'Projects here belong to this browser’s private guest session. Sign in to sync across devices.'}</p>
      <div className="fl-library-summary">
        <span><FolderKanban size={15}/> <strong>{overview?.projectCount??projects.length}</strong> projects</span>
        <span><Images size={15}/> <strong>{overview?.inspirationCount??'—'}</strong> inspirations</span>
        <span><Sparkles size={15}/> <strong>{overview?.promptCount??'—'}</strong> prompts</span>
      </div>
    </div>
    <div className="fl-library-controls">
      <label className="search-box">
        <Search size={16} aria-hidden="true"/>
        <input aria-label="Search saved conversations" value={query}
          onChange={event=>onQuery(event.target.value)} placeholder="Search your projects"/>
      </label>
      <div className="fl-library-selectors">
        <label>Show
          <select aria-label="Filter projects" value={filter} onChange={e=>setFilter(e.target.value)}>
            <option value="all">All designs</option>
            <option value="prompts">With prompts</option>
            <option value="inspirations">With inspirations</option>
          </select>
        </label>
        <label>Sort
          <select aria-label="Sort projects" value={sort} onChange={e=>setSort(e.target.value)}>
            <option value="recent">Recently active</option>
            <option value="oldest">Oldest activity</option>
            <option value="alphabetical">A to Z</option>
          </select>
        </label>
        <button type="button" className="fl-library-refresh" onClick={onRefresh} disabled={loading}
          aria-label="Refresh projects from server" title="Refresh saved projects">
          <RefreshCw size={16} className={loading?'spin':''}/>
        </button>
      </div>
    </div>
    <div className="fl-library-list">
      {projects.length===0?<div className="fl-library-empty">
        <LayoutGrid size={26} aria-hidden="true"/><strong>Your collection starts here</strong>
        <span>Start a design conversation to save your first project.</span>
      </div>:shown.length===0?<div className="fl-library-empty">
        <Search size={23} aria-hidden="true"/><strong>No matching designs</strong>
        <span>Try another search or choose a different filter.</span>
      </div>:shown.map(p=><button type="button" key={p.id} className="fl-project-card history-item" onClick={()=>onOpen(p)}
        aria-label={'Continue project: '+projectName(p)}>
        <div className="fl-project-card-heading"><span className="fl-project-icon"><BookOpen size={17}/></span>
          <span><strong>{projectName(p)}</strong>
            <small>{String(p.recommendations?.analysis?.category||'Design project')} · Last active {safeDate(p.updatedAt||p.createdAt)}</small>
          </span><ChevronRight size={17} className="fl-project-open"/>
        </div>
        <p>{String(p.brief||'')}</p>
        <div className="fl-project-metrics">
          <span><MessageCircleMore size={13}/> {p.messageCount??0} messages</span>
          <span><Sparkles size={13}/> {p.promptCount??0} prompts</span>
          <span><Images size={13}/> {p.inspirationCount??0} saved</span>
          <ArrowUpRight size={15} className="fl-project-open"/>
        </div>
      </button>)}
    </div>
    {nextOffset!==null&&<button type="button" className="fl-library-more" onClick={onLoadMore} disabled={moreBusy}>
      {moreBusy?'Loading earlier projects…':'Load earlier projects'} <ChevronRight size={15}/>
    </button>}
    <p className="fl-library-footnote"><Cloud size={13}/>{account?'Private to your signed-in Google account':'Private to this browser until linked to an account'}</p>
  </section>;
}
