const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const port=Number(process.env.BIRTHDAY_PORT||18439);
const types={'.html':'text/html; charset=utf-8','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.mp3':'audio/mpeg','.glb':'model/gltf-binary'};
http.createServer((req,res)=>{
  let requestPath;try{requestPath=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400);return res.end();}
  const file=path.resolve(root,'.'+(requestPath==='/'?'/index.html':requestPath));
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end('Not found');}
  res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});
  fs.createReadStream(file).pipe(res);
}).listen(port,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:'+port+'/'));
