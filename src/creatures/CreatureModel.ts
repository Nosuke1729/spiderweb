import * as THREE from 'three';
import type { SpeciesId } from './Species';

const sphere=new THREE.SphereGeometry(1,16,10);
const limbGeo=new THREE.CylinderGeometry(.7,1,1,8);
const mat=(color:string,roughness=.65,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
const materials={
  dark:mat('#27342b'),gold:mat('#bb9250',.38),green:mat('#809d58',.43),belly:mat('#c4ca91'),
  beetle:mat('#4b8b78',.28,.6),fur:mat('#9b8170',.88),cream:mat('#cabda3'),pink:mat('#ba9385'),shell:mat('#ad8c59',.42),
  eyes:mat('#1d2420',.13),wing:new THREE.MeshStandardMaterial({color:'#d9dcd0',transparent:true,opacity:.58,side:THREE.DoubleSide,depthWrite:false}),
  amber:mat('#c8a65e'),purple:mat('#cdaae0'),blue:mat('#7cbfc9'),
};
export type CreatureModel={group:THREE.Group;body:THREE.Group;wings:THREE.Group[];legs:THREE.Group[];tail?:THREE.Mesh};
function ellipsoid(parent:THREE.Object3D,material:THREE.Material,x:number,y:number,z:number,sx:number,sy:number,sz:number){
  const mesh=new THREE.Mesh(sphere,material);mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);return mesh;
}
function bone(parent:THREE.Object3D,a:THREE.Vector3,b:THREE.Vector3,r:number,material:THREE.Material){
  const d=b.clone().sub(a),mesh=new THREE.Mesh(limbGeo,material);mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.scale.set(r,d.length(),r);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());mesh.castShadow=true;parent.add(mesh);
}
const v=(x:number,y:number,z:number)=>new THREE.Vector3(x,y,z);
export function createCreatureModel(kind:SpeciesId):CreatureModel{
  const group=new THREE.Group(),body=new THREE.Group(),wings:THREE.Group[]=[],legs:THREE.Group[]=[];
  group.add(body);const model:CreatureModel={group,body,wings,legs};
  if(kind==='fly'||kind==='moth'||kind==='butterfly'){
    const size=kind==='fly'?.045:kind==='moth'?.085:.12;
    ellipsoid(body,kind==='fly'?materials.dark:materials.gold,0,0,0,size,size*.8,size*1.8);
    ellipsoid(body,materials.dark,0,0,size*1.7,size*.7,size*.7,size*.7);
    for(const side of [-1,1]){
      const wing=new THREE.Group();wing.position.set(side*size*.55,.025,0);body.add(wing);wings.push(wing);
      if(kind==='fly')ellipsoid(wing,materials.wing,side*.075,0,-.02,.085,.012,.05);
      else{
        const color=kind==='moth'?materials.amber:(side===1?materials.purple:materials.blue);
        ellipsoid(wing,color,side*size*2.3,0,.06,size*2.65,.025,size*1.9);
        ellipsoid(wing,color,side*size*1.6,0,-size*1.6,size*1.8,.022,size*1.5);
        for(const z of [0,-size*1.6]){
          ellipsoid(wing,materials.dark,side*size*2.2,.027,z,size*.63,.018,size*.63);
          ellipsoid(wing,materials.cream,side*size*2.2,.045,z,size*.3,.012,size*.3);
        }
      }
      bone(body,v(side*size*.35,0,size*1.9),v(side*size*.85,.08,size*3),.007,materials.dark);
    }
  }else if(kind==='dragonfly'){
    ellipsoid(body,materials.beetle,0,0,0,.18,.17,.25);
    ellipsoid(body,materials.blue,0,-.015,-.5,.095,.09,.62);
    for(let i=0;i<6;i++)ellipsoid(body,materials.gold,0,.055,-.3-i*.14,.098,.035,.035);
    for(const side of [-1,1]){
      ellipsoid(body,materials.beetle,side*.115,.08,.25,.14,.145,.15);
      ellipsoid(body,materials.eyes,side*.155,.095,.34,.055,.065,.05);
      for(const z of [-.16,.1]){
        const wing=new THREE.Group();wing.position.set(side*.1,.08,z);body.add(wing);wings.push(wing);
        ellipsoid(wing,materials.wing,side*.57,0,-.05,.65,.012,.14);
        bone(wing,v(0,.018,0),v(side*1.1,.018,-.05),.007,materials.gold);
        for(let i=1;i<5;i++)bone(wing,v(side*i*.2,.016,-.03),v(side*(i*.2+.1),.016,-.16),.004,materials.dark);
      }
    }
  }else if(kind==='beetle'){
    ellipsoid(body,materials.dark,0,0,0,.25,.17,.37);
    for(const side of [-1,1]){
      ellipsoid(body,materials.beetle,side*.115,.055,-.035,.126,.17,.31);
      for(let i=0;i<3;i++){
        const leg=new THREE.Group();leg.position.set(side*.18,-.07,.18-i*.19);body.add(leg);legs.push(leg);
        bone(leg,v(0,0,0),v(side*.16,-.015,-.07),.02,materials.dark);bone(leg,v(side*.16,-.015,-.07),v(side*.25,-.14,.03),.012,materials.dark);
      }
      bone(body,v(side*.08,.06,.39),v(side*.18,.16,.6),.012,materials.dark);
    }
    ellipsoid(body,materials.gold,0,.015,.31,.19,.12,.17);ellipsoid(body,materials.dark,0,0,.46,.13,.105,.12);
  }else if(kind==='frog'){
    ellipsoid(body,materials.green,0,-.015,-.08,.76,.48,.85);
    ellipsoid(body,materials.belly,0,-.18,.32,.63,.28,.66);
    ellipsoid(body,materials.green,0,.1,.58,.68,.38,.52);
    for(const side of [-1,1]){
      ellipsoid(body,materials.green,side*.4,.39,.7,.24,.24,.25);
      ellipsoid(body,materials.gold,side*.43,.44,.84,.145,.15,.125);
      ellipsoid(body,materials.eyes,side*.43,.455,.935,.07,.12,.035);
      for(const back of [false,true]){
        const leg=new THREE.Group();leg.position.set(side*(back?.53:.49),-.1,back?-.56:.34);body.add(leg);legs.push(leg);
        const knee=v(side*(back?.68:.24),back?-.05:-.26,back?-.23:.35),foot=v(side*(back?.37:.4),-.48,back?.34:.56);
        bone(leg,v(0,0,0),knee,back?.22:.095,materials.green);bone(leg,knee,foot,back?.12:.06,materials.green);
        for(let j=0;j<3;j++)bone(leg,foot,foot.clone().add(v((j-1)*.12,0,.22)),.025,materials.belly);
      }
      for(let i=0;i<4;i++)ellipsoid(body,materials.dark,side*(.2+i*.11),.38-i*.055,-.1-i*.16,.1,.025,.09);
    }
  }else if(kind==='mouse'){
    ellipsoid(body,materials.fur,0,0,-.12,.7,.64,1.02);ellipsoid(body,materials.cream,0,-.36,.1,.52,.23,.7);
    ellipsoid(body,materials.fur,0,.16,.87,.46,.45,.54);ellipsoid(body,materials.fur,0,.06,1.27,.28,.22,.35);
    ellipsoid(body,materials.pink,0,.07,1.55,.095,.08,.07);
    for(const side of [-1,1]){
      ellipsoid(body,materials.fur,side*.36,.59,.76,.25,.31,.12);ellipsoid(body,materials.pink,side*.36,.6,.835,.17,.225,.025);
      ellipsoid(body,materials.eyes,side*.34,.3,1.1,.085,.1,.07);
      for(const z of [-.58,.64]){
        const leg=new THREE.Group();leg.position.set(side*.44,-.32,z);body.add(leg);legs.push(leg);
        ellipsoid(leg,materials.fur,0,0,0,.18,.25,.22);ellipsoid(leg,materials.pink,side*.06,-.28,.14,.13,.075,.22);
      }
      for(let j=0;j<3;j++)bone(body,v(side*.18,.06+j*.045,1.42),v(side*.75,.02+j*.09,1.57-j*.1),.006,materials.cream);
    }
    const points=[v(0,-.16,-.95),v(.18,-.32,-1.6),v(.58,-.55,-2.1),v(.85,-.61,-2.55)];
    model.tail=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),18,.055,8,false),materials.pink);body.add(model.tail);
  }else{
    ellipsoid(body,materials.belly,0,-.2,.2,.32,.18,.92);ellipsoid(body,materials.gold,0,.04,-.14,.55,.53,.48);
    const points=[];for(let i=0;i<=72;i++){const a=i/72*Math.PI*4.6,r=.025+i/72*.43;points.push(v(Math.cos(a)*r,Math.sin(a)*r+.04,.35));}
    body.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),72,.025,6,false),materials.shell));
    for(const side of [-1,1]){
      bone(body,v(side*.14,-.08,.77),v(side*.23,.35,1.07),.025,materials.belly);
      ellipsoid(body,materials.eyes,side*.23,.35,1.07,.04,.04,.04);
    }
  }
  return model;
}
export function animateCreature(model:CreatureModel,kind:SpeciesId,t:number,speed:number,caught:boolean){
  const activity=Math.min(1,speed/1.2),phase=t*(kind==='fly'?55:kind==='dragonfly'?36:kind==='butterfly'?9:kind==='moth'?18:10);
  model.wings.forEach((wing,i)=>wing.rotation.z=Math.sin(phase)*(caught?.32:.65)*(kind==='dragonfly'?(i<2?1:-1):i===0?1:-1));
  model.legs.forEach((leg,i)=>{leg.rotation.x=Math.sin(t*10+i*Math.PI*.7)*.18*(caught?1:activity);});
  model.body.rotation.z=caught?Math.sin(t*14)*.08:0;
  model.body.position.y=kind==='frog'&&!caught?Math.max(0,Math.sin(t*3.4))*.22*activity:Math.sin(t*8)*.018*activity;
  if(model.tail)model.tail.rotation.y=Math.sin(t*4)*.1*activity;
}
