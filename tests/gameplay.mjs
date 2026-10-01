import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import * as THREE from 'three';

// Use the installed TypeScript compiler; no extra runner or browser dependency.
const output = fs.mkdtempSync(path.resolve('.test-build-'));
function compile(dir) {
  for (const entry of fs.readdirSync(dir, {withFileTypes:true})) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) compile(file);
    else if (file.endsWith('.ts')) {
      const compiled = ts.transpileModule(fs.readFileSync(file,'utf8'), {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText
        .replace(/(from\s+['"])(\.[^'"]+)(['"])/g, (_,a,b,c) => a+b.replace(/\.ts$/, '').replace(/(?<!\.js)$/,'.js')+c);
      const target = path.join(output,file.replace(/\.ts$/,'.js'));
      fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,compiled);
    }
  }
}
compile('src');
process.on('exit',()=>fs.rmSync(output,{recursive:true,force:true}));
const {SilkLauncher,SILK_RANGE} = await import(path.join(output,'src/web/SilkLauncher.js'));
const {WebManager} = await import(path.join(output,'src/web/WebManager.js'));
const {SpiderCamera} = await import(path.join(output,'src/camera/SpiderCamera.js'));
const {SpiderController} = await import(path.join(output,'src/player/SpiderController.js'));
const {Spider} = await import(path.join(output,'src/player/Spider.js'));
const {surfaceNormal} = await import(path.join(output,'src/player/SurfaceMath.js'));
const {installTerrainRaycast} = await import(path.join(output,'src/world/Terrain.js'));
const {Exploration} = await import(path.join(output,'src/world/Exploration.js'));
const v=(x,y,z)=>new THREE.Vector3(x,y,z);
function box(scene,x,y,z,w=2,h=2,d=.3){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshBasicMaterial());m.position.set(x,y,z);scene.add(m);m.geometry.computeBoundingBox();scene.updateMatrixWorld(true);return m;}
function launcherFixture(){const scene=new THREE.Scene(),surfaces=[],web=new WebManager(scene),origin=v(0,1,0),launcher=new SilkLauncher(scene,surfaces,web,()=>origin.clone());return {scene,surfaces,web,origin,launcher};}
function finish(launcher){for(let i=0;i<40&&launcher.flying;i++)launcher.update(.025);}

test('silk travels before attachment and hits the first physical obstruction',()=>{
  const f=launcherFixture();f.surfaces.push(box(f.scene,0,1,-2),box(f.scene,0,1,-6));
  f.launcher.shoot(v(0,1,-6));assert.equal(f.launcher.pending,undefined);
  f.launcher.update(.02);assert.equal(f.launcher.pending,undefined);
  finish(f.launcher);assert.ok(f.launcher.pending.position.z>-2);assert.ok(f.launcher.pending.position.z<-1.7);
});
test('silk has a real maximum range and a miss creates no graph nodes',()=>{
  const f=launcherFixture();f.surfaces.push(box(f.scene,0,1,-SILK_RANGE-4));
  f.launcher.shoot(v(0,1,-20));finish(f.launcher);
  assert.equal(f.launcher.pending,undefined);assert.equal(f.web.nodes.size,0);
});
test('two landed shots form a strand through open space',()=>{
  const f=launcherFixture();f.origin.set(0,2,3);f.surfaces.push(box(f.scene,-3,2,-5),box(f.scene,3,2,-5));
  f.launcher.shoot(v(-3,2,-5));finish(f.launcher);assert.ok(f.launcher.pending);
  f.launcher.shoot(v(3,2,-5));finish(f.launcher);
  assert.equal(f.web.strands.size,1);assert.equal(f.launcher.pending,undefined);assert.equal(f.web.nodes.size,2);
});
test('a web span cannot pass through a third object',()=>{
  const f=launcherFixture();f.origin.set(0,2,3);f.surfaces.push(box(f.scene,-3,2,-5),box(f.scene,3,2,-5),box(f.scene,0,2,-5,1.2,2,1.8));
  f.launcher.shoot(v(-3,2,-5));finish(f.launcher);f.launcher.shoot(v(3,2,-5));finish(f.launcher);
  assert.equal(f.web.strands.size,0);assert.ok(f.launcher.pending);
});
test('sagged silk picking and traversal use the same curve',()=>{
  const web=new WebManager(new THREE.Scene());web.add(v(-5,3,0),v(5,3,0));
  const strand=[...web.strands.values()][0],point=web.sample(strand,.5);
  assert.ok(point.y<2.7);const nearest=web.getNearestPoint(point,.01);
  assert.ok(nearest);assert.ok(Math.abs(nearest.t-.5)<.001);
  assert.equal(web.aimStrand(point.clone().add(v(0,0,2)),v(0,0,-1))?.id,strand.id);
});
test('a junction chooses the outgoing strand aligned with the player view',()=>{
  const web=new WebManager(new THREE.Scene());web.add(v(-2,2,0),v(0,2,0));web.add(v(0,2,0),v(0,2,3));web.add(v(0,2,0),v(3,2,0));
  const first=web.strands.get(1);assert.equal(web.nextAt(first.b,first.id,v(1,0,0)).id,3);
  assert.equal(web.nextAt(first.b,first.id,v(0,0,1)).id,2);
  const nodes=web.nodes.size;assert.equal(web.add(v(-2,2,0),v(0,2,0)),false);assert.equal(web.nodes.size,nodes);
});
test('terrain grid traversal agrees with Three.js triangle raycasting',()=>{
  const geo=new THREE.PlaneGeometry(20,20,20,20);geo.rotateX(-Math.PI/2);
  const p=geo.attributes.position;for(let i=0;i<p.count;i++)p.setY(i,Math.sin(p.getX(i)*.3)*Math.cos(p.getZ(i)*.4)*.3);
  geo.computeVertexNormals();geo.computeBoundingBox();const mesh=new THREE.Mesh(geo,new THREE.MeshBasicMaterial());mesh.updateMatrixWorld(true);
  const native=mesh.raycast.bind(mesh);installTerrainRaycast(mesh,20,20);
  for(let i=0;i<180;i++){
    const caster=new THREE.Raycaster(v(Math.sin(i*1.7)*14,1+i%5,Math.cos(i*.91)*14),v(Math.cos(i*.3)*.5,-1,Math.sin(i*.4)*.5).normalize(),0,35);
    const expected=[];native(caster,expected);expected.sort((a,b)=>a.distance-b.distance);
    const actual=caster.intersectObject(mesh);
    assert.equal(!!actual.length,!!expected.length,`ray ${i}`);
    if(actual.length)assert.ok(Math.abs(actual[0].distance-expected[0].distance)<.00001,`ray ${i}`);
  }
});
test('interpolated cylinder normals remain smooth across a geometry seam',()=>{
  const cylinder=new THREE.Mesh(new THREE.CylinderGeometry(1,1,5,12),new THREE.MeshBasicMaterial());cylinder.updateMatrixWorld(true);
  const normals=[-.015,.015].map(z=>surfaceNormal(new THREE.Raycaster(v(3,0,z),v(-1,0,0)).intersectObject(cylinder)[0],v(-1,0,0)));
  assert.ok(normals[0].dot(normals[1])>.999);
});
function movementFixture(){
  const scene=new THREE.Scene(),floor=new THREE.Mesh(new THREE.PlaneGeometry(40,40),new THREE.MeshBasicMaterial());floor.rotation.x=-Math.PI/2;scene.add(floor);
  const surfaces=[floor,box(scene,0,1.5,0,.5,3,.5),box(scene,1.5,3.13,0,4,.28,4)];scene.updateMatrixWorld(true);
  const keys=new Set(['KeyW']),input={pressed:(...codes)=>codes.some(c=>keys.has(c))};
  const camera=new SpiderCamera(surfaces,16/9),spider=new Spider(scene),controller=new SpiderController(spider,camera,input,surfaces);
  controller.position.set(1.2,.245,0);controller.heading.set(-1,0,0);camera.heading.set(-1,0,0);
  return {controller,camera,keys};
}
test('ground, wall and underside traversal stay attached after input stops',()=>{
  const f=movementFixture();let wall=false,ceiling=false;
  for(let i=0;i<600;i++){
    f.controller.update(1/120,i/120);f.camera.update(f.controller.position,f.controller.normal,1/120);
    wall ||= Math.abs(f.controller.normal.y)<.1;
    if(f.controller.normal.y<-.9){ceiling=true;break;}
  }
  assert.ok(wall,'wall reached');assert.ok(ceiling,'ceiling reached');f.keys.clear();
  for(let i=0;i<60;i++){f.controller.update(1/120,6+i/120);f.camera.update(f.controller.position,f.controller.normal,1/120);}
  assert.ok(f.controller.normal.y<-.9,JSON.stringify({position:f.controller.position.toArray(),normal:f.controller.normal.toArray(),air:f.controller.airborne}));assert.equal(f.controller.airborne,false);assert.ok(f.controller.position.y>2.5);
});
test('camera stays finite through wall and ceiling rotations, and allows looking up',()=>{
  const camera=new SpiderCamera([],16/9);camera.look(0,-450);
  let before;
  for(let i=0;i<=100;i++){
    const normal=v(Math.sin(i*Math.PI/100),Math.cos(i*Math.PI/100),0);
    camera.update(v(0,4,0),normal,1/60);
    assert.ok(camera.camera.position.toArray().every(Number.isFinite));
    assert.ok(Math.abs(camera.camera.quaternion.length()-1)<.001);
    if(before)assert.ok(before.distanceTo(camera.camera.position)<.7);
    before=camera.camera.position.clone();
  }
  const direction=camera.camera.getWorldDirection(v(0,0,0));assert.ok(direction.dot(camera.normal)>.7);
});
test('discoveries require visiting the habitat and preserve only known IDs',()=>{
  const exploration=new Exploration();exploration.update(v(-9,0,-8));assert.equal(exploration.discovered.size,0);
  exploration.update(v(-7,3,-8));assert.ok(exploration.discovered.has('roots'));
  exploration.restore(['pool','bad-id']);assert.equal(exploration.discovered.size,2);
});
test('a corrupt web save is rejected without leaving a partial graph',()=>{
  const web=new WebManager(new THREE.Scene());
  web.restore({nodes:[{id:1,position:[0,1,0]},{id:2,position:[2,1,0]}],strands:[{id:1,a:1,b:99}]});
  assert.equal(web.nodes.size,0);assert.equal(web.strands.size,0);assert.ok(web.add(v(0,1,0),v(2,1,0)));
});
test('surface orientation survives a save and reload',()=>{
  const f=movementFixture();f.controller.restore([.495,2,0],[1,0,0],[0,1,0]);
  assert.equal(f.controller.normal.x,1);assert.equal(f.controller.heading.y,1);
  const g=movementFixture();g.controller.restore([.495,2,0]);assert.ok(g.controller.normal.x>.99);
});
test('an idle spider does not slide across a smooth sloping surface',()=>{
  const scene=new THREE.Scene(),floor=new THREE.Mesh(new THREE.PlaneGeometry(20,20,20,20),new THREE.MeshBasicMaterial());floor.geometry.rotateX(-Math.PI/2);
  const p=floor.geometry.attributes.position;for(let i=0;i<p.count;i++)p.setY(i,Math.sin(p.getX(i)*.4)*.2);floor.geometry.computeVertexNormals();scene.add(floor);scene.updateMatrixWorld(true);
  const camera=new SpiderCamera([floor],1),controller=new SpiderController(new Spider(scene),camera,{pressed:()=>false},[floor]);controller.position.set(-3,.5,0);
  for(let i=0;i<180;i++)controller.update(1/120,i/120);const settled=controller.position.clone();
  for(let i=0;i<2400;i++)controller.update(1/120,2+i/120);
  assert.ok(controller.position.distanceTo(settled)<.02,`idle drift: ${controller.position.distanceTo(settled)}`);
});
test('a camera initialized from a wall save keeps a valid tangent frame',()=>{
  const camera=new SpiderCamera([],1);camera.heading.set(0,1,0);camera.update(v(2,3,0),v(1,0,0),1/60);
  assert.ok(camera.camera.position.toArray().every(Number.isFinite));
  assert.ok(camera.forward(v(1,0,0)).dot(v(0,1,0))>.99);
});

test('physical shots join two strand interiors into a connected web',()=>{
  const f=launcherFixture();f.origin.set(0,2,3);
  f.web.add(v(-4,3,-5),v(4,3,-5));f.web.add(v(4,3,-5),v(4,3,-1));
  const first=f.web.strands.get(1),second=f.web.strands.get(2);
  f.launcher.shoot(f.web.sample(first,.5));f.launcher.update(.02);
  assert.equal(f.launcher.pending,undefined);finish(f.launcher);
  assert.equal(f.launcher.pending.strandId,1);
  f.launcher.shoot(f.web.sample(second,.5));finish(f.launcher);
  assert.equal(f.launcher.pending,undefined);assert.equal(f.web.strands.size,5);
  assert.equal([...f.web.nodes.values()].filter(n=>n.strands.size===3).length,2);
  assert.equal(f.web.components().length,1);
  const bridge=[...f.web.strands.values()].at(-1);f.web.disturb(bridge.id,1);
  for(const strand of f.web.strands.values())assert.ok(strand.energy>.1);
});
test('splitting silk preserves its exact sag curve and riders',()=>{
  const scene=new THREE.Scene(),web=new WebManager(scene);
  web.add(v(-5,4,0),v(5,4,0));const original=web.strands.get(1);
  const points=Array.from({length:21},(_,i)=>web.sample(original,i/20));
  const camera=new SpiderCamera([],16/9),controller=new SpiderController(new Spider(scene),camera,{pressed:()=>false},[]);
  controller.ride(...web.getEndpoints(original),.75,original.id,1,original.tension,original.sag);controller.update(1/120,0);
  const before=controller.position.clone();let replacements;
  web.onSplit=(id,parts)=>{replacements=parts;controller.remapStrand(id,parts,s=>web.getEndpoints(s));};
  assert.ok(web.connect({position:web.sample(original,.4),strandId:original.id,t:.4},{position:v(-1,7,3)}));
  for(let i=0;i<points.length;i++){
    const t=i/20,part=replacements.find(p=>t<=p.to)??replacements.at(-1);
    assert.ok(web.sample(part.strand,(t-part.from)/(part.to-part.from)).distanceTo(points[i])<1e-8);
  }
  controller.update(1/120,0);assert.ok(controller.isRiding());assert.ok(controller.position.distanceTo(before)<1e-8);
  const save=web.serialize(),loaded=new WebManager(new THREE.Scene());loaded.restore(save);
  assert.equal(loaded.components().length,1);
  for(const s of web.strands.values())assert.ok(web.sample(s,.5).distanceTo(loaded.sample(loaded.strands.get(s.id),.5))<1e-8);
});
test('a solid obstruction shields silk and cut pending silk cannot become a floating anchor',()=>{
  const f=launcherFixture();f.web.add(v(-3,1,-6),v(3,1,-6));
  f.surfaces.push(box(f.scene,0,1,-2));f.launcher.shoot(f.web.sample(f.web.strands.get(1),.5));finish(f.launcher);
  assert.equal(f.launcher.pending.strandId,undefined);assert.ok(f.launcher.pending.position.z>-2.1);
  f.launcher.cancel();f.surfaces.length=0;f.launcher.shoot(f.web.sample(f.web.strands.get(1),.5));finish(f.launcher);
  assert.equal(f.launcher.pending.strandId,1);f.web.remove(1);f.launcher.update(.01);assert.equal(f.launcher.pending,undefined);
});

test('an existing crossing node joins the targeted strand without leaving disconnected silk',()=>{
  const web=new WebManager(new THREE.Scene());web.add(v(-3,3,0),v(3,3,0));
  const s=web.strands.get(1),point=web.sample(s,.5);web.add(point,v(0,6,3));
  assert.equal(web.components().length,2);
  assert.ok(web.connect({position:point,strandId:s.id,t:.5},{position:v(2,6,-3)}));
  assert.equal(web.components().length,1);assert.equal([...web.nodes.values()].find(n=>n.position.distanceTo(point)<.001).strands.size,4);
});
test('capacity rejection does not split or damage the existing web',()=>{
  const web=new WebManager(new THREE.Scene());for(let i=0;i<240;i++)web.add(v(0,2,i*.4),v(4,2,i*.4));
  const before=JSON.stringify(web.serialize()),s=web.strands.get(1);
  assert.equal(web.connect({position:web.sample(s,.5),strandId:s.id,t:.5},{position:v(2,5,-2)}),false);
  assert.equal(JSON.stringify(web.serialize()),before);
});
test('expanded terrain supports exploration and saves beyond the old garden limits',async()=>{
  const {TERRAIN_SIZE,gardenHeight,OUTER_HABITATS}=await import(path.join(output,'src/world/WorldLayout.js'));
  const geometry=new THREE.PlaneGeometry(TERRAIN_SIZE,TERRAIN_SIZE,TERRAIN_SIZE,TERRAIN_SIZE);geometry.rotateX(-Math.PI/2);
  const p=geometry.attributes.position;for(let i=0;i<p.count;i++)p.setY(i,gardenHeight(p.getX(i),p.getZ(i)));geometry.computeVertexNormals();
  const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial());mesh.updateMatrixWorld(true);installTerrainRaycast(mesh,TERRAIN_SIZE,TERRAIN_SIZE);
  const camera=new SpiderCamera([mesh],16/9),keys=new Set(),controller=new SpiderController(new Spider(new THREE.Scene()),camera,{pressed:(...codes)=>codes.some(c=>keys.has(c))},[mesh]);
  controller.restore([70,gardenHeight(70,60)+.245,60],[0,1,0],[1,0,0]);assert.equal(controller.position.x,70);
  camera.heading.set(1,0,0);keys.add('KeyW');
  for(let i=0;i<240;i++){controller.update(1/120,i/120);camera.update(controller.position,controller.normal,1/120);}
  assert.ok(controller.position.x>73);assert.equal(controller.airborne,false);
  const exploration=new Exploration();for(const habitat of OUTER_HABITATS)exploration.update(v(habitat.x,gardenHeight(habitat.x,habitat.z)+.25,habitat.z));
  assert.equal(exploration.discovered.size,9);assert.equal(exploration.total,15);
});

test('caught insects remain on split strands and outer insects stay in their habitat',async()=>{
  const {InsectManager}=await import(path.join(output,'src/creatures/InsectManager.js'));
  const scene=new THREE.Scene(),web=new WebManager(scene),manager=new InsectManager(scene,web);
  web.add(v(-4,3,0),v(4,3,0));const s=web.strands.get(1),fly=manager.insects[0];
  fly.caught={strand:s.id,time:2,point:web.sample(s,.7)};web.onSplit=(id,parts)=>manager.remapStrand(id,parts);
  assert.ok(web.connect({position:web.sample(s,.4),strandId:s.id,t:.4},{position:v(0,6,3)}));
  assert.notEqual(fly.caught.strand,s.id);assert.ok(web.strands.has(fly.caught.strand));manager.update(0,.01);assert.ok(fly.caught);
  const outer=manager.insects[18],home=outer.home.clone();outer.caught={strand:fly.caught.strand,time:0,point:outer.position.clone()};
  assert.ok(manager.collectNear(outer.position));assert.ok(outer.position.distanceTo(home)<17);
});

const {WebInteraction}=await import(path.join(output,'src/web/WebInteraction.js'));
test('nearby silk can be selected without aiming, prioritizes ridden silk and never cuts through wood',()=>{
  const scene=new THREE.Scene(),web=new WebManager(scene),surfaces=[],interaction=new WebInteraction(web,surfaces);
  web.add(v(-2,1,0),v(2,1,0));web.add(v(-2,1,.7),v(2,1,.7));
  const eye=v(0,1.2,1),away=new THREE.Ray(v(0,2,4),v(0,1,0));
  assert.equal(interaction.cutTarget(eye,undefined,away).strand.id,2);
  assert.equal(interaction.cutTarget(eye,1,away).strand.id,1);
  surfaces.push(box(scene,0,1,.85,6,4,.15));assert.equal(interaction.cutTarget(eye,undefined,away),undefined);
  surfaces.length=0;const selected=interaction.cutTarget(eye,undefined,away);web.remove(selected.strand.id);
  const restored=new WebManager(new THREE.Scene());restored.restore(web.serialize());assert.equal(restored.strands.size,1);assert.ok(!restored.strands.has(selected.strand.id));
  for(const node of restored.nodes.values())for(const id of node.strands)assert.ok(restored.strands.has(id));
});
function pullFixture(surfaces=[]){
  const scene=new THREE.Scene(),camera=new SpiderCamera(surfaces,1),controller=new SpiderController(new Spider(scene),camera,{pressed:()=>false},surfaces);
  controller.position.set(0,1,0);return {scene,camera,controller};
}
function runPull(controller,seconds=3){for(let i=0;i<120*seconds;i++)controller.update(1/120,i/120);}
test('pull accelerates gradually, stops at a wall and remains attached with a valid orientation',()=>{
  const scene=new THREE.Scene(),wall=box(scene,0,2,-6,8,8,.3),f=pullFixture([wall]);let reason;
  f.controller.onPullEnd=r=>reason=r;
  const target={position:v(0,2,-5.605),normal:v(0,0,1)};
  assert.equal(f.controller.startPull(()=>target),true);f.controller.update(1/120,0);
  assert.ok(f.controller.position.distanceTo(v(0,1,0))<.005);assert.ok(f.controller.isPulling());
  runPull(f.controller);assert.equal(reason,'arrived');assert.equal(f.controller.isPulling(),false);assert.equal(f.controller.airborne,false);
  assert.ok(f.controller.position.z>-5.7);assert.ok(f.controller.normal.z>.99);
});
test('pull reaches a ceiling and stays on its underside',()=>{
  const scene=new THREE.Scene(),ceiling=box(scene,0,5,0,10,.3,10),f=pullFixture([ceiling]);
  f.controller.startPull(()=>({position:v(0,4.605,0),normal:v(0,-1,0)}));runPull(f.controller);
  assert.equal(f.controller.airborne,false);assert.ok(f.controller.normal.y<-.99);assert.ok(Math.abs(f.controller.position.y-4.605)<.02);
});
test('pull cannot pass through an intervening obstruction',()=>{
  const scene=new THREE.Scene(),obstacle=box(scene,0,2,-2,8,8,.3),f=pullFixture([obstacle]);let reason;
  f.controller.onPullEnd=r=>reason=r;f.controller.startPull(()=>({position:v(0,2,-6),normal:v(0,0,1)}));runPull(f.controller);
  assert.equal(reason,'blocked');assert.ok(f.controller.position.z>-1.7);assert.equal(f.controller.airborne,false);
});
test('a missing anchor releases pull, and Space interrupts it with an actual leap',()=>{
  const f=pullFixture();let target={position:v(0,6,0)},reason;f.controller.onPullEnd=r=>reason=r;
  f.controller.startPull(()=>target);runPull(f.controller,.2);target=undefined;f.controller.update(1/120,1);assert.equal(reason,'lost');assert.equal(f.controller.isPulling(),false);
  f.controller.startPull(()=>({position:v(0,6,0)}));const before=f.controller.position.clone();f.controller.jump();f.controller.update(1/120,2);
  assert.equal(f.controller.isPulling(),false);assert.ok(f.controller.position.y>before.y);assert.equal(f.controller.airborne,true);
});
test('pull retains the fired anchor so a second physical shot can still build a strand',()=>{
  const f=launcherFixture();f.surfaces.push(box(f.scene,0,2,-5,4,4,.3),box(f.scene,4,2,-3,2,4,.3));
  f.launcher.shoot(v(0,2,-5));finish(f.launcher);const anchor=f.launcher.pending;
  const player=pullFixture(f.surfaces);player.controller.position.copy(f.origin);
  player.controller.startPull(()=>({position:anchor.position.clone().addScaledVector(anchor.normal,.18),normal:anchor.normal}));runPull(player.controller);
  assert.equal(f.launcher.pending,anchor);f.origin.copy(player.controller.position);
  f.launcher.shoot(v(4,2,-3));finish(f.launcher);assert.equal(f.web.strands.size,1);assert.equal(f.launcher.pending,undefined);
});
test('pull can arrive on existing silk, then cutting underfoot detaches the spider and preserves other paths',()=>{
  const f=launcherFixture();f.web.add(v(-3,4,-4),v(3,4,-4));f.web.add(v(3,4,-4),v(5,5,-2));
  const strand=f.web.strands.get(1);f.launcher.shoot(f.web.sample(strand,.5));finish(f.launcher);const anchor=f.launcher.pending;
  const player=pullFixture();player.controller.position.copy(f.origin);
  player.controller.onPullEnd=reason=>{if(reason==='arrived'){const [a,b]=f.web.getEndpoints(strand);player.controller.ride(a,b,anchor.t,strand.id,1,strand.tension,strand.sag);}};
  player.controller.startPull(()=>{const position=f.web.anchorPosition(anchor);return position?{position:position.add(v(0,.245,0))}:undefined;});runPull(player.controller);
  assert.equal(player.controller.isRiding(),true);assert.equal(f.launcher.pending,anchor);
  player.controller.detachRemovedStrand(strand.id);f.web.remove(strand.id);f.launcher.update(.01);
  assert.equal(player.controller.isRiding(),false);assert.equal(player.controller.airborne,true);assert.equal(f.launcher.pending,undefined);
  assert.equal(f.web.strands.size,1);assert.equal(f.web.nodes.size,2);assert.equal(f.web.components().length,1);
});
test('an obstructed climbing orbit moves to the open face instead of into the spider',()=>{
  const scene=new THREE.Scene(),wall=box(scene,0,0,0,12,12,.3),camera=new SpiderCamera([wall],1);
  camera.heading.set(0,1,0);camera.look(0,-420);const position=v(0,0,.395),normal=v(0,0,1);
  for(let i=0;i<120;i++)camera.update(position,normal,1/120);
  assert.ok(camera.camera.position.z>.4);assert.ok(camera.camera.position.distanceTo(position)>1.2);
});

const {SPECIES}=await import(path.join(output,'src/creatures/Species.js'));
const {assessNet}=await import(path.join(output,'src/web/NetAssessment.js'));
function netGrid(web,center=v(0,2,0),columns=3,rows=3,spacing=.65){
  const at=(x,z)=>center.clone().add(v((x-(columns-1)/2)*spacing,0,(z-(rows-1)/2)*spacing));
  for(let x=0;x<columns;x++)for(let z=0;z<rows;z++){
    if(x+1<columns)web.add(at(x,z),at(x+1,z));
    if(z+1<rows)web.add(at(x,z),at(x,z+1));
  }
}
test('one thread catches a fly but every larger species requires an actual net',()=>{
  const web=new WebManager(new THREE.Scene());web.add(v(-2,2,0),v(2,2,0));const point=web.sample(web.strands.get(1),.5);
  assert.equal(assessNet(web,point,SPECIES.fly).caught,true);
  for(const species of Object.values(SPECIES).filter(s=>s.id!=='fly'))assert.equal(assessNet(web,point,species).caught,false,species.id);
});
test('unjoined crossing strands and a long subdivided thread cannot pretend to be a strong net',()=>{
  const web=new WebManager(new THREE.Scene());
  for(let i=0;i<15;i++)web.add(v(-2,2+i*.025,-.3+i*.035),v(2,2+i*.025,.3-i*.035));
  const result=assessNet(web,v(0,2.2,0),SPECIES.mouse);assert.ok(result.threads<12);assert.equal(result.caught,false);
  const chain=new WebManager(new THREE.Scene());for(let i=0;i<15;i++)chain.add(v(-2.325+i*.31,2,0),v(-2.015+i*.31,2,0));
  const linked=assessNet(chain,v(0,2,0),SPECIES.mouse);assert.ok(linked.threads>=12);assert.equal(linked.loops,0);assert.equal(linked.caught,false);
});
test('dense connected local nets catch larger wildlife, while smaller nets do not hold a mouse',()=>{
  const medium=new WebManager(new THREE.Scene());netGrid(medium,v(0,2,0),3,2);
  assert.equal(assessNet(medium,v(0,2,.1),SPECIES.beetle).caught,true);
  assert.equal(assessNet(medium,v(0,2,0),SPECIES.frog).caught,false);
  assert.equal(assessNet(medium,v(0,2,0),SPECIES.mouse).caught,false);
  const dense=new WebManager(new THREE.Scene());netGrid(dense);
  for(const species of [SPECIES.snail,SPECIES.frog,SPECIES.mouse]){
    const result=assessNet(dense,v(0,2,0),species);assert.equal(result.caught,true,species.id);assert.ok(result.loops>=species.loops);assert.ok(result.contacts>=species.contacts);
  }
});
test('remote silk does not strengthen a nearby weak strand',()=>{
  const web=new WebManager(new THREE.Scene());web.add(v(-2,2,0),v(2,2,0));
  web.add(v(2,2,0),v(2,2,10));netGrid(web,v(2,2,10),5,5);
  const result=assessNet(web,v(0,2,0),SPECIES.mouse);assert.equal(result.caught,false);assert.ok(result.threads<12);
});
test('animals are physically caught by a net and released when its support is cut',async()=>{
  const {InsectManager}=await import(path.join(output,'src/creatures/InsectManager.js'));
  const {gardenHeight}=await import(path.join(output,'src/world/WorldLayout.js'));
  const scene=new THREE.Scene(),web=new WebManager(scene),manager=new InsectManager(scene,web),mouse=manager.insects.find(c=>c.species.id==='mouse');
  const center=v(0,gardenHeight(0,0)+SPECIES.mouse.lift,0);netGrid(web,center);
  mouse.position.copy(center);mouse.group.position.copy(center);mouse.target.copy(center).add(v(0,0,2));mouse.velocity.set(0,0,0);mouse.rest=0;mouse.cooldown=0;mouse.contactClock=0;
  manager.update(0,1/60);assert.ok(mouse.caught);assert.equal(mouse.bindings.visible,true);
  const id=[...web.strands.keys()].find(s=>s!==mouse.caught.strand);web.remove(id);
  for(let i=0;i<20;i++)manager.update(i/60,1/60);assert.equal(mouse.caught,undefined);assert.ok(mouse.cooldown>0);
});
test('a large creature slips past a weak thread, making it vibrate without being immobilized',async()=>{
  const {InsectManager}=await import(path.join(output,'src/creatures/InsectManager.js'));
  const scene=new THREE.Scene(),web=new WebManager(scene),manager=new InsectManager(scene,web),mouse=manager.insects.find(c=>c.species.id==='mouse');
  web.add(v(-2,.7,0),v(2,.7,0));mouse.position.set(0,.68,0);mouse.target.set(0,.68,4);mouse.velocity.set(0,0,1);mouse.rest=0;mouse.cooldown=0;mouse.contactClock=0;
  let escaped=false;manager.onEscape=c=>{if(c===mouse)escaped=true;};manager.update(0,1/60);
  assert.equal(mouse.caught,undefined);assert.equal(escaped,true);assert.ok(web.strands.get(1).energy>.5);
  const before=mouse.position.clone();for(let i=0;i<20;i++)manager.update(i/60,1/60);assert.ok(mouse.position.distanceTo(before)>.1);
});
test('the enlarged field retains old terrain and supports new player and silk save positions',async()=>{
  const {TERRAIN_SIZE,FIELD_EXTENT,gardenHeight}=await import(path.join(output,'src/world/WorldLayout.js'));
  assert.equal(TERRAIN_SIZE,320);assert.equal(FIELD_EXTENT,145);
  const controller=pullFixture().controller;controller.restore([137,gardenHeight(137,-121)+.245,-121],[0,1,0],[1,0,0]);assert.equal(controller.position.x,137);
  const web=new WebManager(new THREE.Scene());web.add(v(131,2,-123),v(135,3,-120));const restored=new WebManager(new THREE.Scene());restored.restore(web.serialize());assert.equal(restored.strands.size,1);
  const data=restored.serialize();data.nodes[0].position=[161,2,0];const rejected=new WebManager(new THREE.Scene());rejected.restore(data);assert.equal(rejected.nodes.size,0);
});
test('leaping in the low wetland does not trigger the old below-zero respawn',async()=>{
  const {gardenHeight}=await import(path.join(output,'src/world/WorldLayout.js'));
  const x=81,z=78,geometry=new THREE.PlaneGeometry(24,24,24,24);geometry.rotateX(-Math.PI/2);
  const p=geometry.attributes.position;for(let i=0;i<p.count;i++){const px=p.getX(i)+x,pz=p.getZ(i)+z;p.setXYZ(i,px,gardenHeight(px,pz),pz);}geometry.computeVertexNormals();
  const floor=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial());floor.updateMatrixWorld(true);
  const scene=new THREE.Scene(),camera=new SpiderCamera([floor],1),controller=new SpiderController(new Spider(scene),camera,{pressed:()=>false},[floor]);
  controller.restore([x,gardenHeight(x,z)+.245,z],[0,1,0],[1,0,0]);assert.ok(controller.position.y<-2);
  controller.jump();for(let i=0;i<120;i++)controller.update(1/120,i/120);
  assert.ok(controller.position.x>78);assert.ok(controller.position.z>75);assert.equal(controller.airborne,false);
});
test('the real far hollow has usable interior silk anchors and supports ceiling traversal',async()=>{
  const {FarGarden}=await import(path.join(output,'src/world/FarGarden.js'));
  const {gardenHeight}=await import(path.join(output,'src/world/WorldLayout.js'));
  const scene=new THREE.Scene(),group=new THREE.Group(),surfaces=[];scene.add(group);
  const material=new THREE.MeshStandardMaterial();new FarGarden(group,m=>{m.geometry.computeBoundingBox();group.add(m);surfaces.push(m);},material,material,{value:0},new THREE.Texture());scene.updateMatrixWorld(true);
  const center=v(-95,gardenHeight(-95,-73)+3.25,-73),direction=v(0,1,0),hit=new THREE.Raycaster(center,direction,0,8).intersectObjects(surfaces,false)[0];assert.ok(hit);
  const normal=surfaceNormal(hit,direction);assert.ok(normal.y<-.99);
  const camera=new SpiderCamera(surfaces,1),controller=new SpiderController(new Spider(scene),camera,{pressed:c=>c==='KeyW'},surfaces);
  controller.restore(hit.point.clone().addScaledVector(normal,.245).toArray(),normal.toArray(),[1,0,0]);camera.heading.set(1,0,0);
  for(let i=0;i<180;i++){controller.update(1/120,i/120);camera.update(controller.position,controller.normal,1/120);}
  assert.equal(controller.airborne,false);assert.ok(controller.normal.y<-.98);assert.ok(controller.position.x>-93);
});

const {SilkAim}=await import(path.join(output,'src/web/SilkAim.js'));
test('screen-space silk aiming prefers nearby knots and refuses distant or occluded targets',()=>{
  const scene=new THREE.Scene(),web=new WebManager(scene),surfaces=[],picker=new SilkAim(web,surfaces);
  web.add(v(-1,1,-5),v(1,1,-5));
  const camera=new THREE.PerspectiveCamera(64,16/9,.025,280);camera.position.set(0,1,0);camera.lookAt(v(0,1,-5));camera.updateMatrixWorld();
  const knot=v(-1,1,-5).project(camera),cursor=new THREE.Vector2(knot.x+20/1280,knot.y);
  const picked=picker.pick(camera,cursor,1280,720);assert.equal(picked.anchor.nodeId,1);
  const center=web.sample(web.strands.get(1),.5).project(camera);
  assert.ok(picker.pick(camera,new THREE.Vector2(center.x,center.y+20/720),1280,720));
  assert.equal(picker.pick(camera,new THREE.Vector2(center.x,center.y+70/720),1280,720),undefined);
  surfaces.push(box(scene,0,1,-3,4,4,.4));assert.equal(picker.pick(camera,cursor,1280,720),undefined);
  surfaces.length=0;camera.position.z=20;camera.lookAt(v(0,1,-5));camera.updateMatrixWorld();
  const far=web.sample(web.strands.get(1),.5).project(camera);
  assert.equal(picker.pick(camera,new THREE.Vector2(far.x,far.y),1280,720),undefined);
});
test('continuous weaving closes a connected frame with five physical shots and retains a real endpoint',()=>{
  const f=launcherFixture();f.origin.set(0,2,3);f.launcher.chaining=true;
  const points=[v(-3,2,-5),v(3,2,-5),v(3,5,-5),v(-3,5,-5)];
  for(const point of points)f.surfaces.push(box(f.scene,...point.toArray(),.4,.4,.3));
  for(const point of [...points,points[0]]){assert.ok(f.launcher.shoot(point));finish(f.launcher);assert.ok(f.launcher.pending);}
  assert.equal(f.web.strands.size,4);assert.equal(f.web.nodes.size,4);assert.equal(f.web.components().length,1);
  assert.ok(f.launcher.pending.nodeId);assert.equal(f.web.connectionProblem(f.launcher.pending,f.web.nodeAnchor(points[1].clone().add(v(0,0,.215)))),'duplicate');
  assert.equal(f.web.strands.size-f.web.nodes.size+1,1);
  f.launcher.chaining=false;f.surfaces.push(box(f.scene,0,6,-5,.4,.4,.3));f.launcher.shoot(v(0,6,-5));finish(f.launcher);
  assert.equal(f.launcher.pending,undefined);assert.equal(f.web.strands.size,5);
});
test('continuous weaving survives splitting a thread and loses its hold only when that node is removed',()=>{
  const f=launcherFixture();f.origin.set(0,2,3);f.launcher.chaining=true;
  f.web.add(v(-4,3,-5),v(4,3,-5));f.web.add(v(4,3,-5),v(4,3,-1));
  f.launcher.shoot(f.web.sample(f.web.strands.get(1),.5));finish(f.launcher);
  f.launcher.shoot(f.web.sample(f.web.strands.get(2),.5));finish(f.launcher);
  assert.ok(f.launcher.pending.nodeId);assert.ok(f.web.anchorPosition(f.launcher.pending));assert.equal(f.launcher.pending.strandId,undefined);
  const node=f.web.nodes.get(f.launcher.pending.nodeId),one=[...node.strands][0];f.web.remove(one);f.launcher.update(.01);assert.ok(f.launcher.pending);
  for(const id of [...node.strands])f.web.remove(id);f.launcher.update(.01);assert.equal(f.launcher.pending,undefined);
});
test('span guidance predicts obstruction and duplicates without creating or splitting strands',()=>{
  const f=launcherFixture();f.launcher.pending={position:v(-3,2,-5)};
  const other={position:v(3,2,-5)};assert.equal(f.launcher.spanStatus(other),undefined);
  f.surfaces.push(box(f.scene,0,2,-5,1,3,2));assert.equal(f.launcher.spanStatus(other),'blocked');
  assert.equal(f.launcher.spanStatus({position:v(30,2,-5)}),'long');assert.equal(f.web.strands.size,0);
  f.surfaces.length=0;f.web.add(f.launcher.pending.position,other.position);assert.equal(f.launcher.spanStatus(other),'duplicate');assert.equal(f.web.strands.size,1);
});
