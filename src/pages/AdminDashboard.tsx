/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { HelpRequest } from '../types';
import { CATEGORIES, URGENCY_LEVELS, getCategory, getUrgency } from '../constants';
import { AlertCircle, Clock, MapPin, CheckCircle2, MoreVertical, Search, Filter } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function AdminDashboard() {
  const [requests, setRequests] = useState<HelpRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    const q = query(collection(db, 'requests'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as HelpRequest));
      setRequests(data);
      setLoading(false);
    }, (error) => {
      console.error("Firestore onSnapshot error:", error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const updateStatus = async (id: string, status: string) => {
    try {
      await updateDoc(doc(db, 'requests', id), { status });
    } catch (e) {
      console.error("Failed to update status:", e);
    }
  };

  const filteredRequests = filter === 'all' ? requests : requests.filter(r => r.urgency === filter);

  return (
    <div className="max-w-4xl mx-auto px-6 py-12 flex flex-col gap-8 bg-slate-50 min-h-screen">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 bg-white p-8 rounded-3xl border border-slate-100 shadow-soft">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 bg-red-500 rounded-full animate-pulse" />
            <h2 className="text-3xl font-black tracking-tighter text-slate-900 uppercase">Rescue Ops</h2>
          </div>
          <p className="text-slate-400 font-bold uppercase tracking-[0.2em] text-[10px]">Real-time Emergency Dispatch Console</p>
        </div>
        
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2 md:pb-0">
          {['all', 'high', 'medium', 'low'].map(f => (
            <button 
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${filter === f ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-400'}`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence mode="popLayout">
          {filteredRequests.map(request => (
            <motion.div
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              key={request.id}
              className={`p-6 rounded-[2rem] bg-white border-2 ${getUrgency(request.urgency).statusColor.replace('bg-', 'border-')} shadow-soft flex flex-col gap-5 relative overflow-hidden`}
            >
              {/* Top Row */}
              <div className="flex justify-between items-start">
                <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-[0.2em] ${getUrgency(request.urgency).statusColor} text-white`}>
                  {request.urgency}
                </div>
                <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${getCategory(request.category).bgColor} ${getCategory(request.category).color} border ${getCategory(request.category).borderColor || 'border-slate-100'}`}>
                  {request.category}
                </div>
              </div>

              {/* Content */}
              <div>
                <p className="text-slate-400 text-[9px] uppercase font-bold tracking-widest mb-1">Problem Description</p>
                <p className="text-slate-800 font-bold leading-tight line-clamp-2 text-sm">{request.problem}</p>
              </div>

              <div className="flex flex-wrap gap-2">
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 text-slate-500 rounded-lg text-[9px] font-bold uppercase tracking-wider border border-slate-100">
                  <Clock className="w-2.5 h-2.5" /> {request.createdAt && (request.createdAt as any).toDate ? (request.createdAt as any).toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...'}
                </div>
                {request.location && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 text-slate-500 rounded-lg text-[9px] font-bold uppercase tracking-wider border border-slate-100">
                    <MapPin className="w-2.5 h-2.5" /> {request.location.latitude.toFixed(2)}, {request.location.longitude.toFixed(2)}
                  </div>
                )}
              </div>

              {/* Status Actions */}
              <div className="mt-auto pt-5 flex items-center justify-between border-t border-slate-50">
                <div className="flex flex-col">
                   <span className="text-[8px] font-black uppercase tracking-widest text-slate-300">Phase</span>
                   <span className={`text-[10px] font-black uppercase tracking-widest ${request.status === 'resolved' ? 'text-emerald-500' : 'text-slate-900'}`}>
                    {request.status}
                  </span>
                </div>
                <div className="flex gap-2">
                  {request.status === 'pending' && (
                    <button 
                      onClick={() => updateStatus(request.id, 'active')}
                      className="px-3 py-2 bg-blue-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md shadow-blue-100 hover:bg-blue-600 transition-colors"
                    >
                      Dispatch
                    </button>
                  )}
                  {request.status === 'active' && (
                    <button 
                      onClick={() => updateStatus(request.id, 'resolved')}
                      className="p-2 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 border border-emerald-100 transition-colors"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {filteredRequests.length === 0 && !loading && (
        <div className="flex flex-col items-center justify-center py-20 text-slate-300">
          <Search className="w-12 h-12 mb-4 opacity-20" />
          <p className="font-bold uppercase tracking-widest text-xs">No requests found</p>
        </div>
      )}
    </div>
  );
}
