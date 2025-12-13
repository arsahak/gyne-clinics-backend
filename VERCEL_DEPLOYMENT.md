# Vercel Deployment Guide

## Prerequisites

Before deploying to Vercel, ensure you have:

1. A Vercel account (sign up at https://vercel.com)
2. Vercel CLI installed: `npm i -g vercel`
3. MongoDB connection string ready

## Environment Variables

Set these environment variables in your Vercel project:

```bash
# Database
MONGO_URI=your_mongodb_connection_string

# JWT
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRE=30d

# Node Environment
NODE_ENV=production

# Optional: Image Upload (if using ImgBB)
IMGBB_API_KEY=your_imgbb_api_key

# Port (Vercel handles this automatically)
PORT=5000
```

## Deploy to Vercel

### Option 1: Using Vercel CLI

```bash
# Login to Vercel
vercel login

# Deploy
vercel

# Deploy to production
vercel --prod
```

### Option 2: Using Vercel Dashboard

1. Go to https://vercel.com/dashboard
2. Click "Add New Project"
3. Import your GitHub repository
4. Select the `backend` folder as the root directory
5. Add environment variables in the project settings
6. Click "Deploy"

## Setting Environment Variables via CLI

```bash
vercel env add MONGO_URI production
vercel env add JWT_SECRET production
vercel env add NODE_ENV production
```

## Common Issues

### Issue 1: Database Connection Timeout

**Solution**: Make sure your MongoDB Atlas allows connections from anywhere (0.0.0.0/0) or add Vercel IPs to the allowlist.

### Issue 2: Function Timeout

**Solution**: Vercel free tier has a 10s timeout. Hobby plan has 60s. Optimize database queries and use indexes.

### Issue 3: Missing Environment Variables

**Solution**: Double-check all required environment variables are set in Vercel project settings.

### Issue 4: Cold Starts

**Solution**: First request after inactivity might be slow. This is normal for serverless functions.

## Project Structure for Vercel

```
backend/
├── api/
│   └── index.ts         # Serverless function entry point
├── server.ts            # Express app
├── vercel.json          # Vercel configuration
└── .vercelignore        # Files to exclude from deployment
```

## Testing Locally with Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Run in development mode
vercel dev
```

## Production URL

After deployment, your API will be available at:

```
https://your-project-name.vercel.app/
https://your-project-name.vercel.app/api
https://your-project-name.vercel.app/api/health
```

## Important Notes

1. **Uploads folder**: Vercel serverless functions are read-only. Use external storage (AWS S3, Cloudinary, ImgBB) for file uploads.
2. **Database**: Use MongoDB Atlas or other cloud database services.
3. **CORS**: Update CORS settings to allow your frontend domain.
4. **Caching**: Vercel automatically caches static assets.
5. **Logs**: Check logs in Vercel dashboard or use `vercel logs`

## Monitoring

- View logs: `vercel logs --follow`
- Check function stats in Vercel dashboard
- Set up monitoring alerts in project settings

## Updating Deployment

```bash
# Make changes to your code
git add .
git commit -m "Update backend"
git push

# Vercel will auto-deploy if connected to GitHub
# Or manually deploy:
vercel --prod
```
