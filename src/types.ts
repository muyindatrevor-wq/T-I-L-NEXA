export interface User {
  id: string;
  name: string;
  email: string;
  role: 'owner' | 'agent' | 'admin';
  password: string;
  branchId: number;
  allowEditDelete?: boolean;
}

export interface Branch {
  id: number;
  name: string;
  location: string;
  mtnFloat: number;
  airtelFloat: number;
  cashBalance: number;
  baseMtnFloat?: number;
  baseAirtelFloat?: number;
  baseCashBalance?: number;
}

export type TransactionType = 'deposit' | 'withdrawal' | 'airtime' | 'transfer' | 'float_purchase';
export type ProviderType = 'MTN' | 'Airtel' | 'Other';

export interface Transaction {
  id: number;
  type: TransactionType;
  provider: ProviderType;
  amount: number;
  commission: number; // Agent commission
  customerPhone: string;
  customerName: string;
  date: number; // timestamp
  branchId: number;
  agentName: string;
  notes: string;
  targetBranchId?: number;
  transferAsset?: 'cash' | 'mtnFloat' | 'airtelFloat';
}

export type ExpenseCategory = 'rent' | 'transport' | 'salaries' | 'utilities' | 'tax' | 'other';

export interface Expense {
  id: number;
  category: ExpenseCategory;
  amount: number;
  date: number; // timestamp
  branchId: number;
  notes: string;
}

export interface AlertThresholds {
  lowFloatLimit: number;
  lowCashLimit: number;
}

export interface AdvisorMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}
