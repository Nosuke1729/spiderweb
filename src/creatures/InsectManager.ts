import * as THREE from 'three';
import { WebManager, type StrandReplacement } from '../web/WebManager';
import { OUTER_HABITATS,gardenHeight,FIELD_EXTENT } from '../world/WorldLayout';
import { SPECIES,type Species,type SpeciesId } from './Species';
import { createCreatureModel,animateCreature,type CreatureModel } from './CreatureModel';
import { assessNet,type NetAssessment } from '../web/NetAssessment';

type Capture={strand:number;time:number;point:THREE.Vector3;support?:number[];check?:number};
export type Insect={group:THREE.Group;model:CreatureModel;species:Species;position:THREE.Vector3;velocity:THREE.Vector3;target:THREE.Vector3;home:THREE.Vector3;phase:number;rest:number;cooldown:number;contactClock:number;bindings:THREE.LineSegments;caught?:Capture};
const random=(a:number,b:number)=>a+Math.random()*(b-a);
const v=(x:number,y:number,z:number)=>new THREE.Vector3(x,y,z);

export class InsectManager {
  readonly insects:Insect[]=[];
  private tick=0;
  private ray=new THREE.Raycaster();
  onCatch:(creature:Insect)=>void=()=>{};
  onEscape:(creature:Insect,net:NetAssessment)=>void=()=>{};
  lastReleased?:Species;
  constructor(private scene:THREE.Scene,private web:WebManager,private surfaces:THREE.Object3D[]=[]){
    for(let i=0;i<54;i++){
      const kind:SpeciesId=i%13===10?'dragonfly':i%9===7?'butterfly':i%6===5?'moth':'fly';
      const habitat=i<18?undefined:OUTER_HABITATS[(i-18)%OUTER_HABITATS.length];
      const home=habitat?v(habitat.x,gardenHeight(habitat.x,habitat.z),habitat.z):v(0,0,0);
      this.spawn(kind,home);
    }
    // Familiar wildlife also visits the starting garden; there is no empty trek before the new mechanics.
    for(const [kind,x,z] of [
      ['beetle',-4,-5],['beetle',8,12],['snail',-12,10],['frog',14,9],['mouse',-18,13],
      ['beetle',-38,-37],['beetle',38,-14],['beetle',31,34],['snail',-38,30],['mouse',40,15],
      ['frog',86,73],['frog',91,77],['frog',80,69],['snail',78,81],
      ['beetle',-95,-73],['beetle',-100,-69],['mouse',-89,-80],
      ['mouse',101,-81],['mouse',108,-77],['beetle',95,-87],
      ['snail',-95,86],['snail',-103,91],['frog',-90,84],['beetle',-98,81],
    ] as [SpeciesId,number,number][])this.spawn(kind,v(x,gardenHeight(x,z),z));
  }
  private spawn(kind:SpeciesId,home:THREE.Vector3){
    const species=SPECIES[kind],model=createCreatureModel(kind),position=home.clone().add(v(random(-3,3),0,random(-3,3)));
    position.y=gardenHeight(position.x,position.z)+(species.flying?random(1,6):species.lift);model.group.position.copy(position);this.scene.add(model.group);
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(8*6),3).setUsage(THREE.DynamicDrawUsage));geometry.setDrawRange(0,0);
    const bindings=new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color:'#dae9de',transparent:true,opacity:.7,depthWrite:false,blending:THREE.AdditiveBlending}));bindings.visible=false;this.scene.add(bindings);
    const creature:Insect={group:model.group,model,species,position,velocity:v(0,0,0),target:position.clone(),home:home.clone(),phase:random(0,7),rest:0,cooldown:0,contactClock:random(0,.1),bindings};
    this.insects.push(creature);this.wanderTarget(creature);
  }
  update(t:number,dt:number,player?:THREE.Vector3){
    this.tick++;
    for(let i=0;i<this.insects.length;i++){
      const creature=this.insects[i],species=creature.species;
      const visible=!player||creature.position.distanceToSquared(player)<75*75;
      creature.group.visible=visible;creature.bindings.visible=visible&&!!creature.caught;
      if(!visible&&!creature.caught)continue;
      creature.cooldown=Math.max(0,creature.cooldown-dt);creature.contactClock-=dt;
      if(creature.caught){
        const c=creature.caught;c.time+=dt;c.check=(c.check??0)-dt;
        if(!this.web.strands.has(c.strand)||c.time>species.hold){this.release(creature);continue;}
        if(c.check<=0){
          const net=assessNet(this.web,c.point,species);c.check=.18;
          if(!net.caught){this.release(creature);continue;}
          c.support=net.support;
        }
        creature.position.copy(c.point).add(v(Math.sin(t*22+i),Math.sin(t*30+i),Math.cos(t*24+i)).multiplyScalar(species.radius*.08));
        creature.group.position.copy(creature.position);animateCreature(creature.model,species.id,t,0,true);this.bind(creature);
        if((this.tick+i)%12===0)this.web.disturb(c.strand,Math.min(1.7,.4+species.threads*.075));
        continue;
      }
      if(creature.rest>0){creature.rest-=dt;animateCreature(creature.model,species.id,t,0,false);continue;}
      if(creature.position.distanceTo(creature.target)<(species.flying?.25:.65)){
        const local=Math.random()<.28?[...this.web.strands.values()].filter(s=>this.web.sample(s,.5).distanceTo(creature.home)<15):[];
        const strand=local[Math.floor(Math.random()*local.length)];
        if(strand){
          this.web.sample(strand,random(.25,.75),creature.target);
          if(!species.flying)creature.target.y=gardenHeight(creature.target.x,creature.target.z)+species.lift;
        }else{
          this.wanderTarget(creature);if(Math.random()<.25)creature.rest=random(.8,3);
        }
      }
      const drive=creature.target.clone().sub(creature.position);if(!species.flying)drive.y=0;drive.normalize().multiplyScalar(species.speed);
      if(species.flying){
        drive.y+=Math.sin(t*3+creature.phase)*.18;
        if(creature.position.y<gardenHeight(creature.position.x,creature.position.z)+species.radius+.25)drive.y+=.75;
      }
      const before=creature.position.clone();
      if(this.surfaces.length&&creature.contactClock<=0&&drive.lengthSq()>.001){
        this.ray.set(creature.position,drive.clone().normalize());this.ray.near=.03;this.ray.far=species.radius+.7;
        const obstacle=this.ray.intersectObjects(this.surfaces,false)[0];
        if(obstacle){drive.applyAxisAngle(v(0,1,0),Math.PI*.6);creature.target.copy(creature.position).addScaledVector(drive,3);}
      }
      creature.velocity.lerp(drive,1-Math.exp(-3*dt));creature.position.addScaledVector(creature.velocity,dt);
      if(!species.flying){
        const x=creature.position.x,z=creature.position.z,ground=gardenHeight(x,z);
        creature.position.y=ground+species.lift;
        const dx=(gardenHeight(x+.15,z)-gardenHeight(x-.15,z))/.3,dz=(gardenHeight(x,z+.15)-gardenHeight(x,z-.15))/.3;
        const normal=v(-dx,1,-dz).normalize(),heading=creature.velocity.clone().projectOnPlane(normal).normalize();
        if(heading.lengthSq()>.01){const right=v(0,0,0).crossVectors(normal,heading).normalize();const q=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right,normal,heading));creature.group.quaternion.slerp(q,1-Math.exp(-7*dt));}
      }else creature.group.rotation.y=Math.atan2(creature.velocity.x,creature.velocity.z);
      creature.group.position.copy(creature.position);animateCreature(creature.model,species.id,t,creature.velocity.length(),false);
      if(this.web.strands.size&&creature.contactClock<=0&&creature.cooldown<=0){
        // Subsample the swept body path so even a fast mouse cannot skip a thin strand.
        const travel=before.distanceTo(creature.position),steps=Math.max(1,Math.ceil(travel/Math.max(.08,species.radius*.65)));
        let net:NetAssessment|undefined,impact=creature.position;
        for(let j=1;j<=steps;j++){
          const point=before.clone().lerp(creature.position,j/steps),candidate=assessNet(this.web,point,species);
          if(candidate.contact){net=candidate;impact=point;if(candidate.caught)break;}
        }
        if(net?.contact){
          this.web.disturb(net.contact.strand.id,Math.min(1.7,.5+species.threads*.07));
          if(net.caught){
            creature.caught={strand:net.contact.strand.id,time:0,point:impact.clone(),support:net.support,check:0};creature.velocity.set(0,0,0);creature.bindings.visible=visible;this.onCatch(creature);
          }else{creature.cooldown=1.2;this.onEscape(creature,net);}
        }
      }
      if(creature.contactClock<=0)creature.contactClock=.07+(i%4)*.015;
    }
  }
  private bind(creature:Insect){
    const c=creature.caught!,positions=creature.bindings.geometry.attributes.position as THREE.BufferAttribute;
    const contacts=this.web.getNearbyStrands(c.point,creature.species.netRadius);let count=0;
    for(const id of c.support??[c.strand]){
      const strand=this.web.strands.get(id);if(!strand)continue;
      // Visible short bindings use existing support points; they never add free graph strands.
      const point=contacts.find(n=>n.strand.id===id)?.point;
      if(!point)continue;
      positions.setXYZ(count*2,point.x,point.y,point.z);
      const body=creature.position.clone().add(v(Math.sin(count*2.4),.1,Math.cos(count*2.4)).multiplyScalar(creature.species.radius*.45));
      positions.setXYZ(count*2+1,body.x,body.y,body.z);if(++count>=8)break;
    }
    creature.bindings.geometry.setDrawRange(0,count*2);positions.needsUpdate=true;creature.bindings.geometry.computeBoundingSphere();
  }
  private release(creature:Insect){
    creature.caught=undefined;creature.bindings.visible=false;creature.cooldown=4;creature.model.body.rotation.z=0;this.wanderTarget(creature);
  }
  collectNear(position:THREE.Vector3){
    this.lastReleased=undefined;
    const creature=this.nearbyCaught(position);
    if(!creature)return false;this.lastReleased=creature.species;this.release(creature);return true;
  }
  inspect(origin:THREE.Vector3,direction:THREE.Vector3,max:number){
    let nearest:{creature:Insect;distance:number}|undefined;
    for(const creature of this.insects){
      if(!creature.group.visible)continue;
      const delta=creature.position.clone().sub(origin),distance=delta.dot(direction);
      if(distance<0||distance>Math.min(max,20))continue;
      if(delta.addScaledVector(direction,-distance).length()<creature.species.radius+.18&&(!nearest||distance<nearest.distance))nearest={creature,distance};
    }
    return nearest?.creature;
  }
  nearbyCaught(position:THREE.Vector3){return this.insects.filter(c=>c.caught&&c.position.distanceTo(position)<c.species.radius+.85).sort((a,b)=>a.position.distanceToSquared(position)-b.position.distanceToSquared(position))[0];}
  remapStrand(id:number,parts:StrandReplacement[]){
    for(const creature of this.insects)if(creature.caught){
      const c=creature.caught;
      if(c.strand===id){
        const nearest=this.web.getNearbyStrands(c.point,creature.species.netRadius).find(n=>parts.some(p=>p.strand.id===n.strand.id));
        c.strand=nearest?.strand.id??parts[0].strand.id;
      }
      if(c.support?.includes(id))c.support=c.support.flatMap(s=>s===id?parts.map(p=>p.strand.id):[s]);
      c.check=0;
    }
  }
  private wanderTarget(creature:Insect){
    const extent=creature.home.lengthSq()>.1?10:19;
    const x=THREE.MathUtils.clamp(creature.home.x+random(-extent,extent),-FIELD_EXTENT,FIELD_EXTENT),z=THREE.MathUtils.clamp(creature.home.z+random(-extent,extent),-FIELD_EXTENT,FIELD_EXTENT);
    creature.target.set(x,gardenHeight(x,z)+(creature.species.flying?(Math.random()<.14?.3:random(.7,7)):creature.species.lift),z);
  }
}
