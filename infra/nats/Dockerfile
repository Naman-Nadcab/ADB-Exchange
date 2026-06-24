# NATS with JetStream + monitoring port, plus wget for Docker healthchecks.
# Base image nats:2.10-alpine runs as root (no "nats" passwd entry).
FROM nats:2.10-alpine
USER root
RUN apk add --no-cache wget
