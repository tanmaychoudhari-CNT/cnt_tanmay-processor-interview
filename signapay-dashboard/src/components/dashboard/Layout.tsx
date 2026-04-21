import React from 'react';
import { motion } from 'motion/react';
import { 
  Users, 
  DollarSign, 
  TrendingUp, 
  PieChart as PieChartIcon,
  Search,
  Plus,
  LogOut,
  Bell,
  Settings as SettingsIcon,
  ArrowUpRight,
  ArrowDownRight,
  Activity
} from 'lucide-react';

// ... (previous components)

export function DetailedSummary({ stats }: { stats: DashboardStats }) {
  const items = [
    { label: 'Total entries', value: stats.totalEntries, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Total amount', value: formatCurrency(stats.totalAmount), icon: DollarSign, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Average amount', value: formatCurrency(stats.averageAmount), icon: Activity, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'Highest', value: formatCurrency(stats.highestAmount), icon: ArrowUpRight, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Lowest', value: formatCurrency(stats.lowestAmount), icon: ArrowDownRight, color: 'text-rose-600', bg: 'bg-rose-50' },
  ];

  return (
    <div classname="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 space-y-6">
      <div classname="flex items-center justify-between">
        <h3 classname="text-lg font-black tracking-tight text-gray-900">Summary</h3>
        <div classname="w-2 h-2 rounded-full bg-green-500 animate-pulse"/>
      </div>

      <div classname="space-y-4">
        {items.map((item, i) => (
          <motion.div key="{item.label}" initial="{{" opacity:="" 0,="" x:="" 20="" }}="" animate="{{" opacity:="" 1,="" x:="" 0="" }}="" transition="{{" delay:="" i="" *="" 0.1="" }}="" classname="flex items-center justify-between group">
            <div classname="flex items-center gap-3">
              <div classname="{cn(&#34;p-2" rounded-lg="" transition-transform="" group-hover:scale-110",="" item.bg,="" item.color)}="">
                <item.icon classname="w-4 h-4"/>
              </div>
              <span classname="text-sm font-medium text-gray-500">{item.label}</span>
            </div>
            <span classname="{cn(" "text-sm="" font-bold="" tracking-tight",="" item.label.tolowercase().includes('amount')="" ||="" item.label.tolowercase().includes('highest')="" ||="" item.label.tolowercase().includes('lowest')="" ?="" (item.value.tostring().includes('-')="" ?="" 'text-rose-500'="" :="" 'text-gray-900')="" :="" 'text-gray-900'="" )}="">
              {item.value}
            </span>
          </motion.div>
        ))}
      </div>

      <div classname="pt-4 border-t border-gray-50">
        <div classname="bg-gray-50 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p classname="text-[10px] font-black uppercase tracking-widest text-gray-400">Monthly Yield</p>
            <p classname="text-sm font-bold text-gray-900">Signapay Pulse</p>
          </div>
          <div classname="h-8 w-24 bg-blue-100 rounded-lg overflow-hidden relative">
            <motion.div animate="{{" x:="" [-100,="" 100],="" }}="" transition="{{" duration:="" 2,="" repeat:="" infinity,="" ease:="" "linear"="" }}="" classname="absolute inset-0 bg-gradient-to-r from-transparent via-blue-400/30 to-transparent"/>
          </div>
        </div>
      </div>
    </div>
  );
}
import { authService } from '../../services/authService';
import { formatCurrency, cn } from '../../lib/utils';
import { DashboardStats, Entry } from '../../types';

interface NavbarProps {
  username: string;
}

export function Navbar({ username }: NavbarProps) {
  return (
    <nav classname="h-20 bg-white border-b border-gray-100 px-8 flex items-center justify-between sticky top-0 z-50">
      <div classname="flex items-center gap-10">
        <div classname="flex items-center gap-3">
          <div classname="w-10 h-10 bg-black flex items-center justify-center rounded-lg shadow-lg">
            <trendingup classname="text-accent w-5 h-5"/>
          </div>
          <span classname="text-xl font-bold tracking-tight">Signapay</span>
        </div>

        <div classname="relative hidden md:block">
          <search classname="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"/>
          <input type="text" placeholder="Search resources..." classname="pl-11 pr-4 py-2.5 bg-gray-50 border-none rounded-full w-80 text-sm focus:ring-2 focus:ring-accent/20 outline-none transition-all"/>
        </div>
      </div>

      <div classname="flex items-center gap-6">
        <div classname="flex items-center gap-2 pr-6 border-r border-gray-100">
          <button classname="p-2.5 text-gray-400 hover:text-black hover:bg-gray-50 rounded-full transition-all">
            <bell classname="w-5 h-5"/>
          </button>
          <button classname="p-2.5 text-gray-400 hover:text-black hover:bg-gray-50 rounded-full transition-all">
            <settingsicon classname="w-5 h-5"/>
          </button>
        </div>

        <div classname="flex items-center gap-4">
          <div classname="text-right hidden sm:block">
            <p classname="text-sm font-bold capitalize">{username}</p>
            <p classname="text-xs text-gray-500 font-medium">Administrator</p>
          </div>
          <button onclick="{()" ==""> authService.logout()}
            className="w-10 h-10 bg-gray-50 flex items-center justify-center rounded-full text-gray-600 hover:bg-red-50 hover:text-red-500 transition-all"
          >
            <logout classname="w-5 h-5"/>
          </button>
        </div>
      </div>
    </nav>
  );
}

export function SummaryPanel({ stats }: { stats: DashboardStats }) {
  const cards = [
    { label: 'Total Entries', value: stats.totalEntries, icon: Users, color: 'bg-black' },
    { label: 'Total Amount', value: formatCurrency(stats.totalAmount), icon: DollarSign, color: 'bg-accent' },
    { label: 'Average Value', value: formatCurrency(stats.averageAmount), icon: TrendingUp, color: 'bg-black' },
    { label: 'Growth Score', value: '+12.4%', icon: PieChartIcon, color: 'bg-accent' },
  ];

  return (
    <div classname="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {cards.map((card, i) => (
        <motion.div key="{card.label}" initial="{{" opacity:="" 0,="" y:="" 20="" }}="" animate="{{" opacity:="" 1,="" y:="" 0="" }}="" transition="{{" delay:="" i="" *="" 0.1="" }}="" classname="bg-white p-6 rounded-2xl shadow-sm border border-gray-50 group hover:shadow-xl hover:shadow-gray-200/50 transition-all duration-300">
          <div classname="flex items-start justify-between mb-4">
            <div classname="{cn(&#34;p-3" rounded-xl="" text-white="" shadow-lg",="" card.color)}="">
              <card.icon classname="w-5 h-5"/>
            </div>
            <span classname="text-[10px] font-bold uppercase tracking-widest text-gray-400 px-2 py-1 bg-gray-50 rounded-md">Live</span>
          </div>
          <p classname="text-gray-500 text-sm font-medium">{card.label}</p>
          <h3 classname="text-2xl font-black mt-1 tracking-tight">{card.value}</h3>
        </motion.div>
      ))}
    </div>
  );
}


