import * as THREE from 'three';

function bone(a: THREE.Vector3,b: THREE.Vector3,r1: number,r2: number,material: THREE.Material): THREE.Mesh {
  const d=new THREE.Vector3().subVectors(b,a);
  const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,d.length(),7),material);
  mesh.position.copy(a).add(b).multiplyScalar(.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());
  mesh.castShadow=true;
  return mesh;
}

export class Spider {
  readonly group=new THREE.Group();
  readonly model=new THREE.Group();
  private legs: THREE.Group[]=[];
  private abdomen: THREE.Mesh;
  private thorax: THREE.Mesh;

  constructor(scene: THREE.Scene) {
    const shell=new THREE.MeshPhysicalMaterial({color:'#594631',roughness:.64,metalness:.03,clearcoat:.19,clearcoatRoughness:.52});
    const dark=new THREE.MeshStandardMaterial({color:'#282923',roughness:.71});
    const band=new THREE.MeshStandardMaterial({color:'#9c865f',roughness:.82});
    const eyes=new THREE.MeshPhysicalMaterial({color:'#101719',roughness:.08,metalness:.2,clearcoat:1});
    this.group.add(this.model);
    this.abdomen=new THREE.Mesh(new THREE.SphereGeometry(.28,24,16),shell);
    this.abdomen.scale.set(1,.74,1.32);
    this.abdomen.position.set(0,.05,.24);
    this.abdomen.castShadow=true; this.model.add(this.abdomen);
    this.thorax=new THREE.Mesh(new THREE.SphereGeometry(.205,20,14),shell);
    this.thorax.scale.set(1,.7,1.1); this.thorax.position.set(0,.035,-.16);
    this.thorax.castShadow=true; this.model.add(this.thorax);
    // Quiet dorsal spots read as an orb-weaver pattern without a cartoon face.
    for(let i=0;i<5;i++) for(const side of [-1,1]) {
      const spot=new THREE.Mesh(new THREE.SphereGeometry(.02,7,5),band);
      const z=.08+i*.084;
      spot.scale.set(i===0?.9:1,.28,1.25);
      spot.position.set(side*(.09+i*.006),.235-Math.abs(z-.23)*.16,z);
      this.model.add(spot);
    }
    for(const side of [-1,1]) {
      for(let i=0;i<4;i++) {
        const pivot=new THREE.Group();
        const z=-.24+i*.135;
        pivot.position.set(side*.13,.025,z);
        const spread=[-.34,-.15,.12,.35][i];
        const hip=new THREE.Vector3(side*.16,.005,spread*.25);
        const knee=new THREE.Vector3(side*(.39+Math.abs(spread)*.3),.13,spread);
        const ankle=new THREE.Vector3(side*(.58+Math.abs(spread)*.32),-.105,spread*1.52);
        const tip=new THREE.Vector3(side*(.67+Math.abs(spread)*.34),-.27,spread*1.7);
        pivot.add(bone(new THREE.Vector3(0,0,0),hip,.033,.039,shell));
        pivot.add(bone(hip,knee,.024,.032,shell));
        pivot.add(bone(knee,ankle,.014,.023,dark));
        pivot.add(bone(ankle,tip,.007,.014,dark));
        const joint=new THREE.Mesh(new THREE.SphereGeometry(.03,8,6),band);joint.position.copy(knee);pivot.add(joint);
        const ankleJoint=new THREE.Mesh(new THREE.SphereGeometry(.016,6,5),shell);ankleJoint.position.copy(ankle);pivot.add(ankleJoint);
        this.model.add(pivot);this.legs.push(pivot);
      }
      for(let i=0;i<2;i++) {
        const eye=new THREE.Mesh(new THREE.SphereGeometry(i===0?.048:.03,10,8),eyes);
        eye.position.set(side*(i===0?.105:.155),.115,-.325+(i===0?0:.055));
        this.model.add(eye);
        const glint=new THREE.Mesh(new THREE.SphereGeometry(.012,5,4),new THREE.MeshBasicMaterial({color:'#c6dbd2'}));
        glint.position.copy(eye.position).add(new THREE.Vector3(-.009,.016,-.035));this.model.add(glint);
      }
      const palp=bone(new THREE.Vector3(side*.1,-.01,-.31),new THREE.Vector3(side*.16,-.11,-.43),.015,.022,dark);
      this.model.add(palp);
    }
    scene.add(this.group);
  }

  animate(t: number,speed: number,airborne: boolean) {
    const activity=Math.min(1,speed/3.2);
    this.model.position.y=(airborne?.015:Math.sin(t*13*activity)*.018*activity);
    this.abdomen.rotation.z=Math.sin(t*8)*.026*activity;
    this.thorax.rotation.x=Math.sin(t*13*activity)*.025*activity;
    this.legs.forEach((leg,i)=>{
      const phase=t*12*activity+(i%4)*Math.PI*.55+(i<4?0:Math.PI);
      leg.rotation.y=Math.sin(phase)*.23*activity*(i<4?1:-1);
      leg.rotation.z=Math.max(0,Math.sin(phase))*.17*activity*(i<4?1:-1);
    });
  }
}
