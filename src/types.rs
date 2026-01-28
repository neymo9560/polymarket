use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Market {
    pub id: String,
    pub question: String,
    pub description: String,
    pub outcome_tokens: Vec<OutcomeToken>,
    pub volume: Decimal,
    pub liquidity: Decimal,
    pub end_time: Option<DateTime<Utc>>,
    pub category: String,
    pub subcategory: String,
    pub active: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OutcomeToken {
    pub outcome: String, // "YES" ou "NON"
    pub token_id: String,
    pub price: Decimal,
    pub supply: Decimal,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrderBook {
    pub token_id: String,
    pub bids: Vec<OrderLevel>,
    pub asks: Vec<OrderLevel>,
    pub last_update: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrderLevel {
    pub price: Decimal,
    pub size: Decimal,
    pub orders_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Order {
    pub id: String,
    pub token_id: String,
    pub side: OrderSide,
    pub price: Decimal,
    pub size: Decimal,
    pub order_type: OrderType,
    pub status: OrderStatus,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum OrderSide {
    Buy,  // YES
    Sell, // NON
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum OrderType {
    Market,
    Limit,
    PostOnly,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum OrderStatus {
    Pending,
    Filled,
    PartiallyFilled,
    Cancelled,
    Rejected,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Trade {
    pub id: String,
    pub market_id: String,
    pub token_id: String,
    pub side: OrderSide,
    pub price: Decimal,
    pub size: Decimal,
    pub fee: Decimal,
    pub profit_loss: Decimal,
    pub strategy: String,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BotState {
    pub mode: BotMode,
    pub balance: Decimal,
    pub starting_balance: Decimal,
    pub total_pnl: Decimal,
    pub total_trades: u64,
    pub active_strategies: Vec<String>,
    pub status: BotStatus,
    pub risk_config: RiskConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum BotMode {
    Paper,
    Live,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum BotStatus {
    Stopped,
    Running,
    Error(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RiskConfig {
    pub max_position_size: Decimal,    // % du balance
    pub max_risk_per_trade: Decimal,   // USDC max
    pub arb_threshold: Decimal,        // 0.985 par défaut
    pub low_prob_threshold: Decimal,   // 0.02-0.03
    pub scalping_drop_threshold: Decimal, // 25-30%
    pub scan_frequency_ms: u64,
}

impl Default for RiskConfig {
    fn default() -> Self {
        Self {
            max_position_size: Decimal::from_str("0.03").unwrap(), // 3%
            max_risk_per_trade: Decimal::from_str("5.0").unwrap(),  // 5 USDC
            arb_threshold: Decimal::from_str("0.985").unwrap(),
            low_prob_threshold: Decimal::from_str("0.025").unwrap(),
            scalping_drop_threshold: Decimal::from_str("0.30").unwrap(),
            scan_frequency_ms: 1000,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StrategyConfig {
    pub enabled: bool,
    pub name: String,
    pub params: HashMap<String, Decimal>,
}

impl StrategyConfig {
    pub fn new(name: &str) -> Self {
        Self {
            enabled: false,
            name: name.to_string(),
            params: HashMap::new(),
        }
    }
}
