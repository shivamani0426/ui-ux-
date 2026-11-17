import {useCallback,useEffect,useRef,useState} from 'react';
import {sampleCinematicTour,TOUR_DURATION_MS} from '../utils/cinematic-tour.mjs';

/**
 * Scroll is the existing source of truth for all Frontline chapters.
 * This driver only moves the native scroll position, never duplicates the
 * design's animation engine. Any intentional user interaction takes control.
 */
export function useCinematicTour({enabled,reducedMotion}){
  const [status,setStatusState]=useState('locked');
  const statusRef=useRef('locked');
  const rafRef=useRef(0);
  const lastFrameRef=useRef(0);
  const elapsedRef=useRef(0);
  const expectedScrollRef=useRef(null);
  const rangeRef=useRef(1);
  const setStatus=useCallback(next=>{
    if(statusRef.current!==next){
      statusRef.current=next;
      setStatusState(next);
    }
  },[]);
  const cancelFrame=useCallback(()=>{
    if(rafRef.current)cancelAnimationFrame(rafRef.current);
    rafRef.current=0;
    lastFrameRef.current=0;
  },[]);
  const stop=useCallback(next=>{
    cancelFrame();
    setStatus(next);
  },[cancelFrame,setStatus]);

  const advance=useCallback(function advance(now){
    rafRef.current=0;
    if(statusRef.current!=='playing')return;
    if(document.hidden){stop('paused');return}
    const actual=window.scrollY;
    if(expectedScrollRef.current!==null&&Math.abs(actual-expectedScrollRef.current)>24){
      // Includes scrollbar dragging (which need not fire a wheel event).
      stop('paused');return;
    }
    const previous=lastFrameRef.current;
    lastFrameRef.current=now;
    if(previous)elapsedRef.current=Math.min(TOUR_DURATION_MS,elapsedRef.current+Math.min(70,Math.max(0,now-previous)));
    const scene=sampleCinematicTour(elapsedRef.current);
    const target=Math.round(rangeRef.current*scene.progress);
    if(Math.abs(actual-target)>.5){
      window.scrollTo({top:target,behavior:'instant'});
    }
    expectedScrollRef.current=target;
    if(scene.done){stop('completed');return}
    rafRef.current=requestAnimationFrame(advance);
  },[stop]);
  const start=useCallback((reset=false)=>{
    cancelFrame();
    if(reset){
      elapsedRef.current=0;
      expectedScrollRef.current=0;
      window.scrollTo({top:0,behavior:'instant'});
    }else expectedScrollRef.current=window.scrollY;
    if(document.hidden){setStatus('paused');return}
    setStatus('playing');
    rafRef.current=requestAnimationFrame(advance);
  },[advance,cancelFrame,setStatus]);
  const pause=useCallback(()=>{if(statusRef.current==='playing')stop('paused')},[stop]);
  const skip=useCallback(()=>{
    if(!enabled)return;
    stop('completed');
    elapsedRef.current=TOUR_DURATION_MS;
    expectedScrollRef.current=null;
    window.scrollTo({top:Math.max(0,document.documentElement.scrollHeight-innerHeight),behavior:'instant'});
  },[enabled,stop]);
  const replay=useCallback(()=>{
    if(!enabled||reducedMotion)return;
    rangeRef.current=Math.max(1,document.documentElement.scrollHeight-innerHeight);
    start(true);
  },[enabled,reducedMotion,start]);

  useEffect(()=>{
    cancelFrame();
    if(!enabled){
      setStatus('locked');
      elapsedRef.current=0;
      expectedScrollRef.current=null;
      return undefined;
    }
    const measure=()=>{rangeRef.current=Math.max(1,document.documentElement.scrollHeight-innerHeight)};
    measure();
    if(reducedMotion){
      setStatus('manual');
      return undefined;
    }
    // No background/autoplay outside a visible, deliberately opened portal.
    start(true);
    const interrupt=event=>{
      if(event.type!=='wheel'&&event.target?.closest?.('.fl-tour-ui'))return;
      if(event.type==='keydown'&&![
        'ArrowDown','ArrowUp','PageDown','PageUp','Home','End',' ','Escape',
      ].includes(event.key))return;
      pause();
    };
    const hidden=()=>{if(document.hidden)pause()};
    const keys={passive:true,capture:true};
    window.addEventListener('wheel',interrupt,keys);
    window.addEventListener('touchstart',interrupt,keys);
    window.addEventListener('pointerdown',interrupt,keys);
    window.addEventListener('keydown',interrupt,true);
    document.addEventListener('visibilitychange',hidden);
    window.addEventListener('resize',measure,{passive:true});
    window.visualViewport?.addEventListener('resize',measure,{passive:true});
    const observer=typeof ResizeObserver==='function'?new ResizeObserver(measure):null;
    observer?.observe(document.documentElement);
    document.fonts?.ready?.then(()=>{if(statusRef.current==='playing')measure()}).catch(()=>{});
    return ()=>{
      cancelFrame();
      window.removeEventListener('wheel',interrupt,true);
      window.removeEventListener('touchstart',interrupt,true);
      window.removeEventListener('pointerdown',interrupt,true);
      window.removeEventListener('keydown',interrupt,true);
      document.removeEventListener('visibilitychange',hidden);
      window.removeEventListener('resize',measure);
      window.visualViewport?.removeEventListener('resize',measure);
      observer?.disconnect();
    };
  },[enabled,reducedMotion,start,pause,cancelFrame,setStatus]);

  return {status,pause,skip,replay};
}
