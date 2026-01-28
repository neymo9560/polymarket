use anyhow::{Result, anyhow};
use std::sync::Arc;
use tokio::sync::Mutex;
use tracing::{info, warn, error};
use chrono::Utc;

use crate::types::*;
use crate::clob::PolymarketClob;
use crate::strategies::StrategyEngine;

pub struct PolymarketBot {
    clob: Arc<PolymarketClob>,
    state: Arc<Mutex<BotState>>,
    strategy_engine: Arc<StrategyEngine>,
}

impl PolymarketBot {
    pub async fn new(mode: &str, private_key: Option<String>) -> Result<Self> {
        let paper_mode = mode != "live";
        
        // Clé privée depuis env ou paramètre
        let private_key = private_key
            .or_else(|| std::env::var("POLY_PRIVATE_KEY").ok())
            .ok_or_else(|| anyhow!("Clé privée requise (POLY_PRIVATE_KEY ou --private-key)"))?;
        
        // Connexion CLOB
        let clob = Arc::new(PolymarketClob::new(&private_key, paper_mode).await?);
        
        // État initial du bot
        let balance = clob.get_balance().await?;
        let state = Arc::new(Mutex::new(BotState {
            mode: if paper_mode { BotMode::Paper } else { BotMode::Live },
            balance,
            starting_balance: balance,
            total_pnl: Decimal::ZERO,
            total_trades: 0,
            active_strategies: Vec::new(),
            status: BotStatus::Stopped,
            risk_config: RiskConfig::default(),
        }));
        
        // Moteur de stratégies
        let strategy_engine = Arc::new(StrategyEngine::new(clob.clone(), state.clone()));
        
        info!("🤖 Bot Polymarket initialisé - Balance: {:.2} USDC", balance);
        
        Ok(Self {
            clob,
            state,
            strategy_engine,
        })
    }
    
    // Démarrer bot
    pub async fn start(&self) -> Result<()> {
        info!("🚀 Démarrage bot...");
        
        let mut state_guard = self.state.lock().await;
        state_guard.status = BotStatus::Running;
        drop(state_guard);
        
        // Démarrer WebSocket feed
        self.clob.start_websocket_feed().await?;
        
        // Démarrer moteur stratégies en background
        let engine = Arc::clone(&self.strategy_engine);
        tokio::spawn(async move {
            if let Err(e) = engine.run().await {
                error!("❌ Erreur moteur stratégies: {}", e);
            }
        });
        
        info!("✅ Bot démarré avec succès");
        Ok(())
    }
    
    // Arrêter bot
    pub async fn stop(&self) -> Result<()> {
        info!("🛑 Arrêt bot...");
        
        let mut state_guard = self.state.lock().await;
        state_guard.status = BotStatus::Stopped;
        drop(state_guard);
        
        info!("✅ Bot arrêté");
        Ok(())
    }
    
    // Toggle stratégie
    pub async fn toggle_strategy(&self, strategy_code: &str) -> Result<bool> {
        let mut state_guard = self.state.lock().await;
        
        if state_guard.active_strategies.contains(&strategy_code.to_string()) {
            state_guard.active_strategies.retain(|s| s != strategy_code);
            info!("📴 Stratégie {} désactivée", strategy_code);
            Ok(false)
        } else {
            state_guard.active_strategies.push(strategy_code.to_string());
            info!("🟢 Stratégie {} activée", strategy_code);
            Ok(true)
        }
    }
    
    // Mettre à jour config risque
    pub async fn update_risk_config(&self, config: RiskConfig) -> Result<()> {
        let mut state_guard = self.state.lock().await;
        state_guard.risk_config = config;
        info!("⚙️  Config risque mise à jour");
        Ok(())
    }
    
    // Get état actuel
    pub async fn get_state(&self) -> BotState {
        self.state.lock().await.clone()
    }
    
    // Get marchés
    pub async fn get_markets(&self) -> Result<Vec<Market>> {
        self.clob.fetch_markets().await
    }
    
    // Get balance
    pub async fn get_balance(&self) -> Result<Decimal> {
        self.clob.get_balance().await
    }
    
    // Switch mode paper/live
    pub async fn switch_mode(&self, new_mode: &str, private_key: Option<String>) -> Result<()> {
        info!("🔄 Switch mode: {} -> {}", 
              match self.get_state().await.mode {
                  BotMode::Paper => "PAPER",
                  BotMode::Live => "LIVE"
              },
              new_mode.to_uppercase()
        );
        
        if new_mode == "live" {
            let private_key = private_key
                .or_else(|| std::env::var("POLY_PRIVATE_KEY").ok())
                .ok_or_else(|| anyhow!("Clé privée requise pour mode LIVE"))?;
            
            // Recréer client CLOB en mode live
            let new_clob = Arc::new(PolymarketClob::new(&private_key, false).await?);
            
            // Update bot state
            let mut state_guard = self.state.lock().await;
            state_guard.mode = BotMode::Live;
            state_guard.balance = new_clob.get_balance().await?;
            drop(state_guard);
            
            info!("⚠️  Passage en mode LIVE - FRAIS RÉELS ACTIVÉS");
        } else {
            // Mode paper
            let mut state_guard = self.state.lock().await;
            state_guard.mode = BotMode::Paper;
            state_guard.balance = Decimal::from_str("300.00")?;
            drop(state_guard);
            
            info!("📝 Passage en mode PAPER - Simulation uniquement");
        }
        
        Ok(())
    }
    
    // Reset stats
    pub async fn reset_stats(&self) -> Result<()> {
        let mut state_guard = self.state.lock().await;
        state_guard.starting_balance = state_guard.balance;
        state_guard.total_pnl = Decimal::ZERO;
        state_guard.total_trades = 0;
        info!("📊 Stats réinitialisées");
        Ok(())
    }
    
    // Get performance summary
    pub async fn get_performance_summary(&self) -> Result<String> {
        let state = self.get_state().await;
        
        let pnl_percent = if state.starting_balance > Decimal::ZERO {
            (state.total_pnl / state.starting_balance) * Decimal::from(100)
        } else {
            Decimal::ZERO
        };
        
        let summary = format!(
            "📈 Performance:\n\
             Balance: {:.2} USDC\n\
             P&L: {:.4} USDC ({:.2}%)\n\
             Trades: {}\n\
             Stratégies actives: {}\n\
             Mode: {}\n\
             Status: {:?}",
            state.balance,
            state.total_pnl,
            pnl_percent,
            state.total_trades,
            state.active_strategies.len(),
            match state.mode {
                BotMode::Paper => "PAPER",
                BotMode::Live => "LIVE"
            },
            state.status
        );
        
        Ok(summary)
    }
}
