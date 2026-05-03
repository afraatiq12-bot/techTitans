/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { motion } from 'motion/react';
import { LogIn, Phone, Mail, ShieldCheck } from 'lucide-react';
import { auth } from '../lib/firebase';
import { GoogleAuthProvider, signInWithPopup, PhoneAuthProvider, RecaptchaVerifier } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const navigate = useNavigate();
  const [error, setError] = useState('');

  const handleGoogleSignIn = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      navigate('/');
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <div className="max-w-md mx-auto px-6 py-12 flex flex-col items-center justify-center min-h-screen text-center">
      <div className="mb-8 p-6 rounded-3xl bg-red-50">
        <ShieldCheck className="w-12 h-12 text-red-600" />
      </div>
      
      <h2 className="text-3xl font-extrabold tracking-tight text-slate-800 mb-2">Secure Access</h2>
      <p className="text-slate-500 font-medium mb-12 text-sm">Sign in to save your history and sync emergency contacts.</p>

      {error && (
        <div className="w-full p-4 mb-6 bg-red-50 border border-red-100 text-red-700 rounded-xl text-xs font-bold uppercase tracking-widest">
          {error}
        </div>
      )}

      <div className="w-full flex flex-col gap-4">
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={handleGoogleSignIn}
          className="flex items-center justify-center gap-3 w-full py-4 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 shadow-soft hover:shadow-card transition-all"
        >
          <Mail className="w-5 h-5 text-red-500" />
          Continue with Google
        </motion.button>

        <div className="flex items-center gap-4 my-4 opacity-30">
          <div className="h-[1px] flex-grow bg-slate-900"></div>
          <span className="text-xs uppercase font-black tracking-widest">or</span>
          <div className="h-[1px] flex-grow bg-slate-900"></div>
        </div>

        <motion.button
          whileTap={{ scale: 0.98 }}
          className="flex items-center justify-center gap-3 w-full py-5 bg-slate-900 text-white rounded-[2rem] font-bold opacity-50 cursor-not-allowed"
        >
          <Phone className="w-6 h-6" />
          Phone OTP (Coming Soon)
        </motion.button>
      </div>

      <p className="mt-12 text-xs text-slate-400 font-medium leading-relaxed max-w-[280px]">
        By signing in you agree to our terms and conditions for emergency data usage.
      </p>
    </div>
  );
}
