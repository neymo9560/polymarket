# Polymarket HFT Bot - Production Dockerfile
FROM rust:latest as builder

WORKDIR /app

# Install dependencies
RUN apt-get update && apt-get install -y pkg-config libssl-dev && rm -rf /var/lib/apt/lists/*

# Copy source
COPY Cargo.toml ./
COPY src ./src

# Build release
RUN cargo build --release

# Runtime stage
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y ca-certificates libssl3 && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/target/release/polymarket-bot /usr/local/bin/

# Environment
ENV RUST_LOG=info
ENV PORT=8080

EXPOSE 8080

CMD ["polymarket-bot"]
