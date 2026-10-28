export const PERSONAL = Object.freeze({
  name:'李梦琪', english:'Lily', birthday:'2026.10.29', firstMeet:'2024.08.15',
  handHold:null,
  lines:{door:'推开门，进来吧',closing:'明年，还想和你一起看雪。'},
  daysTogether:Math.round((Date.UTC(2026,9,29)-Date.UTC(2024,7,15))/86400000)
});
export const BEATS={
  'interior-clock':{duration:4.5,gesture:'clock',sound:'clock',line:'那天地铁通道里，我的心跳大概就是这个声音。'},
  'interior-wardrobe':{duration:5.2,gesture:'open',sound:'open',line:'这三件，我想看你穿去不同的地方。'},
  'interior-gift':{duration:4.6,gesture:'gift',sound:'paper',line:'下一页，想和你一起写。'},
  'interior-tea':{duration:5.0,gesture:'stir',sound:'stir',line:'甜度七分，和你一样。'},
  'interior-cake':{duration:4.5,gesture:'touch',sound:'match',line:'许一个只关于你的愿望。'},
  'loft-book':{duration:4.8,gesture:'open',sound:'paper',line:'这一页，留给你写。'},
  'loft-rose':{duration:4.4,gesture:'touch',sound:'rose',line:'这一朵，留给今天的小寿星。'}
};
