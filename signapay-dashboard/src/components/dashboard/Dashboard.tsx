import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Navbar, SummaryPanel, DetailedSummary } from './Layout';
import DataGrid from './DataGrid';
import ChartsPanel from './ChartsPanel';
import DataInput from './DataInput';
import { dataService } from '../../services/dataService';
import { Entry, User, DashboardStats } from '../../types';

interface DashboardProps {
  user: User;
}

export default function Dashboard({ user }: DashboardProps) {
  const [entries, setEntries] = useState<entry[]>([]);
  const [stats, setStats] = useState<dashboardstats>({ 
    totalEntries: 0, 
    totalAmount: 0, 
    averageAmount: 0,
    highestAmount: 0,
    lowestAmount: 0
  });
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await dataService.getEntries();
      setEntries(data);
      calculateStats(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const calculateStats = (data: Entry[]) => {
    const totalEntries = data.length;
    const totalAmount = data.reduce((acc, curr) => acc + curr.amount, 0);
    const averageAmount = totalEntries > 0 ? totalAmount / totalEntries : 0;
    
    let highestAmount = 0;
    let lowestAmount = 0;
    
    if (data.length > 0) {
      const sortedByAmount = [...data].sort((a, b) => b.amount - a.amount);
      highestAmount = sortedByAmount[0].amount;
      lowestAmount = sortedByAmount[sortedByAmount.length - 1].amount;
    }

    setStats({ 
      totalEntries, 
      totalAmount, 
      averageAmount,
      highestAmount,
      lowestAmount
    });
  };

  const handleAddMany = async (newEntries: Omit<entry, 'id'="" |="" 'timestamp'="">[]) => {
    await dataService.addManyEntries(newEntries);
    loadData();
  };

  const handleDelete = async (id: string) => {
    await dataService.deleteEntry(id);
    loadData();
  };

  const handleEdit = async (entry: Entry) => {
    const newAmount = prompt('Enter new amount:', entry.amount.toString());
    if (newAmount !== null) {
      const amount = parseFloat(newAmount);
      if (!isNaN(amount)) {
        await dataService.updateEntry(entry.id, { amount });
        loadData();
      }
    }
  };

  if (loading && entries.length === 0) {
    return (
      <div classname="min-h-screen bg-white flex items-center justify-center">
        <div classname="flex flex-col items-center gap-4">
          <div classname="w-12 h-12 border-4 border-accent/20 border-t-accent rounded-full animate-spin"/>
          <p classname="text-xs font-black uppercase tracking-widest text-gray-400">Loading Intelligence...</p>
        </div>
      </div>
    );
  }

  return (
    <div classname="min-h-screen bg-[#F9FAFB]">
      <navbar username="{user.username}"/>
      
      <main classname="p-8 max-w-[1600px] mx-auto">
        <header classname="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 classname="text-4xl font-black tracking-tight text-gray-900">Dashboard Overview</h1>
            <p classname="text-gray-500 font-medium mt-1">Manage financial interactions and growth metrics</p>
          </div>
          <div classname="flex items-center gap-3">
             <div classname="px-4 py-2 bg-white border border-gray-100 rounded-xl text-xs font-bold shadow-sm">
               System Status: <span classname="text-green-500">Optimal</span>
             </div>
          </div>
        </header>

        <summarypanel stats="{stats}"/>

        <div classname="mt-10">
          <div classname="mb-6 flex items-center justify-between">
            <h3 classname="text-lg font-black tracking-tight text-gray-900">Data Injection</h3>
            <span classname="text-[10px] font-black uppercase tracking-widest text-gray-400">Control Panel</span>
          </div>
          <div classname="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div classname="lg:col-span-2">
              <datainput onaddmany="{handleAddMany}" onaddone="{(e)" ==""> handleAddMany([e])} 
              />
            </div>
            <div classname="lg:col-span-1">
              <detailedsummary stats="{stats}"/>
            </div>
          </div>
        </div>

        <div classname="mt-10 space-y-8">
          <chartspanel entries="{entries}"/>
          <datagrid entries="{entries}" ondelete="{handleDelete}" onedit="{handleEdit}"/>
        </div>
      </main>
    </div>
  );
}
