import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { ShaderMaterial } from 'three';
import type { ExaminationMovement } from './EyeSurface';
/** Schematic authored-view illustration; not clinical or diagnostic imagery. */
export function PosteriorPole({x,movement}:{x:number;movement:ExaminationMovement}){
 const ref=useRef<ShaderMaterial>(null);
 const uniforms=useMemo(()=>({offset:{value:{x:0,y:0}}}),[]);
 useFrame(()=>{if(ref.current){ref.current.uniforms.offset.value.x=movement.current.x*.06;ref.current.uniforms.offset.value.y=movement.current.y*.04}});
 return <group position={[x,0,.01]}><mesh><circleGeometry args={[.145,96]}/><shaderMaterial ref={ref} uniforms={uniforms} vertexShader={`varying vec2 v;void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`} fragmentShader={`
 precision highp float;varying vec2 v;uniform vec2 offset;
 void main(){vec2 p=v-.5+offset;float r=length(v-.5);vec3 c=mix(vec3(.35,.065,.025),vec3(.70,.23,.08),1.-length(p)*1.3);c+=sin(p.x*99.)*sin(p.y*113.)*.013;
 float macula=exp(-dot((p-vec2(-.16,-.025))*11.,(p-vec2(-.16,-.025))*11.));c*=1.-macula*.3;
 float disc=1.-smoothstep(.063,.082,length((p-vec2(.19,.025))*vec2(1.,.9)));c=mix(c,vec3(.89,.65,.36),disc*.85);
 float cup=exp(-dot((p-vec2(.19,.025))*30.,(p-vec2(.19,.025))*30.));c=mix(c,vec3(.97,.79,.52),cup*.4);
 float dx=.19-p.x;float upper=.025+.37*sqrt(max(0.,dx));float lower=.025-.4*sqrt(max(0.,dx));float thickness=.004+max(0.,p.x+.4)*.004;
 float vessels=(1.-smoothstep(thickness,thickness+.004,min(abs(p.y-upper),abs(p.y-lower))))*step(p.x,.19);
 float branch=1.-smoothstep(.002,.005,abs(p.y-(.025+.6*(p.x-.19))));branch*=step(.19,p.x);
 c=mix(c,vec3(.30,.045,.025),max(vessels,branch)*.8);c*=1.-smoothstep(.37,.5,r)*.8;gl_FragColor=vec4(c,1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 }`}/></mesh></group>;
}
