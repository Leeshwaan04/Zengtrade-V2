/* ============================================================
   zengtrade · Crypto Algo Studio
   Regime-aware systematic trading on live Binance prices (24/7)
   ============================================================ */
'use strict';

const CRYPTO_ONLY = !!window.ZENG_CRYPTO_ONLY;

/* ---------- data ---------- */
// The watchlist is now a UNIVERSAL instrument list, any segment (NSE/BSE equity & indices,
// NFO/BFO futures & options, MCX commodities, CDS currency). These 10 are the default seed;
// the user can add ANY instrument via the universal search (top bar or "Add scrip"). Each item
// carries exch/type/key/token so quotes, streaming and charts address it across exchanges.
let SYMS = [
  {sym:'MARUTI',     name:'Maruti Suzuki', ltp:12480.0,chg:1.1,  beta:1.05, sector:'Auto'},
  {sym:'INFY',       name:'Infosys',       ltp:1845.6, chg:2.1,  beta:0.88, sector:'IT',    hold:{qty:25, avg:1690}},
  {sym:'SBIN',       name:'State Bank',     ltp:842.3,  chg:1.6,  beta:1.18, sector:'PSU Bank', hold:{qty:60, avg:705}},
  {sym:'RELIANCE',   name:'Reliance Ind',  ltp:2945.5, chg:1.2,  beta:1.05, sector:'Energy',hold:{qty:10, avg:2810}},
  {sym:'ICICIBANK',  name:'ICICI Bank',    ltp:1234.8, chg:0.9,  beta:1.02, sector:'Banks'},
  {sym:'HDFCBANK',   name:'HDFC Bank',     ltp:1678.2, chg:0.4,  beta:0.98, sector:'Banks'},
  {sym:'ITC',        name:'ITC Ltd',       ltp:438.9,  chg:-0.3, beta:0.64, sector:'FMCG'},
  {sym:'TCS',        name:'TCS',           ltp:3890.0, chg:-0.6, beta:0.72, sector:'IT'},
  {sym:'BAJFINANCE', name:'Bajaj Finance', ltp:6890.5, chg:-1.9, beta:1.25, sector:'NBFC', hold:{qty:5, avg:7350}},
  {sym:'ADANIENT',   name:'Adani Ent',     ltp:2456.0, chg:-2.8, beta:1.66, sector:'Energy',hold:{qty:8, avg:2720}},
];
SYMS.forEach(s=>{ s.exch='NSE'; s.type='EQ'; s.key='NSE:'+s.sym; });   // seed = NSE equities
const SEED_SYMS = SYMS.map(s=>s.sym);
// ---- universal-instrument helpers ----
const itemKey = s => s.key || (s.exch?s.exch:'NSE')+':'+s.sym;        // EXCH:TS identity for data
const watchKeys = () => SYMS.map(itemKey);
function byKey(key){ return SYMS.find(s=>itemKey(s)===key); }
const isEq = s => (s.type||'EQ')==='EQ';                              // analytics widgets are equity-only
const TYPE_LABEL = {EQ:'Equity',FUT:'Future',CE:'Call',PE:'Put',CUR:'Currency'};
function instSub(s){                                                  // watchlist subtitle per segment
  if(isEq(s) && s.sector) return s.sector;
  const t=TYPE_LABEL[s.type]||s.type||'';
  const exp=s.expiry?(' · '+new Date(s.expiry).toLocaleDateString('en-IN',{day:'2-digit',month:'short'})):'';
  const k=(s.type==='CE'||s.type==='PE')&&s.strike?(' '+Math.round(s.strike)):'';
  return `${s.exch||'NSE'} · ${t}${k}${exp}`;
}
const HOLDINGS = SYMS.filter(s=>s.hold).map(s=>({...s, pnl:(s.ltp-s.hold.avg)*s.hold.qty, val:s.ltp*s.hold.qty}));
const TOT_PNL = Math.round(HOLDINGS.reduce((a,h)=>a+h.pnl,0));
const EXPOSURE = HOLDINGS.reduce((a,h)=>a+h.val,0);
const CASH = 482000;
const SECTORS = [
  {s:'Auto',base:2.6},{s:'IT',base:1.8},{s:'Energy',base:1.1},{s:'PSU Bank',base:1.3},
  {s:'Banks',base:0.7},{s:'Pharma',base:0.4,def:true},{s:'FMCG',base:-0.2,def:true},
  {s:'Metals',base:-1.4},{s:'Realty',base:-2.1},
];
const STRIKES=[23300,23350,23400,23450,23500,23550,23600], SPOT=23450;

/* ---------- investor-mode data ---------- */
const SIPS=[
  {name:'Nifty 50 Index Fund', amt:5000, day:5,  xirr:14.2, val:182000},
  {name:'Flexi Cap Fund',      amt:7500, day:10, xirr:17.8, val:246500},
  {name:'RELIANCE · stock SIP', amt:3000, day:15, xirr:11.4, val:71200},
];
const GOALS=[
  {name:'Retirement',      target:20000000, cur:4820000, icon:'flag'},
  {name:'Child education', target:5000000,  cur:1640000, icon:'target'},
  {name:'Emergency fund',  target:600000,   cur:540000,  icon:'shield'},
];
const ALLOC=[
  {a:'Equity', cur:64, tgt:60, col:'green'},
  {a:'Debt',   cur:18, tgt:25, col:'blue'},
  {a:'Gold',   cur:9,  tgt:10, col:'amber'},
  {a:'Cash',   cur:9,  tgt:5,  col:'slate'},
];
/* mutual-fund holdings (for the Stocks/MF split + portfolio overview) */
const MF_HELD=[
  {name:'Parag Parikh Flexi Cap', cat:'Flexi Cap', inv:120000, cur:163400, xirr:18.6},
  {name:'Nifty 50 Index Fund',    cat:'Index',     inv:90000,  cur:108200, xirr:14.2},
  {name:'ICICI Pru Corporate Bond',cat:'Debt',     inv:60000,  cur:66100,  xirr:7.8},
  {name:'SBI Gold Fund',          cat:'Gold',      inv:30000,  cur:35400,  xirr:11.1},
];
/* market events + news (curated from the live dashboard; our own copy) */
const MARKET_EVENTS=[
  {co:'HDFC Bank',          type:'Dividend',      detail:'Final dividend recommended',         date:'19 Jun'},
  {co:'Polycab India',      type:'Dividend',      detail:'Final dividend recommended',         date:'19 Jun'},
  {co:'String Metaverse',   type:'Bonus',         detail:'2:9 bonus issue of equity',          date:'19 Jun'},
  {co:'State Bank of India',type:'Board Meeting', detail:'Raising up to ₹60,000 cr via bonds', date:'18 Jun'},
  {co:'Bata India',         type:'Board Meeting', detail:'Appointed new MD & CEO',             date:'18 Jun'},
  {co:'Brigade Enterprises',type:'Bonus',         detail:'1:3 bonus issue of equity',          date:'17 Jun'},
  {co:'Tata Steel',         type:'Dividend',      detail:'Dividend recommended',               date:'12 Jun'},
  {co:'City Union Bank',    type:'Bonus',         detail:'1:3 bonus issue of equity',          date:'12 Jun'},
];
const NEWS_FEED=[
  {head:'Jio Platforms files DRHP for proposed IPO',              co:'Reliance Industries',  date:'19 Jun 2026'},
  {head:'HCL Tech partners with e.solutions (Volkswagen group)',  co:'HCL Technologies',     date:'19 Jun 2026'},
  {head:'Alembic Pharma gets USFDA nod for Binimetinib tablets',  co:'Alembic Pharma',       date:'19 Jun 2026'},
  {head:'SBI board approves raising up to ₹60,000 cr via bonds',  co:'State Bank of India',  date:'18 Jun 2026'},
  {head:'Tata Motors announces hike in commercial-vehicle prices',co:'Tata Motors',          date:'18 Jun 2026'},
  {head:'Bajaj Finance raises ₹1,455 cr via NCDs',               co:'Bajaj Finance',        date:'18 Jun 2026'},
];

/* ---------- helpers ---------- */
const $ = id => document.getElementById(id);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
// Formatters are null/NaN-safe: missing live data renders an honest ", " / neutral, never "₹NaN", "NaN%", or a false green.
const inr=n=>Number.isFinite(n)?'₹'+Math.round(n).toLocaleString('en-IN'):'-';
const inrL=n=>Number.isFinite(n)?'₹'+(n/100000).toFixed(2)+'L':'-';
const pct=n=>Number.isFinite(n)?(n>=0?'+':'')+n.toFixed(2)+'%':'-';
const cls=n=>Number.isFinite(n)?(n>=0?'up':'down'):'';
const tone=n=>n>0?'up':n<0?'down':'';
// ---- Unified P&L presentation (both books) ------------------------------------------------
// One currency-aware signed formatter + the canonical Realised / Unrealised / Net triad and a
// compact inline form. Reuses sgn() (₹) / cxMoney() ($) + secStats(). Net is ALWAYS computed
// realised+unrealised: never trusts a separate "total" field. cur is 'inr' (default) or 'usd'.
function pnlFmt(v,cur){ return cur==='usd' ? cxMoney(v) : sgn(v); }
function pnlTriad(realised,unrealised,cur){
  const r=+realised||0, u=+unrealised||0, net=r+u;
  return [
    {l:'Realised', v:pnlFmt(r,cur), s:'booked', tone:tone(r)},
    {l:'Unrealised', v:pnlFmt(u,cur), s:'open · live', tone:tone(u)},
    {l:'Net', v:pnlFmt(net,cur), s:'realised + unrealised', tone:tone(net)},
  ];
}
function pnlCompact(realised,unrealised,cur){
  const r=+realised||0, u=+unrealised||0, net=r+u;
  return `<span class="pnl-net num ${tone(net)}">${pnlFmt(net,cur)}</span>`
    +`<span class="pnl-ru">R <i class="num ${tone(r)}">${pnlFmt(r,cur)}</i> · U <i class="num ${tone(u)}">${pnlFmt(u,cur)}</i></span>`;
}
const bySym=s=>SYMS.find(x=>x.sym===s||itemKey(x)===s);

/* ---------- icon set (monochrome, currentColor) ---------- */
const ICONS={
  bull:'<path d="M3 4c2.2 0 3.6 1.3 4.6 3.1"/><path d="M21 4c-2.2 0-3.6 1.3-4.6 3.1"/><path d="M6 7c1 4.6 3.2 7 6 7s5-2.4 6-7"/><path d="M8.6 16.4c.9 1.1 2.1 1.6 3.4 1.6s2.5-.5 3.4-1.6"/><path d="M10 19l-1 2M14 19l1 2"/>',
  bear:'<circle cx="6.2" cy="5.2" r="2.2"/><circle cx="17.8" cy="5.2" r="2.2"/><path d="M6.6 6.4c1 4.4 3 6.8 5.4 6.8s4.4-2.4 5.4-6.8"/><path d="M12 13.2v3M9.6 18h4.8"/>',
  neutral:'<circle cx="12" cy="12" r="8.5"/><path d="M7.5 12h9"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  minus:'<path d="M5 12h14"/>',
  expand:'<path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M3 16v3a2 2 0 0 0 2 2h3"/>',
  compress:'<path d="M8 5v3a2 2 0 0 1-2 2H4M16 5v3a2 2 0 0 0 2 2h3M3 14h3a2 2 0 0 1 2 2v3M21 14h-3a2 2 0 0 0-2 2v3"/>',
  close:'<path d="M6 6l12 12M18 6L6 18"/>',
  sliders:'<path d="M4 7h16M4 12h16M4 17h16"/><circle cx="9" cy="7" r="2.2" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="2.2" fill="currentColor" stroke="none"/><circle cx="7" cy="17" r="2.2" fill="currentColor" stroke="none"/>',
  shield:'<path d="M12 3l7 3v5c0 4.2-2.9 7.4-7 8.6C7.9 18.4 5 15.2 5 11V6l7-3z"/>',
  scale:'<path d="M12 4v16M7 20h10M5 8h14"/><path d="M5 8l-2.4 5a2.8 2.8 0 0 0 4.8 0L5 8zM19 8l-2.4 5a2.8 2.8 0 0 0 4.8 0L19 8z"/>',
  scissors:'<circle cx="6" cy="6.5" r="2.4"/><circle cx="6" cy="17.5" r="2.4"/><path d="M8 8l12 8M8 16L20 8"/>',
  droplet:'<path d="M12 3.2s6 6.4 6 10.4a6 6 0 0 1-12 0C6 9.6 12 3.2 12 3.2z"/>',
  trendUp:'<path d="M3 17l6-6 4 4 8-8M21 7h-5M21 7v5"/>',
  trendDown:'<path d="M3 7l6 6 4-4 8 8M21 17h-5M21 17v-5"/>',
  clock:'<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v4.7l3 1.8"/>',
  target:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.6"/>',
  link:'<path d="M9 15l6-6M10.5 6.5l1-1a4 4 0 0 1 6 6l-1 1M13.5 17.5l-1 1a4 4 0 0 1-6-6l1-1"/>',
  bolt:'<path d="M13 2L4.5 13.5H10l-1 8.5 9.5-12.5H13l.9-7.5z"/>',
  check:'<path d="M4 12.5l5 5L20 6.5"/>',
  alert:'<path d="M12 3.5l9 16H3l9-16z"/><path d="M12 10v4.5M12 17.5h.01"/>',
  swap:'<path d="M4 9h13M13 5l4 4-4 4M20 15H7M11 19l-4-4 4-4"/>',
  star:'<path d="M12 3.5l2.6 5.3 5.8.9-4.2 4.1 1 5.8L12 16.8 6.8 19.6l1-5.8L3.6 9.7l5.8-.9L12 3.5z"/>',
  grip:'<circle cx="9" cy="6" r="1.1" fill="currentColor" stroke="none"/><circle cx="15" cy="6" r="1.1" fill="currentColor" stroke="none"/><circle cx="9" cy="12" r="1.1" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="1.1" fill="currentColor" stroke="none"/><circle cx="9" cy="18" r="1.1" fill="currentColor" stroke="none"/><circle cx="15" cy="18" r="1.1" fill="currentColor" stroke="none"/>',
  sun:'<circle cx="12" cy="12" r="4.2"/><path d="M12 2.6v2.4M12 19v2.4M4.6 4.6l1.7 1.7M17.7 17.7l1.7 1.7M2.6 12h2.4M19 12h2.4M4.6 19.4l1.7-1.7M17.7 6.3l1.7-1.7"/>',
  moon:'<path d="M20 13.6A8 8 0 0 1 10.4 4 7 7 0 1 0 20 13.6z"/>',
  wallet:'<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H17a2 2 0 0 1 2 2v0H5.5"/><path d="M3 7.5V17a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-7H6.5"/><circle cx="16.5" cy="13" r="1.1" fill="currentColor" stroke="none"/>',
  sprout:'<path d="M12 21v-8"/><path d="M12 13C12 9 8.5 7 5 7c0 4 3 6 7 6z"/><path d="M12 11c0-3.2 2.8-5 6-5 0 3.2-2.6 5-6 5z"/>',
  pie:'<path d="M12 3a9 9 0 1 0 9 9h-9V3z"/><path d="M14 3.2A9 9 0 0 1 20.8 10H14V3.2z"/>',
  flag:'<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  repeat:'<path d="M4 9l2.5-2.5A6 6 0 0 1 18 8M20 15l-2.5 2.5A6 6 0 0 1 6 16"/><path d="M17 4v3h-3M7 20v-3h3"/>',
  layout:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  spark:'<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z"/><path d="M19 14l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2z"/>',
  cpu:'<rect x="6" y="6" width="12" height="12" rx="2"/><rect x="9.5" y="9.5" width="5" height="5" rx="1"/><path d="M9 3v2M15 3v2M9 19v2M15 19v2M3 9h2M3 15h2M19 9h2M19 15h2"/>',
  send:'<path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>',
  activity:'<path d="M3 12h4l2.5-7 5 14 2.5-7H21"/>',
  download:'<path d="M12 3v11M8 10l4 4 4-4M4 20h16"/>',
  lock:'<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7.5a4 4 0 0 1 8 0V11"/>',
  layers:'<path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5"/>',
};
function icon(name,size){const s=size||16;return `<svg class="ico" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]||''}</svg>`;}

/* ============================================================
   DETECTION ENGINE
   ============================================================ */
function readSignals(){return{trend:+$('sTrend').value,vix:+$('sVix').value,ad:+$('sAd').value,rsi:+$('sRsi').value,pnl:+$('sPnl').value,macd:$('macdToggle').dataset.on==='true'};}
function scoreSignals(s){return{
  trend:clamp(s.trend,-100,100),
  vix:clamp(Math.round((15.5-s.vix)*20),-100,100),
  ad:clamp(Math.round(s.ad>=1?(s.ad-1)*75:(s.ad-1)*125),-100,100),
  mom:clamp(Math.round((s.rsi-50)*3+(s.macd?15:-15)),-100,100),
  pers:clamp(Math.round(s.pnl*14),-100,100),
};}
const W={trend:.30,vix:.20,ad:.20,mom:.20,pers:.10};
const composite=sc=>Math.round(sc.trend*W.trend+sc.vix*W.vix+sc.ad*W.ad+sc.mom*W.mom+sc.pers*W.pers);
function classify(S,prev){
  if(prev==='bull')return S<15?(S<=-25?'bear':'neutral'):'bull';
  if(prev==='bear')return S>-15?(S>=25?'bull':'neutral'):'bear';
  return S>=25?'bull':S<=-25?'bear':'neutral';
}
// 4-state regime LABEL (the bot's taxonomy) ← 3-state directional THEME + VIX. The terminal skin stays 3-state
// (bull/neutral/bear); High-Vol and Choppy are richer *labels* that map onto the bear/neutral skins respectively.
const THEME_OF={Bull:'bull',Bear:'bear',Choppy:'neutral','High-Vol':'bear'};   // label → terminal theme
function regime4(theme3,vix,prevLabel){
  const hi = vix>=20 || (prevLabel==='High-Vol' && vix>=18);   // VIX band: enter High-Vol at 20, hold until <18 (no flicker)
  if(hi) return 'High-Vol';
  return theme3==='bull'?'Bull':theme3==='bear'?'Bear':'Choppy';
}
function confidence(S,sc){const sign=Math.sign(S)||1;const agree=[sc.trend,sc.vix,sc.ad,sc.mom,sc.pers].filter(v=>Math.sign(v)===sign).length/5;return Math.round((0.6*Math.min(Math.abs(S)/50,1)+0.4*agree)*100);}
function reasonText(regime,sc){
  const map=[[sc.trend,'BTC '+(sc.trend>0?'above stacked MAs':'broke below key MAs')],[sc.vix,sc.vix>0?'volatility cooling':'volatility spiking'],[sc.ad,sc.ad>0?'breadth strong':'breadth collapsing'],[sc.mom,sc.mom>0?'momentum up':'momentum weak'],[sc.pers,sc.pers>0?'your P&L rising':'your portfolio drawing down']];
  const want=regime==='bull'?1:-1;
  return map.filter(m=>Math.sign(m[0])===want).sort((a,b)=>Math.abs(b[0])-Math.abs(a[0])).slice(0,2).map(m=>m[1]).join(', ')||'signals balanced';
}

/* ---------- live orderbook ---------- */
let ORDER_ID=104;
// Order book starts empty: no fabricated history. Real paper orders (paper:true) appear
// here as the user places them from the order pad; live orders need a connected Kite session.
const SEED_ORDERS=[];
const REGIME_SYM={bull:'RELIANCE',neutral:'HDFCBANK',bear:'ADANIENT'};
const SL_W={bull:0.025,neutral:0.018,bear:0.010};
// Curated cross-market headline tape, one ticker spanning equities, indices & commodities
const HEADLINE_INDEX=[['NIFTY 50',23450],['SENSEX',77100],['BANK NIFTY',50200],['FIN NIFTY',23010],['GOLD',71800],['SILVER',89500],['CRUDE OIL',6420]];
// Everything a user can pin to the rolling ticker: headline indices/commodities + every stock in the universe.
const TICKER_UNIVERSE=[
  ...HEADLINE_INDEX.map(([name,base])=>({name,base,grp:'Indices & commodities'})),
  ...SYMS.map(s=>({name:s.sym,base:s.ltp,grp:'Stocks'})),
];
const TICKER_DEFAULT={items:HEADLINE_INDEX.map(([n])=>n), speed:60, rolling:true};   // speed = px/sec scroll rate

/* ---------- state ---------- */
const state={mode:'auto',displayed:'bull',engine:'bull',prevVix:12.4,forceHard:false,suggesting:false,
  plan:'algopro',billing:'mo',           // monetization: current tier + billing cycle (persisted)
  simTimer:null,panelTab:null,
  selected:null, orderSide:null, orderQty:null,        // order ticket
  orders:SEED_ORDERS.slice(),                          // live orderbook
  wlOrder:null, dragSym:null,                          // watchlist custom order
  paneW:null, chartH:null,                             // resizing
  surface:'day', tapeT:null,                           // floor mode + live tape
  tradeFromChart:null,                                 // bracket dragged on the chart
  persona:null,                                        // 'trader' | 'investor' (null = first run)
  investAmt:null, investType:'cnc', investSection:null,// investor order pad + tool hub
  portfolioTab:'all',                                  // investing hub: all|stocks|mf
  layout:'originals',                                  // trader workspace preset (originals|charts|watchlist|options|futures|build)
  desk:{view:'chain',under:0,exp:0,legs:[]},           // derivatives desk (ephemeral)
  canvas:[], dragCv:null,                              // build-your-own widget canvas (persisted list of {key,span})
  toolState:{},                                        // ephemeral per-tool UI (sub-tab/filter/draft); not persisted
  widgets:null, dragWidget:null,                       // per-persona widget stack
  revealing:false,                                     // cinematic transition in flight
  simOverride:false,                                   // regime panel: false = mirrors live Kite signals; true = user what-if (drag/preset/demo)
  regimeLabel:null,                                     // 4-state regime label (Bull/Bear/Choppy/High-Vol) shown in the panel readout
  cards:{},                                            // per-card min/max state
  ticker:{items:TICKER_DEFAULT.items.slice(),speed:TICKER_DEFAULT.speed,rolling:TICKER_DEFAULT.rolling}, // rolling index tape (user-configurable)
  lastFocus:null};

let onboarding=false;   // first-run wizard in flight (keeps the persona gate open across steps)

/* ---------- persona axis (orthogonal to regime) ---------- */
const PERSONA={
  trader:{ label:'Trading', icon:'trendUp', fundsLabel:r=>r==='bear'?'Cash / dry powder':'Margin available',
    chartTf:'15m' },
  investor:{ label:'Investing', icon:'sprout', fundsLabel:()=>'Investable surplus',
    chartTf:'1D' },
  algo:{ label:'Algo', icon:'cpu', fundsLabel:()=>'Deployable capital',
    chartTf:'15m' },
  ai:{ label:'AI', icon:'spark', fundsLabel:()=>'Buying power',
    chartTf:'1D' },
};
const PERSONA_KEYS=['trader','investor','algo','ai'];
/* persona × regime playbook line shown in the regime bar */
const PLAY={
  trader:{
    bull:`Opportunity-capture mode. Leads with <b>breakout scans &amp; long entries</b>; watchlist sorted by momentum and the order pad defaults to BUY with a bracket stop.`,
    neutral:`Signals are mixed. <b>BUY and SELL stay equally weighted</b>: trade the range and keep size light until a decisive break.`,
    bear:`Capital-preservation mode. Leads with <b>portfolio risk, hedges &amp; stops</b>: losers surface first and the order pad defaults to PROTECT/SELL.`,
  },
  investor:{
    bull:`Stay-disciplined mode. Markets look extended, <b>rebalance &amp; book partial profits</b>, don't chase highs. Keep your SIPs running.`,
    neutral:`Keep compounding. A range is <b>ideal for rupee-cost averaging</b>: continue SIPs and accumulate quality on dips.`,
    bear:`Accumulation mode. Lower prices are a chance to <b>step up SIPs &amp; average down</b> quality names. Tilt to defensives, don't panic-sell.`,
  },
  algo:{
    bull:`Momentum regime, <b>trend-following algos lead</b>. Breakout &amp; momentum strategies are favoured; keep stops trailing.`,
    neutral:`Choppy regime, <b>mean-reversion algos lead</b>. Range &amp; RSI strategies suit; throttle trend systems and cut size.`,
    bear:`Risk-off regime, <b>defensive &amp; short algos lead</b>. Tighten max-drawdown limits; the kill-switch is one tap away.`,
  },
  ai:{
    bull:`AI copilot is watching momentum &amp; breadth, ask for <b>fresh ideas, screeners or a hedge</b>. Confidence is shown on every signal.`,
    neutral:`AI copilot sees a balanced tape, ask it to <b>scan ranges, compare names or explain your portfolio</b>.`,
    bear:`AI copilot is flagging risk, ask for <b>hedges, downside screens or a portfolio health check</b>. Nothing trades without your confirm.`,
  },
};

/* ---------- persistence (localStorage) ---------- */
const LS_KEY='tradepro.terminal.v1';
function saveState(){try{localStorage.setItem(LS_KEY,JSON.stringify({
  mode:state.mode,regime:state.displayed,surface:state.surface,regimeCollapsed:state.regimeCollapsed,
  watchlist:SYMS.map(s=>({sym:s.sym,name:s.name,exch:s.exch,type:s.type,key:itemKey(s),token:s.token,sector:s.sector,beta:s.beta,lot:s.lot,expiry:s.expiry,strike:s.strike,seg:s.seg,hold:s.hold})),wlCustom:!!state.wlCustom,
  selected:state.selected,paneW:state.paneW,chartH:state.chartH,
  persona:state.persona,investSection:state.investSection,layout:state.layout,customLayouts:state.customLayouts,activeCustom:state.activeCustom,aiCfg:state.aiCfg,widgets:state.widgets,cards:state.cards,ticker:state.ticker,algo:(state.algo?{view:state.algo.view,exec:state.algo.exec,market:state.algo.market}:null),chart:(window.TPChart?TPChart.serialize():null)}));}catch(e){}}
function saveChart(){saveState();}   // persist callback for the chart engine
function loadState(){
  let s; try{s=JSON.parse(localStorage.getItem(LS_KEY));}catch(e){return null;}
  if(!s||typeof s!=='object') return null;
  // BUG FIX (2026-09-09): everything below reconstructs `out` from a persisted snapshot that could
  // be anything (an old schema, a partially-written value, a future field). It used to have no
  // enclosing try/catch, and neither does the caller at boot (line ~6976) - one unexpected shape
  // anywhere in here threw uncaught and aborted the whole boot sequence mid-way, leaving the header
  // chrome mounted but everything after it (including the Algo Studio) never rendered, with no
  // in-app recovery. Any failure now clears the corrupted snapshot and boots fresh instead.
  try{
  const oneOf=(v,arr,d)=>arr.indexOf(v)>=0?v:d;
  const numIn=(v,lo,hi)=>typeof v==='number'&&isFinite(v)&&v>=lo&&v<=hi?v:null;
  const out={
    mode:oneOf(s.mode,['auto','manual'],'auto'),
    regime:oneOf(s.regime,['bull','neutral','bear'],'bull'),
    surface:oneOf(s.surface,['day','night'],'day'),
    regimeCollapsed:typeof s.regimeCollapsed==='boolean'?s.regimeCollapsed:undefined,
    persona:oneOf(s.persona,['trader','investor','algo','ai'],null),
    investSection:oneOf(s.investSection,INVEST_TOOLS.map(t=>t.key),null),
    layout:oneOf(s.layout,['originals','charts','watchlist','options','futures','build'],'originals'),
    canvas:Array.isArray(s.canvas)?s.canvas.filter(c=>c&&typeof c.key==='string').map(c=>({key:c.key,span:c.span===2?2:1})):null, // legacy single canvas (migrated on boot)
    customLayouts:Array.isArray(s.customLayouts)?s.customLayouts.filter(l=>l&&typeof l.id==='string'&&typeof l.name==='string').map(l=>{
      const okIdx=n=>Number.isInteger(n)&&n>=0&&n<=2;                                  // 3 underlyings (clamped, ordering-independent)
      const mkCards=arr=>Array.isArray(arr)?arr.filter(c=>c&&typeof c.key==='string').map(c=>{const o={key:c.key,span:c.span===3?3:c.span===2?2:1}; if(c.grp==='A'||c.grp==='B')o.grp=c.grp; return o;}):[];
      const mkSync=sy=>({A:okIdx(sy&&sy.A)?sy.A:0,B:okIdx(sy&&sy.B)?sy.B:1});
      let tabs=Array.isArray(l.tabs)?l.tabs.filter(t=>t&&typeof t.id==='string').map(t=>({id:String(t.id).slice(0,40),name:(typeof t.name==='string'?t.name:'Tab').slice(0,24),cards:mkCards(t.cards),sync:mkSync(t.sync)})):[];
      if(!tabs.length) tabs=[{id:'t'+Math.random().toString(36).slice(2,8),name:'Main',cards:mkCards(l.cards),sync:{A:0,B:1}}];   // migrate old flat `cards`
      const activeTab=(typeof l.activeTab==='string'&&tabs.some(t=>t.id===l.activeTab))?l.activeTab:tabs[0].id;
      return {id:String(l.id).slice(0,40),name:String(l.name).slice(0,40),tabs,activeTab};
    }):[],
    activeCustom:(typeof s.activeCustom==='string')?s.activeCustom:null,
    aiCfg:(s.aiCfg&&typeof s.aiCfg==='object')?{endpoint:(typeof s.aiCfg.endpoint==='string'&&/^https?:\/\//.test(s.aiCfg.endpoint))?s.aiCfg.endpoint.slice(0,300):'',model:['claude-opus-4-8','claude-sonnet-4-6','claude-haiku-4-5'].indexOf(s.aiCfg.model)>=0?s.aiCfg.model:'claude-opus-4-8'}:null,
    widgets:(()=>{const def={trader:WIDGET_DEFAULTS.trader.slice(),investor:WIDGET_DEFAULTS.investor.slice()};
      if(s.widgets&&typeof s.widgets==='object')['trader','investor'].forEach(p=>{
        const valid=WIDGET_CATALOG[p].map(w=>w.key);
        if(Array.isArray(s.widgets[p])){const a=[...new Set(s.widgets[p].filter(k=>valid.includes(k)))]; def[p]=a;}});
      return def;})(),
    cards:(()=>{const o={};if(s.cards&&typeof s.cards==='object')['watchlist','chart','panel','order','context'].forEach(k=>{o[k]=oneOf(s.cards[k],['normal','min','max'],'normal');});return o;})(),
    ticker:(()=>{const d={items:TICKER_DEFAULT.items.slice(),speed:TICKER_DEFAULT.speed,rolling:true};
      if(s.ticker&&typeof s.ticker==='object'){
        if(Array.isArray(s.ticker.items)){const valid=TICKER_UNIVERSE.map(u=>u.name);const a=[...new Set(s.ticker.items.filter(n=>valid.includes(n)))]; if(a.length)d.items=a;}
        if(typeof s.ticker.speed==='number'&&s.ticker.speed>=20&&s.ticker.speed<=180)d.speed=Math.round(s.ticker.speed);
        if(typeof s.ticker.rolling==='boolean')d.rolling=s.ticker.rolling;
      } return d;})(),
    selected:(typeof s.selected==='string')?s.selected:null,   // validated after the watchlist is rebuilt
    chartH:numIn(s.chartH,120,500), wlCustom:!!s.wlCustom, paneW:null,
    chart:(s.chart&&typeof s.chart==='object')?s.chart:null,   // validated inside TPChart.restore
  };
  // universal watchlist: validate the persisted instrument list (any segment)
  if(Array.isArray(s.watchlist)){
    const seen=new Set(), wl=[];
    for(const it of s.watchlist){
      if(!it||typeof it.sym!=='string') continue;
      const exch=typeof it.exch==='string'?it.exch:'NSE';
      const key=(typeof it.key==='string'&&it.key.includes(':'))?it.key:exch+':'+it.sym;
      if(seen.has(key)) continue; seen.add(key);
      wl.push({sym:sanInstr(it.sym), name:sanInstr(typeof it.name==='string'?it.name:it.sym), exch, key, ltp:0, chg:0, live:false,
        type:sanInstr(typeof it.type==='string'?it.type:'EQ'), token:Number.isFinite(it.token)?it.token:null,
        sector:typeof it.sector==='string'?it.sector:undefined, beta:typeof it.beta==='number'?it.beta:undefined,
        lot:typeof it.lot==='number'?it.lot:undefined, expiry:typeof it.expiry==='string'?it.expiry:undefined,
        strike:typeof it.strike==='number'?it.strike:undefined, seg:typeof it.seg==='string'?it.seg:undefined,
        hold:(it.hold&&typeof it.hold==='object')?it.hold:undefined});
    }
    if(wl.length) out.watchlist=wl.slice(0,100);   // cap a runaway list
  }
  if(s.paneW&&typeof s.paneW==='object'){
    const l=numIn(s.paneW.left,200,600), rr=numIn(s.paneW.right,200,600);
    if(l!=null&&rr!=null) out.paneW={left:l,right:rr};
  }
  return out;
  }catch(e){
    try{ localStorage.removeItem(LS_KEY); }catch(e2){}
    return null;
  }
}

/* ---------- a11y live announcer ---------- */
function announce(msg){const el=$('srAnnounce');if(el)el.textContent=msg;}

/* ============================================================
   RENDER: TOP INDEX + REGIME BAR
   ============================================================ */
function liveS(){return composite(scoreSignals(readSignals()));}
function tickerItems(){ const uni=new Map(TICKER_UNIVERSE.map(u=>[u.name,u])); return (state.ticker.items||[]).map(n=>uni.get(n)).filter(Boolean); }
// Header market toggle (left of search), Indian ⇄ Crypto. Always visible; drives the rolling tape + Algo Studio scope.
function renderHdrMarket(){
  const el=$('hdrMkt'); if(!el) return;
  if(!state.algo) state.algo={};
  if(CRYPTO_ONLY) state.algo.market='crypto';
  else if(!state.algo.market) state.algo.market='in';
  const crypto=state.algo.market==='crypto';
  if(CRYPTO_ONLY){
    el.innerHTML=`<span class="mkt-badge crypto-only" title="Crypto markets · Binance spot · 24/7"><span class="mkt-fl">₿</span> Crypto</span>`;
    return;
  }
  el.innerHTML=`<div class="mkt-toggle hdr" role="tablist" aria-label="Market">`
    +`<button class="mkt-tab${!crypto?' on':''}" role="tab" aria-selected="${!crypto}" data-algomkt="in"><span class="mkt-fl">🇮🇳</span> Indian</button>`
    +`<button class="mkt-tab${crypto?' on':''}" role="tab" aria-selected="${crypto}" data-algomkt="crypto"><span class="mkt-fl">₿</span> Crypto</button></div>`;
  el.querySelectorAll('[data-algomkt]').forEach(b=>b.onclick=()=>setMarket(b.dataset.algomkt));
}
// Single source of truth for the market switch, used by the header toggle (and any other surface).
function setMarket(m){
  if(!state.algo) state.algo={};
  if(CRYPTO_ONLY) m='crypto';
  if(state.algo.market===m) return;
  state.algo.market=m; saveState();
  renderHdrMarket();
  renderTopIndex();                                   // swap the rolling tape (Indian ⇄ Crypto)
  if(m==='crypto'){ loadCrypto().then(()=>{ if(state.algo.market==='crypto'){ patchCryptoTape(); if(isAlgo()) renderAlgo(); } }); connectCryptoWS(); }
  else disconnectCryptoWS();                            // leave crypto → tear down the socket
  if(isAlgo()) renderAlgo();                           // re-scope the Algo Studio if it's open
}
function renderTopIndex(){
  const track=$('topIndex'); if(!track) return;
  // CRYPTO MODE: the global tape rolls live Binance prices (independent of Kite). Real data only.
  // CRYPTO_ONLY is known at script load, before state.algo.market gets set during boot (init() sets
  // it a few calls later) - checking it directly here closes that gap instead of racing it, which
  // used to flash the old "connect Kite" banner for a moment on every fresh load.
  const bar=track.closest('.ticker-bar'); const crypto=CRYPTO_ONLY||!!(state.algo&&state.algo.market==='crypto');
  if(bar) bar.classList.toggle('crypto',crypto);
  if(crypto){ renderCryptoTape(track); return; }
  // NO FAKE PRICES: when Kite isn't connected, show an honest banner instead of synthetic ticks.
  if(!BOT.live){
    track.classList.remove('rolling'); const vp0=track.parentElement; if(vp0) vp0.classList.add('static');
    track.innerHTML=`<div class="tb-seq"><div class="tix tix-offline">${icon('shield',12)}<span>Live market data off, run <b>python3 login.py</b> to connect Kite</span></div></div>`;
    track.dataset.tsig='off';
    return;
  }
  const items=tickerItems();
  // Structure guard: when the instrument SET + rolling flag are unchanged, DON'T rebuild the DOM
  // (a full innerHTML swap flickers and resets the scroll). Patch live values in place instead, 
  // so the tape is flicker-free no matter who calls this (loadMarket / recompute / ticker settings).
  const tsig='L|'+(!!state.ticker.rolling)+'|'+items.map(i=>i.name).join(',');
  if(track.dataset.tsig===tsig && track.querySelector('.tix')){ patchTape(); return; }
  track.dataset.tsig=tsig;
  const seq=items.map(({name})=>{
    const rq=realQuote(name);
    // data-tname lets patchTopIndex() update the value/chg in place on every tick (no animation restart)
    if(!rq) return `<div class="tix" data-tname="${esc(name)}"><span class="tix-name">${esc(name)}</span><div class="tix-row"><span class="tix-val num muted">—</span><span class="tix-chg num" hidden></span></div></div>`;
    const dec=rq.ltp>=20000?0:(rq.ltp>=1000?1:2);
    return `<div class="tix" data-tname="${esc(name)}"><span class="tix-name">${esc(name)}</span><div class="tix-row">
      <span class="tix-val num">${rq.ltp.toLocaleString('en-IN',{maximumFractionDigits:dec})}</span>
      <span class="tix-chg ${cls(rq.chg||0)} num">${pct(rq.chg||0)}</span></div></div>`;
  }).join('') || `<div class="tix tix-empty">No instruments, add some from ticker settings ▸</div>`;
  const roll=!!state.ticker.rolling && items.length>1;
  track.classList.toggle('rolling',roll);
  const vp=track.parentElement; if(vp) vp.classList.toggle('static',!roll);
  // two identical sequences let the track loop seamlessly at translateX(-50%)
  track.innerHTML=`<div class="tb-seq tb-seq-a">${seq}</div>`+(roll?`<div class="tb-seq tb-seq-b" aria-hidden="true">${seq}</div>`:'');
  applyTickerSpeed();
  connectStream();   // keep the live tick subscription in sync with the ticker's instruments
}
// Patch ONLY the rolling tape's price/chg cells in place (both looping copies) so the scroll
// animation never restarts. Driven by the fast tick loop + SSE, not the 30s market poll.
function patchTopIndex(){
  const track=$('topIndex'); if(!track||!BOT.live) return;
  track.querySelectorAll('.tix[data-tname]').forEach(el=>{
    const name=el.dataset.tname, rq=realQuote(name);
    const valEl=el.querySelector('.tix-val'), chgEl=el.querySelector('.tix-chg');
    if(!valEl) return;
    if(!rq){ valEl.textContent='-'; valEl.classList.add('muted'); if(chgEl)chgEl.hidden=true; return; }
    const dec=rq.ltp>=20000?0:(rq.ltp>=1000?1:2);
    const txt=rq.ltp.toLocaleString('en-IN',{maximumFractionDigits:dec});
    if(valEl.textContent!==txt){
      const prev=parseFloat(valEl.dataset.raw); const dir=isFinite(prev)?Math.sign(rq.ltp-prev):0;
      valEl.textContent=txt; valEl.classList.remove('muted'); valEl.dataset.raw=rq.ltp;
      if(dir){ valEl.classList.remove('tick-up','tick-dn'); void valEl.offsetWidth; valEl.classList.add(dir>0?'tick-up':'tick-dn'); }
    }
    if(chgEl){ chgEl.hidden=false; chgEl.textContent=pct(rq.chg||0); chgEl.className='tix-chg '+cls(rq.chg||0)+' num'; }
  });
}
/* ---- CRYPTO rolling tape: same flicker-free marquee, fed by live Binance data (no Kite) ---- */
function renderCryptoTape(track){
  // Kick a fetch if we've never loaded crypto; patch the tape (+resize) once it lands.
  if(!CRYPTO.loaded && !CRYPTO.busy) loadCrypto().then(()=>{ if(state.algo&&state.algo.market==='crypto'){ patchCryptoTape(); applyTickerSpeed(); } });
  const tsig='C|'+CRYPTO_UNIVERSE.map(c=>c.sym).join(',');
  // Structure guard: only rebuild the DOM when the SET changes, else patch in place.
  if(track.dataset.tsig===tsig && track.querySelector('.tix[data-cname]')){ patchCryptoTape(); return; }
  track.dataset.tsig=tsig;
  const seq=CRYPTO_UNIVERSE.map(c=>{ const q=CRYPTO.quotes[c.sym];
    if(!q) return `<div class="tix" data-cname="${esc(c.sym)}"><span class="tix-name">${esc(c.tk)}</span><div class="tix-row"><span class="tix-val num muted">—</span><span class="tix-chg num" hidden></span></div></div>`;
    return `<div class="tix" data-cname="${esc(c.sym)}"><span class="tix-name">${esc(c.tk)}</span><div class="tix-row">`
      +`<span class="tix-val num" data-raw="${q.ltp}">${cryptoFmt(q.ltp)}</span>`
      +`<span class="tix-chg ${cls(q.chg)} num">${pct(q.chg)}</span></div></div>`;
  }).join('');
  track.classList.add('rolling');
  const vp=track.parentElement; if(vp) vp.classList.remove('static');
  // two identical sequences → seamless translateX(-50%) loop, regardless of tile width
  track.innerHTML=`<div class="tb-seq tb-seq-a">${seq}</div><div class="tb-seq tb-seq-b" aria-hidden="true">${seq}</div>`;
  applyTickerSpeed();
}
// Patch ONLY the crypto tape's value/chg cells in place (both looped copies), driven by the 5s Binance poll.
function patchCryptoTape(){
  const track=$('topIndex'); if(!track) return;
  track.querySelectorAll('.tix[data-cname]').forEach(el=>{
    const q=CRYPTO.quotes[el.dataset.cname], valEl=el.querySelector('.tix-val'), chgEl=el.querySelector('.tix-chg');
    if(!valEl) return;
    if(!q){ valEl.textContent='-'; valEl.classList.add('muted'); if(chgEl)chgEl.hidden=true; return; }
    const txt=cryptoFmt(q.ltp);
    if(valEl.textContent!==txt){
      const prev=parseFloat(valEl.dataset.raw); const dir=isFinite(prev)?Math.sign(q.ltp-prev):0;
      valEl.textContent=txt; valEl.classList.remove('muted'); valEl.dataset.raw=q.ltp;
      if(dir){ valEl.classList.remove('tick-up','tick-dn'); void valEl.offsetWidth; valEl.classList.add(dir>0?'tick-up':'tick-dn'); }
    }
    if(chgEl){ chgEl.hidden=false; chgEl.textContent=pct(q.chg); chgEl.className='tix-chg '+cls(q.chg)+' num'; }
  });
  const src=$('tbCryptoSrc');
  if(src) src.textContent=CRYPTO.live?'● Live · Binance · 24h':(CRYPTO.error?'Binance unreachable, retrying':'Connecting to Binance…');
}
function applyTickerSpeed(){
  const track=$('topIndex'); if(!track) return;
  if(!track.classList.contains('rolling')){track.style.removeProperty('--tk-dur');return;}
  const seqA=track.querySelector('.tb-seq-a'); if(!seqA) return;
  requestAnimationFrame(()=>{const w=seqA.scrollWidth, pps=clamp(state.ticker.speed||60,20,180);
    track.style.setProperty('--tk-dur',Math.max(6,w/pps).toFixed(1)+'s');});
}
/* ---- REALTIME ROLLING TAPE ------------------------------------------------------------
   The index tape used to refresh ONLY via loadMarket(), every 30s, and /api/market is itself
   30s-cached server-side, so it sat frozen between cycles while the watchlist ticked every
   second. Here we stream the index LTPs from the WebSocket-fed /api/ticks cache (the SAME
   sub-second feed the watchlist uses) on the existing 2s poll and patch the tape values
   IN PLACE, no innerHTML swap, so the scroll never resets/jumps. Commodities (MCX) have no
   cheap realtime source (need the resolved futures symbol) and stay on the 30s loadMarket cycle. */
const TAPE_LIVE={'NSE:NIFTY 50':['indices','NIFTY 50'],'NSE:NIFTY BANK':['indices','NIFTY BANK'],
  'NSE:NIFTY FIN SERVICE':['indices','NIFTY FIN SERVICE'],'BSE:SENSEX':['indices','SENSEX'],
  'NSE:INDIA VIX':['vix',null]};
async function loadTape(){
  if(!BOT.live||!BOT.market) return;
  try{
    const keys=Object.keys(TAPE_LIVE);
    const d=await fetch(`${BOT_API}/api/ticks?keys=${encodeURIComponent(keys.join(','))}`).then(r=>r.json());
    const t=d&&d.ticks; if(!t) return;
    for(const k in TAPE_LIVE){
      const v=t[k]; if(!v||v.ltp==null) continue;
      const sec=TAPE_LIVE[k][0], name=TAPE_LIVE[k][1];
      if(sec==='vix'){ BOT.market.vix={ltp:v.ltp,chgPct:v.chg}; }
      else { const m=(BOT.market[sec]=BOT.market[sec]||{}); const prev=m[name]||{}; m[name]={ltp:v.ltp,prevClose:prev.prevClose,chgPct:v.chg}; }
    }
    patchTape();
  }catch(e){}
}
function patchTape(){
  const track=$('topIndex'); if(!track) return;
  track.querySelectorAll('.tix').forEach(tx=>{
    // key off data-tname (robust) not display text, so an esc()'d name still matches
    const key=(tx.dataset.tname || (tx.querySelector('.tix-name')||{}).textContent || '').trim();
    if(!key) return;
    const rq=realQuote(key); if(!rq||rq.ltp==null) return;
    const dec=rq.ltp>=20000?0:(rq.ltp>=1000?1:2);
    const val=tx.querySelector('.tix-val');
    if(val){ val.classList.remove('muted'); val.textContent=rq.ltp.toLocaleString('en-IN',{maximumFractionDigits:dec}); }
    const chg=tx.querySelector('.tix-chg');
    if(chg){ chg.hidden=false; chg.textContent=pct(rq.chg||0); chg.className='tix-chg '+cls(rq.chg||0)+' num'; }   // un-hide: a tile that first painted with no quote must show its % once live
  });
}
/* ---- ticker settings popover (speed · rolling · instruments) ---- */
function openTickerSettings(open){
  const p=$('tickerSettings'), g=$('tickerGear'); if(!p) return;
  if(open===undefined) open=p.hidden;
  if(!open){ p.hidden=true; document.removeEventListener('click',tickerOutside,true); document.removeEventListener('keydown',tickerEsc); if(g)g.setAttribute('aria-expanded','false'); return; }
  renderTickerSettings(); p.hidden=false;
  if(g){const r=g.getBoundingClientRect(); p.style.top=(r.bottom+8)+'px'; p.style.right=Math.max(12,window.innerWidth-r.right)+'px'; g.setAttribute('aria-expanded','true');}
  setTimeout(()=>{document.addEventListener('click',tickerOutside,true);document.addEventListener('keydown',tickerEsc);},0);
}
function tickerOutside(e){ if(!e.target.closest('#tickerSettings,#tickerGear')) openTickerSettings(false); }
function tickerEsc(e){ if(e.key==='Escape'){openTickerSettings(false); const g=$('tickerGear'); if(g)g.focus();} }
let tkQuery='', tkActive=-1, tkRefocus=false; // ticker instrument search: query text, keyboard cursor, refocus-after-add flag
function renderTickerSettings(){
  const p=$('tickerSettings'); if(!p) return; const t=state.ticker, has=new Set(t.items);
  const chips=t.items.map(n=>`<span class="tk-chip"><span>${esc(n)}</span><button class="tk-chip-x" data-tkremove="${esc(n)}" aria-label="Remove ${esc(n)} from ticker">${icon('close',11)}</button></span>`).join('')||`<span class="tk-none">No instruments yet, search below to add one.</span>`;
  p.innerHTML=`
    <div class="tk-head"><b>Ticker settings</b><button class="icon-btn" id="tkClose" aria-label="Close ticker settings">${icon('close',14)}</button></div>
    <div class="tk-row tk-toggle-row"><label id="tkRollLab">Rolling tape</label>
      <button class="mini-toggle" id="tkRoll" role="switch" aria-checked="${t.rolling}" aria-labelledby="tkRollLab" data-on="${t.rolling}">${t.rolling?'On':'Off'}</button></div>
    <div class="tk-row tk-speed-row${t.rolling?'':' tk-disabled'}"><label for="tkSpeed">Speed</label>
      <input type="range" id="tkSpeed" min="20" max="180" step="5" value="${t.speed}" ${t.rolling?'':'disabled'} aria-label="Ticker scroll speed">
      <span class="tk-ends"><i>Slow</i><i>Fast</i></span></div>
    <div class="tk-sec">Instruments <i>${t.items.length}</i></div>
    <div class="tk-chips">${chips}</div>
    <div class="tk-add">
      <div class="tk-search-wrap">${icon('search',13)}<input type="text" id="tkSearch" class="tk-search" value="${esc(tkQuery)}" placeholder="Search any instrument to add…" autocomplete="off" spellcheck="false" role="combobox" aria-expanded="false" aria-controls="tkResults" aria-autocomplete="list"><button class="tk-search-clear" id="tkClear" aria-label="Clear search" ${tkQuery?'':'hidden'}>${icon('close',12)}</button></div>
      <div class="tk-results" id="tkResults" role="listbox" aria-label="Matching instruments" hidden></div>
    </div>
    <div class="tk-foot"><span class="tk-foot-hint">${TICKER_UNIVERSE.length} instruments available</span><button class="btn-ghost sm" id="tkReset">Reset to default</button></div>`;
  $('tkClose').onclick=()=>openTickerSettings(false);
  $('tkRoll').onclick=()=>{t.rolling=!t.rolling;renderTopIndex();renderTickerSettings();saveState();};
  const sp=$('tkSpeed'); if(sp) sp.oninput=()=>{t.speed=+sp.value;applyTickerSpeed();saveState();};
  p.querySelectorAll('[data-tkremove]').forEach(b=>b.onclick=()=>{t.items=t.items.filter(n=>n!==b.dataset.tkremove);renderTopIndex();renderTickerSettings();saveState();});
  $('tkReset').onclick=()=>{tkQuery='';state.ticker={items:TICKER_DEFAULT.items.slice(),speed:TICKER_DEFAULT.speed,rolling:true};renderTopIndex();renderTickerSettings();saveState();};
  // --- searchable instrument picker (type to filter · ↑↓ to navigate · Enter to add) ---
  const search=$('tkSearch'), results=$('tkResults'), clear=$('tkClear');
  const hlite=(name,q)=>{ if(!q)return esc(name); const i=name.toLowerCase().indexOf(q); return i<0?esc(name):esc(name.slice(0,i))+'<mark>'+esc(name.slice(i,i+q.length))+'</mark>'+esc(name.slice(i+q.length)); };
  const addInstr=name=>{ if(!name||has.has(name))return; t.items.push(name); tkRefocus=true; renderTopIndex(); renderTickerSettings(); saveState(); announce(name+' added to ticker'); };
  const itemEls=()=>[...results.querySelectorAll('.tk-res')];
  const setActive=i=>{ const els=itemEls(); if(!els.length){tkActive=-1;return;} tkActive=(i+els.length)%els.length; els.forEach((el,j)=>el.classList.toggle('on',j===tkActive)); els[tkActive].scrollIntoView({block:'nearest'}); };
  const closeResults=()=>{ results.hidden=true; tkActive=-1; if(search)search.setAttribute('aria-expanded','false'); };
  const renderResults=()=>{
    const q=tkQuery.trim().toLowerCase(), avail=TICKER_UNIVERSE.filter(u=>!has.has(u.name));
    if(!avail.length){ results.innerHTML=`<div class="tk-res-empty">Every instrument is already on your ticker.</div>`; results.hidden=false; return; }
    let m=q?avail.filter(u=>u.name.toLowerCase().includes(q)):avail;
    if(q)m.sort((a,b)=>(a.name.toLowerCase().startsWith(q)?0:1)-(b.name.toLowerCase().startsWith(q)?0:1)||a.name.localeCompare(b.name));
    const total=m.length; m=m.slice(0,40);
    if(!m.length){ results.innerHTML=`<div class="tk-res-empty">No instrument matches “${esc(tkQuery)}”.</div>`; results.hidden=false; search.setAttribute('aria-expanded','true'); return; }
    const groups={}; m.forEach(x=>{(groups[x.grp]=groups[x.grp]||[]).push(x);});
    results.innerHTML=Object.keys(groups).map(g=>`<div class="tk-res-grp">${esc(g)}</div>`+groups[g].map(x=>{const dec=x.base>=20000?0:1;
      return `<button type="button" class="tk-res" role="option" data-tkadd="${esc(x.name)}"><span class="tk-res-nm">${hlite(x.name,q)}</span><span class="tk-res-px num">${x.base.toLocaleString('en-IN',{maximumFractionDigits:dec})}</span><span class="tk-res-add">${icon('plus',12)}</span></button>`;}).join('')).join('')
      + (total>m.length?`<div class="tk-res-more">+${total-m.length} more, keep typing to narrow</div>`:'');
    results.hidden=false; search.setAttribute('aria-expanded','true');
    results.querySelectorAll('[data-tkadd]').forEach(b=>{b.onmousedown=e=>e.preventDefault();b.onclick=()=>addInstr(b.dataset.tkadd);});
    setActive(0);
  };
  if(search){
    search.oninput=()=>{ tkQuery=search.value; if(clear)clear.hidden=!tkQuery; renderResults(); };
    search.onfocus=()=>renderResults();
    search.onkeydown=e=>{
      if(e.key==='ArrowDown'){ e.preventDefault(); if(results.hidden){renderResults();}else setActive(tkActive+1); }
      else if(e.key==='ArrowUp'){ e.preventDefault(); setActive(tkActive-1); }
      else if(e.key==='Enter'){ e.preventDefault(); const els=itemEls(), el=els[tkActive]||els[0]; if(el)addInstr(el.dataset.tkadd); }
      else if(e.key==='Escape'&&!results.hidden){ e.preventDefault(); e.stopPropagation(); closeResults(); }
    };
  }
  if(clear)clear.onclick=()=>{ tkQuery=''; if(search){search.value='';search.focus();} clear.hidden=true; renderResults(); };
  if(tkRefocus){ tkRefocus=false; if(search){search.focus(); const L=search.value.length; try{search.setSelectionRange(L,L);}catch(_){}} renderResults(); }
}
function wireTicker(){ const g=$('tickerGear'); if(g) g.onclick=e=>{e.stopPropagation();openTickerSettings();}; }
function renderRegimeBar(r){
  const bar=$('regimeBar'); if(!bar) return;
  const cfg={
    bull:{kick:'Risk-on · Momentum',title:'Markets trending up',
      read:`Opportunity-capture mode. The terminal leads with <b>breakout scans &amp; long entries</b>; risk tools stay one tap away. Your watchlist is sorted by momentum and the order pad defaults to BUY.`},
    neutral:{kick:'Neutral · Rangebound',title:'Markets rangebound, wait for clarity',
      read:`Signals are mixed. <b>BUY and SELL stay equally weighted</b> and the engine waits for a decisive break before committing to a regime.`},
    bear:{kick:'Risk-off · Defensive',title:'Markets under pressure',
      read:`Capital-preservation mode. The terminal now leads with <b>portfolio risk, hedges &amp; stops</b>: the risk pane widens, losers surface first and the order pad defaults to PROTECT/SELL.`},
  }[r];
  const read=(PLAY[state.persona||'trader']||PLAY.trader)[r]||cfg.read;
  const pTag=isInvestor()?'Investing':'Trading';
  if(state.regimeCollapsed===undefined) state.regimeCollapsed=true;   // compact by default, engine stats live in the header now
  const collapsed=state.regimeCollapsed;
  // Guard: the bar's content is purely regime + persona + collapsed. When none changed, skip the
  // rebuild so the 30s poll (and recompute, called every poll) don't flicker the banner.
  const rbsig=r+'|'+(state.persona||'trader')+'|'+(collapsed?1:0)+'|'+pTag;
  if(bar.dataset.rbsig===rbsig) return;
  bar.dataset.rbsig=rbsig;
  bar.classList.toggle('collapsed',collapsed);
  if(collapsed){
    bar.innerHTML=`<button class="rb-toggle" id="rbToggle" aria-expanded="false" title="Show the market read">
      <span class="rb-mini-ic rb-emo-${r}">${icon(r,13)}</span><b>${cfg.title}</b><span class="rb-mini-kick">${cfg.kick} · ${pTag}</span><span class="rb-chev">▾</span></button>`;
  } else {
    bar.innerHTML=`
      <div class="rb-badge"><div class="rb-emo rb-emo-${r}"><img class="rb-mascot" src="assets/mascot-${r}.png" alt="" draggable="false"><span class="rb-emo-ic" style="display:none">${icon(r,21)}</span></div>
        <div><div class="rb-title"><small>${cfg.kick} · ${pTag}</small>${cfg.title}</div></div></div>
      <div class="rb-read">${read}</div>
      <button class="rb-toggle mini" id="rbToggle" aria-expanded="true" aria-label="Minimize market read" title="Minimize">${icon('compress',13)}<span>Minimize</span></button>`;
  }
  const t=$('rbToggle'); if(t)t.onclick=()=>{state.regimeCollapsed=!state.regimeCollapsed; renderRegimeBar(state.displayed); if(typeof saveState==='function')saveState();};
}

/* ============================================================
   RENDER: WATCHLIST (left pane)
   ============================================================ */
function spark(seed,up){
  let s=seed;const rnd=()=>{s=(s*9301+49297)%233280;return s/233280;};
  let y=10,pts=[];for(let i=0;i<10;i++){y=clamp(y+(rnd()-(up?0.42:0.58))*5,2,16);pts.push([i*5,+y.toFixed(1)]);}
  const line=pts.map((p,i)=>`${i?'L':'M'}${p[0]},${p[1]}`).join('');
  const col=up?'var(--green)':'var(--red)', gid=up?'sgu':'sgd';
  return `<svg class="spark" viewBox="0 0 46 18" preserveAspectRatio="none"><path d="${line}L45,18L0,18Z" fill="url(#${gid})"/><path d="${line}" fill="none" stroke="${col}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
}
// segment-filter tab (All / F&O / Indices) over the universal watchlist
function wlFilter(){
  const t=state.wlTab||'all';
  if(t==='fno') return SYMS.filter(s=>s.exch==='NFO'||s.exch==='BFO'||['FUT','CE','PE'].includes(s.type));
  if(t==='idx') return SYMS.filter(s=>s.seg==='INDICES'||/NIFTY|SENSEX|INDIA VIX|BANKEX/i.test(s.sym));
  return SYMS.slice();
}
function wlList(r){
  const base=wlFilter();
  if(state.wlCustom) return base;            // user's drag order = the array order
  const bear=r==='bear';
  return [...base].sort((a,b)=>bear?(a.chg||0)-(b.chg||0):(b.chg||0)-(a.chg||0));
}
function renderWatchlist(r){
  const bear=r==='bear', inv=isInvestor();
  const list=wlList(r);
  const effSel=state.selected||REGIME_SYM[r];
  $('wlMeta').innerHTML=state.wlCustom
    ? `<span>${SYMS.length} instruments · custom order</span><button class="wl-reset" id="wlReset">Reset sort</button>`
    : inv ? `<span>Quality &amp; your holdings</span><span>LTP · Chg%</span>`
    : `<span>${list.length} · ${bear?'Weakest first':'Top movers first'}</span><span>LTP · Chg%</span>`;
  if(!list.length){ $('wlRows').innerHTML=`<div class="wl-empty">${icon('search',16)}<span>No instruments in this tab, use search or “Add scrip” to add any instrument (stocks, futures, options, indices, MCX).</span></div>`; return; }
  $('wlRows').innerHTML=list.map(s=>{
    const lv = s.live!==false && BOT.live;   // real Kite quote present for THIS instrument
    const eq=isEq(s); let badge='';
    if(inv){ badge = s.hold?`<span class="badge b-hold">holding</span>`:(lv&&s.chg<-1.5?`<span class="badge b-up">on sale</span>`:''); }
    else if(bear){ badge = lv&&s.chg<0?`<span class="badge b-down">near support</span>`:(s.hold?`<span class="badge b-hold">holding</span>`:''); }
    else { badge = lv&&s.chg>1.5?`<span class="badge b-up">near breakout</span>`:''; }
    const sub = `<span>${esc(instSub(s))}</span>${(bear&&eq&&s.beta!=null)?`<span class="beta">β ${s.beta}</span>`:''}${badge}`;
    const ltpCell = lv
      ? `<div class="wl-ltp num">${(+s.ltp).toLocaleString('en-IN')}</div><div class="wl-chg ${cls(s.chg)} num">${pct(s.chg)}</div>`
      : `<div class="wl-ltp num muted" title="No live quote, connect Kite">—</div><div class="wl-chg num muted">·</div>`;
    const _selRow=(itemKey(s)===effSel||s.sym===effSel);
    return `<div class="wl-row${_selRow?' sel':''}" draggable="true" data-sym="${esc(s.sym)}" data-key="${esc(itemKey(s))}" role="button" tabindex="0" aria-label="Select ${esc(s.sym)}${eq?'':' '+esc(s.type||'')}"${_selRow?' aria-current="true"':''}>
      <span class="wl-grip">${icon('grip',12)}</span>
      <div class="wl-l">
        <div class="wl-sym">${esc(s.sym)} ${!eq?`<i class="wl-seg ${s.type==='FUT'?'fut':s.type==='CE'?'ce':s.type==='PE'?'pe':'oth'}">${s.type}</i>`:(s.hold?`<span class="hold-star">${icon('star',11)}</span>`:'')}</div>
        <div class="wl-sub">${sub}</div></div>
      <div class="wl-r">${ltpCell}</div>
      <div class="wl-spark">${lv&&eq?spark(s.sym.length*97+ (bear?3:11), s.chg>=0):''}</div>
      <button class="wl-x" data-wlremove="${esc(itemKey(s))}" title="Remove from watchlist" aria-label="Remove ${esc(s.sym)}">${icon('close',11)}</button>
    </div>`;
  }).join('');
  const rst=$('wlReset'); if(rst) rst.onclick=()=>{state.wlCustom=false;renderWatchlist(state.displayed);saveState();};
  $('wlRows').querySelectorAll('[data-wlremove]').forEach(b=>b.onclick=e=>{e.stopPropagation();removeInstrument(b.dataset.wlremove);});
}
// add ANY instrument (from the universal search) to the watchlist
function addInstrument(meta){
  if(!meta||!meta.key) return;
  if(byKey(meta.key)){ selectSym(meta.sym); return; }   // already pinned → just select it
  SYMS.push({sym:sanInstr(meta.ts||meta.sym), name:sanInstr(meta.name||meta.ts||meta.sym), exch:meta.exch, type:sanInstr(meta.type||'EQ'),
    key:meta.key, token:meta.token, seg:meta.seg, lot:meta.lot, ltp:0, chg:0,
    expiry:meta.expiry, strike:meta.strike, sector:meta.sector, live:false});
  saveState();
  if(BOT.live){ connectStream(); loadMarket(); }        // pull a quote + (re)subscribe the stream for the new key
  renderWatchlist(state.displayed); selectSym(meta.ts||meta.sym);
  announce((meta.ts||meta.sym)+' added to watchlist');
}
function removeInstrument(key){
  const i=SYMS.findIndex(s=>itemKey(s)===key); if(i<0) return;
  const was=SYMS[i].sym;
  if(SYMS.length<=1){ quickToast('Keep at least one','Add another instrument before removing the last one.'); return; }
  SYMS.splice(i,1);
  if(state.selected===key||state.selected===was) state.selected=null;
  // if this stock was also pinned to the rolling tape, drop it so it can't become a dead ", " cell
  if(state.ticker&&Array.isArray(state.ticker.items)&&state.ticker.items.includes(was)){
    state.ticker.items=state.ticker.items.filter(n=>n!==was);
    if(BOT.tickerLive) delete BOT.tickerLive[was];
    renderTopIndex();
  }
  saveState(); if(BOT.live) connectStream();
  renderWatchlist(state.displayed); renderChart(state.displayed);
  announce(was+' removed from watchlist');
}
function resetWatchlist(){   // restore the default seed list
  SYMS=SEED_SYMS.map(sym=>({sym,name:sym,exch:'NSE',type:'EQ',key:'NSE:'+sym,ltp:0,chg:0,live:false}));
  state.wlCustom=false; state.selected=null; saveState();
  if(BOT.live){ connectStream(); loadMarket(); }
  renderWatchlist(state.displayed);
}
function selectSym(sym){
  if(!bySym(sym))return;
  state.selected=sym; state.orderSide=null; state.orderQty=null; state.tradeFromChart=null;
  renderWatchlist(state.displayed); renderChart(state.displayed); renderOrder(state.displayed);
  if(BOT.live && document.querySelector('.wg-card[data-wkey="depth"]')) loadDepth(sym);  // refresh depth ladder for new symbol
  announce(sym+' selected'); saveState();
}
/* trade-from-chart: the engine drags an entry/SL/target bracket → order pad */
function tradeFromChart(p){
  if(!p||!bySym(p.sym)) return;
  state.selected=p.sym;
  state.tradeFromChart={sym:p.sym,side:p.side,sl:p.sl,target:p.target,entry:p.entry};
  state.orderSide=p.side; state.orderQty=null;
  renderOrder(state.displayed);
  const pad=$('orderPad'); if(pad){pad.classList.remove('flash-pad');void pad.offsetWidth;pad.classList.add('flash-pad');}
  announce(`Chart bracket sent, ${p.side==='buy'?'long':'short'} ${p.sym}, SL ${p.sl}, target ${p.target}`);
  saveState();
}

/* ============================================================
   RENDER: CHART (center)  → delegates to the interactive engine
   ============================================================ */
function chartSymbol(r){
  // chart follows the watchlist/search selection so it stays in lock-step
  // with the order pad; falls back to this regime's spotlight scrip
  const sym=(state.selected&&bySym(state.selected))?state.selected:REGIME_SYM[r];
  return bySym(sym);
}
function renderChart(r){
  if(!window.TPChart) return;
  const s=chartSymbol(r);
  TPChart.render({symbol:s.sym, name:s.name||s.sym, regime:r, basePrice:s.ltp, change:s.chg});
}
/* Real OHLCV feed for the chart, pulls Kite historical via /api/candles. Returns null
   when offline or the symbol has no real series, so the chart shows an honest empty
   state instead of synthetic candles. The chart calls this on every symbol/timeframe change. */
async function chartFeed(sym, tfKey){
  if(!BOT.live) return null;
  // any segment: chart by EXCH:TS key when the instrument isn't a plain NSE equity
  const it=bySym(sym);
  const q=(it && it.exch && it.exch!=='NSE')
    ? `key=${encodeURIComponent(itemKey(it))}`
    : `symbol=${encodeURIComponent((it&&it.sym)||sym)}`;
  try{
    const d=await fetch(`${BOT_API}/api/candles?${q}&tf=${encodeURIComponent(tfKey)}`).then(r=>r.json());
    if(d && Array.isArray(d.candles) && d.candles.length) return d.candles;
  }catch(e){}
  return null;
}

/* Real holdings from the Kite account (/api/holdings) or null when offline, panels
   that show positions/P&L use this so they never display the mock catalog. */
function liveHoldings(){
  return (BOT.live && BOT.holdings && Array.isArray(BOT.holdings.holdings)) ? BOT.holdings.holdings : null;
}
function emptyConnect(what){
  return `<div class="empty-state">${icon('alert',16)} <span>Connect Kite for live ${what}, run <code>python3 login.py</code>.</span></div>`;
}

/* ============================================================
   RENDER: BOTTOM PANEL (tabs reorder per regime)
   ============================================================ */
const PANELS={
  scan(r){
    // A screener needs the live market. With no connected Kite session there is nothing real to
    // screen: stay honest (no fabricated setups/moves) and prompt to connect, like every other panel.
    if(!BOT.live) return emptyConnect('breakout &amp; momentum screening');
    if(r==='bear'){
      const rows=[['ADANIENT','Lost 50-DMA · gap risk','b-down','52W LOW',-2.8],['BAJFINANCE','RSI 32 · distribution','b-down','WEAK',-1.9],['TCS','High-beta fade','b-warn','DISTRIB',-0.6]];
      return tbl(['Scrip','Setup','','LTP','Chg%'],rows.map(x=>scanRow(x)).join(""))+note('warn','Surfacing weakness, 52-wk lows &amp; high-beta names that lead a sell-off.');
    }
    if(r==='neutral'){
      const rows=[['HDFCBANK','Coiling in range','b-warn','RANGE',0.4],['ICICIBANK','At mid-band','b-warn','NEUTRAL',0.9],['ITC','Low volatility','b-warn','QUIET',-0.3]];
      return tbl(['Scrip','Setup','','LTP','Chg%'],rows.map(x=>scanRow(x)).join(""))+note('info','Awaiting the breakout that resolves the range, no decisive edge yet.');
    }
    const rows=[['MARUTI','Volume thrust · 2.4× avg','b-up','BREAKOUT',3.4],['INFY','Flag breakout','b-up','52W HIGH',2.1],['SBIN','Cup &amp; handle','b-up','VOL ↑',1.6]];
    return tbl(['Scrip','Setup','','LTP','Chg%'],rows.map(x=>scanRow(x)).join(""))+note('go','Surfacing momentum, fresh 52-wk highs &amp; volume thrust to ride the trend.');
  },
  positions(r){
    const hs=liveHoldings();
    if(!hs) return emptyConnect('positions & P&L');
    if(!hs.length) return '<div class="empty-state">No holdings in your Zerodha account yet, fund it and buy to see positions here.</div>';
    const day=BOT.holdings.dayPnl||0, total=BOT.holdings.totalPnl||0;
    const exposure=hs.reduce((a,h)=>a+(h.ltp||0)*(h.qty||0),0);
    if(r==='bear'){
      const losers=[...hs].sort((a,b)=>(a.dayChangePct||0)-(b.dayChangePct||0)).slice(0,5);
      const cards=`<div class="riskcards">
        <div class="rcard"><span>Day P&L</span><b class="${cls(day)}">${sgn(day)}</b></div>
        <div class="rcard"><span>Exposure</span><b>${inrL(exposure)}</b></div>
        <div class="rcard"><span>Total P&L</span><b class="${cls(total)}">${sgn(total)}</b></div>
        <div class="rcard"><span>Holdings</span><b>${hs.length}</b></div></div>`;
      const body=losers.map(h=>`<tr><td><span class="t-sym">${esc(h.sym)}</span></td>
        <td class="num">${h.qty}</td><td class="num">${(h.ltp||0).toLocaleString('en-IN')}</td>
        <td class="num ${cls(h.pnl)}">${h.pnl>=0?'+':''}${inr(h.pnl)}</td>
        <td><span class="badge ${(h.dayChangePct||0)<0?'b-down':'b-warn'}">${pct(h.dayChangePct||0)}</span></td></tr>`).join('');
      return cards+tbl(['Scrip','Qty','LTP','P&L','Day'],body)+note('warn','Weakest holdings by today’s move shown first, review risk on the red names.');
    }
    const winners=[...hs].sort((a,b)=>(b.pnl||0)-(a.pnl||0));
    const body=winners.map(h=>`<tr><td><span class="t-sym">${esc(h.sym)}</span></td>
      <td class="num">${h.qty}</td><td class="num">${(h.avg||0).toLocaleString('en-IN',{maximumFractionDigits:2})}</td>
      <td class="num">${(h.ltp||0).toLocaleString('en-IN')}</td><td class="num ${cls(h.pnl)}">${h.pnl>=0?'+':''}${inr(h.pnl)}</td></tr>`).join('');
    return tbl(['Scrip','Qty','Avg','LTP','P&L'],body)+note(r==='neutral'?'info':'go',
      `Total unrealised <b>${sgn(total)}</b> · day <b>${sgn(day)}</b> across ${hs.length} holdings.`);
  },
  orders(){
    if(!state.orders.length) return '<div class="empty-state">No orders yet. Place one from the order pad on the right.</div>';
    const body=state.orders.map(o=>{
      const live=(o.status==='Pending'||o.status==='Open');
      const act=live?`<button class="mini-cancel" data-cancel="${o.id}">Cancel</button>`
        :`<span class="badge ${o.status==='Cancelled'?'b-warn':'b-up'}">${o.status}</span>`;
      return `<tr><td><span class="t-sym">${o.sym} <span class="side-chip side-${o.side}">${o.side}</span></span></td>
        <td>${o.type}</td><td class="num">${o.qty}</td><td class="num">${o.price.toLocaleString('en-IN')}</td>
        <td>${act}</td></tr>`;}).join('');
    return tbl(['Scrip','Type','Qty','Price','Status'],body);
  },
  holdings(){
    const hs=liveHoldings();
    if(!hs) return emptyConnect('holdings');
    if(!hs.length) return '<div class="empty-state">No holdings in your Zerodha account yet.</div>';
    const body=hs.map(h=>{const val=(h.ltp||0)*(h.qty||0);return `<tr><td><span class="t-sym">${esc(h.sym)}</span></td>
      <td class="num">${h.qty}</td><td class="num">${(h.avg||0).toLocaleString('en-IN',{maximumFractionDigits:2})}</td>
      <td class="num">${inr(val)}</td><td class="num ${cls(h.pnl)}">${h.pnl>=0?'+':''}${inr(h.pnl)}</td></tr>`;}).join('');
    return tbl(['Scrip','Qty','Avg','Cur. Value','P&L'],body)
      +note('info',`${hs.length} holdings · total unrealised <b>${sgn(BOT.holdings.totalPnl||0)}</b> · day <b>${sgn(BOT.holdings.dayPnl||0)}</b>.`);
  },
  sips(r){
    const tot=SIPS.reduce((a,s)=>a+s.amt,0);
    const body=SIPS.map(s=>`<tr><td><span class="t-sym">${s.name}</span></td><td class="num">${inr(s.amt)}</td>
      <td class="num">${s.day}th</td><td class="num up">${s.xirr.toFixed(1)}%</td><td class="num">${inrL(s.val)}</td></tr>`).join('');
    const tip=r==='bear'?'Markets are lower, a strong time to <b>step up SIPs</b>; each rupee buys more units.'
      :r==='bull'?'Markets extended, <b>keep SIPs running</b> but avoid lump-sum chasing at highs.'
      :'Range-bound is ideal, <b>rupee-cost averaging</b> works best here.';
    return tbl(['Fund / Scrip','Monthly','Date','XIRR','Value'],body)+note(r==='bear'?'go':'info',`Total <b>${inr(tot)}/mo</b> across ${SIPS.length} SIPs. ${tip}`);
  },
  goals(){
    const cards=GOALS.map(g=>{const p=Math.round(g.cur/g.target*100);
      return `<div class="goal-card"><div class="goal-h"><span class="ctx-ico ic-info">${icon(g.icon,15)}</span><b>${g.name}</b><span class="num">${p}%</span></div>
        <div class="goal-bar"><span style="width:${p}%"></span></div>
        <div class="goal-sub"><span>${inrL(g.cur)}</span><span>of ${inrL(g.target)}</span></div></div>`;}).join('');
    return `<div class="goals-wrap">${cards}</div>`+note('info','On track for 2 of 3 goals, stepping up SIPs ~10% closes the retirement gap about 3 years sooner.');
  },
  alloc(r){
    const body=ALLOC.map(a=>{const d=a.cur-a.tgt;return `<tr><td><span class="t-sym">${a.a}</span></td>
      <td class="num">${a.cur}%</td><td class="num">${a.tgt}%</td>
      <td><span class="badge ${Math.abs(d)>=5?'b-warn':'b-up'}">${d>0?'+':''}${d}%</span></td></tr>`;}).join('');
    const tip=r==='bear'?'Equity has slipped under target, <b>deploy cash to rebalance</b> back to 60% while valuations are lower.'
      :r==='bull'?'Equity is <b>4% over target</b>: book partial profits and top up debt / gold.'
      :'Allocation is near target, small top-ups keep you balanced.';
    return tbl(['Asset','Current','Target','Drift'],body)+note(r==='bull'?'warn':'go',tip);
  },
  events(){
    const body=MARKET_EVENTS.map(e=>{const bc=e.type==='Dividend'?'b-up':e.type==='Bonus'?'b-warn':'b-neu';
      return `<tr><td><span class="t-sym">${e.co}</span></td>
        <td><span class="badge ${bc}">${e.type}</span></td>
        <td style="text-align:left;color:var(--slate)">${e.detail}</td><td class="num">${e.date}</td></tr>`;}).join('');
    return tbl(['Company','Event','Details','Date'],body)+note('info','Corporate actions across your watchlist &amp; holdings, dividends, bonuses and board meetings.');
  },
  news(){
    return `<div class="news-wrap">${NEWS_FEED.map(n=>`<div class="news-item">
      <div class="news-h">${n.head}</div>
      <div class="news-m"><span class="t-sym">${n.co}</span><span>${n.date}</span></div></div>`).join('')}</div>`;
  },
};
function scanRow(x){const[s,setup,bc,bt,chg]=x;return `<tr><td><span class="t-sym">${s}</span></td><td style="text-align:left;color:var(--slate)">${setup}</td><td><span class="badge ${bc}">${bt}</span></td><td class="num">${bySym(s)?bySym(s).ltp.toLocaleString('en-IN'):'-'}</td><td class="num ${cls(chg)}">${pct(chg)}</td></tr>`;}
function tbl(heads,bodyRows){return `<table class="tbl"><thead><tr>${heads.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${bodyRows}</tbody></table>`;}
function note(t,html){const ic=t==='go'?'check':t==='warn'?'alert':'swap';return `<div class="panel-note note-${t}">${icon(ic,15)}<span>${html}</span></div>`;}

const PANEL_LAYOUT={
  bull:   {order:[['scan','Breakout Scanner','12'],['positions','Positions','6'],['orders','Orders','4'],['holdings','Holdings','6']], def:'scan'},
  neutral:{order:[['orders','Orders','4'],['positions','Positions','6'],['holdings','Holdings','6'],['scan','Scanner','-']], def:'orders'},
  bear:   {order:[['positions','Positions · Risk','6'],['orders','Orders','4'],['holdings','Holdings','6'],['scan','Breakdown Scanner','9']], def:'positions'},
};
const PANEL_LAYOUT_INV={
  bull:   {order:[['holdings','Holdings','-'],['alloc','Allocation','4'],['sips','SIPs','3'],['goals','Goals','3'],['events','Events','8'],['news','News','-']], def:'holdings'},
  neutral:{order:[['sips','SIPs','3'],['holdings','Holdings','-'],['goals','Goals','3'],['alloc','Allocation','4'],['events','Events','8'],['news','News','-']], def:'sips'},
  bear:   {order:[['sips','SIPs · Step-up','3'],['holdings','Holdings','-'],['alloc','Allocation','4'],['goals','Goals','3'],['events','Events','8'],['news','News','-']], def:'sips'},
};
function renderPanel(r){
  const L=(isInvestor()?PANEL_LAYOUT_INV:PANEL_LAYOUT)[r];
  if(!state.panelTab || !L.order.find(t=>t[0]===state.panelTab)) state.panelTab=L.def;
  const hcnt=(liveHoldings()||[]).length;
  const cnt=id=>id==='orders'?state.orders.length:(id==='positions'||id==='holdings')?(BOT.live?hcnt:null):id==='sips'?SIPS.length:id==='goals'?GOALS.length:id==='events'?MARKET_EVENTS.length:null;
  $('panelTabs').innerHTML=L.order.map(([id,label,count])=>{
    let c=cnt(id);
    // positions/holdings come only from a live Kite session, show NO badge when offline (the body says "connect"),
    // never the static placeholder. Other tabs keep their app-computed/static count.
    if(c==null) c=(id==='positions'||id==='holdings')?'':count;
    const badge=(c===''||c==null)?'':`<span class="pt-count">${c}</span>`;
    return `<button class="p-tab ${id===state.panelTab?'active':''}" data-ptab="${id}">${label}${badge}</button>`;}).join('');
  $('panelBody').innerHTML=PANELS[state.panelTab](r);
  $('panelTabs').querySelectorAll('[data-ptab]').forEach(b=>b.onclick=()=>{state.panelTab=b.dataset.ptab;renderPanel(r);});
}

/* ============================================================
   RENDER: ORDER PAD (right)
   ============================================================ */
function orderModel(r){
  const s=bySym(state.selected||REGIME_SYM[r])||SYMS[0];
  const sym=s.sym;
  const tf=(state.tradeFromChart&&state.tradeFromChart.sym===sym)?state.tradeFromChart:null;
  const side=tf?tf.side:(state.orderSide||(r==='bear'?'sell':'buy'));
  const qty=state.orderQty!=null?state.orderQty:(r==='bear'?4:10);
  const w=SL_W[r];
  const live=!!BOT.live && s.live!==false;                       // a REAL quote exists for this symbol
  const px=(live&&typeof s.ltp==='number'&&isFinite(s.ltp))?s.ltp:0;  // no live quote → no price (honest)
  const entry=tf?tf.entry:px;
  const sl=tf?tf.sl:(side==='buy'? px*(1-w) : px*(1+w));
  const target=tf?tf.target:null;
  const type=tf?'BRACKET':(r==='bear'?'SL-M':r==='bull'?'BRACKET':'LIMIT');
  return {sym,s,px,priced:px>0,side,qty,w,entry,sl,target,type,value:qty*entry,fromChart:!!tf};
}
function renderOrder(r){
  if(isInvestor()) return renderOrderInvestor(r);
  const m=orderModel(r);
  const types=r==='bear'?['SL-M','GTT stop','Cover','Margin ×5']:r==='bull'?['BRACKET','Cover','Margin ×5']:['LIMIT','Market','SL'];
  const typePills=types.map((tp,i)=>`<span class="type-pill ${i===0?'on':''} ${tp.startsWith('Margin')&&r==='bear'?'disabled':''}">${tp}</span>`).join('');
  const ctaCls=m.side==='buy'?(r==='neutral'?'cta-navy':'cta-buy'):'cta-sell';
  const ctaTxt=m.side==='buy'?'BUY '+m.sym:(r==='bear'?'PROTECT / SELL '+m.sym:'SELL '+m.sym);
  const note=m.fromChart?`<div class="order-note note-info">${icon('target',14)}<span>Levels pulled from your chart bracket, entry, SL &amp; target are live on the chart.</span></div>`
    :r==='bear'?`<div class="order-note note-warn">${icon('alert',14)}<span>High VIX, qty trimmed, SL tightened. Consider a protective put.</span></div>`
    :r==='neutral'?`<div class="order-note note-info">${icon('swap',14)}<span>Rangebound, wait for a breakout before sizing up.</span></div>`
    :`<div class="order-note note-go">${icon('check',14)}<span>Trend intact, trail SL, let winners run.</span></div>`;
  const rr=(m.fromChart&&m.target!=null)?Math.abs(m.target-m.entry)/Math.max(1,Math.abs(m.entry-m.sl)):0;
  const entryFld=m.fromChart?`<div class="fld"><label>Entry <i>chart bracket</i></label><div class="inp">${Math.round(m.entry).toLocaleString('en-IN')}</div></div>`:'';
  const ladder=(m.fromChart&&m.target!=null)
    ? `<div class="fld"><label>Target <i>from chart · R:R ${rr.toFixed(2)}</i></label><div class="inp">${Math.round(m.target).toLocaleString('en-IN')}</div></div>`
    : (r==='bull'&&m.priced)?`<div class="fld"><label>Target ladder</label><div class="inp">T1 ${Math.round(m.px*1.022).toLocaleString('en-IN')} · T2 ${Math.round(m.px*1.046).toLocaleString('en-IN')} · T3 ${Math.round(m.px*1.073).toLocaleString('en-IN')}</div></div>`:'';
  $('orderPad').innerHTML=`<div class="order-card">
    <div class="order-head"><span class="oh-sym">${esc(m.sym)} <i class="paper-tag" title="Orders here are simulated, no real order is placed. Real execution is on the roadmap.">PAPER</i></span><span class="oh-px ${cls(m.s.chg)} num"><span id="ordLtp">${m.priced?m.px.toLocaleString('en-IN'):'-'}</span> ${m.s.live!==false?pct(m.s.chg):''}</span>${cardCtl('order')}</div>
    <div class="order-body">
      <div class="side-tabs"><div class="side-tab buy ${m.side==='buy'?'active':''}" data-side="buy">BUY</div><div class="side-tab sell ${m.side==='sell'?'active':''}" data-side="sell">${r==='bear'?'SELL / HEDGE':'SELL'}</div></div>
      <div class="type-row">${typePills}</div>
      <div class="fld-row">
        <div class="fld"><label>Qty</label><div class="qty-step"><button class="qbtn" data-qty="-1" aria-label="Decrease quantity">−</button><input class="qty-inp num" id="ordQty" value="${m.qty}" inputmode="numeric" aria-label="Order quantity"><button class="qbtn" data-qty="1" aria-label="Increase quantity">+</button></div></div>
        <div class="fld"><label>Stop-loss <i>${(m.w*100).toFixed(1)}%</i></label><div class="inp">${m.priced?Math.round(m.sl).toLocaleString('en-IN'):'-'}</div></div>
      </div>
      ${entryFld}${ladder}
      <div class="fld"><label>Order value</label><div class="inp" id="ordVal">${m.priced?inr(m.value):'-'}</div></div>
      ${note}
      <button class="cta ${ctaCls}" id="placeBtn">${ctaTxt}</button>
    </div></div>`;
  $('orderPad').querySelectorAll('[data-side]').forEach(b=>b.onclick=()=>{state.orderSide=b.dataset.side;state.tradeFromChart=null;renderOrder(state.displayed);});
  $('orderPad').querySelectorAll('[data-qty]').forEach(b=>b.onclick=()=>{const d=+b.dataset.qty;state.orderQty=Math.max(1,(state.orderQty!=null?state.orderQty:m.qty)+d);renderOrder(state.displayed);});
  const qi=$('ordQty'); if(qi) qi.oninput=()=>{const v=parseInt(qi.value)||0;state.orderQty=Math.max(0,v);const vv=$('ordVal');if(vv)vv.textContent=m.priced?inr(state.orderQty*m.entry):'-';};
  $('placeBtn').onclick=()=>openOrderModal(r);   // paper/simulated order, honest, no real execution
  updateCardBtns();
}
function openOrderModal(r){
  const m=orderModel(r);
  const qty=state.orderQty!=null?state.orderQty:m.qty;
  if(!qty){const qi=$('ordQty');if(qi){qi.focus();}return;}
  const sideTxt=m.side==='buy'?'BUY':(r==='bear'?'SELL / HEDGE':'SELL');
  setModalTitle('Confirm order');
  $('modalBody').innerHTML=`
    <div class="modal-top ${m.side==='buy'?'is-buy':'is-sell'}">
      <span class="modal-side">${sideTxt}</span>
      <div><div class="modal-sym">${esc(m.sym)}</div><div class="modal-name">${esc(m.s.name)}</div></div>
      <span class="modal-px num">${m.priced?m.px.toLocaleString('en-IN'):'-'}</span></div>
    <div class="modal-grid">
      <div><span>Order type</span><b>${m.type}</b></div>
      <div><span>Quantity</span><b class="num">${qty}</b></div>
      <div><span>${m.fromChart?'Entry':'Price'}</span><b class="num">${m.type==='MARKET'?'At market':Math.round(m.entry).toLocaleString('en-IN')}</b></div>
      <div><span>Stop-loss</span><b class="num">${Math.round(m.sl).toLocaleString('en-IN')}</b></div>
      ${m.fromChart&&m.target!=null?`<div><span>Target</span><b class="num">${Math.round(m.target).toLocaleString('en-IN')}</b></div>`:''}
      <div><span>Order value</span><b class="num">${inr(qty*m.entry)}</b></div>
      <div><span>Regime context</span><b style="text-transform:capitalize;color:var(--accent-d)">${r}</b></div>
    </div>
    <div class="modal-note">${icon('shield',13)}<span>Review &amp; confirm. Placing this order does not modify any existing position or stop-loss.</span></div>`;
  const cf=$('modalConfirm');
  cf.style.display='';
  cf.className='tbtn '+(m.side==='buy'?'primary':'danger');
  cf.textContent=m.side==='buy'?'Confirm Buy':'Confirm '+(r==='bear'?'Protect':'Sell');
  cf.onclick=()=>{placeOrder({sym:m.sym,side:m.side,type:m.type,qty,price:Math.round(m.entry)});closeModal();};
  state.lastFocus=document.activeElement;
  showModal(true);
  setTimeout(()=>{const c=$('modalConfirm');if(c)c.focus();},40);
}
function showModal(o){$('orderModal').classList.toggle('show',o);$('modalScrim').classList.toggle('show',o);$('orderModal').setAttribute('aria-hidden',String(!o));}
function closeModal(){showModal(false);if(state.lastFocus&&state.lastFocus.focus)state.lastFocus.focus();}
function setModalTitle(t){const el=$('modalTitle');if(el)el.textContent=t;$('orderModal').setAttribute('aria-label',t);}
function successToast(o,status){
  const t=document.createElement('div');t.className='toast';
  t.innerHTML=`<div class="toast-ico">${icon('check',22)}</div><div class="toast-body"><b>Paper ${o.side==='buy'?'buy':'sell'} order, ${o.sym}</b><span>${o.qty} qty @ ${o.price.toLocaleString('en-IN')} · ${o.type} · ${status} · simulated, no real order</span></div><div class="toast-acts"><button class="tbtn ghost" data-act="ok">Dismiss</button></div>`;
  $('toastWrap').appendChild(t);
  t.querySelector('[data-act=ok]').onclick=()=>dismiss(t);
  t._timer=setTimeout(()=>{if(document.body.contains(t))dismiss(t);},4500);
}
function placeOrder(o){
  const status=o.type.startsWith('SL')?'Pending':(o.type==='MARKET'||o.type==='BRACKET')?'Filled':'Open';
  state.orders.unshift({id:++ORDER_ID,...o,status,paper:true});   // SIMULATED, no real order is placed
  state.panelTab='orders'; renderPanel(state.displayed);
  successToast(o,status);
}
function flowModal(o){
  setModalTitle(o.title||'Confirm');
  $('modalBody').innerHTML=o.body||'';
  const cf=$('modalConfirm');
  if(o.hideConfirm){ cf.style.display='none'; }
  else{
    cf.style.display=''; cf.className='tbtn '+(o.danger?'danger':'primary'); cf.textContent=o.confirm||'Confirm';
    cf.onclick=()=>{ const r=o.onConfirm?o.onConfirm($('modalBody')):true; if(r!==false) closeModal(); };
  }
  if(o.wire) o.wire($('modalBody'));
  state.lastFocus=document.activeElement; showModal(true);
  setTimeout(()=>{ const first=$('modalBody').querySelector(o.focus||'input:not([disabled]),select,button,[tabindex="0"]'); (first||$('modalConfirm')).focus(); },50);
}
function cancelOrder(id){const o=state.orders.find(x=>x.id===id);if(o&&(o.status==='Pending'||o.status==='Open')){o.status='Cancelled';renderPanel(state.displayed);}}
function applyRegime(regime){
  state.displayed=regime;
  document.documentElement.dataset.regime=regime;
  document.querySelectorAll('[data-regime-btn]').forEach(b=>{const on=b.dataset.regimeBtn===regime;b.classList.toggle('active',on);b.setAttribute('aria-selected',on);});
  $('fundsLabel').textContent=(PERSONA[state.persona||'trader']||PERSONA.trader).fundsLabel(regime);
  $('fundsVal').textContent=fundsText();
  state.panelTab=null; // reset to regime default
  renderTopIndex(); renderRegimeBar(regime); renderWatchlist(regime);
  renderChart(regime); renderPanel(regime); renderOrder(regime); renderWidgetStack(); renderDeskView(); renderAlgo();
  applyPaneWidths(); // keep any manual resize across regime switches
  flashRegime();
  announce(`${regime.charAt(0).toUpperCase()+regime.slice(1)} regime, ${regime==='bull'?'markets trending up':regime==='bear'?'markets under pressure':'markets rangebound'}`);
  saveState();
}
function flashRegime(){const s=$('regimeSweep');if(!s)return;s.classList.remove('go');void s.offsetWidth;s.classList.add('go');}
const RV_SEL='.regime-bar,.pane-left,.chart-card,.panel,#orderPad,#contextModule';
const RV_META={
  bull:   {word:'BULL',    tag:'Risk-on · Momentum'},
  neutral:{word:'NEUTRAL', tag:'Wait for clarity'},
  bear:   {word:'BEAR',    tag:'Protect capital'},
};
const prefersReduced=()=>window.matchMedia&&window.matchMedia('(prefers-reduced-motion:reduce)').matches;
/* original mascot artwork (filled vector), charging bull · roaring bear · balance scale */
const MASCOTS={
  bull:`<g class="m-all">
    <path class="m-body m-stroke" d="M60,134 C50,152 50,180 66,192 L134,192 C150,180 150,152 140,134 C129,121 110,117 100,117 C90,117 71,121 60,134 Z"/>
    <path class="m-horn m-stroke" d="M72,92 C46,90 23,75 9,50 C6,44 13,39 19,43 C42,57 60,74 81,88 Z"/>
    <path class="m-horn m-stroke" d="M128,92 C154,90 177,75 191,50 C194,44 187,39 181,43 C158,57 140,74 119,88 Z"/>
    <path class="m-dark" d="M70,96 C56,90 45,93 41,103 C52,107 62,105 75,105 Z"/>
    <path class="m-dark" d="M130,96 C144,90 155,93 159,103 C148,107 138,105 125,105 Z"/>
    <path class="m-body m-stroke" d="M100,74 C77,74 63,90 61,110 C60,129 72,147 84,155 C90,159 95,161 100,161 C105,161 110,159 116,155 C128,147 140,129 139,110 C137,90 123,74 100,74 Z"/>
    <path class="m-light" d="M100,125 C85,125 77,134 77,145 C77,155 88,162 100,162 C112,162 123,155 123,145 C123,134 115,125 100,125 Z"/>
    <path class="m-dark" d="M72,101 L100,113 L128,101 L124,92 L100,105 L76,92 Z"/>
    <path class="m-dark" d="M76,109 C81,104 90,105 95,111 C89,114 80,114 76,109 Z"/>
    <path class="m-dark" d="M124,109 C119,104 110,105 105,111 C111,114 120,114 124,109 Z"/>
    <ellipse class="m-dark" cx="91" cy="144" rx="4.6" ry="6.6"/>
    <ellipse class="m-dark" cx="109" cy="144" rx="4.6" ry="6.6"/>
    <path class="m-dark" d="M86,76 C88,65 95,60 100,58 C105,60 112,65 114,76 C109,71 105,69 100,69 C95,69 91,71 86,76 Z"/>
    <circle class="m-light snort s1" cx="72" cy="152" r="6"/>
    <circle class="m-light snort s2" cx="128" cy="152" r="6"/>
  </g>`,
  bear:`<g class="m-all">
    <path class="m-body m-stroke" d="M58,150 C47,166 49,190 64,192 L136,192 C151,190 153,166 142,150 C130,134 112,128 100,128 C88,128 70,134 58,150 Z"/>
    <circle class="m-body m-stroke" cx="61" cy="64" r="20"/>
    <circle class="m-body m-stroke" cx="139" cy="64" r="20"/>
    <circle class="m-dark" cx="61" cy="64" r="9"/>
    <circle class="m-dark" cx="139" cy="64" r="9"/>
    <path class="m-body m-stroke" d="M100,50 C71,50 53,73 53,102 C53,129 74,151 100,151 C126,151 147,129 147,102 C147,73 129,50 100,50 Z"/>
    <path class="m-dark" d="M69,90 L97,99 L92,108 L69,101 Z"/>
    <path class="m-dark" d="M131,90 L103,99 L108,108 L131,101 Z"/>
    <circle class="m-dark" cx="82" cy="99" r="5.2"/>
    <circle class="m-dark" cx="118" cy="99" r="5.2"/>
    <path class="m-light" d="M100,103 C85,103 77,116 79,128 C81,139 90,147 100,147 C110,147 119,139 121,128 C123,116 115,103 100,103 Z"/>
    <path class="m-dark" d="M91,111 C91,107 109,107 109,111 C109,118 104,122 100,122 C96,122 91,118 91,111 Z"/>
    <g class="bear-jaw">
      <path class="m-dark" d="M83,128 C88,144 112,144 117,128 C112,152 88,152 83,128 Z"/>
      <path class="m-horn" d="M89,131 L94,131 L91.5,141 Z"/>
      <path class="m-horn" d="M111,131 L106,131 L108.5,141 Z"/>
    </g>
    <g class="bear-arm a-l">
      <path class="m-body m-stroke" d="M44,168 C37,177 40,190 53,190 C64,190 71,181 68,172 C65,163 52,159 44,168 Z"/>
      <path class="m-claw" d="M42,170 L37,161 M49,167 L45,157 M56,166 L53,156"/>
    </g>
    <g class="bear-arm a-r">
      <path class="m-body m-stroke" d="M156,168 C163,177 160,190 147,190 C136,190 129,181 132,172 C135,163 148,159 156,168 Z"/>
      <path class="m-claw" d="M158,170 L163,161 M151,167 L155,157 M144,166 L147,156"/>
    </g>
  </g>`,
  neutral:`<g class="m-all">
    <path class="m-body m-stroke" d="M100,40 C66,40 44,68 44,108 C44,150 68,178 100,178 C132,178 156,150 156,108 C156,68 134,40 100,40 Z"/>
    <path class="m-body m-stroke" d="M58,52 C53,37 60,28 71,29 C75,42 72,55 65,63 Z"/>
    <path class="m-body m-stroke" d="M142,52 C147,37 140,28 129,29 C125,42 128,55 135,63 Z"/>
    <path class="m-dark" d="M50,110 C46,130 52,152 68,166 C59,145 57,126 60,110 Z"/>
    <path class="m-dark" d="M150,110 C154,130 148,152 132,166 C141,145 143,126 140,110 Z"/>
    <path class="m-light" d="M100,58 C78,58 62,76 62,100 C62,121 77,140 100,140 C123,140 138,121 138,100 C138,76 122,58 100,58 Z"/>
    <path class="m-dark" d="M65,80 C75,71 87,71 95,80 L92,88 C85,82 76,82 68,88 Z"/>
    <path class="m-dark" d="M135,80 C125,71 113,71 105,80 L108,88 C115,82 124,82 132,88 Z"/>
    <circle class="m-dark" cx="82" cy="99" r="16.5"/>
    <circle class="m-dark" cx="118" cy="99" r="16.5"/>
    <circle class="m-eye" cx="82" cy="99" r="11"/>
    <circle class="m-eye" cx="118" cy="99" r="11"/>
    <circle class="m-dark eye-p" cx="82" cy="99" r="5.2"/>
    <circle class="m-dark eye-p" cx="118" cy="99" r="5.2"/>
    <path class="m-horn m-stroke" d="M100,106 L109,119 C105,125 95,125 91,119 Z"/>
    <path class="m-light" d="M100,142 C87,142 79,152 79,162 C85,158 93,156 100,156 C107,156 115,158 121,162 C121,152 113,142 100,142 Z"/>
  </g>`,
};
function rvCards(){return [...document.querySelectorAll(RV_SEL)];}
function runStage(html,cls,dur){
  const st=$('revealStage'); if(!st)return;
  clearTimeout(st._t);
  st.className='reveal-stage '+cls; st.innerHTML=html;
  void st.offsetWidth; st.classList.add('go');
  st._t=setTimeout(()=>{st.classList.remove('go');st.className='reveal-stage';st.innerHTML='';},dur);
}
function buildMascot(r){
  const m=RV_META[r], dirY=r==='bull'?-1:r==='bear'?1:0;
  const streaks=Array.from({length:8},(_,i)=>`<span class="rv-streak" style="--a:${i*45}deg;--d:${i*28}ms"></span>`).join('');
  let pcl='';for(let i=0;i<16;i++){const x=(Math.random()*2-1);
    const tx=(x*(r==='neutral'?125:55)).toFixed(0);
    const ty=(dirY*(60+Math.random()*75)+(r==='neutral'?(Math.random()*2-1)*22:0)).toFixed(0);
    pcl+=`<span class="rv-pcl" style="--tx:${tx}px;--ty:${ty}px;--sz:${(4+Math.random()*7).toFixed(0)}px;--dl:${i*32}ms"></span>`;}
  let smoke='';for(let i=0;i<7;i++){smoke+=`<span class="rv-smoke" style="--x:${(Math.random()*2-1).toFixed(2)};--sz:${(70+Math.random()*70).toFixed(0)}px;--dl:${150+i*70}ms"></span>`;}
  return `<div class="rv-back"></div><div class="rv-core ${r}">
    <span class="rv-halo"></span>
    <span class="rv-rays"></span>
    <span class="rv-ground"></span>
    <span class="rv-burst"></span><span class="rv-burst b2"></span>
    <div class="rv-streaks">${streaks}</div>${smoke}
    <div class="rv-glyph rv-${r}">
      <img class="rv-img" src="assets/mascot-${r}.png" alt="" draggable="false">
      <svg viewBox="0 0 200 200" class="rv-svg" style="display:none">${MASCOTS[r]}</svg>
    </div>
    ${pcl}
    <div class="rv-word">${m.word}<small>${m.tag}</small></div></div>`;
}
function buildPersonaFx(p){
  return `<div class="rv-back"></div><div class="rv-sweep"></div>
    <div class="rv-emblem"><span class="rve-ic">${icon(PERSONA[p].icon,34)}</span>
      <b>${PERSONA[p].label}</b><small>${p==='investor'?'Long-term wealth':'Active markets'}</small></div>`;
}
function cinematicRegime(r){
  if(prefersReduced()||state.revealing){applyRegime(r);return;}
  state.revealing=true;
  rvCards().forEach((c,i)=>{c.style.setProperty('--rvd',(i*45)+'ms');c.classList.remove('rv-in');c.classList.add('rv-out');});
  setTimeout(()=>{ applyRegime(r); runStage(buildMascot(r),'reveal-regime '+r,1450); },300);
  setTimeout(()=>{ rvCards().forEach((c,i)=>{c.classList.remove('rv-out');c.style.setProperty('--rvd',(i*55)+'ms');c.classList.add('rv-in');}); },840);
  setTimeout(()=>{ rvCards().forEach(c=>{c.classList.remove('rv-in');c.style.removeProperty('--rvd');}); state.revealing=false; },1700);
}
function cinematicPersona(p){
  if(prefersReduced()||state.revealing){applyPersona(p,{user:true});return;}
  const gateOpen=$('personaGate')&&$('personaGate').classList.contains('show');
  state.revealing=true;
  runStage(buildPersonaFx(p),'reveal-persona '+p,900);
  if(gateOpen){
    applyPersona(p,{user:true});
    rvCards().forEach((c,i)=>{c.style.setProperty('--rvd',(i*50)+'ms');c.classList.add('pm-in');});
    setTimeout(()=>{rvCards().forEach(c=>{c.classList.remove('pm-in');c.style.removeProperty('--rvd');});state.revealing=false;},780);
  }else{
    rvCards().forEach((c,i)=>{c.style.setProperty('--rvd',(i*38)+'ms');c.classList.add('pm-out');});
    setTimeout(()=>{
      applyPersona(p,{user:true});
      rvCards().forEach((c,i)=>{c.classList.remove('pm-out');c.style.setProperty('--rvd',(i*50)+'ms');c.classList.add('pm-in');});
      setTimeout(()=>{rvCards().forEach(c=>{c.classList.remove('pm-in');c.style.removeProperty('--rvd');});state.revealing=false;},760);
    },230);
  }
}
// Crypto trades 24/7, no NSE-style market-hours/Kite-connection status to show, so the header
// clock strip stays hidden here. Live status is the Binance ticker banner (cryptoStatusBar()).
function updateClock(){const el=$('mktStatus');if(el)el.hidden=true;const eng=$('hdrEngine');if(eng)eng.hidden=true;}
const isInvestor=()=>state.persona==='investor';
const isAlgo=()=>state.persona==='algo';
function syncFab(){const p=CRYPTO_ONLY?'algo':(state.persona||'trader');
  let active=null;
  document.querySelectorAll('#modeFab [data-persona]').forEach(b=>{const on=b.dataset.persona===p;b.classList.toggle('on',on);b.setAttribute('aria-selected',on);if(on)active=b;});
  const fb=$('modeFab'); if(fb){ fb.dataset.persona=p; if(CRYPTO_ONLY) fb.style.display='none'; }
  // slide the pill to the active button (works for any count / variable widths)
  const pill=fb&&fb.querySelector('.mf-pill');
  if(pill&&active){ pill.style.left=active.offsetLeft+'px'; pill.style.width=active.offsetWidth+'px'; }}
function applyPersona(p,opts){
  opts=opts||{};
  if(PERSONA_KEYS.indexOf(p)<0)p='trader';
  const changed=state.persona!==p;
  state.persona=p;
  document.documentElement.dataset.persona=p;
  applyPaneWidths(); // re-apply (3-pane) or clear (algo/ai single-pane) the grid width on every persona switch
  syncFab();
  const gate=$('personaGate'); if(gate && !onboarding) gate.classList.remove('show');  // onboarding keeps the gate open to advance to the connect step
  // reset order-pad context so verbs/defaults match the new persona
  state.orderSide=null; state.orderQty=null; state.tradeFromChart=null; state.panelTab=null;
  $('fundsLabel').textContent=PERSONA[p].fundsLabel(state.displayed);
  if(opts.user && changed && window.TPChart && TPChart.setTimeframe) TPChart.setTimeframe(PERSONA[p].chartTf);
  const r=state.displayed;
  renderRegimeBar(r); renderWatchlist(r); renderPanel(r); renderOrder(r); renderWidgetStack(); renderDeskView(); renderAlgo();
  if(opts.user){
    announce(`${PERSONA[p].label} mode, terminal retuned for ${p==='investor'?'long-term investing':'active trading'}`);
    const t=document.querySelector('.terminal'); if(t){t.classList.remove('persona-morph');void t.offsetWidth;t.classList.add('persona-morph');setTimeout(function(){t.classList.remove('persona-morph');},480);}
  }
  saveState();
}
function startOnboarding(){
  onboarding=true;
  const g=$('personaGate'); if(!g) return;
  if(CRYPTO_ONLY){ applyPersona('algo',{user:true}); obStep(2); g.classList.add('show'); return; }
  obStep(1); g.classList.add('show');
}
function obStep(n){
  const g=$('personaGate'); if(!g) return;
  g.dataset.step=String(n);
  g.querySelectorAll('.pg-dot').forEach((d,i)=>d.classList.toggle('on',i<n));
  if(n===2){
    renderOnboardConnect();
    // pull fresh bot/Kite status, then re-render with the live result
    if(typeof loadBotData==='function') loadBotData().then(()=>{ if(onboarding) renderOnboardConnect(); }).catch(()=>{});
    const f=$('pgStep2').querySelector('[data-obfinish]'); if(f) f.focus();
  }
}
function onboardPick(p){ applyPersona(p,{user:true}); obStep(2); }
function renderOnboardConnect(){
  const el=$('pgStep2'); if(!el) return;
  const botOff=!BOT.loaded||BOT.error;
  const running=BOT.status&&BOT.status.harnessRunning;
  const statusCard=botOff
    ?`<div class="ob-status off">${icon('shield',16)}<div><b>Setting up your paper account</b><span>Live prices and the paper book connect automatically, no action needed.</span></div></div>`
    :`<div class="ob-status ok"><span class="live-dot live"></span><div><b>Crypto engine ${running?'running':'ready'}</b>
    <span>Live Binance spot prices · 24/7 paper book · no exchange keys required.</span></div></div>`;
  const legend=`<div class="ob-legend">
    <span><span class="ob-tag live">● LIVE</span> real Binance prices</span>
    <span><span class="ob-tag paper">PAPER</span> simulated fills, honest costs</span>
    <p>zengtrade never fabricates numbers, prove your edge forward before going live.</p></div>`;
  el.innerHTML=`
    <h2 class="pg-title">Welcome to zengtrade Crypto</h2>
    <p class="pg-sub">Backtest, forward-test, and paper-trade systematic strategies on live crypto prices, 24/7.</p>
    ${statusCard}${legend}
    <div class="ob-foot">
      <button class="tbtn primary ob-start" data-obfinish type="button">Open Algo Studio ▶</button>
    </div>`;
}
function finishOnboarding(){
  onboarding=false;
  const g=$('personaGate'); if(g) g.classList.remove('show');
  saveState();                       // persona was already saved on pick; this also persists post-onboarding state
  if(state.lastFocus&&state.lastFocus.focus) try{state.lastFocus.focus();}catch(e){}
}
function renderOrderInvestor(r){
  const sym=state.selected||REGIME_SYM[r], s=bySym(sym);
  const side=state.orderSide==='sell'?'redeem':'invest';
  const amt=state.investAmt!=null?state.investAmt:10000;
  const type=state.investType||'cnc';
  // honest pricing: no live quote → no price (never divide by 0 → "Infinity" units)
  const live=!!BOT.live && s && s.live!==false;
  const px=(live&&typeof s.ltp==='number'&&isFinite(s.ltp)&&s.ltp>0)?s.ltp:0;
  const pxTxt=px>0?px.toLocaleString('en-IN'):'-';
  const units=px>0?Math.max(0,Math.floor(amt/px)):null;
  const unitsTxt=units!=null?units:'-';
  const types=[['cnc','Buy · Delivery'],['sip','Monthly SIP'],['gtt','GTT buy']];
  const typePills=types.map(([k,l])=>`<span class="type-pill ${k===type?'on':''}" data-itype="${k}">${l}</span>`).join('');
  const ctaCls=side==='invest'?'cta-buy':'cta-sell';
  const ctaTxt=side==='invest'?(type==='sip'?'START SIP · '+sym:'INVEST '+inr(amt)+' · '+sym):'REDEEM · '+sym;
  const note=r==='bear'?`<div class="order-note note-go">${icon('sprout',14)}<span>Accumulation zone, averaging down quality at lower prices. No leverage, no stop-loss.</span></div>`
    :r==='bull'?`<div class="order-note note-warn">${icon('scale',14)}<span>Markets extended, invest steadily, don't chase. Consider rebalancing instead of adding.</span></div>`
    :`<div class="order-note note-info">${icon('repeat',14)}<span>Range-bound, ideal for rupee-cost averaging via SIP.</span></div>`;
  $('orderPad').innerHTML=`<div class="order-card">
    <div class="order-head"><span class="oh-sym">${sym}</span><span class="oh-px ${live?cls(s.chg):'muted'} num"><span id="ordLtp">${pxTxt}</span> ${live?pct(s.chg):''}</span>${cardCtl('order')}</div>
    <div class="order-body">
      <div class="side-tabs"><div class="side-tab buy ${side==='invest'?'active':''}" data-iside="invest">INVEST</div><div class="side-tab sell ${side==='redeem'?'active':''}" data-iside="redeem">REDEEM</div></div>
      <div class="type-row">${typePills}</div>
      <div class="fld"><label>${type==='sip'?'Monthly amount':'Amount'} <i>₹</i></label><div class="qty-step"><button class="qbtn" data-amt="-2500" aria-label="Decrease amount">−</button><input class="qty-inp num" id="ordAmt" value="${amt}" inputmode="numeric" aria-label="Investment amount"><button class="qbtn" data-amt="2500" aria-label="Increase amount">+</button></div></div>
      <div class="fld-row">
        <div class="fld"><label>Approx units</label><div class="inp num" id="ordUnits">${unitsTxt}</div></div>
        <div class="fld"><label>${type==='sip'?'Annual outlay':'Avg cost'}</label><div class="inp num">${type==='sip'?inr(amt*12):pxTxt}</div></div>
      </div>
      ${note}
      <button class="cta ${ctaCls}" id="placeBtn">${ctaTxt}</button>
    </div></div>`;
  $('orderPad').querySelectorAll('[data-iside]').forEach(b=>b.onclick=()=>{state.orderSide=b.dataset.iside==='redeem'?'sell':'buy';renderOrder(state.displayed);});
  $('orderPad').querySelectorAll('[data-itype]').forEach(b=>b.onclick=()=>{state.investType=b.dataset.itype;renderOrder(state.displayed);});
  $('orderPad').querySelectorAll('[data-amt]').forEach(b=>b.onclick=()=>{const d=+b.dataset.amt;state.investAmt=Math.max(500,(state.investAmt!=null?state.investAmt:amt)+d);renderOrder(state.displayed);});
  const ai=$('ordAmt'); if(ai) ai.oninput=()=>{const v=parseInt(ai.value)||0;state.investAmt=Math.max(0,v);
    const u=$('ordUnits'); if(u)u.textContent=px>0?Math.max(0,Math.floor(state.investAmt/px)):'-';
    const cb=$('placeBtn'); if(cb&&side==='invest')cb.textContent=(type==='sip'?'START SIP · '+sym:'INVEST '+inr(state.investAmt)+' · '+sym);};
  $('placeBtn').onclick=()=>openInvestModal(r);
  updateCardBtns();
}
function openInvestModal(r){
  const sym=state.selected||REGIME_SYM[r], s=bySym(sym);
  const side=state.orderSide==='sell'?'redeem':'invest';
  const amt=state.investAmt!=null?state.investAmt:10000;
  const type=state.investType||'cnc';
  const live=!!BOT.live && s && s.live!==false;
  const px=(live&&typeof s.ltp==='number'&&isFinite(s.ltp)&&s.ltp>0)?s.ltp:0;
  if(px<=0){ quickToast&&quickToast('No live price for '+sym,'Connect the exchange to invest at a real price.'); return; }
  const units=Math.max(0,Math.floor(amt/px));
  if(!amt){const ai=$('ordAmt');if(ai)ai.focus();return;}
  setModalTitle(side==='invest'?(type==='sip'?'Start SIP':'Confirm investment'):'Confirm redemption');
  $('modalBody').innerHTML=`
    <div class="modal-top ${side==='invest'?'is-buy':'is-sell'}">
      <span class="modal-side">${side==='invest'?(type==='sip'?'SIP':'INVEST'):'REDEEM'}</span>
      <div><div class="modal-sym">${sym}</div><div class="modal-name">${s.name}</div></div>
      <span class="modal-px num">${s.ltp.toLocaleString('en-IN')}</span></div>
    <div class="modal-grid">
      <div><span>Product</span><b>${type==='sip'?'Monthly SIP':type==='gtt'?'GTT':'Delivery · CNC'}</b></div>
      <div><span>${type==='sip'?'Monthly amount':'Amount'}</span><b class="num">${inr(amt)}</b></div>
      <div><span>Approx units</span><b class="num">${units}</b></div>
      <div><span>Avg cost</span><b class="num">${s.ltp.toLocaleString('en-IN')}</b></div>
      ${type==='sip'?`<div><span>Annual outlay</span><b class="num">${inr(amt*12)}</b></div>`:''}
      <div><span>Regime context</span><b style="text-transform:capitalize;color:var(--accent-d)">${r}</b></div>
    </div>
    <div class="modal-note">${icon('sprout',13)}<span>${side==='invest'?'Long-term delivery order, no leverage, no stop-loss. Pause or stop a SIP anytime.':'Redemption request against your delivery holding.'}</span></div>`;
  const cf=$('modalConfirm');
  cf.style.display='';
  cf.className='tbtn '+(side==='invest'?'primary':'danger');
  cf.textContent=side==='invest'?(type==='sip'?'Start SIP':'Confirm Invest'):'Confirm Redeem';
  cf.onclick=()=>{placeInvest({sym,side,type,amt,units,price:Math.round(s.ltp)});closeModal();};
  state.lastFocus=document.activeElement; showModal(true);
  setTimeout(()=>{const c=$('modalConfirm');if(c)c.focus();},40);
}
function placeInvest(o){
  const title=o.side==='invest'?(o.type==='sip'?'SIP started, '+o.sym:'Investment placed, '+o.sym):'Redemption placed, '+o.sym;
  const sub=o.type==='sip'?`${inr(o.amt)}/month · ~${o.units} units @ ${o.price.toLocaleString('en-IN')}`
    :`${inr(o.amt)} · ~${o.units} units @ ${o.price.toLocaleString('en-IN')} · Delivery`;
  const t=document.createElement('div');t.className='toast';
  t.innerHTML=`<div class="toast-ico">${icon('check',22)}</div><div class="toast-body"><b>${title}</b><span>${sub}</span></div><div class="toast-acts"><button class="tbtn ghost" data-act="ok">Dismiss</button></div>`;
  $('toastWrap').appendChild(t);
  t.querySelector('[data-act=ok]').onclick=()=>dismiss(t);
  t._timer=setTimeout(()=>{if(document.body.contains(t))dismiss(t);},4500);
  state.panelTab=o.type==='sip'?'sips':'holdings'; renderPanel(state.displayed);
  announce(title);
}
const INVEST_TOOLS=[
  {key:'ipo',      label:'IPO',                icon:'wallet',  tag:'5 open',    desc:'Apply to mainboard &amp; SME IPOs via UPI / ASBA.'},
  {key:'algo',     label:'IB Algo',            icon:'bolt',    tag:'New',       desc:'Rule-based strategies that execute for you.'},
  {key:'basket',   label:'Smart Basket',       icon:'shield',  tag:'12 themes', desc:'Curated, theme-based stock baskets in one tap.'},
  {key:'analyser', label:'Portfolio Analyser', icon:'pie',     tag:'Live',      real:true, desc:'X-ray your real holdings, value, concentration, sector mix &amp; P&amp;L.'},
  {key:'mf',       label:'Mutual Funds',       icon:'droplet', tag:'2,000+',    desc:'Direct funds, explore, compare &amp; invest.'},
  {key:'sip',      label:'Stock SIP',          icon:'repeat',  tag:'',          desc:'Automate recurring investments in stocks.'},
  {key:'research', label:'Research',           icon:'search',  tag:'Daily',     desc:'Ideas, calls &amp; deep-dive reports.'},
];
function portfolio(){
  const eqInv=HOLDINGS.reduce((a,h)=>a+h.hold.qty*h.hold.avg,0), eqCur=EXPOSURE;
  const eqToday=HOLDINGS.reduce((a,h)=>a+h.val*h.chg/100,0);
  const mfInv=MF_HELD.reduce((a,m)=>a+m.inv,0), mfCur=MF_HELD.reduce((a,m)=>a+m.cur,0);
  const mk=(inv,cur,today)=>({inv,cur,pnl:cur-inv,pct:inv?(cur-inv)/inv*100:0,today,todayPct:cur?today/cur*100:0});
  return {all:mk(eqInv+mfInv,eqCur+mfCur,eqToday),stocks:mk(eqInv,eqCur,eqToday),mf:mk(mfInv,mfCur,0),eqCur,mfCur};
}
function quickToast(title,sub){
  const t=document.createElement('div');t.className='toast';
  t.innerHTML=`<div class="toast-ico">${icon('wallet',22)}</div><div class="toast-body"><b>${title}</b><span>${sub}</span></div><div class="toast-acts"><button class="tbtn ghost" data-act="ok">Dismiss</button></div>`;
  $('toastWrap').appendChild(t);
  t.querySelector('[data-act=ok]').onclick=()=>dismiss(t);
  t._timer=setTimeout(()=>{if(document.body.contains(t))dismiss(t);},4000);
}
function ts(k,def){ return (state.toolState[k]!==undefined)?state.toolState[k]:def; }
function secStats(items){return `<div class="sec-stats">${items.map(s=>`<div class="sec-stat"><span class="ss-l">${s.l}</span><b class="ss-v num ${s.tone||''}"${s.id?` data-live="${s.id}"`:''}>${s.v}</b>${s.s?`<span class="ss-s">${s.s}</span>`:''}</div>`).join('')}</div>`;}
function secEmpty(ic,title,msg,cta){return `<div class="sec-empty"><span class="se-ic">${icon(ic,28)}</span><b>${title}</b><p>${msg}</p>${cta||''}</div>`;}
function lcMsg(s){
  return s==='paper'?'Live data, simulated fills, no real money. Building forward evidence.'
    : s==='paused'?'Paused, no new entries; open paper positions are kept.'
    : (s===null||s==='off')?'Stopped, open paper positions square off next cycle; nothing else trades it.'
    : 'Updated.';
}
async function setStrategyState(id, stateVal, title){
  try{
    const r=await fetch(BOT_API+'/api/strategy',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({id,state:stateVal})}).then(x=>x.json());
    if(r&&r.error){
      if(r.upgrade){ quickToast('Upgrade to Pro', r.error); setTimeout(function(){ location.href=r.upgrade; }, 700); return r; }
      quickToast('Action failed', r.error); return r;
    }
    if(r&&r.locked){ quickToast('Live locked '+'🔒', r.reason||'Arm ALLOW_LIVE on the bot machine to go live.'); }
    else { quickToast(title||'Updated', lcMsg(stateVal)); }
    // refresh both the shared catalog and this user's own crypto monitor snapshot, so a Stop/Deploy
    // toast is never followed by a card that still shows the pre-action state until the next poll.
    await Promise.all([loadBotData(), loadCryptoMonitor()]);
    if(typeof renderAlgo==='function') renderAlgo();
    return r;
  }catch(e){ quickToast('Action failed','The trading engine is temporarily unreachable, try again shortly.'); }
}
function algoDeploy(a){
  if(!a.wired){ quickToast('Not deployable yet', `${a.name} has no live engine, backtest/validate it first.`); return; }
  flowModal({title:'Deploy in Paper, '+a.name, confirm:'Deploy in Paper',
    body:`<div class="flow-top"><div><b>${esc(a.name)}</b><span class="flow-sub">${esc(a.cat)} · ${esc(a.risk)}</span></div><span class="badge ${a.risk==='Aggressive'?'b-warn':a.risk==='Conservative'?'b-up':'b-neu'}">${esc(a.risk)}</span></div>
      <div class="flow-rows">
        <div><span>Best regime</span><b class="num">${esc(a.bestRegime||'-')}</b></div>
        <div><span>Validation</span><b class="num ${a.vstatus==='validated'?'up':''}">${a.vstatus==='validated'?'Validated':'Candidate'}</b></div>
      </div>
      <p class="flow-note">${icon('shield',13)}<span><b>Risk-free.</b> Paper deploy runs this strategy on <b>live Binance data with simulated fills</b>: no real orders, no money at risk. Your bot harness starts trading it; closed-trade P&amp;L builds toward the Go-Live gate (≥${BOT.nudgeMin||10} profitable trades). You can Pause or Stop anytime.</span></p>`,
    onConfirm(){ setStrategyState(a.id,'paper','Deployed, '+a.name); }
  });
}
function lcStop(a){
  const flatten=a.sub==='live';
  flowModal({title:(flatten?'Stop & Flatten, ':'Stop, ')+a.name, confirm:flatten?'Stop & Flatten':'Stop', danger:true,
    body:`<p class="flow-note">${icon('alert',13)}<span>${flatten
      ? `This <b>squares off real positions</b> and stops the strategy. Real-money action, confirm you want to exit now.`
      : `Stops paper-trading <b>${esc(a.name)}</b>. Any open paper positions are squared off next cycle. You can redeploy anytime.`}</span></p>`,
    onConfirm(){ setStrategyState(a.id,'off','Stopped, '+a.name); }});
}
function cryptoLibDeploy(bid){
  const c=CRYPTO_STRATEGIES.find(x=>x.bid===bid);
  if(!c){ quickToast('Engine loading','Wait for the strategy catalog to load from the API.'); return; }
  if(!c.wired){ quickToast('Not deployable yet', `${c.name} has no live engine on the cloud worker yet, backtest/validate it first.`); return; }
  const m=((CRYPTOMON.data&&CRYPTOMON.data.strategies)||[]).find(x=>x.id===bid);
  if(!CRYPTOMON.loaded&&!CRYPTOMON.busy) loadCryptoMonitor();
  const a={ id:bid, name:c.name, cat:c.cat+' · '+c.pair, risk:c.risk, wired:true,
            bestRegime:null, vstatus:'validated', sub:(m&&m.deployed)?'paper':null };
  if(a.sub==='paper') lcStop(a);
  else algoDeploy(a);
}
const newLayoutId=()=>'L'+Date.now().toString(36)+(_lid++);
function customLayouts(){ if(!Array.isArray(state.customLayouts))state.customLayouts=[]; return state.customLayouts; }
function activeCustom(){ const a=customLayouts(); let cl=a.find(l=>l.id===state.activeCustom); if(!cl){cl=a[0]||null; state.activeCustom=cl?cl.id:null;} return cl; }
function newTabId(){ return 't'+Math.random().toString(36).slice(2,8)+Date.now().toString(36).slice(-3); }
function tabsOf(cl){ if(!cl) return [];
  if(!Array.isArray(cl.tabs)){ cl.tabs=[{id:newTabId(),name:'Main',cards:Array.isArray(cl.cards)?cl.cards:[],sync:{A:0,B:1}}]; cl.activeTab=cl.tabs[0].id; }
  if('cards' in cl) delete cl.cards;                                   // drop the migrated flat list
  cl.tabs.forEach(t=>{ if(!t.id)t.id=newTabId(); if(!Array.isArray(t.cards))t.cards=[]; if(typeof t.name!=='string')t.name='Tab'; if(!t.sync||typeof t.sync!=='object')t.sync={A:0,B:1}; });
  if(!cl.tabs.length) cl.tabs.push({id:newTabId(),name:'Main',cards:[],sync:{A:0,B:1}});
  if(!cl.tabs.find(t=>t.id===cl.activeTab)) cl.activeTab=cl.tabs[0].id;
  return cl.tabs;
}
function activeTab(){ const cl=activeCustom(); if(!cl) return null; const ts=tabsOf(cl); return ts.find(t=>t.id===cl.activeTab)||ts[0]; }
const isDesk=()=>state.persona==='trader'&&(state.layout==='options'||state.layout==='futures');
const isCenterTakeover=()=>state.persona==='trader'&&['options','futures','build'].indexOf(state.layout)>=0;
function renderDeskView(){
  const v=$('deskView'); if(!v) return;
  v.innerHTML='';
}
function canvasCatalog(){ if(_canvasCat) return _canvasCat; _canvasCat=(WIDGET_CATALOG.trader||[]).map(w=>({key:w.key,name:w.name,icon:w.icon,span:1,render:w.render})); return _canvasCat; }
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function sanInstr(s){ return typeof s==='string' ? s.replace(/[<>"'`]/g,'') : s; }
const BOT_API=(()=>{
  const h=location.hostname;
  if(h==='localhost'||h==='127.0.0.1'||h==='::1'||h==='') return 'http://localhost:8756';
  return '';   // production: SAME-ORIGIN, the tunnel routes /api/* to the bot, so the Cloudflare
               // Access cookie rides along automatically. No CORS, no CSP change, no secret in JS.
})();
let BOT={loaded:false,connected:false,status:null,paperMode:true,error:false,chains:{},chainExp:{},futures:null};
let ALGOS=[];   // no fabricated strategies, loadBotData() fills this from the real crypto engine
async function loadBotData(){
  try{
    const reqs=CRYPTO_ONLY
      ?[fetch(BOT_API+'/api/strategies').then(r=>r.json()).catch(()=>({strategies:[]})),
        fetch(BOT_API+'/api/status').then(r=>r.json()).catch(()=>({connected:false})),
        fetch(BOT_API+'/api/trades').then(r=>r.json()).catch(()=>({trades:[]})),
        Promise.resolve({stopped:[]})]
      :[fetch(BOT_API+'/api/strategies').then(r=>r.json()).catch(()=>({strategies:[]})),
        fetch(BOT_API+'/api/status').then(r=>r.json()).catch(()=>({connected:false})),
        fetch(BOT_API+'/api/trades').then(r=>r.json()).catch(()=>({trades:[]})),
        fetch(BOT_API+'/api/stopped').then(r=>r.json()).catch(()=>({stopped:[]}))];
    const [s,st,tr,sp]=await Promise.all(reqs);
    BOT.trades=tr.trades||[]; BOT.stopped=sp.stopped||[]; BOT.stoppedTotal=sp.totalFlattenPnl||0;
    BOT.connected=CRYPTO_ONLY?!!(st.ok||st.connected):!!st.connected;
    BOT.live=CRYPTO_ONLY?BOT.connected:!!st.connected;
    BOT.status=st; BOT.paperMode=CRYPTO_ONLY?true:(s.paperMode!==false); BOT.updated=s.updated; BOT.error=false;
    BOT.segments=s.segments||[{id:'crypto',label:'Crypto Spot',note:''}];
    if(s.strategies&&s.strategies.length){
      ALGOS=s.strategies.map(x=>({
        id:x.id,name:x.name,cat:x.cat,segment:x.segment,win:x.win,minCap:x.minCap,risk:x.risk,
        product:x.product,vstatus:x.status,bestRegime:x.bestRegime,regimeFit:x.regimeFit,requires:x.requires,
        desc:x.desc,sharpe:x.oos_sharpe,totalRet:x.totalRet,trades:x.trades,dd:x.dd||3,
        style:x.style,minDeploy:x.minDeploy,riskPerTrade:x.riskPerTrade,maxDD:x.maxDD,   // capital + risk + style model
        verdict:x.verdict,paperPnl:x.paperPnl,realisedPnl:x.realisedPnl,openPnl:x.openPnl,openPositions:x.openPositions,live:x.live,real:true,
        nudge:x.nudge,fwdTrades:x.fwdTrades,readyExceptCapital:x.readyExceptCapital,blockers:x.blockers,nudgeMsg:x.nudgeMsg,positions:x.positions,
        sub:x.sub,deployed:x.deployed,wired:x.wired,   // lifecycle: sub = paper|paused|live|null
        status:x.live?'live':'idle', cap:x.live?x.minCap:0, cagr:x.totalRet
      }));
      BOT.nudgeMin=s.nudgeMinTrades||10;
    }
  }catch(e){ BOT.error=true; }
  BOT.loaded=true;
}
// Structural signature: everything that, if changed, genuinely needs a heavy panel re-render.
// Deliberately EXCLUDES live prices/P&L, those are patched in place by the 2s loops + 1s clock,
// so the 30s poll no longer repaints the whole screen (that was the idle "flickers on its own").
function marketSig(){
  const m=BOT.market||{};
  const funds=(m.funds!=null)?Math.round(m.funds):'x';
  const hold=BOT.holdings?(Array.isArray(BOT.holdings)?BOT.holdings.length:Object.keys(BOT.holdings).length):0;
  const reg=(m.engine&&m.engine.regime)||state.displayed;
  return [BOT.live?1:0, BOT.connected?1:0, reg, funds, hold, state.selected||'', state.layout||'',
    state.persona||'', state.panelTab||'', (state.desk&&state.desk.view)||'',
    SYMS.map(s=>itemKey(s)).join(','), (typeof algoLiveSig==='function'?algoLiveSig():'')].join('~');
}
async function loadMarket(){
  try{
    const m=await fetch(BOT_API+'/api/market').then(r=>r.json());
    BOT.live=!!(m && m.real && !m.error && m.engine);
    BOT.market=BOT.live?m:null;
    if(BOT.live){
      const [q,h]=await Promise.all([
        fetch(BOT_API+'/api/uquotes?keys='+encodeURIComponent(watchKeys().join(','))).then(r=>r.json()).catch(()=>({quotes:{}})),
        fetch(BOT_API+'/api/holdings').then(r=>r.json()).catch(()=>null)
      ]);
      BOT.quotes=(q&&q.quotes)||{};
      // overlay REAL ltp/chg onto each watchlist instrument BY KEY (any segment), no synthetic
      // prices. s.live marks whether THIS instrument has a real quote; a null quote (delisted /
      // illiquid / market-closed) stays BLANK, never the stale catalog price.
      SYMS.forEach(s=>{const r=BOT.quotes[itemKey(s)]; if(r&&r.ltp!=null){s.ltp=r.ltp; if(r.chg!=null)s.chg=r.chg; s.live=true;} else {s.live=false;}});
      BOT.holdings=(h&&!h.error)?h:null;
    } else { BOT.quotes=null; BOT.holdings=null; BOT.tickerLive={}; BOT._regimeSynced=false; SYMS.forEach(s=>{s.live=false;}); }
  }catch(e){ BOT.live=false; BOT.market=null; BOT.quotes=null; BOT.holdings=null; BOT.tickerLive={}; BOT._regimeSynced=false; SYMS.forEach(s=>{s.live=false;}); }
  // Adaptive risk: when the LIVE regime actually flips, re-apply every "Adapt"-enabled
  // strategy's stand-aside / re-engage rule (paper only; never silent on real money).
  if(BOT.live && BOT.market && BOT.market.engine){
    const reg=BOT.market.engine.regime;
    if(BOT._adaptRegime && BOT._adaptRegime!==reg && typeof enforceAdapt==='function') enforceAdapt();
    BOT._adaptRegime=reg;
  }
  // Regime panel mirrors the LIVE Kite signals (unless the user is running a what-if): feed the
  // real signals into the sliders so the gauge, composite and AUTO switching reflect the real market.
  if(BOT.live && !state.simOverride && typeof syncSlidersFromLive==='function' && syncSlidersFromLive()){
    if(!BOT._regimeSynced){ BOT._regimeSynced=true; recompute({silent:true}); }  // adopt live regime quietly on first connect
    else recompute();                                                            // later polls → AUTO reacts to genuine flips
  } else if(typeof renderEngineSrc==='function'){ renderEngineSrc(); }
  if(BOT.live) connectStream(); else disconnectStream();   // sub-second push when live; keeps symset in sync
  applyFunds(); updateClock();
  // renderTopIndex + renderRegimeBar self-guard (patch in place / skip when unchanged) → cheap every poll.
  if(typeof renderTopIndex==='function') renderTopIndex();
  if(typeof renderRegimeBar==='function') renderRegimeBar(state.displayed);
  // The heavy panels do FULL innerHTML rebuilds, so only run them when something STRUCTURAL changed
  // (regime, connection, funds, holdings, symbol set, selection, layout/persona/tab, a trade opening
  // or closing). Live prices stay fresh via the 2s loops (applyTickDom / patchTape / patchAlgoLive).
  const _msig=marketSig();
  if(_msig!==BOT._mktSig){
    BOT._mktSig=_msig;
    if(typeof renderWatchlist==='function') renderWatchlist(state.displayed);
    if(typeof renderWidgetStack==='function') renderWidgetStack();
    if(typeof renderDeskView==='function') renderDeskView();   // refresh canvas cards (movers/pnl/heatmap) with live SYMS
    if(typeof renderChart==='function') renderChart(state.displayed);  // pull real candles once live
    if(typeof renderPanel==='function') renderPanel(state.displayed);  // holdings/positions panels -> real
    if(typeof isAlgo==='function' && isAlgo() && typeof renderAlgo==='function') renderAlgo();
  }
}
/* ---- REAL-TIME ticks via Kite WebSocket (/api/ticks, KiteTicker-fed). Updates only
   the watchlist price cells + chart last candle IN PLACE (no full re-render → drag,
   sort and selection survive). Self-gates on live + visible tab. ---- */
/* ===== Sub-second PUSH via Server-Sent Events (bot→browser stream) =====
   The bot holds one Kite WebSocket and pushes each tick to the browser over /api/stream
   (EventSource) the instant it lands, no 2s polling lag. The 2s poll below stays as an
   automatic fallback: it only fires when the stream isn't actively delivering (first paint,
   stream dropped, or EventSource unsupported), so prices are never stale and never doubled. */
const STREAM={es:null, syms:'', on:false, last:0};
function streamSyms(){ return liveKeys().join(','); }   // EXCH:TS keys: watchlist ∪ rolling-tape indices
function connectStream(){
  if(!BOT.live || typeof EventSource==='undefined') return;
  const keys=streamSyms();
  if(STREAM.es && STREAM.syms===keys) return;             // already streaming this exact set
  disconnectStream();
  STREAM.syms=keys;
  try{
    const es=new EventSource(`${BOT_API}/api/stream?keys=${encodeURIComponent(keys)}`);
    es.onopen=()=>{ STREAM.on=true; STREAM.last=Date.now(); };
    es.onmessage=ev=>{ try{ const d=JSON.parse(ev.data);
      if(d&&d.ticks){ applyTicks(d.ticks); STREAM.on=true; STREAM.last=Date.now(); if(d.stream)BOT.tickStream=d.stream; } }catch(e){} };
    es.onerror=()=>{ STREAM.on=false; };                  // EventSource auto-reconnects; the poll covers the gap
    STREAM.es=es;
  }catch(e){ STREAM.on=false; }
}
function disconnectStream(){ if(STREAM.es){ try{STREAM.es.close();}catch(e){} } STREAM.es=null; STREAM.on=false; STREAM.syms=''; }
// Apply a PARTIAL tick update (only the instruments that ticked) keyed by EXCH:TS: push stream.
function applyTicks(ticks){
  if(!ticks) return; const dir={};
  for(const key in ticks){ const t=ticks[key], s=byKey(key);
    if(s&&t&&t.ltp!=null){ dir[key]=Math.sign(t.ltp-(s.ltp||t.ltp)); s.ltp=t.ltp; if(t.chg!=null)s.chg=t.chg; s.live=true; } }
  applyTickDom(ticks,dir);
  applyTickerTicks(ticks);   // same ticks drive the rolling tape (indices + pinned stocks) in lock-step
}

let TICK_BUSY=false;
async function loadTicks(){
  if(TICK_BUSY || !BOT.live || document.visibilityState!=='visible') return;
  if(STREAM.on && Date.now()-STREAM.last < 6000) return;   // push stream is live → skip the poll
  TICK_BUSY=true;
  try{
    const d=await fetch(`${BOT_API}/api/ticks?keys=${encodeURIComponent(liveKeys().join(','))}`).then(r=>r.json());
    if(d&&d.ticks){
      const dir={};
      SYMS.forEach(s=>{const k=itemKey(s),t=d.ticks[k];
        if(t&&t.ltp!=null){ dir[k]=Math.sign(t.ltp-(s.ltp||t.ltp)); s.ltp=t.ltp; if(t.chg!=null)s.chg=t.chg; s.live=true; }
        else { s.live=false; }});
      applyTickDom(d.ticks,dir);
      applyTickerTicks(d.ticks);   // refresh the rolling tape's indices on the same poll
      BOT.tickStream=d.stream;
    }
  }catch(e){}
  TICK_BUSY=false;
}
function applyTickDom(ticks,dir){
  document.querySelectorAll('#wlRows .wl-row').forEach(row=>{
    const key=row.dataset.key, t=ticks[key]; if(!t||t.ltp==null) return;
    const ltpEl=row.querySelector('.wl-ltp'), chgEl=row.querySelector('.wl-chg');
    if(ltpEl){ ltpEl.textContent=(+t.ltp).toLocaleString('en-IN'); ltpEl.classList.remove('muted');
      const dr=dir[key]; if(dr){ltpEl.classList.remove('tick-up','tick-dn');void ltpEl.offsetWidth;ltpEl.classList.add(dr>0?'tick-up':'tick-dn');} }
    if(chgEl){ const c=t.chg!=null?t.chg:0; chgEl.textContent=pct(c); chgEl.className='wl-chg num '+cls(c); }
  });
  // nudge the chart's last candle for the SELECTED instrument
  const si=state.selected&&bySym(state.selected); const t=si&&ticks[itemKey(si)];
  if(t&&t.ltp!=null&&window.TPChart&&TPChart.tick) TPChart.tick(si.sym,t.ltp);
}
/* ---- REAL 5-level market depth (/api/depth, full Kite quote().depth). Targeted body
   update so it never rebuilds the whole widget stack. Empty levels show " (" (honest)
   the order book is thin/empty after 15:30; all 5 levels fill during market hours). ---- */
let DEPTH_BUSY=false;
async function loadDepth(sym){
  if(!BOT.live || !sym || DEPTH_BUSY) return;
  DEPTH_BUSY=true;
  try{
    const d=await fetch(`${BOT_API}/api/depth?symbol=${encodeURIComponent(sym)}`).then(r=>r.json());
    BOT.depth=(d&&!d.error)?d:{symbol:sym,bids:[],asks:[],error:(d&&d.error)||'no data'};
  }catch(e){ BOT.depth={symbol:sym,bids:[],asks:[],error:'fetch failed'}; }
  DEPTH_BUSY=false;
  const body=document.querySelector('.wg-card[data-wkey="depth"] .wg-body');
  if(body && BOT.depth.symbol===(state.selected||'RELIANCE')){
    body.innerHTML = BOT.depth.error
      ? `<div class="wg-empty">No depth for ${esc(BOT.depth.symbol)}, ${esc(BOT.depth.error)}.</div>`
      : depthLadderHtml(BOT.depth);
  }
}
function depthLadderHtml(d){
  let rows='';
  for(let i=0;i<5;i++){const b=d.bids[i]||{}, a=d.asks[i]||{};
    rows+=`<div class="wg-depth"><span class="num up">${b.price?b.price.toFixed(1):'-'}</span>`
      +`<span class="wg-q">${b.qty?b.qty.toLocaleString('en-IN'):''}</span>`
      +`<span class="wg-q">${a.qty?a.qty.toLocaleString('en-IN'):''}</span>`
      +`<span class="num down">${a.price?a.price.toFixed(1):'-'}</span></div>`;}
  const tb=d.totalBuyQty||0, ts=d.totalSellQty||0;
  const foot=`<div class="wg-sub">${esc(d.symbol)} · bid ${tb.toLocaleString('en-IN')} · ask ${ts.toLocaleString('en-IN')}${(tb+ts)===0?' · book opens 09:15':''}</div>`;
  return `<div class="wg-depth wg-dhead"><span>Bid</span><span>Qty</span><span>Qty</span><span>Ask</span></div>${rows}${foot}`;
}
// FAST, lean poll for the live Monitor, every strategy's real-time P&L from /api/monitor (cached ~1ms).
async function loadMonitor(){
  try{
    const m=await fetch(BOT_API+'/api/monitor').then(r=>r.json());
    if(m&&m.running){
      BOT.monitor=m;
      const byId={}; m.running.forEach(r=>byId[r.id]=r);
      ALGOS.forEach(a=>{const r=byId[a.id]; if(r){
        a.paperPnl=r.paperPnl; a.openPnl=r.openPnl; a.realisedPnl=r.realisedPnl;
        // DON'T clobber a.live here: that conflated "subscribed" with "monitored" and raced
        // loadBotData every 2s (the old P&L flip-flop). All algo tabs filter on a.deployed (stable,
        // from /api/strategies); /api/monitor now returns only subscribed strategies, so they agree.
        a.openPositions=r.openPositions; a.fwdTrades=r.fwdTrades; a.positions=r.positions;
        // forward-test ACCURACY (real out-of-sample, parsed from closed paper trades)
        a.fwdWins=r.fwdWins; a.fwdLosses=r.fwdLosses; a.fwdWinPct=r.fwdWinPct;
        a.fwdProfitFactor=r.fwdProfitFactor; a.fwdAvgWin=r.fwdAvgWin; a.fwdAvgLoss=r.fwdAvgLoss; a.fwdExpectancy=r.fwdExpectancy;
      }});
    }
  }catch(e){}
}
function fundsText(){
  if(BOT.live && BOT.market && typeof BOT.market.funds==='number') return inr(BOT.market.funds);
  return '-';
}
function applyFunds(){ const e=$('fundsVal'); if(e) e.textContent=fundsText(); }
// Map a ticker/headline name to its REAL quote from /api/market (indices+commodities) or /api/quotes (stocks).
const MKT_INDEX={'NIFTY 50':['indices','NIFTY 50'],'SENSEX':['indices','SENSEX'],'BANK NIFTY':['indices','NIFTY BANK'],
  'FIN NIFTY':['indices','NIFTY FIN SERVICE'],'GOLD':['commodities','GOLD'],'SILVER':['commodities','SILVER'],'CRUDE OIL':['commodities','CRUDEOIL']};
// EXCH:TS tick keys for the headline instruments. Indices stream over the Kite WS (sub-second);
// MCX commodities don't, so they have no tick key and fall back to the 30s /api/market snapshot.
const TICKER_TICK_KEY={'NIFTY 50':'NSE:NIFTY 50','SENSEX':'BSE:SENSEX','BANK NIFTY':'NSE:NIFTY BANK','FIN NIFTY':'NSE:NIFTY FIN SERVICE'};
// {tickKey -> tickerName} for every ticker item that can stream live (indices + any pinned, watched stock).
function tickerTickMap(){
  const out={};
  (state.ticker.items||[]).forEach(name=>{
    const k=TICKER_TICK_KEY[name];
    if(k){ out[k]=name; return; }                          // headline index
    const s=bySym(name); if(s) out[itemKey(s)]=name;       // a stock pinned to the tape (rides its watchlist quote)
  });
  return out;
}
// All EXCH:TS keys the live tick path should subscribe/poll: watchlist ∪ ticker indices.
function liveKeys(){ const set=new Set(watchKeys()); Object.keys(tickerTickMap()).forEach(k=>set.add(k)); return [...set]; }
// Fold a fresh tick payload into the ticker's live overlay, then patch the tape in place. Returns true if anything changed.
// Iterates the ticker's OWN keys (not the payload) so a poll that returns a null/stale quote drops the overlay entry, 
// indices then fall back to the 30s snapshot, a stale pinned stock blanks honestly. SSE partials (key absent) are left alone.
function applyTickerTicks(ticks){
  if(!ticks) return false; const map=tickerTickMap(); let changed=false;
  for(const key in map){ const name=map[key], t=ticks[key];
    if(t===undefined) continue;                                   // not in this (partial SSE) payload → leave as-is
    if(t && t.ltp!=null){ (BOT.tickerLive||(BOT.tickerLive={}))[name]={ltp:t.ltp,chg:t.chg!=null?t.chg:0}; changed=true; }
    else if(BOT.tickerLive && BOT.tickerLive[name]!=null){ delete BOT.tickerLive[name]; changed=true; }   // source went stale
  }
  if(changed) patchTopIndex();
  return changed;
}
function realQuote(name){
  if(!BOT.live) return null;
  // 1) live tick overlay (indices stream sub-second; refreshed every tick by the fast path)
  const lv=BOT.tickerLive&&BOT.tickerLive[name];
  if(lv&&lv.ltp!=null) return {ltp:lv.ltp,chg:lv.chg};
  // 2) headline index/commodity from the latest /api/market snapshot (commodities don't tick → 30s refresh)
  const m=MKT_INDEX[name];
  if(m){ if(!BOT.market) return null; const o=(BOT.market[m[0]]||{})[m[1]]; return (o&&o.ltp!=null)?{ltp:o.ltp,chg:o.chgPct}:null; }
  // 3) a stock pinned to the tape → its live watchlist quote (SYMS carry tick-updated ltp/chg)
  const s=bySym(name); return (s&&s.live&&s.ltp!=null)?{ltp:s.ltp,chg:s.chg||0}:null;
}
function botBanner(){
  if(!BOT.loaded) return `<div class="bot-banner">${icon('cpu',13)}<span>Connecting to your trading bot…</span></div>`;
  if(BOT.error) return `<div class="bot-banner off">${icon('shield',13)}<span>The trading engine is temporarily offline, try reopening Algo Studio shortly.</span></div>`;
  if(!BOT.connected){
    const auto=BOT.status&&BOT.status.autoLogin, running=(BOT.status&&BOT.status.reloginRunning)||BOT.reconnecting;
    const msg=running?'Session expired, reconnecting to Kite…'
      :auto?'Session expired (daily token). Tap reconnect or it will auto-refresh shortly.'
      :'Kite session expired, the daily token. Run <b>python3 auto_login.py</b> (or <b>login.py</b>), or set up auto-login.';
    return `<div class="bot-banner off">${running?'<span class="live-dot warn pulse"></span>':icon('shield',13)}<span>${msg}</span>
      <button class="bot-relogin" data-relogin ${running?'disabled':''}>${running?'Reconnecting…':'Reconnect'}</button></div>`;
  }
  const u=BOT.status&&BOT.status.user?esc(BOT.status.user):'-';
  return `<div class="bot-banner on"><span class="live-dot live"></span><span>Kite connected · ${u} · <b>${BOT.paperMode?'PAPER mode, no real orders':'LIVE'}</b>${BOT.status&&BOT.status.subscription?' · '+esc(BOT.status.subscription):''}</span></div>`;
}
// Manual reconnect: trigger the headless TOTP re-login, then refresh everything.
async function botReconnect(){
  if(BOT.reconnecting) return; BOT.reconnecting=true;
  if(isAlgo()&&typeof renderAlgo==='function') renderAlgo();
  let res={};
  try{ res=await fetch(BOT_API+'/api/relogin',{method:'POST'}).then(r=>r.json()); }catch(e){ res={ok:false,error:'bot API offline'}; }
  BOT.reconnecting=false;
  if(res&&res.ok){ announce('Kite reconnected'); }
  else { announce('Reconnect failed'); quickToast&&quickToast('Couldn’t auto-reconnect', (res&&res.error)||'Run python3 login.py in the bot folder.'); }
  await loadBotData(); await loadMarket();   // refresh status + prices either way
  if(isAlgo()&&typeof renderAlgo==='function') renderAlgo();
  if(onboarding) renderOnboardConnect();     // reflect the new connection state in the wizard
}
document.addEventListener('click',e=>{ if(e.target.closest('[data-relogin]')) botReconnect(); });
/* ---- Live patching: update only the ticking values in place (no full re-render → no flicker) ---- */
function algoLiveSig(){
  // the STRUCTURE that, if it changes (a trade opens/closes, a strategy goes live), needs a full re-render
  return (state.algo&&state.algo.view)+'~'+(state.algo&&state.algo.exec)+'~'+
    ALGOS.map(a=>`${a.id}.${a.live?1:0}.${a.openPositions||0}.${a.fwdTrades||0}.${(a.positions||[]).map(p=>p.sym).join(',')}`).join('|');
}
function patchAlgoLive(){
  const exec=(state.algo&&state.algo.exec)||'paper';
  const setNum=(el,v)=>{ if(!el)return; el.textContent=sgn(v||0); el.classList.remove('up','down'); el.classList.add(cls(v||0)); };
  let total=0, totalR=0, totalU=0, depTotal=0;        // total = actively-running IN THE ACTIVE CLASS (Monitor); totalR/U = its realised/unrealised split; depTotal = all deployed (Forward Test)
  const brk={equity:0,options:0,futures:0}; let overall=0;   // per-class + combined (all classes) for the Monitor breakdown
  ALGOS.forEach(a=>{
    const v=exec==='live'?(a.livePnl||0):(a.paperPnl||0);
    if(a.live && inScope(a)){ total+=v; totalR+=(a.realisedPnl||0); totalU+=(a.openPnl||0); }   // scoped to the Equity/Options/Futures toggle, matches the list shown
    if(a.deployed) depTotal+=v;
    if(a.deployed){ const ik=algoInstr(a); if(brk[ik]!=null) brk[ik]+=v; overall+=v; }
    document.querySelectorAll('[data-live-pnl="'+a.id+'"]').forEach(el=>setNum(el,v));
    const sub=document.querySelector('[data-live-sub="'+a.id+'"]');
    if(sub) sub.textContent=(a.fwdTrades||a.openPositions||a.realisedPnl||a.openPnl)?`R ${sgn(a.realisedPnl||0)} · U ${sgn(a.openPnl||0)}`:'no trades yet';   // both realised & unrealised, live
    (a.positions||[]).forEach(p=>{
      if(p.entry==null) return;
      const key=a.id+'::'+p.sym;
      const ltp=document.querySelector('[data-live-ltp="'+key+'"]'); if(ltp) ltp.textContent=p.ltp!=null?p.ltp.toLocaleString('en-IN'):'-';
      const up=document.querySelector('[data-live-upnl="'+key+'"]');
      if(up){ up.textContent=sgn(p.unreal)+(p.chgPct!=null?` · ${p.chgPct>=0?'+':''}${p.chgPct}%`:''); up.classList.remove('up','down'); up.classList.add(cls(p.unreal)); }
    });
  });
  document.querySelectorAll('[data-live="monReal"]').forEach(el=>setNum(el,totalR));
  document.querySelectorAll('[data-live="monUnreal"]').forEach(el=>setNum(el,totalU));
  document.querySelectorAll('[data-live="monNet"]').forEach(el=>setNum(el,totalR+totalU));
  document.querySelectorAll('[data-live="algoTotal"]').forEach(el=>setNum(el,depTotal));
  document.querySelectorAll('[data-live="monOverall"]').forEach(el=>setNum(el,overall));
  document.querySelectorAll('[data-live="brkEquity"]').forEach(el=>setNum(el,brk.equity));
  document.querySelectorAll('[data-live="brkOptions"]').forEach(el=>setNum(el,brk.options));
  document.querySelectorAll('[data-live="brkFutures"]').forEach(el=>setNum(el,brk.futures));
  let anReal=0, anOpen=0;
  ALGOS.forEach(a=>{ if(a.live){ anReal+=(a.realisedPnl||0); anOpen+=(a.openPnl||0); } });
  document.querySelectorAll('[data-live="anRealised"]').forEach(el=>setNum(el,anReal));
  document.querySelectorAll('[data-live="anOpen"]').forEach(el=>setNum(el,anOpen));
  document.querySelectorAll('[data-live="anBook"]').forEach(el=>setNum(el,total));
  // Moonshot Mission banner (computed inline in missionBanner, so patch its live numbers here)
  const ms=ALGOS.find(a=>a.id==='moonshot');
  if(ms){ const START=5000, TARGET=5e10, eq=START+(ms.paperPnl||0), mult=eq/START;
    const prog=Math.max(0,Math.min(100,Math.log(Math.max(eq,1)/START)/Math.log(TARGET/START)*100));
    document.querySelectorAll('[data-live="msnEq"]').forEach(el=>{ el.textContent=inrShort(eq); el.className=(ms.paperPnl||0)>=0?'up':'down'; });
    document.querySelectorAll('[data-live="msnMult"]').forEach(el=>{ el.textContent=mult>=1?mult.toFixed(mult>=100?0:2)+'× start':'−'+((1-mult)*100).toFixed(1)+'%'; });
    document.querySelectorAll('[data-live="msnFill"]').forEach(el=>{ el.style.width=prog.toFixed(4)+'%'; });
    document.querySelectorAll('[data-live="msnProg"]').forEach(el=>{ el.textContent=prog.toFixed(prog<1?4:2)+'% of the way (log scale)'; });
  }
}
/* ============================================================
   STRATEGY LIBRARY: every strategy family, as honest, browseable,
   educational entries. Risk-first: each leads with how it FAILS and
   the survival guard, not just the upside. Entries are "Candidate"
   (recognised, not yet engine-backtested) until a backend-validated
   strategy of the same id graduates them. The whole survival ethos:
   pick what fits TODAY's regime, stand aside when nothing does.
   ============================================================ */
const STRAT_FAMILIES=[
  ['trend',      'Trend / Momentum',     'trendUp', 'Ride a move that has already started; lose small when it reverses.'],
  ['meanrev',    'Mean Reversion',       'repeat',  'Fade a stretched price back to its average. Wins often, must cap the rare big loss.'],
  ['breakout',   'Breakout / Volatility','bolt',    'Enter as price escapes a range on expanding volume.'],
  ['time',       'Time / Calendar',      'clock',   'The clock is the signal, time-of-day, expiry, day-of-week, auto square-off.'],
  ['statarb',    'Stat-Arb / Pairs',     'swap',    'Trade the spread between two related instruments, not the market direction.'],
  ['event',      'Event-Driven',         'flag',    'Position around a scheduled catalyst, results, rebalances, news.'],
  ['sentiment',  'Sentiment / OI / Flow','spark',   'Read positioning, open interest, PCR, max-pain, FII/DII flows.'],
  ['factor',     'Factor / Rotation',    'pie',     'Rotate a basket by a persistent edge, momentum, low-vol, quality, sector.'],
  ['ml',         'ML / Regime',          'cpu',     'A model picks the signal or switches the active strategy by regime.'],
  ['opt_dir',    'Options · Directional','target',  'Express a view with limited, known risk using long options or debit spreads.'],
  ['opt_income', 'Options · Income',     'wallet',  'Sell premium for steady credit, capped upside, must defend the tails.'],
  ['opt_vol',    'Options · Volatility', 'scale',   'Trade volatility itself, straddles, calendars, delta-neutral theta.'],
  ['arb',        'Cash-Futures / Arb',   'scissors','Lock a near-riskless spread between cash & futures or across expiries.'],
];
const SEG_LABEL={equity:'Equity',index:'Index F&O',fno:'Stock F&O',options:'Options',any:'Any market'};
/* ── Instrument × holding-style bifurcation (Library navigation) ──────────────
   Primary class is DERIVED from the catalog seg (equity→Equity, options→Options,
   index|fno→Futures). Holding style is an explicit per-strategy tag, a judgement
   call about how the strategy is actually held; retune freely in STRAT_HOLD. */
const INSTR_LABEL={equity:'Equity',options:'Options',futures:'Futures'};
const INSTR_TABS=[
  ['equity', 'Equity',  'layers',  'Cash stocks, delivery & intraday'],
  ['options','Options', 'target',  'Defined-risk & premium, calls & puts'],
  ['futures','Futures', 'trendUp', 'Leveraged index & stock F&O'],
];
const HOLD_LABEL={carry:'Carry-forward',intraday:'Intraday',swing:'Swing',expiry:'Expiry',scalper:'Scalper'};
const HOLD_DESC={
  carry:'Positional, held overnight to multi-day (CNC / carried F&O).',
  intraday:'Entered and squared off within the same session.',
  swing:'Held a few days on a directional or volatility view.',
  expiry:'Anchored to the options expiry cycle, theta, pin, expiry-day.',
  scalper:'Very short intraday, many small, fast trades.',
};
// per-instrument holding-style tabs (order as the user mapped them)
const HOLD_TABS={
  equity:['carry','intraday','scalper'],
  options:['carry','intraday','swing','expiry','scalper'],
  futures:['carry','intraday','swing','expiry','scalper'],
};
const instrOf=s=>(s.seg==='equity'||s.seg==='any')?'equity':(s.seg==='options')?'options':'futures';
const STRAT_HOLD={
  // Equity (cash stocks)
  lib_adx:'carry',lib_rsmom:'carry',lib_rsi2:'carry',lib_bollrev:'carry',lib_donchian:'carry',
  lib_vcp:'carry',lib_btst:'carry',lib_pairs:'carry',lib_earnings:'carry',lib_rebal:'carry',
  lib_sectorrot:'carry',lib_mompf:'carry',lib_lowvol:'carry',lib_quality:'carry',lib_mlsignal:'carry',
  lib_nr7:'intraday',lib_eodsq:'intraday',lib_news:'intraday',lib_gapfill:'scalper',
  // Futures (index & stock F&O)
  lib_macross:'carry',lib_fiiflow:'carry',lib_regimeswitch:'carry',lib_supertrend:'carry',
  lib_orb:'intraday',lib_dow:'swing',lib_ratio:'swing',lib_oibuildup:'swing',
  lib_idxarb:'expiry',lib_cashfut:'expiry',lib_calroll:'expiry',lib_ema921:'scalper',lib_vwaprev:'scalper',
  // Options
  lib_coveredcall:'carry',lib_calendar:'carry',lib_deltaneutral:'carry',lib_longopt:'intraday',
  lib_pcr:'swing',lib_debit:'swing',lib_credit:'swing',lib_straddle:'swing',
  lib_expiry:'expiry',lib_maxpain:'expiry',lib_strangle:'expiry',lib_condor:'expiry',lib_920:'scalper',
};
const holdOf=s=>STRAT_HOLD[s.id]||'carry';
/* Same Equity/Options/Futures × holding-style classes, but for the REAL backend bots (ALGOS).
   Instrument from segment+name; holding from product (CNC=carry, MIS=intraday, NRML=swing) with
   an explicit per-id map for the cases where that's too coarse. Scope is studio-wide. */
const ALGO_HOLD={
  orb:'intraday',vwap_rev:'scalper',vwap_mom:'scalper',ema_scalp:'scalper',bb_breakout:'intraday',meanrev:'intraday',
  momentum:'carry',rsi2:'carry',macross:'carry',supertrend:'carry',lowvol:'carry',xs_momentum:'carry',
  ema_cross:'carry',adx_trend:'carry',bollinger:'carry',zscore:'carry',nr7:'carry',opportunity:'carry',moonshot:'carry',
  pairs:'swing',strangle:'expiry',fut_trend:'swing',iron_condor:'expiry',basis:'expiry',mcx_trend:'swing',goldsilver:'swing',
};
function algoInstr(a){ const id=(a&&a.id||'').toLowerCase(), seg=(a&&a.segment||'').toLowerCase(), nm=(a&&a.name||'').toLowerCase();
  if(/strangle|condor|straddle|option|theta|premium selling|iron/.test(id+' '+nm)) return 'options';
  if(seg==='cash') return 'equity';
  if(seg==='fno'||seg==='commodity') return 'futures';
  return 'equity'; }
// Capital-at-risk deployed by a strategy = Σ open-position notional, marked to LTP (falls back to entry).
// Reconciles with the backend risk.exposure; F&O legs are shown at NOTIONAL, not margin (see the monitor note).
function algoDeployed(a){ return (a&&a.positions||[]).reduce((s,p)=>{ const q=p.qty,px=(p.ltp!=null?p.ltp:p.entry);
  return s+((q!=null&&px!=null)?Math.abs(q*px):0); },0); }
// Compact INR for capital figures: ₹99.9K · ₹9.95L · ₹1.20Cr.
function inrC(v){ if(v==null||!isFinite(v)) return '-'; const a=Math.abs(v);
  if(a>=1e7) return '₹'+(a/1e7).toFixed(2)+'Cr'; if(a>=1e5) return '₹'+(a/1e5).toFixed(2)+'L';
  if(a>=1e3) return '₹'+(a/1e3).toFixed(1)+'K'; return '₹'+Math.round(a); }
// Crypto deployed = Σ open-position notional (qty×entry); perps book 20% margin. Options premium ≈ 0 notional.
function cryptoDeployed(s){ const seg=(s&&s.instr)||'spot'; return (s&&s.positions||[]).reduce((a,p)=>{
  const n=Math.abs((p.qty||0)*(p.entry||0)); return a+(seg==='perps'?n*0.20:n); },0); }
// Shared monitor sort+filter (Indian & crypto books). Returns {sorted, bar}; chips reuse state.algo.monSort/monFilter.
const MON_SORTS=[['pnl','Top P&L'],['unreal','Unrealised'],['deployed','Deployed'],['open','Open'],['name','Name']];
const MON_FILTS=[['all','All'],['profit','In profit'],['loss','Losing'],['open','Open now']];
function monSortFilter(list){
  const mSort=state.algo.monSort||'pnl', mFilt=state.algo.monFilter||'all';
  const filtFn=({all:()=>true,profit:x=>(x.paperPnl||0)>0,loss:x=>(x.paperPnl||0)<0,open:x=>(x.openPositions||0)>0})[mFilt]||(()=>true);
  const sortFn=({pnl:(a,b)=>(b.paperPnl||0)-(a.paperPnl||0),unreal:(a,b)=>(b.openPnl||0)-(a.openPnl||0),open:(a,b)=>(b.openPositions||0)-(a.openPositions||0),
    deployed:(a,b)=>(b._dep||0)-(a._dep||0),name:(a,b)=>String(a.name||'').localeCompare(String(b.name||''))})[mSort]||((a,b)=>(b.paperPnl||0)-(a.paperPnl||0));
  const sorted=list.filter(filtFn).sort(sortFn);
  const bar=`<div class="mon-ctrl"><div class="mon-seg"><span class="msc-lead">Sort</span>${MON_SORTS.map(([k,l])=>`<button class="msc-chip${mSort===k?' on':''}" data-monsort="${k}">${esc(l)}</button>`).join('')}</div>`+
    `<div class="mon-seg"><span class="msc-lead">Show</span>${MON_FILTS.map(([k,l])=>`<button class="msc-chip${mFilt===k?' on':''}" data-monfilter="${k}">${esc(l)}</button>`).join('')}<span class="msc-count">${sorted.length} of ${list.length}</span></div></div>`;
  return {sorted,bar};
}
function algoHold(a){ const id=(a&&a.id||'').toLowerCase(); if(ALGO_HOLD[id]) return ALGO_HOLD[id];
  if(/scalp/.test(id)) return 'scalper'; const p=(a&&a.product||'').toUpperCase();
  if(p==='MIS') return 'intraday'; if(p==='NRML') return 'swing'; return 'carry'; }
// studio-wide instrument × holding scope, the single source of truth every Algo tab honours
function studioScope(){ const a=state.algo=state.algo||{};
  if(!a.instr){ a.instr=(a.lib&&a.lib.instr)||'equity'; } if(!a.hold){ a.hold=(a.lib&&a.lib.hold)||'all'; }
  return {instr:a.instr,hold:a.hold}; }
function inScope(a){ const sc=studioScope(); return algoInstr(a)===sc.instr && (sc.hold==='all'||algoHold(a)===sc.hold); }       // ALGOS
function libInScope(s){ const sc=studioScope(); return instrOf(s)===sc.instr && (sc.hold==='all'||holdOf(s)===sc.hold); }       // STRAT_LIBRARY
// risk → existing badge class (Conservative=b-up, Moderate=b-neu, Aggressive=b-warn)
const STRAT_LIBRARY=[
  // ---- Trend / Momentum ----
  {id:'lib_macross',name:'Moving-Average Crossover',fam:'trend',risk:'Moderate',seg:'index',best:'Bull',
   what:'Goes long when a fast MA crosses above a slow MA; flat/short when it crosses below.',
   rule:'BUY when price/fast-MA crosses above the slow MA (e.g. 50 over 200); exit on the opposite cross.',
   works:'Sustained, trending markets, it catches the meat of a directional move.',
   fails:'Choppy, sideways markets, it gets whipsawed, buying high and selling low repeatedly.',
   guard:'Add a regime filter (only take longs in Bull) and a hard stop; stand aside in Choppy.',
   params:[['Fast MA','50'],['Slow MA','200'],['Stop','ATR×2']]},
  {id:'lib_ema921',name:'EMA 9/21 Momentum',fam:'trend',risk:'Aggressive',seg:'index',best:'Bull',
   what:'Faster intraday version of the crossover for momentum bursts.',
   rule:'Long when EMA9 > EMA21 and price holds above both; exit when EMA9 crosses back below EMA21.',
   works:'Strong intraday trends and momentum days with a clear direction.',
   fails:'Range-bound, low-volume sessions, frequent small losses pile up.',
   guard:'Cap trades/day, trade only the trending session window, square off by close.',
   params:[['Fast EMA','9'],['Slow EMA','21'],['Max trades/day','3']]},
  {id:'lib_supertrend',name:'Supertrend Follow',fam:'trend',risk:'Moderate',seg:'fno',best:'Bull',
   what:'Trails an ATR-based band; flips long/short as price closes through it.',
   rule:'Long when price closes above the Supertrend line; reverse/flat when it closes below.',
   works:'Clean trends with steady volatility, the band trails the move well.',
   fails:'Sharp volatility spikes flip it repeatedly (false reversals).',
   guard:'Use a longer ATR period in High-Vol; size down when VIX is elevated.',
   params:[['ATR period','10'],['Multiplier','3']]},
  {id:'lib_adx',name:'ADX Trend Filter',fam:'trend',risk:'Conservative',seg:'equity',best:'Bull',
   what:'Only trades when trend strength (ADX) confirms a real trend exists.',
   rule:'Take trend entries only when ADX > 25 and rising; otherwise stay flat.',
   works:'As a filter on top of any trend system, it cuts the worst chop trades.',
   fails:'Lags at trend births and ends; can keep you out of early moves.',
   guard:'Pair with a momentum trigger so you are not late; never trade ADX < 20.',
   params:[['ADX threshold','25'],['Lookback','14']]},
  {id:'lib_rsmom',name:'Relative-Strength Rotation',fam:'trend',risk:'Moderate',seg:'equity',best:'Bull',
   what:'Holds the strongest stocks in a universe, drops the laggards.',
   rule:'Rank a universe by 3–6 month return; hold the top decile, rebalance monthly.',
   works:'Trending broad markets where leadership persists.',
   fails:'Sharp reversals/crashes, last month’s winners fall hardest.',
   guard:'Add a market-trend filter (go to cash below the 200-DMA of the index).',
   params:[['Lookback','6mo'],['Top N','10'],['Rebalance','Monthly']]},
  // ---- Mean Reversion ----
  {id:'lib_rsi2',name:'RSI(2) Pullback',fam:'meanrev',risk:'Moderate',seg:'equity',best:'Bull',
   what:'Buys short, sharp dips inside an established uptrend.',
   rule:'In an uptrend (price > 200-DMA), buy when RSI(2) < 10; exit when RSI(2) > 70 or on a time stop.',
   works:'Uptrending markets that pull back and resume, high win rate.',
   fails:'Catches a falling knife if the uptrend has actually broken.',
   guard:'Never fade without the trend filter; hard time-stop so a loser can’t compound.',
   params:[['RSI period','2'],['Entry','<10'],['Exit','>70']]},
  {id:'lib_bollrev',name:'Bollinger Band Reversion',fam:'meanrev',risk:'Moderate',seg:'equity',best:'Choppy',
   what:'Fades touches of the outer band back toward the mean.',
   rule:'Buy a close below the lower band, exit at the middle band; mirror for shorts.',
   works:'Range-bound, mean-reverting names with stable volatility.',
   fails:'Trending breakouts, “cheap” keeps getting cheaper.',
   guard:'Skip when bands are expanding fast (volatility regime change); stop beyond the band.',
   params:[['Period','20'],['StdDev','2']]},
  {id:'lib_vwaprev',name:'VWAP Reversion',fam:'meanrev',risk:'Aggressive',seg:'index',best:'Choppy',
   what:'Intraday fade of price stretched far from VWAP back to it.',
   rule:'Fade when price is >N stdev from VWAP with no fresh news; target VWAP.',
   works:'Liquid intraday instruments on balanced, two-sided days.',
   fails:'Trend days, price rides far from VWAP and never returns.',
   guard:'Detect trend-day early (opening drive) and disable; tight per-trade stop.',
   params:[['Band','2σ'],['Target','VWAP']]},
  {id:'lib_gapfill',name:'Gap-Fill Fade',fam:'meanrev',risk:'Aggressive',seg:'equity',best:'Choppy',
   what:'Fades an overnight gap betting it fills toward the prior close.',
   rule:'On a moderate gap with no catalyst, fade toward the prior close; stop beyond the gap extreme.',
   works:'Emotion-driven gaps with no real news behind them.',
   fails:'News/results gaps that run, fading those is how accounts blow up.',
   guard:'Never fade an earnings/news gap; cap gap size; hard stop at the day extreme.',
   params:[['Max gap','2%'],['Stop','Day extreme']]},
  // ---- Breakout / Volatility ----
  {id:'lib_orb',name:'Opening Range Breakout',fam:'breakout',risk:'Aggressive',seg:'index',best:'High-Vol',
   what:'Trades a break of the first 15–30 min range of the day.',
   rule:'Mark the first 15-min high/low; go with a breakout on volume; stop at the opposite end.',
   works:'High-volatility opens and trending days.',
   fails:'Quiet, rangebound days produce repeated false breaks.',
   guard:'Require a volume/ATR expansion to confirm; one re-entry max; square off intraday.',
   params:[['Range','First 15m'],['Confirm','Volume>avg']]},
  {id:'lib_donchian',name:'20-Day High Breakout',fam:'breakout',risk:'Moderate',seg:'equity',best:'Bull',
   what:'The classic Turtle breakout, buy new highs, ride the trend.',
   rule:'Buy a close above the 20-day high; trail with the 10-day low; exit on the trail.',
   works:'Strong, persistent trends and momentum regimes.',
   fails:'Whipsaws at range edges in sideways markets.',
   guard:'ATR position sizing so each trade risks a fixed small % of capital.',
   params:[['Entry','20-day high'],['Exit trail','10-day low']]},
  {id:'lib_nr7',name:'NR7 / Inside-Bar Breakout',fam:'breakout',risk:'Moderate',seg:'equity',best:'High-Vol',
   what:'Trades expansion out of the narrowest-range bar (a coiled spring).',
   rule:'After an NR7 / inside bar, enter on a break of its range in the trend direction.',
   works:'Post-consolidation volatility expansion.',
   fails:'Failed breaks reverse straight through the other side.',
   guard:'Trade only in the higher-timeframe trend direction; stop at the bar’s other extreme.',
   params:[['Pattern','NR7'],['Filter','HTF trend']]},
  {id:'lib_vcp',name:'Volatility Contraction',fam:'breakout',risk:'Moderate',seg:'equity',best:'Bull',
   what:'Buys breakouts from tightening bases (contracting volatility).',
   rule:'Identify successively tighter pullbacks on declining volume; buy the pivot breakout.',
   works:'Leading stocks in bull markets forming clean bases.',
   fails:'Late-stage bases and bear markets, most breakouts fail.',
   guard:'Tight stop under the pivot; only in confirmed uptrends.',
   params:[['Base','Tightening'],['Stop','Under pivot']]},
  // ---- Time / Calendar ----
  {id:'lib_920',name:'9:20 ORB (time entry)',fam:'time',risk:'Aggressive',seg:'options',best:'High-Vol',
   what:'A fixed-time entry just after the open captures the day’s initial drive.',
   rule:'At 9:20, enter in the direction of the opening 5-min candle; SL at its low/high.',
   works:'Days with a strong directional open.',
   fails:'Flat opens reverse and stop you out fast.',
   guard:'Predefined SL/target, one shot per day, hard square-off time.',
   params:[['Entry','09:20'],['Square-off','15:15']]},
  {id:'lib_eodsq',name:'Intraday Auto Square-off',fam:'time',risk:'Conservative',seg:'any',best:'Any',
   what:'A discipline overlay, flatten everything before the close, no overnight risk.',
   rule:'Force-exit all intraday positions at a set time (e.g. 15:15) regardless of P&L.',
   works:'Every intraday strategy, removes gap risk and emotional holding.',
   fails:'Can exit a winner early; that is the price of zero overnight risk.',
   guard:'This IS the guard, pair with any intraday system.',
   params:[['Square-off','15:15']]},
  {id:'lib_btst',name:'BTST Momentum',fam:'time',risk:'Aggressive',seg:'equity',best:'Bull',
   what:'Buy strong-closing stocks today, sell tomorrow on follow-through.',
   rule:'Buy names closing at day highs on volume; exit next morning on strength or a stop.',
   works:'Strong-trend markets with overnight continuation.',
   fails:'Overnight gap-downs on negative global cues, full overnight risk.',
   guard:'Small size; avoid event nights; predefined gap-down exit.',
   params:[['Hold','1 night'],['Exit','Next open']]},
  {id:'lib_expiry',name:'Expiry-Day Theta',fam:'time',risk:'Aggressive',seg:'options',best:'Choppy',
   what:'Sells options on expiry day to harvest the fastest time decay.',
   rule:'Sell ATM/OTM options near the open on expiry; manage with a stop-loss on premium.',
   works:'Pinned, low-movement expiry sessions.',
   fails:'A trending expiry day, short options can lose multiples of the credit fast.',
   guard:'Hard premium SL, defined-risk spreads not naked, size for the worst case.',
   params:[['Day','Expiry'],['Stop','2× credit']]},
  {id:'lib_dow',name:'Day-of-Week / Seasonality',fam:'time',risk:'Conservative',seg:'index',best:'Any',
   what:'Exploits recurring calendar tendencies (e.g. monthly expiry, turn-of-month).',
   rule:'Take positions only on statistically favourable calendar days from backtests.',
   works:'When a seasonal edge is statistically robust out-of-sample.',
   fails:'Overfitting, many “seasonal” edges are noise that vanish live.',
   guard:'Demand a large sample + OOS proof before trusting; tiny size.',
   params:[['Edge','Calendar'],['Proof','OOS required']]},
  // ---- Stat-Arb / Pairs ----
  {id:'lib_pairs',name:'Pairs Trading',fam:'statarb',risk:'Moderate',seg:'equity',best:'Choppy',
   what:'Long one stock, short a correlated one when their spread stretches.',
   rule:'When the spread z-score > 2, short the rich / long the cheap; exit at mean reversion.',
   works:'Stable, cointegrated pairs in range-bound markets, market-neutral.',
   fails:'When the relationship breaks (a fundamental change in one name).',
   guard:'Re-test cointegration regularly; stop if the spread keeps diverging.',
   params:[['Entry','z>2'],['Exit','z→0']]},
  {id:'lib_ratio',name:'Ratio / Spread Trade',fam:'statarb',risk:'Moderate',seg:'fno',best:'Choppy',
   what:'Trades the ratio between two related futures (e.g. sector pair).',
   rule:'Mean-revert the historical ratio band between two related contracts.',
   works:'Structurally linked instruments with a stable ratio.',
   fails:'Regime shifts that permanently re-rate one leg.',
   guard:'Hard spread stop; cap leverage, spreads still blow out.',
   params:[['Band','Historical'],['Hedge','β-weighted']]},
  {id:'lib_idxarb',name:'Index Arbitrage',fam:'statarb',risk:'Conservative',seg:'index',best:'Any',
   what:'Captures mispricing between an index and its futures/constituents.',
   rule:'When futures deviate from fair value beyond costs, trade the convergence.',
   works:'High-liquidity, low-cost execution environments.',
   fails:'Costs/slippage eat the tiny edge; needs fast execution.',
   guard:'Only when net of all costs is clearly positive; automate execution.',
   params:[['Edge','Basis'],['Need','Low latency']]},
  // ---- Event-Driven ----
  {id:'lib_earnings',name:'Earnings Drift',fam:'event',risk:'Aggressive',seg:'equity',best:'Any',
   what:'Rides the post-results drift after a strong earnings surprise.',
   rule:'After a big beat + gap on volume, enter on the day-1 close; trail the move.',
   works:'Clear, high-quality surprises with institutional follow-through.',
   fails:'“Buy the rumour, sell the news” fades; gaps that reverse.',
   guard:'Wait for confirmation (no pre-results bet); stop under the results-day low.',
   params:[['Trigger','Beat+gap'],['Stop','Day-1 low']]},
  {id:'lib_rebal',name:'Index Rebalance',fam:'event',risk:'Moderate',seg:'equity',best:'Any',
   what:'Front-runs forced index-fund buying/selling on add/drop announcements.',
   rule:'Buy confirmed index additions / sell deletions ahead of the effective date.',
   works:'Large, predictable passive flows around rebalance dates.',
   fails:'Crowded trade, much of the move is already priced in.',
   guard:'Enter early on the announcement, exit into the rebalance-day flow.',
   params:[['Trigger','Add/Drop'],['Exit','Effective date']]},
  {id:'lib_news',name:'News-Catalyst Momentum',fam:'event',risk:'Aggressive',seg:'equity',best:'High-Vol',
   what:'Trades the immediate momentum from a material news catalyst.',
   rule:'On confirmed material news + volume surge, trade the initial direction with a tight stop.',
   works:'Genuine, high-impact catalysts with volume confirmation.',
   fails:'Stale/priced-in news and fake-outs; spreads widen on the spike.',
   guard:'Volume + price confirmation before entry; very tight stop; small size.',
   params:[['Trigger','News+vol'],['Stop','Tight']]},
  // ---- Sentiment / OI / Flow ----
  {id:'lib_oibuildup',name:'OI Buildup',fam:'sentiment',risk:'Moderate',seg:'fno',best:'Bull',
   what:'Reads price + open-interest together to classify long/short buildup.',
   rule:'Price up + OI up = long buildup (go with it); price up + OI down = short covering (fade carefully).',
   works:'Confirming a directional move with real positioning.',
   fails:'OI lags; can mislead near expiry when positions roll.',
   guard:'Combine with price action, not alone; avoid the last expiry hours.',
   params:[['Inputs','Price+OI'],['Avoid','Expiry close']]},
  {id:'lib_pcr',name:'PCR Contrarian',fam:'sentiment',risk:'Moderate',seg:'options',best:'Choppy',
   what:'Uses the put-call ratio as a contrarian sentiment extreme gauge.',
   rule:'Very high PCR (excess fear) = look for longs; very low PCR (greed) = caution/shorts.',
   works:'Sentiment extremes that mark short-term turning points.',
   fails:'In strong trends sentiment stays extreme far longer than you can stay solvent.',
   guard:'Need a price-confirmation trigger; never fade a trend on PCR alone.',
   params:[['High PCR','>1.3'],['Low PCR','<0.7']]},
  {id:'lib_maxpain',name:'Max-Pain Pin',fam:'sentiment',risk:'Aggressive',seg:'options',best:'Choppy',
   what:'Bets price gravitates to the max-pain strike into expiry.',
   rule:'Sell defined-risk premium around the max-pain strike as expiry approaches.',
   works:'Low-event, range-bound expiries where pinning tends to occur.',
   fails:'Trending expiries ignore max-pain entirely.',
   guard:'Defined-risk only; exit if price trends away from the pin.',
   params:[['Anchor','Max-pain'],['Risk','Defined']]},
  {id:'lib_fiiflow',name:'FII/DII Flow Follow',fam:'sentiment',risk:'Conservative',seg:'index',best:'Bull',
   what:'Tilts with sustained institutional buying/selling pressure.',
   rule:'Bias long on persistent net FII+DII inflows; reduce on sustained outflows.',
   works:'As a slow regime/bias filter, not a precise timing signal.',
   fails:'Flows are reported with a lag and are noisy day to day.',
   guard:'Use as a bias overlay only; pair with a price trigger for timing.',
   params:[['Input','Net flows'],['Use','Bias filter']]},
  // ---- Factor / Rotation ----
  {id:'lib_sectorrot',name:'Sector Rotation',fam:'factor',risk:'Moderate',seg:'equity',best:'Bull',
   what:'Rotates capital into the strongest sectors, out of the weakest.',
   rule:'Rank sectors by relative strength; overweight leaders, underweight laggards; rebalance monthly.',
   works:'Markets with clear sector leadership cycles.',
   fails:'Rapid rotations and reversals whipsaw the basket.',
   guard:'Hold a diversified set; cap single-sector weight; trend filter on the index.',
   params:[['Rank','Rel-strength'],['Rebalance','Monthly']]},
  {id:'lib_mompf',name:'Momentum Factor Portfolio',fam:'factor',risk:'Moderate',seg:'equity',best:'Bull',
   what:'Systematic long basket of the highest-momentum names.',
   rule:'Hold top-momentum decile, equal-weight, monthly rebalance, market-trend filter.',
   works:'Persistent bull trends, momentum is a durable long-run factor.',
   fails:'Momentum crashes at sharp market turns.',
   guard:'De-risk to cash below the index 200-DMA; cap volatility per name.',
   params:[['Factor','12-1 mom'],['Filter','Index 200-DMA']]},
  {id:'lib_lowvol',name:'Low-Volatility Factor',fam:'factor',risk:'Conservative',seg:'equity',best:'Bear',
   what:'Holds the lowest-volatility names for smoother, defensive returns.',
   rule:'Rank universe by realised volatility; hold the lowest-vol basket, rebalance quarterly.',
   works:'Choppy/bear markets, it draws down far less.',
   fails:'Lags badly in roaring bull markets.',
   guard:'Use as the defensive sleeve; combine with momentum for balance.',
   params:[['Factor','Low vol'],['Rebalance','Quarterly']]},
  {id:'lib_quality',name:'Quality / Value Tilt',fam:'factor',risk:'Conservative',seg:'equity',best:'Any',
   what:'Owns financially strong, reasonably-priced companies for the long run.',
   rule:'Screen for high ROE/low debt + sensible valuation; hold long-term, rebalance yearly.',
   works:'Long horizons, quality compounds and survives downturns.',
   fails:'Can underperform for long stretches when junk rallies.',
   guard:'Diversify; this is a survive-and-compound sleeve, not a trade.',
   params:[['Screen','ROE/Debt/Val'],['Horizon','Years']]},
  // ---- ML / Regime ----
  {id:'lib_regimeswitch',name:'Regime-Switching Meta',fam:'ml',risk:'Moderate',seg:'index',best:'Any',
   what:'A meta-strategy that turns sub-strategies on/off by the live regime.',
   rule:'Detect regime (trend/chop/high-vol); run only the sub-strategy validated for that regime.',
   works:'Across full market cycles, it stands aside when nothing fits.',
   fails:'Regime detection lags at turning points; transitions are costly.',
   guard:'This is the survival engine, when uncertain, it goes to cash.',
   params:[['Detector','VIX+breadth+trend'],['Default','Stand aside']]},
  {id:'lib_mlsignal',name:'ML Predictive Signal',fam:'ml',risk:'Aggressive',seg:'equity',best:'Any',
   what:'A trained model outputs a directional probability used to size trades.',
   rule:'Enter when model confidence clears a threshold; size proportional to confidence.',
   works:'When the model has a genuine, walk-forward-validated edge.',
   fails:'Overfitting and regime drift, the model decays as markets change.',
   guard:'Strict walk-forward validation, live monitoring, kill-switch on decay.',
   params:[['Validation','Walk-forward'],['Sizing','Confidence']]},
  // ---- Options · Directional ----
  {id:'lib_longopt',name:'Directional Long Option',fam:'opt_dir',risk:'Aggressive',seg:'options',best:'High-Vol',
   what:'Buy a call or put for a leveraged, limited-risk directional bet.',
   rule:'Buy ATM/ITM option in your direction; risk is capped at the premium paid.',
   works:'Strong, fast directional moves where the move beats time decay.',
   fails:'Time decay + falling IV bleed the premium even if you are “right” slowly.',
   guard:'Size so total premium at risk is tiny; avoid buying into high IV.',
   params:[['Strike','ATM/ITM'],['Risk','Premium only']]},
  {id:'lib_debit',name:'Vertical Debit Spread',fam:'opt_dir',risk:'Moderate',seg:'options',best:'Bull',
   what:'Directional bet with lower cost and lower time-decay drag than a naked long.',
   rule:'Buy a near option, sell a further one in the same direction; defined risk & reward.',
   works:'Moderate directional moves, cheaper and less IV-sensitive.',
   fails:'Capped upside; still loses if the move doesn’t come.',
   guard:'Risk = net debit, known up front; pick expiries with room for the move.',
   params:[['Structure','Buy+Sell'],['Risk','Net debit']]},
  // ---- Options · Income ----
  {id:'lib_strangle',name:'Short Strangle',fam:'opt_income',risk:'Aggressive',seg:'options',best:'Choppy',
   what:'Sell an OTM call and put to collect premium when price stays in a range.',
   rule:'Sell OTM call + put; profit if price stays between strikes through expiry.',
   works:'Range-bound, falling-volatility markets.',
   fails:'A big move on either side, losses are theoretically unlimited if naked.',
   guard:'Prefer the defined-risk Iron Condor; hard SL on premium; never naked + unhedged.',
   params:[['Strikes','OTM C+P'],['Defend','SL on premium']]},
  {id:'lib_condor',name:'Iron Condor',fam:'opt_income',risk:'Moderate',seg:'options',best:'Choppy',
   what:'A defined-risk strangle, sells a range, buys wings to cap the tails.',
   rule:'Sell an OTM call & put spread; max loss is capped by the long wings.',
   works:'Range-bound markets with elevated IV to sell into.',
   fails:'Trending/break-out moves push price through a short strike.',
   guard:'Known max loss by design; adjust/roll the tested side; size to survive max loss.',
   params:[['Wings','Long OTM'],['Risk','Defined']]},
  {id:'lib_credit',name:'Credit Spread',fam:'opt_income',risk:'Moderate',seg:'options',best:'Bull',
   what:'A one-sided defined-risk premium sell with a directional lean.',
   rule:'Sell a put spread (bullish) or call spread (bearish); collect net credit.',
   works:'When you have a directional bias and want a high-probability income trade.',
   fails:'A move against you to the short strike realises the (capped) max loss.',
   guard:'Risk = spread width − credit, fixed; close at a set loss multiple.',
   params:[['Lean','Put/Call'],['Risk','Width−credit']]},
  {id:'lib_coveredcall',name:'Covered Call',fam:'opt_income',risk:'Conservative',seg:'options',best:'Choppy',
   what:'Sell calls against stock you own to earn income on flat-to-mild-up moves.',
   rule:'Hold the stock, sell an OTM call each cycle; keep the premium if unexercised.',
   works:'Sideways-to-slightly-up markets on holdings you already own.',
   fails:'Caps your upside if the stock rallies hard; no downside protection.',
   guard:'Only on stock you’re happy to sell at the strike; income, not protection.',
   params:[['Need','Own stock'],['Strike','OTM call']]},
  // ---- Options · Volatility / Neutral ----
  {id:'lib_straddle',name:'Long Straddle',fam:'opt_vol',risk:'Aggressive',seg:'options',best:'High-Vol',
   what:'Buy a call AND a put, profits from a big move either direction.',
   rule:'Buy ATM call + put before an expected volatility event; profit on a large move.',
   works:'Pre-event when a large move is likely and IV is still cheap.',
   fails:'IV crush after the event + a small move, both legs bleed.',
   guard:'Enter before IV ramps; exit fast post-event; cap premium at risk.',
   params:[['Strikes','ATM C+P'],['Edge','Cheap IV']]},
  {id:'lib_calendar',name:'Calendar Spread',fam:'opt_vol',risk:'Moderate',seg:'options',best:'Choppy',
   what:'Sell a near-dated option, buy a far-dated one, harvest faster near-term decay.',
   rule:'Same strike, sell front expiry / buy back expiry; profit from differential theta.',
   works:'Stable price near the strike with a favourable term structure.',
   fails:'A large directional move away from the strike hurts both legs.',
   guard:'Defined-ish risk; manage if price leaves the strike zone.',
   params:[['Legs','Sell front/Buy back'],['Edge','Theta diff']]},
  {id:'lib_deltaneutral',name:'Delta-Neutral Theta',fam:'opt_vol',risk:'Moderate',seg:'options',best:'Choppy',
   what:'Hold a net-zero-delta option book and earn time decay, re-hedging as it drifts.',
   rule:'Sell premium, keep delta near zero by adjusting hedges as price moves.',
   works:'Range-bound, mean-reverting volatility with active management.',
   fails:'Gamma risk, fast moves force costly re-hedging (negative gamma bleed).',
   guard:'Continuous monitoring + adjustment; cap gamma exposure; size small.',
   params:[['Target','Δ≈0'],['Risk','Gamma']]},
  // ---- Cash-Futures / Arb ----
  {id:'lib_cashfut',name:'Cash-Futures Basis',fam:'arb',risk:'Conservative',seg:'fno',best:'Any',
   what:'Lock the spread between a stock’s cash price and its future.',
   rule:'When the future trades at a premium beyond carry, sell future / buy cash; converge at expiry.',
   works:'Liquid names with a clear, cost-positive basis.',
   fails:'Thin liquidity & costs erase the edge; needs capital for both legs.',
   guard:'Only when net-of-cost positive; hold to convergence.',
   params:[['Legs','Cash vs Future'],['Exit','Expiry']]},
  {id:'lib_calroll',name:'Calendar Roll Spread',fam:'arb',risk:'Conservative',seg:'fno',best:'Any',
   what:'Trade the spread between near and far expiries of the same future.',
   rule:'Take the roll spread when it deviates from its typical band; revert as expiry nears.',
   works:'Stable term structures with predictable roll behaviour.',
   fails:'Demand/supply shocks distort the curve unexpectedly.',
   guard:'Spread stop; modest leverage; close before the near expiry.',
   params:[['Legs','Near vs Far'],['Edge','Roll band']]},
];
const LIB_RISK_CLASS={Conservative:'b-up',Moderate:'b-neu',Aggressive:'b-warn'};

/* ============================================================
   CRYPTO MARKET LAYER: the Algo Studio can scope to Indian (Kite)
   or Crypto (Binance). REAL prices only, no fake fallback: Binance's
   public data mirror (no API key, read-only). Strategy EXECUTION is
   preview/paper, honestly flagged. Real crypto orders would route via
   the Binance Algo API (TWAP/POV), which needs server-side key signing
  , that's the roadmap engine, never the browser.
   ============================================================ */
const CRYPTO_API='https://data-api.binance.vision';   // public market-data mirror: CORS-ok, not geo-fenced, no key
const CRYPTO_UNIVERSE=[
  {sym:'BTCUSDT',tk:'BTC',name:'Bitcoin'},   {sym:'ETHUSDT',tk:'ETH',name:'Ethereum'},
  {sym:'SOLUSDT',tk:'SOL',name:'Solana'},    {sym:'BNBUSDT',tk:'BNB',name:'BNB'},
  {sym:'XRPUSDT',tk:'XRP',name:'XRP'},       {sym:'ADAUSDT',tk:'ADA',name:'Cardano'},
  {sym:'DOGEUSDT',tk:'DOGE',name:'Dogecoin'},{sym:'AVAXUSDT',tk:'AVAX',name:'Avalanche'},
  {sym:'LINKUSDT',tk:'LINK',name:'Chainlink'},{sym:'MATICUSDT',tk:'MATIC',name:'Polygon'},
];
const CRYPTO={loaded:false,live:false,error:false,quotes:{},t:0,busy:false};
function cryptoSyms(){ return CRYPTO_UNIVERSE.map(c=>c.sym); }
// Risk-first strategy TEMPLATES (educational, preview/paper), same survival-first ethos as the live library.
// wired: true only for bids the cloud worker actually runs (mirrors studio.js's DEPLOYABLE set
// for the crypto/customer path - keep the two in sync). The rest render normally but are honest
// about not having a live engine yet, instead of the old permanently-stuck "Engine loading" toast.
const CRYPTO_STRATEGIES=[
  {id:'cx_btc_trend',bid:'macross',name:'BTC Trend (MA200)',cat:'Trend',risk:'Moderate',pair:'BTCUSDT',wired:true,
   what:'Long BTC while it holds above its long-term moving average; flat below.',
   rule:'BUY when price closes above the 200-period MA; exit on a close back below.',
   works:'Strong, sustained bull legs, crypto trends long and hard.',
   fails:'Chop around the MA whipsaws you in and out at small losses repeatedly.',
   guard:'Only long above the MA; ATR-sized stop; one position; stand aside in chop.'},
  {id:'cx_grid',bid:'bollinger',name:'Range Grid (ETH)',cat:'Mean-Reversion',risk:'Aggressive',pair:'ETHUSDT',wired:true,
   what:'A ladder of staggered buys & sells across a defined band, harvesting oscillation.',
   rule:'Buy each rung down, sell each rung up within a set price band.',
   works:'Sideways, high-volatility ranges, it monetises the wiggle.',
   fails:'A clean breakout leaves you holding the whole ladder against the move.',
   guard:'Hard band-exit if price leaves the range; cap total grid exposure & leverage.'},
  {id:'cx_funding',bid:'perp_funding',name:'Funding-Rate Carry',cat:'Income',risk:'Moderate',pair:'BTC spot vs perp',
   what:'Delta-neutral: long spot, short perpetual, collect funding each interval.',
   rule:'When funding is positive, hold spot + short perp; pocket the funding payments.',
   works:'Calm, positive-funding regimes, steady market-neutral yield.',
   fails:'Funding flips negative or the basis blows out in a liquidation cascade.',
   guard:'Watch funding + basis; unwind on negative funding; respect exchange limits.'},
  {id:'cx_rsi2',bid:'rsi2',name:'RSI-2 Dip (Alts)',cat:'Mean-Reversion',risk:'Aggressive',pair:'SOLUSDT',wired:true,
   what:'Buys very short-term oversold dips inside a higher-timeframe uptrend.',
   rule:'In an uptrend, BUY when RSI(2) < 5; exit when RSI(2) > 70 or after N bars.',
   works:'Pullbacks within an established alt uptrend.',
   fails:'Catching a falling knife once the trend has actually broken.',
   guard:'Only above the 200-MA; time-stop + hard stop; small size on alts.'},
  {id:'cx_breakout',bid:'momentum',name:'Volatility Breakout',cat:'Breakout',risk:'Aggressive',pair:'BTCUSDT',wired:true,
   what:'Enters as price escapes a tight range on expanding volume.',
   rule:'BUY on a close above the N-day high with above-average volume; trail a stop.',
   works:'The start of a fresh expansion leg after compression.',
   fails:'False breakouts in thin liquidity hours snap straight back.',
   guard:'Require volume confirmation; trade liquid majors; trail, don’t fix a target.'},
  {id:'cx_pairs',bid:'pairs',name:'ETH/BTC Ratio Pairs',cat:'Stat-Arb',risk:'Moderate',pair:'ETH vs BTC',
   what:'Trades the ETH/BTC ratio back to its mean, neutral to overall crypto beta.',
   rule:'Short the rich leg, long the cheap leg when the ratio z-score is stretched.',
   works:'When ETH & BTC stay cointegrated and the spread mean-reverts.',
   fails:'A narrative regime-shift breaks the relationship and the spread runs.',
   guard:'Z-score entry/exit bands; stop if the spread breaks its historical range.'},
  {id:'cx_dca',name:'Disciplined DCA',cat:'Time / Calendar',risk:'Conservative',pair:'BTCUSDT',
   what:'Cost-averages a fixed amount on a fixed schedule, accumulation, not timing.',
   rule:'Buy a fixed notional every interval regardless of price; optional dip boosts.',
   works:'Long-horizon accumulation through full cycles; removes timing risk.',
   fails:'Prolonged bear markets test conviction; capital sits in drawdown.',
   guard:'Only commit what you can hold for years; size the schedule to your cashflow.'},
  {id:'cx_momentum',bid:'xs_momentum',name:'Cross-Sectional Momentum',cat:'Factor / Rotation',risk:'Aggressive',pair:'Top-10 majors',
   what:'Rotates into the strongest recent performers across a basket of majors.',
   rule:'Each week, hold the top-N by trailing return; drop the laggards.',
   works:'Persistent momentum regimes where winners keep winning.',
   fails:'Sharp momentum crashes reverse and gut the whole basket at once.',
   guard:'Cap per-name weight; vol-target the basket; kill-switch on a drawdown limit.'},
  // These 5 were live on the worker (REGISTRY, featured:true - the same "proven net of costs" bar
  // as the cards above) with no customer-facing card at all until now. The other 8 REGISTRY entries
  // (orb, vwap_rev, vwap_mom, ema_scalp, bb_breakout, supertrend, vwap_pull, rsi_intraday) stay
  // deliberately uncarded: strategies.py's own comments mark them "non-featured until validated" or
  // "fail after costs so far" - surfacing those as Deploy-worthy would recommend strategies the
  // team's own testing found unprofitable, with no disclosure.
  {id:'cx_trendfollow',bid:'trend_follow',name:'Trend Rider (20/100)',cat:'Trend',risk:'Moderate',pair:'ETHUSDT',wired:true,
   what:'Longs a fresh 20-day high while price holds above its 100-day trend average, then rides the move with a trailing stop.',
   rule:'BUY when price makes a new 20-bar high AND price is above the 100-bar average; trail-stop exit, no fixed target.',
   works:'Sustained trends with room to run, a slower, wider-net breakout system.',
   fails:'Choppy, range-bound markets whipsaw the 20-bar high trigger with no follow-through.',
   guard:'ATR-sized trailing stop; only long above the 100-bar average; one position at a time.'},
  {id:'cx_emacross',bid:'ema_cross',name:'EMA Cross (20/50)',cat:'Trend',risk:'Moderate',pair:'BNBUSDT',wired:true,
   what:'A faster trend-follower than the 200-day golden cross, reacts to shifts in weeks, not months.',
   rule:'BUY when the 20-EMA crosses above the 50-EMA and price holds above the 50-EMA; exit on the cross back down.',
   works:'Medium-length trends where a 200-day filter reacts too slowly.',
   fails:'Sideways chop triggers repeated false crossovers, each one a small loss.',
   guard:'ATR stop; exits immediately on the EMA cross-down, no waiting for confirmation.'},
  {id:'cx_adxtrend',bid:'adx_trend',name:'ADX Trend Filter',cat:'Trend',risk:'Conservative',pair:'SOLUSDT',wired:true,
   what:'Only trades when the trend-strength indicator (ADX) confirms a real trend is underway, sits out everything else.',
   rule:'BUY when ADX ≥ 25, +DI leads -DI, and price is above its 50-bar average; exit when the trend fades (DI flips or ADX drops).',
   works:'Clean, strongly-trending markets, the ADX filter is built specifically to reject chop.',
   fails:'Regime transitions, where ADX confirms a trend just as it is about to end.',
   guard:'ADX floor before any entry; exits fast on trend fade, not just full reversal.'},
  {id:'cx_zscore',bid:'zscore',name:'Z-Score Snapback (10-bar)',cat:'Mean-Reversion',risk:'Aggressive',pair:'XRPUSDT',wired:true,
   what:'A faster, shallower dip-buyer than the Bollinger reversion card, reacts to smaller, quicker stretches.',
   rule:'BUY when price is 1.5+ standard deviations below its 10-bar average inside an uptrend; exit on reversion to the mean.',
   works:'Quick, sharp dips inside an established uptrend that snap back within days.',
   fails:'A real trend break, buying every shallow dip on the way down.',
   guard:'Only trades inside a 200-bar uptrend filter; ATR stop; exits on mean-reversion, not a fixed target.'},
  {id:'cx_nr7',bid:'nr7',name:'NR7 Coil Breakout',cat:'Breakout',risk:'Aggressive',pair:'BTCUSDT',wired:true,
   what:'Waits for the tightest daily range in 7 days, a coiled spring, then buys the break above it.',
   rule:'BUY on a close above the narrowest-7-day bar\'s high, only inside a 50-bar uptrend; exit below the trend average.',
   works:'The volatility contraction genuinely precedes an expansion move (a real breakout, not a fakeout).',
   fails:'A quiet coil that just stays quiet, or breaks and immediately reverses.',
   guard:'Uptrend filter before any entry; ATR stop; exits on a trend-average break, not just a stall.'},
];
async function loadCrypto(){
  if(CRYPTO.busy) return; CRYPTO.busy=true;
  const url=`${CRYPTO_API}/api/v3/ticker/24hr?symbols=${encodeURIComponent(JSON.stringify(cryptoSyms()))}`;
  try{
    const d=await fetch(url).then(r=>r.json());
    if(Array.isArray(d)){
      const q={}; d.forEach(t=>{ const ltp=parseFloat(t.lastPrice), chg=parseFloat(t.priceChangePercent);
        if(isFinite(ltp)) q[t.symbol]={ltp,chg:isFinite(chg)?chg:0}; });
      CRYPTO.quotes=q; CRYPTO.live=Object.keys(q).length>0; CRYPTO.error=!CRYPTO.live; CRYPTO.t=Date.now();
    } else { CRYPTO.live=false; CRYPTO.error=true; }
  }catch(e){ CRYPTO.live=false; CRYPTO.error=true; }
  CRYPTO.loaded=true; CRYPTO.busy=false;
}
function cryptoFmt(p){ if(!isFinite(p)) return '-'; const dec=p>=1?2:p>=0.01?4:6; return '$'+p.toLocaleString('en-US',{minimumFractionDigits:Math.min(dec,2),maximumFractionDigits:dec}); }
/* ---- Binance WebSocket: sub-second tape. Free public data mirror (data-stream.binance.vision: the wss
   twin of data-api, not geo-fenced, no key). One combined connection streams each coin's 24h ticker
   (~1/s per symbol) straight into CRYPTO.quotes → the tape ticks live. The 5s REST poll stays as an
   automatic fallback (only fires when the socket isn't delivering). ---- */
const CRYPTO_WS='wss://data-stream.binance.vision';
const CWS={ws:null,url:'',on:false,lastMsg:0,backoff:1000,reT:null,raf:0};
function cryptoWsUrl(){ return CRYPTO_WS+'/stream?streams='+CRYPTO_UNIVERSE.map(c=>c.sym.toLowerCase()+'@ticker').join('/'); }
// Coalesce DOM patches to one per animation frame (the universe pushes ~10 msgs/s combined).
function scheduleTapePatch(){ if(CWS.raf) return; CWS.raf=requestAnimationFrame(()=>{ CWS.raf=0;
  if(!(state.algo&&state.algo.market==='crypto')) return;
  patchCryptoTape();
  // also re-mark the crypto Monitor/Positions P&L sub-second (spot marked to WS price)
  if(typeof isAlgo==='function' && isAlgo() && (state.algo.view==='monitor'||state.algo.view==='positions')) patchCryptoMonitorLive();
}); }
// Sub-second P&L: re-mark SPOT open positions to the live WS price between the bot's 7s polls. Perps/options
// keep the bot's authoritative mark (funding / option-credit aren't a plain qty×spot). Patches in place.
function cxLiveOpen(s){
  if(((s&&s.instr)||'spot')!=='spot') return (s&&s.openPnl)||0;
  let open=0, marked=false;
  ((s&&s.positions)||[]).forEach(p=>{ const q=p.qty, e=p.entry, w=CRYPTO.quotes&&CRYPTO.quotes[p.sym];
    if(q!=null && e!=null && w && w.ltp!=null){ open+=q*(w.ltp-e); marked=true; }
    else if(p.unreal!=null){ open+=p.unreal; } });   // no WS quote for this coin → keep the bot mark
  return marked?open:((s&&s.openPnl)||0);
}
function patchCryptoMonitorLive(){
  const d=CRYPTOMON.data; if(!d||!d.strategies) return;
  const cur=(state.algo&&state.algo.cinstr)||'spot';
  const segTot={spot:0,perps:0,options:0}, segOpen={spot:0,perps:0,options:0};
  const rowMap={}; document.querySelectorAll('[data-cxrow]').forEach(r=>rowMap[r.getAttribute('data-cxrow')]=r);
  const setCls=(el,v)=>{ el.classList.remove('up','down'); const c=cls(v); if(c) el.classList.add(c); };
  d.strategies.forEach(s=>{
    const open=cxLiveOpen(s), total=((s.realisedPnl)||0)+open, instr=s.instr||'spot';
    segTot[instr]=(segTot[instr]||0)+total; segOpen[instr]=(segOpen[instr]||0)+open;
    const row=rowMap[s.id]; if(!row) return;
    // mon-card structure: patch the Net figure + the "R … · U …" sub in place (no re-render/flicker)
    const nb=row.querySelector('.cxm-net'); if(nb){ nb.textContent=cxMoney(total); setCls(nb,total); }
    const sub=row.querySelector('[data-cxsub]'); if(sub) sub.textContent=`R ${cxMoney(s.realisedPnl||0)} · U ${cxMoney(open)}`;
  });
  const setLive=(id,v)=>document.querySelectorAll('[data-live="'+id+'"]').forEach(el=>{ el.textContent=cxMoney(v); setCls(el,v); });
  setLive('cxClsPnl', segTot[cur]); setLive('cxUnreal', segOpen[cur]);
  ['spot','perps','options'].forEach(k=>document.querySelectorAll('[data-cxseg="'+k+'"]').forEach(el=>el.textContent=cxMoney(segTot[k])));
}
function connectCryptoWS(){
  if(typeof WebSocket==='undefined') return;
  if(!(state.algo&&state.algo.market==='crypto')) return;
  const url=cryptoWsUrl();
  if(CWS.ws && CWS.url===url && (CWS.ws.readyState===0||CWS.ws.readyState===1)) return;   // already connecting/open to this set
  disconnectCryptoWS();
  CWS.url=url;
  try{
    const ws=new WebSocket(url);
    ws.onopen=()=>{ CWS.on=true; CWS.backoff=1000; };
    ws.onmessage=ev=>{ try{ const d=JSON.parse(ev.data).data; if(d&&d.s){ const ltp=parseFloat(d.c), chg=parseFloat(d.P);
      if(isFinite(ltp)){ (CRYPTO.quotes||(CRYPTO.quotes={}))[d.s]={ltp,chg:isFinite(chg)?chg:0};
        CRYPTO.live=true; CRYPTO.error=false; CRYPTO.loaded=true; CRYPTO.t=Date.now(); CWS.lastMsg=Date.now(); scheduleTapePatch(); } } }catch(e){} };
    ws.onerror=()=>{ CWS.on=false; };
    ws.onclose=()=>{ CWS.on=false; CWS.ws=null; scheduleCryptoWSReconnect(); };   // Binance drops the socket every 24h → auto-reconnect
    CWS.ws=ws;
  }catch(e){ scheduleCryptoWSReconnect(); }
}
function disconnectCryptoWS(){ if(CWS.reT){clearTimeout(CWS.reT);CWS.reT=null;} if(CWS.ws){ try{CWS.ws.onclose=null;CWS.ws.close();}catch(e){} } CWS.ws=null; CWS.on=false; CWS.url=''; }
function scheduleCryptoWSReconnect(){
  if(!(state.algo&&state.algo.market==='crypto')||CWS.reT) return;
  const delay=Math.min(CWS.backoff,15000); CWS.backoff=Math.min(CWS.backoff*2,15000);
  CWS.reT=setTimeout(()=>{ CWS.reT=null; connectCryptoWS(); },delay);
}
// ---- crypto views ----
function cryptoStatusBar(){
  const live=CRYPTO.live, t=CRYPTO.t?new Date(CRYPTO.t).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):'';
  const cells=[
    `<div class="asb-cell"><span class="asb-l">Venue${infoI('Binance public market data (read-only, no API key). Real prices, never simulated.')}</span><span class="asb-v"><span class="live-dot ${live?'live':''}"></span>Binance</span></div>`,
    `<div class="asb-cell"><span class="asb-l">Data</span><span class="asb-v">${live?`● LIVE${t?` · ${t}`:''}`:(CRYPTO.error?'Unreachable, retrying':'Connecting…')}</span></div>`,
    `<div class="asb-cell"><span class="asb-l">Mode${infoI('Live 24/7 paper engine on real Binance data, simulated fills, no real crypto orders are placed. Live execution (Binance Algo API, server-signed) is on the roadmap.')}</span><span class="asb-v"><span class="mode-badge paper">PAPER · live</span></span></div>`,
    `<div class="asb-cell asb-grow"><span class="asb-l">Market</span><span class="asb-v">Crypto · USDT spot</span></div>`
  ].join('<span class="asb-div"></span>');
  return `<div class="algo-statusbar${live?'':' off'}">${cells}</div>`;
}
function cryptoPriceStrip(){
  const tiles=CRYPTO_UNIVERSE.map(c=>{ const q=CRYPTO.quotes[c.sym], ch=q?q.chg:null;
    return `<div class="cx-tile" data-cprice="${c.sym}">
      <div class="cx-tk"><b>${esc(c.tk)}</b><span>${esc(c.name)}</span></div>
      <div class="cx-px"><span class="cx-ltp num"${q?` data-raw="${q.ltp}"`:''}>${q?cryptoFmt(q.ltp):'-'}</span>
        <span class="cx-chg num ${cls(ch)}" data-cchg>${ch==null?'·':pct(ch)+' · 24h'}</span></div></div>`; }).join('');
  const note=CRYPTO.live?`<span class="cx-src live">● Live · Binance · 24h change</span>`
    :(CRYPTO.error?`<span class="cx-src off">Can’t reach Binance, retrying…</span>`:`<span class="cx-src off">Connecting to Binance…</span>`);
  return `<div class="cx-strip-wrap"><div class="cx-strip-head">${icon('spark',13)}<b>Live crypto prices</b>${note}</div><div class="cx-strip">${tiles}</div></div>`;
}
function patchCryptoPrices(){
  document.querySelectorAll('[data-cprice]').forEach(el=>{ const q=CRYPTO.quotes[el.dataset.cprice]; if(!q) return;
    const l=el.querySelector('.cx-ltp'), c=el.querySelector('[data-cchg]');
    if(l){ const txt=cryptoFmt(q.ltp); if(l.textContent!==txt){ const prev=parseFloat(l.dataset.raw); const dir=isFinite(prev)?Math.sign(q.ltp-prev):0;
      l.textContent=txt; l.dataset.raw=q.ltp; if(dir){ l.classList.remove('tick-up','tick-dn'); void l.offsetWidth; l.classList.add(dir>0?'tick-up':'tick-dn'); } } }
    if(c){ c.textContent=pct(q.chg)+' · 24h'; c.className='cx-chg num '+cls(q.chg); c.setAttribute('data-cchg',''); } });
  const note=document.querySelector('.cx-strip-head .cx-src');
  if(note){ note.className='cx-src '+(CRYPTO.live?'live':'off'); note.textContent=CRYPTO.live?'● Live · Binance · 24h change':(CRYPTO.error?'Can’t reach Binance, retrying…':'Connecting to Binance…'); }
}
function cryptoStratCard(s){
  const rk=LIB_RISK_CLASS[s.risk]||'b-neu';
  // BUG FIX (2026-09-09): this used to read ALGOS (the shared, unscoped /api/strategies payload -
  // same platform-wide data every user sees, unrelated to their own deploy/stop actions) instead of
  // CRYPTOMON's per-user overlay. That's why Stop showed a success toast and the card still said
  // "running" right after - the badge was never looking at this user's own state to begin with.
  // Crypto deployment status is running|stopped only (no distinct "paused" in the deployment table).
  const m=s.bid?((CRYPTOMON.data&&CRYPTOMON.data.strategies)||[]).find(x=>x.id===s.bid):null;
  const dep=!!(m&&m.deployed), paused=false;
  let cta;
  if(!s.bid) cta=`<span class="cx-tag">Learn only</span>`;
  else if(!s.wired) cta=`<span class="cx-tag">Backtest only</span>`;
  else if(dep||paused) cta=`<span class="cx-tag live">${paused?'Paused':'Paper · running'}</span><button class="btn-ghost sm" data-cxdep="${esc(s.bid)}">${paused?'Resume':'Stop'}</button>`;
  else cta=`<button class="btn-primary sm" data-cxdep="${esc(s.bid)}">${icon('bolt',12)} Deploy in Paper</button>`;
  return `<div class="cx-card">
    <div class="cx-card-h"><div><b>${esc(s.name)}</b><span class="cx-cat">${esc(s.cat)} · ${esc(s.pair)}</span></div><span class="badge ${rk}">${esc(s.risk)}</span></div>
    <p class="cx-what">${esc(s.what)}</p>
    <div class="cx-line cx-rule">${icon('bolt',11)}<span><b>Rule.</b> ${esc(s.rule)}</span></div>
    <div class="cx-line cx-works">${icon('check',11)}<span><b>Works.</b> ${esc(s.works)}</span></div>
    <div class="cx-line cx-fails">${icon('alert',11)}<span><b>Fails.</b> ${esc(s.fails)}</span></div>
    <div class="cx-line cx-guard">${icon('shield',11)}<span><b>Survival guard.</b> ${esc(s.guard)}</span></div>
    <div class="cx-card-f">${cta}</div></div>`;
}
function cryptoMarket(){
  // Library cards need this user's own running/stopped state (cryptoStratCard reads CRYPTOMON.data) -
  // load it even if the user opens Library before ever visiting Monitor.
  if(!CRYPTOMON.loaded&&!CRYPTOMON.busy) loadCryptoMonitor().then(()=>{ if(isAlgo()&&state.algo.market==='crypto'&&state.algo.view==='library') renderAlgo(); });
  // Honest framing: the crypto paper engine IS live 24/7 (not "preview/roadmap"), real Binance prices,
  // simulated fills, no real orders. Live execution unlocks per strategy once proven + connected + armed.
  const note=`<div class="cx-preview-note">${icon('shield',13)}<span><b>Live crypto paper book, 24/7.</b> Prices are <b>real</b> (Binance), fills are <b>simulated</b>: <b>no real orders are placed</b>. These strategies run continuously in paper; watch them live on <b>Monitor</b>. Live execution unlocks <i>per strategy</i> only once it clears the Go-Live bar, you connect Binance, and arm ALLOW_LIVE.</span></div>`;
  const stat=secStats([
    {l:'Instruments',v:String(CRYPTO_UNIVERSE.length),s:'USDT majors'},
    {l:'Strategies',v:String(CRYPTO_STRATEGIES.length),s:'running in paper'},
    {l:'Data',v:CRYPTO.live?'Live':'-',s:CRYPTO.live?'real · Binance':'connecting',tone:CRYPTO.live?'up':''},
    {l:'Execution',v:'Paper',s:'live: locked until proven'},
  ]);
  const cats=['all',...Array.from(new Set(CRYPTO_STRATEGIES.map(s=>s.cat)))];
  const sel=(state.algo&&state.algo.cxLibCat)||'all';
  const shown=sel==='all'?CRYPTO_STRATEGIES:CRYPTO_STRATEGIES.filter(s=>s.cat===sel);
  const filters=`<div class="mon-ctrl"><div class="mon-seg"><span class="msc-lead">Family</span>${cats.map(c=>`<button class="msc-chip${sel===c?' on':''}" data-cxlibcat="${esc(c)}">${c==='all'?'All':esc(c)}</button>`).join('')}<span class="msc-count">${shown.length} of ${CRYPTO_STRATEGIES.length}</span></div></div>`;
  const grid=shown.length?`<div class="cx-grid">${shown.map(cryptoStratCard).join('')}</div>`:secEmpty('search','No strategies in this family','Pick another family or <button class="mon-clearfilt" data-cxlibcat="all">show all</button>.');
  return note+stat+filters+grid;
}
function cryptoSoon(label){
  return secEmpty('cpu',label+' · crypto',
    `${esc(label)} runs on the live 24/7 crypto paper harness. Start the engine from <b>Monitor</b> or deploy a strategy from <b>Library</b>.`);
}
// Real 24h movers from the live Binance data, honest momentum snapshot, not a scored signal.
function cryptoOpportunity(){
  if(!CRYPTO.live) return secEmpty('cpu','Scanning crypto…','Pulling live 24h moves from Binance. If this persists, the public data API may be unreachable from your network.');
  // relative leaders/laggards (top & bottom of the same sorted set), never an empty column, even on an all-red day
  const m=CRYPTO_UNIVERSE.map(c=>({...c,q:CRYPTO.quotes[c.sym]})).filter(r=>r.q).sort((a,b)=>b.q.chg-a.q.chg);
  const n=Math.min(5,Math.ceil(m.length/2)), lead=m.slice(0,n), lag=m.slice(-n).reverse();
  const row=r=>`<div class="cx-mv-row"><div class="cx-mv-tk"><b>${esc(r.tk)}</b><span>${esc(r.name)}</span></div><span class="cx-mv-px num">${cryptoFmt(r.q.ltp)}</span><span class="cx-mv-chg num ${cls(r.q.chg)}">${pct(r.q.chg)}</span></div>`;
  const col=(title,arr,ic)=>`<div class="cx-mv-col"><div class="cx-mv-h">${icon(ic,12)} ${title}</div>${arr.map(row).join('')||'<div class="cx-mv-empty">—</div>'}</div>`;
  const note=`<div class="cx-preview-note">${icon('shield',13)}<span><b>Honest scan.</b> These are <b>real 24h moves</b> from Binance, relative leaders vs laggards, a momentum snapshot and <b>not a validated signal</b>. The explainable, scored crypto opportunity engine arrives with the strategy engine; nothing is traded.</span></div>`;
  return note+`<div class="cx-movers">${col('Leaders · 24h',lead,'trendUp')}${col('Laggards · 24h',lag,'alert')}</div>`;
}
// Templates grouped by family: no fabricated track record; real ranking unlocks with the engine.
function cryptoLeaderboard(){
  const note=`<div class="cx-preview-note">${icon('shield',13)}<span><b>No fabricated track record.</b> Crypto strategies are templates, there's no live performance to rank yet, so we won't invent one. They're grouped by family below; a real, forward-tested leaderboard unlocks with the crypto paper engine.</span></div>`;
  const byCat={}; CRYPTO_STRATEGIES.forEach(s=>{(byCat[s.cat]=byCat[s.cat]||[]).push(s);});
  const groups=Object.keys(byCat).map(cat=>`<div class="cx-lb-grp"><div class="cx-lb-h">${esc(cat)} <i>${byCat[cat].length}</i></div>${byCat[cat].map(s=>`<div class="cx-lb-row"><b>${esc(s.name)}</b><span class="cx-cat">${esc(s.pair)}</span><span class="badge ${LIB_RISK_CLASS[s.risk]||'b-neu'}">${esc(s.risk)}</span></div>`).join('')}</div>`).join('');
  return note+`<div class="cx-lb">${groups}</div>`;
}
// ---- LIVE crypto paper book (24/7 harness on :8756 → /api/crypto/monitor) ----
const CRYPTOMON={loaded:false,busy:false,data:null,err:false,t:0};
async function loadCryptoMonitor(){
  if(CRYPTOMON.busy) return; CRYPTOMON.busy=true;
  try{
    const d=await fetch(`${BOT_API}/api/crypto/monitor`).then(r=>r.json());
    CRYPTOMON.data=d; CRYPTOMON.err=false; CRYPTOMON.t=Date.now();
  }catch(e){ CRYPTOMON.err=true; }
  CRYPTOMON.loaded=true; CRYPTOMON.busy=false;
}
function cxMoney(v){ if(v==null||!isFinite(v)) return '-'; const s=v<0?'−':(v>0?'+':''); return s+'$'+Math.abs(v).toLocaleString('en-US',{maximumFractionDigits:0}); }
function cxActive(){ const d=CRYPTOMON.data; return d&&d.strategies?d.strategies.filter(s=>s.openPositions>0||s.realisedPnl!==0).length:0; }
// crypto instrument bifurcation (Spot / Perps / Options), the crypto analog of Equity/Options/Futures
const CX_INSTR=[['spot','Spot','spark','Long-only on spot majors'],['perps','Perpetuals','trendUp','Long / short + funding carry'],['options','Options','layers','Premium selling']];
// Compact unsigned money for exposure/deployed figures ($492K / $1.0M).
function cxAbs(v){ if(v==null||!isFinite(v)) return '-'; const a=Math.abs(v);
  if(a>=1e6) return '$'+(a/1e6).toFixed(a>=1e7?0:1)+'M';
  if(a>=1e3) return '$'+(a/1e3).toFixed(a>=1e5?0:1)+'K';
  return '$'+Math.round(a); }
function cxScopeCounts(){ const by={spot:{n:0,pnl:0,open:0,book:0},perps:{n:0,pnl:0,open:0,book:0},options:{n:0,pnl:0,open:0,book:0}};
  ((CRYPTOMON.data&&CRYPTOMON.data.strategies)||[]).forEach(s=>{ const seg=s.instr||'spot', c=by[seg]; if(!c) return;
    c.n++; c.pnl+=s.paperPnl||0; c.open+=s.openPositions||0;
    // deployed = capital-at-risk, mirroring the backend Governor: spot/options = full notional (qty×entry); perps = 20% margin
    (s.positions||[]).forEach(p=>{ const notional=Math.abs((p.qty||0)*(p.entry||0)); c.book += seg==='perps'?notional*0.20:notional; }); });
  return by; }
function cryptoScopeBar(){
  const cur=state.algo.cinstr||'spot', by=cxScopeCounts();
  const pool=(CRYPTOMON.data&&CRYPTOMON.data.capital)||0;
  const bar=CX_INSTR.map(([id,lab,ic,desc])=>{ const c=by[id]||{n:0,pnl:0,book:0};
    const dep=c.n?`<span class="lii-dep">Deployed <b class="num">${cxAbs(c.book)}</b>${pool?` · ${(c.book/pool*100).toFixed(1)}% of pool`:''}</span>`:'';
    return `<button class="lib-instr-tab${cur===id?' on':''}" data-cinstr="${id}" role="tab" aria-selected="${cur===id}">
      <span class="lii-top">${icon(ic,15)}<b>${lab}</b><i class="lii-n">${c.n}</i></span>
      <span class="lii-desc">${c.n?esc(desc)+' · <span data-cxseg="'+id+'">'+cxMoney(c.pnl)+'</span>':esc(desc)+' · coming online'}</span>${dep}</button>`; }).join('');
  const totBook=by.spot.book+by.perps.book+by.options.book;
  const note=totBook>0?`<div class="av-scope-note">${icon('shield',12)}<span><b>Deployed</b> = capital-at-risk against the ${pool?cxAbs(pool)+' ':''}governed pool${pool?` (≈${(totBook/pool*100).toFixed(1)}% total exposure, matches the Risk Score)`:''}. Perps book only <b>20% margin</b>; options premium-selling ties up <b>~no notional</b>, so their margin/tail risk isn't reflected here.</span></div>`:'';
  return `<div class="av-scope"><div class="lib-instr" role="tablist" aria-label="Crypto instrument class">${bar}</div>${note}</div>`;
}
// shared chip renderer (used by full render AND the in-place patch), one source of truth
function cxChips(positions){ return (positions||[]).map(p=>{
    if(p.credit!=null) return `<span class="cxm-chip ${cls(p.pnl)}">${esc(p.sym||'')}${p.pnl!=null?` <i>${cxMoney(p.pnl)}</i>`:` <i>cr ${cxMoney(p.credit)}</i>`}</span>`;
    if(p.side!=null) return `<span class="cxm-chip ${cls(p.pnl)}">${p.side<0?'▼':'▲'} ${esc((p.sym||'').replace('USDT',''))}${p.pnl!=null?` <i>${cxMoney(p.pnl)}</i>`:''}</span>`;
    if(p.qty!=null) return `<span class="cxm-chip ${cls(p.pnl)}">${esc((p.sym||'').replace('USDT',''))} <i>${pct(p.pnlPct)}</i></span>`;
    if(p.spread!=null) return `<span class="cxm-chip">${esc((p.sym||'').replace(/USDT/g,''))} ${p.spread>0?'L':'S'}</span>`;
    return ''; }).join(''); }
// structural signature: a full re-render happens ONLY when this changes (position opens/closes,
// scope/sort/filter/regime changes). Otherwise the 7s poll patches numbers in place → no flicker.
function cryptoMonSig(){ const d=CRYPTOMON.data; if(!d||!d.strategies) return 'x'; const cur=state.algo.cinstr||'spot';
  const scoped=d.strategies.filter(s=>(s.instr||'spot')===cur);
  return [cur,d.running,CRYPTOMON.err?'e':'',d.regime||'',state.algo.monSort||'',state.algo.monFilter||'',
    scoped.map(s=>s.id+':'+(s.openPositions||0)+':'+((s.positions||[]).length)).join(',')].join('|'); }
function cxSetNum(el,txt,tone){ if(!el) return; if(el.textContent!==txt) el.textContent=txt; el.classList.remove('up','down'); if(tone) el.classList.add(tone); }
// patch live numbers in place: no innerHTML rebuild of the tab, so no flicker
function patchCryptoMon(){ const d=CRYPTOMON.data; if(!d||!d.strategies) return;
  const cur=state.algo.cinstr||'spot';
  const scoped=d.strategies.filter(s=>(s.instr||'spot')===cur);
  const t=scoped.reduce((a,s)=>{a.realised+=s.realisedPnl||0;a.unreal+=s.openPnl||0;a.pnl+=s.paperPnl||0;a.open+=s.openPositions||0;return a;},{realised:0,unreal:0,pnl:0,open:0});
  const tn=v=>v>0?'up':(v<0?'down':'');
  cxSetNum(document.querySelector('[data-live="cxRealised"]'),cxMoney(t.realised),tn(t.realised));
  cxSetNum(document.querySelector('[data-live="cxUnreal"]'),cxMoney(t.unreal),tn(t.unreal));
  cxSetNum(document.querySelector('[data-live="cxClsPnl"]'),cxMoney(t.pnl),tn(t.pnl));
  cxSetNum(document.querySelector('[data-live="cxOpen"]'),String(t.open||0),null);
  const esc1=id=>(window.CSS&&CSS.escape)?CSS.escape(id):id;
  scoped.forEach(s=>{ const row=document.querySelector('.cxm-row[data-cxrow="'+esc1(s.id)+'"]'); if(!row) return;
    cxSetNum(row.querySelector('.cxm-open'),String(s.openPositions||0),null);
    cxSetNum(row.querySelector('.cxm-real'),cxMoney(s.realisedPnl),tn(s.realisedPnl));
    cxSetNum(row.querySelector('.cxm-unreal'),cxMoney(s.openPnl),tn(s.openPnl));
    const tot=row.querySelector('.cxm-total'); if(tot){ tot.classList.remove('up','down'); const tt=tn(s.paperPnl); if(tt)tot.classList.add(tt); const h='<b>'+cxMoney(s.paperPnl)+'</b>'; if(tot.innerHTML!==h) tot.innerHTML=h; }
    const posC=row.querySelector('.cxm-pos'); if(posC){ const h=cxChips(s.positions); if(posC.innerHTML!==h) posC.innerHTML=h; }
  });
}
function cryptoMonitor(){
  const d=CRYPTOMON.data;
  if(!d){ if(!CRYPTOMON.busy) loadCryptoMonitor().then(()=>{ if(isAlgo()&&state.algo.market==='crypto') renderAlgo(); });
    return secEmpty('cpu','Loading crypto book…','Fetching your live crypto paper P&L…'); }
  if(CRYPTOMON.err && !d.running){ return secEmpty('cpu','Trading engine unreachable','The paper-trading engine is temporarily unreachable. Prices are still real Binance; your paper book resumes once it\'s back.'); }
  if(d.running===false){ return secEmpty('cpu','Trading engine offline','The paper-trading engine is temporarily offline. It normally runs 24/7 on live Binance data, paper only, we\'re on it.'); }
  const cur=state.algo.cinstr||'spot', g=d.governor||{};
  const scoped=(d.strategies||[]).filter(s=>(s.instr||'spot')===cur);
  const t=scoped.reduce((a,s)=>{a.realised+=s.realisedPnl||0;a.unreal+=s.openPnl||0;a.pnl+=s.paperPnl||0;a.open+=s.openPositions||0;return a;},{realised:0,unreal:0,pnl:0,open:0});
  const clsLabel=(CX_INSTR.find(x=>x[0]===cur)||[,'Spot'])[1];
  const upd=d.updated?new Date(d.updated).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):'';
  const gate=cur==='perps'?' Perps can go long OR short and harvest funding.':cur==='options'?' Premium selling, regime-gated (never sold into a strong trend).':' Long-only on spot majors.';
  const note=`<div class="cx-preview-note">${icon('shield',13)}<span><b>Live crypto paper book, ${esc(clsLabel)}.</b> Real Binance prices, simulated fills, <b>no crypto orders are placed</b>.${gate} Same survival-first Governor across every strategy. P&L is USDT on a $${Math.round((d.capital||1e6)/1000)}K sizing sandbox.</span></div>`;
  if(cur==='options' && !scoped.length){
    return note+cryptoScopeBar()+secEmpty('layers','Crypto options, coming online','The crypto options desk (USDT-settled, regime-gated premium selling on Binance) is being wired next. Spot & Perpetuals are live now, switch the toggle above.'); }
  const stat=secStats([
    {l:'Realised',v:cxMoney(t.realised),s:'booked',tone:t.realised>0?'up':(t.realised<0?'down':''),id:'cxRealised'},
    {l:'Unrealised',v:cxMoney(t.unreal),s:'open · live',tone:t.unreal>0?'up':(t.unreal<0?'down':''),id:'cxUnreal'},
    {l:'Net',v:cxMoney(t.pnl),s:'realised + unrealised',tone:t.pnl>0?'up':(t.pnl<0?'down':''),id:'cxClsPnl'},
    {l:'Open positions',v:String(t.open||0),s:esc(clsLabel)+' strategies',id:'cxOpen'},
    {l:'Regime',v:esc(d.regime||'-'),s:'BTC-led'},
    {l:'Risk score',v:g.score==null?'-':String(g.score),s:g.exposurePct!=null?`${g.exposurePct}% exposure`:'governor'},
  ]);
  // forward stats (win%/PF/expectancy/closed per strategy) power the accuracy line + go-live check, 
  // joined by strategy id from the /api/crypto/forward payload.
  if(!CRYPTOFWD.loaded && !CRYPTOFWD.busy) loadCryptoFwd().then(()=>{ if(isAlgo()&&state.algo.market==='crypto'&&state.algo.view==='monitor') renderAlgo(); });
  const fwdMap={}; ((CRYPTOFWD.data&&CRYPTOFWD.data.strategies)||[]).forEach(f=>fwdMap[f.id]=f);
  // regime fit (learned, net-of-cost verdict per strategy for the CURRENT regime) → drives the live
  // engine panel + per-row FIT/STOOD-DOWN badges. Joined by id from /api/regime-fit?market=crypto.
  if(!RFIT.data.crypto && !RFIT.busy.crypto) loadRegimeFit('crypto').then(()=>{ if(isAlgo()&&state.algo.market==='crypto'&&state.algo.view==='monitor') renderAlgo(); });
  if(!CRYPTOALLOC.loaded && !CRYPTOALLOC.busy) loadCryptoAlloc().then(()=>{ if(isAlgo()&&state.algo.market==='crypto'&&state.algo.view==='monitor') renderAlgo(); });
  const rf=RFIT.data.crypto||{}, curReg=rf.currentRegime||d.regime||'-';
  const fitMap={}, fitAllMap={}; (rf.strategies||[]).forEach(x=>{ fitMap[x.id]=(x.cells||{})[curReg]||null; fitAllMap[x.id]=x.cells||{}; });
  const allocMap={}; ((CRYPTOALLOC.data&&CRYPTOALLOC.data.strategies)||[]).forEach(x=>{ allocMap[x.id]=x.weight; });
  scoped.forEach(s=>s._dep=cryptoDeployed(s));   // stamp deployed for the Deployed sort
  const {sorted:sortedScoped, bar:ctrlBar}=monSortFilter(scoped);
  const me=state.algo.monExpand=state.algo.monExpand||{};
  // accordion cards (mon-card): click to expand
  // positions + forward accuracy, a per-row Go-Live check CTA, and deployed capital in the subline.
  const rows=sortedScoped.map(s=>{
    const open=!!me[s.id], f=fwdMap[s.id]||{}, dep=cryptoDeployed(s);
    const sub=(s.realisedPnl||s.openPnl||s.openPositions)?`R ${cxMoney(s.realisedPnl||0)} · U ${cxMoney(s.openPnl||0)}`:'no trades yet';
    const pos=(s.positions||[]).map(p=>{
      const sym=(p.sym||'').replace(/USDT/g,'');
      if(p.entry!=null){ const dir=p.side!=null?(p.side<0?'SHORT ':'LONG '):''; const g=p.gainPct!=null?p.gainPct:(p.pnlPct!=null?p.pnlPct:null);
        return `<div class="mon-posrow"><span class="mp-sym">${esc(dir+sym)}</span><span class="mp-q">${p.qty!=null?esc(String(p.qty))+' qty':''}</span><span class="mp-x num">entry ${(+p.entry).toLocaleString()}</span>${p.stop?`<span class="mp-x num">stop ${(+p.stop).toLocaleString()}</span>`:''}<b class="mp-pnl num ${cls(p.pnl)}">${p.pnl!=null?cxMoney(p.pnl):''}${g!=null?` · ${g>=0?'+':''}${g}%`:''}</b></div>`; }
      return `<div class="mon-posrow"><span class="mp-sym">${esc(sym)}</span><span class="mp-q">spread ${p.spread>0?'long':'short'}</span><span class="mp-x">marks on close</span></div>`;
    }).join('');
    const posBlock=pos?`<div class="mon-pos">${pos}</div>`:'';
    const accLine=f.closed?`<div class="mon-acc"><span>Forward accuracy</span><b class="${f.winPct!=null&&f.winPct>=50?'up':'down'}">${f.winPct!=null?f.winPct+'% win':'-'}</b><i>·</i>PF <b class="${f.profitFactor!=null&&f.profitFactor>=1?'up':'down'}">${f.profitFactor!=null?(+f.profitFactor).toFixed(2):'-'}</b><i>·</i>exp <b class="num ${cls(f.expectancy)}">${f.expectancy!=null?cxMoney(f.expectancy):'-'}</b><i>·</i>${f.closed} closed <a class="mon-acc-link" data-algogoto="accuracy">go-live gate →</a></div>`:'';
    // allocation dial: the user's real control over how much of this strategy's normal size to use
    const wgt=allocMap[s.id]!=null?allocMap[s.id]:1, wpct=Math.round(wgt*100);
    const allocCtl=`<div class="mon-alloc"><div class="ma-h"><span>${icon('sliders',12)} Capital allocation</span><b class="ma-val" data-cxallocval="${esc(s.id)}">${wpct}%</b></div>
      <input class="ma-slider" type="range" min="0" max="100" step="5" value="${wpct}" data-cxalloc="${esc(s.id)}" aria-label="Allocation for ${esc(s.name)}">
      <div class="ma-scale"><span>Off</span><span>Full size</span></div>
      <p class="ma-note">Caps how much of its normal size this strategy may use, <b>0% = paused</b> (no new trades; open ones still managed). The Governor's concentration caps still apply on top. Honoured by the engine next cycle.</p></div>`;
    // "on deck": for a strategy stood down in THIS regime, which regimes it's PROVEN to win in
    // (why it's kept: it's your bench for those regimes). Answers "how are inactive strategies useful?"
    const curCell=fitMap[s.id], benched=curCell&&curCell.verdict==='unfit';
    const fitRegs=Object.entries(fitAllMap[s.id]||{}).filter(([r,c])=>c&&c.verdict==='fit').map(([r])=>r);
    const onDeck=benched?`<div class="mon-ondeck">${icon('repeat',12)}<span><b>Stood down in ${esc(curReg)}</b>: it loses here, so the engine holds its capital in cash. ${fitRegs.length?`It's your bench for <b>${fitRegs.map(esc).join(' · ')}</b>: proven to win there, ready to redeploy the moment the regime turns.`:`No regime has cleared it yet, it stays benched, still gathering evidence.`}</span></div>`:'';
    const expInner=(onDeck+posBlock+accLine+allocCtl)||`<div class="mon-exp-empty">No open positions or closed trades yet, this strategy trades only when its setup appears.</div>`;
    const badge=cxStratBadge(s, fitMap[s.id], curReg, allocMap[s.id]===0);
    return `<div class="mon-card${open?' open':''}" data-cxrow="${esc(s.id)}">
      <div class="mon-row live mon-head" data-monexp="${esc(s.id)}" role="button" tabindex="0" aria-expanded="${open}" title="Show positions &amp; forward accuracy"><div class="mon-l"><span class="live-dot live"></span><div><b>${esc(s.name)} <span class="cxf-cls">${esc(s.instr||'spot')}</span>${badge}</b><span class="mon-cat">${s.openPositions||0} open${dep>0?` · <b class="mc-dep">${cxMoney(dep)}</b> deployed`:''} · ${f.closed||0} closed</span></div></div>
      <div class="mon-pnl"><b class="num cxm-net ${cls(s.paperPnl)}">${cxMoney(s.paperPnl)}</b><span class="mon-sub" data-cxsub="${esc(s.id)}">${sub}</span></div>
      <div class="mon-ctrls"><button class="btn-ghost sm" data-cxgl="${esc(s.id)}">${icon('shield',12)} Go-Live check</button><span class="mon-chev">▾</span></div></div>
      <div class="mon-exp">${expInner}</div></div>`;
  }).join('');
  const act=scoped.filter(s=>s.openPositions>0||s.realisedPnl!==0).length;
  const listHtml=rows||`<div class="mon-exp-empty" style="padding:14px">No strategies match this filter, <button class="mon-clearfilt" data-monfilter="all">show all</button>.</div>`;
  const _xt=execToggle(scoped.length, 0);   // Paper | Live toggle, unified with the Indian book (crypto live is locked)
  if((state.algo.exec||'paper')==='live') return note+cryptoScopeBar()+_xt+liveLockedPanel();
  CRYPTOMON._sig=cryptoMonSig();   // remember the structure so the next poll can patch-in-place (no flicker)
  const brk=cxClassStrip();   // P&L by instrument class (Spot / Perps / Options)
  const engine=cxLiveEnginePanel(scoped, fitMap, curReg, allocMap);   // honest "what's working now" transparency
  return note+cryptoScopeBar()+_xt+engine+stat+brk+ctrlBar+`<div class="cxm-tbl-h">${icon('activity',13)}<b>${esc(clsLabel)} strategies</b><span>${act} active · ${scoped.length} running${upd?` · updated ${upd}`:''}</span></div><div class="mon-list">${listHtml}</div>`;
}
// Per-strategy badge: LIVE (has open positions right now) + regime verdict (FIT / STOOD DOWN /
// GATHERING) for the current regime, so the user sees, at a glance, which strategies the engine
// is running vs benching AND which are actively in a trade. All from the learned regime-fit data.
function cxStratBadge(s, cell, regime, paused){
  const active=(s.openPositions||0)>0;
  const act=active?`<span class="cxb reg-live"><i class="cxb-dot"></i>LIVE</span>`:'';
  if(paused){   // YOU set this to 0%, distinct from the engine standing it down for the regime
    return act+`<span class="cxb reg-paused" title="You paused this strategy (allocation 0%), it takes no new trades until you raise it. Open positions are still managed.">${icon('lock',10)} PAUSED BY YOU</span>`;
  }
  const v=cell&&cell.verdict;
  let reg='';
  if(v==='fit') reg=`<span class="cxb reg-fit" title="Proven to WIN in ${esc(regime)} (net of cost, ${cell.n} trades), the engine keeps it running">FIT · ${esc(regime)}</span>`;
  else if(v==='unfit') reg=`<span class="cxb reg-unfit" title="Proven to LOSE in ${esc(regime)} (${cell.n} trades, ${cell.expectancy!=null?cxMoney(cell.expectancy)+'/trade':''}), stood down to cash">STOOD DOWN</span>`;
  else if(cell&&cell.n) reg=`<span class="cxb reg-gath" title="Gathering evidence for ${esc(regime)} (${cell.n} trades so far)">GATHERING</span>`;
  return act+reg;
}
// Shared regime-fit lens for every crypto tab, ensures /api/regime-fit is loaded and returns the
// current regime + per-strategy verdict maps (by id). Keeps the FIT/STOOD-DOWN story consistent
// across Monitor / Forward / Positions instead of each tab re-deriving it.
function cxRegimeFit(){
  if(!RFIT.data.crypto && !RFIT.busy.crypto) loadRegimeFit('crypto').then(()=>{ if(isAlgo()&&state.algo.market==='crypto') renderAlgo(); });
  const rf=RFIT.data.crypto||{};
  const curReg=rf.currentRegime||(CRYPTOMON.data&&CRYPTOMON.data.regime)||'-';
  const fitMap={}, fitAllMap={};
  (rf.strategies||[]).forEach(x=>{ fitMap[x.id]=(x.cells||{})[curReg]||null; fitAllMap[x.id]=x.cells||{}; });
  return {curReg, fitMap, fitAllMap};
}
// The honest "Live Engine" panel, what's actually working RIGHT NOW, net of costs. It reconciles
// the ugly all-time number with the forward picture: the strategies that caused the loss are now
// STOOD DOWN; what's cleared to run has a real positive edge in this regime. No fabricated profit: 
// every figure is the learned, net-of-135bps regime-fit evidence.
function cxLiveEnginePanel(scoped, fitMap, regime, allocMap){
  allocMap=allocMap||{};
  const fit=[], unfit=[];
  scoped.forEach(s=>{ const c=fitMap[s.id]; if(!c) return; if(c.verdict==='fit') fit.push({s,c}); else if(c.verdict==='unfit') unfit.push({s,c}); });
  const paused=scoped.filter(s=>allocMap[s.id]===0);   // strategies YOU turned off (distinct from regime stand-down)
  if(!fit.length && !unfit.length && !paused.length) return '';   // no learned verdicts yet, don't invent a story
  const N=fit.reduce((a,x)=>a+(x.c.n||0),0);
  const wWin=N?fit.reduce((a,x)=>a+(x.c.n||0)*(x.c.winPct||0),0)/N:null;      // trade-weighted win-rate
  const wExp=N?fit.reduce((a,x)=>a+(x.c.n||0)*(x.c.expectancy||0),0)/N:null;  // trade-weighted expectancy
  const activeFit=fit.filter(x=>(x.s.openPositions||0)>0).length;
  const depFit=fit.reduce((a,x)=>a+cryptoDeployed(x.s),0);
  const unfitExp=unfit.length?unfit.reduce((a,x)=>a+(x.c.expectancy||0),0)/unfit.length:null;
  const good=wExp!=null&&wExp>0;
  // running chips: the proven winners for this regime, with their REAL edge
  const runChips=fit.sort((a,b)=>(b.c.expectancy||0)-(a.c.expectancy||0)).slice(0,6).map(x=>
    `<span class="cxe-chip${(x.s.openPositions||0)>0?' on':''}" title="${esc(x.s.name)} in ${esc(regime)}: ${x.c.winPct}% win · PF ${x.c.pf} · ${cxMoney(x.c.expectancy)}/trade over ${x.c.n} trades">${esc(x.s.name)} <i class="${cls(x.c.expectancy)}">${cxMoney(x.c.expectancy)}</i></span>`).join('')
    || `<span class="cxe-chip muted">No strategy has cleared the ${esc(regime)} bar yet, the book stays in cash.</span>`;
  const edge=N?`<div class="cxe-edge">
    <div class="cxe-metric"><span>Historical win-rate</span><b class="${wWin>=50?'up':'down'}">${Math.round(wWin)}%</b><i>of trades, running set</i></div>
    <div class="cxe-metric"><span>Edge per trade</span><b class="num ${cls(wExp)}">${cxMoney(wExp)}</b><i>net of 135bps cost</i></div>
    <div class="cxe-metric"><span>Evidence</span><b>${N}</b><i>closed ${esc(regime)} trades</i></div>
    <div class="cxe-metric"><span>Capital at work</span><b class="num">${cxMoney(depFit)}</b><i>${activeFit} live now</i></div>
  </div>`:'';
  const verdict=good
    ? `<span class="cxe-tag ok">${icon('check',13)} Positive edge, net of cost</span>`
    : (N?`<span class="cxe-tag warn">${icon('alert',13)} Edge not yet proven positive, trading small / mostly cash</span>`:'');
  const stood=unfit.length?`<div class="cxe-stood">${icon('shield',13)}<span><b>${unfit.length} strateg${unfit.length===1?'y':'ies'} stood down</b>: proven to lose in ${esc(regime)}${unfitExp!=null?` (avg <b class="down">${cxMoney(unfitExp)}</b>/trade)`:''}. Their capital is held in <b>cash</b> by design, this is the engine refusing to trade a losing setup, not idleness. <a class="mon-acc-link" data-algogoto="analytics">see the damage they did →</a></span></div>`:'';
  const pausedLine=paused.length?`<div class="cxe-stood cxe-paused">${icon('lock',13)}<span><b>${paused.length} paused by you</b>: allocation set to 0% (${paused.slice(0,4).map(s=>esc(s.name)).join(', ')}${paused.length>4?` +${paused.length-4}`:''}). These take no new trades until you raise them, <b>your choice, not the engine's</b>. Expand a row to adjust.</span></div>`:'';
  return `<div class="cxe-panel ${good?'ok':'warn'}">
    <div class="cxe-head"><div class="cxe-ic">${icon('cpu',18)}</div>
      <div class="cxe-hx"><b>Live engine · ${esc(regime)} regime</b><span>What's <b>cleared to run right now</b>, net of cost. The engine learned from the losses: the strategies that bled are benched below; what's running here has real evidence behind it.</span></div>
      ${verdict}</div>
    ${edge}
    <div class="cxe-run"><span class="cxe-run-l">Running now</span><div class="cxe-chips">${runChips}</div></div>
    ${stood}
    ${pausedLine}
    <p class="cxe-foot">${icon('shield',12)}<span>Win-rate and edge are the <b>real forward record</b> of these strategies in ${esc(regime)} (net of 135bps), evidence, <b>not a promise</b>. Markets can still hand any single trade a loss; the edge is a long-run average.</span></p>
  </div>`;
}
// P&L by instrument class for the crypto Monitor; each cell
// switches the scope (data-cinstr wiring already exists). Counts/P&L from cxScopeCounts().
function cxClassStrip(){
  const by=cxScopeCounts(), cur=state.algo.cinstr||'spot';
  const cell=(k,lab)=>`<span class="mb-cell${cur===k?' on':''}" data-cinstr="${k}" role="button" tabindex="0" title="${lab}, net ${cxMoney(by[k].pnl)} · ${by[k].n} strategies. Click to scope."><i>${esc(lab)}</i><b class="num ${cls(by[k].pnl)}">${cxMoney(by[k].pnl)}</b></span>`;
  const overall=by.spot.pnl+by.perps.pnl+by.options.pnl;
  return `<div class="mon-brk"><span class="mb-lead">P&amp;L by class</span>${cell('spot','Spot')}${cell('perps','Perps')}${cell('options','Options')}<span class="mb-cell mb-all"><i>Overall</i><b class="num ${cls(overall)}">${cxMoney(overall)}</b></span></div>`;
}
// Per-strategy Go-Live check for crypto, the honest readiness modal.
// Scores the strategy's forward evidence against the go-live bar and states plainly WHY crypto
// live stays locked (browser can't arm ALLOW_LIVE + the book must clear the net-of-cost bar).
function cryptoGoLiveCheck(id){
  const s=((CRYPTOMON.data&&CRYPTOMON.data.strategies)||[]).find(x=>x.id===id)||{name:id};
  flowModal({title:'Go-Live readiness, '+(s.name||id), hideConfirm:true,
    body:`<div class="gl-load">${icon('cpu',16)}<span>Scoring ${esc(s.name||id)} against the go-live bar (net of 135bps costs)…</span></div>`,
    wire(body){
      fetch(BOT_API+'/api/readiness/book?market=crypto').then(r=>r.json())
        .then(d=>{ body.innerHTML=cryptoGoLiveHTML(d,id); })
        .catch(()=>{ body.innerHTML=`<p class="flow-note">${icon('shield',13)}<span>The trading engine is temporarily offline, please retry shortly.</span></p>`; });
    }});
}
function cryptoGoLiveHTML(d,id){
  const bar=d.bar||{}, r=(d.strategies||[]).find(x=>x.id===id)||{};
  const gate=(ok,label,detail)=>`<div class="gl-row ${ok?'pass':'fail'}"><span class="gl-mk">${icon(ok?'check':'x',13)}</span><div class="gl-tx"><b>${esc(label)}</b><span>${esc(detail)}</span></div></div>`;
  const nT=r.closed||0, pf=r.profitFactor, exp=r.expectancy, regs=(r.regimes||[]).length;
  const g1=nT>=(bar.minTrades||30), g2=pf!=null&&pf>=(bar.minProfitFactor||1.3), g3=regs>=(bar.minRegimes||2), g4=exp!=null&&exp>0;
  const passed=[g1,g2,g3,g4].filter(Boolean).length;
  const head=`<div class="gl-head block"><div class="gl-score"><b>${passed}/4</b><span>evidence gates green</span></div>
    <div class="gl-barwrap"><div class="gl-bar"><i style="width:${passed/4*100}%"></i></div><span class="gl-verdict">${icon('lock',13)} Crypto live is gated</span></div></div>`;
  const gates=`<div class="gl-grp"><div class="gl-gh">Forward-test evidence · net of 135bps (1% TDS + fees)</div>
    ${gate(g1,'Enough closed trades',`${nT} of ${bar.minTrades||30} needed for a real sample`)}
    ${gate(g2,'Profit factor clears the bar',`PF ${pf!=null?(+pf).toFixed(2):'-'} vs ≥ ${bar.minProfitFactor||1.3}`)}
    ${gate(g3,'Proven across regimes',`${regs} of ${bar.minRegimes||2} regimes with a real sample`)}
    ${gate(g4,'Positive expectancy after cost',`${exp!=null?cxMoney(exp):'-'} per trade`)}</div>`;
  const foot=`<div class="gl-blocked">${icon('lock',14)}<div><b>Crypto live is locked, by design, twice over.</b><span>1) A browser can <b>never</b> arm real orders, it needs <b>ALLOW_LIVE</b> set on the machine running the bot (a two-key OS gate). 2) The whole crypto book must clear the net-of-cost bar first, and today it is negative after the 1% TDS. ${passed===4?'This strategy has cleared the <b>evidence</b> gates, the capital/cost gate remains.':`This strategy still has <b>${4-passed}</b> evidence gate(s) open.`}</span></div></div>`;
  return head+gates+foot;
}
// ---- crypto Positions: Position Intelligence ----
// Uses the pi-card component (health score, action chip, thesis reason),
// fed by the crypto engine's live position_intel (health/action/reason/gainPct).
function cryptoPositions(){
  const hero=`<div class="pi-hero"><div class="pi-hero-ic">${icon('shield',20)}</div>
    <div class="pi-hero-tx"><b>Position Intelligence</b><span>Every open crypto position, managed live by the same survival-first engine. Health = is the original thesis still valid? Profit is protected as gains grow; exits fire only on <b>persistent</b> decay, never a single down-tick, so winners run.</span></div></div>`;
  const d=CRYPTOMON.data;
  if(!d){ if(!CRYPTOMON.busy) loadCryptoMonitor().then(()=>{ if(isAlgo()&&state.algo.market==='crypto') renderAlgo(); });
    return hero+`<div class="opp-load">${icon('cpu',16)}<span>Reading open crypto positions…</span></div>`; }
  if(CRYPTOMON.err && !d.running) return hero+`<div class="opp-offline">${icon('shield',14)}<span>The trading engine is temporarily unreachable.</span></div>`;
  if(d.running===false) return hero+`<div class="opp-offline">${icon('shield',14)}<span>The trading engine is temporarily offline.</span></div>`;
  const cur=state.algo.cinstr||'spot';
  const {curReg, fitMap}=cxRegimeFit();
  const scoped=(d.strategies||[]).filter(s=>(s.instr||'spot')===cur);
  const ps=[]; scoped.forEach(s=>(s.positions||[]).forEach(p=>ps.push(Object.assign({strat:s.name,stratId:s.id},p))));
  if(!ps.length) return hero+cryptoScopeBar()+secEmpty('check','No open positions',`Nothing to manage right now, in this regime the survival-first engine is largely in cash. As strategies enter, each position appears here with a live health score and a recommended action.`);
  ps.sort((a,b)=>(a.health==null?999:a.health)-(b.health==null?999:b.health));   // weakest first
  const withH=ps.filter(p=>p.health!=null);
  const avgH=withH.length?Math.round(withH.reduce((s,p)=>s+p.health,0)/withH.length):null;
  const summ=`<p class="sec-hint">${icon('cpu',12)}<span><b>${ps.length}</b> open position(s)${avgH!=null?` · avg health <b>${avgH}</b>`:''} · weakest first. Health updates every cycle from the live thesis.</span></p>`;
  const cards=ps.map(p=>{
    const tone=posTone(p.health), act=POS_ACT[p.action]||null, hv=p.health==null?'-':p.health;
    const gain=p.gainPct!=null?p.gainPct:(p.pnlPct!=null?p.pnlPct:null);
    const dir=p.side!=null?(p.side<0?'SHORT ':'LONG '):'', sym=(p.sym||'').replace(/USDT/g,'');
    const fc=fitMap[p.stratId], fitB=fc&&fc.verdict==='fit'?`<span class="cxb reg-fit" title="Its strategy is proven to win in ${esc(curReg)}, a healthy live position">FIT · ${esc(curReg)}</span>`:fc&&fc.verdict==='unfit'?`<span class="cxb reg-unfit" title="Its strategy is stood down in ${esc(curReg)}, this is a legacy position being wound down, not a fresh entry">WINDING DOWN</span>`:'';
    return `<div class="pi-card ${tone}">
      <div class="pi-h"><div class="pi-sym"><b>${esc(dir+sym)}</b><span>${esc(p.strat||'')}${fitB}</span></div>
        <div class="pi-score ${tone}"><b>${hv}</b><span>health</span></div></div>
      <div class="pi-bar"><i class="${tone}" style="width:${p.health==null?0:p.health}%"></i></div>
      <div class="pi-meta">
        ${act?`<span class="pi-act ${act[1]}">${esc(act[0])}</span>`:''}
        ${gain!=null?`<span class="pi-gain ${gain>=0?'up':'down'}">${gain>=0?'+':''}${gain}%</span>`:''}
        ${p.entry?`<span>entry $${(p.entry).toLocaleString()}</span>`:''}
        ${p.stop?`<span>stop $${(p.stop).toLocaleString()}</span>`:''}
        ${p.pnl!=null?`<span class="${cls(p.pnl)}">${cxMoney(p.pnl)}</span>`:''}
        ${p.weak?`<span class="pi-weak">weak ${p.weak}/2</span>`:''}
      </div>
      ${p.reason?`<p class="pi-reason">${icon(p.action==='exit'?'alert':p.action==='protect'?'shield':'cpu',11)} ${esc(p.reason)}</p>`:''}
    </div>`;
  }).join('');
  return hero+cryptoScopeBar()+summ+`<div class="pi-grid">${cards}</div>`;
}
// ---- crypto Risk Governor ----
const CRYPTORISK={loaded:false,busy:false,data:null};
async function loadCryptoRisk(){ if(CRYPTORISK.busy) return; CRYPTORISK.busy=true;
  try{ CRYPTORISK.data=await fetch(`${BOT_API}/api/crypto/risk`).then(r=>r.json()); }catch(e){ CRYPTORISK.data={running:false}; }
  CRYPTORISK.loaded=true; CRYPTORISK.busy=false; }
function cxRiskBar(p,limit,label){ const w=Math.min(100,(p/limit)*100), over=p>limit;
  return `<div class="cxr-row"><span class="cxr-l">${esc(label)}</span><div class="cxr-track"><span class="cxr-fill${over?' over':''}" style="width:${w.toFixed(0)}%"></span></div><span class="cxr-v num${over?' down':''}">${(+p).toFixed(1)}%</span></div>`; }
function cryptoRisk(){
  const d=CRYPTORISK.data;
  if(!d){ if(!CRYPTORISK.busy) loadCryptoRisk().then(()=>{ if(isAlgo()&&state.algo.market==='crypto') renderAlgo(); }); return secEmpty('shield','Loading crypto risk…','Reading the crypto Governor state from the bot.'); }
  if(d.running===false){ return secEmpty('shield','Crypto Governor offline','The trading engine is temporarily offline, Governor state resumes once it\'s back.'); }
  // BUG FIX (2026-09-09): real per-user Governor state (health score, drawdown ladder, kill-switch,
  // trade audit) only exists inside the worker's Python process and isn't published per user yet.
  // This used to fall through to shared platform numbers instead - every signed-in user saw the
  // same $971K equity. Honest unavailable state until the worker publishes real per-user risk data.
  if(d.available===false){ return secEmpty('shield','Risk Governor: not available yet for your book','Deploy a strategy in the Algo Studio: once the worker runs your positions, your own exposure, drawdown, and crowding appear here.'); }
  const lim=d.limits||{};
  const note=`<div class="cx-preview-note">${icon('shield',13)}<span><b>Crypto Risk Governor.</b> The same portfolio control layer across every strategy: symbol/sector concentration, a crowding cap (max ${lim.botsPerSymbol||2} bots/name), total-exposure ceiling + a drawdown kill-switch. Crypto is grouped into Major / L1 / Alt sub-sectors so correlated coins can't quietly become one bet.</span></div>`;
  const stat=secStats([
    {l:'Health score',v:String(d.score),s:esc(d.mode||'normal'),tone:d.score>=70?'up':(d.score<40?'down':'')},
    {l:'Mode',v:esc(d.mode||'normal'),s:d.killSwitch?'KILL-SWITCH':'live',tone:d.killSwitch?'down':''},
    {l:'Exposure',v:(d.exposurePct||0)+'%',s:`limit ${lim.total||150}%`,tone:(d.exposurePct>(lim.total||150))?'down':''},
    {l:'Drawdown',v:(d.drawdownPct||0)+'%',s:'realised vs peak',tone:(d.drawdownPct>=2)?'down':''},
    {l:'Book',v:cxMoney(d.totalBook),s:`of $${Math.round((d.capital||1e6)/1000)}K pool`},
    {l:'Equity',v:cxMoney(d.equity),s:'capital + realised'},
  ]);
  const secBars=Object.entries(d.sectors||{}).map(([s,p])=>cxRiskBar(p,lim.sector||35,s)).join('')||'<div class="cxr-empty">No sector exposure</div>';
  const symBars=Object.entries(d.symbols||{}).slice(0,8).map(([s,p])=>cxRiskBar(p,lim.symbol||18,s.replace('USDT',''))).join('')||'<div class="cxr-empty">No open positions</div>';
  const crowd=Object.entries(d.crowding||{}).filter(([s,n])=>n>1).map(([s,n])=>`<span class="cxm-chip${n>=(lim.botsPerSymbol||2)?' down':''}">${esc(s.replace('USDT',''))} · ${n} bots</span>`).join('')||'<span class="cxr-empty">No crowding, every name held by ≤1 bot</span>';
  // risk-mode banner: the Governor is actively de-risking (kill-switch or reduced sizing)
  const modeBanner=d.killSwitch
    ?`<div class="rk-kill">${icon('alert',16)}<div><b>KILL-SWITCH ACTIVE, ${esc((d.mode||'').toUpperCase())}</b><span>Portfolio drawdown ${d.drawdownPct}%, new entries are blocked across all crypto bots until it recovers.</span></div></div>`
    :(d.mode&&d.mode!=='normal')?`<div class="rk-warn">${icon('alert',13)}<span>Risk-reduction mode <b>${esc(d.mode)}</b>: new positions sized to <b>${Math.round((d.sizeMult||1)*100)}%</b> (drawdown ${d.drawdownPct}%). Bots keep managing open positions; only new risk is throttled.</span></div>`:'';
  // drawdown kill-switch ladder (real ddTiers from the Governor, current mode highlighted)
  const tiers=(d.ddTiers||[]).slice().reverse();
  const ladder=tiers.length?`<div class="cxm-tbl-h">${icon('shield',13)}<b>Drawdown kill-switch ladder</b><span>current: ${esc(d.mode||'normal')} at ${d.drawdownPct||0}%</span></div>
    <div class="rk-ladder rk-card">
      <div class="rk-tier${(d.mode||'normal')==='normal'?' on':''}" style="order:-1"><b>0%</b><span>normal</span></div>
      ${tiers.map(t=>`<span class="rk-arr">→</span><div class="rk-tier${d.mode===t.mode?' on':''}"><b>${t.at}%</b><span>${esc(t.mode)}</span></div>`).join('')}
    </div>`:'';
  // trade audit: every proposal the Governor approved or vetoed (real, honest empty-state when quiet)
  const audit=(d.audit||[]);
  const aud=audit.length?`<div class="cxm-tbl-h">${icon('flag',13)}<b>Trade audit</b><span>every proposal, approved or vetoed</span></div>
    <div class="rk-audit rk-card">${audit.slice(0,20).map(a=>`<div class="rk-arow ${a.approved?'ok':'veto'}"><span class="rk-atag ${a.approved?'ok':'veto'}">${a.approved?'PASS':'VETO'}</span><span class="rk-amain"><b>${esc(a.bot||'')}</b> ${esc((a.symbol||'').replace('USDT',''))}</span><span class="rk-areason">${esc(a.reason||'')}</span><span class="rk-awhen">${a.ts?timeAgo(a.ts):''}</span></div>`).join('')}</div>`
    :`<div class="cxm-tbl-h">${icon('flag',13)}<b>Trade audit</b><span>every proposal, approved or vetoed</span></div><div class="cxr-empty" style="padding:11px 13px">No proposals reviewed since the last restart, each bot entry appears here with the Governor's verdict as the book trades.</div>`;
  return note+modeBanner+stat+
    `<div class="cxm-tbl-h">${icon('layout',13)}<b>Sector concentration</b><span>limit ${lim.sector||35}%</span></div><div class="cxr-bars">${secBars}</div>`+
    `<div class="cxm-tbl-h">${icon('activity',13)}<b>Symbol concentration</b><span>limit ${lim.symbol||18}%</span></div><div class="cxr-bars">${symBars}</div>`+
    `<div class="cxm-tbl-h">${icon('shield',13)}<b>Crowding</b><span>max ${lim.botsPerSymbol||2} bots/name</span></div><div class="cxm-pos">${crowd}</div>`+
    ladder+aud;
}
// ---- crypto Backtest (Binance klines) ----
const CX_BT_STRATS=[['momentum','Momentum'],['rsi2','RSI(2)'],['macross','MA Cross'],['supertrend','Supertrend'],['ema_cross','EMA Cross'],['adx_trend','ADX Trend'],['bollinger','Bollinger'],['zscore','Z-Score'],['nr7','NR7'],['xs_momentum','XS Momentum'],['lowvol','Low-Vol']];
const CX_BT_PERIODS=['1M','3M','1Y','3Y'];
const CRYPTOBT={busy:false,key:'',data:null};
async function loadCryptoBT(strat,period){ const key=strat+'|'+period; CRYPTOBT.busy=true; CRYPTOBT.key=key;
  try{ CRYPTOBT.data=await fetch(`${BOT_API}/api/crypto/backtest?strategy=${encodeURIComponent(strat)}&period=${period}`).then(r=>r.json()); }
  catch(e){ CRYPTOBT.data={real:false,error:'The trading engine is temporarily unreachable'}; }
  CRYPTOBT.busy=false; }
function cxCurve(a,b){ const all=(a||[]).concat(b||[]); if(all.length<2) return ''; const min=Math.min(...all),max=Math.max(...all),rng=(max-min)||1,W=560,H=150;
  const path=arr=>(!arr||arr.length<2)?'':arr.map((v,i)=>`${(i/(arr.length-1)*W).toFixed(1)},${(H-(v-min)/rng*H).toFixed(1)}`).join(' ');
  const base=(H-(100-min)/rng*H).toFixed(1);
  return `<svg class="cxbt-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
    <line class="cxbt-base" x1="0" y1="${base}" x2="${W}" y2="${base}"/>
    ${(b&&b.length)?`<polyline class="cxbt-bh" points="${path(b)}"/>`:''}
    <polyline class="cxbt-eq" points="${path(a)}"/></svg>`; }
function cryptoBacktest(){
  state.algo.cbt=state.algo.cbt||{strat:'macross',period:'1Y'};
  const {strat,period}=state.algo.cbt, key=strat+'|'+period;
  if(CRYPTOBT.key!==key && !CRYPTOBT.busy){ loadCryptoBT(strat,period).then(()=>{ if(isAlgo()&&state.algo.market==='crypto'&&state.algo.view==='backtest') renderAlgo(); }); }
  const sPick=CX_BT_STRATS.map(([id,l])=>`<button class="cxbt-chip${strat===id?' on':''}" data-cbtstrat="${id}">${esc(l)}</button>`).join('');
  const pPick=CX_BT_PERIODS.map(p=>`<button class="cxbt-chip${period===p?' on':''}" data-cbtperiod="${p}">${p}</button>`).join('');
  const picker=`<div class="cxbt-pick"><div class="cxbt-pick-r">${sPick}</div><div class="cxbt-pick-r cxbt-per">${pPick}</div></div>`;
  const note=`<div class="cx-preview-note">${icon('shield',13)}<span><b>Real crypto backtest.</b> The same Backtester every strategy is proven on, on historical Binance daily klines for the 10 majors (equal-weight portfolio, ${period} + warmup, 15bps costs). Past performance isn't a promise, it's evidence a rule had an edge, honestly measured.</span></div>`;
  let body;
  if(CRYPTOBT.busy || CRYPTOBT.key!==key){ body=secEmpty('activity','Backtesting…',`Running ${esc(strat)} over the crypto majors on Binance history.`); }
  else{ const d=CRYPTOBT.data;
    // BUG FIX (2026-09-09): an empty {} (no cached result for this strategy/period combo) used to
    // slip past this check - d.real===false is only set on an actual fetch failure - and fall into
    // the render path below, showing a confusing "0 trades, +0.00% drawdown" result instead of an
    // honest "unavailable" message. Catch the no-data case explicitly.
    if(!d||d.real===false||(d.totalRet==null&&!(d.pts&&d.pts.length))){ body=secEmpty('alert','Backtest unavailable',esc((d&&d.error)||'No cached result for this strategy/period yet.')); }
    else{ const tone=v=>v>0?'up':(v<0?'down':'');
      const stat=secStats([
        {l:'Total return',v:pct(d.totalRet),s:esc(d.period||period),tone:tone(d.totalRet)},
        {l:'CAGR',v:pct(d.cagr),s:'annualised',tone:tone(d.cagr)},
        {l:'Max drawdown',v:pct(-Math.abs(d.maxDD||0)),s:'peak-to-trough',tone:'down'},
        {l:'Sharpe',v:(d.sharpe==null?'-':(+d.sharpe).toFixed(2)),s:'risk-adjusted',tone:tone(d.sharpe)},
        {l:'Win rate',v:(d.winRate==null?'-':d.winRate+'%'),s:`${d.trades||0} trades`},
        {l:'Avg trade',v:pct(d.avgTrade),s:`${d.timeInMarket!=null?d.timeInMarket+'% in market':''}`,tone:tone(d.avgTrade)},
      ]);
      const bh=d.benchmark||{}; const curve=cxCurve(d.pts,bh.pts);
      const legend=curve?`<div class="cxbt-legend"><span class="cxbt-lg eq">${esc((CX_BT_STRATS.find(x=>x[0]===strat)||[,strat])[1])}</span>${bh.pts?`<span class="cxbt-lg bh">${esc(bh.label||'Buy & hold')} ${bh.totalRet!=null?pct(bh.totalRet):''}</span>`:''}${bh.alpha!=null?`<span class="cxbt-lg">α ${pct(bh.alpha)}</span>`:''}</div>`:'';
      const curveBlock=curve?`<div class="cxm-tbl-h">${icon('activity',13)}<b>Equity curve</b><span>base 100 · vs buy & hold</span></div>${legend}<div class="cxbt-chart">${curve}</div>`:'';
      // ---- validation: in-sample vs out-of-sample (the honest cut) ----
      const o=d.oos||{}, held=(o.oos_ret||0)>=0 && (o.oos_avg||0)>=-0.1, thin=(d.trades||0)<30;
      const vr=(o.is_trades!=null||o.oos_trades!=null)?`<div class="bt-vr"><div class="bt-vrh">${icon('shield',13)} Validation, the honest cut</div>
        <div class="bt-vrgrid">
          <div class="bt-vrcol"><span>In-sample (70%)</span><b class="num ${tone(o.is_ret)}">${pct(o.is_ret||0)}</b><i>${o.is_trades||0} trades · avg ${pct(o.is_avg||0)}/trade</i></div>
          <div class="bt-vrcol"><span>Out-of-sample (30%)</span><b class="num ${tone(o.oos_ret)}">${pct(o.oos_ret||0)}</b><i>${o.oos_trades||0} trades · avg ${pct(o.oos_avg||0)}/trade</i></div>
        </div>
        <p class="bt-vrverdict ${held?'ok':'warn'}">${icon(held?'check':'alert',12)}<span>${held?'Edge <b>persisted out-of-sample</b>: held up on data it never trained on.':'Edge <b>weakened out-of-sample</b>: strong in-sample but faded on unseen data. Treat with caution.'} Costs: <b>${d.costBps||15} bps/leg applied</b>.${thin?' <b>Thin sample</b> ('+(d.trades||0)+' trades, &lt;30), a hint, not proof.':''}</span></p></div>`:'';
      // ---- vs buy & hold ----
      const beat=bh&&bh.totalRet!=null&&d.totalRet>=bh.totalRet;
      const benchBlock=(bh&&bh.totalRet!=null)?`<div class="bt-bench"><div class="bt-anh">${icon('scale',13)} vs Buy &amp; hold <i>same ${d.universe||10} coins, dashed on the curve</i></div>
        <div class="bt-bgrid">
          <div class="bt-bc"><span>Strategy</span><b class="num ${tone(d.totalRet)}">${pct(d.totalRet)}</b></div>
          <div class="bt-bc"><span>Buy &amp; hold</span><b class="num ${tone(bh.totalRet)}">${pct(bh.totalRet)}</b></div>
          <div class="bt-bc"><span>Alpha · ann.${infoI('Annualised return the strategy added beyond just holding these coins. Positive = real edge; negative = the timing cost more than it added.')}</span><b class="num ${tone(bh.alpha)}">${bh.alpha!=null?pct(bh.alpha):'-'}</b></div>
          <div class="bt-bc"><span>Beta${infoI('Sensitivity to simply holding the basket. ~1 moves with it, <1 less exposed, ~0 market-neutral.')}</span><b class="num">${bh.beta!=null?bh.beta.toFixed(2):'-'}</b></div>
        </div>
        <p class="bt-bverdict ${beat?'ok':'warn'}">${icon(beat?'check':'alert',12)}<span>${beat?'The strategy <b>beat</b> simply holding these coins.':'The strategy <b>underperformed</b> buy &amp; hold over this window, an honest result, shown anyway.'}</span></p></div>`:'';
      // ---- drawdown / underwater ----
      const ddBlock=(Array.isArray(d.dd)&&d.dd.length>1)?`<div class="bt-dd"><div class="bt-anh">${icon('trendDown',13)} Drawdown, underwater <i>worst −${Math.abs(d.maxDD||0).toFixed(1)}% · time in market ${d.timeInMarket!=null?d.timeInMarket+'%':'-'}</i></div>${ddCurveSVG(d.dd)}<p class="bt-ddcap">${icon('shield',11)}<span>How deep and how long the strategy sat below its prior peak, the pain you'd have had to sit through.</span></p></div>`:'';
      // ---- Monte-Carlo robustness ----
      const mc=d.montecarlo, robust=mc&&mc.profitableShare>=60;
      const mcBlock=mc?`<div class="bt-bench"><div class="bt-anh">${icon('shield',13)} Monte-Carlo robustness <i>${mc.runs} resamples of the trades</i></div>
        <div class="bt-bgrid">
          <div class="bt-bc"><span>Worst 5%${infoI('5th-percentile outcome across the bootstrap resamples of the real trades, a bad-luck draw.')}</span><b class="num down">${pct(mc.p5)}</b></div>
          <div class="bt-bc"><span>Median</span><b class="num ${tone(mc.p50)}">${pct(mc.p50)}</b></div>
          <div class="bt-bc"><span>Best 5%</span><b class="num up">${pct(mc.p95)}</b></div>
          <div class="bt-bc"><span>Profitable${infoI('Share of resampled runs that ended in profit. >60% = a robust edge; near 50% = a coin-flip.')}</span><b class="num ${mc.profitableShare>=60?'up':mc.profitableShare<50?'down':''}">${mc.profitableShare}%</b></div>
        </div>
        <p class="bt-bverdict ${robust?'ok':'warn'}">${icon(robust?'check':'alert',12)}<span>${robust?'<b>Robust</b>: '+mc.profitableShare+'% of resampled runs profited, so the edge isn’t one lucky sequence.':'<b>Fragile</b>: only '+mc.profitableShare+'% of resampled runs profited; the result leans on a few trades. Treat with caution.'} Across draws, returns spanned <b>${pct(mc.p5)}</b> to <b>${pct(mc.p95)}</b>.</span></p></div>`:'';
      // ---- edge decay ----
      const ed=d.edgeDecay;
      const decayLine=ed?`<p class="bt-ddcap">${icon('clock',11)}<span><b>${ed.posMonths}%</b> of ${ed.totalMonths} months positive.${ed.fading!=null?(ed.fading?' Edge is <b>fading</b>: recent months ('+pct(ed.secondHalfAvg)+'/mo) weaker than earlier ('+pct(ed.firstHalfAvg)+'/mo).':' Edge is <b>holding</b>: recent ('+pct(ed.secondHalfAvg)+'/mo) ≈ earlier ('+pct(ed.firstHalfAvg)+'/mo).'):''}</span></p>`:'';
      // ---- trade analytics ----
      const an=d.analytics||{}, pf=an.profitFactor!=null?an.profitFactor.toFixed(2):'∞';
      const analytics=(an.wins!=null||an.losses!=null)?`<div class="bt-an"><div class="bt-anh">${icon('trendUp',13)} Trade analytics <i>${an.wins||0}W / ${an.losses||0}L</i></div>
        <div class="bt-angrid">
          <div class="bt-anc"><span>Avg win</span><b class="num up">${pct(an.avgWin||0)}</b></div>
          <div class="bt-anc"><span>Avg loss</span><b class="num down">${pct(an.avgLoss||0)}</b></div>
          <div class="bt-anc"><span>Profit factor</span><b class="num ${an.profitFactor>=1.2?'up':an.profitFactor!=null&&an.profitFactor<1?'down':''}">${pf}</b></div>
          <div class="bt-anc"><span>Best / Worst</span><b class="num"><span class="up">${pct(an.best||0)}</span> <span class="down">${pct(an.worst||0)}</span></b></div>
          <div class="bt-anc"><span>Avg hold</span><b class="num">${an.avgHold||0}d</b></div>
          <div class="bt-anc"><span>Max streak</span><b class="num"><span class="up">${an.winStreak||0}W</span> <span class="down">${an.lossStreak||0}L</span></b></div>
        </div></div>`:'';
      // ---- trade log ----
      const log=(d.log&&d.log.length)?`<div class="bt-logwrap"><div class="bt-logttl">Recent trades</div><table class="tbl bt-log"><thead><tr><th>#</th><th>Entry</th><th>Exit</th><th>Hold</th><th>Return</th></tr></thead><tbody>${d.log.map((t,i)=>`<tr><td>${i+1}</td><td class="num">${(+t.entry).toLocaleString('en-US')}</td><td class="num">${(+t.exit).toLocaleString('en-US')}</td><td class="num">${t.days}d</td><td class="num ${cls(t.ret)}">${pct(t.ret)}</td></tr>`).join('')}</tbody></table></div>`:'';
      body=stat+curveBlock+benchBlock+vr+ddBlock+monthlyHeat(d.monthly)+decayLine+mcBlock+analytics+log;
    }
  }
  return note+picker+body;
}
// ---- crypto Forward Test + Accuracy (real closed-trade track record from the 24/7 harness) ----
const CRYPTOFWD={loaded:false,busy:false,data:null};
// per-strategy capital allocation (the user's deploy dial, 0-100%), read from + written to the
// backend, which the 24/7 harness honours when sizing (bot/crypto_alloc.py).
const CRYPTOALLOC={loaded:false,busy:false,data:null};
async function loadCryptoAlloc(){ if(CRYPTOALLOC.busy) return; CRYPTOALLOC.busy=true;
  try{ CRYPTOALLOC.data=await fetch(`${BOT_API}/api/crypto/allocation`).then(r=>r.json()); }catch(e){ CRYPTOALLOC.data={running:false}; }
  CRYPTOALLOC.loaded=true; CRYPTOALLOC.busy=false; }
// write a strategy's allocation weight (0-1), optimistic UI + persists to the harness.
function cxSetAlloc(id, w){
  w=Math.max(0,Math.min(1,w));
  const rec=((CRYPTOALLOC.data&&CRYPTOALLOC.data.strategies)||[]).find(x=>x.id===id); if(rec) rec.weight=w;   // optimistic
  fetch(`${BOT_API}/api/crypto/allocation`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,weight:w})})
    .then(r=>r.json()).then(res=>{ if(res&&res.ok) announce(`Allocation for ${id} set to ${Math.round(w*100)}%, the engine sizes within this cap next cycle.`); })
    .catch(()=>announce('Could not save allocation, bot API unreachable.'));
}
async function loadCryptoFwd(){ if(CRYPTOFWD.busy) return; CRYPTOFWD.busy=true;
  try{ CRYPTOFWD.data=await fetch(`${BOT_API}/api/crypto/forward`).then(r=>r.json()); }catch(e){ CRYPTOFWD.data={running:false}; }
  CRYPTOFWD.loaded=true; CRYPTOFWD.busy=false; }
function cryptoForward(mode){   // mode: 'forward' | 'accuracy'
  const d=CRYPTOFWD.data;
  if(!d){ if(!CRYPTOFWD.busy) loadCryptoFwd().then(()=>{ if(isAlgo()&&state.algo.market==='crypto') renderAlgo(); }); return secEmpty('activity','Loading track record…','Reading closed crypto trades from the harness log.'); }
  const rows=d.strategies||[], t=d.totals||{};
  if(!rows.length){ return secEmpty('activity','No closed trades yet',`The 24/7 crypto harness books this as it runs, win%, profit factor and expectancy appear once positions close. Open positions are on the <b>Monitor</b> tab.`); }
  const acc=mode==='accuracy';
  const note=`<div class="cx-preview-note">${icon('shield',13)}<span><b>${acc?'Forward accuracy':'Forward test'}, real out-of-sample.</b> Every metric below is from <b>closed</b> paper trades on live Binance data (not a backtest, not fabricated). ${acc?'Win% and profit factor are the honest edge measure.':'This is the live track record the go-live gate would judge.'}</span></div>`;
  const stat=secStats([
    {l:'Closed trades',v:String(t.closed||0),s:`${t.wins||0}W / ${t.losses||0}L`},
    {l:'Win rate',v:t.winPct==null?'-':t.winPct+'%',s:'across all strategies',tone:(t.winPct>=50)?'up':(t.winPct<45?'down':'')},
    {l:'Profit factor',v:t.profitFactor==null?'-':(+t.profitFactor).toFixed(2),s:'gross win ÷ loss',tone:(t.profitFactor>=1.3)?'up':(t.profitFactor<1?'down':'')},
    {l:'Net P&L',v:cxMoney(t.netPnl),s:'realised, closed',tone:(t.netPnl>0)?'up':(t.netPnl<0?'down':'')},
  ]);
  const {curReg:reg, fitMap}=cxRegimeFit();
  const regBanner=reg&&reg!=='-'?`<div class="ft-regime"><div class="ft-regime-ic">${icon('activity',15)}</div><div><b>Live regime: ${esc(reg)}</b><span>The go-live gate judges each strategy net of costs. Strategies proven <b>fit for this regime</b> (green) carry the edge; the rest are stood down to cash, that's survival-first, not idle.</span></div></div>`:'';
  const GRAD=50;   // go-live sample bar: ≥50 closed trades to be judged
  const head=`<div class="cxm-row cxf-row cxm-head"><div class="cxm-name">Strategy · go-live progress</div><span class="cxm-n">Trades</span><span class="cxm-n">Win%</span><span class="cxm-n">PF</span><span class="cxm-n">Expectancy</span><span class="cxm-n">Net</span></div>`;
  const body=rows.map(s=>{const g=Math.min(100,Math.round((s.closed/GRAD)*100)),cleared=s.closed>=GRAD;
    return `<div class="cxm-row cxf-row"><div class="cxm-name"><b>${esc(s.name)}</b> <span class="cxf-cls">${esc(s.instr||'spot')}</span>${cxStratBadge(s, fitMap[s.id], reg)}
    <div class="cxf-grad" title="${s.closed}/${GRAD} closed trades toward the go-live sample"><i class="${cleared?'done':''}" style="width:${g}%"></i></div>
    <span class="cxf-gradlbl">${cleared?'✓ sample cleared':`${s.closed}/${GRAD} to go-live`}</span></div>
    <span class="cxm-n num">${s.closed}</span>
    <span class="cxm-n num ${s.winPct>=50?'up':(s.winPct<45?'down':'')}">${s.winPct==null?'-':s.winPct+'%'}</span>
    <span class="cxm-n num ${s.profitFactor>=1.3?'up':(s.profitFactor<1?'down':'')}">${s.profitFactor==null?'-':(+s.profitFactor).toFixed(2)}</span>
    <span class="cxm-n num ${cls(s.expectancy)}">${cxMoney(s.expectancy)}</span>
    <span class="cxm-n num ${cls(s.netPnl)}"><b>${cxMoney(s.netPnl)}</b></span></div>`;}).join('');
  return note+regBanner+stat+`<div class="cxm-tbl-h">${icon('activity',13)}<b>Per-strategy ${acc?'accuracy':'track record'}</b><span>${rows.length} with closed trades</span></div><div class="cxm-tbl">${head}${body}</div>`;
}
// ---- crypto Analytics (P&L attribution by instrument / strategy / regime) ----
const CRYPTOAN={loaded:false,busy:false,data:null};
async function loadCryptoAn(){ if(CRYPTOAN.busy) return; CRYPTOAN.busy=true;
  try{ CRYPTOAN.data=await fetch(`${BOT_API}/api/crypto/analytics`).then(r=>r.json()); }catch(e){ CRYPTOAN.data={running:false}; }
  CRYPTOAN.loaded=true; CRYPTOAN.busy=false; }
const CX_INSTR_LABEL={spot:'Spot',perps:'Perpetuals',options:'Options'};
// realised equity curve: cumulative net P&L over the closed-trade sequence (all real, from the log)
function cxEquityCurve(pts){
  if(!pts||pts.length<2) return '';
  const ys=pts.map(p=>p.cum), min=Math.min(0,...ys), max=Math.max(0,...ys), rng=(max-min)||1, W=560,H=140;
  const X=i=>(i/(pts.length-1)*W), Y=v=>(H-(v-min)/rng*H);
  const line=pts.map((p,i)=>`${X(i).toFixed(1)},${Y(p.cum).toFixed(1)}`).join(' ');
  const zero=Y(0).toFixed(1), last=pts[pts.length-1].cum, tone=last>=0?'up':'down';
  const area=`0,${zero} ${line} ${W},${zero}`;
  return `<svg class="cxeq-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
    <line class="cxbt-base" x1="0" y1="${zero}" x2="${W}" y2="${zero}"/>
    <polygon class="cxeq-area ${tone}" points="${area}"/>
    <polyline class="cxeq-line ${tone}" points="${line}"/></svg>`;
}
// download the closed-trade set the analytics is built from as CSV (real rows, nothing synthesised)
function cxTradesCSV(){
  const rows=(CRYPTOAN.data&&CRYPTOAN.data.recent)||[];
  if(!rows.length){ announce('No closed trades to export'); return; }
  const head=['time','strategy','symbol','pnl','cost','exit_reason','regime'];
  const csv=[head.join(',')].concat(rows.map(r=>[r.time,r.strat,r.sym,r.pnl,r.cost,r.reason,r.regime]
    .map(x=>`"${String(x==null?'':x).replace(/"/g,'""')}"`).join(','))).join('\n');
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
  a.download='crypto-closed-trades.csv'; a.click(); URL.revokeObjectURL(a.href);
}
function cryptoAnalytics(){
  const d=CRYPTOAN.data;
  if(!d){ if(!CRYPTOAN.busy) loadCryptoAn().then(()=>{ if(isAlgo()&&state.algo.market==='crypto') renderAlgo(); }); return secEmpty('activity','Loading analytics…','Attributing the crypto P&L by instrument, strategy, regime, symbol, exit-reason and hour.'); }
  if(d.running===false){ return secEmpty('activity','Analytics offline','Start the crypto harness, analytics attributes its live book once it is running.'); }
  const t=d.totals||{}, st=d.stats||{}, note=`<div class="cx-preview-note">${icon('shield',13)}<span><b>P&L attribution, real, from the closed-trade log.</b> Every realised figure below is computed from actual closed paper trades (not estimated): the equity curve, and the splits by regime, symbol, exit-reason and hour. Open P&L is marked live. Nothing here is synthesised.</span></div>`;
  // live-book summary (open + realised), the running picture
  const stat=secStats([
    {l:'Realised',v:cxMoney(t.realised),s:'booked',tone:t.realised>0?'up':(t.realised<0?'down':'')},
    {l:'Unrealised',v:cxMoney(t.unreal),s:'open · live',tone:t.unreal>0?'up':(t.unreal<0?'down':'')},
    {l:'Net',v:cxMoney(t.pnl),s:'realised + unrealised',tone:t.pnl>0?'up':(t.pnl<0?'down':'')},
    {l:'Current regime',v:esc(d.regime||'-'),s:'BTC-led'},
  ]);
  // closed-trade quality (all real, from the log)
  const qual=st.n?secStats([
    {l:'Closed trades',v:String(st.n),s:`win ${st.winRate}%`},
    {l:'Profit factor',v:st.profitFactor==null?'-':(+st.profitFactor).toFixed(2),s:'gross win ÷ loss',tone:(st.profitFactor>=1.3)?'up':(st.profitFactor<1?'down':'')},
    {l:'Avg win / loss',v:`${cxMoney(st.avgWin)} / ${cxMoney(st.avgLoss)}`,s:'per trade',tone:(st.avgWin>=Math.abs(st.avgLoss))?'up':'down'},
    {l:'Max drawdown',v:cxMoney(st.maxDrawdown),s:'realised, peak-to-trough',tone:'down'},
    {l:'Cost paid',v:cxMoney(-Math.abs(st.totalCost||0)),s:'brokerage + TDS + fees',tone:'down'},
    {l:'Realised net',v:cxMoney(st.net),s:`${st.n} closed`,tone:st.net>0?'up':(st.net<0?'down':'')},
  ]):'';
  // realised equity curve
  const eq=cxEquityCurve(d.equity);
  const eqBlock=eq?`<div class="cxm-tbl-h">${icon('activity',13)}<b>Realised equity curve</b><span>cumulative net · by closed-trade #</span></div><div class="cxbt-chart">${eq}</div>`:'';
  // instrument attribution
  const inst=Object.entries(d.byInstrument||{}).sort((a,b)=>b[1].pnl-a[1].pnl).map(([k,v])=>
    `<div class="cxm-row"><div class="cxm-name"><b>${esc(CX_INSTR_LABEL[k]||k)}</b> <span class="cxf-cls">${v.n} strat</span></div>
      <span class="cxm-n num">${v.openPos}</span>
      <span class="cxm-n num ${cls(v.realised)}">${cxMoney(v.realised)}</span>
      <span class="cxm-n num ${cls(v.open)}">${cxMoney(v.open)}</span>
      <span class="cxm-n num ${cls(v.pnl)}"><b>${cxMoney(v.pnl)}</b></span></div>`).join('')
    ||'<div class="cxr-empty" style="padding:11px 13px">No positions yet</div>';
  const instHead=`<div class="cxm-row cxm-head"><div class="cxm-name">Instrument</div><span class="cxm-n">Open</span><span class="cxm-n">Realised</span><span class="cxm-n">Unreal.</span><span class="cxm-n">Net</span></div>`;
  // a real breakdown table: label · net · trades · win% (sorted worst→best so the drags surface)
  const bkTable=(obj,labfn,asc)=>{ const e=Object.entries(obj||{}).sort((a,b)=>asc?a[1].net-b[1].net:b[1].net-a[1].net);
    if(!e.length) return '<div class="cxr-empty" style="padding:11px 13px">No closed trades yet</div>';
    const head=`<div class="cxm-row cxf-row cxm-head" style="grid-template-columns:1.6fr 70px 90px 110px"><div class="cxm-name">Bucket</div><span class="cxm-n">Trades</span><span class="cxm-n">Win%</span><span class="cxm-n">Net</span></div>`;
    return `<div class="cxm-tbl">${head}`+e.map(([k,v])=>{const wr=v.n?Math.round(100*v.wins/v.n):0;
      return `<div class="cxm-row cxf-row" style="grid-template-columns:1.6fr 70px 90px 110px"><div class="cxm-name"><b>${esc(labfn?labfn(k):k)}</b></div>
      <span class="cxm-n num">${v.n}</span><span class="cxm-n num ${wr>=50?'up':(wr<45?'down':'')}">${wr}%</span>
      <span class="cxm-n num ${cls(v.net)}"><b>${cxMoney(v.net)}</b></span></div>`;}).join('')+`</div>`; };
  // regime attribution (chips, quick glance)
  const regs=Object.entries(d.byRegime||{}).sort((a,b)=>b[1].net-a[1].net);
  const regChips=regs.length?regs.map(([r,v])=>`<span class="cxm-chip ${cls(v.net)}">${esc(r)} <i>${cxMoney(v.net)} · ${v.n}t</i></span>`).join(''):'<span class="cxr-empty">No closed trades yet</span>';
  // by-hour mini bars (net per hour-of-day, shows when the book makes/loses money)
  const hrs=Object.entries(d.byHour||{}).filter(([k])=>k!=='-').sort((a,b)=>a[0].localeCompare(b[0]));
  const hrMax=hrs.length?Math.max(...hrs.map(([,v])=>Math.abs(v.net)),1):1;
  const hrBars=hrs.length?`<div class="cxhr-bars">`+hrs.map(([h,v])=>{const up=v.net>=0,ph=Math.round(Math.abs(v.net)/hrMax*100);
    return `<div class="cxhr-col" title="${esc(h)} · ${v.n} trades · net ${cxMoney(v.net)}"><div class="cxhr-track"><i class="cxhr-fill ${up?'up':'down'}" style="height:${Math.max(4,ph)}%"></i></div><span class="cxhr-lbl">${esc(h.slice(0,2))}</span></div>`;}).join('')+`</div>`:'';
  // strategy contributors
  const strat=(d.byStrategy||[]);
  const contrib=strat.length?strat.map(s=>`<div class="cxm-row cxf-row" style="grid-template-columns:1.5fr 90px 90px"><div class="cxm-name"><b>${esc(s.name)}</b> <span class="cxf-cls">${esc(s.instr)}</span></div><span class="cxm-n"></span><span class="cxm-n num ${cls(s.pnl)}"><b>${cxMoney(s.pnl)}</b></span></div>`).join(''):'<div class="cxr-empty" style="padding:11px 13px">No active strategies</div>';
  // recent closed-trade feed (newest first, capped) + CSV export
  const rec=(d.recent||[]).slice(0,40);
  const feedHead=`<div class="cxm-tbl-h">${icon('activity',13)}<b>Recent closed trades</b><span>newest first · ${(d.recent||[]).length} exported</span><button class="cxan-csv" data-cxcsv="1">${icon('download',12)} CSV</button></div>`;
  const feed=rec.length?`<div class="cxm-tbl">`+rec.map(r=>`<div class="cxm-row cxf-row" style="grid-template-columns:56px 1.3fr 1fr 90px">
    <span class="cxm-n" style="text-align:left;opacity:.6;font-variant-numeric:tabular-nums">${esc(r.time||'')}</span>
    <div class="cxm-name"><b>${esc(r.strat)}</b> <span class="cxf-cls">${esc(r.sym.replace('USDT',''))}</span></div>
    <span class="cxm-n" style="text-align:left"><span class="cxrsn cxrsn-${esc((r.reason||'').replace(/[^a-z]/gi,''))}">${esc(r.reason)}</span> <i style="opacity:.5">${esc(r.regime)}</i></span>
    <span class="cxm-n num ${cls(r.pnl)}"><b>${cxMoney(r.pnl)}</b></span></div>`).join('')+`</div>`:'<div class="cxr-empty" style="padding:11px 13px">No closed trades yet</div>';
  return note+stat+qual+eqBlock+
    `<div class="cxm-tbl-h">${icon('layout',13)}<b>By instrument class</b><span>Spot / Perps / Options</span></div><div class="cxm-tbl">${instHead}${inst}</div>`+
    `<div class="cxm-tbl-h">${icon('cpu',13)}<b>By exit reason</b><span>where P&L is made & lost, worst first</span></div>${bkTable(d.byReason,null,true)}`+
    `<div class="cxm-tbl-h">${icon('activity',13)}<b>By symbol</b><span>net per coin, worst first</span></div>${bkTable(d.bySymbol,k=>k.replace('USDT',''),true)}`+
    (hrBars?`<div class="cxm-tbl-h">${icon('activity',13)}<b>By hour of day</b><span>net per hour (UTC clock)</span></div>${hrBars}`:'')+
    `<div class="cxm-tbl-h">${icon('cpu',13)}<b>By regime</b><span>realised, from closed trades</span></div><div class="cxm-pos">${regChips}</div>`+
    `<div class="cxm-tbl-h">${icon('activity',13)}<b>Strategy contributors</b><span>top by total P&L</span></div><div class="cxm-tbl">${contrib}</div>`+
    feedHead+feed;
}
// ---- Go-live readiness gate (net-of-cost evidence per strategy vs the bar) ----
const READY={data:{},busy:{}};
async function loadReadiness(mkt){ if(READY.busy[mkt]) return; READY.busy[mkt]=true;
  try{ READY.data[mkt]=await fetch(`${BOT_API}/api/readiness/book?market=${mkt}`).then(r=>r.json()); }catch(e){ READY.data[mkt]={err:true}; }
  READY.busy[mkt]=false; }
function readinessView(mkt){
  const d=READY.data[mkt];
  const money=mkt==='crypto'?cxMoney:(v=>(v==null||!isFinite(v))?'-':(v<0?'−':'+')+'₹'+Math.abs(Math.round(v)).toLocaleString('en-IN'));
  if(!d){ if(!READY.busy[mkt]) loadReadiness(mkt).then(()=>{ if(isAlgo()) renderAlgo(); }); return secEmpty('shield','Assessing go-live readiness…','Scoring each strategy against the bar.'); }
  if(d.err){ return secEmpty('shield','Readiness unavailable','The trading engine is temporarily unreachable.'); }
  const s=d.summary||{}, bar=d.bar||{};
  const verdict=d.goLive?'READY':(s.ready>0?'PARTIAL, not all clear':'NOT READY');
  const banner=`<div class="rdy-banner ${d.goLive?'ok':'no'}">${icon(d.goLive?'check':'shield',22)}
    <div><b>Go-live: ${verdict}</b><span>${s.ready||0} ready · ${s.gathering||0} gathering · ${s.cull||0} to cull, of ${s.total||0} strategies with closed trades.</span></div>
    <span class="rdy-bar">Bar: ≥${bar.minTrades} trades · PF ≥ ${bar.minProfitFactor} · ≥${bar.minRegimes} regimes · +expectancy after costs</span></div>`;
  const note=`<div class="cx-preview-note">${icon('shield',13)}<span><b>Honest go-live gate.</b> Every number is <b>net of realistic costs</b> (brokerage + STT/fees + slippage) from CLOSED paper trades. A strategy is <b>READY</b> only with a real sample across multiple regimes, a few lucky trades read as <b>gathering</b>. <b>CULL</b> = auto-benched for negative expectancy.</span></div>`;
  const rows=(d.strategies||[]).map(r=>{
    const vlbl=r.verdict==='ready'?'READY':r.verdict==='cull'?'CULL':'GATHERING';
    const regimes=(r.regimes||[]).length?`<div class="cxm-pos">${r.regimes.map(g=>`<span class="cxm-chip">${esc(g)}</span>`).join('')}</div>`:'';
    return `<div class="cxm-row rdy-row"><div class="cxm-name"><b>${esc(r.name)}</b> <span class="rdy-badge ${esc(r.verdict)}">${vlbl}</span>${regimes}</div>
      <span class="cxm-n num">${r.closed}</span>
      <span class="cxm-n num ${r.winPct>=50?'up':(r.winPct<45?'down':'')}">${r.winPct==null?'-':r.winPct+'%'}</span>
      <span class="cxm-n num ${r.profitFactor>=bar.minProfitFactor?'up':(r.profitFactor<1?'down':'')}">${r.profitFactor==null?'-':(+r.profitFactor).toFixed(2)}</span>
      <span class="cxm-n num ${cls(r.expectancy)}">${money(r.expectancy)}</span></div>`;
  }).join('');
  const head=`<div class="cxm-row rdy-row cxm-head"><div class="cxm-name">Strategy · verdict</div><span class="cxm-n">Trades</span><span class="cxm-n">Win%</span><span class="cxm-n">PF</span><span class="cxm-n">Expectancy</span></div>`;
  return banner+note+`<div class="cxm-tbl-h">${icon('activity',13)}<b>Per-strategy verdict</b><span>ranked: ready → gathering → cull</span></div><div class="cxm-tbl">${head}${rows||'<div class="cxr-empty" style="padding:11px 13px">No closed trades yet, the gate fills as the harness runs</div>'}</div>`;
}
// ---- Strategy × regime fit matrix (learned, drives live selection) ----
const RFIT={data:{},busy:{}};
async function loadRegimeFit(mkt){ if(RFIT.busy[mkt]) return; RFIT.busy[mkt]=true;
  try{ RFIT.data[mkt]=await fetch(`${BOT_API}/api/regime-fit?market=${mkt}`).then(r=>r.json()); }catch(e){ RFIT.data[mkt]={err:true}; }
  RFIT.busy[mkt]=false; }
function regimeFitMatrix(mkt){
  const d=RFIT.data[mkt];
  if(!d){ if(!RFIT.busy[mkt]) loadRegimeFit(mkt).then(()=>{ if(isAlgo())renderAlgo(); }); return ''; }
  if(d.err||!(d.strategies||[]).length) return '';
  const regs=d.regimes||[], cur=d.currentRegime;
  const note=`<div class="cx-preview-note">${icon('shield',13)}<span><b>Regime fit, learned, not assumed.</b> Each cell is a strategy's <b>net-of-cost</b> edge in that regime (needs ${d.minTrades}+ trades to call it). In the live regime (<b>${esc(cur)}</b> ●) the book <b>benches proven losers and deploys proven winners</b>; the safe default stands where evidence is thin, so we run the right strategies for the conditions.</span></div>`;
  const head=`<div class="rf-row rf-head"><span class="rf-name">Strategy</span>${regs.map(r=>`<span class="rf-col${r===cur?' cur':''}">${esc(r)}${r===cur?' ●':''}</span>`).join('')}</div>`;
  const cell=c=>{ if(!c||!c.n) return '<span class="rf-cell rf-none">·</span>';
    const lbl=c.verdict==='fit'?'FIT':c.verdict==='unfit'?'UNFIT':'…';
    return `<span class="rf-cell rf-${esc(c.verdict)}" title="${c.n} trades · win ${c.winPct}% · PF ${c.pf} · expectancy ${c.expectancy}">${lbl} <i>${c.n}</i></span>`; };
  const rows=d.strategies.map(s=>`<div class="rf-row"><span class="rf-name"><b>${esc(s.name)}</b></span>${regs.map(r=>cell((s.cells||{})[r])).join('')}</div>`).join('');
  return `<div class="cxm-tbl-h">${icon('cpu',13)}<b>Strategy × regime fit</b><span>green FIT · red UNFIT · grey gathering, drives live selection</span></div>`+note+`<div class="rf-grid" style="grid-template-columns:1.6fr repeat(${regs.length},1fr)">${head}${rows}</div>`;
}
// Crypto-scoped router: every Algo Studio tab stays in sync with the crypto market (no Indian content leaks).
function cryptoBody(view,label){
  if(view==='library'||view==='market') return cryptoMarket();
  if(view==='opportunity') return cryptoOpportunity();
  if(view==='leaderboard') return cryptoLeaderboard();
  if(view==='monitor') return cryptoMonitor();
  if(view==='positions') return cryptoPositions();
  if(view==='risk') return cryptoRisk();
  if(view==='backtest') return cryptoBacktest();
  if(view==='forward') return cryptoForward('forward');
  if(view==='accuracy') return readinessView('crypto');
  if(view==='analytics') return cryptoAnalytics()+regimeFitMatrix('crypto');
  return cryptoSoon(label);
}

// Studio-wide scope toggle (Equity/Options/Futures + holding style), rendered once in the
// chrome, below the tabs, so every tab is scoped consistently. Counts are the strategy
// universe (the Library catalog) so the number means the same on every tab.
function studioScopeBar(){
  const {instr,hold}=studioScope();
  const instrCount=i=>STRAT_LIBRARY.filter(s=>instrOf(s)===i).length;
  const holdCount=(i,h)=>STRAT_LIBRARY.filter(s=>instrOf(s)===i&&holdOf(s)===h).length;
  const instrBar=`<div class="lib-instr" role="tablist" aria-label="Instrument class">${INSTR_TABS.map(([id,lab,ic,desc])=>
    `<button class="lib-instr-tab${instr===id?' on':''}" data-algoinstr="${id}" role="tab" aria-selected="${instr===id}">
      <span class="lii-top">${icon(ic,15)}<b>${esc(lab)}</b><i class="lii-n">${instrCount(id)}</i></span>
      <span class="lii-desc">${esc(desc)}</span></button>`).join('')}</div>`;
  const holdBar=`<div class="lib-hold" role="tablist" aria-label="Holding style">`+
    `<button class="lib-hold-tab${hold==='all'?' on':''}" data-algohold="all" role="tab" aria-selected="${hold==='all'}">All <i>${instrCount(instr)}</i></button>`+
    (HOLD_TABS[instr]||[]).map(h=>`<button class="lib-hold-tab${hold===h?' on':''}" data-algohold="${h}" role="tab" aria-selected="${hold===h}" title="${esc(HOLD_DESC[h])}">${esc(HOLD_LABEL[h])} <i>${holdCount(instr,h)}</i></button>`).join('')+
    `</div>`;
  return `<div class="av-scope">${instrBar}${holdBar}</div>`;
}
// honest empty state that names the active scope (used when a tab is empty BECAUSE of the scope)
function scopeEmpty(ic,title,msg,cta){ const {instr,hold}=studioScope();
  const chip=`<div class="av-scope-empty">${icon('layout',12)}<span>Scope · <b>${esc(INSTR_LABEL[instr])}${hold!=='all'?' · '+esc(HOLD_LABEL[hold]):''}</b></span></div>`;
  return chip+secEmpty(ic,title,msg,cta); }
// honest note for portfolio/engine-level tabs that are deliberately NOT scoped by instrument
function scopeNote(msg){ return `<div class="av-scope-note">${icon('layout',12)}<span>${msg}</span></div>`; }
function renderAlgo(){
  const v=$('algoView'); if(!v) return;
  if(!isAlgo()){ v.innerHTML=''; return; }
  state.algo=state.algo||{view:'monitor',bt:{algo:0,period:'1Y'}};
  if(!state.algo.view) state.algo.view='monitor';
  if(['market','opportunity','leaderboard'].includes(state.algo.view)) state.algo.view='monitor';  // retired tabs → land on Monitor
  if(!state.algo.bt) state.algo.bt={algo:0,period:'1Y'};   // guard: setMarket/studioScope can create state.algo before this default
  if(!state.algo.exec) state.algo.exec='paper';
  state.algo.market='crypto';
  if(!state.algo.cinstr) state.algo.cinstr='spot';   // crypto instrument scope (Spot/Perps/Options)
  const crypto=true;
  if(!BOT.loaded){ loadBotData().then(()=>{ if(isAlgo())renderAlgo(); }); }
  if(!CRYPTO.loaded && !CRYPTO.busy){ loadCrypto().then(()=>{ if(isAlgo()&&state.algo.market==='crypto') renderAlgo(); }); }
  const view=state.algo.view;
  if((view==='monitor'||view==='positions') && !CRYPTOMON.loaded && !CRYPTOMON.busy){ loadCryptoMonitor().then(()=>{ if(isAlgo()&&state.algo.market==='crypto') renderAlgo(); }); }
  const depN=cxActive();   // Monitor badge reflects deployed strategy count
  // Decluttered for clarity: a simple left-to-right flow: watch → browse → hold → prove → protect → history.
  // (Retired: Marketplace [dup of Library], Leaderboard [dup of Forward Test/Accuracy], Opportunity Engine [equity discretionary picker].)
  const tabs=[['monitor','Monitor'],['library','Library'],['positions','Positions'],['forward','Forward Test'],['accuracy','Accuracy'],['analytics','Analytics'],['risk','Risk Governor'],['backtest','Backtest']];
  const head=`<div class="av-head">
    <div class="av-title"><span class="av-ic">${icon('cpu',17)}</span><div><b>Algo Studio</b><span>Crypto · live Binance data · paper trading, 24/7</span></div></div>
    <div class="av-tabs" role="tablist" aria-label="Algo views">${tabs.map(([k,l])=>`<button class="av-tab${k===view?' on':''}" role="tab" aria-selected="${k===view}" data-algoview="${k}">${l}${k==='monitor'&&depN?` <i class="av-tn">${depN}</i>`:''}</button>`).join('')}</div></div>`;
  const tabLabel=(tabs.find(t=>t[0]===view)||[,'This view'])[1];
  const body=cryptoBody(view,tabLabel);
  // Preserve scroll across the full innerHTML rebuild so in-place CTAs (sort, filter, scope toggles, sub-tabs,
  // live P&L patches) don't flick/jump to the top. The algo view scrolls EITHER the page, the .pane-center, OR
  // the inner .av-scroll depending on layout: capture and restore ALL THREE. Reset to top ONLY on real
  // navigation: a market switch or a TAB (view) change. Scope toggles (instrument/holding) are in-tab filters,
  // NOT navigation, so they keep your place (that was the "every click jumps me to the hero" bug).
  const _scEl=document.scrollingElement||document.documentElement;
  const _pane=v.closest('.pane-center');
  const _av0=v.querySelector('.av-scroll');
  const _vk='crypto/'+view;
  const _keep=(state.algo._vk===_vk); state.algo._vk=_vk;
  const _sy=_keep?_scEl.scrollTop:0, _py=(_keep&&_pane)?_pane.scrollTop:0, _avy=(_keep&&_av0)?_av0.scrollTop:0;
  // crypto instrument scope (Spot/Perps/Options) shows on every tab except Monitor/Positions, which render it inline.
  const cxScope=['monitor','positions'].includes(view)?'':cryptoScopeBar();
  v.innerHTML=`<div class="av-wrap">${head}<div class="av-scroll">${cryptoStatusBar()}${cxScope}${body}</div></div>`;
  _scEl.scrollTop=_sy; if(_pane) _pane.scrollTop=_py;
  const _av1=v.querySelector('.av-scroll'); if(_av1) _av1.scrollTop=_avy;
  v.querySelectorAll('[data-algoview]').forEach(b=>b.onclick=()=>{state.algo.view=b.dataset.algoview;renderAlgo();});
  v.querySelectorAll('[data-algoinstr]').forEach(b=>b.onclick=()=>{ const a=state.algo; if(a.instr===b.dataset.algoinstr) return; a.instr=b.dataset.algoinstr; a.hold='all'; if(a.lib) a.lib.fam='all'; renderAlgo(); });
  v.querySelectorAll('[data-algohold]').forEach(b=>b.onclick=()=>{ state.algo.hold=b.dataset.algohold; renderAlgo(); });
  v.querySelectorAll('[data-cinstr]').forEach(b=>b.onclick=()=>{ state.algo.cinstr=b.dataset.cinstr; renderAlgo(); });
  v.querySelectorAll('[data-cbtstrat]').forEach(b=>b.onclick=()=>{ state.algo.cbt=state.algo.cbt||{strat:'macross',period:'1Y'}; state.algo.cbt.strat=b.dataset.cbtstrat; renderAlgo(); });
  v.querySelectorAll('[data-cbtperiod]').forEach(b=>b.onclick=()=>{ state.algo.cbt=state.algo.cbt||{strat:'macross',period:'1Y'}; state.algo.cbt.period=b.dataset.cbtperiod; renderAlgo(); });
  v.querySelectorAll('[data-cxcsv]').forEach(b=>b.onclick=cxTradesCSV);
  v.querySelectorAll('[data-cxgl]').forEach(b=>b.onclick=e=>{e.stopPropagation();cryptoGoLiveCheck(b.dataset.cxgl);});
  v.querySelectorAll('[data-cxalloc]').forEach(sl=>{
    let _t=null;
    sl.oninput=()=>{ const lab=v.querySelector('[data-cxallocval="'+CSS.escape(sl.dataset.cxalloc)+'"]'); if(lab)lab.textContent=sl.value+'%';
      clearTimeout(_t); _t=setTimeout(()=>cxSetAlloc(sl.dataset.cxalloc,(+sl.value)/100), 400); };   // debounce the write while dragging
    sl.onchange=()=>{ clearTimeout(_t); cxSetAlloc(sl.dataset.cxalloc,(+sl.value)/100); };            // commit immediately on release
    sl.onclick=e=>e.stopPropagation();
  });
  v.querySelectorAll('[data-algogoto]').forEach(b=>b.onclick=()=>{state.algo.view=b.dataset.algogoto;renderAlgo();});
  v.querySelectorAll('[data-cxdep]').forEach(b=>b.onclick=()=>cryptoLibDeploy(b.dataset.cxdep));
  // Monitor accordion: click a strategy to reveal its positions + forward accuracy.
  // Toggles the class directly (no re-render) → smooth, and survives the 2s live poll.
  v.querySelectorAll('[data-monexp]').forEach(el=>{
    const tog=e=>{ if(e&&e.target&&e.target.closest('[data-algogl],[data-cxgl],[data-algogoto]'))return;
      const id=el.dataset.monexp, m=state.algo.monExpand=state.algo.monExpand||{}; m[id]=!m[id];
      const card=el.closest('.mon-card'); if(card)card.classList.toggle('open',m[id]); el.setAttribute('aria-expanded',String(!!m[id])); };
    el.onclick=tog;
    el.onkeydown=e=>{ if(e.key==='Enter'||e.key===' '){e.preventDefault();tog(e);} };
  });
  v.querySelectorAll('[data-execmode]').forEach(b=>b.onclick=()=>{state.algo.exec=b.dataset.execmode;renderAlgo();});
  v.querySelectorAll('[data-monsort]').forEach(b=>b.onclick=()=>{state.algo.monSort=b.dataset.monsort;renderAlgo();});
  v.querySelectorAll('[data-monfilter]').forEach(b=>b.onclick=()=>{state.algo.monFilter=b.dataset.monfilter;renderAlgo();});
  v.querySelectorAll('[data-cxlibcat]').forEach(b=>b.onclick=()=>{state.algo.cxLibCat=b.dataset.cxlibcat;renderAlgo();});
  state.algo._sig=algoLiveSig();   // snapshot structure so the 2s poll knows when a full re-render is needed
}
/* ===== Info icons + plain-English definitions for every metric/strategy ===== */
function infoI(tip){return tip?`<span class="info-i" title="${esc(tip)}" role="img" aria-label="${esc(tip)}" tabindex="0">i</span>`:'';}
const POS_ACT={hold:['Hold','hold'],protect:['Protect profit','protect'],watch:['Watch','watch'],exit:['Exit, thesis decayed','exit']};
function posTone(h){ return (h==null)?'na':h>=70?'hi':h>=50?'mid':'lo'; }
function timeAgo(iso){ try{ const s=Math.max(0,(Date.now()-new Date(iso).getTime())/1000);
  if(s<60)return Math.round(s)+'s ago'; if(s<3600)return Math.round(s/60)+'m ago';
  if(s<86400)return Math.round(s/3600)+'h ago'; return Math.round(s/86400)+'d ago'; }catch(e){return '';} }
function ddCurveSVG(dd){
  const W=600,H=70,pad=6;
  const pts=(Array.isArray(dd)&&dd.length>1)?dd:[0,0];
  const lo=Math.min(...pts,-0.01);                          // most-negative; avoid /0
  const X=i=>i/(pts.length-1)*W, Y=v=>pad+(v/lo)*(H-2*pad); // 0 at top, worst at bottom
  const d=pts.map((v,i)=>(i?'L':'M')+X(i).toFixed(1)+','+Y(v).toFixed(1)).join(' ');
  const area=d+` L${W},${pad} L0,${pad} Z`;
  return `<svg class="dd-svg" width="100%" height="${H}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Drawdown curve, worst ${Math.round(Math.min(...pts))} percent"><path class="dd-area" d="${area}"/><path class="dd-line" d="${d}"/></svg>`;
}
function monthlyHeat(monthly){
  if(!Array.isArray(monthly)||!monthly.length) return '';
  const byY={}; monthly.forEach(m=>{const p=String(m.ym).split('-');(byY[p[0]]=byY[p[0]]||{})[+p[1]]=m.ret;});
  const years=Object.keys(byY).sort();
  const mn=['J','F','M','A','M','J','J','A','S','O','N','D'];
  const cell=v=>{ if(v==null) return '<td class="mh-cell mh-na"></td>'; const a=Math.min(Math.abs(v)/8,.5)+.08; const g=v>=0;
    return `<td class="mh-cell" style="background:${g?`rgba(0,171,78,${a})`:`rgba(229,56,59,${a})`}" title="${v>=0?'+':''}${v}%">${v>=0?'+':''}${Math.round(v)}</td>`; };
  return `<div class="bt-monthly"><div class="bt-anh">${icon('clock',13)} Monthly returns <i>green = up month, red = down</i></div>
    <div class="mh-scroll"><table class="mh-tbl"><thead><tr><th></th>${mn.map((m,i)=>`<th>${m}</th>`).join('')}</tr></thead>
    <tbody>${years.map(y=>`<tr><td class="mh-y">${esc(y)}</td>${[1,2,3,4,5,6,7,8,9,10,11,12].map(mo=>cell(byY[y][mo])).join('')}</tr>`).join('')}</tbody></table></div></div>`;
}
function liveArmed(){ try{ return !!(typeof BOT!=='undefined'&&BOT.liveArmed) || !!(typeof CRYPTOMON!=='undefined'&&CRYPTOMON.data&&CRYPTOMON.data.liveArmed); }catch(e){ return false; } }
function execToggle(paperN,liveN){
  const exec=state.algo.exec||'paper', armed=liveArmed();
  return `<div class="exec-toggle" role="tablist" aria-label="Execution mode">`
    +`<button class="exec-tab${exec==='paper'?' on':''}" data-execmode="paper" role="tab" aria-selected="${exec==='paper'}"><span class="exec-dot paper"></span>Paper<i>${paperN||0}</i></button>`
    +`<button class="exec-tab${exec==='live'?' on':''}${armed?'':' locked'}" data-execmode="live" role="tab" aria-selected="${exec==='live'}" title="${armed?'Live, placing real orders':'Live is locked, a browser can never arm real trading'}"><span class="exec-dot ${armed&&liveN?'live':'off'}"></span>Live${armed?`<i>${liveN||0}</i>`:'<span class="exec-lock" aria-hidden="true">🔒</span>'}</button>`
    +`</div>`;
}
function liveLockedPanel(){
  const crypto=state.algo.market==='crypto';
  return `<div class="exec-locked">${icon('shield',15)}<div><b>Live trading is locked</b>`
    +`<span>Nothing places real orders yet. Live turns on only when <b>all three</b> are true:</span>`
    +`<ol class="exec-req"><li>A strategy has <b>cleared the Go-Live bar</b>: proven forward, net of costs</li>`
    +`<li>Your <b>${crypto?'exchange (Binance)':'broker (Zerodha Kite)'}</b> is connected with <b>trade-only</b> keys</li>`
    +`<li><b>ALLOW_LIVE</b> is armed at the OS level on the bot machine, <b>a browser can never do this</b></li></ol>`
    +`<span class="exec-req-foot">Everything runs in paper until then. This is deliberate, it's what keeps your money safe.</span></div></div>`;
}

/* ============================================================
   AI MODE: copilot chat + AI signals (XSS-safe via esc())
   ============================================================ */
const AI_PROMPTS=['Top movers right now','Find me oversold ideas','Hedge my portfolio','Explain my portfolio health','Best option strategy now'];
function aiWelcome(){return `<b>Hi, I’m your market copilot.</b> ${aiLive()?'I read your <b>real</b> holdings, live prices, the market regime &amp; option chains and can run real backtests, every number I give you is fetched live, never invented.':'Ask me for ideas, a hedge, an option strategy, or a read on your portfolio.'} Try a suggestion below 👇`;}
const aiCfg=()=>state.aiCfg||(state.aiCfg={endpoint:'',model:'claude-opus-4-8'});
const aiLive=()=>!!(aiCfg().endpoint||'').trim();
function setSurface(s,silent){
  state.surface=s; document.documentElement.dataset.surface=s;
  const b=$('surfaceToggle'); if(b){ b.innerHTML=icon(s==='night'?'sun':'moon',16); b.setAttribute('aria-label',s==='night'?'Switch to day mode':'Switch to night trading-floor mode'); b.setAttribute('aria-pressed',s==='night'); }
  if(s==='night'&&!silent) powerOn();
  announce(s==='night'?'Night trading-floor mode on':'Day mode on');
  saveState();
}
function toggleSurface(){ cascadeSurface(state.surface==='night'?'day':'night'); }
function tapeLoop(){ doTick(); const vix=+$('sVix').value, night=state.surface==='night'?0.7:1; const delay=clamp((1500-(vix-8)*42)*night,300,1500); state.tapeT=setTimeout(tapeLoop,delay); }
function applyPaneWidths(){
  const t=document.querySelector('.terminal'); if(!t)return;
  const threePane=state.persona==='trader'||state.persona==='investor';
  if(!threePane){ t.style.gridTemplateColumns=''; return; } // algo/ai are single-pane: drop any stale inline width so the persona stylesheet (1fr) wins
  const wlHidden=threePane && state.cards && state.cards.watchlist==='hidden';
  if(wlHidden){ const bear=document.documentElement.dataset.regime==='bear'; const right=state.paneW?state.paneW.right:(bear?300:332); t.style.gridTemplateColumns=`1fr ${right}px`; }
  else t.style.gridTemplateColumns=state.paneW?`${state.paneW.left}px 1fr ${state.paneW.right}px`:'';
}
function applyChartHeight(){
  const card=$('chartCard'); if(card) card.style.height=state.chartH?state.chartH+'px':'';
}
const sgn=n=>Number.isFinite(n)?(n>=0?'+':'−')+'$'+Math.abs(Math.round(n)).toLocaleString():'-';
const WIDGET_CATALOG={
  trader:[
    {key:'movers',name:'Top Movers',icon:'trendUp',desc:'Biggest gainers & losers right now',render(){
      if(!BOT.live) return `<div class="wg-empty">${icon('shield',13)} Connect the exchange for live movers.</div>`;
      const live=SYMS.filter(s=>s.live!==false);   // exclude symbols with no real quote, never a stale price
      if(!live.length) return `<div class="wg-empty">No live quotes yet.</div>`;
      const g=[...live].sort((a,b)=>b.chg-a.chg), row=s=>`<div class="wg-row"><span class="t-sym">${s.sym}</span><span class="num">${s.ltp.toLocaleString()}</span><span class="num ${cls(s.chg)}">${pct(s.chg)}</span></div>`;
      return `<div class="wg-split"><div><div class="wg-cap up">Gainers</div>${g.slice(0,3).map(row).join('')}</div><div><div class="wg-cap down">Losers</div>${g.slice(-3).reverse().map(row).join('')}</div></div>`;}},
    {key:'pnl',name:'Day P&L',icon:'bolt',desc:'Today’s real P&L across your paper holdings',render(){
      if(!BOT.live||!BOT.holdings) return `<div class="wg-big muted">—</div><div class="wg-empty">Connect the exchange for live Day P&amp;L.</div>`;
      const hs=BOT.holdings.holdings||[];
      if(!hs.length) return `<div class="wg-big">$0</div><div class="wg-empty">No holdings yet, your real Day P&amp;L shows here once you hold positions.</div>`;
      const day=BOT.holdings.dayPnl||0, byPct=[...hs].map(h=>({sym:h.sym,chg:h.dayChangePct||0}));
      const best=[...byPct].sort((a,b)=>b.chg-a.chg)[0], worst=[...byPct].sort((a,b)=>a.chg-b.chg)[0];
      return `<div class="wg-big ${cls(day)}">${sgn(day)}</div><div class="wg-row"><span>Best</span><span class="t-sym">${esc(best.sym)}</span><span class="num ${cls(best.chg)}">${pct(best.chg)}</span></div><div class="wg-row"><span>Worst</span><span class="t-sym">${esc(worst.sym)}</span><span class="num ${cls(worst.chg)}">${pct(worst.chg)}</span></div><div class="wg-foot">${hs.length} holdings · total ${sgn(BOT.holdings.totalPnl||0)}</div>`;}},
    {key:'depth',name:'Market Depth',icon:'sliders',desc:'5-level bid / ask ladder',render(){
      if(!BOT.live) return `<div class="wg-empty">${icon('shield',13)} Connect the exchange for live market depth.</div>`;
      const sel=state.selected||'BTCUSDT', d=BOT.depth;
      if(!d||d.symbol!==sel){ loadDepth(sel); return `<div class="wg-empty">Loading live depth for ${esc(sel)}…</div>`; }
      if(d.error) return `<div class="wg-empty">No depth for ${esc(sel)}, ${esc(d.error)}.</div>`;
      return depthLadderHtml(d);}},
  ],
};
const WIDGET_DEFAULTS={trader:['movers','pnl'],investor:[]};   // investor catalog removed (unreachable persona under CRYPTO_ONLY), key kept for state-init structural compat
const personaKey=()=>isInvestor()?'investor':'trader';
const widgetCatalog=()=>WIDGET_CATALOG[personaKey()];
function activeWidgets(){ if(!state.widgets)state.widgets={trader:WIDGET_DEFAULTS.trader.slice(),investor:WIDGET_DEFAULTS.investor.slice()}; return state.widgets[personaKey()]; }
function renderWidgetStack(){
  const wrap=$('widgetStack'); if(!wrap) return;
  const cat=widgetCatalog(), keys=activeWidgets();
  wrap.innerHTML=keys.map(k=>{const w=cat.find(x=>x.key===k); if(!w) return '';
    return `<div class="wg-card" draggable="true" data-wkey="${k}">
      <div class="wg-head"><span class="wg-ic">${icon(w.icon,13)}</span><b>${w.name}</b>
        <span class="wg-grip" title="Drag to reorder" aria-hidden="true">${icon('grip',13)}</span>
        <button class="wg-x" data-wremove="${k}" title="Remove" aria-label="Remove ${w.name}">${icon('close',12)}</button></div>
      <div class="wg-body">${w.render()}</div></div>`;}).join('');
  wrap.querySelectorAll('[data-wremove]').forEach(b=>b.onclick=e=>{e.stopPropagation();removeWidget(b.dataset.wremove);});
  initWidgetDnD();
}
function openWidgetGallery(o){ const g=$('widgetGallery'); if(!g)return; g.classList.toggle('collapsed',!o); $('widgetGalleryScrim').classList.toggle('show',o); if(o)renderWidgetGallery(); }
function addWidget(k){const a=activeWidgets(); if(widgetCatalog().some(w=>w.key===k)&&!a.includes(k)){a.push(k);renderWidgetStack();renderWidgetGallery();saveState();}}
function removeWidget(k){const p=personaKey();state.widgets[p]=activeWidgets().filter(x=>x!==k);renderWidgetStack();renderWidgetGallery();saveState();}
function toggleWidget(k){ activeWidgets().includes(k)?removeWidget(k):addWidget(k); }
function renderWidgetGallery(){
  const body=$('wgGalleryBody'); if(!body) return;
  const inv=isInvestor(), keys=activeWidgets();
  const sub=$('wgSubtitle'); if(sub) sub.textContent=inv?'Wealth, planning & discovery widgets':'Real-time market & execution widgets';
  const panes=[['watchlist','star'],['chart','trendUp'],['panel','layout'],['order','scale'],['context','target']];
  const paneHtml=`<div class="wgl-sec">Layout panels</div>`+panes.map(([k,ic])=>{const on=paneVisible(k),nm=CARD_LABEL[k]||k;
    return `<button class="wgl-item ${on?'on':''}" data-ptoggle="${k}" aria-pressed="${on}">
      <span class="wgl-ic">${icon(ic,17)}</span>
      <span class="wgl-tb"><b>${nm}</b><span>${on?'Showing':'Hidden, tap to restore'}</span></span>
      <span class="wgl-add">${icon(on?'check':'plus',15)}</span></button>`;}).join('');
  body.innerHTML=`<div class="wgl-note">Tailored for <b>${inv?'Investing':'Trading'}</b> · your picks are saved per mode</div>`
    +paneHtml+`<div class="wgl-sec">Widgets</div>`
    +widgetCatalog().map(w=>{const on=keys.includes(w.key);
      return `<button class="wgl-item ${on?'on':''}" data-wtoggle="${w.key}" aria-pressed="${on}">
        <span class="wgl-ic">${icon(w.icon,17)}</span>
        <span class="wgl-tb"><b>${w.name}</b><span>${w.desc}</span></span>
        <span class="wgl-add">${icon(on?'check':'plus',15)}</span></button>`;}).join('');
  body.querySelectorAll('[data-wtoggle]').forEach(b=>b.onclick=()=>toggleWidget(b.dataset.wtoggle));
  body.querySelectorAll('[data-ptoggle]').forEach(b=>b.onclick=()=>togglePane(b.dataset.ptoggle));
}
function initWidgetDnD(){
  const wrap=$('widgetStack'); if(!wrap) return;
  wrap.querySelectorAll('[data-wkey]').forEach(card=>{
    card.ondragstart=e=>{state.dragWidget=card.dataset.wkey;card.classList.add('wg-drag');e.dataTransfer.effectAllowed='move';};
    card.ondragend=()=>{card.classList.remove('wg-drag');state.dragWidget=null;};
    card.ondragover=e=>{e.preventDefault();};
    card.ondrop=e=>{e.preventDefault();const from=state.dragWidget,to=card.dataset.wkey;if(!from||from===to)return;
      const a=activeWidgets(); a.splice(a.indexOf(from),1); a.splice(a.indexOf(to),0,from); renderWidgetStack();saveState();};
  });
}
const CARD_EL={watchlist:'.pane-left',chart:'.chart-card',panel:'.panel',order:'#orderPad',context:'#contextModule'};
const CARD_LABEL={watchlist:'Watchlist',chart:'Chart',panel:'Orders & scanner',order:'Order pad',context:'Insights'};
function cardCtl(key){ const nm=CARD_LABEL[key]||key;
  return `<div class="card-ctl" data-cardgrp="${key}">
    <button class="cc-btn cc-min" data-cardbtn="min" data-cardkey="${key}" title="Minimize / restore" aria-label="Minimize ${nm}">${icon('minus',13)}</button>
    <button class="cc-btn cc-max" data-cardbtn="max" data-cardkey="${key}" title="Maximize / restore" aria-label="Maximize ${nm}">${icon('expand',13)}</button>
    <button class="cc-btn cc-close" data-cardbtn="close" data-cardkey="${key}" title="Close ${nm}, restore from + Widgets" aria-label="Close ${nm}">${icon('close',13)}</button>
  </div>`;
}
function mountStableCardCtls(){
  // chart + watchlist have stable header bars; inject the controls once
  const chart=document.querySelector('.ch-bar');
  if(chart && !chart.querySelector('.card-ctl')){const d=document.createElement('div');d.className='card-ctl';d.dataset.cardgrp='chart';d.innerHTML=cardCtl('chart').replace(/^<div[^>]*>|<\/div>$/g,'');chart.appendChild(d);}
  const wl=document.querySelector('.pane-head');
  if(wl && !wl.querySelector('.card-ctl')){const d=document.createElement('div');d.className='card-ctl';d.dataset.cardgrp='watchlist';d.innerHTML=cardCtl('watchlist').replace(/^<div[^>]*>|<\/div>$/g,'');wl.appendChild(d);}
  const panel=document.querySelector('.panel');
  if(panel && !panel.querySelector(':scope > .card-ctl')){const d=document.createElement('div');d.className='card-ctl card-ctl-abs';d.dataset.cardgrp='panel';d.innerHTML=cardCtl('panel').replace(/^<div[^>]*>|<\/div>$/g,'');panel.appendChild(d);}
}
function updateCardBtns(){
  Object.keys(CARD_EL).forEach(k=>{
    const el=document.querySelector(CARD_EL[k]); if(!el)return;
    const m=(state.cards&&state.cards[k])||'normal';
    const mn=el.querySelector('.cc-min'), mx=el.querySelector('.cc-max');
    if(mn) mn.innerHTML=icon(m==='min'?'plus':'minus',13);
    if(mx) mx.innerHTML=icon(m==='max'?'compress':'expand',13);
  });
}
function paneVisible(key){ return ((state.cards&&state.cards[key])||'normal')!=='hidden'; }
function togglePane(key){ if(!state.cards)state.cards={}; state.cards[key]= paneVisible(key)?'hidden':'normal'; applyCardStates(); applyPaneWidths(); renderWidgetGallery(); saveState(); }
function applyCardStates(){
  let anyMax=false;
  Object.keys(CARD_EL).forEach(k=>{
    const el=document.querySelector(CARD_EL[k]); if(!el)return;
    const m=(state.cards&&state.cards[k])||'normal';
    el.classList.toggle('card-min', m==='min');
    el.classList.toggle('card-max', m==='max');
    el.classList.toggle('card-hidden', m==='hidden');
    if(m==='max')anyMax=true;
  });
  const term=document.querySelector('.terminal'); if(term) term.classList.toggle('has-max',anyMax);
  const scrim=$('cardScrim'); if(scrim) scrim.classList.toggle('show',anyMax);
  document.body.classList.toggle('card-maxed',anyMax);
  updateCardBtns();
  if(window.TPChart&&TPChart.resize){TPChart.resize();setTimeout(()=>TPChart.resize(),70);}
}
function toggleCard(key,which){
  if(!state.cards)state.cards={};
  const cur=state.cards[key]||'normal', nm=CARD_LABEL[key]||key;
  if(which==='close'){ state.cards[key]='hidden'; wsRestoreDismissed=false; }
  else if(which==='min'){ state.cards[key]= cur==='min'?'normal':'min'; }
  else { if(cur==='max'){state.cards[key]='normal';}
    else { Object.keys(CARD_EL).forEach(k=>{if(state.cards[k]==='max')state.cards[k]='normal';}); state.cards[key]='max'; } }
  applyCardStates(); applyPaneWidths();
  const st=state.cards[key];
  if(st==='hidden') quickToast(nm+' hidden','Restore it from + Widgets → Layout panels.');
  else announce(`${nm} ${st==='normal'?'restored':st==='min'?'minimized':'maximized'}`);
  saveState();
}
function restoreMaxCard(){ let changed=false; Object.keys(CARD_EL).forEach(k=>{if(state.cards[k]==='max'){state.cards[k]='normal';changed=true;}}); if(changed){applyCardStates();saveState();} }
function recompute(opts={}){
  syncSliderLabels();
  const raw=readSignals(),sc=scoreSignals(raw),S=composite(sc),conf=confidence(S,sc);
  // Live: the bot's regime is authoritative for BOTH the 4-state label and the 3-state terminal theme (via THEME_OF).
  // What-if / offline: classify the composite with hysteresis, then derive the label from theme + VIX.
  const liveReg=(!state.simOverride && BOT.live && BOT.market && BOT.market.engine)?BOT.market.engine.regime:null;
  const newEngine=(liveReg&&THEME_OF[liveReg])?THEME_OF[liveReg]:classify(S,state.engine); state.engine=newEngine;
  const label=liveReg||regime4(newEngine,raw.vix,state.regimeLabel); state.regimeLabel=label;
  renderEngine(S,sc,conf,newEngine,label);$('autoConf').textContent=conf+'%';
  renderTopIndex(); renderRegimeBar(state.displayed);
  const vixROC=(raw.vix-state.prevVix)/Math.max(1,state.prevVix);
  const hard=state.forceHard||vixROC>0.15;state.forceHard=false;
  const mismatch=newEngine!==state.displayed;
  if(state.mode==='auto'){
    if(opts.silent){ if(mismatch) applyRegime(newEngine); }     // quiet adoption (boot / first live sync), no toast/cinematic
    else if(mismatch&&!state.suggesting){
      if(hard){applyRegime(newEngine);infoToast(newEngine,S,conf,sc,true,label);}
      else if(conf>=65){suggestToast(newEngine,S,conf,sc,false,label);}
    }
  }else if(mismatch&&conf>=65&&!state.suggesting&&!opts.silent){suggestToast(newEngine,S,conf,sc,true,label);}
  state.prevVix=raw.vix;
  renderEngineSrc();
}
/* ---------- Trading Floor (Day/Night) surface ---------- */
function powerOn(){ const f=$('floorSweep'); if(!f)return; f.classList.remove('go'); void f.offsetWidth; f.classList.add('go'); }
/* ---------- day/night CASCADE: trading floor powers on/off, pane by pane ----------
   Freeze each visible pane in the OLD theme (inline CSS vars inherit to the whole
   subtree), flip the global theme so the canvas changes at once, then release the
   panes in a ripple outward from the toggle, each flipping with an accent flash. */
const THEME_VARS=['--bg','--surface','--surface-2','--white','--line','--line-2','--navy','--slate','--slate-2','--green','--green-d','--red','--red-d','--blue','--amber','--tint-down','--tint-warn','--tint-info','--bd-down','--bd-warn','--up-flash','--down-flash','--topbar-bg','--glass','--glass-hi','--shadow','--shadow-hover','--shadow-lg','--accent','--accent-d','--accent-soft','--accent-line'];
const CASCADE_SEL=['.topbar','.ticker-bar','.regime-bar','.pane-left','.chart-card','#investHub','.panel','.order-card','.ctx-card','#modeFab',
  /* algo / ai / trader-desk takeover panes. So day↔night powers on in EVERY persona, not just the 3-pane floor */
  '.av-head','.av-scroll','.ai-main','.ai-side','.desk-head','.desk-scroll'];
function cascadeSurface(next){
  if(prefersReduced()||!document.querySelector('.topbar')){ setSurface(next); return; }
  const cs=getComputedStyle(document.documentElement);
  const oldVals={}; THEME_VARS.forEach(v=>{const val=cs.getPropertyValue(v).trim(); if(val) oldVals[v]=val;});
  const keys=Object.keys(oldVals);
  const btn=$('surfaceToggle'); const br=btn?btn.getBoundingClientRect():{left:innerWidth-40,top:20,width:24,height:24};
  const ox=br.left+br.width/2, oy=br.top+br.height/2;
  const cards=[];
  CASCADE_SEL.forEach(s=>document.querySelectorAll(s).forEach(el=>{ if(el.getClientRects().length) cards.push(el); }));
  cards.forEach(el=>{
    keys.forEach(v=>el.style.setProperty(v,oldVals[v]));            // freeze in old theme
    const r=el.getBoundingClientRect(), cx=r.left+r.width/2, cy=r.top+r.height/2;
    el.__dist=Math.hypot(cx-ox,cy-oy);
    el.style.setProperty('--fx',(((ox-r.left)/Math.max(1,r.width))*100).toFixed(1)+'%');  // flash points back at toggle
    el.style.setProperty('--fy',(((oy-r.top)/Math.max(1,r.height))*100).toFixed(1)+'%');
  });
  cards.sort((a,b)=>a.__dist-b.__dist);
  setSurface(next,true);                                            // flip global theme (canvas) now; panes held by local vars
  const step=58;
  cards.forEach((el,i)=>setTimeout(()=>{
    el.classList.add('theme-flip');
    keys.forEach(v=>el.style.removeProperty(v));                    // release → pane eases to new theme + flashes
    setTimeout(()=>{ el.classList.remove('theme-flip'); el.style.removeProperty('--fx'); el.style.removeProperty('--fy'); },620);
  }, i*step));
}

/* ---------- live tape: VIX-driven ticks with uptick/downtick flash ---------- */
function flashNum(el,txt,dir){ el.textContent=txt; el.classList.remove('tk-up','tk-down'); void el.offsetWidth; el.classList.add(dir>=0?'tk-up':'tk-down'); }
function doTick(){
  // LIVE: real Kite WebSocket ticks (loadTicks) drive every price, never fabricate
  // movement on top of them. This synthetic tape only animates the offline demo.
  // (BOT is a module-scoped `let`, NOT on window, reference it directly.)
  if(typeof BOT!=='undefined' && BOT.live) return;
  if(state.algo && state.algo.market==='crypto') return;   // crypto tape is fed by real Binance data, never synth-tick it
  const vix=+$('sVix').value, vol=clamp((vix-8)/27,0,1), night=state.surface==='night'?1.4:1;
  const upd=(el,dec)=>{const base=parseFloat(el.textContent.replace(/,/g,''))||0; if(!base)return;
    const mv=(Math.random()-0.5)*base*0.0007*(0.4+vol*3.2)*night;
    flashNum(el,(base+mv).toLocaleString('en-IN',{maximumFractionDigits:dec}),mv);};
  document.querySelectorAll('#topIndex .tb-seq-a .tix-val').forEach(el=>upd(el,(parseFloat(el.textContent.replace(/,/g,''))||0)>=20000?0:1));
  const _sa=document.querySelector('#topIndex .tb-seq-a'),_sb=document.querySelector('#topIndex .tb-seq-b'); if(_sa&&_sb)_sb.innerHTML=_sa.innerHTML; // keep the looped copy in sync
  document.querySelectorAll('#wlRows .wl-row .wl-ltp').forEach(el=>{if(Math.random()<0.6+vol*0.4)upd(el, (parseFloat(el.textContent.replace(/,/g,''))||0)>1000?1:2);});
  const op=$('ordLtp'); if(op) upd(op,1);
}


/* ============================================================
   CARD MINIMIZE / MAXIMIZE  (per-card focus & flexibility)
   ============================================================ */
/* ============================================================
   WIDGET LIBRARY: persona-aware, user-composable cards (right rail)
   Two distinct catalogs are the trader/investor differentiator.
   ============================================================ */

/* ============================================================
   CONTROLLER
   ============================================================ */
function syncSliderLabels(){const s=readSignals();
  $('vTrend').textContent=(s.trend>=0?'+':'')+s.trend;$('vVix').textContent=s.vix.toFixed(1);
  $('vAd').textContent=s.ad.toFixed(2);$('vRsi').textContent=s.rsi;$('vPnl').textContent=(s.pnl>=0?'+':'')+s.pnl.toFixed(1)+'%';}
/* ---- Regime panel ↔ live Kite: feed the real signals into the sliders so the panel,
function syncSlidersFromLive(){
  const sg=BOT.live&&BOT.market&&BOT.market.signals; if(!sg) return false;
  const set=(id,v,lo,hi)=>{ if(typeof v!=='number'||!isFinite(v)) return; const el=$(id); if(el) el.value=clamp(v,lo,hi); };
  set('sTrend',sg.trend,-100,100); set('sVix',sg.vix,8,35); set('sAd',sg.ad,0.2,3);
  set('sRsi',sg.rsi,20,80); set('sPnl',sg.pnl,-10,10);
  if(typeof sg.macd==='boolean'){ const mt=$('macdToggle'); if(mt){ mt.dataset.on=String(sg.macd); mt.textContent=sg.macd?'Bullish ↑':'Bearish ↓'; } }
  return true;
}
// Pull the panel back onto live data (clears a what-if). Called by the "Use live" button.
function resyncLive(){
  state.simOverride=false; BOT._regimeSynced=false;
  if(BOT.live && syncSlidersFromLive()){ recompute({silent:true}); BOT._regimeSynced=true; }
  else { recompute(); }
}
// Honest source badge: LIVE (mirrors Kite) · WHAT-IF (user override) · SIMULATED (offline demo).
function renderEngine(S,sc,conf,regime,label){
  $('gaugeNeedle').style.left=clamp((S+100)/200*100,1,99)+'%';
  const rd=$('erRegime'); rd.textContent=(label||regime).toUpperCase(); rd.dataset.reg=label||regime;   // 4-state label (Bull/Bear/Choppy/High-Vol)
  $('erScore').textContent=(S>=0?'+':'')+S; $('erConf').textContent=conf+'%';
  const sigs=[['Trend',sc.trend,'.30'],['Volatility',sc.vix,'.20'],['Breadth',sc.ad,'.20'],['Momentum',sc.mom,'.20'],['Personal',sc.pers,'.10']];
  $('signals').innerHTML=sigs.map(([nm,v,w])=>{const pos=v>=0,width=Math.abs(v)/100*50;
    return `<div class="sig"><span class="sig-name">${nm} <i style="color:var(--slate-2)">${w}</i></span>
      <span class="sig-bar"><span class="sig-fill ${pos?'pos':'neg'}" style="width:${width}%"></span></span>
      <span class="sig-val num">${v>=0?'+':''}${v}</span></div>`;}).join('');
}
function renderEngineSrc(){
  const el=$('engSrc'); if(!el) return;
  if(state.simOverride){
    el.className='eng-src sim';
    el.innerHTML=`<span class="es-dot"></span><span class="es-txt"><b>What-if</b> · simulated inputs, not the live market</span>${BOT.live?`<button class="es-reset" id="esReset" type="button">Use live</button>`:''}`;
  } else if(BOT.live && BOT.market){
    const reg=(BOT.market.engine&&BOT.market.engine.regime)||'-';
    const t=BOT.market.asOf?new Date(BOT.market.asOf).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):'';
    el.className='eng-src live';
    el.innerHTML=`<span class="es-dot live"></span><span class="es-txt"><b>● LIVE from Binance</b> · ${esc(reg)}${t?` · ${t}`:''} · updates every 30s</span>`;
  } else {
    el.className='eng-src off';
    el.innerHTML=`<span class="es-dot"></span><span class="es-txt"><b>Simulated</b> · connect the live engine for the real regime, drag to explore</span>`;
  }
  const rb=$('esReset'); if(rb) rb.onclick=resyncLive;
}
// Any manual interaction switches the panel into what-if mode (stops live mirroring until "Use live").
function markSimOverride(){ if(!state.simOverride){ state.simOverride=true; renderEngineSrc(); } }

/* ---------- toasts ---------- */
function clearToasts(){$('toastWrap').innerHTML='';state.suggesting=false;}
function suggestToast(regime,S,conf,sc,manual,label){
  state.suggesting=true;
  const t=document.createElement('div');t.className='toast';
  t.innerHTML=`<div class="toast-ico">${icon(regime,22)}</div><div class="toast-body"><b>Market shifting to ${(label||regime).toUpperCase()}</b>
    <span>Composite ${S>=0?'+':''}${S} · ${conf}% confidence · ${reasonText(regime,sc)}</span></div>
    <div class="toast-acts"><button class="tbtn primary" data-act="switch">Switch view</button><button class="tbtn ghost" data-act="stay">Stay</button></div>`;
  $('toastWrap').appendChild(t);
  t.querySelector('[data-act="switch"]').onclick=()=>{cinematicRegime(regime);dismiss(t);};
  t.querySelector('[data-act="stay"]').onclick=()=>{if(!manual)setMode('manual',true);dismiss(t);};
  if(!manual)t._timer=setTimeout(()=>{if(document.body.contains(t)){cinematicRegime(regime);dismiss(t);}},6500);
}
function infoToast(regime,S,conf,sc,hard,label){
  state.suggesting=true;
  const L=(label||regime).toUpperCase();
  const t=document.createElement('div');t.className='toast'+(hard?' hard':'');
  t.innerHTML=`<div class="toast-ico">${icon(hard?'bolt':regime,22)}</div><div class="toast-body"><b>${hard?'Hard signal, switched to '+L:'Switched to '+L}</b>
    <span>Composite ${S>=0?'+':''}${S} · ${conf}% · ${reasonText(regime,sc)}. No orders were changed.</span></div>
    <div class="toast-acts"><button class="tbtn ghost" data-act="keep">Override</button><button class="tbtn primary" data-act="ok">Got it</button></div>`;
  $('toastWrap').appendChild(t);
  t.querySelector('[data-act="ok"]').onclick=()=>dismiss(t);
  t.querySelector('[data-act="keep"]').onclick=()=>{setMode('manual',true);dismiss(t);};
  t._timer=setTimeout(()=>{if(document.body.contains(t))dismiss(t);},7000);
}
function dismiss(t){if(t._timer)clearTimeout(t._timer);t.classList.add('out');setTimeout(()=>{t.remove();if(!$('toastWrap').children.length)state.suggesting=false;},300);}

/* ---------- mode + engine panel ---------- */
function setMode(mode,silent){state.mode=mode;$('autoPill').classList.toggle('on',mode==='auto');renderRegimeBar(state.displayed);if(mode==='auto'&&!silent){clearToasts();recompute();}}
function openEngine(o){$('engine').classList.toggle('collapsed',!o);$('engineScrim').classList.toggle('show',o);}

/* ---------- simulation ---------- */
function toggleSim(){const btn=$('simRun');
  if(state.simTimer){clearInterval(state.simTimer);state.simTimer=null;btn.textContent='▶ Simulate a move (demo)';btn.classList.remove('running');return;}
  markSimOverride();   // the random-walk demo is explicitly a what-if, not live data
  btn.textContent='⏸ Pause demo';btn.classList.add('running');
  state.simTimer=setInterval(()=>{const walk=(id,mn,mx,st)=>{const e=$(id);e.value=clamp(+e.value+(Math.random()-0.5)*st,mn,mx);};
    walk('sTrend',-100,100,16);walk('sVix',8,35,1.4);walk('sAd',0.2,3,0.18);walk('sRsi',20,80,5);walk('sPnl',-10,10,0.9);recompute();},1400);}

/* ---------- presets ---------- */
const PRESETS={rally:{sTrend:88,sVix:11.5,sAd:2.6,sRsi:68,sPnl:4.5,macd:true},choppy:{sTrend:8,sVix:16,sAd:1.0,sRsi:50,sPnl:-0.5,macd:true},crash:{sTrend:-78,sVix:24,sAd:0.4,sRsi:32,sPnl:-6,macd:false,hard:true},spike:{sTrend:-32,sVix:28,sAd:0.5,sRsi:38,sPnl:-3.5,macd:false,hard:true}};
function applyPreset(name){const p=PRESETS[name];if(!p)return;
  markSimOverride();   // a preset is a hypothetical scenario, not the live market
  ['sTrend','sVix','sAd','sRsi','sPnl'].forEach(k=>{if(p[k]!=null)$(k).value=p[k];});
  const mt=$('macdToggle');mt.dataset.on=String(p.macd);mt.textContent=p.macd?'Bullish ↑':'Bearish ↓';
  if(p.hard)state.forceHard=true;clearToasts();recompute();}

/* ---------- init ---------- */
function init(){
  ['sTrend','sVix','sAd','sRsi','sPnl'].forEach(id=>$(id).addEventListener('input',()=>{markSimOverride();recompute();}));
  $('macdToggle').addEventListener('click',()=>{const b=$('macdToggle');const on=b.dataset.on!=='true';b.dataset.on=String(on);b.textContent=on?'Bullish ↑':'Bearish ↓';markSimOverride();recompute();});
  document.querySelectorAll('[data-preset]').forEach(b=>b.addEventListener('click',()=>applyPreset(b.dataset.preset)));
  $('simRun').addEventListener('click',toggleSim);
  $('engineBtn').addEventListener('click',()=>openEngine(true));
  $('engineClose').addEventListener('click',()=>openEngine(false));
  $('engineScrim').addEventListener('click',()=>openEngine(false));
  $('widgetBtn').addEventListener('click',()=>openWidgetGallery(true));
  $('wgClose').addEventListener('click',()=>openWidgetGallery(false));
  $('widgetGalleryScrim').addEventListener('click',()=>openWidgetGallery(false));
  $('autoPill').addEventListener('click',()=>setMode(state.mode==='auto'?'manual':'auto'));
  document.querySelectorAll('[data-regime-btn]').forEach(b=>b.addEventListener('click',()=>{setMode('manual',true);clearToasts();cinematicRegime(b.dataset.regimeBtn);}));

  // modal close
  $('modalClose').addEventListener('click',closeModal);
  $('modalCancel').addEventListener('click',closeModal);
  $('modalScrim').addEventListener('click',closeModal);
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal();});

  // orderbook cancel (delegated)
  $('panelBody').addEventListener('click',e=>{const c=e.target.closest('[data-cancel]');if(c)cancelOrder(+c.dataset.cancel);});

  $('surfaceToggle').addEventListener('click',toggleSurface);

  // persona: floating CTA switches mode; the first-run gate drives the onboarding wizard
  document.querySelectorAll('#modeFab [data-persona]').forEach(b=>b.addEventListener('click',()=>cinematicPersona(b.dataset.persona)));
  document.querySelectorAll('#personaGate [data-persona]').forEach(b=>b.addEventListener('click',()=>onboardPick(b.dataset.persona)));
  const pgSkip=$('pgSkip'); if(pgSkip) pgSkip.addEventListener('click',()=>onboardPick('trader'));
  // onboarding wizard: step-2 controls (back / finish / copy command / retry)
  const pgate=$('personaGate'); if(pgate) pgate.addEventListener('click',e=>{
    if(e.target.closest('[data-obback]')) obStep(1);
    else if(e.target.closest('[data-obfinish]')) finishOnboarding();
    else if(e.target.closest('[data-obretry]')){ loadBotData().then(()=>{ if(onboarding) renderOnboardConnect(); }).catch(()=>{}); }
    else if(e.target.closest('[data-obcopy]')){ const c=$('obCmd');
      if(c && navigator.clipboard){ navigator.clipboard.writeText(c.textContent.replace(/ /g,' ').trim())
        .then(()=>quickToast('Copied','Paste it into your terminal')).catch(()=>{}); } }
  });

  // keep the floating-mode pill aligned: the pill is sized from button widths in syncFab(),
  // but those widths shift when the web font swaps in (FOUT) and on resize, re-measure then.
  if(document.fonts&&document.fonts.ready) document.fonts.ready.then(syncFab);
  addEventListener('resize',syncFab);

  // card minimize / maximize (delegated)
  const term=document.querySelector('.terminal');
  if(term) term.addEventListener('click',e=>{const b=e.target.closest('[data-cardbtn]');if(b){e.preventDefault();e.stopPropagation();toggleCard(b.dataset.cardkey,b.dataset.cardbtn);}});
  const cscrim=$('cardScrim'); if(cscrim) cscrim.addEventListener('click',restoreMaxCard);
  document.addEventListener('keydown',e=>{if(e.key==='Escape')restoreMaxCard();});

  initWatchlistDnD(); initResize(); initSearch(); initKeyboardNav(); wireTicker();

  // ---- mount the interactive chart engine (real Kite candles via /api/candles) ----
  if(window.TPChart) TPChart.mount({onTrade:tradeFromChart, persist:saveChart, feed:chartFeed});

  // ---- restore persisted session ----
  const saved=loadState();
  if(saved){
    if(Array.isArray(saved.watchlist)) SYMS=saved.watchlist;   // rebuild the universal watchlist
    state.wlCustom=!!saved.wlCustom;
    state.selected=(typeof saved.selected==='string'&&bySym(saved.selected))?saved.selected:null;  // validate vs rebuilt list
    state.paneW=saved.paneW||null; state.chartH=saved.chartH||null;
    if(saved.chart && window.TPChart){ try{ TPChart.restore(saved.chart); }catch(e){} } }
  if(saved&&saved.cards) state.cards=saved.cards;
  if(saved&&saved.ticker) state.ticker=saved.ticker;
  if(saved&&typeof saved.regimeCollapsed==='boolean') state.regimeCollapsed=saved.regimeCollapsed;
  state.persona=CRYPTO_ONLY?'algo':((saved&&saved.persona)||'trader');
  renderPlanChip();
  state.investSection=(saved&&saved.investSection)||null;
  state.layout=(saved&&['originals','charts','watchlist','options','futures','build'].indexOf(saved.layout)>=0)?saved.layout:'originals';
  // restore the active Algo sub-tab (Monitor / Library / …) so a refresh keeps you on the page you were on,
  // instead of always snapping back to Marketplace (the default) when the async data loads settle.
  if(saved&&saved.algo&&typeof saved.algo==='object'){
    const AV=['library','opportunity','risk','market','leaderboard','backtest','forward','monitor','accuracy','analytics'];
    if(AV.indexOf(saved.algo.view)>=0){
      state.algo=state.algo||{bt:{algo:0,period:'1Y'}};
      state.algo.view=saved.algo.view;
      if(saved.algo.exec==='live'||saved.algo.exec==='paper') state.algo.exec=saved.algo.exec;
    }
    if(saved.algo.market==='in'||saved.algo.market==='crypto'){ state.algo=state.algo||{bt:{algo:0,period:'1Y'}}; state.algo.market=saved.algo.market; }
  }
  // CRYPTO_ONLY forces state BEFORE the first setMode/applyRegime/recompute below, not after - those
  // calls fan out into renderAlgo() and 30+ other spots gated on state.algo.market==='crypto'. Forcing
  // this late (as it used to) meant the very first render of the whole chain ran against unset/legacy
  // state and showed the pre-pivot layout for one frame - the flash a fresh login used to hit every time.
  if(CRYPTO_ONLY){
    state.algo=state.algo||{}; state.algo.market='crypto'; state.persona='algo';
    const wlTabs=document.querySelector('.wl-tabs'); if(wlTabs) wlTabs.style.display='none';
    const invHub=$('investHub'); if(invHub) invHub.style.display='none';
    const deskView=$('deskView'); if(deskView) deskView.style.display='none';
    document.documentElement.dataset.persona='algo';
  }
  if(state.layout==='options')state.desk.view='chain'; else if(state.layout==='futures')state.desk.view='futures';
  // restore named custom layouts (validate card keys against the live catalog)
  const validCard=c=>c&&canvasCatalog().some(w=>w.key===c.key);
  const cleanCard=c=>{const o={key:c.key,span:c.span===3?3:c.span===2?2:1}; if(c.grp==='A'||c.grp==='B')o.grp=c.grp; return o;};
  // restore named custom layouts (tabs shape; validate card keys against the live catalog)
  state.customLayouts=(saved&&Array.isArray(saved.customLayouts))?saved.customLayouts.map(l=>({id:l.id,name:l.name,activeTab:l.activeTab,
    tabs:(Array.isArray(l.tabs)?l.tabs:[]).map(t=>({id:t.id,name:t.name,sync:(t.sync&&typeof t.sync==='object')?t.sync:{A:0,B:1},cards:(t.cards||[]).filter(validCard).map(cleanCard)}))})):[];
  state.activeCustom=(saved&&typeof saved.activeCustom==='string')?saved.activeCustom:null;
  state.aiCfg=(saved&&saved.aiCfg)||null;
  // migrate the legacy single canvas into one named layout (one "Main" tab)
  if(!state.customLayouts.length && saved && Array.isArray(saved.canvas) && saved.canvas.length){
    const cards=saved.canvas.filter(validCard).map(cleanCard);
    if(cards.length){const id=newLayoutId(),tid=newTabId(); state.customLayouts=[{id,name:'My Layout',activeTab:tid,tabs:[{id:tid,name:'Main',cards,sync:{A:0,B:1}}]}]; if(state.layout==='build')state.activeCustom=id;}
  }
  // if 'build' is active but the referenced layout is gone, fall back to a preset
  if(state.layout==='build' && !activeCustom()) state.layout='originals';
  document.documentElement.dataset.layout=state.layout;
  state.widgets=(saved&&saved.widgets)||{trader:WIDGET_DEFAULTS.trader.slice(),investor:WIDGET_DEFAULTS.investor.slice()};
  document.documentElement.dataset.persona=state.persona;
  document.documentElement.dataset.layout=state.layout;
  syncFab();
  applyChartHeight();
  setSurface(saved&&saved.surface?saved.surface:'day', true); // silent: no power-on sweep on reload
  updateClock(); setInterval(updateClock,1000);

  const startMode=(saved&&saved.mode)||'auto';
  setMode(startMode,true);
  applyRegime(startMode==='manual'&&saved&&saved.regime?saved.regime:'bull');
  recompute({silent:true});
  renderHdrMarket();
  if(CRYPTO_ONLY && !(saved&&saved.watchlist)){
    SYMS=CRYPTO_UNIVERSE.slice(0,6).map(c=>({sym:c.tk,name:c.name,exch:'CRYPTO',type:'SPOT',key:'CRYPTO:'+c.sym,ltp:0,chg:0,live:false}));
    state.wlCustom=true;
  }
  if(CRYPTO_ONLY || (state.algo&&state.algo.market==='crypto')){ renderTopIndex(); loadCrypto().then(()=>{ if(state.algo.market==='crypto'){ patchCryptoTape(); applyTickerSpeed(); } }); connectCryptoWS(); }
  tapeLoop();
  if(CRYPTO_ONLY){
    loadBotData().then(()=>{ if(typeof renderAlgo==='function'&&isAlgo()) renderAlgo(); });
    setInterval(()=>{ if(document.visibilityState==='visible') loadBotData().then(()=>{ if(isAlgo()) renderAlgo(); }); }, 15000);
  }
  if(!CRYPTO_ONLY){
    loadMarket(); setInterval(loadMarket, 30000);   // Kite market data (Indian edition only)
  }
  if(!CRYPTO_ONLY) setInterval(()=>{ loadTicks();                  // Kite WebSocket (Indian edition only)
    loadTape();                                   // real-time index tape (WS-fed), patched in place, no scroll reset
    // desk movers/P&L/heatmap are live-data cards but the 30s cascade gate skips them between
    // structural changes → refresh them on the tick ONLY when the desk is the visible center view
    // (localised rebuild, not the whole screen, so no global flicker).
    if(BOT.live && typeof renderDeskView==='function' && ((typeof isDesk==='function'&&isDesk()) || (typeof isCenterTakeover==='function'&&isCenterTakeover()))) renderDeskView();
    if(BOT.live && document.querySelector('.wg-card[data-wkey="depth"]')) loadDepth(state.selected||'RELIANCE');
  }, 2000);
  // live crypto prices: the WebSocket drives the tape sub-second; this 5s REST poll is the FALLBACK,
  // firing only when the socket isn't delivering (first paint, dropped socket, WS unsupported).
  setInterval(()=>{ if(!(state.algo && state.algo.market==='crypto' && document.visibilityState==='visible')) return;
    if(CWS.on && Date.now()-CWS.lastMsg<8000) return;   // socket is live → skip the REST poll
    loadCrypto().then(()=>{ if(state.algo&&state.algo.market==='crypto') patchCryptoTape(); }); }, 5000);
  // Instant refresh the moment the tab regains focus. Background tabs throttle setInterval (Chrome caps
  // hidden-tab timers to ~1/min), so on return the crypto tape/book can look frozen until the next tick, 
  // pull fresh data immediately instead of waiting for it.
  const refreshVisible=()=>{
    if(document.visibilityState!=='visible') return;
    if(state.algo && state.algo.market==='crypto'){
      connectCryptoWS();   // ensure the price socket is up again after the tab was hidden
      loadCrypto().then(()=>{ if(state.algo.market==='crypto') patchCryptoTape(); });
      if(typeof isAlgo==='function' && isAlgo()){ const v=state.algo.view;
        if((v==='monitor'||v==='positions')&&typeof loadCryptoMonitor==='function') loadCryptoMonitor().then(()=>{ if(isAlgo()&&state.algo.market==='crypto'&&(state.algo.view==='monitor'||state.algo.view==='positions')){
          if(document.querySelector('.cxm-tbl') && CRYPTOMON._sig===cryptoMonSig()) patchCryptoMon(); else renderAlgo(); } });
        else if(v==='risk'&&typeof loadCryptoRisk==='function') loadCryptoRisk().then(()=>{ if(isAlgo()&&state.algo.market==='crypto') renderAlgo(); }); }
    } else if(BOT.live){ loadTicks(); }   // Indian book: pull fresh ticks on return too
  };
  document.addEventListener('visibilitychange',refreshVisible);
  window.addEventListener('focus',refreshVisible);
  // live crypto paper book (7s poll), refresh the Monitor/Positions/Risk while the studio is scoped to Crypto
  setInterval(()=>{ if(!(isAlgo() && state.algo && state.algo.market==='crypto' && document.visibilityState==='visible')) return;
    const v=state.algo.view;
    if(v==='monitor'||v==='positions') loadCryptoMonitor().then(()=>{ if(isAlgo()&&state.algo.market==='crypto'&&(state.algo.view==='monitor'||state.algo.view==='positions')){
      // steady state → patch the ticking numbers in place (NO rebuild, no flicker); only full-render on a structural change
      if(document.querySelector('.cxm-tbl') && CRYPTOMON._sig===cryptoMonSig()) patchCryptoMon(); else renderAlgo();
    } });
    else if(v==='risk') loadCryptoRisk().then(()=>{ if(isAlgo()&&state.algo.market==='crypto'&&state.algo.view==='risk') renderAlgo(); });
    else if(v==='forward'||v==='accuracy') loadCryptoFwd().then(()=>{ if(isAlgo()&&state.algo.market==='crypto'&&(state.algo.view==='forward'||state.algo.view==='accuracy')) renderAlgo(); });
    else if(v==='analytics') loadCryptoAn().then(()=>{ if(isAlgo()&&state.algo.market==='crypto'&&state.algo.view==='analytics') renderAlgo(); });
    else if(v==='accuracy') loadReadiness('crypto').then(()=>{ if(isAlgo()&&state.algo.market==='crypto'&&state.algo.view==='accuracy') renderAlgo(); });
    else if(v==='analytics') loadRegimeFit('crypto'); }, 7000);
  // fast real-time poll (2s): refresh live paper P&L + positions across ALL live algo
  // views: Marketplace, Leaderboard, Forward Test, Monitor. (Backtest is static, skip it.)
  // Safe re-render: skips the tick while a field is focused (no clobbering the capital box)
  // and preserves scroll so live numbers update without any UI disruption.
  const ALGO_LIVE_VIEWS=['market','leaderboard','forward','monitor','accuracy','analytics','opportunity'];
  setInterval(()=>{
    if(!(typeof isAlgo==='function'&&isAlgo())) return;
    if(state.algo&&state.algo.market==='crypto') return;   // Indian P&L poll is paused while the studio is scoped to Crypto
    if(!ALGO_LIVE_VIEWS.includes(state.algo&&state.algo.view)) return;
    loadMonitor().then(()=>{
      if(!(isAlgo()&&ALGO_LIVE_VIEWS.includes(state.algo.view))) return;
      const ae=document.activeElement;
      if(ae&&ae.closest&&ae.closest('#algoView')&&/^(INPUT|SELECT|TEXTAREA)$/.test(ae.tagName)) return; // don't interrupt typing
      if(state.algo.view==='analytics'){ patchAlgoLive(); ensureAnalytics(); return; } // analytics: live P&L patched in sync (2s) + breakdowns refreshed (throttled)
      if(algoLiveSig()!==state.algo._sig){           // structure changed (a trade opened/closed) → one full re-render
        const av=$('algoView'), sc=av?av.scrollTop:0; renderAlgo(); if(av) av.scrollTop=sc;
      } else {
        patchAlgoLive();                             // steady state → patch the ticking numbers in place, NO flicker
      }
    });
  }, 2000);
  mountStableCardCtls(); applyCardStates();

  // first-run: onboarding wizard (pick a persona, then connect Kite)
  if(!(saved&&saved.persona)) startOnboarding();
}

/* ---------- keyboard nav for segmented controls ---------- */
function initKeyboardNav(){
  [document.querySelector('.seg')].forEach(grp=>{ if(!grp)return;
    grp.addEventListener('keydown',e=>{
      if(e.key!=='ArrowLeft'&&e.key!=='ArrowRight')return;
      const btns=[...grp.querySelectorAll('button')];
      const i=btns.indexOf(document.activeElement); if(i<0)return;
      e.preventDefault();
      const ni=(i+(e.key==='ArrowRight'?1:-1)+btns.length)%btns.length;
      btns[ni].focus(); btns[ni].click();
    });
  });
}

/* ---------- watchlist: click-to-select + drag reorder ---------- */
function initWatchlistDnD(){
  const wl=$('wlRows');
  wl.addEventListener('click',e=>{if(e.target.closest('[data-wlremove]'))return;const row=e.target.closest('.wl-row');if(row)selectSym(row.dataset.key);});
  // Keyboard a11y: rows are role="button" tabindex="0", Enter/Space selects, Up/Down roves focus
  // (WCAG 2.1.1). Without this the watchlist was mouse-only. The remove button keeps its own focus.
  wl.addEventListener('keydown',e=>{
    if(e.target.closest('[data-wlremove]'))return;             // let the remove button handle its own keys
    const row=e.target.closest('.wl-row'); if(!row)return;
    if(e.key==='Enter'||e.key===' '){ e.preventDefault(); selectSym(row.dataset.key); return; }
    if(e.key==='ArrowDown'||e.key==='ArrowUp'){ e.preventDefault();
      const rows=[...wl.querySelectorAll('.wl-row')], i=rows.indexOf(row);
      const nxt=rows[e.key==='ArrowDown'?Math.min(i+1,rows.length-1):Math.max(i-1,0)];
      if(nxt)nxt.focus();
    }
  });
  wl.addEventListener('dragstart',e=>{const row=e.target.closest('.wl-row');if(!row)return;state.dragKey=row.dataset.key;row.classList.add('dragging');e.dataTransfer.effectAllowed='move';});
  wl.addEventListener('dragend',e=>{const row=e.target.closest('.wl-row');if(row)row.classList.remove('dragging');wl.querySelectorAll('.drag-over').forEach(x=>x.classList.remove('drag-over'));});
  wl.addEventListener('dragover',e=>{e.preventDefault();const row=e.target.closest('.wl-row');wl.querySelectorAll('.drag-over').forEach(x=>x.classList.remove('drag-over'));if(row&&row.dataset.key!==state.dragKey)row.classList.add('drag-over');});
  wl.addEventListener('drop',e=>{e.preventDefault();const row=e.target.closest('.wl-row');if(!row||!state.dragKey)return;
    const dragged=byKey(state.dragKey), target=byKey(row.dataset.key);
    if(dragged&&target&&dragged!==target){ SYMS.splice(SYMS.indexOf(dragged),1); SYMS.splice(SYMS.indexOf(target),0,dragged); }
    state.wlCustom=true; state.dragKey=null; renderWatchlist(state.displayed); saveState();});
  // segment-filter tabs (My Watchlist / F&O / Indices)
  document.querySelectorAll('.pane-left .wl-tab').forEach((b,i)=>b.onclick=()=>{
    document.querySelectorAll('.pane-left .wl-tab').forEach(x=>x.classList.remove('active')); b.classList.add('active');
    state.wlTab=['all','fno','idx'][i]||'all'; renderWatchlist(state.displayed);});
  // "Add scrip…" box = universal instrument search scoped to the watchlist
  initAddScrip();
}

/* ---------- resizable panes + chart ---------- */
function initResize(){
  let active=null,sx=0,sl=0,sr=0;
  const startPW=()=>{if(!state.paneW){const l=document.querySelector('.pane-left').getBoundingClientRect().width;const rp=document.querySelector('.pane-right').getBoundingClientRect().width;state.paneW={left:Math.round(l),right:Math.round(rp)};}};
  const move=e=>{if(!active)return;const dx=e.clientX-sx;
    if(active==='left')state.paneW.left=clamp(sl+dx,240,560);else state.paneW.right=clamp(sr-dx,240,560);
    applyPaneWidths();};
  const up=()=>{active=null;document.body.classList.remove('resizing');window.removeEventListener('mousemove',move);window.removeEventListener('mouseup',up);saveState();};
  document.querySelectorAll('[data-resize]').forEach(h=>{
    h.addEventListener('mousedown',e=>{e.preventDefault();startPW();active=h.dataset.resize;sx=e.clientX;sl=state.paneW.left;sr=state.paneW.right;document.body.classList.add('resizing');window.addEventListener('mousemove',move);window.addEventListener('mouseup',up);});
    h.addEventListener('dblclick',()=>{state.paneW=null;applyPaneWidths();saveState();});
  });
  const ch=$('chartResize'), card=$('chartCard');
  if(ch&&card){let cy=0,sh=0,drag=false;
    const cmove=e=>{if(!drag)return;state.chartH=clamp(sh+(e.clientY-cy),300,680);card.style.height=state.chartH+'px';};
    const cup=()=>{drag=false;document.body.classList.remove('resizing');window.removeEventListener('mousemove',cmove);window.removeEventListener('mouseup',cup);saveState();};
    ch.addEventListener('mousedown',e=>{e.preventDefault();drag=true;cy=e.clientY;sh=card.getBoundingClientRect().height;document.body.classList.add('resizing');window.addEventListener('mousemove',cmove);window.addEventListener('mouseup',cup);});
    ch.addEventListener('dblclick',()=>{state.chartH=null;card.style.height='';saveState();});
  }
  applyChartHeight();
}

/* ===== Universal instrument search (ALL segments), shared by the top-bar search and the
   watchlist "Add scrip" box. Hits /api/instruments (the full 128k Kite master), debounced +
   abortable, keyboard-navigable. Picking an instrument adds it to the watchlist. ===== */
function instRow(r){
  const exp=r.expiry?' · '+new Date(r.expiry).toLocaleDateString('en-IN',{day:'2-digit',month:'short'}):'';
  const strike=(r.type==='CE'||r.type==='PE')&&r.strike?(' '+Math.round(r.strike)):'';
  const cls2=(''+(r.type||'')).toLowerCase();
  return `<div class="sr-item" data-key="${esc(r.key)}" role="option">
    <div class="sr-l"><b>${esc(r.ts)}<i class="sr-seg ${cls2}">${esc(r.type||'')}</i></b>
      <span>${esc(r.name||r.ts)} · ${esc(r.exch)}${esc(strike)}${esc(exp)}</span></div>
    <span class="sr-add" title="Add to watchlist">${icon('plus',13)}</span></div>`;
}
function wireInstSearch(input, box, onPick){
  let t=0, ctrl=null, items=[], active=-1, cache={};
  const close=()=>{box.classList.remove('show');box.innerHTML='';active=-1;items=[];};
  const draw=()=>{ box.innerHTML=items.length?items.map(instRow).join(''):'<div class="sr-empty">No instruments found</div>'; box.classList.add('show');
    [...box.querySelectorAll('.sr-item')].forEach((el,i)=>{ el.classList.toggle('active',i===active);
      el.onmousedown=e=>{e.preventDefault();pick(items[i]);}; }); };
  const pick=r=>{ if(!r)return; onPick(r); input.value=''; close(); input.blur(); };
  const run=q=>{ q=q.trim(); if(q.length<2){close();return;}
    // CRYPTO_ONLY: search the real, bounded crypto universe locally, no network round-trip needed.
    // This used to always call the old Kite/NSE instrument-search API regardless of market, so
    // typing "BTC" (or any crypto symbol) against a crypto-only build returned nothing, found via
    // an adversarial QA pass - the search bar's own placeholder says "e.g. BTCUSDT" but the search
    // itself could never find it.
    if(CRYPTO_ONLY){
      const ql=q.toLowerCase();
      items=CRYPTO_UNIVERSE.filter(c=>c.tk.toLowerCase().includes(ql)||c.sym.toLowerCase().includes(ql)||c.name.toLowerCase().includes(ql))
        .map(c=>({key:'CRYPTO:'+c.sym, ts:c.tk, sym:c.sym, name:c.name, exch:'CRYPTO', type:'SPOT'}));
      active=items.length?0:-1; draw(); return;
    }
    if(cache[q]){items=cache[q];active=items.length?0:-1;draw();return;}
    if(ctrl)ctrl.abort(); ctrl=new AbortController();
    fetch(`${BOT_API}/api/instruments?q=${encodeURIComponent(q)}&limit=30`,{signal:ctrl.signal})
      .then(r=>r.json()).then(d=>{items=(d&&d.results)||[];cache[q]=items;active=items.length?0:-1;draw();})
      .catch(err=>{ if(!(err&&err.name==='AbortError')){items=[];draw();} }); };
  input.addEventListener('input',()=>{clearTimeout(t);t=setTimeout(()=>run(input.value),170);});  // debounce
  input.addEventListener('keydown',e=>{
    if(e.key==='ArrowDown'){e.preventDefault();active=Math.min(active+1,items.length-1);draw();}
    else if(e.key==='ArrowUp'){e.preventDefault();active=Math.max(active-1,0);draw();}
    else if(e.key==='Enter'){if(active>=0&&items[active]){e.preventDefault();pick(items[active]);}}
    else if(e.key==='Escape'){input.value='';close();input.blur();}});
  input.addEventListener('blur',()=>setTimeout(close,150));
}
function initSearch(){   // top-bar global search → add any instrument
  const si=document.querySelector('.search input'), sr=$('searchResults');
  if(si&&sr) wireInstSearch(si, sr, r=>addInstrument(r));
  document.addEventListener('keydown',e=>{const a=document.activeElement;if(e.key==='/'&&a!==si&&a.tagName!=='INPUT'){e.preventDefault();si&&si.focus();}});
}
function initAddScrip(){   // watchlist "Add scrip…" box → add any instrument
  const si=document.querySelector('.wl-search input'); if(!si) return;
  let box=si.parentElement.querySelector('.search-results');
  if(!box){ box=document.createElement('div'); box.className='search-results wl-results'; si.parentElement.appendChild(box); }
  wireInstSearch(si, box, r=>addInstrument(r));
}
// The old in-app "pricing preview" modal (PLANS/ADDONS tiers, Zerodha-cockpit copy, Razorpay,
// RIA/PMS white-label pitch) was entirely pre-pivot Indian-equity content with its own fake
// tier prices in rupees, disconnected from the real crypto billing (NOWPayments, $19/mo
// Founding Pro) that actually exists on /pricing and /app#pricing. Rather than reskin numbers
// that don't correspond to anything real, the chip now just opens the real pricing directly.
function renderPlanChip(){ const el=$('planChip'); if(!el) return;
  el.innerHTML=`${icon('bolt',12)}<span>Pricing</span>`;
  el.title='View plans & pricing'; el.onclick=()=>{ window.location.href='/app#pricing'; }; }

document.addEventListener('DOMContentLoaded',init);

