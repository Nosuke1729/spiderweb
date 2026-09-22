import * as THREE from 'three';

export type WebNode={id:number;position:THREE.Vector3;strands:Set<number>};
export type WebStrand={id:number;a:number;b:number;length:number;tension:number;integrity:number;energy:number;phase:number;pulse:number};
export type WebSave={nodes:{id:number;position:number[]}[];strands:{id:number;a:number;b:number}[]};

export class WebManager {
  readonly nodes=new Map<number,WebNode>();
  readonly strands=new Map<number,WebStrand>();
  readonly group=new THREE.Group();
  private nextNode=1;
  private nextStrand=1;
  private geometry=new THREE.BufferGeometry();
  private line:THREE.LineSegments;
  private positions=new Float32Array(0);
  private colors=new Float32Array(0);
  private segments=12;
  private pulseClock=0;
  onChange:()=>void=()=>{};
  constructor(scene:THREE.Scene){
    const mat=new THREE.LineBasicMaterial({vertexColors:true,transparent:true,opacity:.86,blending:THREE.AdditiveBlending,depthWrite:false});
    this.line=new THREE.LineSegments(this.geometry,mat);
    this.line.renderOrder=3;
    this.group.add(this.line);scene.add(this.group);
    this.rebuild();
  }
  private nearestNode(pos:THREE.Vector3){
    let nearest:WebNode|undefined;let distance=.36;
    for(const node of this.nodes.values()){const d=node.position.distanceTo(pos);if(d<distance){distance=d;nearest=node;}}
    return nearest;
  }
  private nodeAt(pos:THREE.Vector3){
    const existing=this.nearestNode(pos);if(existing)return existing;
    const node={id:this.nextNode++,position:pos.clone(),strands:new Set<number>()};this.nodes.set(node.id,node);return node;
  }
  add(a:THREE.Vector3,b:THREE.Vector3){
    if(a.distanceTo(b)<.45||this.strands.size>=240)return false;
    const na=this.nodeAt(a),nb=this.nodeAt(b);
    if(na.id===nb.id)return false;
    for(const id of na.strands){const s=this.strands.get(id)!;if((s.a===na.id&&s.b===nb.id)||(s.b===na.id&&s.a===nb.id))return false;}
    const length=na.position.distanceTo(nb.position);
    const strand={id:this.nextStrand++,a:na.id,b:nb.id,length,tension:THREE.MathUtils.clamp(1-length/22,.32,.94),integrity:1,energy:.26,phase:Math.random()*6,pulse:0};
    this.strands.set(strand.id,strand);na.strands.add(strand.id);nb.strands.add(strand.id);
    this.rebuild();this.onChange();return true;
  }
  remove(id:number){
    const s=this.strands.get(id);if(!s)return;
    this.nodes.get(s.a)?.strands.delete(id);this.nodes.get(s.b)?.strands.delete(id);this.strands.delete(id);
    for(const nid of [s.a,s.b])if(this.nodes.get(nid)?.strands.size===0)this.nodes.delete(nid);
    this.rebuild();this.onChange();
  }
  private rebuild(){
    this.positions=new Float32Array(this.strands.size*this.segments*2*3);
    this.colors=new Float32Array(this.positions.length);
    this.geometry.dispose();this.geometry=new THREE.BufferGeometry();
    this.geometry.setAttribute('position',new THREE.BufferAttribute(this.positions,3));
    this.geometry.setAttribute('color',new THREE.BufferAttribute(this.colors,3));
    this.line.geometry=this.geometry;
    this.geometry.setDrawRange(0,this.positions.length/3);
  }
  getEndpoints(s:WebStrand){return [this.nodes.get(s.a)!.position,this.nodes.get(s.b)!.position] as const;}
  getNearestPoint(position:THREE.Vector3,max=.65){
    let closest:{strand:WebStrand;point:THREE.Vector3;t:number;distance:number}|undefined;
    for(const s of this.strands.values()){
      const [a,b]=this.getEndpoints(s);const delta=b.clone().sub(a);
      const t=THREE.MathUtils.clamp(position.clone().sub(a).dot(delta)/delta.lengthSq(),0,1);
      const point=a.clone().addScaledVector(delta,t);const distance=point.distanceTo(position);
      if(distance<max&&(!closest||distance<closest.distance))closest={strand:s,point,t,distance};
    }
    return closest;
  }
  aimStrand(origin:THREE.Vector3,direction:THREE.Vector3,max=16){
    let found:{strand:WebStrand;distance:number}|undefined;
    const ray=new THREE.Ray(origin,direction);
    for(const s of this.strands.values()){
      const [a,b]=this.getEndpoints(s);
      const p=new THREE.Vector3(),q=new THREE.Vector3();
      const d=ray.distanceSqToSegment(a,b,p,q);
      const along=p.distanceTo(origin);
      if(d<.1&&along<max&&(!found||along<found.distance))found={strand:s,distance:along};
    }
    return found?.strand;
  }
  disturb(id:number,energy=1){
    const origin=this.strands.get(id);if(!origin)return;
    const queue:[number,number][]=[[id,energy]];const seen=new Set<number>();
    while(queue.length){
      const [sid,e]=queue.shift()!;if(seen.has(sid)||e<.12)continue;seen.add(sid);
      const s=this.strands.get(sid);if(!s)continue;s.energy=Math.max(s.energy,e);s.pulse=1;
      for(const nid of [s.a,s.b])for(const other of this.nodes.get(nid)!.strands)if(!seen.has(other))queue.push([other,e*.57]);
    }
  }
  nextAt(nodeId:number,exclude:number){
    const node=this.nodes.get(nodeId);if(!node)return;
    for(const id of node.strands)if(id!==exclude)return this.strands.get(id);
  }
  components(){
    const groups:number[][]=[],seen=new Set<number>();
    for(const node of this.nodes.values()){
      if(seen.has(node.id))continue;
      const group:number[]=[],queue=[node.id];seen.add(node.id);
      while(queue.length){
        const id=queue.shift()!;group.push(id);
        for(const sid of this.nodes.get(id)!.strands){const s=this.strands.get(sid)!;const other=s.a===id?s.b:s.a;if(!seen.has(other)){seen.add(other);queue.push(other);}}
      }
      groups.push(group);
    }
    return groups;
  }
  update(t:number,dt:number,sun:THREE.Vector3,camera:THREE.Vector3){
    this.pulseClock+=dt;
    let index=0;
    for(const s of this.strands.values()){
      const [a,b]=this.getEndpoints(s),delta=b.clone().sub(a);
      const lateral=new THREE.Vector3().crossVectors(delta,new THREE.Vector3(0,1,0)).normalize();
      if(lateral.lengthSq()<.01)lateral.set(1,0,0);
      const view=camera.clone().sub(a).normalize();
      const edge=Math.abs(new THREE.Vector3().crossVectors(delta.clone().normalize(),view).dot(sun));
      const base=.34+edge*.48;
      const glow=s.energy*.64+s.pulse*.4;
      for(let k=0;k<this.segments;k++){
        for(const u of [k/this.segments,(k+1)/this.segments]){
          const point=a.clone().lerp(b,u);
          const sag=Math.min(.65,s.length*s.length*.006)*(1.15-s.tension*.45)*(1-(2*u-1)**2);
          point.y-=sag;
          const vibrate=Math.sin(u*21+t*34+s.phase)*Math.sin(u*Math.PI)*s.energy*.11;
          point.addScaledVector(lateral,vibrate);
          this.positions[index]=point.x;this.positions[index+1]=point.y;this.positions[index+2]=point.z;
          const pulse=Math.max(0,1-Math.abs(u-(1-s.pulse))/.16)*s.energy*.85;
          const c=Math.min(1,base+glow+pulse);
          this.colors[index]=c*.74;this.colors[index+1]=c*.92;this.colors[index+2]=c;
          index+=3;
        }
      }
      s.energy*=Math.exp(-dt*2.2);
      s.pulse=Math.max(0,s.pulse-dt*.8);
    }
    this.geometry.attributes.position.needsUpdate=true;
    this.geometry.attributes.color.needsUpdate=true;
    this.geometry.computeBoundingSphere();
  }
  serialize():WebSave{return {nodes:[...this.nodes.values()].map(n=>({id:n.id,position:n.position.toArray()})),strands:[...this.strands.values()].map(s=>({id:s.id,a:s.a,b:s.b}))};}
  restore(data:WebSave){
    if(!data||!Array.isArray(data.nodes)||!Array.isArray(data.strands)||data.nodes.length>500||data.strands.length>240)return;
    try{
      for(const n of data.nodes){if(!Array.isArray(n.position)||n.position.length!==3||!n.position.every(Number.isFinite))return;this.nodes.set(n.id,{id:n.id,position:new THREE.Vector3().fromArray(n.position),strands:new Set()});this.nextNode=Math.max(this.nextNode,n.id+1);}
      for(const s of data.strands){const a=this.nodes.get(s.a),b=this.nodes.get(s.b);if(!a||!b)continue;
        const strand={id:s.id,a:s.a,b:s.b,length:a.position.distanceTo(b.position),tension:.7,integrity:1,energy:0,phase:Math.random()*6,pulse:0};
        this.strands.set(s.id,strand);a.strands.add(s.id);b.strands.add(s.id);this.nextStrand=Math.max(this.nextStrand,s.id+1);
      }
      this.rebuild();
    }catch{this.nodes.clear();this.strands.clear();this.rebuild();}
  }
}
