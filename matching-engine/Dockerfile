# Multi-stage build for Rust matching engine (Tier-1 spot matcher)
FROM rust:1.88-bookworm AS builder
WORKDIR /build
COPY Cargo.toml Cargo.lock ./
COPY src ./src
RUN cargo build --release

FROM debian:bookworm-slim AS runner
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=builder /build/target/release/matching-engine /app/matching-engine
RUN mkdir -p /data/wal && chown -R 1001:1001 /data
USER 1001:1001
ENV ENGINE_MATCH_WAL_PATH=/data/wal/match_events.jsonl
ENV ENGINE_TIER1_WAL_REQUIRED=true
ENV USE_EVENT_STREAM=true
ENV ENGINE_HTTP_PORT=7101
ENV ENGINE_HTTP_BIND=0.0.0.0
EXPOSE 7101
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD curl -sf http://127.0.0.1:7101/health || exit 1
CMD ["/app/matching-engine"]
