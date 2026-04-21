import { Entry } from '../types';

const STORAGE_KEY = 'dashboard_entries';

// Initial sample data
const sampleData: Entry[] = [
  { id: '1', cardNumber: '4532 1234 5678 9012', amount: 1250.50, timestamp: Date.now() - 86400000 * 5 },
  { id: '2', cardNumber: '5105 8765 4321 0987', amount: -3420.00, timestamp: Date.now() - 86400000 * 4 },
  { id: '3', cardNumber: '3782 4444 5555 6666', amount: 890.75, timestamp: Date.now() - 86400000 * 3 },
  { id: '4', cardNumber: '4921 0000 1111 2222', amount: -5670.20, timestamp: Date.now() - 86400000 * 2 },
  { id: '5', cardNumber: '5213 1212 3434 5656', amount: 2100.00, timestamp: Date.now() - 86400000 * 1 },
  { id: '6', cardNumber: '4532 9999 8888 7777', amount: -12400.00, timestamp: Date.now() - 40000000 },
  { id: '7', cardNumber: '4321 5432 1234 5678', amount: 450.25, timestamp: Date.now() - 35000000 },
  { id: '8', cardNumber: '5555 4444 3333 2222', amount: 7800.00, timestamp: Date.now() - 30000000 },
  { id: '9', cardNumber: '4912 3456 7890 1234', amount: -120.00, timestamp: Date.now() - 25000000 },
  { id: '10', cardNumber: '3712 9876 5432 1098', amount: 9500.50, timestamp: Date.now() - 20000000 },
  { id: '11', cardNumber: '4000 1111 2222 3333', amount: -3200.00, timestamp: Date.now() - 15000000 },
  { id: '12', cardNumber: '5123 4567 8901 2345', amount: 670.00, timestamp: Date.now() - 10000000 },
  { id: '13', cardNumber: '4444 5555 6666 7777', amount: 11000.00, timestamp: Date.now() - 5000000 },
];



export const dataService = {
  getEntries: async (): Promise<entry[]> => {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sampleData));
      return sampleData;
    }
    return JSON.parse(stored);
  },

  saveEntries: async (entries: Entry[]): Promise<void> => {
    await new Promise(resolve => setTimeout(resolve, 500));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  },

  addEntry: async (entry: Omit<entry, 'id'="" |="" 'timestamp'="">): Promise<entry> => {
    const entries = await dataService.getEntries();
    const newEntry: Entry = {
      ...entry,
      id: Math.random().toString(36).substr(2, 9),
      timestamp: Date.now(),
    };
    await dataService.saveEntries([newEntry, ...entries]);
    return newEntry;
  },

  addManyEntries: async (newEntries: Omit<entry, 'id'="" |="" 'timestamp'="">[]): Promise<void> => {
    const entries = await dataService.getEntries();
    const entriesWithIds: Entry[] = newEntries.map(e => ({
      ...e,
      id: Math.random().toString(36).substr(2, 9),
      timestamp: Date.now(),
    }));
    await dataService.saveEntries([...entriesWithIds, ...entries]);
  },

  updateEntry: async (id: string, updates: Partial<entry>): Promise<void> => {
    const entries = await dataService.getEntries();
    const updated = entries.map(e => e.id === id ? { ...e, ...updates } : e);
    await dataService.saveEntries(updated);
  },

  deleteEntry: async (id: string): Promise<void> => {
    const entries = await dataService.getEntries();
    const filtered = entries.filter(e => e.id !== id);
    await dataService.saveEntries(filtered);
  }
};
