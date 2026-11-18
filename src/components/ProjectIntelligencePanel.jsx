import React,{useEffect,useState} from 'react';
import {BrainCircuit,CheckCircle2,Compass,GitMerge,ShieldCheck,RotateCcw,Sparkles,AlertCircle} from 'lucide-react';
import './ProjectIntelligencePanel.css';

/** Bounded, readable summaries of this visitor's project only. */
export default function ProjectIntelligencePanel({project,onRefine,busy=false}){
  const [refinement,setRefinement]=useState(String(project?.recommendations?.refinement||''));
  useEffect(()=>setRefinement(String(project?.recommendations?.refinement||'')),
    [project?.id,project?.recommendations?.refinement]);
  const analysis=project?.recommendations?.analysis;
  const comparisons=project?.recommendations?.comparison;
  if(!analysis)return null;
  const features=(analysis.features||[]).slice(0,12);
  const questions=(analysis.openQuestions||[]).slice(0,3);
  const ranked=(Array.isArray(comparisons)?comparisons:[]).slice(0,3);
  const decision=project?.recommendations?.decision||null;
  const excluded=(analysis.excludedFeatures||[]).slice(0,9);
  const saved=String(project?.recommendations?.refinement||'');
  const changed=refinement.trim()!==saved;
  const apply=event=>{
    event.preventDefault();
    if(!onRefine||busy||!changed)return;
    onRefine(refinement.trim());
  };
  return <section className="pi-panel" aria-label="Project understanding and explainable design comparison">
    <div className="pi-head">
      <div className="pi-eyebrow"><BrainCircuit size={15} aria-hidden="true"/> FRONTLINE / PROJECT INTELLIGENCE</div>
      <h3>Understand the brief. Design with intent.</h3>
      <p>Requirements below are extracted from this project, while page suggestions and fit indicators are proposed starting points — not results of real user testing.</p>
      <div className="pi-confidence" aria-label="Brief evidence strength">
        <Sparkles size={14} aria-hidden="true"/>
        <span>Evidence strength: <strong>{decision?.status||analysis.confidence||'low'}</strong> ·
        Based only on the written brief, not measured user testing</span>
      </div>
    </div>
    <div className="pi-summary">
      <div>
        <span className="pi-label">PROJECT TYPE</span>
        <strong>{analysis.category}</strong>
      </div>
      <div>
        <span className="pi-label">TARGET AUDIENCE</span>
        <strong>{(analysis.audience||[]).join(', ')}</strong>
        <small>{analysis.audienceSource==='suggested'?'Needs confirmation':'Mentioned in brief'}</small>
      </div>
      <div>
        <span className="pi-label">PRIMARY WORKFLOW</span>
        <strong>{analysis.workflows?.[0]?.name||'To be defined'}</strong>
      </div>
    </div>
    {decision?.primaryStyle&&<div className="pi-top-pick">
      <span className="pi-label">RECOMMENDED STARTING POINT</span>
      <strong>{decision.primaryStyle.name}</strong>
      <p>Best current heuristic fit for the stated goals. Compare the trade-offs before deciding;
        this is not a verified usability or accessibility score.</p>
    </div>}
    {features.length>0&&<div className="pi-features" aria-label="Explicitly requested modules">
      {features.map(feature=><span className="pi-chip" key={feature.id}><CheckCircle2 size={12} aria-hidden="true"/>{feature.label}</span>)}
    </div>}
    {excluded.length>0&&<div className="pi-exclusions" aria-label="Explicitly excluded capabilities">
      <strong><AlertCircle size={14} aria-hidden="true"/> Out of scope — not recommended</strong>
      <div>{excluded.map(feature=><span key={feature.id} className="pi-exclusion-chip">
        {feature.label}</span>)}</div>
      <p>These exclusions take priority over style suggestions or previous preferences.</p>
    </div>}
    <form className="pi-refine" onSubmit={apply}>
      <label htmlFor={'pi-refine-'+project.id}>
        <strong>Make recommendations more accurate</strong>
        <span>Describe what to keep, remove or prioritize. Your original brief and chat stay saved.</span>
      </label>
      <textarea id={'pi-refine-'+project.id} value={refinement}
        maxLength={450} rows={2} disabled={busy}
        placeholder="Example: Keep all approved tasks, exclude chat, prioritize mobile accessibility."
        onChange={event=>setRefinement(event.target.value)}/>
      <div className="pi-refine-actions">
        <small>{refinement.length}/450 characters · private to this project</small>
        {saved&&<button type="button" className="pi-refine-reset"
          onClick={()=>{setRefinement('');if(!busy)onRefine?.('')}}
          disabled={busy}><RotateCcw size={13}/> Reset</button>}
        <button type="submit" disabled={busy||!changed||(refinement.length>0&&refinement.trim().length<5)}>
          {busy?'Updating…':'Update recommendations'}
        </button>
      </div>
    </form>
    <details className="pi-details">
      <summary><Compass size={15} aria-hidden="true"/> Proposed pages and requirements</summary>
      <div className="pi-details-body">
        <div>
          <strong>Suggested pages</strong>
          <ol>{(analysis.pages||[]).slice(0,15).map(page=><li key={page}>{page}</li>)}</ol>
        </div>
        <div>
          <strong>Constraints and open decisions</strong>
          {analysis.constraints?.length?<ul>{analysis.constraints.map(x=><li key={x}>{x}</li>)}</ul>:<p>No technical constraints were explicitly stated.</p>}
          {questions.length>0&&<div className="pi-questions"><strong>Questions to clarify</strong><ul>{questions.map(x=><li key={x}>{x}</li>)}</ul></div>}
        </div>
      </div>
    </details>
    {ranked.length>0&&<details className="pi-details">
      <summary><GitMerge size={15} aria-hidden="true"/> Compare the three directions</summary>
      <div className="pi-comparisons">
        {ranked.map(d=><article key={d.id} className="pi-compare">
          <div className="pi-compare-top"><strong>{d.name}</strong><span>{d.match}/100 heuristic fit</span></div>
          <div className="pi-bar" aria-hidden="true"><span style={{width:d.match+'%'}}/></div>
          <p>{d.comparisonSummary||d.strengths}</p>
          <small><b>Strength:</b> {d.strengths}</small>
          <small><b>Tradeoff:</b> {d.tradeoff}</small>
          {d.mitigations?.length>0&&<ul className="pi-mitigations">
            {d.mitigations.map(line=><li key={line}>{line}</li>)}
          </ul>}
          {d.scoreFactors?.length>0&&<details className="pi-factor-details">
            <summary>Why this heuristic score?</summary>
            <ul>{d.scoreFactors.map((factor,i)=><li key={i}>
              <span>{factor.label}</span><strong>{factor.points>=0?'+':''}{factor.points}</strong>
            </li>)}</ul>
            <small>Points are bounded to 48–96; they are not test results.</small>
          </details>}
          {d.personalization?.styleSignal!==0&&d.personalization&&
            <small className="pi-feedback-impact">
              Personal feedback: {d.personalization.styleSignal>0?'+':''}{d.personalization.styleSignal}/5;
              effective heuristic effect {d.personalization.appliedPointAdjustment>0?'+':''}{d.personalization.appliedPointAdjustment} points
              {d.personalization.scoreBounded?' (bounded at the score limit)':''}.
            </small>}
          <div className="pi-criteria">
            {Object.entries(d.criteria||{}).map(([name,score])=><span key={name}>{name.replace(/([A-Z])/g,' $1')} {score}/5</span>)}
          </div>
        </article>)}
      </div>
      <p className="pi-footnote"><ShieldCheck size={13} aria-hidden="true"/> These scores are heuristic, not empirical accessibility or usability measurements.</p>
    </details>}
  </section>;
}
