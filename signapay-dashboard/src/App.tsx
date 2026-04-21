/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import Dashboard from './components/dashboard/Dashboard';
import { authService } from './services/authService';
import { User } from './types';

export default function App() {
  const [user, setUser] = useState<user |="" null="">(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const currentUser = authService.getCurrentUser();
    setUser(currentUser);
    setLoading(false);
  }, []);

  const handleLogin = () => {
    setUser(authService.getCurrentUser());
  };

  if (loading) {
    return (
      <div classname="min-h-screen bg-black flex items-center justify-center">
        <div classname="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin"/>
      </div>
    );
  }

  return (
    <>
      {user ? (
        <dashboard user="{user}"/>
      ) : (
        <login onlogin="{handleLogin}"/>
      )}
    </>
  );
}

