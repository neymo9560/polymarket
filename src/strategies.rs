use anyhow::{Result, anyhow};
use std::sync::Arc;
use tokio::sync::Mutex;
use tracing::{info, warn, error};
use chrono::Utc;

use crate::types::*;
use crate::clob::PolymarketClob;

pub struct StrategyEngine {
    clob: Arc<PolymarketClob>,
    state: Arc<Mutex<BotState>>,
    strategies: Vec<Box<dyn Strategy>>,
}

impl StrategyEngine {
    pub fn new(clob: Arc<PolymarketClob>, state: Arc<Mutex<BotState>>) -> Self {
        let mut strategies: Vec<Box<dyn Strategy>> = Vec::new();
        
        // Stratégies des top performers 2026
        strategies.push(Box::new(ArbitrageStrategy::new()));
        strategies.push(Box::new(LowProbStrategy::new()));
        strategies.push(Box::new(ScalpingStrategy::new()));
        strategies.push(Box::new(MarketMakingStrategy::new()));
        
        Self {
            clob,
            state,
            strategies,
        }
    }
    
    pub async fn run(&self) -> Result<()> {
        info!("🤖 Démarrage moteur stratégies...");
        
        loop {
            let state = self.state.lock().await;
            
            if matches!(state.status, BotStatus::Stopped) {
                drop(state);
                tokio::time::sleep(tokio::time::Duration::from_millis(1000)).await;
                continue;
            }
            
            let scan_freq = state.risk_config.scan_frequency_ms;
            drop(state);
            
            // Exécuter toutes les stratégies activées
            for strategy in &self.strategies {
                if let Err(e) = strategy.execute(&self.clob, &self.state).await {
                    error!("❌ Erreur stratégie {}: {}", strategy.name(), e);
                }
            }
            
            tokio::time::sleep(tokio::time::Duration::from_millis(scan_freq)).await;
        }
    }
}

// Trait pour toutes les stratégies
#[async_trait::async_trait]
pub trait Strategy {
    fn name(&self) -> &'static str;
    async fn execute(&self, clob: &PolymarketClob, state: &Arc<Mutex<BotState>>) -> Result<()>;
    fn is_enabled(&self, state: &BotState) -> bool;
}

// Stratégie A: Arbitrage binaire (gabagool style)
pub struct ArbitrageStrategy {
    name: &'static str,
}

impl ArbitrageStrategy {
    pub fn new() -> Self {
        Self { name: "Arbitrage Binaire" }
    }
}

#[async_trait::async_trait]
impl Strategy for ArbitrageStrategy {
    fn name(&self) -> &'static str {
        self.name
    }
    
    fn is_enabled(&self, state: &BotState) -> bool {
        state.active_strategies.contains(&"A".to_string())
    }
    
    async fn execute(&self, clob: &PolymarketClob, state: &Arc<Mutex<BotState>>) -> Result<()> {
        let state_guard = state.lock().await;
        if !self.is_enabled(&state_guard) {
            return Ok(());
        }
        
        let threshold = state_guard.risk_config.arb_threshold;
        drop(state_guard);
        
        // Comme gabagool : hedge misprices pour free money
        // YES Ask + NO Ask < 0.985 → buy both, lock profit
        
        let markets = clob.fetch_markets().await?;
        
        for market in markets {
            if let (Some(yes_token), Some(no_token)) = (market.outcome_tokens.get(0), market.outcome_tokens.get(1)) {
                let yes_ask = yes_token.price;
                let no_ask = no_token.price;
                let total_cost = yes_ask + no_ask;
                
                if total_cost < threshold {
                    info!("🎯 ARBITRAGE TROUVÉ: {} - YES: {:.3}, NO: {:.3}, Total: {:.3} < {:.3}", 
                          market.question, yes_ask, no_ask, total_cost, threshold);
                    
                    // Calculer taille position
                    let state_guard = state.lock().await;
                    let max_size = state_guard.balance * state_guard.risk_config.max_position_size;
                    let trade_size = (max_size / total_cost).min(state_guard.risk_config.max_risk_per_trade);
                    drop(state_guard);
                    
                    if trade_size > Decimal::ZERO {
                        // Placer ordres YES et NO simultanément
                        let yes_order = Order {
                            id: uuid::Uuid::new_v4().to_string(),
                            token_id: yes_token.token_id.clone(),
                            side: OrderSide::Buy,
                            price: yes_ask,
                            size: trade_size,
                            order_type: OrderType::Limit,
                            status: OrderStatus::Pending,
                            created_at: Utc::now(),
                        };
                        
                        let no_order = Order {
                            id: uuid::Uuid::new_v4().to_string(),
                            token_id: no_token.token_id.clone(),
                            side: OrderSide::Buy,
                            price: no_ask,
                            size: trade_size,
                            order_type: OrderType::Limit,
                            status: OrderStatus::Pending,
                            created_at: Utc::now(),
                        };
                        
                        // Exécuter ordres
                        let yes_id = clob.place_order(&yes_order).await?;
                        let no_id = clob.place_order(&no_order).await?;
                        
                        info!("✅ Arbitrage exécuté: YES={}, NO={}", yes_id, no_id);
                        
                        // Enregistrer trade
                        self.record_arbitrage_trade(&market.id, trade_size, total_cost, state).await?;
                    }
                }
            }
        }
        
        Ok(())
    }
}

impl ArbitrageStrategy {
    async fn record_arbitrage_trade(&self, market_id: &str, size: Decimal, cost: Decimal, state: &Arc<Mutex<BotState>>) -> Result<()> {
        let mut state_guard = state.lock().await;
        
        // Profit garanti = 1.0 - cost
        let profit = (Decimal::ONE - cost) * size;
        state_guard.total_pnl += profit;
        state_guard.total_trades += 2; // 2 trades pour arbitrage
        
        info!("💰 Arbitrage profit: {:.4} USDC", profit);
        
        Ok(())
    }
}

// Stratégie B: Low-prob NO (swisstony/cry.eth2 style)
pub struct LowProbStrategy {
    name: &'static str,
}

impl LowProbStrategy {
    pub fn new() -> Self {
        Self { name: "Low-Prob NO" }
    }
}

#[async_trait::async_trait]
impl Strategy for LowProbStrategy {
    fn name(&self) -> &'static str {
        self.name
    }
    
    fn is_enabled(&self, state: &BotState) -> bool {
        state.active_strategies.contains(&"B".to_string())
    }
    
    async fn execute(&self, clob: &PolymarketClob, state: &Arc<Mutex<BotState>>) -> Result<()> {
        let state_guard = state.lock().await;
        if !self.is_enabled(&state_guard) {
            return Ok(());
        }
        
        let threshold = state_guard.risk_config.low_prob_threshold;
        drop(state_guard);
        
        // Comme swisstony : NO sur quasi-impossible pour compounding safe
        // YES price < 0.02-0.03 → buy NO massivement
        
        let markets = clob.fetch_markets().await?;
        
        for market in markets {
            for token in &market.outcome_tokens {
                if token.outcome == "YES" && token.price < threshold {
                    let yes_price = token.price;
                    let no_price = Decimal::ONE - yes_price;
                    
                    info!("🎯 LOW-PROB OPPORTUNITÉ: {} - YES: {:.3} < {:.3}", 
                          market.question, yes_price, threshold);
                    
                    // Trouver token NO correspondant
                    if let Some(no_token) = market.outcome_tokens.iter().find(|t| t.outcome == "NON") {
                        let state_guard = state.lock().await;
                        let max_size = state_guard.balance * state_guard.risk_config.max_position_size;
                        let trade_size = max_size.min(state_guard.risk_config.max_risk_per_trade * Decimal::TWO); // Double size pour low-prob
                        drop(state_guard);
                        
                        if trade_size > Decimal::ZERO {
                            let no_order = Order {
                                id: uuid::Uuid::new_v4().to_string(),
                                token_id: no_token.token_id.clone(),
                                side: OrderSide::Buy,
                                price: no_price,
                                size: trade_size,
                                order_type: OrderType::Limit,
                                status: OrderStatus::Pending,
                                created_at: Utc::now(),
                            };
                            
                            let order_id = clob.place_order(&no_order).await?;
                            info!("✅ Low-prob NO exécuté: {} @ {:.3}", order_id, no_price);
                            
                            // Enregistrer
                            self.record_low_prob_trade(&market.id, trade_size, no_price, state).await?;
                        }
                    }
                }
            }
        }
        
        Ok(())
    }
}

impl LowProbStrategy {
    async fn record_low_prob_trade(&self, market_id: &str, size: Decimal, price: Decimal, state: &Arc<Mutex<BotState>>) -> Result<()> {
        let mut state_guard = state.lock().await;
        state_guard.total_trades += 1;
        // PnL mis à jour plus tard lors du settlement
        info!("📊 Low-prob position: {:.2} USDC @ {:.3}", size * price, price);
        Ok(())
    }
}

// Stratégie C: Scalping 15-min crypto (Theo4/SeriouslySirius style)
pub struct ScalpingStrategy {
    name: &'static str,
    price_history: Arc<Mutex<HashMap<String, Vec<Decimal>>>>,
}

impl ScalpingStrategy {
    pub fn new() -> Self {
        Self { 
            name: "Scalping 15-min",
            price_history: Arc::new(Mutex::new(HashMap::new())),
        }
    }
}

#[async_trait::async_trait]
impl Strategy for ScalpingStrategy {
    fn name(&self) -> &'static str {
        self.name
    }
    
    fn is_enabled(&self, state: &BotState) -> bool {
        state.active_strategies.contains(&"C".to_string())
    }
    
    async fn execute(&self, clob: &PolymarketClob, state: &Arc<Mutex<BotState>>) -> Result<()> {
        let state_guard = state.lock().await;
        if !self.is_enabled(&state_guard) {
            return Ok(());
        }
        
        let drop_threshold = state_guard.risk_config.scalping_drop_threshold;
        drop(state_guard);
        
        // Comme Theo4 : 10k+ trades/mois sur micro-mouvements
        // WS detect drop >25-30% en 10-30s → buy low, exit +10-20%
        
        let markets = clob.fetch_markets().await?;
        
        for market in markets {
            if market.subcategory != "15-min" {
                continue;
            }
            
            // Simuler détection de drop via WebSocket
            if let Some(yes_token) = market.outcome_tokens.iter().find(|t| t.outcome == "YES") {
                let current_price = yes_token.price;
                
                // Update price history
                {
                    let mut history = self.price_history.lock().await;
                    let prices = history.entry(market.id.clone()).or_insert_with(Vec::new);
                    prices.push(current_price);
                    
                    // Garder seulement 30 derniers points
                    if prices.len() > 30 {
                        prices.remove(0);
                    }
                    
                    // Détecter drop
                    if prices.len() >= 10 {
                        let old_price = prices[prices.len() - 10];
                        let drop_percent = (old_price - current_price) / old_price;
                        
                        if drop_percent > drop_threshold {
                            info!("🚨 FLASH DROP DÉTECTÉ: {} - Drop: {:.1}%", 
                                  market.question, drop_percent * Decimal::from(100));
                            
                            // Entrer position
                            let state_guard = state.lock().await;
                            let trade_size = state_guard.risk_config.max_risk_per_trade;
                            drop(state_guard);
                            
                            if trade_size > Decimal::ZERO {
                                let buy_order = Order {
                                    id: uuid::Uuid::new_v4().to_string(),
                                    token_id: yes_token.token_id.clone(),
                                    side: OrderSide::Buy,
                                    price: current_price,
                                    size: trade_size,
                                    order_type: OrderType::Market,
                                    status: OrderStatus::Pending,
                                    created_at: Utc::now(),
                                };
                                
                                let order_id = clob.place_order(&buy_order).await?;
                                info!("⚡ Scalping entrée: {} @ {:.3}", order_id, current_price);
                                
                                // Planifier exit après 10-20% gain
                                self.schedule_scalping_exit(&market.id, &yes_token.token_id, current_price, trade_size, clob, state).await?;
                            }
                        }
                    }
                }
            }
        }
        
        Ok(())
    }
}

impl ScalpingStrategy {
    async fn schedule_scalping_exit(&self, market_id: &str, token_id: &str, entry_price: Decimal, size: Decimal, clob: &PolymarketClob, state: &Arc<Mutex<BotState>>) -> Result<()> {
        let market_id = market_id.to_string();
        let token_id = token_id.to_string();
        let clob = Arc::clone(clob);
        let state = Arc::clone(state);
        
        tokio::spawn(async move {
            // Attendre 10-60 secondes pour exit
            tokio::time::sleep(tokio::time::Duration::from_secs(30)).await;
            
            // Target price: +10-20%
            let target_price = entry_price * Decimal::from_str("1.15").unwrap();
            
            let sell_order = Order {
                id: uuid::Uuid::new_v4().to_string(),
                token_id: token_id.clone(),
                side: OrderSide::Sell,
                price: target_price,
                size,
                order_type: OrderType::Limit,
                status: OrderStatus::Pending,
                created_at: Utc::now(),
            };
            
            if let Ok(order_id) = clob.place_order(&sell_order).await {
                info!("📈 Scalping exit: {} @ {:.3}", order_id, target_price);
                
                // Calculer profit
                let profit = (target_price - entry_price) * size;
                let mut state_guard = state.lock().await;
                state_guard.total_pnl += profit;
                state_guard.total_trades += 2;
                info!("💰 Scalping profit: {:.4} USDC", profit);
            }
        });
        
        Ok(())
    }
}

// Stratégie D: Market Making / LP
pub struct MarketMakingStrategy {
    name: &'static str,
}

impl MarketMakingStrategy {
    pub fn new() -> Self {
        Self { name: "Market Making" }
    }
}

#[async_trait::async_trait]
impl Strategy for MarketMakingStrategy {
    fn name(&self) -> &'static str {
        self.name
    }
    
    fn is_enabled(&self, state: &BotState) -> bool {
        state.active_strategies.contains(&"D".to_string())
    }
    
    async fn execute(&self, clob: &PolymarketClob, state: &Arc<Mutex<BotState>>) -> Result<()> {
        let state_guard = state.lock().await;
        if !self.is_enabled(&state_guard) {
            return Ok(());
        }
        drop(state_guard);
        
        // Market making: place mirrored BID/ASK spreads, farm rewards
        
        let markets = clob.fetch_markets().await?;
        
        for market in markets {
            // Se concentrer sur marchés high volume
            if market.volume < Decimal::from_str("1000000")? {
                continue;
            }
            
            for token in &market.outcome_tokens {
                let mid_price = token.price;
                let spread = mid_price * Decimal::from_str("0.02")?; // 2% spread
                
                let bid_price = mid_price - spread / Decimal::TWO;
                let ask_price = mid_price + spread / Decimal::TWO;
                
                let state_guard = state.lock().await;
                let trade_size = state_guard.risk_config.max_risk_per_trade / Decimal::TWO; // Split size
                drop(state_guard);
                
                if trade_size > Decimal::ZERO {
                    // Placer ordre BID (buy si YES, sell si NON)
                    let bid_side = if token.outcome == "YES" { OrderSide::Buy } else { OrderSide::Sell };
                    let bid_order = Order {
                        id: uuid::Uuid::new_v4().to_string(),
                        token_id: token.token_id.clone(),
                        side: bid_side,
                        price: bid_price,
                        size: trade_size,
                        order_type: OrderType::PostOnly,
                        status: OrderStatus::Pending,
                        created_at: Utc::now(),
                    };
                    
                    // Placer ordre ASK (sell si YES, buy si NON)
                    let ask_side = if token.outcome == "YES" { OrderSide::Sell } else { OrderSide::Buy };
                    let ask_order = Order {
                        id: uuid::Uuid::new_v4().to_string(),
                        token_id: token.token_id.clone(),
                        side: ask_side,
                        price: ask_price,
                        size: trade_size,
                        order_type: OrderType::PostOnly,
                        status: OrderStatus::Pending,
                        created_at: Utc::now(),
                    };
                    
                    // Exécuter ordres
                    let bid_id = clob.place_order(&bid_order).await?;
                    let ask_id = clob.place_order(&ask_order).await?;
                    
                    info!("📊 MM position: {} BID @ {:.3}, ASK @ {:.3}", 
                          token.outcome, bid_price, ask_price);
                }
            }
        }
        
        Ok(())
    }
}
