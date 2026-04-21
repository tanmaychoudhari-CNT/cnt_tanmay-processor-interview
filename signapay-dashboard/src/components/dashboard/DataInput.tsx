import React, { useRef, useState } from 'react';
import { Upload, FileCode, FileType, Plus, Save, Trash2, X } from 'lucide-react';
import Papa from 'papaparse';
import { parseString } from 'xml2js';
import { Entry } from '../../types';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface DataInputProps {
  onAddMany: (entries: Omit<entry, 'id'="" |="" 'timestamp'="">[]) => void;
  onAddOne: (entry: Omit<entry, 'id'="" |="" 'timestamp'="">) => void;
}

export default function DataInput({ onAddMany, onAddOne }: DataInputProps) {
  const [activeTab, setActiveTab] = useState<'upload' | 'manual'>('upload');
  const [manualEntries, setManualEntries] = useState<omit<entry, 'id'="" |="" 'timestamp'="">[]>([{ cardNumber: '', amount: 0 }]);
  const [isParsing, setIsParsing] = useState(false);
  const fileInputRef = useRef<htmlinputelement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<htmlinputelement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsing(true);
    const reader = new FileReader();

    reader.onload = async (event) => {
      const content = event.target?.result as string;
      const extension = file.name.split('.').pop()?.toLowerCase();

      let parsedData: any[] = [];

      try {
        if (extension === 'csv') {
          const results = Papa.parse(content, { header: true, skipEmptyLines: true });
          parsedData = results.data;
        } else if (extension === 'json') {
          parsedData = JSON.parse(content);
          if (!Array.isArray(parsedData)) parsedData = [parsedData];
        } else if (extension === 'xml') {
          parseString(content, (err, result) => {
            if (!err) {
              // Simple extraction logic for XML
              const root = result[Object.keys(result)[0]];
              const items = root[Object.keys(root)[0]];
              parsedData = Array.isArray(items) ? items : [items];
            }
          });
        }

        const formattedEntries = parsedData.map(item => ({
          cardNumber: item.cardNumber || item.card_number || item.CardNumber || '',
          amount: parseFloat(item.amount || item.Amount || 0)
        })).filter(e => e.cardNumber && !isNaN(e.amount));

        if (formattedEntries.length > 0) {
          onAddMany(formattedEntries);
        }
      } catch (err) {
        alert('Error parsing file. Please check format.');
      } finally {
        setIsParsing(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };

    reader.readAsText(file);
  };

  const addManualRow = () => {
    setManualEntries([...manualEntries, { cardNumber: '', amount: 0 }]);
  };

  const removeManualRow = (index: number) => {
    setManualEntries(manualEntries.filter((_, i) => i !== index));
  };

  const updateManualRow = (index: number, field: keyof Entry, value: string | number) => {
    const newEntries = [...manualEntries];
    (newEntries[index] as any)[field] = value;
    setManualEntries(newEntries);
  };

  const submitManual = () => {
    const validEntries = manualEntries.filter(e => e.cardNumber.trim() !== '' && e.amount > 0);
    if (validEntries.length > 0) {
      onAddMany(validEntries);
      setManualEntries([{ cardNumber: '', amount: 0 }]);
      setActiveTab('upload');
    }
  };

  return (
    <div classname="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden h-full flex flex-col">
      <div classname="flex border-b border-gray-50">
        <button onclick="{()" ==""> setActiveTab('upload')}
          className={cn(
            "flex-1 py-4 text-[10px] font-black uppercase tracking-widest transition-all",
            activeTab === 'upload' ? "bg-black text-white" : "bg-white text-gray-400 hover:text-black"
          )}
        >
          File Import
        </button>
        <button onclick="{()" ==""> setActiveTab('manual')}
          className={cn(
            "flex-1 py-4 text-[10px] font-black uppercase tracking-widest transition-all",
            activeTab === 'manual' ? "bg-black text-white" : "bg-white text-gray-400 hover:text-black"
          )}
        >
          Manual Entry
        </button>
      </div>

      <div classname="p-6 flex-1 flex flex-col">
        {activeTab === 'upload' ? (
          <div classname="flex-1 flex flex-col items-center justify-center p-8 border-2 border-dashed border-gray-100 rounded-2xl group hover:border-accent hover:bg-accent/5 transition-all cursor-pointer" onclick="{()" ==""> fileInputRef.current?.click()}>
            <input type="file" ref="{fileInputRef}" onchange="{handleFileUpload}" accept=".csv,.json,.xml" classname="hidden"/>
            
            <div classname="w-16 h-16 bg-gray-50 flex items-center justify-center rounded-2xl mb-4 group-hover:scale-110 transition-all duration-300">
              <upload classname="w-8 h-8 text-gray-400 group-hover:text-accent"/>
            </div>
            
            <p classname="text-sm font-bold text-gray-900">Choose file to upload</p>
            <p classname="text-xs text-gray-500 mt-1">Supports CSV, JSON, and XML formats</p>
            
            <div classname="mt-8 flex gap-3 text-gray-300">
              <filetype classname="w-5 h-5"/>
              <filecode classname="w-5 h-5"/>
            </div>
            
            {isParsing && (
              <div classname="mt-6 flex items-center gap-2 text-accent font-bold text-xs uppercase tracking-widest animate-pulse">
                <div classname="w-2 h-2 bg-accent rounded-full animate-ping"/>
                Parsing Intelligence...
              </div>
            )}
          </div>
        ) : (
          <div classname="flex-1 flex flex-col">
            <div classname="flex-1 overflow-y-auto space-y-3 max-h-[400px] mb-4 pr-2">
              <animatepresence initial="{false}">
                {manualEntries.map((e, index) => (
                  <motion.div initial="{{" opacity:="" 0,="" x:="" -20="" }}="" animate="{{" opacity:="" 1,="" x:="" 0="" }}="" exit="{{" opacity:="" 0,="" x:="" 20="" }}="" key="{index}" classname="flex items-center gap-3">
                    <div classname="flex-1 bg-gray-50 rounded-xl px-4 py-3 border border-transparent focus-within:border-accent transition-all">
                      <input type="text" placeholder="Card Number" value="{e.cardNumber}" onchange="{(ev)" ==""> updateManualRow(index, 'cardNumber', ev.target.value)}
                        className="bg-transparent border-none outline-none text-sm font-mono w-full"
                      />
                    </div>
                    <div classname="w-32 bg-gray-50 rounded-xl px-4 py-3 border border-transparent focus-within:border-accent transition-all relative">
                      <span classname="absolute left-3 text-gray-400 text-xs font-bold leading-none top-3.5">$</span>
                      <input type="number" placeholder="0.00" value="{e.amount" ||="" ''}="" onchange="{(ev)" ==""> updateManualRow(index, 'amount', parseFloat(ev.target.value))}
                        className="bg-transparent border-none outline-none text-sm font-bold w-full pl-3"
                      />
                    </div>
                    <button onclick="{()" ==""> removeManualRow(index)}
                      className="p-3 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                    >
                      <x classname="w-4 h-4"/>
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
            
            <div classname="flex gap-3">
              <button onclick="{addManualRow}" classname="flex-[2] py-4 bg-gray-100 text-black rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-gray-200 transition-all flex items-center justify-center gap-2">
                <plus classname="w-4 h-4"/> Add Row
              </button>
              <button onclick="{submitManual}" classname="flex-[3] py-4 bg-black text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-gray-900 transition-all flex items-center justify-center gap-2 shadow-lg shadow-black/10">
                <save classname="w-4 h-4"/> Push All Entries
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
