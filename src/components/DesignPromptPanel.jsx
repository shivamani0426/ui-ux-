import React,{useEffect,useState} from 'react';
import {Copy,Layers3,RefreshCcw,Sparkles} from 'lucide-react';
import './DesignPromptPanel.css';

/** A prompt-only design deliverable, not a code/site generator. */
export default function DesignPromptPanel({project,mode,styles,api,notice}){
  const [busy,setBusy]=useState(false);
  const [refinement,setRefinement]=useState('');
  const [result,setResult]=useState(null);
  const styleKey=styles.join('|');
  useEffect(()=>{setResult(null);setRefinement('')},[project.id,mode,styleKey]);
  const generate=async()=>{
    if(busy)return;
    if(!styles.length){notice('Choose at least one design direction.');return}
    setBusy(true);
    try{
      const response=await api('/api/projects/'+encodeURIComponent(project.id)+'/design-prompt',{
        method:'POST',body:JSON.stringify({mode,styles,refinement})
      });
      setResult(response);
      notice(response.source==='ai'?'AI-enhanced design specification ready.':'Complete structured design specification ready.');
    }catch(error){notice('Could not create your design prompt: '+error.message)}
    finally{setBusy(false)}
  };
  const copy=async()=>{
    if(!result?.prompt)return;
    try{await navigator.clipboard.writeText(result.prompt);notice('Complete design specification copied.')}
    catch{notice('Clipboard blocked. Select the prompt below and copy manually.')}
  };
  const fusion=mode==='fusion';
  return <section className="di-panel" aria-label={fusion?'Design Fusion prompt engine':'Generate UI/UX prompt engine'}>
    <div className="di-head">
      <div className="di-intro">
        <span className="di-label">{fusion?'DESIGN FUSION':'GENERATE UI/UX'} / DESIGN INTELLIGENCE</span>
        <h3>{fusion?'Combine your selected concepts.':'Turn your idea into three design directions.'}</h3>
        <p>{fusion?'Blend chosen styles and privately saved inspiration metadata into one original, build-ready design specification.':'Create three original UI/UX directions, a detailed page plan and an implementation-ready design prompt.'}</p>
      </div>
      <span className="di-symbol" aria-hidden="true">{fusion?<Layers3 size={23}/>:<Sparkles size={23}/>}</span>
    </div>
    <p className="di-start-hint">Ready to generate a full copyable specification. You can optionally refine it below.</p>
    <div className="di-actions">
      <button type="button" className="di-primary" onClick={generate} disabled={busy||!styles.length}>
        {busy?<RefreshCcw size={16} className="spin"/>:fusion?<Layers3 size={16}/>:<Sparkles size={16}/>}
        {busy?'Composing design specification…':result?'Regenerate prompt':fusion?'Combine my selected concepts':'Generate three directions'}
      </button>
      {result&&<button type="button" className="di-copy" onClick={copy}><Copy size={15}/> Copy full prompt</button>}
    </div>
    <label className="di-refine">
      <span>Optional refinement (not required)</span>
      <textarea rows={2} maxLength={600} value={refinement}
        onChange={e=>setRefinement(e.target.value)}
        placeholder="Example: Prioritize mobile students, dark surfaces and accessible navigation…"
        aria-label="Additional design prompt requirements"/>
    </label>

    {result&&<div className="di-result">
      <div className="di-result-header">
        <strong>{fusion?'Original Design Fusion prompt':'Original Generate UI/UX prompt'}</strong>
        <small>{result.source==='ai'?'Structured + AI creative refinements via '+result.provider:'Complete structured specification'} · {styles.length} selected styles</small>
      </div>
      <pre tabIndex={0} aria-label="Complete generated copyable UI/UX design prompt">{result.prompt}</pre>
      {result.review&&<p className="di-coverage" role="status">{result.review.usedFallback
        ?'Complete structured specification preserved; AI refinement was unavailable or did not pass validation.'
        :'Quality gate: full specification validated and original AI refinements added ('+Object.values(result.review.checks).filter(Boolean).length+' coverage checks).'} This checks section coverage, not real-world usability.</p>}
      <p>Prompt only: no application code or working site has been generated. Referenced sites contribute curated metadata, not copied visual layouts.</p>
    </div>}
  </section>;
}
