import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { Patient } from '../../../web/scene/Models';
import { PATIENT_BLINK_DURATION_SECONDS, patientBlinkClosure, patientBlinkDelay } from '../../../web/interaction/patientAnimation';
import './style.css';

type MeshData={name:string;positions:number[];uvs:number[];indices:number[];texture:string;center:number[]|null;blink?:number[]};
type View='face'|'seated'|'profile';
const asset=new URL('./assets/',window.location.href).href;
const gaze={x:0,y:0,eye:'both',follow:false,demo:false,blink:false};

// Code-generated iris detail on the fitted eye geometry; no external textures
// or transmissive extra render passes. Rotation moves the whole eye surface.
function eyeMaterial(){
  const material=new THREE.MeshStandardMaterial({color:'#f0ebe2',roughness:.23});
  material.onBeforeCompile=shader=>{
    shader.vertexShader='varying vec3 eyePoint;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\neyePoint = position;');
    shader.fragmentShader='varying vec3 eyePoint;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      float r = length(eyePoint.xy);
      float edge = max(fwidth(r), 0.00005);
      float angle = atan(eyePoint.y, eyePoint.x);
      float iris = (1.0-smoothstep(0.0073-edge,0.0073+edge,r))*step(0.0,eyePoint.z);
      float pupil = 1.0-smoothstep(0.0030-edge,0.0030+edge,r);
      float fibers = sin(angle*93.0 + sin(angle*37.0)*2.0 + r*1900.0)*0.5+0.5;
      float fine = sin(angle*171.0-r*2300.0)*0.5+0.5;
      vec3 irisColor = mix(vec3(0.075,0.045,0.022),vec3(0.26,0.18,0.08),fibers*.55+fine*.2);
      float limbus = smoothstep(0.0064,0.0073,r);
      irisColor = mix(irisColor,vec3(0.025,0.022,0.018),limbus*.85);
      irisColor = mix(irisColor,vec3(0.003,0.004,0.005),pupil);
      diffuseColor.rgb = mix(diffuseColor.rgb,irisColor,iris);
    `);
  };
  return material;
}

function Character({data}:{data:MeshData[]}) {
  const blinkState=useRef({next:3,start:-1});
  const gazeRotation=useMemo(()=>new THREE.Quaternion(),[]);
  const neutralRotation=useMemo(()=>new THREE.Quaternion(),[]);
  const gazeDirection=useMemo(()=>new THREE.Vector3(),[]);
  const forward=useMemo(()=>new THREE.Vector3(0,0,1),[]);
  const meshes=useMemo(()=>data.map(d=>{
    // Identical spherical eyes rotating about their geometric centres. The
    // imported eyes had different fitted profiles and off-centre iris surfaces.
    const geometry=d.center?new THREE.SphereGeometry(.0158,64,48):new THREE.BufferGeometry();
    if(!d.center){
      geometry.setAttribute('position',new THREE.Float32BufferAttribute(d.positions,3));
      geometry.setAttribute('uv',new THREE.Float32BufferAttribute(d.uvs,2));
      geometry.setIndex(d.indices); geometry.computeVertexNormals();
    }
    if(d.blink?.length){
      geometry.morphAttributes.position=[new THREE.Float32BufferAttribute(d.blink,3)];
      const closed=geometry.clone();closed.setAttribute('position',new THREE.Float32BufferAttribute(d.blink,3));closed.computeVertexNormals();
      geometry.morphAttributes.normal=[closed.getAttribute('normal').clone()];closed.dispose();
    }
    const map=d.center?null:new THREE.TextureLoader().load(asset+d.texture);
    if(map){map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=4;}
    const hair=d.name==='hair'||d.name==='brows';
    const material=d.center?eyeMaterial():new THREE.MeshStandardMaterial({map,color:d.name==='skin'?'#c3a38b':d.name==='brows'?'#675047':'#ffffff',roughness:hair?.85:.72,side:hair?THREE.DoubleSide:THREE.FrontSide,alphaTest:hair?.25:0});
    const mesh=new THREE.Mesh(geometry,material);mesh.name=d.name;mesh.castShadow=!d.center;mesh.receiveShadow=!d.center;
    if(d.center)mesh.position.set(d.name==='OD'?-.030:.030,1.4356,.130435);
    return mesh;
  }),[data]);
  useEffect(()=>()=>meshes.forEach(m=>{m.geometry.dispose();m.material.map?.dispose();m.material.dispose()}),[meshes]);
  useFrame(({clock},dt)=>{
    const time=clock.elapsedTime;
    const blink=blinkState.current;
    if((gaze.blink||time>=blink.next)&&blink.start<0){blink.start=time;gaze.blink=false;}
    const closure=blink.start<0?0:patientBlinkClosure(time-blink.start);
    if(blink.start>=0&&time-blink.start>=PATIENT_BLINK_DURATION_SECONDS){blink.start=-1;blink.next=time+patientBlinkDelay(Math.random());}
    for(const m of meshes)if(m.name==='skin'&&m.morphTargetInfluences)m.morphTargetInfluences[0]=closure;
    const targetX=gaze.demo?Math.sin(time*.7)*.8:gaze.x;
    const targetY=gaze.demo?Math.sin(time*.47)*.5:gaze.y;
    // Frame-rate-independent exponential easing, with no overshoot or snapping
    // when changing eyes, resetting, or switching between input modes.
    const alpha=1-Math.exp(-20*Math.min(dt,.05));
    // One distant fixation direction: conjugate movement without accidental
    // near-target convergence. Single-eye controls remain a preview option.
    gazeDirection.set(Math.tan(targetX*.30),Math.tan(targetY*.20),1).normalize();
    gazeRotation.setFromUnitVectors(forward,gazeDirection);
    for(const m of meshes)if(m.name==='OD'||m.name==='OS'){
      const enabled=gaze.eye==='both'||gaze.eye===m.name;
      m.quaternion.slerp(enabled?gazeRotation:neutralRotation,alpha);
    }
  });
  return <group>{meshes.map(m=><primitive key={m.name} object={m}/>)}<Chair/>{[-1,1].map(s=><group key={s} position={[s*.19,.075,.52]}><RoundedBox args={[.115,.035,.26]} radius={.015} position={[0,-.025,0]}><meshStandardMaterial color="#202b2d"/></RoundedBox><mesh scale={[.06,.055,.13]}><sphereGeometry args={[1,32,20]}/><meshStandardMaterial color="#334044" roughness={.85}/></mesh></group>)}</group>;
}
function Chair(){
  const cushion='#315c62', metal='#889b9b';
  const box=(key:string,p:[number,number,number],s:[number,number,number],color:string,r=.035)=><RoundedBox key={key} position={p} args={s} radius={r} smoothness={6} castShadow><meshStandardMaterial color={color} roughness={.65}/></RoundedBox>;
  return <group>
    <mesh position={[0,.055,.01]} receiveShadow><cylinderGeometry args={[.34,.39,.09,64]}/><meshStandardMaterial color={metal} metalness={.65} roughness={.3}/></mesh>
    <mesh position={[0,.28,.01]} castShadow><cylinderGeometry args={[.065,.09,.41,32]}/><meshStandardMaterial color={metal} metalness={.7} roughness={.24}/></mesh>
    {box('seat',[0,.58,.14],[.55,.14,.57],cushion,.065)}
    <group rotation={[-.08,0,0]}>{box('back',[0,1.01,-.17],[.49,.77,.13],cushion,.06)}</group>
    {box('head',[0,1.42,-.13],[.29,.20,.095],cushion,.045)}
    {[-1,1].map(s=><group key={s}>{box('support'+s,[s*.30,.70,.06],[.035,.28,.035],metal,.012)}{box('arm'+s,[s*.30,.86,.15],[.11,.065,.43],cushion,.03)}</group>)}
    {box('foot',[0,.16,.60],[.44,.045,.22],metal,.015)}
  </group>;
}
function Camera({view,after}:{view:View;after:boolean}){
  const controls=useRef<any>(null);const {camera}=useThree();
  useEffect(()=>{
    const y=after?1.435:1.5;
    const target=new THREE.Vector3(0,view==='seated'?.83:y,view==='seated'?.10:.10);
    camera.position.set(view==='profile'?.52:view==='seated'?.62:0,view==='seated'?1.05:y+.005,view==='profile'?.45:view==='seated'?3.15:after?.60:.80);
    if(controls.current){controls.current.target.copy(target);controls.current.update()}
    camera.lookAt(target);
  },[view,after,camera]);
  return <OrbitControls ref={controls} enableDamping dampingFactor={.08} enablePan={false} minDistance={.32} maxDistance={3.5} minPolarAngle={.35} maxPolarAngle={Math.PI*.7}/>;
}
function Stage({after,view,data}:{after:boolean;view:View;data:MeshData[]}){
  return <Canvas shadows dpr={[1,1.75]} camera={{fov:34,near:.01,far:30}} fallback={<p className="fallback">WebGL is unavailable. Open this preview in a browser with hardware acceleration.</p>} onCreated={({gl})=>{gl.toneMapping=THREE.ACESFilmicToneMapping;gl.toneMappingExposure=1.05;}}>
    <color attach="background" args={['#dce5e3']}/>
    <hemisphereLight args={['#e8f4ff','#b8aaa0',1.4]}/>
    <directionalLight position={[-2,3,4]} intensity={2.5} castShadow shadow-mapSize={[2048,2048]} shadow-bias={-.00015} shadow-normalBias={.015}/>
    <directionalLight position={[0,1.5,4]} intensity={1.1}/>
    <directionalLight position={[2,2,-1]} color="#cce7ed" intensity={1.5}/>
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,-.005,0]} receiveShadow><planeGeometry args={[20,20]}/><meshStandardMaterial color="#d5dfdc" roughness={1}/></mesh>
    <Suspense fallback={null}>{after?<Character data={data}/>:<group position={[0,0,.7]}><Patient xr/></group>}</Suspense>
    <Camera view={view} after={after}/>
  </Canvas>;
}
function App(){
  const [view,setView]=useState<View>('face');const [data,setData]=useState<MeshData[]|null>(null);const [error,setError]=useState('');
  const [x,setX]=useState(0),[y,setY]=useState(0),[eye,setEye]=useState('both'),[follow,setFollow]=useState(false),[demo,setDemo]=useState(false);
  useEffect(()=>{const abort=new AbortController();fetch(asset+'patient.json',{signal:abort.signal}).then(r=>{if(!r.ok)throw Error('Model download failed');return r.json()}).then(setData).catch(e=>{if(e.name!=='AbortError')setError(e.message)});return()=>abort.abort()},[]);
  gaze.x=x;gaze.y=y;gaze.eye=eye;gaze.follow=follow;gaze.demo=demo;
  return <main>
    <header><a className="brand" href="/">opto<span> / design lab</span></a><span className="status"><i/> LOCAL CONCEPT · 01</span></header>
    <section className="intro"><div><p className="eyebrow">PATIENT / VISUAL DEVELOPMENT</p><h1>A more human encounter.</h1><p>Compare the current patient with a textured, anatomically shaped 3D character.</p></div><a className="reference" href="https://sketchfab.com/3d-models/human-head-26335511efb24e4dbd636160f3d51a1a" target="_blank" rel="noreferrer">Your visual reference ↗</a></section>
    <nav aria-label="Camera presets">{(['face','seated','profile'] as View[]).map(v=><button key={v} aria-pressed={view===v} onClick={()=>setView(v)}>{v==='face'?'Face & eyes':v==='seated'?'Seated patient':'Three-quarter view'}</button>)}<span>Drag to orbit · scroll to zoom</span></nav>
    <section className="comparison">
      {[false,true].map(after=><article className="panel" key={String(after)}><div className="panel-title"><div><span className="number">{after?'02':'01'}</span><strong>{after?'Proposed direction':'Current patient'}</strong></div><span>{after?'TEXTURED 3D MESH':'LIVE OPTO MODEL'}</span></div>
        <div className="viewport" onPointerMove={e=>{if(after&&follow){const r=e.currentTarget.getBoundingClientRect();setX(Math.max(-1,Math.min(1,((e.clientX-r.left)/r.width-.5)*2)));setY(Math.max(-1,Math.min(1,-((e.clientY-r.top)/r.height-.5)*2)))}}}>
          {data?<Stage after={after} view={view} data={data}/>:<p className="loading" role="status">{error||'Loading patient study…'}</p>}
          <div className="caption">{after?'Sculpted anatomy · textured skin · separate eyes':'Existing procedural geometry'}</div>
        </div>
      </article>)}
    </section>
    <section className="controls"><div className="control-heading"><p className="eyebrow">TRY THE PROPOSED PATIENT</p><h2>Look around.</h2><p>Eye movement is a visual demo, independent of clinical procedures.</p></div><div className="inputs">
      <label>Move<select value={eye} onChange={e=>setEye(e.target.value)}><option value="both">Both eyes</option><option value="OD">Patient’s right eye (OD)</option><option value="OS">Patient’s left eye (OS)</option></select></label>
      <label>Horizontal gaze<input aria-label="Horizontal gaze" type="range" min="-1" max="1" step=".01" value={x} onChange={e=>{setDemo(false);setFollow(false);setX(+e.target.value)}}/></label>
      <label>Vertical gaze<input aria-label="Vertical gaze" type="range" min="-1" max="1" step=".01" value={y} onChange={e=>{setDemo(false);setFollow(false);setY(+e.target.value)}}/></label>
      <div className="actions"><button onClick={()=>{gaze.blink=true}}>Blink now</button><button aria-pressed={demo} onClick={()=>{setFollow(false);setDemo(!demo)}}>Smooth tracking demo</button><button aria-pressed={follow} onClick={()=>{setDemo(false);setFollow(!follow)}}>Follow pointer</button><button onClick={()=>{setDemo(false);setFollow(false);setX(0);setY(0);setEye('both')}}>Reset gaze</button></div>
    </div></section>
    <footer><p><strong>Prototype, not the final character.</strong> CC0 MakeHuman assets, custom seated pose and chair. This is an alternative asset study—not the linked Sketchfab model. Final hair/material polish, clinical eye integration and Quest performance remain to be developed.</p><a href="./README.md">Asset credits & preview notes ↗</a></footer>
  </main>;
}
createRoot(document.getElementById('root')!).render(<App/>);
