import * as THREE from 'three';
import { Spider } from './Spider';
import { SpiderCamera } from '../camera/SpiderCamera';
import { Input } from '../core/Input';
import { surfaceNormal, surfaceRotation } from './SurfaceMath';
import { strandPoint, strandTangent } from '../web/WebPath';

const clearance = .245;
export class SpiderController {
  readonly position = new THREE.Vector3(-3, .25, -2.5);
  readonly normal = new THREE.Vector3(0, 1, 0);
  readonly heading = new THREE.Vector3(-.65, 0, -.76).normalize();
  readonly velocity = new THREE.Vector3();
  speed = 0;
  airborne = false;
  private leapVelocity = new THREE.Vector3();
  private ray = new THREE.Raycaster();
  private orientation = new THREE.Quaternion();
  private lastDrive = new THREE.Vector3();
  private webRide?: { a: THREE.Vector3; b: THREE.Vector3; t: number; id: number; direction: number; tension: number };
  onRideEnd: (id: number, end: 'a' | 'b', drive: number, wish: THREE.Vector3) => { id: number; a: THREE.Vector3; b: THREE.Vector3; t: number; direction: number; tension: number } | undefined = () => undefined;

  constructor(private spider: Spider, private camera: SpiderCamera, private input: Input, private colliders: THREE.Object3D[]) {
    spider.group.position.copy(this.position);
  }
  restore(p: number[], n?: number[], h?: number[]) {
    if (!Array.isArray(p) || p.length !== 3 || !p.every(Number.isFinite) || Math.abs(p[0]) > 40 || Math.abs(p[1]) > 30 || Math.abs(p[2]) > 40) return;
    this.position.fromArray(p);
    if (Array.isArray(n) && n.length === 3 && n.every(Number.isFinite) && new THREE.Vector3().fromArray(n).lengthSq() > .5) this.normal.fromArray(n).normalize();
    if (!n) {
      let support: ReturnType<SpiderController['cast']>;
      for (const axis of [new THREE.Vector3(0,-1,0),new THREE.Vector3(0,1,0),new THREE.Vector3(1,0,0),new THREE.Vector3(-1,0,0),new THREE.Vector3(0,0,1),new THREE.Vector3(0,0,-1)]) {
        const hit=this.cast(this.position,axis,.75);if(hit&&(!support||hit.distance<support.distance))support=hit;
      }
      if(support)this.normal.copy(support.normal);
    }
    if (Array.isArray(h) && h.length === 3 && h.every(Number.isFinite)) {
      const heading = new THREE.Vector3().fromArray(h).projectOnPlane(this.normal);
      if (heading.lengthSq() > .01) this.heading.copy(heading).normalize();
    }
    if(this.heading.clone().projectOnPlane(this.normal).lengthSq()<.1)this.heading.copy(new THREE.Vector3(0,1,0).projectOnPlane(this.normal).normalize());
    else this.heading.projectOnPlane(this.normal).normalize();
    const right=new THREE.Vector3().crossVectors(this.heading,this.normal).normalize();
    this.orientation.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right,this.normal,this.heading.clone().negate()));
    this.spider.group.position.copy(this.position);this.spider.group.quaternion.copy(this.orientation);
  }
  jump() {
    if (this.airborne) return;
    this.webRide = undefined;
    this.airborne = true;
    this.leapVelocity.copy(this.normal).multiplyScalar(3.8).addScaledVector(this.heading, Math.max(1.3, this.speed * .8));
  }
  ride(a: THREE.Vector3, b: THREE.Vector3, t: number, id: number, direction = 1, tension = .7) {
    this.webRide = { a, b, t, id, direction, tension }; this.airborne = false;
  }
  isRiding() { return !!this.webRide; }
  rideId() { return this.webRide?.id; }
  detachRemovedStrand(id: number) { if (this.webRide?.id === id) this.jump(); }
  private cast(origin: THREE.Vector3, direction: THREE.Vector3, max: number) {
    this.ray.set(origin, direction); this.ray.near = .001; this.ray.far = max;
    const hit = this.ray.intersectObjects(this.colliders, false)[0];
    return hit ? { point: hit.point, normal: surfaceNormal(hit, direction), object: hit.object, distance: hit.distance } : undefined;
  }
  private transport(n: THREE.Vector3, drive?: THREE.Vector3) {
    const q = surfaceRotation(this.normal, n, this.heading);
    this.heading.applyQuaternion(q).projectOnPlane(n).normalize();
    this.lastDrive.applyQuaternion(q);
    if (drive) drive.applyQuaternion(q).projectOnPlane(n).normalize();
    this.normal.copy(n);
  }

  update(dt: number, t: number) {
    const before = this.position.clone();
    const forward = this.camera.forward(this.normal), right = this.camera.right(this.normal);
    const drive = new THREE.Vector3();
    if (this.input.pressed('KeyW', 'ArrowUp')) drive.add(forward);
    if (this.input.pressed('KeyS', 'ArrowDown')) drive.sub(forward);
    if (this.input.pressed('KeyD', 'ArrowRight')) drive.add(right);
    if (this.input.pressed('KeyA', 'ArrowLeft')) drive.sub(right);
    if (drive.lengthSq() > .01) { drive.normalize(); this.lastDrive.copy(drive); }
    const running = this.input.pressed('ShiftLeft', 'ShiftRight');
    this.speed = THREE.MathUtils.lerp(this.speed, drive.lengthSq() > .01 ? (running ? 3.65 : 2.05) : 0, 1 - Math.exp(-16 * dt));

    if (this.webRide) {
      const ride = this.webRide;
      const travel = (this.input.pressed('KeyW', 'ArrowUp') ? 1 : 0) - (this.input.pressed('KeyS', 'ArrowDown') ? 1 : 0);
      const length = ride.a.distanceTo(ride.b);
      ride.t = THREE.MathUtils.clamp(ride.t + travel * ride.direction * dt * (running ? 3.2 : 1.9) / Math.max(.4, length), 0, 1);
      const tangent = strandTangent(ride.a, ride.b, ride.tension, ride.t).multiplyScalar(travel ? travel * ride.direction : ride.direction);
      const up = new THREE.Vector3(0, 1, 0).projectOnPlane(tangent);
      if (up.lengthSq() < .05) up.copy(this.normal).projectOnPlane(tangent);
      if (up.lengthSq() < .05) up.set(1, 0, 0).projectOnPlane(tangent);
      this.transport(up.normalize()); this.heading.copy(tangent);
      strandPoint(ride.a, ride.b, ride.tension, ride.t, this.position).addScaledVector(this.normal, clearance);
      if (travel && (ride.t === 0 || ride.t === 1)) {
        const wish = this.camera.forward(this.normal).multiplyScalar(travel);
        if (this.input.pressed('KeyD')) wish.addScaledVector(this.camera.right(this.normal), .9);
        if (this.input.pressed('KeyA')) wish.addScaledVector(this.camera.right(this.normal), -.9);
        const next = this.onRideEnd(ride.id, ride.t === 0 ? 'a' : 'b', travel, wish.normalize());
        if (next) this.ride(next.a, next.b, next.t, next.id, next.direction, next.tension);
        else {
          this.webRide = undefined;
          // Return to the surface supporting the anchor before falling.
          const contact = this.cast(this.position, this.normal.clone().negate(), .65);
          if (contact) { this.transport(contact.normal); this.position.copy(contact.point).addScaledVector(contact.normal, clearance); }
          else { this.airborne = true; this.leapVelocity.copy(tangent).multiplyScalar(.65); }
        }
      }
    } else if (this.airborne) {
      this.leapVelocity.addScaledVector(drive, dt * 3.5); this.leapVelocity.y -= 9.8 * dt;
      const step = this.leapVelocity.clone().multiplyScalar(dt), distance = step.length();
      const hit = distance > .001 ? this.cast(this.position, step.clone().normalize(), distance + clearance) : undefined;
      if (hit && this.leapVelocity.dot(hit.normal) < 0) {
        this.position.copy(hit.point).addScaledVector(hit.normal, clearance); this.transport(hit.normal);
        this.airborne = false; this.leapVelocity.set(0, 0, 0);
      } else this.position.add(step);
      if (this.position.y < -2) { this.position.set(-3, .5, -2.5); this.normal.set(0, 1, 0); this.airborne = false; this.leapVelocity.set(0, 0, 0); }
    } else {
      const direction = drive.lengthSq() > .01 ? drive : this.lastDrive;
      const step = direction.clone().multiplyScalar(this.speed * dt);
      const candidate = this.position.clone().add(step);
      let contact: ReturnType<SpiderController['cast']>;
      let corner = false;
      if (step.lengthSq() > .000001) {
        const front = this.cast(this.position, direction, clearance + step.length() + .035);
        if (front && front.normal.dot(direction) < -.3 && front.normal.dot(this.normal) < .86) { contact = front; corner = true; }
      }
      if (!contact) {
        const down = this.normal.clone().negate();
        contact = this.cast(candidate.clone().addScaledVector(this.normal, .24), down, .85);
        if (contact) {
          const blend = contact.normal.clone();
          // Nearby feet blend normals across bark and adjoining roots, but never average opposite faces.
          for (const offset of [right.clone().multiplyScalar(.12), right.clone().multiplyScalar(-.12), direction.clone().multiplyScalar(-.13)]) {
            const foot = this.cast(candidate.clone().addScaledVector(this.normal, .24).add(offset), down, .85);
            if (foot && foot.normal.dot(contact.normal) > .75 && Math.abs(foot.distance - contact.distance) < .12) blend.add(foot.normal);
          }
          contact.normal = blend.normalize();
        } else if (step.lengthSq() > .000001) {
          // Wrap a convex lip: probe back into the edge from just beyond it.
          const edgeOrigin = candidate.clone().addScaledVector(direction, .29).addScaledVector(this.normal, -.34);
          const edge = this.cast(edgeOrigin, direction.clone().negate(), .62);
          if (edge && edge.normal.dot(this.normal) > -.1) { contact = edge; corner = true; }
        }
      }
      if (contact) {
        const oldNormal = this.normal.clone();
        this.transport(contact.normal, drive);
        const desired = contact.point.clone().addScaledVector(contact.normal, clearance);
        if (corner) this.position.lerp(desired, 1 - Math.exp(-32 * dt));
        else {
          // Preserve full tangential travel; smooth only the support height.
          this.position.copy(candidate);
          const correction = desired.clone().sub(candidate);
          this.position.addScaledVector(oldNormal, correction.dot(oldNormal) * (1 - Math.exp(-35 * dt)));
        }
        if (drive.lengthSq() > .01) this.heading.lerp(drive, 1 - Math.exp(-14 * dt)).normalize();
      } else {
        this.position.copy(candidate); this.airborne = true;
        this.leapVelocity.copy(direction).multiplyScalar(this.speed);
      }
    }
    this.velocity.copy(this.position).sub(before).multiplyScalar(1 / dt);
    if (this.heading.lengthSq() < .1) this.heading.copy(this.camera.forward(this.normal));
    const rightAxis = new THREE.Vector3().crossVectors(this.heading, this.normal).normalize();
    const desired = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(rightAxis, this.normal, this.heading.clone().negate()));
    this.orientation.slerp(desired, 1 - Math.exp(-16 * dt));
    this.spider.group.position.copy(this.position); this.spider.group.quaternion.copy(this.orientation);
    this.spider.animate(t, this.velocity.length(), this.airborne);
  }
}
