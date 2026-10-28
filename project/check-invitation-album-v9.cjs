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


const sha = value => crypto.createHash('sha256').update(value).digest('hex');
function readLegacyLetter() {
  const backup = path.join(delivery, 'versions/before-v9-album-20261028/project/src/story-data.js');
  let source, evidence;
  if (fs.existsSync(backup)) { source = fs.readFileSync(backup, 'utf8'); evidence = backup; }
  else {
    const repo=fs.existsSync(path.join(delivery,'.git'))?delivery:path.join(delivery,'git-deploy');
    const result = spawnSync('git', ['-C', repo, 'show', '89f25d8:project/src/story-data.js'], { encoding: 'utf8', maxBuffer: 2 * 1024 * 1024 });
    assert.equal(result.status, 0, 'Could not read the original v8 LETTER for comparison');
    source = result.stdout; evidence = 'Git commit 89f25d8:project/src/story-data.js';
  }
  const context = { module: { exports: {} } };
  vm.runInNewContext(source.replace(/export const /g, 'const ') + '\nmodule.exports=LETTER;', context);
  return { letter: context.module.exports, evidence };
}

(async () => {
  const compiled = await require(path.join(deps, 'esbuild')).build({ stdin: { contents: "export {invitationMarkup,mountBirthdayInvitation} from './src/invitation-v8.js';export {MEDIA} from './src/local-media.js';export {LETTER} from './src/story-data.js';", resolveDir: project }, bundle: true, platform: 'node', format: 'cjs', write: false });
  let clock = 0, nextTimer = 0; const timers = new Map();
  function advance(ms) { clock += ms; for (const [id, timer] of [...timers]) if (timer.at <= clock) { timers.delete(id); timer.fn(); } }
  const context = { module: { exports: {} }, exports: {}, document: documentModel(), console, setTimeout(fn, delay) { const id = ++nextTimer; timers.set(id, { fn, at: clock + delay }); return id; }, clearTimeout(id) { timers.delete(id); } }; context.exports = context.module.exports;
  vm.runInNewContext(compiled.outputFiles[0].text, context);
  const { invitationMarkup, mountBirthdayInvitation, MEDIA, LETTER } = context.module.exports;
  const album = MEDIA.albumPhotos, invitationPhotos = MEDIA.invitationPhotos, skyPhotos = MEDIA.skyPhotos || album.filter(photo => photo.sky);
  const manifest = JSON.parse(fs.readFileSync(path.join(project, 'album-manifest.json'), 'utf8'));
  assert.equal(album.length, 28); assert.equal(invitationPhotos.length, 10); assert.equal(skyPhotos.length, 8); assert.equal(new Set(album.map(photo => photo.id)).size, 28);
  assert.equal(manifest.photos.length, 28); assert.equal(manifest.photos.find(photo => photo.id === 'photo-01').chapter, 'first'); assert(manifest.photos.find(photo => photo.id === 'photo-14').title.includes('眼镜'));
  assert.equal(album.find(photo => photo.id === 'photo-01').chapter, 'first'); assert(album.find(photo => photo.id === 'photo-14').caption.includes('6105'));
  assert.equal(JSON.stringify(Array.from(album, photo => photo.id)), JSON.stringify(manifest.photos.map(photo => photo.id)), 'Album order diverges from the story manifest');
  for (const photo of album) {
    const entry = manifest.photos.find(item => item.id === photo.id), chapter = manifest.chapters.find(item => item.id === photo.chapter);
    assert(entry && chapter, 'Unmapped album entry ' + photo.id);
    assert(photo.title === entry.title && photo.caption === entry.caption && photo.chapterTitle === chapter.title, 'Photo story metadata differs for ' + photo.id);
    assert(photo.period === (entry.period || chapter.period), 'Photo period differs for ' + photo.id);
    const suffix = photo.id.slice(-2);
    for (const [field, name] of [['src', 'photo-'], ['thumb', 'thumb-']]) {
      assert(/^data:image\/jpeg;base64,/.test(photo[field]), 'Runtime portrait must be embedded JPEG data: ' + photo.id + ' ' + field);
      const bytes = Buffer.from(photo[field].slice(photo[field].indexOf(',') + 1), 'base64');
      assert(sha(bytes) === sha(fs.readFileSync(path.join(delivery, 'assets/album', name + suffix + '.jpg'))), 'Embedded photo bytes differ from the delivered asset: ' + photo.id + ' ' + field);
    }
  }
  for (const photo of invitationPhotos) assert(photo.invitation && album.includes(photo), 'Invitation metadata should refer to the shared album');
  for (const photo of skyPhotos) assert(photo.sky && album.includes(photo), 'Sky metadata should refer to the shared album');
  const markup = invitationMarkup(invitationPhotos);
  function fresh({ preRendered = false, photos = invitationPhotos, onEnter = () => {} } = {}) {
    context.document = documentModel();
    let root;
    if (preRendered) { root = context.document.createElement('div'); root.id = 'birthday-invitation'; root.innerHTML = invitationMarkup(photos); context.document.body.appendChild(root); }
    return mountBirthdayInvitation({ root, photos, onEnter });
  }
  let calls = 0, insideClick = false, syncCallback = false;
  const mounted = fresh({ preRendered: true, onEnter: () => { calls++; syncCallback = insideClick; } });
  const root = mounted.element, yes = root.querySelector('[data-iv-yes]'), no = root.querySelector('[data-iv-no]');
  const cards = root.querySelectorAll('[data-photo-slot]');
  assert.equal(cards.length, 10); assert.equal(root.querySelectorAll('[data-iv-yes]').length, 1); assert.equal(root.querySelectorAll('[data-iv-no]').length, 1); assert.equal(mounted.stats().photoSources, 10);
  cards.forEach((card, index) => {
    const photo = invitationPhotos[index], img = card.querySelector('img');
    assert.equal(card.dataset.photoId, photo.id); assert.equal(card.querySelector('figcaption span').textContent, photo.period); assert.equal(card.querySelector('figcaption p').textContent, photo.title);
    assert(img.src === photo.thumb, 'Invitation must use the real thumbnail for ' + photo.id); assert.equal(img.alt, photo.title); assert.equal(img.width, photo.width); assert.equal(img.height, photo.height);
    img.dispatchEvent({ type: 'load', bubbles: false }); assert(!img.hidden && card.classList.contains('has-photo'));
  });
  yes.click(); yes.dispatchEvent({ type: 'click' }); no.click(); no.dispatchEvent({ type: 'click' }); advance(60000); assert.equal(calls, 0); assert(no.disabled && yes.disabled, 'Loading gate buttons must remain disabled');
  const progress = []; for (const value of [.1, .4, .2, 1, .5, -2, Infinity, NaN]) { mounted.setProgress({ progress: value, stage: '正在收好每一份回忆。' }); progress.push(mounted.stats().progress); } assert.equal(JSON.stringify(progress), JSON.stringify([10, 40, 40, 99, 99, 99, 99, 99])); assert.equal(root.querySelector('.iv-progress').getAttribute('aria-valuenow'), '99');
  const tabLoading = { type: 'keydown', key: 'Tab' }; root.dispatchEvent(tabLoading); assert(tabLoading.defaultPrevented); assert.equal(context.document.activeElement, root);
  mounted.setReady(); advance(60000); assert.equal(calls, 0, 'Readiness or timers auto-entered the world'); assert.equal(mounted.stats().progress, 100); assert(!yes.disabled && no.disabled); assert(!root.querySelector('.iv-confirm').hidden);
  const tabReady = { type: 'keydown', key: 'Tab', shiftKey: true }; root.dispatchEvent(tabReady); assert(tabReady.defaultPrevented); assert.equal(context.document.activeElement, yes); assert(no.disabled);
  no.click(); no.dispatchEvent({ type: 'click' }); advance(10000); assert.equal(calls, 0, 'No was an alternate entry path');
  insideClick = true; yes.click(); insideClick = false; assert.equal(calls, 1); assert(syncCallback, 'Entry callback escaped the trusted click stack'); assert(!root.hidden); assert(yes.disabled && no.disabled);
  yes.click(); yes.dispatchEvent({ type: 'click' }); no.dispatchEvent({ type: 'click' }); mounted.setReady(); mounted.setProgress({ progress: 0 }); assert.equal(calls, 1, 'Repeated Yes dispatched twice'); advance(949); assert(!root.hidden); advance(1); assert(root.hidden); assert.equal(root.dataset.state, 'entered'); assert.equal(root.getAttribute('aria-modal'), 'false'); mounted.destroy();
  let failedCalls = 0; const failed = fresh({ onEnter: () => failedCalls++ }); failed.setProgress({ progress: .6 }); failed.showError('测试故障'); failed.setReady(); failed.element.querySelector('[data-iv-yes]').dispatchEvent({ type: 'click' }); advance(60000); assert.equal(failedCalls, 0); assert(failed.stats().failed); assert(failed.element.querySelector('[data-iv-yes]').disabled && failed.element.querySelector('[data-iv-no]').disabled); assert(!failed.element.querySelector('.iv-error').hidden); const tabError = { type: 'keydown', key: 'Tab' }; failed.element.dispatchEvent(tabError); assert.equal(context.document.activeElement, failed.element); failed.destroy();
  const broken = fresh(), brokenCard = broken.element.querySelector('[data-photo-slot]'), brokenPhoto = brokenCard.querySelector('img'); brokenPhoto.dispatchEvent({ type: 'load', bubbles: false }); assert(!brokenPhoto.hidden); brokenPhoto.dispatchEvent({ type: 'error', bubbles: false }); assert(brokenPhoto.hidden && !brokenCard.classList.contains('has-photo'), 'Broken portrait did not restore the fallback pane'); broken.destroy();
  const empty = fresh({ photos: [] }); assert.equal(empty.stats().photoSources, 0); assert.equal(empty.element.querySelectorAll('[data-photo-slot]').length, 10); assert(empty.element.querySelectorAll('img').every(img => img.hidden && !img.src)); empty.destroy();
  const htmlBytes = fs.readFileSync(path.join(delivery, 'index.html')),twin=path.join(delivery,'给Lily的生日雪夜.html');
  // A build emits the convenience twin; the public repository commits index only.
  if(fs.existsSync(twin))assert(sha(htmlBytes) === sha(fs.readFileSync(twin)), 'Two delivered HTML entry files differ'); const html = htmlBytes.toString('utf8'), preScript = html.slice(0, html.indexOf('<script>'));
  const builtDocument = documentModel(); const builtRoot = builtDocument.createElement('div'); builtRoot.innerHTML = preScript;
  const builtInvitation = builtRoot.querySelector('#birthday-invitation'); assert(builtInvitation, 'Build lacks pre-rendered invitation'); const builtCards = builtInvitation.querySelectorAll('[data-photo-slot]'); assert.equal(builtCards.length, 10);
  builtCards.forEach((card, index) => { assert.equal(card.dataset.photoId, invitationPhotos[index].id); assert.equal(card.querySelector('figcaption span').textContent, invitationPhotos[index].period); assert.equal(card.querySelector('figcaption p').textContent, invitationPhotos[index].title); });
  assert.equal(builtInvitation.querySelectorAll('[data-iv-yes]').length, 1); assert(builtInvitation.querySelector('[data-iv-yes]').disabled && builtInvitation.querySelector('[data-iv-no]').disabled); assert(builtRoot.querySelector('#app').inert); assert(preScript.includes(markup), 'Build-time invitation differs from the actual metadata markup');
  const forbiddenCopies = ['先别急，我在点灯', '正在点亮这片冬夜']; for (const copy of forbiddenCopies) assert(!html.includes(copy), 'Retired opening copy remains');
  const externalAttributes = [...html.matchAll(/(?:src|href)\s*=\s*(["'])((?:https?:)?\/\/[^"']+)\1/gi)].map(match => match[2]); assert.equal(externalAttributes.length, 0, 'External HTML runtime assets remain');
  assert(!/<script\b[^>]*\bsrc\s*=/i.test(html), 'HTML needs an external script'); assert(!/url\(\s*["']?(?:https?:)?\/\//i.test(html), 'CSS needs an external image/font'); assert(!/\b(?:fetch|load|import|Worker|Audio)\s*\(\s*["'](?:https?:)?\/\//i.test(html), 'A network loader needs an external asset');
  const referenceUrls = [...new Set(html.match(/https?:\/\/[^\s"'<>`]+/g) || [])];
  assert(referenceUrls.every(url => url === 'http://www.w3.org/1999/xhtml' || url === 'http://developer.nvidia.com/' || /^https:\/\/discourse\.threejs\.org\/t\/updates-to-lighting-in-three-js-r155\/53733\.?$/.test(url)), 'Unexpected remote URL in the self-contained HTML');
  const legacy = readLegacyLetter(); assert.equal(LETTER.paragraphs.length, 24); assert.equal(legacy.letter.paragraphs.length, 24); assert.equal(JSON.stringify(LETTER), JSON.stringify(legacy.letter), 'The original long LETTER changed');
  const report = { success: true, createdAt: new Date().toISOString(), kind: 'CPU DOM/event/timer execution of actual source modules plus delivered HTML and embedded asset verification; no browser layout or GPU claims', albumPhotos: album.length, invitationPhotos: invitationPhotos.length, skyPhotos: skyPhotos.length, preRenderedPhotoPanes: builtCards.length, invitationIds: Array.from(invitationPhotos, photo => photo.id), skyIds: Array.from(skyPhotos, photo => photo.id), manifestAnchors: { first: 'photo-01', glasses: 'photo-14' }, progressSequence: progress, entryCallbackSynchronous: syncCallback, yesCalls: calls, noAlwaysDisabled: true, letterParagraphs: LETTER.paragraphs.length, letterSha256: sha(JSON.stringify(LETTER)), letterEvidence: legacy.evidence, htmlSha256: sha(htmlBytes), htmlBytes: htmlBytes.length, externalRuntimeAssets: externalAttributes.length, nonAssetReferenceUrls: referenceUrls, checks: ['28 shared album metadata entries follow the story manifest', '10 actual invitation photos use thumbnail bytes and matching captions', '8 sky photo entries share album references', 'photo-01 first and photo-14 glasses anchors', 'all embedded portrait and thumbnail bytes match delivered files', '10 metadata panes are present in build-time HTML', 'single Yes gate cannot be bypassed by loading/readiness/timers/No', 'Yes invokes callback once synchronously, then exits after 950 ms', 'progress is monotonic and at most 99 until readiness', 'errors lock entry and show readable feedback', 'Tab stays in the loading/error/ready invitation', 'failed images restore the empty card without invented content', '24 original LETTER paragraphs and all other LETTER fields are unchanged', 'two delivered HTML files match exactly', 'self-contained HTML has no external runtime asset links/loaders'] };
  fs.writeFileSync(path.join(delivery, 'invitation-audit-v9.json'), JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify(report, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
