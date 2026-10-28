const fs = require('node:fs');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const root = __dirname;
const outRoot = path.resolve(root, '..');
const deps = fs.existsSync(path.join(root, 'node_modules/esbuild')) ? path.join(root, 'node_modules') : 'C:/页面/winter-cabin-build/node_modules';
const esbuild = require(path.join(deps, 'esbuild'));
const dataURL = file => {
  const ext = path.extname(file).toLowerCase();
  const mime = {'.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp','.mp3':'audio/mpeg','.ogg':'audio/ogg','.wav':'audio/wav','.m4a':'audio/mp4'}[ext];
  return 'data:'+mime+';base64,'+fs.readFileSync(file).toString('base64');
};
function jpegDimensions(file){
  const b=fs.readFileSync(file);if(b.readUInt16BE(0)!==0xffd8)throw new Error('Expected JPEG: '+file);
  let i=2;while(i+8<b.length){
    while(b[i]===0xff)i++;const marker=b[i++];
    if(marker===0xd9||marker===0xda)break;
    if(marker===0x01||(marker>=0xd0&&marker<=0xd7))continue;
    const length=b.readUInt16BE(i);if(length<2||i+length>b.length)break;
    if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker))return {height:b.readUInt16BE(i+3),width:b.readUInt16BE(i+5)};
    i+=length;
  }throw new Error('Missing JPEG dimensions: '+file);
}
(async () => {
  const photosDir = path.join(outRoot,'assets/photos');
  const invitationPhotosDir = path.join(outRoot,'assets/invitation-photos');
  fs.mkdirSync(invitationPhotosDir,{recursive:true});
  const musicDir = path.join(outRoot,'assets/music');
  fs.mkdirSync(photosDir,{recursive:true});fs.mkdirSync(musicDir,{recursive:true});
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'album-manifest.json'),'utf8'));
  const albumPhotos=[];
  for(const [order,item] of manifest.photos.entries()){
    const suffix=item.id.slice(-2),photoPath=path.join(outRoot,'assets/album',`photo-${suffix}.jpg`),thumbPath=path.join(outRoot,'assets/album',`thumb-${suffix}.jpg`);
    const im=jpegDimensions(photoPath),chapter=manifest.chapters.find(c=>c.id===item.chapter);
    if(!chapter)throw new Error('Unknown album chapter: '+item.chapter);
    albumPhotos.push({...item,chapterTitle:chapter.title,period:item.period||chapter.period,order,width:im.width,height:im.height,aspect:im.width/im.height,src:dataURL(photoPath),thumb:dataURL(thumbPath)});
  }
  const photos = fs.readdirSync(photosDir).filter(x=>/\.(jpe?g|png|webp)$/i.test(x)).sort().slice(0,3).map(x=>dataURL(path.join(photosDir,x)));
  const invitationPhotos = fs.readdirSync(invitationPhotosDir).filter(x=>/\.(jpe?g|png|webp)$/i.test(x)).sort().slice(0,16).map(x=>dataURL(path.join(invitationPhotosDir,x)));
  const warnings=[];
  for(const name of fs.readdirSync(photosDir).filter(x=>/\.(jpe?g|png|webp)$/i.test(x)).slice(0,3)){try{const {loadImage}=require('C:/Users/ASUS/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas');const im=await loadImage(path.join(photosDir,name));if(Math.max(im.width,im.height)<1080)warnings.push('照片 '+name+' 长边低于1080px，近看可能模糊');}catch{warnings.push('照片 '+name+' 无法读取尺寸');}}
  const song = fs.readdirSync(musicDir).find(x=>/\.(mp3|ogg|wav|m4a)$/i.test(x));
  if(song&&fs.statSync(path.join(musicDir,song)).size>8*1024*1024)warnings.push('背景音乐超过8MB，会增加离线页面体积');
  warnings.forEach(w=>console.warn(w));
  // Each full photograph occurs once in the bundle. Intro, gallery and sky
  // reference this shared collection rather than embedding duplicate albums.
  fs.writeFileSync(path.join(root,'src/local-media.js'),'const albumPhotos='+JSON.stringify(albumPhotos)+';\nexport const MEDIA = {albumPhotos,albumChapters:'+JSON.stringify(manifest.chapters)+',photos:'+JSON.stringify(photos)+',invitationPhotos:albumPhotos.filter(p=>p.invitation),music:'+JSON.stringify(song?dataURL(path.join(musicDir,song)):null)+'};\n');
  const props = path.join(root,'assets/hearth_props.glb');
  fs.writeFileSync(path.join(root,'src/props-data.js'),'export const PROP_DATA = '+JSON.stringify(fs.readFileSync(props).toString('base64'))+';\n');
  fs.writeFileSync(path.join(root,'src/birthday-props-data.js'),'export const BIRTHDAY_PROP_DATA = '+JSON.stringify(fs.readFileSync(path.join(root,'assets/birthday_props.glb')).toString('base64'))+';\n');
  const result = await esbuild.build({entryPoints:[path.join(root,'src/main.js')],bundle:true,minify:true,format:'iife',target:['es2020'],write:false,legalComments:'inline',nodePaths:[deps],sourcemap:false});
  const css = ['styles.css','birthday.css','gift-overrides.css','invitation-v8.css','album-v9.css'].map(f=>fs.readFileSync(path.join(root,'src',f),'utf8')).join('\n');
  const {invitationMarkup}=await import(pathToFileURL(path.join(root,'src/invitation-v8.js')).href);
  const invitation = '<div id="birthday-invitation" class="iv-root" role="dialog" aria-modal="true" aria-labelledby="iv-title" aria-busy="true">'+invitationMarkup(albumPhotos.filter(p=>p.invitation))+'</div>';
  const html = fs.readFileSync(path.join(root,'src/index.template.html'),'utf8').replace('/*__STYLES__*/',()=>css).replace('<!--__INVITATION__-->',()=>invitation).replace('/*__BUNDLE__*/',()=>result.outputFiles[0].text.replace(/<\/script/gi,'<\\/script'));
  fs.writeFileSync(path.join(outRoot,'index.html'),html);
  fs.writeFileSync(path.join(outRoot,'给Lily的生日雪夜.html'),html);
  console.log(JSON.stringify({output:path.join(outRoot,'index.html'),bytes:Buffer.byteLength(html),photos:photos.length,albumPhotos:albumPhotos.length,invitationPhotos:albumPhotos.filter(p=>p.invitation).length,skyPhotos:albumPhotos.filter(p=>p.sky).length,music:!!song},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
