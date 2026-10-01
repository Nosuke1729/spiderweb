import * as THREE from 'three';
import {FIELD_EXTENT,gardenHeight} from './WorldLayout';

type Solid=(mesh:THREE.Mesh)=>void;
const v=(x:number,y:number,z:number)=>new THREE.Vector3(x,y,z);
// All scenery is generated locally; shared geometry and instancing keep the larger garden affordable.
export class ExpandedGarden {
  private patches:THREE.Object3D[]=[];
  private randomState=91273;
  private rand(){this.randomState=(Math.imul(this.randomState,1664525)+1013904223)>>>0;return this.randomState/4294967296;}
  private between(a:number,b:number){return a+(b-a)*this.rand();}
  constructor(private group:THREE.Group,private solid:Solid,private wood:THREE.Material,private stone:THREE.Material,private wind:{value:number},private leafTexture:THREE.Texture){
    this.trees();this.arch();this.pot();this.paths();this.flowers();this.vegetation();this.cover();this.outcrops();
  }
  private limb(a:THREE.Vector3,b:THREE.Vector3,radius:number,mat=this.wood){
    const delta=b.clone().sub(a),mesh=new THREE.Mesh(new THREE.CylinderGeometry(radius*.78,radius,delta.length(),20,3),mat);
    mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(v(0,1,0),delta.normalize());mesh.castShadow=mesh.receiveShadow=true;this.solid(mesh);return mesh;
  }
  private trees(){
    const leafGeo=new THREE.BufferGeometry(),points:number[]=[],uv:number[]=[],indices:number[]=[];
    for(let j=0;j<=8;j++){
      const t=j/8,w=Math.sin(t*Math.PI)*.43;
      for(const side of [-1,0,1]){points.push(side*w,Math.sin(t*Math.PI)*(.1-Math.abs(side)*.045),(t-.5)*2.3);uv.push((side+1)*.5,t);}
      if(j<8)for(let k=0;k<2;k++){const a=j*3+k;indices.push(a,a+3,a+1,a+1,a+3,a+4);}
    }
    leafGeo.setAttribute('position',new THREE.Float32BufferAttribute(points,3));leafGeo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));leafGeo.setIndex(indices);leafGeo.computeVertexNormals();
    const leafMat=new THREE.MeshStandardMaterial({map:this.leafTexture,color:'#d6e1b5',roughness:.9,side:THREE.DoubleSide});
    const canopy=new THREE.InstancedMesh(leafGeo,leafMat,560),dummy=new THREE.Object3D(),color=new THREE.Color();let index=0;
    for(const [x,z,h] of [[-34,-36,24],[40,15,27],[-57,2,19],[12,57,21]]){
      const y=gardenHeight(x,z),r=h*.075;
      const trunk=new THREE.Mesh(new THREE.CylinderGeometry(r*.61,r,h,48,10),this.wood);
      trunk.position.set(x,y+h*.5-.25,z);trunk.castShadow=trunk.receiveShadow=true;this.solid(trunk);
      for(let i=0;i<7;i++){
        const a=i*Math.PI*2/7;
        const ex=x+Math.cos(a)*6,ez=z+Math.sin(a)*6;
        this.limb(v(x+Math.cos(a)*r*.65,y+.5,z+Math.sin(a)*r*.65),v(ex,gardenHeight(ex,ez)+.07,ez),.4);
      }
      for(let i=0;i<5;i++){
        const a=i*2.3999,b=y+5+i*3;
        const end=v(x+Math.cos(a)*(6+i*.55),b+1.2,z+Math.sin(a)*(6+i*.55));
        this.limb(v(x,b,z),end,.38-i*.025);
        this.limb(end,end.clone().add(v(Math.cos(a+.7)*3,1.2,Math.sin(a+.7)*3)),.13);
      }
      for(let i=0;i<140;i++){
        const a=i*2.3999,radius=this.between(2,9);
        dummy.position.set(x+Math.cos(a)*radius,y+h-4+this.between(-4,3),z+Math.sin(a)*radius);
        dummy.scale.set(this.between(.8,1.6),1,this.between(.8,1.7));dummy.rotation.set(this.between(-.25,.25),a,.1);dummy.updateMatrix();canopy.setMatrixAt(index,dummy.matrix);
        color.set(['#697e4e','#92a866','#a3ae71','#536d48'][i%4]);canopy.setColorAt(index++,color);
      }
    }
    canopy.count=index;canopy.computeBoundingSphere();canopy.castShadow=canopy.receiveShadow=true;this.group.add(canopy);
    // An elevated route through the broken fence, with a gap that rewards a player-made bridge.
    this.limb(v(-18,9,-10),v(-24,8.5,-24),.35);
    this.limb(v(-27,8,-27),v(-34,7,-36),.43);
    this.limb(v(-23,gardenHeight(-23,-27)+.35,-27),v(-31,5.2,-34),.65);
    this.limb(v(16,.5,8),v(29,2.1,13),.64);
    this.limb(v(28,2,13),v(40,5.3,15),.56);
    this.limb(v(-31,.5,21),v(-38,3.6,29),.46);
    this.limb(v(29,.4,41),v(14,5.5,56),.56);
  }
  private arch(){
    const x=36,z=-14,y=gardenHeight(x,z);
    for(const sign of [-1,1]){
      const bottom=gardenHeight(x+sign*3.2,z)-.15,top=y+4.2;
      const leg=new THREE.Mesh(new THREE.CylinderGeometry(.95,1.18,top-bottom,24,5),this.stone);
      leg.position.set(x+sign*3.2,(top+bottom)*.5,z);leg.castShadow=leg.receiveShadow=true;this.solid(leg);
      for(let k=1;k<5;k++){
        const band=new THREE.Mesh(new THREE.TorusGeometry(1.18-(k/5)*.23,.028,5,24),new THREE.MeshStandardMaterial({color:'#626e63',roughness:1}));
        band.rotation.x=Math.PI/2;band.position.set(x+sign*3.2,bottom+(top-bottom)*k/5,z);this.group.add(band);
      }
    }
    const curve=new THREE.CatmullRomCurve3([v(x-3.2,y+4,z),v(x-2.2,y+6.6,z),v(x,y+7.6,z),v(x+2.2,y+6.6,z),v(x+3.2,y+4,z)]);
    const arch=new THREE.Mesh(new THREE.TubeGeometry(curve,48,.82,16,false),this.stone);arch.castShadow=arch.receiveShadow=true;this.solid(arch);
    for(let i=1;i<12;i++){
      const seam=new THREE.Mesh(new THREE.TorusGeometry(.825,.02,5,16),new THREE.MeshStandardMaterial({color:'#667568',roughness:1}));
      seam.position.copy(curve.getPoint(i/12));seam.quaternion.setFromUnitVectors(v(0,0,1),curve.getTangent(i/12));this.group.add(seam);
    }
    this.limb(v(25,gardenHeight(25,-11)+.3,-11),v(33,y+4,-14),.4);
    this.limb(v(39,y+4,-14),v(46,gardenHeight(46,-8)+.3,-8),.5);
    // Broken coping stones offer independent anchors above the arch.
    for(let i=0;i<5;i++){
      const m=new THREE.Mesh(new THREE.IcosahedronGeometry(.6,1),this.stone);m.position.set(x-4+i*2,gardenHeight(x-4+i*2,z+3)+.24,z+3);m.scale.set(1.5,.55,1);m.castShadow= m.receiveShadow=true;this.solid(m);
    }
  }
  private pot(){
    const x=-38,z=30,y=gardenHeight(x,z),clay=new THREE.MeshStandardMaterial({color:'#aa7355',roughness:.93,side:THREE.DoubleSide});
    const shell=new THREE.Mesh(new THREE.CylinderGeometry(3.2,2.15,5,48,8,true,Math.PI*.25,Math.PI*1.55),clay);
    shell.position.set(x,y+2.45,z);shell.castShadow=shell.receiveShadow=true;this.solid(shell);
    const rim=new THREE.Mesh(new THREE.TorusGeometry(3.2,.2,10,64,Math.PI*1.55),clay);rim.rotation.x=Math.PI/2;rim.rotation.z=-Math.PI*.25;rim.position.set(x,y+4.95,z);rim.castShadow=true;this.solid(rim);
    for(let i=0;i<6;i++){
      const shard=new THREE.Mesh(new THREE.IcosahedronGeometry(.8,0),clay);shard.scale.set(1.9,.16,1.2);shard.rotation.y=i*1.9;shard.position.set(x+Math.cos(i*2)*4.1,y+.16,z+Math.sin(i*2)*4);shard.castShadow=true;this.solid(shard);
    }
  }
  private paths(){
    // Low wooden slats give long-distance routes a readable direction and climbable undersides.
    for(const [ax,az,bx,bz,count] of [[5,17,28,29,7],[-17,12,-34,27,6],[12,-21,28,-17,5]]){
      for(let i=0;i<count;i++){
        const t=i/(count-1),x=ax+(bx-ax)*t,z=az+(bz-az)*t;
        const slat=new THREE.Mesh(new THREE.BoxGeometry(3.7,.22,1.35),this.wood);
        slat.position.set(x,gardenHeight(x,z)+.19,z);slat.rotation.y=-Math.atan2(bz-az,bx-ax);slat.rotation.z=this.between(-.04,.04);slat.castShadow=slat.receiveShadow=true;this.solid(slat);
      }
    }
    // A loose fence plank makes an alternative ground-to-ridge route on the far side.
    this.limb(v(10,gardenHeight(10,-27)+.25,-27),v(8,5,-18.5),.48);
  }
  private flowers(){
    const stemMat=new THREE.MeshStandardMaterial({color:'#5d7340',roughness:1});
    const petalGeo=new THREE.SphereGeometry(.72,10,7),petals=new THREE.InstancedMesh(petalGeo,new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.8}),28*6);
    const centers=new THREE.InstancedMesh(new THREE.SphereGeometry(.33,12,8),new THREE.MeshStandardMaterial({color:'#ba954e',roughness:.85}),28);
    const dummy=new THREE.Object3D(),color=new THREE.Color();
    for(let i=0;i<28;i++){
      const a=i*2.3999,r=this.between(2,10),x=(i<20?31:-47)+Math.cos(a)*r,z=(i<20?34:-17)+Math.sin(a)*r,y=gardenHeight(x,z),h=this.between(2.3,5.6);
      const end=v(x+.2,y+h,z);this.limb(v(x,y,z),end,.11,stemMat);
      dummy.position.copy(end);dummy.rotation.set(0,0,0);dummy.scale.set(1,.35,1);dummy.updateMatrix();centers.setMatrixAt(i,dummy.matrix);
      for(let j=0;j<6;j++){
        const angle=j*Math.PI/3;dummy.position.copy(end).add(v(Math.cos(angle)*.52,0,Math.sin(angle)*.52));dummy.rotation.set(.08,angle,.12);dummy.scale.set(.75,.16,1.3);dummy.updateMatrix();petals.setMatrixAt(i*6+j,dummy.matrix);
        color.set(['#efdbab','#d8c4dd','#f2e8cf','#d8ab87'][i%4]);petals.setColorAt(i*6+j,color);
      }
    }
    for(const m of [petals,centers]){m.computeBoundingSphere();m.castShadow=m.receiveShadow=true;this.group.add(m);}
  }
  private vegetation(){
    const geo=new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.Float32BufferAttribute([-.05,0,0,.05,0,0,-.04,.5,.06,.04,.5,.06,0,1,.25],3));geo.setIndex([0,1,2,1,3,2,2,3,4]);geo.computeVertexNormals();
    const mat=new THREE.MeshStandardMaterial({color:'#ffffff',side:THREE.DoubleSide,roughness:1});
    mat.onBeforeCompile=shader=>{
      shader.uniforms.uWind=this.wind;shader.vertexShader='uniform float uWind;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
        transformed.x+=position.y*position.y*sin(uWind*.9+instanceMatrix[3].x*.8+instanceMatrix[3].z)*.14;`);
    };
    const dummy=new THREE.Object3D(),color=new THREE.Color();
    const palette=['#99aa68','#aeb872','#7e975e','#b7b47b','#76905c'];
    // Separate patches can be culled; the old dense starting garden is preserved.
    const reach=Math.ceil(FIELD_EXTENT/21);
    for(let cx=-reach;cx<=reach;cx++)for(let cz=-reach;cz<=reach;cz++){
      if(Math.abs(cx)<=1&&Math.abs(cz)<=1)continue;
      const locations:THREE.Matrix4[]=[],colors:THREE.Color[]=[];
      const count=Math.abs(cx)>3||Math.abs(cz)>3?230:420;
      for(let i=0;i<count;i++){
        const x=cx*21+this.between(-10.5,10.5),z=cz*21+this.between(-10.5,10.5);
        if(Math.abs(x)>FIELD_EXTENT||Math.abs(z)>FIELD_EXTENT)continue;
        // Winding open paths between clusters keep crawling and aiming readable.
        const lane=Math.abs(z-8*Math.sin(x*.065)-x*.35)<1.6||Math.abs(x+12*Math.sin(z*.06))<1.4;
        if(lane&&this.rand()<.87)continue;
        dummy.position.set(x,gardenHeight(x,z)-.02,z);dummy.rotation.set(0,this.rand()*6.28,0);dummy.scale.set(this.between(.65,1.6),this.between(.4,1.65),1);dummy.updateMatrix();locations.push(dummy.matrix.clone());colors.push(color.set(palette[i%5]).clone());
      }
      const patch=new THREE.InstancedMesh(geo,mat,locations.length);locations.forEach((m,i)=>{patch.setMatrixAt(i,m);patch.setColorAt(i,colors[i]);});patch.receiveShadow=true;patch.computeBoundingSphere();this.group.add(patch);patch.userData.center=v(cx*21,0,cz*21);this.patches.push(patch);
    }
  }
  private outcrops(){
    for(let i=0;i<34;i++){
      const a=i*2.3999,r=this.between(29,72),x=Math.cos(a)*r,z=Math.sin(a)*r,size=this.between(.8,2.4);
      const rock=new THREE.Mesh(new THREE.IcosahedronGeometry(size,1),this.stone);rock.position.set(x,gardenHeight(x,z)+size*.36,z);rock.scale.set(1.4,.6,1);rock.rotation.y=a;rock.castShadow=rock.receiveShadow=true;this.solid(rock);
    }
  }
  private cover(){
    const geo=new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.Float32BufferAttribute([0,0,-.4,-.16,.025,-.05,0,.055,.1,.16,.025,-.05,0,0,.4],3));
    geo.setAttribute('uv',new THREE.Float32BufferAttribute([.5,0,0,.35,.5,.55,1,.35,.5,1],2));geo.setIndex([0,1,2,0,2,3,1,4,2,2,4,3]);geo.computeVertexNormals();
    const count=6500,mesh=new THREE.InstancedMesh(geo,new THREE.MeshStandardMaterial({map:this.leafTexture,color:'#d0dbb0',roughness:1,side:THREE.DoubleSide}),count);
    const dummy=new THREE.Object3D(),color=new THREE.Color();
    const clusters=[[-34,-36],[40,15],[-57,2],[12,57],[31,34],[-38,30]];
    for(let i=0;i<count;i++){
      let x:number,z:number;
      if(i<4000){const center=clusters[i%clusters.length],a=this.rand()*Math.PI*2,r=this.between(2,12);x=center[0]+Math.cos(a)*r;z=center[1]+Math.sin(a)*r;}
      else{const a=this.rand()*Math.PI*2,r=this.between(30,77);x=Math.cos(a)*r;z=Math.sin(a)*r;}
      dummy.position.set(x,gardenHeight(x,z)+.055,z);dummy.rotation.set(this.between(-.14,.14),this.rand()*6.28,this.between(-.1,.1));dummy.scale.set(this.between(.65,1.6),1,this.between(.7,1.8));dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
      color.set(['#81975d','#a6b674','#719259','#b6b37a'][i%4]);mesh.setColorAt(i,color);
    }
    mesh.computeBoundingSphere();mesh.receiveShadow=true;this.group.add(mesh);
  }
  update(player:THREE.Vector3){
    for(const patch of this.patches){const center=patch.userData.center as THREE.Vector3;patch.visible=Math.hypot(center.x-player.x,center.z-player.z)<90;}
  }
}
