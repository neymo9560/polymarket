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
    Json(BotStatus {
        running: true,
        mode,
        balance: 300.0,
        total_trades: 0,
        pnl: 0.0,
    })
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
        .route("/api/markets", get(proxy_markets))
        .route("/api/markets/{id}", get(proxy_market_details))
        .layer(cors);

    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    info!("✅ Server running at http://{}", addr);
    
    axum::serve(listener, app).await.unwrap();
}
