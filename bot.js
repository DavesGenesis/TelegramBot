require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const { saveToGoogleSheets } = require('./googleSheets');
const { formatRequestMessage } = require('./utils');
const auth = require('./auth');

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

// Initialize auth files
auth.initAuthFiles();

// Store user sessions
const userSessions = new Map();

// Session states
const STATES = {
  IDLE: 'idle',
  AWAITING_NAME: 'awaiting_name',
  AWAITING_DOB: 'awaiting_dob',
  AWAITING_GENDER: 'awaiting_gender',
  AWAITING_SMOKING: 'awaiting_smoking',
  AWAITING_PRODUCT: 'awaiting_product',
  AWAITING_TERM_CCY: 'awaiting_term_ccy',
  AWAITING_COVERAGE: 'awaiting_coverage',
  AWAITING_COVERAGE_CUSTOM: 'awaiting_coverage_custom',
  AWAITING_TERM_PAYMENT: 'awaiting_term_payment',
  AWAITING_TERM_PAYMENT_CUSTOM: 'awaiting_term_payment_custom',
  AWAITING_NOTES: 'awaiting_notes',
  CONFIRMING: 'confirming'
};

// Product types
const PRODUCTS = {
  TERM_SGD: 'Term Life (SGD)',
  TERM_USD: 'Term Life (USD)',
  IUL: 'IUL (USD)',
  SAVINGS: 'Savings Plan (USD)',
  SINGLE_IDR: 'Single Premi Wholelife (IDR)',
  SINGLE_USD: 'Single Premi USD'
};

// Coverage amounts by currency (for protection products)
const COVERAGE_OPTIONS = {
  USD: ['$250,000', '$500,000', '$1,000,000'],
  SGD: ['$250,000 SGD', '$500,000 SGD', '$1,000,000 SGD'],
  IDR: ['IDR 250 juta', 'IDR 500 juta', 'IDR 1 milyar']
};

// Premium amounts by product (for savings products)
const PREMIUM_OPTIONS = {
  SAVINGS_USD: ['$5,000/year', '$10,000/year', '$20,000/year'],
  SINGLE_IDR: ['IDR 50 juta', 'IDR 100 juta', 'IDR 200 juta'],
  SINGLE_USD: ['$25,000', '$50,000', '$100,000']
};

// Check if product is savings/premium based
function isSavingsProduct(productName) {
  return productName.includes('Savings Plan') || 
         productName.includes('Single Premi');
}

const TERM_PAYMENT_OPTIONS = {
  TERM_LIFE: [
    { text: '10 years', value: '10 years' },
    { text: '20 years', value: '20 years' },
    { text: '30 years', value: '30 years' },
    { text: 'Till 85', value: 'Till 85' },
    { text: 'Till 88 (FWD only)', value: 'Till 88' }
  ],
  IUL: ['1 year', '5 years', '10 years'],
  SAVINGS: ['2 years', '5 years'],
  SINGLE_PREMI: '1'
};

// Initialize session
function initSession(userId) {
  return {
    state: STATES.IDLE,
    data: {
      agentId: userId,
      agentName: '',
      clientName: '',
      clientDOB: '',
      clientGender: '',
      smoking: '',
      selectedProducts: [], // Array to store multiple products
      currentProduct: '', // Current product being configured
      coverageAmount: '',
      termPayment: '',
      notes: '',
      timestamp: new Date().toISOString()
    }
  };
}

// Validate DOB format (DD/MM/YYYY)
function isValidDOB(dob) {
  const regex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
  const match = dob.match(regex);
  
  if (!match) return false;
  
  const day = parseInt(match[1]);
  const month = parseInt(match[2]);
  const year = parseInt(match[3]);
  
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  if (year < 1900 || year > new Date().getFullYear()) return false;
  
  return true;
}

// Start command
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const userName = msg.from.first_name || 'Agent';
  
  // Check if user is authorized
  if (!auth.isAuthorized(userId)) {
    bot.sendMessage(chatId,
      `👋 Hello ${userName}!\n\n` +
      `🔒 You need authorization to use this bot.\n\n` +
      `Use /requestaccess to request access from admin.`
    );
    return;
  }
  
  const isAdminUser = auth.isAdmin(userId);
  const adminCommands = isAdminUser ? 
    `\n\n*Admin Commands:*\n` +
    `/lists - View all requests\n` +
    `/lists pending - View pending requests\n` +
    `/lists processing - View processing requests\n` +
    `/lists completed - View completed requests\n` +
    `/setstatus [id] [status] - Update status manually\n` +
    `/pending - View pending access requests\n` +
    `/list - View all authorized users\n` +
    `/adduser [user_id] - Add user manually` : '';
  
  bot.sendMessage(chatId, 
    `👋 Selamat datang, ${userName}!\n\n` +
    `Saya adalah bot untuk permintaan ilustrasi asuransi.\n\n` +
    `Gunakan /request untuk memulai permintaan baru\n` +
    `Gunakan /cancel untuk membatalkan permintaan\n` +
    `Gunakan /help untuk bantuan` +
    adminCommands,
    { parse_mode: 'Markdown' }
  );
});

// Help command
bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const isAdminUser = auth.isAdmin(userId);
  
  const adminNote = isAdminUser ? `\n\n_Use /adminhelp for admin commands_` : '';
  
  bot.sendMessage(chatId,
    `📋 *Panduan Penggunaan*\n\n` +
    `/request - Mulai permintaan ilustrasi baru\n` +
    `/status - Cek status permintaan Anda\n` +
    `/cancel - Batalkan permintaan saat ini\n` +
    `/myid - Get your Telegram User ID\n` +
    `/help - Tampilkan panduan ini` +
    adminNote +
    `\n\nBot akan memandu Anda langkah demi langkah untuk mengisi data klien.`,
    { parse_mode: 'Markdown' }
  );
});

// Admin help command
bot.onText(/\/adminhelp/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  if (!auth.isAdmin(userId)) {
    bot.sendMessage(chatId, '❌ Admin only command.');
    return;
  }
  
  bot.sendMessage(chatId,
    `👑 *Admin Commands*\n\n` +
    `*Request Management:*\n` +
    `/lists - View all requests (last 20)\n` +
    `/lists pending - View pending requests\n` +
    `/lists processing - View processing requests\n` +
    `/lists completed - View completed requests\n` +
    `/setstatus [id] [status] - Update status manually\n` +
    `  Example: /setstatus 1 processing\n\n` +
    `*User Management:*\n` +
    `/pending - View pending access requests\n` +
    `/list - View all authorized users\n` +
    `/adduser [user_id] - Add user manually\n` +
    `/removeuser [user_id] - Remove user access\n` +
    `/addadmin [user_id] - Make someone admin\n\n` +
    `*Status Options:*\n` +
    `• pending - Just submitted\n` +
    `• processing - CS is working on it\n` +
    `• completed - Illustration ready\n\n` +
    `_Note: Agents are notified when status changes from Pending to Processing_`,
    { parse_mode: 'Markdown' }
  );
});

// Get User ID command
bot.onText(/\/myid/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const userName = `${msg.from.first_name || ''} ${msg.from.last_name || ''}`.trim();
  const username = msg.from.username || 'N/A';
  
  bot.sendMessage(chatId,
    `👤 *Your Information*\n\n` +
    `🆔 User ID: \`${userId}\`\n` +
    `📛 Name: ${userName}\n` +
    `📱 Username: @${username}\n\n` +
    `_Tap the User ID to copy it_`,
    { parse_mode: 'Markdown' }
  );
});

// Status command - check request status
bot.onText(/\/status/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  // Check authorization
  if (!auth.isAuthorized(userId)) {
    bot.sendMessage(chatId, '🔒 Access denied. Use /requestaccess to request authorization.');
    return;
  }
  
  try {
    const { getRequestsByAgent } = require('./googleSheets');
    const requests = await getRequestsByAgent(userId);
    
    if (requests.length === 0) {
      bot.sendMessage(chatId,
        `📋 *Your Requests*\n\n` +
        `No requests found.\n\n` +
        `Use /request to submit a new illustration request.`,
        { parse_mode: 'Markdown' }
      );
      return;
    }
    
    let message = `📋 *Your Illustration Requests*\n\n`;
    
    // Group by status
    const pending = requests.filter(r => r.status === 'Pending');
    const processing = requests.filter(r => r.status === 'Processing');
    const completed = requests.filter(r => r.status === 'Completed');
    
    if (pending.length > 0) {
      message += `⏳ *Pending (${pending.length})*\n`;
      pending.slice(0, 3).forEach(r => {
        message += `• ${r.clientName} - ${r.productType}\n`;
        message += `  ${new Date(r.timestamp).toLocaleDateString('id-ID')}\n`;
      });
      message += '\n';
    }
    
    if (processing.length > 0) {
      message += `🔄 *Processing (${processing.length})*\n`;
      processing.slice(0, 3).forEach(r => {
        message += `• ${r.clientName} - ${r.productType}\n`;
        message += `  ${new Date(r.timestamp).toLocaleDateString('id-ID')}\n`;
      });
      message += '\n';
    }
    
    if (completed.length > 0) {
      message += `✅ *Completed (${completed.length})*\n`;
      completed.slice(0, 3).forEach(r => {
        message += `• ${r.clientName} - ${r.productType}\n`;
        message += `  ${new Date(r.timestamp).toLocaleDateString('id-ID')}\n`;
      });
      message += '\n';
    }
    
    message += `\n_Total: ${requests.length} request(s)_`;
    
    bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    
  } catch (error) {
    console.error('Error fetching status:', error);
    bot.sendMessage(chatId,
      `❌ Error fetching your requests.\n` +
      `Please try again later or contact admin.`
    );
  }
});

// Request access command
bot.onText(/\/requestaccess/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const userName = `${msg.from.first_name || ''} ${msg.from.last_name || ''}`.trim();
  const userUsername = msg.from.username || 'N/A';
  
  // Check if already authorized
  if (auth.isAuthorized(userId)) {
    bot.sendMessage(chatId, '✅ You are already authorized to use this bot!');
    return;
  }
  
  // Check if already pending
  if (auth.getPendingRequest(userId)) {
    bot.sendMessage(chatId, '⏳ Your access request is pending. Please wait for admin approval.');
    return;
  }
  
  // Add to pending
  auth.addPendingRequest(userId, userName, userUsername);
  
  // Notify user
  bot.sendMessage(chatId,
    `✅ Access request submitted!\n\n` +
    `Your request has been sent to the admin.\n` +
    `You will be notified once approved.`
  );
  
  // Notify all admins
  const admins = auth.getAllUsers().admins;
  const approvalKeyboard = {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '✅ Approve', callback_data: `approve_${userId}` },
          { text: '❌ Reject', callback_data: `reject_${userId}` }
        ]
      ]
    }
  };
  
  for (const adminId of admins) {
    try {
      await bot.sendMessage(adminId,
        `🔔 *New Access Request*\n\n` +
        `👤 Name: ${userName}\n` +
        `🆔 User ID: ${userId}\n` +
        `📱 Username: @${userUsername}\n\n` +
        `Approve or reject this request:`,
        { ...approvalKeyboard, parse_mode: 'Markdown' }
      );
    } catch (error) {
      console.error(`Failed to notify admin ${adminId}:`, error.message);
    }
  }
});

// Request command
bot.onText(/\/request/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  // Check authorization
  if (!auth.isAuthorized(userId)) {
    bot.sendMessage(chatId,
      `🔒 Access denied.\n\n` +
      `Use /requestaccess to request authorization.`
    );
    return;
  }
  
  const session = initSession(userId);
  session.state = STATES.AWAITING_NAME;
  session.data.agentName = `${msg.from.first_name || ''} ${msg.from.last_name || ''}`.trim();
  userSessions.set(userId, session);
  
  bot.sendMessage(chatId,
    `📝 *Permintaan Ilustrasi Baru*\n\n` +
    `Silakan masukkan *nama lengkap klien*:`,
    { parse_mode: 'Markdown' }
  );
});

// Cancel command
bot.onText(/\/cancel/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  if (userSessions.has(userId)) {
    userSessions.delete(userId);
    bot.sendMessage(chatId, '❌ Permintaan dibatalkan.\n\nGunakan /request untuk memulai lagi.');
  } else {
    bot.sendMessage(chatId, 'Tidak ada permintaan aktif.');
  }
});

// Handle text messages
bot.on('message', async (msg) => {
  // Skip commands
  if (msg.text && msg.text.startsWith('/')) return;
  
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const session = userSessions.get(userId);
  
  if (!session || session.state === STATES.IDLE) return;
  
  const text = msg.text?.trim();
  
  switch (session.state) {
    case STATES.AWAITING_NAME:
      session.data.clientName = text;
      session.state = STATES.AWAITING_DOB;
      bot.sendMessage(chatId, 
        `✅ Nama: ${text}\n\n` +
        `Masukkan *tanggal lahir* klien (format: DD/MM/YYYY)\n` +
        `Contoh: 25/11/1990`,
        { parse_mode: 'Markdown' }
      );
      break;
      
    case STATES.AWAITING_DOB:
      if (!isValidDOB(text)) {
        bot.sendMessage(chatId, 
          '❌ Format tanggal tidak valid.\n\n' +
          'Gunakan format DD/MM/YYYY (contoh: 25/11/1990):'
        );
        return;
      }
      session.data.clientDOB = text;
      session.state = STATES.AWAITING_GENDER;
      
      const genderKeyboard = {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '👨 Male', callback_data: 'gender_male' },
              { text: '👩 Female', callback_data: 'gender_female' }
            ]
          ]
        }
      };
      bot.sendMessage(chatId, 
        `✅ DOB: ${text}\n\nPilih *gender* klien:`,
        { ...genderKeyboard, parse_mode: 'Markdown' }
      );
      break;
      
    case STATES.AWAITING_COVERAGE_CUSTOM:
      session.data.coverageAmount = text;
      session.state = STATES.AWAITING_TERM_PAYMENT;
      
      // Check if single premi
      const currentProduct = session.data.currentProduct;
      const isSavings = isSavingsProduct(currentProduct);
      const amountLabel = isSavings ? 'Premium' : 'Coverage';
      
      if (currentProduct.includes('Single Premi')) {
        session.data.termPayment = '1';
        
        // Add to selected products
        session.data.selectedProducts.push({
          product: currentProduct,
          coverage: text,
          termPayment: '1'
        });
        
        const moreProductKeyboard = {
          reply_markup: {
            inline_keyboard: [
              [
                { text: '➕ Tambah Produk Lain', callback_data: 'add_more_product' },
                { text: '✅ Lanjut ke Notes', callback_data: 'proceed_notes' }
              ]
            ]
          }
        };
        
        bot.sendMessage(chatId,
          `✅ ${amountLabel}: ${text}\n` +
          `✅ Term of Payment: 1 (Single Premium)\n\n` +
          `Produk terpilih: ${session.data.selectedProducts.length}\n\n` +
          `Ingin menambah produk lain?`,
          moreProductKeyboard
        );
      } else {
        // Ask for term payment
        let termOptions;
        if (currentProduct.includes('Term Life')) {
          termOptions = TERM_PAYMENT_OPTIONS.TERM_LIFE;
        } else if (currentProduct.includes('IUL')) {
          termOptions = TERM_PAYMENT_OPTIONS.IUL;
        } else if (currentProduct.includes('Savings')) {
          termOptions = TERM_PAYMENT_OPTIONS.SAVINGS;
        }
        
        const termKeyboard = {
          reply_markup: {
            inline_keyboard: [
              ...termOptions.map(term => {
                // Handle both string and object formats
                const text = typeof term === 'string' ? term : term.text;
                const value = typeof term === 'string' ? term : term.value;
                return [{ text: text, callback_data: `term_${value}` }];
              }),
              [{ text: '✏️ Others (custom)', callback_data: 'term_custom' }]
            ]
          }
        };
        
        bot.sendMessage(chatId,
          `✅ ${amountLabel}: ${text}\n\nPilih *Term of Payment*:`,
          { ...termKeyboard, parse_mode: 'Markdown' }
        );
      }
      break;
      
    case STATES.AWAITING_TERM_PAYMENT_CUSTOM:
      session.data.termPayment = text;
      
      const isSavingsCustom = isSavingsProduct(session.data.currentProduct);
      const amountLabelCustom = isSavingsCustom ? 'Premium' : 'Coverage';
      
      // Add current product to selected products
      session.data.selectedProducts.push({
        product: session.data.currentProduct,
        coverage: session.data.coverageAmount,
        termPayment: text
      });
      
      const moreProductKeyboard2 = {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '➕ Tambah Produk Lain', callback_data: 'add_more_product' },
              { text: '✅ Lanjut ke Notes', callback_data: 'proceed_notes' }
            ]
          ]
        }
      };
      
      bot.sendMessage(chatId,
        `✅ ${amountLabelCustom}: ${session.data.coverageAmount}\n` +
        `✅ Term of Payment: ${text}\n\n` +
        `Produk terpilih: ${session.data.selectedProducts.length}\n\n` +
        `Ingin menambah produk lain?`,
        moreProductKeyboard2
      );
      break;
      
    case STATES.AWAITING_NOTES:
      session.data.notes = text.toLowerCase() === 'tidak' ? '-' : text;
      session.state = STATES.CONFIRMING;
      
      const summary = formatRequestMessage(session.data);
      const confirmKeyboard = {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✅ Kirim Permintaan', callback_data: 'confirm_yes' },
              { text: '❌ Batalkan', callback_data: 'confirm_no' }
            ]
          ]
        }
      };
      
      bot.sendMessage(chatId,
        `📋 *Konfirmasi Data*\n\n${summary}\n\nApakah data sudah benar?`,
        { ...confirmKeyboard, parse_mode: 'Markdown' }
      );
      break;
  }
});

// Handle callback queries (button clicks)
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const userId = query.from.id;
  const session = userSessions.get(userId);
  
  if (!session) {
    bot.answerCallbackQuery(query.id, { text: 'Session expired. Use /request to start again.' });
    return;
  }
  
  const data = query.data;
  
  // Handle gender selection
  if (data.startsWith('gender_')) {
    const gender = data === 'gender_male' ? 'Male' : 'Female';
    session.data.clientGender = gender;
    session.state = STATES.AWAITING_SMOKING;
    
    const smokingKeyboard = {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🚭 No', callback_data: 'smoking_no' },
            { text: '🚬 Yes', callback_data: 'smoking_yes' }
          ]
        ]
      }
    };
    
    bot.editMessageText(
      `✅ Gender: ${gender}\n\n*Smoking?*`,
      {
        chat_id: chatId,
        message_id: query.message.message_id,
        parse_mode: 'Markdown',
        ...smokingKeyboard
      }
    );
    bot.answerCallbackQuery(query.id);
    return;
  }
  
  // Handle smoking selection
  if (data.startsWith('smoking_')) {
    const smoking = data === 'smoking_yes' ? 'Yes' : 'No';
    session.data.smoking = smoking;
    session.state = STATES.AWAITING_PRODUCT;
    
    const productKeyboard = {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🛡️ Term Life', callback_data: 'product_TERM' }],
          [{ text: '💰 IUL (USD)', callback_data: 'product_IUL' }],
          [{ text: '💎 Savings Plan (USD)', callback_data: 'product_SAVINGS' }],
          [{ text: '🏛️ Single Premi Wholelife (IDR)', callback_data: 'product_SINGLE_IDR' }],
          [{ text: '💵 Single Premi USD', callback_data: 'product_SINGLE_USD' }]
        ]
      }
    };
    
    bot.editMessageText(
      `✅ Smoking: ${smoking}\n\nPilih *produk* (bisa pilih lebih dari 1):`,
      {
        chat_id: chatId,
        message_id: query.message.message_id,
        parse_mode: 'Markdown',
        ...productKeyboard
      }
    );
    bot.answerCallbackQuery(query.id);
    return;
  }
  
  // Handle product selection
  if (data.startsWith('product_')) {
    const productKey = data.replace('product_', '');
    
    // Special handling for Term Life - ask currency
    if (productKey === 'TERM') {
      session.state = STATES.AWAITING_TERM_CCY;
      
      const ccyKeyboard = {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '💵 USD', callback_data: 'term_ccy_USD' },
              { text: '💴 SGD', callback_data: 'term_ccy_SGD' }
            ]
          ]
        }
      };
      
      bot.editMessageText(
        `Pilih *currency* untuk Term Life:`,
        {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: 'Markdown',
          ...ccyKeyboard
        }
      );
      bot.answerCallbackQuery(query.id);
      return;
    }
    
    // For other products, proceed to coverage/premium
    session.data.currentProduct = PRODUCTS[productKey];
    session.state = STATES.AWAITING_COVERAGE;
    
    // Determine if this is savings product or protection product
    const isSavings = isSavingsProduct(PRODUCTS[productKey]);
    let options, keyboard, questionText;
    
    if (isSavings) {
      // Savings products - ask for premium
      if (productKey === 'SAVINGS') {
        options = PREMIUM_OPTIONS.SAVINGS_USD;
        questionText = 'Berapa *premium* yang ingin dibayarkan?';
      } else if (productKey === 'SINGLE_IDR') {
        options = PREMIUM_OPTIONS.SINGLE_IDR;
        questionText = 'Berapa *single premium* yang ingin dibayarkan?';
      } else if (productKey === 'SINGLE_USD') {
        options = PREMIUM_OPTIONS.SINGLE_USD;
        questionText = 'Berapa *single premium* yang ingin dibayarkan?';
      }
    } else {
      // Protection products - ask for coverage
      if (productKey === 'SINGLE_IDR') {
        options = COVERAGE_OPTIONS.IDR;
      } else {
        options = COVERAGE_OPTIONS.USD;
      }
      questionText = 'Pilih *UP Jiwa coverage*:';
    }
    
    keyboard = {
      reply_markup: {
        inline_keyboard: [
          ...options.map(amount => [{ text: amount, callback_data: `coverage_${amount}` }]),
          [{ text: '✏️ Others (custom)', callback_data: 'coverage_custom' }]
        ]
      }
    };
    
    bot.editMessageText(
      `✅ Produk: ${session.data.currentProduct}\n\n${questionText}`,
      {
        chat_id: chatId,
        message_id: query.message.message_id,
        parse_mode: 'Markdown',
        ...keyboard
      }
    );
    bot.answerCallbackQuery(query.id);
    return;
  }
  
  // Handle Term Life currency selection
  if (data.startsWith('term_ccy_')) {
    const ccy = data.replace('term_ccy_', '');
    session.data.currentProduct = ccy === 'USD' ? PRODUCTS.TERM_USD : PRODUCTS.TERM_SGD;
    session.state = STATES.AWAITING_COVERAGE;
    
    const coverageOptions = ccy === 'SGD' ? COVERAGE_OPTIONS.SGD : COVERAGE_OPTIONS.USD;
    const coverageKeyboard = {
      reply_markup: {
        inline_keyboard: [
          ...coverageOptions.map(amount => [{ text: amount, callback_data: `coverage_${amount}` }]),
          [{ text: '✏️ Others (custom)', callback_data: 'coverage_custom' }]
        ]
      }
    };
    
    bot.editMessageText(
      `✅ Produk: ${session.data.currentProduct}\n\nPilih *UP Jiwa coverage*:`,
      {
        chat_id: chatId,
        message_id: query.message.message_id,
        parse_mode: 'Markdown',
        ...coverageKeyboard
      }
    );
    bot.answerCallbackQuery(query.id);
    return;
  }
  
  // Handle coverage/premium selection
  if (data.startsWith('coverage_')) {
    if (data === 'coverage_custom') {
      session.state = STATES.AWAITING_COVERAGE_CUSTOM;
      
      // Check if savings or protection product
      const isSavings = isSavingsProduct(session.data.currentProduct);
      const promptText = isSavings 
        ? `Masukkan *premium amount* custom:\n(contoh: $15,000/year atau IDR 150 juta)`
        : `Masukkan *coverage amount* custom:\n(contoh: $750,000 atau IDR 750 juta)`;
      
      bot.sendMessage(chatId, promptText, { parse_mode: 'Markdown' });
      bot.answerCallbackQuery(query.id);
      return;
    }
    
    const coverage = data.replace('coverage_', '');
    session.data.coverageAmount = coverage;
    
    // Now ask for term of payment
    session.state = STATES.AWAITING_TERM_PAYMENT;
    
    // Determine term payment options based on product
    let termOptions, termKeyboard;
    const currentProduct = session.data.currentProduct;
    
    if (currentProduct.includes('Single Premi')) {
      // Single premi = automatic 1 year
      session.data.termPayment = '1';
      
      // Add to selected products
      session.data.selectedProducts.push({
        product: currentProduct,
        coverage: coverage,
        termPayment: '1'
      });
      
      // Ask if want to add more products
      const moreProductKeyboard = {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '➕ Tambah Produk Lain', callback_data: 'add_more_product' },
              { text: '✅ Lanjut ke Notes', callback_data: 'proceed_notes' }
            ]
          ]
        }
      };
      
      bot.editMessageText(
        `✅ Coverage: ${coverage}\n` +
        `✅ Term of Payment: 1 (Single Premium)\n\n` +
        `Produk terpilih: ${session.data.selectedProducts.length}\n\n` +
        `Ingin menambah produk lain?`,
        {
          chat_id: chatId,
          message_id: query.message.message_id,
          ...moreProductKeyboard
        }
      );
      bot.answerCallbackQuery(query.id);
      return;
    }
    
    // For other products, show term payment options
    const isSavings = isSavingsProduct(currentProduct);
    const amountLabel = isSavings ? 'Premium' : 'Coverage';
    
    if (currentProduct.includes('Term Life')) {
      termOptions = TERM_PAYMENT_OPTIONS.TERM_LIFE;
    } else if (currentProduct.includes('IUL')) {
      termOptions = TERM_PAYMENT_OPTIONS.IUL;
    } else if (currentProduct.includes('Savings')) {
      termOptions = TERM_PAYMENT_OPTIONS.SAVINGS;
    }
    
    termKeyboard = {
      reply_markup: {
        inline_keyboard: [
          ...termOptions.map(term => {
            // Handle both string and object formats
            const text = typeof term === 'string' ? term : term.text;
            const value = typeof term === 'string' ? term : term.value;
            return [{ text: text, callback_data: `term_${value}` }];
          }),
          [{ text: '✏️ Others (custom)', callback_data: 'term_custom' }]
        ]
      }
    };
    
    bot.editMessageText(
      `✅ ${amountLabel}: ${coverage}\n\nPilih *Term of Payment*:`,
      {
        chat_id: chatId,
        message_id: query.message.message_id,
        parse_mode: 'Markdown',
        ...termKeyboard
      }
    );
    bot.answerCallbackQuery(query.id);
    return;
  }
  
  // Handle term payment selection
  if (data.startsWith('term_')) {
    if (data === 'term_custom') {
      session.state = STATES.AWAITING_TERM_PAYMENT_CUSTOM;
      bot.sendMessage(chatId, 
        `Masukkan *term of payment* custom:\n` +
        `(contoh: 15 years)`,
        { parse_mode: 'Markdown' }
      );
      bot.answerCallbackQuery(query.id);
      return;
    }
    
    const term = data.replace('term_', '');
    session.data.termPayment = term;
    
    // Add current product to selected products
    session.data.selectedProducts.push({
      product: session.data.currentProduct,
      coverage: session.data.coverageAmount,
      termPayment: term
    });
    
    // Ask if want to add more products
    const moreProductKeyboard = {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '➕ Tambah Produk Lain', callback_data: 'add_more_product' },
            { text: '✅ Lanjut ke Notes', callback_data: 'proceed_notes' }
          ]
        ]
      }
    };
    
    bot.editMessageText(
      `✅ Coverage: ${session.data.coverageAmount}\n` +
      `✅ Term of Payment: ${term}\n\n` +
      `Produk terpilih: ${session.data.selectedProducts.length}\n\n` +
      `Ingin menambah produk lain?`,
      {
        chat_id: chatId,
        message_id: query.message.message_id,
        ...moreProductKeyboard
      }
    );
    bot.answerCallbackQuery(query.id);
    return;
  }
  
  // Handle add more product
  if (data === 'add_more_product') {
    session.state = STATES.AWAITING_PRODUCT;
    
    const productKeyboard = {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🛡️ Term Life', callback_data: 'product_TERM' }],
          [{ text: '💰 IUL (USD)', callback_data: 'product_IUL' }],
          [{ text: '💎 Savings Plan (USD)', callback_data: 'product_SAVINGS' }],
          [{ text: '🏛️ Single Premi Wholelife (IDR)', callback_data: 'product_SINGLE_IDR' }],
          [{ text: '💵 Single Premi USD', callback_data: 'product_SINGLE_USD' }]
        ]
      }
    };
    
    bot.editMessageText(
      `Pilih *produk* berikutnya:`,
      {
        chat_id: chatId,
        message_id: query.message.message_id,
        parse_mode: 'Markdown',
        ...productKeyboard
      }
    );
    bot.answerCallbackQuery(query.id);
    return;
  }
  
  // Handle proceed to notes
  if (data === 'proceed_notes') {
    session.state = STATES.AWAITING_NOTES;
    bot.sendMessage(chatId,
      `Ada *catatan tambahan*?\n(ketik "tidak" jika tidak ada)`,
      { parse_mode: 'Markdown' }
    );
    bot.answerCallbackQuery(query.id);
    return;
  }
  
  // Handle confirmation
  if (data === 'confirm_yes') {
    bot.answerCallbackQuery(query.id, { text: 'Mengirim permintaan...' });
    
    try {
      // Save to Google Sheets - one row per product
      await saveToGoogleSheets(session.data);
      
      // Send to CS group
      const csMessage = formatRequestMessage(session.data, true);
      await bot.sendMessage(process.env.CS_CHAT_ID, csMessage, { parse_mode: 'Markdown' });
      
      // Confirm to agent
      bot.editMessageText(
        `✅ *Permintaan Berhasil Dikirim!*\n\n` +
        `${session.data.selectedProducts.length} permintaan ilustrasi telah diteruskan ke tim CS.\n` +
        `Anda akan dihubungi segera.\n\n` +
        `Gunakan /request untuk permintaan baru.`,
        {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: 'Markdown'
        }
      );
      
      // Clear session
      userSessions.delete(userId);
      
    } catch (error) {
      console.error('Error processing request:', error);
      bot.sendMessage(chatId, 
        `❌ Terjadi kesalahan saat mengirim permintaan.\n` +
        `Silakan coba lagi atau hubungi admin.\n\n` +
        `Error: ${error.message}`
      );
    }
    
  } else if (data === 'confirm_no') {
    bot.answerCallbackQuery(query.id, { text: 'Permintaan dibatalkan' });
    userSessions.delete(userId);
    
    bot.editMessageText(
      `❌ Permintaan dibatalkan.\n\nGunakan /request untuk memulai lagi.`,
      {
        chat_id: chatId,
        message_id: query.message.message_id
      }
    );
  }
});

// Error handling
bot.on('polling_error', (error) => {
  console.error('Polling error:', error);
});

console.log('🤖 Insurance Illustration Bot is running...');

// Admin: View pending requests
bot.onText(/\/pending/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  if (!auth.isAdmin(userId)) {
    bot.sendMessage(chatId, '❌ Admin only command.');
    return;
  }
  
  const pending = auth.getAllPendingRequests();
  
  if (pending.length === 0) {
    bot.sendMessage(chatId, '✅ No pending access requests.');
    return;
  }
  
  let message = `📋 *Pending Access Requests (${pending.length})*\n\n`;
  
  for (const req of pending) {
    const keyboard = {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '✅ Approve', callback_data: `approve_${req.userId}` },
            { text: '❌ Reject', callback_data: `reject_${req.userId}` }
          ]
        ]
      }
    };
    
    await bot.sendMessage(chatId,
      `👤 *${req.userName}*\n` +
      `🆔 User ID: ${req.userId}\n` +
      `📱 Username: @${req.userUsername}\n` +
      `🕐 ${new Date(req.timestamp).toLocaleString('id-ID')}`,
      { ...keyboard, parse_mode: 'Markdown' }
    );
  }
});

// Admin: List authorized users
bot.onText(/\/list/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  if (!auth.isAdmin(userId)) {
    bot.sendMessage(chatId, '❌ Admin only command.');
    return;
  }
  
  const users = auth.getAllUsers();
  
  let message = `👥 *Authorized Users*\n\n`;
  message += `*Admins (${users.admins.length}):*\n`;
  users.admins.forEach(id => message += `• ${id}\n`);
  message += `\n*Users (${users.users.length}):*\n`;
  users.users.forEach(id => message += `• ${id}\n`);
  
  bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
});

// Admin: Add user manually
bot.onText(/\/adduser (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const targetUserId = parseInt(match[1]);
  
  if (!auth.isAdmin(userId)) {
    bot.sendMessage(chatId, '❌ Admin only command.');
    return;
  }
  
  if (isNaN(targetUserId)) {
    bot.sendMessage(chatId, '❌ Invalid user ID. Use: /adduser 123456789');
    return;
  }
  
  if (auth.addUser(targetUserId)) {
    bot.sendMessage(chatId, `✅ User ${targetUserId} has been authorized.`);
    
    // Notify the user
    try {
      bot.sendMessage(targetUserId,
        `✅ *Access Granted!*\n\n` +
        `You can now use the bot.\n` +
        `Use /request to start.`,
        { parse_mode: 'Markdown' }
      );
    } catch (error) {
      console.log('Could not notify user:', error.message);
    }
  } else {
    bot.sendMessage(chatId, `⚠️ User ${targetUserId} is already authorized.`);
  }
});

// Admin: Remove user
bot.onText(/\/removeuser (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const targetUserId = parseInt(match[1]);
  
  if (!auth.isAdmin(userId)) {
    bot.sendMessage(chatId, '❌ Admin only command.');
    return;
  }
  
  if (isNaN(targetUserId)) {
    bot.sendMessage(chatId, '❌ Invalid user ID. Use: /removeuser 123456789');
    return;
  }
  
  if (auth.removeUser(targetUserId)) {
    bot.sendMessage(chatId, `✅ User ${targetUserId} has been removed.`);
    
    // Notify the user
    try {
      bot.sendMessage(targetUserId,
        `🔒 Your access has been revoked.\n\n` +
        `Contact admin if you believe this is an error.`
      );
    } catch (error) {
      console.log('Could not notify user:', error.message);
    }
  } else {
    bot.sendMessage(chatId, `⚠️ User ${targetUserId} not found.`);
  }
});

// Admin: Add admin
bot.onText(/\/addadmin (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const targetUserId = parseInt(match[1]);
  
  if (!auth.isAdmin(userId)) {
    bot.sendMessage(chatId, '❌ Admin only command.');
    return;
  }
  
  if (isNaN(targetUserId)) {
    bot.sendMessage(chatId, '❌ Invalid user ID. Use: /addadmin 123456789');
    return;
  }
  
  if (auth.addAdmin(targetUserId)) {
    bot.sendMessage(chatId, `✅ User ${targetUserId} is now an admin.`);
    
    // Notify the new admin
    try {
      bot.sendMessage(targetUserId,
        `👑 *You are now an admin!*\n\n` +
        `You can now manage user access.\n` +
        `Use /help to see admin commands.`,
        { parse_mode: 'Markdown' }
      );
    } catch (error) {
      console.log('Could not notify user:', error.message);
    }
  } else {
    bot.sendMessage(chatId, `⚠️ User ${targetUserId} is already an admin.`);
  }
});

// Handle approval/rejection callbacks
bot.on('callback_query', async (query) => {
  const data = query.data;
  const chatId = query.message.chat.id;
  const adminId = query.from.id;
  
  if (!auth.isAdmin(adminId)) {
    bot.answerCallbackQuery(query.id, { text: 'Admin only action.' });
    return;
  }
  
  if (data.startsWith('approve_')) {
    const targetUserId = parseInt(data.replace('approve_', ''));
    const pendingReq = auth.getPendingRequest(targetUserId);
    
    if (!pendingReq) {
      bot.answerCallbackQuery(query.id, { text: 'Request not found or already processed.' });
      return;
    }
    
    auth.addUser(targetUserId);
    
    bot.editMessageText(
      `✅ *APPROVED*\n\n` +
      `👤 ${pendingReq.userName}\n` +
      `🆔 User ID: ${targetUserId}\n` +
      `✓ Approved by admin`,
      {
        chat_id: chatId,
        message_id: query.message.message_id,
        parse_mode: 'Markdown'
      }
    );
    
    // Notify the user
    try {
      await bot.sendMessage(targetUserId,
        `✅ *Access Granted!*\n\n` +
        `Your request has been approved.\n` +
        `You can now use the bot.\n\n` +
        `Use /request to start.`,
        { parse_mode: 'Markdown' }
      );
    } catch (error) {
      console.log('Could not notify user:', error.message);
    }
    
    bot.answerCallbackQuery(query.id, { text: 'User approved!' });
    
  } else if (data.startsWith('reject_')) {
    const targetUserId = parseInt(data.replace('reject_', ''));
    const pendingReq = auth.getPendingRequest(targetUserId);
    
    if (!pendingReq) {
      bot.answerCallbackQuery(query.id, { text: 'Request not found or already processed.' });
      return;
    }
    
    auth.removePendingRequest(targetUserId);
    
    bot.editMessageText(
      `❌ *REJECTED*\n\n` +
      `👤 ${pendingReq.userName}\n` +
      `🆔 User ID: ${targetUserId}\n` +
      `✗ Rejected by admin`,
      {
        chat_id: chatId,
        message_id: query.message.message_id,
        parse_mode: 'Markdown'
      }
    );
    
    // Notify the user
    try {
      await bot.sendMessage(targetUserId,
        `❌ Access request rejected.\n\n` +
        `Please contact admin for more information.`
      );
    } catch (error) {
      console.log('Could not notify user:', error.message);
    }
    
    bot.answerCallbackQuery(query.id, { text: 'User rejected.' });
  }
});

// Admin: List requests
bot.onText(/\/lists(?:\s+(.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  if (!auth.isAdmin(userId)) {
    bot.sendMessage(chatId, '❌ Admin only command.');
    return;
  }
  
  const statusFilter = match[1]?.trim().toLowerCase();
  const { getAllRequests } = require('./googleSheets');
  
  try {
    const requests = await getAllRequests(statusFilter, 20);
    
    if (requests.length === 0) {
      const filterText = statusFilter ? ` with status "${statusFilter}"` : '';
      bot.sendMessage(chatId, `📋 No requests found${filterText}.`);
      return;
    }
    
    const filterText = statusFilter ? ` (${statusFilter})` : '';
    bot.sendMessage(chatId, `📋 *Requests${filterText}*\n\nShowing ${requests.length} request(s)`, { parse_mode: 'Markdown' });
    
    // Send each request with status buttons
    for (const req of requests) {
      const statusEmoji = {
        'Pending': '⏳',
        'Processing': '🔄',
        'Completed': '✅'
      };
      
      const currentStatus = req.status || 'Pending';
      const emoji = statusEmoji[currentStatus] || '📋';
      
      const keyboard = {
        reply_markup: {
          inline_keyboard: [
            [
              { 
                text: currentStatus === 'Pending' ? '⏳ Pending ✓' : '⏳ Pending', 
                callback_data: `status_${req.rowNumber}_Pending` 
              },
              { 
                text: currentStatus === 'Processing' ? '🔄 Processing ✓' : '🔄 Processing', 
                callback_data: `status_${req.rowNumber}_Processing` 
              },
              { 
                text: currentStatus === 'Completed' ? '✅ Completed ✓' : '✅ Completed', 
                callback_data: `status_${req.rowNumber}_Completed` 
              }
            ]
          ]
        }
      };
      
      const message = 
        `📋 *Request #${req.requestId}*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `👤 Client: ${req.clientName}\n` +
        `📅 DOB: ${req.clientDOB}\n` +
        `⚧️ Gender: ${req.clientGender}\n` +
        `🚬 Smoking: ${req.smoking}\n` +
        `🎯 Product: ${req.productType}\n` +
        `💰 Amount: ${req.coverageAmount}\n` +
        `📆 Term: ${req.termPayment}\n` +
        `👨‍💼 Agent: ${req.agentName} (ID: ${req.agentId})\n` +
        `📝 Notes: ${req.notes}\n` +
        `⏰ Submitted: ${new Date(req.timestamp).toLocaleString('id-ID')}\n\n` +
        `Current Status: ${emoji} *${currentStatus}*`;
      
      await bot.sendMessage(chatId, message, { ...keyboard, parse_mode: 'Markdown' });
    }
    
  } catch (error) {
    console.error('Error listing requests:', error);
    bot.sendMessage(chatId, '❌ Error fetching requests. Please try again.');
  }
});

// Admin: Set status manually
bot.onText(/\/setstatus (\d+) (\w+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  if (!auth.isAdmin(userId)) {
    bot.sendMessage(chatId, '❌ Admin only command.');
    return;
  }
  
  const requestId = parseInt(match[1]);
  const newStatus = match[2].charAt(0).toUpperCase() + match[2].slice(1).toLowerCase();
  
  if (!['Pending', 'Processing', 'Completed'].includes(newStatus)) {
    bot.sendMessage(chatId, '❌ Invalid status. Use: pending, processing, or completed');
    return;
  }
  
  const { getRequestByRow, updateRequestStatus } = require('./googleSheets');
  const rowNumber = requestId + 1; // Convert ID to row number
  
  try {
    const request = await getRequestByRow(rowNumber);
    
    if (!request) {
      bot.sendMessage(chatId, `❌ Request #${requestId} not found.`);
      return;
    }
    
    const oldStatus = request.status || 'Pending';
    
    // Update status in Google Sheets
    await updateRequestStatus(rowNumber, newStatus);
    
    bot.sendMessage(chatId,
      `✅ *Status Updated*\n\n` +
      `Request #${requestId}\n` +
      `Client: ${request.clientName}\n` +
      `${oldStatus} → ${newStatus}`,
      { parse_mode: 'Markdown' }
    );
    
    // Notify agent only if changing from Pending to Processing
    if (oldStatus === 'Pending' && newStatus === 'Processing') {
      try {
        await bot.sendMessage(request.agentId,
          `🔔 *Status Update*\n\n` +
          `Your request for ${request.clientName} (${request.productType})\n` +
          `Status: Pending → Processing\n\n` +
          `Use /status to see all your requests.`,
          { parse_mode: 'Markdown' }
        );
      } catch (error) {
        console.log('Could not notify agent:', error.message);
      }
    }
    
  } catch (error) {
    console.error('Error setting status:', error);
    bot.sendMessage(chatId, '❌ Error updating status. Please try again.');
  }
});

// Handle status button clicks
bot.on('callback_query', async (query) => {
  const data = query.data;
  
  // Handle status update buttons
  if (data.startsWith('status_')) {
    const userId = query.from.id;
    
    if (!auth.isAdmin(userId)) {
      bot.answerCallbackQuery(query.id, { text: 'Admin only action.' });
      return;
    }
    
    const parts = data.split('_');
    const rowNumber = parseInt(parts[1]);
    const newStatus = parts[2];
    
    const { getRequestByRow, updateRequestStatus } = require('./googleSheets');
    
    try {
      const request = await getRequestByRow(rowNumber);
      
      if (!request) {
        bot.answerCallbackQuery(query.id, { text: 'Request not found.' });
        return;
      }
      
      const oldStatus = request.status || 'Pending';
      
      // Don't update if same status
      if (oldStatus === newStatus) {
        bot.answerCallbackQuery(query.id, { text: `Already ${newStatus}` });
        return;
      }
      
      // Update status in Google Sheets
      await updateRequestStatus(rowNumber, newStatus);
      
      // Update the message
      const statusEmoji = {
        'Pending': '⏳',
        'Processing': '🔄',
        'Completed': '✅'
      };
      
      const emoji = statusEmoji[newStatus] || '📋';
      
      const keyboard = {
        reply_markup: {
          inline_keyboard: [
            [
              { 
                text: newStatus === 'Pending' ? '⏳ Pending ✓' : '⏳ Pending', 
                callback_data: `status_${rowNumber}_Pending` 
              },
              { 
                text: newStatus === 'Processing' ? '🔄 Processing ✓' : '🔄 Processing', 
                callback_data: `status_${rowNumber}_Processing` 
              },
              { 
                text: newStatus === 'Completed' ? '✅ Completed ✓' : '✅ Completed', 
                callback_data: `status_${rowNumber}_Completed` 
              }
            ]
          ]
        }
      };
      
      const message = 
        `📋 *Request #${request.requestId}*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `👤 Client: ${request.clientName}\n` +
        `📅 DOB: ${request.clientDOB}\n` +
        `⚧️ Gender: ${request.clientGender}\n` +
        `🚬 Smoking: ${request.smoking}\n` +
        `🎯 Product: ${request.productType}\n` +
        `💰 Amount: ${request.coverageAmount}\n` +
        `📆 Term: ${request.termPayment}\n` +
        `👨‍💼 Agent: ${request.agentName} (ID: ${request.agentId})\n` +
        `📝 Notes: ${request.notes}\n` +
        `⏰ Submitted: ${new Date(request.timestamp).toLocaleString('id-ID')}\n\n` +
        `Current Status: ${emoji} *${newStatus}*`;
      
      bot.editMessageText(message, {
        chat_id: query.message.chat.id,
        message_id: query.message.message_id,
        parse_mode: 'Markdown',
        ...keyboard
      });
      
      bot.answerCallbackQuery(query.id, { text: `✅ Updated to ${newStatus}` });
      
      // Notify agent only if changing from Pending to Processing
      if (oldStatus === 'Pending' && newStatus === 'Processing') {
        try {
          await bot.sendMessage(request.agentId,
            `🔔 *Status Update*\n\n` +
            `Your request for ${request.clientName} (${request.productType})\n` +
            `Status: Pending → Processing\n\n` +
            `Use /status to see all your requests.`,
            { parse_mode: 'Markdown' }
          );
        } catch (error) {
          console.log('Could not notify agent:', error.message);
        }
      }
      
    } catch (error) {
      console.error('Error updating status:', error);
      bot.answerCallbackQuery(query.id, { text: 'Error updating status' });
    }
    
    return;
  }
  
  // ... rest of existing callback handlers ...
});
