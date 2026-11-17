import React from 'react';
import {BrainCircuit,PauseCircle,ShieldCheck,RotateCcw,Trash2} from 'lucide-react';
import './LearningPreferencesPanel.css';

const KEYS=[
  ['minimal','Minimal SaaS'],
  ['glass','Glass UI'],
  ['creative','Creative UI'],
];
const FIELDS=[
  {key:'motion',label:'Motion',values:[['minimal','Minimal'],['balanced','Balanced'],['expressive','Expressive']]},
  {key:'density',label:'Content density',values:[['compact','Compact'],['comfortable','Comfortable']]},
  {key:'contrast',label:'Contrast priority',values:[['standard','Standard'],['high','High']]},
  {key:'colorMood',label:'Color atmosphere',values:[['neutral','Neutral'],['warm','Warm'],['cool','Cool']]},
];
const DEFAULT={enabled:true,motion:'balanced',density:'comfortable',contrast:'standard',colorMood:'neutral'};
export default function LearningPreferencesPanel({profile={},evidence=[],busy=false,onChange,onClear}){
  const prefs={...DEFAULT,...(profile.personalization||{})};
  const enabled=prefs.enabled!==false;
  const weights=profile.styleWeights||{};
  const counter=style=>evidence.find(row=>row.style===style)||{};
  return <section className="learning-preferences" aria-label="Your private design learning preferences">
    <div className="learning-intro">
      <BrainCircuit size={18} aria-hidden="true"/>
      <div><strong>Your design memory</strong>
        <p>Only this visitor's choices influence recommendations. Explicit new project instructions always win.</p>
      </div>
    </div>
    <label className="learning-switch">
      <input type="checkbox" checked={enabled} disabled={busy} onChange={e=>onChange({enabled:e.target.checked})}/>
      <span><strong>{enabled?'Personal learning enabled':'Personal learning paused'}</strong>
      <small>{enabled?'Feedback and finalized selections can adjust future design suggestions.':'Preferences are stored but are not used or updated. Shared feedback is also disabled.'}</small></span>
      {enabled?<ShieldCheck size={18} aria-hidden="true"/>:<PauseCircle size={18} aria-hidden="true"/>}
    </label>
    <fieldset className="learning-settings" disabled={busy||!enabled}>
      <legend>Personalize future design prompts</legend>
      {FIELDS.map(field=><label key={field.key}>
        <span>{field.label}</span>
        <select value={prefs[field.key]} onChange={e=>onChange({[field.key]:e.target.value})}>
          {field.values.map(([value,label])=><option value={value} key={value}>{label}</option>)}
        </select>
      </label>)}
    </fieldset>
    <div className="learning-box">
      <strong>Style preferences — editable signals</strong>
      <p>Use − or + to correct each style's weight. These are personal signals, not measured usability scores.</p>
      {KEYS.map(([key,label])=><div className="learning-row" key={key}>
        <div><span>{label}</span>
        <small>{counter(key).likes||0} likes · {counter(key).dislikes||0} dislikes · {counter(key).refinements||0} improvements</small></div>
        <div className="learning-weight">
          <button type="button" aria-label={'Decrease '+label+' preference'} disabled={busy||!enabled||(weights[key]||0)<=-5}
            onClick={()=>onChange({styleWeights:{[key]:Math.max(-5,(weights[key]||0)-1)}})}>−</button>
          <output aria-label={label+' preference weight'}>{weights[key]||0}</output>
          <button type="button" aria-label={'Increase '+label+' preference'} disabled={busy||!enabled||(weights[key]||0)>=5}
            onClick={()=>onChange({styleWeights:{[key]:Math.min(5,(weights[key]||0)+1)}})}>+</button>
        </div>
      </div>)}
    </div>
    <div className="learning-privacy-note"><ShieldCheck size={15} aria-hidden="true"/>
      Your feedback remains private unless you separately opt into aggregate learning. Shared results use coarse size bands and require at least five distinct guest browser IDs per style; these are not verified people.
    </div>
    <button type="button" className="learning-clear" disabled={busy} onClick={onClear}>
      <Trash2 size={15}/> Clear only design preferences & feedback
    </button>
    <p className="learning-clear-note"><RotateCcw size={12}/> This does not delete saved projects, conversations or inspiration selections.</p>
  </section>;
}
