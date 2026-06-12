# Deployment Guide

## Production Deployment

### Prerequisites
- Linux server (Ubuntu 20.04+ recommended)
- Docker and Docker Compose installed
- Domain name
- SSL certificate
- MongoDB Atlas or self-hosted MongoDB
- Redis instance

### Step 1: Prepare Server

```bash
# Update system
sudo apt-get update && sudo apt-get upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### Step 2: Clone Repository

```bash
git clone <repository-url>
cd smart-attendance-system
```

### Step 3: Configure Production Environment

```bash
# Copy and edit environment file
cp backend/.env.example backend/.env

# Edit configuration
nano backend/.env
```

Update the following for production:
```env
DEBUG=False
MONGODB_URL=<production-mongodb-url>
REDIS_URL=<production-redis-url>
SECRET_KEY=<generate-new-secret-key>
ALLOWED_HOSTS=["yourdomain.com", "www.yourdomain.com"]
```

### Step 4: Setup SSL Certificate

Using Let's Encrypt with Certbot:

```bash
sudo apt-get install certbot python3-certbot-nginx -y

sudo certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com
```

### Step 5: Configure Nginx

Create `/etc/nginx/sites-available/smart-attendance`:

```nginx
upstream backend {
    server backend:8000;
}

upstream frontend {
    server frontend:3000;
}

server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name yourdomain.com www.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;

    # API proxy
    location /api/ {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Frontend
    location / {
        proxy_pass http://frontend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Static files caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

Enable site:
```bash
sudo ln -s /etc/nginx/sites-available/smart-attendance /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### Step 6: Deploy with Docker Compose

```bash
docker-compose up -d
```

### Step 7: Setup Monitoring

Install and configure monitoring tools:

```bash
# Prometheus
docker run -d --name prometheus -p 9090:9090 prom/prometheus

# Grafana
docker run -d --name grafana -p 3001:3000 grafana/grafana
```

### Step 8: Backup Configuration

```bash
# Daily backup of MongoDB
0 2 * * * mongodump --uri="mongodb://..." --out=/backups/$(date +\%Y\%m\%d)

# Backup to S3
aws s3 sync /backups s3://your-bucket/backups/
```

## Monitoring & Maintenance

### Check Service Status
```bash
docker-compose ps
docker-compose logs -f
```

### Update Certificates
```bash
sudo certbot renew --quiet
```

### Scale Services
Edit `docker-compose.yml`:
```yaml
backend:
  deploy:
    replicas: 3
```

Apply changes:
```bash
docker-compose up -d --scale backend=3
```

## Performance Tuning

### MongoDB
```javascript
// Create indexes
db.users.createIndex({ "email": 1 });
db.attendance_records.createIndex({ "session_id": 1, "student_id": 1 });
db.face_embeddings.createIndex({ "student_id": 1 });
```

### Redis
```bash
# Optimize memory
redis-cli CONFIG SET maxmemory-policy allkeys-lru
redis-cli CONFIG SET maxmemory 2gb
```

### Nginx
Update `/etc/nginx/nginx.conf`:
```nginx
worker_processes auto;
worker_connections 2048;
gzip on;
gzip_types text/plain text/css application/json;
```

## Disaster Recovery

### Database Backup
```bash
# Manual backup
mongodump --uri="mongodb://..." --out=/backups/dump_$(date +%Y%m%d_%H%M%S)

# Restore
mongorestore --uri="mongodb://..." /backups/dump_xxxxx
```

### Docker Backup
```bash
# Save container state
docker-compose exec backend tar czf - /app > backup.tar.gz
```

## Troubleshooting

### Out of Memory
```bash
docker stats  # Check memory usage
docker-compose restart backend  # Restart service
```

### High CPU Usage
```bash
docker top <container-id>
docker-compose logs <service> | tail -100
```

### Database Issues
```bash
# Check MongoDB status
docker-compose logs mongodb

# Repair database
docker-compose exec mongodb mongod --dbpath /data/db --repair
```

## Security Hardening

### Firewall Configuration
```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 22/tcp
sudo ufw enable
```

### Update Dependencies
```bash
# Backend
pip list --outdated
pip install --upgrade package-name

# Frontend
npm outdated
npm update
```

### Regular Audits
```bash
# Check logs
tail -f /var/log/nginx/error.log
docker-compose logs | grep ERROR

# Security scanning
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock aquasec/trivy image myapp:latest
```
