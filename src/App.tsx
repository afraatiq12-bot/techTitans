/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db } from './lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Shield, User as UserIcon, History, LayoutDashboard, Home as HomeIcon } from 'lucide-react';
import Home from './pages/Home';
import Profile from './pages/Profile';
import AdminDashboard from './pages/AdminDashboard';
import Login from './pages/Login';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Double check admin status by collection or email
        const adminDoc = await getDoc(doc(db, 'admins', currentUser.uid));
        const isEmailAdmin = currentUser.email === 'nafeesahoorain827@gmail.com';
        setIsAdmin(adminDoc.exists() || isEmailAdmin);
      } else {
        setIsAdmin(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="animate-pulse flex flex-col items-center">
          <Shield className="w-12 h-12 text-red-600 mb-4" />
          <p className="text-slate-600 font-medium">Loading RescueRouter...</p>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-50 flex flex-col">
        {/* Main Content */}
        <main className="flex-grow pb-24 lg:pb-0">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route 
              path="/profile" 
              element={user ? <Profile /> : <Navigate to="/login" />} 
            />
            <Route 
              path="/admin" 
              element={isAdmin ? <AdminDashboard /> : <Navigate to="/" />} 
            />
          </Routes>
        </main>

        {/* Bottom Navigation (Mobile) */}
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-6 py-3 flex justify-between items-center z-50 lg:hidden">
          <Link to="/" className="flex flex-col items-center gap-1">
            <HomeIcon className="w-6 h-6 text-slate-600" />
            <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">Home</span>
          </Link>
          <Link to="/profile" className="flex flex-col items-center gap-1">
            <UserIcon className="w-6 h-6 text-slate-600" />
            <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">Profile</span>
          </Link>
          {isAdmin && (
            <Link to="/admin" className="flex flex-col items-center gap-1">
              <LayoutDashboard className="w-6 h-6 text-slate-600" />
              <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">Admin</span>
            </Link>
          )}
        </nav>

        {/* Top Header (Desktop) */}
        <header className="hidden lg:flex items-center justify-between px-8 py-4 bg-white border-b border-slate-200 sticky top-0 z-50">
          <Link to="/" className="flex items-center gap-2">
            <Shield className="w-8 h-8 text-red-600" />
            <h1 className="font-bold text-xl tracking-tight text-slate-900">RescueRouter</h1>
          </Link>
          <div className="flex items-center gap-6">
            <Link to="/" className="text-sm font-medium text-slate-600 hover:text-red-600 transition-colors">Home</Link>
            <Link to="/profile" className="text-sm font-medium text-slate-600 hover:text-red-600 transition-colors">Profile</Link>
            {isAdmin && (
              <Link to="/admin" className="text-sm font-medium text-slate-600 hover:text-red-600 transition-colors">Dashboard</Link>
            )}
            {!user && (
              <Link to="/login" className="px-4 py-2 bg-red-600 text-white rounded-full text-sm font-semibold hover:bg-red-700 transition-colors">Sign In</Link>
            )}
          </div>
        </header>
      </div>
    </BrowserRouter>
  );
}
