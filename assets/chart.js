/* ============================================================
   TradePro · Indiabulls Securities — Interactive Chart Engine
   Canvas2D · pan/zoom/crosshair · multi chart-type ·
   indicator stack · regime-aware overlays · drawing tools ·
   trade-from-chart · bar replay
   Exposes window.TPChart  { mount, render, resize, serialize, restore }
   ============================================================ */
(function(){
'use strict';

/* ---------- timeframes ---------- */
const TF = {
  '1m' :{mins:1,    n:260, vol:0.35},
  '5m' :{mins:5,    n:260, vol:0.55},
  '15m':{mins:15,   n:240, vol:0.85},
  '1H' :{mins:60,   n:220, vol:1.25},
  '1D' :{mins:1440, n:200, vol:2.10},
  '1W' :{mins:10080,n:160, vol:3.40},
};
const TF_ORDER=['1m','5m','15m','1H','1D','1W'];
const TYPES=[['candle','Candles'],['hollow','Hollow'],['heikin','Heikin-Ashi'],['bar','OHLC Bars'],['line','Line'],['area','Area'],['baseline','Baseline']];
const TYPE_LABEL=Object.fromEntries(TYPES);
const IND_DEFS=[
  ['ema20','EMA 20','price'],['ema50','EMA 50','price'],['ema200','EMA 200','price'],
  ['bb','Bollinger (20,2)','price'],['vwap','VWAP','price'],['sup','Supertrend','price'],
  ['vol','Volume','pane'],['rsi','RSI (14)','pane'],['macd','MACD (12,26,9)','pane'],
];
const TOOLS=[
  ['cursor','Crosshair','M5 12h14M12 5v14'],
  ['trend','Trend line','M4 19L20 5'],
  ['ray','Horizontal','M4 12h16'],
  ['fib','Fibonacci','M4 6h16M4 10h16M4 14h16M4 18h16'],
  ['rect','Rectangle','M5 6h14v12H5z'],
  ['trade','Trade level','M4 12h7l2-4 3 8 2-4h2'],
  ['erase','Remove','M6 6l12 12M18 6L6 18'],
];

/* ---------- helpers ---------- */
const $=s=>document.querySelector(s);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const hash=s=>{let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;};
const fmtN=(n,d)=>n.toLocaleString('en-IN',{minimumFractionDigits:d,maximumFractionDigits:d});
function cssv(name){return getComputedStyle(document.documentElement).getPropertyValue(name).trim();}
function withA(hex,a){ // hex/rgb -> rgba
  hex=hex.trim();
  if(hex.startsWith('rgb')) return hex.replace(/rgba?\(([^)]+)\)/,(m,p)=>{const v=p.split(',').slice(0,3).join(',');return `rgba(${v},${a})`;});
  let h=hex.replace('#','');if(h.length===3)h=h.split('').map(c=>c+c).join('');
  const r=parseInt(h.slice(0,2),16),g=parseInt(h.slice(2,4),16),b=parseInt(h.slice(4,6),16);
  return `rgba(${r},${g},${b},${a})`;
}

/* ---------- engine state ---------- */
const S={
  mounted:false, cv:null, ctx:null, dpr:1, W:0, H:0,
  sym:'NIFTY 50', name:'', regime:'bull', basePrice:23450, change:0,
  type:'candle', tf:'15m',
  ind:{ema20:true,ema50:true,ema200:false,bb:false,vwap:false,sup:false,vol:true,rsi:false,macd:false},
  regimeStudies:true,
  bars:[], view:{start:0,count:90}, hover:-1, hoverY:null,
  drawings:{}, draft:null, tool:'cursor',
  trade:null,                 // {sym,side,entry,sl,target}
  replay:{on:false,idx:0,timer:null},
  drag:null, palette:{}, onTrade:null, persist:null, raf:0,
  feed:null, barReq:0, loading:false, noData:false,   // real-candle feed (Kite historical)
};

/* ============================================================
   DATA
   ============================================================ */
function genBars(sym,tf,regime,basePrice){
  const cfg=TF[tf]||TF['15m'], n=cfg.n;
  let seed=hash(sym+'|'+tf);const rnd=()=>{seed=(seed*9301+49297)%233280;return seed/233280;};
  const base=basePrice||1000;
  const drift=regime==='bull'?0.0011:regime==='bear'?-0.0013:0.00004;
  let price=base*(regime==='bear'?1.07:regime==='bull'?0.94:1.0);
  const bars=[],now=Date.now(),step=cfg.mins*60000;
  // gentle multi-wave so it reads like a real tape, not noise
  for(let i=0;i<n;i++){
    const t=now-(n-1-i)*step;
    const o=price;
    const wave=Math.sin(i/14)*base*0.004 + Math.sin(i/47)*base*0.006;
    const shock=(rnd()-0.5), vola=base*0.0042*cfg.vol;
    let c=o+drift*price+shock*vola+(wave-(bars.length?Math.sin((i-1)/14)*base*0.004+Math.sin((i-1)/47)*base*0.006:0))*0.4;
    if(rnd()<0.035)c+=(rnd()-0.5)*vola*5;            // occasional gap/spike
    c=Math.max(base*0.45,c);
    const hi=Math.max(o,c)+rnd()*vola*0.85, lo=Math.min(o,c)-rnd()*vola*0.85;
    const v=Math.round((0.45+rnd())*1e6*(1+Math.abs(shock)*2.4));
    bars.push({t,o,h:hi,l:lo,c,v});price=c;
  }
  // pin last close to the live LTP so chart agrees with the tape
  const k=base/bars[bars.length-1].c;
  bars.forEach(b=>{b.o*=k;b.h*=k;b.l*=k;b.c*=k;});
  return bars;
}
function visBars(){ // honour replay
  if(S.replay.on) return S.bars.slice(0,Math.max(2,S.replay.idx));
  return S.bars;
}

/* ---------- transforms (Heikin / baseline derive) ---------- */
function heikin(bars){const out=[];let pc=bars[0].o,po=bars[0].o;
  for(const b of bars){const c=(b.o+b.h+b.l+b.c)/4;const o=(po+pc)/2;
    out.push({t:b.t,o,c,h:Math.max(b.h,o,c),l:Math.min(b.l,o,c),v:b.v});po=o;pc=c;}return out;}

/* ============================================================
   INDICATORS
   ============================================================ */
function ema(arr,p){const k=2/(p+1);const o=[];let prev;
  arr.forEach((v,i)=>{prev=i?v*k+prev*(1-k):v;o.push(prev);});return o;}
function sma(arr,p){return arr.map((_,i)=>{if(i<p-1)return null;let s=0;for(let j=i-p+1;j<=i;j++)s+=arr[j];return s/p;});}
function stdev(arr,p,m){return arr.map((_,i)=>{if(i<p-1||m[i]==null)return null;let s=0;for(let j=i-p+1;j<=i;j++)s+=(arr[j]-m[i])**2;return Math.sqrt(s/p);});}
function rsi(arr,p){const o=[];let g=0,l=0;
  for(let i=0;i<arr.length;i++){if(i===0){o.push(null);continue;}const d=arr[i]-arr[i-1];const up=Math.max(0,d),dn=Math.max(0,-d);
    if(i<=p){g+=up;l+=dn;if(i===p){g/=p;l/=p;o.push(100-100/(1+g/(l||1e-9)));}else o.push(null);}
    else{g=(g*(p-1)+up)/p;l=(l*(p-1)+dn)/p;o.push(100-100/(1+g/(l||1e-9)));}}return o;}
function macd(arr){const f=ema(arr,12),s=ema(arr,26);const line=arr.map((_,i)=>f[i]-s[i]);const sig=ema(line,9);
  return{line,sig,hist:line.map((v,i)=>v-sig[i])};}
function vwap(bars){const o=[];let pv=0,vv=0;for(const b of bars){const tp=(b.h+b.l+b.c)/3;pv+=tp*b.v;vv+=b.v;o.push(pv/vv);}return o;}
function atr(bars,p){const tr=bars.map((b,i)=>i?Math.max(b.h-b.l,Math.abs(b.h-bars[i-1].c),Math.abs(b.l-bars[i-1].c)):b.h-b.l);return ema(tr,p);}
function supertrend(bars,p,mult){const a=atr(bars,p);const o=[];let dir=1,st=bars[0].c;
  for(let i=0;i<bars.length;i++){const hl2=(bars[i].h+bars[i].l)/2;const up=hl2-mult*a[i],dn=hl2+mult*a[i];
    if(i===0){o.push({v:up,dir:1});continue;}const pc=bars[i-1].c;
    if(dir===1){st=Math.max(up,st);if(bars[i].c<st){dir=-1;st=dn;}}
    else{st=Math.min(dn,st);if(bars[i].c>st){dir=1;st=up;}}
    o.push({v:st,dir});}return o;}

/* ============================================================
   RENDER
   ============================================================ */
function refreshPalette(){
  S.palette={
    green:cssv('--green'),red:cssv('--red'),accent:cssv('--accent'),accentD:cssv('--accent-d'),
    amber:cssv('--amber'),blue:cssv('--blue'),line:cssv('--line'),line2:cssv('--line-2'),
    slate:cssv('--slate'),slate2:cssv('--slate-2'),navy:cssv('--navy'),surface:cssv('--surface'),
    surface2:cssv('--surface-2'),
  };
}
function layout(){
  const padR=58, padB=22, padT=8, padL=6;
  const plotW=S.W-padR-padL;
  let panes=[]; if(S.ind.vol)panes.push('vol'); if(S.ind.rsi)panes.push('rsi'); if(S.ind.macd)panes.push('macd');
  const subH=panes.length?Math.min(0.5,panes.length*0.17):0;
  const usable=S.H-padT-padB;
  const mainH=usable*(1-subH);
  const each=panes.length?(usable*subH)/panes.length:0;
  const L={padL,padR,padT,padB,plotW,
    main:{top:padT,h:mainH-(panes.length?6:0)},panes:[]};
  let y=padT+mainH+ (panes.length?2:0);
  panes.forEach(p=>{L.panes.push({id:p,top:y,h:each-6});y+=each;});
  return L;
}
function priceRange(L,bars){
  const v=S.view, lo0=Math.max(0,v.start|0), hi0=Math.min(bars.length-1,(v.start+v.count)|0);
  let mn=Infinity,mx=-Infinity;
  for(let i=lo0;i<=hi0;i++){if(bars[i].h>mx)mx=bars[i].h;if(bars[i].l<mn)mn=bars[i].l;}
  // include drawings + trade levels + ema200 swing for framing
  (S.drawings[S.sym]||[]).forEach(d=>d.pts.forEach(p=>{mn=Math.min(mn,p.price);mx=Math.max(mx,p.price);}));
  if(S.trade&&S.trade.sym===S.sym){[S.trade.entry,S.trade.sl,S.trade.target].forEach(p=>{if(p!=null){mn=Math.min(mn,p);mx=Math.max(mx,p);}});}
  if(!isFinite(mn)){mn=S.basePrice*0.98;mx=S.basePrice*1.02;}
  const pad=(mx-mn)*0.08||1; return {mn:mn-pad,mx:mx+pad};
}
function xOf(i,L){const cw=L.plotW/S.view.count;return L.padL+(i-S.view.start+0.5)*cw;}
function iOf(px,L){const cw=L.plotW/S.view.count;return Math.round((px-L.padL)/cw-0.5+S.view.start);}
function yOf(p,pane,rng){return pane.top+(1-(p-rng.mn)/(rng.mx-rng.mn))*pane.h;}
function pOf(py,pane,rng){return rng.mn+(1-(py-pane.top)/pane.h)*(rng.mx-rng.mn);}

function draw(){
  if(!S.mounted)return;
  const ctx=S.ctx,P=S.palette,L=layout();
  ctx.clearRect(0,0,S.W,S.H);
  let bars=visBars();
  if(S.type==='heikin')bars=heikin(bars);
  if(!bars.length){
    // Honest empty state — never synthetic candles
    ctx.fillStyle=withA(cssv('--slate')||'#8a93a6',0.9);
    ctx.font='13px '+(cssv('--ui')||'system-ui');
    ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText(S.loading?'Loading live chart…':(S.noData?'No live chart data — connect Kite (run login.py)':'No data'),S.W/2,S.H/2);
    ctx.textAlign='left';
    return;
  }
  const rng=priceRange(L,bars), main=L.main;
  const v=S.view, cw=L.plotW/v.count;
  const lo=Math.max(0,Math.floor(v.start)-1), hi=Math.min(bars.length-1,Math.ceil(v.start+v.count)+1);

  // grid + price axis
  ctx.font='10px '+(cssv('--mono')||'monospace');ctx.textBaseline='middle';
  const steps=5;
  for(let s=0;s<=steps;s++){const p=rng.mn+(rng.mx-rng.mn)*s/steps,yy=yOf(p,main,rng);
    ctx.strokeStyle=withA(P.line,0.7);ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(L.padL,yy);ctx.lineTo(S.W-L.padR,yy);ctx.stroke();
    ctx.fillStyle=P.slate;ctx.textAlign='left';ctx.fillText(fmtN(p,p>2000?0:1),S.W-L.padR+5,yy);}
  // time axis ticks
  ctx.fillStyle=P.slate2;ctx.textAlign='center';
  const tfMins=(TF[S.tf]||TF['15m']).mins;
  for(let i=lo;i<=hi;i++){if(i<0)continue;const gap=Math.max(1,Math.round(v.count/8));if(i%gap)continue;
    const d=new Date(bars[i].t);const lbl=tfMins>=1440?`${d.getDate()}/${d.getMonth()+1}`:`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    ctx.fillText(lbl,xOf(i,L),S.H-10);}

  // regime auto-overlays (drawn under price)
  if(S.regimeStudies)drawRegime(ctx,L,main,rng,bars,lo,hi);

  // price series
  const upC=P.green,dnC=P.red;
  if(S.type==='line'||S.type==='area'||S.type==='baseline'){
    ctx.lineWidth=1.7;ctx.lineJoin='round';
    const closes=bars.map(b=>b.c);
    if(S.type==='baseline'){
      const baseP=closes[Math.max(0,lo)];const yBase=yOf(baseP,main,rng);
      ctx.beginPath();for(let i=lo;i<=hi;i++){const x=xOf(i,L),y=yOf(bars[i].c,main,rng);i===lo?ctx.moveTo(x,y):ctx.lineTo(x,y);}
      ctx.strokeStyle=P.accent;ctx.stroke();
      // shade above/below base
      ctx.save();ctx.globalAlpha=.10;
      ['up','dn'].forEach(side=>{ctx.beginPath();ctx.moveTo(xOf(lo,L),yBase);
        for(let i=lo;i<=hi;i++)ctx.lineTo(xOf(i,L),yOf(bars[i].c,main,rng));
        ctx.lineTo(xOf(hi,L),yBase);ctx.closePath();
        ctx.fillStyle=side==='up'?upC:dnC;ctx.save();ctx.beginPath();
        side==='up'?ctx.rect(0,0,S.W,yBase):ctx.rect(0,yBase,S.W,S.H-yBase);ctx.clip();ctx.fill();ctx.restore();});
      ctx.restore();
      ctx.setLineDash([4,4]);ctx.strokeStyle=withA(P.slate,.6);ctx.beginPath();ctx.moveTo(L.padL,yBase);ctx.lineTo(S.W-L.padR,yBase);ctx.stroke();ctx.setLineDash([]);
    } else {
      ctx.beginPath();for(let i=lo;i<=hi;i++){const x=xOf(i,L),y=yOf(bars[i].c,main,rng);i===lo?ctx.moveTo(x,y):ctx.lineTo(x,y);}
      ctx.strokeStyle=P.accent;ctx.stroke();
      if(S.type==='area'){ctx.lineTo(xOf(hi,L),main.top+main.h);ctx.lineTo(xOf(lo,L),main.top+main.h);ctx.closePath();
        const g=ctx.createLinearGradient(0,main.top,0,main.top+main.h);g.addColorStop(0,withA(P.accent,.22));g.addColorStop(1,withA(P.accent,0));ctx.fillStyle=g;ctx.fill();}
    }
  } else {
    const bw=Math.max(1,cw*0.62);
    for(let i=lo;i<=hi;i++){const b=bars[i],x=xOf(i,L),up=b.c>=b.o,col=up?upC:dnC;
      const yo=yOf(b.o,main,rng),yc=yOf(b.c,main,rng),yh=yOf(b.h,main,rng),yl=yOf(b.l,main,rng);
      if(S.type==='bar'){ctx.strokeStyle=col;ctx.lineWidth=Math.max(1,bw*0.34);
        ctx.beginPath();ctx.moveTo(x,yh);ctx.lineTo(x,yl);ctx.moveTo(x-bw/2,yo);ctx.lineTo(x,yo);ctx.moveTo(x,yc);ctx.lineTo(x+bw/2,yc);ctx.stroke();continue;}
      ctx.strokeStyle=col;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x,yh);ctx.lineTo(x,yl);ctx.stroke();
      const top=Math.min(yo,yc),bh=Math.max(1,Math.abs(yc-yo));
      if(S.type==='hollow'&&up){ctx.strokeStyle=col;ctx.lineWidth=1.2;ctx.strokeRect(x-bw/2,top,bw,bh);}
      else{ctx.fillStyle=col;ctx.fillRect(x-bw/2,top,bw,bh);}
    }
  }

  // overlay indicators
  drawOverlayIndicators(ctx,L,main,rng,bars,lo,hi);
  // last price tag + line
  const last=bars[hi];const yL=yOf(last.c,main,rng);
  ctx.setLineDash([2,3]);ctx.strokeStyle=withA(last.c>=last.o?upC:dnC,.55);ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(L.padL,yL);ctx.lineTo(S.W-L.padR,yL);ctx.stroke();ctx.setLineDash([]);
  ctx.fillStyle=last.c>=last.o?upC:dnC;ctx.fillRect(S.W-L.padR,yL-8,L.padR,16);
  ctx.fillStyle='#fff';ctx.textAlign='left';ctx.font='10px '+(cssv('--mono')||'monospace');ctx.fillText(fmtN(last.c,last.c>2000?0:1),S.W-L.padR+5,yL);

  // sub-panes
  L.panes.forEach(p=>drawPane(ctx,L,p,bars,lo,hi));

  // drawings + trade levels + draft
  drawDrawings(ctx,L,main,rng);
  drawTrade(ctx,L,main,rng);

  // crosshair + readout
  if(S.hover>=0)drawCrosshair(ctx,L,main,rng,bars);
  updateReadout(bars,L,main,rng);
}

function drawOverlayIndicators(ctx,L,main,rng,bars,lo,hi){
  const closes=bars.map(b=>b.c),P=S.palette;
  const plot=(vals,color,w,dash)=>{ctx.strokeStyle=color;ctx.lineWidth=w||1.4;ctx.setLineDash(dash||[]);ctx.lineJoin='round';
    ctx.beginPath();let started=false;for(let i=lo;i<=hi;i++){if(vals[i]==null)continue;const x=xOf(i,L),y=yOf(vals[i],main,rng);started?ctx.lineTo(x,y):(ctx.moveTo(x,y),started=true);}ctx.stroke();ctx.setLineDash([]);};
  if(S.ind.ema20)plot(ema(closes,20),P.blue,1.4);
  if(S.ind.ema50)plot(ema(closes,50),P.amber,1.4);
  if(S.ind.ema200)plot(ema(closes,200),P.slate,1.6);
  if(S.ind.vwap)plot(vwap(bars),'#8b5cf6',1.4,[5,3]);
  if(S.ind.bb){const m=sma(closes,20),sd=stdev(closes,20,m);
    const up=m.map((x,i)=>x==null?null:x+2*sd[i]),dn=m.map((x,i)=>x==null?null:x-2*sd[i]);
    plot(up,withA(P.blue,.7),1,[3,3]);plot(dn,withA(P.blue,.7),1,[3,3]);plot(m,withA(P.blue,.5),1);}
  if(S.ind.sup){const st=supertrend(bars,10,3);ctx.lineWidth=1.8;
    for(let i=Math.max(lo,1);i<=hi;i++){ctx.strokeStyle=st[i].dir===1?P.green:P.red;ctx.beginPath();
      ctx.moveTo(xOf(i-1,L),yOf(st[i-1].v,main,rng));ctx.lineTo(xOf(i,L),yOf(st[i].v,main,rng));ctx.stroke();}}
}

function drawRegime(ctx,L,main,rng,bars,lo,hi){
  const P=S.palette, last=bars[bars.length-1], window=bars.slice(-60);
  const swingHi=Math.max(...window.map(b=>b.h)), swingLo=Math.min(...window.map(b=>b.l));
  const at=atr(bars,14),lastAtr=at[at.length-1];
  const hl=(p,col,label,dash)=>{const y=yOf(p,main,rng);ctx.strokeStyle=col;ctx.lineWidth=1.2;ctx.setLineDash(dash||[6,4]);
    ctx.beginPath();ctx.moveTo(L.padL,y);ctx.lineTo(S.W-L.padR,y);ctx.stroke();ctx.setLineDash([]);
    ctx.fillStyle=col;ctx.font='9px '+(cssv('--sans')||'sans-serif');ctx.textAlign='left';ctx.fillText(label,L.padL+4,y-5);};
  const band=(p1,p2,col)=>{const y1=yOf(p1,main,rng),y2=yOf(p2,main,rng);ctx.fillStyle=col;ctx.fillRect(L.padL,Math.min(y1,y2),L.plotW,Math.abs(y2-y1));};
  if(S.regime==='bull'){
    band(swingHi,swingHi-(swingHi-swingLo)*0.04,withA(P.green,.07));
    hl(swingHi,withA(P.green,.85),'BREAKOUT '+fmtN(swingHi,swingHi>2000?0:1));
  }else if(S.regime==='bear'){
    band(swingLo,swingLo+(swingHi-swingLo)*0.05,withA(P.red,.08));
    hl(swingLo,withA(P.red,.85),'SUPPORT '+fmtN(swingLo,swingLo>2000?0:1));
    hl(last.c-2*lastAtr,withA(P.amber,.9),'ATR STOP '+fmtN(last.c-2*lastAtr,last.c>2000?0:1),[2,3]);
  }else{
    band(swingHi,swingLo,withA(P.blue,.045));
    hl(swingHi,withA(P.blue,.7),'RANGE HI',[4,4]);hl(swingLo,withA(P.blue,.7),'RANGE LO',[4,4]);
  }
}

function drawPane(ctx,L,pane,bars,lo,hi){
  const P=S.palette;ctx.strokeStyle=withA(P.line,.8);ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(L.padL,pane.top);ctx.lineTo(S.W-L.padR,pane.top);ctx.stroke();
  ctx.font='9px '+(cssv('--mono')||'monospace');ctx.textAlign='left';
  if(pane.id==='vol'){
    const mx=Math.max(...bars.slice(lo,hi+1).map(b=>b.v))||1,cw=L.plotW/S.view.count,bw=Math.max(1,cw*0.62);
    for(let i=lo;i<=hi;i++){const b=bars[i],h=(b.v/mx)*pane.h*0.92,x=xOf(i,L);
      ctx.fillStyle=withA(b.c>=b.o?P.green:P.red,.55);ctx.fillRect(x-bw/2,pane.top+pane.h-h,bw,h);}
    const vm=sma(bars.map(b=>b.v),20);ctx.strokeStyle=P.amber;ctx.lineWidth=1;ctx.beginPath();let st=false;
    for(let i=lo;i<=hi;i++){if(vm[i]==null)continue;const x=xOf(i,L),y=pane.top+pane.h-(vm[i]/mx)*pane.h*0.92;st?ctx.lineTo(x,y):(ctx.moveTo(x,y),st=true);}ctx.stroke();
    ctx.fillStyle=P.slate2;ctx.fillText('Vol',L.padL+2,pane.top+9);
  } else if(pane.id==='rsi'){
    const r=rsi(bars.map(b=>b.c),14);const yv=v=>pane.top+(1-v/100)*pane.h;
    [30,50,70].forEach(g=>{ctx.strokeStyle=withA(P.line,.8);ctx.setLineDash(g===50?[]:[3,3]);ctx.beginPath();ctx.moveTo(L.padL,yv(g));ctx.lineTo(S.W-L.padR,yv(g));ctx.stroke();ctx.setLineDash([]);
      ctx.fillStyle=P.slate2;ctx.fillText(g,S.W-L.padR+5,yv(g));});
    ctx.fillStyle=withA('#8b5cf6',.08);ctx.fillRect(L.padL,yv(70),L.plotW,yv(30)-yv(70));
    ctx.strokeStyle='#8b5cf6';ctx.lineWidth=1.4;ctx.beginPath();let st=false;
    for(let i=lo;i<=hi;i++){if(r[i]==null)continue;const x=xOf(i,L),y=yv(clamp(r[i],0,100));st?ctx.lineTo(x,y):(ctx.moveTo(x,y),st=true);}ctx.stroke();
    ctx.fillStyle=P.slate2;ctx.fillText('RSI 14',L.padL+2,pane.top+9);
  } else if(pane.id==='macd'){
    const m=macd(bars.map(b=>b.c));const all=[...m.line.slice(lo,hi+1),...m.sig.slice(lo,hi+1)].filter(x=>x!=null);
    const mx=Math.max(0.001,...all.map(Math.abs));const yv=v=>pane.top+pane.h/2-(v/mx)*(pane.h/2)*0.9,cw=L.plotW/S.view.count,bw=Math.max(1,cw*0.6);
    for(let i=lo;i<=hi;i++){const h=m.hist[i];if(h==null)continue;const x=xOf(i,L),y0=yv(0),y1=yv(h);ctx.fillStyle=withA(h>=0?P.green:P.red,.5);ctx.fillRect(x-bw/2,Math.min(y0,y1),bw,Math.abs(y1-y0));}
    const ln=(vals,c)=>{ctx.strokeStyle=c;ctx.lineWidth=1.2;ctx.beginPath();let st=false;for(let i=lo;i<=hi;i++){if(vals[i]==null)continue;const x=xOf(i,L),y=yv(vals[i]);st?ctx.lineTo(x,y):(ctx.moveTo(x,y),st=true);}ctx.stroke();};
    ln(m.line,P.blue);ln(m.sig,P.amber);ctx.fillStyle=P.slate2;ctx.fillText('MACD',L.padL+2,pane.top+9);
  }
}

/* ---------- drawings ---------- */
function drawDrawings(ctx,L,main,rng){
  const P=S.palette;const list=(S.drawings[S.sym]||[]).concat(S.draft?[S.draft]:[]);
  list.forEach(d=>{
    const col=d.type==='fib'?P.amber:d.type==='rect'?P.blue:P.accentD;
    ctx.strokeStyle=col;ctx.lineWidth=1.4;
    const X=p=>xOf(p.i,L),Y=p=>yOf(p.price,main,rng);
    if(d.type==='trend'&&d.pts.length>=2){ctx.beginPath();ctx.moveTo(X(d.pts[0]),Y(d.pts[0]));ctx.lineTo(X(d.pts[1]),Y(d.pts[1]));ctx.stroke();}
    else if(d.type==='ray'&&d.pts.length>=1){const y=Y(d.pts[0]);ctx.setLineDash([5,3]);ctx.beginPath();ctx.moveTo(L.padL,y);ctx.lineTo(S.W-L.padR,y);ctx.stroke();ctx.setLineDash([]);
      ctx.fillStyle=col;ctx.font='9px '+(cssv('--mono')||'monospace');ctx.textAlign='right';ctx.fillText(fmtN(d.pts[0].price,1),S.W-L.padR-3,y-5);}
    else if(d.type==='rect'&&d.pts.length>=2){const x1=X(d.pts[0]),y1=Y(d.pts[0]),x2=X(d.pts[1]),y2=Y(d.pts[1]);
      ctx.fillStyle=withA(P.blue,.07);ctx.fillRect(Math.min(x1,x2),Math.min(y1,y2),Math.abs(x2-x1),Math.abs(y2-y1));ctx.strokeRect(Math.min(x1,x2),Math.min(y1,y2),Math.abs(x2-x1),Math.abs(y2-y1));}
    else if(d.type==='fib'&&d.pts.length>=2){const p1=d.pts[0].price,p2=d.pts[1].price;const levels=[0,0.236,0.382,0.5,0.618,0.786,1];
      const x1=X(d.pts[0]),x2=X(d.pts[1]);levels.forEach(f=>{const pr=p1+(p2-p1)*f;const y=Y({price:pr});ctx.strokeStyle=withA(P.amber,.8);ctx.setLineDash(f===0||f===1?[]:[4,3]);
        ctx.beginPath();ctx.moveTo(Math.min(x1,x2),y);ctx.lineTo(S.W-L.padR,y);ctx.stroke();ctx.setLineDash([]);
        ctx.fillStyle=P.amber;ctx.font='9px '+(cssv('--mono')||'monospace');ctx.textAlign='left';ctx.fillText((f*100).toFixed(1)+'%  '+fmtN(pr,1),Math.min(x1,x2)+3,y-4);});}
  });
}
function drawTrade(ctx,L,main,rng){
  if(!S.trade||S.trade.sym!==S.sym)return;const t=S.trade,P=S.palette;
  const lvl=(p,col,label)=>{if(p==null)return;const y=yOf(p,main,rng);ctx.strokeStyle=col;ctx.lineWidth=1.3;ctx.setLineDash([6,3]);
    ctx.beginPath();ctx.moveTo(L.padL,y);ctx.lineTo(S.W-L.padR,y);ctx.stroke();ctx.setLineDash([]);
    ctx.fillStyle=col;ctx.fillRect(L.padL,y-7,52,14);ctx.fillStyle='#fff';ctx.font='9px '+(cssv('--sans')||'sans-serif');ctx.textAlign='left';ctx.fillText(label,L.padL+4,y);};
  // shade reward (entry->target) green, risk (entry->sl) red
  if(t.entry!=null&&t.target!=null){const ye=yOf(t.entry,main,rng),yt=yOf(t.target,main,rng);ctx.fillStyle=withA(P.green,.07);ctx.fillRect(L.padL,Math.min(ye,yt),L.plotW,Math.abs(yt-ye));}
  if(t.entry!=null&&t.sl!=null){const ye=yOf(t.entry,main,rng),ys=yOf(t.sl,main,rng);ctx.fillStyle=withA(P.red,.07);ctx.fillRect(L.padL,Math.min(ye,ys),L.plotW,Math.abs(ys-ye));}
  lvl(t.target,P.green,'TGT '+fmtN(t.target,1));
  lvl(t.entry,P.navy,(t.side==='buy'?'BUY':'SELL')+' '+fmtN(t.entry,1));
  lvl(t.sl,P.red,'SL '+fmtN(t.sl,1));
}
function drawCrosshair(ctx,L,main,rng,bars){
  const P=S.palette,i=clamp(S.hover,0,bars.length-1),x=xOf(i,L);
  ctx.strokeStyle=withA(P.slate,.55);ctx.lineWidth=1;ctx.setLineDash([3,3]);
  ctx.beginPath();ctx.moveTo(x,main.top);ctx.lineTo(x,S.H-L.padB);ctx.stroke();
  if(S.hoverY!=null){ctx.beginPath();ctx.moveTo(L.padL,S.hoverY);ctx.lineTo(S.W-L.padR,S.hoverY);ctx.stroke();
    const pr=pOf(S.hoverY,main,rng);if(S.hoverY>main.top&&S.hoverY<main.top+main.h){ctx.fillStyle=P.navy;ctx.fillRect(S.W-L.padR,S.hoverY-8,L.padR,16);ctx.fillStyle='#fff';ctx.font='10px '+(cssv('--mono')||'monospace');ctx.textAlign='left';ctx.fillText(fmtN(pr,pr>2000?0:1),S.W-L.padR+5,S.hoverY);}}
  ctx.setLineDash([]);
  // time tag
  const d=new Date(bars[i].t);const tfMins=(TF[S.tf]||TF['15m']).mins;
  const lbl=tfMins>=1440?d.toLocaleDateString('en-IN',{day:'2-digit',month:'short'}):d.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'});
  ctx.fillStyle=P.navy;ctx.font='9px '+(cssv('--mono')||'monospace');const tw=ctx.measureText(lbl).width+10;
  ctx.fillRect(clamp(x-tw/2,L.padL,S.W-L.padR-tw),S.H-L.padB+2,tw,15);ctx.fillStyle='#fff';ctx.textAlign='center';ctx.fillText(lbl,clamp(x,L.padL+tw/2,S.W-L.padR-tw/2),S.H-L.padB+10);
}

/* ---------- HTML readout + legend ---------- */
function updateReadout(bars,L,main,rng){
  const i=S.hover>=0?clamp(S.hover,0,bars.length-1):bars.length-1;const b=bars[i];
  const ro=$('#chRead');if(!ro)return;const ch=b.c-b.o,chp=(ch/b.o*100);
  const c=ch>=0?'up':'down';
  ro.innerHTML=`<b>${S.sym}</b><span class="ch-tf">${S.tf} · ${TYPE_LABEL[S.type]}</span>`+
    ['O','H','L','C'].map((k,j)=>`<i>${k}</i><span class="${c} num">${fmtN([b.o,b.h,b.l,b.c][j],b.c>2000?0:1)}</span>`).join('')+
    `<span class="${c} num">${ch>=0?'+':''}${fmtN(ch,1)} (${chp>=0?'+':''}${chp.toFixed(2)}%)</span>`;
  // legend (indicator last values)
  const closes=bars.map(x=>x.c);const lg=[];
  if(S.ind.ema20)lg.push(['EMA20',ema(closes,20)[i],S.palette.blue]);
  if(S.ind.ema50)lg.push(['EMA50',ema(closes,50)[i],S.palette.amber]);
  if(S.ind.ema200)lg.push(['EMA200',ema(closes,200)[i],S.palette.slate]);
  if(S.ind.vwap)lg.push(['VWAP',vwap(bars)[i],'#8b5cf6']);
  if(S.ind.rsi){const r=rsi(closes,14)[i];lg.push(['RSI',r,'#8b5cf6']);}
  const le=$('#chLegend');if(le)le.innerHTML=lg.map(([n,v,c])=>`<span class="ch-lg"><i style="background:${c}"></i>${n} <b class="num">${v==null?'—':fmtN(v,n==='RSI'?1:(v>2000?0:1))}</b></span>`).join('');
}

/* ============================================================
   POINTER INTERACTION
   ============================================================ */
function localXY(e){const r=S.cv.getBoundingClientRect();return{x:(e.clientX-r.left),y:(e.clientY-r.top)};}
function priceAt(py){const L=layout(),main=L.main,rng=priceRange(L,S.type==='heikin'?heikin(visBars()):visBars());return pOf(py,main,rng);}
function onDown(e){
  const {x,y}=localXY(e);const L=layout();const i=clamp(iOf(x,L),0,S.bars.length-1);
  if(S.tool==='cursor'){S.drag={mode:'pan',x,start:S.view.start};S.cv.style.cursor='grabbing';return;}
  if(S.tool==='erase'){eraseAt(x,y,L);return;}
  const pr=priceAt(y);
  if(S.tool==='ray'){pushDrawing({type:'ray',pts:[{i,price:pr}]});return;}
  if(S.tool==='trade'){
    const side=pr>=S.basePrice?'buy':'sell';// will refine on drag
    S.draft={type:'trade',side,pts:[{i,price:pr}],entry:pr};S.drag={mode:'draftTrade'};return;
  }
  S.draft={type:S.tool,pts:[{i,price:pr},{i,price:pr}]};S.drag={mode:'draft'};
}
function onMove(e){
  const {x,y}=localXY(e);const L=layout();
  S.hover=clamp(iOf(x,L),0,Math.max(0,visBars().length-1));S.hoverY=y;
  if(S.drag){
    if(S.drag.mode==='pan'){const cw=L.plotW/S.view.count;const dx=(x-S.drag.x)/cw;
      S.view.start=clamp(S.drag.start-dx,-S.view.count*0.4,S.bars.length-S.view.count*0.6);}
    else if(S.drag.mode==='draft'&&S.draft){const i=clamp(iOf(x,L),0,S.bars.length-1);S.draft.pts[1]={i,price:priceAt(y)};}
    else if(S.drag.mode==='draftTrade'&&S.draft){const tgt=priceAt(y);const e0=S.draft.entry;const side=tgt>=e0?'buy':'sell';
      const r=Math.abs(tgt-e0);S.draft.side=side;S.draft.target=tgt;S.draft.sl=side==='buy'?e0-r*0.5:e0+r*0.5;
      S.trade={sym:S.sym,side,entry:e0,target:tgt,sl:S.draft.sl};updateTradeChip();}
  }
  schedule();
}
function onUp(){
  if(S.drag){
    if(S.drag.mode==='draft'&&S.draft){pushDrawing(S.draft);S.draft=null;}
    else if(S.drag.mode==='draftTrade'){S.draft=null;}
    if(S.drag.mode==='pan')S.cv.style.cursor='';
  }
  S.drag=null;persist();schedule();
}
function onWheel(e){e.preventDefault();const L=layout();const {x}=localXY(e);const i=iOf(x,L);
  const f=e.deltaY>0?1.12:0.89;const nc=clamp(Math.round(S.view.count*f),20,S.bars.length);
  const ratio=(i-S.view.start)/S.view.count;S.view.start=clamp(i-ratio*nc,-nc*0.4,S.bars.length-nc*0.6);S.view.count=nc;schedule();persistSoon();}
function onLeave(){S.hover=-1;S.hoverY=null;schedule();}

function eraseAt(x,y,L){const list=S.drawings[S.sym]||[];const main=L.main,rng=priceRange(L,visBars());
  for(let k=list.length-1;k>=0;k--){const d=list[k];const hit=d.pts.some(p=>Math.abs(xOf(p.i,L)-x)<10&&Math.abs(yOf(p.price,main,rng)-y)<10)
    ||(d.type==='ray'&&Math.abs(yOf(d.pts[0].price,main,rng)-y)<6);
    if(hit){list.splice(k,1);persist();schedule();return;}}
}
function pushDrawing(d){if(!S.drawings[S.sym])S.drawings[S.sym]=[];S.drawings[S.sym].push(d);persist();schedule();}

/* ============================================================
   TOOLBAR DOM + EVENTS
   ============================================================ */
function buildDOM(){
  const card=$('#chartCard');
  card.innerHTML=`
  <div class="ch-bar">
    <div class="ch-id">
      <span class="ch-name" id="chName">NIFTY 50</span>
      <span class="ch-last num" id="chLast">—</span>
    </div>
    <div class="ch-seg" id="chTF">${TF_ORDER.map(t=>`<button class="ch-pill" data-tf="${t}">${t}</button>`).join('')}</div>
    <div class="ch-menu-wrap">
      <button class="ch-pill ch-drop" id="chTypeBtn"><span id="chTypeLbl">Candles</span> ▾</button>
      <div class="ch-pop" id="chTypePop">${TYPES.map(([k,l])=>`<button data-type="${k}">${l}</button>`).join('')}</div>
    </div>
    <div class="ch-menu-wrap">
      <button class="ch-pill ch-drop" id="chIndBtn">Indicators ▾</button>
      <div class="ch-pop ch-pop-ind" id="chIndPop">${IND_DEFS.map(([k,l,t])=>`<label data-ind="${k}"><input type="checkbox" data-indc="${k}"><span>${l}</span><i class="ch-tag">${t==='pane'?'pane':'overlay'}</i></label>`).join('')}</div>
    </div>
    <button class="ch-pill" id="chRegimeStudies" title="Auto-apply the regime's signature studies">Regime auto</button>
    <button class="ch-pill" id="chReplay" title="Bar replay — reveal price bar by bar">▶ Replay</button>
    <span class="ch-flex"></span>
    <button class="ch-pill ch-reset" id="chReset" title="Reset zoom &amp; pan">Reset</button>
  </div>
  <div class="ch-stage">
    <div class="ch-tools" id="chTools">${TOOLS.map(([k,l,p])=>`<button class="ch-tool${k==='cursor'?' on':''}" data-tool="${k}" title="${l}"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="${p}"/></svg></button>`).join('')}<button class="ch-tool" id="chClear" title="Clear all drawings"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg></button></div>
    <div class="ch-canvas-wrap">
      <canvas id="chCanvas"></canvas>
      <div class="ch-read" id="chRead"></div>
      <div class="ch-legend" id="chLegend"></div>
      <div class="ch-trade-chip" id="chTradeChip"></div>
    </div>
  </div>`;
  S.cv=$('#chCanvas');S.ctx=S.cv.getContext('2d');

  // events
  S.cv.addEventListener('mousedown',onDown);
  window.addEventListener('mousemove',e=>{if(S.drag)onMove(e);});
  S.cv.addEventListener('mousemove',onMove);
  window.addEventListener('mouseup',onUp);
  S.cv.addEventListener('mouseleave',onLeave);
  S.cv.addEventListener('wheel',onWheel,{passive:false});
  // touch (pan + tap crosshair)
  S.cv.addEventListener('touchstart',e=>{if(e.touches.length===1){const t=e.touches[0];onDown({clientX:t.clientX,clientY:t.clientY});}},{passive:true});
  S.cv.addEventListener('touchmove',e=>{if(e.touches.length===1){const t=e.touches[0];onMove({clientX:t.clientX,clientY:t.clientY});}},{passive:true});
  S.cv.addEventListener('touchend',onUp);

  $('#chTF').addEventListener('click',e=>{const b=e.target.closest('[data-tf]');if(b)setTF(b.dataset.tf);});
  $('#chTypeBtn').addEventListener('click',()=>togglePop('chTypePop'));
  $('#chTypePop').addEventListener('click',e=>{const b=e.target.closest('[data-type]');if(b){setType(b.dataset.type);closePops();}});
  $('#chIndBtn').addEventListener('click',()=>togglePop('chIndPop'));
  // read checkbox state on change (avoids the label+input double-fire that cancels a toggle)
  $('#chIndPop').addEventListener('change',e=>{const c=e.target.closest('[data-indc]');if(c){S.ind[c.dataset.indc]=c.checked;fit();persist();schedule();}});
  $('#chRegimeStudies').addEventListener('click',()=>{S.regimeStudies=!S.regimeStudies;$('#chRegimeStudies').classList.toggle('on',S.regimeStudies);persist();schedule();});
  $('#chReplay').addEventListener('click',toggleReplay);
  $('#chReset').addEventListener('click',()=>{fit(true);schedule();});
  $('#chTools').addEventListener('click',e=>{const b=e.target.closest('[data-tool]');if(b)setTool(b.dataset.tool);});
  $('#chClear').addEventListener('click',()=>{S.drawings[S.sym]=[];S.trade=null;updateTradeChip();persist();schedule();});
  document.addEventListener('click',e=>{if(!e.target.closest('.ch-menu-wrap'))closePops();});
  $('#chRegimeStudies').classList.toggle('on',S.regimeStudies);
}
function togglePop(id){const p=$('#'+id);const open=p.classList.contains('show');closePops();if(!open)p.classList.add('show');}
function closePops(){document.querySelectorAll('.ch-pop').forEach(p=>p.classList.remove('show'));}
function syncIndChecks(){IND_DEFS.forEach(([k])=>{const c=document.querySelector(`[data-indc="${k}"]`);if(c)c.checked=!!S.ind[k];});}
function setTool(t){S.tool=t;document.querySelectorAll('.ch-tool').forEach(b=>b.classList.toggle('on',b.dataset.tool===t));S.cv.style.cursor=t==='cursor'?'crosshair':t==='trade'?'ns-resize':'crosshair';}
function setTF(tf){if(!TF[tf])return;S.tf=tf;rebuildBars();fit(true);syncToolbar();persist();schedule();}
function setType(t){S.type=t;$('#chTypeLbl').textContent=TYPE_LABEL[t];persist();schedule();}
function syncToolbar(){
  document.querySelectorAll('[data-tf]').forEach(b=>b.classList.toggle('on',b.dataset.tf===S.tf));
  $('#chTypeLbl').textContent=TYPE_LABEL[S.type];syncIndChecks();
  $('#chName').textContent=S.sym;
  const last=S.bars[S.bars.length-1];if(last){const ch=S.change;$('#chLast').innerHTML=`${fmtN(last.c,last.c>2000?0:1)} <span class="${ch>=0?'up':'down'}">${ch>=0?'+':''}${ch.toFixed(2)}%</span>`;}
}

/* ---------- replay ---------- */
function toggleReplay(){
  const b=$('#chReplay');
  if(S.replay.on){S.replay.on=false;clearInterval(S.replay.timer);b.textContent='▶ Replay';b.classList.remove('on');schedule();return;}
  S.replay.on=true;S.replay.idx=Math.max(20,Math.floor(S.bars.length*0.55));b.textContent='⏸ Replaying';b.classList.add('on');
  S.replay.timer=setInterval(()=>{S.replay.idx++;if(S.replay.idx>=S.bars.length){S.replay.idx=S.bars.length;clearInterval(S.replay.timer);S.replay.on=false;b.textContent='▶ Replay';b.classList.remove('on');}schedule();},220);
}

/* ---------- trade chip ---------- */
function updateTradeChip(){updateTradeChipDom();}
function updateTradeChipDom(){
  const el=$('#chTradeChip');if(!el)return;
  if(!S.trade||S.trade.sym!==S.sym){el.classList.remove('show');el.innerHTML='';return;}
  const t=S.trade;const risk=Math.abs(t.entry-t.sl),rew=Math.abs(t.target-t.entry);const rr=risk?(rew/risk):0;
  el.classList.add('show');
  el.innerHTML=`<div class="tc-row"><b>${t.side==='buy'?'LONG':'SHORT'} ${S.sym}</b><span class="tc-rr">R:R ${rr.toFixed(2)}</span></div>
    <div class="tc-lv"><span>Entry <b class="num">${fmtN(t.entry,1)}</b></span><span class="down">SL <b class="num">${fmtN(t.sl,1)}</b></span><span class="up">Tgt <b class="num">${fmtN(t.target,1)}</b></span></div>
    <div class="tc-acts"><button id="tcSend" class="tc-send">Send to order pad ▸</button><button id="tcClear" class="tc-clear">✕</button></div>`;
  $('#tcSend').onclick=()=>{if(S.onTrade)S.onTrade({sym:S.sym,side:t.side,entry:t.entry,sl:Math.round(t.sl),target:Math.round(t.target)});};
  $('#tcClear').onclick=()=>{S.trade=null;updateTradeChipDom();persist();schedule();};
}

/* ============================================================
   SIZING + RAF
   ============================================================ */
function fit(reset){
  const cfg=TF[S.tf]||TF['15m'];
  if(reset||S.view.count<10){S.view.count=Math.min(90,S.bars.length);}
  S.view.count=clamp(S.view.count,20,S.bars.length);
  S.view.start=clamp(reset?S.bars.length-S.view.count:S.view.start,-S.view.count*0.4,S.bars.length-S.view.count*0.6);
}
function resize(){
  if(!S.cv)return;const wrap=S.cv.parentElement;const r=wrap.getBoundingClientRect();
  S.dpr=window.devicePixelRatio||1;S.W=r.width;S.H=r.height;
  S.cv.width=Math.round(S.W*S.dpr);S.cv.height=Math.round(S.H*S.dpr);
  S.cv.style.width=S.W+'px';S.cv.style.height=S.H+'px';
  S.ctx.setTransform(S.dpr,0,0,S.dpr,0,0);schedule();
}
function schedule(){if(S.raf)return;S.raf=requestAnimationFrame(()=>{S.raf=0;draw();updateTradeChipDom();});}
function rebuildBars(){
  // Real candles when a feed is wired (live Kite historical); NO synthetic fallback.
  // While a request is in flight the prior bars stay; null/empty -> honest no-data state.
  if(S.feed){
    const sym=S.sym, tf=S.tf, reqId=++S.barReq;
    S.loading=true;
    Promise.resolve(S.feed(sym,tf)).then(bars=>{
      if(reqId!==S.barReq) return;                 // superseded by a newer symbol/TF
      S.loading=false;
      if(Array.isArray(bars)&&bars.length){ S.bars=bars; S.noData=false; }
      else { S.bars=[]; S.noData=true; }
      const last=S.bars[S.bars.length-1];
      const el=document.querySelector('#chLast');
      if(el) el.innerHTML = last ? `${fmtN(last.c,last.c>2000?0:1)} <span class="${S.change>=0?'up':'down'}">${S.change>=0?'+':''}${(S.change||0).toFixed(2)}%</span>` : '<span class="muted">—</span>';
      fit(true); schedule();
    }).catch(()=>{ if(reqId===S.barReq){S.loading=false;S.bars=[];S.noData=true;fit(true);schedule();} });
    return;
  }
  S.bars=genBars(S.sym,S.tf,S.regime,S.basePrice);   // legacy fallback (no feed wired)
}

let persistT=0;
function persistSoon(){clearTimeout(persistT);persistT=setTimeout(persist,400);}
function persist(){if(S.persist)S.persist(serialize());}

/* ============================================================
   PUBLIC API
   ============================================================ */
function mount(opts){
  if(S.mounted)return;opts=opts||{};
  S.onTrade=opts.onTrade||null;S.persist=opts.persist||null;S.feed=opts.feed||null;
  buildDOM();refreshPalette();
  rebuildBars();fit(true);syncToolbar();syncIndChecks();
  if(window.ResizeObserver){new ResizeObserver(resize).observe(S.cv.parentElement);}
  else window.addEventListener('resize',resize);
  S.mounted=true;resize();
}
function render(o){
  o=o||{};let symChanged=false;
  if(o.symbol&&o.symbol!==S.sym){S.sym=o.symbol;symChanged=true;}
  if(o.name!=null)S.name=o.name;
  if(o.basePrice)S.basePrice=o.basePrice;
  if(o.change!=null)S.change=o.change;
  const regChanged=o.regime&&o.regime!==S.regime;if(o.regime)S.regime=o.regime;
  refreshPalette();
  if(symChanged||regChanged||!S.bars.length){rebuildBars();fit(symChanged);}
  // clear a trade level that belongs to another symbol view
  updateTradeChipDom();syncToolbar();schedule();
}
function serialize(){
  const dr={};Object.keys(S.drawings).forEach(k=>{const a=(S.drawings[k]||[]).filter(d=>d&&d.pts&&d.pts.length);if(a.length)dr[k]=a.map(d=>({type:d.type,pts:d.pts.map(p=>({i:p.i,price:p.price}))}));});
  return{type:S.type,tf:S.tf,ind:{...S.ind},regimeStudies:S.regimeStudies,drawings:dr};
}
function restore(o){
  if(!o||typeof o!=='object')return;
  if(TYPE_LABEL[o.type])S.type=o.type;
  if(TF[o.tf])S.tf=o.tf;
  if(o.ind&&typeof o.ind==='object')IND_DEFS.forEach(([k])=>{if(typeof o.ind[k]==='boolean')S.ind[k]=o.ind[k];});
  if(typeof o.regimeStudies==='boolean')S.regimeStudies=o.regimeStudies;
  const okType={trend:1,ray:1,fib:1,rect:1};
  if(o.drawings&&typeof o.drawings==='object'){S.drawings={};Object.keys(o.drawings).forEach(sym=>{
    const arr=o.drawings[sym];if(!Array.isArray(arr))return;const clean=arr.filter(d=>d&&okType[d.type]&&Array.isArray(d.pts)&&d.pts.every(p=>typeof p.i==='number'&&typeof p.price==='number'&&isFinite(p.i)&&isFinite(p.price))).slice(0,40);
    if(clean.length)S.drawings[sym]=clean.map(d=>({type:d.type,pts:d.pts.map(p=>({i:p.i,price:p.price}))}));});}
}
function setTimeframe(tf){if(S.mounted&&TF[tf])setTF(tf);}
/* Real-time tick: nudge the last live candle's close (and extend its high/low) when a
   fresh WebSocket price arrives for the symbol on screen. Cheap — just redraws. */
function tick(sym,ltp){
  if(!S.mounted||ltp==null||sym!==S.sym||!S.bars.length||S.noData)return;
  const b=S.bars[S.bars.length-1];
  b.c=ltp; if(ltp>b.h)b.h=ltp; if(ltp<b.l)b.l=ltp;
  const el=document.querySelector('#chLast');
  if(el){const d=el.querySelector('span');const chg=d?d.outerHTML:'';
    el.innerHTML=`${fmtN(ltp,ltp>2000?0:1)} ${chg}`;}
  schedule();
}
window.TPChart={mount,render,resize,serialize,restore,setTimeframe,tick};
})();
