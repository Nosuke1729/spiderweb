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

type Save={version:2;player:number[];web:ReturnType<WebManager['serialize']>;quality:'high'|'low';muted:boolean};
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
  private pending?:THREE.Vector3;
  private ghost:THREE.Line;
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
  private debug?:HTMLElement;
  private qa='';
  private qaDone=false;

  constructor(private root:HTMLElement){
    this.root.innerHTML=`
      <div class="game-shell">
        <div class="viewport"></div>
        <div class="grade"></div><div class="vignette"></div>
        <div class="loading" id="loading">Growing the garden…</div>
        <div class="mobile-notice">Spiderweb is designed for a desktop browser with a mouse and keyboard.<br><small>Touch controls are planned.</small></div>
        <div class="hud" id="hud">
          <div class="hud-top"><div class="location"><span class="sun-mark">✺</span><span id="zone">THE UNDERGROWTH</span></div><div class="silk-count"><span class="silk-icon">◇</span> <span id="count">0</span> strands</div></div>
          <div class="aim-prompt" id="prompt"></div>
          <div class="reticle" id="reticle"><i></i><i></i><i></i><i></i></div>
          <div class="status" id="status"></div>
          <div class="hint"><b>W A S D</b> move <span>·</span> <b>MOUSE</b> look <span>·</span> <b>SHIFT</b> scurry <span>·</span> <b>SPACE</b> leap <span>·</span> <b>CLICK</b> weave <span>·</span> <b>E</b> use silk <span>·</span> <b>R</b> cut</div>
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
          <p>Your paths and webs save in this browser.</p>
        </div>
      </div>`;
    this.hud=this.el('hud');this.startScreen=this.el('start');this.pauseScreen=this.el('pause');this.reticle=this.el('reticle');this.prompt=this.el('prompt');this.status=this.el('status');
    this.renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
    this.renderer.setSize(innerWidth,innerHeight);
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure=1.34;
    this.renderer.shadowMap.enabled=true;
    this.renderer.shadowMap.type=THREE.PCFShadowMap;
    this.canvas=this.renderer.domElement;
    this.canvas.className='game-canvas';
    this.root.querySelector('.viewport')!.appendChild(this.canvas);
    this.world=new World(this.scene);
    this.web=new WebManager(this.scene);
    this.spider=new Spider(this.scene);
    this.camera=new SpiderCamera(this.world.colliders,innerWidth/innerHeight);
    this.input=new Input(this.canvas);
    this.controller=new SpiderController(this.spider,this.camera,this.input,this.world.colliders);
    this.insects=new InsectManager(this.scene,this.web);
    this.composer=new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene,this.camera.camera));
    this.bloom=new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),.22,.5,.84);
    this.composer.addPass(this.bloom);this.composer.addPass(new OutputPass());
    const ghostGeo=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]);
    this.ghost=new THREE.Line(ghostGeo,new THREE.LineDashedMaterial({color:'#e1f3ed',dashSize:.13,gapSize:.09,transparent:true,opacity:.62,depthWrite:false}));
    this.ghost.visible=false;this.ghost.renderOrder=3;this.scene.add(this.ghost);
    if(import.meta.env.DEV)this.qa=new URLSearchParams(location.search).get('qa')??'';
    this.setupControls();if(!this.qa)this.load();this.resize();
    if(import.meta.env.DEV){
      if(this.qa==='wall'||this.qa==='ceiling'){
        if(this.qa==='wall'){
          this.controller.position.set(-6.3,.3,-8);
          this.controller.heading.set(-1,0,0);
          this.camera.heading.set(-1,0,0);
        }else{
          this.controller.position.set(8.35,.3,-10.85);
          this.controller.heading.set(1,0,0);
          this.camera.heading.set(1,0,0);
        }
        this.started=true;this.startScreen.classList.add('hidden');this.hud.classList.add('visible');
        this.input.keys.add('KeyW');
        setTimeout(()=>{this.input.keys.delete('KeyW');this.qaDone=true;},6500);
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
        setTimeout(()=>{this.input.keys.delete('KeyW');this.qaDone=true;},2300);
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
    this.input.onLook=(x,y)=>this.camera.look(x,y);
    this.input.onPrimary=()=>this.attach();
    this.input.onSecondary=on=>this.camera.setAim(on);
    this.input.onCut=()=>this.cut();
    this.input.onInteract=()=>this.interact();
    this.input.onJump=()=>{if(this.started&&!this.paused)this.controller.jump();};
    this.input.onPause=()=>{if(this.started&&!this.paused)this.pause();};
    this.controller.onRideEnd=(id,end,drive)=>{
      const current=this.web.strands.get(id);if(!current)return;
      const nodeId=end==='a'?current.a:current.b;
      const next=this.web.nextAt(nodeId,id);if(!next)return;
      const [a,b]=this.web.getEndpoints(next);
      const t=next.a===nodeId?0:1;
      return {id:next.id,a,b,t,direction:(t===0?1:-1)*drive};
    };
    this.web.onChange=()=>{this.updateCount();this.save();};
    this.insects.onCatch=()=>{this.audio.vibration();this.message('A faint tremor travels through your silk.');if(this.qa==='insect')this.qaDone=true;};
    addEventListener('beforeunload',()=>this.save());
    document.addEventListener('keydown',e=>{if(e.code==='Enter'&&!this.started)this.start();else if(e.code==='Enter'&&this.paused)this.resume();});
  }
  private start(){
    this.started=true;this.paused=false;this.startScreen.classList.add('hidden');this.pauseScreen.classList.add('hidden');this.hud.classList.add('visible');
    this.audio.start();this.input.lock();this.message('Find a surface. Click to place your first silk anchor.');
  }
  private pause(){this.paused=true;this.pauseScreen.classList.remove('hidden');this.hud.classList.remove('visible');this.input.unlock();this.save();}
  private resume(){this.paused=false;this.pauseScreen.classList.add('hidden');this.hud.classList.add('visible');this.input.lock();}
  private aimHit(precise=false){
    this.ray.setFromCamera(this.input.locked?new THREE.Vector2(0,0):new THREE.Vector2(this.input.pointer.x,this.input.pointer.y),this.camera.camera);this.ray.far=24;
    // Vegetation instances are queried on clicks; frequent HUD probes use the solid set.
    return this.ray.intersectObjects(precise?this.world.anchors:this.world.colliders,false)[0];
  }
  private attach(){
    if(!this.started||this.paused)return;
    const hit=this.aimHit(true);
    if(!hit){this.message('Aim at a solid surface to anchor silk.');this.audio.note(220,.11,.04);return;}
    const point=hit.point.clone();
    if(!this.pending){this.pending=point;this.message('First anchor set. Move to another surface and click.');this.audio.attach();}
    else if(this.web.add(this.pending,point)){
      this.pending=undefined;this.audio.attach();this.message('A new path in the garden. Keep weaving.');
    } else this.message('Choose a more distant or unconnected anchor.');
  }
  private cut(){
    if(this.pending){this.pending=undefined;this.message('Loose silk released.');return;}
    this.ray.setFromCamera(this.input.locked?new THREE.Vector2(0,0):new THREE.Vector2(this.input.pointer.x,this.input.pointer.y),this.camera.camera);
    const strand=this.web.aimStrand(this.ray.ray.origin,this.ray.ray.direction);
    if(strand){this.web.remove(strand.id);this.audio.cut();this.message('Strand cut.');}
    else this.message('Aim at a strand to cut it.');
  }
  private interact(){
    if(this.insects.collectNear(this.controller.position)){this.audio.note(580,.15,.1);this.message('You found the source of the vibration.');return;}
    const nearest=this.web.getNearestPoint(this.controller.position,.65);
    if(nearest&&!this.controller.isRiding()){
      const [a,b]=this.web.getEndpoints(nearest.strand);
      this.controller.ride(a,b,nearest.t,nearest.strand.id);this.web.disturb(nearest.strand.id,.55);
      this.message('On silk. W and S travel along the thread; Space leaps away.');
    }else this.message('Move closer to a strand or caught insect.');
  }
  private message(text:string){this.status.textContent=text;this.status.classList.add('show');this.statusTimer=4.5;}
  private updateCount(){this.el('count').textContent=String(this.web.strands.size);}
  private updateZone(){
    const p=this.controller.position;
    this.el('zone').textContent=p.y>4?'ABOVE THE UNDERGROWTH':p.z< -12?'THE OLD FENCE':p.x< -5&&p.z<0?'THE ROOTS':p.x>7&&p.z>3?'THE RAIN POOL':'THE UNDERGROWTH';
  }
  private updateGhost(){
    this.ghost.visible=!!this.pending;
    if(!this.pending)return;
    const hit=this.aimHit();const end=hit?.point??this.controller.position;
    this.ghost.geometry.setFromPoints([this.pending,end]);this.ghost.computeLineDistances();
  }
  private updatePrompt(){
    if(!this.started||this.paused)return;
    const hit=this.aimHit();this.reticle.classList.toggle('active',!!hit);this.reticle.classList.toggle('free',!this.input.locked);
    const near=this.web.getNearestPoint(this.controller.position,.65);
    this.prompt.textContent=this.pending?'CLICK TO COMPLETE THE STRAND':near?'E · TRAVERSE SILK':hit?'CLICK · ANCHOR SILK':'';
  }
  private save(){
    if(this.qa)return;
    try{const data:Save={version:2,player:this.controller.position.toArray(),web:this.web.serialize(),quality:this.quality,muted:!this.audio.enabled};localStorage.setItem(saveKey,JSON.stringify(data));}catch{}
  }
  private load(){
    try{
      const value=localStorage.getItem(saveKey);if(!value)return;const data=JSON.parse(value) as Save;
      if(data.version!==2)return;
      this.controller.restore(data.player);this.web.restore(data.web);
      this.quality=data.quality==='low'?'low':'high';this.audio.setEnabled(!data.muted);
      this.applyQuality();this.el('sound').textContent=`SOUND: ${this.audio.enabled?'ON':'OFF'}`;this.updateCount();
    }catch{localStorage.removeItem(saveKey);}
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
    this.world.update(this.time,dt);
    if(this.started&&!this.paused){
      this.controller.update(dt,this.time);
      this.camera.update(this.controller.position,this.controller.normal,dt);
      this.insects.update(this.time,dt);
      if(!this.controller.airborne&&this.controller.speed>.45){
        this.stepDistance+=this.controller.speed*dt;
        if(this.stepDistance>.52){this.audio.step();this.stepDistance=0;}
      }
      if(this.time>this.nextBird){this.audio.bird();this.nextBird=this.time+15+Math.random()*13;}
      this.updateGhost();this.updatePrompt();this.updateZone();
      this.statusTimer-=dt;if(this.statusTimer<=0)this.status.classList.remove('show');
      if(this.time-this.lastSave>8){this.save();this.lastSave=this.time;}
    }else{
      this.spider.animate(this.time,0,false);
      this.camera.update(this.controller.position,this.controller.normal,dt);
      this.insects.update(this.time,dt);
    }
    this.web.update(this.time,dt,this.world.sun.position.clone().normalize(),this.camera.camera.position);
    if(this.debug&&Math.floor(this.time*4)!==Math.floor((this.time-dt)*4)){
      const p=this.controller.position,n=this.controller.normal;
      this.debug.textContent=`DEV  ${p.x.toFixed(1)} ${p.y.toFixed(1)} ${p.z.toFixed(1)}  N ${n.x.toFixed(1)} ${n.y.toFixed(1)} ${n.z.toFixed(1)}  ${this.web.strands.size}S/${this.web.components().length}C  ${this.insects.insects.filter(i=>i.caught).length} caught  ${this.controller.isRiding()?'RIDING':'SURFACE'}  ${this.input.locked?'LOCK':'CURSOR'}  ${Math.round(1/Math.max(dt,.001))} FPS ${this.qa?this.qa.toUpperCase()+(this.qaDone?' DONE':' RUNNING'):''}`;
    }
    if(this.quality==='high')this.composer.render();else this.renderer.render(this.scene,this.camera.camera);
    requestAnimationFrame(this.frame);
  };
}
