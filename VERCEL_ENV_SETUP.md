# Vercel Environment Variables Setup

## ⚠️ CRITICAL: Set These in Vercel Dashboard

Go to: **Vercel Dashboard → Your Project → Settings → Environment Variables**

### Required Environment Variables

Add each of these variables individually:

#### 1. Database Configuration

```
Name: MONGODB_URI
Value: mongodb+srv://gyneclinicsdev_db_user:rqIHZB35u8MvQMna@cluster0.gvs9iuh.mongodb.net/gyneclinics?retryWrites=true&w=majority&appName=Cluster0
Environment: Production, Preview, Development
```

#### 2. JWT Configuration

```
Name: JWT_SECRET
Value: 2FxXT1NTf2K1Mo4i6AOvtdI
Environment: Production, Preview, Development
```

```
Name: JWT_REFRESH_SECRET
Value: PWj0fI#&DsZY9w$8tHe11*yr9F45K*j2xj&fceGZ!tEnMNZcEN
Environment: Production, Preview, Development
```

```
Name: JWT_EXPIRE
Value: 7d
Environment: Production, Preview, Development
```

#### 3. Node Environment

```
Name: NODE_ENV
Value: production
Environment: Production
```

#### 4. ImageBB Configuration

```
Name: IMAGEBB_API_KEY
Value: 8e5691634c513ea3f568ede1970f9506
Environment: Production, Preview, Development
```

```
Name: IMAGEBB_CLOUD_NAME
Value: Arsahak99
Environment: Production, Preview, Development
```

## MongoDB Atlas Configuration

### ✅ Checklist for MongoDB Atlas:

1. **Network Access**

   - Go to MongoDB Atlas → Network Access
   - Click "Add IP Address"
   - Select "Allow Access from Anywhere" (0.0.0.0/0)
   - Or add Vercel's IP ranges (recommended for security)

2. **Database User**

   - Username: `gyneclinicsdev_db_user`
   - Password: `rqIHZB35u8MvQMna`
   - Database: `gyneclinics`
   - Ensure user has "Read and Write" permissions

3. **Database Name**
   - Make sure the database name in the connection string is correct: `/gyneclinics`

## Common Issues & Solutions

### Issue 1: "MONGODB_URI is not defined"

**Solution**: Double-check that MONGODB_URI is set in Vercel environment variables (no extra spaces or quotes)

### Issue 2: "Connection timeout"

**Solution**:

- Check MongoDB Atlas Network Access allows 0.0.0.0/0
- Verify the connection string is correct
- Make sure the password doesn't contain special characters that need URL encoding

### Issue 3: "Authentication failed"

**Solution**:

- Verify database user credentials in MongoDB Atlas
- Check that the user has the correct permissions
- Ensure the database name in the connection string matches your Atlas database

### Issue 4: "Function timeout"

**Solution**:

- Database operations are taking too long
- Check if indexes are created on frequently queried fields
- Optimize database queries
- Consider upgrading Vercel plan for longer timeout limits

### Issue 5: JWT_EXPIRE vs JWT_EXPIRES

**Important**: The code uses `JWT_EXPIRE` (without 'S'). Make sure to set:

- ✅ `JWT_EXPIRE=7d` (correct)
- ❌ `JWT_EXPIRES=7d` (wrong)

## Testing Environment Variables

After setting up, test your deployment:

```bash
# Test health endpoint
curl https://your-project.vercel.app/api/health

# Expected response:
{
  "success": true,
  "status": "healthy",
  "database": "connected"
}
```

## Setting Variables via Vercel CLI

```bash
# Login to Vercel
vercel login

# Link to your project
vercel link

# Add environment variables
vercel env add MONGODB_URI production
# Paste: mongodb+srv://gyneclinicsdev_db_user:rqIHZB35u8MvQMna@cluster0.gvs9iuh.mongodb.net/gyneclinics?retryWrites=true&w=majority&appName=Cluster0

vercel env add JWT_SECRET production
# Paste: 2FxXT1NTf2K1Mo4i6AOvtdI

vercel env add JWT_EXPIRE production
# Type: 7d

vercel env add NODE_ENV production
# Type: production

# Pull environment variables to local
vercel env pull
```

## Verify Setup

1. Check all variables are set in Vercel dashboard
2. Make sure no variables have extra spaces or quotes
3. Verify MongoDB Atlas allows Vercel connections
4. Redeploy after setting environment variables:
   ```bash
   vercel --prod
   ```

## Important Notes

- ⚠️ Never commit `.env` file to Git
- ⚠️ Always use environment variables for sensitive data
- ⚠️ After adding/updating environment variables, you must redeploy
- ⚠️ Environment variables are encrypted and securely stored by Vercel
