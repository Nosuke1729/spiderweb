import * as THREE from 'three';
import { WebManager, type WebContact } from './WebManager';
import type { Species } from '../creatures/Species';
import { strandTangent } from './WebPath';

export type NetAssessment={caught:boolean;threads:number;loops:number;contacts:number;crossed:boolean;support:number[];contact?:WebContact};

// Only connected strands in this local patch contribute; distant webbing cannot hold a creature here.
export function assessNet(web:WebManager,position:THREE.Vector3,species:Species):NetAssessment{
  const nearby=web.getNearbyStrands(position,species.netRadius);
  const empty:NetAssessment={caught:false,threads:0,loops:0,contacts:0,crossed:false,support:[]};
  const touches=nearby.filter(c=>c.distance<=species.radius);if(!touches.length)return empty;
  const byId=new Map(nearby.map(c=>[c.strand.id,c]));let best=empty;
  const visited=new Set<number>();
  for(const touch of touches){
    if(visited.has(touch.strand.id))continue;
    const queue=[touch.strand.id],patch:WebContact[]=[],nodes=new Set<number>();
    while(queue.length){
      const id=queue.pop()!;if(visited.has(id))continue;
      const contact=byId.get(id);if(!contact)continue;visited.add(id);patch.push(contact);
      for(const nid of [contact.strand.a,contact.strand.b]){
        nodes.add(nid);
        for(const other of web.nodes.get(nid)!.strands)if(byId.has(other)&&!visited.has(other))queue.push(other);
      }
    }
    const body=patch.filter(c=>c.distance<=species.radius);
    const tangents=body.map(c=>{const [a,b]=web.getEndpoints(c.strand);return strandTangent(a,b,c.strand.tension,c.t,c.strand.sag);});
    const crossed=tangents.some((a,i)=>tangents.slice(i+1).some(b=>new THREE.Vector3().crossVectors(a,b).lengthSq()>.2));
    const loops=Math.max(0,patch.length-nodes.size+1);
    const result:NetAssessment={caught:patch.length>=species.threads&&loops>=species.loops&&body.length>=species.contacts&&(species.threads===1||crossed),threads:patch.length,loops,contacts:body.length,crossed,support:patch.map(c=>c.strand.id),contact:body[0]};
    if(result.caught)return result;
    if(result.threads>best.threads)best=result;
  }
  return best;
}
