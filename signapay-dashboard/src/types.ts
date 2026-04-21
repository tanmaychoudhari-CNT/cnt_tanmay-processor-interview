export interface Entry {
  id: string;
  cardNumber: string;
  amount: number;
  timestamp: number;
}

export interface User {
  id: string;
  username: string;
}

export interface DashboardStats {
  totalEntries: number;
  totalAmount: number;
  averageAmount: number;
  highestAmount: number;
  lowestAmount: number;
}
