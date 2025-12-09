const fs = require('fs');
const path = require('path');

const AUTH_FILE = path.join(__dirname, 'authorized-users.json');
const PENDING_FILE = path.join(__dirname, 'pending-requests.json');

// Initialize files if they don't exist
function initAuthFiles() {
  if (!fs.existsSync(AUTH_FILE)) {
    // Check for initial admin from environment variable
    const initialAdmins = [];
    if (process.env.INITIAL_ADMIN_ID) {
      const adminIds = process.env.INITIAL_ADMIN_ID.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
      initialAdmins.push(...adminIds);
    }
    
    fs.writeFileSync(AUTH_FILE, JSON.stringify({
      admins: initialAdmins,
      users: []
    }, null, 2));
    
    if (initialAdmins.length > 0) {
      console.log(`✅ Initialized with ${initialAdmins.length} admin(s): ${initialAdmins.join(', ')}`);
    }
  }
  
  if (!fs.existsSync(PENDING_FILE)) {
    fs.writeFileSync(PENDING_FILE, JSON.stringify([], null, 2));
  }
}

// Load authorized users
function loadAuthorizedUsers() {
  initAuthFiles();
  const data = fs.readFileSync(AUTH_FILE, 'utf8');
  return JSON.parse(data);
}

// Save authorized users
function saveAuthorizedUsers(data) {
  fs.writeFileSync(AUTH_FILE, JSON.stringify(data, null, 2));
}

// Load pending requests
function loadPendingRequests() {
  initAuthFiles();
  const data = fs.readFileSync(PENDING_FILE, 'utf8');
  return JSON.parse(data);
}

// Save pending requests
function savePendingRequests(data) {
  fs.writeFileSync(PENDING_FILE, JSON.stringify(data, null, 2));
}

// Check if user is admin
function isAdmin(userId) {
  const auth = loadAuthorizedUsers();
  return auth.admins.includes(userId);
}

// Check if user is authorized
function isAuthorized(userId) {
  const auth = loadAuthorizedUsers();
  return auth.admins.includes(userId) || auth.users.includes(userId);
}

// Add admin
function addAdmin(userId) {
  const auth = loadAuthorizedUsers();
  if (!auth.admins.includes(userId)) {
    auth.admins.push(userId);
    saveAuthorizedUsers(auth);
    return true;
  }
  return false;
}

// Add authorized user
function addUser(userId) {
  const auth = loadAuthorizedUsers();
  if (!auth.users.includes(userId) && !auth.admins.includes(userId)) {
    auth.users.push(userId);
    saveAuthorizedUsers(auth);
    
    // Remove from pending if exists
    removePendingRequest(userId);
    return true;
  }
  return false;
}

// Remove user
function removeUser(userId) {
  const auth = loadAuthorizedUsers();
  const index = auth.users.indexOf(userId);
  if (index > -1) {
    auth.users.splice(index, 1);
    saveAuthorizedUsers(auth);
    return true;
  }
  return false;
}

// Add pending request
function addPendingRequest(userId, userName, userUsername) {
  const pending = loadPendingRequests();
  
  // Check if already pending
  if (pending.find(p => p.userId === userId)) {
    return false;
  }
  
  pending.push({
    userId: userId,
    userName: userName,
    userUsername: userUsername,
    timestamp: new Date().toISOString()
  });
  
  savePendingRequests(pending);
  return true;
}

// Remove pending request
function removePendingRequest(userId) {
  const pending = loadPendingRequests();
  const filtered = pending.filter(p => p.userId !== userId);
  savePendingRequests(filtered);
}

// Get pending request
function getPendingRequest(userId) {
  const pending = loadPendingRequests();
  return pending.find(p => p.userId === userId);
}

// Get all pending requests
function getAllPendingRequests() {
  return loadPendingRequests();
}

// Get all authorized users
function getAllUsers() {
  return loadAuthorizedUsers();
}

module.exports = {
  initAuthFiles,
  isAdmin,
  isAuthorized,
  addAdmin,
  addUser,
  removeUser,
  addPendingRequest,
  removePendingRequest,
  getPendingRequest,
  getAllPendingRequests,
  getAllUsers
};
