import * as THREE from 'three';

export function strandSag(length: number, tension: number) {
  return Math.min(.65, length * length * .006) * (1.15 - tension * .45);
}
export function strandPoint(a: THREE.Vector3, b: THREE.Vector3, tension: number, t: number, out = new THREE.Vector3()) {
  out.copy(a).lerp(b, t);
  out.y -= strandSag(a.distanceTo(b), tension) * (1 - (2 * t - 1) ** 2);
  return out;
}
export function strandTangent(a: THREE.Vector3, b: THREE.Vector3, tension: number, t: number) {
  const tangent = b.clone().sub(a);
  tangent.y -= strandSag(a.distanceTo(b), tension) * (4 - 8 * t);
  return tangent.normalize();
}
