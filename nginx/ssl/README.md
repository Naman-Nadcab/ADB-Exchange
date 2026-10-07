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

## Let's Encrypt for the public IP

Let's Encrypt issues a publicly trusted certificate for an IP address. It uses the shortlived profile and lasts about six days, so renewal has to stay on.

```bash
python3 -m venv /opt/certbot
/opt/certbot/bin/pip install -U certbot
bash scripts/renew-ip-tls.sh issue
```

Port 80 must serve `/.well-known/acme-challenge/` from `nginx/acme` before the HTTP-to-HTTPS redirect. Renew twice a day; Certbot replaces the certificate only inside the last 48 hours:

```bash
0 3,15 * * * root /opt/adb-exchange/scripts/renew-ip-tls.sh renew
```
