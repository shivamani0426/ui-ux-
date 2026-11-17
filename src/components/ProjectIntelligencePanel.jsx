import React from 'react';
import {BrainCircuit,CheckCircle2,Compass,GitMerge,ShieldCheck} from 'lucide-react';
import './ProjectIntelligencePanel.css';

/** Bounded, readable summaries of this visitor's project only. */
export default function ProjectIntelligencePanel({project}){
  const analysis=project?.recommendations?.analysis;
  const comparisons=project?.recommendations?.comparison;
  if(!analysis)return null;
  const features=(analysis.features||[]).slice(0,12);
  const questions=(analysis.openQuestions||[]).slice(0,3);
  const ranked=(Array.isArray(comparisons)?comparisons:[]).slice(0,3);
  return <section className="pi-panel" aria-label="Project understanding and explainable design comparison">
    <div className="pi-head">
      <div className="pi-eyebrow"><BrainCircuit size={15} aria-hidden="true"/> FRONTLINE / PROJECT INTELLIGENCE</div>
      <h3>Understand the brief. Design with intent.</h3>
      <p>Requirements below are extracted from this project, while page suggestions and fit indicators are proposed starting points — not results of real user testing.</p>
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
    {features.length>0&&<div className="pi-features" aria-label="Explicitly requested modules">
      {features.map(feature=><span className="pi-chip" key={feature.id}><CheckCircle2 size={12} aria-hidden="true"/>{feature.label}</span>)}
    </div>}
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
          <p>{d.strengths}</p><small><b>Tradeoff:</b> {d.tradeoff}</small>
          <div className="pi-criteria">
            {Object.entries(d.criteria||{}).map(([name,score])=><span key={name}>{name.replace(/([A-Z])/g,' $1')} {score}/5</span>)}
          </div>
        </article>)}
      </div>
      <p className="pi-footnote"><ShieldCheck size={13} aria-hidden="true"/> These scores are heuristic, not empirical accessibility or usability measurements.</p>
    </details>}
  </section>;
}
