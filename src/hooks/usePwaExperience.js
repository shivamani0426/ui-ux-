import {useCallback,useEffect,useState} from 'react';

/**
 * Install prompt is user initiated. Service worker caches only public shell
 * assets; it must never claim private records are available offline.
 */
export default function usePwaExperience(){
  const [online,setOnline]=useState(()=>navigator.onLine!==false);
  const [deferredPrompt,setDeferredPrompt]=useState(null);
  const [installed,setInstalled]=useState(()=>window.matchMedia?.('(display-mode: standalone)')?.matches||
    navigator.standalone===true||false);
  useEffect(()=>{
    const onOnline=()=>setOnline(true),onOffline=()=>setOnline(false);
    const beforeInstall=event=>{event.preventDefault();setDeferredPrompt(event)};
    const onInstalled=()=>{setInstalled(true);setDeferredPrompt(null)};
    window.addEventListener('online',onOnline);
    window.addEventListener('offline',onOffline);
    window.addEventListener('beforeinstallprompt',beforeInstall);
    window.addEventListener('appinstalled',onInstalled);
    if(import.meta.env.PROD&&window.isSecureContext&&'serviceWorker' in navigator)
      navigator.serviceWorker.register('/service-worker.js',{scope:'/'})
        .catch(()=>{/* Installation is optional; site still works online. */});
    return ()=>{
      window.removeEventListener('online',onOnline);
      window.removeEventListener('offline',onOffline);
      window.removeEventListener('beforeinstallprompt',beforeInstall);
      window.removeEventListener('appinstalled',onInstalled);
    };
  },[]);
  const install=useCallback(async()=>{
    if(!deferredPrompt)return false;
    try{
      await deferredPrompt.prompt();
      const result=await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      return result?.outcome==='accepted';
    }catch{setDeferredPrompt(null);return false;}
  },[deferredPrompt]);
  return {online,installed,installAvailable:!!deferredPrompt,install};
}
