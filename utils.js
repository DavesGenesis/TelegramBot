/**
 * Format request data into readable message
 */
function formatRequestMessage(data, forCS = false) {
  const header = forCS 
    ? `🔔 *PERMINTAAN ILUSTRASI BARU*\n\n`
    : '';
  
  const agentInfo = forCS
    ? `👤 *Agent:* ${data.agentName} (ID: ${data.agentId})\n\n`
    : '';
  
  const productsList = data.selectedProducts
    .map((p, i) => {
      const isSavings = p.product.includes('Savings Plan') || p.product.includes('Single Premi');
      const amountLabel = isSavings ? 'Premium' : 'Coverage';
      return `${i + 1}. ${p.product}\n   ${amountLabel}: ${p.coverage}\n   Term: ${p.termPayment}`;
    })
    .join('\n');
  
  return (
    header +
    agentInfo +
    `📋 *DATA KLIEN*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `👤 Nama: ${data.clientName}\n` +
    `🎂 DOB: ${data.clientDOB}\n` +
    `⚧️ Gender: ${data.clientGender}\n` +
    `🚬 Smoking: ${data.smoking}\n\n` +
    `📦 *PRODUK (${data.selectedProducts.length})*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `${productsList}\n\n` +
    `📝 *CATATAN*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `${data.notes}\n\n` +
    `🕐 ${new Date(data.timestamp).toLocaleString('id-ID')}`
  );
}

/**
 * Format date to Indonesian locale
 */
function formatDate(date) {
  return new Date(date).toLocaleString('id-ID', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Validate age input
 */
function isValidAge(age) {
  const num = parseInt(age);
  return !isNaN(num) && num >= 1 && num <= 100;
}

/**
 * Validate currency amount
 */
function isValidAmount(amount) {
  // Allow formats like: 1000000, 1jt, 1 juta, 1M, 1 milyar, etc.
  const patterns = [
    /^\d+$/,                    // Plain numbers
    /^\d+[\s]?(jt|juta)$/i,    // 1jt, 1 juta
    /^\d+[\s]?(m|million)$/i,  // 1M, 1 million
    /^\d+[\s]?(b|milyar)$/i    // 1B, 1 milyar
  ];
  
  return patterns.some(pattern => pattern.test(amount.trim()));
}

module.exports = {
  formatRequestMessage,
  formatDate,
  isValidAge,
  isValidAmount
};
