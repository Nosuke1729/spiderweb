import * as THREE from 'three';

export const TERRAIN_SIZE = 180;
export const FIELD_EXTENT = 78;
export const MAX_SAVE_POSITION = 88;
export const OUTER_HABITATS = [
  {id:'orchard',name:'THE OPEN ORCHARD',x:-34,z:-36,radius:7,detail:'Beyond the broken fence, roots and branches lead into a second canopy.'},
  {id:'arch',name:'THE STONE GATE',x:36,z:-14,radius:6,detail:'A fallen garden arch. Climb its underside or weave a bridge across the opening.'},
  {id:'meadow',name:'THE WILDFLOWER SEA',x:31,z:34,radius:9,detail:'Flowers rise above the paths. Join their stems with silk to cross the meadow.'},
  {id:'pot',name:'THE CLAY REFUGE',x:-38,z:30,radius:5,detail:'A broken flowerpot shelters a passage. Its rim overlooks the fern valley.'},
  {id:'grove',name:'THE EASTERN GROVE',x:40,z:15,radius:7,detail:'Another tree, another vertical world. Fallen limbs connect the grove to the rain pool.'},
] as const;

export function gardenHeight(x:number,z:number){
  const original=.19*Math.sin(x*.37)*Math.cos(z*.28)+.09*Math.sin(x*1.4+z*.8)+.012*Math.sin(x*8)*Math.cos(z*7);
  const outer=THREE.MathUtils.smoothstep(Math.hypot(x,z),26,48);
  const hill=2.3*Math.exp(-((x-38)**2+(z+14)**2)/210);
  return original+outer*(1.2*Math.sin(x*.065)*Math.cos(z*.072)+hill);
}
