# Vercel Environment Variables Setup Guide

## 🔧 **Required Environment Variables**

### **Step 1: Set via Vercel Dashboard**

1. Go to [vercel.com](https://vercel.com) → Your Project
2. Navigate to **Settings** → **Environment Variables**
3. Add the following variables:

| Variable Name | Value | Environment |
|---------------|-------|-------------|
| `MAX_FILE_SIZE` | `50000000` | Production |
| `CORS_ORIGIN` | `https://your-frontend-domain.vercel.app` | Production |
| `UPLOAD_TIMEOUT` | `60000` | Production |
| `API_SECRET` | `your-secret-key-123` | Production |

### **Step 2: Set via Vercel CLI**

```bash
# Navigate to your backend directory
cd backend

# Set environment variables
vercel env add MAX_FILE_SIZE production
# Enter: 50000000

vercel env add CORS_ORIGIN production
# Enter: https://your-frontend-domain.vercel.app

vercel env add UPLOAD_TIMEOUT production
# Enter: 60000

vercel env add API_SECRET production
# Enter: your-secret-key-123
```

### **Step 3: Redeploy After Setting Variables**

```bash
# Redeploy to apply environment variables
vercel --prod
```

## 🎯 **Variable Explanations**

### **Essential Variables:**
- **`MAX_FILE_SIZE`**: Maximum file upload size (50MB = 50000000 bytes)
- **`CORS_ORIGIN`**: Your frontend domain for security
- **`UPLOAD_TIMEOUT`**: Processing timeout in milliseconds
- **`API_SECRET`**: Secret key for API authentication

### **Auto-Set by Vercel:**
- **`NODE_ENV`**: Automatically set to "production"
- **`VERCEL_ENV`**: Automatically set to "production"
- **`VERCEL_REGION`**: Automatically set based on deployment

## 🔒 **Security Best Practices**

1. **Never commit `.env` files** to git
2. **Use different secrets** for different environments
3. **Restrict CORS origin** to your frontend domain only
4. **Use strong API secrets** (generate random strings)

## 📋 **Example Values for Different Environments**

### **Development:**
```bash
CORS_ORIGIN=http://localhost:3000
MAX_FILE_SIZE=10000000
API_SECRET=dev-secret-key
```

### **Production:**
```bash
CORS_ORIGIN=https://your-app.vercel.app
MAX_FILE_SIZE=50000000
API_SECRET=prod-strong-secret-key-xyz789
```

## 🚀 **After Setting Variables**

Your backend will automatically:
- ✅ Respect file size limits
- ✅ Allow CORS only from your frontend
- ✅ Use secure API authentication
- ✅ Handle timeouts gracefully

## 🔍 **Verify Setup**

After deployment, test your API:
```bash
curl https://your-backend.vercel.app/
```

Should return JSON with configuration details.

## 📞 **Need Help?**

If you encounter issues:
1. Check Vercel function logs
2. Verify environment variables are set
3. Ensure frontend domain matches CORS_ORIGIN
4. Test API endpoints individually
