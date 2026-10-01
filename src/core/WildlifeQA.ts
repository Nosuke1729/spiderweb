import * as THREE from 'three';
import { WebManager } from '../web/WebManager';
import { InsectManager } from '../creatures/InsectManager';
import { SpiderController } from '../player/SpiderController';
import { SpiderCamera } from '../camera/SpiderCamera';
import { gardenHeight } from '../world/WorldLayout';

// Called only inside the development gate. Production players always weave their own networks.
export function prepareWildlifeQA(mode:string,web:WebManager,creatures:InsectManager,controller:SpiderController,camera:SpiderCamera){
  const center=new THREE.Vector3(22,gardenHeight(22,15)+.68,15);
  if(mode==='weaknet')web.add(center.clone().add(new THREE.Vector3(-2,0,0)),center.clone().add(new THREE.Vector3(2,0,0)));
  else{
    const at=(x:number,z:number)=>center.clone().add(new THREE.Vector3((x-1.5)*.58,0,(z-1.5)*.58));
    for(let x=0;x<4;x++)for(let z=0;z<4;z++){
      if(x<3)web.add(at(x,z),at(x+1,z));if(z<3)web.add(at(x,z),at(x,z+1));
    }
  }
  const mouse=creatures.insects.find(c=>c.species.id==='mouse')!;
  mouse.home.copy(center);mouse.home.y=gardenHeight(center.x,center.z);
  mouse.position.copy(center).add(new THREE.Vector3(0,0,-1.5));mouse.position.y=gardenHeight(mouse.position.x,mouse.position.z)+mouse.species.lift;
  mouse.group.position.copy(mouse.position);mouse.target.copy(center).add(new THREE.Vector3(0,0,2.5));mouse.velocity.set(0,0,1);mouse.rest=0;mouse.cooldown=0;mouse.contactClock=0;
  controller.position.set(center.x,gardenHeight(center.x,center.z+.4)+.245,center.z+.4);controller.heading.set(0,0,-1);camera.heading.copy(controller.heading);
  return mouse;
}
