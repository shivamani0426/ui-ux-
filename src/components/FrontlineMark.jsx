import React, {useId} from 'react';

/**
 * Frontline's original F monogram.
 * A sculpted, slightly calligraphic F set inside a solar orbit.
 * Reuses the same amber / copper / champagne palette as the landing page.
 */
export default function FrontlineMark({className='',size=30,decorative=true}){
  const uid=useId().replaceAll(':','');
  const metal='fl-metal-'+uid;
  const halo='fl-halo-'+uid;
  return (
    <svg className={'fl-monogram '+className} width={size} height={size}
      viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"
      aria-hidden={decorative?'true':undefined}
      role={decorative?undefined:'img'} aria-label={decorative?undefined:'Frontline F monogram'}>
      <defs>
        <linearGradient id={metal} x1="14" y1="4" x2="54" y2="63" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFF9DB"/>
          <stop offset=".32" stopColor="#FFD698"/>
          <stop offset=".72" stopColor="#DB9860"/>
          <stop offset="1" stopColor="#9E503B"/>
        </linearGradient>
        <radialGradient id={halo} cx="0" cy="0" r="1" gradientTransform="translate(26 19) rotate(48) scale(46)">
          <stop stopColor="#FFE8AD" stopOpacity=".35"/>
          <stop offset="1" stopColor="#F4B97B" stopOpacity="0"/>
        </radialGradient>
      </defs>
      <circle cx="32" cy="32" r="29" fill={`url(#${halo})`} />
      <path d="M11 39c3 11 12 18 23 18 11 0 20-7 23-17" stroke={`url(#${metal})`} strokeOpacity=".65" strokeWidth="1.15" strokeLinecap="round"/>
      <path d="M12 24c3-10 12-17 23-17 8 0 16 4 21 11" stroke={`url(#${metal})`} strokeOpacity=".58" strokeWidth="1.15" strokeLinecap="round"/>
      <path d="M22 48V19.5C22 17 24 15 26.5 15H47L43.6 21.1H30V30.3H42.5L39.7 36H30V46.6C30 48.8 28.4 50 26.5 50H22Z"
        fill={`url(#${metal})`} stroke="#60342F" strokeWidth="1.45" strokeLinejoin="round" paintOrder="stroke"/>
      <path d="M21.9 19.8L21.9 47.1M30.2 30.2H42" stroke="#FFF9E1" strokeOpacity=".42" strokeWidth="1" strokeLinecap="round"/>
      <circle cx="51.4" cy="14" r="2.5" fill="#FFE8B6" />
      <path d="M51.4 8.5v2M51.4 17.5v2M45.9 14h2M54.9 14h2" stroke="#FFE8B6" strokeOpacity=".68" strokeWidth=".8" strokeLinecap="round"/>
    </svg>
  );
}
