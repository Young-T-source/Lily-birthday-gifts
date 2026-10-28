'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const project = __dirname;
const deps = fs.existsSync(path.join(project, 'node_modules/esbuild')) ? path.join(project, 'node_modules') : 'C:/页面/winter-cabin-build/node_modules';

// Executes the actual bundled module in a CPU DOM/event model. This does not claim
// browser layout, image decoding, accessibility-tree or GPU verification.
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

(async () => {
  const compiled = await require(path.join(deps, 'esbuild')).build({ stdin: { contents: "export {mountBirthdayUI} from './src/birthday-ui.js';export {STORIES, LETTER, BIRTHDAY_NOTE} from './src/story-data.js';", resolveDir: project }, bundle: true, platform: 'node', format: 'cjs', write: false });
  const timers = new Map(); let timerId = 0;
  const context = { module: { exports: {} }, exports: {}, document: documentModel(), window: { location: { search: '' } }, URLSearchParams, console, setTimeout(fn) { timers.set(++timerId, fn); return timerId; }, clearTimeout(id) { timers.delete(id); } }; context.exports = context.module.exports;
  vm.runInNewContext(compiled.outputFiles[0].text, context);
  const { mountBirthdayUI, STORIES, LETTER, BIRTHDAY_NOTE } = context.module.exports;
  const photos = Array.from({ length: 28 }, (_, i) => ({ id: `photo-${String(i + 1).padStart(2, '0')}`, src: `assets/album/photo-${String(i + 1).padStart(2, '0')}.jpg`, thumb: `assets/album/thumb-${String(i + 1).padStart(2, '0')}.jpg`, width: i === 9 ? 275 : 1400, height: i === 9 ? 207 : 1050, aspect: 4 / 3, title: i === 0 ? '留住 <Lily> 的笑' : `片刻 ${i + 1}`, caption: `这一张的回忆 ${i + 1}`, chapter: `chapter-${Math.floor(i / 4) + 1}`, chapterTitle: `回忆章节 ${Math.floor(i / 4) + 1}`, period: `那段时光 ${Math.floor(i / 4) + 1}`, order: i }));
  const openings = []; let closes = 0, begins = 0;
  const ui = mountBirthdayUI({ albumPhotos: [...photos].reverse(), onOpen: id => openings.push(id), onClose: () => closes++, onBegin: () => begins++ });
  const root = context.document.getElementById('birthday-ui'), query = s => root.querySelector(s), reader = query('.bd-reader');
  const key = (name, shiftKey = false) => { const event = { type: 'keydown', key: name, shiftKey }; context.document.dispatchEvent(event); return event; };
  const title = () => query('#bd-reader-title').textContent;
  const active = () => query('.bd-album-position').textContent;
  assert(root.inert && query('.bd-hud').hidden); assert.equal(ui.begin(), false); ui.setReady(); assert.equal(begins, 0); assert.equal(ui.begin(), true); assert.equal(ui.begin(), false); assert.equal(begins, 1);
  assert.equal(ui.openLetter(), false, 'Secret letter opened before the tree touch'); assert(!ui.isOpen()); assert.equal(openings.length, 0);
  query('[data-action="birthday-note"]').click(); assert(ui.isOpen()); assert(reader.classList.contains('bd-note-reader')); assert.equal(title(), BIRTHDAY_NOTE.title); assert(query('.bd-story-body').textContent.includes(BIRTHDAY_NOTE.paragraphs[0])); assert(!query('.bd-story-body').textContent.includes(LETTER.paragraphs[1]));
  ui.close(); assert.equal(closes, 1);
  ui.openStory('courage'); assert(query('.bd-reader-footer').textContent.includes('最后一条线索')); ui.openStory('letter'); assert.equal(title(), STORIES.at(-1).title); assert(!reader.classList.contains('bd-letter-reader')); assert(query('.bd-reader-footer').textContent.includes('回到雪地，寻找线索')); assert.equal(query('.bd-reader-footer').querySelectorAll('[data-story]').length, 0); ui.close();
  const returnFocus = query('[data-action="birthday-note"]'); returnFocus.focus(); const beforeAlbumOpen = openings.length, beforeAlbumClose = closes;
  assert.equal(ui.openAlbum('photo-10'), true); assert.equal(active(), '10 / 28'); assert.equal(openings.length, beforeAlbumOpen + 1); assert(query('.bd-hud').inert); assert.equal(query('.bd-album-frame img').getAttribute('width'), '275'); assert.equal(root.querySelectorAll('[data-album-photo]').length, 28); assert.equal(root.querySelectorAll('[data-album-chapter]').length, 7);
  assert.deepEqual(root.querySelectorAll('[data-album-photo]').map(el => el.dataset.albumPhoto), photos.map(photo => photo.id), 'Album chronology ignored order');
  const right = key('ArrowRight'); assert(right.defaultPrevented && right.stopped); assert.equal(active(), '11 / 28'); key('ArrowLeft'); assert.equal(active(), '10 / 28');
  query('[data-album-photo="photo-28"]').click(); assert.equal(active(), '28 / 28'); assert(query('[data-action="album-next"]').disabled); query('[data-action="album-next"]').click(); key('ArrowRight'); assert.equal(active(), '28 / 28');
  query('[data-album-photo="photo-01"]').click(); assert.equal(active(), '01 / 28'); assert.equal(title(), photos[0].title); assert.equal(query('.bd-album-frame img').getAttribute('src'), photos[0].src); assert(query('[data-action="album-prev"]').disabled); key('ArrowLeft'); assert.equal(active(), '01 / 28');
  query('[data-album-chapter="chapter-4"]').click(); assert.equal(active(), '13 / 28'); assert.equal(query('.bd-album-caption').textContent, photos[12].caption); assert.equal(query('[data-album-chapter="chapter-4"]').getAttribute('aria-pressed'), 'true'); assert.equal(query('[data-album-photo="photo-13"]').getAttribute('aria-pressed'), 'true');
  const brokenImage = query('.bd-album-frame img'); brokenImage.dispatchEvent({ type: 'error', bubbles: false }); assert(brokenImage.hidden && !query('.bd-album-error').hidden); query('[data-action="album-next"]').click(); assert(!query('.bd-album-error').hidden === false); assert(!query('.bd-album-frame img').hidden);
  reader.focus(); const tab = key('Tab'); assert(tab.defaultPrevented); assert.equal(context.document.activeElement, query('.bd-close')); key('Tab', true); assert.equal(context.document.activeElement, query('[data-action="album-next"]')); key('Tab'); assert.equal(context.document.activeElement, query('.bd-close'));
  assert.equal(openings.length, beforeAlbumOpen + 1, 'Photo navigation repeatedly paused/cancelled the scene'); assert.equal(closes, beforeAlbumClose);
  key('Escape'); assert(!ui.isOpen()); assert(!query('.bd-hud').inert); assert.equal(context.document.activeElement, returnFocus); assert.equal(closes, beforeAlbumClose + 1); ui.close(); assert.equal(closes, beforeAlbumClose + 1);
  ui.openAlbum('missing-id'); assert.equal(active(), '14 / 28'); ui.openBirthdayNote(); assert(reader.classList.contains('bd-note-reader') && !reader.classList.contains('bd-album-reader')); assert(!query('.bd-reader-overlay').classList.contains('bd-album-overlay')); ui.openStory('arrival'); assert(!reader.classList.contains('bd-note-reader')); assert.equal(ui.openLetter(), false); assert.equal(title(), STORIES[0].title);
  ui.unlockSecretLetter(); assert.equal(ui.openLetter(), true); assert(reader.classList.contains('bd-letter-reader')); assert(query('.bd-letter-body').textContent.includes(LETTER.paragraphs[1])); ui.openStory('letter'); assert.equal(title(), STORIES.at(-1).title, 'Clue chapter bypassed the treasure even after unlock'); ui.close();
  ui.destroy(); assert(!context.document.getElementById('birthday-ui')); assert.equal((context.document.listeners.get('keydown') || []).length, 0);
  let noteCalls = 0, visitCalls = 0, albumCalls = 0; const routed = mountBirthdayUI({ onBirthdayNote: () => noteCalls++, onVisitAlbum: () => visitCalls++, onAlbum: () => albumCalls++ }); const routedRoot = context.document.getElementById('birthday-ui'); for (const action of ['birthday-note', 'visit-album', 'album']) routedRoot.querySelector(`[data-action="${action}"]`).click(); assert.deepEqual([noteCalls, visitCalls, albumCalls], [1, 1, 1]); assert(!routed.isOpen()); routed.destroy();
  let emptyPauses = 0; const empty = mountBirthdayUI({ onOpen: () => emptyPauses++ }); assert.equal(empty.openAlbum(), false); assert(!empty.isOpen()); assert.equal(emptyPauses, 0); empty.destroy();
  const css = fs.readFileSync(path.join(project, 'src/album-v9.css'), 'utf8'); assert(css.includes('object-fit: contain')); assert(css.includes('var(--album-native-width)') && css.includes('var(--album-native-height)')); assert(css.includes('(orientation: portrait)') && css.includes('(orientation: landscape)'));
  console.log(JSON.stringify({ success: true, kind: 'CPU DOM/event model running actual source modules; no browser layout or GPU assertions', photos: 28, chapters: 7, albumOpenCallbacksDuringNavigation: 1, checks: ['explicit entry gate remains intact', '28 photos sort by supplied order', 'full-source image and native dimensions retained', 'thumbnail and chapter navigation update image and story', 'ArrowLeft/Right stay bounded', 'no repeated scene pause while flipping photos', 'Escape closes once and restores focus', 'Tab and Shift+Tab remain in modal', 'broken photo provides readable fallback', 'public birthday note and callbacks route correctly', 'chapter 7 is a clue with a safe final footer', 'secret letter requires explicit unlock', 'reader modes clean up on every view switch', 'empty album does not pause the scene', 'destroy removes document key listener', 'portrait and landscape styles present'] }, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
