import math

PILLARS = {
    "markets": "Crypto Markets",
    "trading": "Technical Trading",
    "investing": "Strategic Investing",
    "algo": "Algorithmic Trading",
    "strategies": "Quantitative Strategies"
}

def generate_topics():
    topics = []
    
    # Pillar 1: Markets
    market_themes = [
        ("halving-supply-shock-cycle", "Halving Cycle Supply Shock & Macro Liquidity", "How fixed issuance reductions and ETF inflows drive structural supply shocks in {name} ({sym})."),
        ("institutional-etf-inflows", "Institutional ETF Inflows & Spot Liquidity", "Tracking the absorption of {sym} liquid supply by major institutional custodians."),
        ("funding-rate-sentiment-bias", "Perpetual Funding Rate Sentiment & Liquidations", "Analyzing {name} derivatives funding rates to anticipate short squeezes and long liquidations."),
        ("exchange-reserve-exhaustion", "Centralized Exchange Reserve Depletion", "The macro implications of {sym} leaving exchange wallets for deep cold storage."),
        ("whale-wallet-accumulation", "Whale Wallet Accumulation & Smart Money", "On-chain footprints of institutional {name} accumulation and distribution phases."),
        ("macro-interest-rate-regime", "Federal Reserve Rates & Crypto Risk Premia", "How global M2 money supply and Fed interest rates dictate the {sym} volatility regime."),
        ("stablecoin-supply-ratio", "Stablecoin Supply Ratio (SSR) & Dry Powder", "Using stablecoin velocity to measure sidelined capital ready to deploy into {name}."),
        ("derivative-open-interest-divergence", "Open Interest Divergence & Volatility Squeezes", "Identifying major {sym} directional breaks through open interest and volume mismatches."),
        ("on-chain-nvt-ratio", "Network Value to Transactions (NVT) Valuation", "Fundamental valuation of {name} using the NVT golden cross metric."),
        ("miner-capitulation-hash-ribbons", "Miner Capitulation Dynamics & Hash Ribbons", "How {sym} hash rate capitulation signals generational macro bottoms."),
        ("realized-cap-mvrv-zscore", "MVRV Z-Score Extremes & Realized Capitalization", "Using the MVRV Z-Score to identify {name} overvaluation and deep value zones."),
        ("order-book-depth-slippage", "Bid-Ask Order Book Depth & Market Impact", "Analyzing {sym} liquidity thickness to calculate realistic high-frequency execution slippage."),
        ("cross-asset-correlation-matrix", "Cross-Asset Correlation with US Equities & Gold", "Decoupling phases and beta tracking of {name} against legacy financial markets."),
        ("liquidity-cascade-liquidations", "Cascading Liquidations & Flash Deleveraging", "How automated risk engines trigger violent {sym} liquidation cascades."),
        ("dex-to-cex-volume-dominance", "DEX vs CEX Volume Dominance Shifts", "Decentralized liquidity migration patterns and their impact on {name} spot pricing."),
        ("grayscale-discount-premium-arbitrage", "Institutional Trust Premium Dislocation", "Arbitraging net asset value (NAV) premiums in legacy {sym} trust vehicles."),
        ("implied-volatility-term-structure", "Options Implied Volatility Surface & Skew", "Reading the {name} options market volatility smile for directional probability."),
        ("dormant-supply-revival-risk", "Dormant Supply Revival & Distribution Waves", "When long-term {sym} holders move ancient coins, and how it impacts market structure."),
        ("layer-1-gas-fee-burn-velocity", "Network Fee Burn & Tokenomic Velocity", "Deflationary pressure and base fee burn mechanics supporting the {name} ecosystem."),
        ("global-m2-money-supply-beta", "Global M2 Central Bank Liquidity Beta", "Measuring {sym}'s elasticity to global central bank balance sheet expansions.")
    ]
    for slug, title, hook in market_themes:
        topics.append({"slug": slug, "pillar": "markets", "title": title, "hook": hook})
        
    # Pillar 2: Trading
    trading_themes = [
        ("order-block-liquidity-sweeps", "Order Block Identification & Liquidity Sweeps", "Locating institutional {sym} order blocks and avoiding smart money liquidity traps."),
        ("fair-value-gap-imbalance", "Fair Value Gap (FVG) & Price Imbalances", "Trading {name} price inefficiencies as the market hunts for volume profile rebalancing."),
        ("volume-profile-poc-rejection", "Volume Profile Point of Control (POC) Rejections", "Trading high-volume nodes and value area pivots on the {sym} order flow footprint."),
        ("wyckoff-accumulation-springs", "Wyckoff Accumulation Schematics & Springs", "Identifying phase C spring tests in {name} to catch markup phases early."),
        ("anchored-vwap-support-resistance", "Anchored VWAP from Key Market Cycle Highs", "Using volume-weighted average price anchored to major {sym} macroeconomic events."),
        ("bullish-bearish-divergence-filter", "Multi-Oscillator Momentum Divergences", "Spotting {name} trend exhaustion before the reversal using MACD and RSI divergence."),
        ("average-true-range-volatility-stops", "ATR-Based Volatility Trailing Stops", "Protecting {sym} profits with dynamic Chandelier exits tied to market volatility."),
        ("fibonacci-golden-pocket-retracement", "Fibonacci 61.8% Golden Pocket Reversals", "Executing limit orders in the {name} 61.8% to 65% optimal trade entry zone."),
        ("liquidity-hunt-stop-runs", "Stop-Loss Hunting Patterns & Smart Money Traps", "How market makers engineer {sym} stop runs to accumulate massive positions."),
        ("break-of-structure-trend-shift", "Market Structure Shift (MSS) & Break of Structure", "Reading raw {name} price action to confirm institutional trend transitions."),
        ("candlestick-orderflow-delta", "Cumulative Volume Delta (CVD) Absorption", "Detecting passive {sym} limit order absorption against aggressive market orders."),
        ("bollinger-bandwidth-squeeze-expansion", "Bollinger Bandwidth Compression & Volatility Bursts", "Trading {name} volatility expansion following historically tight bandwidth squeezes."),
        ("heikin-ashi-trend-smoothing", "Heikin-Ashi Trend Filtering & Noise Reduction", "Filtering out {sym} intraday noise to ride clean macro trends securely."),
        ("parabolic-sar-trailing-accelerator", "Parabolic SAR Acceleration Factor Optimization", "Tuning the SAR accelerator to perfectly track {name} parabolic blow-off tops."),
        ("keltner-channel-breakout-bands", "Keltner Channel Breakouts & EMA Trend Lines", "Catching {sym} momentum surges using volatility-adjusted Keltner envelopes."),
        ("ichimoku-kumo-cloud-twist", "Ichimoku Kumo Cloud Breakouts & Senkou Flips", "Trading the {name} equilibrium breakout when the Kumo cloud twists bullish."),
        ("support-resistance-flip-zones", "Polarity Principles & Support-Resistance Flips", "Executing {sym} retests when multi-month resistance definitively flips to support."),
        ("supertrend-atr-pivot-tracking", "Supertrend Trailing Stops with Multi-Timeframe Alignment", "Riding {name} macro trends safely by aligning 4-hour and daily Supertrend pivots."),
        ("macd-histogram-momentum-surges", "MACD Zero-Line Acceleration & Histogram Expansions", "Entering {sym} momentum waves exactly as institutional accumulation accelerates."),
        ("stochastic-rsi-overbought-oversold", "Stochastic RSI Double-Tap Momentum Reversals", "Fading extreme {name} overbought and oversold conditions in range-bound regimes.")
    ]
    for slug, title, hook in trading_themes:
        topics.append({"slug": slug, "pillar": "trading", "title": title, "hook": hook})

    # Pillar 3: Investing
    investing_themes = [
        ("dollar-cost-averaging-compounding", "Dynamic Volatility-Scaled Dollar-Cost Averaging", "Accelerating {name} accumulation by scaling DCA buys dynamically during deep drawdowns."),
        ("macro-regime-capital-shield", "Regime-Aware Capital Preservation & Cash Stand-Downs", "Protecting {sym} gains by automatically migrating to stables during bear regimes."),
        ("asymmetric-risk-portfolio-allocation", "Kelly Criterion & Asymmetric Position Sizing", "Optimizing your {name} allocation using advanced Kelly sizing for maximum compounding."),
        ("drawdown-mitigation-circuit-breakers", "Systematic Drawdown Circuit Breakers", "Implementing hard capital stops to prevent catastrophic {sym} portfolio drawdowns."),
        ("portfolio-rebalancing-thresholds", "Volatility-Triggered vs Time-Based Rebalancing", "Harvesting {name} volatility premium by rebalancing on deviation thresholds rather than time."),
        ("risk-parity-crypto-allocation", "Risk Parity Asset Weighting via Inverse Volatility", "Balancing {sym} against lower-beta assets to achieve a perfectly neutral risk portfolio."),
        ("long-term-hodl-vs-systematic-harvest", "Buy-and-Hold vs Systematic Profit Harvesting", "Why blind {name} holding underperforms systematic regime-aware profit taking."),
        ("cyclical-bear-market-accumulation", "Bear Market Accumulation Corridors & Value Bands", "Identifying multi-year {sym} accumulation zones using fundamental value bands."),
        ("tax-loss-harvesting-strategies", "Tax-Efficient Crypto Portfolio Rebalancing", "Resetting cost basis on {name} while maintaining optimal market exposure."),
        ("lump-sum-vs-dca-simulations", "Lump-Sum vs DCA Expected Value in Exponential Cycles", "Mathematical breakdown of optimal capital deployment into {sym} during bull cycles."),
        ("treasury-management-crypto-yield", "Corporate Treasury Allocation & Non-Custodial Yield", "Generating delta-neutral yield on {name} allocations for corporate treasuries."),
        ("crypto-retirement-roth-ira", "Self-Directed Crypto IRA Allocation Rules", "Structuring long-term, tax-advantaged exposure to {sym} over a multi-decade horizon."),
        ("stablecoin-yield-cash-reserves", "Delta-Neutral Cash Collateral & Dry Powder", "Earning risk-free yield on stables while awaiting the perfect {name} entry."),
        ("cross-cycle-beta-management", "Managing Portfolio Beta Across Market Regimes", "Dynamically adjusting {sym} beta exposure based on the macro liquidity environment."),
        ("layer-1-vs-layer-2-allocation", "Infrastructure Layer Allocation Matrices", "Strategic tiering of {name} within a diversified layer-1 and layer-2 thesis."),
        ("tokenomics-dilution-inflation-impact", "Fully Diluted Valuation (FDV) & Vesting Cliff Defenses", "Protecting your {sym} investment from hidden inflation and venture capital unlocks."),
        ("black-swan-tail-risk-hedging", "Out-of-the-Money Puts & Synthetic Tail-Risk Insurance", "Hedging massive {name} downside using asymmetric derivative options."),
        ("compound-interest-staking-reinvestment", "Staking Yield vs Capital Depreciation Risk", "Calculating the true net yield of {sym} staking after adjusting for token inflation."),
        ("governance-token-value-capture", "Fee Switch Mechanics & Real Yield Investment", "Evaluating {name} as a cash-flowing asset based on protocol revenue distribution."),
        ("non-custodial-cold-storage-custody", "Cold Storage Verification & Hardware Security Protocols", "Securing your long-term {sym} bags with absolute cryptographic sovereignty.")
    ]
    for slug, title, hook in investing_themes:
        topics.append({"slug": slug, "pillar": "investing", "title": title, "hook": hook})

    # Pillar 4: Algo
    algo_themes = [
        ("walk-forward-regime-validation", "Walk-Forward 3-Regime Optimization", "Validating {name} strategies out-of-sample across Bull, Neutral, and Bear regimes."),
        ("slippage-order-book-friction", "Modeling 35 bps Round-Trip Fee & Slippage Friction", "Why 99% of {sym} backtests are lies, and how to model true execution friction."),
        ("execution-latency-arbitrage", "Non-Colocated REST & WebSocket API Latency", "Managing sub-second {name} execution latency on cloud infrastructure."),
        ("backtesting-pitfalls-lookahead-bias", "Eliminating Lookahead Bias & Survivorship Distortions", "Sanitizing {sym} historical data to prevent future-leaking in algorithmic backtests."),
        ("monte-carlo-risk-simulation", "Monte Carlo Permutation Testing for Max Drawdown", "Stress-testing {name} algorithms against 10,000 synthetic future price paths."),
        ("regime-detection-hmm-clustering", "Hidden Markov Models & Volatility Regime Clustering", "Teaching your {sym} bot to mathematically detect market regime shifts in real-time."),
        ("limit-order-maker-rebate-routing", "Passive Maker Limit Order Queuing & Fill Probability", "Capturing negative fees on {name} by predicting limit order queue dynamics."),
        ("time-in-force-execution-policies", "IOC, FOK, and GTC Execution Algorithms", "Routing {sym} orders dynamically based on order book depth and volatility."),
        ("dynamic-position-sizing-volatility", "Normalized Volatility Parity & Sizing Governors", "Scaling {name} trade size inversely to real-time Average True Range (ATR)."),
        ("api-key-security-ip-whitelisting", "Non-Custodial API Key Hygiene & IP Whitelisting", "Securing your {sym} trading server with strict IP scopes and withdrawal restrictions."),
        ("automated-bracket-order-management", "OCO Bracket Automation & Dynamic Profit Locks", "Managing {name} risk natively on-exchange using One-Cancels-the-Other routing."),
        ("real-time-websocket-reconnection", "WebSocket Disconnect Recovery & Synthetic State Resync", "Ensuring zero downtime for {sym} algorithms during exchange API maintenance."),
        ("twap-vwap-institutional-execution", "TWAP and VWAP Execution Algorithms", "Slicing massive {name} orders into micro-executions to hide from HFT front-runners."),
        ("paper-trading-vs-live-fill-discrepancies", "Auditing Paper Execution Against Realized Limit Fills", "Bridging the gap between {sym} paper simulation and real-world execution."),
        ("backtest-overfitting-deflated-sharpe", "Deflated Sharpe Ratio & Multiple Hypothesis Testing", "Mathematically proving {name} alpha is real and not a product of curve fitting."),
        ("co-integration-pairs-trading", "Statistical Co-Integration & Mean-Reverting Pairs", "Arbitraging the statistical spread between {sym} and correlated layer-1 assets."),
        ("order-cancellation-ratio-throttling", "Exchange Rate Limits & Weight Budget Optimization", "Managing binance IP weight bans when aggressively market-making {name}."),
        ("synthetic-order-routing-multi-pool", "Smart Order Routing Across Isolated Order Books", "Sweeping optimal {sym} liquidity across spot, margin, and perpetual venues."),
        ("kill-switch-circuit-breaker-engine", "Automated Circuit Breakers for API Drift", "Halting {name} execution instantly when exchange API data goes stale or corrupt."),
        ("quant-performance-attribution-metrics", "Sortino, Calmar, and Omega Ratios for Crypto Edge Proof", "Grading your {sym} algorithm's true risk-adjusted return against a buy-and-hold baseline.")
    ]
    for slug, title, hook in algo_themes:
        topics.append({"slug": slug, "pillar": "algo", "title": title, "hook": hook})

    # Pillar 5: Strategies
    strategies_themes = [
        ("bollinger-squeeze-breakout", "Bollinger Band Squeeze Breakout with Keltner Confirmation", "Trading explosive {name} volatility expansions after prolonged historical consolidation."),
        ("dual-ema-golden-cross-system", "Dual EMA 50/200 Trend-Following Filter System", "The definitive {sym} macro trend following engine for capturing multi-month runs."),
        ("rsi-divergence-reversal-engine", "Multi-Timeframe RSI Divergence Exhaustion System", "Systematically fading {name} momentum exhaustion at key psychological boundaries."),
        ("cash-and-carry-basis-arbitrage", "Cash and Carry Basis Arbitrage Between Spot and Perps", "Extracting risk-free {sym} yield by shorting the perpetual premium against spot holding."),
        ("grid-trading-range-accumulation", "Geometric Grid Trading Engine for Range-Bound Regimes", "Milking {name} chop by deploying a dynamic multi-level geometric grid."),
        ("breakout-volume-expansion-scanner", "Volume-Weighted Breakout Strategy on 4-Hour Pivots", "Riding {sym} momentum only when validated by a 300% expansion in hourly volume."),
        ("vwap-mean-reversion-fade", "Second Standard Deviation VWAP Band Reversion Scalper", "Fading extreme {name} intraday deviations away from the volume-weighted average price."),
        ("momentum-trailing-atr-system", "Momentum Continuation System with Chandelier ATR Stops", "Locking in {sym} profits dynamically as the trend accelerates to the upside."),
        ("supertrend-multi-timeframe-cascade", "Tri-Timeframe Supertrend Alignment and Trend Ride", "Executing {name} trades only when the 1H, 4H, and 1D Supertrends flash green."),
        ("order-flow-imbalance-scalping", "Order Flow Imbalance and Footprint Delta Scalping", "Exploiting micro {sym} order book imbalances before the retail market reacts."),
        ("triangular-cross-currency-arbitrage", "Statistical Triangular Currency Loop Opportunities", "Exploiting fleeting {name} cross-pair inefficiencies across base and quote pairs."),
        ("keltner-volatility-channel-trend", "Keltner Volatility Channel Riding in Expansion Regimes", "Using ATR-based {sym} envelopes to hold winners through aggressive noise."),
        ("parabolic-sar-macd-confluence", "Parabolic SAR and MACD Confluence Momentum Strategy", "Combining {name} trend acceleration with underlying oscillator momentum."),
        ("donchian-channel-turtle-breakout", "Classic Donchian 20-Day Turtle Breakout for Crypto", "Adapting the legendary Turtle trading system to highly volatile {sym} markets."),
        ("stochastic-macd-double-cross", "Stochastic Oscillator and MACD Dual Confirmation Strategy", "Filtering {name} fakeouts by demanding dual oscillator alignment before entry."),
        ("intraday-range-breakout-opening", "Daily Open Range Breakout (ORB) System for Crypto", "Trading the initial {sym} volatility injection following the daily UTC reset."),
        ("mean-reversion-envelope-bands", "Moving Average Envelope Reversion for Sideways Regimes", "Fading {name} extremes when the market is trapped in a tight low-volatility regime."),
        ("trend-exhaustion-exhaustion-fades", "Exhaustion Volume Climax and Counter-Trend Fade Strategy", "Catching the exact {sym} blow-off top using extreme volume climaxes."),
        ("hull-moving-average-zero-lag", "Zero-Lag Hull Moving Average (HMA) Quick Trend Capture", "Reducing {name} moving average lag to zero for razor-sharp entries and exits."),
        ("adaptive-moving-average-kaufman", "Kaufman Adaptive Moving Average (KAMA) Noise Filtering", "A {sym} trend line that automatically flattens in chop and steepens in trends.")
    ]
    for slug, title, hook in strategies_themes:
        topics.append({"slug": slug, "pillar": "strategies", "title": title, "hook": hook})

    return topics

if __name__ == "__main__":
    t = generate_topics()
    print(f"Generated {len(t)} topics.")
