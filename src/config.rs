use serde::{Deserialize, Serialize};
use std::env;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub polymarket: PolymarketConfig,
    pub bot: BotConfig,
    pub ui: UIConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PolymarketConfig {
    pub private_key: String,
    pub clob_url: String,
    pub ws_url: String,
    pub gamma_api_url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BotConfig {
    pub default_mode: String,
    pub scan_frequency_ms: u64,
    pub max_concurrent_orders: usize,
    pub enable_websocket: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UIConfig {
    pub refresh_rate_ms: u64,
    pub max_log_lines: usize,
    pub show_advanced_stats: bool,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            polymarket: PolymarketConfig {
                private_key: env::var("POLY_PRIVATE_KEY").unwrap_or_default(),
                clob_url: "https://clob.polymarket.com".to_string(),
                ws_url: "wss://ws.clob.polymarket.com".to_string(),
                gamma_api_url: "https://gamma-api.polymarket.com".to_string(),
            },
            bot: BotConfig {
                default_mode: "paper".to_string(),
                scan_frequency_ms: 1000,
                max_concurrent_orders: 10,
                enable_websocket: true,
            },
            ui: UIConfig {
                refresh_rate_ms: 1000,
                max_log_lines: 100,
                show_advanced_stats: false,
            },
        }
    }
}

impl Config {
    pub fn load() -> anyhow::Result<Self> {
        // Charger depuis fichier .env ou valeurs par défaut
        Ok(Config::default())
    }
    
    pub fn validate(&self) -> anyhow::Result<()> {
        if self.polymarket.private_key.is_empty() {
            anyhow::bail!("POLY_PRIVATE_KEY requis");
        }
        
        if self.bot.scan_frequency_ms < 100 {
            anyhow::bail!("Scan frequency trop bas (minimum 100ms)");
        }
        
        Ok(())
    }
}
