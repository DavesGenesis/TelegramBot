# Insurance Illustration Request Bot

Telegram bot untuk permintaan ilustrasi asuransi dengan integrasi Google Sheets.

## Features

- ✅ Conversational form untuk input data klien
- ✅ Validasi input otomatis
- ✅ Simpan ke Google Sheets sebagai database
- ✅ Notifikasi otomatis ke grup CS
- ✅ Support multiple product types
- ✅ Session management untuk multiple users
- ✅ Cancel/restart functionality

## Setup Instructions

### 1. Create Telegram Bot

1. Open Telegram and search for `@BotFather`
2. Send `/newbot` command
3. Follow instructions to create your bot
4. Copy the bot token (looks like: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)
5. Save this token for later

### 2. Get CS Group Chat ID

1. Add your bot to the CS group
2. Send a message in the group
3. Visit: `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
4. Look for `"chat":{"id":-1001234567890}` in the response
5. Copy this chat ID (including the minus sign)

### 3. Setup Google Sheets

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Enable Google Sheets API
4. Create Service Account:
   - Go to IAM & Admin > Service Accounts
   - Create new service account
   - Download JSON key file
5. Create a Google Sheet with these columns:
   ```
   Timestamp | Agent Name | Agent ID | Client Name | DOB | Gender | Smoking | Product Type | Coverage / Premium Amount | Term of Payment | Notes | Status
   ```
   
   Note: "Coverage / Premium Amount" column stores:
   - Coverage amounts for protection products (Term Life, IUL)
   - Premium amounts for savings products (Savings Plan, Single Premi)
6. Share the sheet with service account email (from JSON file)
7. Copy the Sheet ID from URL: `https://docs.google.com/spreadsheets/d/[SHEET_ID]/edit`

### 4. Install Dependencies

```bash
cd telegram-bot
npm install
```

### 5. Configure Environment

1. Copy `.env.example` to `.env`:
   ```bash
   copy .env.example .env
   ```

2. Edit `.env` file with your credentials:
   ```
   TELEGRAM_BOT_TOKEN=your_bot_token_here
   CS_CHAT_ID=-1001234567890
   GOOGLE_SHEET_ID=your_sheet_id_here
   GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@project.iam.gserviceaccount.com
   GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour\nPrivate\nKey\nHere\n-----END PRIVATE KEY-----\n"
   ```

### 6. Run the Bot

Development mode (with auto-restart):
```bash
npm run dev
```

Production mode:
```bash
npm start
```

## Usage

### For Agents

1. Start chat with bot
2. Send `/request` command
3. Follow the conversational prompts:
   - Enter client name
   - Enter date of birth (DD/MM/YYYY)
   - Select gender (Male/Female)
   - Select smoking status (Yes/No)
   - Select product(s) - can select multiple:
     - Term Life (will ask for SGD or USD)
     - IUL (USD)
     - Savings Plan (USD)
     - Single Premi Wholelife (IDR)
     - Single Premi USD
   - Select coverage amount (or enter custom)
   - Add more products or proceed
   - Add notes (optional)
4. Confirm and submit

### For CS Team

- Receive notifications in CS group
- Check Google Sheets for full database
- Update status column as needed

## Bot Commands

- `/start` - Welcome message and instructions
- `/request` - Start new illustration request
- `/cancel` - Cancel current request
- `/help` - Show help information
- `/status` - Check last request status (future feature)

## Deployment Options

### Option 1: Railway (Recommended - Free Tier)

1. Create account at [Railway.app](https://railway.app)
2. Click "New Project" > "Deploy from GitHub"
3. Connect your repository
4. Add environment variables in Railway dashboard
5. Deploy automatically

### Option 2: Render

1. Create account at [Render.com](https://render.com)
2. New > Web Service
3. Connect GitHub repository
4. Set build command: `npm install`
5. Set start command: `npm start`
6. Add environment variables
7. Deploy

### Option 3: Vercel (Serverless)

Requires slight modification for serverless functions. Let me know if you want this setup.

### Option 4: VPS (DigitalOcean, AWS, etc.)

1. SSH into your server
2. Install Node.js
3. Clone repository
4. Install dependencies
5. Use PM2 for process management:
   ```bash
   npm install -g pm2
   pm2 start bot.js --name insurance-bot
   pm2 save
   pm2 startup
   ```

## Google Sheets Structure

The bot will append data to your sheet in this format (one row per product):

| Timestamp | Agent Name | Agent ID | Client Name | DOB | Gender | Smoking | Product Type | Coverage / Premium Amount | Term of Payment | Notes | Status |
|-----------|------------|----------|-------------|-----|--------|---------|--------------|---------------------------|-----------------|-------|--------|
| 2024-11-22 10:30 | John Doe | 123456 | Jane Smith | 25/11/1990 | Female | No | Term Life (USD) | $500,000 | 20 years | Urgent | Pending |
| 2024-11-22 10:30 | John Doe | 123456 | Jane Smith | 25/11/1990 | Female | No | Savings Plan (USD) | $10,000/year | 5 years | Urgent | Pending |

**Note:** 
- If a client requests multiple products, each product creates a separate row with the same client data.
- "Coverage / Premium Amount" shows coverage for protection products and premium for savings products.

## Customization

### Add More Product Types

Edit `bot.js` and add to `PRODUCTS` object:

```javascript
const PRODUCTS = {
  TERM_SGD: 'Term Life (SGD)',
  TERM_USD: 'Term Life (USD)',
  IUL: 'IUL (USD)',
  SAVINGS: 'Savings Plan (USD)',
  SINGLE_IDR: 'Single Premi Wholelife (IDR)',
  SINGLE_USD: 'Single Premi USD',
  CUSTOM: 'Your Custom Product'
};
```

Then add the button in the product selection keyboard.

### Add Provider-Specific Routing

Uncomment and configure provider chat IDs in `.env`, then add logic in bot.js to route based on product type.

### Add File Upload

Add this handler to bot.js:

```javascript
bot.on('document', async (msg) => {
  // Handle document uploads
  const fileId = msg.document.file_id;
  // Save to cloud storage or forward to CS
});
```

## Troubleshooting

**Bot not responding:**
- Check if bot token is correct
- Verify bot is running (`npm start`)
- Check console for errors

**Google Sheets not updating:**
- Verify service account has edit access to sheet
- Check sheet ID is correct
- Ensure private key is properly formatted (with \n for newlines)

**CS notifications not working:**
- Verify bot is added to CS group
- Check chat ID is correct (including minus sign)
- Ensure bot has permission to send messages in group

## Security Notes

- Never commit `.env` file to git
- Keep bot token secret
- Restrict service account permissions
- Use environment variables for all sensitive data

## Future Enhancements

- [ ] Status tracking and updates
- [ ] File upload support (KTP, documents)
- [ ] Admin dashboard
- [ ] Analytics and reporting
- [ ] Multi-language support
- [ ] Integration with CRM systems
- [ ] Automated follow-ups

## Support

For issues or questions, contact your development team.
