import * as THREE from 'three';
import { WebManager } from './WebManager';

export const CUT_REACH=1.25;

// Prefer the strand underfoot, then the aimed reachable strand, then the closest reachable one.
export class WebInteraction {
  private ray=new THREE.Raycaster();
  constructor(private web:WebManager,private surfaces:THREE.Object3D[]){}
  private reachable(origin:THREE.Vector3,point:THREE.Vector3){
    const direction=point.clone().sub(origin),distance=direction.length();
    if(distance<.04)return true;
    this.ray.set(origin,direction.normalize());this.ray.near=.015;this.ray.far=Math.max(.015,distance-.08);
    return !this.ray.intersectObjects(this.surfaces,false).length;
  }
  cutTarget(position:THREE.Vector3,rideId?:number,aim?:THREE.Ray){
    const ridden=rideId!==undefined?this.web.strands.get(rideId):undefined;
    if(ridden)return {strand:ridden,near:true};
    let aimed:ReturnType<WebManager['raycast']>;
    if(aim){
      this.ray.set(aim.origin,aim.direction);this.ray.near=0;this.ray.far=16;
      const obstruction=this.ray.intersectObjects(this.surfaces,false)[0];
      aimed=this.web.raycast(aim.origin,aim.direction,Math.min(16,(obstruction?.distance??16)+.08),.158);
      if(aimed&&aimed.point.distanceTo(position)<CUT_REACH&&this.reachable(position,aimed.point))return {strand:aimed.strand,near:true};
    }
    const nearest=this.web.getNearestPoint(position,CUT_REACH,p=>this.reachable(position,p));
    if(nearest)return {strand:nearest.strand,near:true};
    if(aimed)return {strand:aimed.strand,near:false};
  }
}
