import math

PILLARS = {
    "markets": "Crypto Markets",
    "trading": "Technical Trading",
    "investing": "Strategic Investing",
    "algo": "Algorithmic Trading",
    "strategies": "Quantitative Strategies",
    "indicators": "Technical Indicators",
    "risk": "Risk Management",
    "derivatives": "Derivatives & Arbitrage"
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
        ("global-m2-money-supply-beta", "Global M2 Central Bank Liquidity Beta", "Measuring {sym}'s elasticity to global central bank balance sheet expansions."),
        ("sovereign-wealth-fund-reserves", "Sovereign State Treasury Accumulation Dynamics", "Tracking sovereign wealth fund adoption and nation-state reserve strategies for {name}."),
        ("otc-desk-dark-pool-flows", "Institutional Dark Pool Footprints & Block Trades", "Detecting off-exchange OTC institutional accumulation before price impacts spot order books."),
        ("cross-chain-bridge-liquidity-migration", "Cross-Chain Liquidity Migration & Yield Arbitrage", "Measuring TVL velocity and bridge capital flows into the {name} ecosystem."),
        ("regulatory-enforcement-volatility", "Regulatory Arbitrage & Jurisdictional Spot Liquidity", "How shifting global compliance frameworks reshape {sym} order book liquidity."),
        ("market-depth-slippage-elasticity", "Order Book Resilience & Market Depth Elasticity", "Quantifying how many millions in spot market orders it takes to move {sym} by 1%.")
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
        ("stochastic-rsi-overbought-oversold", "Stochastic RSI Double-Tap Momentum Reversals", "Fading extreme {name} overbought and oversold conditions in range-bound regimes."),
        ("vwap-deviation-bands-mean-reversion", "VWAP 2nd Standard Deviation Envelope Fades", "Catching statistical mean reversion on {sym} when price stretches beyond institutional value."),
        ("multi-timeframe-confluence-matrix", "Triple Screen Multi-Timeframe Confluence Execution", "Eliminating false breakouts in {name} by aligning macro, intermediate, and execution timeframes."),
        ("liquidity-void-fill-patterns", "Liquidity Void Fills & High-Velocity Impulse Reversals", "Predicting the rapid rebalancing of {sym} price vacuums left behind by institutional pumps."),
        ("donchian-channel-breakouts", "Donchian 20-Day High Breakout Trend Riders", "Systematic trend execution on {name} when price prints a fresh 20-day high with volume."),
        ("volume-weighted-macd-zero-cross", "Volume-Weighted MACD Histogram Expansion", "Validating true momentum shifts in {sym} by weighting moving average crosses with real volume.")
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
        ("non-custodial-cold-storage-custody", "Cold Storage Verification & Hardware Security Protocols", "Securing your long-term {sym} bags with absolute cryptographic sovereignty."),
        ("secular-logarithmic-growth-curves", "Logarithmic Regression Growth Channels & Fair Value", "Modeling long-term secular price appreciation bands for {name} across multi-year cycles."),
        ("institutional-custody-safeguards", "Multi-Sig Governance & Institutional Key Sharding", "Enterprise security architectures for protecting significant {sym} treasury holdings."),
        ("crypto-index-passive-rebalancing", "Market-Cap Weighted Crypto Index Methodology", "Building a rules-based, low-turnover passive crypto index featuring {name}."),
        ("stochastic-portfolio-optimization", "Markowitz Efficient Frontier for Crypto Portfolios", "Finding the mathematically optimal Sharpe-maximizing weighting for {sym}."),
        ("generational-wealth-cold-storage", "Cryptographic Inheritance Planning & Time-Locked Proofs", "Structuring non-custodial asset succession protocols for your {name} holdings.")
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
        ("quant-performance-attribution-metrics", "Sortino, Calmar, and Omega Ratios for Crypto Edge Proof", "Grading your {sym} algorithm's true risk-adjusted return against a buy-and-hold baseline."),
        ("high-frequency-order-book-resilience", "Bid-Ask Spread Asymmetry & Microstructure Resilience", "Measuring queue priority and fill likelihood for passive {sym} limit orders."),
        ("automated-rebalance-slippage-guards", "Dynamic Slippage Guards for Algorithmic Rebalancing", "Protecting large {name} portfolio rotations from front-running MEV and exchange toxicity."),
        ("multi-exchange-latency-arbitrage", "Cross-Venue Microstructure Arbitrage Models", "Exploiting high-velocity price discovery leads between Binance and decentralized {sym} books."),
        ("event-driven-volatility-filters", "Macro Event Blackout Windows & FOMC Volatility Gates", "Pausing {name} algorithmic execution during high-impact macroeconomic releases."),
        ("genetic-algorithm-parameter-tuning", "Genetic Algorithms & Hyperparameter Optimization", "Optimizing indicator periods for {sym} without falling into curve-fitting traps.")
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
        ("adaptive-moving-average-kaufman", "Kaufman Adaptive Moving Average (KAMA) Noise Filtering", "A {sym} trend line that automatically flattens in chop and steepens in trends."),
        ("volume-profile-value-area-reversion", "Value Area High/Low Reversion in Ranging Regimes", "Exploiting 70% value area rotational behavior on the {name} volume footprint."),
        ("fibonacci-extension-trend-expansion", "1.618 and 2.618 Fibonacci Expansion Target Models", "Projecting algorithmic profit-taking targets during parabolic {sym} price runs."),
        ("heikin-ashi-momentum-continuation", "Consecutive Smooth Heikin-Ashi Candle Continuation", "Holding {name} trend positions until two consecutive counter-trend candles print."),
        ("relative-volatility-index-scalper", "Relative Volatility Index (RVI) Directional Filter", "Using standard deviation directionality to filter false {sym} moving average crosses."),
        ("supertrend-vwap-hybrid-engine", "Supertrend and Anchored VWAP Dual Confirmation Engine", "Institutional trend entries verified by volume-weighted average price boundaries on {sym}.")
    ]
    for slug, title, hook in strategies_themes:
        topics.append({"slug": slug, "pillar": "strategies", "title": title, "hook": hook})

    # Pillar 6: Technical Indicators
    indicators_themes = [
        ("supertrend-atr-volatility-band", "Supertrend Indicator Formula & Dynamic ATR Banding", "Mathematical breakdown of the Average True Range multiplier behind {name} Supertrend signals."),
        ("relative-strength-index-momentum", "RSI Momentum Oscillator & Centerline Crossings", "Using the 14-period RSI centerline transition to gauge {sym} institutional accumulation."),
        ("exponential-moving-average-ribbon", "EMA Ribbon Convergence & Multi-Timeframe Alignment", "Visualizing macro structural shifts in {name} with an 8-line exponential ribbon."),
        ("volume-weighted-average-price-bands", "VWAP Standard Deviation Bands & Institutional Anchors", "How high-frequency institutional algos anchor execution benchmarks on {sym}."),
        ("bollinger-bands-standard-deviation", "Bollinger Bands Standard Deviation & Volatility Squeezes", "Quantifying the statistical probability of {name} touching 2-sigma outer volatility bands."),
        ("moving-average-convergence-divergence", "MACD Signal Line & Histogram Momentum Formula", "Deriving directional velocity and momentum divergence on {sym} using dual EMAs."),
        ("average-true-range-volatility-meter", "Average True Range (ATR) & Dynamic Sizing Metric", "Using Wilder's ATR formula to measure raw {name} price volatility without directional bias."),
        ("stochastic-rsi-momentum-oscillator", "Stochastic RSI Oscillator Overbought/Oversold Limits", "Achieving high-sensitivity cyclical turn detection on {sym} via the Stochastic RSI formula."),
        ("keltner-channels-average-true-range", "Keltner Channels & Exponential Moving Average Envelopes", "Combining 20 EMA baseline trend lines with 2x ATR volatility channels on {name}."),
        ("ichimoku-cloud-tenkan-kijun", "Ichimoku Cloud Tenkan-sen and Kijun-sen Equilibrium", "Reading the full Japanese equilibrium charting suite to establish {sym} macro support."),
        ("chaikin-money-flow-accumulation", "Chaikin Money Flow (CMF) & Volume Accumulation", "Measuring institutional money flow into {name} by cross-referencing volume and close location."),
        ("parabolic-sar-trailing-dots", "Parabolic SAR Stop and Reverse Dynamic Price Acceleration", "Mathematical mechanics of Wilder's acceleration factor in trailing {sym} stops."),
        ("commodity-channel-index-cyclical", "Commodity Channel Index (CCI) & Cyclical Price Extremes", "Detecting statistically rare statistical extensions in {name} using Lambert's CCI formula."),
        ("on-balance-volume-trend-confirmation", "On-Balance Volume (OBV) & Institutional Trend Divergence", "Tracking smart money positioning by adding or subtracting volume based on {sym} closing prints."),
        ("directional-movement-index-adx", "Average Directional Index (ADX) & Trend Strength Thresholds", "Determining whether {name} is in a genuine trending regime or a random walk."),
        ("donchian-channels-periodic-breakout", "Donchian Channels & 20-Day Turtle Breakout Bands", "The math behind N-period highest highs and lowest lows for systematic {sym} trend trading."),
        ("aroon-indicator-trend-initiation", "Aroon Oscillator & New Trend Identification", "Measuring the elapsed time between highs and lows to catch fresh {name} trends early."),
        ("money-flow-index-volume-weighted", "Money Flow Index (MFI) & Volume-Weighted RSI", "Combining price momentum with real tick volume to find hidden {sym} divergence."),
        ("hull-moving-average-weighted-speed", "Hull Moving Average (HMA) Calculation & Speed Optimization", "Eliminating moving average lag on {name} while retaining smooth curve properties."),
        ("kaufman-adaptive-moving-average", "Kaufman Adaptive Moving Average (KAMA) Noise Filtering", "Dynamic smoothing that slows down in {sym} chop and speeds up during aggressive breakouts."),
        ("rate-of-change-velocity-oscillator", "Rate of Change (ROC) & Momentum Velocity Metric", "Measuring pure percentage acceleration of {name} over discrete trading windows."),
        ("williams-percent-r-extreme-oscillator", "Williams %R Oscillator & Overbought Reversal Signals", "Pinpointing exact exhaustion points in {sym} by indexing close against high-low range."),
        ("vortex-indicator-directional-flow", "Vortex Indicator (VI) Positive and Negative Trend Flow", "Identifying the birth of major {name} multi-week trends via positive/negative vortex crosses."),
        ("elder-ray-bull-bear-power", "Elder-Ray Index & Bull/Bear Power Histogram", "Measuring the internal buying and selling pressure behind every {sym} daily candlestick."),
        ("zig-zag-retracement-filter", "Zig Zag Filter & Harmonic Price Wave Identification", "Filtering out sub-threshold noise to map clean Elliot Wave and swing structure on {name}.")
    ]
    for slug, title, hook in indicators_themes:
        topics.append({"slug": slug, "pillar": "indicators", "title": title, "hook": hook})

    # Pillar 7: Risk Management
    risk_themes = [
        ("atr-dynamic-trailing-stops", "Average True Range Dynamic Trailing Stops & Chandelier Exits", "Setting volatility-scaled trailing stops on {name} that never get stopped out by normal noise."),
        ("kelly-criterion-position-sizing", "Fractional Kelly Criterion & Mathematical Risk Optimization", "Calculating optimal position sizing for {sym} to maximize geometric wealth growth."),
        ("maximum-drawdown-circuit-breakers", "Automated Portfolio Circuit Breakers & Drawdown Halts", "Why hard percentage portfolio stops are critical when running automated algos on {name}."),
        ("position-sizing-volatility-parity", "Volatility Parity & Risk-Normalized Position Sizing", "Ensuring equal risk allocation across {sym} and correlated cryptocurrency assets."),
        ("value-at-risk-monte-carlo", "Value at Risk (VaR) & Parametric Portfolio Loss Estimates", "Calculating the 99% confidence maximum daily loss expectation for {name} holdings."),
        ("conditional-value-at-risk-cvar", "Conditional Value at Risk (CVaR) & Expected Shortfall", "Measuring tail-risk severity when black swan events strike the {sym} market."),
        ("risk-reward-ratio-expectancy", "Minimum 1:2 Risk-Reward Ratio & Positive Net Expectancy", "The mathematical impossibility of losing money when maintaining positive trade expectancy on {name}."),
        ("order-cooldown-overtrading-protection", "Automated Order Cooldowns & Overtrading Protection", "Enforcing programmatic time buffers between {sym} executions to eliminate emotional churn."),
        ("daily-loss-limits-hard-stop", "Daily Loss Limits & Forced Engine Sleep Modes", "Programmatic rules that automatically turn off trading if daily drawdown crosses 3% on {name}."),
        ("correlation-risk-cluster-avoidance", "Asset Correlation Matrices & Cluster Exposure Limits", "Preventing accidental 5x leveraged exposure when trading {sym} alongside correlated altcoins."),
        ("liquidity-depth-slippage-caps", "Order Book Depth Analysis & Max Slippage Thresholds", "Protecting your capital by refusing market orders when {name} order book depth thins out."),
        ("unrealized-profit-lock-ratchet", "Trailing Profit Ratchets & Breakeven Stop Escalation", "Moving stops to breakeven once {sym} achieves a 1.5R favorable price excursion."),
        ("downside-deviation-sortino-ratio", "Downside Deviation Management & Sortino Optimization", "Ignoring upside volatility to focus exclusively on eliminating harmful downside {name} variance."),
        ("kill-switch-emergency-deleveraging", "Single-Click Automated Kill-Switch Protocol", "Flattening all open {name} positions into cash instantaneously when market conditions corrupt."),
        ("counterparty-custody-risk-defense", "Non-Custodial Architecture & Exchange Solvency Protection", "Why keeping custody on your own exchange keys protects {sym} from centralized insolvency."),
        ("regime-shift-capital-preservation", "Regime-Triggered Cash Stand-Down Protocols", "Halting all trend breakout systems on {name} when the macro engine detects choppy neutral chop."),
        ("black-swan-tail-risk-insurance", "Synthetic Put Options & Tail Risk Protection", "Using asymmetric low-cost hedges to protect large spot {name} holdings from market meltdowns."),
        ("time-in-trade-decay-stops", "Time-Based Exit Triggers & Opportunity Cost Mitigation", "Closing stagnant {sym} positions after N bars to prevent capital from remaining dead money."),
        ("stop-loss-hunting-padding-buffers", "Smart Money Stop-Run Buffers & ATR Multipliers", "Adding mathematical buffers beyond obvious swing levels to prevent {name} liquidity sweeps."),
        ("over-leverage-liquidation-insulation", "Spot-Only Non-Liquidable Architecture Principles", "Why trading spot {sym} with rule-based ATR stops beats high-leverage perpetual gambles."),
        ("margin-call-stress-testing", "Extreme Volatility Scenario Stress-Testing", "Simulating 2020/2021 liquidity crashes against your {name} algorithm before going live."),
        ("slippage-budgeting-market-orders", "Dynamic Slippage Budgeting for Fast-Moving Breakouts", "Calculating whether expected {sym} breakout magnitude justifies market order spread penalty."),
        ("portfolio-heat-risk-governor", "Total Portfolio Heat & Maximum Simultaneous Exposure", "Capping total capital at risk across all deployed strategies and assets to 6%."),
        ("recovery-factor-drawdown-ratio", "Recovery Factor Tracking & Post-Drawdown Re-entry Rules", "Mathematically managing position sizing recovery after a string of consecutive {name} losses."),
        ("psychological-discipline-automation", "Removing Cognitive Biases Through Algorithmic Pre-Commitment", "Eliminating FOMO, panic-selling, and revenge trading on {sym} through cold mathematical rules.")
    ]
    for slug, title, hook in risk_themes:
        topics.append({"slug": slug, "pillar": "risk", "title": title, "hook": hook})

    # Pillar 8: Derivatives & Arbitrage
    derivatives_themes = [
        ("perpetual-funding-rate-arbitrage", "Perpetual Funding Rate Arbitrage & Delta-Neutral Yield", "Harvesting consistent 10-30% APY on {name} by shorting perps against spot holdings."),
        ("cash-and-carry-basis-trade", "Cash and Carry Basis Trade Across Calendar Futures", "Locking in fixed annualized yield on {sym} by selling quarterly futures trading at a premium."),
        ("negative-funding-short-squeeze", "Negative Funding Rate Inversions & Short Squeeze Dynamics", "Anticipating explosive upside {name} short squeezes when perpetual funding turns deeply negative."),
        ("open-interest-liquidation-heatmap", "Open Interest Liquidation Heatmaps & Magnet Price Levels", "Tracking where retail liquidation clusters sit to predict institutional {sym} price magnets."),
        ("implied-volatility-surface-skew", "Options Implied Volatility Surface & Volatility Smirks", "Extracting institutional market sentiment on {name} by analyzing out-of-the-money options pricing."),
        ("gamma-squeeze-dealer-hedging", "Gamma Squeezes & Market Maker Delta Rebalancing", "How dealer delta-hedging accelerates violent parabolic price breakouts in {sym}."),
        ("cross-exchange-funding-spreads", "Cross-Exchange Perpetual Funding Rate Dislocation", "Capturing risk-free spread discrepancies between Binance, OKX, and Bybit {name} perps."),
        ("synthetic-dollar-delta-neutral", "Synthetic Stablecoins & Delta-Neutral Staking Returns", "Creating high-yield synthetic dollars using {sym} spot collateral and 1x short hedge."),
        ("perpetual-premium-index-divergence", "Premium Index Divergence as an Early Trend Exhaustion Signal", "Spotting imminent {name} macro reversals when perp premiums detach from spot."),
        ("liquidation-cascade-momentum-riding", "Trading Breakouts Triggered by Algorithmic Liquidation Cascades", "Entering high-velocity momentum moves in {sym} exactly as automated liquidations trigger."),
        ("basis-curve-backwardation-contango", "Term Structure Analysis: Futures Contango vs Backwardation", "Reading the {name} futures curve to determine whether institutional capital is bullish or defensive."),
        ("covered-call-yield-generation", "Synthetic Covered Calls & Options Premium Collection", "Boosting {sym} portfolio yield by systematically selling out-of-the-money call options."),
        ("protective-collar-hedging-strategy", "Protective Collar Option Structures for Spot Portfolios", "Financing downside put protection on {name} by capping extreme upside with sold calls."),
        ("volatility-smile-kurtosis-fat-tails", "Fat-Tail Risk Modeling on High-Beta Crypto Derivatives", "Pricing extreme statistical black swan probabilities into {sym} algorithmic systems."),
        ("perpetual-swap-funding-velocity", "Funding Rate Velocity & Acceleration Predictors", "Using the second derivative of funding rate changes to predict {name} trend exhaustion."),
        ("cross-margin-liquidation-mechanics", "Cross-Margin Liquidation Cascade Mechanics", "Understanding the math of exchange collateral haircuts and liquidation thresholds on {sym}."),
        ("coin-margined-vs-usdt-margined", "Inverse Coin-Margined vs Linear USDT-Margined Hedging", "Comparing the convex payoff curves of inverse vs linear {name} derivative contracts."),
        ("delta-neutral-liquidity-provision", "Delta-Neutral Market Making on Decentralized Order Books", "Providing automated liquidity on {sym} pools while hedging directional inventory risk."),
        ("derivatives-volume-to-spot-ratio", "Derivatives-to-Spot Volume Ratio & Speculative Climax", "Detecting overheated speculative tops in {name} when derivative volume exceeds spot by 10x."),
        ("straddle-strangle-volatility-breakout", "Long Straddle Strategy Prior to Major Protocol Upgrades", "Profiting from violent price moves in {sym} regardless of direction using options straddles."),
        ("funding-rate-mean-reversion-decay", "Mean Reversion of Extreme Positive and Negative Funding Rates", "Arbitraging extreme funding rate excursions back toward neutral baseline levels on {name}."),
        ("skewness-and-directional-bias", "Put-Call Ratio Skew as an Institutional Sentiment Compass", "Tracking whether institutional desks are buying protective puts or aggressive calls on {sym}."),
        ("flash-crash-liquidation-absorption", "Buying Extreme Liquidation Wicks at Statistical Discounts", "Deploying aggressive limit orders to scoop up flash-crash liquidation wicks in {name}."),
        ("perpetual-funding-cost-drag", "Long-Term Holding Cost Drag on Perpetual Futures Positions", "Why holding perpetual long positions in {sym} destroys capital compared to spot ownership."),
        ("derivatives-market-maker-inventory", "Market Maker Inventory Imbalances & Order Book Skew", "Predicting short-term {name} price direction based on designated market maker positioning.")
    ]
    for slug, title, hook in derivatives_themes:
        topics.append({"slug": slug, "pillar": "derivatives", "title": title, "hook": hook})

    return topics

if __name__ == "__main__":
    t = generate_topics()
    print(f"Generated {len(t)} topics across {len(PILLARS)} pillars.")
