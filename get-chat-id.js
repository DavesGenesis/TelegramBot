// Temporary script to get chat ID
const TelegramBot = require('node-telegram-bot-api');

const token = '8203118127:AAHJk4CybzzTJQwHmlUGj2uc-opVMegTSjI';
const bot = new TelegramBot(token, { polling: true });

console.log('🤖 Bot is running...');
console.log('📝 Send a message in your CS group now!');
console.log('');

bot.on('message', (msg) => {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📨 Message received!');
  console.log('');
  console.log('Chat Type:', msg.chat.type);
  console.log('Chat Title:', msg.chat.title || 'N/A');
  console.log('');
  console.log('✅ CHAT ID:', msg.chat.id);
  console.log('');
  console.log('Copy this ID (including minus sign if present)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  
  if (msg.chat.type === 'group' || msg.chat.type === 'supergroup') {
    console.log('✅ This is a group chat - perfect for CS notifications!');
  } else if (msg.chat.type === 'private') {
    console.log('⚠️  This is a private chat - you need to use a GROUP chat ID for CS notifications');
  }
  console.log('');
  console.log('Press Ctrl+C to stop this script');
});

bot.on('polling_error', (error) => {
  console.error('Error:', error.message);
});
