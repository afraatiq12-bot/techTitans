/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Mic, Send, MapPin, Phone, Volume2, ClipboardList, AlertCircle, 
  HeartPulse, ShieldAlert, Flame, Leaf, HelpCircle, Loader2, 
  Droplets, Zap, Milestone, Trash2, GlobeLock, HeartHandshake, 
  Dog, Lamp, VolumeX, Bus, Activity, Construction, FileText, ChevronRight,
  Camera, StopCircle, X, AlertTriangle, Navigation
} from 'lucide-react';
import { APIProvider, Map, AdvancedMarker, Pin, InfoWindow, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import { classifyProblem, getActionSteps } from '../utils';
import { classifyEmergencyAI, classifyEmergencyFromImage, classifyEmergencyFromAudio, type AIClassification } from '../services/aiService';
import { CATEGORIES, URGENCY_LEVELS, getCategory, getUrgency, LANGUAGES, TRANSLATIONS } from '../constants';
import { EmergencyCategory, UrgencyLevel } from '../types';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, query, where, orderBy, onSnapshot, limit } from 'firebase/firestore';

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_PLATFORM_KEY || '';
const hasValidMapsKey = Boolean(GOOGLE_MAPS_API_KEY);

function NearbyPlaces({ center, type }: { center: { lat: number; lng: number }; type: string }) {
  const placesLib = useMapsLibrary('places');
  const map = useMap();
  const [places, setPlaces] = useState<google.maps.places.Place[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<google.maps.places.Place | null>(null);

  useEffect(() => {
    if (!placesLib || !center || !type || !map) return;
    
    const request: google.maps.places.SearchNearbyRequest = {
      fields: ['displayName', 'location', 'formattedAddress', 'id'],
      locationRestriction: {
        center: center,
        radius: 3000
      },
      includedPrimaryTypes: [type],
      maxResultCount: 10
    };

    placesLib.Place.searchNearby(request).then(({ places: results }) => {
      setPlaces(results || []);
      if (results && results.length > 0) {
        const bounds = new google.maps.LatLngBounds();
        results.forEach(p => {
          if (p.location) bounds.extend(p.location);
        });
        bounds.extend(center);
        map.fitBounds(bounds);
      }
    }).catch(err => console.error("Nearby search failed:", err));
  }, [placesLib, map, center, type]);

  return (
    <>
      <AdvancedMarker position={center} title="Your Location">
        <Pin background="#ef4444" glyphColor="#fff" scale={1.2} />
      </AdvancedMarker>
      {places.map(place => (
        <AdvancedMarker 
          key={place.id} 
          position={place.location} 
          onClick={() => setSelectedPlace(place)}
        >
          <Pin background="#3b82f6" glyphColor="#fff" />
        </AdvancedMarker>
      ))}
      {selectedPlace && (
        <InfoWindow 
          position={selectedPlace.location} 
          onCloseClick={() => setSelectedPlace(null)}
        >
          <div className="p-2 flex flex-col gap-1 min-w-[150px]">
             <span className="text-xs font-black text-slate-900 leading-tight">{(selectedPlace as any).displayName}</span>
             <span className="text-[9px] text-slate-500">{(selectedPlace as any).formattedAddress || 'Nearby facility'}</span>
             <button 
               onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${selectedPlace.location?.lat()},${selectedPlace.location?.lng()}`, '_blank')}
               className="mt-2 bg-slate-900 text-white py-1.5 px-3 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5"
             >
               <Navigation className="w-3 h-3" /> Get Directions
             </button>
          </div>
        </InfoWindow>
      )}
    </>
  );
}

export default function Home() {
  const [problemText, setProblemText] = useState('');
  const [classification, setClassification] = useState<{ category: EmergencyCategory; urgency: UrgencyLevel } | null>(null);
  const [aiResult, setAiResult] = useState<AIClassification | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMapVisible, setIsMapVisible] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [showJson, setShowJson] = useState(false);
  const [isAllCategoriesVisible, setIsAllCategoriesVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<'home' | 'history'>('home');
  const [recentRequests, setRecentRequests] = useState<any[]>([]);
  const [language, setLanguage] = useState('en');
  
  const resultRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const civicGroups = [
    {
      title: 'Safety & Help',
      items: [
        { key: 'cybercrime', label: 'Cyber Fraud', icon: GlobeLock, text: 'I need to report a cyber crime / online fraud' },
        { key: 'domestic', label: 'Domestic Aid', icon: HeartHandshake, text: 'I need assistance for a domestic issue' },
        { key: 'animal', label: 'Animal Rescue', icon: Dog, text: 'I found an animal requiring rescue' },
        { key: 'noise', label: 'Noise Issue', icon: VolumeX, text: 'Excessive noise complaint' },
      ]
    },
    {
      title: 'Infrastructure',
      items: [
        { key: 'lights', label: 'Street Lights', icon: Lamp, text: 'Street light repair needed' },
        { key: 'roads', label: 'Road Repair', icon: Milestone, text: 'Pothole or road damage report' },
        { key: 'traffic', label: 'Traffic Infra', icon: Activity, text: 'Traffic signal failure' },
        { key: 'building', label: 'Bldg Safety', icon: Construction, text: 'Building structure safety concern' },
      ]
    },
    {
      title: 'Utilities & Trash',
      items: [
        { key: 'water', label: 'Water Supply', icon: Droplets, text: 'Water leakage or supply issue' },
        { key: 'electricity', label: 'Power Cut', icon: Zap, text: 'Electricity power outage' },
        { key: 'toilets', label: 'Sanitation', icon: Droplets, text: 'Public toilet or sewer blockage' },
        { key: 'waste', label: 'Waste Mgmt', icon: Trash2, text: 'Garbage collection needed' },
      ]
    },
    {
      title: 'Admin & Other',
      items: [
        { key: 'records', label: 'Registry', icon: FileText, text: 'Query about birth/death/records registry' },
        { key: 'crop', label: 'Agri Help', icon: Leaf, text: 'Agriculture or crop assistance' },
        { key: 'transit', label: 'Transport', icon: Bus, text: 'Bus or metro service complaint' },
        { key: 'general', label: 'General', icon: HelpCircle, text: 'General inquiry or other issue' },
      ]
    }
  ];

  useEffect(() => {
    if (classification && resultRef.current) {
      resultRef.current.scrollIntoView({ behavior: 'smooth' });
      speakGuidance(classification.category, classification.urgency);
    }
    return () => {
      window.speechSynthesis.cancel();
    };
  }, [classification]);

  // Real-time tracking of requests
  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, 'requests'),
      where('userId', '==', auth.currentUser.uid),
      orderBy('createdAt', 'desc'),
      limit(5)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRecentRequests(docs);
    }, (error) => {
      console.error("Error fetching requests:", error);
    });

    return () => unsubscribe();
  }, []);

  const t = (key: string) => TRANSLATIONS[language]?.[key] || TRANSLATIONS['en']?.[key] || key;

  const speakGuidance = (category: EmergencyCategory, urgency: UrgencyLevel) => {
    window.speechSynthesis.cancel();
    const steps = aiResult?.suggestedSteps || getActionSteps(category, urgency, problemText);
    
    // Prefix for context
    const assistanceLabel = t(category) || getCategory(category).label;
    const textToSpeak = `${t('urgency_alert')}: ${urgency}. ${assistanceLabel} ${t('helpline')} ${t('initializing')}. ${steps.map((s, i) => `${i + 1}: ${s}`).join('. ')}`;
    
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.lang = language === 'hi' ? 'hi-IN' : language === 'bn' ? 'bn-BD' : 'en-US';
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    
    window.speechSynthesis.speak(utterance);
  };

  const handleClassify = async (overrideText?: string, mode: 'text' | 'image' | 'audio' = 'text', data?: string) => {
    const textToUse = overrideText || problemText;
    if (mode === 'text' && !textToUse.trim()) return;
    
    setIsSubmitting(true);
    let finalResult: { category: EmergencyCategory; urgency: UrgencyLevel };

    try {
      let aiResponse: AIClassification;
      
      if (mode === 'image' && data) {
        aiResponse = await classifyEmergencyFromImage(data.split(',')[1], language);
      } else if (mode === 'audio' && data) {
        aiResponse = await classifyEmergencyFromAudio(data.split(',')[1], 'audio/webm', language);
      } else {
        aiResponse = await classifyEmergencyAI(textToUse, language);
      }
      
      setAiResult(aiResponse);
      finalResult = { category: aiResponse.primaryCategory, urgency: aiResponse.urgency };
    } catch (error) {
      console.warn("AI Classification failed, falling back to rule-based:", error);
      finalResult = classifyProblem(textToUse);
      setAiResult(null);
    }

    setClassification(finalResult);

    try {
      const requestData = {
        problem: mode === 'text' ? textToUse : `[Multimodal Request: ${mode}]`,
        category: finalResult.category,
        urgency: finalResult.urgency,
        status: 'pending' as const,
        createdAt: serverTimestamp(),
        userId: auth.currentUser?.uid || null,
        location: location ? { latitude: location.lat, longitude: location.lng } : null,
        multimodalType: mode
      };
      await addDoc(collection(db, 'requests'), requestData);
    } catch (e) {
      console.warn('Persistence failed locally:', e);
      if (auth.currentUser) {
        try { handleFirestoreError(e, OperationType.CREATE, 'requests'); } catch(err) { console.error(err); }
      }
    }

    setIsSubmitting(false);
    setCapturedImage(null);
  };

  const getBrowserLocation = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition((position) => {
        const newLoc = { lat: position.coords.latitude, lng: position.coords.longitude };
        setLocation(newLoc);
        setIsMapVisible(true);
      }, (error) => {
        console.error("Error getting location:", error);
        alert("Could not access your location. Please check browser permissions.");
      });
    }
  };

  const startVoiceRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const base64Audio = reader.result as string;
          handleClassify('', 'audio', base64Audio);
        };
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setIsListening(true);
    } catch (err) {
      console.error("Failed to start recording:", err);
      alert("Microphone access denied or not available.");
    }
  };

  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current && isListening) {
      mediaRecorderRef.current.stop();
      setIsListening(false);
    }
  };

  const toggleCamera = async () => {
    if (isCameraActive) {
      stopCamera();
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment' } 
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setIsCameraActive(true);
        }
      } catch (err) {
        console.error("Failed to access camera:", err);
        const errorMessage = err instanceof Error ? err.name : String(err);
        if (errorMessage === 'NotAllowedError' || errorMessage === 'PermissionDeniedError') {
          alert("Camera access was denied. Please enable camera permissions in your browser settings and refresh the page.");
        } else {
          alert(`Failed to access camera: ${errorMessage}. Please ensure your device has a working camera and you are using a secure connection (HTTPS).`);
        }
      }
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  const takePicture = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = canvas.toDataURL('image/jpeg');
        setCapturedImage(imageData);
        stopCamera();
        handleClassify('', 'image', imageData);
      }
    }
  };

  return (
    <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
      <div className="max-w-md mx-auto flex flex-col min-h-screen relative bg-slate-50">
      {/* Dynamic Header */}
      <div className="px-6 pt-8 pb-4 bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <div className="flex flex-col">
            <h2 className="text-xl font-black tracking-tight text-slate-900 border-l-4 border-red-500 pl-3">{t('hero_title')}</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-3 mt-0.5">{t('hero_subtitle')}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <select 
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="bg-slate-50 border border-slate-100 text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg outline-none cursor-pointer hover:bg-slate-100 transition-colors"
            >
              {LANGUAGES.map(lang => (
                <option key={lang.code} value={lang.code}>{lang.native}</option>
              ))}
            </select>
            <motion.div 
              whileHover={{ scale: 1.05 }}
              className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 ${auth.currentUser ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-slate-100 text-slate-400'}`}
            >
              <div className={`w-1.5 h-1.5 rounded-full ${auth.currentUser ? 'bg-emerald-400 animate-pulse' : 'bg-slate-300'}`} />
              {auth.currentUser ? 'Verified User' : 'Guest Mode'}
            </motion.div>
          </div>
        </div>
        
        <div className="flex gap-8">
          <button 
            onClick={() => { setActiveTab('home'); setClassification(null); }}
            className={`text-[11px] font-black uppercase tracking-[0.2em] pb-3 transition-all relative ${activeTab === 'home' ? 'text-slate-900' : 'text-slate-300'}`}
          >
            Dashboard
            {activeTab === 'home' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-1 bg-red-500 rounded-full" />}
          </button>
          <button 
            onClick={() => { setActiveTab('history'); setClassification(null); }}
            className={`text-[11px] font-black uppercase tracking-[0.2em] pb-3 transition-all relative ${activeTab === 'history' ? 'text-slate-900' : 'text-slate-300'}`}
          >
            Requests History
            {activeTab === 'history' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-1 bg-red-500 rounded-full" />}
            {recentRequests.some(r => r.status === 'pending') && (
              <span className="absolute -top-1 -right-3 w-4 h-4 bg-red-500 text-white text-[8px] flex items-center justify-center rounded-full border-2 border-white">
                {recentRequests.filter(r => r.status === 'pending').length}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="px-6 py-8 pb-32 flex flex-col gap-8 overflow-y-auto">
        {activeTab === 'home' ? (
          <>
            {/* Global Map Preview */}
            <AnimatePresence>
              {isMapVisible && location && (
                <motion.div
                  initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                  animate={{ opacity: 1, height: 'auto', marginBottom: 24 }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  className="overflow-hidden bg-white border border-slate-200 rounded-3xl shadow-soft"
                >
                  <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-800 flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-red-500" /> Current Hotspot
                    </span>
                    <button onClick={() => setIsMapVisible(false)} className="text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-red-500 transition-colors">Close</button>
                  </div>
                      <div className="w-full h-56 bg-slate-100 relative group">
                        {hasValidMapsKey ? (
                          <Map
                            defaultCenter={location}
                            defaultZoom={15}
                            mapId="DEMO_MAP_ID"
                            style={{ width: '100%', height: '100%' }}
                            disableDefaultUI
                            gestureHandling={'greedy'}
                            internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                          >
                            <AdvancedMarker position={location}>
                               <Pin background="#ef4444" glyphColor="#fff" />
                            </AdvancedMarker>
                          </Map>
                        ) : (
                          <iframe
                            title="Global Location Map"
                            width="100%" height="100%" style={{ border: 0 }} loading="lazy" allowFullScreen referrerPolicy="no-referrer"
                            src={`https://www.google.com/maps/embed/v1/view?key=${GOOGLE_MAPS_API_KEY}&center=${location.lat},${location.lng}&zoom=15`}
                          ></iframe>
                        )}
                        {!hasValidMapsKey && (
                      <div className="absolute inset-0 flex items-center justify-center bg-slate-100/90 backdrop-blur-[2px] p-8 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <div className="p-3 bg-white rounded-full shadow-soft mb-2"><MapPin className="w-6 h-6 text-red-400" /></div>
                          <p className="text-[10px] font-black text-slate-800 uppercase tracking-widest">Local Coordination Active</p>
                          <p className="text-[10px] font-medium text-slate-400 lowercase max-w-[200px]">Coordinates locked: {location.lat.toFixed(4)}, {location.lng.toFixed(4)}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Main Input */}
            <div className={`transition-all duration-300 ${classification ? 'opacity-40 grayscale pointer-events-none' : ''}`}>
              <div className="relative group">
                <div className="w-full bg-white border-2 border-slate-100 focus-within:border-red-100 rounded-[2rem] p-6 shadow-soft flex flex-col gap-4 transition-all duration-300">
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">{t('describe_situation')}</label>
                    <div className="flex gap-2">
                      <motion.button whileTap={{ scale: 0.9 }} onClick={getBrowserLocation} title={t('gps_request')} className={`p-2 rounded-xl transition-all ${location ? 'bg-emerald-50 text-emerald-500' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}><MapPin className="w-4 h-4" /></motion.button>
                      <motion.button whileTap={{ scale: 0.9 }} onClick={toggleCamera} title={t('camera_analysis')} className={`p-2 rounded-xl transition-all ${isCameraActive ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}><Camera className="w-4 h-4" /></motion.button>
                      <motion.button whileTap={{ scale: 0.9 }} onClick={isListening ? stopVoiceRecording : startVoiceRecording} title={t('voice_assistant')} className={`p-2 rounded-xl transition-all ${isListening ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-200' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}>{isListening ? <StopCircle className="w-4 h-4" /> : <Mic className="w-4 h-4" />}</motion.button>
                    </div>
                  </div>

                  {/* Camera View */}
                  <AnimatePresence>
                    {isCameraActive && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="relative rounded-2xl overflow-hidden bg-black aspect-video"
                      >
                        <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                        <div className="absolute inset-x-0 bottom-4 flex justify-center gap-4">
                          <button onClick={takePicture} className="bg-white text-slate-900 px-6 py-2 rounded-full font-black text-[10px] uppercase tracking-widest shadow-xl">Capture & Analyze</button>
                          <button onClick={stopCamera} className="bg-slate-900/50 text-white p-2 rounded-full backdrop-blur-md"><X className="w-4 h-4" /></button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  
                  {/* Image Preview during processing */}
                  <AnimatePresence>
                    {capturedImage && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0 }}
                        className="relative rounded-2xl overflow-hidden bg-slate-100 aspect-video group"
                      >
                        <img src={capturedImage} alt="Captured" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-slate-900/40 flex items-center justify-center backdrop-blur-[2px]">
                          <div className="flex flex-col items-center gap-2">
                             <Loader2 className="w-8 h-8 text-white animate-spin" />
                             <span className="text-white text-[10px] font-black uppercase tracking-widest">Analyzing Scene...</span>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Voice recording indicator */}
                  <AnimatePresence>
                    {isListening && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="bg-red-50 border border-red-100 rounded-2xl p-4 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex gap-1 items-end h-4">
                            <motion.div animate={{ height: [4, 12, 4] }} transition={{ repeat: Infinity, duration: 0.5 }} className="w-1 bg-red-400 rounded-full" />
                            <motion.div animate={{ height: [8, 16, 8] }} transition={{ repeat: Infinity, duration: 0.6 }} className="w-1 bg-red-500 rounded-full" />
                            <motion.div animate={{ height: [4, 10, 4] }} transition={{ repeat: Infinity, duration: 0.4 }} className="w-1 bg-red-400 rounded-full" />
                          </div>
                          <span className="text-[10px] font-black text-red-600 uppercase tracking-widest">Listening to report...</span>
                        </div>
                        <button onClick={stopVoiceRecording} className="text-[10px] font-black text-red-500 uppercase tracking-widest">Finish</button>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <textarea
                    value={problemText}
                    onChange={(e) => setProblemText(e.target.value)}
                    placeholder="E.g. Someone is choking on floor 5..."
                    className="w-full bg-transparent border-none outline-none text-slate-800 font-bold text-lg placeholder:text-slate-300 min-h-[80px] resize-none"
                  />
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleClassify()}
                    disabled={isSubmitting || !problemText.trim()}
                    className="w-full bg-slate-900 text-white rounded-2xl py-4 flex items-center justify-center gap-3 font-black text-sm uppercase tracking-widest shadow-xl shadow-slate-200 disabled:opacity-30 disabled:shadow-none transition-all group"
                  >
                    {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Process Request <Send className="w-4 h-4 group-hover:translate-x-1 transition-transform" /></>}
                  </motion.button>
                </div>
              </div>
            </div>

            {/* Result Display */}
            <AnimatePresence>
              {classification && (
                <motion.div
                  initial={{ opacity: 0, y: 50, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  ref={resultRef}
                  className="flex flex-col gap-6"
                >
                  <div className={`p-8 rounded-[2.5rem] ${getCategory(classification.category).bgColor} border-2 ${getCategory(classification.category).borderColor} shadow-2xl relative overflow-hidden`}>
                    {classification.urgency === 'high' && (
                       <motion.div initial={{ opacity: 0.4 }} animate={{ opacity: [0.2, 0.5, 0.2] }} transition={{ repeat: Infinity, duration: 2 }} className="absolute inset-0 bg-red-500/10 pointer-events-none" />
                    )}
                    
                    <div className="flex justify-between items-start mb-6 relative">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 mb-1">
                          <AlertCircle className={`w-4 h-4 ${getUrgency(classification.urgency).color}`} />
                          <span className={`text-[10px] font-black uppercase tracking-widest ${getUrgency(classification.urgency).color}`}>{t('urgency_alert')}</span>
                        </div>
                        <h3 className="text-2xl font-black text-slate-900 leading-none">{t(classification.category)}</h3>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">{t('initializing')}</p>
                      </div>
                      <div className={`p-4 rounded-2xl ${getCategory(classification.category).bgColor} border ${getCategory(classification.category).borderColor} shadow-soft`}>
                        {(() => {
                          const iconMap: Record<string, any> = { 
                            medical: HeartPulse, fire: Flame, police: ShieldAlert, 
                            water: Droplets, electricity: Zap, roads: Milestone, waste: Trash2, 
                            crop: Leaf, general: HelpCircle, cybercrime: GlobeLock,
                            domestic: HeartHandshake, animal: Dog, lights: Lamp,
                            toilets: Droplets, noise: VolumeX, transit: Bus,
                            traffic: Activity, building: Construction, records: FileText
                          };
                          const Icon = iconMap[classification.category] || HelpCircle;
                          return <Icon className={`w-8 h-8 ${getCategory(classification.category).color}`} />
                        })()}
                      </div>
                    </div>

                    {aiResult && aiResult.allCategories.length > 1 && (
                      <div className="flex flex-wrap gap-2 mb-6">
                        {aiResult.allCategories.filter(c => c !== aiResult.primaryCategory).map(cat => (
                          <span key={cat} className="px-2 py-1 rounded-lg bg-white/50 border border-white/20 text-[9px] font-black uppercase tracking-widest text-slate-600">
                            + {cat} detected
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="bg-white/60 backdrop-blur-md rounded-3xl p-6 border border-white/40 flex flex-col gap-4 mb-6">
                       <div className="flex flex-col">
                         <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">{t('primary_dept')}</span>
                         <span className="text-sm font-black text-slate-800">{getCategory(classification.category).department}</span>
                       </div>
                       <div className="flex items-center justify-between">
                         <div className="flex flex-col">
                           <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">{t('helpline')}</span>
                           <span className="text-xl font-black text-red-500 tracking-tighter">{getCategory(classification.category).helpline}</span>
                         </div>
                         <motion.button 
                           whileTap={{ scale: 0.9 }}
                           onClick={() => window.location.href = `tel:${getCategory(classification.category).helpline}`}
                           className="bg-red-500 text-white p-4 rounded-2xl shadow-lg shadow-red-200"
                         >
                           <Phone className="w-5 h-5" />
                         </motion.button>
                       </div>
                    </div>

                    <div className="flex justify-between items-center px-2">
                       <button onClick={() => speakGuidance(classification.category, classification.urgency)} className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2 hover:text-slate-900 transition-colors">
                         <Volume2 className={`w-4 h-4 ${isSpeaking ? 'animate-bounce text-red-500' : ''}`} /> {isSpeaking ? 'Reading Protocol...' : 'Play Voice Instructions'}
                       </button>
                       <button onClick={() => setClassification(null)} className="text-[10px] font-black uppercase tracking-widest text-red-500">Dismiss</button>
                    </div>

                    {/* Nearby Locations Feature */}
                    <div className="mt-8 flex flex-col gap-4">
                      <div className="flex justify-between items-center px-1">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Deploying Nearby Resources</label>
                        {!location && (
                          <button onClick={getBrowserLocation} className="text-[9px] font-black uppercase tracking-widest text-red-500 animate-pulse">Request Gps</button>
                        )}
                      </div>
                      
                      <div className="w-full h-64 bg-white border-2 border-white rounded-[2rem] overflow-hidden shadow-soft relative group">
                        {hasValidMapsKey && location ? (
                          <Map
                            defaultCenter={location}
                            defaultZoom={14}
                            mapId="NEARBY_FACILITIES_MAP"
                            style={{ width: '100%', height: '100%' }}
                            disableDefaultUI={false}
                            gestureHandling={'greedy'}
                            internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                          >
                            <NearbyPlaces 
                              center={location} 
                              type={(getCategory(classification.category) as any).nearbySearchType || 'police'} 
                            />
                          </Map>
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center bg-slate-50 p-8 text-center">
                            <div className="flex flex-col items-center gap-3">
                              <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-soft mb-1">
                                <Navigation className="w-6 h-6 text-slate-300" />
                              </div>
                              <p className="text-[10px] font-black text-slate-800 uppercase tracking-widest leading-loose">
                                {!hasValidMapsKey ? 'Maps API Required' : !location ? 'Waiting for GPS Lock' : 'Synchronizing Fleet...'}
                              </p>
                              {!hasValidMapsKey && (
                                <p className="text-[9px] text-slate-400 font-medium">Add GOOGLE_MAPS_PLATFORM_KEY to secrets to enable live tracking.</p>
                              )}
                              {location && !hasValidMapsKey && (
                                <button 
                                  onClick={() => window.open(`https://www.google.com/maps/search/nearby+${(getCategory(classification.category) as any).nearbySearchType || 'emergency'}/@${location.lat},${location.lng},14z`, '_blank')}
                                  className="mt-2 bg-slate-900 text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest"
                                >
                                  Open Google Maps Search
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions List */}
                  <div className="flex flex-col gap-4">
                    <div className="flex justify-between items-center">
                      <label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">{t('response_protocols')}</label>
                      <button onClick={() => setShowJson(!showJson)} className="text-[9px] font-black uppercase tracking-widest text-slate-300 hover:text-slate-500 transition-colors">{showJson ? 'Hide Debug' : 'Source Logic'}</button>
                    </div>
                    
                    <AnimatePresence mode="wait">
                      {showJson ? (
                        <motion.div key="debug" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="bg-slate-900 rounded-2xl p-6 font-mono text-[10px] text-emerald-400 overflow-x-auto shadow-inner">
                          <pre>{JSON.stringify({ classification, aiResult, meta: { processedAt: Date.now(), model: 'RescueRouter-v1' } }, null, 2)}</pre>
                        </motion.div>
                      ) : (
                        <div className="flex flex-col gap-3">
                          {(aiResult?.suggestedSteps || getActionSteps(classification.category, classification.urgency, problemText)).map((step, i) => (
                            <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }} className="bg-white border border-slate-100 rounded-2xl p-5 flex gap-4 shadow-soft items-start hover:border-slate-200 transition-all">
                              <div className="w-8 h-8 rounded-xl bg-slate-900 text-white font-black text-xs flex items-center justify-center flex-shrink-0 mt-0.5">{i+1}</div>
                              <p className="text-sm font-bold text-slate-700 leading-snug">{step}</p>
                            </motion.div>
                          ))}
                        </div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Core Emergency Services */}
            {!classification && (
              <div className="flex flex-col gap-6">
                <div className="flex justify-between items-center">
                  <label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">{t('core_emergency')}</label>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { key: 'medical' as const, label: t('medical'), icon: HeartPulse, color: 'text-red-500 bg-red-50 border-red-100', text: t('msg_medical') },
                    { key: 'fire' as const, label: t('fire'), icon: Flame, color: 'text-orange-500 bg-orange-50 border-orange-100', text: t('msg_fire') },
                    { key: 'police' as const, label: t('police'), icon: ShieldAlert, color: 'text-blue-500 bg-blue-50 border-blue-100', text: t('msg_police') },
                  ].map((item, i) => (
                    <motion.button
                      key={i}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => { setProblemText(item.text); handleClassify(item.text); }}
                      className={`flex flex-col items-center gap-3 p-5 rounded-[2rem] border transition-all text-center group ${item.color} shadow-sm hover:shadow-md`}
                    >
                      <item.icon className="w-6 h-6" />
                      <span className="text-[10px] font-black uppercase tracking-widest leading-tight">{item.label}</span>
                    </motion.button>
                  ))}
                </div>

                {/* AI Suggestions / Recent Issues */}
                <div className="flex justify-between items-center">
                  <label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">{t('civic_services')}</label>
                  <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">Tap to fast-report</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { key: 'water' as const, label: t('water'), icon: Droplets, color: 'bg-cyan-50 text-cyan-600 border-cyan-100', text: t('msg_water') },
                    { key: 'electricity' as const, label: t('electricity'), icon: Zap, color: 'bg-amber-50 text-amber-500 border-amber-100', text: t('msg_electricity') },
                    { key: 'cybercrime' as const, label: t('cybercrime'), icon: GlobeLock, color: 'bg-indigo-50 text-indigo-600 border-indigo-100', text: t('msg_cybercrime') },
                    { key: 'noise' as const, label: t('noise'), icon: VolumeX, color: 'bg-slate-50 text-slate-600 border-slate-100', text: t('msg_noise') }
                  ].map((item, i) => (
                    <motion.button
                      key={i}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => { setProblemText(item.text); handleClassify(item.text); }}
                      className={`flex items-center gap-3 p-4 rounded-2xl border transition-all text-left ${item.color} shadow-xs hover:shadow-sm`}
                    >
                      <item.icon className="w-5 h-5 flex-shrink-0" />
                      <div className="flex flex-col overflow-hidden">
                        <span className="text-[10px] font-black uppercase tracking-widest truncate">{item.label}</span>
                        <span className="text-[8px] font-medium opacity-60 truncate">Report Issue</span>
                      </div>
                    </motion.button>
                  ))}
                </div>

                {/* Browse More */}
                <motion.button 
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setIsAllCategoriesVisible(true)}
                  className="w-full bg-white border-2 border-slate-100 rounded-2xl p-4 flex items-center justify-between group hover:border-slate-300 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-50 rounded-lg group-hover:bg-slate-100">
                      <ClipboardList className="w-4 h-4 text-slate-400" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">See all 15+ civic categories</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:translate-x-1 transition-transform" />
                </motion.button>
              </div>
            )}
          </>
        ) : (
          /* Real-time Status Tab */
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-8">
            <div className="flex flex-col gap-2">
              <h3 className="text-2xl font-black text-slate-900 border-l-4 border-emerald-500 pl-4 uppercase tracking-tighter">Live Status Room</h3>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-4">Your current active and past tickets</p>
            </div>

            {recentRequests.length === 0 ? (
              <div className="bg-white border-2 border-slate-100 rounded-[2.5rem] p-16 text-center flex flex-col items-center gap-6 shadow-soft">
                <div className="w-20 h-20 bg-slate-50 text-slate-200 rounded-full flex items-center justify-center"><ClipboardList className="w-10 h-10" /></div>
                <div className="flex flex-col gap-2">
                  <p className="text-sm font-black text-slate-800 uppercase tracking-widest">No Active Sessions</p>
                  <p className="text-xs text-slate-400 font-medium">Any request you send will appear here for live tracking.</p>
                </div>
                <button onClick={() => setActiveTab('home')} className="mt-4 px-6 py-3 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest">Start New Session</button>
              </div>
            ) : (
              <div className="flex flex-col gap-5">
                {recentRequests.map((req, i) => (
                  <motion.div 
                    key={req.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                    className="bg-white border-2 border-slate-100 rounded-[2rem] p-6 shadow-sm relative overflow-hidden"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex flex-col">
                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-300 mb-1">Ticket: {req.id.substring(0, 8)}</span>
                        <span className="font-black text-lg text-slate-900 line-clamp-1">{req.problem}</span>
                      </div>
                      <div className={`px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest border ${
                        req.status === 'pending' ? 'bg-amber-50 text-amber-600 border-amber-200' :
                        req.status === 'active' ? 'bg-blue-50 text-blue-600 border-blue-200' :
                        'bg-emerald-50 text-emerald-600 border-emerald-200'
                      }`}>
                        {req.status}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4 mb-6">
                      <div className="flex-1 h-2 bg-slate-50 rounded-full overflow-hidden border border-slate-100">
                        <motion.div 
                          className={`h-full ${req.status === 'pending' ? 'bg-amber-400 w-1/3' : req.status === 'active' ? 'bg-blue-400 w-2/3' : 'bg-emerald-400 w-full'}`}
                          initial={{ width: 0 }} animate={{ width: req.status === 'pending' ? '33%' : req.status === 'active' ? '66%' : '100%' }}
                        />
                      </div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        {req.status === 'pending' ? 'Dispatching' : req.status === 'active' ? 'En Route' : 'Resolved'}
                      </span>
                    </div>

                    <div className="pt-4 border-t border-slate-50 flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <div className={`w-2.5 h-2.5 rounded-sm rotate-45 ${getUrgency(req.urgency).color.replace('text', 'bg')}`} />
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{req.category} Dept</span>
                      </div>
                      <div className="flex gap-2">
                        {req.location && <MapPin className="w-4 h-4 text-slate-300" />}
                        <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">
                          {req.createdAt?.toDate ? req.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recently'}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </div>

      <footer className="mt-auto py-8 text-center text-[10px] font-black uppercase tracking-[0.5em] text-slate-200">
        RescueRouter Protocol 1.4-L
      </footer>

      {/* Hidden helper elements */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Persistent SOS Trigger */}
      {activeTab === 'home' && !classification && (
        <div className="fixed bottom-10 right-6 z-50">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => { setProblemText('URGENT SOS ACTIVATED'); handleClassify('URGENT SOS ACTIVATED'); }}
            className="w-20 h-20 bg-red-600 text-white rounded-full flex flex-col items-center justify-center shadow-2xl shadow-red-200 border-[6px] border-white active:bg-red-700 transition-colors"
          >
            <span className="font-black text-xs leading-none">SOS</span>
            <div className="w-1.5 h-1.5 bg-white rounded-full mt-1 animate-ping" />
          </motion.button>
        </div>
      )}
      {/* All Categories Overlay */}
      <AnimatePresence>
        {isAllCategoriesVisible && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-md flex items-end sm:items-center justify-center sm:p-6"
          >
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="bg-white w-full max-w-md rounded-t-[2.5rem] sm:rounded-[2.5rem] max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
            >
              <div className="px-8 pt-8 pb-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                <div className="flex flex-col">
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">Civic Catalog</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Select a service to report</p>
                </div>
                <button 
                  onClick={() => setIsAllCategoriesVisible(false)}
                  className="w-10 h-10 bg-white border border-slate-100 rounded-full flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors shadow-sm"
                >
                  <ChevronRight className="w-5 h-5 rotate-90" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-8 pb-20 no-scrollbar">
                {civicGroups.map((group, idx) => (
                  <div key={idx} className="flex flex-col gap-4">
                    <label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-300 px-2">{group.title}</label>
                    <div className="grid grid-cols-2 gap-3">
                      {group.items.map((item, i) => (
                        <motion.button
                          key={i}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => {
                            setProblemText(item.text);
                            setIsAllCategoriesVisible(false);
                            handleClassify(item.text);
                          }}
                          className="flex items-center gap-3 p-4 rounded-3xl border border-slate-100 bg-white hover:border-slate-300 transition-all text-left group"
                        >
                          <div className="p-2.5 bg-slate-50 rounded-xl group-hover:bg-slate-100 transition-colors">
                            <item.icon className="w-4 h-4 text-slate-400 group-hover:text-slate-600" />
                          </div>
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-700 leading-tight">{item.label}</span>
                        </motion.button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    </APIProvider>
  );
}
