import * as THREE from 'three';
import { Spider } from './Spider';
import { SpiderCamera } from '../camera/SpiderCamera';
import { Input } from '../core/Input';

export class SpiderController {
  readonly position=new THREE.Vector3(-3,.45,-2.5);
  readonly normal=new THREE.Vector3(0,1,0);
  readonly heading=new THREE.Vector3(-.65,0,-.76).normalize();
  speed=0;
  airborne=false;
  private velocity=new THREE.Vector3();
  private ray=new THREE.Raycaster();
  private orientation=new THREE.Quaternion();
  private scratch=new THREE.Vector3();
  private probeOffsets=[new THREE.Vector3(),new THREE.Vector3(.16,0,0),new THREE.Vector3(-.16,0,0),new THREE.Vector3(0,0,.16)];
  private webRide?:{a:THREE.Vector3;b:THREE.Vector3;t:number;id:number;direction:number};
  onRideEnd:(id:number,end:'a'|'b',drive:number)=>{id:number;a:THREE.Vector3;b:THREE.Vector3;t:number;direction:number}|undefined=()=>undefined;

  constructor(private spider:Spider,private camera:SpiderCamera,private input:Input,private colliders:THREE.Object3D[]){
    this.position.y=.25;
    this.spider.group.position.copy(this.position);
  }
  restore(p:number[]){if(p.length===3&&p.every(Number.isFinite)&&Math.abs(p[0])<40&&Math.abs(p[1])<30&&Math.abs(p[2])<40){this.position.set(p[0],p[1],p[2]);}}
  jump(){if(this.webRide){this.webRide=undefined;this.airborne=true;this.velocity.copy(this.normal).multiplyScalar(2.7);return;}if(!this.airborne){this.airborne=true;this.velocity.copy(this.normal).multiplyScalar(3.8).addScaledVector(this.heading,1.2);}}
  ride(a:THREE.Vector3,b:THREE.Vector3,t:number,id:number,direction=1){this.webRide={a,b,t,id,direction};this.airborne=false;}
  isRiding(){return !!this.webRide;}
  private cast(origin:THREE.Vector3,direction:THREE.Vector3,max:number){
    this.ray.set(origin,direction);this.ray.far=max;
    return this.ray.intersectObjects(this.colliders,false)[0];
  }
  private worldNormal(hit:THREE.Intersection):THREE.Vector3{
    return hit.face!.normal.clone().transformDirection(hit.object.matrixWorld).normalize();
  }
  update(dt:number,t:number){
    const forward=this.camera.forward();const right=this.camera.right();
    const inputDir=new THREE.Vector3();
    if(this.input.pressed('KeyW','ArrowUp'))inputDir.add(forward);
    if(this.input.pressed('KeyS','ArrowDown'))inputDir.sub(forward);
    if(this.input.pressed('KeyD','ArrowRight'))inputDir.add(right);
    if(this.input.pressed('KeyA','ArrowLeft'))inputDir.sub(right);
    inputDir.projectOnPlane(this.normal);
    if(inputDir.lengthSq()>.01)inputDir.normalize();
    const targetSpeed=this.input.pressed('ShiftLeft','ShiftRight')?4.1:2.25;
    this.speed=THREE.MathUtils.lerp(this.speed,inputDir.lengthSq()>.01?targetSpeed:0,1-Math.exp(-10*dt));
    if(this.webRide){
      const ride=this.webRide;const length=ride.a.distanceTo(ride.b);
      const drive=(this.input.pressed('KeyW','ArrowUp')?1:0)-(this.input.pressed('KeyS','ArrowDown')?1:0);
      ride.t=THREE.MathUtils.clamp(ride.t+drive*ride.direction*dt*2.1/Math.max(1,length),0,1);
      this.position.copy(ride.a).lerp(ride.b,ride.t).add(new THREE.Vector3(0,-.14,0));
      this.normal.set(0,1,0);this.heading.copy(ride.b).sub(ride.a).normalize().projectOnPlane(this.normal).normalize();
      if(drive!==0&&(ride.t===0||ride.t===1)){
        const next=this.onRideEnd(ride.id,ride.t===0?'a':'b',drive);
        if(next)this.ride(next.a,next.b,next.t,next.id,next.direction);
        else {this.webRide=undefined;this.airborne=true;this.velocity.set(0,.6,0);}
      }
    } else if(this.airborne){
      this.velocity.addScaledVector(inputDir,dt*2);
      this.velocity.y-=10*dt;
      const next=this.position.clone().addScaledVector(this.velocity,dt);
      const travel=next.clone().sub(this.position);const distance=travel.length();
      if(distance>.001){
        const hit=this.cast(this.position,travel.normalize(),distance+.27);
        if(hit&&this.velocity.dot(this.worldNormal(hit))<0){
          const n=this.worldNormal(hit);
          this.position.copy(hit.point).addScaledVector(n,.24);
          this.transport(n);this.airborne=false;this.velocity.set(0,0,0);
        }else this.position.copy(next);
      }
      if(this.position.y<-.3){this.position.set(0,.5,4);this.velocity.set(0,0,0);this.airborne=false;}
    } else {
      const move=inputDir.clone().multiplyScalar(this.speed*dt);
      const candidate=this.position.clone().add(move);
      const search=move.length()>.001?move.clone().normalize():this.heading;
      let best:THREE.Intersection|undefined;
      let bestNormal:THREE.Vector3|undefined;
      // A forward probe catches a new wall or underside before the support probe loses contact.
      if(move.lengthSq()>.000001){
        const hit=this.cast(this.position.clone().addScaledVector(this.normal,.02),search,.43+move.length());
        if(hit){const n=this.worldNormal(hit);if(n.dot(search)<-.18){best=hit;bestNormal=n;}}
      }
      if(!best){
        const down=this.normal.clone().negate();
        const center=this.cast(candidate.clone().addScaledVector(this.normal,.48),down,1.2);
        if(center){
          best=center;
          const blended=this.worldNormal(center);
          let samples=1;
          for(const offset of this.probeOffsets.slice(1)){
            const side=offset.clone().applyQuaternion(this.orientation);
            const hit=this.cast(candidate.clone().addScaledVector(this.normal,.48).add(side),down,1.2);
            if(hit&&hit.object===center.object&&Math.abs(hit.distance-center.distance)<.22){blended.add(this.worldNormal(hit));samples++;}
          }
          bestNormal=blended.multiplyScalar(1/samples).normalize();
        }else{
          // Side probes retain contact at narrow edges, offset back to the body center.
          for(const offset of this.probeOffsets.slice(1)){
            const side=offset.clone().applyQuaternion(this.orientation);
            const hit=this.cast(candidate.clone().addScaledVector(this.normal,.48).add(side),down,1.2);
            if(hit){
              best={...hit,point:hit.point.clone().sub(side)};
              bestNormal=this.worldNormal(hit);break;
            }
          }
        }
      }
      if(best&&bestNormal){
        const n=bestNormal;
        const formerNormal=this.normal.clone();
        const transport=new THREE.Quaternion().setFromUnitVectors(formerNormal,n);
        this.heading.applyQuaternion(transport).projectOnPlane(n).normalize();
        if(Math.abs(formerNormal.y)<.35&&n.y<-.7){
          // The underside lies inside the wall's corner. Continue inward under it.
          this.heading.copy(formerNormal).negate().projectOnPlane(n).normalize();
        }
        this.normal.copy(n);
        const desired=best.point.clone().addScaledVector(n,.24);
        this.position.lerp(desired,1-Math.exp(-25*dt));
      }else{
        // Small gaps can be crossed; a long gap becomes a short fall.
        this.position.copy(candidate);this.airborne=true;this.velocity.copy(move).multiplyScalar(1/Math.max(dt,.001));
      }
      if(inputDir.lengthSq()>.01){
        const target=inputDir.clone().projectOnPlane(this.normal).normalize();
        this.heading.lerp(target,1-Math.exp(-8*dt)).normalize();
      }
    }
    const rightAxis=this.scratch.crossVectors(this.heading,this.normal).normalize();
    const back=this.heading.clone().negate();
    const matrix=new THREE.Matrix4().makeBasis(rightAxis,this.normal,back);
    const desiredQ=new THREE.Quaternion().setFromRotationMatrix(matrix);
    this.orientation.slerp(desiredQ,1-Math.exp(-12*dt));
    this.spider.group.position.copy(this.position);
    this.spider.group.quaternion.copy(this.orientation);
    this.spider.animate(t,this.speed,this.airborne);
  }
  private transport(n:THREE.Vector3){const q=new THREE.Quaternion().setFromUnitVectors(this.normal,n);this.heading.applyQuaternion(q).projectOnPlane(n).normalize();this.normal.copy(n);}
}
