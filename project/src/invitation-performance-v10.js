// Opt-in browser QA only (?perf=1). Measures main-thread frame cadence;
// it does not claim to measure the display compositor's presentation rate.
export function monitorInvitationMotion(root){
  if(!root||new URLSearchParams(location.search).get('perf')!=='1')return;
  let previous=0,phase='',samples=[],lastReport=0;
  const report=()=>{
    if(!samples.length)return;
    const sorted=[...samples].sort((a,b)=>a-b),mean=samples.reduce((a,b)=>a+b,0)/samples.length;
    root.dataset.motion=JSON.stringify({phase,samples:samples.length,rafHz:+(1000/mean).toFixed(1),medianMs:+sorted[Math.floor(sorted.length*.5)].toFixed(2),p95Ms:+sorted[Math.min(sorted.length-1,Math.floor(sorted.length*.95))].toFixed(2),maxMs:+sorted.at(-1).toFixed(2),gapsOver50Ms:samples.filter(v=>v>50).length});
  };
  function sample(now){
    if(root.hidden){report();return;}
    if(phase!==root.dataset.state||document.hidden){phase=root.dataset.state;samples=[];previous=0;}
    if(previous){samples.push(now-previous);if(samples.length>240)samples.shift();}
    previous=now;
    if(now-lastReport>1500){lastReport=now;report();}
    requestAnimationFrame(sample);
  }
  requestAnimationFrame(sample);
}
