import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { SpeciesId } from './Species';

const sphere=new THREE.SphereGeometry(1,16,10);
const limbGeo=new THREE.CylinderGeometry(.7,1,1,8);
const mat=(color:string,roughness=.65,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
const materials={
  dark:mat('#27342b'),gold:mat('#bb9250',.38),green:mat('#71834c',.7),belly:mat('#b6bc87',.8),
  beetle:mat('#4b8b78',.28,.6),fur:mat('#9b8170',.88),cream:mat('#cabda3'),pink:mat('#ba9385'),shell:mat('#a68a60',.7),
  eyes:mat('#1d2420',.13),wing:new THREE.MeshStandardMaterial({color:'#d9dcd0',transparent:true,opacity:.58,side:THREE.DoubleSide,depthWrite:false}),
  amber:mat('#c8a65e'),purple:mat('#cdaae0'),blue:mat('#7cbfc9'),
};
export type CreatureModel={group:THREE.Group;body:THREE.Group;wings:THREE.Group[];legs:THREE.Group[];tail?:THREE.Mesh;feelers:THREE.Group[]};
function ellipsoid(parent:THREE.Object3D,material:THREE.Material,x:number,y:number,z:number,sx:number,sy:number,sz:number){
  const mesh=new THREE.Mesh(sphere,material);mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);return mesh;
}
function bone(parent:THREE.Object3D,a:THREE.Vector3,b:THREE.Vector3,r:number,material:THREE.Material){
  const d=b.clone().sub(a),mesh=new THREE.Mesh(limbGeo,material);mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.scale.set(r,d.length(),r);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());mesh.castShadow=true;parent.add(mesh);
}
const v=(x:number,y:number,z:number)=>new THREE.Vector3(x,y,z);
const membraneMaterial=materials.belly.clone();membraneMaterial.side=THREE.DoubleSide;

function frogFoot(parent:THREE.Object3D,at:THREE.Vector3,side:number,count:number){
  ellipsoid(parent,materials.green,at.x,at.y,at.z,.095,.028,.12);
  const ends:THREE.Vector3[]=[];
  for(let i=0;i<count;i++){
    const spread=(i-(count-1)/2)*.07;
    const tip=at.clone().add(v(spread*side,-.01,.19-Math.abs(spread)*.45));ends.push(tip);
    bone(parent,at,tip,.012,materials.belly);ellipsoid(parent,materials.green,tip.x,tip.y,tip.z,.021,.012,.027);
  }
  const verts:number[]=[];
  for(let i=0;i<ends.length-1;i++)for(const point of [at,at.clone().lerp(ends[i],.58),at.clone().lerp(ends[i+1],.58)])verts.push(point.x,point.y,point.z);
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));geometry.computeVertexNormals();
  const membrane=new THREE.Mesh(geometry,membraneMaterial);parent.add(membrane);
}
function snailFoot(){
  const positions:number[]=[],indices:number[]=[],rows=32,sides=12;
  for(let i=0;i<=rows;i++){
    const u=i/rows,z=-1.05+u*2.07,width=.018+.26*Math.sin(u*Math.PI)**.85;
    for(let j=0;j<=sides;j++){
      const angle=j/sides*Math.PI*2;
      // A flat underside, softly ridged mantle, and narrowing tail sit just above the ground.
      positions.push(Math.cos(angle)*width*(1+Math.sin(u*60)*.018),-.255+Math.sin(angle)*(.065+.04*Math.sin(u*Math.PI)),z);
      if(i<rows&&j<sides){const a=i*(sides+1)+j,b=a+sides+1;indices.push(a,a+1,b,b,a+1,b+1);}
    }
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}
const footGeometry=snailFoot();
let shellDetails:{spiral:THREE.BufferGeometry;growth:THREE.BufferGeometry}|undefined;
function snailShellDetails(){
  if(shellDetails)return shellDetails;
  const spirals:THREE.BufferGeometry[]=[],growth:THREE.BufferGeometry[]=[];
  for(const side of [-1,1]){
    const points:THREE.Vector3[]=[];
    for(let i=0;i<=112;i++){
      const angle=i/112*Math.PI*4.8,r=.018+i/112*.445;
      const x=side*(.39*Math.sqrt(Math.max(.02,1-(r/.48)**2))+.009);
      points.push(v(x,.04+Math.sin(angle)*r,-.14+Math.cos(angle)*r));
    }
    spirals.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),112,.012,5,false));
    for(let i=0;i<34;i++){
      const angle=i/34*Math.PI*2,marks=[];
      for(let j=0;j<7;j++){const r=.28+j*.025;marks.push(v(side*(.39*Math.sqrt(Math.max(.02,1-(r/.48)**2))+.006),.04+Math.sin(angle)*r,-.14+Math.cos(angle)*r));}
      growth.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(marks),6,.003,4,false));
    }
  }
  shellDetails={spiral:mergeGeometries(spirals)!,growth:mergeGeometries(growth)!};
  for(const geometry of [...spirals,...growth])geometry.dispose();return shellDetails;
}

export function createCreatureModel(kind:SpeciesId):CreatureModel{
  const group=new THREE.Group(),body=new THREE.Group(),wings:THREE.Group[]=[],legs:THREE.Group[]=[];
  group.add(body);const model:CreatureModel={group,body,wings,legs,feelers:[]};
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
    // A low, crouched silhouette: broad snout, folded thighs, and small splayed toes.
    ellipsoid(body,materials.green,0,-.12,-.12,.58,.34,.72);
    ellipsoid(body,materials.belly,0,-.27,.14,.49,.19,.53);
    ellipsoid(body,materials.green,0,.015,.51,.53,.27,.48);
    ellipsoid(body,materials.belly,0,-.12,.69,.42,.13,.3);
    const mouth=[v(-.43,-.055,.78),v(-.28,-.09,.92),v(0,-.11,.985),v(.28,-.09,.92),v(.43,-.055,.78)];
    body.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(mouth),20,.008,5,false),materials.dark));
    for(const side of [-1,1]){
      ellipsoid(body,materials.green,side*.345,.225,.53,.18,.19,.195);
      ellipsoid(body,materials.gold,side*.37,.28,.675,.12,.12,.073);
      ellipsoid(body,materials.eyes,side*.37,.285,.739,.093,.036,.017);
      ellipsoid(body,materials.cream,side*.345,.319,.748,.018,.018,.007);
      ellipsoid(body,materials.dark,side*.16,.12,.924,.021,.012,.007);
      for(const back of [false,true]){
        const leg=new THREE.Group();leg.position.set(side*(back?.45:.42),back?-.17:-.09,back?-.47:.35);body.add(leg);legs.push(leg);
        if(back){
          ellipsoid(leg,materials.green,side*.18,-.015,-.09,.32,.23,.36);
          const knee=v(side*.42,-.13,-.2),ankle=v(side*.17,-.34,.14),foot=v(side*.27,-.39,.34);
          bone(leg,knee,ankle,.08,materials.green);bone(leg,ankle,foot,.045,materials.green);
          frogFoot(leg,foot,side,5);
        }else{
          const elbow=v(side*.19,-.22,.12),foot=v(side*.28,-.47,.36);
          bone(leg,v(0,0,0),elbow,.067,materials.green);bone(leg,elbow,foot,.041,materials.green);
          frogFoot(leg,foot,side,4);
        }
      }
      // Small mottled markings follow the back rather than floating above it.
      for(let i=0;i<9;i++){
        const z=-.59+i*.1,x=side*(.22+Math.sin(i*2.1)*.07),r=.72;
        const y=-.12+.345*Math.sqrt(Math.max(0,1-(x/.58)**2-((z+.12)/r)**2));
        const spot=ellipsoid(body,materials.dark,x,y,z,.028+(i%3)*.011,.006,.026);
        spot.rotation.x=-Math.atan((z+.12)/r*.65);
      }
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
    // Shell coils on the sides (axis X), above a long tapered foot rather than a ball.
    const foot=new THREE.Mesh(footGeometry,materials.belly);foot.castShadow=foot.receiveShadow=true;body.add(foot);
    ellipsoid(body,materials.belly,0,-.18,.69,.195,.145,.29);
    ellipsoid(body,materials.shell,0,.04,-.14,.39,.47,.48);
    const details=snailShellDetails();body.add(new THREE.Mesh(details.spiral,materials.gold),new THREE.Mesh(details.growth,materials.cream));
    for(const side of [-1,1]){
      // Two pairs of tentacles; only the taller pair carries eyes.
      for(const upper of [true,false]){
        const tentacle=new THREE.Group();tentacle.position.set(side*(upper?.095:.115),-.13,upper?.77:.85);body.add(tentacle);model.feelers.push(tentacle);
        const tip=upper?v(side*.10,.32,.15):v(side*.10,.035,.16);
        bone(tentacle,v(0,0,0),tip,upper?.015:.01,materials.belly);
        if(upper)ellipsoid(tentacle,materials.eyes,tip.x,tip.y,tip.z,.027,.022,.026);
      }
    }
    const lip=[];for(let i=0;i<=24;i++){const a=i/24*Math.PI*2;lip.push(v(Math.cos(a)*.23,-.13+Math.sin(a)*.27,.19));}
    body.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(lip),24,.023,6,true),materials.shell));
  }
  return model;
}
export function animateCreature(model:CreatureModel,kind:SpeciesId,t:number,speed:number,caught:boolean){
  const activity=Math.min(1,speed/1.2),phase=t*(kind==='fly'?55:kind==='dragonfly'?36:kind==='butterfly'?9:kind==='moth'?18:10);
  model.wings.forEach((wing,i)=>wing.rotation.z=Math.sin(phase)*(caught?.32:.65)*(kind==='dragonfly'?(i<2?1:-1):i===0?1:-1));
  model.legs.forEach((leg,i)=>{leg.rotation.x=Math.sin(t*(kind==='frog'?3.4:10)+i*(kind==='frog'?Math.PI:Math.PI*.7))*(kind==='frog'?.075:.18)*(caught?1:activity);});
  model.body.rotation.z=caught?Math.sin(t*14)*.08:0;
  model.body.position.y=kind==='frog'&&!caught?Math.max(0,Math.sin(t*3.4))*.22*activity:Math.sin(t*8)*.018*activity;
  if(model.tail)model.tail.rotation.y=Math.sin(t*4)*.1*activity;
  model.feelers.forEach((feeler,i)=>{feeler.rotation.x=Math.sin(t*1.7+i)*.045;feeler.rotation.z=Math.sin(t*1.2+i*1.9)*.07;});
}
