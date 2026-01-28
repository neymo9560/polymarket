use anyhow::{Result, anyhow};
use rs_clob_client::{ClobClient, OrderSide as ClobSide, OrderType as ClobType};
use alloy_signer_local::LocalSigner;
use alloy_primitives::{Address, PrivateKey, B256};
use std::collections::HashMap;
use tokio::sync::Mutex;
use tracing::{info, warn, error};

use crate::types::*;

pub struct PolymarketClob {
    client: ClobClient<LocalSigner<PrivateKey, Address>>,
    orderbooks: Arc<Mutex<HashMap<String, OrderBook>>>,
    markets: Arc<Mutex<HashMap<String, Market>>>,
    paper_mode: bool,
}

impl PolymarketClob {
    pub async fn new(private_key: &str, paper_mode: bool) -> Result<Self> {
        // Comme gabagool : connexion CLOB avec signing EIP-712
        let signer = LocalSigner::from_slice(&hex::decode(private_key.trim_start_matches("0x"))?)?;
        let client = ClobClient::new(signer).await?;
        
        info!("✅ Connexion CLOB établie - Mode: {}", if paper_mode { "PAPER" } else { "LIVE" });
        
        Ok(Self {
            client,
            orderbooks: Arc::new(Mutex::new(HashMap::new())),
            markets: Arc::new(Mutex::new(HashMap::new())),
            paper_mode,
        })
    }
    
    // Fetch markets depuis Gamma API + CLOB
    pub async fn fetch_markets(&self) -> Result<Vec<Market>> {
        info!("📡 Récupération marchés depuis Gamma API...");
        
        // Simulation - en prod utiliser API Gamma réelle
        let markets = self.fetch_mock_markets().await?;
        
        let mut markets_map = self.markets.lock().await;
        for market in &markets {
            markets_map.insert(market.id.clone(), market.clone());
        }
        
        Ok(markets)
    }
    
    // WebSocket orderbook streaming
    pub async fn start_websocket_feed(&self) -> Result<()> {
        info!("🔌 Démarrage WebSocket orderbook streaming...");
        
        // Comme planktonXD : parsing zero-allocation pour max speed
        let ws_url = "wss://ws.clob.polymarket.com";
        
        // Implémentation WebSocket avec tokio-tungstenite
        // Pour l'instant simulation updates
        tokio::spawn(async move {
            loop {
                tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
                // Simuler updates orderbook
            }
        });
        
        Ok(())
    }
    
    // Place order (paper ou live)
    pub async fn place_order(&self, order: &Order) -> Result<String> {
        if self.paper_mode {
            self.simulate_order(order).await
        } else {
            self.place_live_order(order).await
        }
    }
    
    // Simulation mode paper
    async fn simulate_order(&self, order: &Order) -> Result<String> {
        info!("📝 SIMULATION ORDER: {} {} @ {}", 
              match order.side {
                  OrderSide::Buy => "BUY",
                  OrderSide::Sell => "SELL"
              },
              order.size,
              order.price
        );
        
        // Simuler fill immédiat en paper
        let order_id = format!("paper_{}", uuid::Uuid::new_v4());
        
        // Update balance simulé
        // TODO: intégrer avec bot state
        
        Ok(order_id)
    }
    
    // Live order avec signature EIP-712
    async fn place_live_order(&self, order: &Order) -> Result<String> {
        warn!("⚠️  LIVE ORDER - FRAIS RÉELS");
        
        let clob_side = match order.side {
            OrderSide::Buy => ClobSide::Buy,
            OrderSide::Sell => ClobSide::Sell,
        };
        
        let clob_type = match order.order_type {
            OrderType::Market => ClobType::Market,
            OrderType::Limit => ClobType::Limit,
            OrderType::PostOnly => ClobType::PostOnly,
        };
        
        // Convertir prix/size pour CLOB
        let price = order.price.to_string();
        let size = order.size.to_string();
        
        // Place order via rs-clob-client
        let result = self.client.create_order(
            &order.token_id,
            clob_side,
            price.parse()?,
            size.parse()?,
            clob_type,
        ).await?;
        
        info!("✅ Order placé: {}", result.order_id);
        Ok(result.order_id)
    }
    
    // Get balance
    pub async fn get_balance(&self) -> Result<Decimal> {
        if self.paper_mode {
            // Balance simulée pour paper mode
            Ok(Decimal::from_str("300.00")?)
        } else {
            // Balance réelle via CLOB client
            let balance = self.client.get_balance().await?;
            Ok(Decimal::from_str(&balance.to_string())?)
        }
    }
    
    // Mock markets pour démo
    async fn fetch_mock_markets(&self) -> Result<Vec<Market>> {
        let markets = vec![
            Market {
                id: "btc-15min".to_string(),
                question: "Bitcoin dépassera $100k dans les 15 prochaines minutes?".to_string(),
                description: "15-min crypto spike prediction".to_string(),
                outcome_tokens: vec![
                    OutcomeToken {
                        outcome: "YES".to_string(),
                        token_id: "yes_btc_15min".to_string(),
                        price: Decimal::from_str("0.45")?,
                        supply: Decimal::from_str("1000000")?,
                    },
                    OutcomeToken {
                        outcome: "NON".to_string(),
                        token_id: "no_btc_15min".to_string(),
                        price: Decimal::from_str("0.55")?,
                        supply: Decimal::from_str("980000")?,
                    },
                ],
                volume: Decimal::from_str("2500000")?,
                liquidity: Decimal::from_str("500000")?,
                end_time: Some(chrono::Utc::now() + chrono::Duration::minutes(15)),
                category: "Crypto".to_string(),
                subcategory: "15-min".to_string(),
                active: true,
            },
            Market {
                id: "trump-2024".to_string(),
                question: "Trump gagnera l'élection 2024?".to_string(),
                description: "Élection présidentielle US 2024".to_string(),
                outcome_tokens: vec![
                    OutcomeToken {
                        outcome: "YES".to_string(),
                        token_id: "yes_trump_2024".to_string(),
                        price: Decimal::from_str("0.62")?,
                        supply: Decimal::from_str("5000000")?,
                    },
                    OutcomeToken {
                        outcome: "NON".to_string(),
                        token_id: "no_trump_2024".to_string(),
                        price: Decimal::from_str("0.38")?,
                        supply: Decimal::from_str("4800000")?,
                    },
                ],
                volume: Decimal::from_str("15000000")?,
                liquidity: Decimal::from_str("2000000")?,
                end_time: Some(chrono::Utc::now() + chrono::Duration::days(30)),
                category: "Politique".to_string(),
                subcategory: "Élections".to_string(),
                active: true,
            },
        ];
        
        Ok(markets)
    }
}
