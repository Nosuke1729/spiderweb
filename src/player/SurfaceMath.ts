import * as THREE from 'three';

// Rotate a tangent frame without losing its heading at a 180 degree change.
export function surfaceRotation(from: THREE.Vector3, to: THREE.Vector3, tangent: THREE.Vector3) {
  if (from.dot(to) < -.999) {
    const axis = tangent.clone().projectOnPlane(from).normalize();
    if (axis.lengthSq() < .1) axis.crossVectors(from, new THREE.Vector3(1, .37, .19)).normalize();
    return new THREE.Quaternion().setFromAxisAngle(axis, Math.PI);
  }
  return new THREE.Quaternion().setFromUnitVectors(from, to);
}

// Interpolate vertex normals. Face normals made cylinders feel like staircases.
export function surfaceNormal(hit: THREE.Intersection, incoming?: THREE.Vector3) {
  const mesh = hit.object as THREE.Mesh;
  const face = hit.face;
  if (!face) return new THREE.Vector3(0, 1, 0);
  const normals = mesh.geometry.attributes.normal;
  let normal = face.normal.clone();
  if (normals) {
    const positions = mesh.geometry.attributes.position;
    const localPoint = mesh.worldToLocal(hit.point.clone());
    const weights = new THREE.Triangle(
      new THREE.Vector3().fromBufferAttribute(positions, face.a),
      new THREE.Vector3().fromBufferAttribute(positions, face.b),
      new THREE.Vector3().fromBufferAttribute(positions, face.c),
    ).getBarycoord(localPoint, new THREE.Vector3());
    if (weights) normal = new THREE.Vector3().fromBufferAttribute(normals, face.a).multiplyScalar(weights.x)
      .addScaledVector(new THREE.Vector3().fromBufferAttribute(normals, face.b), weights.y)
      .addScaledVector(new THREE.Vector3().fromBufferAttribute(normals, face.c), weights.z);
  }
  normal.applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld)).normalize();
  if (incoming && normal.dot(incoming) > 0) normal.negate();
  return normal;
}
