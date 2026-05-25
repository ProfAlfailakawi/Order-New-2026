import { GamificationProvider } from './components/GamificationProvider';
import { UserProvider } from './contexts/UserContext';
import { CognitiveModeProvider } from './contexts/CognitiveModeContext';
import { useAmbientIntelligence } from './hooks/useAmbientIntelligence';
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  GraduationCap, Globe, Command, Sparkles, 
  ClipboardCheck, Gamepad2, Hourglass, BrainCircuit, 
  Zap, Users, Lightbulb, RefreshCw, X, MessageCircleQuestion, Menu, LogOut, LayoutDashboard,
  Search, Network, BarChart3, LibraryBig, Route, TicketPercent, Mail, Settings, User, Lock, Box,
  Compass, Anchor, Moon, Sun, Heart, Brain, Loader2, WifiOff, DoorOpen, ShieldCheck,
  ArrowLeft, HelpCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { useAuth } from './components/AuthProvider';
import { auth, db } from './lib/firebase';
import { query, collection, where, limit, getDocs } from 'firebase/firestore';
import Login from './components/Login';
import UserMenu from './components/UserMenu';
import { signOut } from 'firebase/auth';
import { GlobalCommand } from './components/GlobalCommand';
import { GamificationBadge } from './components/GamificationBadge';
import { TheOrb } from './components/TheOrb';
import { VoiceCanvas } from './components/VoiceCanvas';
import { MessagesFloatingButton } from './components/MessagesFloatingButton';
import { ThoughtNebula } from './components/ThoughtNebula';
import { WhisperHint } from './components/WhisperHint';
import { SerendipityCompass } from './components/SerendipityCompass';
import { PWAInstallPrompt, PWAHeaderButton } from './components/PWAInstallPrompt';
import { SpatialGhost } from './components/SpatialGhost';
import { OnboardingTour } from './components/OnboardingTour';
import { TebyanTooltip } from './components/TebyanTooltip';

import { KnowledgeGraphTab } from './components/tabs/KnowledgeGraphTab';
import { GlobalSageBar } from './components/GlobalSageBar';
import { migrateLegacyData } from './lib/migration';

import AdminUsersDashboard from './components/AdminUsersDashboard';
import AdminQawlFasl from './components/tabs/QawlFasl/AdminQawlFasl';
import { AdminContactTab } from './components/tabs/AdminContactTab';

const TabFallback = () => (
  <div className="w-full space-y-8 p-6 md:p-12 bg-white rounded-[24px] md:rounded-[32px] border border-zinc-200/60 shadow-[0_4px_24px_rgba(0,0,0,0.02)] animate-pulse">
     <div className="flex items-center gap-5">
        <div className="w-14 h-14 bg-zinc-100 rounded-[16px]"></div>
        <div className="w-64 h-8 bg-zinc-100 rounded-lg"></div>
     </div>
     <div className="space-y-4">
       <div className="w-full h-16 bg-zinc-50 rounded-2xl"></div>
       <div className="w-4/5 h-16 bg-zinc-50 rounded-2xl"></div>
       <div className="w-full h-40 bg-zinc-50 rounded-2xl mt-12"></div>
     </div>
  </div>
);

const OracleTab = React.lazy(() => import('./components/tabs/OracleTab').then(m => ({ default: m.OracleTab })));
const ConceptsTab = React.lazy(() => import('./components/tabs/ConceptsTab').then(m => ({ default: m.ConceptsTab })));
const QuizTab = React.lazy(() => import('./components/tabs/QuizTab').then(m => ({ default: m.QuizTab })));
const SimulationTab = React.lazy(() => import('./components/tabs/SimulationTab').then(m => ({ default: m.SimulationTab })));
const TimeMachineTab = React.lazy(() => import('./components/tabs/TimeMachineTab').then(m => ({ default: m.TimeMachineTab })));
const CouncilTab = React.lazy(() => import('./components/tabs/CouncilTab').then(m => ({ default: m.CouncilTab })));
const LabTab = React.lazy(() => import('./components/tabs/LabTab').then(m => ({ default: m.LabTab })));
const QawlFaslTab = React.lazy(() => import('./components/tabs/QawlFasl/QawlFaslTab').then(m => ({ default: m.QawlFaslTab })));
const MindMapTab = React.lazy(() => import('./components/tabs/MindMapTab').then(m => ({ default: m.MindMapTab })));
const AnalyticsTab = React.lazy(() => import('./components/tabs/AnalyticsTab').then(m => ({ default: m.AnalyticsTab })));
const LoyaltyTab = React.lazy(() => import('./components/tabs/LoyaltyTab').then(m => ({ default: m.LoyaltyTab })));
const RoadmapTab = React.lazy(() => import('./components/tabs/RoadmapTab').then(m => ({ default: m.RoadmapTab })));
const StoryTab = React.lazy(() => import('./components/tabs/StoryTab').then(m => ({ default: m.StoryTab })));
const RippleEffectTab = React.lazy(() => import('./components/tabs/RippleEffectTab').then(m => ({ default: m.RippleEffectTab })));
const DecisionExecutiveTab = React.lazy(() => import('./components/tabs/DecisionExecutiveTab').then(m => ({ default: m.DecisionExecutiveTab })));
const MyLibraryTab = React.lazy(() => import('./components/tabs/MyLibraryTab'));
const ContactTab = React.lazy(() => import('./components/tabs/ContactTab').then(m => ({ default: m.ContactTab })));
const AdminDashboard = React.lazy(() => import('./components/AdminDashboard'));

const StrategicArenaTab = React.lazy(() => import('./components/tabs/StrategicArenaTab'));
const CreativeLabWrapper = React.lazy(() => import('./components/tabs/CreativeLabWrapper'));
const KnowledgeCenterTab = React.lazy(() => import('./components/tabs/KnowledgeCenterTab'));
const ARTab = React.lazy(() => import('./components/tabs/ARTab'));
const TruthManuscriptTab = React.lazy(() => import('./components/tabs/TruthManuscriptTab'));

type Tab = 'home' | 'oracle' | 'concepts' | 'quizzes' | 'simulation' | 'timemachine' | 'council' | 'lab' | 'qawlfasl' | 'mindmap' | 'knowledgegraph' | 'analytics' | 'loyalty' | 'roadmap' | 'story' | 'mylibrary' | 'discover' | 'adminusers' | 'adminqawlfasl' | 'contact' | 'adminmessages' | 'admindashboard' | 'decisionroom' | 'strategicarena' | 'creativelab' | 'knowledgecenter' | 'ar' | 'ripple' | 'truthmanuscript';

type Mood = 'default' | 'revolutionary' | 'calm' | 'melancholic' | 'optimistic';

const protectedFeatures: Tab[] = ['oracle', 'concepts', 'quizzes', 'simulation', 'timemachine', 'council', 'lab', 'adminusers', 'adminqawlfasl', 'mindmap', 'knowledgegraph', 'analytics', 'loyalty', 'roadmap', 'story', 'adminmessages', 'decisionroom', 'admindashboard', 'strategicarena', 'creativelab', 'knowledgecenter', 'mylibrary', 'truthmanuscript'];

import DevPanel from './components/DevPanel';

import { SmartGateway } from './components/SmartGateway';
import { logEvent } from './services/analyticsService';
import { cronService } from './services/cronService';
import { LighthouseMode } from './components/LighthouseMode';
import { translateWithContext, findSoulMatch } from './services/geminiService';

const SplashScreen = ({ onFinish, language }: { onFinish: () => void, language: 'ar' | 'en' }) => {
    const quotes = language === 'ar' ? [
        'نفتح بوابة الفهم…',
        'نرتّب الفكرة بهدوء…',
        'تبيان يهيّئ مساحة القرار…',
        'كل سؤال جيد يبدأ من هدوء صغير…'
    ] : [
        'Opening the gate of understanding…',
        'Arranging the idea calmly…',
        'Tebyan is preparing your decision space…',
        'Every good question begins with a quiet moment…'
    ];

    const [randomQuote] = useState(() => quotes[Math.floor(Math.random() * quotes.length)]);

    useEffect(() => {
        const timer = setTimeout(() => {
            localStorage.setItem('tebyan_creative_splash_seen_v15', 'true');
            try { sessionStorage.setItem('tebyan_gate_to_search', 'true'); window.dispatchEvent(new CustomEvent('tebyan_gate_to_search')); } catch(e) {}
            onFinish();
        }, 1850);
        return () => clearTimeout(timer);
    }, [onFinish]);

    return (
        <motion.div 
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, filter: 'blur(12px)', transition: { duration: 0.75, ease: 'easeInOut' } }}
            className="fixed inset-0 z-[99999] bg-[#F8F5EF] flex flex-col items-center justify-center overflow-hidden"
        >
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <motion.div animate={{ scale: [1, 1.13, 1], opacity: [0.18, 0.30, 0.18] }} transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }} className="absolute top-[10%] right-[14%] w-[520px] h-[520px] bg-[#C9BEDF] rounded-full blur-[145px]" />
                <motion.div animate={{ scale: [1, 1.17, 1], opacity: [0.14, 0.24, 0.14] }} transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 0.7 }} className="absolute bottom-[6%] left-[10%] w-[430px] h-[430px] bg-[#B9D0E7] rounded-full blur-[135px]" />
                <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(142,122,174,0.055)_1px,transparent_1px),linear-gradient(to_bottom,rgba(143,169,199,0.055)_1px,transparent_1px)] bg-[size:52px_52px] [mask-image:radial-gradient(circle_at_center,#000_0%,transparent_72%)]" />
            </div>

            <div className="relative flex flex-col items-center gap-7 px-6 text-center">
                <motion.div initial={{ scale: 0.88, opacity: 0, rotate: -2 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} transition={{ duration: 0.9, ease: 'easeOut' }} className="relative h-36 w-36 md:h-44 md:w-44 flex items-center justify-center">
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 16, repeat: Infinity, ease: 'linear' }} className="absolute inset-0 rounded-full border border-dashed border-[#8E7AAE]/28" />
                    <motion.div animate={{ scale: [1, 1.08, 1], opacity: [0.65, 1, 0.65] }} transition={{ duration: 3.8, repeat: Infinity, ease: 'easeInOut' }} className="absolute h-28 w-28 md:h-36 md:w-36 rounded-full bg-white/72 border border-white shadow-[0_28px_80px_rgba(103,88,132,0.18)]" />
                    <motion.div animate={{ y: [-2, 2, -2] }} transition={{ duration: 4.2, repeat: Infinity, ease: 'easeInOut' }} className="relative z-10 flex h-20 w-20 md:h-24 md:w-24 items-center justify-center rounded-[2rem] bg-[#FBFAF7] border border-[#E8E0F0] text-[#8E7AAE] shadow-inner">
                        <Globe className="w-10 h-10 md:w-12 md:h-12" />
                        <Sparkles className="absolute -top-1 -left-1 h-4 w-4 text-[#A68F58]" />
                    </motion.div>
                </motion.div>

                <div className="space-y-3">
                    <motion.p initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2, duration: 0.7 }} className="text-[11px] font-black tracking-[0.35em] text-[#8E7AAE]/70 uppercase">
                        {language === 'ar' ? 'مختبر فكر هادئ' : 'Quiet thinking lab'}
                    </motion.p>
                    <motion.h1 initial={{ y: 18, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.35, duration: 0.75 }} className="text-5xl md:text-7xl font-black text-[#182231] tracking-tighter">
                        تبيان
                    </motion.h1>
                    <motion.p initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.65, duration: 0.75 }} className="text-[#7C8796] font-black flex items-center justify-center gap-2 leading-relaxed">
                        {randomQuote}
                    </motion.p>
                </div>

                <div className="mt-5 flex items-center gap-2" aria-label={language === 'ar' ? 'جاري التحميل' : 'Loading'}>
                    {[0, 1, 2].map(i => (
                        <motion.span key={i} animate={{ opacity: [0.22, 1, 0.22], scale: [0.86, 1.08, 0.86] }} transition={{ duration: 1.45, repeat: Infinity, delay: i * 0.2, ease: 'easeInOut' }} className="h-2.5 w-2.5 rounded-full bg-[#8E7AAE]/70" />
                    ))}
                </div>
            </div>
        </motion.div>
    );
};

const SessionRestoreLoader = ({ language, slow = false }: { language: 'ar' | 'en', slow?: boolean }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className={cn('fixed left-1/2 z-[9998] -translate-x-1/2 border border-white/70 bg-white/84 shadow-[0_14px_40px_rgba(103,88,132,0.12)] backdrop-blur-xl', slow ? 'top-6 rounded-[28px] px-5 py-4 max-w-md w-[calc(100%-2rem)]' : 'top-5 rounded-full px-4 py-2')}
  >
    <div className="flex items-center gap-3 text-xs font-black text-[#7D689E]">
      <Loader2 className="h-4 w-4 animate-spin" />
      <span>{slow ? (language === 'ar' ? 'نحافظ على مسارك ونستعيد الاتصال بالنظام…' : 'Keeping your path while restoring the system…') : (language === 'ar' ? 'جاري استعادة الجلسة…' : 'Restoring session…')}</span>
    </div>
  </motion.div>
);


const OfflineNotice = ({ language }: { language: 'ar' | 'en' }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.35, ease: 'easeOut' }}
    className="fixed inset-0 z-[9999] flex items-end justify-center p-4 md:items-center bg-[#F8F5EF]/62 backdrop-blur-[6px]"
    dir={language === 'ar' ? 'rtl' : 'ltr'}
  >
    <motion.div
      initial={{ y: 22, scale: 0.98, opacity: 0 }}
      animate={{ y: 0, scale: 1, opacity: 1 }}
      exit={{ y: 22, scale: 0.98, opacity: 0 }}
      className="relative w-full max-w-lg overflow-hidden rounded-[34px] border border-[#F0D8D2] bg-[#FFF9F6]/94 p-5 md:p-7 shadow-[0_34px_110px_rgba(166,96,63,0.16)]"
    >
      <div className="absolute -top-24 -right-24 h-56 w-56 rounded-full bg-[#F1D7CC]/50 blur-[70px]" />
      <div className="absolute -bottom-24 -left-24 h-56 w-56 rounded-full bg-[#C9BEDF]/35 blur-[80px]" />
      <div className="relative flex items-start gap-4">
        <div className="relative mt-0.5 flex h-14 w-14 shrink-0 items-center justify-center rounded-[24px] bg-[#FAF0E6] text-[#A6603F]">
          <motion.span animate={{ scale: [1, 1.7, 1], opacity: [0.5, 0, 0.5] }} transition={{ duration: 2.6, repeat: Infinity, ease: 'easeOut' }} className="absolute inset-0 rounded-[24px] border border-[#A6603F]/25" />
          <WifiOff className="h-6 w-6" />
        </div>
        <div className="min-w-0 text-right">
          <p className="text-[11px] font-black tracking-[0.22em] uppercase text-[#A6603F]/75">{language === 'ar' ? 'وضع الحفاظ على المسار' : 'Path-preserve mode'}</p>
          <h3 className="mt-1 text-xl md:text-2xl font-black text-[#182231]">{language === 'ar' ? 'الاتصال انقطع… لكن الفكرة لم تضِع' : 'Connection paused… the idea is safe'}</h3>
          <p className="mt-2 text-sm font-bold leading-relaxed text-[#7C8796]">
            {language === 'ar' ? 'لا نعيد السبلاش الافتتاحي هنا. تبيان يحفظ حالتك الحالية، وعند عودة الشبكة نكمل من نفس الباب.' : 'We do not replay the opening splash here. Tebyan keeps your state and resumes from the same doorway when the network returns.'}
          </p>
          <div className="mt-4 flex items-center gap-2 rounded-2xl border border-[#E9D7CF] bg-white/60 px-3 py-2 text-xs font-black text-[#8D6A58]">
            <ShieldCheck className="h-4 w-4" />
            <span>{language === 'ar' ? 'مسارك الحالي محفوظ مؤقتاً' : 'Your current path is temporarily preserved'}</span>
          </div>
        </div>
      </div>
    </motion.div>
  </motion.div>
);

import { LivingIcon } from './components/LivingIcon';
import { WhispersOfTheVoid } from './components/WhispersOfTheVoid';

const AppContent: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile, loading, authReady } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [toast, setToast] = useState<{ message: string; type: 'info' | 'error' | 'success' } | null>(null);
  const [language, setLanguage] = useState<'ar' | 'en'>('ar');
  const [showSplash, setShowSplash] = useState(() => localStorage.getItem('tebyan_creative_splash_seen_v15') !== 'true');
  const [isOffline, setIsOffline] = useState(() => typeof navigator !== 'undefined' ? !navigator.onLine : false);
  const [showSlowRecovery, setShowSlowRecovery] = useState(false);
  const [doorTransition, setDoorTransition] = useState<{ label: string; kind: string } | null>(null);
  const [showPageHelp, setShowPageHelp] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [showGlobalCommand, setShowGlobalCommand] = useState(false);
  const [showVoiceCanvas, setShowVoiceCanvas] = useState(false);
  const [initialContext, setInitialContext] = useState<string>('');
  const [showHeader, setShowHeader] = useState(true);
  const [isMoodHudOpen, setIsMoodHudOpen] = useState(false);
  const [currentMood, setCurrentMood] = useState<Mood>('default');
  const [prevMood, setPrevMood] = useState<Mood>('default');
  const [showMoodTransition, setShowMoodTransition] = useState(false);
  
  useEffect(() => {
    const updateOnlineState = () => setIsOffline(!navigator.onLine);
    window.addEventListener('online', updateOnlineState);
    window.addEventListener('offline', updateOnlineState);
    updateOnlineState();
    return () => {
      window.removeEventListener('online', updateOnlineState);
      window.removeEventListener('offline', updateOnlineState);
    };
  }, []);

  useEffect(() => {
    if (showSplash || authReady) {
      setShowSlowRecovery(false);
      return;
    }
    const timer = setTimeout(() => setShowSlowRecovery(true), 1800);
    return () => clearTimeout(timer);
  }, [showSplash, authReady]);


  // Mobile UX assist: after pressing any internal tool/action button, guide the viewport to the generated result area.
  // This is visual navigation only; it does not alter AI prompts, features, data, or routes.
  useEffect(() => {
    const resultSelectors = [
      '#decision-results', '#lab-results', '#mobile-results', '#desktop-results', '#qawl-fasl-results',
      '[data-tebyan-results]', '[data-result-section]', '.tebyan-result-document', '.markdown-body'
    ];
    const skipSelectors = [
      'header', '.tebyan-tab-back', '[aria-label="رجوع"]', '[aria-label="Back"]', '[title="رجوع"]', '[title="Back"]',
      '[title="الصفحة الرئيسية"]', '[title="Home"]', '[data-no-auto-scroll]'
    ];

    const findScrollableMain = () => document.querySelector('main') as HTMLElement | null;
    const isMeaningfulResult = (el: Element) => {
      const rect = el.getBoundingClientRect();
      const text = (el.textContent || '').trim();
      return rect.height > 80 && text.length > 12;
    };
    const scrollToResult = () => {
      const mainEl = findScrollableMain();
      const target = resultSelectors
        .map(selector => Array.from(document.querySelectorAll(selector)).find(isMeaningfulResult))
        .find(Boolean) as HTMLElement | undefined;
      if (!target) return;
      const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const behavior: ScrollBehavior = prefersReduced ? 'auto' : 'smooth';
      const topGap = window.innerWidth < 768 ? 86 : 112;
      if (mainEl && getComputedStyle(mainEl).overflowY !== 'visible') {
        const mainRect = mainEl.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();
        mainEl.scrollTo({ top: mainEl.scrollTop + targetRect.top - mainRect.top - topGap, behavior });
      } else {
        window.scrollTo({ top: window.scrollY + target.getBoundingClientRect().top - topGap, behavior });
      }
    };

    const scheduleResultScroll = (event: Event) => {
      const target = event.target as Element | null;
      if (!target) return;
      const action = target.closest('button, a, [role="button"], [role="tab"], input[type="submit"]');
      if (!action || skipSelectors.some(sel => action.closest(sel))) return;
      if (!action.closest('main')) return;
      window.setTimeout(scrollToResult, 450);
      window.setTimeout(scrollToResult, 1100);
      window.setTimeout(scrollToResult, 2200);
    };

    document.addEventListener('click', scheduleResultScroll, true);
    document.addEventListener('submit', scheduleResultScroll, true);
    return () => {
      document.removeEventListener('click', scheduleResultScroll, true);
      document.removeEventListener('submit', scheduleResultScroll, true);
    };
  }, []);

  useEffect(() => {
    // Run migration from legacy keys immediately
    migrateLegacyData();

    // Panic mode listener
    const handlePanic = (e: any) => {
        const isPanic = e.detail;
        if (isPanic) {
            setCurrentMood('calm');
            document.documentElement.classList.add('panic-mode');
        } else {
            setCurrentMood('default');
            document.documentElement.classList.remove('panic-mode');
        }
    };
    window.addEventListener('tebyan_panic_mode_change', handlePanic);
    if (localStorage.getItem('tebyan_panic_mode') === 'true') {
         setCurrentMood('calm');
         document.documentElement.classList.add('panic-mode');
    }
    return () => window.removeEventListener('tebyan_panic_mode_change', handlePanic);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-mood', currentMood);
    if (currentMood !== prevMood) {
      setShowMoodTransition(true);
      const timer = setTimeout(() => {
        setShowMoodTransition(false);
        setPrevMood(currentMood);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [currentMood, prevMood]);
  const [lighthouseIdea, setLighthouseIdea] = useState<{ text: string; author: string } | null>(null);
  const [soulTwinMsg, setSoulTwinMsg] = useState<string | null>(null);
  const [isAnalyzingTwin, setIsAnalyzingTwin] = useState(false);
  const lastScrollTop = useRef(0);
  const mainRef = useRef<HTMLElement>(null);
  
  // Ambient Intelligence Hook
  const { isConfused, isZen, intensity } = useAmbientIntelligence(mainRef);

  useEffect(() => {
    const handleScroll = () => {
      const main = mainRef.current;
      if (!main) return;
      const scrollTop = main.scrollTop;
      if (scrollTop > lastScrollTop.current && scrollTop > 100) {
        setShowHeader(false); // Scrolling down
      } else {
        setShowHeader(true); // Scrolling up
      }
      lastScrollTop.current = scrollTop;
    };
    const main = mainRef.current;
    main?.addEventListener('scroll', handleScroll);
    return () => main?.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    // Automatically check and run daily tasks when user is available and is an admin
    const isPrimaryAdmin = user?.uid === 'VfYbpLBoYFQGoVyBVOlMfVCESdm1' ||
                         user?.email?.toLowerCase() === 'ah_f@hotmail.com' ||
                         user?.email?.toLowerCase() === 'alfailakawidrahmad@gmail.com' || 
                         user?.email?.toLowerCase() === 'alfailakawidrahmad@outlook.com' ||
                         user?.email?.toLowerCase().includes('dr.ahmad');
    
    if (authReady && user && (profile?.role === 'admin' || isPrimaryAdmin)) {
      cronService.runDailyTasks();
    }
  }, [authReady, user, profile]);

  useEffect(() => {
    // Run migration from legacy keys
    migrateLegacyData();

    // Desktop: default closed behavior
    if (window.innerWidth >= 1024) {
        setSidebarOpen(false);
    }
    
    // Check if there's a tab in the URL
    const searchParams = new URLSearchParams(window.location.search);
    const tabParam = searchParams.get('tab');
    if (tabParam && tabs.some(t => t.id === tabParam) || ['adminusers', 'adminqawlfasl', 'adminmessages', 'loyalty'].includes(tabParam as string)) {
        setActiveTab(tabParam as Tab);
    }

    // Digital Patina Simulation (Accelerated for demonstration)
    const visits = parseInt(localStorage.getItem('app_visits') || '0', 10) + 1;
    localStorage.setItem('app_visits', visits.toString());
    
    // If visited more than 5 times (or refresh), apply patina (aging effect)
    if (visits > 2) { // just for show
      document.body.classList.add('patina-aged');
    }
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        // Optional: you could still auto-close here if you wanted, 
        // but let's keep it under user control.
      }
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowGlobalCommand(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  React.useEffect(() => {
    if (user && showLogin) {
      setShowLogin(false);
    }
  }, [user, showLogin]);

  const showToast = (message: string, type: 'info' | 'error' | 'success' = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const checkAuth = useCallback((tab: Tab) => {
    if (!authReady) {
        return false;
    }

    if (tab === 'qawlfasl') return true;

    if (!user && protectedFeatures.includes(tab)) {
      const msg = language === 'ar' 
        ? "هذه الخدمة خاصة للمشتركين... يرجى التسجيل أو الدخول." 
        : "This service is for subscribers only. Please register or login to access.";
      showToast(msg, 'info');
      setShowLogin(true);
      return false;
    }
    return true;
  }, [authReady, language, user, showToast]);

  const handleTabChange = useCallback((tab: Tab | 'ar' | 'simulation_roleplay', context: string = '', exit: boolean = false) => {
    if (exit) {
      localStorage.removeItem('tebyan_last_query');
      localStorage.removeItem('tebyan_last_has_searched');
      sessionStorage.removeItem('tebyan_current_query');
      sessionStorage.removeItem('tebyan_current_has_searched');
    }
    setMobileMenuOpen(false);
    setSidebarOpen(false); // Force close
    setShowGlobalCommand(false);
    setShowVoiceCanvas(false);
    setShowPageHelp(false);
    // Dispatch event to close all other potential overlays (like Serendipity Compass)
    window.dispatchEvent(new CustomEvent('close_overlays'));
    
    let targetTab = tab as any;
    let targetContext = context;

    if (targetTab === 'simulation_roleplay') {
      targetTab = 'simulation';
      targetContext = '[ROLEPLAY]' + context;
    }

    const actualTab = targetTab === 'home' || targetTab === 'discover' || (targetTab as string) === 'dashboard' ? 'home' : targetTab;
    const doorLabels: Record<string, string> = {
      home: language === 'ar' ? 'نعود إلى الواجهة الهادئة…' : 'Returning to the calm dashboard…',
      qawlfasl: language === 'ar' ? 'نفتح باب قول فصل…' : 'Opening Qawl Fasl…',
      decisionroom: language === 'ar' ? 'نفتح غرفة القرار…' : 'Opening the decision room…',
      creativelab: language === 'ar' ? 'نفتح مفاعل الإبداع…' : 'Opening the idea reactor…',
      knowledgecenter: language === 'ar' ? 'نفتح مركز المعرفة…' : 'Opening the knowledge center…',
      knowledgegraph: language === 'ar' ? 'نفتح نسيج الأفكار…' : 'Opening the idea fabric…',
      strategicarena: language === 'ar' ? 'نفتح الميدان الاستراتيجي…' : 'Opening the strategic arena…',
      oracle: language === 'ar' ? 'نفتح مجلس المستشارين…' : 'Opening the council…'
    };
    if (actualTab !== activeTab) {
      setDoorTransition({ label: doorLabels[String(actualTab)] || (language === 'ar' ? 'نفتح الباب المناسب…' : 'Opening the right doorway…'), kind: String(actualTab) });
      setTimeout(() => setDoorTransition(null), 760);
    }
    if (checkAuth(actualTab as Tab)) {
      setIsLoading(false);
      setError(null);
      setInitialContext(targetContext);
      setActiveTab(actualTab);
      logEvent('feature_use', language, undefined, { feature: actualTab, context: targetContext });
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'auto' });
        document.documentElement.scrollTo({ top: 0, behavior: 'auto' });
        document.body.scrollTo({ top: 0, behavior: 'auto' });
        const mainEl = document.querySelector('main');
        if (mainEl) mainEl.scrollTo({ top: 0, behavior: 'auto' });
      }, 50);
    }
  }, [checkAuth, language, activeTab, setMobileMenuOpen, setSidebarOpen, setIsLoading, setError, setInitialContext, setActiveTab]);

  // Listen for custom navigation events dispatched from child components (e.g. ClientProfilePanel)
  // When a 'navigate_tab' event is received, navigate to the given tab using handleTabChange.
  useEffect(() => {
    const listener = (e: any) => {
      const targetTab = e?.detail?.tab as Tab | undefined;
      if (targetTab) {
        handleTabChange(targetTab);
      }
    };
    window.addEventListener('navigate_tab', listener);
    return () => {
      window.removeEventListener('navigate_tab', listener);
    };
  }, [handleTabChange]);

  const tabs = [
    { id: 'discover', label: language === 'ar' ? 'اكتشف' : 'Discover', icon: Search, tooltip: language === 'ar' ? 'البحث الرئيسي في النظام' : 'Main Search' },
    { id: 'decisionroom', label: language === 'ar' ? 'غرفة القرار السرية' : 'Secret Decision Room', icon: Lock, tooltip: language === 'ar' ? 'لمساعدتك في حسم قراراتك الصعبة والمصيرية خطوة بخطوة' : 'Help for tough decisions' },
    { id: 'qawlfasl', label: language === 'ar' ? 'قول فصل' : 'Qawl Fasl', icon: MessageCircleQuestion, tooltip: language === 'ar' ? 'لحل النزاعات والنقاشات المعقدة برأي محايد ومنطقي' : 'Resolve conflicts logically' },
    { id: 'strategicarena', label: language === 'ar' ? 'الميدان الاستراتيجي' : 'Strategic Arena', icon: BrainCircuit, tooltip: language === 'ar' ? 'للتخطيط بعيد المدى، سواء لأهدافك الشخصية أو التجارية' : 'Long-term planning' },
    { id: 'creativelab', label: language === 'ar' ? 'المختبر الإبداعي' : 'Creative Lab', icon: Zap, tooltip: language === 'ar' ? 'لدمج الأفكار، توليد ابتكارات جديدة، وحل المشاكل بطرق غير تقليدية' : 'Generate innovative ideas' },
    { id: 'ar', label: language === 'ar' ? 'واقع تبيان المعزز' : 'Tibyan AR', icon: Box, tooltip: language === 'ar' ? 'تفاعل مع أفكارك ومجسمات المعرفة في الواقع الثلاثي الأبعاد' : 'Interact in Augmented Reality' },
    { id: 'truthmanuscript', label: language === 'ar' ? 'مخطوطة الحقيقة' : 'Truth Manuscript', icon: Sparkles, tooltip: language === 'ar' ? 'لتحويل أفكارك وتأملاتك العميقة إلى مخطوطة فنية' : 'Turn thoughts into manuscripts' },
    { id: 'knowledgecenter', label: language === 'ar' ? 'مركز المعرفة' : 'Knowledge Center', icon: Network, tooltip: language === 'ar' ? 'محرك بحث متقدم يبحث ويرتب لك المعلومات المعقدة كشبكة' : 'Advanced Knowledge Search' },
    { id: 'oracle', label: language === 'ar' ? 'المستشار الكلي' : 'Omni Counselor', icon: Command, tooltip: language === 'ar' ? 'لاستشارة النظام بشخصيات مختلفة (طبيب، مهندس، فيلسوف.. إلخ)' : 'Consult different AI personas' },
    { id: 'mylibrary', label: language === 'ar' ? 'المكتبة المفضلة' : 'My Library', icon: LibraryBig, tooltip: language === 'ar' ? 'المكان الذي تُحفظ فيه كل أفكارك القيمة لاسترجاعها لاحقاً' : 'Your saved knowledge' },
    { id: 'loyalty', label: language === 'ar' ? 'الولاء والكوبونات' : 'Loyalty & Coupons', icon: TicketPercent, tooltip: language === 'ar' ? 'نقاطك ومكافآتك وعروضك الترويجية كعضو' : 'Your rewards and discounts' },
    { 
      id: 'adminusers', 
      label: language === 'ar' ? 'المستخدمين' : 'Users', 
      icon: Users,
      tooltip: language === 'ar' ? 'لوحة تحكم إدارة المستخدمين' : 'User Management',
      hidden: !(profile?.role === 'admin' || user?.uid === 'VfYbpLBoYFQGoVyBVOlMfVCESdm1' || user?.email?.toLowerCase() === 'ah_f@hotmail.com' || user?.email?.toLowerCase().includes('alfailakawidrahmad') || user?.email?.toLowerCase().includes('dr.ahmad'))
    },
    { 
      id: 'adminqawlfasl', 
      label: language === 'ar' ? 'إدارة قول فصل' : 'Admin Qawl', 
      icon: LayoutDashboard,
      tooltip: language === 'ar' ? 'إدارة طلبات وأسئلة قول فصل' : 'Manage Qawl Fasl',
      hidden: !(profile?.role === 'admin' || user?.uid === 'VfYbpLBoYFQGoVyBVOlMfVCESdm1' || user?.email?.toLowerCase() === 'ah_f@hotmail.com' || user?.email?.toLowerCase().includes('alfailakawidrahmad') || user?.email?.toLowerCase().includes('dr.ahmad'))
    },
    {
      id: 'adminmessages',
      label: language === 'ar' ? 'صندوق الوارد' : 'Inbox',
      icon: Mail,
      tooltip: language === 'ar' ? 'رسائل الدعم والاتصال بـ تبيان' : 'Support Inbox',
      hidden: !(profile?.role === 'admin' || user?.uid === 'VfYbpLBoYFQGoVyBVOlMfVCESdm1' || user?.email?.toLowerCase() === 'ah_f@hotmail.com' || user?.email?.toLowerCase().includes('alfailakawidrahmad') || user?.email?.toLowerCase().includes('dr.ahmad'))
    },
    {
      id: 'contact',
      label: language === 'ar' ? 'تواصل معنا' : 'Contact Us',
      icon: Mail,
      tooltip: language === 'ar' ? 'أرسل لنا رسالة أو استفسار' : 'Send us a message'
    }
  ];


  const currentTabMeta = tabs.find(t => t.id === activeTab);
  const isInternalPage = activeTab !== 'home' && activeTab !== 'discover';
  const pageHelpText = language === 'ar'
    ? `هذه صفحة ${currentTabMeta?.label || 'داخلية'}. استخدم الأزرار الرئيسية داخل البطاقة لبدء الإجراء، والأيقونات الصغيرة للتنقل أو الحفظ أو فتح التفاصيل. زر الرجوع ثابت أعلى اليسار للعودة بدون أن يغطي المحتوى.`
    : `This is the ${currentTabMeta?.label || 'internal'} page. Use the main card buttons to start, and the small icons for navigation, saving, or opening details. The back button stays at the top-left without covering content.`;

  return (
        <div className={cn("h-[100dvh] tebyan-living-background font-sans flex flex-col overflow-hidden text-[#182231] selection:bg-zinc-200 selection:text-black", language === 'ar' ? 'rtl' : 'ltr')} dir={language === 'ar' ? 'rtl' : 'ltr'}>
          <AnimatePresence>
            {lighthouseIdea && (
              <LighthouseMode 
                idea={lighthouseIdea} 
                onClose={() => setLighthouseIdea(null)} 
                language={language}
              />
            )}
            {showSplash && <SplashScreen key="splash" onFinish={() => setShowSplash(false)} language={language} />}
            {!showSplash && !authReady && <SessionRestoreLoader key="session-restore" language={language} slow={showSlowRecovery} />}
            {isOffline && !showSplash && <OfflineNotice key="offline-notice" language={language} />}
            {doorTransition && !showSplash && (
              <motion.div
                key="door-transition"
                initial={{ opacity: 0, scale: 0.98, filter: 'blur(10px)' }}
                animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                exit={{ opacity: 0, scale: 1.02, filter: 'blur(10px)' }}
                transition={{ duration: 0.34, ease: 'easeOut' }}
                className="fixed inset-0 z-[120] pointer-events-none flex items-center justify-center bg-[#F8F5EF]/36 backdrop-blur-[2px]"
              >
                <div className="relative rounded-[34px] border border-white/75 bg-white/82 px-8 py-6 shadow-[0_30px_100px_rgba(142,122,174,0.16)] overflow-hidden">
                  <div className="absolute -top-20 -right-20 h-44 w-44 rounded-full bg-[#C9BEDF]/45 blur-[60px]" />
                  <div className="relative flex items-center gap-4 text-[#6E5F8E]">
                    <DoorOpen className="w-7 h-7" />
                    <span className="text-base md:text-lg font-black">{doorTransition.label}</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          
          {/* Background Elements (Volume & Texture) */}
          <div className="fixed inset-0 pointer-events-none z-0 flex flex-col transition-opacity duration-1000" style={{ opacity: Math.max(0.2, intensity * 1.2) }}>
              <div className="absolute inset-0 bg-noise mix-blend-multiply opacity-40"></div>
              <div 
                  className="absolute top-0 right-0 w-full h-full blur-[120px] transition-all duration-1000 mix-blend-normal" 
                  style={{ 
                      backgroundColor: intensity > 0.8 ? 'rgba(251, 146, 60, 0.25)' : 'var(--mood-glow)',
                      transform: `scale(${1 + intensity * 0.15})`
                  }} 
              />
          </div>
          
          <WhispersOfTheVoid isZen={isZen} language={language} />
          
          {/* Liquid Mood Pour Transition */}
          <AnimatePresence>
            {showMoodTransition && (
              <motion.div
                initial={{ clipPath: 'circle(0% at 50% 90%)', opacity: 0 }}
                animate={{ clipPath: 'circle(150% at 50% 90%)', opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                className="fixed inset-0 z-[100] pointer-events-none bg-mood-primary opacity-20"
              />
            )}
          </AnimatePresence>

          <ThoughtNebula />
          <WhisperHint language={language} forceShow={isConfused} />
          {isInternalPage && (
            <div className="fixed top-[calc(env(safe-area-inset-top)+12px)] left-3 z-[95] flex items-center gap-2 pointer-events-auto">
              <button
                type="button"
                onClick={() => handleTabChange('discover', '', true)}
                aria-label={language === 'ar' ? 'رجوع' : 'Back'}
                title={language === 'ar' ? 'رجوع' : 'Back'}
                className="tebyan-global-back w-11 h-11 rounded-2xl bg-[#182231] text-white border border-white/60 shadow-[0_14px_34px_rgba(24,34,49,0.22)] backdrop-blur-xl transition-all active:scale-95 flex items-center justify-center"
              >
                <ArrowLeft className={cn('w-5 h-5', language === 'ar' ? '' : 'rotate-180')} />
              </button>
              <button
                type="button"
                onClick={() => setShowPageHelp(v => !v)}
                aria-label={language === 'ar' ? 'شرح الصفحة' : 'Page help'}
                title={language === 'ar' ? 'شرح الصفحة' : 'Page help'}
                className="tebyan-page-help-button w-8 h-8 rounded-full bg-white/92 text-[#6E5F8E] border border-[#8E7AAE]/20 shadow-[0_10px_24px_rgba(24,34,49,0.12)] backdrop-blur-xl transition-all active:scale-95 flex items-center justify-center"
              >
                <HelpCircle className="w-4 h-4" />
              </button>
            </div>
          )}
          <AnimatePresence>
            {isInternalPage && showPageHelp && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.96 }}
                className="fixed top-[calc(env(safe-area-inset-top)+62px)] left-3 z-[94] w-[min(330px,calc(100vw-24px))] rounded-[22px] bg-white/96 border border-[#8E7AAE]/15 shadow-[0_24px_70px_rgba(24,34,49,0.16)] backdrop-blur-2xl p-4 text-right"
                dir={language === 'ar' ? 'rtl' : 'ltr'}
              >
                <div className="flex items-center gap-2 mb-2 text-[#6E5F8E]">
                  <HelpCircle className="w-4 h-4" />
                  <span className="text-xs font-black">{language === 'ar' ? 'كيف تستخدم هذه الصفحة؟' : 'How to use this page'}</span>
                </div>
                <p className="text-xs font-bold leading-relaxed text-[#64788D]">{pageHelpText}</p>
              </motion.div>
            )}
          </AnimatePresence>
          
          {/* Spatial Ghosting (الذاكرة المكانية الوهمية) */}
          {activeTab === 'discover' && (
            <SpatialGhost 
              message={language === 'ar' ? "في زيارتك السابقة، توقفت مطولاً عند مقال عن الوعي الاصطناعي.." : "During your last visit, you lingered on an article about artificial consciousness.."} 
              x="left-8" 
              y="top-1/3" 
            />
          )}
          {activeTab === 'mindmap' && (
            <SpatialGhost 
              message={language === 'ar' ? "هناك رابط خفي لم تكتشفه بعد بين الفلسفة والتكنولوجيا.." : "There is a hidden link you haven't discovered yet between philosophy and tech.."} 
              x="right-10" 
              y="top-1/4" 
            />
          )}
          {activeTab === 'qawlfasl' && (
             <SpatialGhost 
               message={language === 'ar' ? "في الشهر الماضي، سألت عن معنى 'الحقيقة المطلقة'..." : "Last month, you asked for the meaning of 'absolute truth'..."} 
               x="left-10" 
               y="bottom-1/3" 
             />
          )}
          {activeTab === 'mylibrary' && (
             <SpatialGhost 
               message={language === 'ar' ? "كتاب 'تأملات' لا يزال ينتظر أن تكمله منذ أسبوعين.." : "The book 'Meditations' is still waiting for you to finish it since two weeks ago.."} 
               x="right-8" 
               y="top-1/2" 
             />
          )}

        <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: -20, filter: 'blur(10px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 0.95, filter: 'blur(5px)' }}
            className={cn(
              "fixed top-6 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.12)] border font-medium flex items-center gap-3 text-sm max-w-[90vw] md:max-w-md w-max backdrop-blur-xl",
              toast.type === 'info' ? "bg-white/90 border-zinc-200/50 text-zinc-900" : 
              toast.type === 'error' ? "bg-rose-50/90 border-rose-200/50 text-rose-900" : 
              "bg-emerald-50/90 border-emerald-200/50 text-emerald-900"
            )}
          >
            <div className={cn("w-2 h-2 rounded-full shadow-inner", toast.type === 'info' ? "bg-blue-500" : toast.type === 'error' ? "bg-rose-500" : "bg-emerald-500")} />
            {toast.message}
          </motion.div>
        )}
        </AnimatePresence>


      <motion.header 
         animate={{ y: showHeader ? 0 : -100 }}
         transition={{ duration: 0.3, ease: "easeInOut" }}
         className="fixed top-0 left-0 right-0 z-40 px-4 md:px-8 py-3 md:py-4 flex items-center justify-between pointer-events-none"
      >
         <div className="tebyan-floating-nav flex items-center gap-4 md:gap-6 pointer-events-auto">
             <button 
               onClick={() => handleTabChange('home')}
               className="flex items-center gap-3 transition-transform active:scale-95"
             >
               <div className="w-10 h-10 bg-mood-primary rounded-2xl flex items-center justify-center text-white shadow-xl shadow-mood-glow transition-all duration-700 tebyan-orb-mark">
                 <LivingIcon icon={Globe} mood={currentMood} type="home" className="w-5 h-5" />
               </div>
               <span className="font-black text-xl text-[#182231] tracking-tighter transition-colors group-hover:text-mood-primary">تبيان</span>
             </button>
           
           {/* <button 
             onClick={() => setLanguage(l => l === 'ar' ? 'en' : 'ar')}
             className="hidden md:flex ml-4 px-3 py-1.5 rounded-full bg-white/50 backdrop-blur-sm border border-zinc-200/50 text-xs font-bold text-zinc-500 hover:text-black hover:bg-white transition-all shadow-sm"
           >
             {language === 'ar' ? 'EN' : 'عربي'}
           </button> */}
         </div>

         <div className="flex items-center gap-2 pointer-events-auto">
           <PWAHeaderButton />
           {user ? (
             <UserMenu />
           ) : authReady && Object.keys(user || {}).length === 0 ? (
               <button 
                  onClick={() => setShowLogin(true)}
                  className="bg-white/78 backdrop-blur-xl px-4 py-2 mx-2 rounded-2xl text-zinc-900 shadow-[0_10px_30px_rgba(24,34,49,0.08)] transition-all hover:scale-105 active:scale-95 border border-white/70 flex items-center gap-2"
                  title={language === 'ar' ? 'تسجيل الدخول' : 'Login'}
                >
                  <User className="w-4 h-4" />
                </button>
           ) : null}
         </div>
      </motion.header>


      {/* --- Menu Overlay --- */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-zinc-900/40 backdrop-blur-sm md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          >
            <motion.div 
              initial={{ x: language === 'ar' ? '100%' : '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: language === 'ar' ? '100%' : '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="absolute top-0 bottom-0 right-0 w-[85%] max-w-[340px] bg-white shadow-2xl flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-6 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
                <button 
                  onClick={() => { handleTabChange('home'); setMobileMenuOpen(false); }}
                  className="flex items-center gap-3 active:scale-95 transition-transform text-right"
                >
                  <div className="w-8 h-8 bg-mood-primary rounded-lg flex items-center justify-center shadow-lg shadow-mood-glow">
                    <Globe className="w-4 h-4 text-white" />
                  </div>
                  <span className="font-bold text-lg text-black">تبيان</span>
                </button>
                <button onClick={() => setMobileMenuOpen(false)} className="p-2 bg-zinc-200/50 rounded-full text-zinc-600 hover:text-black">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto py-6 px-4 space-y-1">
                {tabs.map(tab => !tab.hidden && (
                  <button
                    key={tab.id}
                    onClick={() => { handleTabChange(tab.id as Tab); setMobileMenuOpen(false); }}
                    className={cn(
                      "w-full flex flex-wrap md:flex-nowrap items-center gap-4 px-4 py-4 rounded-2xl font-medium transition-colors text-right relative",
                      activeTab === tab.id ? "bg-mood-primary text-white shadow-lg shadow-mood-glow" : "text-zinc-600 hover:bg-zinc-100 hover:text-black"
                    )}
                  >
                    <tab.icon className={cn("w-5 h-5", activeTab === tab.id ? "text-white" : "text-zinc-400")} />
                    <span>{tab.label}</span>
                  </button>
                ))}
              </div>
              <div className="p-6 border-t border-zinc-100 bg-zinc-50/50 space-y-3">
                 {/* Language Switcher Hidden
                 <button onClick={() => { setLanguage(l => l === 'ar' ? 'en' : 'ar'); setMobileMenuOpen(false); }} className="w-full flex items-center justify-center gap-2 py-3.5 bg-white border border-zinc-200/80 rounded-2xl text-sm font-semibold text-zinc-700 shadow-sm hover:border-zinc-300">
                    <Globe className="w-4 h-4" />
                    {language === 'ar' ? 'English' : 'العربية'}
                 </button>
                 */}
                 {authReady && !user && (
                    <button onClick={() => { setShowLogin(true); setMobileMenuOpen(false); }} className="w-full py-3.5 bg-black text-white rounded-2xl text-sm font-semibold shadow-md">
                      تسجيل الدخول
                    </button>
                 )}
                 {user && (
                    <div className="mt-4 pt-4 border-t border-zinc-100 space-y-3">
                      {/* Admin Link for Mobile */}
                      {(profile?.role === 'admin' || user?.uid === 'VfYbpLBoYFQGoVyBVOlMfVCESdm1' || user?.email?.toLowerCase() === 'ah_f@hotmail.com' || user?.email?.toLowerCase().includes('alfailakawidrahmad') || user?.email?.toLowerCase().includes('dr.ahmad')) && (
                        <button 
                          onClick={() => {
                            handleTabChange('admindashboard');
                          }}
                          className="w-full flex items-center justify-center gap-3 py-4 bg-zinc-900 text-white rounded-[20px] text-base font-bold shadow-lg transition-all active:scale-[0.98]"
                        >
                          <Settings className="w-5 h-5 text-amber-400" />
                          لوحة الإدارة
                        </button>
                      )}
                      
                      <button 
                        onClick={() => {
                          localStorage.removeItem('tebyan_memory');
                          localStorage.removeItem('tebyan_cognitive_memory');
                          localStorage.removeItem('tebyan_sage_progress');
                          localStorage.removeItem('tebyan_search_history');
                          localStorage.removeItem('tebyan_usage_stats');
                          localStorage.removeItem('tebyan_analytics_logs');
                          localStorage.removeItem('tebyan_galaxy_cache');
                          localStorage.removeItem('tebyan_custom_avatar');
                          localStorage.removeItem('tebyan_style_confirmed');
                          signOut(auth);
                        }} 
                        className="w-full flex items-center justify-center gap-3 py-4 bg-rose-600 text-white hover:bg-rose-700 rounded-[20px] text-base font-black shadow-lg shadow-rose-200 transition-all active:scale-[0.98]"
                      >
                        <LogOut className="w-5 h-5" />
                        تسجيل الخروج
                      </button>
                    </div>
                 )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- Desktop Sidebar Removed --- */}

      <main ref={mainRef} className={cn("flex-1 w-full min-h-0 pt-24 overflow-y-auto overflow-x-hidden relative scroll-smooth custom-scrollbar tebyan-route-shell", `tebyan-route-${activeTab}`)}>
        
        {/* Error Banner */}
        {error && (
          <div className="m-4 md:m-8 bg-rose-50 border border-rose-200 text-rose-800 px-6 py-4 rounded-2xl flex items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-3 text-sm font-medium">
              <Sparkles className="w-5 h-5 text-rose-500 shrink-0" />
              <span>{error}</span>
            </div>
            <button onClick={() => setError(null)} className="p-2 hover:bg-rose-100 rounded-full cursor-pointer transition-colors shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div 
          className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8 w-full min-h-full cursor-default"
          onClick={(e) => {
            // If clicking the direct background of the tab area, return to home if not already there
            if (e.target === e.currentTarget && activeTab !== 'home' && activeTab !== 'discover') {
              handleTabChange('home');
            }
          }}
        >
            <motion.div 
              key={activeTab} 
              initial={{ opacity: 0, y: 15, filter: 'blur(8px)' }} 
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} 
              transition={{ duration: 0.4, type: 'spring', bounce: 0 }}
              className="relative z-10"
            >
            <div className="absolute -top-10 left-12 w-32 h-32 bg-mood-glow rounded-full blur-[80px] pointer-events-none opacity-50" />
            <React.Suspense fallback={<TabFallback />}>
              {(() => {
                switch (activeTab) {
                  case 'home':
                  case 'discover':
                    return <SmartGateway language={language} handleTabChange={handleTabChange} tabs={tabs} initialQuery={initialContext} mood={currentMood} isHome={activeTab === 'home'} />;
                  case 'strategicarena':
                    return <StrategicArenaTab handleTabChange={handleTabChange} language={language} initialValue={initialContext} />;
                  case 'creativelab':
                    return <CreativeLabWrapper handleTabChange={handleTabChange} language={language} initialValue={initialContext} />;
                  case 'ar':
                    return <ARTab handleTabChange={handleTabChange} language={language} initialValue={initialContext} />;
                  case 'truthmanuscript':
                    return <TruthManuscriptTab handleTabChange={handleTabChange} language={language} initialValue={initialContext} />;
                  case 'knowledgecenter':
                    return <KnowledgeCenterTab handleTabChange={handleTabChange} language={language} initialValue={initialContext} />;
                  case 'oracle':
                    return <OracleTab handleTabChange={handleTabChange} language={language} initialValue={initialContext} />;
                  case 'concepts':
                    return <ConceptsTab handleTabChange={handleTabChange} language={language} initialValue={initialContext} />;
                  case 'quizzes':
                    return <QuizTab handleTabChange={handleTabChange} language={language} initialValue={initialContext} />;
                  case 'simulation':
                    return <SimulationTab handleTabChange={handleTabChange} language={language} initialValue={initialContext} />;
                  case 'knowledgegraph':
                    return <KnowledgeGraphTab handleTabChange={handleTabChange} language={language} />;
                  case 'timemachine':
                    return <TimeMachineTab handleTabChange={handleTabChange} language={language} initialValue={initialContext} />;
                  case 'council':
                    return <CouncilTab handleTabChange={handleTabChange} language={language} initialValue={initialContext} />;
                  case 'mindmap':
                    return <MindMapTab handleTabChange={handleTabChange} language={language} initialValue={initialContext} />;
                  case 'ripple':
                    return <RippleEffectTab language={language} handleTabChange={handleTabChange} onFocusMode={(idea) => setLighthouseIdea(idea)} />;
                  case 'analytics':
                    return <AnalyticsTab handleTabChange={handleTabChange} language={language} />;
                  case 'loyalty':
                    return <LoyaltyTab handleTabChange={handleTabChange} language={language} />;
                  case 'roadmap':
                    return <RoadmapTab handleTabChange={handleTabChange} language={language} initialValue={initialContext} />;
                  case 'story':
                    return <StoryTab handleTabChange={handleTabChange} language={language} initialValue={initialContext} />;
                  case 'mylibrary':
                    return <MyLibraryTab language={language} handleTabChange={handleTabChange} />;
                  case 'lab':
                    return <LabTab handleTabChange={handleTabChange} language={language} initialValue={initialContext} />;
                  case 'qawlfasl':
                    return <QawlFaslTab handleTabChange={handleTabChange} language={language} initialValue={initialContext} />;
                  case 'decisionroom':
                    return <DecisionExecutiveTab handleTabChange={handleTabChange} language={language} initialValue={initialContext} />;
                  case 'adminusers':
                    return (profile?.role === 'admin' || user?.uid === 'VfYbpLBoYFQGoVyBVOlMfVCESdm1' || user?.email?.toLowerCase() === 'ah_f@hotmail.com' || user?.email?.toLowerCase().includes('alfailakawidrahmad') || user?.email?.toLowerCase().includes('dr.ahmad')) ? <AdminUsersDashboard /> : null;
                  case 'adminqawlfasl':
                    return (profile?.role === 'admin' || user?.uid === 'VfYbpLBoYFQGoVyBVOlMfVCESdm1' || user?.email?.toLowerCase() === 'ah_f@hotmail.com' || user?.email?.toLowerCase().includes('alfailakawidrahmad') || user?.email?.toLowerCase().includes('dr.ahmad')) ? <AdminQawlFasl /> : null;
                  case 'adminmessages':
                    return (profile?.role === 'admin' || user?.uid === 'VfYbpLBoYFQGoVyBVOlMfVCESdm1' || user?.email?.toLowerCase() === 'ah_f@hotmail.com' || user?.email?.toLowerCase().includes('alfailakawidrahmad') || user?.email?.toLowerCase().includes('dr.ahmad')) ? <AdminContactTab language={language} /> : null;
                  case 'admindashboard':
                    return (profile?.role === 'admin' || user?.uid === 'VfYbpLBoYFQGoVyBVOlMfVCESdm1' || user?.email?.toLowerCase() === 'ah_f@hotmail.com' || user?.email?.toLowerCase().includes('alfailakawidrahmad') || user?.email?.toLowerCase().includes('dr.ahmad')) ? <AdminDashboard /> : null;
                  case 'contact':
                    return <ContactTab language={language} />;
                  default:
                    return null;
                }
              })()}
            </React.Suspense>
            </motion.div>
          
          <footer className="text-center py-6 mt-10 text-zinc-400">
             <div className="flex items-center justify-center gap-2 mb-3">
               <Globe className="w-5 h-5" />
               <span className="font-bold text-zinc-500 tracking-tight">تبيان</span>
             </div>
             <p className="text-[13px] font-medium">نظامك لفهم العالم &copy; {new Date().getFullYear()}</p>
             <div className="mt-8 flex flex-col items-center gap-6">
                 <div className="flex flex-col items-center gap-4 py-8 border-t border-zinc-100/50 w-full max-w-xs transition-all duration-700">
                  <div className="flex flex-col items-center gap-1 mb-2">
                    <p className="text-[10px] font-black uppercase tracking-[0.4em] text-mood-primary/70 animate-pulse">
                      {language === 'ar' ? 'بوصلة الوجدان' : 'MOOD COMPASS'}
                    </p>
                  </div>
                  <button 
                    onClick={() => setIsMoodHudOpen(!isMoodHudOpen)}
                    className={cn(
                      "tour-mood-compass flex items-center gap-3 px-6 py-3 rounded-full transition-all duration-500 group relative overflow-hidden active:scale-95",
                      isMoodHudOpen ? "bg-mood-primary text-white shadow-[0_0_30px_rgba(var(--mood-primary),0.3)]" : "bg-white border border-zinc-100 text-zinc-400 hover:text-mood-primary hover:border-mood-primary/30 shadow-sm"
                    )}
                  >
                    <LivingIcon icon={Compass} mood={currentMood} type="settings" className={cn("w-4 h-4 transition-all duration-1000", isMoodHudOpen ? "rotate-[360deg] scale-110" : "rotate-0 transform group-hover:rotate-45")} />
                    <span className="text-[10px] font-black uppercase tracking-widest">{language === 'ar' ? 'بوصلة الوجدان' : 'Mood Compass'}</span>
                  </button>

                  <AnimatePresence>
                    {isMoodHudOpen && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.9, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 10 }}
                        className="flex items-center gap-2 p-2 bg-white/95 backdrop-blur-xl border border-zinc-200/60 rounded-[24px] shadow-2xl mt-4"
                      >
                        <button 
                            onClick={() => { setCurrentMood('revolutionary'); setIsMoodHudOpen(false); }}
                            className={cn("p-3 rounded-xl transition-all", currentMood === 'revolutionary' ? "bg-mood-primary text-white shadow-lg shadow-mood-glow" : "text-zinc-400 hover:bg-zinc-50")}
                            title={language === 'ar' ? 'ثوري' : 'Revolutionary'}
                        >
                            <LivingIcon icon={Zap} mood="revolutionary" className="w-5 h-5" />
                        </button>
                        <button 
                            onClick={() => { setCurrentMood('calm'); setIsMoodHudOpen(false); }}
                            className={cn("p-3 rounded-xl transition-all", currentMood === 'calm' ? "bg-mood-primary text-white shadow-lg shadow-mood-glow" : "text-zinc-400 hover:bg-zinc-50")}
                            title={language === 'ar' ? 'هادئ' : 'Calm'}
                        >
                            <LivingIcon icon={Moon} mood="calm" className="w-5 h-5" />
                        </button>
                        <button 
                            onClick={() => { setCurrentMood('melancholic'); setIsMoodHudOpen(false); }}
                            className={cn("p-3 rounded-xl transition-all", currentMood === 'melancholic' ? "bg-mood-primary text-white shadow-lg shadow-mood-glow" : "text-zinc-400 hover:bg-zinc-50")}
                            title={language === 'ar' ? 'عميق' : 'Melancholic'}
                        >
                            <LivingIcon icon={Heart} mood="melancholic" className="w-5 h-5" />
                        </button>
                        <button 
                            onClick={() => { setCurrentMood('optimistic'); setIsMoodHudOpen(false); }}
                            className={cn("p-3 rounded-xl transition-all", currentMood === 'optimistic' ? "bg-mood-primary text-white shadow-lg shadow-mood-glow" : "text-zinc-400 hover:bg-zinc-50")}
                            title={language === 'ar' ? 'متفائل' : 'Optimistic'}
                        >
                            <LivingIcon icon={Sun} mood="optimistic" className="w-5 h-5" />
                        </button>
                        <div className="w-px h-8 bg-zinc-100 mx-1" />
                        <button 
                            onClick={async () => {
                              if (!user) {
                                 showToast(language === 'ar' ? 'سجل دخولك لتجد توأمك الفكري' : 'Sign in to find your intellectual twin', 'info');
                                 setShowLogin(true);
                                 return;
                              }
                              setIsAnalyzingTwin(true);
                              try {
                                const q = query(collection(db, 'ripples'), where('authorId', '==', user.uid), limit(5));
                                const snap = await getDocs(q);
                                const posts = snap.docs.map(d => d.data().text);
                                if (posts.length < 2) {
                                  showToast(language === 'ar' ? 'انشر بذوراً أكثر لنحلل نمطك الفكري!' : 'Post more seeds to analyze your pattern!', 'info');
                                  return;
                                }
                                const res = await findSoulMatch(posts, language);
                                if (res) setSoulTwinMsg(res);
                              } finally {
                                setIsAnalyzingTwin(false);
                              }
                            }}
                            className={cn("p-3 rounded-xl transition-all relative group", isAnalyzingTwin ? "bg-zinc-50" : "bg-zinc-900 text-white")}
                        >
                            {isAnalyzingTwin ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                              <>
                                <Brain className="w-5 h-5 relative z-10" />
                                <div className="absolute inset-0 bg-mood-primary opacity-0 group-hover:opacity-20 transition-opacity rounded-xl" />
                              </>
                            )}
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <div className="mt-12 flex flex-col items-center gap-1 opacity-40 scale-75 pt-8 border-t border-zinc-100/30 w-full max-w-[200px]">
                   <span className="text-[10px] font-mono font-bold tracking-widest uppercase text-zinc-500">Version 2.6.0.Release</span>
                </div>
             </div>
          </footer>
        </div>
      </main>

      {/* Login Modal - Moved out of flow */}
      <AnimatePresence>
        {showLogin && !user && (
          <motion.div 
            initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
            animate={{ opacity: 1, backdropFilter: 'blur(12px)' }}
            exit={{ opacity: 0, backdropFilter: 'blur(0px)' }}
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99999 }}
            className="flex items-center justify-center p-4 bg-zinc-900/40"
            onClick={() => setShowLogin(false)}
          >
            <div className="relative w-full max-w-md" onClick={(e) => e.stopPropagation()}>
              <button 
                onClick={() => setShowLogin(false)}
                className="absolute -top-12 right-0 z-10 p-2.5 bg-white/20 hover:bg-white/40 rounded-full text-white transition-all backdrop-blur-md"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="shadow-[0_24px_60px_rgb(0,0,0,0.12)] rounded-[24px] md:rounded-[32px] overflow-hidden">
                 <Login />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {(activeTab === 'home' || activeTab === 'discover') && (
        <>
          {false && <TheOrb 
            language={language}
            onTap={() => setShowGlobalCommand(true)}
            onDragUp={() => setShowVoiceCanvas(true)}
          />}
          <MessagesFloatingButton />
        </>
      )}

      <VoiceCanvas
        isOpen={showVoiceCanvas}
        onClose={() => setShowVoiceCanvas(false)}
        language={language}
      />

      <GlobalCommand 
        isOpen={showGlobalCommand} 
        onClose={() => setShowGlobalCommand(false)} 
        language={language}
        tabs={tabs}
        handleTabChange={handleTabChange}
      />

      {false && (activeTab === 'home' || activeTab === 'discover') && (
        <SerendipityCompass language={language} contextTopic={initialContext || activeTab} handleTabChange={handleTabChange} />
      )}

      <AnimatePresence>
          {isAnalyzingTwin && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-6"
              >
                 <motion.div 
                   initial={{ scale: 0.9, opacity: 0 }}
                   animate={{ scale: 1, opacity: 1 }}
                   exit={{ scale: 0.9, opacity: 0 }}
                   className="w-full max-w-sm bg-zinc-950 border border-zinc-800 rounded-[40px] p-10 flex flex-col items-center justify-center relative overflow-hidden shadow-2xl"
                 >
                    {/* Artistic Particle/Wave Animation */}
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-transparent to-emerald-500/10 animate-pulse pointer-events-none" />
                    <div className="w-24 h-24 relative mb-8">
                       <motion.div 
                         initial={{ rotate: 0 }}
                         animate={{ rotate: 360 }}
                         transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                         className="absolute inset-0 border-[2px] border-dashed border-zinc-700 rounded-full"
                       />
                       <motion.div 
                         initial={{ rotate: 360 }}
                         animate={{ rotate: 0 }}
                         transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
                         className="absolute inset-2 border-[1px] border-zinc-600 rounded-full opacity-60"
                       />
                       <div className="absolute inset-4 bg-zinc-900 rounded-full flex items-center justify-center border border-zinc-800 shadow-inner">
                           <Brain className="w-8 h-8 text-indigo-400 animate-pulse" />
                       </div>
                    </div>
                    <h4 className="font-serif text-white text-xl mb-3">{language === 'ar' ? 'نقرأ نسيجك الفكري...' : 'Reading your thought fabric...'}</h4>
                    <p className="text-zinc-500 text-sm text-center font-medium leading-relaxed">
                        {language === 'ar' ? 'نقارن نبضاتك مع آلاف العقول بحثاً عن توأم روحك' : 'Comparing your pulses with thousands of minds...'}
                    </p>
                 </motion.div>
              </motion.div>
          )}
          {soulTwinMsg && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="fixed bottom-32 z-50 left-8 right-8 md:left-auto md:right-8 md:w-[400px] p-8 bg-zinc-950 border border-zinc-800 rounded-[32px] shadow-[0_20px_60px_rgba(0,0,0,0.4)] overflow-hidden"
              >
                  <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-indigo-500 to-emerald-500" />
                  <button onClick={() => setSoulTwinMsg(null)} className="absolute top-6 right-6 p-2 text-zinc-500 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
                  <div className="flex items-center gap-4 mb-6">
                      <div className="w-12 h-12 bg-zinc-900 border border-zinc-800 rounded-[18px] flex items-center justify-center text-indigo-400 shadow-inner">
                          <Sparkles className="w-6 h-6" strokeWidth={1.5} />
                      </div>
                      <h4 className="font-serif text-white text-lg">{language === 'ar' ? 'توأم الروح الفكري' : 'Intellectual Twin'}</h4>
                  </div>
                  <p className="text-zinc-400 font-serif leading-relaxed text-[15px]">{soulTwinMsg}</p>
              </motion.div>
          )}
      </AnimatePresence>

      <PWAInstallPrompt />
      <OnboardingTour language={language} />

      </div>
  );
};

import { TooltipProvider } from './components/ui/tooltip';

const App = () => (
  <CognitiveModeProvider>
    <GamificationProvider>
      <UserProvider>
        <TooltipProvider delayDuration={300}>
          <AppContent />
        </TooltipProvider>
      </UserProvider>
    </GamificationProvider>
  </CognitiveModeProvider>
);

export default App;
