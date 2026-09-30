import * as THREE from 'three';
import { surfaceNormal } from '../player/SurfaceMath';
import { WebManager } from './WebManager';
import { strandPoint } from './WebPath';

export const SILK_RANGE = 12;
export const SILK_SPAN = 18;
type Anchor = { position: THREE.Vector3; normal: THREE.Vector3 };
type Shot = { position: THREE.Vector3; direction: THREE.Vector3; distance: number };

export class SilkLauncher {
  pending?: Anchor;
  private shot?: Shot;
  private ray = new THREE.Raycaster();
  private head: THREE.Mesh;
  private trail: THREE.Line;
  private tether: THREE.Line;
  private fade = 0;
  onMessage: (text: string) => void = () => {};
  onLaunch: () => void = () => {};
  onLand: () => void = () => {};
  onBuilt: () => void = () => {};

  constructor(scene: THREE.Scene, private surfaces: THREE.Object3D[], private web: WebManager, private emitter: () => THREE.Vector3) {
    const material = new THREE.LineBasicMaterial({ color: '#cbe5e5', transparent: true, opacity: .72, depthWrite: false, blending: THREE.AdditiveBlending });
    this.trail = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), material);
    this.tether = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), material.clone());
    this.head = new THREE.Mesh(new THREE.SphereGeometry(.037, 8, 6), new THREE.MeshBasicMaterial({ color: '#efffff' }));
    this.trail.visible = this.tether.visible = this.head.visible = false;
    this.trail.renderOrder = this.tether.renderOrder = 3;
    scene.add(this.trail, this.tether, this.head);
  }
  get flying() { return !!this.shot; }
  // The projectile starts at the spider, so camera parallax cannot shoot through nearby wood.
  preview(target: THREE.Vector3) {
    const origin = this.emitter(), direction = target.clone().sub(origin).normalize();
    this.ray.set(origin, direction); this.ray.near = .015; this.ray.far = SILK_RANGE;
    const hit = this.ray.intersectObjects(this.surfaces, false)[0];
    return { hit, inRange: target.distanceTo(origin) <= SILK_RANGE, blocked: !!hit && hit.point.distanceTo(target) > .25 };
  }
  shoot(target: THREE.Vector3) {
    if (this.shot) return false;
    const position = this.emitter();
    if (position.distanceToSquared(target) < .01) return false;
    this.shot = { position, direction: target.clone().sub(position).normalize(), distance: 0 };
    this.head.position.copy(position); this.head.visible = this.trail.visible = true;
    this.fade = 0; this.onLaunch(); return true;
  }
  cancel() {
    const hadSilk = !!this.pending || !!this.shot;
    this.pending = this.shot = undefined;
    this.trail.visible = this.head.visible = this.tether.visible = false;
    return hadSilk;
  }
  private linePoints(line: THREE.Line, a: THREE.Vector3, b: THREE.Vector3) {
    const positions = line.geometry.attributes.position as THREE.BufferAttribute;
    positions.setXYZ(0, a.x, a.y, a.z); positions.setXYZ(1, b.x, b.y, b.z);
    positions.needsUpdate = true; line.geometry.computeBoundingSphere();
  }
  private clearSpan(a: THREE.Vector3, b: THREE.Vector3) {
    const tension = THREE.MathUtils.clamp(1 - a.distanceTo(b) / 22, .32, .94);
    let last = a.clone();
    for (let i = 1; i <= 16; i++) {
      const next = strandPoint(a, b, tension, i / 16);
      const direction = next.clone().sub(last), length = direction.length(); direction.normalize();
      this.ray.set(last, direction); this.ray.near = i === 1 ? .08 : .002; this.ray.far = Math.max(0, length - (i === 16 ? .08 : 0));
      if (this.ray.intersectObjects(this.surfaces, false).length) return false;
      last = next;
    }
    return true;
  }
  private land(hit: THREE.Intersection, direction: THREE.Vector3) {
    const normal = surfaceNormal(hit, direction);
    const anchor = { position: hit.point.clone().addScaledVector(normal, .065), normal };
    this.onLand();
    if (!this.pending) {
      this.pending = anchor;
      this.onMessage('Silk attached. Find another surface and fire to weave a path.');
    } else if (this.pending.position.distanceTo(anchor.position) > SILK_SPAN) {
      this.onMessage('The span is too long. Move closer, or R to release the anchor.');
    } else if (!this.clearSpan(this.pending.position, anchor.position)) {
      this.onMessage('Something crosses this path. Choose a clear span between the anchors.');
    } else if (this.web.add(this.pending.position, anchor.position)) {
      this.pending = undefined; this.onBuilt();
      this.onMessage('A new path. Approach the thread and press E to climb onto it.');
    } else this.onMessage(this.web.strands.size >= 240 ? 'The garden holds enough silk. Cut an old strand to make room.' : 'Choose a separate anchor, or R to release the loose thread.');
  }
  update(dt: number) {
    const emitter = this.emitter();
    if (this.pending && this.pending.position.distanceTo(emitter) > SILK_SPAN) {
      this.pending = undefined; this.onMessage('The loose thread ran out. Fire again from closer to your destination.');
    }
    this.tether.visible = !!this.pending;
    if (this.pending) this.linePoints(this.tether, this.pending.position, emitter);
    const shot = this.shot;
    if (shot) {
      const travel = Math.min(21 * dt, SILK_RANGE - shot.distance);
      this.ray.set(shot.position, shot.direction); this.ray.near = .001; this.ray.far = travel;
      const hit = this.ray.intersectObjects(this.surfaces, false)[0];
      if (hit) {
        shot.position.copy(hit.point); this.land(hit, shot.direction);
        this.shot = undefined; this.fade = .12;
      } else {
        shot.position.addScaledVector(shot.direction, travel); shot.distance += travel;
        if (shot.distance >= SILK_RANGE - .001) {
          this.shot = undefined; this.fade = .16;
          this.onMessage('Silk fell short. Move closer and find a clear surface.');
        }
      }
      this.head.position.copy(shot.position); this.linePoints(this.trail, emitter, shot.position);
    } else if (this.fade > 0) {
      this.fade -= dt;
      (this.trail.material as THREE.LineBasicMaterial).opacity = Math.max(0, this.fade / .16) * .72;
      if (this.fade <= 0) this.trail.visible = this.head.visible = false;
    }
    if (this.shot) (this.trail.material as THREE.LineBasicMaterial).opacity = .72;
  }
}
