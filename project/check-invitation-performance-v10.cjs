'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const project = __dirname, delivery = path.resolve(project, '..');
const deps = fs.existsSync(path.join(project, 'node_modules/esbuild')) ? path.join(project, 'node_modules') : 'C:/页面/winter-cabin-build/node_modules';
class Element {
  constructor(tag, document) { this.tagName = tag.toUpperCase(); this.ownerDocument = document; this.children = []; this.parentNode = null; this.attrs = {}; this.dataset = {}; this.listeners = new Map(); this._text = ''; this._html = ''; this.style = { values: {}, setProperty(name, value) { this.values[name] = value; } }; }
  get id() { return this.attrs.id || ''; } set id(value) { this.setAttribute('id', value); }
  get className() { return this.attrs.class || ''; } set className(value) { this.setAttribute('class', value); }
  get classList() { const el = this; return { contains(name) { return el.className.split(/\s+/).includes(name); }, add(...names) { el.className = [...new Set([...el.className.split(/\s+/).filter(Boolean), ...names])].join(' '); }, remove(...names) { el.className = el.className.split(/\s+/).filter(name => !names.includes(name)).join(' '); }, toggle(name, force) { const on = force === undefined ? !this.contains(name) : !!force; if (on) this.add(name); else this.remove(name); return on; } }; }
  setAttribute(name, value) { this.attrs[name] = String(value); if (name.startsWith('data-')) this.dataset[name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = String(value); }
  getAttribute(name) { return this.attrs[name] ?? null; }
  removeAttribute(name) { delete this.attrs[name]; }
  get hidden() { return Object.hasOwn(this.attrs, 'hidden'); } set hidden(value) { if (value) this.attrs.hidden = ''; else delete this.attrs.hidden; }
  get disabled() { return Object.hasOwn(this.attrs, 'disabled'); } set disabled(value) { if (value) this.attrs.disabled = ''; else delete this.attrs.disabled; }
  get inert() { return Object.hasOwn(this.attrs, 'inert'); } set inert(value) { if (value) this.attrs.inert = ''; else delete this.attrs.inert; }
  get isConnected() { return this.ownerDocument.body.contains(this); }
  set innerHTML(value) { this.children.forEach(child => { child.parentNode = null; }); this.children = []; this._html = String(value); this._text = ''; parseInto(this, this._html); }
  get innerHTML() { return this._html; }
  set textContent(value) { this.children = []; this._text = String(value); } get textContent() { return this._text + this.children.map(child => child.textContent).join(''); }
  appendChild(child) { child.parentNode = this; this.children.push(child); return child; }
  remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(child => child !== this); this.parentNode = null; }
  contains(el) { return el === this || this.children.some(child => child.contains(el)); }
  matches(selector) {
    if (selector.includes(',')) return selector.split(',').some(s => this.matches(s.trim()));
    const parts = selector.trim().split(/\s+/); if (parts.length > 1) { if (!this.matches(parts.pop())) return false; let parent = this.parentNode; while (parts.length) { const part = parts.pop(); while (parent && !parent.matches(part)) parent = parent.parentNode; if (!parent) return false; parent = parent.parentNode; } return true; }
    const exclude = /:not\(([^)]+)\)/.exec(selector); if (exclude) { if (this.matches(exclude[1])) return false; selector = selector.replace(exclude[0], ''); }
    const tag = /^[a-z][\w-]*/i.exec(selector); if (tag && this.tagName !== tag[0].toUpperCase()) return false;
    const id = /#([\w-]+)/.exec(selector); if (id && this.id !== id[1]) return false;
    for (const match of selector.matchAll(/\.([\w-]+)/g)) if (!this.classList.contains(match[1])) return false;
    for (const match of selector.matchAll(/\[([^=\]]+)(?:=["']?([^"'\]]+)["']?)?\]/g)) if (!Object.hasOwn(this.attrs, match[1]) || match[2] !== undefined && this.attrs[match[1]] !== match[2]) return false;
    return !!(tag || id || selector.startsWith('.') || selector.startsWith('['));
  }
  closest(selector) { for (let el = this; el; el = el.parentNode) if (el.matches(selector)) return el; return null; }
  querySelectorAll(selector) { const found = []; for (const child of this.children) { if (child.matches(selector)) found.push(child); found.push(...child.querySelectorAll(selector)); } return found; }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  addEventListener(type, fn, options = {}) { const rows = this.listeners.get(type) || []; rows.push({ fn, once: options.once }); this.listeners.set(type, rows); }
  removeEventListener(type, fn) { this.listeners.set(type, (this.listeners.get(type) || []).filter(row => row.fn !== fn)); }
  dispatchEvent(event) { event.target ??= this; event.currentTarget = this; event.preventDefault ??= () => { event.defaultPrevented = true; }; event.stopPropagation ??= () => { event.stopped = true; }; for (const row of [...(this.listeners.get(event.type) || [])]) { row.fn(event); if (row.once) this.removeEventListener(event.type, row.fn); } if (!event.stopped && event.bubbles !== false && this.parentNode) this.parentNode.dispatchEvent(event); return !event.defaultPrevented; }
  click() { if (!this.disabled) this.dispatchEvent({ type: 'click' }); }
  focus() { this.ownerDocument.activeElement = this; }
  scrollIntoView() { this.wasScrolledIntoView = true; }
}
const voidTags = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr', 'path']);
function parseInto(root, html) { const stack = [root]; for (const token of html.match(/<!--[\s\S]*?-->|<[^>]+>|[^<]+/g) || []) { if (token.startsWith('<!--')) continue; if (token.startsWith('</')) { if (stack.length > 1) stack.pop(); continue; } if (token.startsWith('<')) { const match = /^<([\w:-]+)([\s\S]*?)\/?\s*>$/.exec(token); if (!match) continue; const el = new Element(match[1], root.ownerDocument); for (const attr of match[2].matchAll(/([^\s=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s]+)))?/g)) el.setAttribute(attr[1], attr[2] ?? attr[3] ?? attr[4] ?? ''); stack.at(-1).appendChild(el); if (!voidTags.has(match[1].toLowerCase()) && !token.endsWith('/>')) stack.push(el); } else stack.at(-1)._text += token; } }
function documentModel() { const document = { createElement(tag) { return new Element(tag, document); }, getElementById(id) { return document.body.id === id ? document.body : document.body.querySelector('#' + id); }, listeners: new Map(), addEventListener: Element.prototype.addEventListener, removeEventListener: Element.prototype.removeEventListener, dispatchEvent: Element.prototype.dispatchEvent }; document.body = new Element('body', document); document.activeElement = document.body; return document; }


// Runs the actual invitation controller and the actual shipped main-loop entry
// and visibility functions. Scene rendering is a counted contract stub: this
// audit makes no browser compositor / frame-rate claims.
function sourceFunction(source,start){
  const from=source.indexOf(start);assert(from>=0,'Missing '+start);
  const brace=source.indexOf('{',from);let depth=0,quote='',line=false,block=false;
  for(let i=brace;i<source.length;i++){
    const ch=source[i],next=source[i+1],previous=source[i-1];
    if(line){if(ch==='\n')line=false;continue;}
    if(block){if(previous==='*'&&ch==='/')block=false;continue;}
    if(quote){if(ch===quote&&previous!=='\\')quote='';continue;}
    if(ch==='/'&&next==='/'){line=true;i++;continue;}
    if(ch==='/'&&next==='*'){block=true;i++;continue;}
    if(ch==='"'||ch==="'"||ch==='`'){quote=ch;continue;}
    if(ch==='{')depth++;
    if(ch==='}'&&--depth===0)return source.slice(from,i+1);
  }throw Error('Unterminated '+start);
}
(async()=>{
  const main=fs.readFileSync(path.join(project,'src/main.js'),'utf8');
  const compiled=await require(path.join(deps,'esbuild')).build({stdin:{contents:"export {mountBirthdayInvitation} from './src/invitation-v8.js';",resolveDir:project},bundle:true,format:'cjs',platform:'node',write:false});
  let time=0,nextTimer=0,nextFrame=0,gesture=false,gestureCalls=0;
  const timers=new Map(),frames=new Map(),canceledFrames=[],windowEvents=new Map();
  function advance(ms){time+=ms;for(const [id,t]of [...timers])if(t.at<=time){timers.delete(id);t.fn();}}
  const document=documentModel();document.hidden=false;
  const context={module:{exports:{}},exports:{},document,console,performance:{now:()=>time},
    window:{addEventListener(type,fn){windowEvents.set(type,fn);},visualViewport:{addEventListener(){}}},
    requestAnimationFrame(fn){const id=++nextFrame;frames.set(id,fn);return id;},
    cancelAnimationFrame(id){canceledFrames.push(id);frames.delete(id);},
    setTimeout(fn,delay){const id=++nextTimer;timers.set(id,{fn,at:time+delay});return id;},
    clearTimeout(id){timers.delete(id);}};
  context.exports=context.module.exports;vm.runInNewContext(compiled.outputFiles[0].text,context);
  const {mountBirthdayInvitation}=context.module.exports;
  const blocks=['function startWorldLoop()','function queueFrame()','function bindEvents()'].map(key=>sourceFunction(main,key)).join('\n');
  vm.runInNewContext(`let loopStarted=false,frameRequest=0,backgroundRequest=0,worldDraws=0,clockStarts=0;const app={dataset:{}};const clock={start(){clockStarts++;}};function onResize(){}function animate(){loopStarted=true;worldDraws++;queueFrame();}\n${blocks}\nbindEvents();module.exports={startWorldLoop,stats:()=>({loopStarted,worldDraws,clockStarts,phase:app.dataset.sceneLoop})};`,context);
  const loop=context.module.exports;
  const invitation=mountBirthdayInvitation({onEnter(){assert(gesture,'Audio callback must remain in the actual Yes event stack');gestureCalls++;},onEntered:loop.startWorldLoop});
  const yes=invitation.element.querySelector('[data-iv-yes]');
  yes.click();advance(10000);assert.equal(gestureCalls,0);assert.equal(loop.stats().worldDraws,0);assert.equal(frames.size,0);
  invitation.setReady();advance(60000);assert.equal(loop.stats().worldDraws,0,'Scene continuously rendered under the ready invitation');
  for(const hidden of [true,false,true,false]){document.hidden=hidden;document.dispatchEvent({type:'visibilitychange'});}
  assert.equal(frames.size,0);assert.equal(timers.size,0,'Visibility woke the world before Yes');
  gesture=true;yes.click();gesture=false;assert.equal(gestureCalls,1);assert.equal(loop.stats().worldDraws,0,'Yes began WebGL before invitation faded');
  yes.dispatchEvent({type:'click'});assert.equal(gestureCalls,1,'Repeated Yes lost idempotence');
  advance(949);assert.equal(loop.stats().worldDraws,0);assert(!invitation.element.hidden);
  advance(1);assert(invitation.element.hidden);assert.equal(loop.stats().worldDraws,1);assert.equal(loop.stats().clockStarts,1);assert.equal(loop.stats().phase,'running');assert.equal(frames.size,1);
  loop.startWorldLoop();loop.startWorldLoop();assert.equal(loop.stats().clockStarts,1);assert.equal(loop.stats().worldDraws,1,'Loop started twice');
  document.hidden=true;document.dispatchEvent({type:'visibilitychange'});assert.equal(frames.size,0);assert.equal(timers.size,1,'Hidden active scene should have one coarse wake timer');
  document.hidden=false;document.dispatchEvent({type:'visibilitychange'});assert.equal(timers.size,0);assert.equal(frames.size,1,'Return from background should schedule exactly one frame');
  const frame=frames.entries().next().value;frames.delete(frame[0]);frame[1](time);assert.equal(loop.stats().worldDraws,2);assert.equal(frames.size,1);
  let errorStarts=0;const error=mountBirthdayInvitation({onEntered:()=>errorStarts++});error.showError('test');error.setReady();error.element.querySelector('[data-iv-yes]').dispatchEvent({type:'click'});advance(2000);assert.equal(errorStarts,0);error.destroy();
  let destroyedStarts=0;const destroyed=mountBirthdayInvitation({onEntered:()=>destroyedStarts++});destroyed.setReady();destroyed.element.querySelector('[data-iv-yes]').click();destroyed.destroy();advance(2000);assert.equal(destroyedStarts,0,'Destroy did not cancel deferred loop start');
  let failedDuringFadeStarts=0;const failedDuringFade=mountBirthdayInvitation({onEntered:()=>failedDuringFadeStarts++});failedDuringFade.setReady();failedDuringFade.element.querySelector('[data-iv-yes]').click();failedDuringFade.showError('fade failure');advance(2000);assert.equal(failedDuringFadeStarts,0,'Error during fade still started 3D');failedDuringFade.destroy();
  const init=sourceFunction(main,'function init()');assert(!/\banimate\s*\(/.test(init),'Initialization still launches a continuous render loop');assert(!/\bqueueFrame\s*\(/.test(init),'Initialization secretly queues world frames');assert(/onEntered\s*:\s*startWorldLoop/.test(main));
  assert(init.includes('renderer.initTexture(texture)'));assert(init.includes('camera.position.copy(cabin.interiorCamera)'));assert(init.includes('await birthday.effects.prepare(renderer)'));
  const mainAnimation=sourceFunction(main,'function animate(now)');assert(mainAnimation.includes('renderWorld()'),'The real active world loop was removed');
  const report={success:true,kind:'Actual invitation + main loop entry/visibility CPU behavior; rendering is a contract counter, browser performance requires separate evidence',beforeYesContinuousDraws:0,fadeContinuousDrawsAt949ms:0,worldStartsAfter950ms:1,audioCallbackSynchronous:true,sceneClockReset:true,visibilityCannotBypassGate:true,oneRafAfterVisibilityResume:true,errorAndDestroyCancelEntry:true,doorAndHandPrewarmRetained:true,checks:['loading and ready invitation schedule zero world frames','background transitions cannot start the world before Yes','audio begins in the real click stack','950ms visual exit precedes world-loop start','world loop starts once and resets its clock','active visibility changes retain a single frame/timer','errors including fade error cannot start the world','destroy cancels pending entry','real init retains texture upload, hands compile and indoor prewarm']};
  fs.writeFileSync(path.join(delivery,'invitation-performance-audit-v10.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
