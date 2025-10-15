# 🚀 CollabCanvas Deployment Guide

## Architecture Overview

CollabCanvas is a full-stack real-time collaborative application:
- **Frontend**: React + Vite (can deploy to Netlify)  
- **Backend**: Node.js + Express + WebSockets (needs persistent server)

## 🎯 Recommended Deployment: Hybrid Approach

### Frontend → Netlify
### Backend → Railway (or Render/Heroku)

---

## 📦 Frontend Deployment (Netlify)

### Step 1: Prepare Frontend for Production

1. **Update Environment Variables**
   ```bash
   # Create /frontend/.env.production
   VITE_API_URL=https://your-backend-domain.railway.app
   VITE_WS_URL=wss://your-backend-domain.railway.app
   ```

2. **Build Configuration**
   ```bash
   cd frontend
   npm run build
   ```

3. **Create `netlify.toml`**
   ```toml
   # /netlify.toml (in project root)
   [build]
     base = "frontend"
     command = "npm run build"
     publish = "dist"

   [build.environment]
     NODE_VERSION = "18"

   [[redirects]]
     from = "/*"
     to = "/index.html"
     status = 200
   ```

### Step 2: Deploy to Netlify

#### Method A: GitHub Integration (Recommended)
1. Go to [netlify.com](https://netlify.com)
2. Click "New site from Git"
3. Connect your GitHub repository
4. Configure build settings:
   - **Base directory**: `frontend`
   - **Build command**: `npm run build`
   - **Publish directory**: `frontend/dist`
5. Add environment variables in Netlify dashboard

#### Method B: Manual Deploy
```bash
cd frontend
npm run build
npx netlify-cli deploy --prod --dir=dist
```

---

## 🖥️ Backend Deployment (Railway)

### Step 1: Prepare Backend

1. **Create Railway Configuration**
   ```json
   // /backend/package.json - ensure these scripts exist
   {
     "scripts": {
       "start": "node dist/index.js",
       "build": "tsc",
       "dev": "nodemon --exec ts-node src/index.ts"
     }
   }
   ```

2. **Create `railway.toml`**
   ```toml
   # /backend/railway.toml
   [build]
     builder = "NIXPACKS"
     buildCommand = "npm run build"

   [deploy]
     startCommand = "npm start"
     restartPolicyType = "ON_FAILURE"
     restartPolicyMaxRetries = 10

   [env]
     NODE_ENV = "production"
   ```

3. **Update CORS for Production**
   ```typescript
   // /backend/src/index.ts
   app.use(cors({
     origin: [
       'http://localhost:5173',
       'https://your-netlify-site.netlify.app' // Add your Netlify URL
     ],
     credentials: true
   }));
   ```

### Step 2: Deploy to Railway

1. **Install Railway CLI**
   ```bash
   npm install -g @railway/cli
   ```

2. **Login and Deploy**
   ```bash
   cd backend
   railway login
   railway init
   railway up
   ```

3. **Set Environment Variables**
   ```bash
   railway variables set NODE_ENV=production
   railway variables set PORT=3000
   # Add your Firebase and other env vars
   ```

---

## 🌐 Alternative Backend Hosting Options

### Option 1: Render
- Great free tier
- Automatic deployments from GitHub
- Built-in SSL certificates

### Option 2: Heroku
- Reliable but paid tiers only now
- Easy deployment with git push

### Option 3: DigitalOcean App Platform
- Good performance
- Simple deployment process

---

## 🔧 Environment Variables Setup

### Frontend (.env.production)
```env
VITE_API_URL=https://your-backend.railway.app
VITE_WS_URL=wss://your-backend.railway.app
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
```

### Backend (Railway/Render Dashboard)
```env
NODE_ENV=production
PORT=3000
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_PRIVATE_KEY=your_private_key
FIREBASE_CLIENT_EMAIL=your_service_account_email
```

---

## ✅ Deployment Checklist

### Pre-Deployment
- [ ] Frontend builds successfully (`npm run build`)
- [ ] Backend compiles successfully (`npm run build`)
- [ ] Environment variables configured
- [ ] CORS settings updated for production domains
- [ ] Firebase configuration ready

### Post-Deployment
- [ ] Frontend loads on Netlify URL
- [ ] Backend health endpoint responds
- [ ] WebSocket connections work
- [ ] Authentication flow works
- [ ] Real-time features function correctly

---

## 🐛 Common Issues & Solutions

### CORS Errors
```typescript
// Add your production domains to CORS
app.use(cors({
  origin: [
    'https://your-site.netlify.app',
    'https://your-custom-domain.com'
  ]
}));
```

### WebSocket Connection Issues
- Ensure you're using `wss://` (not `ws://`) for HTTPS sites
- Check that your backend supports WebSocket upgrades
- Verify firewall/proxy settings don't block WebSocket traffic

### Environment Variable Issues
- Double-check all required variables are set
- Use Railway/Render dashboard to verify variable values
- Test with staging environment first

---

## 🔄 Continuous Deployment

### Netlify (Frontend)
- Automatically deploys on git push to main branch
- Configure branch deploys for staging

### Railway (Backend)  
- Set up GitHub integration for auto-deploys
- Configure environment-specific deployments

---

## 📊 Monitoring & Logs

### Frontend
- Netlify provides deployment logs and analytics
- Use browser dev tools for client-side debugging

### Backend
- Railway/Render provide application logs
- Set up health check endpoints
- Monitor WebSocket connection metrics

---

## 💰 Cost Estimation

### Netlify (Frontend)
- **Free tier**: 100GB bandwidth, 300 build minutes
- **Pro**: $19/month for additional features

### Railway (Backend)
- **Free tier**: $5 credit/month (limited)  
- **Pro**: Pay-as-you-go, ~$10-20/month for small apps

### Total Estimated Cost
- **Development**: Free (using free tiers)
- **Production**: $10-40/month depending on usage

---

## 🚀 Quick Start Commands

```bash
# Deploy Frontend to Netlify
cd frontend
npm run build
npx netlify-cli deploy --prod --dir=dist

# Deploy Backend to Railway
cd backend  
npm run build
railway up

# Test the deployment
curl https://your-backend.railway.app/health
```

Happy deploying! 🎉
