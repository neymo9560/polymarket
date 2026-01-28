use anyhow::{Result, anyhow};
use std::sync::Arc;
use tokio::sync::Mutex;
use ratatui::{
    backend::CrosstermBackend,
    layout::{Constraint, Direction, Layout, Margin, Rect},
    style::{Color, Modifier, Style},
    text::{Line, Span},
    widgets::{
        Block, Borders, Clear, Gauge, List, ListItem, Paragraph, Tabs, Wrap,
        Table, Row, Cell
    },
    Frame, Terminal,
};
use crossterm::{
    event::{self, DisableMouseCapture, EnableMouseCapture, Event, KeyCode, KeyEvent},
    execute,
    terminal::{disable_raw_mode, enable_raw_mode, EnterAlternateScreen, LeaveAlternateScreen},
};
use tracing::{info, warn};

use crate::bot::PolymarketBot;
use crate::types::*;

pub struct PolymarketUI {
    bot: Arc<Mutex<PolymarketBot>>,
    current_view: View,
    selected_market: usize,
    selected_strategy: usize,
    search_query: String,
    selected_category: String,
    input_mode: InputMode,
}

#[derive(Debug, Clone, PartialEq)]
pub enum View {
    Markets,
    BotDashboard,
    TradeTicket,
}

#[derive(Debug, Clone, PartialEq)]
pub enum InputMode {
    Normal,
    Search,
    Config,
}

impl PolymarketUI {
    pub fn new(bot: Arc<Mutex<PolymarketBot>>) -> Self {
        Self {
            bot,
            current_view: View::Markets,
            selected_market: 0,
            selected_strategy: 0,
            search_query: String::new(),
            selected_category: "Crypto".to_string(),
            input_mode: InputMode::Normal,
        }
    }
    
    pub async fn run(&mut self) -> Result<()> {
        // Setup terminal
        enable_raw_mode()?;
        let mut stdout = std::io::stdout();
        execute!(stdout, EnterAlternateScreen, EnableMouseCapture)?;
        let backend = CrosstermBackend::new(stdout);
        let mut terminal = Terminal::new(backend)?;
        
        // Initialiser UI
        let mut last_update = std::time::Instant::now();
        
        loop {
            // Draw UI
            terminal.draw(|f| self.draw(f))?;
            
            // Handle input
            if event::poll(std::time::Duration::from_millis(100))? {
                if let Event::Key(key) = event::read()? {
                    if self.handle_key_event(key).await? {
                        break;
                    }
                }
            }
            
            // Auto-refresh chaque seconde
            if last_update.elapsed().as_millis() >= 1000 {
                last_update = std::time::Instant::now();
            }
        }
        
        // Cleanup
        disable_raw_mode()?;
        execute!(
            terminal.backend_mut(),
            LeaveAlternateScreen,
            DisableMouseCapture
        )?;
        terminal.show_cursor()?;
        
        Ok(())
    }
    
    fn draw(&mut self, f: &mut Frame) {
        match self.current_view {
            View::Markets => self.draw_markets_view(f),
            View::BotDashboard => self.draw_bot_dashboard(f),
            View::TradeTicket => self.draw_trade_ticket(f),
        }
    }
    
    fn draw_markets_view(&self, f: &mut Frame) {
        let chunks = Layout::default()
            .direction(Direction::Vertical)
            .constraints([
                Constraint::Length(7),  // Header
                Constraint::Length(3),  // Search + Categories
                Constraint::Min(0),     // Markets list
                Constraint::Length(3),  // Bottom menu
            ])
            .split(f.area());
        
        self.draw_header(f, chunks[0]);
        self.draw_search_and_categories(f, chunks[1]);
        self.draw_markets_list(f, chunks[2]);
        self.draw_bottom_menu(f, chunks[3]);
    }
    
    fn draw_header(&self, f: &mut Frame, area: Rect) {
        let header_block = Block::default()
            .borders(Borders::ALL)
            .style(Style::default().bg(Color::DarkBlue));
        
        let header_text = vec![
            Line::from(vec![
                Span::styled("POLYMARKET", Style::default().fg(Color::White).add_modifier(Modifier::BOLD)),
                Span::raw(" "),
                Span::styled("Le plus grand marché de prédictions du monde", Style::default().fg(Color::Cyan)),
            ]),
            Line::from(vec![
                Span::styled("Bot HFT-lite 2026", Style::default().fg(Color::Yellow)),
                Span::raw(" | "),
                Span::styled("Top performers style", Style::default().fg(Color::Green)),
            ]),
        ];
        
        let header = Paragraph::new(header_text)
            .block(header_block)
            .wrap(Wrap { trim: true })
            .centered();
        
        f.render_widget(header, area);
    }
    
    fn draw_search_and_categories(&self, f: &mut Frame, area: Rect) {
        let chunks = Layout::default()
            .direction(Direction::Horizontal)
            .constraints([Constraint::Percentage(60), Constraint::Percentage(40)])
            .split(area);
        
        // Search bar
        let search_text = if self.input_mode == InputMode::Search {
            format!("🔍 Rechercher: {}_", self.search_query)
        } else {
            format!("🔍 Rechercher: {} (Appuyez '/' pour chercher)", self.search_query)
        };
        
        let search = Paragraph::new(search_text)
            .block(Block::default().borders(Borders::ALL).title("Recherche"))
            .style(Style::default().fg(Color::Yellow));
        
        f.render_widget(search, chunks[0]);
        
        // Categories tabs
        let categories = vec!["Crypto", "Politique", "Sports", "15-min"];
        let selected = categories.iter().position(|&c| c == self.selected_category).unwrap_or(0);
        
        let tabs = Tabs::new(categories.iter().map(|&c| c).collect::<Vec<_>>())
            .block(Block::default().borders(Borders::ALL).title("Catégories"))
            .style(Style::default().fg(Color::Rgb(100, 100, 100)))
            .highlight_style(Style::default().fg(Color::Yellow).add_modifier(Modifier::BOLD))
            .select(selected)
            .divider(" | ");
        
        f.render_widget(tabs, chunks[1]);
    }
    
    fn draw_markets_list(&self, f: &mut Frame, area: Rect) {
        let markets = self.get_mock_markets();
        
        let items: Vec<ListItem> = markets
            .iter()
            .enumerate()
            .map(|(i, market)| {
                let (yes_price, no_price) = if let (Some(yes), Some(no)) = (&market.outcome_tokens.get(0), &market.outcome_tokens.get(1)) {
                    (yes.price, no.price)
                } else {
                    (Decimal::ZERO, Decimal::ZERO)
                };
                
                let yes_percent = yes_price * Decimal::from(100);
                let no_percent = no_price * Decimal::from(100);
                
                let style = if i == self.selected_market {
                    Style::default().bg(Color::DarkGray).add_modifier(Modifier::BOLD)
                } else {
                    Style::default()
                };
                
                let content = format!(
                    "{}\n\
                     {} {}% | {} {}% | Vol: {}M$ | Clôture: {}j 🔥",
                    market.question,
                    "OUI".to_uppercase(),
                    yes_percent,
                    "NON".to_uppercase(),
                    no_percent,
                    market.volume / Decimal::from(1000000),
                    if let Some(end_time) = market.end_time {
                        let days = (end_time - chrono::Utc::now()).num_days();
                        days.max(0).to_string()
                    } else {
                        "∞".to_string()
                    }
                );
                
                ListItem::new(content).style(style)
            })
            .collect();
        
        let list = List::new(items)
            .block(Block::default().borders(Borders::ALL).title("Marchés"))
            .highlight_style(Style::default().add_modifier(Modifier::REVERSED));
        
        f.render_widget(list, area);
    }
    
    fn draw_bottom_menu(&self, f: &mut Frame, area: Rect) {
        let menu_text = vec![
            Line::from(vec![
                Span::styled("[ENTRÉE]", Style::default().fg(Color::Green)),
                Span::raw(" Sélectionner | "),
                Span::styled("[BOT]", Style::default().fg(Color::Yellow)),
                Span::raw(" Dashboard | "),
                Span::styled("[/]", Style::default().fg(Color::Cyan)),
                Span::raw(" Rechercher | "),
                Span::styled("[TAB]", Style::default().fg(Color::Magenta)),
                Span::raw(" Catégorie | "),
                Span::styled("[Q]", Style::default().fg(Color::Red)),
                Span::raw(" Quitter"),
            ]),
        ];
        
        let menu = Paragraph::new(menu_text)
            .block(Block::default().borders(Borders::ALL))
            .centered();
        
        f.render_widget(menu, area);
    }
    
    fn draw_bot_dashboard(&self, f: &mut Frame) {
        let chunks = Layout::default()
            .direction(Direction::Vertical)
            .constraints([
                Constraint::Length(3),  // Header
                Constraint::Length(8),  // Stats panel
                Constraint::Length(10), // Strategies panel
                Constraint::Length(8),  // Recent trades
                Constraint::Length(3),  // Controls
            ])
            .split(f.area());
        
        self.draw_dashboard_header(f, chunks[0]);
        self.draw_stats_panel(f, chunks[1]);
        self.draw_strategies_panel(f, chunks[2]);
        self.draw_recent_trades(f, chunks[3]);
        self.draw_dashboard_controls(f, chunks[4]);
    }
    
    fn draw_dashboard_header(&self, f: &mut Frame, area: Rect) {
        let header = Paragraph::new("🤖 DASHBOARD BOT HFT-LITE")
            .style(Style::default().fg(Color::Yellow).add_modifier(Modifier::BOLD))
            .block(Block::default().borders(Borders::ALL))
            .centered();
        
        f.render_widget(header, area);
    }
    
    fn draw_stats_panel(&self, f: &mut Frame, area: Rect) {
        let chunks = Layout::default()
            .direction(Direction::Horizontal)
            .constraints([Constraint::Percentage(50), Constraint::Percentage(50)])
            .split(area);
        
        // Balance et P&L
        let balance_text = vec![
            Line::from("💰 WALLET & PERFORMANCE"),
            Line::from(""),
            Line::from(format!("Wallet: {:.2} USDC", 300.00)), // TODO: get from bot
            Line::from(format!("Profits: +{:.2} USDC ({:.1}%)", 12.50, 4.2)), // TODO: get from bot
            Line::from(format!("Trades: {} ce mois", 1247)), // TODO: get from bot
        ];
        
        let balance_panel = Paragraph::new(balance_text)
            .block(Block::default().borders(Borders::ALL).title("Balance"))
            .style(Style::default().fg(Color::Green));
        
        f.render_widget(balance_panel, chunks[0]);
        
        // Status
        let status_text = vec![
            Line::from("📊 STATUT BOT"),
            Line::from(""),
            Line::from("🟢 EN COURS - PAPER"), // TODO: get from bot
            Line::from("⚡ Scan: 1000ms"),
            Line::from("🔥 Stratégies actives: 2/4"),
        ];
        
        let status_panel = Paragraph::new(status_text)
            .block(Block::default().borders(Borders::ALL).title("Statut"))
            .style(Style::default().fg(Color::Cyan));
        
        f.render_widget(status_panel, chunks[1]);
    }
    
    fn draw_strategies_panel(&self, f: &mut Frame, area: Rect) {
        let strategies = vec![
            ("A", "Arbitrage Binaire", "gabagool style", "Hedge misprices pour free money", true),
            ("B", "Low-Prob NO", "swisstony style", "NO sur quasi-impossible pour compounding", false),
            ("C", "Scalping 15-min", "Theo4 style", "10k+ trades/mois micro-mouvements", true),
            ("D", "Market Making", "LP style", "Place mirrored spreads farm rewards", false),
        ];
        
        let rows: Vec<Row> = strategies
            .iter()
            .enumerate()
            .map(|(i, (code, name, style, desc, active))| {
                let style = if i == self.selected_strategy {
                    Style::default().bg(Color::DarkGray).add_modifier(Modifier::BOLD)
                } else {
                    Style::default()
                };
                
                let status = if *active { "🟢" } else { "🔴" };
                
                Row::new(vec![
                    Cell::from(status.to_string()),
                    Cell::from(code.to_string()),
                    Cell::from(*name),
                    Cell::from(*style),
                    Cell::from(*desc),
                ]).style(style)
            })
            .collect();
        
        let table = Table::new(
            rows,
            &[
                Constraint::Length(3),
                Constraint::Length(3),
                Constraint::Length(15),
                Constraint::Length(12),
                Constraint::Min(0),
            ],
        )
        .block(Block::default().borders(Borders::ALL).title("Stratégies Top Performers 2026"))
        .header(Row::new(vec![
            Cell::from("Act"),
            Cell::from("Code"),
            Cell::from("Nom"),
            Cell::from("Style"),
            Cell::from("Description"),
        ]).style(Style::default().add_modifier(Modifier::BOLD)));
        
        f.render_widget(table, area);
    }
    
    fn draw_recent_trades(&self, f: &mut Frame, area: Rect) {
        let trades = vec![
            "12:34:45 +0.125 USDC [Arbitrage] BTC-15min",
            "12:33:12 +0.089 USDC [Scalping] ETH-15min",
            "12:31:55 -0.045 USDC [Low-Prob] Trump-2024",
            "12:29:23 +0.234 USDC [Arbitrage] BTC-15min",
            "12:28:11 +0.156 USDC [Market Making] SP500",
        ];
        
        let items: Vec<ListItem> = trades
            .iter()
            .map(|trade| {
                let color = if trade.contains("+") { Color::Green } else { Color::Red };
                ListItem::new(*trade).style(Style::default().fg(color))
            })
            .collect();
        
        let list = List::new(items)
            .block(Block::default().borders(Borders::ALL).title("Trades Récents"));
        
        f.render_widget(list, area);
    }
    
    fn draw_dashboard_controls(&self, f: &mut Frame, area: Rect) {
        let controls = vec![
            Line::from(vec![
                Span::styled("[1-4]", Style::default().fg(Color::Green)),
                Span::raw(" Toggle Strat | "),
                Span::styled("[SPACE]", Style::default().fg(Color::Yellow)),
                Span::raw(" Start/Stop | "),
                Span::styled("[C]", Style::default().fg(Color::Cyan)),
                Span::raw(" Config | "),
                Span::styled("[R]", Style::default().fg(Color::Magenta)),
                Span::raw(" Reset | "),
                Span::styled("[ESC]", Style::default().fg(Color::Red)),
                Span::raw(" Retour"),
            ]),
        ];
        
        let controls_panel = Paragraph::new(controls)
            .block(Block::default().borders(Borders::ALL))
            .centered();
        
        f.render_widget(controls_panel, area);
    }
    
    fn draw_trade_ticket(&self, f: &mut Frame, area: Rect) {
        let chunks = Layout::default()
            .direction(Direction::Vertical)
            .constraints([
                Constraint::Length(3),  // Header
                Constraint::Min(0),    // Market info
                Constraint::Length(8), // Order form
                Constraint::Length(3), // Actions
            ])
            .split(area);
        
        // Header
        let header = Paragraph::new("🎫 TICKET PARI")
            .style(Style::default().fg(Color::Yellow).add_modifier(Modifier::BOLD))
            .block(Block::default().borders(Borders::ALL))
            .centered();
        
        f.render_widget(header, chunks[0]);
        
        // Market info
        let market_info = vec![
            Line::from("Bitcoin dépassera $100k dans les 15 prochaines minutes?"),
            Line::from(""),
            Line::from("OUI: 45% | NON: 55%"),
            Line::from("Volume: 2.5M$ | Clôture: 14min"),
        ];
        
        let info_panel = Paragraph::new(market_info)
            .block(Block::default().borders(Borders::ALL).title("Marché"))
            .centered();
        
        f.render_widget(info_panel, chunks[1]);
        
        // Order form
        let order_form = vec![
            Line::from("Type: [1] BUY OUI | [2] SELL NON"),
            Line::from("Montant: 10.00 USDC"),
            Line::from("Prix estimé: 0.45"),
            Line::from("Gain potentiel: +11.11 USDC"),
            Line::from(""),
            Line::from("[ENTRÉE] Confirmer | [ESC] Annuler"),
        ];
        
        let form_panel = Paragraph::new(order_form)
            .block(Block::default().borders(Borders::ALL).title("Ordre"))
            .centered();
        
        f.render_widget(form_panel, chunks[2]);
        
        // Actions
        let actions = Paragraph::new("⚠️  Mode PAPER - Aucun argent réel en jeu")
            .style(Style::default().fg(Color::Yellow))
            .block(Block::default().borders(Borders::ALL))
            .centered();
        
        f.render_widget(actions, chunks[3]);
    }
    
    async fn handle_key_event(&mut self, key: KeyEvent) -> Result<bool> {
        match self.current_view {
            View::Markets => self.handle_markets_input(key).await,
            View::BotDashboard => self.handle_dashboard_input(key).await,
            View::TradeTicket => self.handle_trade_ticket_input(key).await,
        }
    }
    
    async fn handle_markets_input(&mut self, key: KeyEvent) -> Result<bool> {
        match key.code {
            KeyCode::Char('q') => return Ok(true), // Quitter
            KeyCode::Up => {
                if self.selected_market > 0 {
                    self.selected_market -= 1;
                }
            }
            KeyCode::Down => {
                self.selected_market += 1;
            }
            KeyCode::Enter => {
                self.current_view = View::TradeTicket;
            }
            KeyCode::Char('/') => {
                self.input_mode = InputMode::Search;
            }
            KeyCode::Tab => {
                let categories = vec!["Crypto", "Politique", "Sports", "15-min"];
                let current_idx = categories.iter().position(|&c| c == self.selected_category).unwrap_or(0);
                let next_idx = (current_idx + 1) % categories.len();
                self.selected_category = categories[next_idx].to_string();
            }
            KeyCode::Char('b') | KeyCode::Char('B') => {
                self.current_view = View::BotDashboard;
            }
            KeyCode::Esc => {
                self.input_mode = InputMode::Normal;
            }
            KeyCode::Char(c) if self.input_mode == InputMode::Search => {
                self.search_query.push(c);
            }
            KeyCode::Backspace if self.input_mode == InputMode::Search => {
                self.search_query.pop();
            }
            _ => {}
        }
        Ok(false)
    }
    
    async fn handle_dashboard_input(&mut self, key: KeyEvent) -> Result<bool> {
        match key.code {
            KeyCode::Esc => {
                self.current_view = View::Markets;
            }
            KeyCode::Char(' ') => {
                // Toggle start/stop
                let bot = self.bot.lock().await;
                // TODO: implement start/stop
                info!("Toggle bot start/stop");
            }
            KeyCode::Char('1') | KeyCode::Char('2') | KeyCode::Char('3') | KeyCode::Char('4') => {
                // Toggle strategies
                let strategy_code = match key.code {
                    KeyCode::Char('1') => "A",
                    KeyCode::Char('2') => "B",
                    KeyCode::Char('3') => "C",
                    KeyCode::Char('4') => "D",
                    _ => "",
                };
                
                let bot = self.bot.lock().await;
                bot.toggle_strategy(strategy_code).await?;
                info!("Toggle strategy {}", strategy_code);
            }
            KeyCode::Up => {
                if self.selected_strategy > 0 {
                    self.selected_strategy -= 1;
                }
            }
            KeyCode::Down => {
                if self.selected_strategy < 3 {
                    self.selected_strategy += 1;
                }
            }
            KeyCode::Char('c') | KeyCode::Char('C') => {
                // Config
                info!("Open config");
            }
            KeyCode::Char('r') | KeyCode::Char('R') => {
                // Reset stats
                let bot = self.bot.lock().await;
                bot.reset_stats().await?;
                info!("Stats reset");
            }
            _ => {}
        }
        Ok(false)
    }
    
    async fn handle_trade_ticket_input(&mut self, key: KeyEvent) -> Result<bool> {
        match key.code {
            KeyCode::Esc => {
                self.current_view = View::Markets;
            }
            KeyCode::Enter => {
                // Execute trade
                info!("Execute trade");
                self.current_view = View::Markets;
            }
            KeyCode::Char('1') => {
                // Buy YES
                info!("Buy YES selected");
            }
            KeyCode::Char('2') => {
                // Sell NO
                info!("Sell NO selected");
            }
            _ => {}
        }
        Ok(false)
    }
    
    fn get_mock_markets(&self) -> Vec<Market> {
        // TODO: get from bot
        vec![
            Market {
                id: "btc-15min".to_string(),
                question: "Bitcoin dépassera $100k dans les 15 prochaines minutes?".to_string(),
                description: "15-min crypto spike prediction".to_string(),
                outcome_tokens: vec![
                    OutcomeToken {
                        outcome: "YES".to_string(),
                        token_id: "yes_btc_15min".to_string(),
                        price: rust_decimal::Decimal::from_str("0.45").unwrap(),
                        supply: rust_decimal::Decimal::from_str("1000000").unwrap(),
                    },
                    OutcomeToken {
                        outcome: "NON".to_string(),
                        token_id: "no_btc_15min".to_string(),
                        price: rust_decimal::Decimal::from_str("0.55").unwrap(),
                        supply: rust_decimal::Decimal::from_str("980000").unwrap(),
                    },
                ],
                volume: rust_decimal::Decimal::from_str("2500000").unwrap(),
                liquidity: rust_decimal::Decimal::from_str("500000").unwrap(),
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
                        price: rust_decimal::Decimal::from_str("0.62").unwrap(),
                        supply: rust_decimal::Decimal::from_str("5000000").unwrap(),
                    },
                    OutcomeToken {
                        outcome: "NON".to_string(),
                        token_id: "no_trump_2024".to_string(),
                        price: rust_decimal::Decimal::from_str("0.38").unwrap(),
                        supply: rust_decimal::Decimal::from_str("4800000").unwrap(),
                    },
                ],
                volume: rust_decimal::Decimal::from_str("15000000").unwrap(),
                liquidity: rust_decimal::Decimal::from_str("2000000").unwrap(),
                end_time: Some(chrono::Utc::now() + chrono::Duration::days(30)),
                category: "Politique".to_string(),
                subcategory: "Élections".to_string(),
                active: true,
            },
        ]
    }
}
