const { google } = require('googleapis');
const { loadGoogleCredentials } = require('./load-credentials');

// Try to load from JSON file first, fallback to env variables
let credentials;
const jsonCredentials = loadGoogleCredentials();

if (jsonCredentials) {
  credentials = {
    client_email: jsonCredentials.client_email,
    private_key: jsonCredentials.private_key
  };
} else {
  credentials = {
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')
  };
}

// Initialize Google Sheets API
const auth = new google.auth.GoogleAuth({
  credentials: credentials,
  scopes: ['https://www.googleapis.com/auth/spreadsheets']
});

const sheets = google.sheets({ version: 'v4', auth });

/**
 * Save request data to Google Sheets
 * Creates one row per product
 */
async function saveToGoogleSheets(data) {
  try {
    // Create one row for each selected product
    const values = data.selectedProducts.map(product => [
      data.timestamp,
      data.agentName,
      data.agentId,
      data.clientName,
      data.clientDOB,
      data.clientGender,
      data.smoking,
      product.product,
      product.coverage,
      product.termPayment,
      data.notes,
      'Pending' // Status
    ]);

    const response = await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: 'Requests!A:L', // Adjust sheet name and range as needed
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: values
      }
    });

    console.log(`${values.length} rows saved to Google Sheets:`, response.data);
    return response.data;
    
  } catch (error) {
    console.error('Error saving to Google Sheets:', error);
    throw error;
  }
}

/**
 * Update request status in Google Sheets
 */
async function updateRequestStatus(rowNumber, status) {
  try {
    await sheets.spreadsheets.values.update({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: `Requests!L${rowNumber}`, // Status column (changed from K to L)
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[status]]
      }
    });
    
    console.log(`Status updated to ${status} for row ${rowNumber}`);
    
  } catch (error) {
    console.error('Error updating status:', error);
    throw error;
  }
}

/**
 * Get recent pending requests (for admin to manage)
 */
async function getRecentPendingRequests(limit = 10) {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: 'Requests!A2:L'
    });

    const rows = response.data.values || [];
    return rows
      .map((row, index) => ({
        rowNumber: index + 2,
        timestamp: row[0],
        agentName: row[1],
        agentId: row[2],
        clientName: row[3],
        clientDOB: row[4],
        clientGender: row[5],
        smoking: row[6],
        productType: row[7],
        coverageAmount: row[8],
        termPayment: row[9],
        notes: row[10],
        status: row[11] || 'Pending'
      }))
      .filter(req => req.status === 'Pending')
      .slice(0, limit);
      
  } catch (error) {
    console.error('Error getting recent pending requests:', error);
    throw error;
  }
}

/**
 * Update request status in Google Sheets
 */
async function updateRequestStatus(rowNumber, status) {
  try {
    await sheets.spreadsheets.values.update({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: `Requests!L${rowNumber}`, // Status column (L)
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[status]]
      }
    });
    
    console.log(`Status updated to ${status} for row ${rowNumber}`);
    
  } catch (error) {
    console.error('Error updating status:', error);
    throw error;
  }
}

/**
 * Get all pending requests
 */
async function getPendingRequests() {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: 'Requests!A2:L' // Skip header row
    });

    const rows = response.data.values || [];
    return rows
      .map((row, index) => ({
        rowNumber: index + 2,
        timestamp: row[0],
        agentName: row[1],
        agentId: row[2],
        clientName: row[3],
        clientDOB: row[4],
        clientGender: row[5],
        smoking: row[6],
        productType: row[7],
        coverageAmount: row[8],
        termPayment: row[9],
        notes: row[10],
        status: row[11] || 'Pending'
      }))
      .filter(req => req.status === 'Pending');
      
  } catch (error) {
    console.error('Error getting pending requests:', error);
    throw error;
  }
}

/**
 * Get all requests with optional status filter
 */
async function getAllRequests(statusFilter = null, limit = 20) {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: 'Requests!A2:L' // Skip header row
    });

    const rows = response.data.values || [];
    let requests = rows.map((row, index) => ({
      rowNumber: index + 2,
      requestId: index + 1, // Simple ID starting from 1
      timestamp: row[0],
      agentName: row[1],
      agentId: row[2],
      clientName: row[3],
      clientDOB: row[4],
      clientGender: row[5],
      smoking: row[6],
      productType: row[7],
      coverageAmount: row[8],
      termPayment: row[9],
      notes: row[10],
      status: row[11] || 'Pending'
    }));

    // Filter by status if provided
    if (statusFilter) {
      requests = requests.filter(req => 
        req.status.toLowerCase() === statusFilter.toLowerCase()
      );
    }

    // Return oldest first, limited to specified number
    return requests.slice(0, limit);
      
  } catch (error) {
    console.error('Error getting all requests:', error);
    throw error;
  }
}

/**
 * Get request by row number
 */
async function getRequestByRow(rowNumber) {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: `Requests!A${rowNumber}:L${rowNumber}`
    });

    const row = response.data.values?.[0];
    if (!row) return null;

    return {
      rowNumber: rowNumber,
      requestId: rowNumber - 1,
      timestamp: row[0],
      agentName: row[1],
      agentId: row[2],
      clientName: row[3],
      clientDOB: row[4],
      clientGender: row[5],
      smoking: row[6],
      productType: row[7],
      coverageAmount: row[8],
      termPayment: row[9],
      notes: row[10],
      status: row[11] || 'Pending'
    };
      
  } catch (error) {
    console.error('Error getting request by row:', error);
    throw error;
  }
}

/**
 * Get all requests by agent ID
 */
async function getRequestsByAgent(agentId) {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: 'Requests!A2:L' // Skip header row
    });

    const rows = response.data.values || [];
    return rows
      .map((row, index) => ({
        rowNumber: index + 2,
        timestamp: row[0],
        agentName: row[1],
        agentId: row[2],
        clientName: row[3],
        clientDOB: row[4],
        clientGender: row[5],
        smoking: row[6],
        productType: row[7],
        coverageAmount: row[8],
        termPayment: row[9],
        notes: row[10],
        status: row[11] || 'Pending'
      }))
      .filter(req => req.agentId == agentId); // Filter by agent ID
      
  } catch (error) {
    console.error('Error getting requests by agent:', error);
    throw error;
  }
}

module.exports = {
  saveToGoogleSheets,
  updateRequestStatus,
  getPendingRequests,
  getRequestsByAgent,
  getAllRequests,
  getRequestByRow
};
