import * as THREE from 'three';

export class SpiderCamera {
  readonly camera:THREE.PerspectiveCamera;
  readonly heading=new THREE.Vector3(-.65,0,-.76).normalize();
  readonly normal=new THREE.Vector3(0,1,0);
  private previousNormal=new THREE.Vector3(0,1,0);
  private pitch=.38;
  private distance=3.8;
  private aim=false;
  private ray=new THREE.Raycaster();
  private focus=new THREE.Vector3();
  private initialized=false;
  constructor(private colliders:THREE.Object3D[],aspect:number){
    this.camera=new THREE.PerspectiveCamera(64,aspect,.025,95);
    this.camera.position.set(0,1.2,3);
  }
  resize(w:number,h:number){this.camera.aspect=w/h;this.camera.updateProjectionMatrix();}
  look(dx:number,dy:number){
    this.heading.applyAxisAngle(this.normal,-dx*.0026).projectOnPlane(this.normal).normalize();
    this.pitch=THREE.MathUtils.clamp(this.pitch+dy*.0023,-.23,1.1);
  }
  setAim(on:boolean){this.aim=on;}
  forward(){return this.heading.clone().projectOnPlane(this.normal).normalize();}
  right(){return new THREE.Vector3().crossVectors(this.forward(),this.normal).normalize();}
  update(position:THREE.Vector3,surfaceNormal:THREE.Vector3,dt:number){
    // Parallel transport keeps the view direction coherent through wall and ceiling turns.
    const wasWall=Math.abs(this.previousNormal.y)<.35;
    const inward=this.previousNormal.clone().negate();
    const q=new THREE.Quaternion().setFromUnitVectors(this.previousNormal,surfaceNormal);
    this.heading.applyQuaternion(q).projectOnPlane(surfaceNormal).normalize();
    if(wasWall&&surfaceNormal.y<-.7)this.heading.copy(inward).projectOnPlane(surfaceNormal).normalize();
    this.previousNormal.copy(surfaceNormal);
    this.normal.lerp(surfaceNormal,1-Math.exp(-8*dt)).normalize();
    const target=position.clone().addScaledVector(surfaceNormal,.17).addScaledVector(this.heading,.55);
    if(!this.initialized)this.focus.copy(target);
    else this.focus.lerp(target,1-Math.exp(-10*dt));
    const desiredDistance=this.aim?2.1:3.8;
    this.distance=THREE.MathUtils.lerp(this.distance,desiredDistance,1-Math.exp(-7*dt));
    const desired=this.focus.clone()
      .addScaledVector(this.heading,-Math.cos(this.pitch)*this.distance)
      .addScaledVector(this.normal,Math.sin(this.pitch)*this.distance+.12);
    const direction=desired.clone().sub(this.focus);const length=direction.length();direction.normalize();
    this.ray.set(this.focus,direction);this.ray.far=length;
    const hit=this.ray.intersectObjects(this.colliders,false)[0];
    if(hit)desired.copy(this.focus).addScaledVector(direction,Math.max(.28,hit.distance-.16));
    // Keep the spider visible when an offset boulder or leaf edge blocks the view.
    const visibilityDirection=desired.clone().sub(position);
    const visibilityDistance=visibilityDirection.length();visibilityDirection.normalize();
    this.ray.set(position,visibilityDirection);this.ray.far=visibilityDistance;
    const occluder=this.ray.intersectObjects(this.colliders,false)[0];
    if(occluder&&occluder.distance<visibilityDistance-.1){
      const side=new THREE.Vector3().crossVectors(this.normal,visibilityDirection).normalize();
      let clear=false;
      for(const sign of [1,-1]){
        const shifted=desired.clone().addScaledVector(side,sign*1.15);
        const toward=shifted.clone().sub(position);const reach=toward.length();toward.normalize();
        this.ray.set(position,toward);this.ray.far=reach;
        if(!this.ray.intersectObjects(this.colliders,false).length){desired.copy(shifted);clear=true;break;}
      }
      if(!clear)desired.copy(position).addScaledVector(visibilityDirection,Math.max(.36,occluder.distance-.2));
    }
    if(!this.initialized)this.camera.position.copy(desired);
    else this.camera.position.lerp(desired,1-Math.exp(-13*dt));
    this.camera.up.copy(this.normal);
    this.camera.lookAt(this.focus);
    this.initialized=true;
  }
}
