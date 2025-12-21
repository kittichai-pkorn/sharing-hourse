# DigitalOcean Deployment Blueprint

คู่มือการ Deploy ระบบไปยัง DigitalOcean Droplet - สามารถนำไปใช้กับโปรเจคอื่นได้

---

## Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    DigitalOcean Droplet                     │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                      Nginx                           │   │
│  │         (Reverse Proxy + SSL + Static Files)        │   │
│  └──────────────────────┬──────────────────────────────┘   │
│                         │                                   │
│         ┌───────────────┴───────────────┐                  │
│         ▼                               ▼                  │
│  ┌─────────────────┐           ┌─────────────────┐        │
│  │   Frontend      │           │    Backend      │        │
│  │  (Static/Nginx) │           │  (PM2/Node.js)  │        │
│  │   Port: 80      │           │   Port: 3001    │        │
│  └─────────────────┘           └────────┬────────┘        │
│                                         │                  │
└─────────────────────────────────────────┼──────────────────┘
                                          │
                                          ▼
                              ┌───────────────────────┐
                              │  DigitalOcean         │
                              │  Managed MySQL        │
                              │  (External Database)  │
                              └───────────────────────┘
```

---

## 1. Create Managed Database

### 1.1 Create MySQL Database Cluster

1. DigitalOcean Control Panel > **Databases** > **Create Database Cluster**
2. Select:
   - **Engine**: MySQL 8
   - **Plan**: Basic - $15/mo
   - **Datacenter**: Same region as Droplet
   - **Cluster name**: `your-app-db`

### 1.2 Setup Database

1. **Users & Databases** > **Add new database**
2. Setup **Trusted Sources** for security

### 1.3 Connection String

```
mysql://doadmin:PASSWORD@HOST:25060/database?ssl-mode=REQUIRED
```

---

## 2. Create Droplet

| Option | Recommended |
|--------|-------------|
| Image | Ubuntu 22.04 LTS |
| Plan | Basic - $6/mo (1GB RAM) |
| Region | Same as Database |
| Authentication | SSH Key |

---

## 3. Initial Server Setup

```bash
# SSH to server
ssh root@YOUR_DROPLET_IP

# Update system
apt update && apt upgrade -y

# Create deploy user
adduser deploy
usermod -aG sudo deploy
rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy

# Setup firewall
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

---

## 4. Install Dependencies

```bash
# Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Nginx
sudo apt install nginx -y
sudo systemctl enable nginx

# PM2
sudo npm install -g pm2
pm2 startup systemd

# Additional tools
sudo apt install -y git certbot python3-certbot-nginx mysql-client
```

---

## 5. Deploy Application

### 5.1 Clone Repository

```bash
sudo mkdir -p /var/www/your-app
sudo chown deploy:deploy /var/www/your-app
cd /var/www/your-app
git clone https://github.com/your-username/your-app.git .
```

### 5.2 Setup Backend

```bash
cd /var/www/your-app/backend
npm install
cp .env.example .env
nano .env
```

**Backend .env:**
```env
PORT=3001
NODE_ENV=production
DATABASE_URL="mysql://user:pass@host:25060/database?ssl-mode=REQUIRED"
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=24h
```

```bash
npx prisma generate
npx prisma migrate deploy
npx prisma db seed
npm run build
```

### 5.3 Setup Frontend

```bash
cd /var/www/your-app/frontend
npm install
nano .env
```

**Frontend .env:**
```env
VITE_API_URL=https://yourdomain.com/api
VITE_APP_NAME=Your App
```

```bash
npm run build
```

---

## 6. Configure PM2

**ecosystem.config.js:**
```javascript
module.exports = {
  apps: [{
    name: 'your-app-backend',
    cwd: '/var/www/your-app/backend',
    script: 'dist/index.js',
    instances: 1,
    autorestart: true,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
      PORT: 3001,
    },
  }],
};
```

```bash
pm2 start ecosystem.config.js
pm2 save
```

---

## 7. Configure Nginx

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    root /var/www/your-app/frontend/dist;
    index index.html;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript;

    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/your-app /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

---

## 8. SSL Certificate

```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
sudo certbot renew --dry-run
```

---

## 9. Deploy Script

```bash
#!/bin/bash
set -e

cd /var/www/your-app

git pull origin main

# Backend
cd backend
npm install
npx prisma generate
npx prisma migrate deploy
npm run build

# Frontend
cd ../frontend
npm install
npm run build

# Restart PM2
pm2 restart your-app-backend

echo "Deployment complete!"
```

---

## 10. Quick Reference

| Action | Command |
|--------|---------|
| Deploy | `./deploy.sh` |
| View logs | `pm2 logs your-app-backend` |
| Restart backend | `pm2 restart your-app-backend` |
| Restart nginx | `sudo systemctl restart nginx` |
| Test nginx | `sudo nginx -t` |
| Check disk | `df -h` |
| Check memory | `free -m` |

### Important Paths

| Path | Description |
|------|-------------|
| `/var/www/your-app` | Application root |
| `/var/www/your-app/backend/.env` | Backend config |
| `/var/www/your-app/frontend/dist` | Frontend build |
| `/etc/nginx/sites-available/your-app` | Nginx config |

---

## 11. Cost Estimation

| Resource | Plan | Monthly Cost |
|----------|------|--------------|
| Droplet | Basic 1GB | $6 |
| Managed MySQL | Basic 1GB | $15 |
| **Total** | | **$21/mo** |

---

## 12. Security Checklist

- [ ] SSH Key authentication only
- [ ] Firewall enabled (UFW)
- [ ] SSL certificate installed
- [ ] Database in Trusted Sources
- [ ] Strong JWT secrets
- [ ] Fail2ban installed

---

*Document Version: 1.0*
*Last Updated: December 2024*
