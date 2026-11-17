import React, {useEffect, useRef} from 'react';

/**
 * Frontline's original lightweight WebGL accent renderer.
 * It enhances the CSS solar scene with pointer-reactive lighting and sine ripples.
 * No external scene, texture, geometry, proprietary shader or font is copied.
 * The underlying CSS orb/reflection remains a complete fallback.
 */
const VERTEX = `
attribute vec2 aPosition;
varying vec2 vUv;
void main(){
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;
const SUN = `
precision highp float;
varying vec2 vUv;
uniform vec2 uPointer;
uniform float uTime;
uniform float uScroll;
void main(){
  vec2 q = vUv * 2.0 - 1.0;
  float pointer = exp(-length(q - uPointer * vec2(0.52, -0.52)) * 2.2);
  float wave = sin(q.y * 11.0 - uTime * 1.1 + sin(q.x * 7.0 + uTime * 0.65) * 2.0);
  float bend = (0.024 * wave + 0.036 * pointer) * (1.0 - uScroll * 0.32);
  vec2 p = q + vec2(bend, bend * 0.45);
  float r = length(p);
  float mask = 1.0 - smoothstep(0.965, 1.005, r);
  float z = sqrt(max(0.0, 1.0 - min(r,1.0) * min(r,1.0)));
  vec3 n = normalize(vec3(p.x, p.y, z));
  float diffuse = max(dot(n, normalize(vec3(-0.44,0.68,0.95))), 0.0);
  float fresnel = pow(1.0 - z, 2.35);
  float streak = pow(max(0.0, sin(p.y * 3.9 + p.x * 2.0 + uTime * 0.18)), 5.0) * 0.075;
  vec3 gold = mix(vec3(0.84,0.34,0.19),vec3(1.0,0.93,0.62),clamp(0.16 + diffuse * 0.86,0.0,1.0));
  gold += vec3(0.19,0.13,0.055) * fresnel;
  gold += vec3(0.19,0.16,0.09) * (pointer * 0.19 + streak);
  gold = clamp(gold, 0.0, 1.0);
  gl_FragColor = vec4(gold, mask * 0.82);
}
`;
const WATER = `
precision highp float;
varying vec2 vUv;
uniform vec2 uPointer;
uniform float uTime;
uniform float uScroll;
void main(){
  vec2 p = (vUv - vec2(0.5, 0.49)) * vec2(2.5, 6.5);
  float d = length(p);
  float pointer = exp(-length(p - (uPointer * vec2(1.1,-0.5))) * 2.8);
  float time = uTime * 1.45;
  float rings = sin(d * 16.0 - time * 3.0 + pointer * 1.35);
  float crest = pow(max(rings,0.0),13.0);
  float attenuation = exp(-d * 0.45);
  float specular = crest * attenuation;
  float sparkling = pow(max(0.0,sin(p.x * 5.0 + time + sin(p.y * 8.0))),10.0) * 0.2;
  float mask = 1.0 - smoothstep(2.4,3.2,d);
  vec3 color = mix(vec3(0.86,0.55,0.35),vec3(1.0,0.94,0.65),specular);
  float alpha = mask * (specular * 0.49 + sparkling * 0.14) * (0.85 + uScroll * 0.15);
  gl_FragColor = vec4(color,alpha);
}
`;
const shader = (gl,type,source) => {
  const sh=gl.createShader(type);
  gl.shaderSource(sh,source);
  gl.compileShader(sh);
  if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS)){
    gl.deleteShader(sh);
    return null;
  }
  return sh;
};

export default function SolarFluidCanvas({mode='sun'}){
  const ref=useRef(null);
  useEffect(()=>{
    const canvas=ref.current;
    const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce), (pointer: coarse), (max-width: 700px)')?.matches;
    const lowPower=(navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2) || navigator.connection?.saveData;
    if(!canvas || reduced || lowPower) return;
    const gl=canvas.getContext('webgl',{alpha:true,antialias:false,premultipliedAlpha:false,preserveDrawingBuffer:false});
    if(!gl) return;
    const v=shader(gl,gl.VERTEX_SHADER,VERTEX);
    const f=shader(gl,gl.FRAGMENT_SHADER,mode==='water'?WATER:SUN);
    if(!v || !f){if(v)gl.deleteShader(v);if(f)gl.deleteShader(f);return;}
    const program=gl.createProgram();
    gl.attachShader(program,v);
    gl.attachShader(program,f);
    gl.linkProgram(program);
    gl.deleteShader(v);
    gl.deleteShader(f);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS)){gl.deleteProgram(program);return;}
    const buffer=gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
    gl.useProgram(program);
    const pos=gl.getAttribLocation(program,'aPosition');
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos,2,gl.FLOAT,false,0,0);
    const uTime=gl.getUniformLocation(program,'uTime');
    const uPointer=gl.getUniformLocation(program,'uPointer');
    const uScroll=gl.getUniformLocation(program,'uScroll');
    let raf=0, running=true, visible=true, lastDraw=0, resizeNeeded=true;
    let currentWidth=0,currentHeight=0;
    let scrollRange=Math.max(1,document.documentElement.scrollHeight-innerHeight);
    const pointer={x:0,y:0};
    const onPointer=e=>{
      if(!visible)return;
      pointer.x=(e.clientX/Math.max(1,window.innerWidth)-.5)*2;
      pointer.y=(e.clientY/Math.max(1,window.innerHeight)-.5)*2;
    };
    const measure=()=>{
      const rect=canvas.getBoundingClientRect();
      const dpr=Math.min(window.devicePixelRatio||1,1.25);
      currentWidth=Math.max(1,Math.min(900,Math.round(rect.width*dpr)));
      currentHeight=Math.max(1,Math.min(620,Math.round(rect.height*dpr)));
      scrollRange=Math.max(1,document.documentElement.scrollHeight-innerHeight);
      resizeNeeded=false;
      if(canvas.width!==currentWidth||canvas.height!==currentHeight){
        canvas.width=currentWidth;canvas.height=currentHeight;
        gl.viewport(0,0,currentWidth,currentHeight);
      }
    };
    const paint=time=>{
      raf=0;
      if(!running||!visible||document.hidden)return;
      if(resizeNeeded)measure();
      if(time-lastDraw>=40&&currentWidth>2&&currentHeight>2){
        lastDraw=time;
        gl.useProgram(program);
        gl.uniform1f(uTime,time/1000);
        gl.uniform2f(uPointer,pointer.x,pointer.y);
        gl.uniform1f(uScroll,Math.max(0,Math.min(1,window.scrollY/scrollRange)));
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
        gl.clearColor(0,0,0,0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLES,0,6);
      }
      wake();
    };
    const wake=()=>{
      // A hidden canvas must not keep a hot requestAnimationFrame loop alive.
      if(raf||!running||!visible||document.hidden)return;
      raf=requestAnimationFrame(paint);
    };
    const suspend=()=>{
      if(raf)cancelAnimationFrame(raf);
      raf=0;
    };
    const observer=typeof IntersectionObserver==='undefined'?null:
      new IntersectionObserver(entries=>{
        visible=Boolean(entries[0]?.isIntersecting);
        if(visible){resizeNeeded=true;wake()}
        else suspend();
      },{threshold:0.01});
    const resizeObserver=typeof ResizeObserver==='undefined'?null:new ResizeObserver(()=>{
      resizeNeeded=true;wake();
    });
    const onResize=()=>{resizeNeeded=true;wake()};
    const onVisibility=()=>document.hidden?suspend():wake();
    observer?.observe(canvas);
    resizeObserver?.observe(canvas);
    window.addEventListener('pointermove',onPointer,{passive:true});
    window.addEventListener('resize',onResize,{passive:true});
    document.addEventListener('visibilitychange',onVisibility);
    document.fonts?.ready?.then(()=>{if(running)onResize()}).catch(()=>{});
    canvas.style.opacity='1';
    wake();
    return ()=>{
      running=false;suspend();
      observer?.disconnect();
      resizeObserver?.disconnect();
      window.removeEventListener('pointermove',onPointer);
      window.removeEventListener('resize',onResize);
      document.removeEventListener('visibilitychange',onVisibility);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
    };
  },[mode]);
  return <canvas ref={ref} className={'fl-fluid-canvas fl-fluid-'+mode} aria-hidden="true" />;
}
