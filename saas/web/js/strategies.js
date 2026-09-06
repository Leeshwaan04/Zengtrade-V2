// zengtrade: featured strategy catalog for the frontend.
// Backtest metrics are HONEST and LABELLED: ~2 years of real daily Binance data, net of global
// costs, from the evaluation harness. They are backtest (NOT forward-proven) and shown as such.
export const STRATEGIES = [
  {
    key: "trend_follow", name: "Crypto Trend Follower", style: "Trend",
    desc: "Rides big crypto trends — breakout entry, trailing stop. The flagship: robustly positive across every parameter setting.",
    bt: { trades: 51, win: 23.5, net: 2289, pf: 1.99 },
  },
  {
    key: "momo", name: "Momentum", style: "Trend",
    desc: "A faster trend variant that catches shorter momentum bursts on the majors.",
    bt: { trades: 90, win: 15.6, net: 1313, pf: 1.32 },
  },
  {
    key: "bollinger", name: "Bollinger Reversion", style: "Reversion",
    desc: "Fades stretched daily moves back to the mean. High win-rate, low turnover.",
    bt: { trades: 23, win: 56.5, net: 865, pf: 2.87 },
  },
];
export const byKey = Object.fromEntries(STRATEGIES.map(s => [s.key, s]));
export const nameOf = (k) => byKey[k]?.name || k;
