# TLS certificates for production nginx

Place certificates here:

| File | Purpose |
|------|---------|
| `fullchain.pem` | Certificate (or full chain) |
| `privkey.pem` | Private key |

## VPS first boot (no domain)

Generate a self-signed cert for your VPS IP:

```bash
bash scripts/generate-self-signed-tls.sh YOUR.VPS.IP.ADDRESS
docker compose -f docker-compose.production.yml restart nginx
```

Browsers will warn until you replace with a trusted CA cert.

## HTTP-only mode

If **neither** file exists, nginx starts in **HTTP-only** mode on port 80 (no redirect to HTTPS).
Use this for initial smoke tests, then add TLS before go-live.

## Let's Encrypt (when domain is ready)

```bash
certbot certonly --standalone -d exchange.example.com
cp /etc/letsencrypt/live/exchange.example.com/fullchain.pem nginx/ssl/
cp /etc/letsencrypt/live/exchange.example.com/privkey.pem nginx/ssl/
docker compose -f docker-compose.production.yml restart nginx
```

Update `.env` `PUBLIC_*`, `FRONTEND_URL`, and `CORS_ORIGINS` to the domain, then rebuild frontend/admin images.
