import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LogIn, Lock, User, AlertCircle, Eye, EyeOff, TrendingUp } from 'lucide-react';
import { authService } from '../services/authService';

interface LoginProps {
  onLogin: () => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const user = await authService.login(username, password);
      if (user) {
        onLogin();
      } else {
        setError('Invalid username or password (Hint: admin/password)');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div classname="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <motion.div initial="{{" opacity:="" 0,="" scale:="" 0.95="" }}="" animate="{{" opacity:="" 1,="" scale:="" 1="" }}="" classname="w-full max-w-[1100px] h-[750px] bg-white rounded-[32px] overflow-hidden shadow-2xl flex flex-col md:flex-row">
        {/* Left Section: Form */}
        <div classname="flex-1 p-12 lg:p-16 flex flex-col overflow-y-auto">
          <div classname="flex items-center gap-2 mb-16">
            <div classname="w-8 h-8 bg-blue-600 flex items-center justify-center rounded-lg">
              <trendingup classname="text-white w-5 h-5"/>
            </div>
            <span classname="text-xl font-black text-gray-900 tracking-tight">Signapay</span>
          </div>

          <div classname="flex-1 flex flex-col justify-center max-w-[400px] mx-auto w-full">
            <div classname="text-center mb-10">
              <h2 classname="text-4xl font-extrabold text-gray-900 tracking-tight mb-3">Welcome Back</h2>
              <p classname="text-gray-500 text-sm">Enter your email and password to access your account.</p>
            </div>

            <form onsubmit="{handleSubmit}" classname="space-y-6">
              <div classname="space-y-2">
                <label classname="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Username</label>
                <div classname="relative">
                  <user classname="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"/>
                  <input type="text" required="" value="{username}" onchange="{(e)" ==""> setUsername(e.target.value)}
                    className="w-full pl-11 pr-4 py-3.5 bg-gray-50/50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-blue-600/10 focus:border-blue-600 transition-all outline-none text-sm"
                    placeholder="admin"
                  />
                </div>
              </div>

              <div classname="space-y-2">
                <label classname="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Password</label>
                <div classname="relative">
                  <lock classname="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"/>
                  <input type="{showPassword" ?="" 'text'="" :="" 'password'}="" required="" value="{password}" onchange="{(e)" ==""> setPassword(e.target.value)}
                    className="w-full pl-11 pr-12 py-3.5 bg-gray-50/50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-blue-600/10 focus:border-blue-600 transition-all outline-none text-sm"
                    placeholder="••••••••"
                  />
                  <button type="button" onclick="{()" ==""> setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <eyeoff classname="w-4 h-4"/> : <eye classname="w-4 h-4"/>}
                  </button>
                </div>
              </div>

              <div classname="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider">
                <label classname="flex items-center gap-2 text-gray-400 cursor-pointer group">
                  <input type="checkbox" classname="w-4 h-4 rounded-md border-gray-200 text-blue-600 focus:ring-blue-600"/>
                  <span classname="group-hover:text-gray-600 transition-colors">Remember Me</span>
                </label>
                <a href="#" classname="text-blue-600 hover:text-blue-700 transition-colors">Forgot Your Password?</a>
              </div>

              <animatepresence>
                {error && (
                  <motion.div initial="{{" opacity:="" 0,="" y:="" -10="" }}="" animate="{{" opacity:="" 1,="" y:="" 0="" }}="" classname="flex items-center gap-2 text-red-500 text-xs font-bold bg-red-50 p-3 rounded-xl border border-red-100">
                    <alertcircle classname="w-4 h-4 shrink-0"/>
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              <button type="submit" disabled="{loading}" classname="w-full bg-blue-600 text-white py-4 rounded-xl font-black text-sm uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-600/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                {loading ? (
                  <div classname="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>
                ) : (
                  'Log In'
                )}
              </button>

              <div classname="relative py-4">
                <div classname="absolute inset-0 flex items-center"><div classname="w-full border-t border-gray-100"></div></div>
                <div classname="relative flex justify-center text-[10px] uppercase font-black tracking-widest"><span classname="bg-white px-4 text-gray-400">Or Login With</span></div>
              </div>

              <div classname="grid grid-cols-2 gap-4">
                <button type="button" classname="flex items-center justify-center gap-2 py-3 bg-gray-50 border border-gray-100 rounded-xl hover:bg-gray-100 transition-all">
                  <img src="https://www.google.com/favicon.ico" classname="w-4 h-4" alt="Google"/>
                  <span classname="text-xs font-bold">Google</span>
                </button>
                <button type="button" classname="flex items-center justify-center gap-2 py-3 bg-gray-50 border border-gray-100 rounded-xl hover:bg-gray-100 transition-all">
                  <div classname="w-4 h-4 bg-black flex items-center justify-center rounded-sm text-white text-[10px] font-black">A</div>
                  <span classname="text-xs font-bold">Apple</span>
                </button>
              </div>
            </form>

            <p classname="mt-10 text-center text-xs font-bold text-gray-400">
              Don't Have An Account? <a href="#" classname="text-blue-600 hover:underline px-1">Register Now.</a>
            </p>
          </div>

          <div classname="mt-auto pt-10 flex items-center justify-between text-[10px] font-bold text-gray-300 uppercase tracking-widest">
            <span>Copyright © 2026 Signapay LTD.</span>
            <a href="#" classname="hover:text-gray-400 transition-colors">Privacy Policy</a>
          </div>
        </div>

        {/* Right Section: Branding/Mockup */}
        <div classname="hidden md:flex flex-1 bg-blue-600 relative overflow-hidden p-16 flex-col items-center justify-center">
          {/* Abstract Grid Pattern */}
          <div classname="absolute inset-0 opacity-10" style="{{" backgroundimage:="" 'radial-gradient(#fff="" 2px,="" transparent="" 2px)',="" backgroundsize:="" '40px="" 40px'="" }}=""/>
          
          <div classname="relative z-10 text-center text-white mb-16">
            <h3 classname="text-4xl font-black mb-4 leading-tight">Effortlessly manage your team and operations.</h3>
            <p classname="text-blue-100 opacity-80 font-medium">Log in to access your CRM dashboard and manage your team.</p>
          </div>

          {/* Mockup Dashboard Image */}
          <div classname="relative z-10 w-full max-w-[480px] aspect-[16/10] bg-white/10 backdrop-blur-3xl rounded-[24px] border border-white/20 shadow-2xl p-4 overflow-hidden group">
            <div classname="w-full h-full rounded-[18px] bg-white overflow-hidden shadow-inner">
               {/* Simplified Mockup Content */}
               <div classname="h-8 bg-gray-50 border-b border-gray-100 flex items-center px-4 gap-2">
                 <div classname="w-2 h-2 rounded-full bg-red-400"/>
                 <div classname="w-2 h-2 rounded-full bg-yellow-400"/>
                 <div classname="w-2 h-2 rounded-full bg-green-400"/>
               </div>
               <div classname="p-4 space-y-4">
                 <div classname="grid grid-cols-2 gap-3">
                   <div classname="h-20 bg-blue-50 rounded-xl"/>
                   <div classname="h-20 bg-gray-50 rounded-xl"/>
                 </div>
                 <div classname="h-32 bg-gray-50 rounded-xl"/>
                 <div classname="space-y-2">
                   <div classname="h-6 bg-gray-100 rounded w-full"/>
                   <div classname="h-6 bg-gray-50 rounded w-3/4"/>
                   <div classname="h-6 bg-gray-100 rounded w-1/2"/>
                 </div>
               </div>
            </div>
            {/* Animated Glow */}
            <div classname="absolute inset-0 bg-gradient-to-tr from-blue-600/0 via-white/10 to-blue-600/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"/>
          </div>
          
          {/* Subtle decoration */}
          <div classname="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500 rounded-full blur-[100px] opacity-30"/>
          <div classname="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-white rounded-full blur-[120px] opacity-10"/>
        </div>
      </motion.div>
    </div>
  );
}
