import * as THREE from 'three';
import { gardenHeight } from './WorldLayout';

const v=(x:number,y:number,z:number)=>new THREE.Vector3(x,y,z);
type Solid=(mesh:THREE.Mesh)=>void;
export class FarGarden {
  private waterTime={value:0};
  private patches:{mesh:THREE.Object3D;center:THREE.Vector3}[]=[];
  private state=38013;
  private random(){this.state=(Math.imul(this.state,1664525)+1013904223)>>>0;return this.state/4294967296;}
  private range(a:number,b:number){return a+(b-a)*this.random();}
  constructor(private group:THREE.Group,private solid:Solid,private wood:THREE.Material,private stone:THREE.Material,private wind:{value:number},private leaf:THREE.Texture){
    this.reedwater();this.hollow();this.hedge();this.ferns();this.routes();this.wildTrees();this.floorCover();
  }
  private limb(a:THREE.Vector3,b:THREE.Vector3,radius:number,material=this.wood){
    const delta=b.clone().sub(a),mesh=new THREE.Mesh(new THREE.CylinderGeometry(radius*.75,radius,delta.length(),16,4),material);
    mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(v(0,1,0),delta.normalize());mesh.castShadow=mesh.receiveShadow=true;this.solid(mesh);return mesh;
  }
  private reedwater(){
    const x=86,z=73,y=gardenHeight(x,z)+.4;
    const geo=new THREE.CircleGeometry(9,72);geo.rotateX(-Math.PI/2);
    const material=new THREE.ShaderMaterial({uniforms:{uTime:this.waterTime},transparent:true,depthWrite:false,side:THREE.DoubleSide,
      vertexShader:'varying vec3 p; void main(){p=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:`uniform float uTime; varying vec3 p; void main(){float r=length(p.xz);float ripple=sin(r*8.-uTime*1.4)+sin(p.x*4.+p.z*3.+uTime*.7);float rim=1.-smoothstep(7.7,9.,r);vec3 col=mix(vec3(.12,.25,.24),vec3(.42,.57,.49),.5+.5*sin(p.x*.4+p.z*.25+ripple*.035));float shine=pow(max(0.,sin(p.x*4.+p.z*3.+uTime*.7)),20.)*.15;gl_FragColor=vec4(col+shine+ripple*.007,rim*.83);#include <tonemapping_fragment>\n#include <colorspace_fragment>}`.replace(';#include',';\n#include')});
    const water=new THREE.Mesh(geo,material);water.position.set(x,y,z);water.receiveShadow=true;this.group.add(water);
    const reedMat=new THREE.MeshStandardMaterial({color:'#899357',roughness:.9}),headMat=new THREE.MeshStandardMaterial({color:'#70553a',roughness:1});
    const stems=new THREE.InstancedMesh(new THREE.CylinderGeometry(.04,.075,1,7),reedMat,150),heads=new THREE.InstancedMesh(new THREE.CapsuleGeometry(.16,.7,3,8),headMat,150),dummy=new THREE.Object3D();
    for(let i=0;i<150;i++){
      const a=i*2.39996,r=this.range(8.5,12),px=x+Math.cos(a)*r,pz=z+Math.sin(a)*r,base=gardenHeight(px,pz),h=this.range(2.6,5.3);
      dummy.position.set(px,base+h*.5,pz);dummy.rotation.set(.05*Math.sin(a),0,.1*Math.cos(a));dummy.scale.set(1,h,1);dummy.updateMatrix();stems.setMatrixAt(i,dummy.matrix);
      dummy.position.y=base+h-.25;dummy.scale.set(1,1,1);dummy.updateMatrix();heads.setMatrixAt(i,dummy.matrix);
      if(i%12===0)this.limb(v(px,base,pz),v(px+.12,base+h,pz),.085,reedMat);
    }
    for(const mesh of [stems,heads]){mesh.computeBoundingSphere();mesh.castShadow=mesh.receiveShadow=true;this.group.add(mesh);}
    this.limb(v(x-12,gardenHeight(x-12,z)+.4,z),v(x+9,y+1.6,z+3),.7);
    this.limb(v(x+5,y+1.45,z+2),v(x+12,gardenHeight(x+12,z+10)+.3,z+10),.42);
    for(let i=0;i<12;i++){
      const a=i*2.4,px=x+Math.cos(a)*10,pz=z+Math.sin(a)*10,rock=new THREE.Mesh(new THREE.IcosahedronGeometry(this.range(.6,1.2),1),this.stone);
      rock.position.set(px,gardenHeight(px,pz)+.2,pz);rock.scale.set(1.5,.5,1);rock.castShadow=rock.receiveShadow=true;this.solid(rock);
    }
  }
  private hollow(){
    const x=-95,z=-73,y=gardenHeight(x,z),bark=(this.wood as THREE.MeshStandardMaterial).clone();bark.side=THREE.DoubleSide;
    const shell=new THREE.Mesh(new THREE.CylinderGeometry(3.5,4,20,48,12,true),bark);shell.rotation.z=Math.PI/2;shell.position.set(x,y+3.25,z);shell.castShadow=shell.receiveShadow=true;this.solid(shell);
    for(const side of [-1,1]){
      const rim=new THREE.Mesh(new THREE.TorusGeometry(side===1?4:3.5,.15,8,48),bark);rim.rotation.y=Math.PI/2;rim.position.set(x+side*10,y+3.25,z);rim.castShadow=true;this.solid(rim);
    }
    this.limb(v(x-14,gardenHeight(x-14,z+6)+.2,z+6),v(x-2,y+6.9,z+1.1),.56);
    this.limb(v(x+4,y+6.4,z+.3),v(x+14,gardenHeight(x+14,z-7)+.2,z-7),.7);
    this.limb(v(x-8,y+.3,z),v(x+8,y+.3,z),.4);
    const caps=new THREE.InstancedMesh(new THREE.SphereGeometry(.6,12,8),new THREE.MeshStandardMaterial({color:'#c29d6b',roughness:.82}),24),dummy=new THREE.Object3D();
    for(let i=0;i<24;i++){
      const px=x+this.range(-8,8),pz=z+(i%2?1:-1)*this.range(3.1,3.8),base=gardenHeight(px,pz);
      this.limb(v(px,base,pz),v(px,base+.8,pz),.1,new THREE.MeshStandardMaterial({color:'#c8b78c',roughness:1}));
      dummy.position.set(px,base+.85,pz);dummy.scale.set(1,.36,1);dummy.rotation.set(0,this.random()*6.28,0);dummy.updateMatrix();caps.setMatrixAt(i,dummy.matrix);
    }
    caps.computeBoundingSphere();caps.castShadow=true;this.group.add(caps);
  }
  private hedge(){
    const x=101,z=-81,y=gardenHeight(x,z),green=new THREE.MeshStandardMaterial({map:this.leaf,color:'#849864',roughness:.88,side:THREE.DoubleSide});
    const leaves=new THREE.InstancedMesh(new THREE.SphereGeometry(1,8,6),green,900),berries=new THREE.InstancedMesh(new THREE.SphereGeometry(.13,9,6),new THREE.MeshStandardMaterial({color:'#946179',roughness:.32}),200),dummy=new THREE.Object3D();let berry=0;
    for(let i=0;i<6;i++){
      const px=x-9+i*3.6,pz=z+Math.sin(i)*1.6,base=gardenHeight(px,pz);
      this.limb(v(px,base,pz),v(px,base+5.5,pz),.26);
      for(const side of [-1,1])this.limb(v(px,base+1.7,pz),v(px+side*2.3,base+4.6,pz+side*1.4),.13);
      for(let j=0;j<150;j++){
        const a=j*2.4,r=this.range(.4,2.7);dummy.position.set(px+Math.cos(a)*r,base+this.range(1.8,6.4),pz+Math.sin(a)*r);dummy.rotation.set(0,a,.12);dummy.scale.set(this.range(.4,.8),.035,this.range(.7,1.1));dummy.updateMatrix();leaves.setMatrixAt(i*150+j,dummy.matrix);
        if(j%5===0&&berry<200){dummy.position.add(v(.1,-.08,.15));dummy.scale.set(1,1,1);dummy.updateMatrix();berries.setMatrixAt(berry++,dummy.matrix);}
      }
    }
    berries.count=berry;for(const mesh of [leaves,berries]){mesh.computeBoundingSphere();mesh.castShadow=mesh.receiveShadow=true;this.group.add(mesh);}
    // A forgotten lattice offers low net anchors and a climbable roof above the mouse trail.
    for(const px of [x-5,x+5])for(const pz of [z+4,z+8])this.limb(v(px,gardenHeight(px,pz),pz),v(px,y+6,pz),.24);
    for(let i=0;i<5;i++)this.limb(v(x-5,y+6,z+4+i),v(x+5,y+6,z+4+i),.13);
    this.limb(v(x-7,gardenHeight(x-7,z+10)+.2,z+10),v(x-5,y+5.8,z+8),.4);
  }
  private ferns(){
    const geometry=new THREE.BufferGeometry(),points:number[]=[],indices:number[]=[],uv:number[]=[];
    for(let i=0;i<=32;i++){
      const t=i/32,width=Math.sin(t*Math.PI)*.36*(i%2?.52:1);
      points.push(-width,Math.sin(t*Math.PI)*.22,t*2.6,width,Math.sin(t*Math.PI)*.22,t*2.6);
      uv.push(0,t,1,t);
      if(i<32){const a=i*2;indices.push(a,a+2,a+1,a+1,a+2,a+3);}
    }
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(points,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();
    const material=new THREE.MeshStandardMaterial({map:this.leaf,color:'#a6b683',roughness:.94,side:THREE.DoubleSide});
    material.onBeforeCompile=shader=>{shader.uniforms.uWind=this.wind;shader.vertexShader='uniform float uWind;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed.y+=sin(uWind+instanceMatrix[3].x+position.z)*position.z*.035;');};
    const patch=new THREE.InstancedMesh(geometry,material,900),dummy=new THREE.Object3D();
    for(let i=0;i<900;i++){
      const a=i*2.39996,r=this.range(2,19),x=-95+Math.cos(a)*r,z=86+Math.sin(a)*r;
      dummy.position.set(x,gardenHeight(x,z)+.1,z);dummy.rotation.set(this.range(-.6,.1),a,0);dummy.scale.set(1,1,this.range(.7,1.4));dummy.updateMatrix();patch.setMatrixAt(i,dummy.matrix);
    }
    patch.computeBoundingSphere();patch.castShadow=patch.receiveShadow=true;this.group.add(patch);this.patches.push({mesh:patch,center:v(-95,0,86)});
    for(let i=0;i<5;i++){const x=-104+i*4,z=84+Math.sin(i)*6;this.limb(v(x,gardenHeight(x,z)+.3,z),v(x+7,gardenHeight(x+7,z+5)+1.3,z+5),.7);}
  }
  private routes(){
    for(const [ax,az,bx,bz] of [[40,15,86,73],[-34,-36,-95,-73],[-38,30,-95,86],[36,-14,101,-81],[86,73,110,5]]){
      for(let i=1;i<=9;i++){
        const t=i/10,x=THREE.MathUtils.lerp(ax,bx,t),z=THREE.MathUtils.lerp(az,bz,t),h=gardenHeight(x,z);
        if(i%3===0)this.limb(v(x-3,h+.35,z-1),v(x+3,h+.5,z+1),.44);
        else{const rock=new THREE.Mesh(new THREE.IcosahedronGeometry(.9,1),this.stone);rock.position.set(x,h+.23,z);rock.scale.set(1.5,.5,1);rock.castShadow=rock.receiveShadow=true;this.solid(rock);}
      }
    }
  }
  private wildTrees(){
    const leaves=new THREE.InstancedMesh(new THREE.SphereGeometry(1,8,6),new THREE.MeshStandardMaterial({map:this.leaf,color:'#81945e',roughness:1}),1100),dummy=new THREE.Object3D();let index=0;
    for(const [x,z,height] of [[68,86,26],[-112,-62,29],[111,-96,25],[-82,104,28],[124,27,31],[-125,13,24]]){
      const y=gardenHeight(x,z),radius=height*.068;
      const trunk=new THREE.Mesh(new THREE.CylinderGeometry(radius*.55,radius,height,40,10),this.wood);trunk.position.set(x,y+height/2-.2,z);trunk.castShadow=trunk.receiveShadow=true;this.solid(trunk);
      for(let i=0;i<6;i++){
        const a=i*2.39996,end=v(x+Math.cos(a)*7,y+5+i*3.6,z+Math.sin(a)*7);this.limb(v(x,y+4+i*3.5,z),end,.35);
        this.limb(v(x+Math.cos(a)*radius*.7,y+.6,z+Math.sin(a)*radius*.7),v(x+Math.cos(a)*7,gardenHeight(x+Math.cos(a)*7,z+Math.sin(a)*7)+.1,z+Math.sin(a)*7),.48);
      }
      for(let i=0;i<180;i++){
        const a=i*2.39996,r=this.range(2,9);dummy.position.set(x+Math.cos(a)*r,y+height-3+this.range(-4,3),z+Math.sin(a)*r);dummy.rotation.set(0,a,.2);dummy.scale.set(this.range(.55,1.2),.025,this.range(1.3,2));dummy.updateMatrix();leaves.setMatrixAt(index++,dummy.matrix);
      }
    }
    leaves.count=index;leaves.computeBoundingSphere();leaves.castShadow=leaves.receiveShadow=true;this.group.add(leaves);
  }
  private floorCover(){
    const geo=new THREE.PlaneGeometry(.6,1.35,2,4);geo.rotateX(-Math.PI/2);
    const p=geo.attributes.position;
    for(let i=0;i<p.count;i++){const z=p.getZ(i),t=(z+.675)/1.35;p.setX(i,p.getX(i)*Math.sin(t*Math.PI));p.setY(i,Math.sin(t*Math.PI)*.045);}
    geo.computeVertexNormals();
    const material=new THREE.MeshStandardMaterial({map:this.leaf,color:'#a0a66c',roughness:1,side:THREE.DoubleSide}),dummy=new THREE.Object3D(),color=new THREE.Color();
    for(const [x,z] of [[86,73],[-95,-73],[101,-81],[-95,86],[124,27],[-125,13]]){
      const leaves=new THREE.InstancedMesh(geo,material,900);
      for(let i=0;i<900;i++){
        const a=i*2.4,r=this.range(2,17),px=x+Math.cos(a)*r,pz=z+Math.sin(a)*r;
        dummy.position.set(px,gardenHeight(px,pz)+.065,pz);dummy.rotation.set(this.range(-.08,.08),a,this.range(-.08,.08));dummy.scale.set(this.range(.6,1.7),1,this.range(.65,1.8));dummy.updateMatrix();leaves.setMatrixAt(i,dummy.matrix);
        color.set(['#aaa578','#789567','#8e9c68','#baaf80'][i%4]);leaves.setColorAt(i,color);
      }
      leaves.computeBoundingSphere();leaves.receiveShadow=true;this.group.add(leaves);this.patches.push({mesh:leaves,center:v(x,0,z)});
    }
  }
  update(t:number,player:THREE.Vector3){this.waterTime.value=t;for(const patch of this.patches)patch.mesh.visible=Math.hypot(patch.center.x-player.x,patch.center.z-player.z)<90;}
}
