// Helper to load Google credentials from JSON file
const fs = require('fs');
const path = require('path');

function loadGoogleCredentials() {
  try {
    // Look for JSON file in the telegram-bot folder
    const files = fs.readdirSync(__dirname);
    const jsonFile = files.find(f => 
      f.endsWith('.json') && 
      !f.includes('package') && 
      f.includes('client')
    );
    
    if (!jsonFile) {
      console.error('❌ No Google credentials JSON file found!');
      console.log('Please place your downloaded JSON file in the telegram-bot folder');
      return null;
    }
    
    const credentials = JSON.parse(fs.readFileSync(path.join(__dirname, jsonFile), 'utf8'));
    
    console.log('✅ Credentials loaded from:', jsonFile);
    console.log('📧 Service Account Email:', credentials.client_email);
    
    return credentials;
    
  } catch (error) {
    console.error('❌ Error loading credentials:', error.message);
    return null;
  }
}

module.exports = { loadGoogleCredentials };
