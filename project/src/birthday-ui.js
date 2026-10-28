import { STORIES, LETTER, BIRTHDAY_NOTE, RECEIVER } from './story-data.js';
import { PERSONAL } from './personal.js';

/** The interface belongs to the scene; the host owns walking, sound and assets. */
export function mountBirthdayUI(callbacks = {}) {
  const previousRoot = document.getElementById('birthday-ui');
  if (previousRoot) previousRoot.remove();
  const root = document.createElement('div');
  root.id = 'birthday-ui';
  root.className = 'bd-root';
  root.inert = true;
  const isEditor = new URLSearchParams(window.location.search).get('edit') === '1';
  let currentId = null;
  let opened = false;
  let begun = false;
  let ready = false;
  let nearTarget = null;
  let musicAvailable = false;
  let musicPlaying = false;
  let ambienceEnabled=false;
  let focusBeforeReader = null;
  let secretUnlocked = false;
  let readerMode = 'story';
  let albumIndex = 0;
  const albumPhotos = (Array.isArray(callbacks.albumPhotos) ? callbacks.albumPhotos : [])
    .filter(photo => photo && typeof photo.src === 'string' && photo.src)
    .map((photo, index) => ({ ...photo, id: String(photo.id || `photo-${index + 1}`), chapter: String(photo.chapter || 'memories'), order: Number.isFinite(Number(photo.order)) ? Number(photo.order) : index }))
    .sort((a, b) => a.order - b.order);
  const albumChapters = [...new Set(albumPhotos.map(photo => photo.chapter))];
  let progress = new Set();
  const esc = (value = '') => String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const arrow = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15m-5-5 5 5-5 5"/></svg>';
  const star = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2 2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4Z"/></svg>';
  root.innerHTML = `
    <div class="bd-hud" hidden>
      <header class="bd-wordmark">
        <span class="bd-wordmark-emblem" aria-hidden="true">✦</span>
        <div><span class="bd-wordmark-en">FOR LILY</span><h2>梦琪的生日雪夜</h2><p>2026.10.29 <span>·</span> HAPPY BIRTHDAY</p></div>
      </header>
      <div class="bd-top-actions">
        <button class="bd-quiet-button bd-house-button" type="button" data-action="house" aria-expanded="false" aria-controls="bd-house-menu">小屋里的心意 <span aria-hidden="true">⌂</span></button>
        <button class="bd-quiet-button" type="button" data-action="birthday-note">生日小笺 <span aria-hidden="true">↗</span></button>
        <button class="bd-icon-button bd-music" type="button" data-action="music" aria-label="背景音乐尚未添加" title="背景音乐尚未添加" aria-pressed="false"><span class="bd-music-bars" aria-hidden="true"><i></i><i></i><i></i></span><span class="bd-music-label">静候一首歌</span></button>
      </div>
      <aside class="bd-house-menu" id="bd-house-menu" hidden aria-label="小屋里的心意">
        <p>留给你的，都是小小的偏爱。</p><button type="button" data-action="birthday-signs">✦ 门前 · 生日祝福牌 <small>走近看看，为你写的祝福</small></button><button type="button" data-action="stairs">↗ 沿暖灯上二楼 <small>走上楼梯，去看另一份心意</small></button>
        <button type="button" data-action="birthday-room">❀ 二楼 · 生日祝福地毯 <small>把每一步，都铺上祝福</small></button>
        <button type="button" data-action="visit-album">▧ 二楼 · 我镜头里的你 <small>沿着照片，走过那些被记住的日子</small></button>
        <button type="button" data-action="album">▤ 翻看全部相册 <small>一张张打开，慢慢看</small></button>
        <button type="button" data-interior="interior-clock">♡ 粉色心形钟 <small>轻触，听时间慢下来</small></button>
        <button type="button" data-interior="interior-wardrobe">♧ 二楼 · 公主的衣柜 <small>打开，看看为你准备的裙子</small></button>
        <button type="button" data-interior="interior-gift">✧ 桌上的礼物 <small>亲手拆开这一份心意</small></button>
        <button type="button" data-interior="interior-tea">♨ 一杯甜甜的奶茶 <small>搅一搅，暖暖手</small></button>
        <button type="button" data-interior="interior-cake">✦ 生日小蛋糕 <small>许一个只属于你的愿望</small></button>
        <button type="button" data-interior="loft-book">♡ 二楼 · 我们的下一页 <small>亲手翻开，留给未来的空白</small></button><button type="button" data-interior="loft-rose">❀ 二楼 · 玫瑰音乐盒 <small>轻轻触碰，心意慢慢转动</small></button><span>点击前往 · 靠近后按 E 或轻点物件</span>
      </aside>
      <nav class="bd-map-shell" aria-label="回忆地图">
        <button class="bd-map-toggle" type="button" data-action="map" aria-expanded="false" aria-controls="bd-memory-map"><span class="bd-map-icon" aria-hidden="true">⌘</span><span>回忆地图 <small class="bd-progress-text">0 / 7</small></span><span class="bd-map-chevron" aria-hidden="true">⌃</span></button>
        <div class="bd-map-panel" id="bd-memory-map" hidden>
          <p class="bd-map-heading">沿着灯光，找回我们的故事</p>
          <p class="bd-map-caption">自由寻找，或点击一章前往</p>
          <ol>${STORIES.map((story, index) => `<li><button type="button" data-story="${esc(story.id)}" style="--chapter-color:${esc(story.color || '#d9c4a7')}"><span class="bd-chapter-number">${String(index + 1).padStart(2, '0')}</span><span class="bd-chapter-label"><span>${esc(story.title)}</span><small>${esc(story.date)}</small></span><span class="bd-chapter-check" aria-hidden="true">○</span></button></li>`).join('')}</ol>
          <p class="bd-map-bottom">七处回忆，一封还想继续写下去的信。</p>
        </div>
      </nav>
      <div class="bd-near" hidden><div class="bd-near-light" aria-hidden="true">✦</div><div><span class="bd-near-category">美好的回忆</span><strong class="bd-near-title"></strong></div><button type="button" data-action="near"><b class="bd-near-verb">打开</b> <span aria-hidden="true">E</span></button></div>
      <button class="bd-fireworks" type="button" data-action="fireworks">${star}<span>为你点亮天空</span></button>
      <div class="bd-show-controls" hidden><span>烟花之后，是一场为你的流星雨</span><button type="button" data-action="pause-show" aria-label="暂停天空表演">暂停</button></div>
      <button class="bd-cancel-touch" type="button" data-action="cancel-touch" hidden>收回手 <kbd>Esc</kbd></button>
      <div class="bd-world-caption" role="status" hidden></div>
      <section class="bd-ending" hidden><p>${esc(PERSONAL.lines.closing)}</p><div><button type="button" data-action="fireworks">再看一次</button><button type="button" data-action="save-keepsake">把今晚收好</button></div><small>2026.10.29 · 给 Lily 的雪夜</small></section>
      <div class="bd-wish-phase" hidden><span>MAKE A WISH</span><h3>流星替你，收好心愿。</h3><p>愿下一次睁开眼，喜欢的人和事都在身边。</p><i></i></div><p class="bd-personal-note">愿这一夜的温柔，都与你有关。</p>

    </div>
    <section class="bd-reader-overlay" hidden aria-label="回忆阅读器">
      <div class="bd-reader-backdrop" data-action="close"></div>
      <div class="bd-reader" role="dialog" aria-modal="true" aria-labelledby="bd-reader-title" tabindex="-1">
        <div class="bd-reader-toolbar"><span class="bd-reader-label">MEMORIES, KEPT WARM</span><button class="bd-close" type="button" data-action="close" aria-label="合上回忆，继续漫步"><span aria-hidden="true">×</span></button></div>
        <div class="bd-reader-scroll"></div>
        <footer class="bd-reader-footer"></footer>
      </div>
    </section>
    <div class="bd-toast" role="status" aria-live="polite"></div>
  `;
  document.body.appendChild(root);
  const q = selector => root.querySelector(selector);
  const readerOverlay = q('.bd-reader-overlay');
  const reader = q('.bd-reader');
  const readerScroll = q('.bd-reader-scroll');
  const readerFooter = q('.bd-reader-footer');
  let toastTimer;

  function toast(message) {
    q('.bd-toast').textContent = message;
    q('.bd-toast').classList.add('bd-toast-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => q('.bd-toast').classList.remove('bd-toast-visible'), 3800);
  }
  function setMap(expanded) {
    if(expanded){q('.bd-house-menu').hidden=true;q('[data-action="house"]').setAttribute('aria-expanded','false');}
    q('.bd-map-toggle').setAttribute('aria-expanded', String(expanded));
    q('.bd-map-panel').hidden = !expanded;
    root.classList.toggle('bd-map-open', expanded);
  }
  function navigate(id) {
    if (!STORIES.some(story => story.id === id)) return;
    setMap(false);
    if (callbacks.onNavigate) callbacks.onNavigate(id);
    else openStory(id);
  }
  function showReader(id) {
    q('.bd-house-menu').hidden=true;q('[data-action="house"]').setAttribute('aria-expanded','false');
    const firstOpen = !opened;
    if (firstOpen) focusBeforeReader = document.activeElement;
    currentId = id;
    opened = true;
    readerOverlay.hidden = false;
    q('.bd-hud').inert = true;
    root.classList.add('bd-reader-open');
    setMap(false);
    readerScroll.scrollTop = 0;
    reader.focus({ preventScroll: true });
    // Changing a page within the same reader must not pause/cancel the scene again.
    if (firstOpen) callbacks.onOpen?.(id);
  }
  function setReaderMode(mode) {
    readerMode = mode;
    reader.classList.remove('bd-letter-reader', 'bd-album-reader', 'bd-note-reader');
    if (mode !== 'story') reader.classList.add(`bd-${mode}-reader`);
    readerOverlay.classList.toggle('bd-album-overlay', mode === 'album');
    q('.bd-reader-label').textContent = mode === 'album' ? 'OUR DAYS, FRAME BY FRAME' : mode === 'note' ? 'A BIRTHDAY NOTE FOR LILY' : 'MEMORIES, KEPT WARM';
  }
  function openStory(id) {
    const story = STORIES.find(item => item.id === id);
    if (!story) return;
    const index = STORIES.indexOf(story);
    const nextStory = STORIES[index + 1];
    setReaderMode('story');
    reader.style.setProperty('--story-color', story.color || '#ddc7a3');
    readerScroll.innerHTML = `<article class="bd-story-article"><div class="bd-story-topline"><span>${esc(story.eyebrow)}</span><span class="bd-story-folio">${String(index + 1).padStart(2, '0')} / 07</span></div><p class="bd-story-date">${esc(story.date)}</p><h2 id="bd-reader-title">${esc(story.title)}</h2><div class="bd-story-divider"><span></span><i aria-hidden="true">${esc(story.icon)}</i><span></span></div><blockquote>${esc(story.quote)}</blockquote><div class="bd-story-body">${story.paragraphs.map(text => `<p>${esc(text)}</p>`).join('')}</div><p class="bd-story-endmark" aria-hidden="true">✦</p></article>`;
    readerFooter.innerHTML = `<button class="bd-text-button" type="button" data-action="close">合上回忆，继续漫步</button>${nextStory ? `<button class="bd-next-button" type="button" data-story="${esc(nextStory.id)}"><span>${nextStory.id === 'letter' ? '最后一条线索' : '下一段回忆'}</span>${arrow}</button>` : `<button class="bd-next-button" type="button" data-action="close"><span>回到雪地，寻找线索</span>${arrow}</button>`}`;
    showReader(id);
  }
  function openBirthdayNote() {
    setReaderMode('note');
    reader.style.setProperty('--story-color', '#eac6c5');
    readerScroll.innerHTML = `<article class="bd-letter-article bd-birthday-note"><div class="bd-story-topline"><span>HAPPY 21ST BIRTHDAY</span><span class="bd-story-folio">1029</span></div><p class="bd-story-date">${esc(RECEIVER.birthday)} · FOR LILY</p><h2 id="bd-reader-title">${esc(BIRTHDAY_NOTE.title)}</h2><div class="bd-story-divider"><span></span><i aria-hidden="true">✦</i><span></span></div><p class="bd-letter-salutation">${esc(BIRTHDAY_NOTE.salutation)}</p><div class="bd-story-body bd-letter-body">${BIRTHDAY_NOTE.paragraphs.map(text => `<p>${esc(text)}</p>`).join('')}</div><div class="bd-letter-signature"><span>${esc(BIRTHDAY_NOTE.signature)}</span><time datetime="2026-10-29">${esc(BIRTHDAY_NOTE.date)}</time></div></article>`;
    readerFooter.innerHTML = `<button class="bd-text-button" type="button" data-action="close">把祝福收好，继续逛逛</button><button class="bd-next-button" type="button" data-action="album"><span>去翻翻那些照片</span>${arrow}</button>`;
    showReader('birthday-note');
    return true;
  }
  function renderAlbumPhoto(index) {
    if (!albumPhotos.length) return;
    albumIndex = Math.max(0, Math.min(albumPhotos.length - 1, index));
    const photo = albumPhotos[albumIndex];
    currentId = `album:${photo.id}`;
    const width = Math.max(1, Number(photo.width) || 1400);
    const height = Math.max(1, Number(photo.height) || 1400);
    q('.bd-album-frame').innerHTML = `<img src="${esc(photo.src)}" alt="${esc(photo.title || '被珍藏的一刻')}" width="${width}" height="${height}" style="--album-native-width:${width}px;--album-native-height:${height}px" decoding="async" loading="eager"><p class="bd-album-error" hidden>这一张暂时没有加载出来，可以先翻下一张，再回来看看。</p>`;
    q('.bd-album-frame img').addEventListener('error', event => { event.target.hidden = true; q('.bd-album-error').hidden = false; }, { once: true });
    q('.bd-album-period').textContent = photo.period || photo.chapterTitle || '被记住的日子';
    q('#bd-reader-title').textContent = photo.title || '被珍藏的一刻';
    q('.bd-album-caption').textContent = photo.caption || '有些很平常的瞬间，后来成了很舍不得忘记的回忆。';
    q('.bd-album-position').textContent = `${String(albumIndex + 1).padStart(2, '0')} / ${String(albumPhotos.length).padStart(2, '0')}`;
    q('.bd-album-announcement').textContent = `第 ${albumIndex + 1} 张，共 ${albumPhotos.length} 张。${photo.title || '被珍藏的一刻'}`;
    q('[data-action="album-prev"]').disabled = albumIndex === 0;
    q('[data-action="album-next"]').disabled = albumIndex === albumPhotos.length - 1;
    root.querySelectorAll('[data-album-photo]').forEach(button => {
      const selected = button.dataset.albumPhoto === photo.id;
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    root.querySelectorAll('[data-album-chapter]').forEach(button => {
      const selected = button.dataset.albumChapter === photo.chapter;
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    const activeThumb = Array.from(root.querySelectorAll('[data-album-photo]')).find(button => button.dataset.albumPhoto === photo.id);
    activeThumb?.scrollIntoView?.({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }
  function openAlbum(photoId) {
    if (!albumPhotos.length) { toast('照片正在被妥帖地收进相册，稍后再来看看。'); return false; }
    const matched = albumPhotos.findIndex(photo => photo.id === photoId);
    const index = matched >= 0 ? matched : albumIndex;
    if (readerMode !== 'album' || !opened) {
      setReaderMode('album');
      reader.style.setProperty('--story-color', '#eac6c5');
      readerScroll.innerHTML = `<section class="bd-album-layout" aria-label="我们的照片相册"><div class="bd-album-main"><figure class="bd-album-figure"><div class="bd-album-frame"></div></figure><aside class="bd-album-details"><p class="bd-album-eyebrow">在我的镜头里，一直有你</p><p class="bd-album-period"></p><h2 id="bd-reader-title"></h2><p class="bd-album-caption"></p><nav class="bd-album-chapters" aria-label="按回忆章节翻看">${albumChapters.map(chapter => { const first = albumPhotos.find(photo => photo.chapter === chapter); return `<button type="button" data-album-chapter="${esc(chapter)}" aria-pressed="false">${esc(first.chapterTitle || chapter)}</button>`; }).join('')}</nav><p class="bd-album-hint">照片可以慢慢看，故事也可以慢慢想。</p></aside></div><nav class="bd-album-thumbnails" aria-label="选择照片">${albumPhotos.map((photo, index) => `<button type="button" data-album-photo="${esc(photo.id)}" aria-label="第${index + 1}张：${esc(photo.title || '被珍藏的一刻')}" aria-pressed="false"><img src="${esc(photo.thumb || photo.src)}" alt="" loading="lazy" decoding="async"><span>${String(index + 1).padStart(2, '0')}</span></button>`).join('')}</nav><p class="bd-album-announcement" aria-live="polite" aria-atomic="true"></p></section>`;
      readerFooter.innerHTML = `<button class="bd-text-button" type="button" data-action="close">合上相册，继续漫步</button><div class="bd-album-pagination"><button type="button" data-action="album-prev" aria-label="上一张照片">← <span>上一张</span></button><span class="bd-album-position"></span><button type="button" data-action="album-next" aria-label="下一张照片"><span>下一张</span> →</button></div>`;
    }
    renderAlbumPhoto(index);
    showReader(`album:${albumPhotos[albumIndex].id}`);
    return true;
  }
  function unlockSecretLetter() {
    secretUnlocked = true;
    return true;
  }
  function openLetter() {
    if (!secretUnlocked) { toast('还有一份安静的礼物，留在“属于你的那棵树”下。'); return false; }
    setReaderMode('letter');
    reader.style.setProperty('--story-color', '#eac6c5');
    readerScroll.innerHTML = `<article class="bd-letter-article"><div class="bd-story-topline"><span>CHAPTER 07 · 一封写给你的信</span><span class="bd-story-folio">07 / 07</span></div><p class="bd-story-date">${esc(RECEIVER.birthday)} · FOR MY DEAR LILY</p><h2 id="bd-reader-title">把没说出口的话，<br>慢慢说给你听</h2><div class="bd-story-divider"><span></span><i aria-hidden="true">♡</i><span></span></div><p class="bd-letter-salutation">${esc(LETTER.salutation)}</p><div class="bd-story-body bd-letter-body">${LETTER.paragraphs.map(text => `<p>${esc(text)}</p>`).join('')}</div><div class="bd-letter-signature"><span>${esc(LETTER.signature)}</span><time datetime="2026-10-29">${esc(LETTER.date)}</time></div><div class="bd-letter-postscript"><span aria-hidden="true">✦</span><p>你可以慢慢想，<br>今天先好好过生日。</p></div></article>`;
    readerFooter.innerHTML = `<button class="bd-text-button" type="button" data-action="close">把心意好好收下</button><button class="bd-next-button" type="button" data-action="fireworks-close"><span>为你点亮天空</span>${star}</button>`;
    showReader('secret-letter');
    return true;
  }
  function close() {
    if (!opened) return;
    opened = false;
    currentId = null;
    readerOverlay.hidden = true;
    q('.bd-hud').inert = false;
    setReaderMode('story');
    root.classList.remove('bd-reader-open');
    if (focusBeforeReader?.isConnected) focusBeforeReader.focus({ preventScroll: true });
    callbacks.onClose?.();
  }
  function setProgress(ids = []) {
    progress = new Set(ids instanceof Set ? Array.from(ids) : ids);
    q('.bd-progress-text').textContent = `${STORIES.filter(story => progress.has(story.id)).length} / ${STORIES.length}`;
    root.querySelectorAll('.bd-map-panel [data-story]').forEach(button => {
      const seen = progress.has(button.dataset.story);
      button.classList.toggle('bd-chapter-seen', seen);
      button.querySelector('.bd-chapter-check').textContent = seen ? '✓' : '○';
      button.setAttribute('aria-label', `${STORIES.find(story => story.id === button.dataset.story).title}${seen ? '，已读' : ''}`);
    });
  }
  function setNearTarget(target) {
    nearTarget = typeof target === 'string' ? { id: target } : target;
    const story = nearTarget ? STORIES.find(item => item.id === nearTarget.id) : null;
    q('.bd-near').hidden = !nearTarget;
    q('.bd-near-title').textContent = nearTarget ? (nearTarget.title || story?.title || '一段为你珍藏的故事') : '';
    q('.bd-near-category').textContent = nearTarget?.kind === 'interior' ? '小屋里的心意' : '美好的回忆';
    q('.bd-near-verb').textContent = nearTarget?.kind === 'interior' ? (nearTarget.action || '轻触') : '打开';
  }
  function setReady() {
    ready = true;
    root.classList.add('bd-ready');
  }
  function begin() {
    if(!ready||begun)return false;
    begun=true;
    root.inert=false;
    q('.bd-hud').hidden=false;
    root.classList.add('bd-has-begun');
    callbacks.onBegin?.();
    return true;
  }
  function refreshMusic() {
    const music = q('.bd-music');
    const on=musicAvailable?musicPlaying:ambienceEnabled;
    music.classList.toggle('bd-music-playing', on);
    music.setAttribute('aria-pressed', String(on));
    const label = musicAvailable ? (musicPlaying ? '音乐已开启' : '开启音乐') : (ambienceEnabled ? '环境声 · 开' : '环境声 · 关');
    q('.bd-music-label').textContent = label;
    music.setAttribute('aria-label', musicAvailable ? (musicPlaying ? '暂停背景音乐' : '播放背景音乐') : (ambienceEnabled ? '关闭环境声' : '开启环境声'));
    music.title = music.getAttribute('aria-label');
  }
  function setMusicPlaying(value) {
    musicPlaying = Boolean(value);
    refreshMusic();
  }
  function setMusicAvailable(value, title = '') {
    musicAvailable = Boolean(value);
    refreshMusic();
    if (musicAvailable && title) q('.bd-music').title = title;
  }
  const onClick = event => {
    const photoButton = event.target.closest('[data-album-photo]');
    if (photoButton && root.contains(photoButton)) {
      renderAlbumPhoto(albumPhotos.findIndex(photo => photo.id === photoButton.dataset.albumPhoto));
      return;
    }
    const chapterButton = event.target.closest('[data-album-chapter]');
    if (chapterButton && root.contains(chapterButton)) {
      renderAlbumPhoto(albumPhotos.findIndex(photo => photo.chapter === chapterButton.dataset.albumChapter));
      return;
    }
    const interiorButton = event.target.closest('[data-interior]');
    if (interiorButton && root.contains(interiorButton)) {
      q('.bd-house-menu').hidden = true;
      q('[data-action="house"]').setAttribute('aria-expanded', 'false');
      callbacks.onVisitInterior?.(interiorButton.dataset.interior);
      return;
    }
    const storyButton = event.target.closest('[data-story]');
    if (storyButton && root.contains(storyButton)) { navigate(storyButton.dataset.story); return; }
    const button = event.target.closest('[data-action]');
    if (!button || !root.contains(button)) return;
    switch (button.dataset.action) {
      case 'begin':
        begin();
        break;
      case 'map': setMap(q('.bd-map-toggle').getAttribute('aria-expanded') !== 'true'); break;
      case 'house': {
        const show = q('.bd-house-menu').hidden;
        q('.bd-house-menu').hidden = !show;
        q('[data-action="house"]').setAttribute('aria-expanded', String(show));
        setMap(false);
        break;
      }
      case 'stairs': q('.bd-house-menu').hidden=true;q('[data-action="house"]').setAttribute('aria-expanded','false');callbacks.onStairs?.();break;
      case 'birthday-note': if (callbacks.onBirthdayNote) callbacks.onBirthdayNote(); else openBirthdayNote(); break;
      case 'letter': openStory('letter'); break;
      case 'visit-album': q('.bd-house-menu').hidden=true;q('.bd-house-button').setAttribute('aria-expanded','false');if (callbacks.onVisitAlbum) callbacks.onVisitAlbum(); else openAlbum();break;
      case 'album': if (callbacks.onAlbum) callbacks.onAlbum(); else openAlbum();break;
      case 'album-prev': if (readerMode === 'album' && albumIndex > 0) renderAlbumPhoto(albumIndex - 1);break;
      case 'album-next': if (readerMode === 'album' && albumIndex < albumPhotos.length - 1) renderAlbumPhoto(albumIndex + 1);break;
      case 'close': close(); break;
      case 'near': if (nearTarget) { if (callbacks.onInteract) callbacks.onInteract(nearTarget.id); else navigate(nearTarget.id); } break;
      case 'fireworks-close': close(); callbacks.onFireworks?.(); break;
      case 'fireworks': callbacks.onFireworks?.(); break;
      case 'pause-show': callbacks.onPauseShow?.();break;
      case 'birthday-room': q('.bd-house-menu').hidden=true;q('.bd-house-button').setAttribute('aria-expanded','false');callbacks.onBirthdayRoom?.();break;
      case 'birthday-signs': q('.bd-house-menu').hidden=true;q('.bd-house-button').setAttribute('aria-expanded','false');callbacks.onBirthdaySigns?.();break;
      case 'skip-show': callbacks.onSkip?.();break;
      case 'cancel-touch': callbacks.onCancel?.();break;
      case 'save-keepsake': callbacks.onSave?.();break;
      case 'music':
        callbacks.onMusic?.();
        break;
      case 'music-edit': if (isEditor) callbacks.onMusic?.({ edit: true }); break;
      case 'photo-edit': if (isEditor) callbacks.onPhotoUpload?.(); break;
      default: break;
    }
  };
  const onKeydown = event => {
    if (event.key === 'Escape') {
      q('.bd-house-menu').hidden = true;
      q('[data-action="house"]').setAttribute('aria-expanded', 'false');
      if (opened) { event.preventDefault(); event.stopPropagation(); close(); }
      else setMap(false);
    }
    if (!opened) return;
    if (readerMode === 'album' && ['ArrowLeft', 'ArrowRight'].includes(event.key)) {
      event.preventDefault();
      event.stopPropagation();
      renderAlbumPhoto(albumIndex + (event.key === 'ArrowRight' ? 1 : -1));
      return;
    }
    if (event.key === 'Tab') {
      const focusables = Array.from(reader.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')).filter(el => !el.disabled && !el.closest('[hidden]') && !el.closest('[inert]'));
      const first = focusables[0]; const last = focusables.at(-1);
      if (!reader.contains(document.activeElement) || document.activeElement === reader) { event.preventDefault(); (event.shiftKey ? last : first)?.focus(); }
      else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    if (['w', 'a', 's', 'd', 'e', 'W', 'A', 'S', 'D', 'E', ' '].includes(event.key)) event.stopPropagation();
  };
  root.addEventListener('click', onClick);
  document.addEventListener('keydown', onKeydown);
  refreshMusic();
  return {
    openStory, openLetter, unlockSecretLetter, openBirthdayNote, openAlbum, close, setProgress, setNearTarget, setReady, begin,
    setWishPhase(on){q('.bd-wish-phase').hidden=!on;root.classList.toggle('bd-wishing',on);},
    setWishRemaining(seconds,duration=20){q('.bd-wish-phase i').style.setProperty('--wish-progress',String(Math.max(0,Math.min(1,(seconds||0)/duration))));const line=seconds>duration*2/3?'愿你一直有勇气，做自己喜欢的样子。':seconds>duration/3?'愿你的每一天，都有小小的甜。':'下一场雪，我还想陪你看。';if(q('.bd-wish-phase p').textContent!==line)q('.bd-wish-phase p').textContent=line;},
    setShowState(on){q('.bd-show-controls').hidden=!on;q('.bd-fireworks').hidden=on;root.classList.toggle('bd-show-active',on);},
    setShowPaused(paused){const button=q('[data-action="pause-show"]');button.textContent=paused?'继续':'暂停';button.setAttribute('aria-label',paused?'继续天空表演':'暂停天空表演');},
    setTouching(on){q('.bd-cancel-touch').hidden=!on;},
    setWorldCaption(text,point,on){const c=q('.bd-world-caption');c.hidden=!on;c.textContent=text||'';c.style.left=(point.x*100)+'%';c.style.top=(point.y*100)+'%';},
    setEnding(on){q('.bd-ending').hidden=!on;root.classList.toggle('bd-at-ending',on);if(on)q('.bd-fireworks').hidden=true;},
    setAudioState({available,enabled,playing}){if(musicAvailable===available&&ambienceEnabled===enabled&&musicPlaying===playing)return;musicAvailable=available;ambienceEnabled=enabled;musicPlaying=playing;refreshMusic();},
    isOpen: () => opened,
    setMusicPlaying, setMusicAvailable,
    destroy() { clearTimeout(toastTimer); root.removeEventListener('click', onClick); document.removeEventListener('keydown', onKeydown); root.remove(); }
  };
}
