import * as THREE from 'three';

// Walk only the grid cells crossed by a ray, instead of testing the whole terrain.
export function installTerrainRaycast(mesh: THREE.Mesh, divisions: number, width: number) {
  mesh.geometry.computeBoundingBox();
  const bounds = mesh.geometry.boundingBox!;
  const positions = mesh.geometry.attributes.position;
  const cell = width / divisions, half = width / 2, stride = divisions + 1;
  mesh.raycast = function (caster, intersections) {
    const inverse = new THREE.Matrix4().copy(this.matrixWorld).invert();
    const ray = caster.ray.clone().applyMatrix4(inverse);
    const entry = bounds.containsPoint(ray.origin) ? ray.origin.clone() : ray.intersectBox(bounds, new THREE.Vector3());
    if (!entry) return;
    const start = entry.clone().addScaledVector(ray.direction, .00001);
    let x = THREE.MathUtils.clamp(Math.floor((start.x + half) / cell), 0, divisions - 1);
    let z = THREE.MathUtils.clamp(Math.floor((start.z + half) / cell), 0, divisions - 1);
    const sx = Math.sign(ray.direction.x), sz = Math.sign(ray.direction.z);
    const stepX = sx ? cell / Math.abs(ray.direction.x) : Infinity;
    const stepZ = sz ? cell / Math.abs(ray.direction.z) : Infinity;
    let nextX = sx ? ((sx > 0 ? x + 1 : x) * cell - half - ray.origin.x) / ray.direction.x : Infinity;
    let nextZ = sz ? ((sz > 0 ? z + 1 : z) * cell - half - ray.origin.z) / ray.direction.z : Infinity;
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), point = new THREE.Vector3();
    for (let step = 0; step <= divisions * 2 + 2; step++) {
      const first = z * stride + x;
      for (const indices of [[first, first + stride, first + 1], [first + stride, first + stride + 1, first + 1]]) {
        a.fromBufferAttribute(positions, indices[0]); b.fromBufferAttribute(positions, indices[1]); c.fromBufferAttribute(positions, indices[2]);
        if (!ray.intersectTriangle(a, b, c, true, point)) continue;
        const worldPoint = point.clone().applyMatrix4(this.matrixWorld);
        const distance = worldPoint.distanceTo(caster.ray.origin);
        if (distance < caster.near || distance > caster.far) continue;
        intersections.push({ distance, point: worldPoint, object: this, face: { a: indices[0], b: indices[1], c: indices[2], normal: new THREE.Triangle(a, b, c).getNormal(new THREE.Vector3()), materialIndex: 0 } });
        return;
      }
      if (nextX === Infinity && nextZ === Infinity) return;
      if (Math.min(nextX, nextZ) > caster.far) return;
      if (nextX < nextZ) { x += sx; nextX += stepX; } else { z += sz; nextZ += stepZ; }
      if (x < 0 || x >= divisions || z < 0 || z >= divisions) return;
    }
  };
}
