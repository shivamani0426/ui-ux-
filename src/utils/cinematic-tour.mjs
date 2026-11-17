/**
 * Frontline's cinematic landing itinerary (milliseconds, not scroll velocity).
 *
 * A readable hold separates each chapter, and every journey is quintic-eased:
 * visitors can enjoy the typography and solar scenes without hurried jumps.
 * The output is pure, so timing regressions can be tested without a browser.
 */
export const TOUR_STOPS=Object.freeze([0,.294,.482,.678,.855,1]);
export const TOUR_HOLDS_MS=Object.freeze([2200,3100,3200,3200,2800,0]);
export const TOUR_TRAVEL_MS=Object.freeze([5500,4900,5000,5200,6400]);

const clamp=value=>Math.min(1,Math.max(0,Number.isFinite(value)?value:0));
const smoother=t=>{const x=clamp(t);return x*x*x*(x*(x*6-15)+10)};
export const TOUR_DURATION_MS=TOUR_HOLDS_MS.reduce((a,b)=>a+b,0)+TOUR_TRAVEL_MS.reduce((a,b)=>a+b,0);

/** Exact-progress sample, never dependent on frame rate or browser timers. */
export function sampleCinematicTour(milliseconds){
  let time=Math.max(0,Number.isFinite(milliseconds)?milliseconds:0);
  for(let i=0;i<TOUR_STOPS.length;i++){
    const hold=TOUR_HOLDS_MS[i];
    if(time<=hold)return {progress:TOUR_STOPS[i],chapter:i,stage:'hold',done:i===TOUR_STOPS.length-1};
    time-=hold;
    if(i===TOUR_STOPS.length-1)break;
    const travel=TOUR_TRAVEL_MS[i];
    if(time<=travel){
      const progress=TOUR_STOPS[i]+(TOUR_STOPS[i+1]-TOUR_STOPS[i])*smoother(time/travel);
      return {progress:clamp(progress),chapter:i,stage:'travel',done:false};
    }
    time-=travel;
  }
  return {progress:1,chapter:TOUR_STOPS.length-1,stage:'complete',done:true};
}
