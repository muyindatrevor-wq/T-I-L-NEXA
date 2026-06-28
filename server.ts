import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Middleware to restrict edit/delete operations to owners only
const checkOwnerRole = (req: any, res: any, next: any) => {
  const role = req.headers["x-user-role"];
  if (role !== "owner") {
    return res.status(403).json({ error: "Access Denied: Only owners can perform this action." });
  }
  next();
};

// Middleware to restrict edit/delete operations to owners or authorized agents
const checkEditDeletePermission = (req: any, res: any, next: any) => {
  const role = req.headers["x-user-role"];
  const userId = req.headers["x-user-id"];
  
  if (role === "owner") {
    return next();
  }
  
  const user = users.find(u => u.id === String(userId));
  if (user && user.allowEditDelete) {
    return next();
  }
  
  return res.status(403).json({ error: "Access Denied: You do not have permission to edit or delete records. Please contact the business owner." });
};

// --- CUSTOM TIERS FOR UGANDA MOBILE MONEY COMMISSIONS ---
// Estimated standard commissions for Agent operations (Deposits & Withdrawals)
function calculateEstimatedCommission(type: string, provider: string, amount: number): number {
  if (type === 'airtime') {
    return Math.round(amount * 0.05); // 5% airtime retail commission
  }
  if (type === 'transfer') {
    return 1000; // Average flat commission on independent transfers
  }
  if (type === 'float_purchase') {
    return 0; // No commission on float purchase
  }

  // Tiered commission for Deposits and Withdrawals (approximate MTN/Airtel agent tiers in UGX)
  if (amount <= 5000) return 150;
  if (amount <= 10000) return 280;
  if (amount <= 30000) return 450;
  if (amount <= 60000) return 800;
  if (amount <= 100000) return 1200;
  if (amount <= 250000) return 3200;
  if (amount <= 500000) return 5200;
  if (amount <= 1000000) return 8500;
  return 12000; // Standard max commission tier for huge agent transactions
}

// --- DATA MODELS & FILE-BASED JSON PERSISTENCE DB ---
const DB_FILE = path.join(process.cwd(), "db.json");
const now = Date.now();
const oneDay = 24 * 60 * 60 * 1000;

let branches: any[] = [];
let users: any[] = [];
let alertThresholds: any = {
  lowFloatLimit: 300000,
  lowCashLimit: 400000
};
let transactions: any[] = [];
let expenses: any[] = [];

function saveToDisk() {
  try {
    const data = {
      branches,
      users,
      alertThresholds,
      transactions,
      expenses
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error("[DB SAVE FAILED] Could not write database payload to local disk:", err);
  }
}

function loadFromDisk() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, "utf-8");
      if (raw.trim()) {
        const data = JSON.parse(raw);
        if (data.branches) branches = data.branches;
        if (data.users) users = data.users;
        if (data.alertThresholds) alertThresholds = data.alertThresholds;
        if (data.transactions) transactions = data.transactions;
        if (data.expenses) expenses = data.expenses;
        console.log(`[DB LOAD SUCCESS] Loaded SenteLedger dataset from "${DB_FILE}"`);
        return;
      }
    }
  } catch (err) {
    console.error("[DB LOAD FAILED] Error reading db.json, falling back to seed default configuration.", err);
  }

  // Fallback / First-run Setup: Initial Seed Data for SenteLedger in Uganda
  branches = [
    { id: 1, name: "Kampala Road Main Branch", location: "City Centre, Kampala", mtnFloat: 3500000, airtelFloat: 2800000, cashBalance: 4500000, baseMtnFloat: 3500000, baseAirtelFloat: 2800000, baseCashBalance: 4500000 },
    { id: 2, name: "Wandegeya Booth", location: "Near Makerere Main Gate", mtnFloat: 1200000, airtelFloat: 950000, cashBalance: 1800000, baseMtnFloat: 1200000, baseAirtelFloat: 950000, baseCashBalance: 1800000 },
    { id: 3, name: "Nakasero Market Kiosk", location: "Nakasero Hill", mtnFloat: 1800000, airtelFloat: 800000, cashBalance: 2200000, baseMtnFloat: 1800000, baseAirtelFloat: 800000, baseCashBalance: 2200000 }
  ];

  users = [
    { id: "1", name: "Trevor Muyinda", email: "muyindatrevor@gmail.com", role: "owner", password: "password123", branchId: 1, allowEditDelete: true },
    { id: "2", name: "Sarah Namubiru", email: "sarah@gmail.com", role: "agent", password: "password123", branchId: 2, allowEditDelete: false },
    { id: "3", name: "John Baptist K.", email: "john@gmail.com", role: "agent", password: "password123", branchId: 3, allowEditDelete: false },
    { id: "4", name: "Trevor Owner Alt", email: "trevor@gmail.com", role: "owner", password: "password123", branchId: 1, allowEditDelete: true }
  ];

  alertThresholds = {
    lowFloatLimit: 300000, // Alert if float falls below 300k UGX
    lowCashLimit: 400000   // Alert if cash falls below 400k UGX
  };

  transactions = [
    { id: 1, type: "deposit", provider: "MTN", amount: 200000, commission: 2800, customerPhone: "0772888999", customerName: "Emma Kato", date: now - 12 * oneDay, branchId: 1, agentName: "Trevor Muyinda", notes: "Successful deposit" },
    { id: 2, type: "withdrawal", provider: "Airtel", amount: 150000, commission: 2000, customerPhone: "0701555444", customerName: "Proscovia N.", date: now - 11 * oneDay, branchId: 1, agentName: "Trevor Muyinda", notes: "Customer withdrew cash" },
    { id: 3, type: "airtime", provider: "MTN", amount: 10000, commission: 500, customerPhone: "0782777666", customerName: "Musa Aliga", date: now - 10 * oneDay, branchId: 2, agentName: "Sarah Namubiru", notes: "Direct airtime load" },
    { id: 4, type: "deposit", provider: "MTN", amount: 500000, commission: 5200, customerPhone: "0774333222", customerName: "John Kakooza", date: now - 8 * oneDay, branchId: 1, agentName: "Trevor Muyinda", notes: "Big deposit" },
    { id: 5, type: "float_purchase", provider: "MTN", amount: 1000000, commission: 0, customerPhone: "", customerName: "MTN Distributor", date: now - 7 * oneDay, branchId: 2, agentName: "Sarah Namubiru", notes: "Bought float from runner" },
    { id: 6, type: "withdrawal", provider: "MTN", amount: 300000, commission: 5200, customerPhone: "0771444555", customerName: "Alice Birungi", date: now - 5 * oneDay, branchId: 2, agentName: "Sarah Namubiru", notes: "Cash withdrawal" },
    { id: 7, type: "transfer", provider: "Other", amount: 80000, commission: 1000, customerPhone: "0756333999", customerName: "David Ssewankambo", date: now - 3 * oneDay, branchId: 3, agentName: "John Baptist K.", notes: "Inter-bank cash transfer" },
    { id: 8, type: "airtime", provider: "Airtel", amount: 5000, commission: 250, customerPhone: "0702444111", customerName: "Grace Nakitende", date: now - 1 * oneDay, branchId: 3, agentName: "John Baptist K.", notes: "Airtime purchase" },
    { id: 9, type: "deposit", provider: "Airtel", amount: 100000, commission: 1200, customerPhone: "0708555999", customerName: "Ivan Ssemwanga", date: now - 6 * 60 * 60 * 1000, branchId: 1, agentName: "Trevor Muyinda", notes: "Morning deposit Airtel" },
    { id: 10, type: "withdrawal", provider: "MTN", amount: 250000, commission: 3200, customerPhone: "0775999111", customerName: "Doreen Namara", date: now - 2 * 60 * 60 * 1000, branchId: 1, agentName: "Trevor Muyinda", notes: "Salary cash withdrawal" }
  ];

  expenses = [
    { id: 1, category: "rent", amount: 250000, date: now - 13 * oneDay, branchId: 1, notes: "Rent for Kampala Road booth" },
    { id: 2, category: "transport", amount: 35000, date: now - 9 * oneDay, branchId: 2, notes: "Bodaboda transport to cash in bank" },
    { id: 3, category: "utilities", amount: 60000, date: now - 6 * oneDay, branchId: 1, notes: "Umeme power bill pre-paid tokens" },
    { id: 4, category: "salaries", amount: 150000, date: now - 2 * oneDay, branchId: 2, notes: "Weekly advance for Sarah agent" }
  ];

  saveToDisk();
}

// Load current data state
loadFromDisk();

// --- BACKEND BALANCES PROCESSOR ---
// Updates branch balances based on the current transaction list (re-sync action)
function recalculateBranchBalances() {
  // Re-apply base balances from each branch's own base fields
  branches = branches.map(b => {
    return {
      ...b,
      mtnFloat: (b as any).baseMtnFloat !== undefined ? (b as any).baseMtnFloat : b.mtnFloat,
      airtelFloat: (b as any).baseAirtelFloat !== undefined ? (b as any).baseAirtelFloat : b.airtelFloat,
      cashBalance: (b as any).baseCashBalance !== undefined ? (b as any).baseCashBalance : b.cashBalance
    };
  });

  // Apply transactions chronologically to build accurate final states
  const sortedTx = [...transactions].sort((a, b) => a.date - b.date);
  
  for (const tx of sortedTx) {
    const bIdx = branches.findIndex(b => b.id === tx.branchId);
    if (bIdx === -1) continue;

    const amt = tx.amount;
    
    if (tx.type === 'deposit') {
      // Deposit: Customer gives Cash to Agent, Agent transfers Float to Customer
      // Cash increases, float decreases
      branches[bIdx].cashBalance += amt;
      if (tx.provider === 'MTN') {
        branches[bIdx].mtnFloat -= amt;
      } else if (tx.provider === 'Airtel') {
        branches[bIdx].airtelFloat -= amt;
      }
    } else if (tx.type === 'withdrawal') {
      // Withdrawal: Customer transfers Float to Agent, Agent gives Cash to Customer
      // Cash decreases, float increases
      branches[bIdx].cashBalance -= amt;
      if (tx.provider === 'MTN') {
        branches[bIdx].mtnFloat += amt;
      } else if (tx.provider === 'Airtel') {
        branches[bIdx].airtelFloat += amt;
      }
    } else if (tx.type === 'airtime') {
      // Airtime: Customer buys airtime.
      // Customer pays cash, Agent deducts airtime from Float
      branches[bIdx].cashBalance += amt;
      if (tx.provider === 'MTN') {
        branches[bIdx].mtnFloat -= amt;
      } else if (tx.provider === 'Airtel') {
        branches[bIdx].airtelFloat -= amt;
      }
    } else if (tx.type === 'float_purchase') {
      // Float Purchase: Agent pays Cash to buy Float
      // Cash decreases, Float increases
      branches[bIdx].cashBalance -= amt;
      if (tx.provider === 'MTN') {
        branches[bIdx].mtnFloat += amt;
      } else if (tx.provider === 'Airtel') {
        branches[bIdx].airtelFloat += amt;
      }
    } else if (tx.type === 'transfer') {
      const asset = (tx as any).transferAsset || 'cash';
      
      // Decrement source branch
      if (asset === 'cash' || asset === 'cashBalance') {
        branches[bIdx].cashBalance -= amt;
      } else if (asset === 'mtnFloat') {
        branches[bIdx].mtnFloat -= amt;
      } else if (asset === 'airtelFloat') {
        branches[bIdx].airtelFloat -= amt;
      }

      // Increment target branch if present
      const targetId = (tx as any).targetBranchId;
      if (targetId) {
        const tIdx = branches.findIndex(b => b.id === targetId);
        if (tIdx !== -1) {
          if (asset === 'cash' || asset === 'cashBalance') {
            branches[tIdx].cashBalance += amt;
          } else if (asset === 'mtnFloat') {
            branches[tIdx].mtnFloat += amt;
          } else if (asset === 'airtelFloat') {
            branches[tIdx].airtelFloat += amt;
          }
        }
      }
    }
  }

  // Apply expenses chronologically to cash balances
  for (const exp of expenses) {
    const bIdx = branches.findIndex(b => b.id === exp.branchId);
    if (bIdx !== -1) {
      branches[bIdx].cashBalance -= exp.amount;
    }
  }
}

// Perform initial balance sync
recalculateBranchBalances();


// --- API ROUTING ---

// Authentication / Email & Password Login
app.post("/api/login", (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Please enter email and password" });
  }

  const user = users.find(u => u.email.trim().toLowerCase() === email.trim().toLowerCase() && u.password === password);
  if (!user) {
    return res.status(401).json({ error: "Invalid Mobile Money Agent email or password" });
  }

  const userBranch = branches.find(b => b.id === user.branchId);
  res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      branchId: user.branchId,
      allowEditDelete: user.allowEditDelete !== undefined ? !!user.allowEditDelete : (user.role === "owner")
    },
    branch: userBranch
  });
});

// Reset Password API (Forgot Password flow)
app.post("/api/reset-password", (req, res) => {
  const { email, newPassword, confirmNewPassword } = req.body;
  
  if (!email || !newPassword || !confirmNewPassword) {
    return res.status(400).json({ error: "Please fill in all fields to reset your password" });
  }

  if (newPassword !== confirmNewPassword) {
    return res.status(400).json({ error: "Passwords do not match" });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: "Security password must be at least 6 characters long for protection" });
  }

  const targetUsers = users.filter(u => u.email.trim().toLowerCase() === email.trim().toLowerCase());
  if (targetUsers.length === 0) {
    return res.status(404).json({ error: "No registered Mobile Money Agent found with this email address" });
  }

  targetUsers.forEach(user => {
    user.password = newPassword;
  });

  saveToDisk();
  console.log(`[PASSWORD RESET SUCCESS] Password successfully updated for agent email: ${email}`);
  res.json({ success: true, message: "Your security password has been reset successfully. Please log in with your new password." });
});

// Change Password API (when logged in)
app.post("/api/change-password", (req, res) => {
  const { email, currentPassword, newPassword } = req.body;

  if (!email || !currentPassword || !newPassword) {
    return res.status(400).json({ error: "Please fill in all password fields" });
  }

  const user = users.find(u => u.email.trim().toLowerCase() === email.trim().toLowerCase() && u.password === currentPassword);
  if (!user) {
    return res.status(401).json({ error: "Your current password is incorrect" });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: "New security password must be at least 6 characters long" });
  }

  const targetUsers = users.filter(u => u.email.trim().toLowerCase() === email.trim().toLowerCase());
  targetUsers.forEach(u => {
    u.password = newPassword;
  });

  saveToDisk();
  console.log(`[PASSWORD CHANGE SUCCESS] Password successfully changed for agent: ${email}`);
  res.json({ success: true, message: "Your security password has been updated successfully." });
});

// Users/Workers Management APIs
app.get("/api/users", (req, res) => {
  res.json(users);
});

app.post("/api/users", checkOwnerRole, (req, res) => {
  const { name, email, role, password, branchId, allowEditDelete } = req.body;

  if (!name || !email || !role || !password) {
    return res.status(400).json({ error: "Name, email, role, and password are required" });
  }

  const emailExists = users.some(u => u.email.trim().toLowerCase() === email.trim().toLowerCase());
  if (emailExists) {
    return res.status(400).json({ error: "An account with this email address already exists" });
  }

  const nextId = String(users.length > 0 ? Math.max(...users.map(u => parseInt(u.id) || 0)) + 1 : 1);
  const newUser = {
    id: nextId,
    name,
    email: email.trim().toLowerCase(),
    role,
    password,
    branchId: branchId ? parseInt(branchId) : 1,
    allowEditDelete: role === "owner" ? true : !!allowEditDelete
  };

  users.push(newUser);
  saveToDisk();

  console.log(`[USER CREATION SUCCESS] New user registered. ID: ${nextId}, Email: ${email}`);
  res.status(201).json(newUser);
});

app.put("/api/users/:id", checkOwnerRole, (req, res) => {
  const { id } = req.params;
  const { name, email, role, password, branchId, allowEditDelete } = req.body;

  const userIdx = users.findIndex(u => u.id === id);
  if (userIdx === -1) {
    return res.status(404).json({ error: "User not found" });
  }

  if (email) {
    const emailExists = users.some(u => u.id !== id && u.email.trim().toLowerCase() === email.trim().toLowerCase());
    if (emailExists) {
      return res.status(400).json({ error: "Another account with this email already exists" });
    }
    users[userIdx].email = email.trim().toLowerCase();
  }

  if (name) users[userIdx].name = name;
  if (role) users[userIdx].role = role;
  if (password) users[userIdx].password = password;
  if (branchId !== undefined) users[userIdx].branchId = parseInt(branchId);
  if (allowEditDelete !== undefined) {
    users[userIdx].allowEditDelete = users[userIdx].role === "owner" ? true : !!allowEditDelete;
  }

  saveToDisk();
  console.log(`[USER UPDATE SUCCESS] User updated. ID: ${id}`);
  res.json(users[userIdx]);
});

app.delete("/api/users/:id", checkOwnerRole, (req, res) => {
  const { id } = req.params;
  const userIdx = users.findIndex(u => u.id === id);
  if (userIdx === -1) {
    return res.status(404).json({ error: "User not found" });
  }

  const deletedUser = users[userIdx];
  users = users.filter(u => u.id !== id);
  saveToDisk();

  console.log(`[USER DELETION SUCCESS] User deleted. ID: ${id}, Email: ${deletedUser.email}`);
  res.json({ success: true, id });
});

// Branches
app.get("/api/branches", (req, res) => {
  res.json(branches);
});

app.post("/api/branches", checkOwnerRole, (req, res) => {
  const { name, location, mtnFloat, airtelFloat, cashBalance } = req.body;
  
  console.log(`[BRANCH CREATION STARTED] Request Payload:`, req.body);

  if (!name || !location) {
    console.error(`[BRANCH CREATION FAILED] Missing name or location description.`);
    return res.status(400).json({ error: "Name and location are required" });
  }

  // Prevent duplicate names to ensure atomic identity uniqueness
  const exists = branches.some(b => b.name.trim().toLowerCase() === name.trim().toLowerCase());
  if (exists) {
    console.warn(`[BRANCH CREATION FAILED] Duplicate branch name detected: "${name}"`);
    return res.status(400).json({ error: `A branch with the name "${name}" already exists.` });
  }

  const parseOrZero = (val: any) => {
    if (val === undefined || val === null || val === "") return 0;
    const parsed = parseFloat(val);
    return isNaN(parsed) ? 0 : parsed;
  };

  const finalMtn = parseOrZero(mtnFloat);
  const finalAirtel = parseOrZero(airtelFloat);
  const finalCash = parseOrZero(cashBalance);

  // Uniquely generate ID atomically by checking maximum existing ID
  const nextId = branches.length > 0 ? Math.max(...branches.map(b => b.id)) + 1 : 1;

  const newBranch = {
    id: nextId,
    name: name.trim(),
    location: location.trim(),
    mtnFloat: finalMtn,
    airtelFloat: finalAirtel,
    cashBalance: finalCash,
    baseMtnFloat: finalMtn,
    baseAirtelFloat: finalAirtel,
    baseCashBalance: finalCash
  };

  console.log(`[BRANCH CREATION SAVING] New Branch object initialized atomically:`, newBranch);

  branches.push(newBranch);
  recalculateBranchBalances();
  saveToDisk();

  console.log(`[BRANCH CREATION SUCCESSFUL] Branch Registered. ID: ${nextId}. Current branches count: ${branches.length}`);
  res.status(201).json(newBranch);
});

app.put("/api/branches/:id", checkOwnerRole, (req, res) => {
  const id = parseInt(req.params.id);
  const { name, location, mtnFloat, airtelFloat, cashBalance, isBaseUpdate } = req.body;
  
  console.log(`[BRANCH UPDATE STARTED] Target ID: ${id}, Payload:`, req.body);

  const idx = branches.findIndex(b => b.id === id);
  if (idx === -1) {
    console.error(`[BRANCH UPDATE FAILED] Branch ID ${id} not found.`);
    return res.status(404).json({ error: "Branch not found" });
  }

  // Check for duplicate names if changing name to something other than current name
  if (name && name.trim().toLowerCase() !== branches[idx].name.toLowerCase()) {
    const nameExists = branches.some(b => b.id !== id && b.name.trim().toLowerCase() === name.trim().toLowerCase());
    if (nameExists) {
      console.warn(`[BRANCH UPDATE FAILED] Name conflict with existing branch: "${name}"`);
      return res.status(400).json({ error: `Another branch with the name "${name}" already exists.` });
    }
  }

  const parseOrUndefined = (val: any) => {
    if (val === undefined || val === null || val === "") return undefined;
    const parsed = parseFloat(val);
    return isNaN(parsed) ? undefined : parsed;
  };

  const updatedMtnFloat = parseOrUndefined(mtnFloat);
  const updatedAirtelFloat = parseOrUndefined(airtelFloat);
  const updatedCashBalance = parseOrUndefined(cashBalance);

  const beforeBranch = { ...branches[idx] };

  branches[idx] = {
    ...branches[idx],
    name: name !== undefined ? name.trim() : branches[idx].name,
    location: location !== undefined ? location.trim() : branches[idx].location,
    mtnFloat: updatedMtnFloat !== undefined ? updatedMtnFloat : branches[idx].mtnFloat,
    airtelFloat: updatedAirtelFloat !== undefined ? updatedAirtelFloat : branches[idx].airtelFloat,
    cashBalance: updatedCashBalance !== undefined ? updatedCashBalance : branches[idx].cashBalance,
    baseMtnFloat: isBaseUpdate && updatedMtnFloat !== undefined ? updatedMtnFloat : (branches[idx] as any).baseMtnFloat,
    baseAirtelFloat: isBaseUpdate && updatedAirtelFloat !== undefined ? updatedAirtelFloat : (branches[idx] as any).baseAirtelFloat,
    baseCashBalance: isBaseUpdate && updatedCashBalance !== undefined ? updatedCashBalance : (branches[idx] as any).baseCashBalance
  };

  console.log(`[BRANCH UPDATE ATOMIC SPLIT]`, {
    before: {
      name: beforeBranch.name,
      baseMtn: (beforeBranch as any).baseMtnFloat,
      baseAirtel: (beforeBranch as any).baseAirtelFloat,
      baseCash: (beforeBranch as any).baseCashBalance
    },
    after: {
      name: branches[idx].name,
      baseMtn: (branches[idx] as any).baseMtnFloat,
      baseAirtel: (branches[idx] as any).baseAirtelFloat,
      baseCash: (branches[idx] as any).baseCashBalance
    }
  });

  recalculateBranchBalances();
  saveToDisk();
  console.log(`[BRANCH UPDATE SUCCESSFUL] Target ID: ${id}. Active calculated balances refreshed.`);
  res.json(branches[idx]);
});

app.delete("/api/branches/:id", checkOwnerRole, (req, res) => {
  const id = parseInt(req.params.id);
  console.log(`[BRANCH DELETION STARTED] Target ID: ${id}`);

  const initialCount = branches.length;
  branches = branches.filter(b => b.id !== id);

  if (branches.length === initialCount) {
    console.warn(`[BRANCH DELETION WARNING] Branch ID ${id} did not exist to delete.`);
  }

  const initialTxCount = transactions.length;
  transactions = transactions.filter(t => t.branchId !== id);
  
  const initialExpCount = expenses.length;
  expenses = expenses.filter(e => e.branchId !== id);

  console.log(`[BRANCH DELETION CLEANUP] Deleted branch ID ${id}. Pruned ${initialTxCount - transactions.length} transactions and ${initialExpCount - expenses.length} expenses.`);

  recalculateBranchBalances();
  saveToDisk();
  console.log(`[BRANCH DELETION SUCCESSFUL] Target ID: ${id}. Remaining branches count: ${branches.length}`);
  res.json({ success: true, id });
});

// Alert Thresholds API
app.get("/api/alert-thresholds", (req, res) => {
  res.json(alertThresholds);
});

app.post("/api/alert-thresholds", (req, res) => {
  const { lowFloatLimit, lowCashLimit } = req.body;
  if (lowFloatLimit !== undefined) alertThresholds.lowFloatLimit = parseFloat(lowFloatLimit);
  if (lowCashLimit !== undefined) alertThresholds.lowCashLimit = parseFloat(lowCashLimit);
  saveToDisk();
  res.json(alertThresholds);
});

// Transactions API
app.get("/api/transactions", (req, res) => {
  res.json(transactions);
});

app.post("/api/transactions", (req, res) => {
  const { type, provider, amount, commission, customerPhone, customerName, branchId, agentName, notes } = req.body;
  if (!type || !provider || amount === undefined || !branchId) {
    return res.status(400).json({ error: "Missing required transaction fields" });
  }

  const txAmount = parseFloat(amount);
  const calculatedComm = commission !== undefined ? parseFloat(commission) : calculateEstimatedCommission(type, provider, txAmount);

  const newTx = {
    id: transactions.length > 0 ? Math.max(...transactions.map(t => t.id)) + 1 : 1,
    type,
    provider,
    amount: txAmount,
    commission: calculatedComm,
    customerPhone: customerPhone || "",
    customerName: customerName || "General Customer",
    date: Date.now(),
    branchId: parseInt(branchId),
    agentName: agentName || "Agent Staff",
    notes: notes || ""
  };

  transactions.unshift(newTx); // Insert newest at the top
  recalculateBranchBalances();
  saveToDisk();
  res.status(201).json(newTx);
});

app.put("/api/transactions/:id", checkEditDeletePermission, (req, res) => {
  const id = parseInt(req.params.id);
  const { type, provider, amount, commission, customerPhone, customerName, branchId, notes } = req.body;

  const idx = transactions.findIndex(t => t.id === id);
  if (idx === -1) return res.status(404).json({ error: "Transaction not found" });

  transactions[idx] = {
    ...transactions[idx],
    type: type !== undefined ? type : transactions[idx].type,
    provider: provider !== undefined ? provider : transactions[idx].provider,
    amount: amount !== undefined ? parseFloat(amount) : transactions[idx].amount,
    commission: commission !== undefined ? parseFloat(commission) : transactions[idx].commission,
    customerPhone: customerPhone !== undefined ? customerPhone : transactions[idx].customerPhone,
    customerName: customerName !== undefined ? customerName : transactions[idx].customerName,
    branchId: branchId !== undefined ? parseInt(branchId) : transactions[idx].branchId,
    notes: notes !== undefined ? notes : transactions[idx].notes
  };

  recalculateBranchBalances();
  saveToDisk();
  res.json(transactions[idx]);
});

app.delete("/api/transactions/:id", checkEditDeletePermission, (req, res) => {
  const id = parseInt(req.params.id);
  transactions = transactions.filter(t => t.id !== id);
  recalculateBranchBalances();
  saveToDisk();
  res.json({ success: true, id });
});

// Expenses API
app.get("/api/expenses", (req, res) => {
  res.json(expenses);
});

app.post("/api/expenses", (req, res) => {
  const { category, amount, branchId, notes } = req.body;
  if (!category || amount === undefined || !branchId) {
    return res.status(400).json({ error: "Missing required expense fields" });
  }

  const newExpense = {
    id: expenses.length > 0 ? Math.max(...expenses.map(e => e.id)) + 1 : 1,
    category,
    amount: parseFloat(amount),
    date: Date.now(),
    branchId: parseInt(branchId),
    notes: notes || ""
  };

  expenses.unshift(newExpense);
  recalculateBranchBalances();
  saveToDisk();
  res.status(201).json(newExpense);
});

app.delete("/api/expenses/:id", checkEditDeletePermission, (req, res) => {
  const id = parseInt(req.params.id);
  expenses = expenses.filter(e => e.id !== id);
  recalculateBranchBalances();
  saveToDisk();
  res.json({ success: true, id });
});

app.put("/api/expenses/:id", checkEditDeletePermission, (req, res) => {
  const id = parseInt(req.params.id);
  const { category, amount, branchId, notes } = req.body;

  const idx = expenses.findIndex(e => e.id === id);
  if (idx === -1) return res.status(404).json({ error: "Expense not found" });

  expenses[idx] = {
    ...expenses[idx],
    category: category !== undefined ? category : expenses[idx].category,
    amount: amount !== undefined ? parseFloat(amount) : expenses[idx].amount,
    branchId: branchId !== undefined ? parseInt(branchId) : expenses[idx].branchId,
    notes: notes !== undefined ? notes : expenses[idx].notes
  };

  recalculateBranchBalances();
  saveToDisk();
  res.json(expenses[idx]);
});

// Profit & Loss and Dashboard Stats API
app.get("/api/reports", (req, res) => {
  const now = Date.now();
  const startOfDay = new Date().setHours(0,0,0,0);
  const startOfWeek = now - 7 * 24 * 60 * 60 * 1000;
  const startOfMonth = now - 30 * 24 * 60 * 60 * 1000;

  // Filter helper functions
  const isToday = (d: number) => d >= startOfDay;
  const isThisWeek = (d: number) => d >= startOfWeek;
  const isThisMonth = (d: number) => d >= startOfMonth;

  // Total sums
  const totalCash = branches.reduce((sum, b) => sum + b.cashBalance, 0);
  const totalMtnFloat = branches.reduce((sum, b) => sum + b.mtnFloat, 0);
  const totalAirtelFloat = branches.reduce((sum, b) => sum + b.airtelFloat, 0);

  // Transactions total volume (excluding float purchases to keep customer flow volume clear)
  const volumeTotal = transactions
    .filter(t => t.type !== 'float_purchase')
    .reduce((sum, t) => sum + t.amount, 0);

  // Commission income calculation
  const dailyComm = transactions.filter(t => isToday(t.date)).reduce((sum, t) => sum + t.commission, 0);
  const weeklyComm = transactions.filter(t => isThisWeek(t.date)).reduce((sum, t) => sum + t.commission, 0);
  const monthlyComm = transactions.filter(t => isThisMonth(t.date)).reduce((sum, t) => sum + t.commission, 0);

  // Expenses totals
  const dailyExpenses = expenses.filter(e => isToday(e.date)).reduce((sum, e) => sum + e.amount, 0);
  const weeklyExpenses = expenses.filter(e => isThisWeek(e.date)).reduce((sum, e) => sum + e.amount, 0);
  const monthlyExpenses = expenses.filter(e => isThisMonth(e.date)).reduce((sum, e) => sum + e.amount, 0);

  // Profit / Loss (Commissions minus Expenses)
  const dailyProfit = dailyComm - dailyExpenses;
  const weeklyProfit = weeklyComm - weeklyExpenses;
  const monthlyProfit = monthlyComm - monthlyExpenses;

  // Branch performance metrics
  const branchPerformance = branches.map(b => {
    const branchTx = transactions.filter(t => t.branchId === b.id);
    const branchExp = expenses.filter(e => e.branchId === b.id);

    const totalTxVal = branchTx.filter(t => t.type !== 'float_purchase').reduce((sum, t) => sum + t.amount, 0);
    const totalComm = branchTx.reduce((sum, t) => sum + t.commission, 0);
    const totalExpVal = branchExp.reduce((sum, e) => sum + e.amount, 0);

    return {
      branchId: b.id,
      branchName: b.name,
      mtnFloat: b.mtnFloat,
      airtelFloat: b.airtelFloat,
      cashBalance: b.cashBalance,
      volume: totalTxVal,
      commissions: totalComm,
      expenses: totalExpVal,
      netProfit: totalComm - totalExpVal
    };
  });

  // Expense breakdown by categories
  const categories: Record<string, number> = { rent: 0, transport: 0, salaries: 0, utilities: 0, tax: 0, other: 0 };
  expenses.forEach(e => {
    if (categories[e.category] !== undefined) {
      categories[e.category] += e.amount;
    } else {
      categories.other += e.amount;
    }
  });

  // Daily Trend Data for Recharts (past 7 days)
  const daysTrend = Array.from({ length: 7 }, (_, i) => {
    const targetDay = new Date(now - i * oneDay);
    const dateStr = targetDay.toLocaleDateString('en-UG', { weekday: 'short', month: 'short', day: 'numeric' });
    const targetStart = new Date(now - i * oneDay).setHours(0,0,0,0);
    const targetEnd = targetStart + oneDay;

    const dayTx = transactions.filter(t => t.date >= targetStart && t.date < targetEnd);
    const dayExp = expenses.filter(e => e.date >= targetStart && e.date < targetEnd);

    const dayComm = dayTx.reduce((sum, t) => sum + t.commission, 0);
    const dayExpAmt = dayExp.reduce((sum, e) => sum + e.amount, 0);

    return {
      name: dateStr,
      Commissions: dayComm,
      Expenses: dayExpAmt,
      Profit: dayComm - dayExpAmt
    };
  }).reverse();

  res.json({
    totals: {
      cashInHand: totalCash,
      mtnFloat: totalMtnFloat,
      airtelFloat: totalAirtelFloat,
      volumeTotal,
      lowFloatAlert: (totalMtnFloat < alertThresholds.lowFloatLimit) || (totalAirtelFloat < alertThresholds.lowFloatLimit),
      lowCashAlert: totalCash < alertThresholds.lowCashLimit
    },
    profit: {
      daily: dailyProfit,
      weekly: weeklyProfit,
      monthly: monthlyProfit,
      dailyComm,
      weeklyComm,
      monthlyComm,
      dailyExp: dailyExpenses,
      weeklyExp: weeklyExpenses,
      monthlyExp: monthlyExpenses
    },
    branchPerformance,
    expenseBreakdown: Object.keys(categories).map(k => ({ name: k.charAt(0).toUpperCase() + k.slice(1), value: categories[k] })),
    daysTrend
  });
});

// Auto-suggest Ugandan standard commission tier
app.get("/api/suggest-commission", (req, res) => {
  const { type, provider, amount } = req.query;
  if (!type || !amount) {
    return res.status(400).json({ error: "Type and amount are required" });
  }
  const comm = calculateEstimatedCommission(type as string, (provider as string) || "MTN", parseFloat(amount as string));
  res.json({ commission: comm });
});

// --- UGANDA MOBILE MONEY AI FINANCIAL ADVISOR ---
app.post("/api/advisor", async (req, res) => {
  const { history } = req.body;
  if (!history || !Array.isArray(history)) {
    return res.status(400).json({ error: "Missing or invalid chat history" });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.json({
        text: "Jambo! I am ready to advise you as your Mobile Money Expert! However, **GEMINI_API_KEY** is not set up in Platform Secrets yet. Please add it in **Settings > Secrets** so I can analyze your branches, floats, and daily UGX commissions!"
      });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });

    // Provide rich local Uganda business context
    const totalCash = branches.reduce((sum, b) => sum + b.cashBalance, 0);
    const totalMtnFloat = branches.reduce((sum, b) => sum + b.mtnFloat, 0);
    const totalAirtelFloat = branches.reduce((sum, b) => sum + b.airtelFloat, 0);
    const totalCommissions = transactions.reduce((sum, t) => sum + t.commission, 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
    
    const contextPrompt = `You are "SenteAdvisor", an expert Mobile Money Business Coach and Auditor in Uganda. 
You are speaking to Trevor Muyinda, a mobile money agent owner in Kampala managing branches like Wandegeya and Kampala Road.
The business runs MTN Mobile Money, Airtel Money, and deals with UGX (Ugandan Shillings).

Current Business Ledger Status:
- Total Cash in Hand: UGX ${totalCash.toLocaleString('en-UG')}
- MTN Float: UGX ${totalMtnFloat.toLocaleString('en-UG')}
- Airtel Float: UGX ${totalAirtelFloat.toLocaleString('en-UG')}
- Cumulative Agent Commissions: UGX ${totalCommissions.toLocaleString('en-UG')}
- Total Expenses Logged: UGX ${totalExpenses.toLocaleString('en-UG')}
- Active Branches: ${branches.map(b => `${b.name} (${b.location})`).join(", ")}

Give practical, highly actionable local guidance. Focus on:
1. Float and Cash balancing: MTN and Airtel floats must not run dry. Advise on when to rebalance (e.g. going to a super-agent or commercial bank like Stanbic, Centenary, or DFCU).
2. Commission maximization: Help agents understand which tiers have the highest profit margins (e.g., advising clients on split transactions where compliant, or pushing airtime/Yaka/Water payments).
3. Security and fraud warnings: Speak specifically about Ugandan mobile money scams, such as "Kamula" fake text alerts, SIM swap fraud, runners swapping lines, and direct distraction. Use local business tone, very professional yet warm. Keep answers reasonably concise, structured, and use Markdown.`;

    const contents = history.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text }]
    }));

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents,
      config: {
        systemInstruction: contextPrompt,
        temperature: 0.6
      }
    });

    res.json({ text: response.text || "Webacale nnyo. I couldn't generate advice right now. Please try again." });
  } catch (err: any) {
    console.error("Gemini Agent API error:", err);
    res.status(500).json({ error: "Failed to consult SenteAdvisor." });
  }
});

// --- VITE MIDDLEWARE AND STATIC SERVING ---
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Mobile Money Server running on port ${PORT}`);
  });
}

startServer();
