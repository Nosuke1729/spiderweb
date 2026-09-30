import * as THREE from 'three';
import { strandPoint, strandSag, strandTangent } from './WebPath';

export type WebNode={id:number;position:THREE.Vector3;strands:Set<number>};
export type WebStrand={id:number;a:number;b:number;length:number;tension:number;sag:number;integrity:number;energy:number;phase:number;pulse:number};
export type WebAnchor={position:THREE.Vector3;strandId?:number;t?:number};
export type StrandReplacement={strand:WebStrand;from:number;to:number};
export type WebSave={nodes:{id:number;position:number[]}[];strands:{id:number;a:number;b:number;sag?:number}[]};

export class WebManager {
  readonly nodes=new Map<number,WebNode>();
  readonly strands=new Map<number,WebStrand>();
  readonly group=new THREE.Group();
  private nextNode=1;
  private nextStrand=1;
  private geometry=new THREE.BufferGeometry();
  private line:THREE.LineSegments;
  private junctions:THREE.InstancedMesh;
  private positions=new Float32Array(0);
  private colors=new Float32Array(0);
  private segments=12;
  private pulseClock=0;
  onChange:()=>void=()=>{};
  onSplit:(id:number,parts:StrandReplacement[])=>void=()=>{};
  constructor(scene:THREE.Scene){
    const mat=new THREE.LineBasicMaterial({vertexColors:true,transparent:true,opacity:.86,blending:THREE.AdditiveBlending,depthWrite:false});
    this.line=new THREE.LineSegments(this.geometry,mat);
    this.line.renderOrder=3;
    this.group.add(this.line);scene.add(this.group);
    this.junctions=new THREE.InstancedMesh(new THREE.SphereGeometry(.027,8,6),new THREE.MeshStandardMaterial({color:'#cadfd8',roughness:.22,metalness:.15,emissive:'#527779',emissiveIntensity:.25}),500);
    this.junctions.count=0;this.group.add(this.junctions);
    this.rebuild();
  }
  private nearestNode(pos:THREE.Vector3){
    let nearest:WebNode|undefined;let distance=.2;
    for(const node of this.nodes.values()){const d=node.position.distanceTo(pos);if(d<distance){distance=d;nearest=node;}}
    return nearest;
  }
  private nodeAt(pos:THREE.Vector3){
    const existing=this.nearestNode(pos);if(existing)return existing;
    const node={id:this.nextNode++,position:pos.clone(),strands:new Set<number>()};this.nodes.set(node.id,node);return node;
  }
  private createStrand(na:WebNode,nb:WebNode,sag?:number){
    const length=na.position.distanceTo(nb.position),tension=THREE.MathUtils.clamp(1-length/22,.32,.94);
    const strand={id:this.nextStrand++,a:na.id,b:nb.id,length,tension,sag:sag??strandSag(length,tension),integrity:1,energy:.26,phase:Math.random()*6,pulse:0};
    this.strands.set(strand.id,strand);na.strands.add(strand.id);nb.strands.add(strand.id);return strand;
  }
  anchorPosition(anchor:WebAnchor){
    if(anchor.strandId===undefined)return anchor.position.clone();
    const strand=this.strands.get(anchor.strandId);
    return strand&&anchor.t!==undefined&&Number.isFinite(anchor.t)&&anchor.t>=0&&anchor.t<=1?this.sample(strand,anchor.t):undefined;
  }
  // Resolve both attachments before changing the graph. A failed shot must not damage existing silk.
  connect(a:WebAnchor,b:WebAnchor){
    const pa=this.anchorPosition(a),pb=this.anchorPosition(b);
    if(!pa||!pb||pa.distanceTo(pb)<.3)return false;
    const existingA=this.nearestNode(pa),existingB=this.nearestNode(pb);
    if(existingA&&existingB){
      if(existingA.id===existingB.id)return false;
      for(const id of existingA.strands){const s=this.strands.get(id)!;if(s.a===existingB.id||s.b===existingB.id)return false;}
    }
    // Two positions on the same strand already have a path between them.
    if(a.strandId!==undefined&&a.strandId===b.strandId)return false;
    const needsSplit=(anchor:WebAnchor,node?:WebNode)=>{
      const strand=anchor.strandId!==undefined?this.strands.get(anchor.strandId):undefined;
      return !!strand&&node?.id!==strand.a&&node?.id!==strand.b;
    };
    const splitCount=Number(needsSplit(a,existingA))+Number(needsSplit(b,existingB));
    if(this.strands.size+splitCount+1>240)return false;
    const changes:{id:number;parts:StrandReplacement[]}[]=[];
    const resolve=(anchor:WebAnchor,pos:THREE.Vector3,existing?:WebNode)=>{
      const node=existing??this.nodeAt(pos);
      if(needsSplit(anchor,existing)){
        const old=this.strands.get(anchor.strandId!)!,t=THREE.MathUtils.clamp(anchor.t!,0,1);
        const start=this.nodes.get(old.a)!,end=this.nodes.get(old.b)!;
        start.strands.delete(old.id);end.strands.delete(old.id);this.strands.delete(old.id);
        // Restrict the same parabola instead of recalculating sag: geometry and riders stay in place.
        const first=this.createStrand(start,node,old.sag*t*t),second=this.createStrand(node,end,old.sag*(1-t)*(1-t));
        for(const part of [first,second]){part.energy=old.energy;part.phase=old.phase;part.integrity=old.integrity;}
        changes.push({id:old.id,parts:[{strand:first,from:0,to:t},{strand:second,from:t,to:1}]});
      }
      return node;
    };
    const na=resolve(a,pa,existingA),nb=resolve(b,pb,existingB);
    this.createStrand(na,nb);
    for(const change of changes)this.onSplit(change.id,change.parts);
    this.rebuild();this.onChange();return true;
  }
  add(a:THREE.Vector3,b:THREE.Vector3){return this.connect({position:a},{position:b});}
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
    this.geometry.setAttribute('position',new THREE.BufferAttribute(this.positions,3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute('color',new THREE.BufferAttribute(this.colors,3).setUsage(THREE.DynamicDrawUsage));
    this.line.geometry=this.geometry;
    this.geometry.setDrawRange(0,this.positions.length/3);
    let count=0;const matrix=new THREE.Matrix4();
    for(const node of this.nodes.values())if(node.strands.size>=3){matrix.makeTranslation(node.position);this.junctions.setMatrixAt(count++,matrix);}
    this.junctions.count=count;this.junctions.instanceMatrix.needsUpdate=true;this.junctions.computeBoundingSphere();
  }
  getEndpoints(s:WebStrand){return [this.nodes.get(s.a)!.position,this.nodes.get(s.b)!.position] as const;}
  getNearestPoint(position:THREE.Vector3,max=.65){
    let closest:{strand:WebStrand;point:THREE.Vector3;t:number;distance:number}|undefined;
    const delta=new THREE.Vector3(),point=new THREE.Vector3(),last=new THREE.Vector3(),next=new THREE.Vector3();
    for(const s of this.strands.values()){
      const [a,b]=this.getEndpoints(s);delta.copy(b).sub(a);
      const straightT=THREE.MathUtils.clamp(point.copy(position).sub(a).dot(delta)/delta.lengthSq(),0,1);
      if(point.copy(a).addScaledVector(delta,straightT).distanceTo(position)>max+s.sag)continue;
      last.copy(a);
      for(let i=0;i<this.segments;i++){
        strandPoint(a,b,s.tension,(i+1)/this.segments,next,s.sag);delta.copy(next).sub(last);
        const u=THREE.MathUtils.clamp(point.copy(position).sub(last).dot(delta)/delta.lengthSq(),0,1);
        point.copy(last).addScaledVector(delta,u);const distance=point.distanceTo(position);
        if(distance<max&&(!closest||distance<closest.distance))closest={strand:s,point:point.clone(),t:(i+u)/this.segments,distance};
        last.copy(next);
      }
    }
    return closest;
  }
  raycast(origin:THREE.Vector3,direction:THREE.Vector3,max=16,radius=.14,min=0){
    let found:{strand:WebStrand;distance:number;point:THREE.Vector3;t:number}|undefined;
    const ray=new THREE.Ray(origin,direction),last=new THREE.Vector3(),next=new THREE.Vector3(),p=new THREE.Vector3(),onSilk=new THREE.Vector3();
    for(const s of this.strands.values()){
      const [a,b]=this.getEndpoints(s);last.copy(a);
      for(let i=1;i<=this.segments;i++){
        strandPoint(a,b,s.tension,i/this.segments,next,s.sag);
        const d=ray.distanceSqToSegment(last,next,p,onSilk);
        const along=p.clone().sub(origin).dot(direction);
        const u=THREE.MathUtils.clamp(onSilk.distanceTo(last)/Math.max(.0001,last.distanceTo(next)),0,1),t=(i-1+u)/this.segments;
        if(d<radius*radius&&along>=min&&along<=max&&(!found||along<found.distance))found={strand:s,distance:along,point:this.sample(s,t),t};
        last.copy(next);
      }
    }
    return found;
  }
  aimStrand(origin:THREE.Vector3,direction:THREE.Vector3,max=16){return this.raycast(origin,direction,max,.158)?.strand;}
  disturb(id:number,energy=1){
    const origin=this.strands.get(id);if(!origin)return;
    const queue:[number,number][]=[[id,energy]];const seen=new Set<number>();
    while(queue.length){
      const [sid,e]=queue.shift()!;if(seen.has(sid)||e<.12)continue;seen.add(sid);
      const s=this.strands.get(sid);if(!s)continue;s.energy=Math.max(s.energy,e);s.pulse=1;
      for(const nid of [s.a,s.b])for(const other of this.nodes.get(nid)!.strands)if(!seen.has(other))queue.push([other,e*.57]);
    }
  }
  nextAt(nodeId:number,exclude:number,wish?:THREE.Vector3){
    const node=this.nodes.get(nodeId);if(!node)return;
    let best:WebStrand|undefined,score=-Infinity;
    for(const id of node.strands){
      if(id===exclude)continue;
      const strand=this.strands.get(id)!;
      const [a,b]=this.getEndpoints(strand);
      const outgoing=strandTangent(a,b,strand.tension,strand.a===nodeId?0:1,strand.sag).multiplyScalar(strand.a===nodeId?1:-1);
      const alignment=wish?outgoing.dot(wish):0;
      if(alignment>score){score=alignment;best=strand;}
    }
    return best;
  }
  sample(strand:WebStrand,t:number,out=new THREE.Vector3()){
    const [a,b]=this.getEndpoints(strand);return strandPoint(a,b,strand.tension,t,out,strand.sag);
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
          const point=strandPoint(a,b,s.tension,u,new THREE.Vector3(),s.sag);
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
  serialize():WebSave{return {nodes:[...this.nodes.values()].map(n=>({id:n.id,position:n.position.toArray()})),strands:[...this.strands.values()].map(s=>({id:s.id,a:s.a,b:s.b,sag:s.sag}))};}
  restore(data:WebSave){
    if(!data||!Array.isArray(data.nodes)||!Array.isArray(data.strands)||data.nodes.length>500||data.strands.length>240)return;
    const nodes=new Map<number,WebNode>(),strands=new Map<number,WebStrand>();
    for(const node of data.nodes){
      if(!Number.isSafeInteger(node.id)||node.id<1||nodes.has(node.id)||!Array.isArray(node.position)||node.position.length!==3||!node.position.every(v=>Number.isFinite(v)&&Math.abs(v)<100))return;
      nodes.set(node.id,{id:node.id,position:new THREE.Vector3().fromArray(node.position),strands:new Set()});
    }
    for(const entry of data.strands){
      const a=nodes.get(entry.a),b=nodes.get(entry.b);
      if(!Number.isSafeInteger(entry.id)||entry.id<1||strands.has(entry.id)||!a||!b||a===b)return;
      const length=a.position.distanceTo(b.position);if(length<.1||length>100)return;
      const tension=THREE.MathUtils.clamp(1-length/22,.32,.94);
      if(entry.sag!==undefined&&(!Number.isFinite(entry.sag)||entry.sag<0||entry.sag>1))return;
      const strand={id:entry.id,a:entry.a,b:entry.b,length,tension,sag:entry.sag??strandSag(length,tension),integrity:1,energy:0,phase:Math.random()*6,pulse:0};
      strands.set(entry.id,strand);a.strands.add(entry.id);b.strands.add(entry.id);
    }
    this.nodes.clear();this.strands.clear();
    for(const node of nodes.values())if(node.strands.size){this.nodes.set(node.id,node);this.nextNode=Math.max(this.nextNode,node.id+1);}
    for(const strand of strands.values()){this.strands.set(strand.id,strand);this.nextStrand=Math.max(this.nextStrand,strand.id+1);}
    this.rebuild();
  }
}
