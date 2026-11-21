/**
 * User-visible AI fallback guidance. Never expose upstream error bodies or
 * incorrectly attribute Groq/NVIDIA failures to OpenRouter.
 * No billing is enabled or requested by this helper.
 */
const PROVIDERS={openrouter:'OpenRouter',groq:'Groq',gemini:'Gemini',nvidia:'NVIDIA'};
export function aiFallbackGuidance({provider='openrouter',reason='provider-unavailable',
  retryAfterSeconds=0}={}){
  const label=PROVIDERS[provider]||'The AI provider';
  const minutes=Math.max(1,Math.ceil(
    Number.isFinite(Number(retryAfterSeconds))&&Number(retryAfterSeconds)>0?
      Number(retryAfterSeconds)/60:1));
  const wait=reason==='rate-limited'||reason==='billing-required';
  let note;
  if(reason==='billing-required'){
    note=label+' cannot process more requests under the current free account allowance. No paid service has been activated. Retry after free capacity becomes available.';
  }else if(reason==='rate-limited'){
    note=label+' is rate-limited. Repeated requests can consume the free allowance; avoid retrying for about '+minutes+' minute(s).';
  }else if(reason==='timeout'){
    note=label+' timed out. The provider may be overloaded; the brief-based guidance below remains available.';
  }else if(reason==='incomplete-output'){
    note=label+' stopped before completing the answer. Frontline did not pass incomplete AI text off as a finished design.';
  }else if(reason==='scope-conflict'){
    note='The AI suggestion contradicted an explicitly excluded capability, so Frontline used a scoped design guide instead.';
  }else{
    note=label+' did not provide an answer for this request.';
  }
  const retry=wait?
    '*Do not repeatedly press Retry while the free AI capacity is unavailable.*':
    '*You may use Retry with '+label+' to try again.*';
  return {note,retry};
}
