# Deployment Guide

## Prerequisites

Before deploying, you need:
- ✅ Telegram Bot Token
- ✅ CS Group Chat ID
- ✅ Google Service Account JSON file
- ✅ Google Sheet ID
- ✅ Your Telegram User ID (for admin access)

---

## Option 1: Deploy to Railway (Recommended - Free)

### Step 1: Prepare GitHub Repository

1. Create a new repository on GitHub
2. Push your code (see instructions below)

### Step 2: Deploy to Railway

1. Go to [Railway.app](https://railway.app)
2. Sign up with GitHub
3. Click "New Project"
4. Select "Deploy from GitHub repo"
5. Choose your repository
6. Railway will auto-detect Node.js

### Step 3: Add Environment Variables

In Railway dashboard, go to Variables tab and add:

```
TELEGRAM_BOT_TOKEN=your_bot_token
CS_CHAT_ID=your_cs_chat_id
GOOGLE_SHEET_ID=your_sheet_id
GOOGLE_SERVICE_ACCOUNT_EMAIL=your_service_account_email
GOOGLE_PRIVATE_KEY=your_private_key_with_\n
```

**Important for GOOGLE_PRIVATE_KEY:**
- Copy the entire key from your JSON file
- Keep the `\n` characters (don't replace with actual line breaks)
- Include the BEGIN and END lines

### Step 4: Add Admin User

After first deployment:
1. Get your Telegram User ID (send `/myid` to bot)
2. In Railway, go to your project
3. Click on the service
4. Go to "Data" or use Railway CLI to edit `authorized-users.json`:
   ```json
   {
     "admins": [YOUR_USER_ID],
     "users": []
   }
   ```

Or use Railway CLI:
```bash
railway run node -e "const fs=require('fs'); fs.writeFileSync('authorized-users.json', JSON.stringify({admins:[YOUR_USER_ID],users:[]}))"
```

### Step 5: Deploy!

Railway will automatically deploy. Check logs to ensure bot is running.

---

## Option 2: Deploy to Render

### Step 1: Create Render Account

1. Go to [Render.com](https://render.com)
2. Sign up with GitHub

### Step 2: Create New Web Service

1. Click "New +" → "Web Service"
2. Connect your GitHub repository
3. Configure:
   - **Name:** insurance-bot
   - **Environment:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Plan:** Free

### Step 3: Add Environment Variables

In Render dashboard, add the same environment variables as Railway.

### Step 4: Deploy

Render will build and deploy automatically.

---

## Option 3: Deploy to VPS (DigitalOcean, AWS, etc.)

### Step 1: SSH into your server

```bash
ssh user@your-server-ip
```

### Step 2: Install Node.js

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### Step 3: Clone repository

```bash
git clone https://github.com/yourusername/your-repo.git
cd your-repo/telegram-bot
```

### Step 4: Install dependencies

```bash
npm install
```

### Step 5: Create .env file

```bash
nano .env
```

Paste your environment variables, save and exit (Ctrl+X, Y, Enter).

### Step 6: Setup PM2 (Process Manager)

```bash
sudo npm install -g pm2
pm2 start bot.js --name insurance-bot
pm2 save
pm2 startup
```

### Step 7: Setup authorized users

```bash
nano authorized-users.json
```

Add your admin ID:
```json
{
  "admins": [YOUR_USER_ID],
  "users": []
}
```

### Step 8: Restart

```bash
pm2 restart insurance-bot
```

---

## Uploading to GitHub

### First Time Setup

```bash
cd telegram-bot
git init
git add .
git commit -m "Initial commit - Insurance Illustration Bot"
git branch -M main
git remote add origin https://github.com/yourusername/your-repo.git
git push -u origin main
```

### Updating Code

```bash
git add .
git commit -m "Update: description of changes"
git push
```

---

## Important Security Notes

⚠️ **NEVER commit these files:**
- `.env` file
- `*.json` files with credentials
- `authorized-users.json`
- `pending-requests.json`
- Google Service Account JSON files

✅ **Safe to commit:**
- `bot.js`
- `googleSheets.js`
- `auth.js`
- `utils.js`
- `package.json`
- `.env.example`
- `.gitignore`

---

## Troubleshooting

**Bot not responding:**
- Check logs in Railway/Render dashboard
- Verify environment variables are set correctly
- Ensure bot token is valid

**Google Sheets not updating:**
- Check GOOGLE_PRIVATE_KEY format (must have `\n`)
- Verify service account has Editor access to sheet
- Check GOOGLE_SHEET_ID is correct

**Admin commands not working:**
- Make sure your User ID is in `authorized-users.json`
- Check file permissions on VPS

---

## Monitoring

**Railway:**
- View logs in dashboard
- Set up alerts for crashes

**Render:**
- View logs in dashboard
- Free tier sleeps after 15 min inactivity

**VPS with PM2:**
```bash
pm2 logs insurance-bot
pm2 status
pm2 restart insurance-bot
```

---

## Updating the Bot

1. Make changes locally
2. Test locally with `npm start`
3. Commit and push to GitHub
4. Railway/Render will auto-deploy
5. For VPS: `git pull && pm2 restart insurance-bot`
