import * as THREE from 'three';
import { WebManager } from '../web/WebManager';

type Insect={group:THREE.Group;position:THREE.Vector3;velocity:THREE.Vector3;target:THREE.Vector3;phase:number;rest:number;caught?:{strand:number;time:number;point:THREE.Vector3}};
const random=(a:number,b:number)=>a+Math.random()*(b-a);

export class InsectManager {
  readonly insects:Insect[]=[];
  private tick=0;
  private wingMat=new THREE.MeshBasicMaterial({color:'#c9d9d1',transparent:true,opacity:.57,side:THREE.DoubleSide,depthWrite:false});
  onCatch:()=>void=()=>{};
  constructor(private scene:THREE.Scene,private web:WebManager){
    const bodyMat=new THREE.MeshStandardMaterial({color:'#242c2a',metalness:.3,roughness:.4});
    const warmMat=new THREE.MeshBasicMaterial({color:'#e6ba6b'});
    for(let i=0;i<18;i++){
      const group=new THREE.Group();const isMoth=i%6===0;
      const body=new THREE.Mesh(new THREE.SphereGeometry(isMoth?.082:.045,8,6),isMoth?warmMat:bodyMat);
      body.scale.z=1.5;group.add(body);
      for(const side of [-1,1]){
        const wing=new THREE.Mesh(new THREE.SphereGeometry(isMoth?.12:.085,7,5),this.wingMat);
        wing.scale.set(.9,.04,.48);wing.position.set(side*.08,.035,0);group.add(wing);
      }
      const p=new THREE.Vector3(random(-18,18),random(1,6),random(-14,15));group.position.copy(p);scene.add(group);
      this.insects.push({group,position:p,velocity:new THREE.Vector3(),target:p.clone(),phase:random(0,7),rest:0});
    }
  }
  update(t:number,dt:number){
    this.tick++;
    for(let i=0;i<this.insects.length;i++){
      const insect=this.insects[i];
      if(insect.caught){
        const c=insect.caught;c.time+=dt;
        if(!this.web.strands.has(c.strand)){insect.caught=undefined;insect.target.set(insect.position.x, insect.position.y+1,insect.position.z);continue;}
        insect.position.copy(c.point).add(new THREE.Vector3(Math.sin(t*22+i)*.025,Math.sin(t*30+i)*.025,Math.cos(t*24+i)*.025));
        insect.group.position.copy(insect.position);
        insect.group.rotation.z=Math.sin(t*23)*.3;
        if(c.time>18){insect.caught=undefined;insect.target.set(random(-18,18),random(1,6),random(-14,14));}
        else if(Math.random()<dt*1.8)this.web.disturb(c.strand,.55);
        continue;
      }
      if(insect.rest>0){insect.rest-=dt;insect.group.children[1].rotation.z=Math.sin(t*10)*.08;insect.group.children[2].rotation.z=-Math.sin(t*10)*.08;continue;}
      if(insect.position.distanceTo(insect.target)<.2){
        const strand=this.web.strands.size&&Math.random()<.18?[...this.web.strands.values()][Math.floor(Math.random()*this.web.strands.size)]:undefined;
        if(strand){this.web.sample(strand,random(.22,.78),insect.target);}
        else{
          insect.target.set(random(-19,19),Math.random()<.14?.3:random(.7,7),random(-15,16));
          if(insect.position.y<.5)insect.rest=random(1.5,3.8);
        }
      }
      const drive=insect.target.clone().sub(insect.position).normalize().multiplyScalar(1.18);
      drive.y+=Math.sin(t*3+insect.phase)*.18;
      if(insect.position.y<.45)drive.y+=.75;
      const awayTree=insect.position.clone().sub(new THREE.Vector3(-9,insect.position.y,-8));awayTree.y=0;
      if(awayTree.length()<2.1&&insect.position.y<17)drive.addScaledVector(awayTree.normalize(),.7);
      insect.velocity.lerp(drive,1-Math.exp(-2.5*dt));
      insect.position.addScaledVector(insect.velocity,dt);
      insect.group.position.copy(insect.position);
      insect.group.rotation.y=Math.atan2(insect.velocity.x,insect.velocity.z);
      insect.group.children[1].rotation.z=Math.sin(t*55+insect.phase)*.7;
      insect.group.children[2].rotation.z=-Math.sin(t*55+insect.phase)*.7;
      const near=this.web.strands.size&&(this.tick+i)%3===0?this.web.getNearestPoint(insect.position,.14):undefined;
      if(near){insect.caught={strand:near.strand.id,time:0,point:near.point};this.web.disturb(near.strand.id,1);this.onCatch();}
    }
  }
  collectNear(position:THREE.Vector3){
    for(const insect of this.insects){if(insect.caught&&insect.position.distanceTo(position)<.8){insect.caught=undefined;insect.position.set(random(-18,18),random(2,6),random(-14,14));insect.target.copy(insect.position);return true;}}
    return false;
  }
}
