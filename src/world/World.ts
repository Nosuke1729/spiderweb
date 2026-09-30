import * as THREE from 'three';
import { installTerrainRaycast } from './Terrain';
import { ExpandedGarden } from './ExpandedGarden';
import { gardenHeight,TERRAIN_SIZE } from './WorldLayout';

const seed = (n: number) => {
  let x = n >>> 0;
  return () => ((x = (Math.imul(x, 1664525) + 1013904223) >>> 0) / 4294967296);
};
const rand = seed(1729);
const between = (a: number, b: number) => a + (b - a) * rand();

function texture(kind: 'earth' | 'bark' | 'wood' | 'leaf' | 'stone'): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const c = canvas.getContext('2d')!;
  const colors = {
    earth: ['#5b503c', '#79694d', '#988261', '#3d4c36', '#b0a078'],
    bark: ['#302c25', '#4a3b30', '#65513c', '#8d7050', '#202922'],
    wood: ['#57432e', '#796047', '#a2825b', '#392f27', '#b09672'],
    leaf: ['#819458', '#a4b579', '#c4ca8b', '#6a8652', '#d4c68a'],
    stone: ['#75817b','#9aa398','#b8bca9','#626f6d','#d4d2bd'],
  }[kind];
  c.fillStyle = colors[0]; c.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 15000; i++) {
    c.globalAlpha = between(.02, .22);
    c.fillStyle = colors[Math.floor(rand() * colors.length)];
    const x = rand() * 512, y = rand() * 512;
    if (kind === 'bark' || kind === 'wood') c.fillRect(x, y, between(1, 5), between(4, 35));
    else { c.beginPath(); c.arc(x, y, between(.4, 3), 0, Math.PI * 2); c.fill(); }
  }
  c.globalAlpha = .22;
  if (kind === 'bark' || kind === 'wood') {
    for (let i = 0; i < 80; i++) {
      c.strokeStyle = colors[Math.floor(rand() * colors.length)];
      c.lineWidth = between(.5, 3);
      c.beginPath(); const x = rand() * 512;
      c.moveTo(x, 0); c.bezierCurveTo(x + between(-20, 20), 170, x + between(-20, 20), 350, x + between(-20, 20), 512); c.stroke();
    }
  }
  if(kind==='leaf'){
    c.globalAlpha=.4;c.strokeStyle='#d4d499';c.lineWidth=2;c.beginPath();c.moveTo(256,0);c.lineTo(256,512);c.stroke();
    for(let y=35;y<490;y+=32)for(const sign of [-1,1]){c.lineWidth=.8;c.beginPath();c.moveTo(256,y+38);c.quadraticCurveTo(256+sign*88,y-10,256+sign*235,y-34);c.stroke();}
  }
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

function cylinderBetween(a: THREE.Vector3, b: THREE.Vector3, radius: number, material: THREE.Material, sides = 10): THREE.Mesh {
  const direction = new THREE.Vector3().subVectors(b, a);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius * .78, radius, direction.length(), sides, 3), material);
  mesh.position.copy(a).add(b).multiplyScalar(.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}

export class World {
  readonly group = new THREE.Group();
  readonly colliders: THREE.Object3D[] = [];
  readonly anchors: THREE.Object3D[] = [];
  readonly ground: THREE.Mesh;
  readonly sun = new THREE.DirectionalLight(0xffd8a3, 4.3);
  readonly sunDirection=new THREE.Vector3(-15,25,-14).normalize();
  private windUniform = { value: 0 };
  private motes!: THREE.Points;
  private motePositions!: Float32Array;
  private water!: THREE.Mesh;
  private waterTime = { value: 0 };

  constructor(scene: THREE.Scene) {
    scene.background = new THREE.Color('#c6c6aa');
    scene.fog = new THREE.FogExp2('#bfc1a1', .010);
    const sky=new THREE.Mesh(new THREE.SphereGeometry(235,32,16),new THREE.ShaderMaterial({
      side:THREE.BackSide,depthWrite:false,fog:false,
      vertexShader:`varying vec3 vWorld; void main(){vWorld=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader:`varying vec3 vWorld; void main(){float h=clamp(vWorld.y/235.,-.25,1.);vec3 horizon=vec3(.88,.78,.63);vec3 top=vec3(.50,.64,.66);vec3 below=vec3(.48,.52,.43);vec3 col=h<0.?mix(below,horizon,smoothstep(-.25,0.,h)):mix(horizon,top,smoothstep(0.,.85,h));gl_FragColor=vec4(col,1.);}`
    }));
    sky.frustumCulled=false;scene.add(sky);
    const sunCanvas=document.createElement('canvas');sunCanvas.width=sunCanvas.height=128;
    const ctx=sunCanvas.getContext('2d')!;
    const gradient=ctx.createRadialGradient(64,64,2,64,64,64);
    gradient.addColorStop(0,'rgba(255,247,207,1)');gradient.addColorStop(.13,'rgba(255,224,167,.85)');gradient.addColorStop(.45,'rgba(255,189,112,.18)');gradient.addColorStop(1,'rgba(255,180,100,0)');
    ctx.fillStyle=gradient;ctx.fillRect(0,0,128,128);
    const sunGlow=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(sunCanvas),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));
    sunGlow.position.set(-20,18,-37);sunGlow.scale.set(23,23,1);scene.add(sunGlow);
    scene.add(this.group);
    const ambient = new THREE.HemisphereLight(0xe8efdc, 0x6a5d45, 1.9);
    scene.add(ambient);
    const fill = new THREE.DirectionalLight(0xffebc9, 1.15);
    fill.position.set(12, 9, 8);
    scene.add(fill);
    this.sun.position.set(-15, 25, -18);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.left = this.sun.shadow.camera.bottom = -29;
    this.sun.shadow.camera.right = this.sun.shadow.camera.top = 29;
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 120;
    this.sun.shadow.bias = -.0003;
    this.sun.shadow.normalBias = .035;
    this.sun.target.position.set(0, 0, -4);
    scene.add(this.sun, this.sun.target);
    const earth=texture('earth');
    const gmat = new THREE.MeshStandardMaterial({ map: earth, bumpMap:earth, bumpScale:.065, roughness: .97, color: '#c8c3a3' });
    gmat.map!.repeat.set(21.6, 21.6);
    const groundGeometry = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, TERRAIN_SIZE, TERRAIN_SIZE);
    groundGeometry.rotateX(-Math.PI / 2);
    const p = groundGeometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      p.setY(i, this.height(x, z));
    }
    groundGeometry.computeVertexNormals();
    this.ground = new THREE.Mesh(groundGeometry, gmat);
    this.ground.receiveShadow = true;
    installTerrainRaycast(this.ground,TERRAIN_SIZE,TERRAIN_SIZE);
    this.addSolid(this.ground);
    this.makeTree();
    this.makeFence();
    this.makeBench();
    this.makeRocks();
    this.makeTunnel();
    this.makeLantern();
    this.makeMushrooms();
    this.makeFlowers();
    this.makeGrass();
    this.makeGroundCover();
    this.makeLeaves();
    this.makeMossAndDew();
    this.makeWater();
    this.makeFerns();
    this.makeMotes();
    const outerWoodTexture=texture('bark');
    const outerWood=new THREE.MeshStandardMaterial({map:outerWoodTexture,bumpMap:outerWoodTexture,bumpScale:.12,color:'#baa187',roughness:.97});
    const outerStoneTexture=texture('stone');outerStoneTexture.repeat.set(2,2);
    const outerStone=new THREE.MeshStandardMaterial({map:outerStoneTexture,bumpMap:outerStoneTexture,bumpScale:.09,color:'#d0d7cf',roughness:.93});
    new ExpandedGarden(this.group,mesh=>this.addSolid(mesh),outerWood,outerStone,this.windUniform,texture('leaf'));
  }

  height(x: number, z: number): number {
    return gardenHeight(x,z);
  }

  private addSolid(mesh: THREE.Mesh, anchor = true) {
    mesh.geometry.computeBoundingBox();
    this.group.add(mesh);
    this.colliders.push(mesh);
    if (anchor) this.anchors.push(mesh);
  }

  private makeTree() {
    const barkTexture=texture('bark');
    const bark = new THREE.MeshStandardMaterial({ map: barkTexture, bumpMap:barkTexture,bumpScale:.13, roughness: .96, color: '#baa187' });
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 2.2, 19, 64, 12), bark);
    trunk.position.set(-9, 8.8, -8);
    trunk.castShadow = trunk.receiveShadow = true;
    this.addSolid(trunk);
    const barkRidge=new THREE.MeshStandardMaterial({color:'#423a2e',roughness:1});
    for(let i=0;i<26;i++){
      const angle=i*Math.PI*2/26+between(-.12,.12);
      const y=between(.1,5),h=between(2.5,8);
      const radius=2.18-(y+h*.5)*.035;
      const ridge=new THREE.Mesh(new THREE.CylinderGeometry(between(.025,.06),between(.045,.11),h,5),barkRidge);
      ridge.position.set(-9+Math.cos(angle)*radius,y+h*.5,-8+Math.sin(angle)*radius);
      ridge.rotation.z=between(-.05,.05);ridge.castShadow=true;this.group.add(ridge);
    }
    for (let i = 0; i < 9; i++) {
      const theta = i * Math.PI * 2 / 9 + .15;
      const a = new THREE.Vector3(-9 + Math.cos(theta) * 1.2, .4, -8 + Math.sin(theta) * 1.2);
      const b = new THREE.Vector3(-9 + Math.cos(theta) * between(4, 6), .12, -8 + Math.sin(theta) * between(4, 6));
      const root = cylinderBetween(a, b, between(.18, .38), bark, 24);
      this.addSolid(root);
    }
    const branchEnds = [
      [[-9, 8, -8], [-2, 9, -4]], [[-9, 11, -8], [-15, 12, -1]],
      [[-9, 5, -8], [-4, 4, -12]], [[-9, 14, -8], [0, 15, -12]],
      [[-9, 8, -8], [-18, 9, -10]], [[-9, 4, -8], [-6, 3, -1]],
    ];
    branchEnds.forEach(([a, b], i) => {
      const branch = cylinderBetween(new THREE.Vector3(...a), new THREE.Vector3(...b), i === 5 ? .5 : .35, bark, 24);
      this.addSolid(branch);
    });
    // Low, broad branch: an early opportunity to climb, leap, and anchor silk.
    this.addSolid(cylinderBetween(new THREE.Vector3(-6, 2.8, -1), new THREE.Vector3(3, 2.1, 2), .42, bark, 24));
    // These branches form a loop from the roots through the lantern to the fence.
    this.addSolid(cylinderBetween(new THREE.Vector3(-4,4,-12),new THREE.Vector3(3.3,2.3,-10.8),.26,bark,24));
    this.addSolid(cylinderBetween(new THREE.Vector3(4.2,2.3,-11),new THREE.Vector3(1.4,5.35,-17.9),.23,bark,24));
    this.addSolid(cylinderBetween(new THREE.Vector3(6,.7,1.5),new THREE.Vector3(9.1,.35,5.1),.24,bark,20));
    const log = cylinderBetween(new THREE.Vector3(-4, .65, 10), new THREE.Vector3(7, .9, 1), 1.05, bark, 16);
    this.addSolid(log);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(.98, .17, 8, 24), bark);
    rim.position.set(7, .9, 1); rim.rotation.y = -.89; this.group.add(rim);
    const hollow = new THREE.Mesh(new THREE.CircleGeometry(.78, 24), new THREE.MeshStandardMaterial({ color: '#14150f', roughness: 1, side: THREE.DoubleSide }));
    hollow.position.set(7.02, .9, 1.02); hollow.rotation.y = -.89; this.group.add(hollow);
  }

  private makeFence() {
    const grain=texture('wood');
    const wood = new THREE.MeshStandardMaterial({ map: grain,bumpMap:grain,bumpScale:.075, roughness: .94, color: '#a89170' });
    const dark = new THREE.MeshStandardMaterial({ color: '#514735', roughness: 1 });
    for (let i = -9; i <= 9; i++) {
      if(i===5||i===6)continue; // A ground-level opening invites exploration beyond the fence.
      const x = i * 2.05;
      const h = between(5.3, 7.7);
      const board = new THREE.Mesh(new THREE.BoxGeometry(1.85, h, .43), wood);
      board.position.set(x, h / 2 - .25, -18 + between(-.17, .17));
      board.rotation.z = between(-.035, .035);
      board.castShadow = board.receiveShadow = true;
      this.addSolid(board);
      if (i % 3 === 0) {
        for (const y of [2.5, 4.7]) {
          const nail = new THREE.Mesh(new THREE.SphereGeometry(.055, 6, 4), dark);
          nail.position.set(x + .5, y, -17.73); this.group.add(nail);
        }
      }
    }
    for (const y of [2.4, 5]) {
      for(const [x,width] of [[-4.5,28.9],[16.7,5.8]]){
        const rail = new THREE.Mesh(new THREE.BoxGeometry(width, .35, .6), wood);
        rail.position.set(x, y, -18.4); rail.castShadow = true; this.addSolid(rail);
      }
    }
  }

  private makeBench() {
    const wood = new THREE.MeshStandardMaterial({ map: texture('wood'), roughness: .85, color: '#b19570' });
    const metal = new THREE.MeshStandardMaterial({ color: '#434943', metalness: .65, roughness: .45 });
    // A weathered seed tray; its undersides and rim are traversable.
    for (const x of [9, 13.5]) for (const z of [-11, -5.5]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(.35, 3.2, .35), metal);
      leg.position.set(x, 1.5, z); leg.castShadow = true; this.addSolid(leg);
    }
    for (let j = 0; j < 4; j++) {
      const plank = new THREE.Mesh(new THREE.BoxGeometry(6.4, .28, 1.6), wood);
      plank.position.set(11.3, 3.13, -10.2 + j * 1.4);
      plank.castShadow = plank.receiveShadow = true; this.addSolid(plank);
    }
    for (const z of [-11.1, -5]) {
      const rim = new THREE.Mesh(new THREE.BoxGeometry(6.65, .75, .22), wood);
      rim.position.set(11.3, 3.45, z); rim.castShadow = true; this.addSolid(rim);
    }
  }

  private makeRocks() {
    const stone = new THREE.MeshStandardMaterial({ color: '#777c70', roughness: .95, flatShading: false });
    const moss = new THREE.MeshStandardMaterial({ color: '#456039', roughness: 1 });
    const spots = [[3, -2, 1.4], [4, -11, 2.3], [-12, 4, 2], [17, 3, 1.7], [-18, -3, 2.5], [1, 13, 1.1], [6, 12, 1.9]];
    for (const [x, z, s] of spots) {
      const geo = new THREE.IcosahedronGeometry(s, 2);
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i);
        const noise=1+Math.sin(x*3.1+y*2.7+z*1.8)*.075+Math.cos(z*4.3-x*1.2)*.04;
        pos.setXYZ(i,x*noise,y*noise*.7,z*noise*.94);
      }
      geo.computeVertexNormals();
      const rock = new THREE.Mesh(geo, stone);
      rock.position.set(x, this.height(x, z) + s * .48, z); rock.rotation.y = rand() * 6;
      rock.castShadow = rock.receiveShadow = true; this.addSolid(rock);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(s * .75, 12, 8, 0, Math.PI * 2, 0, Math.PI * .4), moss);
      cap.scale.y = .23; cap.position.set(x, rock.position.y + s * .5, z);
      cap.receiveShadow = true; this.group.add(cap);
    }
  }

  private makeTunnel(){
    // A discarded terracotta drain creates a real ground-level passage.
    const clay=new THREE.MeshStandardMaterial({color:'#9c765c',roughness:1,side:THREE.DoubleSide});
    const darkClay=new THREE.MeshStandardMaterial({color:'#654c3e',roughness:1});
    const tube=new THREE.Mesh(new THREE.CylinderGeometry(.95,.98,3.3,24,4,true),clay);
    tube.rotation.x=Math.PI/2;tube.position.set(-15,.94,7);
    tube.castShadow=tube.receiveShadow=true;this.addSolid(tube);
    for(const z of [5.35,8.65]){
      const rim=new THREE.Mesh(new THREE.TorusGeometry(.96,.13,8,24),darkClay);
      rim.position.set(-15,.94,z);rim.castShadow=true;this.addSolid(rim);
    }
    const chipped=new THREE.Mesh(new THREE.IcosahedronGeometry(.32,1),clay);
    chipped.position.set(-14.05,.16,8.8);chipped.scale.set(1.5,.45,.75);chipped.castShadow=true;this.addSolid(chipped);
  }

  private makeMushrooms() {
    const stem = new THREE.MeshStandardMaterial({ color: '#c9baa0', roughness: .93 });
    const cap = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: .82, side: THREE.DoubleSide, vertexColors:true });
    const gill = new THREE.MeshStandardMaterial({ color: '#efcfaa', roughness: .85, side: THREE.DoubleSide });
    for (const [x, z, s] of [[-4, 3, 1], [-3.1, 3.9, .66], [-13, -3, 1.35], [-5.3, -4.5, 1.26], [-6.2, -3.9, .72], [5, -5, .95], [15, 2, .75], [-2, 10, .88]]) {
      const y = this.height(x, z);
      const stalk = new THREE.Mesh(new THREE.CylinderGeometry(.12*s, .21*s, 1.25*s, 10), stem);
      stalk.position.set(x, y + .62*s, z); stalk.castShadow = true; this.addSolid(stalk);
      const domeGeometry=new THREE.SphereGeometry(.78*s, 20, 12, 0, Math.PI*2, 0, Math.PI*.55);
      const domeColors:number[]=[];const domePositions=domeGeometry.attributes.position;
      const rimColor=new THREE.Color('#77503d'),crownColor=new THREE.Color('#c89167');
      for(let k=0;k<domePositions.count;k++){
        const tint=THREE.MathUtils.smoothstep(domePositions.getY(k)/(.78*s),.08,.95);
        const color=rimColor.clone().lerp(crownColor,tint);
        domeColors.push(color.r,color.g,color.b);
      }
      domeGeometry.setAttribute('color',new THREE.Float32BufferAttribute(domeColors,3));
      const dome = new THREE.Mesh(domeGeometry, cap);
      dome.position.set(x, y + 1.18*s, z); dome.scale.y = .55; dome.castShadow = true; this.addSolid(dome);
      const underside = new THREE.Mesh(new THREE.CircleGeometry(.73*s, 20), gill);
      underside.rotation.x = Math.PI/2; underside.position.set(x, y+1.19*s, z); this.addSolid(underside);
      for(let k=0;k<16;k++){
        const theta=k*Math.PI/8;
        const spoke=cylinderBetween(new THREE.Vector3(x+Math.cos(theta)*.13*s,y+1.185*s,z+Math.sin(theta)*.13*s),new THREE.Vector3(x+Math.cos(theta)*.7*s,y+1.185*s,z+Math.sin(theta)*.7*s),.006*s,stem,4);
        spoke.castShadow=false;this.group.add(spoke);
      }
      for (let k=0;k<7;k++) {
        const spot = new THREE.Mesh(new THREE.SphereGeometry(.04*s, 6, 5), stem);
        const a = rand()*Math.PI*2, r = between(.18,.52)*s;
        spot.position.set(x+Math.cos(a)*r, y+1.18*s+(.35-.3*r/s)*s, z+Math.sin(a)*r); this.group.add(spot);
      }
    }
  }

  private makeFlowers() {
    const stems = new THREE.MeshStandardMaterial({ color: '#52683c', roughness: 1 });
    const petalMats = ['#e9d6bc', '#e2b895', '#d0b9d5', '#f1cf9b'].map(color => new THREE.MeshStandardMaterial({ color, roughness: .86, side: THREE.DoubleSide }));
    const center = new THREE.MeshStandardMaterial({ color: '#b88c43', roughness: .8, emissive: '#4a2608', emissiveIntensity: .13 });
    const leafMat = new THREE.MeshStandardMaterial({ map: texture('leaf'), color: '#93a76d', roughness: .95, side: THREE.DoubleSide });
    const locations = [[-1.1,-4.8,3.15],[-5.1,-6,3.5],[-1,-8,2.7],[3,-14,2.6],[8,5,2.5],[-14,8,3.3],[17,-9,2.7],[-5,13,2.4],[0,7,2.2],[-17,-13,2.8]];
    for (let i=0;i<locations.length;i++) {
      const [x,z,h] = locations[i]; const y=this.height(x,z);
      const a = new THREE.Vector3(x,y,z), b = new THREE.Vector3(x+between(-.2,.2),y+h,z+between(-.2,.2));
      const stalk = cylinderBetween(a,b,.085,stems,8); this.addSolid(stalk);
      const bloom = new THREE.Group(); bloom.position.copy(b); bloom.rotation.x = between(-.85,-.45);
      for (let j=0;j<8;j++) {
        const petal = new THREE.Mesh(new THREE.SphereGeometry(.47, 12, 8),petalMats[i%4]);
        const angle=j*Math.PI/4;
        petal.scale.set(.58,.12,1.22);
        petal.position.set(Math.cos(angle)*.42,.02,Math.sin(angle)*.42);
        petal.rotation.y=-angle;
        petal.castShadow=true; bloom.add(petal); this.anchors.push(petal);
      }
      const disk = new THREE.Mesh(new THREE.SphereGeometry(.35,16,8),center); disk.scale.y=.28; disk.position.y=.07; bloom.add(disk);
      this.group.add(bloom);
      for (let k=0;k<3;k++) {
        const leaf = new THREE.Mesh(new THREE.SphereGeometry(.37,9,6), leafMat);
        leaf.scale.set(.56,.08,1.5); leaf.position.set(x+Math.cos(k*2.4)*.34,y+h*(.25+k*.18),z+Math.sin(k*2.4)*.34); leaf.rotation.y=k*2.4; leaf.rotation.z=.4;
        this.group.add(leaf);
      }
    }
  }

  private makeGrass() {
    const blade = new THREE.BufferGeometry();
    blade.setAttribute('position',new THREE.Float32BufferAttribute([-.06,0,0,.06,0,0,-.05,.38,.05,.05,.38,.05,-.027,.77,.17,.027,.77,.17,0,1,.31],3));
    blade.setAttribute('color',new THREE.Float32BufferAttribute([.58,.73,.43,.58,.73,.43,.82,.89,.59,.82,.89,.59,1,.96,.7,1,.96,.7,1,.89,.65],3));
    blade.setIndex([0,1,2,1,3,2,2,3,4,3,5,4,4,5,6]);
    blade.computeVertexNormals();
    const material = new THREE.MeshStandardMaterial({color:'#ffffff',side:THREE.DoubleSide,roughness:1,vertexColors:true});
    material.onBeforeCompile = shader => {
      shader.uniforms.uWind = this.windUniform;
      shader.vertexShader = 'uniform float uWind;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
        #include <begin_vertex>
        float phase = instanceMatrix[3].x * 1.71 + instanceMatrix[3].z * 2.13;
        transformed.x += pow(position.y, 2.0) * (sin(uWind * 1.1 + phase) * 0.12 + sin(uWind * 0.47 + phase * 1.8) * 0.06);
      `);
    };
    const count=8500, mesh=new THREE.InstancedMesh(blade,material,count);
    const dummy=new THREE.Object3D(); const color=new THREE.Color();
    const palette=['#8da963','#a9b86b','#758f55','#b6ae67','#657e4f','#b5c17c'];
    for(let i=0;i<count;i++) {
      let x=0,z=0; let tries=0;
      do { x=between(-26,26); z=between(-25,23); tries++; } while(tries<10 && ((x-11)**2+(z-7)**2<18 || (x+9)**2+(z+8)**2<5 || x*x+(z-4)**2<18 || (x+3)**2+(z+2.5)**2<14));
      const h=between(.5,1.9)*(rand()<.05?1.6:1);
      dummy.position.set(x,this.height(x,z)-.05,z); dummy.rotation.set(0,rand()*6.28,0); dummy.scale.set(between(.7,1.4),h,1); dummy.updateMatrix();
      mesh.setMatrixAt(i,dummy.matrix); color.set(palette[Math.floor(rand()*palette.length)]); mesh.setColorAt(i,color);
    }
    mesh.instanceMatrix.needsUpdate=true; mesh.receiveShadow=true; mesh.frustumCulled=false; this.group.add(mesh); this.anchors.push(mesh);
  }

  private makeGroundCover(){
    const clover=new THREE.InstancedMesh(new THREE.SphereGeometry(.16,7,5),new THREE.MeshStandardMaterial({color:'#99b572',roughness:1,side:THREE.DoubleSide}),2200);
    const pebble=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.065,0),new THREE.MeshStandardMaterial({color:'#afa48a',roughness:1,flatShading:true}),950);
    const d=new THREE.Object3D(),c=new THREE.Color();
    for(let i=0;i<2200;i++){
      let x=between(-22,22),z=between(-22,20);
      if((x+3)**2+(z+2.5)**2<6){x+=3;z+=3;}
      d.position.set(x,this.height(x,z)+.055,z);d.rotation.set(between(-.17,.17),rand()*6.28,between(-.17,.17));
      d.scale.set(between(.5,1.6),.12,between(.7,1.8));d.updateMatrix();clover.setMatrixAt(i,d.matrix);
      c.set(['#536f42','#789252','#a3aa60','#6d8b4c'][Math.floor(rand()*4)]);clover.setColorAt(i,c);
    }
    for(let i=0;i<950;i++){
      const x=between(-22,22),z=between(-21,20);
      d.position.set(x,this.height(x,z)+.015,z);d.rotation.set(rand()*3,rand()*6,rand()*3);
      d.scale.set(between(.4,1.8),between(.25,.8),between(.4,1.7));d.updateMatrix();pebble.setMatrixAt(i,d.matrix);
    }
    clover.instanceMatrix.needsUpdate=true;pebble.instanceMatrix.needsUpdate=true;
    clover.frustumCulled=pebble.frustumCulled=false;clover.receiveShadow=true;
    this.group.add(clover,pebble);
  }

  private makeLeaves() {
    const leaf = new THREE.BufferGeometry(),vertices:number[]=[],uv:number[]=[],indices:number[]=[];
    for(let j=0;j<=8;j++){
      const t=j/8,w=Math.sin(t*Math.PI)*.34;
      for(const side of [-1,0,1]){vertices.push(side*w,Math.sin(t*Math.PI)*(.09-Math.abs(side)*.055),(t-.5)*1.1);uv.push((side+1)*.5,t);}
      if(j<8)for(let k=0;k<2;k++){const a=j*3+k;indices.push(a,a+3,a+1,a+1,a+3,a+4);}
    }
    leaf.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
    leaf.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));leaf.setIndex(indices);leaf.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({map:texture('leaf'),color:'#d6e1b5',roughness:.83,side:THREE.DoubleSide,alphaHash:true});
    mat.onBeforeCompile=shader=>{
      shader.uniforms.uWind=this.windUniform;
      shader.vertexShader='uniform float uWind; varying vec3 vLeafWorld;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
        transformed.x += sin(uWind*.8+instanceMatrix[3].x*.7+instanceMatrix[3].z)*.035*position.z;
        vLeafWorld=(modelMatrix*instanceMatrix*vec4(transformed,1.)).xyz;`);
      shader.fragmentShader='varying vec3 vLeafWorld;\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <alphahash_fragment>',`diffuseColor.a*=smoothstep(.65,1.6,distance(vLeafWorld,cameraPosition));\n#include <alphahash_fragment>`);
    };
    const mesh=new THREE.InstancedMesh(leaf,mat,650); const d=new THREE.Object3D(); const c=new THREE.Color();
    for(let i=0;i<650;i++) {
      const isCanopy=i<440; const angle=rand()*Math.PI*2; const r=isCanopy?between(2,10):between(4,22);
      let lx=(isCanopy?-9:0)+Math.cos(angle)*r;
      let lz=(isCanopy?-8:0)+Math.sin(angle)*r;
      if(!isCanopy&&(lx+3)**2+(lz+2.5)**2<42){lx+=Math.cos(angle)*7;lz+=Math.sin(angle)*7;}
      d.position.set(lx,isCanopy?between(9,19):this.height(lx,lz)+between(.03,.1),lz);
      d.rotation.set(rand()*.8,rand()*6.28,rand()*.7); d.scale.set(between(.45,1.1),1,between(.45,1.3)); d.updateMatrix(); mesh.setMatrixAt(i,d.matrix);
      c.set(['#748e4c','#93a356','#b0ab62','#c0a161','#566d42'][Math.floor(rand()*5)]); mesh.setColorAt(i,c);
    }
    mesh.instanceMatrix.needsUpdate=true; mesh.castShadow=true; mesh.receiveShadow=true; mesh.frustumCulled=false; this.group.add(mesh); this.anchors.push(mesh);
  }

  private makeMossAndDew() {
    const fiber=new THREE.ConeGeometry(.025,.18,4);
    const moss=new THREE.MeshStandardMaterial({color:'#829b59',roughness:1,side:THREE.DoubleSide});
    const fibers=new THREE.InstancedMesh(fiber,moss,1100);
    const d=new THREE.Object3D(),c=new THREE.Color();
    for(let i=0;i<1100;i++) {
      const angle=rand()*Math.PI*2;
      const aroundTree=i<750;
      const r=aroundTree?between(1.8,8):between(3,20);
      const x=(aroundTree?-9:0)+Math.cos(angle)*r;
      const z=(aroundTree?-8:0)+Math.sin(angle)*r;
      d.position.set(x,this.height(x,z)+.07,z);
      d.rotation.set(between(-.35,.35),rand()*6.28,between(-.35,.35));
      d.scale.set(between(.6,1.6),between(.7,2.6),between(.6,1.6));d.updateMatrix();fibers.setMatrixAt(i,d.matrix);
      c.set(['#6f9554','#99a965','#4b7742','#b2b776'][Math.floor(rand()*4)]);fibers.setColorAt(i,c);
    }
    fibers.instanceMatrix.needsUpdate=true;fibers.frustumCulled=false;this.group.add(fibers);
    const dewMat=new THREE.MeshPhysicalMaterial({color:'#d5ece6',metalness:.2,roughness:.09,transparent:true,opacity:.6,clearcoat:1});
    const drops=new THREE.InstancedMesh(new THREE.SphereGeometry(.055,8,6),dewMat,170);
    for(let i=0;i<170;i++){
      const x=between(-19,19),z=between(-17,17);
      d.position.set(x,this.height(x,z)+between(.1,.9),z);d.rotation.set(0,0,0);
      const s=between(.55,1.9);d.scale.set(s,s*.75,s);d.updateMatrix();drops.setMatrixAt(i,d.matrix);
    }
    drops.instanceMatrix.needsUpdate=true;drops.frustumCulled=false;this.group.add(drops);
  }

  private makeWater() {
    const geo=new THREE.CircleGeometry(3.7,64); geo.rotateX(-Math.PI/2);
    const material=new THREE.ShaderMaterial({
      uniforms:{uTime:this.waterTime},transparent:true,depthWrite:false,side:THREE.DoubleSide,
      vertexShader:`varying vec3 vPos; void main(){vPos=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader:`uniform float uTime; varying vec3 vPos; void main(){float r=length(vPos.xz); float wave=sin(r*13.-uTime*1.5)*.03+sin(vPos.x*9.+vPos.z*7.+uTime)*.025;float edge=smoothstep(3.7,2.6,r); vec3 base=mix(vec3(.17,.27,.25),vec3(.53,.68,.63),.5+.5*sin(vPos.x*1.4+vPos.z*.9)); float glint=pow(max(0.,sin((vPos.x+vPos.z)*18.+uTime*1.8)),22.)*.18; gl_FragColor=vec4(base+wave+glint,edge*.79);}`
    });
    this.water=new THREE.Mesh(geo,material); this.water.position.set(11,.035,7); this.group.add(this.water);
    const ring=new THREE.Mesh(new THREE.TorusGeometry(3.7,.12,6,64),new THREE.MeshStandardMaterial({color:'#726a50',roughness:1}));
    ring.rotation.x=Math.PI/2; ring.position.copy(this.water.position); this.group.add(ring);
  }

  private makeLantern(){
    const metal=new THREE.MeshStandardMaterial({color:'#374940',metalness:.58,roughness:.55});
    const rim=new THREE.MeshStandardMaterial({color:'#a88b54',metalness:.55,roughness:.56});
    const baseY=2.55,x=4,z=-11;
    for(const [y,radius,height] of [[baseY,.61,.18],[baseY+1.55,.62,.12]]){
      const cap=new THREE.Mesh(new THREE.CylinderGeometry(radius*.94,radius,height,32),metal);
      cap.position.set(x,y,z);cap.castShadow=cap.receiveShadow=true;this.addSolid(cap);
    }
    const roof=new THREE.Mesh(new THREE.ConeGeometry(.63,.36,32),metal);roof.position.set(x,baseY+1.78,z);roof.castShadow=true;this.addSolid(roof);
    for(let i=0;i<4;i++){
      const angle=Math.PI*.25+i*Math.PI*.5,dx=Math.cos(angle)*.42,dz=Math.sin(angle)*.42;
      this.addSolid(cylinderBetween(new THREE.Vector3(x+dx,baseY,z+dz),new THREE.Vector3(x+dx,baseY+1.6,z+dz),.038,rim,8));
    }
    const glass=new THREE.Mesh(new THREE.CylinderGeometry(.47,.47,1.35,24,1,true),new THREE.MeshPhysicalMaterial({color:'#d2c6a3',roughness:.18,metalness:.04,transparent:true,opacity:.19,side:THREE.DoubleSide,depthWrite:false}));
    glass.position.set(x,baseY+.77,z);this.group.add(glass);
    const wick=new THREE.Mesh(new THREE.CylinderGeometry(.18,.23,.18,16),rim);wick.position.set(x,baseY+.16,z);this.group.add(wick);
    const ember=new THREE.Mesh(new THREE.SphereGeometry(.065,12,8),new THREE.MeshBasicMaterial({color:'#ffe2a0'}));ember.position.set(x,baseY+.3,z);ember.scale.y=1.8;this.group.add(ember);
    const light=new THREE.PointLight('#ffc377',.6,4,2);light.position.copy(ember.position);this.group.add(light);
    const handle=new THREE.Mesh(new THREE.TorusGeometry(.36,.035,8,32,Math.PI),metal);handle.position.set(x,baseY+1.92,z);handle.castShadow=true;this.addSolid(handle);
  }

  private makeFerns(){
    const geo=new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.Float32BufferAttribute([0,0,-.48,-.12,.018,-.2,0,.055,0,.12,.018,-.2,-.14,.025,.18,0,.04,.25,.14,.025,.18,0,0,.48],3));
    geo.setAttribute('uv',new THREE.Float32BufferAttribute([.5,0,0,.25,.5,.5,1,.25,0,.65,.5,.75,1,.65,.5,1],2));
    geo.setIndex([0,1,2,0,2,3,1,4,2,2,4,5,2,5,6,2,6,3,4,7,5,5,7,6]);geo.computeVertexNormals();
    const mat=new THREE.MeshStandardMaterial({map:texture('leaf'),color:'#e9edca',roughness:.85,side:THREE.DoubleSide});
    mat.onBeforeCompile=shader=>{
      shader.uniforms.uWind=this.windUniform;shader.vertexShader='uniform float uWind;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
        transformed.y+=sin(uWind*.9+instanceMatrix[3].x+instanceMatrix[3].z)*.035*abs(position.z);`);
    };
    const count=72*24,ferns=new THREE.InstancedMesh(geo,mat,count),d=new THREE.Object3D(),color=new THREE.Color();
    for(let i=0;i<72;i++){
      const theta=i*2.399963,r=between(3,11);let x=-9+Math.cos(theta)*r,z=-8+Math.sin(theta)*r;
      if((x+3)**2+(z+2.5)**2<25){x=-9+(x+9)*.4;z=-8+(z+8)*.4;}
      const y=this.height(x,z);
      for(let j=0;j<24;j++){
        const frond=Math.floor(j/8),pair=Math.floor((j%8)/2),side=j%2===0?-1:1;
        const angle=theta+frond*Math.PI*2/3,length=.35+pair*.22,width=.45-pair*.065;
        d.position.set(x+Math.cos(angle)*length,y+.12+Math.sin(length*.9)*.42,z+Math.sin(angle)*length);
        d.rotation.set(-.12+pair*.11,angle+side*.63,.12*side);d.scale.set(width*1.5,1,.55+width);
        d.updateMatrix();ferns.setMatrixAt(i*24+j,d.matrix);color.set(['#a4bc7b','#c7d79a','#8faf72'][i%3]);ferns.setColorAt(i*24+j,color);
      }
    }
    ferns.instanceMatrix.needsUpdate=true;ferns.receiveShadow=true;ferns.computeBoundingSphere();this.group.add(ferns);
  }

  private makeMotes() {
    const n=180; this.motePositions=new Float32Array(n*3);
    for(let i=0;i<n;i++){this.motePositions[i*3]=between(-28,28);this.motePositions[i*3+1]=between(.4,14);this.motePositions[i*3+2]=between(-24,23);}
    const geo=new THREE.BufferGeometry(); geo.setAttribute('position',new THREE.BufferAttribute(this.motePositions,3));
    const mat=new THREE.PointsMaterial({color:'#ffe3a2',size:.08,transparent:true,opacity:.6,sizeAttenuation:true,depthWrite:false,blending:THREE.AdditiveBlending});
    this.motes=new THREE.Points(geo,mat); this.group.add(this.motes);
  }

  update(t: number, dt: number, focus?:THREE.Vector3) {
    this.windUniform.value=t;
    this.waterTime.value=t;
    if(focus){
      const x=Math.round(focus.x/4)*4,z=Math.round(focus.z/4)*4;
      this.sun.target.position.set(x,0,z);this.sun.position.set(x-15,25,z-14);
    }
    const p=this.motePositions;
    for(let i=0;i<p.length;i+=3){p[i]+=.05*dt;p[i+1]+=(.03+Math.sin(t*.7+i)*.015)*dt;if(p[i]>28)p[i]=-28;if(p[i+1]>14)p[i+1]=.4;}
    this.motes.geometry.attributes.position.needsUpdate=true;
  }
}
