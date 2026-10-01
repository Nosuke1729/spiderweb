import * as THREE from 'three';
import { WebManager,type WebAnchor } from './WebManager';

// A small screen-space magnet, never a distant auto-target or a shot through a wall.
export class SilkAim {
  private ray=new THREE.Raycaster();
  constructor(private web:WebManager,private surfaces:THREE.Object3D[]){}
  pick(camera:THREE.PerspectiveCamera,pointer:THREE.Vector2,width:number,height:number,precise=false){
    const pixels=precise?22:13;
    const candidates:{anchor:WebAnchor;screen:THREE.Vector3;score:number}[]=[];
    const project=(point:THREE.Vector3)=>point.clone().project(camera);
    const distance=(p:THREE.Vector3)=>Math.hypot((p.x-pointer.x)*width*.5,(p.y-pointer.y)*height*.5);
    for(const strand of this.web.strands.values()){
      let a=this.web.sample(strand,0),pa=project(a);
      for(let i=1;i<=12;i++){
        const b=this.web.sample(strand,i/12),pb=project(b);
        if(pa.z>=-1&&pa.z<=1&&pb.z>=-1&&pb.z<=1){
          const dx=(pb.x-pa.x)*width*.5,dy=(pb.y-pa.y)*height*.5;
          const px=(pointer.x-pa.x)*width*.5,py=(pointer.y-pa.y)*height*.5;
          const u=THREE.MathUtils.clamp((px*dx+py*dy)/Math.max(.00001,dx*dx+dy*dy),0,1);
          // Perspective-correct interpolation gives the actual silk point beneath the cursor.
          const da=-a.clone().applyMatrix4(camera.matrixWorldInverse).z,db=-b.clone().applyMatrix4(camera.matrixWorldInverse).z;
          const weight=u*da/((1-u)*db+u*da),t=(i-1+weight)/12;
          const point=this.web.sample(strand,t),screen=project(point),error=distance(screen);
          const rayPoint=new THREE.Vector3(pointer.x,pointer.y,screen.z).unproject(camera);
          if(error<=pixels&&rayPoint.distanceTo(point)<(precise?.38:.24))candidates.push({anchor:{position:point,strandId:strand.id,t},screen,score:error});
        }
        a=b;pa=pb;
      }
    }
    // Endpoints and junctions win within the same small target, making closed frames reliable.
    for(const node of this.web.nodes.values()){
      const screen=project(node.position),error=distance(screen);
      const rayPoint=new THREE.Vector3(pointer.x,pointer.y,screen.z).unproject(camera);
      if(screen.z>=-1&&screen.z<=1&&error<=pixels&&rayPoint.distanceTo(node.position)<(precise?.38:.24))candidates.push({anchor:{position:node.position.clone(),nodeId:node.id},screen,score:error-pixels-1});
    }
    candidates.sort((a,b)=>a.score-b.score);
    for(const candidate of candidates){
      const delta=candidate.anchor.position.clone().sub(camera.position),length=delta.length();
      this.ray.set(camera.position,delta.normalize());this.ray.near=.02;this.ray.far=Math.max(.02,length-.08);
      if(length>18||this.ray.intersectObjects(this.surfaces,false).length)continue;
      return candidate;
    }
  }
}
