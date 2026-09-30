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
