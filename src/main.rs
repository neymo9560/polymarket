use anyhow::Result;
use clap::Parser;
use polymarket_hft_bot::{bot::PolymarketBot, ui::PolymarketUI};
use std::sync::Arc;
use tokio::sync::Mutex;
use tracing::{info, error};

#[derive(Parser)]
#[command(name = "polymarket-bot")]
#[command(about = "Polymarket HFT-lite trading bot - Top performers 2026 style")]
struct Args {
    #[arg(short, long, default_value = "paper")]
    mode: String,
    
    #[arg(short, long)]
    private_key: Option<String>,
}

#[tokio::main]
async fn main() -> Result<()> {
    // Initialisation logging
    tracing_subscriber::fmt::init();
    
    // Chargement variables environnement
    dotenv::dotenv().ok();
    
    let args = Args::parse();
    
    info!("🚀 Démarrage Polymarket HFT Bot - Mode {}", args.mode);
    
    // Création bot partagé
    let bot = Arc::new(Mutex::new(PolymarketBot::new(&args.mode, args.private_key).await?));
    
    // Lancement UI terminal
    let mut ui = PolymarketUI::new(bot.clone());
    
    if let Err(e) = ui.run().await {
        error!("❌ Erreur UI: {}", e);
        return Err(e);
    }
    
    Ok(())
}
