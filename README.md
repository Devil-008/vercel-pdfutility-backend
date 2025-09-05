# PDF Management Backend - Vercel Deployment

## 🚀 Ready for Vercel Deployment!

Your backend is now configured for Vercel serverless deployment.

## 📋 Deployment Steps:

### 1. **Install Vercel CLI** (if not already installed):
```bash
npm install -g vercel
```

### 2. **Deploy to Vercel**:
```bash
# Navigate to backend directory
cd backend

# Login to Vercel (if first time)
vercel login

# Deploy
vercel

# For production deployment
vercel --prod
```

## 🔧 **Configuration Files Added:**

### ✅ `vercel.json`:
- Configures serverless function deployment
- Sets 60-second timeout for PDF processing
- Adds CORS headers
- Routes all requests to main index.js

### ✅ `.vercelignore`:
- Excludes unnecessary files from deployment
- Reduces bundle size
- Improves deployment speed

### ✅ `package.json` updates:
- Added `vercel-build` script
- Optimized for serverless deployment

### ✅ `index.js` modifications:
- Exports app for serverless compatibility
- Conditional server startup for local vs production
- Temporary file handling optimized for serverless

## 🌐 **API Endpoints Available:**

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Health check |
| `/api/merge` | POST | Merge multiple PDFs |
| `/api/split` | POST | Split PDF by page ranges |
| `/api/rotate` | POST | Rotate PDF pages |
| `/api/compress` | POST | Compress PDF file size |
| `/api/protect` | POST | Add password protection |
| `/api/unlock` | POST | Remove password protection |
| `/api/watermark` | POST | Add watermark to PDF |
| `/api/convert-office` | POST | Convert between PDF and Office formats |

## 📝 **Environment Variables:**
After deployment, you can set environment variables in Vercel dashboard:
- `NODE_ENV=production` (automatically set)

## 🔗 **Frontend Integration:**
Update your frontend API base URL to use the Vercel deployment URL:
```javascript
// Replace localhost with your Vercel URL
const API_BASE_URL = 'https://your-backend-app.vercel.app';
```

## 🚨 **Important Notes:**

1. **File Size Limits**: Vercel has a 50MB limit for serverless functions
2. **Execution Time**: 60-second timeout for Hobby plan, longer for Pro
3. **Memory**: 1GB memory limit on Hobby plan
4. **Cold Starts**: First request may be slower due to serverless nature

## 📊 **Performance Optimization:**

- Files are processed in memory (no disk storage)
- Temporary files cleaned up automatically
- Optimized for quick response times
- Memory-efficient PDF processing

## 🔧 **Local Development:**
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Test APIs locally
npm start
```

## 🎯 **Ready to Deploy!**

Your backend is now fully configured for Vercel deployment. Simply run `vercel` in the backend directory and your APIs will be live!
