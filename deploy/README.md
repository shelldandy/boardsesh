# Self-Hosting Boardsesh

Run your own Boardsesh instance with Docker Compose. No need to clone the repository.

## Prerequisites

- Docker Engine 24+ with Docker Compose v2
- 2GB+ RAM (the database image is ~1GB)

## Quick Start

```bash
# Download the compose file and environment template
mkdir boardsesh && cd boardsesh
curl -O https://raw.githubusercontent.com/boardsesh/boardsesh/main/deploy/docker-compose.yaml
curl -O https://raw.githubusercontent.com/boardsesh/boardsesh/main/deploy/.env.example

# Create your configuration
cp .env.example .env

# Generate secure secrets
sed -i "s/changeme-generate-a-random-string/$(openssl rand -base64 32)/" .env
sed -i "s/changeme-must-be-at-least-32-characters-long/$(openssl rand -base64 32)/" .env
sed -i "s/^POSTGRES_PASSWORD=changeme/POSTGRES_PASSWORD=$(openssl rand -base64 16)/" .env

# Start everything
docker compose up -d
```

Open http://localhost:3000 in your browser. The first startup may take a few minutes while the database image is pulled (~1GB).

A test user is available: `test@boardsesh.com` / `test`

## Included Data

The database image comes pre-loaded with:
- All Kilter board data (layouts, holds, climbs)
- All Tension board data (layouts, holds, climbs)
- MoonBoard problems
- A test user account

## Configuration

Edit `.env` to customize your deployment. See `.env.example` for all available options.

### LAN / Remote Access

To access from other devices on your network:

1. Set `NEXTAUTH_URL` to `http://YOUR_SERVER_IP:3000`
2. Set `NEXT_PUBLIC_WS_URL` to `ws://YOUR_SERVER_IP:8080/graphql`
3. Restart: `docker compose up -d`

### Reverse Proxy (Caddy example)

For HTTPS with a domain name, put a reverse proxy in front:

```
yourdomain.com {
    reverse_proxy localhost:3000
}

ws.yourdomain.com {
    reverse_proxy localhost:8080
}
```

Then set:
- `NEXTAUTH_URL=https://yourdomain.com`
- `NEXT_PUBLIC_WS_URL=wss://ws.yourdomain.com/graphql`

## Updating

```bash
docker compose pull
docker compose up -d
```

## Backup

The database is stored in a Docker volume. To back it up:

```bash
docker compose exec postgres pg_dump -U postgres boardsesh > backup.sql
```

To restore:

```bash
cat backup.sql | docker compose exec -T postgres psql -U postgres boardsesh
```

## Troubleshooting

**Database not starting**: Check logs with `docker compose logs postgres`

**WebSocket not connecting**: Ensure `NEXT_PUBLIC_WS_URL` is reachable from your browser. For remote access, use your server's IP or domain, not `localhost`.

**Reset everything**: `docker compose down -v && docker compose up -d` (warning: deletes all data)
