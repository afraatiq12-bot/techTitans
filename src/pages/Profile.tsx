/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { User, Phone, LogOut, Plus, Trash2, Heart, Save } from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp as firestoreServerTimestamp } from 'firebase/firestore';
import { UserProfile, EmergencyContact } from '../types';
import { signOut } from 'firebase/auth';
import { handleFirestoreError, OperationType } from '../lib/firebase';

export default function Profile() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    if (!auth.currentUser) return;
    const docRef = doc(db, 'users', auth.currentUser.uid);
    try {
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setProfile({ 
          ...data, 
          id: auth.currentUser.uid,
          createdAt: data.createdAt?.toMillis?.() || data.createdAt 
        } as UserProfile);
      } else {
        // Create default
        const defaultProfile = {
          name: auth.currentUser.displayName || 'Rescue User',
          email: auth.currentUser.email || '',
          emergencyContacts: [],
          createdAt: firestoreServerTimestamp()
        };
        await setDoc(docRef, defaultProfile);
        setProfile({
          id: auth.currentUser.uid,
          name: defaultProfile.name,
          email: defaultProfile.email,
          emergencyContacts: [],
          createdAt: Date.now()
        });
      }
    } catch (e) {
      console.error(e);
      handleFirestoreError(e, OperationType.GET, 'users');
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!auth.currentUser || !profile) return;
    setIsSaving(true);
    const path = `users/${auth.currentUser.uid}`;
    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        name: profile.name,
        bloodGroup: profile.bloodGroup || '',
        emergencyContacts: profile.emergencyContacts
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, path);
    } finally {
      setIsSaving(false);
    }
  };

  const addContact = () => {
    if (!profile) return;
    setProfile({
      ...profile,
      emergencyContacts: [...profile.emergencyContacts, { name: '', phone: '', relation: '' }]
    });
  };

  const updateContact = (index: number, field: keyof EmergencyContact, value: string) => {
    if (!profile) return;
    const newContacts = [...profile.emergencyContacts];
    newContacts[index] = { ...newContacts[index], [field]: value };
    setProfile({ ...profile, emergencyContacts: newContacts });
  };

  const deleteContact = (index: number) => {
    if (!profile) return;
    setProfile({
      ...profile,
      emergencyContacts: profile.emergencyContacts.filter((_, i) => i !== index)
    });
  };

  if (loading) return null;

  return (
    <div className="max-w-md mx-auto px-6 py-12 flex flex-col gap-10">
      <div className="flex justify-between items-start">
        <div className="flex flex-col gap-1">
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">Your Profile</h2>
          <p className="text-slate-500 font-medium tracking-tight">Manage your emergency information.</p>
        </div>
        <motion.button 
          whileTap={{ scale: 0.9 }}
          onClick={() => signOut(auth)}
          className="p-3 bg-slate-100 text-slate-600 rounded-2xl"
        >
          <LogOut className="w-5 h-5" />
        </motion.button>
      </div>

      <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-soft">
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
          <User className="w-3.5 h-3.5" /> Personal Info
        </h3>
        <div className="flex flex-col gap-4">
          <div>
            <label className="text-[10px] uppercase font-bold tracking-widest text-slate-500 mb-1.5 block px-1">Full Name</label>
            <input 
              value={profile?.name || ''}
              onChange={(e) => setProfile(p => p ? {...p, name: e.target.value} : null)}
              className="w-full p-3.5 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all font-medium text-slate-800 outline-none"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase font-bold tracking-widest text-slate-500 mb-1.5 block px-1">Blood Group</label>
            <input 
              value={profile?.bloodGroup || ''}
              onChange={(e) => setProfile(p => p ? {...p, bloodGroup: e.target.value} : null)}
              placeholder="e.g. O+"
              className="w-full p-3.5 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all font-medium text-slate-800 outline-none"
            />
          </div>
        </div>
      </section>

      <section className="bg-slate-800 p-6 rounded-2xl text-white shadow-card">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-[11px] font-bold uppercase tracking-widest opacity-70 flex items-center gap-2 text-white">
            <Heart className="w-3.5 h-3.5" /> Emergency Contacts
          </h3>
          <button onClick={addContact} className="p-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors">
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-col gap-4">
          {profile?.emergencyContacts.map((contact, i) => (
            <div key={i} className="bg-white/5 border border-white/10 p-4 rounded-xl flex flex-col gap-3 relative group">
              <button 
                onClick={() => deleteContact(i)}
                className="absolute top-2 right-2 p-1 text-white/30 hover:text-white transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <input 
                placeholder="Name"
                value={contact.name}
                onChange={(e) => updateContact(i, 'name', e.target.value)}
                className="bg-transparent border-b border-white/10 py-1 font-bold text-white placeholder:text-white/30 focus:outline-none focus:border-white/50 text-sm"
              />
              <div className="flex gap-4">
                <input 
                  placeholder="Phone"
                  value={contact.phone}
                  onChange={(e) => updateContact(i, 'phone', e.target.value)}
                  className="bg-transparent border-b border-white/10 py-1 font-bold text-white placeholder:text-white/30 focus:outline-none focus:border-white/50 text-xs flex-grow"
                />
                <input 
                  placeholder="Relation"
                  value={contact.relation}
                  onChange={(e) => updateContact(i, 'relation', e.target.value)}
                  className="bg-transparent border-b border-white/10 py-1 font-bold text-white placeholder:text-white/30 focus:outline-none focus:border-white/50 text-xs w-24"
                />
              </div>
            </div>
          ))}

          {profile?.emergencyContacts.length === 0 && (
            <p className="text-[10px] uppercase font-bold opacity-40 text-center py-4 tracking-widest">No contacts added yet.</p>
          )}
        </div>
      </section>

      <motion.button 
        whileTap={{ scale: 0.98 }}
        onClick={handleSave}
        disabled={isSaving}
        className="w-full py-4 bg-red-500 text-white rounded-2xl font-bold shadow-soft flex items-center justify-center gap-2 active:bg-red-600 transition-colors"
      >
        {isSaving ? 'Saving...' : <><Save className="w-4 h-4" /> Save Information</>}
      </motion.button>
    </div>
  );
}
