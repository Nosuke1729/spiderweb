export class AudioManager {
  private context?:AudioContext;
  private master?:GainNode;
  private ambient?:AudioBufferSourceNode;
  enabled=true;
  setEnabled(on:boolean){this.enabled=on;if(this.context&&this.master)this.master.gain.setTargetAtTime(on?.18:0,this.context.currentTime,.07);}
  start(){
    if(this.context){void this.context.resume();this.setEnabled(this.enabled);return;}
    try{
      this.context=new AudioContext();this.master=this.context.createGain();this.master.gain.value=this.enabled?.18:0;this.master.connect(this.context.destination);
      const length=this.context.sampleRate*3;const buffer=this.context.createBuffer(1,length,this.context.sampleRate);
      const data=buffer.getChannelData(0);for(let i=0;i<length;i++)data[i]=(Math.random()*2-1)*.16;
      const noise=this.context.createBufferSource();noise.buffer=buffer;noise.loop=true;
      const filter=this.context.createBiquadFilter();filter.type='lowpass';filter.frequency.value=280;
      const gain=this.context.createGain();gain.gain.value=.45;
      noise.connect(filter).connect(gain).connect(this.master);noise.start();this.ambient=noise;
    }catch{this.enabled=false;}
  }
  note(freq:number,duration=.17,volume=.15){
    if(!this.context||!this.master||!this.enabled)return;
    const osc=this.context.createOscillator(),gain=this.context.createGain(),now=this.context.currentTime;
    osc.type='sine';osc.frequency.setValueAtTime(freq,now);osc.frequency.exponentialRampToValueAtTime(Math.max(40,freq*.58),now+duration);
    gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(volume,now+.014);gain.gain.exponentialRampToValueAtTime(.0001,now+duration);
    osc.connect(gain).connect(this.master);osc.start(now);osc.stop(now+duration+.02);
  }
  attach(){this.note(710,.22,.13);setTimeout(()=>this.note(1040,.12,.08),45);}
  vibration(){this.note(180,.32,.08);}
  cut(){this.note(310,.1,.08);}
  step(){this.note(115,.055,.024);}
  bird(){this.note(1210,.19,.021);setTimeout(()=>this.note(1560,.13,.016),115);}
}
