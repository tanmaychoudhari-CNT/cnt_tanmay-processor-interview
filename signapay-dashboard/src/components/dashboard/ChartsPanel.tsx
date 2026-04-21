import React from 'react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell
} from 'recharts';
import { Entry } from '../../types';

interface ChartsPanelProps {
  entries: Entry[];
}

export default function ChartsPanel({ entries }: ChartsPanelProps) {
  // Process data for trend chart (last 7 days or points)
  const trendData = entries
    .slice()
    .sort((a, b) => a.timestamp - b.timestamp)
    .map(e => ({
      time: new Date(e.timestamp).toLocaleDateString(),
      amount: e.amount
    }));

  // Process data for distribution chart
  const amountRanges = [
    { name: '0-1k', min: 0, max: 1000, count: 0 },
    { name: '1k-5k', min: 1000, max: 5000, count: 0 },
    { name: '5k-10k', min: 5000, max: 10000, count: 0 },
    { name: '10k+', min: 10000, max: Infinity, count: 0 },
  ];

  entries.forEach(e => {
    const range = amountRanges.find(r => e.amount >= r.min && e.amount < r.max);
    if (range) range.count++;
  });

  return (
    <div classname="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      <div classname="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
        <div classname="flex items-center justify-between mb-8">
          <div>
            <h3 classname="text-lg font-black tracking-tight">Financial Trends</h3>
            <p classname="text-xs text-gray-500 font-bold uppercase tracking-widest mt-1">Movement Analysis</p>
          </div>
          <div classname="px-3 py-1 bg-accent/10 text-accent text-[10px] font-black uppercase rounded-full">Real-time</div>
        </div>
        
        <div classname="h-64 w-full">
          <responsivecontainer width="100%" height="100%">
            <areachart data="{trendData}">
              <defs>
                <lineargradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopcolor="#00A0DD" stopopacity="{0.3}/">
                  <stop offset="95%" stopcolor="#00A0DD" stopopacity="{0}/">
                </linearGradient>
              </defs>
              <cartesiangrid strokedasharray="3 3" vertical="{false}" stroke="#F3F4F6"/>
              <xaxis datakey="time" axisline="{false}" tickline="{false}" tick="{{" fontsize:="" 10,="" fill:="" '#9ca3af',="" fontweight:="" 'bold'="" }}=""/>
              <yaxis axisline="{false}" tickline="{false}" tick="{{" fontsize:="" 10,="" fill:="" '#9ca3af',="" fontweight:="" 'bold'="" }}="" tickformatter="{(val)" ==""> `$${val/1000}k`}
              />
              <tooltip contentstyle="{{" borderradius:="" '16px',="" border:="" 'none',="" boxshadow:="" '0="" 10px="" 30px="" rgba(0,0,0,0.1)',="" padding:="" '12px'="" }}=""/>
              <area type="monotone" datakey="amount" stroke="#00A0DD" strokewidth="{3}" fillopacity="{1}" fill="url(#colorAmount)"/>
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div classname="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
        <div classname="flex items-center justify-between mb-8">
          <div>
            <h3 classname="text-lg font-black tracking-tight">Distribution</h3>
            <p classname="text-xs text-gray-500 font-bold uppercase tracking-widest mt-1">Amount Segmentation</p>
          </div>
        </div>

        <div classname="h-64 w-full">
          <responsivecontainer width="100%" height="100%">
            <barchart data="{amountRanges}">
              <cartesiangrid strokedasharray="3 3" vertical="{false}" stroke="#F3F4F6"/>
              <xaxis datakey="name" axisline="{false}" tickline="{false}" tick="{{" fontsize:="" 10,="" fill:="" '#9ca3af',="" fontweight:="" 'bold'="" }}=""/>
              <yaxis axisline="{false}" tickline="{false}" tick="{{" fontsize:="" 10,="" fill:="" '#9ca3af',="" fontweight:="" 'bold'="" }}=""/>
              <tooltip cursor="{{" fill:="" '#f9fafb'="" }}="" contentstyle="{{" borderradius:="" '16px',="" border:="" 'none',="" boxshadow:="" '0="" 10px="" 30px="" rgba(0,0,0,0.1)',="" padding:="" '12px'="" }}=""/>
              <bar datakey="count" radius="{[8," 8,="" 0,="" 0]}="">
                {amountRanges.map((_, index) => (
                  <cell key="{`cell-${index}`}" fill="{index" %="" 2="==" 0="" ?="" '#141414'="" :="" '#00a0dd'}=""/>
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
