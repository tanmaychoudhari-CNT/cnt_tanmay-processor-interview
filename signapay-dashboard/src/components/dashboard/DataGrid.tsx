import React, { useState, useMemo } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  ArrowUpDown, 
  Trash2, 
  Edit3, 
  MoreVertical,
  Search,
  Filter
} from 'lucide-react';
import { Entry } from '../../types';
import { formatCurrency, cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface DataGridProps {
  entries: Entry[];
  onDelete: (id: string) => void;
  onEdit: (entry: Entry) => void;
}

export default function DataGrid({ entries, onDelete, onEdit }: DataGridProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof Entry; direction: 'asc' | 'desc' } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Sorting logic
  const sortedEntries = useMemo(() => {
    let sortableItems = [...entries];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (a[sortConfig.key] > b[sortConfig.key]) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [entries, sortConfig]);

  // Filtering logic
  const filteredEntries = useMemo(() => {
    return sortedEntries.filter(entry => 
      entry.cardNumber.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [sortedEntries, searchTerm]);

  // Pagination logic
  const totalPages = Math.ceil(filteredEntries.length / itemsPerPage);
  const paginatedEntries = filteredEntries.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const requestSort = (key: keyof Entry) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  return (
    <div classname="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm flex flex-col min-h-[600px]">
      <div classname="p-6 border-b border-gray-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 classname="text-xl font-black tracking-tight">Financial Records</h2>
          <p classname="text-xs text-gray-500 font-medium mt-1">Found {filteredEntries.length} total records across active nodes</p>
        </div>
        
        <div classname="flex items-center gap-3">
          <div classname="relative">
            <search classname="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"/>
            <input type="text" placeholder="Search card number..." value="{searchTerm}" onchange="{(e)" ==""> setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2.5 bg-gray-50 border-none rounded-xl text-sm w-full sm:w-64 focus:ring-2 focus:ring-accent/20 outline-none transition-all"
            />
          </div>
          <button classname="p-2.5 bg-gray-50 text-gray-500 hover:text-black rounded-xl transition-all">
            <filter classname="w-5 h-5"/>
          </button>
        </div>
      </div>

      <div classname="flex-1 overflow-x-auto">
        <table classname="w-full text-left">
          <thead>
            <tr classname="bg-gray-50/50 text-[10px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-50">
              <th classname="px-8 py-4">Card Number</th>
              <th classname="px-8 py-4 cursor-pointer hover:text-accent transition-colors" onclick="{()" ==""> requestSort('amount')}>
                <div classname="flex items-center gap-2">
                  Amount <arrowupdown classname="w-3 h-3"/>
                </div>
              </th>
              <th classname="px-8 py-4 cursor-pointer hover:text-accent transition-colors" onclick="{()" ==""> requestSort('timestamp')}>
                <div classname="flex items-center gap-2">
                  Time <arrowupdown classname="w-3 h-3"/>
                </div>
              </th>
              <th classname="px-8 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody classname="divide-y divide-gray-50">
            <animatepresence mode="popLayout">
              {paginatedEntries.map((entry) => (
                <motion.tr layout="" key="{entry.id}" initial="{{" opacity:="" 0="" }}="" animate="{{" opacity:="" 1="" }}="" exit="{{" opacity:="" 0="" }}="" classname="group hover:bg-gray-50/30 transition-all duration-200">
                  <td classname="px-8 py-5">
                    <span classname="font-mono text-sm font-medium tracking-tight text-gray-900">{entry.cardNumber}</span>
                  </td>
                  <td classname="px-8 py-5">
                    <div classname="flex flex-col">
                      <span classname="font-bold text-sm tracking-tight">{formatCurrency(entry.amount)}</span>
                      <span classname="text-[10px] text-gray-400 font-bold uppercase">USD</span>
                    </div>
                  </td>
                  <td classname="px-8 py-5">
                    <span classname="text-xs text-gray-500 font-medium">
                      {new Date(entry.timestamp).toLocaleDateString()}
                    </span>
                  </td>
                  <td classname="px-8 py-5 text-right">
                    <div classname="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                      <button onclick="{()" ==""> onEdit(entry)}
                        className="p-2 text-gray-400 hover:text-accent rounded-lg hover:bg-accent/5 transition-all"
                      >
                        <edit3 classname="w-4 h-4"/>
                      </button>
                      <button onclick="{()" ==""> onDelete(entry.id)}
                        className="p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-all"
                      >
                        <trash2 classname="w-4 h-4"/>
                      </button>
                    </div>
                    <button classname="inline-block p-2 text-gray-400 sm:hidden group-hover:hidden">
                      <morevertical classname="w-4 h-4"/>
                    </button>
                  </td>
                </motion.tr>
              ))}
            </AnimatePresence>
            {paginatedEntries.length === 0 && (
              <tr>
                <td colspan="{4}" classname="px-8 py-20 text-center">
                  <div classname="flex flex-col items-center gap-3 text-gray-400">
                    <search classname="w-10 h-10 opacity-20"/>
                    <p classname="text-sm font-medium">No records found matching your search</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div classname="p-6 border-t border-gray-50 flex items-center justify-between">
        <p classname="text-xs text-gray-500 font-bold uppercase tracking-wider">
          Page {currentPage} of {totalPages || 1}
        </p>
        
        <div classname="flex items-center gap-2">
          <button disabled="{currentPage" =="=" 1}="" onclick="{()" ==""> setCurrentPage(prev => prev - 1)}
            className="p-2 bg-gray-50 text-gray-400 hover:text-black hover:bg-gray-100 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <chevronleft classname="w-5 h-5"/>
          </button>
          <button disabled="{currentPage">= totalPages}
            onClick={() => setCurrentPage(prev => prev + 1)}
            className="p-2 bg-gray-50 text-gray-400 hover:text-black hover:bg-gray-100 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <chevronright classname="w-5 h-5"/>
          </button>
        </div>
      </div>
    </div>
  );
}
