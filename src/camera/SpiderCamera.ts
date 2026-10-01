import * as THREE from 'three';
import { surfaceRotation } from '../player/SurfaceMath';

export class SpiderCamera {
  readonly camera: THREE.PerspectiveCamera;
  readonly heading = new THREE.Vector3(-.65, 0, -.76).normalize();
  readonly normal = new THREE.Vector3(0, 1, 0);
  sensitivity = 1;
  private referenceNormal = new THREE.Vector3(0, 1, 0);
  private pitch = .35;
  private orbitDistance = 3.8;
  private distance = 3.8;
  private aim = false;
  private ray = new THREE.Raycaster();
  private focus = new THREE.Vector3();
  private rig = new THREE.Quaternion();
  private initialized = false;

  constructor(private colliders: THREE.Object3D[], aspect: number) {
    this.camera = new THREE.PerspectiveCamera(64, aspect, .025, 280);
  }
  resize(w: number, h: number) { this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
  look(dx: number, dy: number) {
    const precision=this.aim?.55:1;
    this.heading.applyAxisAngle(this.referenceNormal, -dx * .003 * this.sensitivity*precision).normalize();
    this.pitch = THREE.MathUtils.clamp(this.pitch + dy * .0028 * this.sensitivity*precision, -1.2, 1.32);
  }
  zoom(delta: number) { this.orbitDistance = THREE.MathUtils.clamp(this.orbitDistance * Math.exp(delta * .001), 1.65, 6.5); }
  recenter(heading: THREE.Vector3) { this.heading.copy(heading).projectOnPlane(this.referenceNormal).normalize(); this.pitch = .35; }
  setAim(on: boolean) { this.aim = on; }
  forward(surface = this.referenceNormal) {
    return this.heading.clone().applyQuaternion(surfaceRotation(this.referenceNormal, surface, this.heading)).projectOnPlane(surface).normalize();
  }
  right(surface = this.referenceNormal) { return new THREE.Vector3().crossVectors(this.forward(surface), surface).normalize(); }

  private clearDistance(focus: THREE.Vector3, direction: THREE.Vector3, distance: number, right: THREE.Vector3, up: THREE.Vector3) {
    let clear = distance;
    for (const [x, y] of [[0, 0], [.13, 0], [-.13, 0], [0, .13], [0, -.13]]) {
      this.ray.set(focus.clone().addScaledVector(right, x).addScaledVector(up, y), direction);
      this.ray.far = distance;
      const hit = this.ray.intersectObjects(this.colliders, false)[0];
      if (hit) clear = Math.min(clear, Math.max(.18, hit.distance - .16));
    }
    return clear;
  }

  update(position: THREE.Vector3, surface: THREE.Vector3, dt: number, velocity = new THREE.Vector3()) {
    if(!this.initialized){
      this.referenceNormal.copy(surface);this.heading.projectOnPlane(surface);
      if(this.heading.lengthSq()<.01)this.heading.set(0,0,-1).projectOnPlane(surface);
      if(this.heading.lengthSq()<.01)this.heading.set(1,0,0).projectOnPlane(surface);
      this.heading.normalize();
    }
    this.heading.applyQuaternion(surfaceRotation(this.referenceNormal, surface, this.heading)).projectOnPlane(surface).normalize();
    this.referenceNormal.copy(surface);
    const right = new THREE.Vector3().crossVectors(this.heading, surface).normalize();
    const targetRig = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, surface, this.heading.clone().negate()));
    if (!this.initialized) this.rig.copy(targetRig);
    else this.rig.slerp(targetRig, 1 - Math.exp(-11 * dt));
    this.normal.set(0, 1, 0).applyQuaternion(this.rig);
    const viewHeading = new THREE.Vector3(0, 0, -1).applyQuaternion(this.rig);
    const viewRight = new THREE.Vector3(1, 0, 0).applyQuaternion(this.rig);
    const target = position.clone().addScaledVector(surface, .18).addScaledVector(viewHeading, this.aim ? .2 : .35)
      .addScaledVector(velocity, this.aim ? 0 : .075);
    if (!this.initialized) this.focus.copy(target);
    else this.focus.lerp(target, 1 - Math.exp(-16 * dt));
    const desiredDistance = this.aim ? Math.min(2.6, this.orbitDistance) : this.orbitDistance;
    this.distance = THREE.MathUtils.lerp(this.distance, desiredDistance, 1 - Math.exp(-9 * dt));
    const direction = viewHeading.clone().multiplyScalar(-Math.cos(this.pitch)).addScaledVector(this.normal, Math.sin(this.pitch)).normalize();
    let clear = this.clearDistance(this.focus, direction, this.distance, viewRight, this.normal);
    // Reeling under a cap or beside bark can squeeze the lens into the spider.
    // Use the open side of the supporting face while the requested orbit is obstructed.
    if(clear<.85){
      const escape=direction.clone().projectOnPlane(surface).multiplyScalar(.65).addScaledVector(surface,.76).normalize();
      const escapeClear=this.clearDistance(this.focus,escape,this.distance,viewRight,this.normal);
      if(escapeClear>clear+.35){direction.copy(escape);clear=escapeClear;}
    }
    const desired = this.focus.clone().addScaledVector(direction, clear);
    if (!this.initialized) this.camera.position.copy(desired);
    else {
      const inward = this.camera.position.distanceTo(this.focus) > clear + .05;
      this.camera.position.lerp(desired, 1 - Math.exp(-(inward ? 28 : 12) * dt));
      const actual = this.camera.position.clone().sub(this.focus);
      const actualDistance = actual.length(); actual.normalize();
      const safe = this.clearDistance(this.focus, actual, actualDistance, viewRight, this.normal);
      this.camera.position.copy(this.focus).addScaledVector(actual, safe);
    }
    this.camera.up.copy(this.normal);
    this.camera.lookAt(this.focus);
    this.camera.updateMatrixWorld();
    this.initialized = true;
  }
}
