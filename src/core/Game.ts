import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { World } from '../world/World';
import { Spider } from '../player/Spider';
import { SpiderCamera } from '../camera/SpiderCamera';
import { SpiderController } from '../player/SpiderController';
import { WebManager } from '../web/WebManager';
import { InsectManager } from '../creatures/InsectManager';
import { AudioManager } from '../audio/AudioManager';
import { Input } from './Input';
import { SilkLauncher } from '../web/SilkLauncher';
import { Exploration } from '../world/Exploration';
import { OUTER_HABITATS } from '../world/WorldLayout';

type Save={version:2|3|4;player:number[];normal?:number[];heading?:number[];web:ReturnType<WebManager['serialize']>;quality:'high'|'low';muted:boolean;sensitivity?:number;discovered?:string[];catches?:number};
const saveKey='spiderweb-garden-v2';

export class Game {
  readonly scene=new THREE.Scene();
  readonly renderer:THREE.WebGLRenderer;
  readonly canvas:HTMLCanvasElement;
  readonly world:World;
  readonly spider:Spider;
  readonly camera:SpiderCamera;
  readonly controller:SpiderController;
  readonly web:WebManager;
  readonly insects:InsectManager;
  readonly audio=new AudioManager();
  readonly input:Input;
  private composer:EffectComposer;
  private bloom:UnrealBloomPass;
  private ray=new THREE.Raycaster();
  readonly launcher:SilkLauncher;
  readonly exploration=new Exploration();
  private catches=0;
  private accumulator=0;
  private physicsTime=0;
  private promptClock=0;
  private last=performance.now();
  private time=0;
  private started=false;
  private paused=false;
  private quality:'high'|'low'='high';
  private lastSave=0;
  private statusTimer=0;
  private stepDistance=0;
  private nextBird=14;
  private hud:HTMLElement;
  private startScreen:HTMLElement;
  private pauseScreen:HTMLElement;
  private reticle:HTMLElement;
  private prompt:HTMLElement;
  private status:HTMLElement;
  private silkAim=new THREE.Mesh(new THREE.SphereGeometry(.045,8,6),new THREE.MeshBasicMaterial({color:'#d5f4ef',transparent:true,opacity:.8,depthWrite:false}));
  private debug?:HTMLElement;
  private qa='';
  private qaDone=false;
  private qaMovementRemaining=0;

  constructor(private root:HTMLElement){
    this.root.innerHTML=`
      <div class="game-shell">
        <div class="viewport"></div>
        <div class="grade"></div><div class="vignette"></div>
        <div class="loading" id="loading">Growing the garden…</div>
        <div class="mobile-notice">Spiderweb is designed for a desktop browser with a mouse and keyboard.<br><small>Touch controls are planned.</small></div>
        <div class="hud" id="hud">
          <div class="hud-top"><div class="location"><span class="sun-mark">✺</span><span id="zone">THE UNDERGROWTH</span></div><div class="silk-count"><span class="silk-icon">◇</span> <span id="count">0</span> strands <span class="discovery-count" id="discoveries">0 / ${this.exploration.total} places</span></div></div>
          <div class="aim-prompt" id="prompt"></div>
          <div class="reticle" id="reticle"><i></i><i></i><i></i><i></i></div>
          <div class="status" id="status"></div>
          <div class="hint"><b>W A S D</b> move <span>·</span> <b>MOUSE</b> look <span>·</span> <b>SHIFT</b> scurry <span>·</span> <b>SPACE</b> leap <span>·</span> <b>CLICK</b> fire silk <span>·</span> <b>WHEEL</b> zoom <span>·</span> <b>Q</b> center <span>·</span> <b>E</b> use silk <span>·</span> <b>R</b> cut</div>
        </div>
        <div class="screen start-screen" id="start">
          <div class="eyebrow"><span class="line"></span> A WORLD BENEATH THE LEAVES <span class="line"></span></div>
          <h1>SPIDER<span>WEB</span></h1>
          <p>Every blade is a forest.<br>Every thread is a path.</p>
          <button id="enter" class="enter">ENTER THE GARDEN <span>↗</span></button>
          <div class="start-footer">EXPLORE &nbsp;·&nbsp; CLIMB &nbsp;·&nbsp; WEAVE <span>01 / THE GARDEN</span></div>
        </div>
        <div class="screen pause-screen hidden" id="pause">
          <div class="eyebrow">THE GARDEN WAITS</div><h2>PAUSED</h2>
          <button id="resume" class="enter">RETURN TO THE GARDEN <span>↗</span></button>
          <div class="pause-options"><button id="quality">QUALITY: HIGH</button><button id="sound">SOUND: ON</button></div>
          <label class="sensitivity">LOOK SENSITIVITY <input id="sensitivity" type="range" min="0.4" max="1.8" step="0.1" value="1" aria-label="Look sensitivity"></label>
          <div class="garden-notes" id="garden-notes"></div>
          <p>Your paths and discoveries save in this browser.</p>
        </div>
      </div>`;
    this.hud=this.el('hud');this.startScreen=this.el('start');this.pauseScreen=this.el('pause');this.reticle=this.el('reticle');this.prompt=this.el('prompt');this.status=this.el('status');
    this.renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
    this.renderer.setSize(innerWidth,innerHeight);
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure=1.12;
    this.renderer.shadowMap.enabled=true;
    this.renderer.shadowMap.type=THREE.PCFShadowMap;
    this.canvas=this.renderer.domElement;
    this.canvas.className='game-canvas';
    this.root.querySelector('.viewport')!.appendChild(this.canvas);
    this.world=new World(this.scene);this.scene.updateMatrixWorld(true);
    this.web=new WebManager(this.scene);
    this.silkAim.visible=false;this.scene.add(this.silkAim);
    this.spider=new Spider(this.scene);
    this.camera=new SpiderCamera(this.world.colliders,innerWidth/innerHeight);
    this.input=new Input(this.canvas);
    this.controller=new SpiderController(this.spider,this.camera,this.input,this.world.colliders);
    this.insects=new InsectManager(this.scene,this.web);
    this.composer=new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene,this.camera.camera));
    this.bloom=new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),.22,.5,.84);
    this.composer.addPass(this.bloom);this.composer.addPass(new OutputPass());
    this.launcher=new SilkLauncher(this.scene,this.world.anchors.filter(o=>!(o instanceof THREE.InstancedMesh)),this.web,()=>
      this.controller.position.clone().addScaledVector(this.controller.normal,.19).addScaledVector(this.controller.heading,-.29));
    this.launcher.onMessage=text=>this.message(text);
    this.launcher.onLaunch=()=>this.audio.note(510,.09,.055);
    this.launcher.onLand=()=>this.audio.attach();
    this.launcher.onBuilt=()=>this.audio.vibration();
    if(import.meta.env.DEV)this.qa=new URLSearchParams(location.search).get('qa')??'';
    this.setupControls();if(!this.qa)this.load();this.resize();
    if(import.meta.env.DEV){
      if(['arch','orchard','meadow','pot','outer'].includes(this.qa)){
        const point=this.qa==='outer'?{x:39,z:29}:OUTER_HABITATS.find(h=>h.id===this.qa)!;
        const x=point.x-5,z=point.z+5;
        this.controller.position.set(x,this.world.height(x,z)+.3,z);
        this.controller.heading.set(.707,0,-.707);this.camera.heading.copy(this.controller.heading);
        this.started=true;this.startScreen.classList.add('hidden');this.hud.classList.add('visible');
        if(this.qa==='outer'){this.controller.heading.set(1,0,0);this.camera.heading.copy(this.controller.heading);this.input.keys.add('ShiftLeft');this.qaMovementRemaining=6;}
      }else if(this.qa==='wall'||this.qa==='ceiling'){
        if(this.qa==='wall'){
          this.controller.position.set(-6.3,.3,-8);
          this.controller.heading.set(-1,0,0);
          this.camera.heading.set(-1,0,0);
        }else{
          this.controller.position.set(9.8,.3,-10.85);
          this.controller.heading.set(-1,0,0);
          this.camera.heading.set(-1,0,0);
        }
        this.started=true;this.startScreen.classList.add('hidden');this.hud.classList.add('visible');
        this.input.keys.add('KeyW');
        this.qaMovementRemaining=this.qa==='ceiling'?3.1:6.5;
      }else if(this.qa==='insect'){
        this.web.add(new THREE.Vector3(-5,1,-5),new THREE.Vector3(-1,1,-5));
        const fly=this.insects.insects[0];fly.position.set(-3,1,-3.6);fly.group.position.copy(fly.position);fly.target.set(-3,1,-5);fly.velocity.set(0,0,-1);
        this.started=true;this.startScreen.classList.add('hidden');this.hud.classList.add('visible');
      }else if(this.qa==='stress'){
        for(let i=0;i<160;i++){
          const theta=i*2.399963,phi=(i+7)*1.618034;
          const a=new THREE.Vector3(Math.cos(theta)*(3+i%7),.8+(i%6)*.28,-5+Math.sin(theta)*(3+i%7));
          const b=new THREE.Vector3(Math.cos(phi)*(4+i%9),1.1+(i%8)*.26,-5+Math.sin(phi)*(4+i%9));
          this.web.add(a,b);
        }
        this.started=true;this.qaDone=true;this.startScreen.classList.add('hidden');this.hud.classList.add('visible');
      }else if(this.qa==='ride'){
        this.web.add(new THREE.Vector3(-5,.48,-2.5),new THREE.Vector3(-2,.48,-2.5));
        this.web.add(new THREE.Vector3(-2,.48,-2.5),new THREE.Vector3(4,1.1,-2.5));
        this.controller.position.set(-3.5,.25,-2.5);
        this.started=true;this.startScreen.classList.add('hidden');this.hud.classList.add('visible');
        this.interact();this.input.keys.add('KeyW');
        this.qaMovementRemaining=2.3;
      }
    }
    addEventListener('resize',()=>this.resize());
    this.world.update(0,0);this.camera.update(this.controller.position,this.controller.normal,.016);
    this.el('loading').classList.add('hidden');
    if(import.meta.env.DEV){
      this.debug=document.createElement('div');this.debug.className='dev-debug';this.root.querySelector('.game-shell')!.appendChild(this.debug);
    }
    requestAnimationFrame(this.frame);
  }
  private el(id:string){return this.root.querySelector<HTMLElement>('#'+id)!;}
  private setupControls(){
    this.el('enter').addEventListener('click',()=>this.start());
    this.el('resume').addEventListener('click',()=>this.resume());
    this.el('quality').addEventListener('click',()=>{this.quality=this.quality==='high'?'low':'high';this.applyQuality();this.save();});
    this.el('sound').addEventListener('click',()=>{this.audio.setEnabled(!this.audio.enabled);this.el('sound').textContent=`SOUND: ${this.audio.enabled?'ON':'OFF'}`;this.save();});
    this.input.onLook=(x,y)=>{if(this.started&&!this.paused)this.camera.look(x,y);};
    this.input.onZoom=delta=>{if(this.started&&!this.paused)this.camera.zoom(delta);};
    this.input.onRecenter=()=>{if(this.started&&!this.paused)this.camera.recenter(this.controller.heading);};
    this.el('sensitivity').addEventListener('input',e=>{this.camera.sensitivity=Number((e.target as HTMLInputElement).value);this.save();});
    this.input.onPrimary=()=>this.attach();
    this.input.onSecondary=on=>this.camera.setAim(on);
    this.input.onCut=()=>this.cut();
    this.input.onInteract=()=>this.interact();
    this.input.onJump=()=>{if(this.started&&!this.paused)this.controller.jump();};
    this.input.onPause=()=>{if(this.started&&!this.paused)this.pause();};
    this.controller.onRideEnd=(id,end,drive,wish)=>{
      const current=this.web.strands.get(id);if(!current)return;
      const nodeId=end==='a'?current.a:current.b;
      const next=this.web.nextAt(nodeId,id,wish);if(!next)return;
      const [a,b]=this.web.getEndpoints(next);
      const t=next.a===nodeId?0:1;
      return {id:next.id,a,b,t,direction:(t===0?1:-1)*drive,tension:next.tension,sag:next.sag};
    };
    this.web.onSplit=(id,parts)=>{this.controller.remapStrand(id,parts,s=>this.web.getEndpoints(s));this.insects.remapStrand(id,parts);};
    this.web.onChange=()=>{this.updateCount();this.save();};
    this.insects.onCatch=()=>{
      const near=this.web.getNearestPoint(this.controller.position,1.6);
      if(near&&near.strand.energy>.1){this.audio.vibration();this.message('A faint tremor travels through the silk beneath you.');}
      if(this.qa==='insect')this.qaDone=true;
    };
    this.exploration.onDiscover=(name,detail)=>{this.message(name+' · '+detail);this.updateDiscoveries();this.audio.note(840,.45,.045);this.save();};
    addEventListener('beforeunload',()=>this.save());
    document.addEventListener('keydown',e=>{if(e.code==='Enter'&&!this.started)this.start();else if(e.code==='Enter'&&this.paused)this.resume();});
  }
  private start(){
    this.started=true;this.paused=false;this.startScreen.classList.add('hidden');this.pauseScreen.classList.add('hidden');this.hud.classList.add('visible');
    this.audio.start();void this.input.lock().then(locked=>this.message(locked?'Look toward a surface and click to fire silk. Wheel zooms; Q centers the view.':'Drag to look around. Click to fire silk; wheel zooms; Q centers the view.'));
    this.updateDiscoveries();
  }
  private pause(){this.input.clear();this.silkAim.visible=false;this.updateDiscoveries();this.paused=true;this.pauseScreen.classList.remove('hidden');this.hud.classList.remove('visible');this.input.unlock();this.save();}
  private resume(){this.paused=false;this.pauseScreen.classList.add('hidden');this.hud.classList.add('visible');void this.input.lock();}
  private aimRay(){
    this.ray.setFromCamera(this.input.locked?new THREE.Vector2(0,0):new THREE.Vector2(this.input.pointer.x,this.input.pointer.y),this.camera.camera);
    this.ray.near=0;this.ray.far=60;return this.ray;
  }
  private attach(){
    if(!this.started||this.paused)return;
    const ray=this.aimRay();
    const hit=ray.intersectObjects(this.world.anchors.filter(o=>!(o instanceof THREE.InstancedMesh)),false)[0];
    const silk=this.web.raycast(ray.ray.origin,ray.ray.direction,hit?.distance??60);
    const target=silk?.point??hit?.point??ray.ray.at(40,new THREE.Vector3());
    this.launcher.shoot(target);
  }
  private cut(){
    if(!this.started||this.paused)return;
    if(this.launcher.cancel()){this.message('Loose silk released.');return;}
    this.aimRay();
    const occluder=this.ray.intersectObjects(this.world.colliders,false)[0];
    const strand=this.web.aimStrand(this.ray.ray.origin,this.ray.ray.direction,Math.min(16,(occluder?.distance??16)+.08));
    if(strand){this.controller.detachRemovedStrand(strand.id);this.web.remove(strand.id);this.audio.cut();this.message('Strand cut.');}
    else this.message('Aim at a strand to cut it.');
  }
  private interact(){
    if(!this.started||this.paused)return;
    if(this.insects.collectNear(this.controller.position)){this.catches++;this.audio.note(580,.15,.1);this.message('The tremor quiets. Your web is part of the living garden.');this.updateDiscoveries();this.save();return;}
    const nearest=this.web.getNearestPoint(this.controller.position,.65);
    if(nearest&&!this.controller.isRiding()){
      const [a,b]=this.web.getEndpoints(nearest.strand);
      this.controller.ride(a,b,nearest.t,nearest.strand.id,1,nearest.strand.tension,nearest.strand.sag);this.web.disturb(nearest.strand.id,.55);
      this.message('W/S travel along silk. Look toward a branch at junctions; Space leaps away.');
    }else this.message('Move closer to a strand or caught insect.');
  }
  private message(text:string){this.status.textContent=text;this.status.classList.add('show');this.statusTimer=text.length>100?7:4.5;}
  private updateCount(){this.el('count').textContent=String(this.web.strands.size);}
  private updateZone(){
    const p=this.controller.position;
    const outer=OUTER_HABITATS.find(h=>Math.hypot(p.x-h.x,p.z-h.z)<h.radius+7);
    this.el('zone').textContent=outer?.name??(p.y>4?'ABOVE THE UNDERGROWTH':p.z< -24?'BEYOND THE FENCE':Math.abs(p.x)>26||p.z>23?'THE OPEN GARDEN':p.z< -12?'THE OLD FENCE':p.x< -5&&p.z<0?'THE ROOTS':p.x>7&&p.z>3?'THE RAIN POOL':'THE UNDERGROWTH');
  }
  private updateDiscoveries(){
    this.el('discoveries').textContent=`${this.exploration.discovered.size} / ${this.exploration.total} places`;
    this.el('garden-notes').textContent=`${this.exploration.discovered.size} quiet places discovered · ${this.catches} web encounters. ${this.exploration.nextHint()}`;
  }
  private updatePrompt(){
    if(!this.started||this.paused)return;
    const ray=this.aimRay();
    const hit=ray.intersectObjects(this.world.colliders,false)[0];
    const silk=this.web.raycast(ray.ray.origin,ray.ray.direction,hit?.distance??60);
    const target=silk?.point??hit?.point;
    const preview=target?this.launcher.preview(target):undefined;
    const ready=!!preview?.hit&&preview.inRange&&!preview.blocked;
    this.reticle.classList.toggle('active',ready);this.reticle.classList.toggle('blocked',!!hit&&!ready);
    this.reticle.classList.toggle('on-silk',!!silk&&ready);
    this.silkAim.visible=!!silk&&ready&&!this.launcher.flying;if(silk)this.silkAim.position.copy(silk.point);
    this.reticle.style.left=this.input.locked?'50%':`${(this.input.pointer.x+1)*50}%`;
    this.reticle.style.top=this.input.locked?'50%':`${(1-this.input.pointer.y)*50}%`;
    const near=this.web.getNearestPoint(this.controller.position,.65);
    this.prompt.textContent=this.launcher.flying?'SILK IN FLIGHT':silk&&ready?'CLICK · JOIN THIS THREAD':this.controller.isRiding()?'W/S · FOLLOW SILK · SPACE TO LEAP':near&&!this.launcher.pending?'E · TRAVERSE SILK':this.launcher.pending?'CLICK · FIRE SECOND ANCHOR':ready?'CLICK · FIRE SILK':target?'MOVE CLOSER · FIND A CLEAR SHOT':'';
    this.root.querySelector('.hint')!.innerHTML=`<b>WASD</b> move <span>·</span> <b>${this.input.locked?'MOUSE':'DRAG'}</b> look <span>·</span> <b>SHIFT</b> scurry <span>·</span> <b>SPACE</b> leap <span>·</span> <b>CLICK</b> fire silk <span>·</span> <b>WHEEL</b> zoom <span>·</span> <b>Q</b> center <span>·</span> <b>E</b> use silk <span>·</span> <b>R</b> cut`;
  }
  private save(){
    if(this.qa)return;
    try{const data:Save={version:4,player:this.controller.position.toArray(),normal:this.controller.normal.toArray(),heading:this.controller.heading.toArray(),web:this.web.serialize(),quality:this.quality,muted:!this.audio.enabled,sensitivity:this.camera.sensitivity,discovered:[...this.exploration.discovered],catches:this.catches};localStorage.setItem(saveKey,JSON.stringify(data));}catch{}
  }
  private load(){
    try{
      const value=localStorage.getItem(saveKey);if(!value)return;const data=JSON.parse(value) as Save;
      if(data.version!==2&&data.version!==3&&data.version!==4)return;
      this.controller.restore(data.player,data.normal,data.heading);
      this.camera.heading.copy(this.controller.heading);
      this.camera.sensitivity=typeof data.sensitivity==='number'&&Number.isFinite(data.sensitivity)?THREE.MathUtils.clamp(data.sensitivity,.4,1.8):1;
      (this.el('sensitivity') as HTMLInputElement).value=String(this.camera.sensitivity);
      this.exploration.restore(data.discovered);this.catches=Number.isSafeInteger(data.catches)&&data.catches!>=0?data.catches!:0;this.updateDiscoveries();this.web.restore(data.web);
      this.quality=data.quality==='low'?'low':'high';this.audio.setEnabled(!data.muted);
      this.applyQuality();this.el('sound').textContent=`SOUND: ${this.audio.enabled?'ON':'OFF'}`;this.updateCount();
    }catch{try{localStorage.removeItem(saveKey);}catch{}}
  }
  private applyQuality(){
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,this.quality==='high'?1.5:1));
    this.renderer.shadowMap.enabled=this.quality==='high';
    this.el('quality').textContent=`QUALITY: ${this.quality.toUpperCase()}`;
    this.resize();
  }
  private resize(){this.renderer.setSize(innerWidth,innerHeight);this.camera.resize(innerWidth,innerHeight);this.composer.setSize(innerWidth,innerHeight);}
  private frame=(now:number)=>{
    const dt=Math.min(.05,(now-this.last)/1000);this.last=now;this.time+=dt;
    this.world.update(this.time,dt,this.controller.position);
    if(this.started&&!this.paused){
      if(import.meta.env.DEV&&this.qaMovementRemaining>0){
        this.qaMovementRemaining-=dt;
        if(this.qaMovementRemaining<=0){this.input.keys.delete('KeyW');this.qaDone=true;}else this.input.keys.add('KeyW');
      }
      this.accumulator+=dt;
      while(this.accumulator>=1/120){this.physicsTime+=1/120;this.controller.update(1/120,this.physicsTime);this.accumulator-=1/120;}
      this.camera.update(this.controller.position,this.controller.normal,dt,this.controller.velocity.clone().clampLength(0,3.5));
      this.insects.update(this.time,dt);
      if(!this.controller.airborne&&this.controller.speed>.45){
        this.stepDistance+=this.controller.speed*dt;
        if(this.stepDistance>.52){this.audio.step();this.stepDistance=0;}
      }
      if(this.time>this.nextBird){this.audio.bird();this.nextBird=this.time+15+Math.random()*13;}
      this.launcher.update(dt);this.exploration.update(this.controller.position);
      this.promptClock-=dt;if(this.promptClock<=0){this.updatePrompt();this.promptClock=.08;}this.updateZone();
      this.statusTimer-=dt;if(this.statusTimer<=0)this.status.classList.remove('show');
      if(this.time-this.lastSave>8){this.save();this.lastSave=this.time;}
    }else{
      this.spider.animate(this.time,0,false);
      this.camera.update(this.controller.position,this.controller.normal,dt);
      this.insects.update(this.time,dt);
    }
    this.web.update(this.time,dt,this.world.sunDirection,this.camera.camera.position);
    if(this.debug&&Math.floor(this.time*4)!==Math.floor((this.time-dt)*4)){
      const p=this.controller.position,n=this.controller.normal;
      this.debug.textContent=`DEV  ${p.x.toFixed(1)} ${p.y.toFixed(1)} ${p.z.toFixed(1)}  N ${n.x.toFixed(1)} ${n.y.toFixed(1)} ${n.z.toFixed(1)}  ${this.web.strands.size}S/${this.web.components().length}C  ${this.insects.insects.filter(i=>i.caught).length} caught  ${this.controller.isRiding()?'RIDING':'SURFACE'}  ${this.input.locked?'LOCK':'DRAG'} ${this.launcher.flying?'FLIGHT':this.launcher.pending?'ANCHOR':'READY'}  ${Math.round(1/Math.max(dt,.001))} FPS ${this.qa?this.qa.toUpperCase()+(this.qaDone?' DONE':' RUNNING'):''}`;
    }
    if(this.quality==='high')this.composer.render();else this.renderer.render(this.scene,this.camera.camera);
    requestAnimationFrame(this.frame);
  };
}
