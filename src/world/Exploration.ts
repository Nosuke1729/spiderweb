import * as THREE from 'three';

type Habitat = { id: string; name: string; detail: string; reached: (p: THREE.Vector3) => boolean };
const habitats: Habitat[] = [
  { id: 'roots', name: 'THE ROOT CATHEDRAL', detail: 'A whole forest held by one tree. Follow the bark toward the light.', reached: p => p.x < -6 && p.x > -13 && p.z < -5 && p.z > -11 && p.y > 2 },
  { id: 'canopy', name: 'THE SUNLIT CANOPY', detail: 'Above the grass, the garden opens. Your silk can join the high branches.', reached: p => p.x < 1 && p.z < 1 && p.y > 8 },
  { id: 'fence', name: 'THE WEATHERED RIDGE', detail: 'The fence is a quiet path above the undergrowth.', reached: p => p.z < -16.8 && p.y > 5.2 },
  { id: 'tunnel', name: 'THE TERRACOTTA PASSAGE', detail: 'A sheltered route through the earth. Even the smallest cracks lead somewhere.', reached: p => Math.abs(p.x + 15) < .72 && Math.abs(p.z - 7) < 1.25 && p.y < 1.5 },
  { id: 'pool', name: 'THE RAIN MIRROR', detail: 'The insects gather above the water. Try weaving between the bank and the fallen branch.', reached: p => Math.hypot(p.x - 11,p.z - 7) < 4.8 && p.y < 2 },
  { id: 'lantern', name: 'THE FORGOTTEN LANTERN', detail: 'A little warmth left in the garden. Branches join this refuge to the old fence.', reached: p => Math.hypot(p.x - 4,p.z + 11) < 2.1 && p.y > 1.7 },
];
export class Exploration {
  readonly discovered = new Set<string>();
  onDiscover: (name: string, detail: string) => void = () => {};
  get total() { return habitats.length; }
  update(position: THREE.Vector3) {
    for (const habitat of habitats) if (!this.discovered.has(habitat.id) && habitat.reached(position)) {
      this.discovered.add(habitat.id); this.onDiscover(habitat.name, habitat.detail); return;
    }
  }
  restore(ids: unknown) { if (Array.isArray(ids)) for (const id of ids) if (habitats.some(h => h.id === id)) this.discovered.add(id); }
  nextHint() {
    return habitats.find(h => !this.discovered.has(h.id))?.detail ?? 'You know the garden. Weave your own routes between its quiet places.';
  }
}
