# Docker Deployment Blueprint

คู่มือการ Deploy ระบบด้วย Docker Compose - สามารถนำไปใช้กับโปรเจคอื่นได้

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Docker Network                            │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                      Nginx (Port 80/443)                  │  │
│  │                    Reverse Proxy + SSL                    │  │
│  └─────────────────────────┬────────────────────────────────┘  │
│                            │                                    │
│            ┌───────────────┴───────────────┐                   │
│            ▼                               ▼                    │
│  ┌─────────────────┐            ┌─────────────────┐           │
│  │    Frontend     │            │     Backend     │           │
│  │  (Nginx:80)     │            │   (Node:3001)   │           │
│  └─────────────────┘            └────────┬────────┘           │
│                                          │                     │
└──────────────────────────────────────────┼─────────────────────┘
                                           │
                                           ▼
                              ┌─────────────────────┐
                              │   External MySQL    │
                              │  (Managed Database) │
                              └─────────────────────┘
```

---

## Quick Start

### 1. Clone Repository

```bash
git clone https://github.com/your-username/your-app.git
cd your-app
```

### 2. Setup Environment

```bash
cp .env.example .env
nano .env
```

### 3. Start Services

```bash
# Start all services
docker-compose up -d backend frontend nginx

# Or start all services including certbot
docker-compose up -d
```

> **Note**: ต้อง setup External Database ก่อนและใส่ DATABASE_URL ใน .env

### 4. Run Database Migrations

```bash
docker-compose exec backend npx prisma migrate deploy
docker-compose exec backend npx prisma db seed
```

### 5. Access Application

- Frontend: http://localhost
- API: http://localhost/api
- Health Check: http://localhost/api/health

---

## Environment Variables

```env
# Database (External)
DATABASE_URL=mysql://username:password@db-host:25060/database?ssl-mode=REQUIRED

# Backend
JWT_SECRET=your-very-long-jwt-secret-at-least-32-characters
JWT_EXPIRES_IN=24h
SUPERADMIN_JWT_SECRET=another-very-long-secret-for-superadmin

# Frontend
VITE_API_URL=/api
VITE_APP_NAME=Your App Name

# Domain
DOMAIN=yourdomain.com
```

---

## SSL Certificate (Let's Encrypt)

### Using Certbot Container

```bash
# 1. Start nginx without SSL first
docker compose up -d nginx

# 2. Get certificate
docker compose run --rm certbot certonly --webroot \
    --webroot-path=/var/www/certbot \
    -d yourdomain.com -d www.yourdomain.com \
    --email your@email.com \
    --agree-tos \
    --no-eff-email

# 3. Enable SSL in nginx config and restart
docker compose restart nginx
```

---

## Commands Reference

### Docker Compose Commands

```bash
# Start all services
docker compose up -d

# Stop all services
docker compose down

# Rebuild services
docker compose up -d --build

# View logs
docker compose logs -f
docker compose logs -f backend

# Check status
docker compose ps

# Restart service
docker compose restart backend

# Execute command in container
docker compose exec backend sh
```

### Database Commands

```bash
# Run migrations
docker compose exec backend npx prisma migrate deploy

# Reset database (deletes all data)
docker compose exec backend npx prisma migrate reset

# Open Prisma Studio
docker compose exec backend npx prisma studio
```

---

## Deploy Script

```bash
#!/bin/bash
set -e

echo "Starting deployment..."

cd /path/to/your-app

# Pull latest code
git pull origin main

# Build and restart services
docker compose build --no-cache
docker compose up -d

# Run migrations
sleep 10
docker compose exec -T backend npx prisma migrate deploy

# Clean up
docker system prune -f

echo "Deployment complete!"
docker compose ps
```

---

## Troubleshooting

### Container ไม่ start

```bash
docker compose logs backend
docker compose logs nginx
sudo lsof -i :80
sudo lsof -i :3001
```

### Database connection failed

```bash
docker compose exec backend npx prisma db push --accept-data-loss
docker compose exec backend env | grep DATABASE
```

### Out of memory

```bash
free -m
docker stats

# Add swap space
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

---

## File Structure

```
your-app/
├── backend/
│   ├── Dockerfile
│   └── ...
├── frontend/
│   ├── Dockerfile
│   └── ...
├── docker/
│   ├── nginx/
│   │   └── conf.d/
│   └── certbot/
├── docker-compose.yml
├── deploy.sh
└── .env
```

---

*Document Version: 1.0*
*Last Updated: December 2024*
