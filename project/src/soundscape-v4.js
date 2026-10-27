/** Original synthesized ambience and foley: offline, no third-party samples. */
export class Soundscape {
  constructor(){this.ctx=null;this.enabled=false;this.started=false;this.inside=false;this.reading=false;this.fireworkNoise=null;this.noiseVariant=new Map();this.fireworkVoices=[];this.fireworkWindowStart=-Infinity;this.fireworkWindowCount=0;this.fireworkWindowBins=new Set();}
  ensure(){
    if(this.started)return true;
    try{
      const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return false;const c=this.ctx=new AC();
      this.master=c.createGain();this.master.gain.value=0;const compressor=c.createDynamicsCompressor();compressor.threshold.value=-20;compressor.ratio.value=4;this.master.connect(compressor).connect(c.destination);
      for(const name of ['ambience','foley','music','ui']){this[name]=c.createGain();this[name].connect(this.master);}
      this.foley.gain.value=.65;this.ambience.gain.value=.7;this.music.gain.value=.24;
      this.room=c.createConvolver();const impulse=c.createBuffer(2,c.sampleRate*2.4,c.sampleRate);for(let ch=0;ch<2;ch++){const a=impulse.getChannelData(ch);for(let i=0;i<a.length;i++)a[i]=(Math.random()*2-1)*Math.exp(-i/(c.sampleRate*.43));}this.room.buffer=impulse;this.roomSend=c.createGain();this.roomSend.gain.value=.08;this.foley.connect(this.roomSend).connect(this.room).connect(this.master);
      const n=c.sampleRate*8,b=c.createBuffer(1,n,c.sampleRate),a=b.getChannelData(0);let v=0;for(let i=0;i<n;i++){v=.985*v+.015*(Math.random()*2-1);a[i]=v*3.2;}
      const wind=c.createBufferSource();wind.buffer=b;wind.loop=true;const filter=c.createBiquadFilter();filter.type='lowpass';filter.frequency.value=400;
      this.windGain=c.createGain();this.fireGain=c.createGain();this.windGain.gain.value=.27;this.fireGain.gain.value=.07;wind.connect(filter).connect(this.windGain).connect(this.ambience);this.fireGain.connect(this.ambience);wind.start();
      this.pad=c.createGain();this.pad.gain.value=.025;this.pad.connect(this.music);for(const hz of [130.81,196]){const o=c.createOscillator();o.frequency.value=hz;o.type='sine';o.connect(this.pad);o.start();}
      // Bake the long explosion noise once while audio is being started by a
      // gesture. A sky-wide volley then shares samples instead of allocating
      // and filling several megabytes of AudioBuffers on its burst frame.
      this.fireworkNoise=new Map();
      for(const seconds of [1.5,1.7]){const variants=[];for(let variant=0;variant<2;variant++){const n=Math.ceil(c.sampleRate*seconds),buffer=c.createBuffer(1,n,c.sampleRate),samples=buffer.getChannelData(0);for(let i=0;i<n;i++)samples[i]=(Math.random()*2-1)*Math.pow(1-i/n,1.7);variants.push(buffer);}this.fireworkNoise.set(seconds,variants);}
      this.started=true;this._crackle=setInterval(()=>{if(this.enabled&&c.state==='running'&&Math.random()<.38)this.noise(.026,1800,.07,this.fireGain);},240);return true;
    }catch{return false;}
  }
  async setEnabled(on){if(on&&!this.ensure())return false;this.enabled=!!on;if(this.ctx){if(on&&this.ctx.state==='suspended')await this.ctx.resume();this.master.gain.setTargetAtTime(on?.48:0,this.ctx.currentTime,.12);}return true;}
  setInside(value){this.inside=!!value;if(!this.ctx)return;const t=this.ctx.currentTime;this.windGain.gain.setTargetAtTime(value?.095:.27,t,.4);this.fireGain.gain.setTargetAtTime(value?.20:.07,t,.4);this.roomSend.gain.setTargetAtTime(value?.035:.10,t,.4);}
  setReading(value){this.reading=!!value;if(this.ctx)this.music.gain.setTargetAtTime(value?.06:.24,this.ctx.currentTime,.35);}
  attachMusic(audio){if(!this.ensure())return;try{if(!audio._giftNode){audio._giftNode=this.ctx.createMediaElementSource(audio);audio._giftNode.connect(this.music);}}catch{}}
  noise(duration,freq,gain=.05,bus=this.foley,delay=0,pan=0){if(!this.enabled||!this.ctx)return;const c=this.ctx,t=c.currentTime+delay,variants=this.fireworkNoise?.get(duration);let b;if(variants){const variant=this.noiseVariant.get(duration)||0;b=variants[variant%variants.length];this.noiseVariant.set(duration,variant+1);}else{const n=Math.ceil(c.sampleRate*duration);b=c.createBuffer(1,n,c.sampleRate);const a=b.getChannelData(0);for(let i=0;i<n;i++)a[i]=(Math.random()*2-1)*Math.pow(1-i/n,1.7);}const src=c.createBufferSource();src.buffer=b;const f=c.createBiquadFilter();f.type='bandpass';f.frequency.value=freq;f.Q.value=.7;const g=c.createGain();g.gain.value=gain;const p=c.createStereoPanner?.();src.connect(f).connect(g);if(p){p.pan.value=pan;g.connect(p).connect(bus);}else g.connect(bus);src.start(t);}
  tone(hz,seconds,gain=.03,delay=0,pan=0){if(!this.enabled||!this.ctx)return;const c=this.ctx,t=c.currentTime+delay,o=c.createOscillator(),g=c.createGain();o.type='sine';o.frequency.setValueAtTime(hz,t);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(gain,t+.012);g.gain.exponentialRampToValueAtTime(.0001,t+seconds);o.connect(g).connect(this.foley);o.start(t);o.stop(t+seconds+.01);}
  step(surface,side){if(surface==='snow'){this.noise(.24,1200,.15,this.foley,0,side?.14:-.14);this.tone(76,.13,.045);}else{this.noise(.085,490,.065);this.tone(surface==='stairs'?260:165,.14,.035);}}
  creak(){this.noise(.65,210,.09);this.tone(98,.65,.025);}
  touch(kind){if(kind==='open'){this.creak();this.noise(.5,1700,.04);return;}if(kind==='rose'){[523.25,659.25,783.99,987.77,880,783.99,659.25,587.33,523.25,659.25,783.99,987.77,880,783.99,659.25,523.25].forEach((n,i)=>this.tone(n,.85,.022,i*.6));return;}if(kind==='paper'){this.noise(.5,2100,.07);return;}if(kind==='match'){this.noise(.19,2800,.10);return;}if(kind==='clock'){this.tone(990,.15,.025);this.noise(.12,1300,.06);return;}if(kind==='stir'){for(let i=0;i<5;i++){this.tone(1000+i*33,.25,.014,i*.45);this.noise(.3,700,.03,this.foley,i*.45);}return;}this.tone(440,.3,.018);}
  firework(distance,x,style){
    if(!this.enabled||!this.ctx||this.ctx.state!=='running')return false;
    const now=this.ctx.currentTime,delay=Math.max(0,distance)/340,pan=Math.max(-.7,Math.min(.7,x/45));
    this.fireworkVoices=this.fireworkVoices.filter(until=>until>now);
    if(now-this.fireworkWindowStart>.18){this.fireworkWindowStart=now;this.fireworkWindowCount=0;this.fireworkWindowBins.clear();}
    // Several spatial booms convey a simultaneous salvo. Bound overlapping
    // voices so its sound stays full without clipping or a node-allocation spike.
    const bin=Math.min(3,Math.floor((pan+.7)/1.4*4));
    if(this.fireworkWindowCount>=4||this.fireworkVoices.length>=6||this.fireworkWindowBins.has(bin))return false;
    this.fireworkWindowBins.add(bin);this.fireworkWindowCount++;this.fireworkVoices.push(now+delay+1.94);
    this.noise(1.5,Math.max(100,550-distance*3),.36,this.foley,delay,pan);this.tone(style===4?48:62,.8,.11,delay);this.noise(1.7,1500,.075,this.foley,delay+.22,pan);return true;
  }
}
