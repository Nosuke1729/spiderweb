export class Input {
  readonly keys=new Set<string>();
  readonly pointer={x:0,y:0};
  locked=false;
  onLook:(dx:number,dy:number)=>void=()=>{};
  onPrimary:()=>void=()=>{};
  onSecondary:(active:boolean)=>void=()=>{};
  onCut:()=>void=()=>{};
  onInteract:()=>void=()=>{};
  onPause:()=>void=()=>{};
  onJump:()=>void=()=>{};
  constructor(private canvas:HTMLCanvasElement) {
    document.addEventListener('keydown',e=>{
      if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();
      this.keys.add(e.code);
      if(e.repeat)return;
      if(e.code==='Space')this.onJump();
      if(e.code==='KeyR')this.onCut();
      if(e.code==='KeyE')this.onInteract();
      if(e.code==='Escape')this.onPause();
    });
    document.addEventListener('keyup',e=>this.keys.delete(e.code));
    window.addEventListener('blur',()=>this.keys.clear());
    document.addEventListener('pointerlockchange',()=>{this.locked=document.pointerLockElement===this.canvas;if(!this.locked)this.onPause();});
    document.addEventListener('mousemove',e=>{if(this.locked)this.onLook(e.movementX,e.movementY);});
    this.canvas.addEventListener('mousemove',e=>{
      const rect=this.canvas.getBoundingClientRect();
      this.pointer.x=(e.clientX-rect.left)/rect.width*2-1;
      this.pointer.y=-(e.clientY-rect.top)/rect.height*2+1;
      if(!this.locked&&e.buttons===2)this.onLook(e.movementX,e.movementY);
    });
    this.canvas.addEventListener('mousedown',e=>{if(e.button===0)this.onPrimary();if(e.button===2)this.onSecondary(true);});
    document.addEventListener('mouseup',e=>{if(e.button===2)this.onSecondary(false);});
    this.canvas.addEventListener('contextmenu',e=>e.preventDefault());
  }
  pressed(...codes:string[]){return codes.some(c=>this.keys.has(c));}
  lock(){void this.canvas.requestPointerLock().catch(()=>{});}
  unlock(){if(this.locked)document.exitPointerLock();}
}
