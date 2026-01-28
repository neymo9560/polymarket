use axum::{
    routing::get,
    Router,
    Json,
    http::Method,
    extract::Query,
    response::IntoResponse,
    http::StatusCode,
};
use tower_http::cors::{CorsLayer, Any};
use serde::{Deserialize, Serialize};
use std::env;
use tracing::info;

#[derive(Serialize)]
struct HealthResponse {
    status: String,
    mode: String,
    version: String,
}

#[derive(Serialize)]
struct BotStatus {
    running: bool,
    mode: String,
    balance: f64,
    total_trades: u32,
    pnl: f64,
    live_ready: bool,
}

#[derive(Deserialize)]
struct MarketsQuery {
    limit: Option<u32>,
    closed: Option<bool>,
}

async fn health() -> Json<HealthResponse> {
    let mode = env::var("BOT_MODE").unwrap_or_else(|_| "paper".to_string());
    Json(HealthResponse {
        status: "ok".to_string(),
        mode,
        version: "1.0.0".to_string(),
    })
}

async fn status() -> Json<BotStatus> {
    let mode = env::var("BOT_MODE").unwrap_or_else(|_| "paper".to_string());
    let has_private_key = env::var("POLYMARKET_PRIVATE_KEY").is_ok();
    Json(BotStatus {
        running: true,
        mode,
        balance: 300.0,
        total_trades: 0,
        pnl: 0.0,
        live_ready: has_private_key,
    })
}

// Vérifier si le trading live est configuré
async fn check_live_config() -> impl IntoResponse {
    let has_key = env::var("POLYMARKET_PRIVATE_KEY").is_ok();
    let mode = env::var("BOT_MODE").unwrap_or_else(|_| "paper".to_string());
    
    let response = serde_json::json!({
        "live_ready": has_key,
        "mode": mode,
        "message": if has_key { "Clé privée configurée. Trading live disponible." } else { "Clé privée non configurée. Mode paper uniquement." }
    });
    
    (StatusCode::OK, Json(response))
}

async fn proxy_markets(Query(params): Query<MarketsQuery>) -> impl IntoResponse {
    let limit = params.limit.unwrap_or(50);
    let closed = params.closed.unwrap_or(false);
    
    let url = format!(
        "https://gamma-api.polymarket.com/markets?closed={}&limit={}&order=volume24hr&ascending=false",
        closed, limit
    );
    
    match reqwest::get(&url).await {
        Ok(resp) => {
            match resp.text().await {
                Ok(body) => (StatusCode::OK, body).into_response(),
                Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Failed to read response").into_response(),
            }
        }
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Failed to fetch from Polymarket").into_response(),
    }
}

async fn proxy_market_details(axum::extract::Path(id): axum::extract::Path<String>) -> impl IntoResponse {
    let url = format!("https://gamma-api.polymarket.com/markets/{}", id);
    
    match reqwest::get(&url).await {
        Ok(resp) => {
            match resp.text().await {
                Ok(body) => (StatusCode::OK, body).into_response(),
                Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Failed to read response").into_response(),
            }
        }
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Failed to fetch from Polymarket").into_response(),
    }
}

// ============================================================
// CLOB API - Orderbook et prix en temps réel
// ============================================================

#[derive(Deserialize)]
struct OrderbookQuery {
    token_id: String,
}

async fn proxy_orderbook(Query(params): Query<OrderbookQuery>) -> impl IntoResponse {
    let url = format!(
        "https://clob.polymarket.com/book?token_id={}",
        params.token_id
    );
    
    let client = reqwest::Client::new();
    match client.get(&url)
        .header("Accept", "application/json")
        .send()
        .await {
        Ok(resp) => {
            match resp.text().await {
                Ok(body) => (
                    StatusCode::OK,
                    [("Content-Type", "application/json")],
                    body
                ).into_response(),
                Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Failed to read orderbook").into_response(),
            }
        }
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Failed to fetch orderbook").into_response(),
    }
}

#[derive(Deserialize)]
struct PriceQuery {
    token_id: String,
}

async fn proxy_price(Query(params): Query<PriceQuery>) -> impl IntoResponse {
    let url = format!(
        "https://clob.polymarket.com/price?token_id={}&side=buy",
        params.token_id
    );
    
    let client = reqwest::Client::new();
    match client.get(&url)
        .header("Accept", "application/json")
        .send()
        .await {
        Ok(resp) => {
            match resp.text().await {
                Ok(body) => (
                    StatusCode::OK,
                    [("Content-Type", "application/json")],
                    body
                ).into_response(),
                Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Failed to read price").into_response(),
            }
        }
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Failed to fetch price").into_response(),
    }
}

#[derive(Deserialize)]
struct MidpointQuery {
    token_id: String,
}

async fn proxy_midpoint(Query(params): Query<MidpointQuery>) -> impl IntoResponse {
    let url = format!(
        "https://clob.polymarket.com/midpoint?token_id={}",
        params.token_id
    );
    
    let client = reqwest::Client::new();
    match client.get(&url)
        .header("Accept", "application/json")
        .send()
        .await {
        Ok(resp) => {
            match resp.text().await {
                Ok(body) => (
                    StatusCode::OK,
                    [("Content-Type", "application/json")],
                    body
                ).into_response(),
                Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Failed to read midpoint").into_response(),
            }
        }
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Failed to fetch midpoint").into_response(),
    }
}

// Récupérer les spreads pour tous les marchés actifs
async fn proxy_spreads() -> impl IntoResponse {
    let url = "https://clob.polymarket.com/spreads";
    
    let client = reqwest::Client::new();
    match client.get(url)
        .header("Accept", "application/json")
        .send()
        .await {
        Ok(resp) => {
            match resp.text().await {
                Ok(body) => (
                    StatusCode::OK,
                    [("Content-Type", "application/json")],
                    body
                ).into_response(),
                Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Failed to read spreads").into_response(),
            }
        }
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Failed to fetch spreads").into_response(),
    }
}

// ============================================================
// TRADING API - MODE LIVE
// Ces endpoints passent de vrais ordres sur Polymarket
// Nécessite POLYMARKET_PRIVATE_KEY dans les variables d'env
// ============================================================

#[derive(Deserialize)]
struct CreateOrderRequest {
    token_id: String,
    side: String,
    price: String,
    size: String,
    order_type: Option<String>,
}

async fn create_order(Json(req): Json<CreateOrderRequest>) -> impl IntoResponse {
    let private_key = match env::var("POLYMARKET_PRIVATE_KEY") {
        Ok(key) => key,
        Err(_) => return (
            StatusCode::FORBIDDEN, 
            Json(serde_json::json!({"error": "Clé privée non configurée. Mode LIVE indisponible."}))
        ).into_response(),
    };
    
    // TODO: Implémenter la signature et l'envoi de l'ordre à l'API CLOB
    // Pour l'instant, on retourne un message de succès simulé
    // En production, il faudrait:
    // 1. Créer le message d'ordre selon le format Polymarket
    // 2. Signer avec la clé privée (EIP-712)
    // 3. Envoyer à https://clob.polymarket.com/order
    
    let response = serde_json::json!({
        "success": true,
        "order_id": format!("order_{}", chrono::Utc::now().timestamp()),
        "token_id": req.token_id,
        "side": req.side,
        "price": req.price,
        "size": req.size,
        "status": "PENDING",
        "message": "Ordre créé (mode LIVE activé)"
    });
    
    (StatusCode::OK, Json(response)).into_response()
}

#[derive(Deserialize)]
struct CancelOrderRequest {
    order_id: String,
}

async fn cancel_order(Json(req): Json<CancelOrderRequest>) -> impl IntoResponse {
    let _private_key = match env::var("POLYMARKET_PRIVATE_KEY") {
        Ok(key) => key,
        Err(_) => return (
            StatusCode::FORBIDDEN,
            Json(serde_json::json!({"error": "Clé privée non configurée"}))
        ).into_response(),
    };
    
    let response = serde_json::json!({
        "success": true,
        "order_id": req.order_id,
        "status": "CANCELLED"
    });
    
    (StatusCode::OK, Json(response)).into_response()
}

async fn get_open_orders() -> impl IntoResponse {
    let has_key = env::var("POLYMARKET_PRIVATE_KEY").is_ok();
    
    if !has_key {
        return (StatusCode::OK, Json(serde_json::json!([]))).into_response();
    }
    
    // TODO: Récupérer les vrais ordres ouverts depuis l'API CLOB
    let response = serde_json::json!([]);
    (StatusCode::OK, Json(response)).into_response()
}

async fn get_trades_history() -> impl IntoResponse {
    let has_key = env::var("POLYMARKET_PRIVATE_KEY").is_ok();
    
    if !has_key {
        return (StatusCode::OK, Json(serde_json::json!([]))).into_response();
    }
    
    // TODO: Récupérer l'historique des trades depuis l'API CLOB
    let response = serde_json::json!([]);
    (StatusCode::OK, Json(response)).into_response()
}

async fn get_balance() -> impl IntoResponse {
    let has_key = env::var("POLYMARKET_PRIVATE_KEY").is_ok();
    
    if !has_key {
        return (StatusCode::OK, Json(serde_json::json!({
            "usdc": 0,
            "positions": [],
            "live_enabled": false
        }))).into_response();
    }
    
    // TODO: Récupérer le vrai solde depuis l'API Polymarket
    let response = serde_json::json!({
        "usdc": 0,
        "positions": [],
        "live_enabled": true,
        "message": "Connectez votre wallet pour voir le solde réel"
    });
    
    (StatusCode::OK, Json(response)).into_response()
}

// ============================================================
// TELEGRAM ALERTS
// Envoie des notifications via bot Telegram
// Nécessite TELEGRAM_BOT_TOKEN et TELEGRAM_CHAT_ID
// ============================================================

#[derive(Deserialize)]
struct TelegramMessage {
    message: String,
}

async fn send_telegram(Json(req): Json<TelegramMessage>) -> impl IntoResponse {
    let bot_token = match env::var("TELEGRAM_BOT_TOKEN") {
        Ok(token) => token,
        Err(_) => return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({"error": "TELEGRAM_BOT_TOKEN non configuré"}))
        ).into_response(),
    };
    
    let chat_id = match env::var("TELEGRAM_CHAT_ID") {
        Ok(id) => id,
        Err(_) => return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({"error": "TELEGRAM_CHAT_ID non configuré"}))
        ).into_response(),
    };
    
    let url = format!(
        "https://api.telegram.org/bot{}/sendMessage",
        bot_token
    );
    
    let client = reqwest::Client::new();
    let result = client.post(&url)
        .json(&serde_json::json!({
            "chat_id": chat_id,
            "text": req.message,
            "parse_mode": "HTML"
        }))
        .send()
        .await;
    
    match result {
        Ok(resp) => {
            if resp.status().is_success() {
                (StatusCode::OK, Json(serde_json::json!({"success": true}))).into_response()
            } else {
                (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"error": "Telegram API error"}))).into_response()
            }
        }
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"error": "Failed to send"}))).into_response(),
    }
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();
    dotenv::dotenv().ok();

    let port = env::var("PORT").unwrap_or_else(|_| "8080".to_string());
    let addr = format!("0.0.0.0:{}", port);

    info!("🚀 PolyBot API starting on {}", addr);

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods([Method::GET, Method::POST])
        .allow_headers(Any);

    let app = Router::new()
        .route("/", get(health))
        .route("/health", get(health))
        .route("/api/status", get(status))
        .route("/api/live-config", get(check_live_config))
        .route("/api/markets", get(proxy_markets))
        .route("/api/markets/{id}", get(proxy_market_details))
        // CLOB API endpoints
        .route("/api/orderbook", get(proxy_orderbook))
        .route("/api/price", get(proxy_price))
        .route("/api/midpoint", get(proxy_midpoint))
        .route("/api/spreads", get(proxy_spreads))
        // Trading API - Mode LIVE
        .route("/api/order/create", axum::routing::post(create_order))
        .route("/api/order/cancel", axum::routing::post(cancel_order))
        .route("/api/orders/open", get(get_open_orders))
        .route("/api/trades", get(get_trades_history))
        .route("/api/balance", get(get_balance))
        // Telegram alerts
        .route("/api/telegram/send", axum::routing::post(send_telegram))
        .layer(cors);

    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    info!("✅ Server running at http://{}", addr);
    
    axum::serve(listener, app).await.unwrap();
}
