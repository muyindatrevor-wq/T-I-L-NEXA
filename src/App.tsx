import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Wallet, Landmark, ArrowDownLeft, ArrowUpRight, PlusCircle, Search, LogOut,
  AlertTriangle, Bell, Info, Shield, Trash2, Printer, Download, MapPin,
  ChevronRight, RefreshCw, MessageSquare, Send, Building, BarChart3, Receipt, Settings,
  Edit, Lock, Key, Users
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend
} from "recharts";
import { User, Branch, Transaction, Expense, AlertThresholds, AdvisorMessage } from "./types";

// Helper for formatting Ugandan Shilling
const formatUGX = (num: number) => {
  return "UGX " + Math.round(num).toLocaleString("en-UG");
};

export default function App() {
  // Authentication State
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem("sente_user");
    return saved ? JSON.parse(saved) : null;
  });
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [authError, setAuthError] = useState("");

  // Password Reset / Forgot Password States (Login Screen)
  const [isResetMode, setIsResetMode] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetNewPassword, setResetNewPassword] = useState("");
  const [resetConfirmPassword, setResetConfirmPassword] = useState("");
  const [resetSuccessMessage, setResetSuccessMessage] = useState("");
  const [resetErrorMessage, setResetErrorMessage] = useState("");

  // Change Password States (Logged In Modal)
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [changeCurrentPassword, setChangeCurrentPassword] = useState("");
  const [changeNewPassword, setChangeNewPassword] = useState("");
  const [changeConfirmPassword, setChangeConfirmPassword] = useState("");
  const [changeSuccessMessage, setChangeSuccessMessage] = useState("");
  const [changeErrorMessage, setChangeErrorMessage] = useState("");

  // Editing States
  const [editingTxId, setEditingTxId] = useState<number | null>(null);
  const [editingExpenseId, setEditingExpenseId] = useState<number | null>(null);
  const [editingBranchId, setEditingBranchId] = useState<number | null>(null);

  // Core Ledger State
  const [branches, setBranches] = useState<Branch[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [activeBranchId, setActiveBranchId] = useState<number>(1);
  const [loading, setLoading] = useState(false);

  // App Navigation / Views
  const [activeTab, setActiveTab] = useState<"dashboard" | "transactions" | "expenses" | "branches" | "workers" | "reports" | "advisor">("dashboard");

  // Workers / Users States
  const [workers, setWorkers] = useState<User[]>([]);
  const [showWorkerModal, setShowWorkerModal] = useState(false);
  const [editingWorkerId, setEditingWorkerId] = useState<string | null>(null);
  const [workerForm, setWorkerForm] = useState({
    name: "",
    email: "",
    role: "agent" as 'owner' | 'agent' | 'admin',
    password: "",
    branchId: "",
    allowEditDelete: false
  });
  const [workerError, setWorkerError] = useState("");

  // Notifications State
  const [notifications, setNotifications] = useState<string[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [thresholds, setThresholds] = useState<AlertThresholds>({ lowFloatLimit: 300000, lowCashLimit: 400000 });

  // Modals & Form States
  const [showTxModal, setShowTxModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: "transaction" | "expense" | "branch" | "worker" | null;
    id: number | string | null;
    title: string;
    message: string;
  }>({ type: null, id: null, title: "", message: "" });

  const [txForm, setTxForm] = useState({
    type: "deposit" as any,
    provider: "MTN" as any,
    amount: "",
    commission: "",
    customerPhone: "",
    customerName: "",
    notes: ""
  });
  const [isCommissionManuallyEdited, setIsCommissionManuallyEdited] = useState(false);

  const [expenseForm, setExpenseForm] = useState({
    category: "rent" as any,
    amount: "",
    notes: ""
  });

  const [branchForm, setBranchForm] = useState({
    name: "",
    location: "",
    mtnFloat: "",
    airtelFloat: "",
    cashBalance: ""
  });

  const [transferForm, setTransferForm] = useState({
    sourceBranchId: "",
    targetBranchId: "",
    type: "cash" as "cash" | "mtnFloat" | "airtelFloat",
    amount: ""
  });

  // Report Dates & Chart Data
  const [reportStats, setReportStats] = useState<any>(null);

  // AI Advisor Chat State
  const [chatMessages, setChatMessages] = useState<AdvisorMessage[]>([
    { role: "model", text: "Jambo! I am SenteAdvisor, your Uganda Mobile Money coach. Ask me about cash/float balancing, MTN/Airtel commission tiers, or how to avoid common 'Kamula' fake SMS agent scams!", timestamp: Date.now() }
  ]);
  const [chatInput, setChatInput] = useState("");
  const [advisorLoading, setAdvisorLoading] = useState(false);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [providerFilter, setProviderFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  // Load All Core Data
  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [bRes, tRes, eRes, rRes, thRes, uRes] = await Promise.all([
        fetch("/api/branches").then(res => res.json()),
        fetch("/api/transactions").then(res => res.json()),
        fetch("/api/expenses").then(res => res.json()),
        fetch("/api/reports").then(res => res.json()),
        fetch("/api/alert-thresholds").then(res => res.json()),
        fetch("/api/users").then(res => res.json()).catch(() => [])
      ]);

      setBranches(bRes);
      if (bRes && bRes.length > 0) {
        const hasActive = bRes.some((b: any) => b.id === activeBranchId);
        if (!hasActive) {
          setActiveBranchId(bRes[0].id);
        }
      }
      setTransactions(tRes);
      setExpenses(eRes);
      setReportStats(rRes);
      setThresholds(thRes);
      setWorkers(uRes || []);

      // Process warnings & alerts
      const alerts: string[] = [];
      bRes.forEach((b: Branch) => {
        if (b.mtnFloat < thRes.lowFloatLimit) {
          alerts.push(`Low MTN Float: ${b.name} has only ${formatUGX(b.mtnFloat)}`);
        }
        if (b.airtelFloat < thRes.lowFloatLimit) {
          alerts.push(`Low Airtel Float: ${b.name} has only ${formatUGX(b.airtelFloat)}`);
        }
        if (b.cashBalance < thRes.lowCashLimit) {
          alerts.push(`Low Cash Balance: ${b.name} is down to ${formatUGX(b.cashBalance)}`);
        }
      });
      setNotifications(alerts);
    } catch (err) {
      console.error("Error loading ledger data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchAllData();
    }
  }, [currentUser]);

  // Login Handler
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPassword })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login Failed");

      localStorage.setItem("sente_user", JSON.stringify(data.user));
      setCurrentUser(data.user);
      setActiveBranchId(data.user.branchId);
    } catch (err: any) {
      setAuthError(err.message);
    }
  };

  // Password Reset Handler
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetErrorMessage("");
    setResetSuccessMessage("");

    if (resetNewPassword !== resetConfirmPassword) {
      setResetErrorMessage("New passwords do not match");
      return;
    }

    try {
      const res = await fetch("/api/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: resetEmail,
          newPassword: resetNewPassword,
          confirmNewPassword: resetConfirmPassword
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Reset password failed");

      setResetSuccessMessage(data.message);
      setResetEmail("");
      setResetNewPassword("");
      setResetConfirmPassword("");
    } catch (err: any) {
      setResetErrorMessage(err.message);
    }
  };

  // Change Password Handler (for logged-in user)
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangeErrorMessage("");
    setChangeSuccessMessage("");

    if (!currentUser) return;

    if (changeNewPassword !== changeConfirmPassword) {
      setChangeErrorMessage("New passwords do not match");
      return;
    }

    try {
      const res = await fetch("/api/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: currentUser.email,
          currentPassword: changeCurrentPassword,
          newPassword: changeNewPassword
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to change password");

      setChangeSuccessMessage(data.message);
      setChangeCurrentPassword("");
      setChangeNewPassword("");
      setChangeConfirmPassword("");
    } catch (err: any) {
      setChangeErrorMessage(err.message);
    }
  };

  // Logout Handler
  const handleLogout = () => {
    localStorage.removeItem("sente_user");
    setCurrentUser(null);
  };

  // Automatically sync manual edit state when the modal is opened or closed
  useEffect(() => {
    if (showTxModal) {
      if (editingTxId === null) {
        setIsCommissionManuallyEdited(false);
      } else {
        setIsCommissionManuallyEdited(true);
      }
    }
  }, [showTxModal, editingTxId]);

  // Transaction Autofill Commission - Instant Client-side Tiered Calculation
  useEffect(() => {
    if (isCommissionManuallyEdited) return;

    const amt = parseFloat(txForm.amount);
    if (!isNaN(amt) && amt > 0) {
      let comm = 0;
      if (txForm.type === 'airtime') {
        comm = Math.round(amt * 0.05);
      } else if (txForm.type === 'transfer') {
        comm = 1000;
      } else if (txForm.type === 'float_purchase') {
        comm = 0;
      } else {
        // deposit or withdrawal standard tiers
        if (amt <= 5000) comm = 150;
        else if (amt <= 10000) comm = 280;
        else if (amt <= 30000) comm = 450;
        else if (amt <= 60000) comm = 800;
        else if (amt <= 100000) comm = 1200;
        else if (amt <= 250000) comm = 3200;
        else if (amt <= 500000) comm = 5200;
        else if (amt <= 1000000) comm = 8500;
        else comm = 12000;
      }
      setTxForm(prev => ({ ...prev, commission: comm.toString() }));
    } else {
      setTxForm(prev => ({ ...prev, commission: "" }));
    }
  }, [txForm.amount, txForm.type, txForm.provider, isCommissionManuallyEdited]);

  // Submit Transaction
  const handleTxSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...txForm,
        amount: parseFloat(txForm.amount),
        commission: txForm.commission ? parseFloat(txForm.commission) : undefined,
        branchId: activeBranchId,
        agentName: currentUser?.name
      };

      const isEdit = editingTxId !== null;
      if (isEdit && currentUser?.role !== "owner" && !currentUser?.allowEditDelete) {
        alert("Access Denied: You do not have permission to edit records. Please contact the business owner.");
        return;
      }
      const url = isEdit ? `/api/transactions/${editingTxId}` : "/api/transactions";
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { 
          "Content-Type": "application/json",
          "x-user-role": currentUser?.role || "",
          "x-user-id": currentUser?.id || ""
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setShowTxModal(false);
        setEditingTxId(null);
        setTxForm({
          type: "deposit", provider: "MTN", amount: "", commission: "",
          customerPhone: "", customerName: "", notes: ""
        });
        setIsCommissionManuallyEdited(false);
        fetchAllData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Submit Expense
  const handleExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const isEdit = editingExpenseId !== null;
      if (isEdit && currentUser?.role !== "owner" && !currentUser?.allowEditDelete) {
        alert("Access Denied: You do not have permission to edit records. Please contact the business owner.");
        return;
      }
      const url = isEdit ? `/api/expenses/${editingExpenseId}` : "/api/expenses";
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { 
          "Content-Type": "application/json",
          "x-user-role": currentUser?.role || "",
          "x-user-id": currentUser?.id || ""
        },
        body: JSON.stringify({
          ...expenseForm,
          amount: parseFloat(expenseForm.amount),
          branchId: activeBranchId
        })
      });

      if (res.ok) {
        setShowExpenseModal(false);
        setEditingExpenseId(null);
        setExpenseForm({ category: "rent", amount: "", notes: "" });
        fetchAllData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Create Branch
  const handleBranchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentUser?.role !== "owner") {
      alert("Access Denied: Only the owner is allowed to create or modify branches.");
      return;
    }
    try {
      const isEdit = editingBranchId !== null;
      const url = isEdit ? `/api/branches/${editingBranchId}` : "/api/branches";
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { 
          "Content-Type": "application/json",
          "x-user-role": currentUser?.role || ""
        },
        body: JSON.stringify({
          name: branchForm.name,
          location: branchForm.location,
          mtnFloat: branchForm.mtnFloat ? parseFloat(branchForm.mtnFloat) : 0,
          airtelFloat: branchForm.airtelFloat ? parseFloat(branchForm.airtelFloat) : 0,
          cashBalance: branchForm.cashBalance ? parseFloat(branchForm.cashBalance) : 0,
          isBaseUpdate: true
        })
      });

      if (res.ok) {
        setShowBranchModal(false);
        setEditingBranchId(null);
        setBranchForm({ name: "", location: "", mtnFloat: "", airtelFloat: "", cashBalance: "" });
        fetchAllData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Submit Worker
  const handleWorkerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setWorkerError("");
    if (currentUser?.role !== "owner") {
      setWorkerError("Access Denied: Only the owner can manage worker accounts.");
      return;
    }
    try {
      const isEdit = editingWorkerId !== null;
      const url = isEdit ? `/api/users/${editingWorkerId}` : "/api/users";
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { 
          "Content-Type": "application/json",
          "x-user-role": currentUser?.role || ""
        },
        body: JSON.stringify({
          name: workerForm.name,
          email: workerForm.email,
          role: workerForm.role,
          password: workerForm.password,
          branchId: workerForm.branchId ? parseInt(workerForm.branchId) : 1,
          allowEditDelete: workerForm.allowEditDelete
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save worker account");
      }

      setShowWorkerModal(false);
      setEditingWorkerId(null);
      setWorkerForm({ name: "", email: "", role: "agent", password: "", branchId: "" });
      fetchAllData();
    } catch (err: any) {
      console.error(err);
      setWorkerError(err.message);
    }
  };

  // Branch Transfer / Balancing
  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentUser?.role !== "owner") {
      alert("Access Denied: Only the owner is allowed to rebalance float between branches.");
      return;
    }
    try {
      const amt = parseFloat(transferForm.amount);
      const srcId = parseInt(transferForm.sourceBranchId);
      const tgtId = parseInt(transferForm.targetBranchId);
      const asset = transferForm.type;

      // Decrement source branch
      const srcBranch = branches.find(b => b.id === srcId);
      const tgtBranch = branches.find(b => b.id === tgtId);

      if (srcBranch && tgtBranch) {
        const updatedSrc = { ...srcBranch, [asset]: Math.max(0, (srcBranch as any)[asset] - amt) };
        const updatedTgt = { ...tgtBranch, [asset]: ((tgtBranch as any)[asset] || 0) + amt };

        await fetch(`/api/branches/${srcId}`, {
          method: "PUT",
          headers: { 
            "Content-Type": "application/json",
            "x-user-role": currentUser?.role || ""
          },
          body: JSON.stringify(updatedSrc)
        });

        await fetch(`/api/branches/${tgtId}`, {
          method: "PUT",
          headers: { 
            "Content-Type": "application/json",
            "x-user-role": currentUser?.role || ""
          },
          body: JSON.stringify(updatedTgt)
        });

        // Record a transaction for audit
        await fetch("/api/transactions", {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "x-user-role": currentUser?.role || ""
          },
          body: JSON.stringify({
            type: "transfer",
            provider: "Other",
            amount: amt,
            commission: 0,
            customerName: `Rebalance to ${tgtBranch.name}`,
            customerPhone: "",
            branchId: srcId,
            targetBranchId: tgtId,
            transferAsset: asset,
            agentName: currentUser?.name,
            notes: `Float/Cash shifted to branch ${tgtBranch.name}`
          })
        });

        setShowTransferModal(false);
        setTransferForm({ sourceBranchId: "", targetBranchId: "", type: "cash", amount: "" });
        fetchAllData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Delete Transaction
  const handleTxDelete = (id: number) => {
    setDeleteConfirm({
      type: "transaction",
      id,
      title: "Delete Transaction",
      message: "Are you sure you want to delete this transaction? Balance changes will be reverted."
    });
  };

  // Delete Expense
  const handleExpenseDelete = (id: number) => {
    setDeleteConfirm({
      type: "expense",
      id,
      title: "Delete Expense",
      message: "Are you sure you want to delete this expense? Balance changes will be reverted."
    });
  };

  // Delete Branch
  const handleBranchDelete = (id: number) => {
    setDeleteConfirm({
      type: "branch",
      id,
      title: "Delete Branch Outlet",
      message: "Are you sure you want to delete this branch? All transactions and expenses associated with this branch will be permanently deleted."
    });
  };

  // Delete Worker
  const handleWorkerDelete = (id: string, name: string) => {
    setDeleteConfirm({
      type: "worker",
      id,
      title: "Remove Worker / Agent",
      message: `Are you sure you want to delete the worker account for "${name}"? This agent will no longer be able to log in.`
    });
  };

  // Execute actual deletion after confirmation
  const executeDelete = async () => {
    const { type, id } = deleteConfirm;
    if (id === null || type === null) return;

    const isRecordDelete = type === "transaction" || type === "expense";
    const hasPermission = currentUser?.role === "owner" || (isRecordDelete && currentUser?.allowEditDelete);

    if (!hasPermission) {
      alert("Access Denied: You do not have permission to delete this.");
      setDeleteConfirm({ type: null, id: null, title: "", message: "" });
      return;
    }

    try {
      if (type === "transaction") {
        const res = await fetch(`/api/transactions/${id}`, { 
          method: "DELETE",
          headers: { 
            "x-user-role": currentUser?.role || "",
            "x-user-id": currentUser?.id || ""
          }
        });
        if (res.ok) fetchAllData();
      } else if (type === "expense") {
        const res = await fetch(`/api/expenses/${id}`, { 
          method: "DELETE",
          headers: { 
            "x-user-role": currentUser?.role || "",
            "x-user-id": currentUser?.id || ""
          }
        });
        if (res.ok) fetchAllData();
      } else if (type === "branch") {
        const res = await fetch(`/api/branches/${id}`, { 
          method: "DELETE",
          headers: { "x-user-role": currentUser?.role || "" }
        });
        if (res.ok) {
          // If the deleted branch was the active branch, switch to another available one
          if (activeBranchId === id) {
            const remaining = branches.filter(b => b.id !== id);
            if (remaining.length > 0) {
              setActiveBranchId(remaining[0].id);
            } else {
              setActiveBranchId(null as any);
            }
          }
          fetchAllData();
        }
      } else if (type === "worker") {
        const res = await fetch(`/api/users/${id}`, { 
          method: "DELETE",
          headers: { "x-user-role": currentUser?.role || "" }
        });
        if (res.ok) fetchAllData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDeleteConfirm({ type: null, id: null, title: "", message: "" });
    }
  };

  // Ask Advisor AI
  const handleAskAdvisor = async (textToSend?: string) => {
    const query = textToSend || chatInput;
    if (!query.trim()) return;

    const userMsg: AdvisorMessage = { role: "user", text: query, timestamp: Date.now() };
    const updatedHistory = [...chatMessages, userMsg];
    setChatMessages(updatedHistory);
    setChatInput("");
    setAdvisorLoading(true);

    try {
      const res = await fetch("/api/advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ history: updatedHistory })
      });
      const data = await res.json();
      setChatMessages(prev => [...prev, { role: "model", text: data.text, timestamp: Date.now() }]);
    } catch (err) {
      console.error(err);
    } finally {
      setAdvisorLoading(false);
    }
  };

  // Export reports to Excel (CSV)
  const handleExportCSV = () => {
    let csv = "ID,Type,Provider,Amount,Commission,Customer Name,Customer Phone,Agent Name,Date,Notes\n";
    transactions.forEach(t => {
      csv += `${t.id},${t.type},${t.provider},${t.amount},${t.commission},"${t.customerName}",${t.customerPhone},"${t.agentName}",${new Date(t.date).toLocaleString('en-UG')},"${t.notes}"\n`;
    });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `SenteLedger_Report_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print P&L Sheet
  const handlePrintReport = () => {
    window.print();
  };

  // Active branch details
  const activeBranch = branches.find(b => b.id === activeBranchId);

  // Filters
  const filteredTransactions = transactions.filter(t => {
    const matchesSearch = t.customerPhone.includes(searchQuery) ||
      t.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.notes.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesProvider = providerFilter === "all" || t.provider === providerFilter;
    const matchesType = typeFilter === "all" || t.type === typeFilter;
    const matchesBranch = currentUser?.role === "owner" ? t.branchId === activeBranchId : true;
    return matchesSearch && matchesProvider && matchesType && matchesBranch;
  });

  // Login View
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4" style={{ fontFamily: "Inter, sans-serif" }}>
        <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-800">
          <div className="p-8 bg-blue-600 text-white text-center relative">
            <div className="absolute top-4 right-4 flex items-center gap-1 bg-white/20 px-2 py-0.5 rounded-full text-[10px] font-bold">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              <span className="w-2 h-2 rounded-full bg-yellow-500" />
              <span className="w-2 h-2 rounded-full bg-green-500" />
              UG
            </div>
            <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-white/20">
              <Building className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-black tracking-tight font-display">SenteLedger 🇺🇬</h1>
            <p className="text-xs text-blue-100 mt-1">Mobile Money & Cash Management System</p>
          </div>

          {!isResetMode ? (
            <form onSubmit={handleLogin} className="p-8 space-y-5">
              {authError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded-xl flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{authError}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Agent Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. trevor@gmail.com"
                  value={loginEmail}
                  onChange={e => setLoginEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Security Password</label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsResetMode(true);
                      setResetErrorMessage("");
                      setResetSuccessMessage("");
                    }}
                    className="text-[10px] text-blue-600 hover:text-blue-800 font-bold uppercase tracking-wider focus:outline-none cursor-pointer"
                  >
                    Forgot / Reset?
                  </button>
                </div>
                <input
                  type="password"
                  required
                  placeholder="Enter password"
                  value={loginPassword}
                  onChange={e => setLoginPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 text-xs font-bold rounded-xl shadow-lg shadow-blue-500/10 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Shield className="w-4 h-4" />
                Secure Agent Login
              </button>

              <div className="pt-4 border-t border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Demo Credentials</span>
                <div className="space-y-1 text-[11px] text-slate-500">
                  <p>• <strong>Owner:</strong> trevor@gmail.com (password: password123)</p>
                  <p>• <strong>Wandegeya Booth:</strong> sarah@gmail.com (password: password123)</p>
                  <p>• <strong>Nakasero Agent:</strong> john@gmail.com (password: password123)</p>
                </div>
              </div>
            </form>
          ) : (
            <form onSubmit={handleResetPassword} className="p-8 space-y-5">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <Key className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Reset Agent Password</span>
              </div>

              {resetErrorMessage && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded-xl flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{resetErrorMessage}</span>
                </div>
              )}

              {resetSuccessMessage && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs p-3 rounded-xl flex items-center gap-2">
                  <Shield className="w-4 h-4 shrink-0" />
                  <span>{resetSuccessMessage}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Your Registered Email</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. trevor@gmail.com"
                  value={resetEmail}
                  onChange={e => setResetEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">New Security Password</label>
                <input
                  type="password"
                  required
                  placeholder="Minimum 6 characters"
                  value={resetNewPassword}
                  onChange={e => setResetNewPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Confirm New Password</label>
                <input
                  type="password"
                  required
                  placeholder="Repeat new password"
                  value={resetConfirmPassword}
                  onChange={e => setResetConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 text-xs font-bold rounded-xl shadow-lg shadow-blue-500/10 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Lock className="w-4 h-4" />
                Reset & Authorize Password
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsResetMode(false);
                  setResetErrorMessage("");
                  setResetSuccessMessage("");
                }}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 text-xs font-bold rounded-xl transition-all block text-center cursor-pointer"
              >
                Back to Login
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // Loaded Application
  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC]" style={{ fontFamily: "Inter, sans-serif" }}>
      
      {/* HEADER SECTION */}
      <header className="bg-slate-900 text-white shrink-0 shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between flex-wrap gap-3">
          
          {/* Logo & Agent details */}
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 text-white rounded-xl">
              <Building className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold tracking-tight font-display text-lg">SenteLedger</span>
                <span className="bg-yellow-400 text-slate-900 text-[9px] font-black px-1.5 py-0.5 rounded-full">UGANDA</span>
              </div>
              <p className="text-[10px] text-slate-400">
                Logged: <span className="text-white font-medium">{currentUser.name}</span> • <span className="capitalize">{currentUser.role}</span>
              </p>
            </div>
          </div>

          {/* Branch control dropdown for Owner */}
          {currentUser.role === "owner" && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase font-mono hidden sm:inline">Active Terminal:</span>
              {branches.length > 0 ? (
                <select
                  value={activeBranchId}
                  onChange={e => setActiveBranchId(parseInt(e.target.value))}
                  className="bg-slate-800 border border-slate-700 text-xs px-2.5 py-1.5 rounded-lg text-white font-bold focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.name} ({b.location})</option>
                  ))}
                </select>
              ) : (
                <span className="bg-rose-500/10 text-rose-400 border border-rose-500/20 text-xs px-2.5 py-1 py-1 px-2 rounded-lg font-bold">
                  ⚠️ No Registered Branch
                </span>
              )}
            </div>
          )}

          {/* Right actions: Warnings, Refresh & Logout */}
          <div className="flex items-center gap-2">
            
            {/* Notifications Alert */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className={`p-2 rounded-xl transition-all relative ${
                  notifications.length > 0 ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" : "bg-slate-800 text-slate-300"
                }`}
              >
                <Bell className="w-4 h-4" />
                {notifications.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center animate-pulse">
                    {notifications.length}
                  </span>
                )}
              </button>

              <AnimatePresence>
                {showNotifications && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute right-0 mt-2 w-72 bg-white text-slate-800 rounded-2xl shadow-xl p-4 border border-slate-200 z-50 space-y-3"
                  >
                    <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                      <span className="text-xs font-bold text-slate-900 uppercase">Balance Notifications</span>
                      <span className="text-[10px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded font-bold">Active Limits</span>
                    </div>
                    {notifications.length === 0 ? (
                      <p className="text-xs text-slate-500 text-center py-4">All float and cash balances are healthy!</p>
                    ) : (
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {notifications.map((n, i) => (
                          <div key={i} className="flex gap-2 p-2 bg-amber-50 border border-amber-100 rounded-lg text-[11px] text-amber-800">
                            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
                            <span>{n}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <button
              onClick={fetchAllData}
              className="p-2 bg-slate-800 text-slate-300 hover:text-white rounded-xl transition-all"
              title="Refresh ledger"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={() => {
                setChangeCurrentPassword("");
                setChangeNewPassword("");
                setChangeConfirmPassword("");
                setChangeSuccessMessage("");
                setChangeErrorMessage("");
                setShowChangePasswordModal(true);
              }}
              className="p-2 bg-slate-800 text-slate-300 hover:text-white border border-slate-700 rounded-xl transition-all flex items-center gap-1.5 text-xs font-bold cursor-pointer"
              title="Change security password"
            >
              <Key className="w-4 h-4" />
              <span className="hidden md:inline">Change Password</span>
            </button>

            <button
              onClick={handleLogout}
              className="p-2 bg-rose-500/10 text-rose-400 hover:text-rose-300 border border-rose-500/20 rounded-xl transition-all flex items-center gap-1 text-xs font-bold"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>

        </div>
      </header>

      {/* TABS NAVIGATION BAR */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm shrink-0">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between overflow-x-auto whitespace-nowrap scrollbar-none">
          <div className="flex md:ml-auto w-full md:justify-end">
            {[
              { id: "dashboard", label: "Dashboard", icon: BarChart3 },
              { id: "transactions", label: "Transactions", icon: Receipt },
              { id: "expenses", label: "Expenses Log", icon: ArrowUpRight },
              { id: "branches", label: "Branches & Float", icon: Building },
              ...(currentUser?.role === "owner" ? [{ id: "workers", label: "Workers (Agents)", icon: Users }] : []),
              { id: "reports", label: "Reports & P&L", icon: Printer },
              { id: "advisor", label: "SenteAdvisor AI", icon: MessageSquare }
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-4 py-3.5 border-b-2 text-xs font-bold transition-all relative ${
                    isActive ? "border-blue-600 text-blue-600 bg-blue-50/20" : "border-transparent text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                  {tab.id === "advisor" && (
                    <span className="bg-purple-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase scale-95 animate-pulse">AI</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* CORE AREA / WORKSPACE */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 overflow-y-auto">
        
        {/* TOP RECENT REFRESHING INDICATION */}
        {loading && (
          <div className="mb-4 bg-blue-50 border border-blue-100 p-2.5 rounded-xl text-xs text-blue-700 flex items-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span>Updating transactions ledger & balances across branches in Uganda Shillings...</span>
          </div>
        )}

        {/* NO BRANCHES STATE DISPLAY */}
        {branches.length === 0 && (
          <div className="bg-white border border-slate-200 rounded-3xl p-8 max-w-lg mx-auto text-center my-12 space-y-6 shadow-sm">
            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto border border-blue-100">
              <Building className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-slate-900 font-display">Create Your First Branch Outlet</h2>
              <p className="text-xs text-slate-500 leading-relaxed max-w-sm mx-auto">
                Welcome to SenteLedger! To start entering transactions, tracking float, and managing cash at hand, please register your first mobile money branch outlet first.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setBranchForm({ name: "", location: "", mtnFloat: "", airtelFloat: "", cashBalance: "" });
                setEditingBranchId(null);
                setShowBranchModal(true);
              }}
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold text-xs transition-all shadow-md shadow-blue-600/10 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              Register Branch Outlet
            </button>
          </div>
        )}

        {/* 1. DASHBOARD VIEW */}
        {activeTab === "dashboard" && activeBranch && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* LEFT COLUMN: Ledger metrics, margins, alerts, and recent feed */}
            <div className="lg:col-span-8 space-y-6">
              
              {/* Quick Balance Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex items-center justify-between">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Cash in Hand</span>
                    <p className="text-xl font-extrabold text-slate-900">{formatUGX(activeBranch.cashBalance)}</p>
                    <p className="text-[10px] text-slate-500">Current vault balance</p>
                  </div>
                  <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                    <Wallet className="w-6 h-6" />
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex items-center justify-between">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">MTN Money Float</span>
                    <p className="text-xl font-extrabold text-slate-900">{formatUGX(activeBranch.mtnFloat)}</p>
                    <p className="text-[10px] text-slate-500">MTN Agent wallet</p>
                  </div>
                  <div className="p-3 bg-yellow-50 text-amber-500 rounded-xl">
                    <Landmark className="w-6 h-6" />
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex items-center justify-between">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Airtel Money Float</span>
                    <p className="text-xl font-extrabold text-slate-900">{formatUGX(activeBranch.airtelFloat)}</p>
                    <p className="text-[10px] text-slate-500">Airtel Agent wallet</p>
                  </div>
                  <div className="p-3 bg-rose-50 text-rose-500 rounded-xl">
                    <Landmark className="w-6 h-6" />
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex items-center justify-between">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Combined Float</span>
                    <p className="text-xl font-extrabold text-slate-900">
                      {formatUGX(activeBranch.mtnFloat + activeBranch.airtelFloat)}
                    </p>
                    <p className="text-[10px] text-slate-500">Total telecom liquidity</p>
                  </div>
                  <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                    <Building className="w-6 h-6" />
                  </div>
                </div>

              </div>

              {/* Profits & Loss Overview */}
              {reportStats && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  
                  <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-md border border-slate-800 flex flex-col justify-between">
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Today's Commission Profit</span>
                      <p className="text-2xl font-black text-emerald-400">{formatUGX(reportStats.profit.daily)}</p>
                      <p className="text-[11px] text-slate-400">Commissions: {formatUGX(reportStats.profit.dailyComm)}</p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                      <span>Expenses: {formatUGX(reportStats.profit.dailyExp)}</span>
                      <span className="text-emerald-400 font-bold">Daily</span>
                    </div>
                  </div>

                  <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-md border border-slate-800 flex flex-col justify-between">
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Weekly Net Margin</span>
                      <p className="text-2xl font-black text-emerald-400">{formatUGX(reportStats.profit.weekly)}</p>
                      <p className="text-[11px] text-slate-400">Commissions: {formatUGX(reportStats.profit.weeklyComm)}</p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                      <span>Expenses: {formatUGX(reportStats.profit.weeklyExp)}</span>
                      <span className="text-emerald-400 font-bold">Past 7 days</span>
                    </div>
                  </div>

                  <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-md border border-slate-800 flex flex-col justify-between">
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Monthly Net Balance</span>
                      <p className="text-2xl font-black text-emerald-400">{formatUGX(reportStats.profit.monthly)}</p>
                      <p className="text-[11px] text-slate-400">Commissions: {formatUGX(reportStats.profit.monthlyComm)}</p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                      <span>Expenses: {formatUGX(reportStats.profit.monthlyExp)}</span>
                      <span className="text-emerald-400 font-bold">Past 30 days</span>
                    </div>
                  </div>

                </div>
              )}

              {/* Warnings Alert Callout if float or cash is below thresholds */}
              {(activeBranch.mtnFloat < thresholds.lowFloatLimit || activeBranch.airtelFloat < thresholds.lowFloatLimit || activeBranch.cashBalance < thresholds.lowCashLimit) && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-start gap-4">
                  <AlertTriangle className="w-8 h-8 text-amber-500 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h4 className="font-bold text-amber-900 text-sm">Critical Balance Warning at {activeBranch.name}</h4>
                    <p className="text-xs text-amber-700">
                      Your float or physical cash is currently running below the configured optimal reserve limits ({formatUGX(thresholds.lowFloatLimit)} float / {formatUGX(thresholds.lowCashLimit)} cash). Consider initiating a quick float purchase or transferring liquid balances from another branch.
                    </p>
                    <div className="pt-2 flex gap-3">
                      <button
                        onClick={() => {
                          setTxForm({
                            type: "float_purchase", provider: "MTN", amount: "", commission: "0",
                            customerPhone: "", customerName: "MTN Distributor", notes: "Emergency rebalance"
                          });
                          setShowTxModal(true);
                        }}
                        className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-1 text-[10px] font-bold rounded-lg transition-all"
                      >
                        Top-up MTN Float
                      </button>
                      <button
                        onClick={() => {
                          setTxForm({
                            type: "float_purchase", provider: "Airtel", amount: "", commission: "0",
                            customerPhone: "", customerName: "Airtel Distributor", notes: "Emergency rebalance"
                          });
                          setShowTxModal(true);
                        }}
                        className="bg-rose-600 hover:bg-rose-700 text-white px-3 py-1 text-[10px] font-bold rounded-lg transition-all"
                      >
                        Top-up Airtel Float
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Quick Recent Transactions Feed */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Today's Transactions Feed</h3>
                  <button onClick={() => setActiveTab("transactions")} className="text-xs text-blue-600 hover:underline font-bold">
                    View full ledger
                  </button>
                </div>
                <div className="divide-y divide-slate-100">
                  {filteredTransactions.slice(0, 5).map(t => (
                    <div key={t.id} className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl text-xs font-bold ${
                          t.type === 'deposit' ? 'bg-emerald-50 text-emerald-600' :
                          t.type === 'withdrawal' ? 'bg-rose-50 text-rose-500' :
                          t.type === 'airtime' ? 'bg-indigo-50 text-indigo-600' :
                          'bg-slate-100 text-slate-600'
                        }`}>
                          {t.type.toUpperCase().substring(0, 3)}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-800 text-xs sm:text-sm">{t.customerName || "Walk-in Client"}</span>
                            <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full font-bold">{t.provider}</span>
                          </div>
                          <p className="text-[10px] text-slate-400 font-mono">
                            {t.customerPhone || "N/A"} • {new Date(t.date).toLocaleTimeString('en-UG')}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-extrabold text-slate-950 text-xs sm:text-sm">{formatUGX(t.amount)}</p>
                        <p className="text-[10px] text-emerald-600 font-bold">Comm: +{formatUGX(t.commission)}</p>
                      </div>
                    </div>
                  ))}
                  {filteredTransactions.length === 0 && (
                    <div className="p-8 text-center text-xs text-slate-400">No transactions recorded today yet.</div>
                  )}
                </div>
              </div>

            </div>

            {/* RIGHT COLUMN: Action Buttons on the right-hand side, SenteAdvisor widget */}
            <div className="lg:col-span-4 space-y-6">
              
              {/* Quick Actions Panel */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                <div className="pb-3 border-b border-slate-100 mb-4">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Quick Operations Panel</h3>
                  <p className="text-[10px] text-slate-500 mt-0.5">Instant ledger shortcuts for active booth</p>
                </div>
                <div className="flex flex-col gap-3">
                  
                  <button
                    onClick={() => {
                      setTxForm(prev => ({ ...prev, type: "deposit" }));
                      setShowTxModal(true);
                    }}
                    className="flex items-center justify-between w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 text-xs font-bold rounded-xl transition-all shadow-md group"
                  >
                    <div className="flex items-center gap-2">
                      <PlusCircle className="w-4 h-4" />
                      <span>Record Cash Deposit</span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 opacity-60 group-hover:translate-x-0.5 transition-transform" />
                  </button>

                  <button
                    onClick={() => {
                      setTxForm(prev => ({ ...prev, type: "withdrawal" }));
                      setShowTxModal(true);
                    }}
                    className="flex items-center justify-between w-full bg-amber-500 hover:bg-amber-600 text-white px-4 py-3 text-xs font-bold rounded-xl transition-all shadow-md group"
                  >
                    <div className="flex items-center gap-2">
                      <ArrowDownLeft className="w-4 h-4" />
                      <span>Record Cash Withdrawal</span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 opacity-60 group-hover:translate-x-0.5 transition-transform" />
                  </button>

                  <button
                    onClick={() => {
                      setTxForm(prev => ({ ...prev, type: "airtime" }));
                      setShowTxModal(true);
                    }}
                    className="flex items-center justify-between w-full bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-3 text-xs font-bold rounded-xl transition-all shadow-md group"
                  >
                    <div className="flex items-center gap-2">
                      <RefreshCw className="w-4 h-4" />
                      <span>Sell Pre-paid Airtime</span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 opacity-60 group-hover:translate-x-0.5 transition-transform" />
                  </button>

                  <button
                    onClick={() => {
                      setTxForm(prev => ({ ...prev, type: "float_purchase" }));
                      setShowTxModal(true);
                    }}
                    className="flex items-center justify-between w-full bg-slate-800 hover:bg-slate-900 text-white px-4 py-3 text-xs font-bold rounded-xl transition-all shadow-md group"
                  >
                    <div className="flex items-center gap-2">
                      <Landmark className="w-4 h-4" />
                      <span>Record Float Purchase</span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 opacity-60 group-hover:translate-x-0.5 transition-transform" />
                  </button>

                  <button
                    onClick={() => setShowExpenseModal(true)}
                    className="flex items-center justify-between w-full bg-slate-50 hover:bg-slate-100 text-slate-800 px-4 py-3 text-xs font-bold rounded-xl border border-slate-200 transition-all group"
                  >
                    <div className="flex items-center gap-2">
                      <ArrowUpRight className="w-4 h-4 text-rose-500" />
                      <span>Log Business Expense</span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                  </button>

                  {currentUser.role === "owner" && (
                    <button
                      onClick={() => setShowTransferModal(true)}
                      className="flex items-center justify-between w-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-4 py-3 text-xs font-bold rounded-xl border border-indigo-100 transition-all group"
                    >
                      <div className="flex items-center gap-2">
                        <Building className="w-4 h-4" />
                        <span>Inter-branch Rebalance</span>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-indigo-400 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  )}

                </div>
              </div>

              {/* Quick SenteAdvisor Advice Preview */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-5 flex flex-col justify-between space-y-4 shadow-xs">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 bg-blue-600 text-white rounded-xl">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-xs sm:text-sm">Need Help Maximizing Mobile Money Commissions?</h4>
                    <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                      Ask SenteAdvisor AI about Uganda's latest agent commission tiers, float scheduling, or secure transactions.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveTab("advisor")}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 text-xs font-bold rounded-xl transition-all text-center block"
                >
                  Consult SenteAdvisor AI
                </button>
              </div>

            </div>

          </div>
        )}

        {/* 2. TRANSACTIONS LEDGER */}
        {activeTab === "transactions" && (
          <div className="space-y-4">
            
            {/* Filter controls bar */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
              
              <div className="w-full md:w-72 relative">
                <input
                  type="text"
                  placeholder="Search customer name, phone, or notes..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
              </div>

              <div className="flex flex-wrap gap-2 w-full md:w-auto">
                <select
                  value={providerFilter}
                  onChange={e => setProviderFilter(e.target.value)}
                  className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  <option value="all">All Providers</option>
                  <option value="MTN">MTN Money</option>
                  <option value="Airtel">Airtel Money</option>
                  <option value="Other">Other</option>
                </select>

                <select
                  value={typeFilter}
                  onChange={e => setTypeFilter(e.target.value)}
                  className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  <option value="all">All Types</option>
                  <option value="deposit">Deposits</option>
                  <option value="withdrawal">Withdrawals</option>
                  <option value="airtime">Airtime</option>
                  <option value="float_purchase">Float Purchase</option>
                  <option value="transfer">Transfers</option>
                </select>

                <button
                  onClick={() => setShowTxModal(true)}
                  className="ml-auto md:ml-0 flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 text-xs font-bold rounded-xl shadow-sm transition-all"
                >
                  <PlusCircle className="w-4 h-4" />
                  New Entry
                </button>
              </div>

            </div>

            {/* Ledger Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs sm:text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] border-b border-slate-100 font-mono">
                      <th className="p-4">Tx ID</th>
                      <th className="p-4">Customer Info</th>
                      <th className="p-4">Transaction Type</th>
                      <th className="p-4">Provider</th>
                      <th className="p-4">Total Amount</th>
                      <th className="p-4">Commission</th>
                      <th className="p-4 text-right">Logged By</th>
                      {(currentUser?.role === "owner" || currentUser?.allowEditDelete) && <th className="p-4 text-right">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredTransactions.map(t => (
                      <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-4 font-mono text-[11px] text-slate-400">#{t.id}</td>
                        <td className="p-4">
                          <p className="font-bold text-slate-900">{t.customerName || "Walk-in"}</p>
                          <p className="text-[10px] text-slate-400 font-mono">{t.customerPhone || "No Phone"}</p>
                        </td>
                        <td className="p-4">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            t.type === 'deposit' ? 'bg-emerald-50 text-emerald-700' :
                            t.type === 'withdrawal' ? 'bg-rose-50 text-rose-600' :
                            t.type === 'airtime' ? 'bg-indigo-50 text-indigo-700' :
                            'bg-slate-100 text-slate-700'
                          }`}>
                            {t.type}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className={`text-[11px] font-black px-1.5 py-0.5 rounded ${
                            t.provider === 'MTN' ? 'bg-amber-100 text-amber-800' :
                            t.provider === 'Airtel' ? 'bg-rose-100 text-rose-800' :
                            'bg-slate-100 text-slate-600'
                          }`}>
                            {t.provider}
                          </span>
                        </td>
                        <td className="p-4 font-bold font-mono text-slate-950">{formatUGX(t.amount)}</td>
                        <td className="p-4 font-bold font-mono text-emerald-600">+{formatUGX(t.commission)}</td>
                        <td className="p-4 text-right">
                          <p className="text-slate-800 font-medium">{t.agentName}</p>
                          <p className="text-[9px] text-slate-400">{new Date(t.date).toLocaleString('en-UG')}</p>
                        </td>
                        {(currentUser?.role === "owner" || currentUser?.allowEditDelete) && (
                          <td className="p-4 text-right flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => {
                                setEditingTxId(t.id);
                                setTxForm({
                                  type: t.type,
                                  provider: t.provider,
                                  amount: t.amount.toString(),
                                  commission: t.commission.toString(),
                                  customerPhone: t.customerPhone,
                                  customerName: t.customerName,
                                  notes: t.notes
                                });
                                setShowTxModal(true);
                              }}
                              className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg transition-all"
                              title="Edit transaction"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleTxDelete(t.id)}
                              className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition-all"
                              title="Delete transaction"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                    {filteredTransactions.length === 0 && (
                      <tr>
                        <td colSpan={(currentUser?.role === "owner" || currentUser?.allowEditDelete) ? 8 : 7} className="p-8 text-center text-slate-400 text-xs">
                          No matching transactions found. Click "New Entry" to log a customer event.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* 3. EXPENSES VIEW */}
        {activeTab === "expenses" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Log expense Form */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm h-fit">
              <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
                <Receipt className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-slate-800">
                  {editingExpenseId !== null ? "Edit Business Expense" : "Log Business Expense"}
                </h3>
              </div>

              <form onSubmit={handleExpenseSubmit} className="space-y-4 text-xs">
                
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase font-mono">Category</label>
                  <select
                    value={expenseForm.category}
                    onChange={e => setExpenseForm(prev => ({ ...prev, category: e.target.value as any }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 font-medium"
                  >
                    <option value="rent">Rent & Booth lease</option>
                    <option value="transport">Transport (Bodaboda / fuel)</option>
                    <option value="salaries">Staff / Agent Salary</option>
                    <option value="utilities">Utilities (Umeme Electricity / Water)</option>
                    <option value="tax">Uganda Revenue / Local Council Taxes</option>
                    <option value="other">Other Overhead Costs</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase font-mono">Amount (UGX)</label>
                  <input
                    type="number"
                    required
                    placeholder="e.g. 50000"
                    value={expenseForm.amount}
                    onChange={e => setExpenseForm(prev => ({ ...prev, amount: e.target.value }))}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase font-mono">Operational Notes / Reason</label>
                  <textarea
                    rows={3}
                    placeholder="e.g. Pre-paid airtime runner or Umeme tokens"
                    value={expenseForm.notes}
                    onChange={e => setExpenseForm(prev => ({ ...prev, notes: e.target.value }))}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 text-xs font-bold rounded-xl shadow-lg shadow-blue-500/10 transition-all"
                >
                  {editingExpenseId !== null ? "Update Expense" : "Log Expense"}
                </button>
                {editingExpenseId !== null && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingExpenseId(null);
                      setExpenseForm({ category: "rent", amount: "", notes: "" });
                    }}
                    className="w-full mt-2 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 text-xs font-bold rounded-xl transition-all"
                  >
                    Cancel Edit
                  </button>
                )}

              </form>
            </div>

            {/* Expenses List */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Business Expenditures Log</h3>
              
              <div className="divide-y divide-slate-100 text-xs sm:text-sm">
                {expenses.map(e => (
                  <div key={e.id} className="py-3 flex items-center justify-between hover:bg-slate-50/30 transition-colors">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-800 capitalize">{e.category}</span>
                        <span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-bold font-mono">ID: #{e.id}</span>
                      </div>
                      <p className="text-slate-500 text-xs">{e.notes || "No notes logged"}</p>
                      <p className="text-[9px] text-slate-400">{new Date(e.date).toLocaleString('en-UG')}</p>
                    </div>
                    <div className="text-right flex items-center gap-1.5">
                      <div>
                        <p className="font-black text-rose-600">{formatUGX(e.amount)}</p>
                      </div>
                      {(currentUser?.role === "owner" || currentUser?.allowEditDelete) && (
                        <>
                          <button
                            onClick={() => {
                              setEditingExpenseId(e.id);
                              setExpenseForm({
                                category: e.category,
                                amount: e.amount.toString(),
                                notes: e.notes
                              });
                            }}
                            className="p-1 bg-slate-50 hover:bg-blue-50 text-slate-500 hover:text-blue-600 rounded transition-all ml-2"
                            title="Edit expense"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleExpenseDelete(e.id)}
                            className="p-1 bg-slate-50 hover:bg-rose-50 text-slate-500 hover:text-rose-600 rounded transition-all"
                            title="Delete expense"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
                {expenses.length === 0 && (
                  <p className="p-8 text-center text-slate-400 text-xs">No expenditures logged. Track your bills here.</p>
                )}
              </div>
            </div>

          </div>
        )}

        {/* 4. BRANCHES VIEW */}
        {activeTab === "branches" && (
          <div className="space-y-6">
            
            {/* Header controls */}
            <div className="flex justify-between items-center flex-wrap gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Multi-Branch Outlets</h2>
                <p className="text-xs text-slate-500">View and manage float levels across Kampala terminals</p>
              </div>
              {currentUser.role === "owner" && (
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowTransferModal(true)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Inter-branch Balance Transfer
                  </button>
                  <button
                    onClick={() => setShowBranchModal(true)}
                    className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-2"
                  >
                    <PlusCircle className="w-4 h-4" />
                    Add New Branch
                  </button>
                </div>
              )}
            </div>

            {/* Branches list grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {branches.map(b => {
                const isCurrent = b.id === activeBranchId;
                return (
                  <div
                    key={b.id}
                    className={`bg-white rounded-3xl border shadow-sm p-6 space-y-4 relative overflow-hidden transition-all hover:shadow-md ${
                      isCurrent ? "border-blue-500 ring-2 ring-blue-500/10" : "border-slate-200"
                    }`}
                  >
                     <div className="absolute top-4 right-4 flex items-center gap-2">
                      {isCurrent && (
                        <span className="bg-blue-100 text-blue-700 text-[9px] font-black px-2 py-0.5 rounded-full">
                          ACTIVE TERMINAL
                        </span>
                      )}
                      {currentUser.role === "owner" && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setEditingBranchId(b.id);
                              setBranchForm({
                                name: b.name,
                                location: b.location,
                                mtnFloat: (b.baseMtnFloat !== undefined ? b.baseMtnFloat : b.mtnFloat).toString(),
                                airtelFloat: (b.baseAirtelFloat !== undefined ? b.baseAirtelFloat : b.airtelFloat).toString(),
                                cashBalance: (b.baseCashBalance !== undefined ? b.baseCashBalance : b.cashBalance).toString()
                              });
                              setShowBranchModal(true);
                            }}
                            className="p-1 text-slate-400 hover:text-blue-600 bg-slate-50 hover:bg-blue-50 rounded transition-all"
                            title="Edit Branch Settings"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleBranchDelete(b.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 bg-slate-50 hover:bg-rose-50 rounded transition-all"
                            title="Delete Branch"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="space-y-1">
                      <h3 className="font-bold text-slate-800 text-base flex items-center gap-1.5">
                        <MapPin className="w-4 h-4 text-blue-600" />
                        {b.name}
                      </h3>
                      <p className="text-xs text-slate-400">{b.location}</p>
                    </div>

                    <div className="pt-2 divide-y divide-slate-100 text-xs">
                      
                      <div className="py-2.5 flex justify-between items-center">
                        <span className="text-slate-500">MTN Wallet Float:</span>
                        <span className={`font-mono font-bold ${b.mtnFloat < thresholds.lowFloatLimit ? "text-amber-500" : "text-slate-800"}`}>
                          {formatUGX(b.mtnFloat)}
                        </span>
                      </div>

                      <div className="py-2.5 flex justify-between items-center">
                        <span className="text-slate-500">Airtel Wallet Float:</span>
                        <span className={`font-mono font-bold ${b.airtelFloat < thresholds.lowFloatLimit ? "text-amber-500" : "text-slate-800"}`}>
                          {formatUGX(b.airtelFloat)}
                        </span>
                      </div>

                      <div className="py-2.5 flex justify-between items-center">
                        <span className="text-slate-500">Cash-in-Hand Drawer:</span>
                        <span className={`font-mono font-bold ${b.cashBalance < thresholds.lowCashLimit ? "text-amber-500" : "text-slate-800"}`}>
                          {formatUGX(b.cashBalance)}
                        </span>
                      </div>

                    </div>

                    <div className="pt-2 flex justify-between items-center text-[10px] text-slate-400 font-bold font-mono">
                      <span>Liquid Sum: {formatUGX(b.mtnFloat + b.airtelFloat + b.cashBalance)}</span>
                      {currentUser.role === "owner" && !isCurrent && (
                        <button
                          onClick={() => setActiveBranchId(b.id)}
                          className="text-blue-600 hover:underline flex items-center gap-0.5"
                        >
                          Switch here <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                  </div>
                );
              })}
            </div>

          </div>
        )}

        {/* WORKERS VIEW */}
        {activeTab === "workers" && currentUser?.role === "owner" && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900 font-display">Manage Staff & Workers</h2>
                <p className="text-xs text-slate-500">Create, edit, assign branches, and manage security passwords for your agents.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setWorkerForm({ name: "", email: "", role: "agent", password: "", branchId: branches[0]?.id ? String(branches[0].id) : "1", allowEditDelete: false });
                  setEditingWorkerId(null);
                  setWorkerError("");
                  setShowWorkerModal(true);
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 text-xs font-bold rounded-xl shadow-md shadow-blue-600/10 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                Add New Worker
              </button>
            </div>

            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">
                      <th className="py-4 px-6">Worker/Agent Details</th>
                      <th className="py-4 px-6">Assigned Outlet Terminal</th>
                      <th className="py-4 px-6">Role</th>
                      <th className="py-4 px-6">Security Password</th>
                      <th className="py-4 px-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {workers.map(w => {
                      const branchAssigned = branches.find(b => b.id === w.branchId);
                      const isSelf = w.email.trim().toLowerCase() === currentUser.email.trim().toLowerCase();
                      
                      return (
                        <tr key={w.id} className="hover:bg-slate-50/40 transition-colors">
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-blue-100 border border-blue-200 text-blue-700 flex items-center justify-center font-bold text-xs">
                                {w.name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="font-bold text-slate-800 flex items-center gap-1">
                                  {w.name}
                                  {isSelf && (
                                    <span className="bg-blue-50 text-blue-700 text-[8px] font-black px-1.5 py-0.5 rounded uppercase font-mono tracking-wider">You</span>
                                  )}
                                </p>
                                <p className="text-slate-400 text-[11px] font-mono">{w.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-6 font-medium text-slate-700">
                            {w.role === "owner" ? (
                              <span className="text-slate-400 text-[11px] font-medium italic">All Terminals Access</span>
                            ) : branchAssigned ? (
                              <div className="flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span>{branchAssigned.name}</span>
                              </div>
                            ) : (
                              <span className="text-rose-600 font-bold bg-rose-50 px-1.5 py-0.5 rounded text-[10px]">Unassigned</span>
                            )}
                          </td>
                          <td className="py-4 px-6">
                            <div className="flex flex-col gap-1 items-start">
                              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                w.role === "owner" 
                                  ? "bg-purple-50 text-purple-700 border border-purple-100" 
                                  : "bg-blue-50 text-blue-700 border border-blue-100"
                              }`}>
                                {w.role}
                              </span>
                              {w.role === "agent" && (
                                <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-semibold ${
                                  w.allowEditDelete 
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-100" 
                                    : "bg-slate-100 text-slate-500 border border-slate-200"
                                }`}>
                                  {w.allowEditDelete ? "✓ Can Edit/Delete" : "✗ View Only"}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            <code className="bg-slate-100 text-slate-700 font-mono text-[11px] px-2 py-1 rounded-lg">
                              {w.password}
                            </code>
                          </td>
                          <td className="py-4 px-6 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => {
                                  setWorkerForm({
                                    name: w.name,
                                    email: w.email,
                                    role: w.role,
                                    password: w.password,
                                    branchId: String(w.branchId),
                                    allowEditDelete: !!w.allowEditDelete
                                  });
                                  setEditingWorkerId(w.id);
                                  setWorkerError("");
                                  setShowWorkerModal(true);
                                }}
                                className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-all cursor-pointer"
                                title="Edit worker details"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              {!isSelf && (
                                <button
                                  onClick={() => handleWorkerDelete(w.id, w.name)}
                                  className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition-all cursor-pointer"
                                  title="Remove worker account"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* 5. REPORTS VIEW */}
        {activeTab === "reports" && reportStats && (
          <div className="space-y-6">
            
            {/* Header with Print & Export buttons */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">SenteLedger P&L Audit Report</h2>
                <p className="text-xs text-slate-500">Official Uganda agent branch summary and audit logs</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleExportCSV}
                  className="bg-slate-50 hover:bg-slate-100 text-slate-800 px-4 py-2 text-xs font-bold rounded-xl border border-slate-200 transition-all flex items-center gap-2 shadow-sm"
                >
                  <Download className="w-4 h-4" />
                  Export Ledger (CSV)
                </button>
                <button
                  onClick={handlePrintReport}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 shadow-md"
                >
                  <Printer className="w-4 h-4" />
                  Print / Save PDF
                </button>
              </div>
            </div>

            {/* printable report wrapper */}
            <div className="space-y-6 print:bg-white print:p-8">
              
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Visual Area Trend Chart */}
                <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Commissions vs Expenses Trend (7 Days)</h3>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={reportStats.daysTrend}>
                        <defs>
                          <linearGradient id="colorComm" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10B981" stopOpacity={0.2}/>
                            <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#F43F5E" stopOpacity={0.2}/>
                            <stop offset="95%" stopColor="#F43F5E" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                        <XAxis dataKey="name" stroke="#64748B" fontSize={10} tickLine={false} />
                        <YAxis stroke="#64748B" fontSize={10} tickLine={false} />
                        <Tooltip formatter={(value: any) => formatUGX(value)} />
                        <Area type="monotone" dataKey="Commissions" stroke="#10B981" strokeWidth={2} fillOpacity={1} fill="url(#colorComm)" />
                        <Area type="monotone" dataKey="Expenses" stroke="#F43F5E" strokeWidth={2} fillOpacity={1} fill="url(#colorExp)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Expenses Breakdown Pie Chart */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Expenditure Breakdown</h3>
                  <div className="h-60 w-full flex items-center justify-center relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={reportStats.expenseBreakdown}
                          innerRadius={55}
                          outerRadius={75}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {reportStats.expenseBreakdown.map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={["#2563EB", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#64748B"][index % 6]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: any) => formatUGX(value)} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute text-center">
                      <p className="text-[9px] font-bold text-slate-400 uppercase">Overhead</p>
                      <p className="text-sm font-black text-rose-600">
                        {formatUGX(reportStats.expenseBreakdown.reduce((sum: number, e: any) => sum + e.value, 0))}
                      </p>
                    </div>
                  </div>
                </div>

              </div>

              {/* Multi-Branch Performance Table */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Uganda Branches Commission Leaderboard</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100 uppercase text-[9px]">
                        <th className="p-3">Branch Name</th>
                        <th className="p-3">MTN Float</th>
                        <th className="p-3">Airtel Float</th>
                        <th className="p-3">Cash Vault</th>
                        <th className="p-3">Customer Volume</th>
                        <th className="p-3">Commissions</th>
                        <th className="p-3">Expenses</th>
                        <th className="p-3 text-right">Net Profit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {reportStats.branchPerformance.map((b: any) => (
                        <tr key={b.branchId} className="hover:bg-slate-50/50">
                          <td className="p-3 font-bold text-slate-800 font-sans">{b.branchName}</td>
                          <td className="p-3">{formatUGX(b.mtnFloat)}</td>
                          <td className="p-3">{formatUGX(b.airtelFloat)}</td>
                          <td className="p-3">{formatUGX(b.cashBalance)}</td>
                          <td className="p-3 text-slate-600">{formatUGX(b.volume)}</td>
                          <td className="p-3 text-emerald-600 font-bold">+{formatUGX(b.commissions)}</td>
                          <td className="p-3 text-rose-600 font-bold">-{formatUGX(b.expenses)}</td>
                          <td className="p-3 text-right text-blue-600 font-black">{formatUGX(b.netProfit)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>

          </div>
        )}

        {/* 6. SENTEADVISOR AI CHAT */}
        {activeTab === "advisor" && (
          <div className="bg-white rounded-3xl border border-slate-200 shadow-lg overflow-hidden h-[550px] flex flex-col">
            
            {/* Advisor header info */}
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-600 text-white rounded-xl">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">SenteAdvisor AI Coach</h3>
                  <p className="text-[10px] text-emerald-400">● Live Uganda Agent Business Consultant</p>
                </div>
              </div>
              <button
                onClick={() => setChatMessages([{ role: "model", text: "Reset completed! Ask me any operational or financial query regarding your Mobile Money terminals.", timestamp: Date.now() }])}
                className="text-[10px] text-slate-400 hover:text-white underline font-bold"
              >
                Clear History
              </button>
            </div>

            {/* Messages box */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#F1F5F9]">
              {chatMessages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] rounded-2xl p-3.5 shadow-sm text-xs ${
                    msg.role === "user" ? "bg-blue-600 text-white" : "bg-white text-slate-800 border border-slate-100"
                  }`}>
                    {msg.text}
                  </div>
                </div>
              ))}
              {advisorLoading && (
                <div className="flex justify-start">
                  <div className="bg-white rounded-2xl p-3 border border-slate-100 text-slate-400 text-xs flex items-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>SenteAdvisor is reviewing your cash flows & agent commissions...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Suggested quick questions */}
            <div className="p-2 bg-slate-50 border-t border-slate-100 flex gap-2 overflow-x-auto scrollbar-none">
              {[
                { label: "Anti-Fraud Scams", text: "What are the most common mobile money fraud tricks like 'Kamula' fake SMS SMS in Uganda and how can we block them?" },
                { label: "Float Balancing", text: "My MTN float is low and my airtel float is high. Recommend the best Stanbic or distributor rebalancing path." },
                { label: "Margin Maximization", text: "Explain how mobile money transaction commission tiers work in Uganda and when we should split transactions." }
              ].map((b, i) => (
                <button
                  key={i}
                  onClick={() => handleAskAdvisor(b.text)}
                  className="bg-white hover:bg-slate-100 border border-slate-200 text-[10px] font-bold text-slate-600 px-3 py-1.5 rounded-full whitespace-nowrap transition-all"
                >
                  {b.label}
                </button>
              ))}
            </div>

            {/* Input form */}
            <form
              onSubmit={e => {
                e.preventDefault();
                handleAskAdvisor();
              }}
              className="p-3 border-t border-slate-100 flex gap-2"
            >
              <input
                type="text"
                placeholder="Ask about Kampala Road branch, cash reserves, or Umeme billing..."
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                className="flex-1 px-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                type="submit"
                className="p-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all shadow-md"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>

          </div>
        )}

      </main>

      {/* FOOTER STATS INFO */}
      <footer className="bg-slate-900 text-slate-400 text-center py-4 px-4 text-[10px] border-t border-slate-800 shrink-0">
        <p>© 2026 SenteLedger Uganda. All operations logged and audited securely. Designed for telecom and utility retail agents.</p>
      </footer>

      {/* --- ALL MODALS --- */}

      {/* 1. TRANSACTION RECORD MODAL */}
      {showTxModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden border border-slate-200">
            <div className="p-5 bg-slate-900 text-white flex justify-between items-center">
              <div>
                <h3 className="font-bold text-sm">{editingTxId !== null ? "Edit Customer Transaction" : "Record Customer Transaction"}</h3>
                <p className="text-[10px] text-slate-400">Terminal: {activeBranch?.name}</p>
              </div>
              <button
                onClick={() => {
                  setShowTxModal(false);
                  setEditingTxId(null);
                  setTxForm({
                    type: "deposit", provider: "MTN", amount: "", commission: "",
                    customerPhone: "", customerName: "", notes: ""
                  });
                }}
                className="text-slate-400 hover:text-white text-xs font-bold"
              >
                Close
              </button>
            </div>

            {branches.length === 0 ? (
              <div className="p-8 text-center text-slate-500 space-y-4">
                <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto animate-bounce" />
                <h4 className="font-bold text-slate-800 text-sm">No Active Branches Found</h4>
                <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                  You must register at least one branch terminal outlet before you can record any customer transactions.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setShowTxModal(false);
                    setBranchForm({ name: "", location: "", mtnFloat: "", airtelFloat: "", cashBalance: "" });
                    setEditingBranchId(null);
                    setShowBranchModal(true);
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all shadow-md"
                >
                  Register Branch Outlet
                </button>
              </div>
            ) : (
              <form onSubmit={handleTxSubmit} className="p-6 space-y-4 text-xs text-left">
              
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase font-mono">Action / Type</label>
                  <select
                    value={txForm.type}
                    onChange={e => setTxForm(prev => ({ ...prev, type: e.target.value as any }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                  >
                    <option value="deposit">Deposit (Cash to Float)</option>
                    <option value="withdrawal">Withdrawal (Float to Cash)</option>
                    <option value="airtime">Airtime Retail Sale</option>
                    <option value="float_purchase">Float Purchase / Top-up</option>
                    <option value="transfer">Standard Transfer</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase font-mono">Provider</label>
                  <select
                    value={txForm.provider}
                    onChange={e => setTxForm(prev => ({ ...prev, provider: e.target.value as any }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                  >
                    <option value="MTN">MTN Mobile Money</option>
                    <option value="Airtel">Airtel Money</option>
                    <option value="Other">Other Retail / Bank</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase font-mono">Amount (UGX)</label>
                  <input
                    type="number"
                    required
                    placeholder="e.g. 100000"
                    value={txForm.amount}
                    onChange={e => setTxForm(prev => ({ ...prev, amount: e.target.value }))}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold font-mono focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase font-mono">Estimated Commission (UGX)</label>
                  <input
                    type="number"
                    required
                    placeholder="Auto-calculated"
                    value={txForm.commission}
                    onChange={e => {
                      setIsCommissionManuallyEdited(true);
                      setTxForm(prev => ({ ...prev, commission: e.target.value }));
                    }}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold font-mono text-emerald-600 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                  {isCommissionManuallyEdited ? (
                    <button
                      type="button"
                      onClick={() => setIsCommissionManuallyEdited(false)}
                      className="text-[10px] text-blue-600 hover:text-blue-700 font-bold flex items-center gap-1 mt-1 cursor-pointer"
                    >
                      ✏️ Manual Edit (Click to auto-suggest)
                    </button>
                  ) : (
                    <span className="text-[10px] text-slate-400 font-medium block mt-1">
                      ✨ Auto-calculating standard UGX agent commission
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase font-mono">Customer Phone</label>
                  <input
                    type="text"
                    placeholder="e.g. 0772000111"
                    value={txForm.customerPhone}
                    onChange={e => setTxForm(prev => ({ ...prev, customerPhone: e.target.value }))}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase font-mono">Customer Name</label>
                  <input
                    type="text"
                    placeholder="e.g. John Bosco"
                    value={txForm.customerName}
                    onChange={e => setTxForm(prev => ({ ...prev, customerName: e.target.value }))}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase font-mono">Operational Notes</label>
                <input
                  type="text"
                  placeholder="Yaka bill payment or telecom runner comments"
                  value={txForm.notes}
                  onChange={e => setTxForm(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 text-xs font-bold rounded-xl shadow-lg transition-all"
                >
                  {editingTxId !== null ? "Update Transaction & Sync" : "Confirm & Sync Ledger"}
                </button>
              </div>

            </form>
            )}
          </div>
        </div>
      )}

      {/* 2. LOG EXPENSE MODAL */}
      {showExpenseModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-200">
            <div className="p-5 bg-slate-900 text-white flex justify-between items-center">
              <h3 className="font-bold text-sm">{editingExpenseId !== null ? "Edit Business Overhead" : "Log Business Overhead"}</h3>
              <button
                onClick={() => {
                  setShowExpenseModal(false);
                  setEditingExpenseId(null);
                  setExpenseForm({ category: "rent", amount: "", notes: "" });
                }}
                className="text-slate-400 hover:text-white text-xs font-bold"
              >
                Close
              </button>
            </div>
            {branches.length === 0 ? (
              <div className="p-8 text-center text-slate-500 space-y-4">
                <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto animate-bounce" />
                <h4 className="font-bold text-slate-800 text-sm">No Active Branches Found</h4>
                <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                  You must register at least one branch terminal outlet before you can log any expenses.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setShowExpenseModal(false);
                    setBranchForm({ name: "", location: "", mtnFloat: "", airtelFloat: "", cashBalance: "" });
                    setEditingBranchId(null);
                    setShowBranchModal(true);
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all shadow-md"
                >
                  Register Branch Outlet
                </button>
              </div>
            ) : (
              <form onSubmit={handleExpenseSubmit} className="p-6 space-y-4 text-xs text-left">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase font-mono">Category</label>
                <select
                  value={expenseForm.category}
                  onChange={e => setExpenseForm(prev => ({ ...prev, category: e.target.value as any }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  <option value="rent">Rent / Booth Rental</option>
                  <option value="transport">Transport (Bodaboda / Runner)</option>
                  <option value="salaries">Agent Commissions / Salaries</option>
                  <option value="utilities">Umeme Electricity / Water</option>
                  <option value="tax">Uganda Revenue Council Tax</option>
                  <option value="other">Other Overhead</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase font-mono">Amount (UGX)</label>
                <input
                  type="number"
                  required
                  value={expenseForm.amount}
                  onChange={e => setExpenseForm(prev => ({ ...prev, amount: e.target.value }))}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase font-mono">Notes</label>
                <input
                  type="text"
                  value={expenseForm.notes}
                  onChange={e => setExpenseForm(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                />
              </div>
              <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 text-xs font-bold rounded-xl shadow-md">
                {editingExpenseId !== null ? "Update Expense" : "Log Expense"}
              </button>
            </form>
            )}
          </div>
        </div>
      )}

      {/* 3. ADD NEW BRANCH MODAL */}
      {showBranchModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-200">
            <div className="p-5 bg-slate-900 text-white flex justify-between items-center">
              <h3 className="font-bold text-sm">{editingBranchId !== null ? "Edit Branch Outlet" : "Register Branch Outlet"}</h3>
              <button
                onClick={() => {
                  setShowBranchModal(false);
                  setEditingBranchId(null);
                  setBranchForm({ name: "", location: "", mtnFloat: "", airtelFloat: "", cashBalance: "" });
                }}
                className="text-slate-400 hover:text-white text-xs font-bold"
              >
                Close
              </button>
            </div>
            <form onSubmit={handleBranchSubmit} className="p-6 space-y-4 text-xs text-left">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase font-mono">Branch Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ntinda Stage Terminal"
                  value={branchForm.name}
                  onChange={e => setBranchForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase font-mono">Location Description</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ntinda Road, next to Standard Chartered"
                  value={branchForm.location}
                  onChange={e => setBranchForm(prev => ({ ...prev, location: e.target.value }))}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold text-slate-500 uppercase font-mono">MTN Float (UGX)</label>
                  <input
                    type="number"
                    value={branchForm.mtnFloat}
                    onChange={e => setBranchForm(prev => ({ ...prev, mtnFloat: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-[11px]"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold text-slate-500 uppercase font-mono">Airtel Float (UGX)</label>
                  <input
                    type="number"
                    value={branchForm.airtelFloat}
                    onChange={e => setBranchForm(prev => ({ ...prev, airtelFloat: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-[11px]"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold text-slate-500 uppercase font-mono">Cash Vault (UGX)</label>
                  <input
                    type="number"
                    value={branchForm.cashBalance}
                    onChange={e => setBranchForm(prev => ({ ...prev, cashBalance: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-[11px]"
                  />
                </div>
              </div>
              <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 text-xs font-bold rounded-xl">
                {editingBranchId !== null ? "Update Branch Details" : "Create Branch Terminal"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 4. INTER-BRANCH TRANSFER MODAL */}
      {showTransferModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-200">
            <div className="p-5 bg-slate-900 text-white flex justify-between items-center">
              <h3 className="font-bold text-sm">Inter-branch Liquidity Rebalance</h3>
              <button onClick={() => setShowTransferModal(false)} className="text-slate-400 hover:text-white text-xs font-bold">Close</button>
            </div>
            {branches.length < 2 ? (
              <div className="p-8 text-center text-slate-500 space-y-4">
                <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto animate-bounce" />
                <h4 className="font-bold text-slate-800 text-sm">Multiple Branches Required</h4>
                <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                  You must register at least two active branch terminals to perform inter-branch liquidity transfers and balancing.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setShowTransferModal(false);
                    setBranchForm({ name: "", location: "", mtnFloat: "", airtelFloat: "", cashBalance: "" });
                    setEditingBranchId(null);
                    setShowBranchModal(true);
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all shadow-md"
                >
                  Register Branch Outlet
                </button>
              </div>
            ) : (
              <form onSubmit={handleTransferSubmit} className="p-6 space-y-4 text-xs text-left">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase font-mono">Source Branch</label>
                  <select
                    required
                    value={transferForm.sourceBranchId}
                    onChange={e => setTransferForm(prev => ({ ...prev, sourceBranchId: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  >
                    <option value="">Select source</option>
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase font-mono">Target Branch</label>
                  <select
                    required
                    value={transferForm.targetBranchId}
                    onChange={e => setTransferForm(prev => ({ ...prev, targetBranchId: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  >
                    <option value="">Select target</option>
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase font-mono">Asset Type to Move</label>
                <select
                  value={transferForm.type}
                  onChange={e => setTransferForm(prev => ({ ...prev, type: e.target.value as any }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                >
                  <option value="cash">Vault Physical Cash (UGX)</option>
                  <option value="mtnFloat">MTN Wallet Float (UGX)</option>
                  <option value="airtelFloat">Airtel Wallet Float (UGX)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase font-mono">Amount (UGX)</label>
                <input
                  type="number"
                  required
                  placeholder="e.g. 500000"
                  value={transferForm.amount}
                  onChange={e => setTransferForm(prev => ({ ...prev, amount: e.target.value }))}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold font-mono focus:ring-2"
                />
              </div>

              <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 text-xs font-bold rounded-xl transition-all">
                Authorize Transit Transfer
              </button>
            </form>
            )}
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      <AnimatePresence>
        {deleteConfirm.type !== null && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden border border-slate-200"
            >
              <div className="p-5 bg-rose-600 text-white flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 shrink-0 text-white" />
                <h3 className="font-bold text-sm font-display">{deleteConfirm.title}</h3>
              </div>
              <div className="p-6 space-y-4 text-xs text-left">
                <p className="text-slate-600 leading-relaxed font-sans">
                  {deleteConfirm.message}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setDeleteConfirm({ type: null, id: null, title: "", message: "" })}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 font-bold rounded-xl transition-all cursor-pointer text-center"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={executeDelete}
                    className="flex-1 bg-rose-600 hover:bg-rose-700 text-white py-2.5 font-bold rounded-xl transition-all shadow-md shadow-rose-600/10 cursor-pointer text-center"
                  >
                    Yes, Delete
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* WORKER MANAGEMENT MODAL */}
      <AnimatePresence>
        {showWorkerModal && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-200"
            >
              <div className="p-5 bg-slate-900 text-white flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-400" />
                  <h3 className="font-bold text-sm">
                    {editingWorkerId !== null ? "Edit Worker Account" : "Add Worker/Agent Account"}
                  </h3>
                </div>
                <button
                  onClick={() => setShowWorkerModal(false)}
                  className="text-slate-400 hover:text-white text-xs font-bold cursor-pointer"
                >
                  Close
                </button>
              </div>

              <form onSubmit={handleWorkerSubmit} className="p-6 space-y-4 text-xs text-left">
                {workerError && (
                  <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded-xl flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{workerError}</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase font-mono">Full Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Trevor Muyinda"
                    value={workerForm.name}
                    onChange={e => setWorkerForm(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-none text-slate-800"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase font-mono">Email Address</label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. sarah@gmail.com"
                    value={workerForm.email}
                    onChange={e => setWorkerForm(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-none text-slate-800"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase font-mono">Security Password</label>
                  <input
                    type="text"
                    required
                    placeholder="Minimum 6 characters"
                    value={workerForm.password}
                    onChange={e => setWorkerForm(prev => ({ ...prev, password: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-none text-slate-800 font-mono text-[11px]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase font-mono">System Role</label>
                    <select
                      value={workerForm.role}
                      onChange={e => setWorkerForm(prev => ({ ...prev, role: e.target.value as any }))}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-none font-bold text-slate-800"
                    >
                      <option value="agent">Agent (Worker)</option>
                      <option value="owner">Owner (Admin)</option>
                    </select>
                  </div>

                  {workerForm.role === "agent" && (
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase font-mono">Assigned Outlet</label>
                      <select
                        value={workerForm.branchId}
                        onChange={e => setWorkerForm(prev => ({ ...prev, branchId: e.target.value }))}
                        className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-none font-bold text-[11px] text-slate-800"
                      >
                        {branches.map(b => (
                          <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {workerForm.role === "agent" && (
                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/60 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-bold text-slate-800 text-[11px]">Allow Editing & Deleting</p>
                      <p className="text-[9px] text-slate-400">Allows agent to modify or delete logs at their branch</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={workerForm.allowEditDelete}
                        onChange={e => setWorkerForm(prev => ({ ...prev, allowEditDelete: e.target.checked }))}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowWorkerModal(false)}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 font-bold rounded-xl transition-all cursor-pointer text-center"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2.5 font-bold rounded-xl transition-all shadow-md shadow-blue-600/10 cursor-pointer text-center"
                  >
                    {editingWorkerId !== null ? "Update Worker" : "Register Worker"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CHANGE PASSWORD MODAL */}
      <AnimatePresence>
        {showChangePasswordModal && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-200"
            >
              <div className="p-5 bg-slate-900 text-white flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-blue-400" />
                  <h3 className="font-bold text-sm">Change Security Password</h3>
                </div>
                <button
                  onClick={() => setShowChangePasswordModal(false)}
                  className="text-slate-400 hover:text-white text-xs font-bold cursor-pointer"
                >
                  Close
                </button>
              </div>

              <form onSubmit={handleChangePassword} className="p-6 space-y-4 text-xs text-left">
                {changeErrorMessage && (
                  <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded-xl flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{changeErrorMessage}</span>
                  </div>
                )}

                {changeSuccessMessage && (
                  <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs p-3 rounded-xl flex items-center gap-2">
                    <Shield className="w-4 h-4 shrink-0" />
                    <span>{changeSuccessMessage}</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase font-mono">Current Security Password</label>
                  <input
                    type="password"
                    required
                    placeholder="Enter current password"
                    value={changeCurrentPassword}
                    onChange={e => setChangeCurrentPassword(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-none text-slate-800"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase font-mono">New Security Password</label>
                  <input
                    type="password"
                    required
                    placeholder="Minimum 6 characters"
                    value={changeNewPassword}
                    onChange={e => setChangeNewPassword(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-none text-slate-800"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase font-mono">Confirm New Password</label>
                  <input
                    type="password"
                    required
                    placeholder="Repeat new password"
                    value={changeConfirmPassword}
                    onChange={e => setChangeConfirmPassword(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-none text-slate-800"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowChangePasswordModal(false)}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 font-bold rounded-xl transition-all cursor-pointer text-center"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2.5 font-bold rounded-xl transition-all shadow-md shadow-blue-600/10 cursor-pointer text-center"
                  >
                    Change Password
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
