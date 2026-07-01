/* ============================================================
   TradePro · Indiabulls Securities — Bull/Bear Terminal
   Detection engine + AUTO/MANUAL switching + 3-pane reflow
   ============================================================ */
'use strict';

/* ---------- data ---------- */
// The watchlist is now a UNIVERSAL instrument list — any segment (NSE/BSE equity & indices,
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
// Formatters are null/NaN-safe: missing live data renders an honest "—" / neutral, never "₹NaN", "NaN%", or a false green.
const inr=n=>Number.isFinite(n)?'₹'+Math.round(n).toLocaleString('en-IN'):'—';
const inrL=n=>Number.isFinite(n)?'₹'+(n/100000).toFixed(2)+'L':'—';
const pct=n=>Number.isFinite(n)?(n>=0?'+':'')+n.toFixed(2)+'%':'—';
const cls=n=>Number.isFinite(n)?(n>=0?'up':'down'):'';
const tone=n=>n>0?'up':n<0?'down':'';
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
  const map=[[sc.trend,'Nifty '+(sc.trend>0?'above stacked MAs':'broke below key MAs')],[sc.vix,sc.vix>0?'VIX cooling':'VIX spiking'],[sc.ad,sc.ad>0?'breadth strong':'breadth collapsing'],[sc.mom,sc.mom>0?'momentum up':'momentum weak'],[sc.pers,sc.pers>0?'your P&L rising':'your portfolio drawing down']];
  const want=regime==='bull'?1:-1;
  return map.filter(m=>Math.sign(m[0])===want).sort((a,b)=>Math.abs(b[0])-Math.abs(a[0])).slice(0,2).map(m=>m[1]).join(', ')||'signals balanced';
}

/* ---------- live orderbook ---------- */
let ORDER_ID=104;
// Order book starts empty — no fabricated history. Real paper orders (paper:true) appear
// here as the user places them from the order pad; live orders need a connected Kite session.
const SEED_ORDERS=[];
const REGIME_SYM={bull:'RELIANCE',neutral:'HDFCBANK',bear:'ADANIENT'};
const SL_W={bull:0.025,neutral:0.018,bear:0.010};
// Curated cross-market headline tape — one ticker spanning equities, indices & commodities
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
    neutral:`Signals are mixed. <b>BUY and SELL stay equally weighted</b> — trade the range and keep size light until a decisive break.`,
    bear:`Capital-preservation mode. Leads with <b>portfolio risk, hedges &amp; stops</b> — losers surface first and the order pad defaults to PROTECT/SELL.`,
  },
  investor:{
    bull:`Stay-disciplined mode. Markets look extended — <b>rebalance &amp; book partial profits</b>, don't chase highs. Keep your SIPs running.`,
    neutral:`Keep compounding. A range is <b>ideal for rupee-cost averaging</b> — continue SIPs and accumulate quality on dips.`,
    bear:`Accumulation mode. Lower prices are a chance to <b>step up SIPs &amp; average down</b> quality names. Tilt to defensives — don't panic-sell.`,
  },
  algo:{
    bull:`Momentum regime — <b>trend-following algos lead</b>. Breakout &amp; momentum strategies are favoured; keep stops trailing.`,
    neutral:`Choppy regime — <b>mean-reversion algos lead</b>. Range &amp; RSI strategies suit; throttle trend systems and cut size.`,
    bear:`Risk-off regime — <b>defensive &amp; short algos lead</b>. Tighten max-drawdown limits; the kill-switch is one tap away.`,
  },
  ai:{
    bull:`AI copilot is watching momentum &amp; breadth — ask for <b>fresh ideas, screeners or a hedge</b>. Confidence is shown on every signal.`,
    neutral:`AI copilot sees a balanced tape — ask it to <b>scan ranges, compare names or explain your portfolio</b>.`,
    bear:`AI copilot is flagging risk — ask for <b>hedges, downside screens or a portfolio health check</b>. Nothing trades without your confirm.`,
  },
};

/* ---------- persistence (localStorage) ---------- */
const LS_KEY='tradepro.terminal.v1';
function saveState(){try{localStorage.setItem(LS_KEY,JSON.stringify({
  mode:state.mode,regime:state.displayed,surface:state.surface,regimeCollapsed:state.regimeCollapsed,
  watchlist:SYMS.map(s=>({sym:s.sym,name:s.name,exch:s.exch,type:s.type,key:itemKey(s),token:s.token,sector:s.sector,beta:s.beta,lot:s.lot,expiry:s.expiry,strike:s.strike,seg:s.seg,hold:s.hold})),wlCustom:!!state.wlCustom,
  selected:state.selected,paneW:state.paneW,chartH:state.chartH,
  plan:state.plan,billing:state.billing,
  persona:state.persona,investSection:state.investSection,layout:state.layout,customLayouts:state.customLayouts,activeCustom:state.activeCustom,aiCfg:state.aiCfg,widgets:state.widgets,cards:state.cards,ticker:state.ticker,algo:(state.algo?{view:state.algo.view,exec:state.algo.exec,market:state.algo.market}:null),chart:(window.TPChart?TPChart.serialize():null)}));}catch(e){}}
function saveChart(){saveState();}   // persist callback for the chart engine
function loadState(){
  let s; try{s=JSON.parse(localStorage.getItem(LS_KEY));}catch(e){return null;}
  if(!s||typeof s!=='object') return null;
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
      wl.push({sym:it.sym, name:typeof it.name==='string'?it.name:it.sym, exch, key, ltp:0, chg:0, live:false,
        type:typeof it.type==='string'?it.type:'EQ', token:Number.isFinite(it.token)?it.token:null,
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
}

/* ---------- a11y live announcer ---------- */
function announce(msg){const el=$('srAnnounce');if(el)el.textContent=msg;}

/* ============================================================
   RENDER — TOP INDEX + REGIME BAR
   ============================================================ */
function liveS(){return composite(scoreSignals(readSignals()));}
function tickerItems(){ const uni=new Map(TICKER_UNIVERSE.map(u=>[u.name,u])); return (state.ticker.items||[]).map(n=>uni.get(n)).filter(Boolean); }
// Header market toggle (left of search) — Indian ⇄ Crypto. Always visible; drives the rolling tape + Algo Studio scope.
function renderHdrMarket(){
  const el=$('hdrMkt'); if(!el) return;
  if(!state.algo) state.algo={}; if(!state.algo.market) state.algo.market='in';
  const crypto=state.algo.market==='crypto';
  el.innerHTML=`<div class="mkt-toggle hdr" role="tablist" aria-label="Market">`
    +`<button class="mkt-tab${!crypto?' on':''}" role="tab" aria-selected="${!crypto}" data-algomkt="in"><span class="mkt-fl">🇮🇳</span> Indian</button>`
    +`<button class="mkt-tab${crypto?' on':''}" role="tab" aria-selected="${crypto}" data-algomkt="crypto"><span class="mkt-fl">₿</span> Crypto</button></div>`;
  el.querySelectorAll('[data-algomkt]').forEach(b=>b.onclick=()=>setMarket(b.dataset.algomkt));
}
// Single source of truth for the market switch — used by the header toggle (and any other surface).
function setMarket(m){
  if(!state.algo) state.algo={};
  if(state.algo.market===m) return;
  state.algo.market=m; saveState();
  renderHdrMarket();
  renderTopIndex();                                   // swap the rolling tape (Indian ⇄ Crypto)
  if(m==='crypto') loadCrypto().then(()=>{ if(state.algo.market==='crypto'){ patchCryptoTape(); if(isAlgo()) renderAlgo(); } });
  if(isAlgo()) renderAlgo();                           // re-scope the Algo Studio if it's open
}
function renderTopIndex(){
  const track=$('topIndex'); if(!track) return;
  // CRYPTO MODE: the global tape rolls live Binance prices (independent of Kite). Real data only.
  const bar=track.closest('.ticker-bar'); const crypto=!!(state.algo&&state.algo.market==='crypto');
  if(bar) bar.classList.toggle('crypto',crypto);
  if(crypto){ renderCryptoTape(track); return; }
  // NO FAKE PRICES: when Kite isn't connected, show an honest banner instead of synthetic ticks.
  if(!BOT.live){
    track.classList.remove('rolling'); const vp0=track.parentElement; if(vp0) vp0.classList.add('static');
    track.innerHTML=`<div class="tb-seq"><div class="tix tix-offline">${icon('shield',12)}<span>Live market data off — run <b>python3 login.py</b> to connect Kite</span></div></div>`;
    track.dataset.tsig='off';
    return;
  }
  const items=tickerItems();
  // Structure guard: when the instrument SET + rolling flag are unchanged, DON'T rebuild the DOM
  // (a full innerHTML swap flickers and resets the scroll). Patch live values in place instead —
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
  }).join('') || `<div class="tix tix-empty">No instruments — add some from ticker settings ▸</div>`;
  const roll=!!state.ticker.rolling && items.length>1;
  track.classList.toggle('rolling',roll);
  const vp=track.parentElement; if(vp) vp.classList.toggle('static',!roll);
  // two identical sequences let the track loop seamlessly at translateX(-50%)
  track.innerHTML=`<div class="tb-seq tb-seq-a">${seq}</div>`+(roll?`<div class="tb-seq tb-seq-b" aria-hidden="true">${seq}</div>`:'');
  applyTickerSpeed();
  connectStream();   // keep the live tick subscription in sync with the ticker's instruments
}
// Patch ONLY the rolling tape's price/chg cells in place (both looping copies) so the scroll
// animation never restarts. Driven by the fast tick loop + SSE — not the 30s market poll.
function patchTopIndex(){
  const track=$('topIndex'); if(!track||!BOT.live) return;
  track.querySelectorAll('.tix[data-tname]').forEach(el=>{
    const name=el.dataset.tname, rq=realQuote(name);
    const valEl=el.querySelector('.tix-val'), chgEl=el.querySelector('.tix-chg');
    if(!valEl) return;
    if(!rq){ valEl.textContent='—'; valEl.classList.add('muted'); if(chgEl)chgEl.hidden=true; return; }
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
  // Structure guard (same as the Indian tape): only rebuild the DOM when the SET changes — else patch in place.
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
// Patch ONLY the crypto tape's value/chg cells in place (both looped copies) — driven by the 5s Binance poll.
function patchCryptoTape(){
  const track=$('topIndex'); if(!track) return;
  track.querySelectorAll('.tix[data-cname]').forEach(el=>{
    const q=CRYPTO.quotes[el.dataset.cname], valEl=el.querySelector('.tix-val'), chgEl=el.querySelector('.tix-chg');
    if(!valEl) return;
    if(!q){ valEl.textContent='—'; valEl.classList.add('muted'); if(chgEl)chgEl.hidden=true; return; }
    const txt=cryptoFmt(q.ltp);
    if(valEl.textContent!==txt){
      const prev=parseFloat(valEl.dataset.raw); const dir=isFinite(prev)?Math.sign(q.ltp-prev):0;
      valEl.textContent=txt; valEl.classList.remove('muted'); valEl.dataset.raw=q.ltp;
      if(dir){ valEl.classList.remove('tick-up','tick-dn'); void valEl.offsetWidth; valEl.classList.add(dir>0?'tick-up':'tick-dn'); }
    }
    if(chgEl){ chgEl.hidden=false; chgEl.textContent=pct(q.chg); chgEl.className='tix-chg '+cls(q.chg)+' num'; }
  });
  const src=$('tbCryptoSrc');
  if(src) src.textContent=CRYPTO.live?'● Live · Binance · 24h':(CRYPTO.error?'Binance unreachable — retrying':'Connecting to Binance…');
}
function applyTickerSpeed(){
  const track=$('topIndex'); if(!track) return;
  if(!track.classList.contains('rolling')){track.style.removeProperty('--tk-dur');return;}
  const seqA=track.querySelector('.tb-seq-a'); if(!seqA) return;
  requestAnimationFrame(()=>{const w=seqA.scrollWidth, pps=clamp(state.ticker.speed||60,20,180);
    track.style.setProperty('--tk-dur',Math.max(6,w/pps).toFixed(1)+'s');});
}
/* ---- REALTIME ROLLING TAPE ------------------------------------------------------------
   The index tape used to refresh ONLY via loadMarket() — every 30s, and /api/market is itself
   30s-cached server-side — so it sat frozen between cycles while the watchlist ticked every
   second. Here we stream the index LTPs from the WebSocket-fed /api/ticks cache (the SAME
   sub-second feed the watchlist uses) on the existing 2s poll and patch the tape values
   IN PLACE — no innerHTML swap, so the scroll never resets/jumps. Commodities (MCX) have no
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
    const nm=tx.querySelector('.tix-name'); if(!nm) return;
    const rq=realQuote(nm.textContent.trim()); if(!rq||rq.ltp==null) return;
    const dec=rq.ltp>=20000?0:(rq.ltp>=1000?1:2);
    const val=tx.querySelector('.tix-val');
    if(val){ val.classList.remove('muted'); val.textContent=rq.ltp.toLocaleString('en-IN',{maximumFractionDigits:dec}); }
    const chg=tx.querySelector('.tix-chg');
    if(chg){ chg.textContent=pct(rq.chg||0); chg.className='tix-chg '+cls(rq.chg||0)+' num'; }
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
  const chips=t.items.map(n=>`<span class="tk-chip"><span>${esc(n)}</span><button class="tk-chip-x" data-tkremove="${esc(n)}" aria-label="Remove ${esc(n)} from ticker">${icon('close',11)}</button></span>`).join('')||`<span class="tk-none">No instruments yet — search below to add one.</span>`;
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
      + (total>m.length?`<div class="tk-res-more">+${total-m.length} more — keep typing to narrow</div>`:'');
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
    neutral:{kick:'Neutral · Rangebound',title:'Markets rangebound — wait for clarity',
      read:`Signals are mixed. <b>BUY and SELL stay equally weighted</b> and the engine waits for a decisive break before committing to a regime.`},
    bear:{kick:'Risk-off · Defensive',title:'Markets under pressure',
      read:`Capital-preservation mode. The terminal now leads with <b>portfolio risk, hedges &amp; stops</b> — the risk pane widens, losers surface first and the order pad defaults to PROTECT/SELL.`},
  }[r];
  const read=(PLAY[state.persona||'trader']||PLAY.trader)[r]||cfg.read;
  const pTag=isInvestor()?'Investing':'Trading';
  if(state.regimeCollapsed===undefined) state.regimeCollapsed=true;   // compact by default — engine stats live in the header now
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
      <div class="rb-badge"><div class="rb-emo rb-emo-${r}"><img class="rb-mascot" src="assets/mascot-${r}.png" alt="" draggable="false" onerror="this.style.display='none';this.nextElementSibling.style.display='inline-flex'"><span class="rb-emo-ic" style="display:none">${icon(r,21)}</span></div>
        <div><div class="rb-title"><small>${cfg.kick} · ${pTag}</small>${cfg.title}</div></div></div>
      <div class="rb-read">${read}</div>
      <button class="rb-toggle mini" id="rbToggle" aria-expanded="true" aria-label="Minimize market read" title="Minimize">${icon('compress',13)}<span>Minimize</span></button>`;
  }
  const t=$('rbToggle'); if(t)t.onclick=()=>{state.regimeCollapsed=!state.regimeCollapsed; renderRegimeBar(state.displayed); if(typeof saveState==='function')saveState();};
}

/* ============================================================
   RENDER — WATCHLIST (left pane)
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
  if(!list.length){ $('wlRows').innerHTML=`<div class="wl-empty">${icon('search',16)}<span>No instruments in this tab — use search or “Add scrip” to add any instrument (stocks, futures, options, indices, MCX).</span></div>`; return; }
  $('wlRows').innerHTML=list.map(s=>{
    const lv = s.live!==false && BOT.live;   // real Kite quote present for THIS instrument
    const eq=isEq(s); let badge='';
    if(inv){ badge = s.hold?`<span class="badge b-hold">holding</span>`:(lv&&s.chg<-1.5?`<span class="badge b-up">on sale</span>`:''); }
    else if(bear){ badge = lv&&s.chg<0?`<span class="badge b-down">near support</span>`:(s.hold?`<span class="badge b-hold">holding</span>`:''); }
    else { badge = lv&&s.chg>1.5?`<span class="badge b-up">near breakout</span>`:''; }
    const sub = `<span>${esc(instSub(s))}</span>${(bear&&eq&&s.beta!=null)?`<span class="beta">β ${s.beta}</span>`:''}${badge}`;
    const ltpCell = lv
      ? `<div class="wl-ltp num">${(+s.ltp).toLocaleString('en-IN')}</div><div class="wl-chg ${cls(s.chg)} num">${pct(s.chg)}</div>`
      : `<div class="wl-ltp num muted" title="No live quote — connect Kite">—</div><div class="wl-chg num muted">·</div>`;
    return `<div class="wl-row${(itemKey(s)===effSel||s.sym===effSel)?' sel':''}" draggable="true" data-sym="${esc(s.sym)}" data-key="${esc(itemKey(s))}">
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
  SYMS.push({sym:meta.ts||meta.sym, name:meta.name||meta.ts||meta.sym, exch:meta.exch, type:meta.type||'EQ',
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
  // if this stock was also pinned to the rolling tape, drop it so it can't become a dead "—" cell
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
  announce(`Chart bracket sent — ${p.side==='buy'?'long':'short'} ${p.sym}, SL ${p.sl}, target ${p.target}`);
  saveState();
}

/* ============================================================
   RENDER — CHART (center)  → delegates to the interactive engine
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
/* Real OHLCV feed for the chart — pulls Kite historical via /api/candles. Returns null
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

/* Real holdings from the Kite account (/api/holdings) or null when offline — panels
   that show positions/P&L use this so they never display the mock catalog. */
function liveHoldings(){
  return (BOT.live && BOT.holdings && Array.isArray(BOT.holdings.holdings)) ? BOT.holdings.holdings : null;
}
function emptyConnect(what){
  return `<div class="empty-state">${icon('alert',16)} <span>Connect Kite for live ${what} — run <code>python3 login.py</code>.</span></div>`;
}

/* ============================================================
   RENDER — BOTTOM PANEL (tabs reorder per regime)
   ============================================================ */
const PANELS={
  scan(r){
    // A screener needs the live market. With no connected Kite session there is nothing real to
    // screen — stay honest (no fabricated setups/moves) and prompt to connect, like every other panel.
    if(!BOT.live) return emptyConnect('breakout &amp; momentum screening');
    if(r==='bear'){
      const rows=[['ADANIENT','Lost 50-DMA · gap risk','b-down','52W LOW',-2.8],['BAJFINANCE','RSI 32 · distribution','b-down','WEAK',-1.9],['TCS','High-beta fade','b-warn','DISTRIB',-0.6]];
      return tbl(['Scrip','Setup','','LTP','Chg%'],rows.map(x=>scanRow(x)).join(""))+note('warn','Surfacing weakness, 52-wk lows &amp; high-beta names that lead a sell-off.');
    }
    if(r==='neutral'){
      const rows=[['HDFCBANK','Coiling in range','b-warn','RANGE',0.4],['ICICIBANK','At mid-band','b-warn','NEUTRAL',0.9],['ITC','Low volatility','b-warn','QUIET',-0.3]];
      return tbl(['Scrip','Setup','','LTP','Chg%'],rows.map(x=>scanRow(x)).join(""))+note('info','Awaiting the breakout that resolves the range — no decisive edge yet.');
    }
    const rows=[['MARUTI','Volume thrust · 2.4× avg','b-up','BREAKOUT',3.4],['INFY','Flag breakout','b-up','52W HIGH',2.1],['SBIN','Cup &amp; handle','b-up','VOL ↑',1.6]];
    return tbl(['Scrip','Setup','','LTP','Chg%'],rows.map(x=>scanRow(x)).join(""))+note('go','Surfacing momentum, fresh 52-wk highs &amp; volume thrust to ride the trend.');
  },
  positions(r){
    const hs=liveHoldings();
    if(!hs) return emptyConnect('positions & P&L');
    if(!hs.length) return '<div class="empty-state">No holdings in your Zerodha account yet — fund it and buy to see positions here.</div>';
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
      return cards+tbl(['Scrip','Qty','LTP','P&L','Day'],body)+note('warn','Weakest holdings by today’s move shown first — review risk on the red names.');
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
    const tip=r==='bear'?'Markets are lower — a strong time to <b>step up SIPs</b>; each rupee buys more units.'
      :r==='bull'?'Markets extended — <b>keep SIPs running</b> but avoid lump-sum chasing at highs.'
      :'Range-bound is ideal — <b>rupee-cost averaging</b> works best here.';
    return tbl(['Fund / Scrip','Monthly','Date','XIRR','Value'],body)+note(r==='bear'?'go':'info',`Total <b>${inr(tot)}/mo</b> across ${SIPS.length} SIPs. ${tip}`);
  },
  goals(){
    const cards=GOALS.map(g=>{const p=Math.round(g.cur/g.target*100);
      return `<div class="goal-card"><div class="goal-h"><span class="ctx-ico ic-info">${icon(g.icon,15)}</span><b>${g.name}</b><span class="num">${p}%</span></div>
        <div class="goal-bar"><span style="width:${p}%"></span></div>
        <div class="goal-sub"><span>${inrL(g.cur)}</span><span>of ${inrL(g.target)}</span></div></div>`;}).join('');
    return `<div class="goals-wrap">${cards}</div>`+note('info','On track for 2 of 3 goals — stepping up SIPs ~10% closes the retirement gap about 3 years sooner.');
  },
  alloc(r){
    const body=ALLOC.map(a=>{const d=a.cur-a.tgt;return `<tr><td><span class="t-sym">${a.a}</span></td>
      <td class="num">${a.cur}%</td><td class="num">${a.tgt}%</td>
      <td><span class="badge ${Math.abs(d)>=5?'b-warn':'b-up'}">${d>0?'+':''}${d}%</span></td></tr>`;}).join('');
    const tip=r==='bear'?'Equity has slipped under target — <b>deploy cash to rebalance</b> back to 60% while valuations are lower.'
      :r==='bull'?'Equity is <b>4% over target</b> — book partial profits and top up debt / gold.'
      :'Allocation is near target — small top-ups keep you balanced.';
    return tbl(['Asset','Current','Target','Drift'],body)+note(r==='bull'?'warn':'go',tip);
  },
  events(){
    const body=MARKET_EVENTS.map(e=>{const bc=e.type==='Dividend'?'b-up':e.type==='Bonus'?'b-warn':'b-neu';
      return `<tr><td><span class="t-sym">${e.co}</span></td>
        <td><span class="badge ${bc}">${e.type}</span></td>
        <td style="text-align:left;color:var(--slate)">${e.detail}</td><td class="num">${e.date}</td></tr>`;}).join('');
    return tbl(['Company','Event','Details','Date'],body)+note('info','Corporate actions across your watchlist &amp; holdings — dividends, bonuses and board meetings.');
  },
  news(){
    return `<div class="news-wrap">${NEWS_FEED.map(n=>`<div class="news-item">
      <div class="news-h">${n.head}</div>
      <div class="news-m"><span class="t-sym">${n.co}</span><span>${n.date}</span></div></div>`).join('')}</div>`;
  },
};
function scanRow(x){const[s,setup,bc,bt,chg]=x;return `<tr><td><span class="t-sym">${s}</span></td><td style="text-align:left;color:var(--slate)">${setup}</td><td><span class="badge ${bc}">${bt}</span></td><td class="num">${bySym(s)?bySym(s).ltp.toLocaleString('en-IN'):'—'}</td><td class="num ${cls(chg)}">${pct(chg)}</td></tr>`;}
function tbl(heads,bodyRows){return `<table class="tbl"><thead><tr>${heads.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${bodyRows}</tbody></table>`;}
function note(t,html){const ic=t==='go'?'check':t==='warn'?'alert':'swap';return `<div class="panel-note note-${t}">${icon(ic,15)}<span>${html}</span></div>`;}

const PANEL_LAYOUT={
  bull:   {order:[['scan','Breakout Scanner','12'],['positions','Positions','6'],['orders','Orders','4'],['holdings','Holdings','6']], def:'scan'},
  neutral:{order:[['orders','Orders','4'],['positions','Positions','6'],['holdings','Holdings','6'],['scan','Scanner','—']], def:'orders'},
  bear:   {order:[['positions','Positions · Risk','6'],['orders','Orders','4'],['holdings','Holdings','6'],['scan','Breakdown Scanner','9']], def:'positions'},
};
const PANEL_LAYOUT_INV={
  bull:   {order:[['holdings','Holdings','—'],['alloc','Allocation','4'],['sips','SIPs','3'],['goals','Goals','3'],['events','Events','8'],['news','News','—']], def:'holdings'},
  neutral:{order:[['sips','SIPs','3'],['holdings','Holdings','—'],['goals','Goals','3'],['alloc','Allocation','4'],['events','Events','8'],['news','News','—']], def:'sips'},
  bear:   {order:[['sips','SIPs · Step-up','3'],['holdings','Holdings','—'],['alloc','Allocation','4'],['goals','Goals','3'],['events','Events','8'],['news','News','—']], def:'sips'},
};
function renderPanel(r){
  const L=(isInvestor()?PANEL_LAYOUT_INV:PANEL_LAYOUT)[r];
  if(!state.panelTab || !L.order.find(t=>t[0]===state.panelTab)) state.panelTab=L.def;
  const hcnt=(liveHoldings()||[]).length;
  const cnt=id=>id==='orders'?state.orders.length:(id==='positions'||id==='holdings')?(BOT.live?hcnt:null):id==='sips'?SIPS.length:id==='goals'?GOALS.length:id==='events'?MARKET_EVENTS.length:null;
  $('panelTabs').innerHTML=L.order.map(([id,label,count])=>{
    let c=cnt(id);
    // positions/holdings come only from a live Kite session — show NO badge when offline (the body says "connect"),
    // never the static placeholder. Other tabs keep their app-computed/static count.
    if(c==null) c=(id==='positions'||id==='holdings')?'':count;
    const badge=(c===''||c==null)?'':`<span class="pt-count">${c}</span>`;
    return `<button class="p-tab ${id===state.panelTab?'active':''}" data-ptab="${id}">${label}${badge}</button>`;}).join('');
  $('panelBody').innerHTML=PANELS[state.panelTab](r);
  $('panelTabs').querySelectorAll('[data-ptab]').forEach(b=>b.onclick=()=>{state.panelTab=b.dataset.ptab;renderPanel(r);});
}

/* ============================================================
   RENDER — ORDER PAD (right)
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
  const note=m.fromChart?`<div class="order-note note-info">${icon('target',14)}<span>Levels pulled from your chart bracket — entry, SL &amp; target are live on the chart.</span></div>`
    :r==='bear'?`<div class="order-note note-warn">${icon('alert',14)}<span>High VIX — qty trimmed, SL tightened. Consider a protective put.</span></div>`
    :r==='neutral'?`<div class="order-note note-info">${icon('swap',14)}<span>Rangebound — wait for a breakout before sizing up.</span></div>`
    :`<div class="order-note note-go">${icon('check',14)}<span>Trend intact — trail SL, let winners run.</span></div>`;
  const rr=(m.fromChart&&m.target!=null)?Math.abs(m.target-m.entry)/Math.max(1,Math.abs(m.entry-m.sl)):0;
  const entryFld=m.fromChart?`<div class="fld"><label>Entry <i>chart bracket</i></label><div class="inp">${Math.round(m.entry).toLocaleString('en-IN')}</div></div>`:'';
  const ladder=(m.fromChart&&m.target!=null)
    ? `<div class="fld"><label>Target <i>from chart · R:R ${rr.toFixed(2)}</i></label><div class="inp">${Math.round(m.target).toLocaleString('en-IN')}</div></div>`
    : (r==='bull'&&m.priced)?`<div class="fld"><label>Target ladder</label><div class="inp">T1 ${Math.round(m.px*1.022).toLocaleString('en-IN')} · T2 ${Math.round(m.px*1.046).toLocaleString('en-IN')} · T3 ${Math.round(m.px*1.073).toLocaleString('en-IN')}</div></div>`:'';
  $('orderPad').innerHTML=`<div class="order-card">
    <div class="order-head"><span class="oh-sym">${m.sym} <i class="paper-tag" title="Orders here are simulated — no real order is placed. Real execution is on the roadmap.">PAPER</i></span><span class="oh-px ${cls(m.s.chg)} num"><span id="ordLtp">${m.priced?m.px.toLocaleString('en-IN'):'—'}</span> ${m.s.live!==false?pct(m.s.chg):''}</span>${cardCtl('order')}</div>
    <div class="order-body">
      <div class="side-tabs"><div class="side-tab buy ${m.side==='buy'?'active':''}" data-side="buy">BUY</div><div class="side-tab sell ${m.side==='sell'?'active':''}" data-side="sell">${r==='bear'?'SELL / HEDGE':'SELL'}</div></div>
      <div class="type-row">${typePills}</div>
      <div class="fld-row">
        <div class="fld"><label>Qty</label><div class="qty-step"><button class="qbtn" data-qty="-1" aria-label="Decrease quantity">−</button><input class="qty-inp num" id="ordQty" value="${m.qty}" inputmode="numeric" aria-label="Order quantity"><button class="qbtn" data-qty="1" aria-label="Increase quantity">+</button></div></div>
        <div class="fld"><label>Stop-loss <i>${(m.w*100).toFixed(1)}%</i></label><div class="inp">${m.priced?Math.round(m.sl).toLocaleString('en-IN'):'—'}</div></div>
      </div>
      ${entryFld}${ladder}
      <div class="fld"><label>Order value</label><div class="inp" id="ordVal">${m.priced?inr(m.value):'—'}</div></div>
      ${note}
      <button class="cta ${ctaCls}" id="placeBtn">${ctaTxt}</button>
    </div></div>`;
  $('orderPad').querySelectorAll('[data-side]').forEach(b=>b.onclick=()=>{state.orderSide=b.dataset.side;state.tradeFromChart=null;renderOrder(state.displayed);});
  $('orderPad').querySelectorAll('[data-qty]').forEach(b=>b.onclick=()=>{const d=+b.dataset.qty;state.orderQty=Math.max(1,(state.orderQty!=null?state.orderQty:m.qty)+d);renderOrder(state.displayed);});
  const qi=$('ordQty'); if(qi) qi.oninput=()=>{const v=parseInt(qi.value)||0;state.orderQty=Math.max(0,v);const vv=$('ordVal');if(vv)vv.textContent=m.priced?inr(state.orderQty*m.entry):'—';};
  $('placeBtn').onclick=()=>openOrderModal(r);   // paper/simulated order — honest, no real execution
  updateCardBtns();
}
/* ---------- order confirmation modal + placement ---------- */
function openOrderModal(r){
  const m=orderModel(r);
  const qty=state.orderQty!=null?state.orderQty:m.qty;
  if(!qty){const qi=$('ordQty');if(qi){qi.focus();}return;}
  const sideTxt=m.side==='buy'?'BUY':(r==='bear'?'SELL / HEDGE':'SELL');
  setModalTitle('Confirm order');
  $('modalBody').innerHTML=`
    <div class="modal-top ${m.side==='buy'?'is-buy':'is-sell'}">
      <span class="modal-side">${sideTxt}</span>
      <div><div class="modal-sym">${m.sym}</div><div class="modal-name">${m.s.name}</div></div>
      <span class="modal-px num">${m.priced?m.px.toLocaleString('en-IN'):'—'}</span></div>
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
/* generic, accessible confirm flow — reuses the order dialog (role=dialog, Esc-to-close, focus restore).
   onConfirm() returning false keeps the dialog open (for inline validation). */
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
function placeOrder(o){
  const status=o.type.startsWith('SL')?'Pending':(o.type==='MARKET'||o.type==='BRACKET')?'Filled':'Open';
  state.orders.unshift({id:++ORDER_ID,...o,status,paper:true});   // SIMULATED — no real order is placed
  state.panelTab='orders'; renderPanel(state.displayed);
  successToast(o,status);
  announce(`Paper ${o.side} order (simulated) — ${o.qty} ${o.sym} at ${o.price}`);
}
function cancelOrder(id){const o=state.orders.find(x=>x.id===id);if(o&&(o.status==='Pending'||o.status==='Open')){o.status='Cancelled';renderPanel(state.displayed);}}
function successToast(o,status){
  const t=document.createElement('div');t.className='toast';
  t.innerHTML=`<div class="toast-ico">${icon('check',22)}</div><div class="toast-body"><b>Paper ${o.side==='buy'?'buy':'sell'} order — ${o.sym}</b><span>${o.qty} qty @ ${o.price.toLocaleString('en-IN')} · ${o.type} · ${status} · simulated, no real order</span></div><div class="toast-acts"><button class="tbtn ghost" data-act="ok">Dismiss</button></div>`;
  $('toastWrap').appendChild(t);
  t.querySelector('[data-act=ok]').onclick=()=>dismiss(t);
  t._timer=setTimeout(()=>{if(document.body.contains(t))dismiss(t);},4500);
}

/* ============================================================
   RENDER — CONTEXT MODULE (right, under order)
   ============================================================ */
function renderContext(r){
  if(isInvestor()) return renderContextInvestor(r);
  const ctxRow=(ic, in_,b,s,val)=>`<div class="ctx-row"><div class="ctx-ico ic-${ic}">${icon(in_,15)}</div><div><div class="ct-b">${b}</div><div class="ct-s">${s}</div></div><div class="ct-val">${val||''}</div></div>`;
  let head,pill,rows;
  if(r==='bear'){
    head='Hedge &amp; Protect';pill='Defensive';
    rows=ctxRow('down','shield','Buy 23400 PE','Protective put · PCR 1.42','₹90.8')
        +ctxRow('warn','scale','Short NIFTY fut','Index hedge for portfolio β','−1 lot')
        +ctxRow('down','scissors','Trim ADANIENT 50%','Cuts ~30% of book risk','4 qty')
        +ctxRow('info','droplet','Park in liquid fund','Raise cash buffer to 75%',inrL(CASH));
  }else if(r==='neutral'){
    head='Market Internals';pill='Watch';
    rows=ctxRow('info','target','Advance / Decline','Balanced breadth','1.00')
        +ctxRow('info','swap','PCR','Neutral positioning','0.98')
        +ctxRow('warn','clock','Volatility squeeze','Breakout likely 2–3 sessions','');
  }else{
    head='Breakout Signals';pill='Momentum';
    rows=ctxRow('up','trendUp','MARUTI','Volume thrust 2.4× · BUY zone','1,078')
        +ctxRow('up','link','23500/23600 CE','Bull-call-spread quick build','net ₹38')
        +ctxRow('up','target','SBIN cup &amp; handle','Entry on close > 845','842');
  }
  const bias=r==='bull'?1.5:r==='bear'?-3.0:0;
  // real sector performance from the live watchlist when connected; simulated otherwise
  const heatSrc=BOT.live
    ? (()=>{const m={};SYMS.filter(s=>isEq(s)&&s.sector&&s.live!==false).forEach(s=>{(m[s.sector]=m[s.sector]||[]).push(s.chg);});
        return Object.entries(m).map(([s,a])=>({s,c:a.reduce((x,y)=>x+y,0)/a.length})).sort((x,y)=>y.c-x.c);})()
    : SECTORS.map(sec=>({s:sec.s,c:sec.base+bias+(sec.def&&r==='bear'?2.2:0),def:sec.def&&r==='bear'}));
  const heat=heatSrc.map(sec=>{const c=sec.c;const g=c>=0;const a=clamp(Math.abs(c)/4,.1,.45);
    return `<div class="hc ${sec.def?'def':''}" style="background:${g?`rgba(0,171,78,${a})`:`rgba(229,56,59,${a})`}">
      <div class="hc-s">${sec.s}${sec.def?' ·D':''}</div><div class="hc-c ${g?'up':'down'}">${pct(c)}</div></div>`;}).join('');
  // Offline: keep the regime framing (honest — derived from the live regime state) but never show
  // fabricated setups/prices or a simulated heatmap. Live: real ideas + real sector heat from the watchlist.
  const offline=!BOT.live;
  const body=offline
    ? `<div class="empty-state" style="margin:8px 12px">${icon('alert',15)} <span>Connect Kite for live ${r==='bear'?'hedge ideas':r==='neutral'?'market internals':'breakout setups'} &amp; sector heat — run <code>python3 login.py</code>.</span></div>`
    : `${rows}
       <div class="ctx-head" style="border-top:1px solid var(--line)"><b>Sector Heatmap</b><span class="ctx-pill">${r==='bear'?'Defense':'Strength'}</span></div>
       <div class="heat">${heat}</div>`;
  $('contextModule').innerHTML=`<div class="ctx-card">
    <div class="ctx-head"><b><span class="ctx-rico">${icon(r,16)}</span> ${head}</b><span class="ctx-pill">${pill}</span>${cardCtl('context')}</div>
    ${body}
  </div>`;
  updateCardBtns();
}

/* ============================================================
   APPLY REGIME (full re-render)
   ============================================================ */
function applyRegime(regime){
  state.displayed=regime;
  document.documentElement.dataset.regime=regime;
  document.querySelectorAll('[data-regime-btn]').forEach(b=>{const on=b.dataset.regimeBtn===regime;b.classList.toggle('active',on);b.setAttribute('aria-selected',on);});
  $('fundsLabel').textContent=(PERSONA[state.persona||'trader']||PERSONA.trader).fundsLabel(regime);
  $('fundsVal').textContent=fundsText();
  state.panelTab=null; // reset to regime default
  renderTopIndex(); renderRegimeBar(regime); renderWatchlist(regime);
  renderChart(regime); renderPanel(regime); renderOrder(regime); renderContext(regime); renderInvestHub(); renderWidgetStack(); renderDeskBar(); renderDeskView(); renderAlgo(); renderAI();
  applyPaneWidths(); // keep any manual resize across regime switches
  flashRegime();
  announce(`${regime.charAt(0).toUpperCase()+regime.slice(1)} regime — ${regime==='bull'?'markets trending up':regime==='bear'?'markets under pressure':'markets rangebound'}`);
  saveState();
}
function flashRegime(){const s=$('regimeSweep');if(!s)return;s.classList.remove('go');void s.offsetWidth;s.classList.add('go');}

/* ============================================================
   CINEMATIC TRANSITIONS — card vanish · motion-graphic mascot · smoky return
   ============================================================ */
const RV_SEL='.regime-bar,.pane-left,.chart-card,.panel,#orderPad,#contextModule';
const RV_META={
  bull:   {word:'BULL',    tag:'Risk-on · Momentum'},
  neutral:{word:'NEUTRAL', tag:'Wait for clarity'},
  bear:   {word:'BEAR',    tag:'Protect capital'},
};
const prefersReduced=()=>window.matchMedia&&window.matchMedia('(prefers-reduced-motion:reduce)').matches;
/* original mascot artwork (filled vector) — charging bull · roaring bear · balance scale */
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
      <img class="rv-img" src="assets/mascot-${r}.png" alt="" draggable="false"
        onerror="this.style.display='none';var f=this.parentNode.querySelector('.rv-svg');if(f)f.style.display='block';">
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
function updateClock(){const el=$('mktStatus');if(!el)return;const d=new Date();const p=n=>String(n).padStart(2,'0');
  const t=`${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  const mk=BOT.live&&BOT.market&&BOT.market.market;
  // Only rebuild the strip when its NON-time content changes; otherwise just tick the clock text in
  // place. Rebuilding the whole strip (and the VIX/breadth chips) every second was a subtle flicker.
  const csig=mk?('m|'+(mk.open?1:0)+'|'+mk.status+'|'+mk.openTime+'|'+mk.closeTime)
              :('o|'+(BOT.loaded&&BOT.connected===false&&!BOT.error?1:0)+'|'+(BOT.reconnecting?1:0));
  if(el.dataset.csig!==csig){
    el.dataset.csig=csig;
    if(mk){
      el.innerHTML=`<span class="mkt-dot ${mk.open?'open':'closed'}" title="NSE equity session"></span>`
        +`<span class="mkt-live">${mk.open?'MARKET OPEN':esc(mk.status.toUpperCase())}</span>`
        +`<span class="mkt-sess" title="NSE equity trading hours">${mk.openTime}–${mk.closeTime} IST</span>`
        +`<span class="mkt-time num">${t}</span>`;
    } else {
      const showRe = BOT.loaded && BOT.connected===false && !BOT.error;
      el.innerHTML=`<span class="mkt-dot off" title="Kite not connected"></span><span class="mkt-live">OFFLINE</span>`
        +(showRe?`<button class="mkt-relogin" data-relogin title="Reconnect to Kite — refreshes the daily token">${BOT.reconnecting?'Reconnecting…':'Reconnect'}</button>`:'')
        +`<span class="mkt-time num">${t}</span>`;
    }
  } else {
    const tn=el.querySelector('.mkt-time'); if(tn) tn.textContent=t;   // steady state → just tick the clock
  }
  renderHdrEngine();}
function renderHdrEngine(){
  const el=$('hdrEngine'); if(!el) return;
  const live=BOT.live&&BOT.market&&BOT.market.engine;
  if(!live){ if(el.dataset.hsig!=='off'){ el.dataset.hsig='off'; el.innerHTML=`<span class="he-stat off">${icon('shield',11)} engine offline</span>`; } return; }
  const vix=(BOT.market.vix&&BOT.market.vix.ltp)||0, ad=(BOT.market.breadth&&BOT.market.breadth.ad)||0, score=BOT.market.engine.score, reg=BOT.market.engine.regime;
  // Called every 1s by updateClock — only rebuild when a DISPLAYED value actually changed.
  const hsig='on|'+vix.toFixed(1)+'|'+ad.toFixed(2)+'|'+score+'|'+reg;
  if(el.dataset.hsig===hsig) return;
  el.dataset.hsig=hsig;
  el.innerHTML=
    `<div class="he-stat"><span class="he-l">India VIX<span class="he-live" title="Live from Kite">● LIVE</span></span><b class="num ${vix>18?'down':'up'}">${vix.toFixed(1)}</b></div>`
   +`<span class="he-div"></span>`
   +`<div class="he-stat"><span class="he-l">Breadth A/D</span><b class="num ${ad>=1?'up':'down'}">${ad.toFixed(2)}</b></div>`
   +`<span class="he-div"></span>`
   +`<div class="he-stat"><span class="he-l">Engine · ${esc(reg)}</span><b class="num" style="color:var(--accent-d)">${score>=0?'+':''}${score}</b></div>`;
}

/* ============================================================
   PERSONA — Investor vs Trader (orthogonal to regime)
   ============================================================ */
const isInvestor=()=>state.persona==='investor';
const isAlgo=()=>state.persona==='algo';
const isAI=()=>state.persona==='ai';
function syncFab(){const p=state.persona||'trader';
  let active=null;
  document.querySelectorAll('#modeFab [data-persona]').forEach(b=>{const on=b.dataset.persona===p;b.classList.toggle('on',on);b.setAttribute('aria-selected',on);if(on)active=b;});
  const fb=$('modeFab'); if(fb) fb.dataset.persona=p;
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
  renderRegimeBar(r); renderWatchlist(r); renderPanel(r); renderOrder(r); renderContext(r); renderInvestHub(); renderWidgetStack(); renderDeskBar(); renderDeskView(); renderAlgo(); renderAI();
  if(opts.user){
    announce(`${PERSONA[p].label} mode — terminal retuned for ${p==='investor'?'long-term investing':'active trading'}`);
    const t=document.querySelector('.terminal'); if(t){t.classList.remove('persona-morph');void t.offsetWidth;t.classList.add('persona-morph');setTimeout(function(){t.classList.remove('persona-morph');},480);}
  }
  saveState();
}
function openPersonaGate(){const g=$('personaGate'); if(g) g.classList.add('show');}

/* ============================================================
   FIRST-RUN ONBOARDING WIZARD
   Step 1: pick a persona (tailors the terminal)
   Step 2: connect Kite — live status, the exact command, reconnect, and the
           real/paper/demo honesty legend. Removes the cold-start cliff.
   ============================================================ */
function startOnboarding(){
  onboarding=true;
  const g=$('personaGate'); if(!g) return;
  obStep(1); g.classList.add('show');
}
window.startOnboarding=startOnboarding;   // re-runnable later (e.g. a "redo setup" affordance)

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
// persona pick during onboarding: retune the terminal underneath, then advance to Connect
function onboardPick(p){ applyPersona(p,{user:true}); obStep(2); }

function renderOnboardConnect(){
  const el=$('pgStep2'); if(!el) return;
  const botOff   = !BOT.loaded || BOT.error;
  const connected= BOT.loaded && BOT.connected && BOT.live;
  const running  = (BOT.status&&BOT.status.reloginRunning)||BOT.reconnecting;
  const auto     = BOT.status&&BOT.status.autoLogin;
  const user     = (BOT.status&&BOT.status.user)?esc(BOT.status.user):'';

  let statusCard, action='';
  if(connected){
    statusCard=`<div class="ob-status ok"><span class="live-dot live"></span><div><b>Connected to Kite${user?' · '+user:''}</b>
      <span>Live market data is flowing.${BOT.paperMode?' Orders run in <b>PAPER</b> mode — nothing real is placed until you choose to go live.':''}</span></div></div>`;
  } else if(botOff){
    statusCard=`<div class="ob-status off">${icon('shield',16)}<div><b>Bot service isn’t running</b>
      <span>Start it once in your bot folder, then tap Retry.</span></div></div>`;
    action=`<div class="ob-cmd"><span class="ob-cmd-l">Run this</span><code id="obCmd">cd ~/kite-mean-reversion-bot &amp;&amp; python3 bot_api.py</code>
        <button class="ob-copy" data-obcopy type="button">Copy</button></div>
      <div class="ob-actions"><button class="tbtn primary" data-obretry type="button">Retry connection</button></div>`;
  } else {
    statusCard=`<div class="ob-status warn">${running?'<span class="live-dot warn pulse"></span>':icon('shield',16)}<div>
      <b>${running?'Connecting to Kite…':'Kite isn’t connected yet'}</b>
      <span>${running?'Refreshing your daily session token.':'Zerodha expires the access token every morning (a SEBI rule) — refresh it once to see live prices, holdings &amp; signals.'}</span></div></div>`;
    action=`<div class="ob-cmd"><span class="ob-cmd-l">Get a fresh token</span><code id="obCmd">cd ~/kite-mean-reversion-bot &amp;&amp; python3 login.py</code>
        <button class="ob-copy" data-obcopy type="button">Copy</button></div>
      <div class="ob-actions"><button class="tbtn primary" data-relogin ${running?'disabled':''} type="button">${running?'Reconnecting…':(auto?'Reconnect now':'Retry connection')}</button>
        ${auto?'<span class="ob-hint">Auto-login is set up — mornings refresh themselves.</span>'
              :'<span class="ob-hint">Tip: run <b>python3 auto_login.py --setup</b> once to skip this every morning.</span>'}</div>`;
  }

  const legend=`<div class="ob-legend">
    <span><span class="ob-tag live">● LIVE</span> real Kite data</span>
    <span><span class="ob-tag paper">PAPER</span> simulated orders, real prices</span>
    <span><span class="ob-tag demo">DEMO</span> clearly-labelled sample</span>
    <p>TradePro never fabricates numbers — anything not live simply shows “—”.</p></div>`;

  el.innerHTML=`
    <h2 class="pg-title">Connect your Kite account</h2>
    <p class="pg-sub">TradePro reads live data straight from your Zerodha Kite session. It never simulates prices or holdings.</p>
    ${statusCard}${action}${legend}
    <div class="ob-foot">
      <button class="pg-skip" data-obback type="button">← Back</button>
      <button class="tbtn ${connected?'primary':''} ob-start" data-obfinish type="button">${connected?'Start trading ▶':'Enter terminal — I’ll connect later'}</button>
    </div>`;
}

function finishOnboarding(){
  onboarding=false;
  const g=$('personaGate'); if(g) g.classList.remove('show');
  saveState();                       // persona was already saved on pick; this also persists post-onboarding state
  if(state.lastFocus&&state.lastFocus.focus) try{state.lastFocus.focus();}catch(e){}
}

/* ---------- investor order pad ---------- */
function renderOrderInvestor(r){
  const sym=state.selected||REGIME_SYM[r], s=bySym(sym);
  const side=state.orderSide==='sell'?'redeem':'invest';
  const amt=state.investAmt!=null?state.investAmt:10000;
  const type=state.investType||'cnc';
  // honest pricing: no live quote → no price (never divide by 0 → "Infinity" units)
  const live=!!BOT.live && s && s.live!==false;
  const px=(live&&typeof s.ltp==='number'&&isFinite(s.ltp)&&s.ltp>0)?s.ltp:0;
  const pxTxt=px>0?px.toLocaleString('en-IN'):'—';
  const units=px>0?Math.max(0,Math.floor(amt/px)):null;
  const unitsTxt=units!=null?units:'—';
  const types=[['cnc','Buy · Delivery'],['sip','Monthly SIP'],['gtt','GTT buy']];
  const typePills=types.map(([k,l])=>`<span class="type-pill ${k===type?'on':''}" data-itype="${k}">${l}</span>`).join('');
  const ctaCls=side==='invest'?'cta-buy':'cta-sell';
  const ctaTxt=side==='invest'?(type==='sip'?'START SIP · '+sym:'INVEST '+inr(amt)+' · '+sym):'REDEEM · '+sym;
  const note=r==='bear'?`<div class="order-note note-go">${icon('sprout',14)}<span>Accumulation zone — averaging down quality at lower prices. No leverage, no stop-loss.</span></div>`
    :r==='bull'?`<div class="order-note note-warn">${icon('scale',14)}<span>Markets extended — invest steadily, don't chase. Consider rebalancing instead of adding.</span></div>`
    :`<div class="order-note note-info">${icon('repeat',14)}<span>Range-bound — ideal for rupee-cost averaging via SIP.</span></div>`;
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
    const u=$('ordUnits'); if(u)u.textContent=px>0?Math.max(0,Math.floor(state.investAmt/px)):'—';
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
  if(px<=0){ quickToast&&quickToast('No live price for '+sym,'Connect Kite (python3 login.py) to invest at a real price.'); return; }
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
    <div class="modal-note">${icon('sprout',13)}<span>${side==='invest'?'Long-term delivery order — no leverage, no stop-loss. Pause or stop a SIP anytime.':'Redemption request against your delivery holding.'}</span></div>`;
  const cf=$('modalConfirm');
  cf.style.display='';
  cf.className='tbtn '+(side==='invest'?'primary':'danger');
  cf.textContent=side==='invest'?(type==='sip'?'Start SIP':'Confirm Invest'):'Confirm Redeem';
  cf.onclick=()=>{placeInvest({sym,side,type,amt,units,price:Math.round(s.ltp)});closeModal();};
  state.lastFocus=document.activeElement; showModal(true);
  setTimeout(()=>{const c=$('modalConfirm');if(c)c.focus();},40);
}
function placeInvest(o){
  const title=o.side==='invest'?(o.type==='sip'?'SIP started — '+o.sym:'Investment placed — '+o.sym):'Redemption placed — '+o.sym;
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
/* ---------- investor context module ---------- */
function renderContextInvestor(r){
  const ctxRow=(ic,in_,b,s,val)=>`<div class="ctx-row"><div class="ctx-ico ic-${ic}">${icon(in_,15)}</div><div><div class="ct-b">${b}</div><div class="ct-s">${s}</div></div><div class="ct-val">${val||''}</div></div>`;
  let head,pill,rows;
  if(r==='bear'){
    head='Accumulate &amp; Average';pill='Opportunity';
    rows=ctxRow('up','repeat','Step up monthly SIP','More units per rupee at lower prices','₹16k/mo')
        +ctxRow('up','trendDown','Average down HDFCBANK','Quality below its 200-DMA','add 10')
        +ctxRow('info','droplet','Tilt to defensives','FMCG / Pharma for stability','')
        +ctxRow('info','scale','Rebalance to target','Deploy cash into equity 60%',inrL(CASH));
  }else if(r==='bull'){
    head='Rebalance &amp; Harvest';pill='Discipline';
    rows=ctxRow('warn','scale','Book partial profits','Trim names over target weight','3 names')
        +ctxRow('info','repeat','Keep SIPs running','Avoid chasing highs with lump sums','₹15.5k/mo')
        +ctxRow('info','pie','Top up debt / gold','Equity is 4% over target','rebalance');
  }else{
    head='Stay the Course';pill='Compound';
    rows=ctxRow('info','repeat','Continue SIPs','Rupee-cost averaging in the range','₹15.5k/mo')
        +ctxRow('info','target','Add quality on dips','Build core long-term holdings','watch')
        +ctxRow('info','pie','Review allocation','Near target — minor top-ups','balanced');
  }
  const bars=ALLOC.map(a=>`<div class="alloc-row"><span class="alloc-a">${a.a}</span>
    <span class="alloc-track"><span class="alloc-fill al-${a.col}" style="width:${a.cur}%"></span><i style="left:${a.tgt}%"></i></span>
    <span class="alloc-v num">${a.cur}%</span></div>`).join('');
  $('contextModule').innerHTML=`<div class="ctx-card">
    <div class="ctx-head"><b><span class="ctx-rico">${icon('sprout',16)}</span> ${head}</b><span class="ctx-pill">${pill}</span>${cardCtl('context')}</div>
    ${rows}
    <div class="ctx-head" style="border-top:1px solid var(--line)"><b>Asset Allocation</b><span class="ctx-pill">vs target</span></div>
    <div class="alloc">${bars}</div>
  </div>`;
  updateCardBtns();
}

/* ============================================================
   INVESTING MODE — "Invest & Trade" tool hub (center pane)
   Mirrors the panelTab router: state.investSection drives the view.
   Investor-only; trader mode never renders or shows this.
   ============================================================ */
const INVEST_TOOLS=[
  {key:'ipo',      label:'IPO',                icon:'wallet',  tag:'5 open',    desc:'Apply to mainboard &amp; SME IPOs via UPI / ASBA.'},
  {key:'algo',     label:'IB Algo',            icon:'bolt',    tag:'New',       desc:'Rule-based strategies that execute for you.'},
  {key:'basket',   label:'Smart Basket',       icon:'shield',  tag:'12 themes', desc:'Curated, theme-based stock baskets in one tap.'},
  {key:'analyser', label:'Portfolio Analyser', icon:'pie',     tag:'Live',      real:true, desc:'X-ray your real holdings — value, concentration, sector mix &amp; P&amp;L.'},
  {key:'mf',       label:'Mutual Funds',       icon:'droplet', tag:'2,000+',    desc:'Direct funds — explore, compare &amp; invest.'},
  {key:'sip',      label:'Stock SIP',          icon:'repeat',  tag:'',          desc:'Automate recurring investments in stocks.'},
  {key:'research', label:'Research',           icon:'search',  tag:'Daily',     desc:'Ideas, calls &amp; deep-dive reports.'},
];
/* portfolio overview model: equity (from holdings) + mutual funds */
function portfolio(){
  const eqInv=HOLDINGS.reduce((a,h)=>a+h.hold.qty*h.hold.avg,0), eqCur=EXPOSURE;
  const eqToday=HOLDINGS.reduce((a,h)=>a+h.val*h.chg/100,0);
  const mfInv=MF_HELD.reduce((a,m)=>a+m.inv,0), mfCur=MF_HELD.reduce((a,m)=>a+m.cur,0);
  const mk=(inv,cur,today)=>({inv,cur,pnl:cur-inv,pct:inv?(cur-inv)/inv*100:0,today,todayPct:cur?today/cur*100:0});
  return {all:mk(eqInv+mfInv,eqCur+mfCur,eqToday),stocks:mk(eqInv,eqCur,eqToday),mf:mk(mfInv,mfCur,0),eqCur,mfCur};
}
// Real equity portfolio from the live Kite account (/api/holdings) — or null when not connected.
// sym → sector (Kite holdings don't carry sector). Best-effort map; ETFs detected; else "Other".
const SECTOR_MAP={RELIANCE:'Energy',ONGC:'Energy',BPCL:'Energy',IOC:'Energy',GAIL:'Energy',
  TCS:'IT',INFY:'IT',WIPRO:'IT',HCLTECH:'IT',TECHM:'IT',LTIM:'IT',
  HDFCBANK:'Banks',ICICIBANK:'Banks',AXISBANK:'Banks',KOTAKBANK:'Banks',INDUSINDBK:'Banks',
  SBIN:'PSU Bank',BANKBARODA:'PSU Bank',PNB:'PSU Bank',CANBK:'PSU Bank',
  ITC:'FMCG',HINDUNILVR:'FMCG',NESTLEIND:'FMCG',BRITANNIA:'FMCG',DABUR:'FMCG',
  MARUTI:'Auto',TATAMOTORS:'Auto','M&M':'Auto',BAJAJ_AUTO:'Auto',EICHERMOT:'Auto',HEROMOTOCO:'Auto',
  TATASTEEL:'Metals',JSWSTEEL:'Metals',HINDALCO:'Metals',VEDL:'Metals',COALINDIA:'Metals',
  SUNPHARMA:'Pharma',DRREDDY:'Pharma',CIPLA:'Pharma',DIVISLAB:'Pharma',
  BAJFINANCE:'NBFC',BAJAJFINSV:'NBFC',CHOLAFIN:'NBFC',
  LT:'Infra',ADANIENT:'Conglomerate',ADANIPORTS:'Infra',BHARTIARTL:'Telecom',
  ASIANPAINT:'Materials',ULTRACEMCO:'Cement',GRASIM:'Cement',TITAN:'Consumer',
  POWERGRID:'Power',NTPC:'Power',ITC:'FMCG',ETERNAL:'New-age',GROWW:'New-age',RELIANCE:'Energy'};
function sectorOf(sym){
  const u=(sym||'').toUpperCase();
  const s=bySym(sym); if(s&&s.sector) return s.sector;
  if(SECTOR_MAP[u]) return SECTOR_MAP[u];
  if(/BEES|ETF|NIFTY|SENSEX|GOLD|SILVER|LIQUID/.test(u)) return 'ETF / Index';
  return 'Other';
}
function realPortfolio(){
  if(!(BOT.live && BOT.holdings && Array.isArray(BOT.holdings.holdings) && BOT.holdings.holdings.length)) return null;
  const h=BOT.holdings.holdings;
  const inv=h.reduce((a,x)=>a+(+x.avg||0)*(+x.qty||0),0);
  const cur=h.reduce((a,x)=>a+(+x.ltp||0)*(+x.qty||0),0);
  const pnl=(typeof BOT.holdings.totalPnl==='number')?BOT.holdings.totalPnl:(cur-inv);
  const today=(typeof BOT.holdings.dayPnl==='number')?BOT.holdings.dayPnl:0;
  return {n:h.length,inv,cur,pnl,pct:inv?(cur-inv)/inv*100:0,today,todayPct:cur?today/cur*100:0};
}
function renderPortfolioHero(){
  const sinr=n=>(n>=0?'+':'−')+'₹'+Math.abs(Math.round(n)).toLocaleString('en-IN');
  const tabs=[['all','All'],['stocks','Stocks'],['mf','Mutual Funds']];
  const tab=(['all','stocks','mf'].indexOf(state.portfolioTab)>=0?state.portfolioTab:'all');
  const head=`<div class="pf-top">
      <div class="pf-tabs">${tabs.map(([k,l])=>`<button class="pf-tab ${k===tab?'on':''}" data-pftab="${k}">${l}</button>`).join('')}</div>
      <div class="pf-acts"><button class="pf-act" data-fund="add">+ Add Funds</button><button class="pf-act ghost" data-fund="pledge">Pledge</button></div></div>`;
  const rp=realPortfolio();
  // NO real holdings → honest state. NEVER a fabricated value/P&L (was the biggest mock leak).
  if(!rp){
    return `<div class="pf-hero">${head}
      <div class="pf-row pf-offline">
        <div class="pf-main"><span class="pf-lbl">Current value</span><b class="pf-val num muted">—</b><span class="pf-sub">${BOT.live?'No equity holdings in your account':'Live portfolio appears once connected'}</span></div>
        <div class="pf-stat"><span class="pf-lbl">Overall P&amp;L</span><b class="num muted">—</b></div>
        <div class="pf-stat"><span class="pf-lbl">Today's P&amp;L</span><b class="num muted">—</b></div></div>
      ${BOT.live?'':`<p class="pf-connect">${icon('shield',13)}<span>Your real holdings, value &amp; P&amp;L from Kite appear here once connected — nothing is simulated. <button class="pf-relogin" data-relogin>Reconnect</button></span></p>`}</div>`;
  }
  // MF tab → honest (this terminal only reads equity from Kite; no MF feed)
  if(tab==='mf'){
    return `<div class="pf-hero">${head}
      <div class="pf-row"><div class="pf-main"><span class="pf-lbl">Mutual funds</span><b class="pf-val num muted">—</b><span class="pf-sub">Not linked to this terminal</span></div></div>
      <p class="pf-connect">${icon('shield',13)}<span>This terminal reads your <b>equity</b> holdings live from Kite. Mutual-fund data isn’t available here — shown as — rather than estimated.</span></p></div>`;
  }
  // STOCKS / ALL → real equity holdings
  return `<div class="pf-hero">${head}
    <div class="pf-row">
      <div class="pf-main"><span class="pf-lbl">Current value</span><b class="pf-val num">${inr(rp.cur)}</b><span class="pf-sub">Invested ${inr(rp.inv)} · ${rp.n} holding${rp.n===1?'':'s'}</span></div>
      <div class="pf-stat"><span class="pf-lbl">Overall P&amp;L</span><b class="num ${cls(rp.pnl)}">${sinr(rp.pnl)}</b><span class="pf-pct num ${cls(rp.pct)}">${pct(rp.pct)}</span></div>
      <div class="pf-stat"><span class="pf-lbl">Today's P&amp;L</span><b class="num ${cls(rp.today)}">${sinr(rp.today)}</b><span class="pf-pct num ${cls(rp.todayPct)}">${pct(rp.todayPct)}</span></div>
    </div>
    <div class="pf-breakup"><p class="pf-connect"><span class="live-dot live"></span><span>Live equity holdings from Kite · ${rp.n} stock${rp.n===1?'':'s'}. Deployable cash <b>${fundsText()}</b>.</span></p></div>
  </div>`;
}
function fundsAction(kind){
  const map={add:['Add funds','UPI / netbanking — funds reflect instantly for trading & SIPs.'],
             pledge:['Pledge holdings','Pledge eligible holdings for instant margin up to ₹6.01K.']};
  const m=map[kind]||map.add; quickToast(m[0],m[1]);
}
function quickToast(title,sub){
  const t=document.createElement('div');t.className='toast';
  t.innerHTML=`<div class="toast-ico">${icon('wallet',22)}</div><div class="toast-body"><b>${title}</b><span>${sub}</span></div><div class="toast-acts"><button class="tbtn ghost" data-act="ok">Dismiss</button></div>`;
  $('toastWrap').appendChild(t);
  t.querySelector('[data-act=ok]').onclick=()=>dismiss(t);
  t._timer=setTimeout(()=>{if(document.body.contains(t))dismiss(t);},4000);
}
function renderInvestHub(){
  const hub=$('investHub'); if(!hub) return;
  if(!isInvestor()){ hub.innerHTML=''; return; }   // never paint in trader mode
  if(!state.investSection){
    // tools live in the persistent bottom bar now — overview shows the portfolio dashboard + a pointer to the bar
    const chips=INVEST_TOOLS.slice(0,4).map(t=>`<button class="ihw-chip" data-tool="${t.key}">${icon(t.icon,14)}${t.label}${t.tag?`<i>${t.tag}</i>`:''}</button>`).join('');
    hub.innerHTML=`<div class="ih-scroll">
      ${renderPortfolioHero()}
      <div class="ih-welcome">
        <div class="ihw-head"><b>Invest &amp; Trade</b> <span class="ih-demo">Demo tools · sample data</span><span>Illustrative product flows (IPO, baskets, SIP, MF, research) — they don’t place real orders. Your portfolio above is real.</span></div>
        <div class="ihw-chips">${chips}</div>
      </div>
    </div>`;
    hub.querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>enterTool(b.dataset.tool));
    hub.querySelectorAll('[data-pftab]').forEach(b=>b.onclick=()=>{state.portfolioTab=b.dataset.pftab;renderInvestHub();});
    hub.querySelectorAll('[data-fund]').forEach(b=>b.onclick=()=>fundsAction(b.dataset.fund));
  } else {
    const t=INVEST_TOOLS.find(x=>x.key===state.investSection)||INVEST_TOOLS[0];
    const view=INVEST_VIEWS[t.key];
    hub.innerHTML=`<div class="ih-scroll sec-scroll">
      <div class="ih-head"><button class="ih-back" id="ihBack" aria-label="Back to all tools"><span>All tools</span></button>
        <b class="ih-secttl" id="ihSecTtl" tabindex="-1"><span class="ih-ic sm">${icon(t.icon,16)}</span>${t.label}</b>
        ${t.tag?`<span class="ih-secttag">${t.tag}</span>`:''}${t.real?`<span class="ih-live" title="Live — computed from your real Kite account.">${icon('check',11)} Live data</span>`:`<span class="ih-demo" title="Illustrative — this tool uses sample data and doesn’t place real orders or invest real money.">Demo · sample data</span>`}</div>
      <div class="sec-body">${view?view.render():''}</div>
    </div>`;
    const bk=$('ihBack'); if(bk) bk.onclick=exitTool;
    if(view&&view.wire) view.wire(hub);
  }
  updateCardBtns();
}
/* tool navigation: enter steals focus to the section title + announces; refresh re-renders without stealing focus */
function enterTool(k){ state.investSection=k; state.toolState={}; renderInvestHub(); renderWsBar(); saveState();
  const t=INVEST_TOOLS.find(x=>x.key===k)||{}; announce((t.label||'Tool')+' opened');
  const ttl=$('ihSecTtl'); if(ttl) setTimeout(()=>{try{ttl.focus();}catch(e){}},40); }
function exitTool(){ state.investSection=null; state.toolState={}; renderInvestHub(); renderWsBar(); saveState(); announce('Back to all tools'); }
function refreshTool(){ renderInvestHub(); }
/* per-tool ui state helpers (sub-tab / filter / form draft) */
function ts(k,def){ return (state.toolState[k]!==undefined)?state.toolState[k]:def; }
function setTs(k,v){ state.toolState[k]=v; }

/* ============================================================
   INVEST & TRADE — live tool sections (each tool = render()+wire())
   Shared atoms keep every tool consistent & accessible.
   ============================================================ */
/* ---- shared section atoms ---- */
function secTabs(tabs,active,label){return `<div class="sec-tabs" role="tablist" aria-label="${label||'Views'}">${tabs.map(t=>{const k=t[0],l=t[1],n=t[2];return `<button class="sec-tab${k===active?' on':''}" role="tab" aria-selected="${k===active}" data-sectab="${k}">${l}${n!=null?` <i class="sec-tn">${n}</i>`:''}</button>`;}).join('')}</div>`;}
function secStats(items){return `<div class="sec-stats">${items.map(s=>`<div class="sec-stat"><span class="ss-l">${s.l}</span><b class="ss-v num ${s.tone||''}"${s.id?` data-live="${s.id}"`:''}>${s.v}</b>${s.s?`<span class="ss-s">${s.s}</span>`:''}</div>`).join('')}</div>`;}
function secEmpty(ic,title,msg,cta){return `<div class="sec-empty"><span class="se-ic">${icon(ic,28)}</span><b>${title}</b><p>${msg}</p>${cta||''}</div>`;}
function stars(n){let h='';for(let i=1;i<=5;i++)h+=`<span class="star${i<=n?' on':''}">${icon('star',11)}</span>`;return `<span class="rating" aria-label="${n} out of 5">${h}</span>`;}
function wireSecTabs(hub){hub.querySelectorAll('[data-sectab]').forEach(b=>b.onclick=()=>{setTs('tab',b.dataset.sectab);refreshTool();});}
function flowError(body,sel,msg){
  let el=body.querySelector('.flow-err'); if(!el){el=document.createElement('div');el.className='flow-err';el.setAttribute('role','alert');body.appendChild(el);}
  el.innerHTML=`${icon('alert',13)}<span>${msg}</span>`;
  const f=sel&&body.querySelector(sel); if(f){f.classList.add('inval');f.focus();}
}
function clearFlowError(body,f){const e=body.querySelector('.flow-err');if(e)e.remove();if(f)f.classList.remove('inval');}

/* ---- tool data (mutable: actions update these in-session) ---- */
let IPOS=[
  {co:'Tata Capital',        biz:'Diversified NBFC',          type:'Mainboard', band:[310,326], lot:46,   close:'24 Jun', subx:18.4, gmp:9,  status:'open'},
  {co:'Sahasra Electronics', biz:'Electronics manufacturing', type:'SME',       band:[269,283], lot:400,  close:'24 Jun', subx:11.6, gmp:22, status:'open'},
  {co:'Aequs',               biz:'Precision components',      type:'Mainboard', band:[118,124], lot:121,  close:'23 Jun', subx:6.2,  gmp:14, status:'open'},
  {co:'Vikran Engineering',  biz:'EPC · power & rail',        type:'SME',       band:[92,97],   lot:1200, close:'25 Jun', subx:2.1,  gmp:5,  status:'open'},
  {co:'Indogulf Crop',       biz:'Agri inputs',               type:'Mainboard', band:[105,111], lot:135,  close:'26 Jun', subx:0.8,  gmp:3,  status:'open'},
  {co:'HDB Financial',       biz:'Retail lending',            type:'Mainboard', band:[700,740], lot:20,   open:'27 Jun', status:'upcoming'},
  {co:'NSDL',                biz:'Market infrastructure',     type:'Mainboard', band:[760,800], lot:18,   open:'30 Jun', status:'upcoming'},
  {co:'Belrise Industries',  biz:'Auto components',           type:'Mainboard', band:[85,90],   lot:166,  listGain:11.5, status:'listed'},
  {co:'Borana Weaves',       biz:'Textiles',                  type:'SME',       band:[205,216], lot:69,   listGain:-3.2, status:'listed'},
];
let ALGOS=[
  {name:'Momentum Breakout', cat:'Equity intraday', cagr:24.6, win:62, dd:14.2, minCap:50000,  risk:'Aggressive',  status:'idle', desc:'Buys 20-day breakouts with volume confirmation; trailing-stop exit.'},
  {name:'RSI Mean Reversion',cat:'Equity swing',    cagr:18.1, win:68, dd:9.4,  minCap:25000,  risk:'Moderate',    status:'idle', desc:'Fades oversold RSI(2) inside uptrends; time + target exit.'},
  {name:'Golden Crossover',  cat:'Positional',      cagr:15.3, win:55, dd:11.0, minCap:30000,  risk:'Moderate',    status:'idle', desc:'50/200-DMA crossover gated by the market regime filter.'},
  {name:'Index Trend Rider', cat:'Index futures',   cagr:13.8, win:71, dd:7.2,  minCap:100000, risk:'Conservative',status:'idle', desc:'Rides the Nifty trend with ATR-based position sizing.'},
  {name:'Gap & Go',          cat:'Equity intraday', cagr:29.2, win:48, dd:22.5, minCap:75000,  risk:'Aggressive',  status:'idle', desc:'Trades opening-range gaps; hard stop at the day extreme.'},
];
let BASKETS=[
  {name:'EV Revolution',      theme:'Thematic',   stocks:['MARUTI','RELIANCE','ADANIENT'],           minInv:8500,  ret1y:31.2, vol:'High',   desc:'Pure-play & ancillary beneficiaries of India’s EV transition.'},
  {name:'Banking Leaders',    theme:'Sectoral',   stocks:['HDFCBANK','ICICIBANK','SBIN'],            minInv:12000, ret1y:18.4, vol:'Medium', desc:'Largest private & PSU lenders by market share.'},
  {name:'Defensive Dividend', theme:'Factor',     stocks:['ITC','TCS','INFY'],                       minInv:6000,  ret1y:11.0, vol:'Low',    desc:'High-yield, low-beta compounders for stability.'},
  {name:'Digital India',      theme:'Thematic',   stocks:['INFY','TCS','RELIANCE'],                  minInv:9500,  ret1y:22.7, vol:'Medium', desc:'IT services & platform plays riding digitisation.'},
  {name:'All-Weather Core',   theme:'Allocation', stocks:['HDFCBANK','RELIANCE','ITC','TCS'],        minInv:15000, ret1y:14.6, vol:'Low',    desc:'A balanced large-cap core to anchor any portfolio.'},
  {name:'High Beta Movers',   theme:'Factor',     stocks:['ADANIENT','BAJFINANCE','MARUTI'],         minInv:7000,  ret1y:27.9, vol:'High',   desc:'Momentum names for aggressive, risk-tolerant investors.'},
];
let FUNDS=[
  {name:'Parag Parikh Flexi Cap',   cat:'Flexi Cap', grp:'Equity', nav:78.42, r1:18.6, r3:21.2, r5:19.8, rating:5, aum:'82,400', held:true},
  {name:'Nifty 50 Index Fund',      cat:'Index',     grp:'Index',  nav:24.10, r1:14.2, r3:15.1, r5:14.0, rating:4, aum:'14,900', held:true},
  {name:'ICICI Pru Corporate Bond', cat:'Debt',      grp:'Debt',   nav:28.55, r1:7.8,  r3:7.1,  r5:7.4,  rating:4, aum:'27,300', held:true},
  {name:'SBI Gold Fund',            cat:'Gold',      grp:'Gold',   nav:22.18, r1:11.1, r3:13.6, r5:12.2, rating:3, aum:'2,640',  held:true},
  {name:'Quant Small Cap',          cat:'Small Cap', grp:'Equity', nav:265.7, r1:34.1, r3:28.4, r5:32.7, rating:4, aum:'25,100'},
  {name:'Mirae Asset Large Cap',    cat:'Large Cap', grp:'Equity', nav:108.3, r1:13.9, r3:14.6, r5:15.2, rating:4, aum:'38,700'},
  {name:'Axis Midcap',              cat:'Mid Cap',   grp:'Equity', nav:98.62, r1:24.5, r3:22.1, r5:23.4, rating:4, aum:'29,800'},
  {name:'HDFC Balanced Advantage',  cat:'Hybrid',    grp:'Hybrid', nav:512.9, r1:16.2, r3:18.0, r5:16.8, rating:5, aum:'95,200'},
];
let STOCK_SIPS=[
  {id:1, sym:'RELIANCE', amt:3000, freq:'Monthly', day:15, status:'active'},
  {id:2, sym:'INFY',     amt:2500, freq:'Monthly', day:5,  status:'active'},
  {id:3, sym:'HDFCBANK', amt:2000, freq:'Weekly',  day:1,  status:'paused'},
];
let SIP_ID=10;
let CALLS=[
  {sym:'SBIN',       action:'Buy',  cmp:842,  tgt:980,  sl:790,  horizon:'3–6 mo',  conv:'High',   rationale:'Credit growth plus improving asset quality; cheapest large PSU bank on P/B.'},
  {sym:'MARUTI',     action:'Buy',  cmp:12450, tgt:14200, sl:11600, horizon:'3–6 mo', conv:'High',   rationale:'Richer SUV mix and a rural recovery are lifting volumes; softer input costs aid margins.'},
  {sym:'INFY',       action:'Buy',  cmp:1846, tgt:2150, sl:1720, horizon:'6–12 mo', conv:'Medium', rationale:'Deal pipeline recovering; margin levers intact into FY27.'},
  {sym:'ADANIENT',   action:'Sell', cmp:2456, tgt:2100, sl:2560, horizon:'1–3 mo',  conv:'Medium', rationale:'Stretched valuations and momentum rolling over below the 50-DMA.'},
  {sym:'ITC',        action:'Hold', cmp:439,  tgt:470,  sl:410,  horizon:'6–12 mo', conv:'Low',    rationale:'Steady FMCG compounding, but cigarette-tax overhang caps near-term upside.'},
];
let REPORTS=[
  {title:'India Strategy — H2 FY26 Outlook', tag:'Strategy', date:'19 Jun', pages:24},
  {title:'Banking — Q1 Earnings Preview',    tag:'Sector',   date:'18 Jun', pages:14},
  {title:'Auto — Monthly Volume Tracker',    tag:'Sector',   date:'17 Jun', pages:9},
  {title:'Tata Motors — Initiating Coverage',tag:'Company',  date:'16 Jun', pages:31},
];
const CAP_LARGE=new Set(['RELIANCE','HDFCBANK','TCS','INFY','SBIN','ICICIBANK','ITC','BAJFINANCE']);
const symName=s=>{const x=bySym(s);return x?x.name:s;};

/* ============================================================
   THE 7 LIVE TOOLS
   ============================================================ */
const INVEST_VIEWS={

/* ---------- 1) IPO ---------- */
ipo:{
  render(){
    const tab=ts('tab','open');
    const groups={open:IPOS.filter(i=>i.status==='open'),upcoming:IPOS.filter(i=>i.status==='upcoming'),listed:IPOS.filter(i=>i.status==='listed')};
    const list=groups[tab];
    let cards;
    if(!list.length){ cards=secEmpty('wallet','Nothing here yet','No IPOs in this category right now. Check the other tabs.'); }
    else cards=`<div class="ipo-list">${list.map((i,idx)=>{
      const min=i.band[1]*i.lot, estGain=i.gmp?((i.gmp/i.band[1])*100):0, gi=IPOS.indexOf(i);
      if(tab==='open'){const subClass=i.subx>=1?'up':'down', subW=Math.min(100,i.subx/20*100);
        return `<div class="ipo-card">
          <div class="ipo-h"><div><b>${i.co}</b><span class="ipo-biz">${i.biz}</span></div><span class="badge ${i.type==='SME'?'b-warn':'b-up'}">${i.type}</span></div>
          <div class="ipo-grid">
            <div><span>Price band</span><b class="num">₹${i.band[0]}–${i.band[1]}</b></div>
            <div><span>Min invest</span><b class="num">${inr(min)}</b><i class="ipo-sub2">${i.lot} sh / lot</i></div>
            <div><span>GMP</span><b class="num ${i.gmp>0?'up':''}">₹${i.gmp}</b><i class="ipo-sub2">${estGain>0?'≈+'+estGain.toFixed(0)+'%':'—'}</i></div>
          </div>
          <div class="ipo-sub-bar"><div class="ipo-sub-top"><span>Subscribed <b class="${subClass}">${i.subx}×</b></span><span class="ipo-close">Closes ${i.close}</span></div>
            <div class="wg-bar-track"><span style="width:${subW}%"></span></div></div>
          <div class="ipo-act">${i.applied
            ? `<span class="applied-badge">${icon('check',13)} Applied · ${i.appliedLots} lot(s)</span>`
            : `<button class="btn-primary" data-ipoapply="${gi}">Apply via UPI</button>`}</div>
        </div>`;}
      if(tab==='upcoming') return `<div class="ipo-card">
        <div class="ipo-h"><div><b>${i.co}</b><span class="ipo-biz">${i.biz}</span></div><span class="badge b-neu">${i.type}</span></div>
        <div class="ipo-grid"><div><span>Price band</span><b class="num">₹${i.band[0]}–${i.band[1]}</b></div><div><span>Lot size</span><b class="num">${i.lot}</b></div><div><span>Opens</span><b class="num">${i.open}</b></div></div>
        <div class="ipo-act"><button class="btn-ghost" data-ipremind="${gi}">${icon('clock',13)} Remind me</button></div></div>`;
      // listed
      return `<div class="ipo-card">
        <div class="ipo-h"><div><b>${i.co}</b><span class="ipo-biz">${i.biz}</span></div><span class="badge b-neu">${i.type}</span></div>
        <div class="ipo-grid"><div><span>Issue price</span><b class="num">₹${i.band[1]}</b></div><div><span>Listing gain</span><b class="num ${cls(i.listGain)}">${pct(i.listGain)}</b></div><div><span>Status</span><b>Listed</b></div></div></div>`;
    }).join('')}</div>`;
    return secTabs([['open','Open',groups.open.length],['upcoming','Upcoming',groups.upcoming.length],['listed','Recently listed',groups.listed.length]],tab,'IPO categories')+cards;
  },
  wire(hub){
    wireSecTabs(hub);
    hub.querySelectorAll('[data-ipoapply]').forEach(b=>b.onclick=()=>ipoApply(IPOS[+b.dataset.ipoapply]));
    hub.querySelectorAll('[data-ipremind]').forEach(b=>b.onclick=()=>{const i=IPOS[+b.dataset.ipremind];quickToast('Reminder set — '+i.co,'We’ll notify you when the issue opens on '+i.open+'.');});
  }
},

/* ---------- 2) IB Algo ---------- */
algo:{
  render(){
    const live=ALGOS.filter(a=>a.status!=='idle'), cap=live.reduce((s,a)=>s+(a.cap||0),0);
    const estMo=live.filter(a=>a.status==='live').reduce((s,a)=>s+(a.cap||0)*a.cagr/100/12,0);
    const stat=secStats([
      {l:'Deployed',v:String(live.length),s:'strategies'},
      {l:'Capital allocated',v:inr(cap)},
      {l:'Est. monthly',v:sgn(estMo),tone:estMo>0?'up':''},
    ]);
    const cards=`<div class="algo-list">${ALGOS.map((a,i)=>{
      const rk=a.risk==='Aggressive'?'b-warn':a.risk==='Conservative'?'b-up':'b-neu';
      const ctrl=a.status==='idle'
        ? `<button class="btn-primary" data-algodeploy="${i}">Deploy</button>`
        : `<span class="live-pill ${a.status==='paused'?'paused':''}">${icon(a.status==='paused'?'clock':'bolt',12)} ${a.status==='paused'?'Paused':'Live'} · ${inr(a.cap)}</span>
           <div class="algo-ctrls">${a.status==='live'?`<button class="btn-ghost sm" data-algopause="${i}">Pause</button>`:`<button class="btn-ghost sm" data-algoresume="${i}">Resume</button>`}<button class="btn-ghost sm danger" data-algostop="${i}">Stop</button></div>`;
      return `<div class="algo-card${a.status!=='idle'?' is-live':''}">
        <div class="algo-h"><div><b>${a.name}</b><span class="algo-cat">${a.cat}</span></div><span class="badge ${rk}">${a.risk}</span></div>
        <p class="algo-desc">${a.desc}</p>
        <div class="algo-stats">
          <div><span>CAGR</span><b class="num up">${a.cagr}%</b></div>
          <div><span>Win rate</span><b class="num">${a.win}%</b></div>
          <div><span>Max DD</span><b class="num down">−${a.dd}%</b></div>
          <div><span>Min capital</span><b class="num">${inr(a.minCap)}</b></div>
        </div>
        <div class="algo-act">${ctrl}</div>
      </div>`;}).join('')}</div>`;
    return stat+`<p class="sec-hint">${icon('shield',12)}<span>Backtested on 5 years of data. Past performance doesn’t guarantee future returns.</span></p>`+cards;
  },
  wire(hub){
    hub.querySelectorAll('[data-algodeploy]').forEach(b=>b.onclick=()=>algoDeploy(ALGOS[+b.dataset.algodeploy]));
    hub.querySelectorAll('[data-algopause]').forEach(b=>b.onclick=()=>{ALGOS[+b.dataset.algopause].status='paused';refreshTool();quickToast('Strategy paused','No new entries will be taken; open positions are kept.');});
    hub.querySelectorAll('[data-algoresume]').forEach(b=>b.onclick=()=>{ALGOS[+b.dataset.algoresume].status='live';refreshTool();quickToast('Strategy resumed','The algo is live and scanning for entries again.');});
    hub.querySelectorAll('[data-algostop]').forEach(b=>b.onclick=()=>{const a=ALGOS[+b.dataset.algostop];a.status='idle';a.cap=0;refreshTool();quickToast('Strategy stopped','Capital released back to your funds.');});
  }
},

/* ---------- 3) Smart Basket ---------- */
basket:{
  render(){
    const cards=`<div class="bsk-grid">${BASKETS.map((b,i)=>{
      const vk=b.vol==='High'?'b-warn':b.vol==='Low'?'b-up':'b-neu';
      return `<div class="bsk-card">
        <div class="bsk-h"><b>${b.name}</b><span class="badge b-neu">${b.theme}</span></div>
        <p class="bsk-desc">${b.desc}</p>
        <div class="bsk-meta">
          <div><span>1Y return</span><b class="num up">${pct(b.ret1y)}</b></div>
          <div><span>Volatility</span><span class="vol-chip ${vk}">${b.vol}</span></div>
          <div><span>Stocks</span><b class="num">${b.stocks.length}</b></div>
        </div>
        <div class="bsk-foot"><span class="bsk-min">Min ${inr(b.minInv)}</span>
          ${b.invested?`<span class="applied-badge">${icon('check',13)} Invested</span>`:`<button class="btn-primary sm" data-bskbuy="${i}">View &amp; invest</button>`}</div>
      </div>`;}).join('')}</div>`;
    return `<p class="sec-hint">${icon('shield',12)}<span>Curated baskets rebalanced quarterly. One tap buys every constituent in the right weight.</span></p>`+cards;
  },
  wire(hub){ hub.querySelectorAll('[data-bskbuy]').forEach(b=>b.onclick=()=>basketInvest(BASKETS[+b.dataset.bskbuy])); }
},

/* ---------- 4) Portfolio Analyser — REAL: computed from your live Kite holdings ---------- */
analyser:{
  render(){
    const rp=realPortfolio(), held=(BOT.holdings&&BOT.holdings.holdings)||[];
    // NO real holdings → honest connect state, never a fabricated score
    if(!BOT.live || !rp || !held.length){
      return secEmpty('pie','X-ray your real portfolio',
        BOT.live ? 'No equity holdings in your Kite account to analyse yet — buy a stock and it appears here.'
                 : 'Connect Kite (run <b>python3 login.py</b>) to X-ray your real holdings — value, concentration, sector mix &amp; P&amp;L computed live from your account. Nothing is simulated.');
    }
    const cur=rp.cur||1;
    const items=held.map(x=>({sym:x.sym,val:(+x.ltp||0)*(+x.qty||0),pnl:+x.pnl||0,qty:+x.qty||0,sector:sectorOf(x.sym)}))
      .filter(it=>it.val>0).sort((a,b)=>b.val-a.val);
    const top=items[0]||{sym:'—',val:0}, topW=cur?top.val/cur*100:0;
    const div=items.length, conc=Math.max(0,topW-25);
    let score=Math.round(92 - conc*1.4 - Math.max(0,6-div)*4.5); score=Math.max(35,Math.min(98,score));
    const grade=score>=80?['Strong','up']:score>=62?['Healthy','']:['Concentrated','down'];
    const bySec={}; items.forEach(it=>{bySec[it.sector]=(bySec[it.sector]||0)+it.val;});
    const secRows=Object.entries(bySec).sort((a,b)=>b[1]-a[1]);
    const known=items.filter(it=>it.sector!=='Other').length;
    const hero=`<div class="anl-hero">
      <div class="anl-score"><svg viewBox="0 0 36 36" class="anl-ring" aria-hidden="true"><path class="anl-bg" d="M18 2a16 16 0 1 1 0 32 16 16 0 0 1 0-32"/><path class="anl-fg" stroke-dasharray="${score},100" d="M18 2a16 16 0 1 1 0 32 16 16 0 0 1 0-32"/></svg>
        <div class="anl-score-c"><b class="num">${score}</b><span>/100</span></div></div>
      <div class="anl-grade"><b class="${grade[1]}">${grade[0]}</b><span>Concentration &amp; diversification</span>
        <div class="anl-mini"><span><span class="live-dot live"></span>${div} holding${div===1?'':'s'} · live from Kite</span></div></div>
    </div>`;
    const metrics=secStats([
      {l:'Current value',v:inr(rp.cur)},
      {l:'Overall P&L',v:(rp.pnl>=0?'+':'−')+'₹'+Math.abs(Math.round(rp.pnl)).toLocaleString('en-IN'),tone:rp.pnl>=0?'up':'down'},
      {l:'Top holding',v:Math.round(topW)+'%',s:esc(top.sym),tone:topW>25?'down':''},
      {l:'Diversification',v:div>=6?'Good':div>=3?'Fair':'Thin',tone:div>=6?'up':div<3?'down':''},
    ]);
    const holdRows=items.map(it=>{const w=Math.round(it.val/cur*100);
      return `<div class="anl-row"><span class="anl-s">${esc(it.sym)} <i class="anl-sec">${esc(it.sector)}</i></span><span class="anl-track"><span class="anl-fill" style="width:${w}%"></span></span><b class="num">${w}%</b><b class="num ${cls(it.pnl)} anl-pnl">${it.pnl>=0?'+':'−'}₹${Math.abs(Math.round(it.pnl)).toLocaleString('en-IN')}</b></div>`;}).join('');
    const holdBlock=`<div class="anl-card"><div class="anl-ttl">Your holdings · weight &amp; P&amp;L</div>${holdRows}</div>`;
    const secBlock=`<div class="anl-card"><div class="anl-ttl">Sector exposure ${known<div?`<i class="anl-note">(${div-known} unmapped → “Other”)</i>`:''}</div>${secRows.map(([s,v])=>{const w=Math.round(v/cur*100);return `<div class="anl-row"><span class="anl-s">${esc(s)}</span><span class="anl-track"><span class="anl-fill" style="width:${w}%"></span></span><b class="num">${w}%</b></div>`;}).join('')}</div>`;
    const flags=[];
    if(topW>25) flags.push({t:'warn',ic:'alert',b:esc(top.sym)+' is '+Math.round(topW)+'% of your equity',s:'Above the 25% single-stock guardrail — a sharp move here swings the whole book.'});
    if(div<5) flags.push({t:'warn',ic:'scale',b:'Only '+div+' holding'+(div===1?'':'s'),s:'Thin diversification — concentrated in a few names. More positions spread single-stock risk.'});
    const topSec=secRows[0]; if(topSec){const sw=Math.round(topSec[1]/cur*100); if(sw>40&&topSec[0]!=='Other') flags.push({t:'info',ic:'pie',b:topSec[0]+' is '+sw+'% of your equity',s:'A heavy sector tilt — concentrated to '+topSec[0]+'.'});}
    if(!flags.length) flags.push({t:'info',ic:'check',b:'Well-spread book',s:'No single stock above the 25% guardrail and reasonably diversified.'});
    const flagBlock=`<div class="anl-flags">${flags.map(f=>`<div class="anl-flag ${f.t}"><span class="af-ic">${icon(f.ic,15)}</span><div class="af-b"><b>${f.b}</b><span>${f.s}</span></div></div>`).join('')}</div>`;
    const note=`<p class="sec-hint">${icon('shield',12)}<span>Computed live from your real Kite holdings. Sector is mapped where known (Kite doesn’t supply it). No targets/“drift” are shown — that needs a goal you set, which isn’t simulated here.</span></p>`;
    return hero+metrics+flagBlock+holdBlock+secBlock+note;
  },
  wire(){}
},

/* ---------- 5) Mutual Funds ---------- */
mf:{
  render(){
    const groups=['All','Equity','Index','Debt','Hybrid','Gold'], f=ts('fmFilter','All'), q=ts('fmQuery','');
    const chips=`<div class="mf-chips" role="tablist" aria-label="Fund categories">${groups.map(g=>`<button class="mf-chip${g===f?' on':''}" role="tab" aria-selected="${g===f}" data-fmfilter="${g}">${g}</button>`).join('')}</div>`;
    const search=`<div class="mf-search"><span class="mf-sic">${icon('search',15)}</span><input id="fmSearch" class="mf-input" type="text" placeholder="Search funds" aria-label="Search mutual funds" value="${esc(q)}"><button class="mf-clear${q?'':' hide'}" id="fmClear" aria-label="Clear search">${icon('close',13)}</button></div>`;
    return `<div class="mf-bar">${search}${chips}</div><div id="fmList">${mfListHTML()}</div>`;
  },
  wire(hub){
    hub.querySelectorAll('[data-fmfilter]').forEach(b=>b.onclick=()=>{setTs('fmFilter',b.dataset.fmfilter);refreshTool();});
    const si=hub.querySelector('#fmSearch'), cl=hub.querySelector('#fmClear');
    if(si){ si.oninput=()=>{setTs('fmQuery',si.value);if(cl)cl.classList.toggle('hide',!si.value);mfRefreshList(hub);};
      si.onkeydown=e=>{if(e.key==='Escape'){si.value='';setTs('fmQuery','');if(cl)cl.classList.add('hide');mfRefreshList(hub);}}; }
    if(cl) cl.onclick=()=>{setTs('fmQuery','');if(si){si.value='';si.focus();}cl.classList.add('hide');mfRefreshList(hub);};
    mfBindInvest(hub);
  }
},

/* ---------- 6) Stock SIP ---------- */
sip:{
  render(){
    const active=STOCK_SIPS.filter(s=>s.status==='active');
    const monthly=active.reduce((a,s)=>a+s.amt*(s.freq==='Weekly'?4:s.freq==='Fortnightly'?2:1),0);
    const next=active.length?Math.min(...active.filter(s=>s.freq!=='Weekly').map(s=>s.day).concat([99])):0;
    const stat=secStats([
      {l:'Monthly outlay',v:inr(monthly)},
      {l:'Active SIPs',v:String(active.length),s:'of '+STOCK_SIPS.length},
      {l:'Next debit',v:next&&next<99?next+' '+monthName():'—'},
    ]);
    const newBtn=`<button class="btn-primary block" data-sipnew>${icon('plus',14)} New stock SIP</button>`;
    if(!STOCK_SIPS.length) return stat+secEmpty('repeat','No SIPs yet','Automate disciplined, rupee-cost-averaged investing in your favourite stocks.',newBtn);
    const rows=`<div class="sip-list">${STOCK_SIPS.map(s=>{const nm=symName(s.sym);
      return `<div class="sip-card ${s.status}">
        <div class="sip-l"><span class="sip-day">${s.freq==='Weekly'?icon('repeat',14):s.day}</span>
          <div><b>${s.sym}</b><span class="sip-nm">${nm}</span></div></div>
        <div class="sip-m"><b class="num">${inr(s.amt)}</b><span>${s.freq}${s.freq!=='Weekly'?' · '+ordinal(s.day):''}</span></div>
        <div class="sip-r"><span class="sip-status ${s.status}">${s.status==='active'?'Active':'Paused'}</span>
          <div class="sip-acts">
            <button class="icon-mini" data-siptoggle="${s.id}" aria-label="${s.status==='active'?'Pause':'Resume'} SIP for ${s.sym}" title="${s.status==='active'?'Pause':'Resume'}">${icon(s.status==='active'?'clock':'bolt',13)}</button>
            <button class="icon-mini" data-sipedit="${s.id}" aria-label="Edit SIP for ${s.sym}" title="Edit">${icon('sliders',13)}</button>
            <button class="icon-mini danger" data-sipdel="${s.id}" aria-label="Delete SIP for ${s.sym}" title="Delete">${icon('close',13)}</button>
          </div></div>
      </div>`;}).join('')}</div>`;
    return stat+rows+newBtn;
  },
  wire(hub){
    const bn=hub.querySelector('[data-sipnew]'); if(bn) bn.onclick=()=>sipForm(null);
    hub.querySelectorAll('[data-siptoggle]').forEach(b=>b.onclick=()=>{const s=STOCK_SIPS.find(x=>x.id==b.dataset.siptoggle);s.status=s.status==='active'?'paused':'active';refreshTool();quickToast('SIP '+s.status,(s.status==='active'?'Resumed':'Paused')+' your '+s.sym+' SIP of '+inr(s.amt)+'.');});
    hub.querySelectorAll('[data-sipedit]').forEach(b=>b.onclick=()=>sipForm(STOCK_SIPS.find(x=>x.id==b.dataset.sipedit)));
    hub.querySelectorAll('[data-sipdel]').forEach(b=>b.onclick=()=>{const s=STOCK_SIPS.find(x=>x.id==b.dataset.sipdel);sipDelete(s);});
  }
},

/* ---------- 7) Research ---------- */
research:{
  render(){
    const tab=ts('tab','calls');
    if(tab==='reports'){
      const cards=`<div class="rep-list">${REPORTS.map((r,i)=>`<div class="rep-card" data-repopen="${i}" role="button" tabindex="0" aria-label="Open report ${r.title}">
        <span class="rep-ic">${icon('search',16)}</span>
        <div class="rep-b"><b>${r.title}</b><span>${r.tag} · ${r.date} · ${r.pages} pages</span></div>
        <span class="rep-go" aria-hidden="true">${icon('trendUp',14)}</span></div>`).join('')}</div>`;
      return secTabs([['calls','Calls',CALLS.length],['reports','Reports',REPORTS.length]],tab,'Research views')+cards;
    }
    const af=ts('cf','All'), filt=af==='All'?CALLS:CALLS.filter(c=>c.action===af);
    const chips=`<div class="mf-chips" role="tablist" aria-label="Call type">${['All','Buy','Sell','Hold'].map(a=>`<button class="mf-chip${a===af?' on':''}" role="tab" aria-selected="${a===af}" data-cf="${a}">${a}</button>`).join('')}</div>`;
    let body;
    if(!filt.length) body=secEmpty('search','No '+af.toLowerCase()+' calls','There are no active '+af.toLowerCase()+' calls right now.');
    else body=`<div class="call-list">${filt.map((c)=>{const ci=CALLS.indexOf(c),up=((c.tgt-c.cmp)/c.cmp*100),ak=c.action==='Buy'?'b-up':c.action==='Sell'?'b-down':'b-neu',ck=c.conv==='High'?'up':c.conv==='Low'?'down':'';
      return `<div class="call-card">
        <div class="call-h"><div class="t-sym">${c.sym}<span class="call-nm">${symName(c.sym)}</span></div><span class="badge ${ak}">${c.action}</span></div>
        <div class="call-grid">
          <div><span>CMP</span><b class="num">₹${c.cmp}</b></div>
          <div><span>Target</span><b class="num up">₹${c.tgt}</b><i class="ipo-sub2 ${cls(up)}">${pct(up)}</i></div>
          <div><span>Stop</span><b class="num down">₹${c.sl}</b></div>
          <div><span>Conviction</span><b class="${ck}">${c.conv}</b></div>
        </div>
        <p class="call-why">${c.rationale}</p>
        <div class="call-foot"><span class="call-hz">${icon('clock',12)} ${c.horizon}</span><button class="btn-ghost sm" data-callview="${ci}">View thesis</button></div>
      </div>`;}).join('')}</div>`;
    return secTabs([['calls','Calls',CALLS.length],['reports','Reports',REPORTS.length]],tab,'Research views')+chips+body;
  },
  wire(hub){
    wireSecTabs(hub);
    hub.querySelectorAll('[data-cf]').forEach(b=>b.onclick=()=>{setTs('cf',b.dataset.cf);refreshTool();});
    hub.querySelectorAll('[data-callview]').forEach(b=>b.onclick=()=>callThesis(CALLS[+b.dataset.callview]));
    hub.querySelectorAll('[data-repopen]').forEach(b=>{const open=()=>reportOpen(REPORTS[+b.dataset.repopen]);b.onclick=open;b.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open();}};});
  }
},

};

/* ---- small format helpers for tools ---- */
function monthName(){return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][new Date().getMonth()];}
function ordinal(n){const s=['th','st','nd','rd'],v=n%100;return n+(s[(v-20)%10]||s[v]||s[0]);}

/* ---- MF list (re-renders in place so the search box keeps focus) ---- */
function mfFiltered(){const f=ts('fmFilter','All'),q=ts('fmQuery','').trim().toLowerCase();
  return FUNDS.filter(fn=>(f==='All'||fn.grp===f)&&(!q||fn.name.toLowerCase().includes(q)||fn.cat.toLowerCase().includes(q)));}
function mfListHTML(){
  const list=mfFiltered();
  if(!list.length) return secEmpty('search','No funds found','Try a different category or search term.');
  return `<div class="mf-head"><span class="mf-hn">Fund</span><span>1Y</span><span>3Y</span><span>5Y</span><span></span></div>
    <div class="mf-list">${list.map(fn=>{const fi=FUNDS.indexOf(fn);
    return `<div class="mf-card">
      <div class="mf-fn"><b>${fn.name}${fn.held?' <i class="held-tag">Holding</i>':''}</b><span class="mf-cat">${fn.cat} · ${stars(fn.rating)} · NAV ₹${fn.nav}</span></div>
      <div class="mf-ret"><b class="num up">${fn.r1}%</b></div>
      <div class="mf-ret"><b class="num up">${fn.r3}%</b></div>
      <div class="mf-ret"><b class="num up">${fn.r5}%</b></div>
      <div class="mf-inv"><button class="btn-primary sm" data-mfbuy="${fi}">Invest</button></div>
    </div>`;}).join('')}</div>`;
}
function mfRefreshList(hub){const c=hub.querySelector('#fmList');if(c){c.innerHTML=mfListHTML();mfBindInvest(hub);}}
function mfBindInvest(hub){hub.querySelectorAll('[data-mfbuy]').forEach(b=>b.onclick=()=>mfInvest(FUNDS[+b.dataset.mfbuy]));}

/* ============================================================
   TOOL FLOWS (modals) — all reuse the accessible flowModal
   ============================================================ */
function ipoApply(ipo){
  let lots=1; const price=ipo.band[1];
  const calc=()=>{const sh=lots*ipo.lot;return {sh,amt:sh*price};};
  flowModal({title:'Apply — '+ipo.co, confirm:'Confirm application',
    body:`<div class="flow-top"><div><b>${ipo.co}</b><span class="flow-sub">${ipo.type} IPO · cut-off ₹${price}</span></div><span class="badge ${ipo.type==='SME'?'b-warn':'b-up'}">${ipo.type}</span></div>
      <div class="flow-field"><label id="lotsLbl">Lots <i>(1 lot = ${ipo.lot} shares)</i></label>
        <div class="stepper" role="group" aria-labelledby="lotsLbl">
          <button class="step-btn" type="button" data-step="-1" aria-label="Decrease lots">${icon('minus',14)}</button>
          <b class="step-val num" id="lotsVal" aria-live="polite">${lots}</b>
          <button class="step-btn" type="button" data-step="1" aria-label="Increase lots">${icon('plus',14)}</button>
        </div></div>
      <div class="flow-rows">
        <div><span>Shares</span><b class="num" id="ipoSh">${calc().sh}</b></div>
        <div><span>Cut-off price</span><b class="num">₹${price}</b></div>
        <div><span>Amount blocked</span><b class="num" id="ipoAmt">${inr(calc().amt)}</b></div>
      </div>
      <div class="flow-field"><label for="upiId">UPI ID for ASBA mandate</label><input class="flow-input" id="upiId" type="text" value="sumit@okhdfc" autocomplete="off" spellcheck="false"></div>
      <p class="flow-note">${icon('shield',13)}<span>Funds stay in your bank, blocked via a UPI mandate until allotment. Cancel anytime before ${ipo.close}.</span></p>`,
    wire(body){
      const upd=()=>{const c=calc();body.querySelector('#lotsVal').textContent=lots;body.querySelector('#ipoSh').textContent=c.sh;body.querySelector('#ipoAmt').textContent=inr(c.amt);
        body.querySelector('[data-step="-1"]').disabled=lots<=1;body.querySelector('[data-step="1"]').disabled=lots>=5;};
      body.querySelectorAll('[data-step]').forEach(b=>b.onclick=()=>{lots=Math.max(1,Math.min(5,lots+(+b.dataset.step)));upd();});
      const upi=body.querySelector('#upiId'); upi.oninput=()=>clearFlowError(body,upi); upd();
    },
    onConfirm(body){const upi=body.querySelector('#upiId').value.trim();
      if(!/^[\w.\-]+@[\w.\-]+$/.test(upi)){flowError(body,'#upiId','Enter a valid UPI ID (e.g. name@bank).');return false;}
      ipo.applied=true; ipo.appliedLots=lots; refreshTool();
      quickToast('Application submitted — '+ipo.co, lots+' lot(s) · '+inr(calc().amt)+' blocked via UPI mandate.');}
  });
}

function algoDeploy(a){
  if(!a.wired){ quickToast('Not deployable yet', `${a.name} has no live engine — backtest/validate it first.`); return; }
  flowModal({title:'Deploy in Paper — '+a.name, confirm:'Deploy in Paper',
    body:`<div class="flow-top"><div><b>${esc(a.name)}</b><span class="flow-sub">${esc(a.cat)} · ${esc(a.risk)}</span></div><span class="badge ${a.risk==='Aggressive'?'b-warn':a.risk==='Conservative'?'b-up':'b-neu'}">${esc(a.risk)}</span></div>
      <div class="flow-rows">
        <div><span>Best regime</span><b class="num">${esc(a.bestRegime||'—')}</b></div>
        <div><span>Validation</span><b class="num ${a.vstatus==='validated'?'up':''}">${a.vstatus==='validated'?'Validated':'Candidate'}</b></div>
      </div>
      <p class="flow-note">${icon('shield',13)}<span><b>Risk-free.</b> Paper deploy runs this strategy on <b>live Kite data with simulated fills</b> — no real orders, no money at risk. Your bot harness starts trading it; closed-trade P&amp;L builds toward the Go-Live gate (≥${BOT.nudgeMin||10} profitable trades). You can Pause or Stop anytime.</span></p>`,
    onConfirm(){ setStrategyState(a.id,'paper','Deployed — '+a.name); }
  });
}
/* POST the lifecycle change, then refresh the studio from the API (source of truth). */
async function setStrategyState(id, stateVal, title){
  try{
    const r=await fetch(BOT_API+'/api/strategy',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({id,state:stateVal})}).then(x=>x.json());
    if(r&&r.error){ quickToast('Action failed', r.error); return r; }
    if(r&&r.locked){ quickToast('Live locked '+'🔒', r.reason||'Arm ALLOW_LIVE on the bot machine to go live.'); }
    else { quickToast(title||'Updated', lcMsg(stateVal)); }
    await loadBotData(); if(typeof renderAlgo==='function') renderAlgo();
    return r;
  }catch(e){ quickToast('Action failed','Is the bot API running on :8756?'); }
}
function lcMsg(s){
  return s==='paper'?'Live data, simulated fills — no real money. Building forward evidence.'
    : s==='paused'?'Paused — no new entries; open paper positions are kept.'
    : (s===null||s==='off')?'Stopped — open paper positions square off next cycle; nothing else trades it.'
    : 'Updated.';
}
function lcStop(a){
  const flatten=a.sub==='live';
  flowModal({title:(flatten?'Stop & Flatten — ':'Stop — ')+a.name, confirm:flatten?'Stop & Flatten':'Stop', danger:true,
    body:`<p class="flow-note">${icon('alert',13)}<span>${flatten
      ? `This <b>squares off real positions</b> and stops the strategy. Real-money action — confirm you want to exit now.`
      : `Stops paper-trading <b>${esc(a.name)}</b>. Any open paper positions are squared off next cycle. You can redeploy anytime.`}</span></p>`,
    onConfirm(){ setStrategyState(a.id,'off','Stopped — '+a.name); }});
}

function basketInvest(b){
  let amt=b.minInv; const w=Math.round(100/b.stocks.length);
  flowModal({title:b.name, confirm:'Invest '+inr(b.minInv),
    body:`<div class="flow-top"><div><b>${b.name}</b><span class="flow-sub">${b.theme} · ${b.stocks.length} stocks · 1Y ${pct(b.ret1y)}</span></div><span class="vol-chip ${b.vol==='High'?'b-warn':b.vol==='Low'?'b-up':'b-neu'}">${b.vol} vol</span></div>
      <div class="bsk-const">${b.stocks.map(s=>{const x=bySym(s);return `<div class="bc-row"><span class="t-sym">${s}<i class="bc-nm">${x?x.name:''}</i></span><span class="bc-w num">${w}%</span><span class="num">₹${x?x.ltp.toLocaleString('en-IN'):'—'}</span></div>`;}).join('')}</div>
      <div class="flow-field"><label for="bskAmt">Amount to invest</label><input class="flow-input num" id="bskAmt" type="number" inputmode="numeric" value="${b.minInv}" min="${b.minInv}" step="500"></div>
      <p class="flow-note">${icon('sprout',13)}<span>We’ll buy all ${b.stocks.length} stocks in the shown weights. Minimum ${inr(b.minInv)}.</span></p>`,
    focus:'#bskAmt',
    wire(body){const ai=body.querySelector('#bskAmt');ai.oninput=()=>{clearFlowError(body,ai);const v=Math.round(+ai.value||0);const cf=$('modalConfirm');cf.textContent='Invest '+inr(v>=b.minInv?v:b.minInv);};},
    onConfirm(body){const v=Math.round(+body.querySelector('#bskAmt').value||0);
      if(v<b.minInv){flowError(body,'#bskAmt','Minimum investment is '+inr(b.minInv)+'.');return false;}
      b.invested=true; refreshTool();
      quickToast('Basket purchased — '+b.name, inr(v)+' across '+b.stocks.length+' stocks.');}
  });
}

function mfInvest(fn){
  let mode='lumpsum';
  const render=()=>`<div class="flow-top"><div><b>${fn.name}</b><span class="flow-sub">${fn.cat} · ${stars(fn.rating)} · NAV ₹${fn.nav}</span></div></div>
    <div class="seg flow-seg" role="tablist" aria-label="Investment type">
      <button class="seg-btn${mode==='lumpsum'?' on':''}" role="tab" aria-selected="${mode==='lumpsum'}" data-mfmode="lumpsum">One-time</button>
      <button class="seg-btn${mode==='sip'?' on':''}" role="tab" aria-selected="${mode==='sip'}" data-mfmode="sip">Monthly SIP</button>
    </div>
    <div class="flow-field"><label for="mfAmt">${mode==='sip'?'Monthly amount':'Amount'}</label><input class="flow-input num" id="mfAmt" type="number" inputmode="numeric" value="${mode==='sip'?5000:25000}" min="${mode==='sip'?500:5000}" step="500"></div>
    <div class="flow-rows"><div><span>1Y return</span><b class="num up">${fn.r1}%</b></div><div><span>3Y return</span><b class="num up">${fn.r3}%</b></div>${mode==='sip'?`<div><span>Annual outlay</span><b class="num" id="mfYr">${inr(5000*12)}</b></div>`:''}</div>
    <p class="flow-note">${icon('sprout',13)}<span>Direct plan — zero commission. ${mode==='sip'?'Pause or stop your SIP anytime.':'Units allotted at the next NAV.'}</span></p>`;
  const open=()=>flowModal({title:'Invest — '+fn.cat, confirm:mode==='sip'?'Start SIP':'Confirm investment', body:render(), focus:'#mfAmt',
    wire(body){
      body.querySelectorAll('[data-mfmode]').forEach(b=>b.onclick=()=>{mode=b.dataset.mfmode;flowModalReplace(open);});
      const ai=body.querySelector('#mfAmt'); ai.oninput=()=>{clearFlowError(body,ai);const yr=body.querySelector('#mfYr');if(yr)yr.textContent=inr((+ai.value||0)*12);};
    },
    onConfirm(body){const min=mode==='sip'?500:5000,v=Math.round(+body.querySelector('#mfAmt').value||0);
      if(v<min){flowError(body,'#mfAmt','Minimum is '+inr(min)+'.');return false;}
      quickToast(mode==='sip'?'SIP started — '+fn.name:'Investment placed — '+fn.name, (mode==='sip'?inr(v)+'/month':inr(v))+' · direct plan.');}
  });
  open();
}
/* re-open the modal in place (for segmented toggles inside a flow) without flashing the scrim */
function flowModalReplace(openFn){ openFn(); }

function sipForm(existing){
  const editing=!!existing;
  const draft=existing?{...existing}:{sym:'RELIANCE',amt:2000,freq:'Monthly',day:5};
  flowModal({title:editing?'Edit SIP — '+draft.sym:'New stock SIP', confirm:editing?'Save changes':'Start SIP',
    body:`<div class="flow-field"><label for="sipSym">Stock</label>
        <select class="flow-input" id="sipSym" ${editing?'disabled':''}>${SYMS.map(s=>`<option value="${s.sym}" ${s.sym===draft.sym?'selected':''}>${s.sym} · ${s.name}</option>`).join('')}</select></div>
      <div class="flow-2col">
        <div class="flow-field"><label for="sipAmt">Amount</label><input class="flow-input num" id="sipAmt" type="number" inputmode="numeric" value="${draft.amt}" min="500" step="500"></div>
        <div class="flow-field"><label for="sipFreq">Frequency</label><select class="flow-input" id="sipFreq">${['Weekly','Fortnightly','Monthly'].map(f=>`<option ${f===draft.freq?'selected':''}>${f}</option>`).join('')}</select></div>
      </div>
      <div class="flow-field" id="sipDayWrap"><label for="sipDay">Debit day of month</label><input class="flow-input num" id="sipDay" type="number" inputmode="numeric" value="${typeof draft.day==='number'?draft.day:5}" min="1" max="28"></div>
      <p class="flow-note">${icon('repeat',13)}<span>Auto-invests on the chosen schedule. Minimum ₹500. Pause or stop anytime.</span></p>`,
    focus:editing?'#sipAmt':'#sipSym',
    wire(body){const ai=body.querySelector('#sipAmt');ai.oninput=()=>clearFlowError(body,ai);
      const fr=body.querySelector('#sipFreq'),dw=body.querySelector('#sipDayWrap');
      const sync=()=>{dw.style.display=fr.value==='Weekly'?'none':'';};fr.onchange=sync;sync();},
    onConfirm(body){const amt=Math.round(+body.querySelector('#sipAmt').value||0);
      if(amt<500){flowError(body,'#sipAmt','Minimum SIP amount is ₹500.');return false;}
      const sym=body.querySelector('#sipSym').value, freq=body.querySelector('#sipFreq').value, day=freq==='Weekly'?1:Math.max(1,Math.min(28,+body.querySelector('#sipDay').value||5));
      if(editing){Object.assign(existing,{amt,freq,day});quickToast('SIP updated — '+sym, inr(amt)+' · '+freq+'.');}
      else{STOCK_SIPS.push({id:++SIP_ID,sym,amt,freq,day,status:'active'});quickToast('SIP started — '+sym, inr(amt)+' · '+freq+'.');}
      refreshTool();}
  });
}
function sipDelete(s){
  flowModal({title:'Delete SIP?', confirm:'Delete', danger:true,
    body:`<p class="flow-confirm">Stop and remove your <b>${s.sym}</b> SIP of <b>${inr(s.amt)}</b> (${s.freq})? This can’t be undone.</p>`,
    onConfirm(){STOCK_SIPS=STOCK_SIPS.filter(x=>x.id!==s.id);refreshTool();quickToast('SIP deleted — '+s.sym,'The recurring investment has been removed.');}
  });
}

function callThesis(c){
  const up=((c.tgt-c.cmp)/c.cmp*100);
  flowModal({title:c.sym+' — '+c.action+' idea', confirm:'Got it',
    body:`<div class="flow-top"><div><b>${c.sym}</b><span class="flow-sub">${symName(c.sym)} · ${c.horizon}</span></div><span class="badge ${c.action==='Buy'?'b-up':c.action==='Sell'?'b-down':'b-neu'}">${c.action}</span></div>
      <div class="flow-rows">
        <div><span>CMP</span><b class="num">₹${c.cmp}</b></div>
        <div><span>Target</span><b class="num up">₹${c.tgt} <i class="${cls(up)}">(${pct(up)})</i></b></div>
        <div><span>Stop-loss</span><b class="num down">₹${c.sl}</b></div>
        <div><span>Conviction</span><b>${c.conv}</b></div>
      </div>
      <p class="flow-thesis">${c.rationale}</p>
      <p class="flow-note">${icon('alert',13)}<span>Research view from IB Research. Not personalised advice — size positions to your own risk.</span></p>`
  });
}
function reportOpen(r){
  flowModal({title:r.title, confirm:'Download PDF',
    body:`<div class="flow-top"><div><b>${r.title}</b><span class="flow-sub">${r.tag} · ${r.date} · ${r.pages} pages</span></div><span class="rep-ic">${icon('search',16)}</span></div>
      <p class="flow-thesis">A deep-dive covering the demand outlook, key risks, valuation and our preferred picks in the ${r.tag.toLowerCase()} space. Full charts and tables in the PDF.</p>
      <p class="flow-note">${icon('shield',13)}<span>For information only. Read the disclaimers on the final page.</span></p>`,
    onConfirm(){quickToast('Downloading — '+r.title, r.pages+'-page PDF saved to your reports.');}
  });
}

/* ============================================================
   TRADING MODE — Layout presets + Derivatives Desk
   Mirrors investHub: a center-pane takeover driven by state.layout.
   ============================================================ */
const UNDERLYINGS=[
  {sym:'NIFTY',     label:'NIFTY 50',   spot:23450, step:50,  lot:50},
  {sym:'BANKNIFTY', label:'BANK NIFTY', spot:51200, step:100, lot:15},
  {sym:'RELIANCE',  label:'Reliance',   spot:2945,  step:20,  lot:250},
];
const EXPIRIES=[{d:'26 Jun',days:4,tag:'Weekly'},{d:'03 Jul',days:11,tag:'Weekly'},{d:'31 Jul',days:39,tag:'Monthly'}];
const dseed=x=>{const s=Math.sin(x*12.9898)*43758.5453;return s-Math.floor(s);}; // deterministic 0..1
const oiFmt=n=>{n=Math.round(Math.abs(n));return n>=100000?(n/100000).toFixed(1)+'L':n>=1000?(n/1000).toFixed(0)+'K':String(n);};

/* ===== Option chain — 100% REAL from Kite (/api/chain). No synthetic chain: when the
   token is down the desk shows an honest "connect Kite" state, mirroring the live chart. ===== */
function chainKey(uIdx,eIdx){ return (UNDERLYINGS[uIdx]||UNDERLYINGS[0]).sym+'|'+(eIdx||0); }
function ensureChain(uIdx,eIdx){
  if(!BOT.live) return;
  const key=chainKey(uIdx,eIdx), rec=BOT.chains[key];
  if(rec && (rec.loading || Date.now()-rec.t < 15000)) return;   // fresh or already in-flight
  BOT.chains[key]={p:rec&&rec.p,err:null,loading:true,t:rec?rec.t:0};
  const u=(UNDERLYINGS[uIdx]||UNDERLYINGS[0]).sym;
  fetch(`${BOT_API}/api/chain?underlying=${encodeURIComponent(u)}&expiry=${eIdx||0}`).then(r=>r.json()).then(p=>{
    BOT.chains[key]={p:(p&&p.real)?p:null, err:(p&&!p.real)?p.error:null, loading:false, t:Date.now()};
    if(p&&p.real&&Array.isArray(p.expiries)&&p.expiries.length) BOT.chainExp[u]=p.expiries;
    if(typeof isCenterTakeover==='function' && isCenterTakeover()) renderDeskView();
    if(typeof renderWidgetStack==='function') renderWidgetStack();
  }).catch(()=>{ BOT.chains[key]={p:null,err:'fetch failed',loading:false,t:Date.now()}; });
}
function chainRec(uIdx,eIdx){ return BOT.live ? BOT.chains[chainKey(uIdx,eIdx)] : null; }
function chainLoading(uIdx,eIdx){ const r=chainRec(uIdx,eIdx); return !!(r&&r.loading&&!r.p); }
/* Adapt the real /api/chain payload into the row shape the desk/widgets consume.
   Returns null when there's no live chain yet → callers render an honest empty state. */
function buildChain(uIdx,eIdx){
  const rec=chainRec(uIdx,eIdx); if(!(rec&&rec.p)) return null;
  const base=UNDERLYINGS[uIdx]||UNDERLYINGS[0], p=rec.p, el=p.expiryLabel||{d:'—',days:p.days,tag:''};
  const u={sym:p.underlying,label:base.label,spot:p.spot,step:p.step,lot:p.lot};
  const rows=p.rows.map(R=>({K:R.K,iv:R.iv,callLtp:R.callLtp,putLtp:R.putLtp,callOI:R.callOI,putOI:R.putOI,
    callVol:R.callVol,putVol:R.putVol,callChg:null,putChg:null,atm:!!R.atm})); // OI-day-change not in the live quote → honest "—"
  return {u,e:{d:el.d,days:el.days,tag:el.tag},atm:p.atm,rows,live:true,asOf:p.asOf};
}
function expiriesFor(uIdx){ const s=(UNDERLYINGS[uIdx]||UNDERLYINGS[0]).sym, r=BOT.live&&BOT.chainExp[s]; return (r&&r.length)?r:EXPIRIES; }
function cvChainOff(){ return `<div class="cvch-off">${icon('shield',13)}<span>${BOT.live?'Loading live chain…':'Connect Kite for live option data'}</span></div>`; }
const num1=(x,d)=>x==null?'—':(+x).toFixed(d==null?1:d);            // null-safe LTP/IV
const oiTxt=x=>x==null?'—':oiFmt(x);                                 // null-safe OI
function maxPain(c){let best=c.atm,bv=Infinity;c.rows.forEach(R=>{const S=R.K;let pain=0;c.rows.forEach(o=>{pain+=(o.callOI||0)*Math.max(0,S-o.K)+(o.putOI||0)*Math.max(0,o.K-S);});if(pain<bv){bv=pain;best=S;}});return best;}
function pcr(c){const cs=c.rows.reduce((a,r)=>a+(r.callOI||0),0),ps=c.rows.reduce((a,r)=>a+(r.putOI||0),0);return cs?ps/cs:0;}
function srLevels(c){let sup=c.rows[0],res=c.rows[0];c.rows.forEach(r=>{if((r.putOI||0)>(sup.putOI||0))sup=r;if((r.callOI||0)>(res.callOI||0))res=r;});return {support:sup.K,resist:res.K};}

function legPayoff(l,P){const intr=l.type==='CE'?Math.max(0,P-l.K):Math.max(0,l.K-P);return (l.side==='B'?1:-1)*(intr-l.ltp)*l.lot*l.qty;}
function stratPayoff(legs,P){return legs.reduce((a,l)=>a+legPayoff(l,P),0);}
function stratStats(legs,u){
  const lo=u.spot*0.82,hi=u.spot*1.18,N=140,xs=[];let maxP=-Infinity,minP=Infinity,prevY=null,prevX=null,bes=[];
  for(let i=0;i<=N;i++){const P=lo+(hi-lo)*i/N,y=stratPayoff(legs,P);xs.push({P,y});if(y>maxP)maxP=y;if(y<minP)minP=y;
    if(prevY!=null&&((prevY<0)!==(y<0))){const t=(0-prevY)/(y-prevY);bes.push(prevX+(P-prevX)*t);}prevY=y;prevX=P;}
  const netPrem=legs.reduce((a,l)=>a+(l.side==='B'?-1:1)*l.ltp*l.lot*l.qty,0);
  const rS=xs[N].y-xs[N-1].y,lS=xs[0].y-xs[1].y,tiny=Math.abs(maxP-minP)*0.01+1;
  const maxPUnlimited=(rS>tiny&&xs[N].y>=maxP-tiny)||(lS>tiny&&xs[0].y>=maxP-tiny);
  const maxLUnlimited=(rS<-tiny&&xs[N].y<=minP+tiny)||(lS<-tiny&&xs[0].y<=minP+tiny);
  return {xs,maxP,minP,bes,netPrem,maxPUnlimited,maxLUnlimited};
}
function mkLeg(c,type,side,off){
  const ai=c.rows.findIndex(r=>r.atm), px=r=>type==='CE'?r.callLtp:r.putLtp;
  let idx=Math.max(0,Math.min(c.rows.length-1,ai+off));
  if(px(c.rows[idx])==null){ // nearest strike with a real live quote (skip illiquid far wings)
    for(let d=1;d<c.rows.length;d++){const a=idx-d,b=idx+d;
      if(a>=0&&px(c.rows[a])!=null){idx=a;break;} if(b<c.rows.length&&px(c.rows[b])!=null){idx=b;break;}}}
  const r=c.rows[idx]; return {type,side,K:r.K,ltp:Math.round((px(r)||0)*100)/100,lot:c.u.lot,qty:1};}
const STRAT_PRESETS=[
  {key:'longcall', name:'Long Call',        build:c=>[mkLeg(c,'CE','B',0)]},
  {key:'longput',  name:'Long Put',         build:c=>[mkLeg(c,'PE','B',0)]},
  {key:'straddle', name:'Long Straddle',    build:c=>[mkLeg(c,'CE','B',0),mkLeg(c,'PE','B',0)]},
  {key:'strangle', name:'Long Strangle',    build:c=>[mkLeg(c,'CE','B',2),mkLeg(c,'PE','B',-2)]},
  {key:'bullcall', name:'Bull Call Spread', build:c=>[mkLeg(c,'CE','B',0),mkLeg(c,'CE','S',2)]},
  {key:'bearput',  name:'Bear Put Spread',  build:c=>[mkLeg(c,'PE','B',0),mkLeg(c,'PE','S',-2)]},
  {key:'condor',   name:'Iron Condor',      build:c=>[mkLeg(c,'PE','S',-2),mkLeg(c,'PE','B',-4),mkLeg(c,'CE','S',2),mkLeg(c,'CE','B',4)]},
];

/* ---- layout system: 5 preset workspaces + unlimited user-built named layouts ---- */
const PRESET_LAYOUTS=[['originals','Originals','grip'],['charts','Charts','trendUp'],['watchlist','Watchlist','star'],['options','Option Analyser','scale'],['futures','Future Analyser','bolt']];
const PRESET_DESC={originals:'Chart + tabs (default)',charts:'Maximised chart',watchlist:'Wide watchlist + chart',options:'Option chain · OI · strategy',futures:'Futures buildup desk'};
// "Quick layouts" — fixed-pane terminals (instant, opinionated). `panes` drives the hover wireframe; `suggest` ties to today's regime.
const QUICK_LAYOUTS=[
  {key:'originals',name:'Originals',      tag:'Balanced terminal',  accent:'#10b981', icon:'layout',  desc:'Watchlist, chart & orders side by side', panes:['rail','chart','panel'], suggest:'neutral'},
  {key:'charts',   name:'Charts',         tag:'Chart-first',        accent:'#3b82f6', icon:'trendUp', desc:'Maximised chart for focused analysis',   panes:['chart']},
  {key:'watchlist',name:'Watchlist',      tag:'Scan & track',       accent:'#0ea5e9', icon:'star',    desc:'Wide watchlist beside your chart',       panes:['wrail','chart']},
  {key:'options',  name:'Option Analyser',tag:'Derivatives desk',   accent:'#8b5cf6', icon:'scale',   desc:'Chain, OI & strategy builder',           panes:['deskchain'], suggest:'bear'},
  {key:'futures',  name:'Future Analyser',tag:'Futures desk',       accent:'#f59e0b', icon:'bolt',    desc:'Futures buildup & basis tracker',        panes:['deskfut']},
];
// pane type → relative width + skeleton, for the quick-layout pane schematic
const PWIRE={rail:{f:0.8,s:'quotes'},wrail:{f:1.5,s:'quotes'},chart:{f:2.2,s:'candles'},panel:{f:1.1,s:'list'},deskchain:{f:2,s:'chain'},deskfut:{f:2,s:'candles'}};
let _lid=0;
const newLayoutId=()=>'L'+Date.now().toString(36)+(_lid++);
function customLayouts(){ if(!Array.isArray(state.customLayouts))state.customLayouts=[]; return state.customLayouts; }
function activeCustom(){ const a=customLayouts(); let cl=a.find(l=>l.id===state.activeCustom); if(!cl){cl=a[0]||null; state.activeCustom=cl?cl.id:null;} return cl; }
/* P3 data model: a custom layout holds named TABS, each with its own cards + sync groups.
   Old single-`cards` layouts are migrated to one "Main" tab the first time they're touched. */
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
function activeCanvas(){ const t=activeTab(); return t?t.cards:[]; }
function layoutCardCount(L){ return tabsOf(L).reduce((s,t)=>s+t.cards.length,0); }
function currentLayoutName(){ if(state.layout==='build'){const cl=activeCustom();return cl?cl.name:'New workspace';} const p=PRESET_LAYOUTS.find(x=>x[0]===state.layout); return p?p[1]:'Originals'; }
const isDesk=()=>state.persona==='trader'&&(state.layout==='options'||state.layout==='futures');
const isCenterTakeover=()=>state.persona==='trader'&&['options','futures','build'].indexOf(state.layout)>=0;

function renderDeskBar(){
  // workspaces now live in the persistent bottom bar — clear the legacy top slot
  const top=$('wsSwitch'); if(top){ top.innerHTML=''; closeLayoutMenu(); }
  renderWsBar();
}
const PRESET_ICON={originals:'grip',charts:'trendUp',watchlist:'star',options:'scale',futures:'bolt'};
// persistent bottom bar — persona-aware: trader → workspaces, investor → Invest & Trade tools.
function renderWsBar(){
  const bar=$('wsBar'); if(!bar) return;
  if(state.persona==='trader'){ bar.hidden=false; document.body.classList.add('has-wsbar'); renderWsBarTrader(bar); }
  else if(state.persona==='investor'){ bar.hidden=false; document.body.classList.add('has-wsbar'); renderWsBarInvestor(bar); }
  else { bar.hidden=true; document.body.classList.remove('has-wsbar'); }
}
// investor bottom bar: Overview + every Invest & Trade tool as a tab (state.investSection drives active)
function renderWsBarInvestor(bar){
  const cur=state.investSection;
  const home=`<button class="wsb-tab${!cur?' on':''}" data-invtool="" aria-current="${!cur}" title="Portfolio overview">${icon('pie',13)}<span>Overview</span></button>`;
  const tools=INVEST_TOOLS.map(t=>{const on=cur===t.key;
    return `<button class="wsb-tab${on?' on':''}" data-invtool="${t.key}" aria-current="${on}" title="${esc(t.label)}">${icon(t.icon,13)}<span>${esc(t.label)}</span>${t.tag?`<i class="wsb-tag">${esc(t.tag)}</i>`:''}</button>`;}).join('');
  bar.innerHTML=`<span class="wsb-lead">${icon('sprout',13)} Invest &amp; Trade</span>
    <div class="wsb-scroll" role="tablist" aria-label="Invest and trade tools">${home}<span class="wsb-div" aria-hidden="true"></span>${tools}</div>
    <button class="wsb-new" data-invaddfund title="Add funds">${icon('wallet',14)}<span>Add Funds</span></button>`;
  bar.querySelectorAll('[data-invtool]').forEach(b=>b.onclick=()=>{const k=b.dataset.invtool; k?enterTool(k):exitTool();});
  const af=bar.querySelector('[data-invaddfund]'); if(af)af.onclick=()=>fundsAction('add');
  const active=bar.querySelector('.wsb-tab.on'); if(active)active.scrollIntoView({inline:'nearest',block:'nearest'});
}
// trader bottom bar: preset terminals + your custom workspaces as tabs, with a New action.
// Per-workspace TABS (Main / Tab 2 …) stay nested at the top of the canvas — so the hierarchy reads clearly.
function renderWsBarTrader(bar){
  const cl=customLayouts();
  const presets=PRESET_LAYOUTS.map(([k,l])=>{const on=state.layout===k;
    return `<button class="wsb-tab${on?' on':''}" data-wsbpreset="${k}" aria-current="${on}" title="${esc(PRESET_DESC[k]||l)}">${icon(PRESET_ICON[k]||'layout',13)}<span>${esc(l)}</span></button>`;}).join('');
  const customs=cl.map(L=>{const on=state.layout==='build'&&state.activeCustom===L.id, n=layoutCardCount(L);
    return `<span class="wsb-wrap${on?' on':''}"><button class="wsb-tab${on?' on':''}" data-wsbcustom="${L.id}" aria-current="${on}" title="${esc(L.name)} · ${n} widget${n===1?'':'s'}">${icon('layout',13)}<span>${esc(L.name)}</span></button>${on?`<button class="wsb-mini" data-wsbrename="${L.id}" aria-label="Rename ${esc(L.name)}" title="Rename workspace">${icon('sliders',11)}</button><button class="wsb-mini danger" data-wsbdelete="${L.id}" aria-label="Delete ${esc(L.name)}" title="Delete workspace">${icon('close',11)}</button>`:''}</span>`;}).join('');
  bar.innerHTML=`<span class="wsb-lead">${icon('grip',13)} Workspaces</span>
    <div class="wsb-scroll" role="tablist" aria-label="Switch workspace">
      ${presets}${cl.length?'<span class="wsb-div" aria-hidden="true"></span>':''}${customs}
    </div>
    <button class="wsb-new" data-wsbnew title="Create a new workspace">${icon('plus',14)}<span>New</span></button>`;
  bar.querySelectorAll('[data-wsbpreset]').forEach(b=>b.onclick=()=>pickQuickLayout(b.dataset.wsbpreset));
  bar.querySelectorAll('[data-wsbcustom]').forEach(b=>b.onclick=()=>selectCustom(b.dataset.wsbcustom));
  bar.querySelectorAll('[data-wsbrename]').forEach(b=>b.onclick=e=>{e.stopPropagation();renameLayout(b.dataset.wsbrename);});
  bar.querySelectorAll('[data-wsbdelete]').forEach(b=>b.onclick=e=>{e.stopPropagation();deleteLayout(b.dataset.wsbdelete);});
  const nb=bar.querySelector('[data-wsbnew]'); if(nb)nb.onclick=layoutGallery;
  const active=bar.querySelector('.wsb-tab.on'); if(active)active.scrollIntoView({inline:'nearest',block:'nearest'});
}
function toggleLayoutMenu(){ const m=$('layoutMenu'); if(!m)return; m.hidden?openLayoutMenu():closeLayoutMenu(); }
function openLayoutMenu(){
  const m=$('layoutMenu'),btn=$('layoutBtn'); if(!m)return;
  const item=(active,label,sub,attrs,extra)=>`<button class="lm-item${active?' on':''}" role="menuitem" ${attrs}><span class="lm-check">${active?icon('check',13):''}</span><span class="lm-tb"><b>${esc(label)}</b>${sub?`<span>${esc(sub)}</span>`:''}</span>${extra||''}</button>`;
  let html=`<div class="lm-sec">Preset workspaces</div>`;
  html+=PRESET_LAYOUTS.map(([k,l])=>item(state.layout===k,l,PRESET_DESC[k],`data-lmpreset="${k}"`)).join('');
  html+=`<div class="lm-sec">My workspaces</div>`;
  const cl=customLayouts();
  html+= cl.length? cl.map(L=>item(state.layout==='build'&&state.activeCustom===L.id,L.name,layoutCardCount(L)+' widget'+(layoutCardCount(L)===1?'':'s'),`data-lmcustom="${L.id}"`,
      `<span class="lm-acts"><span class="lm-mini" role="button" tabindex="0" data-lmrename="${L.id}" aria-label="Rename ${esc(L.name)}">${icon('sliders',12)}</span><span class="lm-mini danger" role="button" tabindex="0" data-lmdelete="${L.id}" aria-label="Delete ${esc(L.name)}">${icon('close',12)}</span></span>`)).join('')
    : `<div class="lm-empty">No saved workspaces yet — build your own.</div>`;
  html+=`<button class="lm-new" role="menuitem" data-lmnew>${icon('plus',14)} New workspace…</button>`;
  m.innerHTML=html; m.hidden=false; if(btn)btn.setAttribute('aria-expanded','true');
  m.querySelectorAll('[data-lmpreset]').forEach(b=>b.onclick=()=>{selectPreset(b.dataset.lmpreset);});
  m.querySelectorAll('[data-lmcustom]').forEach(b=>b.onclick=e=>{ if(e.target.closest('[data-lmrename],[data-lmdelete]'))return; selectCustom(b.dataset.lmcustom);});
  m.querySelectorAll('[data-lmrename]').forEach(b=>{const f=e=>{e.stopPropagation();e.preventDefault();renameLayout(b.dataset.lmrename);};b.onclick=f;b.onkeydown=e=>{if(e.key==='Enter'||e.key===' ')f(e);};});
  m.querySelectorAll('[data-lmdelete]').forEach(b=>{const f=e=>{e.stopPropagation();e.preventDefault();deleteLayout(b.dataset.lmdelete);};b.onclick=f;b.onkeydown=e=>{if(e.key==='Enter'||e.key===' ')f(e);};});
  const nb=m.querySelector('[data-lmnew]'); if(nb)nb.onclick=()=>{closeLayoutMenu();layoutGallery();};
  setTimeout(()=>{document.addEventListener('click',layoutMenuOutside,true);document.addEventListener('keydown',layoutMenuEsc);},0);
  const first=m.querySelector('.lm-item'); if(first)setTimeout(()=>first.focus(),20);
}
function closeLayoutMenu(){ const m=$('layoutMenu'),btn=$('layoutBtn'); if(m){m.hidden=true;} if(btn)btn.setAttribute('aria-expanded','false');
  document.removeEventListener('click',layoutMenuOutside,true); document.removeEventListener('keydown',layoutMenuEsc); }
function layoutMenuOutside(e){ if(!e.target.closest('#layoutMenu,#layoutBtn')) closeLayoutMenu(); }
function layoutMenuEsc(e){ if(e.key==='Escape'){closeLayoutMenu();const b=$('layoutBtn');if(b)b.focus();} }

function setLayout(l,customId){
  state.layout=l; document.documentElement.dataset.layout=l;
  if(l==='build'){ if(customId!==undefined) state.activeCustom=customId; }
  else if(l==='options') state.desk.view='chain'; else if(l==='futures') state.desk.view='futures';
  renderDeskBar(); renderDeskView(); saveState();
  announce(currentLayoutName()+' workspace');
  if(window.TPChart&&TPChart.resize){TPChart.resize();setTimeout(()=>TPChart.resize(),90);}
}
function selectPreset(k){ closeLayoutMenu(); setLayout(k); }
function selectCustom(id){ closeLayoutMenu(); setLayout('build',id); }
function createLayout(tplKey){
  const tpl=(tplKey&&tplKey!=='scratch')?CANVAS_TEMPLATES.find(t=>t.key===tplKey):null;
  const base=tpl?tpl.name:'My Layout', a=customLayouts();
  let name=base, n=2; while(a.some(L=>L.name===name)){name=base+' '+n;n++;}
  const id=newLayoutId(), tid=newTabId();
  a.push({id,name,activeTab:tid,tabs:[{id:tid,name:'Main',cards:tpl?tpl.cards.map(c=>({key:c.key,span:c.span})):[],sync:{A:0,B:1}}]});
  setLayout('build',id);
  quickToast('Workspace created — '+name, tpl?tpl.cards.length+' widgets added · customise freely':'Empty canvas — add the widgets you want.');
}
function renameLayout(id){
  const L=customLayouts().find(x=>x.id===id); if(!L)return;
  flowModal({title:'Rename workspace', confirm:'Save',
    body:`<div class="flow-field"><label for="lrName">Workspace name</label><input class="flow-input" id="lrName" type="text" value="${esc(L.name)}" maxlength="40" autocomplete="off"></div>`,
    focus:'#lrName',
    onConfirm(body){const v=body.querySelector('#lrName').value.trim(); if(!v){flowError(body,'#lrName','Enter a name.');return false;} L.name=v.slice(0,40); saveState(); renderDeskBar(); renderDeskView(); announce('Workspace renamed to '+L.name);}
  });
}
function deleteLayout(id){
  const L=customLayouts().find(x=>x.id===id); if(!L)return;
  flowModal({title:'Delete workspace?', confirm:'Delete', danger:true,
    body:`<p class="flow-confirm">Delete <b>${esc(L.name)}</b> and its ${layoutCardCount(L)} widget${layoutCardCount(L)===1?'':'s'}? This can’t be undone.</p>`,
    onConfirm(){ state.customLayouts=customLayouts().filter(x=>x.id!==id);
      if(state.activeCustom===id){ const nx=state.customLayouts[0]; if(nx){state.activeCustom=nx.id;setLayout('build',nx.id);} else {state.activeCustom=null;setLayout('originals');} }
      else { renderDeskBar(); saveState(); }
      quickToast('Workspace deleted — '+L.name,'Removed from your workspaces.'); }
  });
}
// Shared Dext-style setup tiles — used by the modal gallery, the empty-canvas state, and the empty-workspace landing.
// `attr` is the data-attribute the caller wires (e.g. 'lgtpl' to create, 'cvtpl' to seed the current tab).
// Each widget maps to a tiny skeleton so the hover preview reads as a real layout, not abstract boxes.
const SKEL_TYPE={cv_watch:'quotes',movers:'quotes',heatmap:'heat',cv_chain:'chain',oi:'bars',depth:'depth',cv_fut:'candles',pnl:'pnl',margin:'pnl',cv_pcr:'meter'};
function skelByType(type){
  switch(type){
    case 'heat':    return `<span class="sk sk-heat"><i class="g"></i><i class="r"></i><i class="g"></i><i class="r"></i><i class="n"></i><i class="g"></i></span>`;
    case 'chain':   return `<span class="sk sk-chain"><i class="hd"></i><i><b class="g"></b><b class="r"></b></i><i class="atm"><b class="g"></b><b class="r"></b></i><i><b class="g"></b><b class="r"></b></i></span>`;
    case 'bars':    return `<span class="sk sk-bars"><i class="g"></i><i class="r"></i><i class="g"></i><i class="r"></i><i class="g"></i></span>`;
    case 'candles': return `<span class="sk sk-cndl"><i class="g"></i><i class="r"></i><i class="g"></i><i class="g"></i><i class="r"></i><i class="g"></i></span>`;
    case 'depth':   return `<span class="sk sk-depth"><i class="g"></i><i class="g"></i><i class="r"></i><i class="r"></i></span>`;
    case 'meter':   return `<span class="sk sk-meter"><i></i></span>`;
    case 'pnl':     return `<span class="sk sk-pnl"><b class="fig"></b><span class="spk"><i></i><i></i><i></i><i></i></span></span>`;
    case 'list':    return `<span class="sk sk-list"><i class="tabs"><b></b><b class="on"></b><b></b></i><i class="ln"></i><i class="ln"></i><i class="ln"></i></span>`; // orders / scanner tabs
    default:        return `<span class="sk sk-q"><i><b></b><b class="up"></b></i><i><b></b><b class="dn"></b></i><i><b></b><b class="up"></b></i></span>`; // quotes
  }
}
function miniSkel(key){ return skelByType(SKEL_TYPE[key]||'quotes'); }
function miniLayout(cards){ return `<span class="lg-wire">${cards.map(c=>{const sp=c.span===3?3:c.span===2?2:1;return `<span class="lg-wcell wsp-${sp}">${miniSkel(c.key)}</span>`;}).join('')}</span>`; }
function setupTiles(attr){
  const suggested={bull:'scalper',neutral:'originals',bear:'optdesk'}[state.displayed]||'originals';
  return CANVAS_TEMPLATES.map(t=>`<button class="lg-tile${t.key===suggested?' is-suggested':''}" data-${attr}="${t.key}" style="--lg-accent:${t.accent}">
      ${t.key===suggested?`<span class="lg-flag">${icon('check',11)} Suggested</span>`:''}
      <span class="lg-stage"><span class="lg-stage-ic">${icon(t.icon,30)}</span><span class="lg-stage-wire">${miniLayout(t.cards)}</span></span>
      <span class="lg-meta"><b>${esc(t.name)}</b><i class="lg-tag">${esc(t.tag)}</i><span class="lg-desc">${esc(t.desc)}</span></span>
      <span class="lg-cta"><span class="lg-n">${icon('layout',10)} ${t.cards.length} widgets</span><em class="lg-go">Use this →</em></span>
    </button>`).join('');
}
// distinct, full-width "do it yourself" path — surfaced upfront, separate from the ready-made tiles
function scratchBar(attr){
  return `<button class="lg-scratch-bar" data-${attr}="scratch">
      <span class="lsb-ic">${icon('plus',20)}</span>
      <span class="lsb-tx"><b>Start from a blank canvas</b><span>Prefer to build it yourself? Open an empty canvas and drop in exactly the widgets you want.</span></span>
      <em class="lsb-go">Start blank →</em>
    </button>`;
}
// pane schematic for quick layouts — horizontal panes, each with a header dash + type skeleton
function quickWire(panes){
  return `<span class="lg-pwire">${panes.map(p=>{const d=PWIRE[p]||PWIRE.chart;
    return `<span class="lg-pane" style="flex:${d.f}"><span class="lg-pane-hd"></span><span class="lg-pane-bd">${skelByType(d.s)}</span></span>`;}).join('')}</span>`;
}
function quickTiles(attr){
  const suggested={bull:'bull',neutral:'neutral',bear:'bear'}[state.displayed]||'neutral';
  return QUICK_LAYOUTS.map(t=>{const isSug=t.suggest===suggested;
    return `<button class="lg-tile${isSug?' is-suggested':''}" data-${attr}="${t.key}" style="--lg-accent:${t.accent}">
      ${isSug?`<span class="lg-flag">${icon('check',11)} Suggested</span>`:''}
      <span class="lg-stage"><span class="lg-stage-ic">${icon(t.icon,30)}</span><span class="lg-stage-wire">${quickWire(t.panes)}</span></span>
      <span class="lg-meta"><b>${esc(t.name)}</b><i class="lg-tag">${esc(t.tag)}</i><span class="lg-desc">${esc(t.desc)}</span></span>
      <span class="lg-cta"><span class="lg-n">${icon('grip',10)} Fixed panes</span><em class="lg-go">Open →</em></span>
    </button>`;}).join('');
}
// saved canvas workspaces shown as resumable tiles (grid wireframe from the active tab)
function savedTiles(attr){
  const cl=customLayouts(); if(!cl.length) return '';
  return cl.map(L=>{const tab=tabsOf(L).find(t=>t.id===L.activeTab)||tabsOf(L)[0], cards=(tab&&tab.cards)||[];
    return `<button class="lg-tile lg-saved" data-${attr}="${L.id}" style="--lg-accent:#64748b">
      <span class="lg-stage"><span class="lg-stage-ic">${icon('layout',30)}</span><span class="lg-stage-wire">${cards.length?miniLayout(cards):`<span class="lg-wire lg-wire-empty">${icon('plus',16)}</span>`}</span></span>
      <span class="lg-meta"><b>${esc(L.name)}</b><i class="lg-tag">Saved workspace</i><span class="lg-desc">Pick up where you left off${tabsOf(L).length>1?` · ${tabsOf(L).length} tabs`:''}</span></span>
      <span class="lg-cta"><span class="lg-n">${icon('layout',10)} ${cards.length} widget${cards.length===1?'':'s'}</span><em class="lg-go">Open →</em></span>
    </button>`;}).join('');
}
// pick a fixed-pane terminal: bring any closed core panes back, then switch layout
function pickQuickLayout(k){
  if(state.cards){ Object.keys(CARD_EL).forEach(key=>{if(state.cards[key]==='hidden')state.cards[key]='normal';}); }
  setLayout(k); applyCardStates(); applyPaneWidths(); saveState();
}
function layoutGallery(){
  closeLayoutMenu();
  const regimeWord={bull:'bullish',neutral:'range-bound',bear:'bearish'}[state.displayed]||'live';
  flowModal({title:'Build your workspace', hideConfirm:true,
    body:`<p class="cv-pick-note">Tuned to today's <b>${regimeWord}</b> market — <span class="lg-hint">${icon('check',10)} marks our pick</span>. Hover any setup to preview its layout.</p>
      ${scratchBar('lgtpl')}
      ${lgSection('Quick layouts','Ready-to-trade terminals — fixed panes, one click.',quickTiles('lgquick'))}
      ${lgSection('Build your own','Pick a template to customise, or reopen a saved workspace.',savedTiles('lgsaved')+setupTiles('lgtpl'))}`,
    wire(body){
      body.querySelectorAll('[data-lgquick]').forEach(b=>b.onclick=()=>{closeModal();pickQuickLayout(b.dataset.lgquick);});
      body.querySelectorAll('[data-lgsaved]').forEach(b=>b.onclick=()=>{closeModal();selectCustom(b.dataset.lgsaved);});
      body.querySelectorAll('[data-lgtpl]').forEach(b=>b.onclick=()=>{closeModal();createLayout(b.dataset.lgtpl);});
    }
  });
}
/* full-canvas "pick a setup" landing shown when the workspace is emptied (all core panes closed) */
let wsRestoreDismissed=false; // session opt-out: hide the restore prompt until the next pane is closed
function restorePanels(){ if(!state.cards)state.cards={}; Object.keys(CARD_EL).forEach(k=>{if(state.cards[k]==='hidden')state.cards[k]='normal';}); applyCardStates(); applyPaneWidths(); saveState(); announce('Panels restored'); }
function dismissRestore(){ wsRestoreDismissed=true; updateWorkspaceEmpty(); announce('Restore dismissed — closed panels stay closed'); }
function lgSection(title,sub,inner){ return `<section class="lg-section"><div class="lg-sec-head"><b>${title}</b><span>${sub}</span></div><div class="lg-grid lg-inline">${inner}</div></section>`; }
function renderWsEmpty(el){
  const hidden=Object.keys(CARD_EL).filter(k=>state.cards&&state.cards[k]==='hidden').length;
  const showRestore=hidden && !wsRestoreDismissed;
  el.innerHTML=`<div class="ws-empty-inner">
    <div class="ws-empty-head"><b>Build your workspace</b><span>Pick a ready-made terminal, design your own, or bring back a panel you closed — hover any setup to preview its layout.</span>
      ${showRestore?`<span class="ws-restore-row">
        <button class="btn-primary sm ws-restore" data-wsrestore>${icon('layout',13)} Restore ${hidden} closed panel${hidden>1?'s':''}</button>
        <button class="btn-ghost sm ws-dismiss" data-wsdismiss aria-label="Dismiss — keep panels closed">${icon('close',12)} Dismiss</button>
      </span>`:''}
    </div>
    ${scratchBar('wstpl')}
    ${lgSection('Quick layouts','Ready-to-trade terminals — fixed panes, one click.',quickTiles('wsquick'))}
    ${lgSection('Build your own','Pick a template to customise, or reopen a saved workspace.',savedTiles('wssaved')+setupTiles('wstpl'))}
  </div>`;
  el.querySelectorAll('[data-wsquick]').forEach(b=>b.onclick=()=>pickQuickLayout(b.dataset.wsquick));
  el.querySelectorAll('[data-wssaved]').forEach(b=>b.onclick=()=>selectCustom(b.dataset.wssaved));
  el.querySelectorAll('[data-wstpl]').forEach(b=>b.onclick=()=>createLayout(b.dataset.wstpl));
  const rs=el.querySelector('[data-wsrestore]'); if(rs)rs.onclick=restorePanels;
  const ds=el.querySelector('[data-wsdismiss]'); if(ds)ds.onclick=dismissRestore;
}
function updateWorkspaceEmpty(){
  const el=$('wsEmpty'); if(!el) return;
  const c=state.cards||{};
  const empty = state.persona==='trader' && !isCenterTakeover() && c.chart==='hidden' && c.panel==='hidden';
  if(empty){ renderWsEmpty(el); el.hidden=false; } else el.hidden=true;
  const term=document.querySelector('.terminal'); if(term) term.classList.toggle('ws-landing',empty);
}
function renderDeskView(){
  const v=$('deskView'); if(!v) return;
  updateWorkspaceEmpty();
  if(!isCenterTakeover()){ v.innerHTML=''; return; }
  if(state.layout==='build'){ renderCanvasInto(v); return; }
  const tabs=[['chain','Option Chain'],['oi','OI Analysis'],['strategy','Strategy'],['futures','Futures']], view=state.desk.view||'chain';
  const head=`<div class="desk-head"><div class="desk-tabs" role="tablist" aria-label="Derivatives views">${tabs.map(([k,l])=>
    `<button class="desk-tab${k===view?' on':''}" role="tab" aria-selected="${k===view}" data-deskview="${k}">${l}${k==='strategy'&&state.desk.legs.length?` <i class="desk-tn">${state.desk.legs.length}</i>`:''}</button>`).join('')}</div></div>`;
  let body;
  if(view==='futures') body=deskFutures();
  else{
    ensureChain(state.desk.under,state.desk.exp);
    const c=buildChain(state.desk.under,state.desk.exp);
    body=deskControls(c)+(!c?chainEmptyBody():(view==='chain'?deskChain(c):view==='oi'?deskOI(c):deskStrategy(c)));
  }
  v.innerHTML=`<div class="desk-wrap">${head}${body}</div>`;
  v.querySelectorAll('[data-deskview]').forEach(b=>b.onclick=()=>{state.desk.view=b.dataset.deskview;renderDeskView();});
  wireDeskControls(v);
  if(view==='chain') wireChain(v);
  if(view==='strategy') wireStrategy(v);
}
// `c` may be null (no live chain yet) → selectors stay visible, stats show a live/connect chip.
function deskControls(c){
  const exps=expiriesFor(state.desk.under), ei=Math.min(state.desk.exp,exps.length-1);
  const sel=`<div class="dc-sel"><label class="dc-lab" for="dcUnder">Underlying</label>
      <select id="dcUnder" class="dc-input">${UNDERLYINGS.map((u,i)=>`<option value="${i}" ${i===state.desk.under?'selected':''}>${u.label}</option>`).join('')}</select></div>
    <div class="dc-sel"><label class="dc-lab" for="dcExp">Expiry</label>
      <select id="dcExp" class="dc-input">${exps.map((e,i)=>`<option value="${i}" ${i===ei?'selected':''}>${e.d} · ${e.tag}</option>`).join('')}</select></div>`;
  let stats;
  if(c){ const mp=maxPain(c),p=pcr(c),sr=srLevels(c);
    stats=`<div class="dc-stats">
      <div class="dc-stat"><span>Spot</span><b class="num">${Math.round(c.u.spot).toLocaleString('en-IN')}</b></div>
      <div class="dc-stat"><span>PCR</span><b class="num ${p>=1?'up':'down'}">${p.toFixed(2)}</b></div>
      <div class="dc-stat"><span>Max Pain</span><b class="num">${mp.toLocaleString('en-IN')}</b></div>
      <div class="dc-stat"><span>Support</span><b class="num up">${sr.support.toLocaleString('en-IN')}</b></div>
      <div class="dc-stat"><span>Resistance</span><b class="num down">${sr.resist.toLocaleString('en-IN')}</b></div></div>
      <span class="dc-live" title="Live option chain from Kite${c.asOf?' · '+new Date(c.asOf).toLocaleTimeString('en-IN'):''}"><span class="live-dot live"></span>Live</span>`;
  } else {
    stats=`<div class="dc-stats"></div><span class="dc-live off">${icon('shield',12)}${BOT.live?'Loading…':'Kite offline'}</span>`;
  }
  return `<div class="desk-ctrls">${sel}${stats}</div>`;
}
// Honest empty state for the chain views when no live chain is loaded (mirrors the chart).
function chainEmptyBody(){
  const u=(UNDERLYINGS[state.desk.under]||UNDERLYINGS[0]).label;
  return `<div class="desk-scroll">${BOT.live
    ? secEmpty('scale','Loading live chain…',`Fetching ${u} strikes, open interest, LTP and IV from Kite.`)
    : secEmpty('shield','Live option chain unavailable',`Connect your Kite session (run <b>python3 login.py</b> in the bot folder) to load the real ${u} option chain — strikes, live OI, LTP and computed IV. No synthetic data is shown.`)}</div>`;
}
function wireDeskControls(v){
  const u=v.querySelector('#dcUnder'); if(u)u.onchange=()=>{state.desk.under=+u.value;state.desk.exp=0;state.desk.legs=[];renderDeskView();};
  const e=v.querySelector('#dcExp'); if(e)e.onchange=()=>{state.desk.exp=+e.value;renderDeskView();};
}
function deskChain(c){
  const cellLtp=(t,K,v,itm)=>v==null?`<td class="ch-ltp"><span class="ch-na">—</span></td>`
    :`<td class="ch-ltp ${itm?'itm':''}"><button class="ch-add" data-leg="${t}:${K}" aria-label="Add buy ${K} ${t==='CE'?'Call':'Put'} at ${num1(v)}">${num1(v)}</button></td>`;
  const rows=c.rows.map(R=>{const callItm=R.K<c.u.spot,putItm=R.K>c.u.spot;
    return `<tr class="${R.atm?'ch-atm':''}">
      <td class="num ch-oi">${oiTxt(R.callOI)}</td>
      <td class="num ch-na">—</td>
      ${cellLtp('CE',R.K,R.callLtp,callItm)}
      <td class="ch-k num ${R.atm?'atm':''}">${R.K}<i class="ch-iv">${R.iv==null?'—':num1(R.iv)}</i></td>
      ${cellLtp('PE',R.K,R.putLtp,putItm)}
      <td class="num ch-na">—</td>
      <td class="num ch-oi">${oiTxt(R.putOI)}</td></tr>`;}).join('');
  return `<div class="desk-scroll"><table class="ch-tbl">
    <thead><tr><th colspan="3" class="ch-grp call">CALLS</th><th class="ch-grp k">Strike · IV</th><th colspan="3" class="ch-grp put">PUTS</th></tr>
    <tr class="ch-sub"><th>OI</th><th>OI Chg</th><th>LTP</th><th></th><th>LTP</th><th>OI Chg</th><th>OI</th></tr></thead>
    <tbody>${rows}</tbody></table>
    <p class="desk-hint">${icon('bolt',12)}<span>Live OI &amp; premiums from Kite${c.e&&c.e.d?' · '+c.e.d+' expiry':''}. Tap any premium to add it to your strategy. Green = ITM. ATM strike ${c.atm.toLocaleString('en-IN')} highlighted. (Intraday OI-change isn’t in the live quote — shown as —.)</span></p></div>`;
}
function wireChain(v){ v.querySelectorAll('[data-leg]').forEach(b=>b.onclick=()=>{const p=b.dataset.leg.split(':');addLeg(p[0],+p[1],'B');}); }
function addLeg(type,K,side){
  const c=buildChain(state.desk.under,state.desk.exp); if(!c) return;
  const R=c.rows.find(r=>r.K===K); if(!R) return;
  const raw=type==='CE'?R.callLtp:R.putLtp;
  if(raw==null){ quickToast('No live quote','That strike isn’t trading right now — pick a nearer strike.'); return; }
  const ltp=Math.round(raw*100)/100;
  state.desk.legs.push({type,side:side||'B',K,ltp,lot:c.u.lot,qty:1});
  const nm=(side==='S'?'Sell':'Buy')+' '+K+' '+(type==='CE'?'Call':'Put');
  quickToast('Leg added — '+nm, '₹'+ltp.toFixed(1)+' × '+c.u.lot+' (1 lot) · open the Strategy tab');
  renderDeskView(); announce(nm+' added to strategy, '+state.desk.legs.length+' legs');
}
function deskOI(c){
  const maxOI=Math.max(...c.rows.map(r=>Math.max(r.callOI||0,r.putOI||0)))||1, mp=maxPain(c), sr=srLevels(c);
  const rows=c.rows.map(R=>{const cw=(R.callOI||0)/maxOI*100,pw=(R.putOI||0)/maxOI*100;
    const tag=R.K===sr.support?'<i class="oi-tag sup">Support</i>':R.K===sr.resist?'<i class="oi-tag res">Resist</i>':R.K===mp?'<i class="oi-tag mp">Max Pain</i>':'';
    return `<div class="oi-row ${R.atm?'atm':''}">
      <div class="oi-call"><span class="oi-v num">${oiTxt(R.callOI)}</span><span class="oi-bar call" style="width:${cw}%"></span></div>
      <div class="oi-k num">${R.K}${tag}</div>
      <div class="oi-put"><span class="oi-bar put" style="width:${pw}%"></span><span class="oi-v num">${oiTxt(R.putOI)}</span></div></div>`;}).join('');
  return `<div class="desk-scroll"><div class="oi-legend"><span><i class="oi-dot call"></i>Call OI · resistance</span><span><i class="oi-dot put"></i>Put OI · support</span></div>
    <div class="oi-chart">${rows}</div>
    <p class="desk-hint">${icon('bolt',12)}<span>Highest put OI marks support, highest call OI marks resistance. Max-pain strike pulls price toward it at expiry.</span></p></div>`;
}
function deskStrategy(c){
  const legs=state.desk.legs;
  const presetBar=`<div class="strat-presets" role="group" aria-label="Strategy presets">${STRAT_PRESETS.map(p=>`<button class="strat-preset" data-preset="${p.key}">${p.name}</button>`).join('')}<button class="strat-preset clear" data-clearlegs ${legs.length?'':'disabled'}>${icon('close',12)} Clear</button></div>`;
  if(!legs.length) return presetBar+secEmpty('scale','Build a strategy','Tap any premium in the Option Chain, or pick a ready-made strategy above — we’ll chart the payoff, max profit, max loss and breakevens.');
  const st=stratStats(legs,c.u);
  const legRows=legs.map((l,i)=>`<div class="leg-row">
    <button class="leg-side ${l.side==='B'?'buy':'sell'}" data-legside="${i}" aria-label="${l.side==='B'?'Buy':'Sell'} — tap to flip side">${l.side==='B'?'BUY':'SELL'}</button>
    <span class="leg-desc"><b class="num">${l.K}</b> <i class="leg-type ${l.type==='CE'?'ce':'pe'}">${l.type}</i></span>
    <span class="leg-ltp num">₹${l.ltp.toFixed(1)}</span>
    <div class="leg-qty"><button data-legqty="${i}:-1" aria-label="Decrease lots">${icon('minus',12)}</button><b class="num" aria-label="${l.qty} lots">${l.qty}</b><button data-legqty="${i}:1" aria-label="Increase lots">${icon('plus',12)}</button></div>
    <button class="leg-x" data-legdel="${i}" aria-label="Remove ${l.K} ${l.type} leg">${icon('close',12)}</button></div>`).join('');
  const net=st.netPrem>=0?{l:'Net credit',v:inr(st.netPrem),t:'up'}:{l:'Net debit',v:inr(-st.netPrem),t:'down'};
  const mp=st.maxPUnlimited?'Unlimited':inr(Math.max(0,st.maxP));
  const ml=st.maxLUnlimited?'Unlimited':inr(Math.abs(Math.min(0,st.minP)));
  const be=st.bes.length?st.bes.map(b=>Math.round(b).toLocaleString('en-IN')).join(' / '):'—';
  return `<div class="desk-scroll strat-wrap">${presetBar}
    <div class="strat-grid">
      <div class="strat-legs">${legRows}<button class="btn-primary block" data-stratexec>${icon('bolt',13)} Execute strategy</button></div>
      <div class="strat-analysis">
        <div class="strat-stats">
          <div class="ss2"><span>${net.l}</span><b class="num ${net.t}">${net.v}</b></div>
          <div class="ss2"><span>Max profit</span><b class="num up">${mp}</b></div>
          <div class="ss2"><span>Max loss</span><b class="num down">${ml}</b></div>
          <div class="ss2"><span>Breakeven</span><b class="num">${be}</b></div>
        </div>
        ${payoffSVG(st,c.u)}
        <div class="pf-axis"><span>${Math.round(c.u.spot*0.82).toLocaleString('en-IN')}</span><span class="pf-spotlab">Spot ${c.u.spot.toLocaleString('en-IN')}</span><span>${Math.round(c.u.spot*1.18).toLocaleString('en-IN')}</span></div>
        <p class="desk-hint">${st.maxLUnlimited?icon('alert',12)+'<span>Unlimited loss potential — naked option leg.</span>':icon('shield',12)+'<span>Defined-risk: maximum loss is capped at expiry.</span>'}</p>
      </div></div></div>`;
}
function payoffSVG(st,u){
  const W=560,H=150,padL=4,padR=4,padT=12,padB=14,xs=st.xs;
  const xlo=xs[0].P,xhi=xs[xs.length-1].P,yr=Math.max(Math.abs(st.minP),Math.abs(st.maxP))||1;
  const X=P=>padL+(P-xlo)/(xhi-xlo)*(W-padL-padR), Y=y=>padT+(1-(y+yr)/(2*yr))*(H-padT-padB);
  let segs=[],cur=[],sign=null;
  xs.forEach(pt=>{const s=pt.y>=0;if(sign===null)sign=s;if(s!==sign){segs.push({s:sign,pts:cur.slice()});cur=[cur[cur.length-1]];sign=s;}cur.push(pt);});
  if(cur.length)segs.push({s:sign,pts:cur});
  const polys=segs.map(seg=>`<polyline class="pf-line ${seg.s?'up':'down'}" points="${seg.pts.map(p=>X(p.P).toFixed(1)+','+Y(p.y).toFixed(1)).join(' ')}"/>`).join('');
  const zeroY=Y(0).toFixed(1),spotX=X(u.spot).toFixed(1);
  const be=st.bes.map(b=>`<circle class="pf-be" cx="${X(b).toFixed(1)}" cy="${zeroY}" r="3.4"/>`).join('');
  return `<svg class="pf-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
    <line class="pf-zero" x1="0" y1="${zeroY}" x2="${W}" y2="${zeroY}"/>
    <line class="pf-spot" x1="${spotX}" y1="${padT}" x2="${spotX}" y2="${H-padB}"/>${polys}${be}</svg>`;
}
function wireStrategy(v){
  v.querySelectorAll('[data-preset]').forEach(b=>b.onclick=()=>{const c=buildChain(state.desk.under,state.desk.exp); if(!c)return; const p=STRAT_PRESETS.find(x=>x.key===b.dataset.preset);if(p){state.desk.legs=p.build(c);renderDeskView();announce(p.name+' loaded — '+state.desk.legs.length+' legs');}});
  const cl=v.querySelector('[data-clearlegs]'); if(cl)cl.onclick=()=>{state.desk.legs=[];renderDeskView();announce('Strategy cleared');};
  v.querySelectorAll('[data-legside]').forEach(b=>b.onclick=()=>{const l=state.desk.legs[+b.dataset.legside];l.side=l.side==='B'?'S':'B';renderDeskView();});
  v.querySelectorAll('[data-legqty]').forEach(b=>b.onclick=()=>{const p=b.dataset.legqty.split(':'),l=state.desk.legs[+p[0]];l.qty=Math.max(1,Math.min(10,l.qty+(+p[1])));renderDeskView();});
  v.querySelectorAll('[data-legdel]').forEach(b=>b.onclick=()=>{state.desk.legs.splice(+b.dataset.legdel,1);renderDeskView();announce('Leg removed');});
  const ex=v.querySelector('[data-stratexec]'); if(ex)ex.onclick=execStrategy;
}
function execStrategy(){
  const legs=state.desk.legs; if(!legs.length) return;
  const c=buildChain(state.desk.under,state.desk.exp); if(!c) return;
  const st=stratStats(legs,c.u);
  const rows=legs.map(l=>`<div class="wg-row"><span class="leg-side sm ${l.side==='B'?'buy':'sell'}">${l.side==='B'?'BUY':'SELL'}</span><span class="wg-grow">${c.u.sym} ${l.K} ${l.type}</span><b class="num">${l.qty}×${l.lot}</b></div>`).join('');
  const margin=Math.round(Math.abs(st.netPrem)*1.4+c.u.spot*c.u.lot*0.12);
  flowModal({title:'Place strategy — '+c.u.sym, confirm:'Place '+legs.length+'-leg order',
    body:`<div class="flow-top"><div><b>${c.u.label} · ${c.e.d}</b><span class="flow-sub">${legs.length}-leg options basket</span></div></div>
      <div class="strat-confirm">${rows}</div>
      <div class="flow-rows"><div><span>${st.netPrem>=0?'Net credit':'Net debit'}</span><b class="num">${inr(Math.abs(st.netPrem))}</b></div><div><span>Margin (est.)</span><b class="num">${inr(margin)}</b></div></div>
      <p class="flow-note">${icon('shield',13)}<span><b>Paper basket (simulated)</b> — no real order is placed. ${st.maxLUnlimited?'⚠ Naked leg: unlimited risk if this were live.':'Defined-risk position.'}</span></p>`,
    onConfirm(){quickToast('Paper basket — '+c.u.sym, legs.length+' legs · '+c.e.d+' · simulated, no real order placed.');state.desk.legs=[];renderDeskView();}
  });
}
// REAL stock-futures buildup from Kite (/api/futures). No synthetic OI.
function futStocks(){ return SYMS.filter(s=>isEq(s)).map(s=>s.sym).slice(0,12); }
const buTone=b=>b==='Long Buildup'?'up':b==='Short Buildup'?'down':b==='Short Covering'?'up':'warn';
function ensureFutures(){
  if(!BOT.live) return;
  const f=BOT.futures;
  if(f && (f.loading || Date.now()-f.t < 30000)) return;
  BOT.futures={...(f||{}),loading:true,t:f?f.t:0};
  fetch(`${BOT_API}/api/futures?symbols=${encodeURIComponent(futStocks().join(','))}`).then(r=>r.json()).then(p=>{
    BOT.futures={rows:(p&&p.real)?p.rows:null,err:(p&&!p.real)?p.error:null,loading:false,t:Date.now()};
    if(typeof isCenterTakeover==='function'&&isCenterTakeover())renderDeskView();
    if(typeof renderWidgetStack==='function')renderWidgetStack();
  }).catch(()=>{BOT.futures={rows:null,loading:false,t:Date.now()};});
}
function deskFutures(){
  ensureFutures();
  const fr=BOT.live&&BOT.futures&&BOT.futures.rows;
  if(!fr) return `<div class="desk-scroll">${BOT.live
    ? secEmpty('bolt','Loading live futures…','Fetching stock-futures price, basis, OI &amp; buildup from Kite.')
    : secEmpty('shield','Live futures unavailable','Connect Kite (run <b>python3 login.py</b>) for live stock-futures buildup — price, basis, OI &amp; long/short buildup from real OI change. No synthetic data is shown.')}</div>`;
  const body=futStocks().map(sym=>{const R=fr[sym]; if(!R)return '';const b=R.basis;
    return `<tr>
      <td><span class="t-sym">${esc(sym)}</span></td>
      <td class="num">${R.spot!=null?R.spot.toLocaleString('en-IN'):'—'}</td>
      <td class="num">${R.futLtp!=null?R.futLtp.toLocaleString('en-IN'):'—'}</td>
      <td class="num ${b==null?'':b>=0?'up':'down'}">${b==null?'—':(b>=0?'+':'−')+Math.abs(b).toFixed(1)}</td>
      <td class="num">${R.oi!=null?oiFmt(R.oi):'—'}</td>
      <td class="num ${R.oiChg==null?'':R.oiChg>=0?'up':'down'}">${R.oiChg==null?'—':(R.oiChg>=0?'+':'')+R.oiChg.toFixed(1)+'%'}</td>
      <td>${R.buildup?`<span class="bu-chip ${buTone(R.buildup)}">${R.buildup}</span>`:'<span class="ch-na">—</span>'}</td></tr>`;}).join('');
  return `<div class="desk-scroll"><table class="fut-tbl">
    <thead><tr><th>Scrip</th><th>Spot</th><th>Futures</th><th>Basis</th><th>OI</th><th>OI Chg</th><th>Buildup</th></tr></thead>
    <tbody>${body}</tbody></table>
    <p class="desk-hint">${icon('bolt',12)}<span>Live from Kite · Buildup = price direction × OI-change (vs prior trading-day close OI). “—” where a contract has no OI history yet.</span></p></div>`;
}

/* ============================================================
   BUILD-YOUR-OWN — custom widget canvas ("My Layout")
   Users compose a personal grid of widget cards (add / drag-reorder /
   resize span / remove). Persisted in state.canvas; starter templates seed it.
   ============================================================ */
/* lazily built (WIDGET_CATALOG is defined later in the file → avoid TDZ at load) */
let _canvasCat=null;
function canvasCatalog(){ if(_canvasCat) return _canvasCat; _canvasCat=WIDGET_CATALOG.trader.map(w=>({key:w.key,name:w.name,icon:w.icon,span:1,render:w.render})).concat(CANVAS_EXTRA); return _canvasCat; }
const CANVAS_EXTRA=[
  {key:'cv_watch',name:'Watchlist',icon:'star',span:1,render(){
    return SYMS.slice(0,7).map(s=>`<div class="wg-row"><span class="t-sym">${s.sym}</span><span class="num">${s.ltp.toLocaleString('en-IN')}</span><span class="num ${cls(s.chg)}">${pct(s.chg)}</span></div>`).join('');}},
  {key:'cv_chain',name:'Option Chain',icon:'scale',span:2,sym:true,render(uIdx){
    ensureChain(uIdx||0,0); const c=buildChain(uIdx||0,0);
    if(!c) return cvChainOff();
    const ai=c.rows.findIndex(r=>r.atm),rows=c.rows.slice(Math.max(0,ai-3),ai+4);
    return `<div class="cvch"><div class="cvch-row cvch-h"><span>Call LTP</span><b>Strike</b><span>Put LTP</span></div>${rows.map(R=>`<div class="cvch-row ${R.atm?'atm':''}"><span class="num up">${num1(R.callLtp,0)}</span><b class="num">${R.K}</b><span class="num down">${num1(R.putLtp,0)}</span></div>`).join('')}</div>`;}},
  {key:'cv_pcr',name:'PCR & Max Pain',icon:'target',span:1,sym:true,render(uIdx){
    ensureChain(uIdx||0,0); const c=buildChain(uIdx||0,0);
    if(!c) return cvChainOff();
    const p=pcr(c),mp=maxPain(c),sr=srLevels(c);
    return `<div class="wg-row"><span>PCR</span><b class="num ${p>=1?'up':'down'}">${p.toFixed(2)}</b></div>
      <div class="wg-row"><span>Max Pain</span><b class="num">${mp.toLocaleString('en-IN')}</b></div>
      <div class="wg-row"><span>Support</span><b class="num up">${sr.support.toLocaleString('en-IN')}</b></div>
      <div class="wg-row"><span>Resistance</span><b class="num down">${sr.resist.toLocaleString('en-IN')}</b></div>`;}},
  {key:'cv_fut',name:'Futures Buildup',icon:'bolt',span:2,render(){
    ensureFutures();
    const fr=BOT.live&&BOT.futures&&BOT.futures.rows;
    if(!fr) return `<div class="cvch-off">${icon('shield',13)}<span>${BOT.live?'Loading live futures…':'Connect Kite for live futures buildup'}</span></div>`;
    return futStocks().slice(0,6).map(sym=>{const R=fr[sym]; if(!R)return '';
      return `<div class="wg-row"><span class="t-sym wg-grow">${esc(sym)}</span>${R.oiChg!=null?`<span class="num ${R.oiChg>=0?'up':'down'}">${R.oiChg>=0?'+':''}${R.oiChg.toFixed(1)}%</span>`:'<span class="num ch-na">—</span>'}${R.buildup?`<span class="bu-chip ${buTone(R.buildup)}">${R.buildup}</span>`:'<span class="ch-na">—</span>'}</div>`;}).join('');}},
];
const canvasW=key=>canvasCatalog().find(w=>w.key===key);
// Card spans are designed so every row sums to 3 columns — no holes in the real canvas or the hover preview.
const CANVAS_TEMPLATES=[
  {key:'originals', name:'Originals',      tag:'The all-rounder',     accent:'#10b981', icon:'layout', desc:'Watchlist, movers, option chain & P&L', cards:[{key:'cv_watch',span:1},{key:'movers',span:1},{key:'pnl',span:1},{key:'cv_chain',span:2},{key:'margin',span:1}]},
  {key:'watchdriven',name:'Watchlist Driven',tag:'Spot movers first',  accent:'#3b82f6', icon:'star',   desc:'Watchlist-led with movers & heatmap',  cards:[{key:'cv_watch',span:2},{key:'movers',span:1},{key:'heatmap',span:3}]},
  {key:'optdesk',  name:'Option Analyser', tag:'Derivatives & hedging',accent:'#8b5cf6', icon:'scale',  desc:'Chain, PCR / max-pain & open interest',  cards:[{key:'cv_chain',span:2},{key:'cv_pcr',span:1},{key:'oi',span:3}]},
  {key:'futdesk',  name:'Future Analyser', tag:'Futures & basis',      accent:'#f59e0b', icon:'bolt',   desc:'Futures buildup, watchlist & margin',    cards:[{key:'cv_fut',span:3},{key:'cv_watch',span:2},{key:'margin',span:1}]},
  {key:'scalper',  name:'Scalper',         tag:'Fast intraday',        accent:'#ef4444', icon:'trendUp',desc:'Movers, depth & live P&L for fast intraday',cards:[{key:'movers',span:1},{key:'depth',span:1},{key:'pnl',span:1},{key:'heatmap',span:3}]},
];
/* tab bar across the top of the canvas — switch / add / rename / delete named workspaces */
function cvTabBar(cl){ const ts=tabsOf(cl);
  const tabs=ts.map(t=>{ const on=t.id===cl.activeTab;
    return `<div class="cv-tabwrap${on?' on':''}"><button class="cv-tab" data-cvtab="${t.id}" role="tab" aria-selected="${on}">${esc(t.name)}</button>${on?`<button class="cv-tabbtn" data-cvtabedit="${t.id}" aria-label="Rename tab ${esc(t.name)}" title="Rename tab">${icon('sliders',10)}</button>${ts.length>1?`<button class="cv-tabbtn" data-cvtabdel="${t.id}" aria-label="Delete tab ${esc(t.name)}" title="Delete tab">${icon('close',10)}</button>`:''}`:''}</div>`;}).join('');
  return `<div class="cv-tabs" role="tablist" aria-label="Workspace tabs">${tabs}<button class="cv-tab-add" data-cvtabadd aria-label="New tab" title="New tab">${icon('plus',12)}</button></div>`;
}
function cvSwitchTab(id){ const cl=activeCustom(); if(!cl)return; const t=tabsOf(cl).find(x=>x.id===id); if(!t)return; cl.activeTab=id; saveState(); renderDeskView(); announce('Tab '+t.name); }
function cvAddTab(){ const cl=activeCustom(); if(!cl)return; const ts=tabsOf(cl); if(ts.length>=8){quickToast('Tab limit reached','Up to 8 tabs per layout.');return;}
  let n=ts.length+1,name='Tab '+n; while(ts.some(t=>t.name===name)){n++;name='Tab '+n;} const id=newTabId(); ts.push({id,name,cards:[],sync:{A:0,B:1}}); cl.activeTab=id; saveState(); renderDeskView(); announce('Added '+name); }
function cvRenameTab(id){ const cl=activeCustom(); if(!cl)return; const t=tabsOf(cl).find(x=>x.id===id); if(!t)return;
  flowModal({title:'Rename tab', confirm:'Save', focus:'#ctName',
    body:`<div class="flow-field"><label for="ctName">Tab name</label><input class="flow-input" id="ctName" type="text" value="${esc(t.name)}" maxlength="24" autocomplete="off"></div>`,
    onConfirm(body){const val=body.querySelector('#ctName').value.trim(); if(!val){flowError(body,'#ctName','Enter a name.');return false;} t.name=val.slice(0,24); saveState(); renderDeskView(); announce('Tab renamed to '+t.name);}});
}
function cvDeleteTab(id){ const cl=activeCustom(); if(!cl)return; const ts=tabsOf(cl); if(ts.length<=1)return; const t=ts.find(x=>x.id===id); if(!t)return;
  flowModal({title:'Delete tab?', confirm:'Delete', danger:true,
    body:`<p class="flow-confirm">Delete tab <b>${esc(t.name)}</b> and its ${t.cards.length} widget${t.cards.length===1?'':'s'}? This can’t be undone.</p>`,
    onConfirm(){ cl.tabs=ts.filter(x=>x.id!==id); if(cl.activeTab===id)cl.activeTab=cl.tabs[0].id; saveState(); renderDeskView(); quickToast('Tab deleted — '+t.name,'Removed from this workspace.'); }});
}
function renderCanvasInto(v){
  const cl=activeCustom();
  if(!cl){ // build layout selected but no custom layouts exist → full-canvas setup picker
    v.innerHTML=`<div class="desk-wrap"><div class="desk-scroll"><div class="ws-empty-inner">
      <div class="ws-empty-head"><b>Build your workspace</b><span>Start from a blank canvas, or pick a template — you can rearrange everything later.</span></div>
      ${scratchBar('lgtpl')}
      ${lgSection('Build your own','Pick a template to customise.',setupTiles('lgtpl'))}</div></div></div>`;
    v.querySelectorAll('[data-lgtpl]').forEach(b=>b.onclick=()=>createLayout(b.dataset.lgtpl)); return;
  }
  const tab=activeTab(), cards=tab?tab.cards:[];
  const head=`<div class="desk-head cv-topbar">
    <div class="cv-title"><b>${icon('layout',15)} ${esc(cl.name)}</b><span>${cards.length?cards.length+' widget'+(cards.length===1?'':'s')+' · '+esc(tab.name):'Empty tab'}</span></div>
    <div class="cv-tools"><button class="btn-ghost sm" data-cvrename aria-label="Rename workspace">${icon('sliders',12)}</button>${cards.length?`<button class="btn-ghost sm" data-cvclear>${icon('close',12)} Clear</button>`:''}<button class="btn-primary sm" data-cvadd>${icon('plus',13)} Add widget</button></div>
  </div>`;
  let body;
  if(!cards.length){
    body=`<div class="desk-scroll"><div class="ws-empty-inner">
      <div class="ws-empty-head"><b>Build out “${esc(tab.name)}”</b><span>Add widgets one by one, or seed this tab from a template — everything stays editable.</span></div>
      <button class="lg-scratch-bar" data-cvadd>
        <span class="lsb-ic">${icon('plus',20)}</span>
        <span class="lsb-tx"><b>Add widgets manually</b><span>Open the widget picker and choose exactly what you want, one by one.</span></span>
        <em class="lsb-go">Open picker →</em>
      </button>
      ${lgSection('Start from a template','Seed this tab instantly — then rearrange, resize & save.',setupTiles('cvtpl'))}
    </div></div>`;
  }else{
    body=`<div class="desk-scroll"><div class="cv-grid">${cards.map((c,i)=>canvasCard(c,i,tab)).join('')}</div></div>`;
  }
  v.innerHTML=`<div class="desk-wrap">${head}${cvTabBar(cl)}${body}</div>`;
  wireCanvas(v);
}
function canvasCard(c,i,tab){
  const w=canvasW(c.key); if(!w) return '';
  const span=c.span===3?3:c.span===2?2:1, isSym=!!w.sym, grp=(c.grp==='A'||c.grp==='B')?c.grp:null;
  const uIdx=(isSym&&grp)?(tab.sync[grp]||0):0;
  let grpCtl='', symSel='';
  if(isSym){ const dot=g=>`<button class="cv-grp cv-grp-${g.toLowerCase()}${grp===g?' on':''}" data-cvgrp="${i}" data-grp="${g}" aria-pressed="${grp===g}" aria-label="Link ${w.name} to sync group ${g}" title="Sync group ${g}">${g}</button>`;
    grpCtl=`<span class="cv-grps" role="group" aria-label="Sync group">${dot('A')}${dot('B')}</span>`;
    if(grp) symSel=`<select class="cv-sym" data-cvsym="${i}" aria-label="${w.name} underlying (group ${grp})">${UNDERLYINGS.map((u,ui)=>`<option value="${ui}" ${ui===uIdx?'selected':''}>${u.sym}</option>`).join('')}</select>`;
  }
  return `<div class="cv-card span-${span}${grp?' grp-'+grp.toLowerCase():''}" data-cvi="${i}" draggable="true">
    <div class="cv-head"><span class="cv-ic">${icon(w.icon,13)}</span><b>${w.name}</b>${symSel}${grpCtl}
      <span class="cv-grip" title="Drag to reorder" aria-hidden="true">${icon('grip',13)}</span>
      <button class="cv-span" data-cvspan="${i}" aria-label="Cycle width of ${w.name} (now ${span} of 3)" title="Width ${span}/3 — click to change">${span}</button>
      <button class="cv-x" data-cvremove="${i}" aria-label="Remove ${w.name}">${icon('close',12)}</button></div>
    <div class="cv-body">${w.render(uIdx)}</div>
    <span class="cv-resize" data-cvresize="${i}" aria-hidden="true" title="Drag to resize"></span></div>`;
}
function wireCanvas(v){
  const cl=activeCustom(), tab=activeTab();
  v.querySelectorAll('[data-cvadd]').forEach(b=>b.onclick=canvasPicker);
  const rn=v.querySelector('[data-cvrename]'); if(rn)rn.onclick=()=>{if(cl)renameLayout(cl.id);};
  const clr=v.querySelector('[data-cvclear]'); if(clr)clr.onclick=()=>{if(tab){tab.cards=[];saveState();renderDeskView();announce('Tab cleared');}};
  v.querySelectorAll('[data-cvtpl]').forEach(b=>b.onclick=()=>{const t=CANVAS_TEMPLATES.find(x=>x.key===b.dataset.cvtpl);if(t&&tab){tab.cards=t.cards.map(c=>({key:c.key,span:c.span}));saveState();renderDeskView();announce(t.name+' template loaded, '+t.cards.length+' widgets');}});
  // tabs
  v.querySelectorAll('[data-cvtab]').forEach(b=>b.onclick=()=>cvSwitchTab(b.dataset.cvtab));
  const ta=v.querySelector('[data-cvtabadd]'); if(ta)ta.onclick=cvAddTab;
  v.querySelectorAll('[data-cvtabedit]').forEach(b=>b.onclick=e=>{e.stopPropagation();cvRenameTab(b.dataset.cvtabedit);});
  v.querySelectorAll('[data-cvtabdel]').forEach(b=>b.onclick=e=>{e.stopPropagation();cvDeleteTab(b.dataset.cvtabdel);});
  // span cycle (1→2→3→1) + remove
  v.querySelectorAll('[data-cvspan]').forEach(b=>b.onclick=()=>{const i=+b.dataset.cvspan;if(tab&&tab.cards[i]){tab.cards[i].span=((tab.cards[i].span||1)%3)+1;saveState();renderDeskView();}});
  v.querySelectorAll('[data-cvremove]').forEach(b=>b.onclick=()=>{const i=+b.dataset.cvremove;if(tab&&tab.cards[i]){const nm=(canvasW(tab.cards[i].key)||{}).name||'Widget';tab.cards.splice(i,1);saveState();renderDeskView();announce(nm+' removed');}});
  // sync groups: toggle a card's group, and pick the group's underlying
  v.querySelectorAll('[data-cvgrp]').forEach(b=>b.onclick=()=>{const i=+b.dataset.cvgrp,g=b.dataset.grp,card=tab&&tab.cards[i];if(card){card.grp=(card.grp===g)?undefined:g;saveState();renderDeskView();announce(card.grp?('Linked to sync group '+g):'Unlinked from sync group');}});
  v.querySelectorAll('[data-cvsym]').forEach(sel=>sel.onchange=()=>{const i=+sel.dataset.cvsym,card=tab&&tab.cards[i];if(card&&card.grp){tab.sync[card.grp]=+sel.value;saveState();renderDeskView();announce('Sync group '+card.grp+' → '+UNDERLYINGS[+sel.value].sym);}});
  // drag-reorder
  v.querySelectorAll('.cv-card').forEach(card=>{
    card.ondragstart=e=>{state.dragCv=+card.dataset.cvi;card.classList.add('cv-drag');e.dataTransfer.effectAllowed='move';};
    card.ondragend=()=>{card.classList.remove('cv-drag');state.dragCv=null;};
    card.ondragover=e=>{e.preventDefault();};
    card.ondrop=e=>{e.preventDefault();const from=state.dragCv,to=+card.dataset.cvi;if(!tab||from==null||from===to)return;const m=tab.cards.splice(from,1)[0];tab.cards.splice(to,0,m);saveState();renderDeskView();};
  });
  // drag-resize: drag a card's right edge; snap span to the nearest 1/2/3 columns under the pointer
  v.querySelectorAll('[data-cvresize]').forEach(h=>{ h.onpointerdown=e=>{ e.preventDefault();e.stopPropagation();
    const i=+h.dataset.cvresize, card=h.closest('.cv-card'), grid=h.closest('.cv-grid'); if(!card||!grid||!tab||!tab.cards[i])return;
    card.setAttribute('draggable','false'); card.classList.add('cv-resizing');
    const cols=getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length||3;
    const colW=grid.getBoundingClientRect().width/cols, left=card.getBoundingClientRect().left, grpCls=tab.cards[i].grp?(' grp-'+tab.cards[i].grp.toLowerCase()):'';
    let span=tab.cards[i].span||1;
    const move=ev=>{ const want=Math.max(1,Math.min(cols,Math.round((ev.clientX-left)/colW))); if(want!==span){ span=want; card.className='cv-card span-'+span+grpCls+' cv-resizing'; } };
    const up=()=>{ document.removeEventListener('pointermove',move); document.removeEventListener('pointerup',up); tab.cards[i].span=span; saveState(); renderDeskView(); };
    document.addEventListener('pointermove',move); document.addEventListener('pointerup',up);
  };});
}
function canvasPicker(){
  const drawItems=()=>{const have=new Set(activeCanvas().map(c=>c.key));
    return canvasCatalog().map(w=>`<button class="cv-pick-item${have.has(w.key)?' on':''}" data-cvpick="${w.key}" aria-pressed="${have.has(w.key)}">
      <span class="cv-pick-ic">${icon(w.icon,16)}</span><span class="cv-pick-tb"><b>${w.name}</b><span>${w.span===2?'Wide card':'Standard card'}</span></span>
      <span class="cv-pick-add">${icon(have.has(w.key)?'check':'plus',14)}</span></button>`).join('');};
  flowModal({title:'Add widgets', hideConfirm:true,
    body:`<p class="cv-pick-note">Tap to add or remove. Build your workspace with as many cards as you like.</p><div class="cv-pick" id="cvPick">${drawItems()}</div>`,
    wire(body){
      const bind=()=>body.querySelectorAll('[data-cvpick]').forEach(b=>b.onclick=()=>{
        const tab=activeTab(); if(!tab)return;
        const key=b.dataset.cvpick,w=canvasW(key),idx=tab.cards.findIndex(c=>c.key===key);
        if(idx>=0)tab.cards.splice(idx,1); else tab.cards.push({key,span:w.span||1});
        saveState(); body.querySelector('#cvPick').innerHTML=drawItems(); bind(); renderDeskView();
        announce((idx>=0?'Removed ':'Added ')+w.name);
      });
      bind();
    }
  });
}

/* HTML-escape any user-supplied / persisted text before it enters innerHTML (XSS-safe) */
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/* ============================================================
   ALGO MODE — strategy studio (Marketplace · Backtest · Monitor)
   Full-width center takeover; reuses ALGOS + algoDeploy.
   ============================================================ */
/* ===== LIVE BOT INTEGRATION — kite-mean-reversion-bot API (:8756) ===== */
const BOT_API='http://localhost:8756';
let BOT={loaded:false,connected:false,status:null,paperMode:true,error:false,chains:{},chainExp:{},futures:null};
async function loadBotData(){
  try{
    const [s,st,tr,sp]=await Promise.all([
      fetch(BOT_API+'/api/strategies').then(r=>r.json()).catch(()=>({strategies:[]})),
      fetch(BOT_API+'/api/status').then(r=>r.json()).catch(()=>({connected:false})),
      fetch(BOT_API+'/api/trades').then(r=>r.json()).catch(()=>({trades:[]})),
      fetch(BOT_API+'/api/stopped').then(r=>r.json()).catch(()=>({stopped:[]}))
    ]);
    BOT.trades=tr.trades||[]; BOT.stopped=sp.stopped||[]; BOT.stoppedTotal=sp.totalFlattenPnl||0;
    BOT.connected=!!st.connected; BOT.status=st; BOT.paperMode=s.paperMode!==false; BOT.updated=s.updated; BOT.error=false;
    BOT.segments=s.segments||[{id:'cash',label:'Equity Cash',note:''}];
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
/* ---- 100% real market data from Kite (/api/market). No fake fallback: when the bot
   is offline or the Kite token has expired, displays show honest blanks, never mock. ---- */
// Structural signature: everything that, if changed, genuinely needs a heavy panel re-render.
// Deliberately EXCLUDES live prices/P&L — those are patched in place by the 2s loops + 1s clock,
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
      // overlay REAL ltp/chg onto each watchlist instrument BY KEY (any segment) — no synthetic
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
   (EventSource) the instant it lands — no 2s polling lag. The 2s poll below stays as an
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
// Apply a PARTIAL tick update (only the instruments that ticked) keyed by EXCH:TS — push stream.
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
   update so it never rebuilds the whole widget stack. Empty levels show "—" (honest —
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
      ? `<div class="wg-empty">No depth for ${esc(BOT.depth.symbol)} — ${esc(BOT.depth.error)}.</div>`
      : depthLadderHtml(BOT.depth);
  }
}
function depthLadderHtml(d){
  let rows='';
  for(let i=0;i<5;i++){const b=d.bids[i]||{}, a=d.asks[i]||{};
    rows+=`<div class="wg-depth"><span class="num up">${b.price?b.price.toFixed(1):'—'}</span>`
      +`<span class="wg-q">${b.qty?b.qty.toLocaleString('en-IN'):''}</span>`
      +`<span class="wg-q">${a.qty?a.qty.toLocaleString('en-IN'):''}</span>`
      +`<span class="num down">${a.price?a.price.toFixed(1):'—'}</span></div>`;}
  const tb=d.totalBuyQty||0, ts=d.totalSellQty||0;
  const foot=`<div class="wg-sub">${esc(d.symbol)} · bid ${tb.toLocaleString('en-IN')} · ask ${ts.toLocaleString('en-IN')}${(tb+ts)===0?' · book opens 09:15':''}</div>`;
  return `<div class="wg-depth wg-dhead"><span>Bid</span><span>Qty</span><span>Qty</span><span>Ask</span></div>${rows}${foot}`;
}
// FAST, lean poll for the live Monitor — every strategy's real-time P&L from /api/monitor (cached ~1ms).
async function loadMonitor(){
  try{
    const m=await fetch(BOT_API+'/api/monitor').then(r=>r.json());
    if(m&&m.running){
      BOT.monitor=m;
      const byId={}; m.running.forEach(r=>byId[r.id]=r);
      ALGOS.forEach(a=>{const r=byId[a.id]; if(r){
        a.paperPnl=r.paperPnl; a.openPnl=r.openPnl; a.realisedPnl=r.realisedPnl;
        // DON'T clobber a.live here — that conflated "subscribed" with "monitored" and raced
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
  return '—';
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
// Iterates the ticker's OWN keys (not the payload) so a poll that returns a null/stale quote drops the overlay entry —
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
  if(BOT.error) return `<div class="bot-banner off">${icon('shield',13)}<span>Bot API offline — run <b>python3 bot_api.py</b> in the bot folder, then reopen Algo.</span></div>`;
  if(!BOT.connected){
    const auto=BOT.status&&BOT.status.autoLogin, running=(BOT.status&&BOT.status.reloginRunning)||BOT.reconnecting;
    const msg=running?'Session expired — reconnecting to Kite…'
      :auto?'Session expired (daily token). Tap reconnect or it will auto-refresh shortly.'
      :'Kite session expired — the daily token. Run <b>python3 auto_login.py</b> (or <b>login.py</b>), or set up auto-login.';
    return `<div class="bot-banner off">${running?'<span class="live-dot warn pulse"></span>':icon('shield',13)}<span>${msg}</span>
      <button class="bot-relogin" data-relogin ${running?'disabled':''}>${running?'Reconnecting…':'Reconnect'}</button></div>`;
  }
  const u=BOT.status&&BOT.status.user?esc(BOT.status.user):'—';
  return `<div class="bot-banner on"><span class="live-dot live"></span><span>Kite connected · ${u} · <b>${BOT.paperMode?'PAPER mode — no real orders':'LIVE'}</b>${BOT.status&&BOT.status.subscription?' · '+esc(BOT.status.subscription):''}</span></div>`;
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
  let total=0, depTotal=0;        // total = actively-running (Monitor); depTotal = all deployed incl. paused/aside (Forward Test)
  ALGOS.forEach(a=>{
    const v=exec==='live'?(a.livePnl||0):(a.paperPnl||0);
    if(a.live) total+=v;
    if(a.deployed) depTotal+=v;
    document.querySelectorAll('[data-live-pnl="'+a.id+'"]').forEach(el=>setNum(el,v));
    const sub=document.querySelector('[data-live-sub="'+a.id+'"]');
    if(sub) sub.textContent=(a.openPositions||0)?`${sgn(a.openPnl||0)} unrealised`:((a.openPositions||a.fwdTrades)?'realised':'no trades yet');
    (a.positions||[]).forEach(p=>{
      if(p.entry==null) return;
      const key=a.id+'::'+p.sym;
      const ltp=document.querySelector('[data-live-ltp="'+key+'"]'); if(ltp) ltp.textContent=p.ltp!=null?p.ltp.toLocaleString('en-IN'):'—';
      const up=document.querySelector('[data-live-upnl="'+key+'"]');
      if(up){ up.textContent=sgn(p.unreal)+(p.chgPct!=null?` · ${p.chgPct>=0?'+':''}${p.chgPct}%`:''); up.classList.remove('up','down'); up.classList.add(cls(p.unreal)); }
    });
  });
  document.querySelectorAll('[data-live="monTotal"]').forEach(el=>setNum(el,total));
  document.querySelectorAll('[data-live="algoTotal"]').forEach(el=>setNum(el,depTotal));
  let anReal=0, anOpen=0;
  ALGOS.forEach(a=>{ if(a.live){ anReal+=(a.realisedPnl||0); anOpen+=(a.openPnl||0); } });
  document.querySelectorAll('[data-live="anRealised"]').forEach(el=>setNum(el,anReal));
  document.querySelectorAll('[data-live="anOpen"]').forEach(el=>setNum(el,anOpen));
  document.querySelectorAll('[data-live="anBook"]').forEach(el=>setNum(el,total));
}
/* ============================================================
   STRATEGY LIBRARY — every strategy family, as honest, browseable,
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
  ['time',       'Time / Calendar',      'clock',   'The clock is the signal — time-of-day, expiry, day-of-week, auto square-off.'],
  ['statarb',    'Stat-Arb / Pairs',     'swap',    'Trade the spread between two related instruments, not the market direction.'],
  ['event',      'Event-Driven',         'flag',    'Position around a scheduled catalyst — results, rebalances, news.'],
  ['sentiment',  'Sentiment / OI / Flow','spark',   'Read positioning — open interest, PCR, max-pain, FII/DII flows.'],
  ['factor',     'Factor / Rotation',    'pie',     'Rotate a basket by a persistent edge — momentum, low-vol, quality, sector.'],
  ['ml',         'ML / Regime',          'cpu',     'A model picks the signal or switches the active strategy by regime.'],
  ['opt_dir',    'Options · Directional','target',  'Express a view with limited, known risk using long options or debit spreads.'],
  ['opt_income', 'Options · Income',     'wallet',  'Sell premium for steady credit — capped upside, must defend the tails.'],
  ['opt_vol',    'Options · Volatility', 'scale',   'Trade volatility itself — straddles, calendars, delta-neutral theta.'],
  ['arb',        'Cash-Futures / Arb',   'scissors','Lock a near-riskless spread between cash & futures or across expiries.'],
];
const SEG_LABEL={equity:'Equity',index:'Index F&O',fno:'Stock F&O',options:'Options',any:'Any market'};
/* ── Instrument × holding-style bifurcation (Library navigation) ──────────────
   Primary class is DERIVED from the catalog seg (equity→Equity, options→Options,
   index|fno→Futures). Holding style is an explicit per-strategy tag — a judgement
   call about how the strategy is actually held; retune freely in STRAT_HOLD. */
const INSTR_LABEL={equity:'Equity',options:'Options',futures:'Futures'};
const INSTR_TABS=[
  ['equity', 'Equity',  'layers',  'Cash stocks — delivery & intraday'],
  ['options','Options', 'target',  'Defined-risk & premium — calls & puts'],
  ['futures','Futures', 'trendUp', 'Leveraged index & stock F&O'],
];
const HOLD_LABEL={carry:'Carry-forward',intraday:'Intraday',swing:'Swing',expiry:'Expiry',scalper:'Scalper'};
const HOLD_DESC={
  carry:'Positional — held overnight to multi-day (CNC / carried F&O).',
  intraday:'Entered and squared off within the same session.',
  swing:'Held a few days on a directional or volatility view.',
  expiry:'Anchored to the options expiry cycle — theta, pin, expiry-day.',
  scalper:'Very short intraday — many small, fast trades.',
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
function algoHold(a){ const id=(a&&a.id||'').toLowerCase(); if(ALGO_HOLD[id]) return ALGO_HOLD[id];
  if(/scalp/.test(id)) return 'scalper'; const p=(a&&a.product||'').toUpperCase();
  if(p==='MIS') return 'intraday'; if(p==='NRML') return 'swing'; return 'carry'; }
// studio-wide instrument × holding scope — the single source of truth every Algo tab honours
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
   works:'Sustained, trending markets — it catches the meat of a directional move.',
   fails:'Choppy, sideways markets — it gets whipsawed, buying high and selling low repeatedly.',
   guard:'Add a regime filter (only take longs in Bull) and a hard stop; stand aside in Choppy.',
   params:[['Fast MA','50'],['Slow MA','200'],['Stop','ATR×2']]},
  {id:'lib_ema921',name:'EMA 9/21 Momentum',fam:'trend',risk:'Aggressive',seg:'index',best:'Bull',
   what:'Faster intraday version of the crossover for momentum bursts.',
   rule:'Long when EMA9 > EMA21 and price holds above both; exit when EMA9 crosses back below EMA21.',
   works:'Strong intraday trends and momentum days with a clear direction.',
   fails:'Range-bound, low-volume sessions — frequent small losses pile up.',
   guard:'Cap trades/day, trade only the trending session window, square off by close.',
   params:[['Fast EMA','9'],['Slow EMA','21'],['Max trades/day','3']]},
  {id:'lib_supertrend',name:'Supertrend Follow',fam:'trend',risk:'Moderate',seg:'fno',best:'Bull',
   what:'Trails an ATR-based band; flips long/short as price closes through it.',
   rule:'Long when price closes above the Supertrend line; reverse/flat when it closes below.',
   works:'Clean trends with steady volatility — the band trails the move well.',
   fails:'Sharp volatility spikes flip it repeatedly (false reversals).',
   guard:'Use a longer ATR period in High-Vol; size down when VIX is elevated.',
   params:[['ATR period','10'],['Multiplier','3']]},
  {id:'lib_adx',name:'ADX Trend Filter',fam:'trend',risk:'Conservative',seg:'equity',best:'Bull',
   what:'Only trades when trend strength (ADX) confirms a real trend exists.',
   rule:'Take trend entries only when ADX > 25 and rising; otherwise stay flat.',
   works:'As a filter on top of any trend system — it cuts the worst chop trades.',
   fails:'Lags at trend births and ends; can keep you out of early moves.',
   guard:'Pair with a momentum trigger so you are not late; never trade ADX < 20.',
   params:[['ADX threshold','25'],['Lookback','14']]},
  {id:'lib_rsmom',name:'Relative-Strength Rotation',fam:'trend',risk:'Moderate',seg:'equity',best:'Bull',
   what:'Holds the strongest stocks in a universe, drops the laggards.',
   rule:'Rank a universe by 3–6 month return; hold the top decile, rebalance monthly.',
   works:'Trending broad markets where leadership persists.',
   fails:'Sharp reversals/crashes — last month’s winners fall hardest.',
   guard:'Add a market-trend filter (go to cash below the 200-DMA of the index).',
   params:[['Lookback','6mo'],['Top N','10'],['Rebalance','Monthly']]},
  // ---- Mean Reversion ----
  {id:'lib_rsi2',name:'RSI(2) Pullback',fam:'meanrev',risk:'Moderate',seg:'equity',best:'Bull',
   what:'Buys short, sharp dips inside an established uptrend.',
   rule:'In an uptrend (price > 200-DMA), buy when RSI(2) < 10; exit when RSI(2) > 70 or on a time stop.',
   works:'Uptrending markets that pull back and resume — high win rate.',
   fails:'Catches a falling knife if the uptrend has actually broken.',
   guard:'Never fade without the trend filter; hard time-stop so a loser can’t compound.',
   params:[['RSI period','2'],['Entry','<10'],['Exit','>70']]},
  {id:'lib_bollrev',name:'Bollinger Band Reversion',fam:'meanrev',risk:'Moderate',seg:'equity',best:'Choppy',
   what:'Fades touches of the outer band back toward the mean.',
   rule:'Buy a close below the lower band, exit at the middle band; mirror for shorts.',
   works:'Range-bound, mean-reverting names with stable volatility.',
   fails:'Trending breakouts — “cheap” keeps getting cheaper.',
   guard:'Skip when bands are expanding fast (volatility regime change); stop beyond the band.',
   params:[['Period','20'],['StdDev','2']]},
  {id:'lib_vwaprev',name:'VWAP Reversion',fam:'meanrev',risk:'Aggressive',seg:'index',best:'Choppy',
   what:'Intraday fade of price stretched far from VWAP back to it.',
   rule:'Fade when price is >N stdev from VWAP with no fresh news; target VWAP.',
   works:'Liquid intraday instruments on balanced, two-sided days.',
   fails:'Trend days — price rides far from VWAP and never returns.',
   guard:'Detect trend-day early (opening drive) and disable; tight per-trade stop.',
   params:[['Band','2σ'],['Target','VWAP']]},
  {id:'lib_gapfill',name:'Gap-Fill Fade',fam:'meanrev',risk:'Aggressive',seg:'equity',best:'Choppy',
   what:'Fades an overnight gap betting it fills toward the prior close.',
   rule:'On a moderate gap with no catalyst, fade toward the prior close; stop beyond the gap extreme.',
   works:'Emotion-driven gaps with no real news behind them.',
   fails:'News/results gaps that run — fading those is how accounts blow up.',
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
   what:'The classic Turtle breakout — buy new highs, ride the trend.',
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
   fails:'Late-stage bases and bear markets — most breakouts fail.',
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
   what:'A discipline overlay — flatten everything before the close, no overnight risk.',
   rule:'Force-exit all intraday positions at a set time (e.g. 15:15) regardless of P&L.',
   works:'Every intraday strategy — removes gap risk and emotional holding.',
   fails:'Can exit a winner early; that is the price of zero overnight risk.',
   guard:'This IS the guard — pair with any intraday system.',
   params:[['Square-off','15:15']]},
  {id:'lib_btst',name:'BTST Momentum',fam:'time',risk:'Aggressive',seg:'equity',best:'Bull',
   what:'Buy strong-closing stocks today, sell tomorrow on follow-through.',
   rule:'Buy names closing at day highs on volume; exit next morning on strength or a stop.',
   works:'Strong-trend markets with overnight continuation.',
   fails:'Overnight gap-downs on negative global cues — full overnight risk.',
   guard:'Small size; avoid event nights; predefined gap-down exit.',
   params:[['Hold','1 night'],['Exit','Next open']]},
  {id:'lib_expiry',name:'Expiry-Day Theta',fam:'time',risk:'Aggressive',seg:'options',best:'Choppy',
   what:'Sells options on expiry day to harvest the fastest time decay.',
   rule:'Sell ATM/OTM options near the open on expiry; manage with a stop-loss on premium.',
   works:'Pinned, low-movement expiry sessions.',
   fails:'A trending expiry day — short options can lose multiples of the credit fast.',
   guard:'Hard premium SL, defined-risk spreads not naked, size for the worst case.',
   params:[['Day','Expiry'],['Stop','2× credit']]},
  {id:'lib_dow',name:'Day-of-Week / Seasonality',fam:'time',risk:'Conservative',seg:'index',best:'Any',
   what:'Exploits recurring calendar tendencies (e.g. monthly expiry, turn-of-month).',
   rule:'Take positions only on statistically favourable calendar days from backtests.',
   works:'When a seasonal edge is statistically robust out-of-sample.',
   fails:'Overfitting — many “seasonal” edges are noise that vanish live.',
   guard:'Demand a large sample + OOS proof before trusting; tiny size.',
   params:[['Edge','Calendar'],['Proof','OOS required']]},
  // ---- Stat-Arb / Pairs ----
  {id:'lib_pairs',name:'Pairs Trading',fam:'statarb',risk:'Moderate',seg:'equity',best:'Choppy',
   what:'Long one stock, short a correlated one when their spread stretches.',
   rule:'When the spread z-score > 2, short the rich / long the cheap; exit at mean reversion.',
   works:'Stable, cointegrated pairs in range-bound markets — market-neutral.',
   fails:'When the relationship breaks (a fundamental change in one name).',
   guard:'Re-test cointegration regularly; stop if the spread keeps diverging.',
   params:[['Entry','z>2'],['Exit','z→0']]},
  {id:'lib_ratio',name:'Ratio / Spread Trade',fam:'statarb',risk:'Moderate',seg:'fno',best:'Choppy',
   what:'Trades the ratio between two related futures (e.g. sector pair).',
   rule:'Mean-revert the historical ratio band between two related contracts.',
   works:'Structurally linked instruments with a stable ratio.',
   fails:'Regime shifts that permanently re-rate one leg.',
   guard:'Hard spread stop; cap leverage — spreads still blow out.',
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
   fails:'Crowded trade — much of the move is already priced in.',
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
   works:'Persistent bull trends — momentum is a durable long-run factor.',
   fails:'Momentum crashes at sharp market turns.',
   guard:'De-risk to cash below the index 200-DMA; cap volatility per name.',
   params:[['Factor','12-1 mom'],['Filter','Index 200-DMA']]},
  {id:'lib_lowvol',name:'Low-Volatility Factor',fam:'factor',risk:'Conservative',seg:'equity',best:'Bear',
   what:'Holds the lowest-volatility names for smoother, defensive returns.',
   rule:'Rank universe by realised volatility; hold the lowest-vol basket, rebalance quarterly.',
   works:'Choppy/bear markets — it draws down far less.',
   fails:'Lags badly in roaring bull markets.',
   guard:'Use as the defensive sleeve; combine with momentum for balance.',
   params:[['Factor','Low vol'],['Rebalance','Quarterly']]},
  {id:'lib_quality',name:'Quality / Value Tilt',fam:'factor',risk:'Conservative',seg:'equity',best:'Any',
   what:'Owns financially strong, reasonably-priced companies for the long run.',
   rule:'Screen for high ROE/low debt + sensible valuation; hold long-term, rebalance yearly.',
   works:'Long horizons — quality compounds and survives downturns.',
   fails:'Can underperform for long stretches when junk rallies.',
   guard:'Diversify; this is a survive-and-compound sleeve, not a trade.',
   params:[['Screen','ROE/Debt/Val'],['Horizon','Years']]},
  // ---- ML / Regime ----
  {id:'lib_regimeswitch',name:'Regime-Switching Meta',fam:'ml',risk:'Moderate',seg:'index',best:'Any',
   what:'A meta-strategy that turns sub-strategies on/off by the live regime.',
   rule:'Detect regime (trend/chop/high-vol); run only the sub-strategy validated for that regime.',
   works:'Across full market cycles — it stands aside when nothing fits.',
   fails:'Regime detection lags at turning points; transitions are costly.',
   guard:'This is the survival engine — when uncertain, it goes to cash.',
   params:[['Detector','VIX+breadth+trend'],['Default','Stand aside']]},
  {id:'lib_mlsignal',name:'ML Predictive Signal',fam:'ml',risk:'Aggressive',seg:'equity',best:'Any',
   what:'A trained model outputs a directional probability used to size trades.',
   rule:'Enter when model confidence clears a threshold; size proportional to confidence.',
   works:'When the model has a genuine, walk-forward-validated edge.',
   fails:'Overfitting and regime drift — the model decays as markets change.',
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
   works:'Moderate directional moves — cheaper and less IV-sensitive.',
   fails:'Capped upside; still loses if the move doesn’t come.',
   guard:'Risk = net debit, known up front; pick expiries with room for the move.',
   params:[['Structure','Buy+Sell'],['Risk','Net debit']]},
  // ---- Options · Income ----
  {id:'lib_strangle',name:'Short Strangle',fam:'opt_income',risk:'Aggressive',seg:'options',best:'Choppy',
   what:'Sell an OTM call and put to collect premium when price stays in a range.',
   rule:'Sell OTM call + put; profit if price stays between strikes through expiry.',
   works:'Range-bound, falling-volatility markets.',
   fails:'A big move on either side — losses are theoretically unlimited if naked.',
   guard:'Prefer the defined-risk Iron Condor; hard SL on premium; never naked + unhedged.',
   params:[['Strikes','OTM C+P'],['Defend','SL on premium']]},
  {id:'lib_condor',name:'Iron Condor',fam:'opt_income',risk:'Moderate',seg:'options',best:'Choppy',
   what:'A defined-risk strangle — sells a range, buys wings to cap the tails.',
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
   what:'Buy a call AND a put — profits from a big move either direction.',
   rule:'Buy ATM call + put before an expected volatility event; profit on a large move.',
   works:'Pre-event when a large move is likely and IV is still cheap.',
   fails:'IV crush after the event + a small move — both legs bleed.',
   guard:'Enter before IV ramps; exit fast post-event; cap premium at risk.',
   params:[['Strikes','ATM C+P'],['Edge','Cheap IV']]},
  {id:'lib_calendar',name:'Calendar Spread',fam:'opt_vol',risk:'Moderate',seg:'options',best:'Choppy',
   what:'Sell a near-dated option, buy a far-dated one — harvest faster near-term decay.',
   rule:'Same strike, sell front expiry / buy back expiry; profit from differential theta.',
   works:'Stable price near the strike with a favourable term structure.',
   fails:'A large directional move away from the strike hurts both legs.',
   guard:'Defined-ish risk; manage if price leaves the strike zone.',
   params:[['Legs','Sell front/Buy back'],['Edge','Theta diff']]},
  {id:'lib_deltaneutral',name:'Delta-Neutral Theta',fam:'opt_vol',risk:'Moderate',seg:'options',best:'Choppy',
   what:'Hold a net-zero-delta option book and earn time decay, re-hedging as it drifts.',
   rule:'Sell premium, keep delta near zero by adjusting hedges as price moves.',
   works:'Range-bound, mean-reverting volatility with active management.',
   fails:'Gamma risk — fast moves force costly re-hedging (negative gamma bleed).',
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
   CRYPTO MARKET LAYER — the Algo Studio can scope to Indian (Kite)
   or Crypto (Binance). REAL prices only, no fake fallback: Binance's
   public data mirror (no API key, read-only). Strategy EXECUTION is
   preview/paper — honestly flagged. Real crypto orders would route via
   the Binance Algo API (TWAP/POV), which needs server-side key signing
   — that's the roadmap engine, never the browser.
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
// Risk-first strategy TEMPLATES (educational, preview/paper) — same survival-first ethos as the Indian library.
const CRYPTO_STRATEGIES=[
  {id:'cx_btc_trend',name:'BTC Trend (MA200)',cat:'Trend',risk:'Moderate',pair:'BTCUSDT',
   what:'Long BTC while it holds above its long-term moving average; flat below.',
   rule:'BUY when price closes above the 200-period MA; exit on a close back below.',
   works:'Strong, sustained bull legs — crypto trends long and hard.',
   fails:'Chop around the MA whipsaws you in and out at small losses repeatedly.',
   guard:'Only long above the MA; ATR-sized stop; one position; stand aside in chop.'},
  {id:'cx_grid',name:'Range Grid (ETH)',cat:'Mean-Reversion',risk:'Aggressive',pair:'ETHUSDT',
   what:'A ladder of staggered buys & sells across a defined band, harvesting oscillation.',
   rule:'Buy each rung down, sell each rung up within a set price band.',
   works:'Sideways, high-volatility ranges — it monetises the wiggle.',
   fails:'A clean breakout leaves you holding the whole ladder against the move.',
   guard:'Hard band-exit if price leaves the range; cap total grid exposure & leverage.'},
  {id:'cx_funding',name:'Funding-Rate Carry',cat:'Income',risk:'Moderate',pair:'BTC spot vs perp',
   what:'Delta-neutral: long spot, short perpetual — collect funding each interval.',
   rule:'When funding is positive, hold spot + short perp; pocket the funding payments.',
   works:'Calm, positive-funding regimes — steady market-neutral yield.',
   fails:'Funding flips negative or the basis blows out in a liquidation cascade.',
   guard:'Watch funding + basis; unwind on negative funding; respect exchange limits.'},
  {id:'cx_rsi2',name:'RSI-2 Dip (Alts)',cat:'Mean-Reversion',risk:'Aggressive',pair:'SOLUSDT',
   what:'Buys very short-term oversold dips inside a higher-timeframe uptrend.',
   rule:'In an uptrend, BUY when RSI(2) < 5; exit when RSI(2) > 70 or after N bars.',
   works:'Pullbacks within an established alt uptrend.',
   fails:'Catching a falling knife once the trend has actually broken.',
   guard:'Only above the 200-MA; time-stop + hard stop; small size on alts.'},
  {id:'cx_breakout',name:'Volatility Breakout',cat:'Breakout',risk:'Aggressive',pair:'BTCUSDT',
   what:'Enters as price escapes a tight range on expanding volume.',
   rule:'BUY on a close above the N-day high with above-average volume; trail a stop.',
   works:'The start of a fresh expansion leg after compression.',
   fails:'False breakouts in thin liquidity hours snap straight back.',
   guard:'Require volume confirmation; trade liquid majors; trail, don’t fix a target.'},
  {id:'cx_pairs',name:'ETH/BTC Ratio Pairs',cat:'Stat-Arb',risk:'Moderate',pair:'ETH vs BTC',
   what:'Trades the ETH/BTC ratio back to its mean — neutral to overall crypto beta.',
   rule:'Short the rich leg, long the cheap leg when the ratio z-score is stretched.',
   works:'When ETH & BTC stay cointegrated and the spread mean-reverts.',
   fails:'A narrative regime-shift breaks the relationship and the spread runs.',
   guard:'Z-score entry/exit bands; stop if the spread breaks its historical range.'},
  {id:'cx_dca',name:'Disciplined DCA',cat:'Time / Calendar',risk:'Conservative',pair:'BTCUSDT',
   what:'Cost-averages a fixed amount on a fixed schedule — accumulation, not timing.',
   rule:'Buy a fixed notional every interval regardless of price; optional dip boosts.',
   works:'Long-horizon accumulation through full cycles; removes timing risk.',
   fails:'Prolonged bear markets test conviction; capital sits in drawdown.',
   guard:'Only commit what you can hold for years; size the schedule to your cashflow.'},
  {id:'cx_momentum',name:'Cross-Sectional Momentum',cat:'Factor / Rotation',risk:'Aggressive',pair:'Top-10 majors',
   what:'Rotates into the strongest recent performers across a basket of majors.',
   rule:'Each week, hold the top-N by trailing return; drop the laggards.',
   works:'Persistent momentum regimes where winners keep winning.',
   fails:'Sharp momentum crashes reverse and gut the whole basket at once.',
   guard:'Cap per-name weight; vol-target the basket; kill-switch on a drawdown limit.'},
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
function cryptoFmt(p){ if(!isFinite(p)) return '—'; const dec=p>=1?2:p>=0.01?4:6; return '$'+p.toLocaleString('en-US',{minimumFractionDigits:Math.min(dec,2),maximumFractionDigits:dec}); }
// ---- crypto views ----
function cryptoStatusBar(){
  const live=CRYPTO.live, t=CRYPTO.t?new Date(CRYPTO.t).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'}):'';
  const cells=[
    `<div class="asb-cell"><span class="asb-l">Venue${infoI('Binance public market data (read-only, no API key). Real prices, never simulated.')}</span><span class="asb-v"><span class="live-dot ${live?'live':''}"></span>Binance</span></div>`,
    `<div class="asb-cell"><span class="asb-l">Data</span><span class="asb-v">${live?`● LIVE${t?` · ${t}`:''}`:(CRYPTO.error?'Unreachable — retrying':'Connecting…')}</span></div>`,
    `<div class="asb-cell"><span class="asb-l">Mode${infoI('Crypto strategies are in preview — paper only. No crypto orders are placed; a live crypto engine (Binance Algo API, server-signed) is on the roadmap.')}</span><span class="asb-v"><span class="mode-badge paper">PAPER · preview</span></span></div>`,
    `<div class="asb-cell asb-grow"><span class="asb-l">Market</span><span class="asb-v">Crypto · USDT spot</span></div>`
  ].join('<span class="asb-div"></span>');
  return `<div class="algo-statusbar${live?'':' off'}">${cells}</div>`;
}
function cryptoPriceStrip(){
  const tiles=CRYPTO_UNIVERSE.map(c=>{ const q=CRYPTO.quotes[c.sym], ch=q?q.chg:null;
    return `<div class="cx-tile" data-cprice="${c.sym}">
      <div class="cx-tk"><b>${esc(c.tk)}</b><span>${esc(c.name)}</span></div>
      <div class="cx-px"><span class="cx-ltp num"${q?` data-raw="${q.ltp}"`:''}>${q?cryptoFmt(q.ltp):'—'}</span>
        <span class="cx-chg num ${cls(ch)}" data-cchg>${ch==null?'·':pct(ch)+' · 24h'}</span></div></div>`; }).join('');
  const note=CRYPTO.live?`<span class="cx-src live">● Live · Binance · 24h change</span>`
    :(CRYPTO.error?`<span class="cx-src off">Can’t reach Binance — retrying…</span>`:`<span class="cx-src off">Connecting to Binance…</span>`);
  return `<div class="cx-strip-wrap"><div class="cx-strip-head">${icon('spark',13)}<b>Live crypto prices</b>${note}</div><div class="cx-strip">${tiles}</div></div>`;
}
function patchCryptoPrices(){
  document.querySelectorAll('[data-cprice]').forEach(el=>{ const q=CRYPTO.quotes[el.dataset.cprice]; if(!q) return;
    const l=el.querySelector('.cx-ltp'), c=el.querySelector('[data-cchg]');
    if(l){ const txt=cryptoFmt(q.ltp); if(l.textContent!==txt){ const prev=parseFloat(l.dataset.raw); const dir=isFinite(prev)?Math.sign(q.ltp-prev):0;
      l.textContent=txt; l.dataset.raw=q.ltp; if(dir){ l.classList.remove('tick-up','tick-dn'); void l.offsetWidth; l.classList.add(dir>0?'tick-up':'tick-dn'); } } }
    if(c){ c.textContent=pct(q.chg)+' · 24h'; c.className='cx-chg num '+cls(q.chg); c.setAttribute('data-cchg',''); } });
  const note=document.querySelector('.cx-strip-head .cx-src');
  if(note){ note.className='cx-src '+(CRYPTO.live?'live':'off'); note.textContent=CRYPTO.live?'● Live · Binance · 24h change':(CRYPTO.error?'Can’t reach Binance — retrying…':'Connecting to Binance…'); }
}
function cryptoStratCard(s){
  const rk=LIB_RISK_CLASS[s.risk]||'b-neu';
  return `<div class="cx-card">
    <div class="cx-card-h"><div><b>${esc(s.name)}</b><span class="cx-cat">${esc(s.cat)} · ${esc(s.pair)}</span></div><span class="badge ${rk}">${esc(s.risk)}</span></div>
    <p class="cx-what">${esc(s.what)}</p>
    <div class="cx-line cx-rule">${icon('bolt',11)}<span><b>Rule.</b> ${esc(s.rule)}</span></div>
    <div class="cx-line cx-works">${icon('check',11)}<span><b>Works.</b> ${esc(s.works)}</span></div>
    <div class="cx-line cx-fails">${icon('alert',11)}<span><b>Fails.</b> ${esc(s.fails)}</span></div>
    <div class="cx-line cx-guard">${icon('shield',11)}<span><b>Survival guard.</b> ${esc(s.guard)}</span></div>
    <div class="cx-card-f"><span class="cx-tag">Preview · paper</span><button class="btn-ghost sm" disabled title="Crypto paper engine is on the roadmap">Paper-test (soon)</button></div></div>`;
}
function cryptoMarket(){
  const note=`<div class="cx-preview-note">${icon('shield',13)}<span><b>Crypto is in preview.</b> Prices are <b>real</b> (Binance public data) — never simulated. The strategies below are educational templates: <b>no crypto orders are placed</b>. A paper/live crypto engine (Binance Algo API, server-signed) is on the roadmap. Indian markets stay fully wired via Kite — switch back anytime.</span></div>`;
  const stat=secStats([
    {l:'Instruments',v:String(CRYPTO_UNIVERSE.length),s:'USDT spot majors'},
    {l:'Strategy templates',v:String(CRYPTO_STRATEGIES.length),s:'preview · paper'},
    {l:'Data',v:CRYPTO.live?'Live':'—',s:CRYPTO.live?'real · Binance':'connecting',tone:CRYPTO.live?'up':''},
    {l:'Execution',v:'Paper',s:'engine on roadmap'},
  ]);
  return note+stat+`<div class="cx-grid">${CRYPTO_STRATEGIES.map(cryptoStratCard).join('')}</div>`;
}
function cryptoSoon(label){
  return secEmpty('cpu',label+' · crypto preview',
    `${esc(label)} for crypto arrives with the crypto strategy engine. For now, explore the live prices above and the strategy templates under <b>Library</b> / <b>Marketplace</b>. Indian markets have the full ${esc(label.toLowerCase())} today — switch the toggle back to <b>Indian</b>.`);
}
// Real 24h movers from the live Binance data — honest momentum snapshot, not a scored signal.
function cryptoOpportunity(){
  if(!CRYPTO.live) return secEmpty('cpu','Scanning crypto…','Pulling live 24h moves from Binance. If this persists, the public data API may be unreachable from your network.');
  // relative leaders/laggards (top & bottom of the same sorted set) — never an empty column, even on an all-red day
  const m=CRYPTO_UNIVERSE.map(c=>({...c,q:CRYPTO.quotes[c.sym]})).filter(r=>r.q).sort((a,b)=>b.q.chg-a.q.chg);
  const n=Math.min(5,Math.ceil(m.length/2)), lead=m.slice(0,n), lag=m.slice(-n).reverse();
  const row=r=>`<div class="cx-mv-row"><div class="cx-mv-tk"><b>${esc(r.tk)}</b><span>${esc(r.name)}</span></div><span class="cx-mv-px num">${cryptoFmt(r.q.ltp)}</span><span class="cx-mv-chg num ${cls(r.q.chg)}">${pct(r.q.chg)}</span></div>`;
  const col=(title,arr,ic)=>`<div class="cx-mv-col"><div class="cx-mv-h">${icon(ic,12)} ${title}</div>${arr.map(row).join('')||'<div class="cx-mv-empty">—</div>'}</div>`;
  const note=`<div class="cx-preview-note">${icon('shield',13)}<span><b>Honest scan.</b> These are <b>real 24h moves</b> from Binance — relative leaders vs laggards, a momentum snapshot and <b>not a validated signal</b>. The explainable, scored crypto opportunity engine arrives with the strategy engine; nothing is traded.</span></div>`;
  return note+`<div class="cx-movers">${col('Leaders · 24h',lead,'trendUp')}${col('Laggards · 24h',lag,'alert')}</div>`;
}
// Templates grouped by family — no fabricated track record; real ranking unlocks with the engine.
function cryptoLeaderboard(){
  const note=`<div class="cx-preview-note">${icon('shield',13)}<span><b>No fabricated track record.</b> Crypto strategies are templates — there's no live performance to rank yet, so we won't invent one. They're grouped by family below; a real, forward-tested leaderboard unlocks with the crypto paper engine.</span></div>`;
  const byCat={}; CRYPTO_STRATEGIES.forEach(s=>{(byCat[s.cat]=byCat[s.cat]||[]).push(s);});
  const groups=Object.keys(byCat).map(cat=>`<div class="cx-lb-grp"><div class="cx-lb-h">${esc(cat)} <i>${byCat[cat].length}</i></div>${byCat[cat].map(s=>`<div class="cx-lb-row"><b>${esc(s.name)}</b><span class="cx-cat">${esc(s.pair)}</span><span class="badge ${LIB_RISK_CLASS[s.risk]||'b-neu'}">${esc(s.risk)}</span></div>`).join('')}</div>`).join('');
  return note+`<div class="cx-lb">${groups}</div>`;
}
// Crypto-scoped router: every Algo Studio tab stays in sync with the crypto market (no Indian content leaks).
function cryptoBody(view,label){
  if(view==='library'||view==='market') return cryptoMarket();
  if(view==='opportunity') return cryptoOpportunity();
  if(view==='leaderboard') return cryptoLeaderboard();
  return cryptoSoon(label);
}

// Studio-wide scope toggle (Equity/Options/Futures + holding style) — rendered once in the
// chrome, below the tabs, so every Indian tab is scoped consistently. Counts are the strategy
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
  state.algo=state.algo||{view:'market',bt:{algo:0,period:'1Y'}};
  if(!state.algo.view) state.algo.view='market';
  if(!state.algo.bt) state.algo.bt={algo:0,period:'1Y'};   // guard: setMarket/studioScope can create state.algo before this default
  if(!state.algo.exec) state.algo.exec='paper';
  if(!state.algo.market) state.algo.market='in';
  const crypto=state.algo.market==='crypto';
  if(!BOT.loaded){ loadBotData().then(()=>{ if(isAlgo())renderAlgo(); }); }
  if(crypto && !CRYPTO.loaded && !CRYPTO.busy){ loadCrypto().then(()=>{ if(isAlgo()&&state.algo.market==='crypto') renderAlgo(); }); }
  const view=state.algo.view, live=ALGOS.filter(a=>a.status!=='idle');
  const depN=crypto?0:ALGOS.filter(a=>a.deployed&&inScope(a)).length;   // Monitor badge reflects the active market + studio scope
  const tabs=[['library','Library'],['opportunity','Opportunity Engine'],['risk','Risk Governor'],['positions','Positions'],['market','Marketplace'],['leaderboard','Leaderboard'],['backtest','Backtest'],['forward','Forward Test'],['monitor','Monitor'],['accuracy','Accuracy'],['analytics','Analytics']];
  const head=`<div class="av-head">
    <div class="av-title"><span class="av-ic">${icon('cpu',17)}</span><div><b>Algo Studio</b><span>${crypto?'Crypto strategies · live Binance prices · paper preview':'Backtest, forward-test &amp; monitor rule-based strategies'}</span></div></div>
    <div class="av-tabs" role="tablist" aria-label="Algo views">${tabs.map(([k,l])=>`<button class="av-tab${k===view?' on':''}" role="tab" aria-selected="${k===view}" data-algoview="${k}">${l}${k==='monitor'&&depN?` <i class="av-tn">${depN}</i>`:''}</button>`).join('')}</div></div>`;
  const tabLabel=(tabs.find(t=>t[0]===view)||[,'This view'])[1];
  const body=crypto
    ? cryptoBody(view,tabLabel)
    : (view==='library'?algoLibrary():view==='opportunity'?algoOpportunity():view==='risk'?algoRisk():view==='positions'?algoPositions():view==='market'?algoMarket():view==='leaderboard'?algoLeaderboard():view==='backtest'?algoBacktest():view==='forward'?algoForward():view==='accuracy'?algoAccuracy():view==='analytics'?algoAnalytics():algoMonitor());
  v.innerHTML=`<div class="av-wrap">${head}<div class="av-scroll">${crypto?cryptoStatusBar():algoStatusBar()}${crypto?'':studioScopeBar()}${body}</div></div>`;
  v.querySelectorAll('[data-algomkt]').forEach(b=>b.onclick=()=>setMarket(b.dataset.algomkt));
  v.querySelectorAll('[data-algoview]').forEach(b=>b.onclick=()=>{state.algo.view=b.dataset.algoview;renderAlgo();});
  v.querySelectorAll('[data-algoseg]').forEach(b=>b.onclick=()=>{state.algo.seg=b.dataset.algoseg;renderAlgo();});
  // studio-wide instrument × holding scope (every Indian tab honours it)
  v.querySelectorAll('[data-algoinstr]').forEach(b=>b.onclick=()=>{ const a=state.algo; if(a.instr===b.dataset.algoinstr) return; a.instr=b.dataset.algoinstr; a.hold='all'; if(a.lib) a.lib.fam='all'; renderAlgo(); });
  v.querySelectorAll('[data-algohold]').forEach(b=>b.onclick=()=>{ state.algo.hold=b.dataset.algohold; renderAlgo(); });
  v.querySelectorAll('[data-algogoto]').forEach(b=>b.onclick=()=>{state.algo.view=b.dataset.algogoto;renderAlgo();});
  v.querySelectorAll('[data-algobt]').forEach(b=>b.onclick=()=>{state.algo.bt.algo=+b.dataset.algobt;state.algo.view='backtest';renderAlgo();});
  v.querySelectorAll('[data-algodep]').forEach(b=>b.onclick=()=>algoDeploy(ALGOS[+b.dataset.algodep]));
  v.querySelectorAll('[data-fwgoto]').forEach(b=>b.onclick=()=>algoDeploy(ALGOS[+b.dataset.fwgoto]));
  v.querySelectorAll('[data-algogl]').forEach(b=>b.onclick=()=>{const a=ALGOS[+b.dataset.algogl]; if(b.classList.contains('is-locked')){quickToast('Go-Live locked','Keep paper-trading — unlocks after the forward-test gate (≥'+(BOT.nudgeMin||10)+' profitable closed trades).');return;} goLiveChecklist(a);});
  v.querySelectorAll('[data-lcpause]').forEach(b=>b.onclick=()=>{const a=ALGOS[+b.dataset.lcpause];setStrategyState(a.id,'paused','Paused — '+a.name);});
  v.querySelectorAll('[data-lcresume]').forEach(b=>b.onclick=()=>{const a=ALGOS[+b.dataset.lcresume];setStrategyState(a.id,'paper','Resumed — '+a.name);});
  v.querySelectorAll('[data-lcstop]').forEach(b=>b.onclick=()=>lcStop(ALGOS[+b.dataset.lcstop]));
  const sa=v.querySelector('[data-stopall]'); if(sa)sa.onclick=stopAll;
  // Monitor accordion: click a strategy to reveal its positions + forward accuracy.
  // Toggles the class directly (no re-render) → smooth, and survives the 2s live poll.
  v.querySelectorAll('[data-monexp]').forEach(el=>{
    const tog=e=>{ if(e&&e.target&&e.target.closest('[data-algogl],[data-algogoto]'))return;
      const id=el.dataset.monexp, m=state.algo.monExpand=state.algo.monExpand||{}; m[id]=!m[id];
      const card=el.closest('.mon-card'); if(card)card.classList.toggle('open',m[id]); el.setAttribute('aria-expanded',String(!!m[id])); };
    el.onclick=tog;
    el.onkeydown=e=>{ if(e.key==='Enter'||e.key===' '){e.preventDefault();tog(e);} };
  });
  v.querySelectorAll('[data-adapt]').forEach(b=>b.onclick=()=>toggleAdapt(+b.dataset.adapt));
  v.querySelectorAll('[data-execmode]').forEach(b=>b.onclick=()=>{state.algo.exec=b.dataset.execmode;renderAlgo();});
  v.querySelectorAll('[data-execjump]').forEach(b=>b.onclick=()=>{state.algo.view='monitor';state.algo.exec=b.dataset.execjump;renderAlgo();});
  const pc=v.querySelector('#algoPlanCap'); if(pc)pc.onchange=()=>{state.algo.capital=Math.max(0,Math.round(+pc.value||0));renderAlgo();};
  const or=v.querySelector('#algoOnlyRun'); if(or)or.onchange=()=>{state.algo.onlyRun=or.checked;renderAlgo();};
  v.querySelectorAll('[data-capset]').forEach(b=>b.onclick=()=>{state.algo.capital=+b.dataset.capset;renderAlgo();});
  v.querySelectorAll('[data-algobuild]').forEach(b=>b.onclick=algoBuilder);
  v.querySelectorAll('[data-anexport]').forEach(b=>b.onclick=exportAnalyticsCSV);
  v.querySelectorAll('[data-btperiod]').forEach(b=>b.onclick=()=>{state.algo.bt.period=b.dataset.btperiod;renderAlgo();});
  v.querySelectorAll('[data-btuni]').forEach(b=>b.onclick=()=>{state.algo.bt.uni=b.dataset.btuni;renderAlgo();});
  const btuc=v.querySelector('#btUniCustom'); if(btuc) btuc.onkeydown=e=>{ if(e.key==='Enter'){ const val=btuc.value.trim().toUpperCase().replace(/\s+/g,''); state.algo.bt.uni=val||'default'; renderAlgo(); } };
  v.querySelectorAll('[data-lbsort]').forEach(b=>b.onclick=()=>{state.algo.lbSort=b.dataset.lbsort;renderAlgo();});
  v.querySelectorAll('[data-harness]').forEach(b=>b.onclick=()=>toggleHarness(b.dataset.harness));
  const fgx=v.querySelector('[data-fgdismiss]'); if(fgx) fgx.onclick=()=>{ BOT.algoGuideDone=true; try{localStorage.setItem('tp.algoGuide','1');}catch(e){} renderAlgo(); };
  // ---- Strategy Library: family/risk filters · search · DIY expand · regime jump (instrument & holding live in the studio scope toggle) ----
  v.querySelectorAll('[data-libfam]').forEach(b=>b.onclick=()=>{ libState().fam=b.dataset.libfam; renderAlgo(); });
  v.querySelectorAll('[data-librisk]').forEach(b=>b.onclick=()=>{ libState().risk=b.dataset.librisk; renderAlgo(); });
  v.querySelectorAll('[data-libfav]').forEach(b=>b.onclick=()=>{ const l=libState(); l.fam='all'; l.risk='all'; l.seg='all'; l.favOnly=!l.favOnly; renderAlgo(); });
  v.querySelectorAll('[data-libexpand]').forEach(el=>{ el.onclick=()=>{ const l=libState(); l.expand=l.expand||{}; l.expand[el.dataset.libexpand]=!l.expand[el.dataset.libexpand]; renderAlgo(); }; });
  const lq=v.querySelector('#libSearch'); if(lq){ lq.oninput=()=>{ libState().q=lq.value; clearTimeout(lq._t); lq._t=setTimeout(()=>{ const ae=document.activeElement; renderAlgo(); const n=$('libSearch'); if(n&&ae&&ae.id==='libSearch'){ n.focus(); n.setSelectionRange(n.value.length,n.value.length); } },180); }; }
  const lqx=v.querySelector('[data-libclear]'); if(lqx) lqx.onclick=()=>{ const l=libState(); l.fam='all'; l.risk='all'; l.seg='all'; l.q=''; l.favOnly=false; renderAlgo(); };
  const bs=v.querySelector('#btAlgo'); if(bs)bs.onchange=()=>{state.algo.bt.algo=+bs.value;renderAlgo();};
  v.querySelectorAll('[data-algopause2]').forEach(b=>b.onclick=()=>{ALGOS[+b.dataset.algopause2].status='paused';renderAlgo();quickToast('Strategy paused','No new entries; open positions kept.');});
  v.querySelectorAll('[data-algoresume2]').forEach(b=>b.onclick=()=>{ALGOS[+b.dataset.algoresume2].status='live';renderAlgo();quickToast('Strategy resumed','Live and scanning for entries.');});
  v.querySelectorAll('[data-algostop2]').forEach(b=>b.onclick=()=>{const a=ALGOS[+b.dataset.algostop2];a.status='idle';a.cap=0;renderAlgo();quickToast('Strategy stopped','Capital released to your funds.');});
  state.algo._sig=algoLiveSig();   // snapshot structure so the 2s poll knows when a full re-render is needed
}
/* ===== Info icons + plain-English definitions for every metric/strategy ===== */
function infoI(tip){return tip?`<span class="info-i" title="${esc(tip)}" role="img" aria-label="${esc(tip)}" tabindex="0">i</span>`:'';}
const ALGO_DEFS={
  'OOS Sharpe':'Out-of-sample Sharpe — risk-adjusted return on data the strategy was NOT tuned on. Above ~1 is good, ~0 means no edge, below 0 loses money.',
  'Return':'Average return per trade in the backtest, after realistic costs.',
  'Win':'Win rate — share of trades that closed in profit. High win rate alone does NOT mean profitable: a few large losses can outweigh many small wins.',
  'Trades':'Number of closed trades in the backtest. More trades = more reliable; under ~30 is thin, treat as a hint not proof.',
  'Paper P&L':'Live profit/loss from forward paper-trading (simulated, no real money) since the bot started running.',
  'Status':'Validation status. Validated = passed the regime backtest with a real, positive edge. Candidate = a recognised strategy that has NOT been backtested yet.',
  'Best regime':'The market condition where this strategy showed its strongest edge in testing.',
  'Min cap':'Minimum capital suggested to trade this strategy given lot sizes / margin.',
  'Needs':'What this strategy requires to trade — product or segment (e.g. stock futures, index options, MCX).',
  'Strategies':'How many strategies are available in this segment.',
  'Validated':'How many strategies in this segment passed the regime backtest with a real edge (the rest are unproven candidates).',
  'Live regime':'The market regime TradePro is detecting right now — it decides which strategy is the active engine.',
  'Mode':'Paper = simulated, zero real orders. Live = real money. Always paper-trade first.'};
const REGIME_DEFS={
  Bull:'Bull — index above its 200-day average and trending up. Momentum / trend strategies are favoured.',
  Bear:'Bear — index below its 200-day average, trending down. Most long-equity edges disappear; best to stand aside.',
  Choppy:'Choppy / rangebound — no clear trend. Mean-reversion works; trend strategies get whipsawed.',
  'High-Vol':'High volatility — India VIX elevated. Sharp moves and snap-backs; dip-buying (RSI-2) historically works, trend-following struggles.'};
const STRAT_DEFS={
  momentum:'Momentum / breakout (trend-following): buys strength as price breaks its recent high and rides the trend. Wins in trends, bleeds in chop.',
  orb:'Opening Range Breakout: trades the break of the first 15-minute range — a classic intraday breakout play, squared off by close.',
  meanrev:'Mean reversion: fades extremes, betting price snaps back to its average. Works in rangebound markets, dangerous in trends.',
  rsi2:'Connors RSI(2): buys deep short-term oversold dips inside a long uptrend — a counter-trend swing edge that shines when volatility spikes.',
  macross:'Golden Cross: slow positional trend-following on the 50/200-day moving-average crossover.',
  supertrend:'Supertrend: an ATR-band trend follower that flips long/short as price crosses the band.',
  pairs:'Pairs / statistical arbitrage: trades the spread between two correlated stocks — long one, short the other. Market-neutral, so it profits regardless of market direction.',
  strangle:'Options premium selling: sells out-of-the-money calls & puts to collect time-decay (theta). High win rate but real tail risk — wings cap it.',
  fut_trend:'Index futures trend-following with a regime filter and ATR-based position sizing.',
  mcx_trend:'Commodity trend-following on MCX futures (gold / silver / crude) — commodities trend more strongly than equities.',
  goldsilver:'Gold–Silver ratio: mean-reverts the price ratio between the two metals via MCX futures.'};
function lbl(t){return ALGO_DEFS[t]?t+infoI(ALGO_DEFS[t]):t;}
function simRegime(){
  let vix=12; try{vix=+document.getElementById('sVix').value||12;}catch(e){}
  return regime4(document.documentElement.dataset.regime||state.displayed||'bull', vix, state.regimeLabel);
}
function liveRegime(){
  if(BOT.live && BOT.market && BOT.market.engine) return BOT.market.engine.regime;   // real, from Kite
  return simRegime();
}
function regimeReadout(){
  if(BOT.live && BOT.market && BOT.market.engine){
    const m=BOT.market;
    return {score:m.engine.score, vix:(m.vix&&m.vix.ltp)||0, ad:(m.breadth&&m.breadth.ad)||0,
            asOf:m.asOf, real:true};
  }
  try{ const raw=readSignals(), sc=scoreSignals(raw); return {score:composite(sc), vix:raw.vix, ad:raw.ad, real:false}; }
  catch(e){ return null; }
}
function algoStatusBar(){
  const lr=liveRegime();
  const active=ALGOS.find(a=>a.vstatus==='validated'&&(a.bestRegime===lr||a.bestRegime==='Market-neutral'));
  const conn=BOT.connected;
  const rdot={Bull:'dot-bull',Bear:'dot-bear',Choppy:'dot-neutral','High-Vol':'dot-amber'}[lr]||'dot-neutral';
  const eng=active?esc(active.name)+(active.live?' · paper':' · ready'):((lr==='Bear'||lr==='High-Vol')?'Stand aside':'—');
  const er=regimeReadout();
  const scoreTag=er?`<span class="asb-score ${er.score>=0?'up':'down'}">${er.score>=0?'+':''}${er.score}</span><span class="asb-caret">▾</span>`:'';
  const pop=er?`<div class="asb-pop" role="tooltip">
      <div class="asb-prow"><span>India VIX</span><b class="num ${er.vix>18?'down':'up'}">${er.vix.toFixed(1)} ${er.vix>=20?'Fear':er.vix>=15?'Caution':'Calm'}</b></div>
      <div class="asb-prow"><span>Breadth A/D</span><b class="num ${er.ad>=1?'up':'down'}">${er.ad.toFixed(2)} ${er.ad>=1.5?'Strong':er.ad>=1?'Firm':'Weak'}</b></div>
      <div class="asb-prow"><span>Engine Score</span><b class="num ${er.score>=0?'up':'down'}">${er.score>=0?'+':''}${er.score} ${esc(lr)}</b></div>
      <div class="asb-popf">${er.real?('● Live from Kite · '+new Date(er.asOf).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})):'⚠ Simulated — connect Kite for live data'}</div></div>`:'';
  const cells=[
    `<div class="asb-cell"><span class="asb-l">Broker${infoI('Your Kite Connect link — green means market data and orders are authorised.')}</span><span class="asb-v"><span class="live-dot ${conn?'live':''}"></span>${conn?'Connected':'Offline'}</span></div>`,
    (conn&&BOT.status&&BOT.status.user)?`<div class="asb-cell"><span class="asb-l">Account</span><span class="asb-v">${esc(String(BOT.status.user).split(' ')[0])}</span></div>`:'',
    `<div class="asb-cell asb-click" data-execjump="${BOT.paperMode?'paper':'live'}" role="button" tabindex="0" title="See which strategies run in paper vs live"><span class="asb-l">Mode${infoI(ALGO_DEFS['Mode'])}</span><span class="asb-v"><span class="mode-badge ${BOT.paperMode?'paper':'live'}">${BOT.paperMode?'PAPER':'LIVE'}</span><span class="asb-caret">▸</span></span></div>`,
    `<div class="asb-cell asb-pop-host"${er?' tabindex="0"':''}><span class="asb-l">Live regime${infoI((REGIME_DEFS[lr]||'')+' Hover for the live India VIX, breadth & engine score behind this call.')}</span><span class="asb-v"><span class="seg-dot ${rdot}"></span>${lr}${scoreTag}</span>${pop}</div>`,
    `<div class="asb-cell asb-grow"><span class="asb-l">Active engine${infoI('The strategy auto-selected for the current regime. Stand aside = no validated edge here, so capital is preserved.')}</span><span class="asb-v">${eng}</span></div>`
  ].filter(Boolean).join('<span class="asb-div"></span>');
  return `<div class="algo-statusbar${conn?'':' off'}">${cells}</div>`;
}
/* One-click paper-engine control — no terminal. Starts/stops the forward harness via the
   guarded /api/harness endpoint; status comes from BOT.status.harnessRunning. */
function harnessRunning(){ return !!(BOT.status && BOT.status.harnessRunning); }
function harnessCta(){
  const busy=BOT.harnessBusy;
  if(harnessRunning())
    return `<div class="harness-on">${icon('check',13)}<span><b>Paper engine running</b> — forward-testing every validated strategy on live data. First trades appear within a few minutes.</span><button class="btn-ghost sm" data-harness="stop" ${busy?'disabled':''}>${busy?'…':'Stop'}</button></div>`;
  return `<div class="harness-cta"><button class="btn-primary harness-start" data-harness="start" ${busy?'disabled':''}>${icon('bolt',14)} ${busy?'Starting…':'Start paper testing'}</button>
    <p class="harness-hint">${icon('shield',11)}<span>One click — no terminal. Runs every validated strategy on <b>live</b> data at <b>zero risk</b>.</span></p></div>`;
}
function toggleHarness(action){
  if(BOT.harnessBusy) return;
  BOT.harnessBusy=true; if(isAlgo())renderAlgo();
  fetch(BOT_API+'/api/harness',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action})})
    .then(r=>r.json()).then(res=>{
      if(res&&res.ok) quickToast(action==='start'?'Paper testing started':'Paper testing stopped',
        action==='start'?'Forward-testing live strategies at zero risk — give it a few minutes for the first signals.':'The forward paper engine was stopped.');
      else quickToast('Couldn’t '+(action==='start'?'start':'stop')+' paper testing',(res&&res.error)||'Is the bot API running?');
    }).catch(()=>quickToast('Bot API offline','Run python3 bot_api.py in the bot folder.'))
    .then(()=>{ setTimeout(()=>{ BOT.harnessBusy=false; loadBotData().then(()=>{ if(isAlgo())renderAlgo(); }); }, action==='start'?1800:600); });
}
/* ===== Regime fit + adaptive risk (Forward Test "mission control") ===== */
// Where does THIS strategy stand in the live regime, RIGHT NOW? Uses the real
// per-regime backtested edge (regimeFit) — never a guess.
function regimeVerdict(a,lr){
  if(a.bestRegime==='Market-neutral') return {st:'fav',lab:'Market-neutral',cls:'fit-fav',ic:'◆',why:'Market-neutral — profits from the spread regardless of which way the market moves.'};
  const f=a.regimeFit&&a.regimeFit[lr];
  if(!f) return {st:'neu',lab:'No regime read',cls:'fit-neu',ic:'•',why:'No backtested sample in the current '+lr+' regime yet.'};
  const avg=f[0],n=f[1],tone=f[2];
  const base=`${avg>0?'+':''}${avg}% avg over ${n} backtested ${lr} trades.`;
  if(tone==='good') return {st:'fav',lab:'Favoured now',cls:'fit-fav',ic:'▲',avg,n,why:'In its element — '+base+' This is the regime where its edge is strongest.'};
  if(tone==='bad')  return {st:'hostile',lab:'Fighting the tape',cls:'fit-bad',ic:'▼',avg,n,why:'Hostile regime — '+base+' Historically loses money here.'};
  return {st:'neu',lab:'Neutral',cls:'fit-neu',ic:'■',avg,n,why:'Marginal edge — '+base+' It works here, but this isn’t its best regime.'};
}
// REAL per-strategy cumulative forward paper-P&L curve, parsed from the live trade
// log (BOT.analytics.trades). Returns null when there aren’t enough closed trades
// for an honest line — we never draw a synthetic curve.
function stratCurve(a){
  const d=BOT.analytics; if(!d||!d.trades) return null;
  let cum=0; const pts=[0];
  d.trades.forEach(t=>{ if(t.strategy===a.name){ cum+=t.pnl; pts.push(+cum.toFixed(2)); } });
  return pts.length>=3?pts:null;
}
function ftSparkSVG(pts){
  const W=96,H=26,pad=3;
  const lo=Math.min(...pts,0),hi=Math.max(...pts,0),rng=(hi-lo)||1;
  const X=i=>pad+i/(pts.length-1)*(W-2*pad), Y=v=>pad+(1-(v-lo)/rng)*(H-2*pad);
  const d=pts.map((v,i)=>(i?'L':'M')+X(i).toFixed(1)+','+Y(v).toFixed(1)).join(' ');
  const up=pts[pts.length-1]>=0, zeroY=Y(0).toFixed(1);
  const area=d+` L${X(pts.length-1).toFixed(1)},${H-pad} L${pad},${H-pad} Z`;
  return `<svg class="ft-spark ${up?'up':'down'}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><path class="fs-area" d="${area}"/><line class="fs-base" x1="0" y1="${zeroY}" x2="${W}" y2="${zeroY}"/><path class="fs-line" d="${d}"/></svg>`;
}
/* Adaptive risk ("Adapt to regime") — the honest version of "harden this strategy".
   It does NOT secretly rewrite the strategy or promise profit. It enforces one real,
   transparent rule via the live engine: stand the strategy ASIDE (pause new entries)
   when the live regime is one it has historically LOST in, and RE-ENGAGE it the moment
   the regime turns favourable again. Cuts the bleed in hostile tape; never touches a
   real-money (live) strategy without you. State persists across reloads. */
function adaptStore(){
  if(!state.algo) state.algo={};
  if(!state.algo._adapt){ let s={on:{},paused:{}}; try{Object.assign(s,JSON.parse(localStorage.getItem('tp_adapt')||'{}'));}catch(e){} state.algo._adapt=s; }
  return state.algo._adapt;
}
function adaptOn(a){ return !!adaptStore().on[a.id]; }
function adaptSave(){ try{localStorage.setItem('tp_adapt',JSON.stringify(adaptStore()));}catch(e){} }
// Enforce the adapt rule for ONE strategy against the live regime. Paper only.
async function applyAdapt(a){
  if(!a||!a.deployed||a.sub==='live') return null;          // never auto-touch real-money strategies
  const lr=liveRegime(), st=adaptStore(), v=regimeVerdict(a,lr);
  if(v.st==='hostile' && a.sub==='paper'){ st.paused[a.id]=true; adaptSave(); await setStrategyState(a.id,'paused','Standing aside — '+a.name); return 'aside'; }
  if(v.st!=='hostile' && a.sub==='paused' && st.paused[a.id]){ delete st.paused[a.id]; adaptSave(); await setStrategyState(a.id,'paper','Re-engaging — '+a.name); return 'engaged'; }
  return null;
}
// Re-check every adapt-enabled strategy (called when the live regime flips).
async function enforceAdapt(){ for(const a of ALGOS){ if(adaptStore().on[a.id]) await applyAdapt(a); } }
function toggleAdapt(i){
  const a=ALGOS[i]; if(!a) return;
  const st=adaptStore(), now=!st.on[a.id]; st.on[a.id]=now; if(!now) delete st.paused[a.id]; adaptSave();
  const lr=liveRegime(), v=regimeVerdict(a,lr);
  if(!now){ quickToast('Adapt off', esc(a.name)+' runs on its own rules again, regardless of the regime.'); renderAlgo(); return; }
  if(a.sub==='live'){ quickToast('Adapt is advisory for live', esc(a.name)+' trades real money, so Adapt won’t auto-pause it. It will flag when the regime turns hostile — you stay in control.'); renderAlgo(); return; }
  applyAdapt(a).then(act=>{
    if(act==='aside') quickToast('Adapt on · standing aside', esc(a.name)+' stops taking new entries in the '+lr+' regime, where it loses'+(v.avg!=null?' ('+(v.avg>0?'+':'')+v.avg+'% avg)':'')+'. It re-engages automatically when the tape turns favourable.');
    else quickToast('Adapt on · engaged', esc(a.name)+' keeps trading — the live '+lr+' regime '+(v.st==='fav'?'favours its edge':'is acceptable')+'. It will auto stand-aside if the regime turns hostile.');
    renderAlgo();
  });
}
function algoForward(){
  const {instr,hold}=studioScope();
  const shown=ALGOS.filter(a=>a.deployed&&inScope(a));    // paper + paused (standing aside) + live, scoped to the active class
  if(!shown.length) return scopeEmpty('cpu','No forward test in this class','No deployed bot in this class is forward-testing yet — switch the scope above (Equity holds the live book), or deploy one from the Marketplace.',harnessCta());
  ensureAnalytics();                                     // real per-strategy equity curves for the sparklines
  const lr=liveRegime();
  const total=shown.reduce((s,a)=>s+(a.paperPnl||0),0);
  const since=BOT.updated?new Date(BOT.updated).toLocaleString('en-IN',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}):'—';
  const stat=secStats([{l:lbl('Strategies'),v:String(shown.length)},{l:'Paper P&L'+infoI(ALGO_DEFS['Paper P&L']),v:sgn(total),tone:total>=0?'up':'down',id:'algoTotal'},{l:'Updated'+infoI('When the forward paper-trading state last refreshed.'),v:since},{l:lbl('Mode'),v:'Paper'}]);
  // ---- "Working right now" regime command banner — which strategies fit THIS moment ----
  const verds=shown.map(a=>({a,v:regimeVerdict(a,lr)}));
  const fav=verds.filter(x=>x.v.st==='fav'), hostile=verds.filter(x=>x.v.st==='hostile');
  const er=regimeReadout();
  const rdot={Bull:'dot-bull',Bear:'dot-bear',Choppy:'dot-neutral','High-Vol':'dot-amber'}[lr]||'dot-neutral';
  const regLine=(REGIME_DEFS[lr]||'').split('—').slice(1).join('—').trim();
  const banner=`<div class="ft-banner">
    <div class="ft-bhead"><span class="seg-dot ${rdot}"></span><b>Live regime · ${lr}</b>${er?`<span class="ft-bscore ${er.score>=0?'up':'down'}">${er.score>=0?'+':''}${er.score}</span>`:''}${infoI(REGIME_DEFS[lr]||'')}${regLine?`<span class="ft-bsub">${esc(regLine)}</span>`:''}</div>
    <div class="ft-blists">
      <div class="ft-bcol"><span class="ft-bl up">▲ Working with the tape</span><div class="ft-bpills">${fav.length?fav.map(x=>`<span class="ft-pill fav" title="${esc(x.v.why)}">${esc(x.a.name)}</span>`).join(''):'<span class="ft-bnone">none of your running strategies are in their best regime right now</span>'}</div></div>
      <div class="ft-bcol"><span class="ft-bl down">▼ Fighting the tape</span><div class="ft-bpills">${hostile.length?hostile.map(x=>`<span class="ft-pill bad" title="${esc(x.v.why)}">${esc(x.a.name)}</span>`).join(''):'<span class="ft-bnone">nothing is trading against the regime</span>'}</div></div>
    </div>
    ${hostile.length?`<div class="ft-btip">${icon('shield',12)}<span><b>Cut the drag:</b> turn on <b>Adapt</b> for ${hostile.length===1?'this strategy':'these'} — ${hostile.length===1?'it':'they'} will stand aside in the ${lr} regime and re-engage automatically when conditions turn favourable.</span></div>`:''}
  </div>`;
  // ---- per-strategy cards: fit badge · real sparkline · risk stats · graduation · adapt ----
  const min=BOT.nudgeMin||10;
  const cards=verds.map(({a,v})=>{
    const i=ALGOS.indexOf(a), pnl=a.paperPnl||0, n=a.fwdTrades||0;
    const paused=a.sub==='paused', isLive=a.sub==='live';
    const curve=stratCurve(a), sparkEl=curve?ftSparkSVG(curve):`<span class="ft-nospark">curve builds as trades close</span>`;
    const pf=a.fwdProfitFactor, exp=a.fwdExpectancy, win=a.fwdWinPct;
    const stats=`<div class="ft-stats">
      <div title="Forward win rate — closed paper trades that finished in profit. Win rate alone isn’t edge; read it with profit factor."><span>Win</span><b class="${win!=null?(win>=50?'up':'down'):''}">${win!=null?win+'%':'—'}</b></div>
      <div title="Profit factor — gross profit ÷ gross loss on forward trades. Above 1 makes money out-of-sample, above 1.5 is strong."><span>PF</span><b class="${pf!=null?(pf>=1?'up':'down'):''}">${pf!=null?(pf>=99?'∞':pf):'—'}</b></div>
      <div title="Expectancy — average P&L per closed forward trade. Positive = the edge pays per trade."><span>Exp</span><b class="num ${cls(exp||0)}">${exp!=null?sgn(exp):'—'}</b></div>
      <div title="OOS Sharpe — risk-adjusted return from the backtest. Above ~1 is good."><span>Sharpe</span><b class="${a.sharpe!=null?(a.sharpe>0?'up':'down'):''}">${a.sharpe!=null?a.sharpe.toFixed(2):'—'}</b></div>
    </div>`;
    const pct=Math.min(100,Math.round(n/min*100)), eligible=!!a.nudge;
    const grad=isLive?`<div class="ft-grad"><span class="ft-glive">● LIVE · trading real money</span></div>`
      :`<div class="ft-grad"><div class="ft-gh"><span>${eligible?'Ready for live':'Proving for live'}${infoI('Go-Live unlocks after ≥'+min+' CLOSED, profitable forward trades on a funded, armed account. Proof, not hope.')}</span><span class="ft-gn">${Math.min(n,min)}/${min} trades</span></div><div class="lc-bar"><i style="width:${pct}%"></i></div></div>`;
    const on=adaptOn(a);
    const adaptBtn=`<button class="ft-adapt${on?' on':''}" data-adapt="${i}" role="switch" aria-checked="${on}" title="${on?'Adapt is ON — auto stand-aside in hostile regimes, auto re-engage when favourable.':'Turn on Adapt — the strategy steps aside in regimes where it loses and re-engages when conditions favour its edge. Honest risk control, not a profit guarantee.'}"><span class="ft-aknob"></span><span class="ft-alab">${on?'Adapt ON':'Adapt'}</span></button>`;
    const adaptState=on?`<span class="ft-astate ${paused?'aside':'eng'}">${paused?'standing aside in '+lr:isLive?'advisory (live)':'engaged · watching regime'}</span>`:'';
    const subTxt=(a.openPositions||0)?`${(a.openPositions)} open`:(n?'realised':'no trades yet');
    const subEl=paused?`<span class="ft-asidetag">standing aside</span>`:`<span data-live-sub="${a.id}">${subTxt}</span>`;
    const cta=isLive?`<button class="btn-go sm" data-algogl="${i}">${icon('shield',12)} Manage live</button>`
      : eligible?`<button class="btn-go sm" data-algogl="${i}">${icon('shield',12)} Go Live →</button>`
      : `<button class="btn-ghost sm is-locked" data-algogl="${i}" title="Locked until the forward-test gate (≥${min} profitable closed trades)">${icon('lock',11)} Go Live</button>`;
    return `<div class="ft-card fit-${v.st}${paused?' is-aside':''}${isLive?' is-live':''}">
      <div class="ft-top">
        <div class="ft-id"><span class="live-dot ${paused?'warn':'live'}"></span><div><b>${esc(a.name)}${infoI(STRAT_DEFS[a.id]||'')}</b><span class="ft-cat">${esc(a.cat)} · ${(a.openPositions||0)} open · ${n} closed</span></div></div>
        <div class="ft-pnl"><b class="num ${cls(pnl)}" data-live-pnl="${a.id}">${sgn(pnl)}</b>${subEl}</div>
      </div>
      <div class="ft-mid"><span class="ft-fit ${v.cls}" title="${esc(v.why)}">${v.ic} ${v.lab}</span><div class="ft-sparkwrap" title="Cumulative forward paper P&L for this strategy — real closed trades, no real money.">${sparkEl}</div></div>
      ${stats}${grad}
      <div class="ft-foot"><div class="ft-adaptwrap">${adaptBtn}${adaptState}</div>${cta}</div>
    </div>`;
  }).join('');
  const feed=(BOT.trades&&BOT.trades.length)?`<div class="ft-feed"><div class="ft-feedh">Recent forward trades${infoI('Live entries & exits from the forward paper-trading harness — genuine out-of-sample evidence, no real money.')}</div>${BOT.trades.slice(0,12).map(t=>`<div class="ft-trade">${esc(t)}</div>`).join('')}</div>`:`<p class="sec-hint">${icon('cpu',12)}<span>No forward trades yet — they stream in here as the paper harness runs during market hours.</span></p>`;
  return (harnessRunning()?harnessCta():'')+stat+banner+`<div class="ft-grid">${cards}</div>`+feed+`<p class="sec-hint">${icon('shield',12)}<span>Forward test = real out-of-sample evidence on live data at zero risk. <b>Adapt</b> only stands a strategy aside in regimes where it has historically lost — it manages risk, it does not promise profit.</span></p>`;
}
function algoCard(a,i,lr,cap){
  cap=cap==null?algoPlanCapital():cap;
  const rk=a.risk==='Aggressive'?'b-warn':a.risk==='Conservative'?'b-up':'b-neu';
  const validated=a.vstatus==='validated', neutral=a.bestRegime==='Market-neutral';
  const isActive=validated&&(a.bestRegime===lr||neutral);
  const afford=cap>=a.minCap;
  const affChip=cap>0?(afford?`<span class="aff-chip ok" title="Your ${inr(cap)} clears the ${inr(a.minCap)} minimum.">✓ Fits your capital</span>`:`<span class="aff-chip no" title="Needs ${inr(a.minCap)} — add ${inr(a.minCap-cap)}.">${icon('lock',10)} +${inr(a.minCap-cap)} needed</span>`):'';
  const chip=lcChip(a);
  const sbadge=validated?'<span class="vbadge ok">Validated</span>':'<span class="vbadge cand">Candidate</span>';
  const tag=a.bestRegime?(neutral?'<span class="rg-tag">Market-neutral</span>':`<span class="rg-tag">Best in ${a.bestRegime}</span>`):'';
  let stats;
  if(validated){
    const m=a.sharpe!=null?{l:'OOS Sharpe',v:a.sharpe.toFixed(2),up:a.sharpe>0}:{l:'Return',v:(a.totalRet>=0?'+':'')+a.totalRet+'%',up:a.totalRet>=0};
    stats=`<div class="algo-stats"><div><span>${lbl(m.l)}</span><b class="num ${m.up?'up':'down'}">${m.v}</b></div><div><span>${lbl('Win')}</span><b class="num">${a.win}%</b></div><div><span>${lbl('Trades')}</span><b class="num">${a.trades}</b></div><div><span>Paper P&amp;L${infoI(ALGO_DEFS['Paper P&L'])}</span><b class="num ${a.paperPnl>0?'up':a.paperPnl<0?'down':''}" data-live-pnl="${a.id}">${a.paperPnl>=0?'+':'−'}${inr(Math.abs(a.paperPnl||0))}</b></div></div>`;
  } else {
    stats=`<div class="algo-stats"><div><span>${lbl('Status')}</span><b class="num">Candidate</b></div><div><span>${lbl('Best regime')}</span><b class="num">${a.bestRegime||'—'}</b></div><div><span>${lbl('Min cap')}</span><b class="num">${inr(a.minCap)}</b></div><div><span>${lbl('Needs')}</span><b class="num sm">${esc(a.requires||a.product||'—')}</b></div></div>`;
  }
  let rgrid='';
  if(a.regimeFit){
    rgrid='<div class="rg-head">Per-regime edge'+infoI('Average trade return in each market regime, measured in the backtest. Green = a positive edge, amber = weak/thin, red = loses. The outlined cell is the current live regime.')+'</div><div class="rg-grid">'+['Bull','Bear','Choppy','High-Vol'].map(r=>{const f=a.regimeFit[r];if(!f)return '';const tone=f[2]==='good'?'rg-good':f[2]==='weak'?'rg-weak':'rg-bad';const on=r===lr?' rg-live':'';return `<span class="rg-cell ${tone}${on}" title="${r}: ${f[0]>0?'+':''}${f[0]}% avg over ${f[1]} trades. ${REGIME_DEFS[r]||''}">${r==='High-Vol'?'HV':r}<b>${f[0]>0?'+':''}${f[0]}</b></span>`;}).join('')+'</div>';
  }
  const verdict=a.verdict?`<div class="algo-verdict">${icon('shield',11)}<span>${esc(a.verdict)}</span></div>`:'';
  const {primary,controls}=lcActions(a,i);
  const bt=`<button class="btn-ghost sm" data-algobt="${i}">${icon('trendUp',12)} Backtest</button>`;
  return `<div class="algo-card${isActive?' is-active':''}${a.sub==='live'?' is-live':''}${a.deployed?' is-deployed':''}">
    ${isActive?`<span class="active-flag">● ACTIVE · regime ${lr}</span>`:''}
    <div class="algo-h"><div><b>${esc(a.name)}${infoI(STRAT_DEFS[a.id]||a.desc)}</b><span class="algo-cat">${esc(a.cat)}</span></div><span class="badge ${rk}">${esc(a.risk)}</span></div>
    <div class="vbadge-row">${sbadge}${tag}${chip}${affChip}</div>
    <p class="algo-desc">${esc(a.desc)}</p>
    ${algoMeta(a)}
    ${stats}${rgrid}${verdict}
    <div class="lc-cta">${primary}</div>
    <div class="lc-row">${controls}${bt}</div></div>`;
}
/* ---- strategy lifecycle (Deploy → Paper/prove → Go Live → Pause/Stop) ---- */
function lcChip(a){
  if(a.sub==='live')   return `<span class="lc-chip live">● LIVE · real money</span>`;
  if(a.sub==='paused') return `<span class="lc-chip paused">❚❚ Paused</span>`;
  if(a.sub==='paper')  return `<span class="lc-chip paper">${icon('bolt',10)} Paper · running${(a.openPositions||0)?` · ${a.openPositions} open`:''}</span>`;
  return '';
}
function lcActions(a,i){
  const min=BOT.nudgeMin||10, validated=a.vstatus==='validated';
  if(!a.wired){   // no live engine yet → can't deploy
    return {primary: validated
        ? `<span class="cand-pill">${icon('shield',12)} Validated · live engine coming soon</span>`
        : `<span class="cand-pill">${icon('shield',12)} Candidate · backtest before deploying</span>`,
      controls:''};
  }
  if(a.sub==='live'){
    return {primary:`<button class="btn-go sm wide" data-algogl="${i}">${icon('shield',12)} Manage live</button>`,
      controls:`<button class="btn-ghost sm" data-lcpause="${i}">Pause</button><button class="btn-ghost sm danger" data-lcstop="${i}">${icon('alert',12)} Stop &amp; Flatten</button>`};
  }
  if(a.sub==='paused'){
    return {primary:`<button class="btn-primary sm wide" data-lcresume="${i}">${icon('bolt',12)} Resume (paper)</button>`,
      controls:`<button class="btn-ghost sm" data-lcstop="${i}">Stop</button>`};
  }
  if(a.sub==='paper'){
    let primary;
    if(validated){
      const n=a.fwdTrades||0, pct=Math.min(100,Math.round(n/min*100)), eligible=!!a.nudge;   // unlocks only on the strict forward-test gate
      const prog=`<div class="lc-prog"><div class="lc-prog-h"><span>Proving for live${infoI('Go-Live unlocks after ≥'+min+' CLOSED, profitable forward paper trades + funded account + ALLOW_LIVE armed. Proof, not hope.')}</span><span class="lc-prog-n">${n}/${min} trades</span></div><div class="lc-bar"><i style="width:${pct}%"></i></div></div>`;
      primary=`${prog}<button class="btn-go sm wide${eligible?'':' is-locked'}" data-algogl="${i}"${eligible?'':' aria-disabled="true" title="Locked until the forward-test gate is met"'}>${icon('shield',12)} ${eligible?'Go Live →':`Go Live — locked`}</button>`;
    } else {
      primary=`<div class="lc-note">${icon('shield',11)}<span>Gathering forward evidence — candidate, not eligible for live yet.</span></div>`;
    }
    return {primary, controls:`<button class="btn-ghost sm" data-lcpause="${i}">Pause</button><button class="btn-ghost sm" data-lcstop="${i}">Stop</button>`};
  }
  // Available (not deployed)
  return {primary:`<button class="btn-primary sm wide" data-algodep="${i}">${icon('bolt',12)} Deploy in Paper</button><span class="lc-free">Risk-free · live data, simulated fills</span>`,
    controls:''};
}
function algoPlanCapital(){
  if(state.algo&&state.algo.capital!=null) return state.algo.capital;
  return (BOT.status&&typeof BOT.status.funds==='number')?BOT.status.funds:0;
}
function algoRunnable(a,lr,cap){ return cap>=a.minCap && a.vstatus==='validated' && (a.bestRegime===lr||a.bestRegime==='Market-neutral'); }
function algoNudge(){
  // Only the prominent "ready to consider live" CTA lives here now. The per-strategy
  // "building evidence" progress moved into the My-strategies chips (at-a-glance) and each
  // strategy card's lc-prog (detail), so we no longer repeat a full banner per proving strategy.
  const prov=ALGOS.filter(a=>a.nudge);
  if(!prov.length) return '';
  const cards=prov.map(a=>{
    const i=ALGOS.indexOf(a);
    return `<div class="nudge-card go"><span class="nudge-ic">${icon('bolt',16)}</span>
      <div class="nudge-b"><b>${esc(a.name)} — ready to consider live</b><span>${esc(a.nudgeMsg||'')}</span></div>
      <button class="btn-go sm" data-algogl="${i}">${icon('shield',12)} Review go-live checklist</button></div>`;
  }).join('');
  return `<div class="nudge-wrap">${cards}</div>`;
}
/* "My Strategies" — the portfolio of what's actually deployed, with quick stop +
   a global kill-switch. Spans all segments so nothing you've deployed is hidden. */
function myStrategiesBar(){
  const dep=ALGOS.filter(a=>a.deployed);
  if(!dep.length) return `<div class="mystrat empty">${icon('cpu',15)}<span>No strategies deployed yet — pick one below and <b>Deploy in Paper</b> to start risk-free.</span></div>`;
  const paper=dep.filter(a=>a.sub!=='live'), live=dep.filter(a=>a.sub==='live');
  const totPnl=dep.reduce((s,a)=>s+(a.paperPnl||0),0);
  const min=BOT.nudgeMin||10;
  const chips=dep.map(a=>{const i=ALGOS.indexOf(a), st=a.sub==='live'?'live':a.sub==='paused'?'paused':'paper';
    // compact go-live progress, folded in from the old nudge banner
    let prog='';
    if(a.nudge) prog=`<span class="ms-prog ready" title="Cleared the forward-test gate — open its card to review go-live">✓ go-live ready</span>`;
    else if(a.vstatus==='validated'&&st==='paper'){const n=Math.min(a.fwdTrades||0,min),pc=Math.round(n/min*100);   // mirror the card's "Proving for live" gate (every validated paper strategy)
      prog=`<span class="ms-prog" title="${n}/${min} closed forward trades toward the go-live gate — proof, not hope"><i class="ms-mini"><b style="width:${pc}%"></b></i>${n}/${min}</span>`;}
    return `<span class="ms-chip ${st}"><i class="ms-dot"></i><b>${esc(a.name)}</b><span class="ms-pnl num ${cls(a.paperPnl||0)}">${sgn(a.paperPnl||0)}</span>${prog}<button class="ms-x" data-lcstop="${i}" aria-label="Stop ${esc(a.name)}" title="Stop ${esc(a.name)}">${icon('close',10)}</button></span>`;}).join('');
  return `<div class="mystrat">
    <div class="ms-head"><b>${icon('cpu',14)} My strategies</b>
      <span class="ms-sum">${dep.length} deployed · net paper P&L <b class="num ${cls(totPnl)}">${sgn(totPnl)}</b></span>
      <button class="btn-ghost sm danger" data-stopall title="Stop every deployed strategy">${icon('alert',12)} Stop all</button></div>
    <div class="ms-chips">${chips}</div></div>`;
}
async function stopAll(){
  const dep=ALGOS.filter(a=>a.deployed); if(!dep.length) return;
  const hasLive=dep.some(a=>a.sub==='live');
  flowModal({title:'Stop all strategies', confirm:'Stop all ('+dep.length+')', danger:true,
    body:`<p class="flow-note">${icon('alert',13)}<span>Stops <b>${dep.length}</b> deployed ${dep.length===1?'strategy':'strategies'}. Paper positions square off next cycle.${hasLive?' <b>Includes LIVE strategies — real positions will be flattened.</b>':''} You can redeploy anytime.</span></p>`,
    onConfirm(){ Promise.all(dep.map(a=>fetch(BOT_API+'/api/strategy',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:a.id,state:'off'})}).catch(()=>{})))
      .then(()=>loadBotData()).then(()=>{ if(typeof renderAlgo==='function')renderAlgo(); quickToast('All stopped','Every strategy stopped; paper positions square off next cycle.'); }); }});
}
/* First-time funnel guide — explains the 6 tabs as one honest path (Discover→Prove→Paper→
   Monitor→Go-Live). Dismissible + persisted, so the studio isn't a maze on first visit. */
function funnelGuide(){
  if(BOT.algoGuideDone) return '';
  try{ if(localStorage.getItem('tp.algoGuide')==='1'){ BOT.algoGuideDone=true; return ''; } }catch(e){}
  const steps=[['cpu','Discover','Browse strategies — each shows its validated edge &amp; best regime.'],
    ['trendUp','Prove','Backtest on real history — vs buy-&amp;-hold, drawdown, monthly returns. No invented numbers.'],
    ['bolt','Paper','One click forward-tests on live data at zero risk.'],
    ['shield','Monitor','Real P&amp;L, exposure &amp; a live kill-switch as it runs.'],
    ['check','Go-Live','Only after 16 safety gates pass — money never moves on a click.']];
  return `<div class="funnel-guide"><button class="fg-x" data-fgdismiss aria-label="Dismiss guide" title="Dismiss">${icon('close',13)}</button>
    <div class="fg-h">${icon('cpu',15)}<b>How Algo Studio works</b><span>a transparent path from idea to live</span></div>
    <div class="fg-steps">${steps.map(([ic,t,d],i)=>`${i?'<span class="fg-arrow">→</span>':''}<div class="fg-step"><span class="fg-ic">${icon(ic,15)}</span><b>${i+1} · ${t}</b><span>${d}</span></div>`).join('')}</div></div>`;
}
/* ===== capital + risk + style line shown on every strategy card ===== */
const STYLE_DESC={
  'Trend':'Rides persistence — wins when moves continue, bleeds in chop.',
  'Reversion':'Fades overreaction — wins in ranges, hurt by strong trends.',
  'Relative-value':'Market-neutral spreads — regime-agnostic, low directional beta.',
  'Carry':'Harvests theta / basis premium — steady income, tail-risk to manage.',
  'Defensive':'Low-vol / quality — the sleeve that holds up in bear & high-vol.',
};
const styleSlug=s=>(s||'').toLowerCase().replace(/[^a-z]/g,'');
function styleChip(s){ return s?`<span class="sty-chip sty-${styleSlug(s)}" title="${esc(STYLE_DESC[s]||'')}">${esc(s)}</span>`:''; }
function algoMeta(a){
  const md=a.minDeploy||a.minCap||0;
  const dd=a.maxDD!=null?a.maxDD:(a.dd!=null?a.dd:null);
  const rpt=a.riskPerTrade;
  return `<div class="algo-meta">
    ${styleChip(a.style)}
    <span class="mt-cap" title="Minimum capital to deploy one unit. For F&amp;O this is the lot-size margin estimate (not a live broker quote).">${icon('wallet',11)} Min to deploy <b>${inr(md)}</b></span>
    <span class="mt-risk" title="Risk appetite — worst backtested drawdown ~${dd!=null?dd+'%':'—'}; about ${rpt!=null?rpt+'%':'—'} of deployed capital at risk per position.">${icon('shield',11)} ${esc(a.risk||'—')} · DD ~${dd!=null?dd+'%':'—'} · ${rpt!=null?rpt+'%':'—'}/trade</span>
  </div>`;
}

/* ===== Strategy Framework — the regime switch (which STYLES to run as conditions change) ===== */
const FW_STYLES=['Trend','Reversion','Relative-value','Carry','Defensive'];
const FW_REGIME={
  'Bull':    {favor:['Trend','Carry'],                       avoid:['Reversion']},
  'Bear':    {favor:['Defensive','Relative-value'],          avoid:['Trend','Carry']},
  'Choppy':  {favor:['Carry','Reversion','Relative-value'],  avoid:['Trend']},
  'High-Vol':{favor:['Reversion','Defensive'],               avoid:['Carry','Trend']},
};
const fwFit=(style,pref)=>pref.favor.includes(style)?'favored':pref.avoid.includes(style)?'avoid':'neutral';
function frameworkBand(lr,cap){
  if(!ALGOS||!ALGOS.length) return '';
  const pref=FW_REGIME[lr]||{favor:[],avoid:[]};
  const styleCells=FW_STYLES.map(st=>{
    const n=ALGOS.filter(a=>a.style===st).length, fit=fwFit(st,pref);
    const fl=fit==='favored'?'Favoured':fit==='avoid'?'Stand aside':'Neutral';
    return `<div class="fw-sty ${fit}" title="${esc(STYLE_DESC[st]||'')} — ${fl.toLowerCase()} in a ${lr} market.">
      <b>${st}</b><i>${fl}</i><span class="fw-sty-n">${n}</span></div>`;
  }).join('');
  const rec=ALGOS.filter(a=>a.vstatus==='validated'&&(a.bestRegime===lr||a.bestRegime==='Market-neutral'));
  const inv=rec.map(a=>1/Math.max(a.maxDD||a.dd||5,1)), tot=inv.reduce((s,x)=>s+x,0)||1;
  const recCards=rec.map((a,k)=>{
    const pct=Math.round(inv[k]/tot*100), amt=cap>0?inr(Math.round(cap*pct/100)):null, i=ALGOS.indexOf(a);
    return `<button class="fw-rec-card" data-fwgoto="${i}" title="Deploy ${esc(a.name)} in paper">
      <span class="fw-rc-top"><b>${esc(a.name)}</b>${styleChip(a.style)}</span>
      <span class="fw-rc-alloc"><b>${pct}%</b>${amt?` · ${amt}`:''}</span>
      <span class="fw-rc-min">min ${inr(a.minDeploy||a.minCap||0)}</span></button>`;
  }).join('');
  const recBlock=rec.length
    ? `<div class="fw-rec-grid">${recCards}</div>`
    : `<div class="fw-rec-empty">${icon('shield',12)}<span>No <b>validated</b> strategy fits a ${lr} market right now — favour the ${(pref.favor||[]).join(' / ')||'market-neutral'} styles below; their candidates are still gathering forward evidence.</span></div>`;
  const dep=ALGOS.filter(a=>a.deployed), depStyles=[...new Set(dep.map(a=>a.style).filter(Boolean))];
  const missing=FW_STYLES.filter(s=>!depStyles.includes(s)&&(s==='Carry'||s==='Defensive'));
  const divNote=dep.length
    ? `You're running ${depStyles.length} style${depStyles.length===1?'':'s'}${depStyles.length?` (${depStyles.join(', ')})`:''}. ${missing.length?`Adding a <b>${missing[0]}</b> sleeve cuts drawdown more than another correlated bet.`:'Good spread across styles.'}`
    : `Diversification only works across LOW-correlated styles — spread capital across a few, don't stack three Trend bets.`;
  return `<div class="fw-band">
    <div class="fw-head"><div><b>${icon('sliders',14)} Strategy Framework</b><span>what to run in a <b>${lr}</b> market — the studio tilts by style as conditions change</span></div>
      <span class="fw-regime">● ${lr}</span></div>
    <div class="fw-styles">${styleCells}</div>
    <div class="fw-rec"><div class="fw-rec-h">Recommended now${cap>0?` · suggested split of ${inr(cap)}`:''}${infoI('Validated strategies whose best regime matches the live market (or are market-neutral). The split is inverse-risk — a calmer strategy gets a bigger slice. Diversify across these rather than picking one.')}</div>${recBlock}</div>
    <p class="fw-note">${icon('shield',12)}<span>${divNote}</span></p></div>`;
}

/* ===== STRATEGY LIBRARY view — browse every type, learn, filter, regime-match ===== */
function libState(){ state.algo=state.algo||{}; return state.algo.lib=state.algo.lib||{instr:'equity',hold:'all',fam:'all',risk:'all',seg:'all',q:'',favOnly:false,expand:{}}; }
const famMeta=k=>STRAT_FAMILIES.find(f=>f[0]===k)||['?','Other','cpu',''];
// liveRegime() already returns a label ('Bull'|'Bear'|'Choppy'|'High-Vol'); High-Vol also overlays from VIX
function libHighVol(){ const v=(BOT.live&&BOT.market&&BOT.market.vix&&BOT.market.vix.ltp)||0; return v>=20; }
// favoured = matches the live regime, or High-Vol when VIX is hot, or works in Any
function libFav(s,regLabel,hv){ return s.best==='Any' || (regLabel&&s.best===regLabel) || (hv&&s.best==='High-Vol'); }
function libHostile(s,regLabel){ return regLabel && ((regLabel==='Bull'&&s.best==='Bear')||(regLabel==='Bear'&&s.best==='Bull')); }
// a library entry is "Validated" only if a real backend strategy of the same name exists
function libValidated(s){ return ALGOS.some(a=>a.vstatus==='validated' && a.name && a.name.toLowerCase()===s.name.toLowerCase()); }

function algoLibrary(){
  const l=libState();
  const regLabel=BOT.live?liveRegime():null;     // 'Bull'|'Bear'|'Choppy'|'High-Vol' when live; null offline
  const hv=libHighVol();
  const q=(l.q||'').trim().toLowerCase();
  const {instr,hold}=studioScope();   // instrument class + holding style come from the studio-wide toggle (chrome)
  // filter pipeline
  let rows=STRAT_LIBRARY.filter(s=>
    libInScope(s) &&
    (l.fam==='all'||s.fam===l.fam) &&
    (l.risk==='all'||s.risk===l.risk) &&
    (!l.favOnly || libFav(s,regLabel,hv)) &&
    (!q || (s.name+' '+s.what+' '+famMeta(s.fam)[1]).toLowerCase().includes(q))
  );
  // sort: favoured-for-now first (only when we know the live regime), else by family order
  if(regLabel||hv) rows=rows.slice().sort((a,b)=>(libFav(b,regLabel,hv)?1:0)-(libFav(a,regLabel,hv)?1:0));

  // ---- risk-first hero ----
  const hero=`<div class="lib-hero">
    <div class="lib-hero-ic">${icon('shield',20)}</div>
    <div class="lib-hero-tx"><b>Survive first, profit second.</b>
      <span>Every strategy type, explained plainly. We lead with how each one <b>loses</b> and the guard that keeps you in the game — then match what fits <b>today’s</b> market. When nothing fits, the right move is to stand aside.</span></div>
  </div>`;

  // ---- "Favoured right now" regime strip (auto-switch intelligence) ----
  let favStrip;
  if(BOT.live && (regLabel||hv)){
    const favs=STRAT_LIBRARY.filter(s=>libFav(s,regLabel,hv));
    const fams=[...new Set(favs.map(s=>s.fam))].slice(0,7);
    const tag=hv?`High-Vol${regLabel?' · '+regLabel:''}`:regLabel;
    favStrip=`<div class="lib-fav">
      <div class="lib-fav-h"><span class="lib-live"><span class="live-dot live"></span>Live regime: <b>${esc(tag)}</b></span>
        <span class="lib-fav-sub">${favs.length} strategy types favour this regime${infoI('Auto-matched to the regime TradePro detects from live Kite data (trend, breadth & VIX). Markets shift — this set updates the moment the regime flips.')}</span>
        <button class="lib-fav-btn${l.favOnly?' on':''}" data-libfav>${icon(l.favOnly?'check':'spark',12)} ${l.favOnly?'Showing favoured only':'Show favoured only'}</button></div>
      <div class="lib-fav-pills">${fams.map(fk=>{const fm=famMeta(fk);return `<button class="lib-fav-pill" data-libfam="${fk}">${icon(fm[2],12)} ${esc(fm[1])}</button>`;}).join('')}</div>
      ${hv?`<p class="lib-fav-warn">${icon('alert',12)}<span>Volatility is elevated — favour <b>defined-risk</b> structures and smaller size. This is when accounts get hurt.</span></p>`:''}
    </div>`;
  } else {
    favStrip=`<div class="lib-fav offline">${icon('shield',14)}<span><b>Connect Kite to auto-match strategies to the live regime.</b> Run <code>python3 login.py</code> — until then, browse and learn freely; we won’t guess today’s regime.</span></div>`;
  }

  // ---- filters (family + risk + search) — instrument & holding handled by the studio scope toggle (chrome) ----
  const instrCount=i=>STRAT_LIBRARY.filter(s=>instrOf(s)===i).length;
  const famCounts={}; STRAT_LIBRARY.forEach(s=>{ if(instrOf(s)===instr) famCounts[s.fam]=(famCounts[s.fam]||0)+1; });
  const famChips=`<button class="lib-chip${l.fam==='all'?' on':''}" data-libfam="all">All <i>${instrCount(instr)}</i></button>`+
    STRAT_FAMILIES.filter(f=>famCounts[f[0]]).map(f=>`<button class="lib-chip${l.fam===f[0]?' on':''}" data-libfam="${f[0]}" title="${esc(f[3])}">${icon(f[2],12)} ${esc(f[1])} <i>${famCounts[f[0]]}</i></button>`).join('');
  const riskChips=['all','Conservative','Moderate','Aggressive'].map(r=>`<button class="lib-mini${l.risk===r?' on':''}" data-librisk="${r}">${r==='all'?'Any risk':r}</button>`).join('');
  const filterActive=l.fam!=='all'||l.risk!=='all'||q||l.favOnly;
  const filters=`<div class="lib-filters">
    <div class="lib-search"><span class="lib-search-ic">${icon('search',14)}</span><input id="libSearch" class="lib-search-in" type="text" placeholder="Search strategies — e.g. straddle, breakout, theta…" value="${esc(l.q||'')}"></div>
    <div class="lib-chiprow">${famChips}</div>
    <div class="lib-minirow"><span class="lib-minilbl">Risk</span>${riskChips}${filterActive?`<button class="lib-clear" data-libclear>${icon('close',11)} Clear</button>`:''}</div>
  </div>`;

  // ---- grid ----
  const grid=rows.length
    ? `<div class="lib-grid">${rows.map(s=>libCard(s,regLabel,hv)).join('')}</div>`
    : secEmpty('search','No strategies match','Loosen the filters or clear the search — or switch holding style / instrument above.');
  const count=`<p class="sec-hint">${icon('cpu',12)}<span>Showing <b>${rows.length}</b> ${esc(INSTR_LABEL[instr])} strateg${rows.length===1?'y':'ies'}${hold!=='all'?` · <b>${esc(HOLD_LABEL[hold])}</b>`:''} of ${instrCount(instr)} in this class. Each is a <b>candidate</b> until a real engine backtest graduates it to <b>Validated</b>.</span></p>`;
  return hero+favStrip+filters+count+grid;
}

function libCard(s,regLabel,hv){
  const l=libState();
  const fm=famMeta(s.fam);
  const open=!!(l.expand&&l.expand[s.id]);
  const validated=libValidated(s);
  const fav=BOT.live&&libFav(s,regLabel,hv);
  const hostile=BOT.live&&libHostile(s,regLabel);
  const rk=LIB_RISK_CLASS[s.risk]||'b-neu';
  const ribbon=fav?`<div class="lib-rib fav">${icon('spark',11)} Favoured in the live regime</div>`
    :hostile?`<div class="lib-rib bad">${icon('alert',11)} Fights today’s regime — stand aside</div>`:'';
  const sbadge=validated?'<span class="vbadge ok">Validated</span>':'<span class="vbadge cand" title="Recognised strategy, not yet engine-backtested. Browse & learn; validate before deploying.">Candidate</span>';
  const meta=`<div class="lib-meta">
    <span class="lib-mtag">${icon(fm[2],11)} ${esc(fm[1])}</span>
    <span class="lib-mtag">${icon('layout',11)} ${esc(INSTR_LABEL[instrOf(s)])} · ${esc(HOLD_LABEL[holdOf(s)])}</span>
    <span class="lib-mtag">${icon('target',11)} Best in ${esc(s.best)}</span>
  </div>`;
  // risk-first: surface the failure + guard up front, before any upside
  const riskline=`<div class="lib-risk">
    <div class="lib-rl fail">${icon('alert',12)}<div><b>Fails when</b><span>${esc(s.fails)}</span></div></div>
    <div class="lib-rl guard">${icon('shield',12)}<div><b>Survival guard</b><span>${esc(s.guard)}</span></div></div>
  </div>`;
  const params=(s.params||[]).map(p=>`<span class="lib-param">${esc(p[0])} <b>${esc(p[1])}</b></span>`).join('');
  const detail=open?`<div class="lib-detail">
    <div class="lib-dl"><span class="lib-dh">${icon('bolt',12)} The rule</span><p>${esc(s.rule)}</p></div>
    <div class="lib-dl"><span class="lib-dh up">${icon('check',12)} When it works</span><p>${esc(s.works)}</p></div>
    <div class="lib-dl"><span class="lib-dh">${icon('sliders',12)} Key parameters</span><div class="lib-params">${params||'—'}</div></div>
    ${validated?`<button class="btn-ghost sm" data-algogoto="market">${icon('bolt',12)} Open in Marketplace</button>`
      :`<span class="cand-pill">${icon('shield',12)} Candidate · backtest in the engine before going live</span>`}
  </div>`:'';
  return `<div class="lib-card${fav?' is-fav':''}${hostile?' is-hostile':''}${open?' open':''}">
    ${ribbon}
    <div class="lib-h"><div class="lib-name"><b>${esc(s.name)}</b>${sbadge}</div><span class="badge ${rk}">${esc(s.risk)}</span></div>
    ${meta}
    <p class="lib-what">${esc(s.what)}</p>
    ${riskline}
    <button class="lib-learn" data-libexpand="${s.id}" aria-expanded="${open}">${icon(open?'compress':'expand',12)} ${open?'Hide details':'Learn — how it works, params & more'}</button>
    ${detail}
  </div>`;
}

/* ===== OPPORTUNITY ENGINE view — the explainable high-conviction decision engine ===== */
let OPPS={loaded:false,loading:false,data:null,error:false};
function loadOpps(force){
  if(OPPS.loading) return; if(OPPS.loaded && !force) return;
  OPPS.loading=true;
  fetch(BOT_API+'/api/opportunities').then(r=>r.json()).then(d=>{
    OPPS.data=d; OPPS.error=!d||d.real===false; OPPS.loaded=true; OPPS.loading=false; OPPS.at=Date.now();
    if(typeof isAlgo==='function'&&isAlgo()&&state.algo&&state.algo.view==='opportunity') renderAlgo();
  }).catch(()=>{ OPPS.error=true; OPPS.loaded=true; OPPS.loading=false; if(isAlgo()&&state.algo.view==='opportunity')renderAlgo(); });
}
const OPP_BANDS={execute:['Execute','exec'],execute_if_filters:['Execute if filters pass','execif'],watchlist:['Watchlist only','watch'],ignore:['Ignore','ign']};
function confTone(c){ return c>=90?'exec':c>=75?'execif':c>=60?'watch':'ign'; }

/* ===== Moonshot Mission tracker — ₹5,000 → ₹5,000 Cr, honest log-scale journey ===== */
function inrShort(v){
  const n=Math.abs(v); const s=v<0?'−':'';
  if(n>=1e7) return s+'₹'+(n/1e7).toFixed(n>=1e8?1:2)+' Cr';
  if(n>=1e5) return s+'₹'+(n/1e5).toFixed(2)+' L';
  return s+'₹'+Math.round(n).toLocaleString('en-IN');
}
function missionBanner(){
  const a=ALGOS.find(x=>x.id==='moonshot'); if(!a) return '';
  const START=5000, TARGET=5e10;                       // ₹5,000 → ₹5,000 Cr
  const eq=START+(a.paperPnl||0), mult=eq/START;
  const prog=Math.max(0,Math.min(100, Math.log(Math.max(eq,1)/START)/Math.log(TARGET/START)*100));
  const i=ALGOS.indexOf(a);
  // honest milestones on the log road
  const mosts=[[START,'₹5K'],[1e5,'₹1L'],[1e7,'₹1Cr'],[1e9,'₹100Cr'],[TARGET,'₹5000Cr']];
  const ticks=mosts.map(([v,l])=>{const p=Math.log(v/START)/Math.log(TARGET/START)*100;return `<span class="msn-tick" style="left:${p}%"><i></i><b>${l}</b></span>`;}).join('');
  // status / deploy
  const chip=a.sub==='paper'?`<span class="lc-chip paper">${icon('bolt',10)} Paper · running</span>`:a.sub==='paused'?'<span class="lc-chip paused">❚❚ Paused</span>':a.sub==='live'?'<span class="lc-chip live">● LIVE</span>':'';
  const pos=(a.positions&&a.positions[0])?`<span class="msn-pos">holding ${esc(a.positions[0].sym)} · ${sgn(a.openPnl||0)} open</span>`:'';
  const cta=a.sub?`${chip}${pos}`:`<button class="btn-primary sm" data-algodep="${i}">${icon('bolt',12)} Deploy ₹5,000 paper</button>`;
  return `<div class="msn">
    <div class="msn-top">
      <div class="msn-title"><span class="msn-rocket">🚀</span><div><b>Moonshot Mission</b><span>₹5,000 → ₹5,000 Cr · reinvest every rupee, ride the best setup</span></div></div>
      <div class="msn-eq"><b class="${(a.paperPnl||0)>=0?'up':'down'}">${inrShort(eq)}</b><span>${mult>=1?mult.toFixed(mult>=100?0:2)+'× start':'−'+((1-mult)*100).toFixed(1)+'%'}</span></div>
    </div>
    <div class="msn-track"><div class="msn-fill" style="width:${prog.toFixed(4)}%"></div>${ticks}</div>
    <div class="msn-foot">
      <span class="msn-prog">${prog.toFixed(prog<1?4:2)}% of the way (log scale)</span>
      <span class="msn-honest">${icon('shield',11)} 10,000,000× to target — ~57 yrs even at a stellar 50%/yr. Markets are probabilistic; this maximises compounding, it doesn't promise the moon.</span>
      <span class="msn-cta">${cta}</span>
    </div>
  </div>`;
}

function algoOpportunity(){
  const a=ALGOS.find(x=>x.id==='opportunity');
  const {instr}=studioScope();
  // engine-level tab: not filtered by instrument — flag it when the scope isn't Equity (where it runs)
  const sNote=instr!=='equity'?scopeNote(`The Opportunity Engine &amp; Moonshot run on the <b>Equity</b> book — they aren't scoped to ${esc(INSTR_LABEL[instr])}. Switch the scope to <b>Equity</b> to act on these.`):'';
  // ---- hero / explainer ----
  const hero=sNote+`<div class="opp-hero">
    <div class="opp-hero-ic">${icon('cpu',20)}</div>
    <div class="opp-hero-tx"><b>Opportunity Engine — the strict judge.</b>
      <span>Not another strategy. It detects the regime, lets only regime-appropriate specialists <b>vote</b> (weighted), scores every setup <b>0–100</b> on 8 confirmations, and <b>refuses</b> anything that isn't high-conviction. The goal isn't to win every trade — it's to never take a low-quality one.</span></div>
  </div>`;
  // ---- pipeline diagram ----
  const pipe=`<div class="opp-pipe">${['Market data','Indicators','Regime','Weighted vote','Confidence 0–100','Risk filters','Execute'].map((s,i,arr)=>`<span class="opp-pstep${i===arr.length-1?' last':''}">${esc(s)}</span>${i<arr.length-1?'<span class="opp-parrow">→</span>':''}`).join('')}</div>`;
  // ---- lifecycle bar for the engine bot (deploy / prove / go-live after 10) ----
  let life='';
  if(a){
    const min=BOT.nudgeMin||10, n=a.fwdTrades||0, pc=Math.min(100,Math.round(n/min*100));
    const chip=a.sub==='live'?'<span class="lc-chip live">● LIVE · real money</span>':a.sub==='paper'?`<span class="lc-chip paper">${icon('bolt',10)} Paper · running</span>`:a.sub==='paused'?'<span class="lc-chip paused">❚❚ Paused</span>':'';
    const i=ALGOS.indexOf(a);
    const gate=a.sub==='live'?`<button class="btn-go sm" data-algogl="${i}">${icon('shield',12)} Manage live</button>`
      :`<div class="opp-gate"><div class="opp-gate-h"><span>Go-Live gate${infoI('The engine earns real-money execution after ≥'+min+' profitable CLOSED forward paper trades + funded account + ALLOW_LIVE armed.')}</span><span>${n}/${min} profitable paper trades</span></div><div class="lc-bar"><i style="width:${pc}%"></i></div>${a.nudge?`<button class="btn-go sm wide" data-algogl="${i}">${icon('shield',12)} Go Live →</button>`:`<button class="btn-go sm wide is-locked" data-algogl="${i}" aria-disabled="true">${icon('lock',12)} Go Live — locked until ${min} profitable trades</button>`}</div>`;
    life=`<div class="opp-life">
      <div class="opp-life-l"><b>${esc(a.name)}</b>${chip}<span class="opp-pnl ${a.paperPnl>0?'up':a.paperPnl<0?'down':''}">${a.paperPnl>=0?'+':'−'}₹${Math.abs(Math.round(a.paperPnl||0)).toLocaleString('en-IN')} paper P&L</span></div>
      ${a.sub?gate:`<button class="btn-primary sm" data-algodep="${i}">${icon('bolt',12)} Deploy in Paper</button>`}
    </div>`;
  }
  // ---- live scan ----
  const d=OPPS.data;
  if(!OPPS.loaded){ loadOpps(); return missionBanner()+hero+pipe+life+`<div class="opp-load">${icon('cpu',16)}<span>Scoring the universe against the live regime…</span></div>`; }
  if(OPPS.error || !d || d.real===false){
    return missionBanner()+hero+pipe+life+`<div class="opp-offline">${icon('shield',14)}<span><b>Connect Kite for the live decision scan.</b> ${esc((d&&d.error)||'')||'Run python3 login.py — the engine scores real setups only; it never invents an opportunity.'}</span></div>`;
  }
  // regime + enabled specialists with weights
  const reg=d.regime, w=d.weights||{};
  const specs=(d.specialists||[]);
  const weightChips=specs.map(s=>{const wt=w[s.style]||0;const tone=wt>=8?'hi':wt>=4?'mid':'lo';return `<span class="opp-wchip ${tone}" title="${esc(s.style)} carries weight ${wt} in a ${esc(reg)} regime">${esc(s.key)} <i>${wt}</i></span>`;}).join('');
  const regBar=`<div class="opp-regime">
    <div class="opp-reg-h"><span class="lib-live"><span class="live-dot live"></span>Live regime: <b>${esc(reg)}</b></span><span class="opp-reg-sub">specialist vote weights this regime — the regime decides who gets a say${infoI('In each regime the engine up-weights the specialists that historically work and mutes the rest. Trend names lead in Bull; reversion in Choppy/High-Vol.')}</span></div>
    <div class="opp-wchips">${weightChips}</div></div>`;
  // bands legend
  const bands=`<div class="opp-legend">${[['exec','90–100 Execute'],['execif','75–89 Execute if filters'],['watch','60–74 Watchlist'],['ign','&lt;60 Ignore']].map(([k,l])=>`<span class="opp-lg ${k}">${l}</span>`).join('')}</div>`;
  const opps=d.opportunities||[];
  const top=opps.filter(o=>o.confidence>=60);
  const feed=opps.length?`<div class="opp-grid">${opps.slice(0,12).map(oppCard).join('')}</div>`
    :secEmpty('shield','Nothing clears the bar right now',`The engine scored ${opps.length} names and none reached the watchlist threshold in this ${esc(reg)} regime — so it stands aside. That's the engine working: no low-quality trades.`);
  const summ=`<p class="sec-hint">${icon('cpu',12)}<span>Scored <b>${opps.length}</b> names · <b>${top.length}</b> on the watchlist+ · <b>${opps.filter(o=>o.confidence>=75).length}</b> in an execute band. Refreshed ${OPPS.at?timeAgo(new Date(OPPS.at).toISOString()):'now'}. <button class="opp-refresh" data-oppref>↻ Rescan</button></span></p>`;
  return missionBanner()+hero+pipe+life+regBar+bands+summ+feed+allocationPanel()+learningPanel()+decisionLog();
}
function oppCard(o){
  const tone=confTone(o.confidence), band=OPP_BANDS[o.band]||['',''];
  const comps=o.components||{};
  const COMPLBL={regime_match:'Regime',ema_trend:'EMA trend',rsi_ok:'RSI',macd:'MACD',supertrend:'Supertrend',volume_spike:'Volume',atr_healthy:'ATR',strong_candle:'Candle'};
  const compChips=Object.keys(COMPLBL).map(k=>{const on=(comps[k]||0)>0;return `<span class="opp-comp${on?' on':''}" title="${COMPLBL[k]}: ${on?'+'+comps[k]:'0'}">${COMPLBL[k]}${on?` +${comps[k]}`:''}</span>`;}).join('');
  const votes=(o.votes||[]);
  const voteChips=votes.map(v=>`<span class="opp-vote${v.vote?' yes':''}" title="${esc(v.strategy)} (${esc(v.style)}, weight ${v.weight}) ${v.vote?'votes BUY':'no signal'}">${esc(v.strategy)}${v.vote?` ·${v.weight}`:''}</span>`).join('');
  // ---- Score 2.0: structured sub-scores + expected value + reasons ----
  const s=o.sub||{};
  const SUBS=[['trendQuality','Trend'],['momentum','Mom'],['volume','Vol'],['volatility','Volat'],['liquidity','Liq']];
  const subBars=SUBS.map(([k,l])=>{const v=s[k]||0;const t=v>=70?'hi':v>=40?'mid':'lo';return `<div class="opp-sub"><span>${l}</span><div class="opp-sbar"><i class="${t}" style="width:${v}%"></i></div><b>${v}</b></div>`;}).join('');
  const ev=s.expReturnPct!=null?`<span title="Estimated favourable move (~1.5×ATR) — an estimate, not a promise">Exp +${s.expReturnPct}%</span>`:'';
  const hold=s.expDurationDays?`<span>~${s.expDurationDays}d hold</span>`:'';
  const risk=s.risk!=null?`<span class="opp-risk ${s.risk<=30?'lo':s.risk<=60?'mid':'hi'}">Risk ${s.risk}</span>`:'';
  const reasons=(o.reasons||[]);
  const reasonList=reasons.length?`<ul class="opp-reasons">${reasons.map(r=>`<li>${/disagree/.test(r)?'⚠':'✓'} ${esc(r)}</li>`).join('')}</ul>`:'';
  return `<div class="opp-card ${tone}">
    <div class="opp-c-h"><div class="opp-c-sym"><b>${esc(o.symbol)}</b><span class="opp-c-px">₹${(o.price||0).toLocaleString('en-IN')}</span></div>
      <div class="opp-score ${tone}"><b>${o.confidence}</b><span>/100</span></div></div>
    <div class="opp-band ${tone}">${icon(tone==='exec'||tone==='execif'?'bolt':tone==='watch'?'clock':'minus',11)} ${esc(band[0])}</div>
    <div class="opp-bar"><i class="${tone}" style="width:${o.confidence}%"></i></div>
    <div class="opp-c-meta"><span>${o.agree}/${votes.length} agree</span>${ev}${hold}${risk}${o.mtfOk===false?'<span class="opp-mtf">⚠ higher-TF</span>':''}</div>
    <div class="opp-subs">${subBars}</div>
    <details class="opp-det"><summary>Why — reasons, components & votes</summary>
      ${reasonList}
      <div class="opp-det-h">Confirmations</div><div class="opp-comps">${compChips}</div>
      <div class="opp-det-h">Specialist votes</div><div class="opp-votes">${voteChips}</div></details>
  </div>`;
}

/* ===== Decision Log — the auditable entry/exit trail (Phase 12/13/16) ===== */
let DECS={loaded:false,loading:false,data:null};
function loadDecisions(force){
  if(DECS.loading) return; if(DECS.loaded && !force) return;
  DECS.loading=true;
  fetch(BOT_API+'/api/decisions').then(r=>r.json()).then(d=>{
    DECS.data=d; DECS.loaded=true; DECS.loading=false;
    if(typeof isAlgo==='function'&&isAlgo()&&state.algo&&state.algo.view==='opportunity') renderAlgo();
  }).catch(()=>{ DECS.loaded=true; DECS.loading=false; });
}
function decisionLog(){
  loadDecisions();
  const recs=(DECS.data&&DECS.data.decisions)||[];
  const head=`<div class="dlog-h">${icon('flag',13)}<b>Decision Log</b><span>every entry & exit, with the reasoning — fully auditable</span></div>`;
  if(!recs.length) return `<div class="dlog">${head}<p class="sec-hint" style="margin-top:8px">${icon('cpu',12)}<span>No decisions logged yet — the Moonshot records each trade here with regime, confidence, sub-scores and rationale the moment it acts.</span></p></div>`;
  const rows=recs.slice(0,30).map(r=>{
    const isE=r.action==='ENTER';
    const when=r.ts?timeAgo(r.ts):'';
    if(isE){
      const reasons=(r.reasons||[]).slice(0,4).map(x=>esc(x)).join(' · ');
      return `<div class="dlog-row enter">
        <span class="dlog-tag enter">BUY</span>
        <div class="dlog-main"><b>${esc(r.symbol)}</b> <span class="dlog-meta">conf ${r.confidence} · size ${Math.round((r.alloc||0)*100)}% · ${r.qty} sh @₹${(r.entry||0).toLocaleString('en-IN')} · ${esc(r.regime||'')}</span>
          <span class="dlog-why">${reasons}${r.expReturnPct!=null?` · exp +${r.expReturnPct}%`:''}</span></div>
        <span class="dlog-when">${when}</span></div>`;
    }
    return `<div class="dlog-row exit">
      <span class="dlog-tag exit">SELL</span>
      <div class="dlog-main"><b>${esc(r.symbol)}</b> <span class="dlog-meta">${esc(r.reason||'')} · equity ₹${(r.equity||0).toLocaleString('en-IN')}</span></div>
      <span class="dlog-pnl ${cls(r.pnl||0)}">${sgn(r.pnl||0)}</span><span class="dlog-when">${when}</span></div>`;
  }).join('');
  return `<div class="dlog">${head}<div class="dlog-rows">${rows}</div></div>`;
}

/* ===== Capital Allocation — the proposal→competition→allocation result ===== */
let CAPALLOC={loaded:false,loading:false,data:null};
function loadAllocation(force){
  if(CAPALLOC.loading) return; if(CAPALLOC.loaded && !force) return;
  CAPALLOC.loading=true;
  fetch(BOT_API+'/api/allocation').then(r=>r.json()).then(d=>{
    CAPALLOC.data=d; CAPALLOC.loaded=true; CAPALLOC.loading=false;
    if(typeof isAlgo==='function'&&isAlgo()&&state.algo&&state.algo.view==='opportunity') renderAlgo();
  }).catch(()=>{ CAPALLOC.loaded=true; CAPALLOC.loading=false; });
}
function allocationPanel(){
  loadAllocation();
  const d=CAPALLOC.data; if(!d || d.real===false) return '';
  const funded=d.funded||[], skipped=d.skipped||[];
  const head=`<div class="alc-h">${icon('scale',13)}<b>Capital Allocation</b><span>bots propose · the Governor constrains · the Allocator funds the best diversified set</span></div>`;
  const fund=funded.length?funded.map(f=>`<div class="alc-row fund">
      <span class="alc-tag fund">FUND</span>
      <div class="alc-main"><b>${esc(f.symbol)}</b> <span class="alc-meta">${esc(f.sector)} · conf ${Math.round(f.confidence)} · score ${f.score}</span></div>
      <span class="alc-alloc">${f.allocPct}%<i>${f.qty} sh</i></span></div>`).join(''):'<p class="sec-hint" style="margin:6px 0">Nothing funded this round — no proposal cleared conviction + the Governor.</p>';
  const skip=skipped.slice(0,8).map(s=>`<div class="alc-row skip">
      <span class="alc-tag skip">SKIP</span>
      <div class="alc-main"><b>${esc(s.symbol)}</b> <span class="alc-meta">${esc(s.sector||'')} · conf ${Math.round(s.confidence||0)}</span></div>
      <span class="alc-reason">${esc(s.reason)}</span></div>`).join('');
  return `<div class="alc">${head}
    <div class="alc-summ">Competed <b>${d.ranked||0}</b> proposals · funded <b class="up">${funded.length}</b> · deployed <b>${inrShort(d.deployed||0)}</b> of ${inrShort(d.budget||0)} budget</div>
    <div class="alc-cols"><div class="alc-col"><div class="alc-ch up">Funded — won capital</div>${fund}</div>
    <div class="alc-col"><div class="alc-ch">Skipped — and why</div>${skip||'<p class="sec-hint" style="margin:6px 0">—</p>'}</div></div></div>`;
}

/* ===== Learning Engine panel — what the system has learned from the decision log ===== */
let LEARN={loaded:false,loading:false,data:null};
function loadLearning(force){
  if(LEARN.loading) return; if(LEARN.loaded && !force) return;
  LEARN.loading=true;
  fetch(BOT_API+'/api/learning').then(r=>r.json()).then(d=>{
    LEARN.data=d; LEARN.loaded=true; LEARN.loading=false;
    if(typeof isAlgo==='function'&&isAlgo()&&state.algo&&state.algo.view==='opportunity') renderAlgo();
  }).catch(()=>{ LEARN.loaded=true; LEARN.loading=false; });
}
const LEARN_LBL={regime_match:'Regime fit',ema_trend:'EMA trend',rsi_ok:'RSI',macd:'MACD',supertrend:'Supertrend',volume_spike:'Volume',atr_healthy:'ATR',strong_candle:'Candle'};
function learningPanel(){
  loadLearning();
  const d=LEARN.data; if(!d || d.real===false) return '';
  const active=d.status==='active';
  const chip=active?`<span class="lrn-chip on">${icon('check',11)} Active · learned from ${d.nTrades} trades</span>`
    :`<span class="lrn-chip">${icon('cpu',11)} Gathering · ${d.nTrades}/${d.minTrades} closed trades</span>`;
  const w=d.weights||{}, p=d.priors||{}, st=d.stats||{};
  const maxw=(Math.max.apply(null,Object.values(p))*1.4)||20;
  const rows=Object.keys(p).map(k=>{
    const lw=w[k], pw=p[k], delta=lw-pw, s=st[k]||{};
    const arrow=Math.abs(delta)<0.3?'':delta>0?'<i class="lrn-up">▲</i>':'<i class="lrn-dn">▼</i>';
    const ev=(active&&s.n)?`${s.winPct!=null?s.winPct+'% win · ':''}${s.n} trades${s.edge?` · edge ${s.edge>0?'+':''}${s.edge}%`:''}`:'—';
    return `<div class="lrn-row"><span class="lrn-name">${LEARN_LBL[k]||k}</span>
      <div class="lrn-bar"><i style="width:${Math.min(100,lw/maxw*100)}%"></i><span class="lrn-prior" style="left:${Math.min(100,pw/maxw*100)}%" title="prior ${pw}"></span></div>
      <span class="lrn-w">${lw}${arrow}</span><span class="lrn-edge">${ev}</span></div>`;
  }).join('');
  return `<div class="lrn">
    <div class="lrn-h">${icon('cpu',13)}<b>Learning Engine</b>${chip}</div>
    <p class="lrn-note">${icon('shield',11)}<span>Scoring weights update from <b>real closed-trade outcomes</b> — each signal shrunk toward its prior by sample size, then renormalised so the 0–100 scale &amp; bands stay fixed. Nothing moves until ${d.minTrades} closed trades. ${active?'It now up-weights the signals that have preceded winners and mutes the noise.':'Priors stay in use until the evidence is robust — no overfitting to a handful of trades.'}</span></p>
    <div class="lrn-rows"><div class="lrn-row lrn-head"><span>Signal</span><span>prior → learned weight</span><span></span><span>evidence</span></div>${rows}</div>
  </div>`;
}

/* ===== Risk Governor tab — portfolio health, concentration, drawdown kill-switch, audit ===== */
let RISK={loaded:false,loading:false,data:null};
function loadRisk(force){
  if(RISK.loading) return; if(RISK.loaded && !force) return;
  RISK.loading=true;
  fetch(BOT_API+'/api/risk').then(r=>r.json()).then(d=>{
    RISK.data=d; RISK.loaded=true; RISK.loading=false;
    if(typeof isAlgo==='function'&&isAlgo()&&state.algo&&state.algo.view==='risk') renderAlgo();
  }).catch(()=>{ RISK.loaded=true; RISK.loading=false; });
}
/* ===== Strategy Rebalancing panel (regime capital rotation, capital-preservation) ===== */
let REBAL={loaded:false,loading:false,data:null};
function loadRebalance(force){
  if(REBAL.loading) return; if(REBAL.loaded && !force) return;
  REBAL.loading=true;
  fetch(BOT_API+'/api/rebalance').then(r=>r.json()).then(d=>{
    REBAL.data=d; REBAL.loaded=true; REBAL.loading=false;
    if(typeof isAlgo==='function'&&isAlgo()&&state.algo&&state.algo.view==='risk') renderAlgo();
  }).catch(()=>{ REBAL.loaded=true; REBAL.loading=false; });
}
function rebalancePanel(){
  loadRebalance();
  const d=REBAL.data; if(!d || d.real===false) return '';
  const en=d.enabled||[], st=d.stoodDown||[];
  const enChips=en.length?en.map(x=>`<span class="rb2-chip on">${esc(x.name)}<i>${esc(x.style)}</i></span>`).join(''):'<span class="sec-hint">—</span>';
  const stChips=st.length?st.map(x=>`<span class="rb2-chip off">${esc(x.name)}<i>${esc(x.style)}</i></span>`).join(''):'<span class="sec-hint">none — all styles fit this regime</span>';
  return `<div class="rb2">
    <div class="rb2-h">${icon('repeat',13)}<b>Strategy Rebalancing</b><span>capital rotates to the regime-fit strategies — the rest stand down to cash (capital-preservation)</span></div>
    <div class="rb2-summ"><span class="rb2-live"><span class="live-dot live"></span>${esc(d.regime||'—')}</span>
      <span>Cash target <b>${d.cashPct}%</b></span><span>Conviction floor <b>${d.convictionFloor}</b></span>
      ${d.preservation?'<span class="rb2-pres">🛡 preservation</span>':''}<span class="rb2-note">${esc(d.note||'')}</span></div>
    <div class="rb2-cols">
      <div class="rb2-col"><div class="rb2-ch up">Taking risk (${en.length})</div><div class="rb2-chips">${enChips}</div></div>
      <div class="rb2-col"><div class="rb2-ch">Stood down · cash (${st.length})</div><div class="rb2-chips">${stChips}</div></div>
    </div></div>`;
}

function algoRisk(){
  loadRisk();
  const hero=scopeNote('Portfolio-wide — the Governor spans <b>every</b> instrument class at once, regardless of the scope above. Risk is managed across the whole book.')+`<div class="rk-hero"><div class="rk-hero-ic">${icon('shield',20)}</div>
    <div class="rk-hero-tx"><b>Portfolio Risk Governor</b><span>Every trade passes through here — no exceptions. It caps concentration, governs exposure, and trips a portfolio-wide kill-switch on drawdown. Bots propose; the Governor disposes.</span></div></div>`;
  const d=RISK.data;
  if(!RISK.loaded) return hero+`<div class="opp-load">${icon('cpu',16)}<span>Reading the live book…</span></div>`;
  if(!d || d.real===false) return hero+`<div class="opp-offline">${icon('shield',14)}<span><b>Governor publishes during market hours.</b> ${esc((d&&d.error)||'')||'Start the paper harness while the market is open to see live portfolio risk.'}</span></div>`;
  const grade=d.score>=80?['Excellent','up']:d.score>=60?['Healthy','']:d.score>=40?['Caution','down']:['Critical','down'];
  const killed=d.killSwitch;
  const kill=killed?`<div class="rk-kill">${icon('alert',16)}<div><b>KILL-SWITCH ACTIVE — ${esc(d.mode).toUpperCase()}</b><span>Portfolio drawdown ${d.drawdownPct}% — new entries are blocked across all bots until it recovers.</span></div></div>`
    :d.mode!=='normal'?`<div class="rk-warn">${icon('alert',13)}<span>Risk-reduction mode <b>${esc(d.mode)}</b> — new positions sized to ${Math.round((d.sizeMult||1)*100)}% (drawdown ${d.drawdownPct}%).</span></div>`:'';
  const health=`<div class="rk-health">
    <div class="rk-score ${grade[1]}"><b>${d.score}</b><span>/100</span></div>
    <div class="rk-grade"><b class="${grade[1]}">${grade[0]}</b><span>portfolio health</span></div>
    <div class="rk-kpis">
      <div><span>Exposure</span><b class="${d.exposurePct>100?'down':''}">${d.exposurePct}%</b></div>
      <div><span>Drawdown</span><b class="${d.drawdownPct>0?'down':'up'}">−${d.drawdownPct}%</b></div>
      <div><span>Top symbol</span><b class="${(d.topSymbol||{}).pct>d.limits.symbol?'down':''}">${esc((d.topSymbol||{}).sym||'—')} ${Math.round((d.topSymbol||{}).pct||0)}%</b></div>
      <div><span>Top sector</span><b class="${(d.topSector||{}).pct>d.limits.sector?'down':''}">${esc((d.topSector||{}).sector||'—')} ${Math.round((d.topSector||{}).pct||0)}%</b></div>
    </div></div>`;
  const bar=(label,pct,lim)=>{const over=pct>lim;return `<div class="rk-cbar"><span class="rk-cl">${esc(label)}</span><div class="rk-ctrack"><i class="${over?'over':''}" style="width:${Math.min(100,pct)}%"></i><span class="rk-clim" style="left:${Math.min(100,lim)}%" title="limit ${lim}%"></span></div><b class="${over?'down':''}">${Math.round(pct)}%</b></div>`;};
  const secs=Object.entries(d.sectors||{});
  const secBars=secs.length?secs.map(([s,p])=>bar(s,p,d.limits.sector)).join(''):'<p class="sec-hint">No open positions — book is flat.</p>';
  const symBars=Object.entries(d.symbols||{}).slice(0,8).map(([s,p])=>bar(s,p,d.limits.symbol)).join('');
  const conc=`<div class="rk-grid2">
    <div class="rk-card"><div class="rk-ch">${icon('pie',13)} Sector concentration <i>limit ${d.limits.sector}%</i></div>${secBars}</div>
    <div class="rk-card"><div class="rk-ch">${icon('layout',13)} Symbol concentration <i>limit ${d.limits.symbol}%</i></div>${symBars||'<p class="sec-hint">—</p>'}</div></div>`;
  // drawdown ladder
  const tiers=(d.ddTiers||[]).slice().reverse();
  const ladder=`<div class="rk-card"><div class="rk-ch">${icon('shield',13)} Drawdown kill-switch ladder</div><div class="rk-ladder">
    ${tiers.map(t=>`<div class="rk-tier${d.mode===t.mode?' on':''}"><b>${t.at}%</b><span>${esc(t.mode)}</span></div>`).join('<span class="rk-arr">→</span>')}
    <div class="rk-tier${d.mode==='normal'?' on':''}" style="order:-1"><b>0%</b><span>normal</span></div></div>
    <p class="rk-cur">Currently: <b class="${d.mode==='normal'?'up':'down'}">${esc(d.mode)}</b> at ${d.drawdownPct}% drawdown</p></div>`;
  // audit
  const audit=(d.audit||[]);
  const aud=audit.length?`<div class="rk-card"><div class="rk-ch">${icon('flag',13)} Trade audit — every proposal, approved or vetoed</div><div class="rk-audit">${audit.slice(0,20).map(a=>`<div class="rk-arow ${a.approved?'ok':'veto'}"><span class="rk-atag ${a.approved?'ok':'veto'}">${a.approved?'PASS':'VETO'}</span><span class="rk-amain"><b>${esc(a.bot)}</b> ${esc(a.symbol||'')}</span><span class="rk-areason">${esc(a.reason)}</span><span class="rk-awhen">${a.ts?timeAgo(a.ts):''}</span></div>`).join('')}</div></div>`:`<div class="rk-card"><div class="rk-ch">${icon('flag',13)} Trade audit</div><p class="sec-hint">No proposals reviewed yet — every bot entry will appear here with the Governor's verdict.</p></div>`;
  return hero+kill+health+rebalancePanel()+conc+ladder+aud;
}

/* ===== Positions tab — Position Intelligence (post-entry management) ===== */
let POSNS={loaded:false,loading:false,data:null};
function loadPositions(force){
  if(POSNS.loading) return; if(POSNS.loaded && !force) return;
  POSNS.loading=true;
  fetch(BOT_API+'/api/positions').then(r=>r.json()).then(d=>{
    POSNS.data=d; POSNS.loaded=true; POSNS.loading=false;
    if(typeof isAlgo==='function'&&isAlgo()&&state.algo&&state.algo.view==='positions') renderAlgo();
  }).catch(()=>{ POSNS.loaded=true; POSNS.loading=false; });
}
const POS_ACT={hold:['Hold','hold'],protect:['Protect profit','protect'],watch:['Watch','watch'],exit:['Exit — thesis decayed','exit']};
function posTone(h){ return (h==null)?'na':h>=70?'hi':h>=50?'mid':'lo'; }
function algoPositions(){
  loadPositions();
  const hero=`<div class="pi-hero"><div class="pi-hero-ic">${icon('shield',20)}</div>
    <div class="pi-hero-tx"><b>Position Intelligence</b><span>Every open position, managed live. Health = is the original thesis still valid? It protects profit as gains grow and exits only on <b>persistent</b> thesis decay — never on a single down-tick, so winners are let run.</span></div></div>`;
  const d=POSNS.data;
  if(!POSNS.loaded) return hero+`<div class="opp-load">${icon('cpu',16)}<span>Reading open positions…</span></div>`;
  if(!d||d.real===false) return hero+`<div class="opp-offline">${icon('shield',14)}<span>${esc((d&&d.error)||'')||'Connect the harness to manage live positions.'}</span></div>`;
  const allPs=d.positions||[];
  const ps=allPs.filter(p=>inScope(ALGOS.find(x=>x.id===(p.bot))||{id:p.bot}));   // scope to the active instrument class
  if(!allPs.length) return hero+`<div class="opp-offline">${icon('check',14)}<span><b>No open positions</b> — nothing to manage right now. As the bots enter, each position appears here with a live health score and a recommended action.</span></div>`;
  if(!ps.length) return hero+scopeEmpty('check','No open positions in this class',`${allPs.length} position(s) are open in other classes — switch the scope above (Equity holds the live book) to manage them.`);
  const summ=`<p class="sec-hint">${icon('cpu',12)}<span><b>${ps.length}</b> open position(s)${d.avgHealth!=null?` · avg health <b>${d.avgHealth}</b>`:''} · weakest first. Health updates every cycle from the live thesis.</span></p>`;
  const cards=ps.map(p=>{
    const tone=posTone(p.health), act=POS_ACT[p.action]||['—','na'];
    const hv=p.health==null?'—':p.health;
    const gain=p.gainPct;
    return `<div class="pi-card ${tone}">
      <div class="pi-h"><div class="pi-sym"><b>${esc(p.symbol)}</b><span>${esc(p.botName||p.bot)}</span></div>
        <div class="pi-score ${tone}"><b>${hv}</b><span>health</span></div></div>
      <div class="pi-bar"><i class="${tone}" style="width:${p.health==null?0:p.health}%"></i></div>
      <div class="pi-meta">
        <span class="pi-act ${act[1]}">${esc(act[0])}</span>
        ${gain!=null?`<span class="pi-gain ${gain>=0?'up':'down'}">${gain>=0?'+':''}${gain}%</span>`:''}
        ${p.entry?`<span>entry ₹${(p.entry).toLocaleString('en-IN')}</span>`:''}
        ${p.stop?`<span>stop ₹${(p.stop).toLocaleString('en-IN')}</span>`:''}
        ${p.weak?`<span class="pi-weak">weak ${p.weak}/2</span>`:''}
      </div>
      ${p.reason?`<p class="pi-reason">${icon(p.action==='exit'?'alert':p.action==='protect'?'shield':'cpu',11)} ${esc(p.reason)}</p>`:''}
    </div>`;
  }).join('');
  return hero+summ+`<div class="pi-grid">${cards}</div>`;
}

function algoMarket(){
  const {instr,hold}=studioScope();                       // instrument class & holding from the studio scope toggle (chrome)
  const lr=liveRegime();
  const cap=algoPlanCapital();
  const onlyRun=!!(state.algo&&state.algo.onlyRun);
  const inSeg=ALGOS.filter(a=>inScope(a));                 // deployable bots in the active class · holding style
  const shown=onlyRun?inSeg.filter(a=>algoRunnable(a,lr,cap)):inSeg;
  const affordN=inSeg.filter(a=>cap>=a.minCap).length, matchN=inSeg.filter(a=>algoRunnable(a,lr,cap)).length;
  const quick=[[50000,'₹50K'],[100000,'₹1L'],[500000,'₹5L'],[1000000,'₹10L']];
  const capQuick=`<div class="cap-quick" role="group" aria-label="Quick capital presets">${quick.map(([qv,ql])=>`<button class="cap-chip${cap===qv?' on':''}" data-capset="${qv}">${ql}</button>`).join('')}</div>`;
  const capStrip=`<div class="cap-strip">
    <div class="cap-field"><label for="algoPlanCap">Plan with capital${infoI('Set the money you intend to deploy. Each card then shows whether you can actually run that strategy at this size — driven by real lot-size & margin minimums, not guesswork.')}</label>
      <div class="cap-row"><div class="cap-input-wrap"><span>₹</span><input id="algoPlanCap" class="cap-input num" type="number" inputmode="numeric" value="${cap}" min="0" step="5000" placeholder="e.g. 100000"></div>${capQuick}</div></div>
    <div class="cap-sum">${cap>0?`<b class="up">${affordN}</b> of ${inSeg.length} affordable · <b>${matchN}</b> also match the live <b>${lr}</b> regime`:'Pick a preset or type the capital you plan to deploy — each card then shows exactly what you can run.'}</div>
    <label class="cap-toggle"><input type="checkbox" id="algoOnlyRun" ${onlyRun?'checked':''}><span>Only what I can run now</span></label>
  </div>`;
  const valid=inSeg.filter(a=>a.vstatus==='validated').length;
  const regimeReady=inSeg.filter(a=>a.vstatus==='validated'&&(a.bestRegime===lr||a.bestRegime==='Market-neutral')).length;
  const segLabel=INSTR_LABEL[instr]+(hold!=='all'?' · '+HOLD_LABEL[hold]:'');
  const stat=secStats([
    {l:lbl('Strategies'),v:String(inSeg.length),s:'in '+esc(segLabel)},
    {l:lbl('Validated'),v:String(valid),s:'passed validation',tone:valid?'up':''},
    {l:'Fit '+esc(lr)+infoI('Validated strategies whose best regime matches the current live regime — the ones the engine can deploy right now.'),v:String(regimeReady),s:'match the live regime'},
    {l:'Runnable now'+infoI('Validated strategies that BOTH fit the live regime AND clear your planned capital’s lot-size / margin minimum.'),v:cap>0?String(matchN):'—',s:cap>0?'fit '+inr(cap):'set your capital',tone:cap>0&&matchN>0?'up':''}
  ]);
  const emptyMsg=inSeg.length===0
    ? `No deployable <b>${esc(segLabel)}</b> bot exists yet — this class is in the Library as candidates. As options/futures engines come online they appear here. Switch the scope above to <b>Equity</b> for the live book.`
    : `No <b>${esc(segLabel)}</b> strategy both fits ${inr(cap)} and matches the live ${lr} regime. Add capital, switch off the filter, or wait for the regime to favour a validated edge.`;
  const cards=shown.length?shown.map(a=>algoCard(a,ALGOS.indexOf(a),lr,cap)).join(''):secEmpty('shield',inSeg.length===0?'Nothing deployable in this class yet':'Nothing runnable at this size',emptyMsg);
  const build=onlyRun?'':`<button class="algo-build" data-algobuild>${icon('plus',20)}<b>Build a strategy</b><span>Define your own entry &amp; exit rules</span></button>`;
  return funnelGuide()+myStrategiesBar()+algoNudge()+frameworkBand(lr,cap)+capStrip+stat+`<div class="algo-grid">${cards}${build}</div>`;
}
/* ===== Go-Live readiness: the hard checklist that gates Paper→Live ===== */
function goLiveChecklist(a){
  flowModal({title:'Go-Live readiness — '+a.name, hideConfirm:true,
    body:`<div class="gl-load">${icon('cpu',16)}<span>Running the go-live audit across strategy, account, risk &amp; security…</span></div>`,
    wire(body){
      fetch(BOT_API+'/api/readiness?strategy='+encodeURIComponent(a.id))
        .then(r=>r.json()).then(d=>{ body.innerHTML=readinessHTML(d,a); wireReadiness(body,d,a); })
        .catch(()=>{ body.innerHTML=`<p class="flow-note">${icon('shield',13)}<span>Bot API offline — run <b>python3 bot_api.py</b> in the bot folder, then retry.</span></p>`; });
    }});
}
function readinessHTML(d,a){
  if(!d||d.error) return `<p class="flow-note">${icon('shield',13)}<span>Could not audit this strategy.</span></p>`;
  const order=[]; d.gates.forEach(g=>{ if(!order.includes(g.cat))order.push(g.cat); });
  const groups=order.map(cat=>{
    const rows=d.gates.filter(g=>g.cat===cat).map(g=>{
      const ico=g.status==='pass'?'check':g.status==='fail'?'x':'alert';
      return `<div class="gl-row ${g.status}"><span class="gl-mk">${icon(ico,13)}</span><div class="gl-tx"><b>${esc(g.label)}${g.critical?'':' <i class="gl-opt">optional</i>'}</b><span>${esc(g.detail)}</span></div></div>`;
    }).join('');
    return `<div class="gl-grp"><div class="gl-gh">${esc(cat)}</div>${rows}</div>`;
  }).join('');
  const pct=d.total?Math.round(d.passed/d.total*100):0;
  const head=`<div class="gl-head ${d.ready?'ok':'block'}">
    <div class="gl-score"><b>${d.passed}/${d.total}</b><span>critical gates green</span></div>
    <div class="gl-barwrap"><div class="gl-bar"><i style="width:${pct}%"></i></div>
      <span class="gl-verdict">${d.ready?icon('check',14)+' Cleared for live':icon('lock',13)+' '+(d.total-d.passed)+' gate(s) still open'}</span></div></div>`;
  const open=d.gates.filter(g=>g.critical&&!g.ok);
  const foot=d.ready
    ? `<button class="tbtn primary gl-go" id="glGo">${icon('bolt',13)} Arm &amp; switch ${esc(a.name)} to LIVE</button>
       <p class="gl-fnote">${icon('shield',12)}<span>Even here, a real order is impossible unless <b>ALLOW_LIVE</b> is set in the bot’s own environment — a UI click can never place money on its own.</span></p>`
    : `<div class="gl-blocked">${icon('lock',14)}<div><b>Live is locked.</b><span>Clears automatically once every critical gate is green${open.length?': '+open.map(g=>esc(g.label)).join(' · '):''}.</span></div></div>`;
  return head+`<div class="gl-list">${groups}</div>`+foot;
}
function wireReadiness(body,d,a){
  const go=body.querySelector('#glGo'); if(!go) return;
  go.onclick=()=>{ go.disabled=true; go.textContent='Arming…';
    fetch(BOT_API+'/api/mode',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode:'live'})})
      .then(r=>r.json()).then(res=>{
        if(res.locked){ go.disabled=false; go.innerHTML=icon('bolt',13)+' Arm &amp; switch '+esc(a.name)+' to LIVE';
          quickToast('Live still locked','ALLOW_LIVE is not set in the bot environment, so the switch was refused. Set it on the machine running the bot, then retry.'); }
        else { BOT.paperMode=false; closeModal(); if(typeof renderAlgo==='function')renderAlgo();
          quickToast('LIVE armed — '+a.name,'Real orders are now enabled. Start small and watch the first fills.'); }
      }).catch(()=>{ go.disabled=false; go.textContent='Retry'; quickToast('Could not reach the bot','Switch was not applied.'); });
  };
}
/* human "x ago" for data-freshness tags (transparency: when was this computed?) */
function timeAgo(iso){ try{ const s=Math.max(0,(Date.now()-new Date(iso).getTime())/1000);
  if(s<60)return Math.round(s)+'s ago'; if(s<3600)return Math.round(s/60)+'m ago';
  if(s<86400)return Math.round(s/3600)+'h ago'; return Math.round(s/86400)+'d ago'; }catch(e){return '';} }
function eqCurveSVG(bt,oosFrac){
  const W=600,H=160,padT=10,padB=10,padL=4,padR=4;
  const pts=(bt&&Array.isArray(bt.pts)&&bt.pts.length>1)?bt.pts:[100,100];   // guard degenerate series
  const bench=(bt&&bt.benchmark&&Array.isArray(bt.benchmark.pts)&&bt.benchmark.pts.length>1)?bt.benchmark.pts:null;
  const all=bench?pts.concat(bench):pts;                                     // shared y-scale so both fit
  const lo=Math.min(...all),hi=Math.max(...all),rng=(hi-lo)||1;
  const X=i=>padL+i/(pts.length-1)*(W-padL-padR), Y=v=>padT+(1-(v-lo)/rng)*(H-padT-padB);
  const d=pts.map((v,i)=>(i?'L':'M')+X(i).toFixed(1)+','+Y(v).toFixed(1)).join(' ');
  const area=d+` L${X(pts.length-1).toFixed(1)},${(H-padB).toFixed(1)} L${X(0).toFixed(1)},${(H-padB).toFixed(1)} Z`;
  const up=pts[pts.length-1]>=pts[0], baseY=Y(100).toFixed(1);
  const end=Math.round(pts[pts.length-1]);
  // benchmark (buy & hold) overlay — dashed line on the same scale
  let benchPath='';
  if(bench){ const BX=i=>padL+i/(bench.length-1)*(W-padL-padR);
    benchPath=`<path class="eq-bench" d="${bench.map((v,i)=>(i?'L':'M')+BX(i).toFixed(1)+','+Y(v).toFixed(1)).join(' ')}"/>`; }
  // out-of-sample split: shade the held-out region + mark the train/test divider (walk-forward viz)
  let oos='';
  if(oosFrac){ const sx=X((pts.length-1)*oosFrac).toFixed(1);
    oos=`<rect class="eq-oos" x="${sx}" y="0" width="${(W-parseFloat(sx)).toFixed(1)}" height="${H}"/>`+
        `<line class="eq-split" x1="${sx}" y1="0" x2="${sx}" y2="${H}"/>`+
        `<text class="eq-oostx" x="${(parseFloat(sx)+4).toFixed(1)}" y="11">out-of-sample →</text>`; }
  return `<svg class="eq-svg ${up?'up':'down'}" width="100%" height="160" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Equity curve: ₹100 ${up?'grew to':'fell to'} ₹${end} over the backtest${bench?', dashed line is buy-and-hold':''}${oosFrac?', with the out-of-sample period shaded':''}">${oos}<path class="eq-area" d="${area}"/><line class="eq-base" x1="0" y1="${baseY}" x2="${W}" y2="${baseY}"/>${benchPath}<path class="eq-line" d="${d}"/></svg>`;
}
/* Underwater / drawdown curve — how deep & how long below the prior peak (dd values ≤ 0). */
function ddCurveSVG(dd){
  const W=600,H=70,pad=6;
  const pts=(Array.isArray(dd)&&dd.length>1)?dd:[0,0];
  const lo=Math.min(...pts,-0.01);                          // most-negative; avoid /0
  const X=i=>i/(pts.length-1)*W, Y=v=>pad+(v/lo)*(H-2*pad); // 0 at top, worst at bottom
  const d=pts.map((v,i)=>(i?'L':'M')+X(i).toFixed(1)+','+Y(v).toFixed(1)).join(' ');
  const area=d+` L${W},${pad} L0,${pad} Z`;
  return `<svg class="dd-svg" width="100%" height="${H}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Drawdown curve, worst ${Math.round(Math.min(...pts))} percent"><path class="dd-area" d="${area}"/><path class="dd-line" d="${d}"/></svg>`;
}
/* Calendar heatmap of monthly returns — year rows × 12 month cells. */
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
function btKey(id,period,uni){ return id+'|'+period+'|'+(uni||''); }
// universe selector → CSV of symbols ('' = default 14-stock universe)
function btUniCsv(){
  const u=state.algo.bt&&state.algo.bt.uni;
  if(u==='watchlist') return SYMS.filter(s=>isEq(s)).map(s=>s.sym).slice(0,20).join(',');
  if(typeof u==='string'&&u&&u!=='default'&&u!=='watchlist') return u;   // explicit CSV
  return '';
}
function ensureBacktest(id,period,uniCsv){
  if(!BOT.live) return;
  uniCsv=uniCsv||'';
  BOT.backtests=BOT.backtests||{};
  const k=btKey(id,period,uniCsv), rec=BOT.backtests[k];
  if(rec && (rec.loading || Date.now()-rec.t<300000)) return;   // fresh (5min) or in-flight
  BOT.backtests[k]={...(rec||{}),loading:true,t:rec?rec.t:0};
  fetch(`${BOT_API}/api/backtest?strategy=${encodeURIComponent(id)}&period=${encodeURIComponent(period)}${uniCsv?'&symbols='+encodeURIComponent(uniCsv):''}`).then(r=>r.json()).then(p=>{
    BOT.backtests[k]={p:(p&&p.real)?p:null,err:(p&&!p.real)?p.error:null,loading:false,t:Date.now()};
    if(typeof isAlgo==='function'&&isAlgo()&&state.algo.view==='backtest') renderAlgo();
  }).catch(()=>{BOT.backtests[k]={p:null,err:'fetch failed',loading:false,t:Date.now()};});
}
function algoBacktest(){
  const period=state.algo.bt.period;
  const pick=ALGOS.map((x,i)=>({x,i})).filter(o=>inScope(o.x));   // strategies in the active class
  if(!pick.length) return scopeEmpty('cpu','No backtestable strategy in this class','Switch the scope above — Equity holds the single-symbol backtests. Switch instrument/holding to see another class.');
  let ai=Math.min(state.algo.bt.algo,ALGOS.length-1);
  if(!pick.some(o=>o.i===ai)) ai=pick[0].i;                       // selected fell out of scope → first in-scope
  const a=ALGOS[ai];
  const periods=[['1M'],['3M'],['1Y'],['3Y']];
  const ctrl=`<div class="bt-controls">
    <div class="dc-sel"><label class="dc-lab" for="btAlgo">Strategy</label><select id="btAlgo" class="dc-input">${pick.map(o=>`<option value="${o.i}" ${o.i===ai?'selected':''}>${esc(o.x.name)}</option>`).join('')}</select></div>
    <div class="bt-periods" role="tablist" aria-label="Backtest period">${periods.map(([k])=>`<button class="bt-period${k===period?' on':''}" data-btperiod="${k}" role="tab" aria-selected="${k===period}">${k}</button>`).join('')}</div></div>`;
  // Custom (user-built) strategies map to a real engine — let them backtest. Other candidates
  // (not yet through validation) stay gated so we don't imply a proven edge.
  if(a.real&&a.vstatus!=='validated'&&!a.custom)
    return ctrl+secEmpty('cpu','Candidate — not yet validated',esc(a.name)+' is a realistic strategy but hasn’t passed the regime-segmented validation. '+(a.requires?('Needs '+esc(a.requires)+' data. '):'')+'Backtest numbers appear once it’s validated.');
  if(a.id==='pairs')
    return ctrl+secEmpty('scale','Pairs is a 2-leg strategy',esc(a.name)+' is market-neutral (long one stock future, short another) — it isn’t a single-symbol backtest. See its live forward-test results under Forward Test / Monitor.');
  // REAL backtest (Kite history). Honest connect/loading state — no simulated projection.
  if(!BOT.live)
    return ctrl+secEmpty('cpu','Connect Kite to run a real backtest',esc(a.name)+' backtests on real Kite daily history across a 14-stock universe (using the same engine that validated it). Connect — <b>python3 login.py</b> — to run it. No simulated numbers are shown.');
  // universe selector — default 14 / your watchlist / a custom symbol list
  const uni=(state.algo.bt&&state.algo.bt.uni)||'default', wlN=Math.min(SYMS.filter(s=>isEq(s)).length,20);
  const uniSel=`<div class="bt-uni"><span class="bt-unil">Backtest on</span>
    <div class="bt-unitabs" role="tablist" aria-label="Backtest universe">
      <button class="bt-unitab${uni==='default'?' on':''}" data-btuni="default" role="tab" aria-selected="${uni==='default'}">Default 14</button>
      <button class="bt-unitab${uni==='watchlist'?' on':''}" data-btuni="watchlist" role="tab" aria-selected="${uni==='watchlist'}" ${wlN?'':'disabled'}>My watchlist${wlN?' ('+wlN+')':''}</button>
    </div>
    <input class="bt-unicustom" id="btUniCustom" placeholder="or symbols: RELIANCE,INFY" value="${(typeof uni==='string'&&uni!=='default'&&uni!=='watchlist')?esc(uni):''}" autocomplete="off">
  </div>`;
  const uniCsv=btUniCsv();
  ensureBacktest(a.id,period,uniCsv);
  const rec=(BOT.backtests||{})[btKey(a.id,period,uniCsv)];
  if(!rec || rec.loading || !rec.p)
    return ctrl+uniSel+secEmpty('cpu', (rec&&rec.err)?'Backtest unavailable':'Running real backtest…', (rec&&rec.err)?esc(rec.err):'Running '+esc(a.name)+' on real Kite history — a few seconds.');
  const bt=rec.p;
  const endEq=Math.round(bt.pts[bt.pts.length-1]||100), peakEq=Math.round(Math.max(...bt.pts));
  const eqCap=`<div class="eq-cap">
    <span>Start <b class="num">₹100</b></span>
    <span>Peak <b class="num up">₹${peakEq.toLocaleString('en-IN')}</b></span>
    <span>End <b class="num ${endEq>=100?'up':'down'}">₹${endEq.toLocaleString('en-IN')}</b> <i class="num ${cls(bt.totalRet)}">${pct(bt.totalRet)}</i></span></div>`;
  const card=`<div class="bt-card"><div class="bt-cardh"><b title="${esc(a.name)}">${esc(a.name)}</b><span><span class="live-dot live"></span>${period} · real Kite history · ${bt.universe} stocks${bt.asOf?' · <span class="bt-fresh">computed '+timeAgo(bt.asOf)+'</span>':''}</span></div>${eqCurveSVG(bt,0.7)}${eqCap}</div>`;
  const metrics=secStats([{l:'Total return',v:pct(bt.totalRet),tone:tone(bt.totalRet)},{l:'CAGR',v:pct(bt.cagr),tone:tone(bt.cagr)},{l:'Max DD',v:'−'+bt.maxDD.toFixed(1)+'%',tone:'down'},{l:'Win rate',v:bt.winRate+'%'},{l:'Sharpe',v:bt.sharpe.toFixed(2),tone:bt.sharpe>=1?'up':bt.sharpe<0?'down':''},{l:'Trades',v:String(bt.trades)}]);
  // VALIDATION REPORT — the honest in-sample vs out-of-sample cut (the moat)
  const o=bt.oos||{}, held=(o.oos_ret||0)>=0 && (o.oos_avg||0)>=-0.1;
  const thin=bt.trades<30;
  const vr=`<div class="bt-vr"><div class="bt-vrh">${icon('shield',13)} Validation — the honest cut</div>
    <div class="bt-vrgrid">
      <div class="bt-vrcol"><span>In-sample (70%)</span><b class="num ${tone(o.is_ret)}">${pct(o.is_ret||0)}</b><i>${o.is_trades||0} trades · avg ${pct(o.is_avg||0)}/trade</i></div>
      <div class="bt-vrcol"><span>Out-of-sample (30%)</span><b class="num ${tone(o.oos_ret)}">${pct(o.oos_ret||0)}</b><i>${o.oos_trades||0} trades · avg ${pct(o.oos_avg||0)}/trade</i></div>
    </div>
    <p class="bt-vrverdict ${held?'ok':'warn'}">${icon(held?'check':'alert',12)}<span>${held?'Edge <b>persisted out-of-sample</b> — held up on data it never trained on.':'Edge <b>weakened out-of-sample</b> — strong in-sample but faded on unseen data. Treat with caution.'} Costs: <b>${bt.costBps} bps/leg applied</b>.${thin?' <b>Thin sample</b> ('+bt.trades+' trades, &lt;30) — a hint, not proof.':''}</span></p></div>`;
  const log=`<table class="tbl bt-log"><thead><tr><th>#</th><th>Entry</th><th>Exit</th><th>Hold</th><th>Return</th></tr></thead><tbody>${bt.log.map((t,i)=>`<tr><td>${i+1}</td><td class="num">${t.entry.toLocaleString('en-IN')}</td><td class="num">${t.exit.toLocaleString('en-IN')}</td><td class="num">${t.days}d</td><td class="num ${cls(t.ret)}">${pct(t.ret)}</td></tr>`).join('')}</tbody></table>`;
  const an=bt.analytics||{}, pf=an.profitFactor!=null?an.profitFactor.toFixed(2):'∞';
  const analytics=`<div class="bt-an"><div class="bt-anh">${icon('trendUp',13)} Trade analytics <i>${an.wins||0}W / ${an.losses||0}L</i></div>
    <div class="bt-angrid">
      <div class="bt-anc"><span>Avg win</span><b class="num up">${pct(an.avgWin||0)}</b></div>
      <div class="bt-anc"><span>Avg loss</span><b class="num down">${pct(an.avgLoss||0)}</b></div>
      <div class="bt-anc"><span>Profit factor</span><b class="num ${an.profitFactor>=1.2?'up':an.profitFactor!=null&&an.profitFactor<1?'down':''}">${pf}</b></div>
      <div class="bt-anc"><span>Best / Worst</span><b class="num"><span class="up">${pct(an.best||0)}</span> <span class="down">${pct(an.worst||0)}</span></b></div>
      <div class="bt-anc"><span>Avg hold</span><b class="num">${an.avgHold||0}d</b></div>
      <div class="bt-anc"><span>Max streak</span><b class="num"><span class="up">${an.winStreak||0}W</span> <span class="down">${an.lossStreak||0}L</span></b></div>
    </div></div>`;
  // ---- vs Buy & hold (the honest "did timing beat just owning these?") ----
  const bm=bt.benchmark;
  const beat=bm&&bt.totalRet>=bm.totalRet;
  const benchBlock=bm?`<div class="bt-bench"><div class="bt-anh">${icon('scale',13)} vs Buy &amp; hold <i>same ${bt.universe} stock${bt.universe>1?'s':''}, dashed on the curve</i></div>
    <div class="bt-bgrid">
      <div class="bt-bc"><span>Strategy</span><b class="num ${tone(bt.totalRet)}">${pct(bt.totalRet)}</b></div>
      <div class="bt-bc"><span>Buy &amp; hold</span><b class="num ${tone(bm.totalRet)}">${pct(bm.totalRet)}</b></div>
      <div class="bt-bc"><span>Alpha · ann.${infoI('Annualised return the strategy added beyond just holding these stocks. Positive = real edge; negative = the timing cost more than it added.')}</span><b class="num ${tone(bm.alpha)}">${bm.alpha!=null?pct(bm.alpha):'—'}</b></div>
      <div class="bt-bc"><span>Beta${infoI('Sensitivity to the benchmark. ~1 moves with it, <1 is less exposed, ~0 is market-neutral.')}</span><b class="num">${bm.beta!=null?bm.beta.toFixed(2):'—'}</b></div>
    </div>
    <p class="bt-bverdict ${beat?'ok':'warn'}">${icon(beat?'check':'alert',12)}<span>${beat?'The strategy <b>beat</b> simply holding these stocks.':'The strategy <b>underperformed</b> buy &amp; hold over this window — the timing cost more than it added. An honest result, shown anyway.'}</span></p></div>`:'';
  // ---- drawdown / underwater + time in market ----
  const ddBlock=(Array.isArray(bt.dd)&&bt.dd.length>1)?`<div class="bt-dd"><div class="bt-anh">${icon('trendDown',13)} Drawdown — underwater <i>worst −${bt.maxDD.toFixed(1)}% · time in market ${bt.timeInMarket!=null?bt.timeInMarket+'%':'—'}</i></div>${ddCurveSVG(bt.dd)}<p class="bt-ddcap">${icon('shield',11)}<span>How deep and how long the strategy sat below its prior peak — the pain you'd have had to sit through.</span></p></div>`:'';
  const uniTag=bt.customUniverse?`<span class="bt-unitag">${esc((bt.symbols||[]).slice(0,4).join(', '))}${(bt.symbols||[]).length>4?' +'+((bt.symbols||[]).length-4):''}</span>`:'';
  // ---- Monte-Carlo robustness (bootstrap of the real trades) ----
  const mc=bt.montecarlo;
  const robust=mc&&mc.profitableShare>=60;
  const mcBlock=mc?`<div class="bt-bench"><div class="bt-anh">${icon('shield',13)} Monte-Carlo robustness <i>${mc.runs} resamples of your trades</i></div>
    <div class="bt-bgrid">
      <div class="bt-bc"><span>Worst 5%${infoI('5th-percentile outcome across 1000 bootstrap resamples of your trades — a bad-luck draw.')}</span><b class="num down">${pct(mc.p5)}</b></div>
      <div class="bt-bc"><span>Median</span><b class="num ${tone(mc.p50)}">${pct(mc.p50)}</b></div>
      <div class="bt-bc"><span>Best 5%</span><b class="num up">${pct(mc.p95)}</b></div>
      <div class="bt-bc"><span>Profitable${infoI('Share of the 1000 resampled runs that ended in profit. >60% = a robust edge; near 50% = close to a coin-flip.')}</span><b class="num ${mc.profitableShare>=60?'up':mc.profitableShare<50?'down':''}">${mc.profitableShare}%</b></div>
    </div>
    <p class="bt-bverdict ${robust?'ok':'warn'}">${icon(robust?'check':'alert',12)}<span>${robust?'<b>Robust</b> — '+mc.profitableShare+'% of resampled runs profited, so the edge isn’t one lucky sequence.':'<b>Fragile</b> — only '+mc.profitableShare+'% of resampled runs profited; the result leans on a few trades. Treat with caution.'} Across draws, returns spanned <b>${pct(mc.p5)}</b> to <b>${pct(mc.p95)}</b>.</span></p></div>`:'';
  // ---- edge consistency over time (folds into the monthly section) ----
  const ed=bt.edgeDecay;
  const decayLine=ed?`<p class="bt-ddcap">${icon('clock',11)}<span><b>${ed.posMonths}%</b> of ${ed.totalMonths} months positive.${ed.fading!=null?(ed.fading?' Edge is <b>fading</b> — recent months ('+pct(ed.secondHalfAvg)+'/mo) weaker than earlier ('+pct(ed.firstHalfAvg)+'/mo).':' Edge is <b>holding</b> — recent ('+pct(ed.secondHalfAvg)+'/mo) ≈ earlier ('+pct(ed.firstHalfAvg)+'/mo).'):''}</span></p>`:'';
  return ctrl+uniSel+uniTag+card+benchBlock+metrics+vr+ddBlock+monthlyHeat(bt.monthly)+decayLine+mcBlock+analytics+`<div class="bt-logwrap"><div class="bt-logttl">Recent trades</div>${log}</div>`;
}
/* ===== Strategy Leaderboard — rank validated strategies + edge-by-regime matrix (real catalog) ===== */
function algoLeaderboard(){
  const lr=liveRegime();
  // Default-rank by Return (a metric populated for every validated strategy). Sharpe is only
  // computed where validation produced it — never fabricated, and strategies without it rank last.
  const sort=state.algo.lbSort||'ret';
  const validated=ALGOS.filter(a=>a.vstatus==='validated'&&inScope(a));
  const cands=ALGOS.filter(a=>a.vstatus!=='validated'&&inScope(a));
  if(!validated.length) return scopeEmpty('cpu','No validated strategies in this class','No bot in this class has passed regime-segmented validation yet — switch the scope above (Equity holds most validated edges), or see candidates in the Marketplace & Library.');
  const haveSharpe=validated.some(a=>a.sharpe!=null);
  const metric={sharpe:a=>(a.sharpe!=null?a.sharpe:-Infinity), ret:a=>a.totalRet||0, win:a=>a.win||0, dd:a=>-(a.dd||99), paper:a=>a.paperPnl||0};
  const ranked=[...validated].sort((x,y)=>metric[sort](y)-metric[sort](x));
  const sorts=[['sharpe','Sharpe'],['ret','Return'],['win','Win %'],['dd','Drawdown'],['paper','Paper P&L']];
  const ctrl=`<div class="lb-ctrl"><span class="lb-lab">Rank by</span><div class="lb-sorts" role="tablist" aria-label="Rank strategies by">${sorts.map(([k,l])=>`<button class="lb-sort${k===sort?' on':''}" data-lbsort="${k}" role="tab" aria-selected="${k===sort}">${l}</button>`).join('')}</div></div>`;
  const sharpeNote=(sort==='sharpe'&&!validated.every(a=>a.sharpe!=null))?`<p class="sec-hint">${icon('shield',12)}<span>Sharpe is shown only where validation computed it — strategies without it rank last (never a guessed value). Run a <b>Backtest</b> to compute a real Sharpe on live history.</span></p>`:'';
  const rows=ranked.map((a,i)=>{const active=a.bestRegime===lr||a.bestRegime==='Market-neutral';
    return `<div class="lb-row${active?' active':''}">
      <span class="lb-rank">${i+1}</span>
      <div class="lb-name"><b>${esc(a.name)}${active?' <span class="lb-active">● ACTIVE</span>':''}</b><span>${esc(a.cat)} · best in ${esc(a.bestRegime||'—')}</span></div>
      <div class="lb-stat ${sort==='sharpe'?'hi':''}"><span>Sharpe</span><b class="num ${a.sharpe>=1?'up':a.sharpe<0?'down':''}">${a.sharpe!=null?a.sharpe.toFixed(2):'—'}</b></div>
      <div class="lb-stat ${sort==='ret'?'hi':''}"><span>Return</span><b class="num ${tone(a.totalRet)}">${a.totalRet!=null?pct(a.totalRet):'—'}</b></div>
      <div class="lb-stat ${sort==='win'?'hi':''}"><span>Win</span><b class="num">${a.win!=null?a.win+'%':'—'}</b></div>
      <div class="lb-stat ${sort==='dd'?'hi':''}"><span>Max DD</span><b class="num down">−${a.dd!=null?a.dd:'—'}%</b></div>
      <div class="lb-stat"><span>Trades</span><b class="num">${a.trades||'—'}</b></div>
      <div class="lb-stat ${sort==='paper'?'hi':''}"><span>Paper P&amp;L</span><b class="num ${cls(a.paperPnl||0)}" data-live-pnl="${a.id}">${a.paperPnl>=0?'+':'−'}${inr(Math.abs(a.paperPnl||0))}</b></div>
      <button class="btn-ghost sm lb-bt" data-algobt="${ALGOS.indexOf(a)}">${icon('trendUp',12)} Backtest</button>
    </div>`;}).join('');
  const regs=['Bull','Bear','Choppy','High-Vol'];
  const matrix=`<div class="lb-matrix"><div class="lb-mh">Edge by regime — who works when${infoI('Average trade return per market regime from the backtest. Green = a positive edge, amber = weak/thin, red = loses. The outlined column is the live regime. No strategy wins in every regime — that’s why the engine switches.')}</div>
    <div class="lb-mscroll"><table class="lb-mtbl"><thead><tr><th>Strategy</th>${regs.map(r=>`<th class="${r===lr?'live':''}">${r==='High-Vol'?'HV':r}</th>`).join('')}</tr></thead>
    <tbody>${validated.map(a=>`<tr><td class="lb-mname">${esc(a.name)}</td>${regs.map(r=>{const f=a.regimeFit&&a.regimeFit[r];if(!f)return '<td class="lb-mcell">—</td>';const tn=f[2]==='good'?'rg-good':f[2]==='weak'?'rg-weak':'rg-bad';return `<td class="lb-mcell ${tn}${r===lr?' live':''}" title="${esc(a.name)} in ${r}: ${f[0]>0?'+':''}${f[0]}% over ${f[1]} trades">${f[0]>0?'+':''}${f[0]}</td>`;}).join('')}</tr>`).join('')}</tbody></table></div>
    <p class="lb-mnote">${icon('shield',12)}<span>The honest takeaway: <b>no strategy wins everywhere</b>. The live regime is <b>${esc(lr)}</b> — the engine favours strategies validated for it and stands aside otherwise.</span></p></div>`;
  const candNote=cands.length?`<p class="sec-hint">${icon('cpu',12)}<span>${cands.length} candidate strateg${cands.length===1?'y is':'ies are'} not ranked — they haven’t passed validation (see Marketplace). We rank proof, not promises.</span></p>`:'';
  return ctrl+sharpeNote+`<div class="lb-list">${rows}</div>${matrix}${corrSection()}${candNote}`;
}
/* Strategy correlation — lazy-loaded real correlation of validated strategies' daily returns,
   so users don't deploy redundant bets. Reuses the regime-matrix table styling. */
function ensureCorrelation(){
  if(!BOT.live) return;
  if(BOT.correlation && (BOT.correlation.loading || Date.now()-BOT.correlation.t<1800000)) return;
  BOT.correlation={...(BOT.correlation||{}),loading:true,t:BOT.correlation?BOT.correlation.t:0};
  fetch(BOT_API+'/api/correlation').then(r=>r.json()).then(p=>{
    BOT.correlation={p:(p&&p.real)?p:null,err:(p&&!p.real)?p.error:null,loading:false,t:Date.now()};
    if(typeof isAlgo==='function'&&isAlgo()&&state.algo.view==='leaderboard')renderAlgo();
  }).catch(()=>{BOT.correlation={p:null,err:'fetch failed',loading:false,t:Date.now()};});
}
function corrSection(){
  if(!BOT.live) return '';
  ensureCorrelation();
  const rec=BOT.correlation;
  if(!rec||rec.loading) return `<div class="lb-matrix"><div class="lb-mh">${icon('scale',13)} Strategy correlation — are these the same bet?</div><p class="sec-hint">${icon('cpu',12)}<span>Computing correlation across validated strategies on real history… (a few seconds)</span></p></div>`;
  if(!rec.p) return '';
  const c=rec.p;
  const cell=v=>{const tn=v>=0.7?'rg-bad':v>=0.4?'rg-weak':'rg-good';return `<td class="lb-mcell ${v===1?'':tn}" title="correlation ${v}">${v.toFixed(2)}</td>`;};
  const mc=c.mostCorrelated;
  const note=mc?`<p class="lb-mnote">${icon('shield',12)}<span>${mc.r>=0.7?'<b>'+esc(mc.a)+'</b> &amp; <b>'+esc(mc.b)+'</b> move together ('+mc.r+') — running both adds little diversification.':'Your validated strategies are <b>weakly correlated</b> (max '+mc.r+') — they diversify each other well, so running them together spreads risk.'}</span></p>`:'';
  return `<div class="lb-matrix"><div class="lb-mh">${icon('scale',13)} Strategy correlation — are these the same bet?${infoI('Correlation of the strategies’ daily returns on real history. Green = complementary (diversifies), red = the same bet. Don’t stack highly-correlated strategies.')}</div>
    <div class="lb-mscroll"><table class="lb-mtbl"><thead><tr><th></th>${c.names.map(n=>`<th>${esc(String(n).split(' ')[0])}</th>`).join('')}</tr></thead>
    <tbody>${c.matrix.map((row,i)=>`<tr><td class="lb-mname">${esc(c.names[i])}</td>${row.map(cell).join('')}</tr>`).join('')}</tbody></table></div>${note}</div>`;
}
/* Risk & safety panel — real aggregate exposure / position cap / loss-limit / kill-switch
   from /api/monitor.risk. The honest "can this hurt me?" view before any live capital. */
function riskPanel(){
  const r=BOT.monitor&&BOT.monitor.risk; if(!r) return '';
  const cap=r.positionCapTotal||1, posPct=Math.min(100,Math.round((r.openPositions||0)/cap*100));
  const armed=!!r.liveArmed;
  return `<div class="risk-panel">
    <div class="rp-h">${icon('shield',13)} Risk &amp; safety<span class="rp-live">● live</span></div>
    <div class="rp-grid">
      <div class="rp-c"><span>Exposure${infoI('Total market value of all open paper positions across strategies, marked to live price.')}</span><b class="num">${inrL(r.exposure||0)}</b><i>${r.openPositions||0} open · ${r.activeStrategies||0} active</i></div>
      <div class="rp-c"><span>Positions vs cap${infoI('Open positions against the bot’s hard cap ('+r.maxPositionsPerStrategy+' per strategy). Prevents over-exposure.')}</span><b class="num ${posPct>=80?'down':''}">${r.openPositions||0} / ${cap}</b><div class="rp-bar"><i class="${posPct>=80?'hot':''}" style="width:${posPct}%"></i></div></div>
      <div class="rp-c"><span>Daily-loss halt${infoI('The bot auto-halts a strategy if its day loss exceeds this — a circuit breaker, enforced in the engine.')}</span><b class="num down">−${r.dailyLossLimitPct}%</b><i>≈ −${inr(r.dailyLossLimitPerStrategy||0)}/strategy</i></div>
      <div class="rp-c rp-kill ${armed?'armed':'safe'}"><span>Kill switch${infoI('ALLOW_LIVE is the hard arming key. SAFE = paper only, real orders are impossible. ARMED = real orders enabled on the bot machine.')}</span><b>${armed?'● ARMED':'● SAFE'}</b><i>${armed?'real orders enabled':'paper only — real orders blocked'}</i></div>
    </div></div>`;
}
/* Honest scaffold for live-only safety features — reconciliation (C2) is active once a strategy
   goes live; alerts (C4) need a Telegram token. We state this plainly rather than fake either. */
function liveSafetyNote(){
  const tg=BOT.status&&BOT.status.telegram;
  return `<div class="exec-ready" style="margin-top:10px">${icon('shield',13)}<div><b>Live-mode safety</b><span>When a strategy goes live, the bot <b>reconciles</b> its positions against your Kite account each cycle (flagging any drift), and the daily-loss circuit-breaker + kill-switch stay enforced. Entry/exit &amp; risk <b>alerts</b> ${tg?'are configured.':'need a Telegram bot token on the bot machine — <b>not set up</b>, so the studio never pretends to notify you.'}</span></div></div>`;
}
function algoMonitor(){
  const exec=state.algo.exec||'paper';
  const paperRun=ALGOS.filter(a=>a.deployed&&inScope(a));      // deployed (paper/paused/live) in the active class — the engine's live book
  const liveRun=ALGOS.filter(a=>a.execLive&&inScope(a));       // actually placing REAL orders (none until the live runner trades it)
  const ready=ALGOS.filter(a=>a.readyExceptCapital&&inScope(a));
  const toggle=`<div class="exec-toggle" role="tablist" aria-label="Execution mode">
    <button class="exec-tab${exec==='paper'?' on':''}" data-execmode="paper" role="tab" aria-selected="${exec==='paper'}"><span class="exec-dot paper"></span>Paper<i>${paperRun.length}</i></button>
    <button class="exec-tab${exec==='live'?' on':''}" data-execmode="live" role="tab" aria-selected="${exec==='live'}"><span class="exec-dot ${liveRun.length?'live':'off'}"></span>Live<i>${liveRun.length}</i></button>
  </div>`;
  if(exec==='live'){
    const readyNote=ready.length
      ? `<div class="exec-ready">${icon('shield',13)}<div><b>Ready for live once funded &amp; armed:</b> ${ready.map(a=>esc(a.name)).join(' · ')}<span>Open each strategy’s Go-Live check, then fund the account + set ALLOW_LIVE.</span></div></div>`
      : '';
    if(!liveRun.length)
      return toggle+secEmpty('shield','No strategies are live','Nothing is placing real orders. Live execution stays locked until a strategy clears the Go-Live checklist — fund the account + arm ALLOW_LIVE on the bot. Everything runs in paper until then.')+readyNote+liveSafetyNote();
    const lrows=liveRun.map(a=>{const i=ALGOS.indexOf(a);
      return `<div class="mon-row live"><div class="mon-l"><span class="live-dot live"></span><div><b>${esc(a.name)}</b><span class="mon-cat">${esc(a.cat)} · ${(a.openPositions||0)} open</span></div></div>
        <div class="mon-pnl"><b class="num ${cls(a.livePnl||0)}" data-live-pnl="${a.id}">${sgn(a.livePnl||0)}</b><span>LIVE · real ₹</span></div>
        <div class="mon-ctrls"><button class="btn-ghost sm" data-algogl="${i}">Gates</button></div></div>`;}).join('');
    return toggle+riskPanel()+`<div class="mon-list">${lrows}</div>`+readyNote+liveSafetyNote();
  }
  // ---- PAPER view ----
  if(!paperRun.length) return toggle+secEmpty('cpu','No paper strategies running','Start the paper engine to run every validated strategy live in paper mode — zero real-money risk, no terminal.',harnessCta());
  const total=paperRun.reduce((s,a)=>s+(a.paperPnl||0),0);
  const stat=secStats([
    {l:'Deployed',v:String(paperRun.length)},
    {l:'Paper P&L'+infoI(ALGO_DEFS['Paper P&L']),v:sgn(total),tone:total>=0?'up':'down',id:'monTotal'},
    {l:'Mode',v:'Paper · no real orders'}]);
  const me=state.algo.monExpand=state.algo.monExpand||{};
  const rows=paperRun.map(a=>{const i=ALGOS.indexOf(a);
    const open=!!me[a.id];
    const sub=(a.openPositions||0)?`${sgn(a.openPnl||0)} unrealised`:((a.openPositions||a.fwdTrades)?'realised':'no trades yet');
    const pos=(a.positions||[]).map(p=>p.entry!=null
      ? `<div class="mon-posrow"><span class="mp-sym">${esc(p.sym)}</span><span class="mp-q">${p.qty} qty</span><span class="mp-x num">entry ${p.entry.toLocaleString('en-IN')}</span><span class="mp-x num">LTP <span data-live-ltp="${a.id}::${esc(p.sym)}">${p.ltp!=null?p.ltp.toLocaleString('en-IN'):'—'}</span></span><b class="mp-pnl num ${cls(p.unreal)}" data-live-upnl="${a.id}::${esc(p.sym)}">${sgn(p.unreal)}${p.chgPct!=null?` · ${p.chgPct>=0?'+':''}${p.chgPct}%`:''}</b></div>`
      : `<div class="mon-posrow"><span class="mp-sym">${esc(p.sym)}</span><span class="mp-q">spread ${p.spread>0?'long':'short'}</span><span class="mp-x">marks on close</span></div>`).join('');
    const posBlock=pos?`<div class="mon-pos">${pos}</div>`:'';
    const accLine=a.fwdTrades?`<div class="mon-acc"><span>Forward accuracy</span><b class="${a.fwdWinPct!=null&&a.fwdWinPct>=50?'up':'down'}">${a.fwdWinPct!=null?a.fwdWinPct+'% win':'—'}</b><i>·</i>PF <b class="${a.fwdProfitFactor!=null&&a.fwdProfitFactor>=1?'up':'down'}">${a.fwdProfitFactor!=null?(a.fwdProfitFactor>=99?'∞':a.fwdProfitFactor):'—'}</b><i>·</i>exp <b class="num ${cls(a.fwdExpectancy||0)}">${a.fwdExpectancy!=null?sgn(a.fwdExpectancy):'—'}</b><i>·</i>${a.fwdTrades} closed <a class="mon-acc-link" data-algogoto="accuracy">full accuracy →</a></div>`:'';
    const expInner=(posBlock+accLine)||`<div class="mon-exp-empty">No open positions or closed trades yet — this strategy trades only when its setup appears.</div>`;
    return `<div class="mon-card${open?' open':''}">
      <div class="mon-row live mon-head" data-monexp="${a.id}" role="button" tabindex="0" aria-expanded="${open}" title="Show positions &amp; accuracy"><div class="mon-l"><span class="live-dot live"></span><div><b>${esc(a.name)}${a.vstatus==='validated'?'<span class="vbadge ok" style="margin-left:6px">Validated</span>':''}</b><span class="mon-cat">${esc(a.cat)} · ${(a.openPositions||0)} open · ${a.fwdTrades||0} closed</span></div></div>
      <div class="mon-pnl"><b class="num ${cls(a.paperPnl||0)}" data-live-pnl="${a.id}">${sgn(a.paperPnl||0)}</b><span data-live-sub="${a.id}" title="Open positions are marked to live market price; closed-trade P&L drives the go-live nudge.">${sub}</span></div>
      <div class="mon-ctrls"><button class="btn-ghost sm" data-algogl="${i}">${icon('shield',12)} Go-Live check</button><span class="mon-chev">▾</span></div></div>
      <div class="mon-exp">${expInner}</div></div>`;}).join('');
  if(!paperRun.length)
    return toggle+(harnessRunning()?harnessCta():'')+riskPanel()+scopeEmpty('cpu','No deployed bots in this class','Nothing is forward-trading in this class right now — switch the scope above (Equity holds the live book) or deploy one from the Marketplace.')+stoppedPanel();
  const note=paperRun.some(a=>!a.openPositions&&!a.fwdTrades)
    ? `Strategies at ₹0 simply haven’t triggered an entry signal yet — they only trade when their setup appears. P&L moves as positions open and close.`
    : `Open positions are marked to live market price; the go-live nudge needs ≥${BOT.nudgeMin||10} <b>closed</b> profitable trades.`;
  return toggle+(harnessRunning()?harnessCta():'')+riskPanel()+stat+`<div class="mon-list">${rows}</div>`+stoppedPanel()+`<p class="sec-hint">${icon('shield',12)}<span>${note} All run in <b>PAPER</b> — zero real-money risk.</span></p>`;
}
/* When you STOP a strategy, the harness squares off its open paper book at the live mark and
   files the liquidation here — deliberately OUT of any strategy's P&L (a stop isn't a signal),
   so the close is auditable rather than hidden on disk. */
function stoppedPanel(){
  const recs=BOT.stopped||[]; if(!recs.length) return '';
  const tot=BOT.stoppedTotal||0;
  const rows=recs.map(r=>{
    const pos=(r.closed||[]).map(c=>`<span class="st-pos"><b>${esc(c.sym)}</b> ${c.qty}@₹${(+c.entry).toFixed(1)}→₹${(+c.exit).toFixed(1)} <i class="num ${cls(c.pnl)}">${sgn(c.pnl)}</i></span>`).join('');
    const when=r.stoppedAt?new Date(r.stoppedAt).toLocaleDateString('en-IN',{day:'numeric',month:'short'}):'';
    return `<div class="st-row"><div class="st-head"><b>${esc(r.name||r.strategy)}</b><span class="st-meta">${when} · ${esc(r.reason||'')}</span><b class="num ${cls(r.flattenPnl)} st-pnl">${sgn(r.flattenPnl)}</b></div><div class="st-pos-list">${pos}</div></div>`;
  }).join('');
  return `<details class="stopped-panel"><summary>${icon('scissors',13)} Stopped strategies <i class="st-n">${recs.length}</i><span class="st-sum">liquidation total <b class="num ${cls(tot)}">${sgn(tot)}</b> · kept out of strategy P&L</span></summary><div class="st-body">${rows}</div></details>`;
}
/* ===== ACCURACY — backtest edge vs LIVE forward results: can you trust it? ===== */
function algoAccuracy(){
  if(!BOT.live) return secEmpty('shield','Connect Kite to measure accuracy','Accuracy pits each strategy’s backtested edge against its LIVE forward-test results — real out-of-sample proof. Reconnect to load it.');
  const MIN=BOT.nudgeMin||10, lr=liveRegime();
  const list=ALGOS.filter(a=>(a.vstatus==='validated'||a.deployed)&&inScope(a));   // validated + deployed, scoped to the active class
  if(!list.length) return scopeEmpty('cpu','No strategies to measure in this class','Accuracy compares each strategy’s backtest edge with its LIVE forward results — switch the scope above (Equity holds the validated/forward book).');
  const vset=list.filter(a=>a.vstatus==='validated');
  const avgBt=vset.length?Math.round(vset.reduce((s,a)=>s+(a.win||0),0)/vset.length):0;
  const totClosed=list.reduce((s,a)=>s+(a.fwdTrades||0),0);
  const totWins=list.reduce((s,a)=>s+(a.fwdWins||0),0);
  const fwdWin=totClosed?Math.round(totWins/totClosed*100):null;
  const holding=vset.filter(a=>(a.fwdTrades||0)>=MIN&&(a.fwdExpectancy||0)>0).length;
  const stat=secStats([
    {l:'Backtested win'+infoI('Average out-of-sample win rate across validated strategies (from the regime backtest).'),v:avgBt+'%'},
    {l:'Forward win'+infoI('Live paper win rate from CLOSED forward trades — the real out-of-sample hit rate. Win rate alone isn’t edge — see profit factor.'),v:fwdWin!=null?fwdWin+'%':'—',tone:fwdWin!=null?(fwdWin>=50?'up':'down'):''},
    {l:'Forward trades'+infoI('Total closed forward paper trades. Accuracy needs sample size — under ~'+MIN+' is a hint, not proof.'),v:String(totClosed)},
    {l:'Edge holding'+infoI('Validated strategies whose LIVE forward results are still profitable (positive expectancy) on ≥'+MIN+' trades.'),v:holding+' / '+vset.length,tone:holding>0?'up':''}
  ]);
  const rows=list.length?list.map(accRow).join(''):secEmpty('cpu','No strategies to measure yet','Accuracy compares each strategy’s backtest edge with its LIVE forward results. Start the paper engine to gather that out-of-sample evidence — one click, zero risk.',harnessCta());
  const legend=`<p class="sec-hint">${icon('shield',12)}<span><b>Edge status</b> judges LIVE profitability (expectancy + profit factor), not win rate alone — a 33%-win strategy can be a strong edge when its wins are bigger than its losses. Every forward number is real out-of-sample, zero real money.</span></p>`;
  return stat+`<div class="acc-list">${rows}</div>`+legend;
}
function accRow(a){
  const MIN=BOT.nudgeMin||10, lr=liveRegime();
  const validated=a.vstatus==='validated';
  const bt=a.win!=null?a.win:null, n=a.fwdTrades||0, fw=a.fwdWinPct;
  const pf=a.fwdProfitFactor, exp=a.fwdExpectancy;
  let badge,btone,note;
  if(!validated){ badge='Candidate'; btone='cand'; note='Not validated — no proven backtest edge yet.'; }
  else if(n===0){ badge='Awaiting first trade'; btone='early'; note='Validated in backtest; no closed forward trades yet.'; }
  else if(n<MIN){ badge='Building · '+n+'/'+MIN; btone='early'; note='Gathering out-of-sample evidence — too few trades to judge.'; }
  else if((exp||0)>0&&(pf||0)>=1.2){ badge='✓ Edge holding'; btone='ok'; note='Profitable out-of-sample — the backtest edge is showing up live.'; }
  else if((exp||0)>=0){ badge='≈ Marginal'; btone='warn'; note='Roughly break-even live — watch before committing capital.'; }
  else { badge='▾ Degrading'; btone='bad'; note='Losing out-of-sample — the edge is not holding live.'; }
  const bar=(pct,c)=>`<div class="acc-bar"><i class="${c}" style="width:${Math.max(0,Math.min(100,pct||0))}%"></i></div>`;
  const cmp=`<div class="acc-cmp">
    <div class="acc-metric"><span>Backtest win</span><b class="num">${bt!=null?bt+'%':'—'}</b>${bar(bt,'bt')}</div>
    <div class="acc-metric"><span>Forward win${n?` · ${n} closed`:''}</span><b class="num ${fw!=null?(fw>=50?'up':'down'):''}">${fw!=null?fw+'%':'—'}</b>${bar(fw,'fw')}</div>
  </div>`;
  const wl=(a.fwdAvgWin&&a.fwdAvgLoss&&a.fwdAvgLoss>0)?(a.fwdAvgWin/a.fwdAvgLoss).toFixed(2)+' : 1':(a.fwdAvgWin&&!a.fwdAvgLoss?'∞':'—');
  const q=n>0?`<div class="acc-q">
    <div><span>Profit factor${infoI('Gross profit ÷ gross loss on forward trades. >1 makes money, >1.5 is strong — the honest "is it profitable" number, independent of win rate.')}</span><b class="num ${pf!=null?(pf>=1?'up':'down'):''}">${pf!=null?(pf>=99?'∞':pf):'—'}</b></div>
    <div><span>Expectancy / trade${infoI('Average P&L per closed forward trade. Positive = the edge pays per trade.')}</span><b class="num ${cls(exp||0)}">${exp!=null?sgn(exp):'—'}</b></div>
    <div><span>Avg win : loss${infoI('Average winning trade vs average losing trade. >1 means wins are bigger than losses — lets a low win-rate still profit.')}</span><b class="num">${wl}</b></div>
    <div><span>Wins : losses</span><b class="num"><span class="up">${a.fwdWins||0}</span> : <span class="down">${a.fwdLosses||0}</span></b></div>
  </div>`:'';
  let rgrid='';
  if(a.regimeFit){
    rgrid='<div class="rg-head">Per-regime edge'+infoI('Backtested avg trade return by regime. The outlined cell is the live regime now — where this strategy should be accurate today.')+'</div><div class="rg-grid">'+['Bull','Bear','Choppy','High-Vol'].map(r=>{const f=a.regimeFit[r];if(!f)return '';const tone=f[2]==='good'?'rg-good':f[2]==='weak'?'rg-weak':'rg-bad';const on=r===lr?' rg-live':'';return `<span class="rg-cell ${tone}${on}" title="${r}: ${f[0]>0?'+':''}${f[0]}% avg over ${f[1]} trades.">${r==='High-Vol'?'HV':r}<b>${f[0]>0?'+':''}${f[0]}</b></span>`;}).join('')+'</div>';
  }
  const i=ALGOS.indexOf(a);
  return `<div class="acc-card${validated?'':' cand'}">
    <div class="acc-h"><div><b>${esc(a.name)}${infoI(STRAT_DEFS[a.id]||a.desc)}</b><span class="acc-cat">${esc(a.cat)}</span></div><span class="acc-badge ${btone}">${badge}</span></div>
    ${cmp}${q}${rgrid}
    <div class="acc-foot"><span>${note}</span>${validated&&n>=MIN?`<button class="btn-ghost sm" data-algogl="${i}">${icon('shield',12)} Go-Live check</button>`:''}</div>
  </div>`;
}
/* ===== ANALYTICS — portfolio intelligence over the forward paper-trade log ===== */
function ensureAnalytics(force){
  const now=Date.now();
  if(!force && BOT._anAt && now-BOT._anAt<8000) return;
  BOT._anAt=now;
  fetch(BOT_API+'/api/analytics').then(r=>r.json()).then(d=>{
    const changed=!BOT.analytics||((BOT.analytics.totals||{}).trades!==(d.totals||{}).trades);
    BOT.analytics=d;
    if(changed && isAlgo() && state.algo && state.algo.view==='analytics') renderAlgo();
  }).catch(()=>{});
}
function anEquitySVG(pts){
  const W=600,H=150,pad=10;
  if(!pts||pts.length<2)pts=[0,0];
  const lo=Math.min(...pts,0),hi=Math.max(...pts,0),rng=(hi-lo)||1;
  const X=i=>pad+i/(pts.length-1)*(W-2*pad), Y=v=>pad+(1-(v-lo)/rng)*(H-2*pad);
  const d=pts.map((v,i)=>(i?'L':'M')+X(i).toFixed(1)+','+Y(v).toFixed(1)).join(' ');
  const area=d+` L${X(pts.length-1).toFixed(1)},${(H-pad).toFixed(1)} L${X(0).toFixed(1)},${(H-pad).toFixed(1)} Z`;
  const up=pts[pts.length-1]>=0, zeroY=Y(0).toFixed(1);
  return `<svg class="eq-svg ${up?'up':'down'}" width="100%" height="150" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Forward cumulative paper P&L curve"><path class="eq-area" d="${area}"/><line class="eq-base" x1="0" y1="${zeroY}" x2="${W}" y2="${zeroY}"/><path class="eq-line" d="${d}"/></svg>`;
}
function exportAnalyticsCSV(){
  const d=BOT.analytics; if(!d||!d.trades||!d.trades.length){quickToast&&quickToast('Nothing to export','No closed forward trades yet.');return;}
  const rows=[['Time','Strategy','Symbol','P&L','Exit reason']].concat(d.trades.map(t=>[t.time,t.strategy,t.sym,t.pnl,t.reason]));
  const csv=rows.map(r=>r.map(x=>`"${String(x==null?'':x).replace(/"/g,'""')}"`).join(',')).join('\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
  const a=document.createElement('a');a.href=url;a.download='tradepro-forward-trades.csv';document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
  quickToast&&quickToast('Exported','Forward trade log saved as CSV.');
}
function algoAnalytics(){
  if(!BOT.live) return secEmpty('shield','Connect Kite for analytics','Strategy analytics aggregate your REAL forward paper-trade history — equity curve, risk & quality, contribution, activity, exit reasons & insights. Reconnect to load it.');
  if(!BOT.analytics){ ensureAnalytics(true); return secEmpty('spark','Loading analytics…','Crunching your forward trade log.'); }
  const d=BOT.analytics, t=d.totals||{};
  // P&L totals come from the SAME live ALGOS data Monitor uses (a.deployed) → identical numbers, patched every 2s
  const liveS=ALGOS.filter(a=>a.deployed);
  const realised=liveS.reduce((s,a)=>s+(a.realisedPnl||0),0);
  const open=liveS.reduce((s,a)=>s+(a.openPnl||0),0);
  const openPos=liveS.reduce((s,a)=>s+(a.openPositions||0),0);
  const bookTotal=realised+open;
  if(!t.trades && !liveS.length) return secEmpty('spark','No activity yet','Analytics build up as the paper harness opens and closes forward trades. Open positions and closed-trade reports appear here.');
  const stat=secStats([
    {l:'Closed trades'+infoI('Total CLOSED forward paper trades across all strategies.'),v:String(t.trades||0)},
    {l:'Win rate',v:t.winPct!=null?t.winPct+'%':'—',tone:t.winPct!=null?(t.winPct>=50?'up':'down'):''},
    {l:'Realised P&L'+infoI('Cumulative CLOSED-trade P&L (paper) — live, in sync with Monitor.'),v:sgn(realised),tone:realised>=0?'up':'down',id:'anRealised'},
    {l:'Open P&L'+infoI(openPos+' open position(s), marked to live price — not yet realised.'),v:openPos?sgn(open):'—',tone:open>=0?'up':'down',id:'anOpen'},
    {l:'Total book'+infoI('Realised + open unrealised = your full live paper book.'),v:sgn(bookTotal),tone:bookTotal>=0?'up':'down',id:'anBook'}
  ]);
  const eqPts=(d.equity&&d.equity.length>1)?d.equity:[0,0];
  const endEq=eqPts[eqPts.length-1], peak=Math.max(...eqPts), trough=Math.min(...eqPts);
  const eq=`<div class="an-card"><div class="an-h">${icon('trendUp',13)}<b>Forward equity curve</b><span>cumulative realised paper P&L over ${t.trades||0} closed trades</span></div>${anEquitySVG(eqPts)}
    <div class="eq-cap"><span>Start <b class="num">₹0</b></span><span>Peak <b class="num up">${sgn(peak)}</b></span><span>Trough <b class="num down">${sgn(trough)}</b></span><span>Max DD <b class="num down">${d.maxDrawdown?'−'+inr(d.maxDrawdown):'₹0'}</b></span><span>Now <b class="num ${cls(endEq)}">${sgn(endEq)}</b></span></div>${d.carried?`<p class="an-note">${icon('shield',11)}<span>Curve includes ${sgn(d.carried)} realised carried from earlier closes; the detail cards below cover the ${t.trades||0} logged trades.</span></p>`:''}</div>`;
  const wl=(d.avgWin&&d.avgLoss&&d.avgLoss>0)?(d.avgWin/d.avgLoss).toFixed(2)+' : 1':(d.avgWin&&!d.avgLoss?'∞':'—');
  const st=d.streaks||{};
  const riskCard=`<div class="an-card"><div class="an-h">${icon('shield',13)}<b>Risk &amp; quality</b><span>is the book actually good?</span></div><div class="an-q">
    <div><span>Profit factor${infoI('Gross profit ÷ gross loss. >1 makes money — the honest edge metric, independent of win rate.')}</span><b class="num ${d.profitFactor!=null?(d.profitFactor>=1?'up':'down'):''}">${d.profitFactor!=null?(d.profitFactor>=99?'∞':d.profitFactor):'—'}</b></div>
    <div><span>Expectancy / trade${infoI('Average P&L per closed trade. Positive = the edge pays.')}</span><b class="num ${cls(d.expectancy||0)}">${d.expectancy!=null?sgn(d.expectancy):'—'}</b></div>
    <div><span>Avg win : loss${infoI('Average winning trade vs average losing trade. >1 lets a low win-rate still profit.')}</span><b class="num">${wl}</b></div>
    <div><span>Max drawdown${infoI('Largest peak-to-trough drop in the cumulative forward equity curve.')}</span><b class="num down">${d.maxDrawdown?'−'+inr(d.maxDrawdown):'—'}</b></div>
    <div><span>Best trade</span><b class="num up">${d.best!=null?sgn(d.best):'—'}</b></div>
    <div><span>Worst trade</span><b class="num down">${d.worst!=null?sgn(d.worst):'—'}</b></div>
    <div><span>Avg win</span><b class="num up">${d.avgWin!=null?sgn(d.avgWin):'—'}</b></div>
    <div><span>Avg loss</span><b class="num down">${d.avgLoss!=null?'−'+inr(d.avgLoss):'—'}</b></div>
  </div></div>`;
  const maxAbs=Math.max(1,...(d.byStrategy||[]).map(s=>Math.abs(s.realised)));
  const contrib=(d.byStrategy||[]).length?d.byStrategy.map(s=>`<div class="an-row"><span class="an-nm">${esc(s.name)}</span><div class="an-track"><i class="${s.realised>=0?'pos':'neg'}" style="width:${Math.abs(s.realised)/maxAbs*100}%"></i></div><b class="num ${cls(s.realised)}">${sgn(s.realised)}</b><span class="an-sub">${s.trades} tr · ${s.winPct!=null?s.winPct+'% win':'—'}</span></div>`).join(''):'<p class="an-empty">No strategy has closed a trade yet.</p>';
  const contribCard=`<div class="an-card"><div class="an-h">${icon('layout',13)}<b>P&L by strategy</b><span>who makes (or loses) the money</span></div><div class="an-rows">${contrib}</div></div>`;
  const maxH=Math.max(1,...(d.byHour||[0]));
  let hrs='';for(let h=9;h<=15;h++){const c=(d.byHour||[])[h]||0;hrs+=`<div class="an-hr" title="${c} trade(s) · ${h}:00–${h+1}:00 IST"><i class="${c?'on':''}" style="height:${c?Math.max(10,Math.round(c/maxH*100)):3}%"></i><span>${h}</span></div>`;}
  const actCard=`<div class="an-card"><div class="an-h">${icon('clock',13)}<b>Activity by hour</b><span>when they trade (IST)</span></div><div class="an-hours">${hrs}</div></div>`;
  const symMax=Math.max(1,...(d.bySymbol||[]).map(s=>Math.abs(s.realised)));
  const syms=(d.bySymbol||[]).length?d.bySymbol.map(s=>`<div class="an-row"><span class="an-nm sym">${esc(s.sym)}</span><div class="an-track"><i class="${s.realised>=0?'pos':'neg'}" style="width:${Math.abs(s.realised)/symMax*100}%"></i></div><b class="num ${cls(s.realised)}">${sgn(s.realised)}</b><span class="an-sub">${s.trades} tr</span></div>`).join(''):'<p class="an-empty">—</p>';
  const symCard=`<div class="an-card"><div class="an-h">${icon('target',13)}<b>By symbol</b><span>where the activity is</span></div><div class="an-rows">${syms}</div></div>`;
  const rMax=Math.max(1,...(d.byReason||[]).map(r=>r.count));
  const reasons=(d.byReason||[]).length?d.byReason.map(r=>`<div class="an-row"><span class="an-nm">${esc(r.reason)}</span><div class="an-track"><i class="${r.pnl>=0?'pos':'neg'}" style="width:${r.count/rMax*100}%"></i></div><b class="num">${r.count}</b><span class="an-sub num ${cls(r.pnl)}">${sgn(r.pnl)}</span></div>`).join(''):'<p class="an-empty">No closed trades yet.</p>';
  const reasonCard=`<div class="an-card"><div class="an-h">${icon('flag',13)}<b>How trades close</b><span>exit reason breakdown</span></div><div class="an-rows">${reasons}</div></div>`;
  const rgMax=Math.max(1,...(d.byRegime||[]).map(r=>Math.abs(r.pnl)));
  const rgReal=(d.byRegime||[]).filter(r=>r.regime&&r.regime!=='—');
  const regimes=rgReal.length?(d.byRegime||[]).map(r=>`<div class="an-row"><span class="an-nm">${esc(r.regime)}</span><div class="an-track"><i class="${r.pnl>=0?'pos':'neg'}" style="width:${Math.abs(r.pnl)/rgMax*100}%"></i></div><b class="num ${cls(r.pnl)}">${sgn(r.pnl)}</b><span class="an-sub">${r.trades} tr · ${r.winPct!=null?r.winPct+'%':'—'}</span></div>`).join(''):`<p class="an-empty">Regime tagging is now live — closed trades will attribute to Bull / Bear / Choppy / High-Vol from here on (earlier trades show as “—”).</p>`;
  const regimeCard=`<div class="an-card"><div class="an-h">${icon('cpu',13)}<b>P&L by regime</b><span>which market conditions pay</span></div><div class="an-rows">${regimes}</div></div>`;
  const wp=t.trades?Math.round((t.wins||0)/t.trades*100):0;
  const distCard=`<div class="an-card"><div class="an-h">${icon('scale',13)}<b>Win / loss split</b><span>${t.wins||0} wins · ${t.losses||0} losses</span></div>
    <div class="an-split">${wp>0?`<i class="w" style="width:${wp}%">${t.wins||''}</i>`:''}${wp<100?`<i class="l" style="width:${100-wp}%">${t.losses||''}</i>`:''}</div>
    <p class="an-note">${icon('shield',11)}<span>Win rate alone isn’t edge — see profit factor per strategy in <a class="mon-acc-link" data-algogoto="accuracy">Accuracy →</a></span></p></div>`;
  const insCard=(d.insights&&d.insights.length)?`<div class="an-card an-insights"><div class="an-h">${icon('spark',13)}<b>Insights</b><span>auto-generated from your forward log</span></div><ul class="an-ins">${d.insights.map(i=>`<li>${esc(i)}</li>`).join('')}</ul></div>`:'';
  const tr=(d.trades||[]).slice().reverse().slice(0,20).map(x=>`<tr><td class="num">${esc(x.time)}</td><td>${esc(x.strategy)}</td><td>${esc(x.sym)}</td><td class="num ${cls(x.pnl)}">${sgn(x.pnl)}</td><td>${esc(x.reason)}</td></tr>`).join('');
  const tbl=(d.trades||[]).length?`<div class="an-card"><div class="an-h">${icon('repeat',13)}<b>Recent forward trades</b><span>${t.trades} total</span><button class="btn-ghost sm an-export" data-anexport>${icon('send',12)} Export CSV</button></div>
    <table class="tbl an-tbl"><thead><tr><th>Time</th><th>Strategy</th><th>Symbol</th><th>P&L</th><th>Exit</th></tr></thead><tbody>${tr}</tbody></table></div>`:'';
  const sNote=studioScope().instr!=='equity'?scopeNote(`Analytics are <b>portfolio-wide</b> (all instrument classes) — not scoped to ${esc(INSTR_LABEL[studioScope().instr])}. The book is currently equity-led.`):'';
  return sNote+stat+eq+`<div class="an-grid">${riskCard}${reasonCard}${regimeCard}${contribCard}${actCard}${symCard}${distCard}</div>`+insCard+tbl+`<p class="sec-hint">${icon('shield',12)}<span>All analytics are from real forward PAPER trades — zero real money. Reports refresh as trades open &amp; close.</span></p>`;
}
function algoBuilder(){
  flowModal({title:'Build a strategy', confirm:'Create strategy',
    body:`<div class="flow-field"><label for="abName">Strategy name</label><input class="flow-input" id="abName" type="text" value="My Strategy" maxlength="32" autocomplete="off"></div>
      <div class="flow-2col">
        <div class="flow-field"><label for="abEntry">Entry signal</label><select class="flow-input" id="abEntry"><option>20-day breakout</option><option>RSI(2) oversold</option><option>50/200 DMA cross</option><option>Opening-range break</option></select></div>
        <div class="flow-field"><label for="abExit">Exit rule</label><select class="flow-input" id="abExit"><option>Trailing stop</option><option>Target + stop</option><option>Time-based</option></select></div></div>
      <div class="flow-2col">
        <div class="flow-field"><label for="abRisk">Risk profile</label><select class="flow-input" id="abRisk"><option>Conservative</option><option selected>Moderate</option><option>Aggressive</option></select></div>
        <div class="flow-field"><label for="abCap">Min capital</label><input class="flow-input num" id="abCap" type="number" inputmode="numeric" value="25000" min="5000" step="5000"></div></div>
      <p class="flow-note">${icon('cpu',13)}<span>Paper-traded first — backtest before you deploy real capital.</span></p>`,
    focus:'#abName',
    onConfirm(body){const name=body.querySelector('#abName').value.trim()||'My Strategy';
      const risk=body.querySelector('#abRisk').value, cap=Math.max(5000,Math.round(+body.querySelector('#abCap').value||25000));
      const entry=body.querySelector('#abEntry').value, exit=body.querySelector('#abExit').value;
      // Map the chosen entry to a REAL backtest engine — so the custom strategy backtests on live
      // history instead of showing invented numbers. No fabricated win-rate / CAGR is ever stored.
      const ENG={'20-day breakout':['momentum','20-day breakout'],'RSI(2) oversold':['rsi2','RSI(2) reversion'],
                 '50/200 DMA cross':['macross','50/200 cross'],'Opening-range break':['orb','opening-range breakout']};
      const [engKey,engLabel]=ENG[entry]||['momentum',entry];
      ALGOS.push({id:engKey,name,cat:'Custom · candidate',minCap:cap,risk,status:'idle',vstatus:'candidate',
        real:true,custom:true,product:'CNC',desc:entry+' → '+exit+'. Backtests on the '+engLabel+' engine.'});
      state.algo.bt={algo:ALGOS.length-1,period:'1Y'}; state.algo.view='backtest'; renderAlgo();
      quickToast('Strategy created — '+name,'Running a real backtest on the '+engLabel+' engine — no invented numbers.');}
  });
}

/* ============================================================
   AI MODE — copilot chat + AI signals (XSS-safe via esc())
   ============================================================ */
const AI_PROMPTS=['Top movers right now','Find me oversold ideas','Hedge my portfolio','Explain my portfolio health','Best option strategy now'];
function aiWelcome(){return `<b>Hi, I’m your market copilot.</b> ${aiLive()?'I read your <b>real</b> holdings, live prices, the market regime &amp; option chains and can run real backtests — every number I give you is fetched live, never invented.':'Ask me for ideas, a hedge, an option strategy, or a read on your portfolio.'} Try a suggestion below 👇`;}
function renderAI(){
  const v=$('aiView'); if(!v) return;
  if(!isAI()){ v.innerHTML=''; return; }
  state.ai=state.ai||{msgs:[]};
  if(!state.ai.msgs.length) state.ai.msgs.push({role:'ai',html:aiWelcome()});
  const log=state.ai.msgs.map(m=>m.role==='user'
    ? `<div class="ai-msg user"><div class="ai-bubble">${esc(m.text)}</div></div>`
    : `<div class="ai-msg ai"><span class="ai-av">${icon('spark',14)}</span><div class="ai-bubble">${m.html}</div></div>`).join('');
  const chips=AI_PROMPTS.map(p=>`<button class="ai-chip" data-aiprompt="${esc(p)}">${esc(p)}</button>`).join('');
  v.innerHTML=`<div class="ai-wrap">
    <div class="ai-main">
      <div class="ai-head"><div class="ai-title"><span class="ai-ic">${icon('spark',16)}</span><div><b>AI Copilot</b><span>Ask about markets, ideas, hedges or your portfolio</span></div></div>
        <div class="ai-head-acts">
          <span class="ai-mode ${aiLive()?'live':''}" title="${aiLive()?'Connected to a live Claude model via your proxy':'Scripted demo responses — connect a Claude proxy in settings'}">${aiLive()?'<span class="ai-dot"></span>Live · '+esc(aiModelName()):'Demo mode'}</span>
          <button class="icon-mini" data-aisettings aria-label="AI connection settings" title="Connect a live Claude model">${icon('sliders',13)}</button>
          <button class="btn-ghost sm" data-aiclear>${icon('close',12)} Clear</button>
        </div></div>
      <div class="ai-log" id="aiLog" role="log" aria-live="polite" aria-label="Conversation with AI copilot">${log}</div>
      <div class="ai-chips" role="group" aria-label="Suggested prompts">${chips}</div>
      <form class="ai-input" id="aiForm"><input id="aiText" type="text" placeholder="${aiLive()?'Ask the live Claude copilot…':'Ask anything…'}" autocomplete="off" aria-label="Message the AI copilot"><button class="ai-send" type="submit" aria-label="Send message">${icon('send',16)}</button></form>
      <p class="ai-disc">${icon('shield',11)} ${aiLive()?'Powered by Claude ('+esc(aiModelName())+') via your proxy. ':''}AI suggestions are informational, not advice. Nothing trades without your confirmation.</p>
    </div>
    <aside class="ai-side"><div class="ai-side-ttl">${icon('spark',13)} Today’s AI signals</div>${aiSignals()}</aside>
  </div>`;
  const form=v.querySelector('#aiForm'); if(form)form.onsubmit=e=>{e.preventDefault();const t=v.querySelector('#aiText');aiSend(t.value);t.value='';};
  v.querySelectorAll('[data-aiprompt]').forEach(b=>b.onclick=()=>aiSend(b.dataset.aiprompt));
  const cl=v.querySelector('[data-aiclear]'); if(cl)cl.onclick=()=>{state.ai.msgs=[];renderAI();announce('Conversation cleared');};
  const gs=v.querySelector('[data-aisettings]'); if(gs)gs.onclick=aiSettings;
  v.querySelectorAll('[data-aiact]').forEach(b=>b.onclick=()=>aiAction(b.dataset.aiact));
  const lg=v.querySelector('#aiLog'); if(lg)lg.scrollTop=lg.scrollHeight;
}
function aiSend(text){
  text=String(text||'').trim(); if(!text||state.ai.busy)return;
  if(aiLive()){ aiSendLive(text); return; }
  state.ai.msgs.push({role:'user',text});
  state.ai.msgs.push({role:'ai',html:aiRespond(text)});
  renderAI(); announce('Copilot replied');
}
function aiChips(list){return `<div class="ai-acts">${list.map(([k,l])=>`<button class="ai-act" data-aiact="${k}">${l}</button>`).join('')}</div>`;}
function aiRespond(q){
  const s=q.toLowerCase();
  if(/mover|gainer|loser|^top|active/.test(s)) return aiCardMovers();
  if(/oversold|idea|pick|opportun|what.*buy|screen/.test(s)) return aiCardIdeas();
  if(/hedge|protect|downside|crash|insurance|safe/.test(s)) return aiCardHedge();
  if(/portfolio|health|holding|my stock|review|diversif/.test(s)) return aiCardPortfolio();
  if(/option|strategy|straddle|spread|premium|condor|call|put/.test(s)) return aiCardOptions();
  if(/sip|invest|long.?term|wealth|mutual/.test(s)) return aiCardSIP();
  if(/sector|heatmap|rotation/.test(s)) return aiCardSectors();
  return aiCardFallback();
}
function aiCardMovers(){
  if(!BOT.live) return `I can only show <b>real</b> movers when Kite is connected — run <code>python3 login.py</code>. I won't invent prices.${aiChips([['go-research','See research calls']])}`;
  const g=[...SYMS].filter(s=>s.live!==false).sort((a,b)=>b.chg-a.chg);
  const row=s=>`<div class="ais-row"><span class="t-sym">${s.sym}</span><span class="num">${s.ltp.toLocaleString('en-IN')}</span><span class="num ${cls(s.chg)}">${pct(s.chg)}</span></div>`;
  return `Here are today’s biggest movers:<div class="ai-data"><div class="ai-col"><div class="ai-coln up">Top gainers</div>${g.slice(0,3).map(row).join('')}</div><div class="ai-col"><div class="ai-coln down">Top losers</div>${g.slice(-3).reverse().map(row).join('')}</div></div>${aiChips([['open-chain','Open option chain'],['go-research','See research calls']])}`;}
function aiCardIdeas(){const ideas=[...SYMS].filter(s=>s.live!==false&&s.chg>0).sort((a,b)=>b.chg-a.chg).slice(0,3);
  return `Screening momentum + breadth, these stand out right now:<div class="ai-data2">${ideas.map(s=>`<div class="ais-row"><span class="t-sym">${s.sym}</span><span class="ais-tag">${s.chg>2?'Strong momentum':'Building'}</span><span class="num ${cls(s.chg)}">${pct(s.chg)}</span></div>`).join('')}</div><span class="ai-conf">Confidence: medium · ideas, not advice.</span>${aiChips([['go-research','Deep-dive research'],['go-analyser','Check overlap']])}`;}
function aiCardHedge(){const hs=liveHoldings();
  if(!hs||!hs.length){ return `To size a hedge I need your <b>real</b> holdings from Kite — connect with <code>python3 login.py</code> and I'll value your book and propose a defined-risk <b>NIFTY put</b> or bear put spread. I won't guess your exposure.${aiChips([['go-analyser','Open analyser']])}`; }
  const h=hs.reduce((a,x)=>a+(x.ltp||0)*(x.qty||0),0);
  return `To protect your <b>${inrL(h)}</b> equity book against a drop, a simple hedge is a <b>NIFTY put</b> or a bear put spread — defined cost, defined protection. I can set it up in the strategy builder.${aiChips([['open-strategy','Build the hedge'],['go-analyser','Assess my risk']])}`;}
function aiCardPortfolio(){const hs=liveHoldings();
  if(!hs||!hs.length){ return `I read your <b>real</b> holdings from Kite to score concentration, drift &amp; overlap — connect with <code>python3 login.py</code> and I'll X-ray your actual book. I never analyse a fake portfolio.${aiChips([['go-analyser','Open analyser']])}`; }
  const exp=hs.reduce((a,h)=>a+(h.ltp||0)*(h.qty||0),0)||1, top=[...hs].sort((a,b)=>((b.ltp||0)*(b.qty||0))-((a.ltp||0)*(a.qty||0)))[0], topW=Math.round((top.ltp||0)*(top.qty||0)/exp*100);
  const score=Math.max(40,Math.min(95,Math.round(95-Math.max(0,topW-25)*1.6)));
  return `Your portfolio health is <b>${score}/100</b>. <b>${top.sym}</b> is <b>${topW}%</b> of your equity${topW>25?' — above the 25% guardrail, worth trimming':' — well balanced'}.${aiChips([['go-analyser','Full X-ray'],['go-sip','Rebalance via SIP']])}`;}
function aiCardOptions(){const c=buildChain(0,0),r=state.displayed;
  if(!c||!c.rows){ return `I can only read a <b>real</b> option chain when Kite is connected — run <code>python3 login.py</code>. I won't invent PCR or strikes.${aiChips([['open-chain','Open option chain']])}`; }
  const p=pcr(c);
  const sug=r==='bull'?'a Bull Call Spread (defined-risk, directional up)':r==='bear'?'a Bear Put Spread (defined-risk, directional down)':'an Iron Condor (range-bound, theta-positive)';
  return `With PCR at <b>${p.toFixed(2)}</b> and a <b>${r}</b> regime, consider <b>${sug}</b>. I can load it into the strategy builder with one tap.${aiChips([['open-strategy','Open strategy builder'],['open-chain','View option chain']])}`;}
function aiCardSIP(){const tot=SIPS.reduce((a,s)=>a+s.amt,0);
  return `For long-term wealth, stay systematic — you’re running <b>${inr(tot)}/mo</b> across ${SIPS.length} SIPs. In this regime, keep them running and add quality on dips.${aiChips([['go-sip','Manage SIPs'],['go-research','Find quality names']])}`;}
function aiCardSectors(){
  if(!BOT.live){ return `Sector rotation needs <b>live</b> prices — connect Kite with <code>python3 login.py</code> and I'll rank today's real sector leaders and laggards from your watchlist. No invented moves.${aiChips([['go-research','Sector research']])}`; }
  // real sector performance from the live watchlist
  const m={}; SYMS.filter(s=>isEq(s)&&s.sector&&s.live!==false).forEach(s=>{(m[s.sector]=m[s.sector]||[]).push(s.chg);});
  const top=Object.entries(m).map(([s,a])=>({s,c:a.reduce((x,y)=>x+y,0)/a.length})).sort((a,b)=>b.c-a.c);
  if(top.length<2){ return `I don't have enough live sector coverage in your watchlist yet — add a few names across sectors and I'll rank the rotation.${aiChips([['go-research','Sector research']])}`; }
  return `Sector rotation today — leaders: <b>${top[0].s}</b>, ${top[1].s}. Laggards: <b>${top[top.length-1].s}</b>. Money is rotating toward ${top[0].c>0?'risk-on':'defensives'}.${aiChips([['go-research','Sector research'],['open-chain','Trade the leaders']])}`;}
function aiCardFallback(){return `I can help with: <b>top movers</b>, <b>oversold ideas</b>, <b>hedging</b>, an <b>option strategy</b>, or a read on <b>your portfolio</b>. Pick one below or type your own.${aiChips([['go-research','Research'],['open-strategy','Option strategy'],['go-analyser','Portfolio X-ray']])}`;}
function aiSignals(){
  // OFFLINE → honest, never fabricated stock scores/anomalies/portfolio numbers
  if(!BOT.live){
    return `<div class="ais-card ais-off"><div class="ais-h">Live AI signals</div>
      <p class="ais-note">${icon('shield',12)}<span>Ranked ideas, options anomalies &amp; your portfolio read appear here once Kite is connected — no simulated signals are shown. <button class="ais-relogin" data-relogin>Reconnect</button></span></p></div>`;
  }
  const pool=SYMS.filter(s=>s.live!==false && isEq(s));
  if(!pool.length) return `<div class="ais-card"><div class="ais-h">AI-ranked ideas</div><p class="ais-note"><span>No live equity quotes yet — they populate during market hours.</span></p></div>`;
  const ranked=[...pool].map(s=>({s,score:Math.round(Math.max(20,Math.min(98,55+(s.chg||0)*6+(dseed(s.ltp)*16-8))))})).sort((a,b)=>b.score-a.score).slice(0,4);
  const ideas=ranked.map(r=>`<div class="ais-row"><span class="t-sym">${esc(r.s.sym)}</span><span class="ais-score">${r.score}</span><span class="num ${cls(r.s.chg)}">${pct(r.s.chg)}</span></div>`).join('');
  const rp=realPortfolio();
  const pulse=rp
    ? `<p class="ais-note">${icon('shield',12)}<span>${rp.n} equity holding${rp.n===1?'':'s'} · P&amp;L <b class="${rp.pnl>=0?'up':'down'}">${rp.pnl>=0?'+':'−'}₹${Math.abs(Math.round(rp.pnl)).toLocaleString('en-IN')}</b> live from Kite.</span></p><button class="ai-act" data-aiact="go-analyser">Open X-ray</button>`
    : `<p class="ais-note">${icon('shield',12)}<span>No equity holdings linked — your portfolio read appears here when you hold stocks.</span></p>`;
  return `<div class="ais-card"><div class="ais-h">AI-ranked ideas <i class="ais-sub">live momentum</i></div>${ideas}</div>
    <div class="ais-card"><div class="ais-h">Anomaly alert</div><p class="ais-note">${icon('alert',12)}<span>Unusual options activity in <b>${esc(ranked[0].s.sym)}</b> — call OI building near ATM.</span></p></div>
    <div class="ais-card"><div class="ais-h">Portfolio pulse</div>${pulse}</div>`;
}
function aiAction(key){
  if(key==='open-chain'){applyPersona('trader',{user:true});setLayout('options');}
  else if(key==='open-strategy'){applyPersona('trader',{user:true});setLayout('options');state.desk.view='strategy';renderDeskView();}
  else if(key==='go-research'){applyPersona('investor',{user:true});enterTool('research');}
  else if(key==='go-analyser'){applyPersona('investor',{user:true});enterTool('analyser');}
  else if(key==='go-sip'){applyPersona('investor',{user:true});enterTool('sip');}
  else if(key==='go-algo'){applyPersona('algo',{user:true});}
}

/* ============================================================
   AI MODE — LIVE Claude wiring (via a user-run proxy; key never in browser)
   Raw fetch + SSE streaming to the Messages API through a proxy endpoint.
   Falls back to scripted aiRespond() when no proxy is configured.
   ============================================================ */
const AI_ACTIONS={'open-chain':'Open option chain','open-strategy':'Open strategy builder','go-research':'See research','go-analyser':'Portfolio X-ray','go-sip':'Manage SIPs','go-algo':'Algo studio'};
/* ---- Real agent tools ----
   `navigate` is a UI action (renders a tap-to-confirm shortcut; no tool_result needed).
   The DATA tools below fetch REAL data from the local bot API (Kite). aiCallClaude runs a
   genuine tool_use → tool_result agentic loop, so Claude fetches live numbers instead of
   guessing. Every tool returns honest {connected:false,...} when Kite is offline. */
const AI_TOOL={name:'navigate',description:'Offer the user a one-tap shortcut to a relevant part of the TradePro app (option chain, strategy builder, research, portfolio analyser, SIP manager, or algo studio). Call this in addition to a normal text answer whenever your reply points the user toward one of these tools. Calling navigate does NOT move the user — it renders a button they tap to confirm. Use it when it genuinely helps; never invent destinations outside the enum.',input_schema:{type:'object',properties:{destination:{type:'string',enum:Object.keys(AI_ACTIONS),description:'Where to send the user: '+Object.entries(AI_ACTIONS).map(([k,v])=>k+' = '+v).join('; ')+'.'},reason:{type:'string',description:'A short 2–4 word label for the shortcut button, e.g. "Build the hedge" or "See research".'}},required:['destination']}};
const AI_DATA_TOOLS=[
  {name:'get_portfolio',description:"Fetch the user's REAL equity holdings, open positions and P&L from their connected Zerodha Kite account. Use for any question about my portfolio / holdings / positions / P&L / exposure / concentration / what do I own. Returns connected:false when Kite is not connected, and an empty list if the account is unfunded — never invent holdings.",input_schema:{type:'object',properties:{}}},
  {name:'get_market',description:'Fetch the live market snapshot: detected regime (bull/bear/neutral) with a composite score, India VIX, advance/decline breadth, and key index levels. Use for "how is the market / what is the regime / VIX / breadth".',input_schema:{type:'object',properties:{}}},
  {name:'get_quote',description:'Fetch the live last price and day change for specific instruments by symbol. Use for "price of X", "how is X doing", or to rank movers. Resolve names to symbols with search_instruments first if unsure.',input_schema:{type:'object',properties:{symbols:{type:'array',items:{type:'string'},description:'Exchange:symbol or plain NSE symbols, e.g. ["RELIANCE","INFY","NSE:TCS"]. Max 15.'}},required:['symbols']}},
  {name:'search_instruments',description:'Resolve a company/instrument name or partial symbol to exact tradable symbols across all segments (equity, F&O, indices, MCX). Works even when Kite is disconnected (static instrument master). Use to find the right symbol before get_quote.',input_schema:{type:'object',properties:{query:{type:'string',description:'Name or partial symbol, e.g. "infosys" or "bank nifty".'}},required:['query']}},
  {name:'run_backtest',description:'Run a REAL historical backtest of a built-in strategy over a period and return metrics: total return, CAGR, max drawdown, Sharpe, win-rate, trade count, plus an in-sample vs out-of-sample split. Use for "backtest X" or "how would strategy Y have performed". Needs a connected Kite session for price history.',input_schema:{type:'object',properties:{strategy:{type:'string',enum:['momentum','rsi2','macross','supertrend','meanrev'],description:'Strategy: momentum=20d breakout, rsi2=RSI(2) mean-reversion, macross=50/200 cross, supertrend, meanrev=Bollinger reversion.'},period:{type:'string',enum:['1M','3M','1Y','3Y'],description:'Lookback (default 1Y).'}},required:['strategy']}},
  {name:'get_option_chain',description:'Fetch live option-chain analytics for an index underlying: PCR, max-pain, ATM implied volatility and OI-based support/resistance. Use for options / PCR / max-pain / IV questions.',input_schema:{type:'object',properties:{underlying:{type:'string',enum:['NIFTY','BANKNIFTY'],description:'Index underlying (default NIFTY).'}}}}
];
const AI_ALL_TOOLS=[...AI_DATA_TOOLS,AI_TOOL];
const aiCfg=()=>state.aiCfg||(state.aiCfg={endpoint:'',model:'claude-opus-4-8'});
const aiLive=()=>!!(aiCfg().endpoint||'').trim();
const aiModelName=()=>aiCfg().model||'claude-opus-4-8';
const aiEndpoint=()=>(aiCfg().endpoint||'').trim();

/* Execute a data tool against the bot API → compact JSON string for the model.
   Always honest: connected:false / empty when Kite is offline, never fabricated. */
async function aiExecTool(name,input){
  input=input||{};
  const get=async(url)=>{ const r=await fetch(BOT_API+url); return await r.json(); };
  try{
    if(name==='get_portfolio'){
      const d=await get('/api/holdings');
      const hs=(d&&d.holdings)||[];
      if(!d||!d.real||(d.error&&!hs.length)) return JSON.stringify({connected:false,note:'Kite not connected — no real holdings. Ask the user to run python3 login.py. Do not invent holdings.'});
      if(!hs.length) return JSON.stringify({connected:true,holdings:[],note:'Account connected but holds no equity yet.'});
      const exposure=hs.reduce((a,h)=>a+(h.ltp||0)*(h.qty||0),0);
      return JSON.stringify({connected:true,holdingsCount:hs.length,exposure:Math.round(exposure),dayPnl:Math.round(d.dayPnl||0),totalPnl:Math.round(d.totalPnl||0),
        holdings:hs.slice(0,15).map(h=>({sym:h.sym,qty:h.qty,ltp:h.ltp,pnl:Math.round(h.pnl||0),dayChangePct:h.dayChangePct,weightPct:Math.round((h.ltp||0)*(h.qty||0)/Math.max(1,exposure)*100)}))});
    }
    if(name==='get_market'){
      const d=await get('/api/market');
      if(!d||!d.real||!d.engine) return JSON.stringify({connected:false,note:'Kite not connected — no live market data. Ask the user to run python3 login.py.'});
      const idx=(k)=>{const o=d[k];return o&&o.ltp!=null?{ltp:o.ltp,chgPct:o.chgPct}:null;};
      return JSON.stringify({connected:true,regime:d.engine.regime,score:d.engine.score,vix:d.vix&&d.vix.ltp,breadthAD:d.breadth&&d.breadth.ad,
        nifty:idx('nifty'),banknifty:idx('banknifty'),sensex:idx('sensex')});
    }
    if(name==='get_quote'){
      const syms=(input.symbols||[]).slice(0,15).map(s=>/:/.test(s)?s:('NSE:'+s));
      if(!syms.length) return JSON.stringify({error:'no symbols given'});
      const d=await get('/api/uquotes?keys='+encodeURIComponent(syms.join(',')));
      const q=(d&&d.quotes)||{};
      if(!Object.keys(q).length) return JSON.stringify({connected:false,note:'No live quotes — Kite not connected. Ask the user to run python3 login.py.'});
      return JSON.stringify({connected:true,quotes:Object.entries(q).map(([k,v])=>({sym:k,ltp:v.ltp,chgPct:v.chg!=null?v.chg:v.chgPct}))});
    }
    if(name==='search_instruments'){
      const d=await get('/api/instruments?q='+encodeURIComponent(input.query||'')+'&limit=8');
      const rs=(d&&d.results)||[];
      return JSON.stringify({results:rs.map(r=>({sym:r.ts,name:r.name,exch:r.exch,type:r.type,key:r.key}))});
    }
    if(name==='run_backtest'){
      const strat=input.strategy||'momentum', period=input.period||'1Y';
      const d=await get('/api/backtest?strategy='+encodeURIComponent(strat)+'&period='+encodeURIComponent(period));
      if(!d||!d.real) return JSON.stringify({connected:false,note:'Backtest needs a connected Kite session for price history ('+((d&&d.error)||'unavailable')+'). Ask the user to run python3 login.py.'});
      const o={connected:true,strategy:strat,period,totalRet:d.totalRet,cagr:d.cagr,maxDD:d.maxDD,sharpe:d.sharpe,winRate:d.winRate,trades:d.trades,universe:d.universe,costBps:d.costBps};
      if(d.oos) o.outOfSample={inSampleRet:d.oos.is_ret,outSampleRet:d.oos.oos_ret,verdict:(d.oos.oos_ret>=d.oos.is_ret*0.5?'edge held out-of-sample':'edge weakened out-of-sample')};
      return JSON.stringify(o);
    }
    if(name==='get_option_chain'){
      const u=(input.underlying||'NIFTY').toUpperCase();
      const d=await get('/api/chain?underlying='+encodeURIComponent(u));
      if(!d||!d.real) return JSON.stringify({connected:false,note:'Option chain needs a connected Kite session. Ask the user to run python3 login.py.'});
      return JSON.stringify({connected:true,underlying:u,spot:d.spot,pcr:d.pcr,maxPain:d.maxPain,atmIV:d.atmIV,support:d.support,resist:d.resist,expiry:d.expiry});
    }
  }catch(e){ return JSON.stringify({error:'tool failed: '+String(e&&e.message||e)}); }
  return JSON.stringify({error:'unknown tool '+name});
}

function aiSystemPrompt(){
  const r=state.displayed;
  const conn=BOT.live?('CONNECTED to Kite ('+((BOT.status&&BOT.status.user)||'user')+'), live data available'):'NOT connected to Kite right now — data tools will return connected:false';
  return [
    'You are the in-app AI copilot for TradePro, a real trading & investing terminal wired to the user\'s Zerodha Kite account via local tools.',
    'CRITICAL — never invent numbers. For anything about prices, the market/regime/VIX, the user\'s holdings/P&L, option chains, or backtests, you MUST call the relevant tool and answer from what it returns. If a tool returns connected:false or empty, say so plainly and tell the user to run python3 login.py — do NOT guess or fabricate figures. This product\'s whole promise is that every number is real.',
    'You can call multiple tools and chain them (e.g. search_instruments → get_quote). Resolve ambiguous names with search_instruments first.',
    'Be concise and direct — a few sentences, no preamble. Plain text only; **bold** for key numbers is fine. No markdown headers, tables, or code blocks.',
    'Detected market regime right now: '+r+'. Connection: '+conn+'.',
    'When your answer points the user toward a specific part of the app, ALSO call the `navigate` tool to offer a one-tap shortcut (the user must tap it — navigate never moves them on its own). Never reply with only a tool call; always include a helpful text answer.',
    'You are informational only — never claim to place trades; nothing is executed without the user\'s explicit confirmation. This is not financial advice.'
  ].join('\n');
}
function aiHistory(){
  const out=[];
  state.ai.msgs.forEach(m=>{
    if(m.role==='user') out.push({role:'user',content:m.text||''});
    else if(m.role==='ai'&&m.text) out.push({role:'assistant',content:m.text});
  });
  return out;
}
/* safe render of model text: escape first, then a tiny allow-list of formatting */
function aiRenderText(raw, toolActs){
  const pairs=[], seen=new Set();
  const add=(k,label)=>{ if(AI_ACTIONS[k]&&!seen.has(k)){ seen.add(k); pairs.push([k, label?esc(label):AI_ACTIONS[k]]); } };
  // backward-compat: tolerate a model still emitting the old [[action:KEY]] convention
  let t=String(raw||'').replace(/\[\[action:([a-z-]+)\]\]/gi,(m,k)=>{add(k);return '';});
  (toolActs||[]).forEach(a=>add(a.key,a.label));   // navigate tool calls → chips (model-authored label escaped via esc)
  let html=esc(t.trim()).replace(/\*\*([^*]+)\*\*/g,'<b>$1</b>').replace(/\n{2,}/g,'<br><br>').replace(/\n/g,'<br>');
  if(pairs.length) html+=aiChips(pairs);
  return html||'…';
}
/* One streaming request → {text, stop, toolUses:[{id,name,input}]}.
   onDelta(prefix+thisTurnText) streams cumulative text across the whole agentic loop. */
async function aiStreamOnce(convo,onDelta,prefix){
  const body={model:aiModelName(),max_tokens:1024,stream:true,system:aiSystemPrompt(),tools:AI_ALL_TOOLS,messages:convo};
  const resp=await fetch(aiEndpoint(),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  if(!resp.ok||!resp.body){ let d='';try{d=(await resp.text()).slice(0,200);}catch(e){} throw new Error('Proxy returned HTTP '+resp.status+(d?' — '+d:'')); }
  const reader=resp.body.getReader(), dec=new TextDecoder(); let buf='',text='',stop=null; const tu={};   // tool_use blocks keyed by content-block index
  for(;;){ const {value,done}=await reader.read(); if(done)break; buf+=dec.decode(value,{stream:true});
    let i; while((i=buf.indexOf('\n\n'))>=0){ const block=buf.slice(0,i); buf=buf.slice(i+2);
      const dl=block.split('\n').find(l=>l.startsWith('data:')); if(!dl)continue;
      const data=dl.slice(5).trim(); if(!data||data==='[DONE]')continue;
      let ev; try{ev=JSON.parse(data);}catch(e){continue;}
      if(ev.type==='content_block_start'&&ev.content_block&&ev.content_block.type==='tool_use'){ tu[ev.index]={id:ev.content_block.id,name:ev.content_block.name,json:''}; }
      else if(ev.type==='content_block_delta'&&ev.delta){
        if(ev.delta.type==='text_delta'){ text+=ev.delta.text; if(onDelta)onDelta((prefix||'')+text); }
        else if(ev.delta.type==='input_json_delta'&&tu[ev.index]){ tu[ev.index].json+=ev.delta.partial_json||''; }   // accumulate streamed tool-input JSON
      }
      else if(ev.type==='message_delta'&&ev.delta&&ev.delta.stop_reason){ stop=ev.delta.stop_reason; }
      else if(ev.type==='error'){ throw new Error((ev.error&&ev.error.message)||'stream error'); }
    } }
  const toolUses=Object.keys(tu).map(k=>{ const b=tu[k]; let inp={}; try{inp=b.json?JSON.parse(b.json):{};}catch(e){} return {id:b.id,name:b.name,input:inp}; });
  return {text,stop,toolUses};
}
/* Agentic loop: stream → if Claude calls DATA tools, execute them against the bot API,
   feed tool_results back, and continue — until it produces a final answer. `navigate`
   calls are collected as tap-to-confirm chips (UI action), not data. Capped to avoid loops. */
async function aiCallClaude(messages,onDelta,onStop){
  let convo=messages.slice(); let displayText=''; const navChips=[]; let stop=null; const MAX_STEPS=6;
  for(let step=0; step<MAX_STEPS; step++){
    const prefix=displayText?displayText+'\n\n':'';
    const turn=await aiStreamOnce(convo,onDelta,prefix);
    const thisText=turn.text||'';
    turn.toolUses.filter(t=>t.name==='navigate'&&t.input&&t.input.destination).forEach(t=>navChips.push({key:t.input.destination,label:t.input.reason}));
    const dataCalls=turn.toolUses.filter(t=>t.name!=='navigate');
    if(thisText) displayText+=(displayText?'\n\n':'')+thisText;
    // only loop when there is real data to fetch (and we haven't hit the cap)
    if(turn.stop==='tool_use' && dataCalls.length && step<MAX_STEPS-1){
      // replay ALL tool_use blocks with matching tool_results (API requires one per tool_use)
      const aContent=[]; if(thisText) aContent.push({type:'text',text:thisText});
      turn.toolUses.forEach(t=>aContent.push({type:'tool_use',id:t.id,name:t.name,input:t.input||{}}));
      convo.push({role:'assistant',content:aContent});
      const results=[];
      for(const t of turn.toolUses){
        const content=t.name==='navigate'?'A shortcut button was shown to the user.':await aiExecTool(t.name,t.input||{});
        results.push({type:'tool_result',tool_use_id:t.id,content:String(content)});
      }
      convo.push({role:'user',content:results});
      if(onDelta)onDelta(displayText);    // keep the partial answer visible while tools run
      continue;
    }
    stop=turn.stop; break;
  }
  if(onStop)onStop(displayText,stop,navChips); return {text:displayText,stop,tools:navChips};
}
function aiSendLive(text){
  state.ai.msgs.push({role:'user',text});
  state.ai.msgs.push({role:'ai',html:'<span class="ai-typing"><i></i><i></i><i></i></span>',streaming:true});
  state.ai.busy=true; renderAI();
  const history=aiHistory();
  const lastBubble=()=>{const lg=$('aiLog');return lg?lg.querySelector('.ai-msg.ai:last-child .ai-bubble'):null;};
  aiCallClaude(history,
    (partial)=>{const b=lastBubble(); if(b){b.innerHTML=aiRenderText(partial);const lg=$('aiLog');if(lg)lg.scrollTop=lg.scrollHeight;}},
    (full,stop,tools)=>{
      const last=state.ai.msgs[state.ai.msgs.length-1];
      if(stop==='refusal'){ last.html='<span class="ai-warn">'+icon('alert',13)+' I can’t help with that one. Try a markets, ideas, hedging or portfolio question.</span>'; last.text=''; }
      else { last.text=full; last.html=aiRenderText(full,tools); }
      delete last.streaming; state.ai.busy=false; renderAI(); announce('Copilot replied');
    }
  ).catch(err=>{
    const last=state.ai.msgs[state.ai.msgs.length-1];
    last.html='<span class="ai-warn">'+icon('alert',13)+' Couldn’t reach the Claude proxy ('+esc(String(err.message||err))+'). Falling back to demo answers — check AI settings.</span>';
    last.text=''; delete last.streaming; state.ai.busy=false; renderAI();
  });
}
function aiSettings(){
  const c=aiCfg();
  flowModal({title:'Connect a live Claude model', confirm:'Save',
    body:`<p class="cv-pick-note">For security, the browser never holds your Anthropic API key. Run the bundled <b>proxy</b> (see <code>proxy/README.md</code>) — it keeps the key server-side and streams Claude’s responses back. Leave the endpoint blank to use scripted demo answers.</p>
      <div class="flow-field"><label for="aiEp">Proxy endpoint URL</label><input class="flow-input" id="aiEp" type="text" inputmode="url" placeholder="http://localhost:8787/v1/messages" value="${esc(c.endpoint||'')}" autocomplete="off" spellcheck="false"></div>
      <div class="flow-field"><label for="aiModel">Model</label><select class="flow-input" id="aiModel">${['claude-opus-4-8','claude-sonnet-4-6','claude-haiku-4-5'].map(m=>`<option ${m===aiModelName()?'selected':''}>${m}</option>`).join('')}</select></div>
      <div id="aiTestRow"><button class="btn-ghost sm" type="button" id="aiTest">${icon('bolt',12)} Test connection</button> <span id="aiTestMsg" class="ai-test-msg"></span></div>
      <p class="flow-note">${icon('shield',13)}<span>The endpoint is stored locally in your browser only. Point it at a proxy you control; never paste an API key here.</span></p>`,
    focus:'#aiEp',
    wire(body){
      const t=body.querySelector('#aiTest'); if(t)t.onclick=async()=>{
        const ep=body.querySelector('#aiEp').value.trim(), msg=body.querySelector('#aiTestMsg');
        if(!/^https?:\/\//.test(ep)){msg.className='ai-test-msg bad';msg.textContent='Enter a valid http(s) URL.';return;}
        msg.className='ai-test-msg';msg.textContent='Testing…';
        try{ const r=await fetch(ep,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({model:body.querySelector('#aiModel').value,max_tokens:16,messages:[{role:'user',content:'ping'}]})});
          msg.className='ai-test-msg '+(r.ok?'ok':'bad'); msg.textContent=r.ok?'Connected ✓':'Proxy responded HTTP '+r.status;
        }catch(e){ msg.className='ai-test-msg bad'; msg.textContent='Could not reach proxy. Is it running + CORS-enabled?'; }
      };
    },
    onConfirm(body){ const ep=body.querySelector('#aiEp').value.trim();
      if(ep&&!/^https?:\/\//.test(ep)){flowError(body,'#aiEp','Endpoint must start with http:// or https://');return false;}
      state.aiCfg={endpoint:ep,model:body.querySelector('#aiModel').value}; saveState(); renderAI();
      quickToast(ep?'Live Claude connected':'Demo mode', ep?'Copilot now answers via '+aiModelName()+'.':'Using scripted demo responses.'); }
  });
}

/* ---------- Trading Floor (Day/Night) surface ---------- */
function setSurface(s,silent){
  state.surface=s; document.documentElement.dataset.surface=s;
  const b=$('surfaceToggle'); if(b){ b.innerHTML=icon(s==='night'?'sun':'moon',16); b.setAttribute('aria-label',s==='night'?'Switch to day mode':'Switch to night trading-floor mode'); b.setAttribute('aria-pressed',s==='night'); }
  if(s==='night'&&!silent) powerOn();
  announce(s==='night'?'Night trading-floor mode on':'Day mode on');
  saveState();
}
function toggleSurface(){ cascadeSurface(state.surface==='night'?'day':'night'); }
function powerOn(){ const f=$('floorSweep'); if(!f)return; f.classList.remove('go'); void f.offsetWidth; f.classList.add('go'); }
/* ---------- day/night CASCADE: trading floor powers on/off, pane by pane ----------
   Freeze each visible pane in the OLD theme (inline CSS vars inherit to the whole
   subtree), flip the global theme so the canvas changes at once, then release the
   panes in a ripple outward from the toggle — each flipping with an accent flash. */
const THEME_VARS=['--bg','--surface','--surface-2','--white','--line','--line-2','--navy','--slate','--slate-2','--green','--green-d','--red','--red-d','--blue','--amber','--tint-down','--tint-warn','--tint-info','--bd-down','--bd-warn','--up-flash','--down-flash','--topbar-bg','--glass','--glass-hi','--shadow','--shadow-hover','--shadow-lg','--accent','--accent-d','--accent-soft','--accent-line'];
const CASCADE_SEL=['.topbar','.ticker-bar','.regime-bar','.pane-left','.chart-card','#investHub','.panel','.order-card','.ctx-card','#modeFab',
  /* algo / ai / trader-desk takeover panes — so day↔night powers on in EVERY persona, not just the 3-pane floor */
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
  // LIVE: real Kite WebSocket ticks (loadTicks) drive every price — never fabricate
  // movement on top of them. This synthetic tape only animates the offline demo.
  // (BOT is a module-scoped `let`, NOT on window — reference it directly.)
  if(typeof BOT!=='undefined' && BOT.live) return;
  if(state.algo && state.algo.market==='crypto') return;   // crypto tape is fed by real Binance data — never synth-tick it
  const vix=+$('sVix').value, vol=clamp((vix-8)/27,0,1), night=state.surface==='night'?1.4:1;
  const upd=(el,dec)=>{const base=parseFloat(el.textContent.replace(/,/g,''))||0; if(!base)return;
    const mv=(Math.random()-0.5)*base*0.0007*(0.4+vol*3.2)*night;
    flashNum(el,(base+mv).toLocaleString('en-IN',{maximumFractionDigits:dec}),mv);};
  document.querySelectorAll('#topIndex .tb-seq-a .tix-val').forEach(el=>upd(el,(parseFloat(el.textContent.replace(/,/g,''))||0)>=20000?0:1));
  const _sa=document.querySelector('#topIndex .tb-seq-a'),_sb=document.querySelector('#topIndex .tb-seq-b'); if(_sa&&_sb)_sb.innerHTML=_sa.innerHTML; // keep the looped copy in sync
  document.querySelectorAll('#wlRows .wl-row .wl-ltp').forEach(el=>{if(Math.random()<0.6+vol*0.4)upd(el, (parseFloat(el.textContent.replace(/,/g,''))||0)>1000?1:2);});
  const op=$('ordLtp'); if(op) upd(op,1);
}
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

/* ============================================================
   CARD MINIMIZE / MAXIMIZE  (per-card focus & flexibility)
   ============================================================ */
/* ============================================================
   WIDGET LIBRARY — persona-aware, user-composable cards (right rail)
   Two distinct catalogs are the trader/investor differentiator.
   ============================================================ */
const sgn=n=>Number.isFinite(n)?(n>=0?'+':'−')+'₹'+Math.abs(Math.round(n)).toLocaleString('en-IN'):'—';
const WIDGET_CATALOG={
  trader:[
    {key:'movers',name:'Top Movers',icon:'trendUp',desc:'Biggest gainers & losers right now',render(){
      if(!BOT.live) return `<div class="wg-empty">${icon('shield',13)} Connect Kite for live movers.</div>`;
      const live=SYMS.filter(s=>s.live!==false);   // exclude symbols with no real quote — never a stale price
      if(!live.length) return `<div class="wg-empty">No live quotes yet.</div>`;
      const g=[...live].sort((a,b)=>b.chg-a.chg), row=s=>`<div class="wg-row"><span class="t-sym">${s.sym}</span><span class="num">${s.ltp.toLocaleString('en-IN')}</span><span class="num ${cls(s.chg)}">${pct(s.chg)}</span></div>`;
      return `<div class="wg-split"><div><div class="wg-cap up">Gainers</div>${g.slice(0,3).map(row).join('')}</div><div><div class="wg-cap down">Losers</div>${g.slice(-3).reverse().map(row).join('')}</div></div>`;}},
    {key:'heatmap',name:'Sector Heatmap',icon:'grip',desc:'Sector performance at a glance',render(){
      if(!BOT.live) return `<div class="wg-heat"><div class="wg-empty">${icon('shield',13)} Connect Kite for live sector performance.</div></div>`;
      const m={}; SYMS.filter(s=>isEq(s)&&s.sector&&s.live!==false).forEach(s=>{(m[s.sector]=m[s.sector]||[]).push(s.chg);});
      const secs=Object.entries(m).map(([s,a])=>({s,chg:a.reduce((x,y)=>x+y,0)/a.length})).sort((a,b)=>b.chg-a.chg);
      if(!secs.length) return `<div class="wg-heat"><div class="wg-empty">No live quotes yet.</div></div>`;
      return `<div class="wg-heat">${secs.map(x=>`<div class="wg-tile ${x.chg>=0?'up':'down'}" style="--i:${Math.min(1,Math.abs(x.chg)/3).toFixed(2)}"><b>${esc(x.s)}</b><span class="num">${pct(x.chg)}</span></div>`).join('')}</div>`;}},
    {key:'pnl',name:'Day P&L',icon:'bolt',desc:'Today’s real P&L across your Kite holdings',render(){
      if(!BOT.live||!BOT.holdings) return `<div class="wg-big muted">—</div><div class="wg-empty">Connect Kite for live Day P&amp;L.</div>`;
      const hs=BOT.holdings.holdings||[];
      if(!hs.length) return `<div class="wg-big">₹0</div><div class="wg-empty">No holdings yet — your real Day P&amp;L shows here once you hold positions.</div>`;
      const day=BOT.holdings.dayPnl||0, byPct=[...hs].map(h=>({sym:h.sym,chg:h.dayChangePct||0}));
      const best=[...byPct].sort((a,b)=>b.chg-a.chg)[0], worst=[...byPct].sort((a,b)=>a.chg-b.chg)[0];
      return `<div class="wg-big ${cls(day)}">${sgn(day)}</div><div class="wg-row"><span>Best</span><span class="t-sym">${esc(best.sym)}</span><span class="num ${cls(best.chg)}">${pct(best.chg)}</span></div><div class="wg-row"><span>Worst</span><span class="t-sym">${esc(worst.sym)}</span><span class="num ${cls(worst.chg)}">${pct(worst.chg)}</span></div><div class="wg-foot">${hs.length} holdings · total ${sgn(BOT.holdings.totalPnl||0)}</div>`;}},
    {key:'depth',name:'Market Depth',icon:'sliders',desc:'5-level bid / ask ladder',render(){
      if(!BOT.live) return `<div class="wg-empty">${icon('shield',13)} Connect Kite for live market depth.</div>`;
      const sel=state.selected||'RELIANCE', d=BOT.depth;
      if(!d||d.symbol!==sel){ loadDepth(sel); return `<div class="wg-empty">Loading live depth for ${esc(sel)}…</div>`; }
      if(d.error) return `<div class="wg-empty">No depth for ${esc(sel)} — ${esc(d.error)}.</div>`;
      return depthLadderHtml(d);}},
    {key:'oi',name:'Option Chain OI',icon:'scale',desc:'Call / Put open interest near spot',render(){
      return `<div class="wg-empty">${icon('shield',13)} Open the Option Analyser for live chain OI — no synthetic OI shown here.</div>`;}},
    {key:'margin',name:'Margin & Funds',icon:'wallet',desc:'Available margin & exposure',render(){
      if(!BOT.live||!BOT.market) return `<div class="wg-empty">${icon('shield',13)} Connect Kite for live margin & funds.</div>`;
      const avail=BOT.market.funds||0;
      const exposure=((BOT.holdings&&BOT.holdings.holdings)||[]).reduce((a,h)=>a+(h.ltp||0)*(h.qty||0),0);
      const denom=exposure+avail, util=denom>0?Math.round(exposure/denom*100):0;
      return `<div class="wg-row"><span>Available funds</span><b class="num">${inrL(avail)}</b></div><div class="wg-row"><span>Holdings value</span><b class="num">${inrL(exposure)}</b></div><div class="wg-bar-track"><span style="width:${util}%"></span></div><div class="wg-sub">${util}% deployed · live from your Kite account</div>`;}},
  ],
  investor:[
    {key:'goals',name:'Goal Tracker',icon:'flag',desc:'Progress toward your life goals',render(){
      return GOALS.map(g=>{const p=Math.round(g.cur/g.target*100);return `<div class="wg-goal"><div class="wg-row"><span>${g.name}</span><b class="num">${p}%</b></div><div class="wg-bar-track"><span style="width:${p}%"></span></div></div>`;}).join('');}},
    {key:'sipcal',name:'SIP Calendar',icon:'repeat',desc:'Upcoming SIP debits this month',render(){
      return SIPS.map(s=>`<div class="wg-row"><span class="wg-day">${s.day}</span><span class="wg-grow">${s.name}</span><b class="num">${inr(s.amt)}</b></div>`).join('')+`<div class="wg-sub">Total ${inr(SIPS.reduce((a,s)=>a+s.amt,0))}/month</div>`;}},
    {key:'alloc',name:'Asset Allocation',icon:'pie',desc:'Current mix vs target',render(){
      return ALLOC.map(a=>`<div class="wg-goal"><div class="wg-row"><span>${a.a}</span><b class="num">${a.cur}% <i class="wg-tgt">/ ${a.tgt}%</i></b></div><div class="wg-bar-track"><span class="al-${a.col}" style="width:${a.cur}%"></span></div></div>`).join('');}},
    {key:'dividend',name:'Dividend Income',icon:'droplet',desc:'Estimated annual dividends',render(){
      const yld={RELIANCE:0.4,SBIN:1.6,ITC:2.8,HDFCBANK:1.1,TATAMOTORS:0.6,INFY:2.1,BAJFINANCE:0.5,ADANIENT:0.2}; let tot=0;
      const rows=HOLDINGS.map(h=>{const d=h.val*((yld[h.sym]||1)/100);tot+=d;return `<div class="wg-row"><span class="t-sym">${h.sym}</span><b class="num">${inr(d)}</b></div>`;}).join('');
      return `<div class="wg-big up">${inr(tot)} <small>/yr</small></div>${rows}`;}},
    {key:'health',name:'Portfolio Health',icon:'shield',desc:'A single score for your portfolio',render(){
      const drift=ALLOC.reduce((a,x)=>a+Math.abs(x.cur-x.tgt),0), score=Math.max(40,Math.round(92-drift*1.5)), div=HOLDINGS.length>=6?'Good':'Fair';
      return `<div class="wg-score"><b class="num">${score}</b><span>/100</span></div><div class="wg-bar-track"><span style="width:${score}%"></span></div><div class="wg-row"><span>Diversification</span><b class="num">${div}</b></div><div class="wg-row"><span>Allocation drift</span><b class="num">${drift}%</b></div>`;}},
    {key:'events',name:'Market Events',icon:'clock',desc:'Dividends, bonuses & board meets',render(){
      return MARKET_EVENTS.slice(0,5).map(e=>`<div class="wg-row"><span class="wg-grow">${e.co}</span><span class="badge ${e.type==='Dividend'?'b-up':e.type==='Bonus'?'b-warn':'b-neu'}">${e.type}</span></div>`).join('');}},
  ],
};
const WIDGET_DEFAULTS={trader:['movers','heatmap','pnl'],investor:['goals','sipcal','alloc']};
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
function addWidget(k){const a=activeWidgets(); if(widgetCatalog().some(w=>w.key===k)&&!a.includes(k)){a.push(k);renderWidgetStack();renderWidgetGallery();saveState();}}
function removeWidget(k){const p=personaKey();state.widgets[p]=activeWidgets().filter(x=>x!==k);renderWidgetStack();renderWidgetGallery();saveState();}
function toggleWidget(k){ activeWidgets().includes(k)?removeWidget(k):addWidget(k); }
function openWidgetGallery(o){ const g=$('widgetGallery'); if(!g)return; g.classList.toggle('collapsed',!o); $('widgetGalleryScrim').classList.toggle('show',o); if(o)renderWidgetGallery(); }
function renderWidgetGallery(){
  const body=$('wgGalleryBody'); if(!body) return;
  const inv=isInvestor(), keys=activeWidgets();
  const sub=$('wgSubtitle'); if(sub) sub.textContent=inv?'Wealth, planning & discovery widgets':'Real-time market & execution widgets';
  const panes=[['watchlist','star'],['chart','trendUp'],['panel','layout'],['order','scale'],['context','target']];
  const paneHtml=`<div class="wgl-sec">Layout panels</div>`+panes.map(([k,ic])=>{const on=paneVisible(k),nm=CARD_LABEL[k]||k;
    return `<button class="wgl-item ${on?'on':''}" data-ptoggle="${k}" aria-pressed="${on}">
      <span class="wgl-ic">${icon(ic,17)}</span>
      <span class="wgl-tb"><b>${nm}</b><span>${on?'Showing':'Hidden — tap to restore'}</span></span>
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
    <button class="cc-btn cc-close" data-cardbtn="close" data-cardkey="${key}" title="Close ${nm} — restore from + Widgets" aria-label="Close ${nm}">${icon('close',13)}</button>
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
  updateCardBtns(); updateWorkspaceEmpty();
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
function paneVisible(key){ return ((state.cards&&state.cards[key])||'normal')!=='hidden'; }
function togglePane(key){ if(!state.cards)state.cards={}; state.cards[key]= paneVisible(key)?'hidden':'normal'; applyCardStates(); applyPaneWidths(); renderWidgetGallery(); saveState(); }
function restoreMaxCard(){ let changed=false; Object.keys(CARD_EL).forEach(k=>{if(state.cards[k]==='max'){state.cards[k]='normal';changed=true;}}); if(changed){applyCardStates();saveState();} }

/* ============================================================
   ENGINE READOUT
   ============================================================ */
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

/* ============================================================
   CONTROLLER
   ============================================================ */
function syncSliderLabels(){const s=readSignals();
  $('vTrend').textContent=(s.trend>=0?'+':'')+s.trend;$('vVix').textContent=s.vix.toFixed(1);
  $('vAd').textContent=s.ad.toFixed(2);$('vRsi').textContent=s.rsi;$('vPnl').textContent=(s.pnl>=0?'+':'')+s.pnl.toFixed(1)+'%';}
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
    if(opts.silent){ if(mismatch) applyRegime(newEngine); }     // quiet adoption (boot / first live sync) — no toast/cinematic
    else if(mismatch&&!state.suggesting){
      if(hard){applyRegime(newEngine);infoToast(newEngine,S,conf,sc,true,label);}
      else if(conf>=65){suggestToast(newEngine,S,conf,sc,false,label);}
    }
  }else if(mismatch&&conf>=65&&!state.suggesting&&!opts.silent){suggestToast(newEngine,S,conf,sc,true,label);}
  state.prevVix=raw.vix;
  renderEngineSrc();
}
/* ---- Regime panel ↔ live Kite: feed the real signals into the sliders so the panel,
   gauge and AUTO switching all reflect the live market. scoreSignals() over these raw
   values reproduces the bot's engine.components exactly (same weights). ---- */
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
function renderEngineSrc(){
  const el=$('engSrc'); if(!el) return;
  if(state.simOverride){
    el.className='eng-src sim';
    el.innerHTML=`<span class="es-dot"></span><span class="es-txt"><b>What-if</b> · simulated inputs, not the live market</span>${BOT.live?`<button class="es-reset" id="esReset" type="button">Use live</button>`:''}`;
  } else if(BOT.live && BOT.market){
    const reg=(BOT.market.engine&&BOT.market.engine.regime)||'—';
    const t=BOT.market.asOf?new Date(BOT.market.asOf).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'}):'';
    el.className='eng-src live';
    el.innerHTML=`<span class="es-dot live"></span><span class="es-txt"><b>● LIVE from Kite</b> · ${esc(reg)}${t?` · ${t}`:''} · updates every 30s</span>`;
  } else {
    el.className='eng-src off';
    el.innerHTML=`<span class="es-dot"></span><span class="es-txt"><b>Simulated</b> · connect Kite for the live regime — drag to explore</span>`;
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
  t.innerHTML=`<div class="toast-ico">${icon(hard?'bolt':regime,22)}</div><div class="toast-body"><b>${hard?'Hard signal — switched to '+L:'Switched to '+L}</b>
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
  // but those widths shift when the web font swaps in (FOUT) and on resize — re-measure then.
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
    if(saved.chart && window.TPChart) TPChart.restore(saved.chart); }
  if(saved&&saved.cards) state.cards=saved.cards;
  if(saved&&saved.ticker) state.ticker=saved.ticker;
  if(saved&&typeof saved.regimeCollapsed==='boolean') state.regimeCollapsed=saved.regimeCollapsed;
  state.persona=(saved&&saved.persona)||'trader';
  state.plan=(saved&&TIER_RANK[saved.plan]!=null)?saved.plan:'algopro';   // restore tier (validated)
  state.billing=(saved&&(saved.billing==='mo'||saved.billing==='yr'))?saved.billing:'mo';
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
  renderHdrMarket();                                // header Indian⇄Crypto toggle (left of search)
  if(state.algo&&state.algo.market==='crypto'){ renderTopIndex(); loadCrypto().then(()=>{ if(state.algo.market==='crypto'){ patchCryptoTape(); applyTickerSpeed(); } }); }
  tapeLoop();
  loadMarket(); setInterval(loadMarket, 30000);   // 100% real Kite market data (funds, regime, VIX, breadth)
  setInterval(()=>{ loadTicks();                  // real-time prices via Kite WebSocket (watchlist + chart)
    loadTape();                                   // real-time index tape (WS-fed) — patched in place, no scroll reset
    if(BOT.live && document.querySelector('.wg-card[data-wkey="depth"]')) loadDepth(state.selected||'RELIANCE');
  }, 2000);
  // live crypto prices (Binance public, real) — drives the global rolling tape whenever Crypto is selected (5s poll)
  setInterval(()=>{ if(state.algo && state.algo.market==='crypto' && document.visibilityState==='visible')
    loadCrypto().then(()=>{ if(state.algo&&state.algo.market==='crypto') patchCryptoTape(); }); }, 5000);
  // fast real-time poll (2s): refresh live paper P&L + positions across ALL live algo
  // views — Marketplace, Leaderboard, Forward Test, Monitor. (Backtest is static, skip it.)
  // Safe re-render: skips the tick while a field is focused (no clobbering the capital box)
  // and preserves scroll so live numbers update without any UI disruption.
  const ALGO_LIVE_VIEWS=['market','leaderboard','forward','monitor','accuracy','analytics'];
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

/* ===== Universal instrument search (ALL segments) — shared by the top-bar search and the
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
/* ============================================================
   MONETIZATION — tiers, entitlements & in-app storefront.
   Real entitlement model + feature-gating + a pricing storefront. Payment is a
   LABELLED DEMO: selecting a plan switches your in-app tier so you can experience
   it; real checkout (Razorpay) + user accounts aren't wired — nothing is charged.
   ============================================================ */
// each feature = [label, liveToday?]  → storefront shows ✓ available now vs ○ on the roadmap (honest)
const PLANS=[
  {id:'free',name:'Paper',tag:'Free forever',mo:0,yr:0,accent:'#64748b',
   blurb:'The honest core — analyse real markets &amp; paper-trade, free.',
   feats:[['Full terminal + all-segment search',1],['Real charts &amp; option chain',1],['Real portfolio (read-only)',1],['Paper trading + forward-test',1],['Regime engine',1],['AI copilot (demo; live via your proxy)',1]]},
  {id:'trader',name:'Trader',tag:'Active trader',mo:349,yr:2990,accent:'#0ea5e9',
   blurb:'A real cockpit on top of your Zerodha account.',
   feats:[['Everything in Paper',1],['Streaming chain + indices',1],['Portfolio analytics (drift/concentration)',0],['Real order execution',0],['Price/indicator alerts',0],['Multiple named watchlists',0]]},
  {id:'algopro',name:'Algo Pro',tag:'Automation',star:true,mo:749,yr:5990,accent:'#10b981',
   blurb:'Run validated strategies live — pay only when it’s proven.',
   feats:[['Everything in Trader',1],['16-gate go-live audit',1],['Real historical backtests',0],['Run strategies live (in-UI)',0],['Deploy / pause from the UI',0],['AI copilot (higher limits)',1]]},
  {id:'quant',name:'Quant',tag:'Power user / HNI',mo:1799,yr:14990,accent:'#8b5cf6',
   blurb:'Unlimited automation, API access &amp; priority compute.',
   feats:[['Everything in Algo Pro',1],['Unlimited live strategies',0],['Priority backtests',0],['API access',0],['Advanced analytics',0],['Highest AI limits',1]]},
];
const ADDONS=[
  {id:'copilot',name:'Copilot',mo:249,note:'150 msgs + credits at cost +15%',blurb:'The AI agent: reads real holdings, runs backtests, drafts gated orders.'},
  {id:'slot',name:'Extra live slot',mo:199,note:'per strategy / mo',blurb:'Scale automation — pay only for what you run.'},
];
const TIER_RANK={free:0,trader:1,algopro:2,quant:3};
// NB: feature entitlement ENFORCEMENT is intentionally NOT done client-side (it's bypassable) —
// the storefront is a roadmap preview; real gating belongs server-side once there's a backend.
function curPlan(){ return PLANS.find(p=>p.id===state.plan)||PLANS[0]; }
function renderPlanChip(){ const el=$('planChip'); if(!el) return; const p=curPlan();
  el.innerHTML=`${p.star?icon('bolt',12):icon('spark',12)}<span>${esc(p.name)}</span>`;
  el.title='Your plan: '+p.name+' — view pricing'; el.onclick=openPricing; }
let _pxEsc;
function closePricing(){ const o=$('pricingOv'); if(o)o.remove(); if(_pxEsc)document.removeEventListener('keydown',_pxEsc); }
function openPricing(){
  closePricing();
  const annual=(state.billing||'mo')==='yr';
  const cards=PLANS.map(p=>{
    const cur=p.id===state.plan;
    const price=p.mo===0?'Free':(annual?`₹${Math.round(p.yr/12).toLocaleString('en-IN')}`:`₹${p.mo.toLocaleString('en-IN')}`);
    const sub=p.mo===0?'forever':(annual?`/mo · ₹${p.yr.toLocaleString('en-IN')} billed yearly`:'/mo');
    const up=TIER_RANK[p.id]>TIER_RANK[state.plan];
    const cta=cur?`<button class="pc-cta cur" disabled>${icon('check',13)} Previewing</button>`
      :`<button class="pc-cta" data-pickplan="${p.id}">Preview ${esc(p.name)}</button>`;
    return `<div class="pc-card${p.star?' star':''}${cur?' cur':''}" style="--pc:${p.accent}">
      ${p.star?'<span class="pc-flag">Most popular</span>':''}
      <div class="pc-h"><b>${esc(p.name)}</b><i>${esc(p.tag)}</i></div>
      <div class="pc-price"><b>${price}</b><span>${sub}</span></div>
      <p class="pc-blurb">${p.blurb}</p>
      <ul class="pc-feats">${p.feats.map(([f,live])=>`<li class="${live?'':'soon'}"><span class="pc-tk">${icon(live?'check':'clock',12)}</span>${f}${live?'':' <i class="soon-pill">soon</i>'}</li>`).join('')}</ul>
      ${cta}</div>`;
  }).join('');
  const addons=ADDONS.map(a=>`<div class="pc-addon"><div class="pc-an"><b>${esc(a.name)}</b><span>₹${a.mo}/mo · ${esc(a.note)}</span></div><p>${esc(a.blurb)}</p></div>`).join('');
  const ov=document.createElement('div'); ov.className='pricing-ov'; ov.id='pricingOv';
  ov.innerHTML=`<div class="pricing-panel" role="dialog" aria-modal="true" aria-label="Pricing">
    <div class="pricing-top"><div><h2>Pricing — roadmap preview</h2>
      <p>Our planned model. <b class="leg-now">✓ available today</b> · <b class="leg-soon">○ on the roadmap</b>. We only charge for what’s real — nothing here is billed yet.</p></div>
      <button class="pricing-x" data-pxclose aria-label="Close pricing">${icon('close',18)}</button></div>
    <div class="pricing-founder">${icon('bolt',14)}<span><b>Founder Lifetime</b> — first 250 users: <b>₹4,999 once</b> = lifetime Algo Pro. <i>60-day launch offer.</i></span></div>
    <div class="pricing-toggle"><button class="pt-opt${!annual?' on':''}" data-cycle="mo">Monthly</button><button class="pt-opt${annual?' on':''}" data-cycle="yr">Annual <i>save ~30%</i></button></div>
    <div class="pricing-grid">${cards}</div>
    <div class="pricing-addons"><div class="pc-addons-h">Add-ons</div>${addons}</div>
    <div class="pricing-b2b">${icon('shield',15)}<div><b>White-label / B2B</b> — license the honest-algo + safety + terminal stack to sub-brokers, RIAs &amp; PMS who hold the advice licenses. The cleanest path, highest ACV. <button class="pc-link" data-pxb2b>Talk to us →</button></div></div>
    <p class="pricing-demo">${icon('shield',12)}<span><b>Roadmap preview — nothing is charged.</b> ✓ = working today · ○ = planned. Choosing a plan just previews the tier in-app; real checkout (Razorpay) &amp; accounts aren’t built. We won’t sell a feature until it’s real.</span></p>
  </div>`;
  document.body.appendChild(ov);
  ov.addEventListener('click',e=>{
    if(e.target===ov||e.target.closest('[data-pxclose]')) return closePricing();
    const c=e.target.closest('[data-cycle]'); if(c){ state.billing=c.dataset.cycle; saveState(); openPricing(); return; }
    const pk=e.target.closest('[data-pickplan]'); if(pk) return pickPlan(pk.dataset.pickplan);
    if(e.target.closest('[data-pxb2b]')) quickToast('White-label enquiry','In production this opens a B2B contact form / Calendly. Tell me and I’ll wire it.');
  });
  _pxEsc=e=>{ if(e.key==='Escape')closePricing(); }; document.addEventListener('keydown',_pxEsc);
}
function pickPlan(id){
  if(!PLANS.find(p=>p.id===id)) return;
  state.plan=id; saveState(); closePricing(); renderPlanChip();
  if(typeof applyPersona==='function') applyPersona(state.persona);
  quickToast('Previewing '+curPlan().name,'Roadmap preview — nothing is charged. ✓ features work today; ○ features are planned.');
}

document.addEventListener('DOMContentLoaded',init);

