const STAR = '<svg viewBox="0 0 28 28" aria-hidden="true"><path d="M14 1.5 17 11l9.5 3-9.5 3-3 9.5L11 17l-9.5-3 9.5-3Z" fill="currentColor"/></svg>';
const LILY = '<svg viewBox="0 0 84 102" aria-hidden="true"><path d="M42 84C32 66 10 60 16 39c14 0 22 11 26 27C46 50 54 39 68 39c6 21-16 27-26 45ZM42 67C24 48 27 27 42 15c15 12 18 33 0 52Zm0 15v16M42 96c-13-1-23-8-26-16 14 0 21 5 26 16Zm0-5c11-2 19-8 23-17-12 1-20 7-23 17Z" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const memories = [
  ['2024.08.15', '故事开始的那一天'], ['SEPTEMBER', '还记得那条淡黄色裙子'],
  ['YOU & ME', '一起走过的路'], ['SWEET MOMENTS', '一杯奶茶的甜'],
  ['OUR FIRSTS', '那些从零到一的瞬间'], ['KEEP IT CLOSE', '把温柔，好好收藏'],
  ['10 · 29', '你要爱久'], ['FOR LILY', '偏爱，留给你'],
  ['MAKE A WISH', '所有心愿，都值得期待'], ['BE THE LIGHT', '因为有怕黑的人'],
  ['CHAPTER 21', '你好，21 岁的 Lily'], ['TO BE CONTINUED', '我们的故事，还很长'],
  ['UNDER THE STARS', '许一个只属于你的心愿'], ['A LITTLE SWEET', '小蛋糕，和小小的幸福'],
  ['ALWAYS BESIDE YOU', '想陪你看更多的风景'], ['LOVE YOU LONG', '把以后，也交给时间']
];

/** Build-time markup makes the invitation visible before the 3D bundle boots. */
export function invitationMarkup(photos=[]) {
  const esc=v=>String(v||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const entries=photos.length?photos.slice(0,10).map(p=>[p.period,p.title,p.id]):memories.slice(0,10);
  const cards = entries.map(([date, caption,id], i) => `<div class="iv-orbit-card" style="--slot:${i};--card-delay:${-i * 10.4}s;--float-delay:${-i * .71}s" data-photo-slot="${i}" data-photo-id="${esc(id)}"><figure class="iv-photo-card"><div class="iv-photo-window"><img class="iv-photo" alt="${esc(caption)}" hidden><span class="iv-empty-photo">${LILY}<i></i><b>${String(i + 1).padStart(2, '0')}</b></span></div><figcaption><span>${esc(date)}</span><p>${esc(caption)}</p></figcaption></figure></div>`).join('');
  const stars = Array.from({length:36}, (_,i) => `<span class="iv-star" style="--x:${(i * 37 + 11) % 101}%;--y:${(i * 61 + 7) % 101}%;--delay:${-i * .63}s;--size:${i % 6 === 0 ? 7 : i % 3 === 0 ? 4 : 2}px">${i % 6 === 0 ? '✦' : ''}</span>`).join('');
  const confetti = Array.from({length:12}, (_,i) => `<i class="iv-confetti" style="--x:${(i * 29 + 6) % 100}%;--delay:${-i * 2.8}s;--turn:${i * 37}deg;--tint:${i % 3 === 0 ? '#dbaac0' : i % 3 === 1 ? '#f3d6a9' : '#e6a188'}"></i>`).join('');
  return `<div class="iv-night" aria-hidden="true"><div class="iv-halo iv-halo-one"></div><div class="iv-halo iv-halo-two"></div><div class="iv-constellation">${stars}${confetti}</div><div class="iv-ribbon iv-ribbon-one"></div><div class="iv-ribbon iv-ribbon-two"></div><div class="iv-orbit">${cards}</div></div>
    <header class="iv-masthead"><span>A FAIRYTALE, MADE FOR YOU</span><span>29 OCTOBER · 2026</span></header>
    <main class="iv-stage">
      <section class="iv-letter" aria-labelledby="iv-title">
        <div class="iv-letter-border" aria-hidden="true"></div>
        <div class="iv-letter-top"><span>DEAR LILY</span><span>CHAPTER <b>21</b></span></div>
        <div class="iv-flower" aria-hidden="true">${LILY}</div>
        <p class="iv-salutation">Happy Birthday,</p>
        <h1 id="iv-title">Lily<span class="iv-title-star" aria-hidden="true">${STAR}</span></h1>
        <p class="iv-title-caption">你好，闪闪发光的 <strong>21</strong> 岁。</p>
        <div class="iv-rule" aria-hidden="true"><i></i><span>✧</span><i></i></div>
        <p class="iv-world-copy">即将进入，一个用心的人<br>为你打造的<span>童话世界。</span></p>
        <blockquote class="iv-favourite"><span>“</span>要变成光，因为有怕黑的人。<span>”</span></blockquote>
        <p class="iv-october">10 月 29 日，你说是<span>「你要爱久」</span>。<br><em>这句话，我一刻也没有忘记。</em></p>
        <div class="iv-loading" aria-live="polite" aria-atomic="true">
          <div class="iv-progress" role="progressbar" aria-label="童话世界准备进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span></span></div>
          <p class="iv-loading-caption"><span data-iv-stage>这一刻，所有美好都在向你靠近。</span><b data-iv-progress>0%</b></p>
        </div>
        <div class="iv-confirm" hidden>
          <p class="iv-question">你准备好进入他为你打造的童话世界了吗？</p>
          <p class="iv-prepare">请做好心理准备！</p>
          <div class="iv-answers"><button class="iv-yes" type="button" data-iv-yes disabled><span>Yes</span><i aria-hidden="true">↗</i></button><button class="iv-no" type="button" data-iv-no disabled aria-label="no，今天只有 Yes 可选">no</button></div>
          <p class="iv-answer-note">今天，偏爱只为你留一个答案。</p>
        </div>
        <div class="iv-error" role="alert" hidden><p></p></div>
        <p class="iv-signature">WITH ALL MY HEART <span>♡</span></p>
      </section>
    </main>
    <footer class="iv-footer"><span>每一个被记住的小细节，都是喜欢。</span><span>ONLY FOR LILY <i>✦</i> FOREVER & A DAY</span></footer>`;
}

/** An explicit Yes is the sole way out. No timer can enter the 3D world. */
export function mountBirthdayInvitation({photos = [], onEnter, root = document.getElementById('birthday-invitation')} = {}) {
  if (!root) {
    root = document.createElement('div'); root.id = 'birthday-invitation';
    document.body.appendChild(root);
  }
  if (!root.querySelector('.iv-letter')) root.innerHTML = invitationMarkup(photos);
  root.classList.add('iv-root'); root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-labelledby', 'iv-title'); root.setAttribute('aria-busy', 'true'); root.tabIndex = -1;
  root.dataset.state = 'loading'; root.dataset.photos = '0';
  const q = selector => root.querySelector(selector);
  const yes = q('[data-iv-yes]'), no = q('[data-iv-no]');
  let ready = false, entered = false, progress = 0, failed = false, exitTimer;
  const sources = photos.map(p=>typeof p==='string'?{src:p}:p).filter(p=>typeof p?.src==='string'&&p.src.trim()).slice(0,10);
  const photoCards = [...root.querySelectorAll('[data-photo-slot]')];
  photoCards.forEach((card, i) => {
    if (!sources.length) return;
    const picture = card.querySelector('img');
    picture.addEventListener('load', () => { picture.hidden = false; card.classList.add('has-photo'); }, {once:true});
    picture.addEventListener('error', () => { picture.hidden = true; card.classList.remove('has-photo'); }, {once:true});
    const p=sources[i%sources.length];picture.decoding = 'async';picture.src=p.thumb||p.src;
    if(p.title)picture.alt=p.title;
    if(p.width&&p.height){picture.width=p.width;picture.height=p.height;}
  });
  root.dataset.photos = String(sources.length);
  function syncStats() {
    root.dataset.invitation = JSON.stringify({ready,entered,progress,failed,photoSources:sources.length,photoSlots:photoCards.length,noDisabled:no.disabled});
  }
  function setProgress({stage,progress:value} = {}) {
    if (entered || failed || ready) return;
    if (Number.isFinite(Number(value))) progress = Math.max(progress,Math.min(99,Math.max(0,Math.round(Number(value)*100))));
    if (typeof stage === 'string' && stage.trim()) q('[data-iv-stage]').textContent = stage;
    q('[data-iv-progress]').textContent = `${progress}%`;
    const meter=q('.iv-progress');meter.setAttribute('aria-valuenow',String(progress));meter.style.setProperty('--progress',String(progress / 100));
    syncStats();
  }
  function setReady() {
    if (entered || failed || ready) return;
    ready = true;progress = 100;root.dataset.state = 'ready';root.classList.add('is-ready');root.setAttribute('aria-busy','false');
    q('.iv-progress').setAttribute('aria-valuenow','100');q('.iv-progress').style.setProperty('--progress','1');
    q('[data-iv-progress]').textContent='100%';q('.iv-confirm').hidden=false;q('.iv-loading').hidden=true;
    yes.disabled=false;no.disabled=true;syncStats();
    if (root.contains(document.activeElement) || document.activeElement === document.body) yes.focus({preventScroll:false});
  }
  function enter() {
    if (!ready || entered || failed) return;
    entered=true;root.dataset.state='entering';root.classList.add('is-entering');yes.disabled=true;syncStats();
    // Keep this call in the click stack: audio still has a real user gesture.
    onEnter?.();
    exitTimer=setTimeout(()=>{root.hidden=true;root.dataset.state='entered';root.setAttribute('aria-modal','false');},950);
  }
  function showError(message) {
    failed=true;ready=false;root.classList.add('has-error');root.dataset.state='error';root.setAttribute('aria-busy','false');
    yes.disabled=true;no.disabled=true;q('.iv-confirm').hidden=true;q('.iv-loading').hidden=true;
    const error=q('.iv-error');error.hidden=false;error.querySelector('p').textContent=message||'这一页暂时没能完整打开。请刷新后再试一次。';syncStats();
  }
  function keydown(event) {
    if(event.key!=='Tab' || entered)return;
    // The disabled no is intentionally not a keyboard stop. Keep focus within
    // this invitation rather than allowing hidden scene controls to activate.
    event.preventDefault();(ready&&!failed?yes:root).focus({preventScroll:false});
  }
  yes.addEventListener('click',enter);root.addEventListener('keydown',keydown);
  root.focus({preventScroll:true});syncStats();
  return {element:root,setProgress,setReady,showError,stats:()=>({ready,entered,progress,failed,photoSources:sources.length,photoSlots:photoCards.length,noDisabled:no.disabled}),
    destroy(){clearTimeout(exitTimer);yes.removeEventListener('click',enter);root.removeEventListener('keydown',keydown);root.remove();}};
}
