# Nginx + Let's Encrypt

This backend listens on `PORT=3009` by default. The intended production layout is:

- Nest app on `127.0.0.1:3009`
- Nginx public entrypoint on `80/443`
- Let's Encrypt certificate for your API domain

## Prerequisites

- A DNS `A` record for your API domain pointing to the droplet IP
- Port `80` open on the droplet firewall
- Port `443` open on the droplet firewall
- The Nest app already running locally on the droplet

## Server Setup

Run this on the droplet as `root` after DNS is live:

```bash
export LETSENCRYPT_EMAIL=admin@example.com
bash scripts/setup-nginx-letsencrypt.sh api.example.com 3009
```

Replace:

- `admin@example.com` with your real renewal email
- `api.example.com` with the real backend domain
- `3009` if the Nest app runs on a different local port

## Verify

Run:

```bash
curl -I http://api.example.com
curl -I https://api.example.com
sudo nginx -t
sudo certbot renew --dry-run
```

Expected result:

- HTTP returns a redirect to HTTPS
- HTTPS returns a response from Nginx proxied to Nest
- `certbot renew --dry-run` succeeds

## Frontend Change

Your production frontend must call the HTTPS API origin, for example:

```bash
https://api.example.com
```

Do not use the droplet IP or any `http://` API URL from the Vercel app.
