import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Sparkles, MessageCircleQuestion, BrainCircuit, Gamepad2, ArrowLeft, Lightbulb, Zap, Route, Rocket, Activity, BarChart3, Network, Hourglass, ClipboardCheck, Command, X, LibraryBig, Lock, Box, Waves, ScrollText, Compass, Moon, Home, Eye, CheckCircle2, LayoutGrid } from 'lucide-react';
import { cn } from '../lib/utils';
import { logEvent } from '../services/analyticsService';
import { useUser } from '../contexts/UserContext';
import { useAuth } from '../components/AuthProvider';
import { detectEmotion } from '../services/gemini';

import { GravityCard } from './GravityCard';
import { AIHeartbeat } from './ui/AIHeartbeat';
import { TypographicAcoustic } from './TypographicAcoustic';
import { SmartIntentEngine } from './common/SmartIntentEngine';
import { KnowledgeSignature } from './common/KnowledgeSignature';
import { TebyanGlyph } from './common/TebyanGlyph';
import TextareaAutosize from 'react-textarea-autosize';
import { TebyanTooltip } from './TebyanTooltip';

const DAILY_CHALLENGES = [
    {
        titleAr: 'كيف تدير صراعاً حاداً بين أفراد فريقك أو عائلتك؟',
        titleEn: 'How to manage severe conflict among your team or family?',
        query: 'كيف أتعامل مع توتر حاد وصدام بين شخصين في فريقي؟',
        path: 'simulation_roleplay'
    },
    {
        titleAr: 'ماذا تفعل إذا انهارت خطتك في اللحظة الأخيرة؟',
        titleEn: 'What to do if your plan falls apart at the last minute?',
        query: 'خطة مهمة جداً فشلت فجأة، كيف ألملم الوضع وأتخذ قراراً؟',
        path: 'simulation_roleplay'
    },
  {
      titleAr: 'كيف تتصرف مع عميل أو شريك غاضب جداً؟',
      titleEn: 'How do you handle a very angry client or partner?',
      query: 'كيف أتصرف بذكاء مع شخص منفعل وغاضب يهاجمني الآن؟',
      path: 'simulation_roleplay'
  },
  {
      titleAr: 'كيف تتخذ قراراً صعباً وسط ضغوط متضاربة؟',
      titleEn: 'How to make a difficult decision amid conflicting pressures?',
      query: 'أواجه قراراً معقداً ولا أعرف من أين أبدأ أو كيف أوازن المخاطر؟',
      path: 'simulation_roleplay'
  },
    {
        titleAr: 'كيف تقنع طرفاً عنيداً بتوجه جديد دون صدام؟',
        titleEn: 'How to convince a stubborn party without a clash?',
        query: 'كيف أقنع شخصاً عنيداً بتغيير المسار وتجربة شيء جديد؟',
        path: 'simulation_roleplay'
    }
];

const PLATFORM_INSIGHTS = [
    {
        titleAr: 'أكثر التحديات الإنسانية هذا الأسبوع',
        titleEn: 'Top human challenges this week',
        items: [
            { labelAr: 'إدارة الغضب', labelEn: 'Anger Management', pct: '70%', color: 'bg-[#8FA9C7]' },
            { labelAr: 'صناعة القرار', labelEn: 'Decision Making', pct: '85%', color: 'bg-[#8E7AAE]' }
        ]
    },
    {
        titleAr: 'تحديات التواصل الحديثة',
        titleEn: 'Modern Communication Challenges',
        items: [
            { labelAr: 'القلق والمخاوف', labelEn: 'Anxiety & Fears', pct: '60%', color: 'bg-[#B7A7C7]' },
            { labelAr: 'الإقناع والتفاوض', labelEn: 'Persuasion & Negotiation', pct: '75%', color: 'bg-[#AFC0D2]' }
        ]
    },
    {
        titleAr: 'مواقف صعبة شائعة اليوم',
        titleEn: 'Common Difficult Situations Today',
        items: [
            { labelAr: 'العناد المفرط', labelEn: 'Extreme Stubbornness', pct: '80%', color: 'bg-[#9F8CC0]' },
            { labelAr: 'رفض التغيير', labelEn: 'Resistance to Change', pct: '50%', color: 'bg-[#CFDAE5]' }
        ]
    },
    {
        titleAr: 'محاور الذكاء العاطفي',
        titleEn: 'Emotional Intelligence Focus',
        items: [
            { labelAr: 'حل النزاعات', labelEn: 'Conflict Resolution', pct: '65%', color: 'bg-[#9BB4CD]' },
            { labelAr: 'التواصل الفعال', labelEn: 'Effective Communication', pct: '90%', color: 'bg-[#D6CDE2]' }
        ]
    }
];

const colorMap: Record<string, string> = {
  mood: 'var(--mood-primary)',
  secondary: 'var(--mood-secondary)',
  zinc: '#71717a'
};

import { useFluidTyping } from '../hooks/useFluidTyping';

interface SmartGatewayProps {
  language: 'ar' | 'en';
  handleTabChange: (id: any, context?: string) => void;
  tabs: any[];
  mood?: string;
  isHome?: boolean;
}

type JourneyProfile = {
  id: string;
  title: { ar: string; en: string };
  promise: { ar: string; en: string };
  firstDoor: { ar: string; en: string };
  deepen: { ar: string; en: string };
  accent: string;
  icon: any;
};

const pickJourneyProfile = (raw: string, fallbackId?: string): JourneyProfile => {
  const q = (raw || '').toLowerCase();
  const has = (...words: string[]) => words.some(word => q.includes(word));

  if (has('قرار', 'اختار', 'احسم', 'حيرة', 'محتار', 'مصيري', 'decision', 'choose', 'decide') || fallbackId === 'decisionroom') {
    return {
      id: 'decision',
      title: { ar: 'رحلة قرار', en: 'Decision journey' },
      promise: { ar: 'نحول الحيرة إلى باب واحد واضح، ثم نزيد العمق فقط إذا احتجت.', en: 'We turn hesitation into one clear doorway, then deepen only if needed.' },
      firstDoor: { ar: 'افتح أول باب للحسم', en: 'Open the first decision doorway' },
      deepen: { ar: 'بعدها نقدر نكشف المخاطر أو المستقبل.', en: 'After that, we can reveal risks or the future.' },
      accent: '#8E7AAE',
      icon: Lock
    };
  }

  if (has('فكرة', 'ابتكار', 'مشروع', 'تصميم', 'إبداع', 'creative', 'idea', 'project', 'design') || fallbackId === 'creativelab') {
    return {
      id: 'idea',
      title: { ar: 'رحلة فكرة', en: 'Idea journey' },
      promise: { ar: 'نأخذ الفكرة الخام ونفتح لها أول زاوية قابلة للتطوير.', en: 'We take the raw idea and open the first buildable angle.' },
      firstDoor: { ar: 'ابدأ تشكيل الفكرة', en: 'Start shaping the idea' },
      deepen: { ar: 'بعدها نقدر نحولها لخطة أو نختبرها.', en: 'Then we can turn it into a plan or test it.' },
      accent: '#C8A9CB',
      icon: Lightbulb
    };
  }

  if (has('خطة', 'خطوات', 'تنفيذ', 'هدف', 'roadmap', 'plan', 'execute', 'goal') || fallbackId === 'roadmap') {
    return {
      id: 'execution',
      title: { ar: 'رحلة تنفيذ', en: 'Execution journey' },
      promise: { ar: 'نرتب الفوضى إلى خطوة أولى، ثم مسار قابل للمتابعة.', en: 'We turn the mess into a first step, then a trackable path.' },
      firstDoor: { ar: 'حوّلها إلى خطوة عملية', en: 'Turn it into an action step' },
      deepen: { ar: 'بعدها نقدر نقيس التقدم أو نرسم الطريق.', en: 'Then we can measure progress or map the road.' },
      accent: '#8FA9C7',
      icon: Route
    };
  }

  if (has('خلاف', 'نزاع', 'غضب', 'توتر', 'صراع', 'مشكلة', 'conflict', 'angry', 'fight', 'tension') || fallbackId === 'qawlfasl') {
    return {
      id: 'conflict',
      title: { ar: 'رحلة موقف', en: 'Situation journey' },
      promise: { ar: 'نهدئ الضجيج ونفتح أول باب لفهم الموقف والتصرف بذكاء.', en: 'We quiet the noise and open the first doorway to understand and act wisely.' },
      firstDoor: { ar: 'افتح باب التصرف الصحيح', en: 'Open the right response doorway' },
      deepen: { ar: 'بعدها نقدر نحاكي الحوار أو نسمع زوايا مختلفة.', en: 'Then we can simulate the dialogue or hear different angles.' },
      accent: '#A8C3BD',
      icon: MessageCircleQuestion
    };
  }

  if (has('مستقبل', 'توقع', 'زمن', 'مخاطر', 'سيناريو', 'future', 'risk', 'scenario') || fallbackId === 'simulation') {
    return {
      id: 'future',
      title: { ar: 'رحلة مستقبل', en: 'Future journey' },
      promise: { ar: 'نفتح لك أول مشهد لما قد يحدث، بدون إغراقك بالتفاصيل.', en: 'We open the first scene of what may happen, without flooding you with details.' },
      firstDoor: { ar: 'شاهد أول سيناريو', en: 'See the first scenario' },
      deepen: { ar: 'بعدها نقدر نختبر القرار بقسوة أكبر.', en: 'Then we can stress-test it harder.' },
      accent: '#B7A7C7',
      icon: Hourglass
    };
  }

  return {
    id: 'understanding',
    title: { ar: 'رحلة فهم', en: 'Understanding journey' },
    promise: { ar: 'نبدأ بفهم واضح واحد، ثم نفتح العمق فقط إذا طلبته.', en: 'We begin with one clear understanding, then open depth only when you ask.' },
    firstDoor: { ar: 'افتح باب الفهم', en: 'Open the understanding doorway' },
    deepen: { ar: 'بعدها نقدر نحول الفهم إلى قرار أو خطة.', en: 'Then we can turn understanding into a decision or plan.' },
    accent: '#7C8796',
    icon: BrainCircuit
  };
};

const getMoodTypography = (mood: string) => {
  switch (mood) {
    case 'revolutionary':
      return "font-black italic skew-x-[-10deg] tracking-tight transition-all duration-700";
    case 'calm':
      return "font-light tracking-widest italic opacity-80 font-sans transition-all duration-1000";
    case 'melancholic':
      return "font-medium tracking-tight opacity-70 underline underline-offset-4 decoration-current transition-all duration-1000";
    case 'optimistic':
      return "font-bold tracking-normal uppercase transition-all duration-500";
    default:
      return "font-bold tracking-tight transition-all";
  }
};


const getCognitiveMood = (text: string, language: 'ar' | 'en') => {
  const q = (text || '').toLowerCase();
  const has = (words: string[]) => words.some(w => q.includes(w));
  if (has(['خطر', 'أزمة', 'طوارئ', 'كارثة', 'ينتحر', 'يؤذي', 'urgent', 'danger', 'crisis', 'emergency'])) {
    return {
      id: 'warning',
      label: language === 'ar' ? 'مقام تنبيه هادئ' : 'Calm alert mood',
      hint: language === 'ar' ? 'تبيان سيحافظ على الهدوء ويطلب السياق الحاسم.' : 'Tebyan will stay calm and ask for decisive context.',
      accent: '#A6603F',
      glow: 'rgba(166,96,63,0.16)',
      soft: 'rgba(166,96,63,0.07)'
    };
  }
  if (has(['قرار', 'احسم', 'اختار', 'حيرة', 'أقرر', 'decide', 'decision', 'choose'])) {
    return {
      id: 'decision',
      label: language === 'ar' ? 'مقام قرار' : 'Decision mood',
      hint: language === 'ar' ? 'السؤال يميل إلى الترجيح والحسم.' : 'This leans toward weighing and deciding.',
      accent: '#8E7AAE',
      glow: 'rgba(142,122,174,0.22)',
      soft: 'rgba(142,122,174,0.08)'
    };
  }
  if (has(['إبداع', 'فكرة', 'ابتكار', 'مشروع', 'creative', 'idea', 'innovation', 'project'])) {
    return {
      id: 'creative',
      label: language === 'ar' ? 'مقام إبداع' : 'Creative mood',
      hint: language === 'ar' ? 'تبيان سيبحث عن زاوية جديدة لا عن جواب عادي.' : 'Tebyan will seek a fresh angle, not a generic answer.',
      accent: '#C8A9CB',
      glow: 'rgba(200,169,203,0.22)',
      soft: 'rgba(200,169,203,0.08)'
    };
  }
  if (has(['معرفة', 'مفهوم', 'بحث', 'مصدر', 'تعلم', 'knowledge', 'concept', 'research', 'learn'])) {
    return {
      id: 'knowledge',
      label: language === 'ar' ? 'مقام معرفة' : 'Knowledge mood',
      hint: language === 'ar' ? 'السؤال يحتاج ربطاً بين المفاهيم والمعنى.' : 'This needs links between concepts and meaning.',
      accent: '#7C8796',
      glow: 'rgba(124,135,150,0.20)',
      soft: 'rgba(124,135,150,0.08)'
    };
  }
  return {
    id: 'understanding',
    label: language === 'ar' ? 'مقام فهم' : 'Understanding mood',
    hint: language === 'ar' ? 'تبيان يقرأ طبيعة السؤال ويهيّئ مسار الفهم.' : 'Tebyan reads the question and prepares the understanding path.',
    accent: '#8FA9C7',
    glow: 'rgba(143,169,199,0.22)',
    soft: 'rgba(143,169,199,0.08)'
  };
};

const ThoughtJourney = ({ language, moodLabel }: { language: 'ar' | 'en', moodLabel: string }) => {
  const steps = language === 'ar'
    ? [
        { label: 'كُتبت', icon: MessageCircleQuestion },
        { label: 'فُهمت', icon: Eye },
        { label: 'وُجّهت', icon: Route },
        { label: 'صارت معرفة', icon: CheckCircle2 },
      ]
    : [
        { label: 'Written', icon: MessageCircleQuestion },
        { label: 'Understood', icon: Eye },
        { label: 'Routed', icon: Route },
        { label: 'Knowledge', icon: CheckCircle2 },
      ];
  return (
    <div className="tebyan-thought-journey tebyan-focus-keep" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/80 border border-[#8E7AAE]/14 shadow-sm">
            <Sparkles className="h-4 w-4 text-[#8E7AAE]" />
          </span>
          <div>
            <p className="text-xs font-black text-[#182231]">{language === 'ar' ? 'رحلة الفكرة' : 'Thought journey'}</p>
            <p className="text-[10px] font-bold text-[#7C8796]">{moodLabel}</p>
          </div>
        </div>
        <span className="text-[10px] font-black text-[#8E7AAE] bg-white/70 px-3 py-1 rounded-full border border-[#8E7AAE]/10">
          {language === 'ar' ? 'مسار معرفي' : 'Cognitive path'}
        </span>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <div key={step.label} className="relative rounded-2xl bg-white/72 border border-[#8FA9C7]/14 px-2 py-3 text-center shadow-sm overflow-hidden">
              {index < steps.length - 1 && <span className="hidden md:block absolute top-1/2 -left-2 h-px w-4 bg-[#8FA9C7]/28" />}
              <Icon className="h-4 w-4 mx-auto mb-2 text-[#6E5F8E]" />
              <span className="block text-[10px] md:text-[11px] font-black text-[#465568]">{step.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const MoodBackgroundEffect = ({ mood }: { mood: string }) => {
  if (mood === 'melancholic') {
    return (
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        {[...Array(8)].map((_, i) => (
          <motion.div
            key={`drop-${i}`}
            initial={{ y: -50, opacity: 0 }}
            animate={{ 
              y: [null, 200, 600], 
              opacity: [0, 0.4, 0],
              x: (10 + Math.random() * 80) + '%'
            }}
            transition={{ 
              duration: 10 + Math.random() * 8, 
              repeat: Infinity,
              delay: i * 1.5 
            }}
            className="absolute top-0 w-[1px] h-40 bg-gradient-to-b from-transparent via-mood-primary/30 to-transparent blur-[1px]"
          />
        ))}
      </div>
    );
  }
  if (mood === 'revolutionary') {
    return (
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        {[...Array(15)].map((_, i) => (
          <motion.div
            key={`spark-${i}`}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ 
              scale: [0, 1.5, 0], 
              opacity: [0, 0.8, 0],
              x: (Math.random() * 100) + '%',
              y: (Math.random() * 100) + '%'
            }}
            transition={{ 
              duration: 1.5 + Math.random() * 1.5, 
              repeat: Infinity,
              delay: i * 0.3 
            }}
            className="absolute w-1 h-1 bg-mood-primary rounded-full shadow-[0_0_8px_rgba(var(--mood-primary-rgb),0.8)]"
          />
        ))}
      </div>
    );
  }
  return null;
};

import { useSmartSearch } from '../hooks/useSmartSearch';

export const SmartGateway: React.FC<SmartGatewayProps & { initialQuery?: string, onQueryUsed?: () => void }> = ({ language, handleTabChange, tabs, initialQuery, onQueryUsed, mood, isHome = false }) => {
  const { preferences, setUserStyle: setGlobalUserStyle } = useUser();
  const { user } = useAuth();
  const { onType, fluidTheme, getFluidStyles, getFluidAmbient } = useFluidTyping();
  const [query, setQuery] = useState(() => sessionStorage.getItem('tebyan_current_query') || '');
  const [searchValue, setSearchValue] = useState(() => sessionStorage.getItem('tebyan_current_query') || '');
  
  const { smartSuggestion, isSuggestionLoading, setSmartSuggestion } = useSmartSearch(searchValue);
  const suggestion = smartSuggestion;
  const setSuggestion = setSmartSuggestion;

  const latestInputRef = useRef(searchValue);
  const [isFocused, setIsFocused] = useState(false);
  
  const EPHEMERAL_WISDOMS = useMemo(() => [
    { ar: 'الشك هو بداية اليقين.. لا تخف من إعادة النظر في قناعاتك اليوم.', en: 'Doubt is the beginning of certainty.. don\'t fear reconsidering your convictions today.' },
    { ar: 'القرار الذي تتجنبه هو غالباً القرار الذي تحتاجه.', en: 'The decision you are avoiding is often the one you need.' },
    { ar: 'ليس كل تراجع فشل، بعض التراجعات هي إعادة تموضع.', en: 'Not every retreat is a failure; some are repositioning.' },
    { ar: 'عندما تتساوى الخيارات، اختر الخيار الذي يوسع آفاقك.', en: 'When options are equal, choose the one that expands your horizons.' },
    { ar: 'الصمت في بعض الحوارات هو أقوى إجابة.', en: 'Silence in some dialogues is the most powerful answer.' },
    { ar: 'لا تقيم قراراً جيداً بناءً على نتيجة سيئة حدثت بالصدفة.', en: 'Do not judge a good decision by a bad outcome that happened by chance.' },
    { ar: 'الخوف من اتخاذ القرار أسوأ من القرار الخاطئ.', en: 'The fear of making a decision is worse than making a wrong one.' }
  ], []);

  const [ephemeralTime, setEphemeralTime] = useState({ m: 9, s: 59 });
  const [wisdomIndex, setWisdomIndex] = useState(0);

  useEffect(() => {
    const updateEphemeralTimer = () => {
        const now = new Date();
        const minutes = now.getMinutes();
        const seconds = now.getSeconds();
        
        const m = 9 - (minutes % 10);
        const s = 59 - seconds;
        
        setEphemeralTime({ m, s });
        setWisdomIndex(Math.floor(now.getTime() / (10 * 60 * 1000)) % EPHEMERAL_WISDOMS.length);
    };
    
    updateEphemeralTimer();
    const interval = setInterval(updateEphemeralTimer, 1000);
    return () => clearInterval(interval);
  }, [EPHEMERAL_WISDOMS.length]);

  const currentWisdom = EPHEMERAL_WISDOMS[wisdomIndex];
  
  const [challengeIndex, setChallengeIndex] = useState(0);
  const [insightIndexList, setInsightIndexList] = useState(0);

  useEffect(() => {
    setChallengeIndex(Math.floor(Math.random() * DAILY_CHALLENGES.length));
    setInsightIndexList(Math.floor(Math.random() * PLATFORM_INSIGHTS.length));
  }, []);

  const currentChallenge = DAILY_CHALLENGES[challengeIndex % DAILY_CHALLENGES.length];

  /**
   * Handle the "Surprise" button by selecting a random challenge each time
   * it is clicked. This ensures the user receives varied suggestions rather
   * than the same preset challenge on each interaction. After selecting a
   * random challenge, navigate to its path using onPathSelect.
   */
  const handleSurprise = () => {
    const randomIndex = Math.floor(Math.random() * DAILY_CHALLENGES.length);
    setChallengeIndex(randomIndex);
    const randomChallenge = DAILY_CHALLENGES[randomIndex];
    onPathSelect(randomChallenge.path as any, randomChallenge.query);
  };
  const currentInsight = PLATFORM_INSIGHTS[insightIndexList % PLATFORM_INSIGHTS.length];

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key && e.key.length === 1) {
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  const [hasSearched, setHasSearched] = useState(() => sessionStorage.getItem('tebyan_current_has_searched') === 'true');
  const [showExpertPaths, setShowExpertPaths] = useState(false);
  const [showDirectTools, setShowDirectTools] = useState(false);
  const [showInspiration, setShowInspiration] = useState(false);
  const [showGateEcho, setShowGateEcho] = useState(false);

  useEffect(() => {
    const revealGate = () => {
      setShowGateEcho(true);
      setTimeout(() => setShowGateEcho(false), 2800);
      try { sessionStorage.removeItem('tebyan_gate_to_search'); } catch(e) {}
    };
    if (sessionStorage.getItem('tebyan_gate_to_search') === 'true') {
      setTimeout(revealGate, 250);
    }
    window.addEventListener('tebyan_gate_to_search', revealGate);
    return () => window.removeEventListener('tebyan_gate_to_search', revealGate);
  }, []);

  const handleSearchInputChange = (value: string) => {
    setSearchValue(value);
    latestInputRef.current = value;
    setSmartSuggestion("");
    setQuery(value);
    onType();
    if (hasSearched) setHasSearched(false);
    setShowExpertPaths(false);
    setShowDirectTools(false);
  };

  const [isQueryExpanded, setIsQueryExpanded] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [loadingPhraseIndex, setLoadingPhraseIndex] = useState(0);
  const [showFollowUp, setShowFollowUp] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  const loadingPhrasesAr = [
      'نرتّب الفكرة بهدوء…',
      'نبحث عن أقرب مسار لفهم ما كتبت…',
      'نوازن بين المعنى والسياق…',
      'نخفف الضجيج ونستخرج الجوهر…',
      'نجهز لك مساراً معرفياً مرتباً…'
  ];

  const loadingPhrasesEn = [
      'Dissecting strategic dimensions...',
      'Scanning potential decision paths...',
      'Filtering behavioral contradictions...',
      'Extracting hidden negotiation essence...',
      'Constructing a comprehensive roadmap...'
  ];

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isThinking) {
        setLoadingPhraseIndex(0);
        interval = setInterval(() => {
            setLoadingPhraseIndex(prev => (prev + 1) % loadingPhrasesAr.length);
        }, 1200);
    }
    return () => clearInterval(interval);
  }, [isThinking]);
  const [lastInteraction, setLastInteraction] = useState<any>(null);
  const proactiveInsights = useMemo(() => {
    const hour = new Date().getHours();
    let arG, enG, arSub, enSub;
    let dynamicSuggests: {ar: string, en: string}[] = [];

    const isWeekend = new Date().getDay() === 0 || new Date().getDay() === 6;

    if (hour < 12) {
      if (lastInteraction && lastInteraction.query) {
        arG = 'صباح الوعي والتجدد';
        enG = 'Good morning, visionary';
        arSub = (
          <div className="inline-flex flex-wrap justify-center items-center gap-1 cursor-pointer" onClick={() => setIsQueryExpanded(!isQueryExpanded)}>
            <span>أهلاً بك مجدداً.. توقفنا في المرة السابقة عند</span>
            <span className={`text-content text-[#6E5F8E] font-bold transition-all ${isQueryExpanded ? 'whitespace-normal w-full text-center mt-2 break-words' : 'truncate max-w-[200px] md:max-w-[400px] inline-block align-bottom'}`}>
                "{lastInteraction.query}"
            </span>
            <span>، هل القهوة جاهزة لنكمل؟ ☕</span>
          </div>
        );
        enSub = (
          <div className="inline-flex flex-wrap justify-center items-center gap-1 cursor-pointer" onClick={() => setIsQueryExpanded(!isQueryExpanded)}>
            <span>Welcome back.. last time we stopped at</span>
             <span className={`text-content text-[#6E5F8E] font-bold transition-all ${isQueryExpanded ? 'whitespace-normal w-full text-center mt-2 break-words' : 'truncate max-w-[200px] md:max-w-[400px] inline-block align-bottom'}`}>
                "{lastInteraction.query}"
            </span>
            <span>, is your coffee ready to continue? ☕</span>
          </div>
        );
        dynamicSuggests = [
            { ar: `أكمل تحليل: ${lastInteraction.query}`, en: `Continue analyzing: ${lastInteraction.query}` },
            { ar: `كيف أتعامل مع تمرد أو عناد الموظفين؟`, en: `How can I deal with team rebellion?` },
            { ar: `أفضل طريقة لإيصال أخبار سيئة للإدارة؟`, en: `Best way to deliver bad news to management?` },
            { ar: `تقييم مخاطر قرار توسع استراتيجي`, en: `Evaluate risks of a strategic expansion` },
            { ar: `خطوات حل نزاع حاد بين شريكين`, en: `Steps to resolve severe conflict between partners` },
            { ar: `كيف أعيد تحفيز فريق أصابه الإحباط؟`, en: `How to remotivate a frustrated team?` },
            { ar: `التعامل مع عميل منفعل وغاضب جداً`, en: `Handling a very angry and frustrated client` },
            { ar: `مراجعة خطة تراجع المبيعات المفاجئ`, en: `Reviewing sudden drop in sales plan` }
        ].sort(() => 0.5 - Math.random());
      } else {
        arG = 'صباح الوعي والتجدد';
        enG = 'Morning of awareness';
        arSub = 'هل نلخص لك التحولات المعرفية لهذا الصباح؟';
        enSub = 'Shall we summarize the cognitive shifts this morning?';
        dynamicSuggests = [
            { ar: `استعراض ملخص التطورات في سوق العمل`, en: `Global developments summary in labor market` },
            { ar: `بناء خريطة تحفيز لفريق المبيعات`, en: `Build a daily strategic roadmap for sales` },
            { ar: `كيف أرتب أولويات المؤسسة لتخطي الأزمة؟`, en: `How to prioritize organizational goals during crisis?` },
            { ar: `تحليل فجوات الأداء الإداري والمهارات`, en: `Analyze management performance and skill gaps` },
            { ar: `كيف أعالج مشكلة تسرب الكفاءات الوظيفية؟`, en: `How to treat employee turnover?` },
            { ar: `تحليل آليات اتخاذ القرار في أوقات التعثر المالي`, en: `Analyzing decision-making under financial crisis` },
            { ar: `كيف أدير أزمة تواصل مع شريك استراتيجي؟`, en: `How to handle a communication crisis with partner?` },
            { ar: `مراجعة مؤشرات الأداء الحيوية بعد الفشل`, en: `Reviewing vital performance indicators after failure` }
        ].sort(() => 0.5 - Math.random()).slice(0, 6);
      }
    } else if (hour < 18) {
      if (lastInteraction && lastInteraction.query) {
        arG = 'مساء التمكين والعمق';
        enG = 'Good afternoon, visionary';
        arSub = (
          <div className="inline-flex flex-wrap justify-center items-center gap-1 cursor-pointer" onClick={() => setIsQueryExpanded(!isQueryExpanded)}>
            <span>أهلاً بك مجدداً.. توقفنا في المرة السابقة عند</span>
            <span className={`text-content text-[#6E5F8E] font-bold transition-all ${isQueryExpanded ? 'whitespace-normal w-full text-center mt-2 break-words' : 'truncate max-w-[200px] md:max-w-[400px] inline-block align-bottom'}`}>
                "{lastInteraction.query}"
            </span>
            <span>، هل نكمل الاستكشاف؟ ☕</span>
          </div>
        );
        enSub = (
          <div className="inline-flex flex-wrap justify-center items-center gap-1 cursor-pointer" onClick={() => setIsQueryExpanded(!isQueryExpanded)}>
            <span>Welcome back.. last time we stopped at</span>
            <span className={`text-content text-[#6E5F8E] font-bold transition-all ${isQueryExpanded ? 'whitespace-normal w-full text-center mt-2 break-words' : 'truncate max-w-[200px] md:max-w-[400px] inline-block align-bottom'}`}>
                "{lastInteraction.query}"
            </span>
            <span>, shall we continue exploring? ☕</span>
          </div>
        );
        dynamicSuggests = [
            { ar: `أكمل تحليل: ${lastInteraction.query}`, en: `Continue analyzing: ${lastInteraction.query}` },
            { ar: `مراجعة وتصحيح مسار القرار الأخير`, en: `Review and correct my path about this` },
            { ar: `طريقة احتواء استقالة مفاجئة`, en: `How to contain a sudden resignation` },
            { ar: `كيف أتعامل مع ضغط تراجع الأرباح الآن؟`, en: `How to handle profit drop stress now?` },
            { ar: `توليد أفكار لتسويق منتج متعثر`, en: `Brainstorming marketing for struggling product` },
            { ar: `تحليل التحديات المعقدة في الاندماج`, en: `Analyze complex challenges in merger` }
        ].sort(() => 0.5 - Math.random()).slice(0, 6);
      } else {
          arG = 'منتصف يوم حافل';
          enG = 'A busy midday';
          arSub = 'هل تحتاج لنقطة ارتكاز قبل اتخاذ قرارك القادم؟';
          enSub = 'Do you need a pivot point before your next decision?';
          dynamicSuggests = [
              { ar: `اقتراح الموازنة بين ميزانية التسويق والتشغيل`, en: `Suggest balancing marketing vs operations budget` },
              { ar: `مراجعة وتصحيح مسار مشاريع اليوم`, en: `Review and correct my path today` },
              { ar: `كيف أتعامل مع تمرد العمال ومطالبهم؟`, en: `How to deal with worker demands?` },
              { ar: `كيف أتعامل مع ضغط تهديدات المنافس الجديد؟`, en: `How to handle threat of new competitor?` },
              { ar: `فكرة إبداعية لحل مشكلة توفر الموارد`, en: `Creative idea to solve resources issue` },
              { ar: `نصيحة للخروج من تعقّد الإجراءات الروتينية`, en: `Tip to escape complex bureaucratic procedures` },
              { ar: `كيف أدير اجتماعاً عاصفاً بطريقة أفضل؟`, en: `How to run a chaotic meeting better?` },
              { ar: `التعامل بحكمة مع تسريب أسرار العمل`, en: `Handling data leak with wisdom` },
              { ar: `توليد حلول لمشروع ديون مستعصي`, en: `Brainstorming ideas for debt management` }
          ].sort(() => 0.5 - Math.random()).slice(0, 6);
      }
    } else {
      if (lastInteraction && lastInteraction.query) {
        arG = 'مساء التأمل والعمق';
        enG = 'Evening of reflection';
        arSub = (
          <div className="inline-flex flex-wrap justify-center items-center gap-1 cursor-pointer" onClick={() => setIsQueryExpanded(!isQueryExpanded)}>
            <span>أهلاً بك مجدداً.. توقفنا في المرة السابقة عند</span>
             <span className={`text-content text-[#6E5F8E] font-bold transition-all ${isQueryExpanded ? 'whitespace-normal w-full text-center mt-2 break-words' : 'truncate max-w-[200px] md:max-w-[400px] inline-block align-bottom'}`}>
                "{lastInteraction.query}"
            </span>
            <span>.. هل كان يوماً مثمراً؟ 🌟</span>
          </div>
        );
        enSub = (
          <div className="inline-flex flex-wrap justify-center items-center gap-1 cursor-pointer" onClick={() => setIsQueryExpanded(!isQueryExpanded)}>
            <span>Welcome back.. last time we stopped at</span>
             <span className={`text-content text-[#6E5F8E] font-bold transition-all ${isQueryExpanded ? 'whitespace-normal w-full text-center mt-2 break-words' : 'truncate max-w-[200px] md:max-w-[400px] inline-block align-bottom'}`}>
                "{lastInteraction.query}"
            </span>
            <span>, how was your day? 🌟</span>
          </div>
        );
        dynamicSuggests = [
            { ar: `أكمل تحليل: ${lastInteraction.query}`, en: `Continue analyzing: ${lastInteraction.query}` },
            { ar: `كيف أستعد لمواجهة الخصم غداً بذكاء؟`, en: `How to prepare for opponent tomorrow smartly?` },
            { ar: `حوار هادئ لحل أزمة ثقة مع فريق العمل`, en: `Calm dialogue to resolve team trust crisis` },
            { ar: `تقييم خسائر اليوم وكيفية التعويض`, en: `Reflections on today's losses and compensation` },
            { ar: `خطوات تأسيس بيئة عمل أكثر شفافية`, en: `Steps to build a more transparent work environment` },
            { ar: `التغلب على التفكير المفرط بالخسارة`, en: `Overcoming overthinking of business loss` }
        ].sort(() => 0.5 - Math.random()).slice(0, 6);
      } else {
          arG = 'مساء التأمل والعمق';
          enG = 'Evening of reflection';
          arSub = 'ما الذي يشغل حيز وعيك في نهاية هذا اليوم؟';
          enSub = 'What occupies your consciousness at the end of this day?';
          dynamicSuggests = [
              { ar: `تأملات استراتيجية في مخرجات الأزمة السابقة`, en: `Strategic reflections on today's crisis output` },
              { ar: `التخطيط الاستباقي للأسوأ غداً`, en: `Proactive planning for the worst tomorrow` },
              { ar: `تقييم الاستجابة למوقف تمرد الموظفين اليوم`, en: `Evaluate response to employee rebellion` },
              { ar: `حوار منهجي لترتيب إغلاق الشراكة`, en: `Systematic dialogue for partnership closure` },
              { ar: `استعراض أسباب رفض المشروع وسبل التعديل`, en: `Summarizing project rejection and pivoting` },
              { ar: `تحليل استراتيجي لمنافس شرس ظهر اليوم`, en: `Strategic analysis of a new competitor seen today` },
              { ar: `مراجعة أخلاقيات القرار في بيئة تسريح العمال`, en: `Review decision ethics in layoff environment` },
              { ar: `كيفية بناء إرث مهني والنجاة من الإفلاس`, en: `How to survive bankruptcy and build a legacy` }
          ].sort(() => 0.5 - Math.random()).slice(0, 6);
      }
    }
    return { arG, enG, arSub, enSub, dynamicSuggests };
  }, [lastInteraction, isQueryExpanded]);
  
  // React to initialQuery prop
  useEffect(() => {
    if (initialQuery) {
        setQuery(initialQuery);
        sessionStorage.setItem('tebyan_current_query', initialQuery);
        
        // Restore search results if they exist, rather than re-computing
        const wasSearched = sessionStorage.getItem('tebyan_current_has_searched') === 'true';
        if (wasSearched) {
            setHasSearched(true);
        } else {
            handleSubmit(undefined, initialQuery);
        }
        
        if (onQueryUsed) onQueryUsed();
    }
  }, [initialQuery, onQueryUsed]);

  const [styleConfirmed, setStyleConfirmed] = useState(() => localStorage.getItem('tebyan_style_confirmed') === 'true');
  const [showStylePicker, setShowStylePicker] = useState(false);

  const confirmStyle = (style: 'practical' | 'analytical' | 'simulation') => {
    setGlobalUserStyle(style);
    setStyleConfirmed(true);
    localStorage.setItem('tebyan_style_confirmed', 'true');
    setShowStylePicker(false);
    logEvent('feature_use', language, undefined, { confirmedStyle: style });
  };

  const [selectionFeedback, setSelectionFeedback] = useState('');
  const [sageProgress, setSageProgress] = useState({
    points: 0,
    level: 'seeker',
    badges: [] as string[],
    stats: { wisdom: 0, dialogue: 0, patience: 0 }
  });

  const levels = [
    { id: 'seeker', ar: 'باحث', en: 'Seeker', min: 0 },
    { id: 'awakened', ar: 'متيقظ', en: 'Awakened', min: 100 },
    { id: 'enlightened', ar: 'مستنير', en: 'Enlightened', min: 300 },
    { id: 'sage', ar: 'حكيم', en: 'Sage', min: 600 },
    { id: 'transcendent', ar: 'متسامي', en: 'Transcendent', min: 1000 }
  ];

  const badges = [
    { id: 'wisdom', icon: BrainCircuit, ar: 'وسام الحكمة', en: 'Wisdom Badge', desc: { ar: 'تُمنح لتحليل المواقف بعمق قبل الرد', en: 'Awarded for deep analysis before acting' } },
    { id: 'dialogue', icon: MessageCircleQuestion, ar: 'وسام الحوار', en: 'Dialogue Badge', desc: { ar: 'تُمنح للتدريب على الحوار المتزن', en: 'Awarded for practicing balanced dialogue' } },
    { id: 'patience', icon: Sparkles, ar: 'وسام الصبر', en: 'Patience Badge', desc: { ar: 'تُمنح للمتابعة والوصول لنتائج هادئة', en: 'Awarded for following up and reaching calm results' } }
  ];

  useEffect(() => {
    // Memory Layer & Gamification: Load from localStorage
    const savedMemory = localStorage.getItem('tebyan_memory');
    const savedProgress = localStorage.getItem('tebyan_sage_progress');

    if (savedProgress) {
      setSageProgress(JSON.parse(savedProgress));
    }

    if (savedMemory) {
      const data = JSON.parse(savedMemory);
      const currentUid = user?.uid || null;
      
      // Only load memory if it belongs to the current user state
      if (data.uid === currentUid) {
        setLastInteraction(data);
        if (user) {
          const lastTime = new Date(data.timestamp).getTime();
          const now = new Date().getTime();
          if (now - lastTime > 3600000 && !data.followedUp) {
            setShowFollowUp(true);
          } else {
            setShowFollowUp(false);
          }
        } else {
          setShowFollowUp(false);
        }
      } else {
        setLastInteraction(null);
        setShowFollowUp(false);
      }
    }
  }, [user]);

  const updateSageProgress = (pointsToAdd: number, statKey?: keyof typeof sageProgress.stats) => {
    setSageProgress(prev => {
      const newPoints = prev.points + pointsToAdd;
      const newStats = { ...prev.stats };
      if (statKey) newStats[statKey] += 1;

      // Check for level up
      const currentLevelObj = [...levels].reverse().find(l => newPoints >= l.min) || levels[0];
      
      // Check for new badges
      const newBadges = [...prev.badges];
      if (newStats.wisdom >= 3 && !newBadges.includes('wisdom')) newBadges.push('wisdom');
      if (newStats.dialogue >= 3 && !newBadges.includes('dialogue')) newBadges.push('dialogue');
      if (newStats.patience >= 2 && !newBadges.includes('patience')) newBadges.push('patience');

      const next = {
        points: newPoints,
        level: currentLevelObj.id,
        badges: newBadges,
        stats: newStats
      };
      
      localStorage.setItem('tebyan_sage_progress', JSON.stringify(next));
      return next;
    });
  };

  const handleFollowUpFeedback = (status: 'success' | 'fail') => {
    if (lastInteraction) {
        const updated = { ...lastInteraction, followedUp: true, feedback: status };
        localStorage.setItem('tebyan_memory', JSON.stringify(updated));
        setLastInteraction(updated);
        
        if (status === 'success') {
            updateSageProgress(20, 'patience');
        }
    }
    setShowFollowUp(false);
  };

  const clearSearch = () => {
    setHasSearched(false);
    setIsThinking(false);
    setSearchValue("");
    setQuery("");
    sessionStorage.setItem('tebyan_current_query', "");
    sessionStorage.setItem('tebyan_current_has_searched', 'false');
    setSmartSuggestion("");
    setShowExpertPaths(false);
  };

  useEffect(() => {
    if (searchValue.trim() === "") {
        setHasSearched(false);
        setIsThinking(false);
        setQuery("");
        setSmartSuggestion("");
        setShowExpertPaths(false);
    }
  }, [searchValue]);

    const onPathSelect = (id: any, query: string) => {
    console.log('[SmartGateway] onPathSelect called:', id, query);
    // Usage Tracking for personalization
    const usageStats = JSON.parse(localStorage.getItem('tebyan_usage_stats') || '{}');
    usageStats[id] = (usageStats[id] || 0) + 1;
    localStorage.setItem('tebyan_usage_stats', JSON.stringify(usageStats));

    // Memory
    const memory = {
        query,
        path: id,
        timestamp: new Date().toISOString(),
        followedUp: false,
        uid: user?.uid || null
    };
    localStorage.setItem('tebyan_memory', JSON.stringify(memory));

    // Gamification rewards based on behavior
    if (id === 'council' || id === 'concepts') updateSageProgress(15, 'wisdom');
    else if (id === 'simulation' || id === 'lab') updateSageProgress(10, 'dialogue');
    else updateSageProgress(5);

    handleTabChange(id, query);
  };

  const [errorMsg, setErrorMsg] = useState('');
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  
  useEffect(() => {
    if (hasSearched && !isThinking) {
        setTimeout(() => {
            const el = window.innerWidth < 768 
               ? document.getElementById('mobile-results') 
               : document.getElementById('desktop-results');
            el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    }
  }, [hasSearched, isThinking]);

  const [emotion, setEmotion] = useState<'neutral'|'stress'|'creative'>('neutral');

  useEffect(() => {
    if (emotion === 'stress') {
        document.body.classList.add('emotion-stress');
        document.body.classList.remove('emotion-creative');
    } else if (emotion === 'creative') {
        document.body.classList.add('emotion-creative');
        document.body.classList.remove('emotion-stress');
    } else {
        document.body.classList.remove('emotion-stress', 'emotion-creative');
    }
    return () => {
        document.body.classList.remove('emotion-stress', 'emotion-creative');
    }
  }, [emotion]);

  useEffect(() => {
    const history = localStorage.getItem('tebyan_search_history');
    if (history) setSearchHistory(JSON.parse(history));
  }, []);

  const addToHistory = (q: string) => {
    const newHistory = [q, ...searchHistory.filter(h => h !== q)].slice(0, 5);
    setSearchHistory(newHistory);
    localStorage.setItem('tebyan_search_history', JSON.stringify(newHistory));
  };

  const [showResumePrompt, setShowResumePrompt] = useState(() => {
    const lastQuery = sessionStorage.getItem('tebyan_current_query');
    const lastHasSearched = sessionStorage.getItem('tebyan_current_has_searched');
    return !!lastQuery && lastHasSearched !== 'true';
  });

  const [insightIndex, setInsightIndex] = useState(0);
  
  const getIntentAndEmotion = (q: string) => {
    const lowQ = q.toLowerCase();
    
    // Urgent / Risk / Emergency / Defense
    const urgentWords = ['عاجل', 'خطر', 'مصيبة', 'مشكلة كبيرة', 'كارثة', 'طوارئ', 'انقذني', 'شسوي', 'الحقوني', 'طاحت', 'urgent', 'danger', 'crisis', 'emergency', 'help', 'save me'];
    if (urgentWords.some(w => lowQ.includes(w))) return { type: 'urgent', intent: 'rescue', emotion: 'panic' };
    
    // Emotional / Psychological Conflict / Needs Safety
    const emotionalWords = ['كذب', 'يخفي', 'خوف', 'قلق', 'توتر', 'مكتئب', 'حزين', 'ضايق خلقي', 'مهموم', 'مخنوق', 'lie', 'hide', 'fear', 'anxiety', 'stress', 'depressed', 'sad'];
    if (emotionalWords.some(w => lowQ.includes(w))) return { type: 'emotional', intent: 'safety', emotion: 'vulnerability' };

    // Behavioral / Aggression / Resistance / Expression
    const behavioralWords = ['غضب', 'يصارخ', 'عناد', 'يرفض', 'تحدي', 'يضرب', 'يعاند', 'ما يسمع', 'نجرة', 'يقهر', 'angry', 'scream', 'stubborn', 'refuse', 'challenge', 'hit', 'frustrated'];
    if (behavioralWords.some(w => lowQ.includes(w))) return { type: 'behavioral', intent: 'expression', emotion: 'frustration' };

    // Strategic / Planning / Decision / Development
    const strategicWords = ['خطة', 'هدف', 'مشروع', 'مستقبل', 'قرار', 'طموح', 'plan', 'goal', 'project', 'future', 'decision', 'ambition'];
    if (strategicWords.some(w => lowQ.includes(w))) return { type: 'strategic', intent: 'development', emotion: 'focus' };

    // Understanding / Explanation / Logical / Curiosity
    const understandingWords = ['ليش', 'شلون', 'كيف', 'مفاهيم', 'شرح', 'فهم', 'why', 'how', 'concept', 'explain', 'understand'];
    if (understandingWords.some(w => lowQ.includes(w))) return { type: 'explanation', intent: 'understanding', emotion: 'curiosity' };

    return { type: 'mixed_general', intent: 'observation', emotion: 'neutral' };
  };

  const getDynamicInsights = () => {
    const { emotion, type, intent } = getIntentAndEmotion(query);
    const base = language === 'ar' ? [
      "كل سلوك هو رسالة...دعنا نفهم ما وراء السطح.",
      "الهدوء والوعي الإدراكي هما أقوى أدوات الإدارة.",
      "الحلول الاستراتيجية تُبنى بالتدرج والملاحظة.",
      "فهم السياق يسبق اتخاذ القرار دائماً.",
      "الرؤية الشاملة تفتح أبواب الحلول المبتكرة."
    ] : [
      "Every behavior is a message...let's understand what's beneath.",
      "Calmness and awareness are the strongest management tools.",
      "Strategic solutions are built gradually.",
      "Understanding context always precedes decision making.",
      "A holistic view opens the door to innovative solutions."
    ];

    if (type === 'urgent') {
      return language === 'ar' ? 
        ["في المواقف العاجلة، الخطوة الأولى هي التهدئة", "تجنب القرارات الانفعالية أثناء الأزمات الحادة", ...base] : 
        ["In urgent situations, the first step is de-escalation", "Avoid impulsive decisions during acute crises", ...base];
    }
    if (type === 'behavioral' || emotion === 'frustration') {
      return language === 'ar' ? 
        ["المقاومة غالباً ما تكون وسيلة تواصل غير ناضجة", "افصل بين السلوك وبين الشخص نفسه", ...base] : 
        ["Resistance is often an immature form of communication", "Separate the behavior from the person", ...base];
    }
    if (type === 'emotional' || emotion === 'fear' || emotion === 'vulnerability') {
      return language === 'ar' ? 
        ["الصدق والمصارحة تُبنى بالثقة لا بالخوف", "الاحتواء العاطفي هو المفتاح الأول في هذه الحالة", ...base] : 
        ["Honesty is built on trust, not fear", "Emotional containment is the first key in this state", ...base];
    }
    if (emotion === 'frustration' || intent === 'expression') {
      return language === 'ar' ? 
        ["خلف كل صرخة حاجة لم تُلبَ", "هدوؤك هو قدوته الأولى في استرجاع السيطرة على النفس", ...base] : 
        ["Behind every scream is an unmet need", "Your calm is their first example of regaining self-control", ...base];
    }
    if (intent === 'identity') {
      return language === 'ar' ? 
        ["العناد غالباً ما يكون صرخة لاستقلال الشخصية", "امنحه خيارات بدلاً من الأوامر المباشرة", ...base] :
        ["Stubbornness is often a cry for independent personality", "Give them choices instead of direct orders", ...base];
    }
    return base;
  };

  const dynamicInsights = useMemo(getDynamicInsights, [query, language]);

  useEffect(() => {
    let interval: any;
    if (isThinking) {
      interval = setInterval(() => {
        setInsightIndex(prev => (prev + 1) % dynamicInsights.length);
      }, 1500);
    }
    return () => clearInterval(interval);
  }, [isThinking, dynamicInsights]);

  const handleSubmit = (e?: React.FormEvent, overrideQuery?: string) => {
    if (e) e.preventDefault();
    const activeQuery = overrideQuery || query;
    console.log('[SmartGateway] Search triggered. Query:', activeQuery);
    
    if (!activeQuery.trim()) {
      console.log('[SmartGateway] Search blocked: active query is empty');
      setErrorMsg(language === 'ar' ? 'لم تكتمل الفكرة بعد، أضف سطرًا واحدًا فقط' : 'The idea is not complete yet. Add one short line.');
      setTimeout(() => setErrorMsg(''), 3000);
      return;
    }

    if (overrideQuery) setQuery(overrideQuery);
    setShowResumePrompt(false);

    if (activeQuery.trim()) {
        try {
            const historyStr = localStorage.getItem('tebyan_search_history');
            let historyList = historyStr ? JSON.parse(historyStr) : [];
            if (!historyList.includes(activeQuery)) {
                historyList.unshift(activeQuery);
                historyList = historyList.slice(0, 50); // keep recent 50
                localStorage.setItem('tebyan_search_history', JSON.stringify(historyList));
            }
        } catch (e) {}
    }

    // Intercept fluid navigation commands
    const qLower = activeQuery.toLowerCase();
    const navMatch = tabs?.find(t => 
      qLower.includes('افتح') && qLower.includes(t.label.toLowerCase()) || 
      qLower.includes('open') && qLower.includes(t.label.toLowerCase())
    );

    if (navMatch) {
        setIsThinking(true);
        setTimeout(() => {
            setIsThinking(false);
            handleTabChange(navMatch.id as any);
        }, 100); // ultra fast transition effect
        return;
    }

    // Analytics: Log search
    logEvent('search', language, activeQuery);
    addToHistory(activeQuery);
    try {
      localStorage.setItem('tebyan_last_session', JSON.stringify({ query: activeQuery, tool: 'discover', toolLabel: language === 'ar' ? 'البحث الذكي' : 'Smart search', at: new Date().toISOString() }));
    } catch (e) {}

    detectEmotion(activeQuery).then(emo => {
      setEmotion(emo);
    }).catch(console.error);

    // Caching check
    const cacheKey = `tebyan_cache_v1_${activeQuery.trim().toLowerCase()}`;
    const isCached = localStorage.getItem(cacheKey);

    setHasSearched(false);
    setIsThinking(true);
    sessionStorage.setItem('tebyan_current_query', activeQuery);
    sessionStorage.setItem('tebyan_current_has_searched', 'false');
    
    // Performance: Faster analysis if cached, or just reduced base delay
    const delay = 5; // Ultra fast, almost no fake loading delay 

    
    setTimeout(() => {
        // Phase 2: Show initial insight if available
        if (!isCached) {
            logEvent('feature_use', language, activeQuery, { phase: 'pre_insight' });
        }
    }, delay * 0.4);

    setTimeout(() => {
      setIsThinking(false);
      setHasSearched(true);
      setSuggestion('');
      sessionStorage.setItem('tebyan_current_has_searched', 'true');
      setSelectionFeedback('');
      localStorage.setItem(cacheKey, 'true'); // Flag it as "seen" to speed up next time
      console.log('[SmartGateway] Analysis complete.');
    }, delay);
  };

  const handlePathSelect = (id: string, q: string) => {
    console.log('[SmartGateway] Path selected triggered:', id, 'with query:', q);
    
    // Save usage stats for ranking boost
    try {
      const stats = JSON.parse(localStorage.getItem('tebyan_usage_stats') || '{}');
      stats[id] = (stats[id] || 0) + 1;
      localStorage.setItem('tebyan_usage_stats', JSON.stringify(stats));
    } catch (e) { console.warn('Failed to save usage stats', e); }

    // Analytics: Log path selection
    logEvent('path_select', language, q, { pathId: id });
    
    setSelectionFeedback('');
    setSuggestion('');
    
    try {
      localStorage.setItem('tebyan_last_session', JSON.stringify({ query: q, tool: id, toolLabel: id, at: new Date().toISOString() }));
    } catch (e) {}
    onPathSelect(id, q);
  };

  const currentLevelObj = useMemo(() => {
    return [...levels].reverse().find(l => sageProgress.points >= l.min) || levels[0];
  }, [sageProgress.points]);

  const followUpPrompts = useMemo(() => {
    if (!query || query.length < 5) return [];
    const q = query.toLowerCase();
    if (q.includes('كذب') || q.includes('lie')) return [
        { ar: 'كيف أبني الثقة مجدداً؟', en: 'How to rebuild trust?' },
        { ar: 'ما هي دوافع الكذب في هذا العمر؟', en: 'Why do they lie at this age?' }
    ];
    if (q.includes('غضب') || q.includes('angry')) return [
        { ar: 'تمارين هدوء فورية', en: 'Immediate calming exercises' },
        { ar: 'خطوات احتواء الموقف', en: 'Steps to contain the situation' }
    ];
    return [
        { ar: 'أقترح لي خطة عمل تفصيلية', en: 'Suggest a detailed action plan' },
        { ar: 'ما هي المخاطر المحتملة؟', en: 'What are the potential risks?' }
    ];
  }, [query, language]);

  const ALL_CHIP_SUGGESTIONS = [
    { ar: 'كيف أتعامل مع مراهق بدأ يدخن؟', en: 'How should I deal with a teenager who started smoking?' },
    { ar: 'كيف أتعامل مع مراهق عنيد بدون صدام؟', en: 'How to deal with a stubborn teenager without conflict?' },
    { ar: 'شخص قريب مني يعاند كثيراً، شنو التصرف الأنسب؟', en: 'Someone close to me is very stubborn, what is the best response?' },
    { ar: 'رفيجي بالدوام وايد يذم فيني قفاي، شلون أتصرف؟', en: 'My friend at work backbites me, how to behave?' },
    { ar: 'في ضغط بالعمل وأحتاج طريقة أتعامل فيها بهدوء', en: 'There is pressure at work and I need a calm way to handle it' },
    { ar: 'كيف أتعامل مع الكذب المتكرر بهدوء؟', en: 'How should I deal with repeated lying calmly?' },
    { ar: 'شخص يرفض التزاماً مهماً ويتحجج كثيراً', en: 'Someone avoids an important commitment and makes excuses' },
    { ar: 'التعامل مع التعلق الزائد بالألعاب الإلكترونية', en: 'Dealing with excessive attachment to electronic games' },
    { ar: 'كيف نعزز الصدق والأمانة في بيئة البيت أو العمل؟', en: 'How to strengthen honesty and integrity at home or work?' },
    { ar: 'توسعة النشاط التجاري المتعثر', en: 'Expanding a struggling business' },
    { ar: 'إقناع المستثمرين بتمويل المشروع', en: 'Persuading investors to fund the project' },
    { ar: 'إدارة أزمة ثقة حادة داخل الفريق', en: 'Managing a severe trust crisis within the team' },
    { ar: 'الموازنة بين العقل والعاطفة في القرار', en: 'Balancing mind and emotion in decisions' },
    { ar: 'ابتكار نموذج عمل تنافسي وجريء', en: 'Innovating a competitive and bold business model' },
    { ar: 'استراتيجيات التفاوض مع طرف عنيد', en: 'Negotiation strategies with a stubborn party' },
    { ar: 'تحليل المنافسين وتوقع خطواتهم القادمة', en: 'Analyzing competitors and predicting their next moves' },
    { ar: 'قرار مصيري بشأن تغيير المسار المهني', en: 'Critical decision about career path change' }
  ];

  const chipSuggestions = useMemo(() => {
    const history = JSON.parse(localStorage.getItem('tebyan_search_history') || '[]');
    const filtered = ALL_CHIP_SUGGESTIONS.filter(s => !history.includes(language === 'ar' ? s.ar : s.en));
    return [...(filtered.length > 0 ? filtered : ALL_CHIP_SUGGESTIONS)].sort(() => 0.5 - Math.random()).slice(0, 7);
  }, [language]);

  const allPossibleQueries = useMemo(() => {
    const list = [
      ...ALL_CHIP_SUGGESTIONS.map(s => language === 'ar' ? s.ar : s.en),
      ...DAILY_CHALLENGES.map(c => language === 'ar' ? c.titleAr : c.titleEn),
      ...proactiveInsights.dynamicSuggests.map(s => language === 'ar' ? s.ar : s.en),
      ...searchHistory
    ];
    return Array.from(new Set(list)).filter(s => typeof s === 'string' && s.length > 0);
  }, [language, proactiveInsights.dynamicSuggests, searchHistory]);

  const smartResponse = useMemo(() => {
    if (query.trim().length < 5) return null;
    const q = query.toLowerCase();
    
    // Dynamic Analysis based on keywords
    let analysis = '';
    if (q.includes('كذب') || q.includes('كاذب') || q.includes('lie')) {
      analysis = language === 'ar' 
        ? `تحليلي لموقف (الكذب) في "${query}" يشير إلى حاجة ملحة لغرس قيمة الصدق بدلاً من العقاب فقط.` 
        : `My analysis of the (lying) situation in "${query}" suggests an urgent need to instill the value of honesty rather than just punishment.`;
    } else if (q.includes('خوف') || q.includes('يخاف') || q.includes('fear') || q.includes('afraid')) {
      analysis = language === 'ar'
        ? `يبدو أن "${query}" يعكس حالة من القلق أو عدم الأمان، التدخل هنا يتطلب بناء جسر ثقة أولاً.`
        : `It seems "${query}" reflects a state of anxiety or insecurity; intervention here requires building a bridge of trust first.`;
    } else if (q.includes('غضب') || q.includes('صراخ') || q.includes('angry') || q.includes('scream')) {
      analysis = language === 'ar'
        ? `نوبة الغضب الموصوفة في "${query}" غالباً ما تكون وسيلة تواصل غير ناضجة لمشاعر مكبوتة.`
        : `The anger episode described in "${query}" is often an immature communication method for suppressed feelings.`;
    } else if (q.includes('شخص') || q.includes('مدير') || q.includes('زميل') || q.includes('person') || q.includes('team')) {
      analysis = language === 'ar'
        ? `الموقف في "${query}" يحتاج موازنة بين الحزم وبين الاحتواء العاطفي لتجنب التصعيد.`
        : `The situation in "${query}" needs a balance between firmness and emotional containment to avoid escalation.`;
    } else {
      analysis = language === 'ar'
        ? `قمت بتحليل "${query}"، وأرى أن الحل الأمثل يكمن في التعامل مع جذور المشكلة لا أعراضها فقط.`
        : `I analyzed "${query}", and I see that the optimal solution lies in dealing with the roots of the problem, not just its symptoms.`;
    }

    return analysis;
  }, [query, language]);

  const questionClarity = useMemo(() => {
    const text = searchValue.trim();
    if (text.length < 3) return null;
    let score = Math.min(100, 28 + Math.floor(text.length * 1.7));
    const hasContext = /(عمر|متى|وين|لماذا|ليش|سبب|مدرس|بيت|دوام|سنة|شهر|age|when|where|why|school|work)/i.test(text);
    const hasGoal = /(أريد|ابي|كيف|حل|قرار|احسم|افهم|اشرح|what|how|decide|understand)/i.test(text);
    if (hasContext) score += 18;
    if (hasGoal) score += 14;
    score = Math.max(8, Math.min(100, score));
    const level = score < 45 ? (language === 'ar' ? 'منخفض' : 'low') : score < 75 ? (language === 'ar' ? 'متوسط' : 'medium') : (language === 'ar' ? 'عالٍ' : 'high');
    const hint = hasContext
      ? (language === 'ar' ? 'سؤالك واضح. إضافة الهدف النهائي قد ترفع جودة المسار.' : 'Your question is clear. Adding the desired outcome can improve the path.')
      : (language === 'ar' ? 'السؤال واضح جزئياً. أضف العمر أو السياق أو متى يحدث الموقف.' : 'Partly clear. Add age, context, or when this happens.');
    return { score, level, hint };
  }, [searchValue, language]);

  const cognitiveMood = useMemo(() => getCognitiveMood(searchValue || query, language), [searchValue, query, language]);

  const clarityRingStyle = questionClarity
    ? {
        '--clarity-glow': cognitiveMood.glow,
        '--cognitive-accent': cognitiveMood.accent,
        '--cognitive-soft': cognitiveMood.soft
      } as React.CSSProperties
    : {
        '--clarity-glow': cognitiveMood.glow,
        '--cognitive-accent': cognitiveMood.accent,
        '--cognitive-soft': cognitiveMood.soft
      } as React.CSSProperties;

  const suggestions = useMemo(() => {
    const q = query.toLowerCase();
    const ranked: any[] = [];
    const { intent, emotion } = getIntentAndEmotion(query);
    
    console.log('[SmartGateway] STARTING ANALYSIS FOR:', q, { intent, emotion });

    // Scoring helpers with dynamic reasoning and categorization
    const addPath = (id: string, category: string, labelAr: string, labelEn: string, icon: any, descAr: string, descEn: string, reasonAr: string, reasonEn: string, score: number) => {
      // Avoid duplicates
      if (ranked.some(r => r.id === id)) return;

      // Personalization booster
      const usageStats = JSON.parse(localStorage.getItem('tebyan_usage_stats') || '{}');
      const localUsage = (usageStats[id] || 0);
      const boost = localUsage * 0.7; // Stronger local weight
      
      // Style Synergy Booster
      let styleBoost = 0;
      
      let finalScore = score + boost + styleBoost;
      
      // Intent/Emotion fallback boosts (gives an edge when keywords fail)
      if (intent === 'defense' || emotion === 'fear') {
          if (id === 'council') finalScore += 3;
          if (id === 'story') finalScore += 2;
          if (id === 'qawlfasl') finalScore += 1;
      }
      if (intent === 'expression' || emotion === 'frustration') {
          if (id === 'simulation') finalScore += 3;
          if (id === 'qawlfasl') finalScore += 2.5;
          if (id === 'council') finalScore += 1;
      }
      if (intent === 'development' || emotion === 'focus') {
          if (id === 'roadmap') finalScore += 4;
          if (id === 'quizzes') finalScore += 3;
      }
      if (intent === 'understanding' || emotion === 'curiosity') {
          if (id === 'oracle') finalScore += 4;
          if (id === 'concepts') finalScore += 3;
          if (id === 'mindmap') finalScore += 2;
      }

      // Dynamic reasoning adjustment based on style/keywords
      let refinedReasonAr = reasonAr;
      let refinedReasonEn = reasonEn;

      if (id === 'council') {
        refinedReasonAr = 'لأنك تفضل عادةً الفهم العميق المتأني لكل زوايا الموقف';
        refinedReasonEn = 'Because you usually prefer a deep, careful understanding of all angles';
      }

      ranked.push({
        id,
        category,
        label: language === 'ar' ? labelAr : labelEn,
        icon,
        desc: language === 'ar' ? descAr : descEn,
        reason: language === 'ar' ? refinedReasonAr : refinedReasonEn,
        weight: finalScore,
        isPersonalized: localUsage >= 3 || styleBoost > 0
      });
    };

    // --- DIMENSION MAPPING ---
    
    // 1. Action (Solution Bank)
    const actionMatch = !q || q.includes('حل') || q.includes('سؤال') || q.includes('كيف') || q.includes('عاجل') || q.includes('طوارئ') || q.includes('قرار') || q.includes('solve');
    addPath('qawlfasl', 'action', 'قول فصل', 'Solution Bank', Zap, 'حلول وقرارات مباشرة', 'Direct certified answer', 'لأن الحالة تتطلب توجيهاً عملياً وقراراً واضحاً في هذه اللحظة', 'Because you seek direct practical guidance', actionMatch ? 10 : 2);
    
    // 2. Analysis (Expert Council)
    const analysisMatch = !q || q.includes('لماذا') || q.includes('سبب') || q.includes('تحليل') || q.includes('موقف') || q.includes('حالة') || q.includes('سياق') || q.includes('why') || q.includes('reason');
    addPath('strategicarena', 'analysis', 'الميدان الاستراتيجي', 'Strategic Arena', BrainCircuit, 'تحليل ومحاكاة استراتيجية', 'Analysis and simulation', 'ميدان متكامل لتحليل المواقف، المحاكاة، واستعراض الأبعاد الزمنية للقرارات', 'Integrated arena for situation analysis, simulation, and temporal dimensions', analysisMatch ? 12 : 3);

    // 2b. Predictive Radar
    const analyticsMatch = !q || q.includes('نبض') || q.includes('رادار') || q.includes('توقع') || q.includes('سلوك') || q.includes('متابعة') || q.includes('تحليل') || q.includes('بيانات') || q.includes('pulse') || q.includes('analytics') || q.includes('radar') || q.includes('analysis') || q.includes('data');
    addPath('knowledgecenter', 'analysis', 'مركز المعرفة', 'Knowledge Center', Activity, 'الرادار والنتائج', 'Predictive Radar & Analytics', 'لقياس مدى التحسن في النتائج والتنبؤ بالسلوكيات', 'To measure performance and behavior trends', analyticsMatch ? 11 : 3);

    // 3. Simulation (Simulator)
    const simMatch = !q || q.includes('تدريب') || q.includes('تجربة') || q.includes('حوار') || q.includes('مواجهة') || q.includes('كذب') || q.includes('عناد') || q.includes('angry') || q.includes('train') || q.includes('practice') || q.includes('تقمص') || q.includes('دور') || q.includes('roleplay');
    addPath('strategicarena', 'simulation', 'الميدان الاستراتيجي', 'Strategic Arena', Gamepad2, 'تدريب واقعي ومحاكاة', 'Realistic training and simulation', 'لأن المواجهة تحتاج تدريب ومحاكاة لضمان أفضل نتيجة', 'Because confrontation needs simulation and practice', simMatch ? 11 : 3);

    // 4. Roadmap (Success Plan)
    const roadMatch = !q || q.includes('خطة') || q.includes('طريق') || q.includes('خطوات') || q.includes('برمجة') || q.includes('عناد') || q.includes('plan') || q.includes('steps') || q.includes('coding') || q.includes('program');
    addPath('knowledgecenter', 'roadmap', 'مركز المعرفة', 'Knowledge Center', Route, 'خارطة طريق ونتائج', 'Roadmap and metrics', 'لأن الموقف يحتاج خطة زمنية واضحة ومتابعة دقيقة للنتائج', 'For clear timelines and performance metrics', roadMatch ? 11 : 3);

    // 6. Innovation (Omni Counselor <button Concepts)
    const innovMatch = !q || q.includes('فكرة') || q.includes('جديد') || q.includes('ابتكار') || q.includes('تغيير') || q.includes('استراتيجية') || q.includes('innovation') || q.includes('creative') || q.includes('سؤال') || q.includes('مشورة');

    // 5. Narrative (Storyteller)
    const storyMatch = !q || q.includes('قصة') || q.includes('شخص') || q.includes('حكاية') || q.includes('تبسيط') || q.includes('كذب') || q.includes('story') || q.includes('tell');

    addPath('oracle', 'innovation', 'المستشار الكلي', 'Omni Counselor', Command, 'حوار استراتيجي شامل', 'Comprehensive cognitive dialogue', 'للحصول على مشورة حكيمة تدمج بين علوم السلوك والاستراتيجية', 'For wise advice integrating behavior and strategy', innovMatch ? 8.5 : 1.5);
    addPath('creativelab', 'innovation', 'المختبر الإبداعي', 'Creative Lab', Sparkles, 'هندسة الابتكار والأفكار', 'Idea & Innovation Engineering', 'لأنك تحتاج إلى تفكيك الموقف وابتكار وسائل جديدة للحل', 'To deconstruct the situation and innovate new solutions', innovMatch ? 8.5 : 2);
    addPath('creativelab', 'innovation', 'المختبر الإبداعي', 'Creative Lab', Zap, 'أدوات التصميم والحلول', 'Strategic design tools', 'لتحليل الأدوات المتاحة للموقف وابتكار وسائل جديدة للحل', 'To analyze available tools and innovate new ones', innovMatch ? 6 : 1);
    
    // 7. Visualization/Thinking Tools
    const thinkMatch = !q || q.includes('رسم') || q.includes('توضيح') || q.includes('بصري') || q.includes('هيكلة') || q.includes('think') || q.includes('map');
    addPath('knowledgecenter', 'thinking', 'مركز المعرفة', 'Knowledge Center', Network, 'هيكلة بصرية للأفكار', 'Visual thought structure', 'لتنظيم شتات الأفكار واستكشاف الروابط المعرفية', 'To organize thoughts and explore knowledge connections', thinkMatch ? 8 : 2);
    addPath('knowledgecenter', 'thinking', 'مركز المعرفة', 'Knowledge Center', Network, 'روابط الأفكار المكتشفة', 'Neural knowledge structure', 'لاستكشاف كيف تترابط أبحاثك وأفكارك في شبكة واحدة', 'To explore how your research and ideas interconnect', thinkMatch ? 8 : 2);
    addPath('strategicarena', 'analysis', 'الميدان الاستراتيجي', 'Strategic Arena', Hourglass, 'تأمل وحوار عبر الزمن', 'Journey through time', 'لفهم كيف تطور المفهوم عبر العصور وتوقع مستقبله', 'To understand how the concept evolved and predict its future', thinkMatch ? 8 : 2);
    
    // 8. Specialized Labs
    const specializedMatch = !q || q.includes('قرار') || q.includes('خيار') || q.includes('أزمة') || q.includes('تنفيذي') || q.includes('استراتيجي') || q.includes('decision') || q.includes('strategic') || q.includes('executive');
    addPath('decisionroom', 'innovation', 'غرفة القرار', 'Decision Room', Lock, 'مختبر القرارات الاستراتيجية', 'Strategic decision lab', 'لتحليل الخيارات المعقدة واتخاذ قرارات مصيرية بناءً على محاور القوة والمخاطر', 'To analyze complex choices and make critical decisions', specializedMatch ? 12 : 2);
    
    addPath('knowledgecenter', 'roadmap', 'مركز المعرفة', 'Knowledge Center', ClipboardCheck, 'قياس الفجوة', 'Measure gap', 'للتأكد من استيعاب السياق أو المفهوم قبل البدء في التطبيق', 'To ensure core context is understood before applying', roadMatch ? 8 : 2);
    

    // Sort by weight descending
    ranked.sort((a, b) => (b.weight || 0) - (a.weight || 0));

    console.log('[SmartGateway] RESULTS FOUND:', ranked.length);
    console.log('[SmartGateway] IDS:', ranked.map(r => r.id));

    return Array.from(new Map(ranked.map(item => [item.id, item])).values());
  }, [query, language]);

  // Split suggestions into three tiers
  const { primarySuggestion, secondarySuggestions, alternativeSuggestions } = useMemo(() => {
    const primary = suggestions[0] || null;
    const secondary = suggestions.slice(1, 3);
    const alternative = suggestions.slice(3, 12);
    
    return { 
      primarySuggestion: primary, 
      secondarySuggestions: secondary, 
      alternativeSuggestions: alternative 
    };
  }, [suggestions]);

  const journeyProfile = useMemo(() => pickJourneyProfile(query || searchValue, primarySuggestion?.id), [query, searchValue, primarySuggestion?.id]);

  const dailyDiscovery = useMemo(() => {
    const daySeed = Math.floor(Date.now() / 86400000);
    const items = [
      {
        ar: 'اختبر قراراً صغيراً كأنه قرار مصيري',
        en: 'Test a small decision like it matters',
        queryAr: 'عندي قرار صغير وأبي أختبر أثره قبل أتسرع',
        queryEn: 'I have a small decision and want to test its impact before rushing'
      },
      {
        ar: 'حوّل فكرة عادية إلى شيء قابل للتنفيذ',
        en: 'Turn an ordinary idea into something buildable',
        queryAr: 'عندي فكرة بسيطة وأبي أحولها إلى خطة قابلة للتنفيذ',
        queryEn: 'I have a simple idea and want to turn it into an executable plan'
      },
      {
        ar: 'افتح زاوية لم تكن تراها في موقفك',
        en: 'Open an angle you were not seeing',
        queryAr: 'أريد زاوية جديدة لموقف أفكر فيه كثيراً',
        queryEn: 'I want a new angle on a situation I keep thinking about'
      },
      {
        ar: 'درّب نفسك على حوار صعب قبل حدوثه',
        en: 'Rehearse a hard conversation before it happens',
        queryAr: 'عندي حوار صعب وأبي أتدرب عليه قبل أقوله',
        queryEn: 'I have a difficult conversation and want to rehearse it first'
      }
    ];
    return items[daySeed % items.length];
  }, []);

  /* useEffect for typing indicator removed to prevent conflict with handleSubmit */

  return (
    <div className="w-full max-w-5xl mx-auto px-4 md:px-8 py-2 flex flex-col min-h-0">
      {/* One-screen gateway: the user sees one question, while Tebyan routes the full lab behind it. */}
      <div className="flex flex-col mt-2 md:mt-4 mb-8 md:mb-12">
        
        {/* Title Section always visible */}
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-5 md:mb-7"
          >
             <header className="text-center">
        
                <motion.div
                   initial={{ opacity: 0 }}
                   animate={{ opacity: 1 }}
                   className="text-[#7C8796] font-black text-[10px] md:text-xs tracking-[0.28em] uppercase mb-3"
                >
                   {language === 'ar' ? 'كل تبيان في سؤال واحد' : 'All Tebyan in one question'}
                </motion.div>
                <h1 className="text-4xl md:text-6xl lg:text-[6.2rem] font-black text-[#182231] tracking-tighter leading-[0.88] mb-3 md:mb-5">
                  {language === 'ar' ? proactiveInsights.arG.split(' ')[0] : proactiveInsights.enG.split(' ')[0]}<br/>
                  <span className="text-[#8E7AAE]/35 italic">
                      {language === 'ar'
                          ? proactiveInsights.arG.split(' ').slice(1).join(' ')
                          : proactiveInsights.enG.split(' ').slice(1).join(' ')}
                  </span>
                </h1>
                <p className="mx-auto max-w-2xl text-sm md:text-base font-bold leading-relaxed text-[#64788D]">
                  {language === 'ar' ? 'اكتب الموضوع بطريقتك، وتبيان يرتب لك الباب الأنسب بدون زحمة أدوات.' : 'Write it naturally, and Tebyan opens the right doorway without tool clutter.'}
                </p>
             </header>
          </motion.div>

        <AnimatePresence>
            {showStylePicker && (
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="mb-8 bg-white border border-zinc-100 p-6 rounded-[32px] shadow-2xl space-y-6 text-right"
                >
                    <div className="flex items-center justify-between">
                        <button onClick={() => setShowStylePicker(false)} className="text-[#7C8796] hover:text-[#6E5F8E]">
                            <X className="w-5 h-5" />
                        </button>
                        <h4 className="font-black text-zinc-800">
                            {language === 'ar' ? 'كيف تفضل أن تتعلم؟' : 'How do you prefer to learn?'}
                        </h4>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {[
                            { id: 'practical', labelAr: 'عملي (حلول سريعة)', labelEn: 'Practical (Fast solutions)', icon: Zap },
                            { id: 'analytical', labelAr: 'تحليلي (فهم عميق)', labelEn: 'Analytical (Deep insight)', icon: BrainCircuit },
                            { id: 'simulation', labelAr: 'تدريبي (محاكاة)', labelEn: 'Simulation (Practice)', icon: Gamepad2 }
                        ].map(s => (
                            <button
                                key={s.id}
                                onClick={() => confirmStyle(s.id as any)}
                                className={cn(
                                    "p-4 rounded-2xl border text-right transition-all group flex flex-col gap-3",
                                    "bg-white border-zinc-100 hover:border-[#8E7AAE]/45"
                                )}
                            >
                                <s.icon className={cn("w-6 h-6", "text-[#7C8796] group-hover:text-[#6E5F8E]")} />
                                <div>
                                    <div className="font-black text-sm">{language === 'ar' ? s.labelAr : s.labelEn}</div>
                                </div>
                            </button>
                        ))}
                    </div>
                </motion.div>
            )}

            {showFollowUp && lastInteraction && !hasSearched && (
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="mb-6 md:mb-8 bg-[#F7FBF9] border border-[#A8C3BD]/25 p-4 md:p-6 rounded-[24px] md:rounded-[32px] shadow-lg space-y-4 text-[#34524B] group relative overflow-hidden"
                >
                    <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-[#A8C3BD]/25 rounded-full blur-3xl opacity-50 group-hover:scale-150 transition-transform duration-700 pointer-events-none" />
                    <div className="relative z-10">
                        <div className="flex items-center justify-between gap-3 mb-2">
                            <button onClick={() => setShowFollowUp(false)} className="text-[#7DA39A] hover:text-[#34524B] transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                            <h4 className="font-black text-sm md:text-base flex items-center gap-2">
                                <span>{language === 'ar' ? 'سؤال للاطمئنان..' : 'Checking in..'}</span>
                                <Sparkles className="w-4 h-4 text-[#6E948A]" />
                            </h4>
                        </div>
                        <p className="font-bold text-sm md:text-base mb-4 leading-relaxed bg-white/40 p-4 rounded-2xl border border-[#8E7AAE]/15 backdrop-blur-sm">
                            {language === 'ar' ? 'في المرة السابقة، فكرنا معاً حول هذا الموضوع:' : 'Last time, we thought through this topic:'}
                            <br/>
                            <span className="italic text-[#4D6B63] mt-2 block break-words opacity-80">"{lastInteraction.query}"</span>
                        </p>
                        <p className="font-bold text-sm">
                            {language === 'ar' ? 'هل سارت الأمور على ما يرام؟ هل احتجت للمزيد من الدعم؟' : 'Did things go well? Do you need more support?'}
                        </p>
                        <div className="flex flex-col sm:flex-row items-stretch gap-3 mt-4">
                            <button 
                                onClick={() => handleFollowUpFeedback('success')}
                                className="flex-1 bg-white border border-[#A8C3BD]/35 hover:border-[#8FA9C7]/50 hover:bg-[#EEF4F1] text-[#4D6B63] py-3 rounded-xl font-bold text-sm md:text-base transition-all shadow-sm active:scale-95"
                            >
                                {language === 'ar' ? 'ممتاز، خطونا خطوة للأمام 👍' : 'Great, took a step forward 👍'}
                            </button>
                            <button 
                                onClick={() => {
                                    handleFollowUpFeedback('fail');
                                    setSearchValue(language === 'ar' ? "في موضوع المرة السابقة، واجهت مشكلة إضافية وهي: " : "Regarding the previous topic, I faced another issue: ");
                                    latestInputRef.current = (language === 'ar' ? "في موضوع المرة السابقة، واجهت مشكلة إضافية وهي: " : "Regarding the previous topic, I faced another issue: ");
                                }}
                                className="flex-1 bg-white border border-rose-200 hover:border-rose-500 hover:bg-rose-50 text-rose-700 py-3 rounded-xl font-bold text-sm md:text-base transition-all shadow-sm active:scale-95"
                            >
                                {language === 'ar' ? 'ما زلت أواجه تحدياً 💬' : 'Still facing a challenge 💬'}
                            </button>
                        </div>
                        <div className="absolute top-3 left-3 hidden sm:flex items-center gap-1 opacity-50 px-2 py-1 bg-[#DDEBE7] rounded-md">
                            <Activity className="w-3 h-3" />
                            <span className="text-[10px] font-black uppercase tracking-widest">{language === 'ar' ? 'سحر المتابعة' : 'FOLLOW-UP MAGIC'}</span>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>

      <div className="relative z-20 flex flex-col items-center justify-center min-h-[40vh]">
        <MoodBackgroundEffect mood={mood || 'default'} />
        <form 
          onSubmit={handleSubmit}
          className="w-full max-w-4xl flex flex-col items-center"
        >
          <div className="w-full relative flex flex-col items-center mt-12 mb-12 group">

            {isThinking && (
               <div className="absolute inset-0 bg-mood-glow blur-[100px] rounded-full scale-150 animate-pulse pointer-events-none transition-colors duration-1000" />
            )}
            <div
              className={cn(
                "tour-search-input tebyan-gateway-ring tebyan-cognitive-mood flex items-center w-full max-w-3xl rounded-[28px] md:rounded-[32px] p-2.5 md:p-3 transition-all duration-700 border backdrop-blur-xl tebyan-soft-card relative overflow-visible",
                `tebyan-cognitive-${cognitiveMood.id}`,
                searchValue.trim().length > 0 && "tebyan-understanding-pulse",
                showGateEcho && "tebyan-gate-arrival",
                isFocused ? "ring-4 ring-[#8E7AAE]/10 shadow-[0_18px_60px_rgba(142,122,174,0.14)] bg-[#FAF9F6]/95" : "bg-[#FAF9F6]/80",
                getFluidStyles(),
                getFluidAmbient()
              )}
              style={clarityRingStyle}
            >
              {searchValue.trim().length >= 3 && (
                <div className="pointer-events-none absolute -top-9 right-5 z-20 hidden md:flex items-center gap-2 rounded-full border border-[#8E7AAE]/12 bg-white/82 px-3 py-1.5 shadow-sm backdrop-blur-xl">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: cognitiveMood.accent, boxShadow: `0 0 14px ${cognitiveMood.glow}` }} />
                  <span className="text-[10px] font-black text-[#465568]">{cognitiveMood.label}</span>
                </div>
              )}
              {showGateEcho && (
                <div className="pointer-events-none absolute -inset-10 z-0 flex items-center justify-center">
                  <motion.div
                    initial={{ scale: 1.22, opacity: 0.0 }}
                    animate={{ scale: [1.22, 1.02, 1.08], opacity: [0, 0.58, 0] }}
                    transition={{ duration: 2.65, ease: 'easeInOut' }}
                    className="h-40 w-40 rounded-full border border-[#8E7AAE]/22 bg-[#F4F0FA]/30 blur-[1px]"
                  />
                </div>
              )}
              <div className="flex-1 relative flex overflow-hidden flex-col justify-center">
                <TextareaAutosize
                  ref={inputRef as any}
                  value={searchValue}
                  minRows={1}
                  maxRows={4}
                  onChange={(e) => handleSearchInputChange(e.target.value)}
                  placeholder={language === 'ar' ? "اكتب الموضوع اللي تبي نفهمه معاك..." : "Type what you want to understand..."}
                  onKeyDown={(e) => {
                    if ((e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey)) && smartSuggestion) {
                      e.preventDefault();
                      setSearchValue(smartSuggestion);
                      latestInputRef.current = smartSuggestion;
                      setQuery(smartSuggestion);
                      setSmartSuggestion('');
                    } else if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit(undefined, searchValue);
                    } else if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && smartSuggestion) {
                      if (e.currentTarget.selectionStart === searchValue.length) {
                        e.preventDefault();
                        setSearchValue(smartSuggestion);
                        latestInputRef.current = smartSuggestion;
                        setQuery(smartSuggestion);
                        setSmartSuggestion('');
                      }
                    }
                  }}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  className="w-full bg-transparent border-none outline-none px-3 md:px-6 py-2.5 md:py-4 text-[15px] sm:text-base md:text-xl lg:text-2xl font-bold tracking-tight text-[#182231] placeholder:text-[#7C8796]/45 z-10 relative resize-none leading-relaxed"
                  dir={language === 'ar' ? 'rtl' : 'ltr'}
                  autoFocus
                />
                
                {smartSuggestion && smartSuggestion.startsWith(searchValue) && (
                  <div 
                    className="pointer-events-none absolute inset-0 px-3 md:px-6 py-2.5 md:py-4 text-[15px] sm:text-base md:text-xl lg:text-2xl font-bold tracking-tight z-0 whitespace-pre-wrap break-words leading-relaxed overflow-hidden"
                    dir={language === 'ar' ? 'rtl' : 'ltr'}
                  >
                    <span className="invisible">{searchValue}</span>
                    <span className="text-[#8E7AAE]/28">{smartSuggestion.slice(searchValue.length)}</span>
                  </div>
                )}
              </div>

              
              <button 
                  type="submit"
                  title={language === 'ar' ? 'البحث أو التحليل' : 'Search / Analyze'}
                  className={cn(
                    "bg-[#8E7AAE] text-white w-12 h-12 md:w-16 md:h-16 rounded-[18px] md:rounded-[20px] transition-all hover:scale-[1.03] active:scale-[0.98] flex items-center justify-center shrink-0 tebyan-breathe",
                    query.length > 0 ? "opacity-100 shadow-[0_16px_38px_rgba(142,122,174,0.20)]" : "opacity-35 pointer-events-none"
                  )}
                >
                    <span className="relative inline-flex items-center justify-center">
                      {searchValue.trim().length > 0 && <motion.span aria-hidden className="absolute -top-1 -left-1 h-2.5 w-2.5 rounded-full bg-white/90" animate={{ scale: [0.85, 1.35, 0.85], opacity: [0.45, 1, 0.45] }} transition={{ duration: 1.55, repeat: Infinity, ease: 'easeInOut' }} />}
                      <TebyanGlyph kind="gateway" className="w-7 h-7 md:w-8 md:h-8" />
                    </span>
                </button>
              <button
                  type="button"
                  onClick={() => {
                    clearSearch();
                    handleTabChange('discover', '');
                  }}
                  title={language === 'ar' ? 'الصفحة الرئيسية' : 'Home'}
                  className="bg-white/90 text-[#465568] border border-[#8FA9C7]/25 w-11 h-11 md:w-14 md:h-14 rounded-[16px] md:rounded-[18px] transition-all hover:scale-[1.03] hover:border-[#8E7AAE]/35 hover:text-[#6E5F8E] active:scale-[0.98] flex items-center justify-center shrink-0 shadow-sm"
                >
                    <Home className="w-5 h-5 md:w-6 md:h-6" />
                </button>
            </div>
            
            {!hasSearched && !isThinking && searchValue.trim().length >= 3 && (
              <div className="mt-4 w-full max-w-3xl mx-auto">
                <SmartIntentEngine
                  language={language}
                  value={searchValue}
                  onApply={(nextValue) => {
                    setSearchValue(nextValue);
                    latestInputRef.current = nextValue;
                    setQuery(nextValue);
                    setSmartSuggestion('');
                    inputRef.current?.focus();
                  }}
                  onSubmit={(nextValue) => handleSubmit(undefined, nextValue)}
                  onQawlFasl={(nextValue) => handlePathSelect('qawlfasl', nextValue)}
                  onOpenPath={(path, nextValue) => handlePathSelect(path, nextValue)}
                />
              </div>
            )}

            {questionClarity && !hasSearched && !isThinking && (
              <div className="mt-3 w-full max-w-3xl mx-auto rounded-2xl border border-[#8FA9C7]/18 bg-white/72 backdrop-blur-xl px-4 py-3 tebyan-focus-keep" dir={language === 'ar' ? 'rtl' : 'ltr'}>
                <div className="flex items-center justify-between gap-3 mb-2">
                  <span className="text-[11px] font-black text-[#64788D]">{language === 'ar' ? 'وضوح السؤال' : 'Question clarity'}: {questionClarity.level}</span>
                  <span className="text-[11px] font-black text-[#8E7AAE]">{questionClarity.score}%</span>
                </div>
                <div className="h-2 rounded-full bg-[#EEF2F6] overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-l from-[#8E7AAE] to-[#8FA9C7] transition-all duration-500" style={{ width: `${questionClarity.score}%` }} />
                </div>
                <p className="mt-2 text-xs font-bold leading-relaxed text-[#7C8796]">{questionClarity.hint}</p>
              </div>
            )}

          </div>

          <AnimatePresence>
            {selectionFeedback  && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="absolute -top-14 left-1/2 -translate-x-1/2 bg-mood-primary text-white px-8 py-3 rounded-full text-sm font-black shadow-2xl z-50 whitespace-nowrap transition-colors duration-700"
              >
                {selectionFeedback}
              </motion.div>
            )}

            {errorMsg  && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="absolute -top-12 left-1/2 -translate-x-1/2 bg-rose-600 text-white px-6 py-2 rounded-full text-xs font-black shadow-xl"
              >
                {errorMsg}
              </motion.div>
            )}

            {(isThinking || hasSearched)  && (
              <motion.div
                id="desktop-results"
                key="desktop-suggestions"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="border-t border-zinc-100 mt-2 p-4 hidden md:block space-y-4"
              >
                <div className="flex justify-center mb-4">
                    {/* Instead of a confusing "return" message, present a clear restart call-to-action */}
                    <button type="button" onClick={clearSearch} className="px-6 py-2 bg-[#8E7AAE]/12 hover:bg-mood-primary/20 text-[#6E5F8E] rounded-full font-bold text-sm transition-all duration-500">
                        {language === 'ar' ? 'سؤال جديد' : 'New question'}
                    </button>
                </div>
                {isThinking ? (
                  <div className="py-12 flex flex-col items-center justify-center gap-6">
                    <div className="relative w-full max-w-sm h-20 flex flex-col items-center justify-center overflow-hidden gap-4">
                       <AIHeartbeat className="opacity-50" />
                       <AnimatePresence mode="popLayout">
                          <TypographicAcoustic
                             key={loadingPhraseIndex}
                             type="snap"
                             className="text-[#182231] font-black text-xl text-center w-full"
                          >
                             {language === 'ar' ? loadingPhrasesAr[loadingPhraseIndex] : loadingPhrasesEn[loadingPhraseIndex]}
                          </TypographicAcoustic>
                       </AnimatePresence>
                    </div>
                    
                    <div className="text-center space-y-4 max-w-sm mx-auto px-4">
                        <AnimatePresence mode="wait">
                            {smartResponse  && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="p-4 bg-mood-secondary/5 border border-mood-secondary/10 rounded-2xl mb-4"
                                >
                                    <div className="flex items-center gap-2 mb-2 justify-center">
                                        <Sparkles className="w-4 h-4 text-[#6E5F8E]" />
                                        <span className="text-[11px] leading-[1.6] font-black text-[#6E5F8E] uppercase tracking-widest">
                                            {language === 'ar' ? 'استنتاج أولي' : 'Initial Insight'}
                                        </span>
                                    </div>
                                    <p className="text-[#6E5F8E] font-bold text-sm leading-relaxed">
                                        {smartResponse}
                                    </p>
                                </motion.div>
                            )}
                            
                            <TypographicAcoustic
                                key={insightIndex}
                                type="whisper"
                                className="min-h-[60px] flex items-center justify-center italic text-base leading-relaxed"
                            >
                                "{dynamicInsights[insightIndex]}"
                            </TypographicAcoustic>
                        </AnimatePresence>
                    </div>
                  </div>
                ) : (
                  <>
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="rounded-[28px] border border-[#8E7AAE]/14 bg-[#FAF9F6]/88 p-5 md:p-6 shadow-[0_18px_55px_rgba(24,34,49,0.05)] relative overflow-hidden"
                      dir={language === 'ar' ? 'rtl' : 'ltr'}
                    >
                      <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(circle at 18% 20%, ${journeyProfile.accent}22, transparent 32%)` }} />
                      <div className="relative z-10 flex items-start gap-4">
                        <div className="h-12 w-12 rounded-[18px] border border-white/70 bg-white/78 flex items-center justify-center shrink-0 shadow-sm" style={{ color: journeyProfile.accent }}>
                          {(() => { const Icon = journeyProfile.icon; return <Icon className="h-6 w-6" />; })()}
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-black tracking-[0.28em] uppercase" style={{ color: journeyProfile.accent }}>{language === 'ar' ? 'تبيان فهمك' : 'Tebyan understood'}</p>
                          <h3 className="mt-1 text-2xl md:text-3xl font-black text-[#182231]">{language === 'ar' ? journeyProfile.title.ar : journeyProfile.title.en}</h3>
                          <p className="mt-2 text-sm md:text-base font-bold leading-relaxed text-[#64788D] max-w-2xl">{language === 'ar' ? journeyProfile.promise.ar : journeyProfile.promise.en}</p>
                        </div>
                      </div>
                    </motion.div>

                    {smartResponse  && (
                        <motion.div 
                            key="smart-response-bubble"
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="bg-zinc-50 border border-zinc-100 p-4 rounded-2xl flex items-start gap-3"
                        >
                            <Sparkles className="w-5 h-5 text-[#7C8796] shrink-0 mt-1" />
                            <p className="text-sm font-bold text-[#465568] leading-relaxed">{smartResponse}</p>
                        </motion.div>
                    )}

                    <div className="space-y-8">
                       <div className="md:grid grid-cols-12 gap-8 mt-8">
                          <div className={cn("col-span-12", showExpertPaths ? "md:col-span-8" : "md:col-span-12")}>
                              {/* Focus Layer: Primary Suggestion */}
                              {primarySuggestion  && (
                                  <div className="space-y-4">
                                      <div className="px-4 py-2 text-[11px] font-black text-[#6E5F8E] uppercase tracking-widest border-b border-zinc-100 flex items-center justify-between">
                                          <div className="flex items-center gap-2">
                                           <span>{language === 'ar' ? 'ابدأ من هنا' : 'START HERE'}</span>
                                           <Zap className="w-3 h-3" />
                                         </div>
                                      </div>
                                      
                                      <button
                                        type="button"
                                        onClick={() => handlePathSelect(primarySuggestion.id, query)}
                                        className="tebyan-primary-route-card w-full flex-col md:flex-row flex md:items-center justify-between p-6 md:p-10 rounded-[32px] md:rounded-[48px] transition-all group text-right border active:scale-[0.98] bg-white text-[#182231] hover:opacity-100 border-[#DED6EA] shadow-[0_22px_60px_rgba(24,34,49,0.08)] relative overflow-hidden"
                                      >
                                         <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-8 relative z-10 w-full md:w-auto">
                                             <div className="w-14 h-14 md:w-20 md:h-20 rounded-[20px] md:rounded-[32px] bg-white/76 border border-[#DED6EA] text-[#6E5F8E] flex items-center justify-center transition-all group-hover:scale-110 shrink-0 self-end md:self-auto shadow-sm">
                                                 {(() => { const Icon = journeyProfile.icon; return <Icon className="w-7 h-7 md:w-10 md:h-10" />; })()}
                                             </div>
                                             <div className="text-right w-full">
                                                 <div className="flex items-center gap-2 mb-1 md:mb-2 justify-end md:justify-start">
                                                    <h3 className="text-2xl md:text-3xl font-black">{language === 'ar' ? journeyProfile.firstDoor.ar : journeyProfile.firstDoor.en}</h3>
                                                 </div>
                                                 <p className="text-sm md:text-base font-semibold text-[#5E6B7A] max-w-md leading-relaxed">
                                                     {language === 'ar' ? journeyProfile.deepen.ar : journeyProfile.deepen.en}
                                                 </p>
                                             </div>
                                         </div>
                                         <div className="mt-6 md:mt-0 relative z-10 w-full md:w-auto text-center md:text-right">
                                            <div className="w-full md:w-auto inline-flex justify-center items-center gap-3 md:gap-4 bg-[#F4F0F8] text-[#6E5F8E] border border-[#DED6EA] px-6 md:px-8 py-3 md:py-3 rounded-full md:group-hover:bg-white transition-all shadow-sm">
                                              <span className="font-bold text-sm">{language === 'ar' ? 'البدء' : 'Start'}</span>
                                               <ArrowLeft className={cn("w-4 h-4 md:w-5 md:h-5", language === 'ar' ? "group-hover:-translate-x-2" : "rotate-180 group-hover:translate-x-2")} />
                                            </div>
                                         </div>
                                      </button>
                                  </div>
                              )}

                              {/* Progressive disclosure layer: keep all tools available without crowding first view */}
                              {(secondarySuggestions.length > 0 || alternativeSuggestions.length > 0) && (
                                <div className="mt-8 rounded-[28px] border border-zinc-100 bg-zinc-50 p-5 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                  <div className="text-right">
                                    <h4 className="text-sm md:text-base font-black text-zinc-900">{language === 'ar' ? 'تبي تبسطها أكثر أو تفتح العمق؟' : 'Simplify it or open the depth?'}</h4>
                                    
                                  </div>
                              <button type="button" onClick={() => setShowExpertPaths(v => !v)} className="shrink-0 px-6 py-3 rounded-full bg-white border border-zinc-200 text-zinc-900 font-black text-xs md:text-sm shadow-sm hover:shadow-md active:scale-95 transition-all">
                                    {showExpertPaths ? (language === 'ar' ? 'اكتفي بهذا الباب' : 'Keep this doorway') : (language === 'ar' ? 'زد العمق' : 'Go deeper')}
                                  </button>
                                </div>
                              )}

                              {/* Focus Layer: Secondary Options */}
                              {showExpertPaths && secondarySuggestions.length > 0  && (
                                  <div className="mt-8 pt-8 border-t border-zinc-100">
                                     <h4 className="text-[11px] leading-[1.6] font-black text-[#7C8796] uppercase tracking-widest mb-4 px-2">
                                        {language === 'ar' ? 'جرّب زاوية أخرى' : 'TRY ANOTHER ANGLE'}
                                     </h4>
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {secondarySuggestions.map((s) => {
                                           const Icon = s.icon;
                                           return (
                                             <button
                                               key={`sec-${s.id}`}
                                               type="button"
                                               onClick={() => handlePathSelect(s.id, query)}
                                               className="flex items-center justify-between p-5 rounded-[24px] transition-all duration-300 group text-right border bg-white border-zinc-100 hover:border-zinc-300 active:scale-95 shadow-[0_4px_20px_rgb(0,0,0,0.02)] hover:shadow-[0_12px_40px_rgb(0,0,0,0.06)] hover:-translate-y-0.5"
                                             >
                                              <div className="flex items-center gap-4">
                                                  <div className="w-12 h-12 rounded-[16px] bg-zinc-50 border border-zinc-100 text-[#7C8796] group-hover:bg-zinc-900 group-hover:border-zinc-800 group-hover:text-white transition-all duration-300 flex items-center justify-center">
                                                      <Icon className="w-5 h-5" />
                                                  </div>
                                                  <div className="text-right">
                                                      <h4 className="text-sm font-black text-zinc-900">{s.label}</h4>
                                                      <p className="text-xs leading-relaxed text-zinc-500 font-bold mt-1 line-clamp-1">{s.desc}</p>
                                                  </div>
                                              </div>
                                              <ArrowLeft className={cn("w-4 h-4 text-[#6E5F8E] group-hover:text-zinc-900 transition-colors", language === 'ar' ? "" : "rotate-180")} />
                                             </button>
                                           );
                                        })}
                                      </div>
                                  </div>
                              )}

                              {/* NEW: DEEP COGNITIVE ANALYSIS */}
                          </div>

                          {/* Alternative Paths */}
                          {showExpertPaths && (
                          <div className="col-span-12 md:col-span-4 space-y-4">
                             <h4 className="text-[11px] leading-[1.6] font-black text-[#7C8796] uppercase tracking-widest px-2">
                                 {language === 'ar' ? 'أبواب إضافية' : 'MORE DOORS'}
                             </h4>
                             <div className="grid grid-cols-2 md:grid-cols-1 gap-2">
                                {alternativeSuggestions.map((s: any) => {
                                   const Icon = s.icon;
                                   return (
                                       <button
                                         key={`alt-${s.id}`}
                                         type="button"
                                         title={s.tooltip}
                                         onClick={() => handlePathSelect(s.id, query)}
                                         className="w-full flex items-center gap-4 p-4 rounded-[20px] transition-all duration-300 group text-right bg-zinc-50 border border-[#8FA9C7]/15 hover:bg-white hover:border-zinc-200 hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] active:scale-95"
                                       >
                                         <div className="w-10 h-10 rounded-xl bg-white border border-zinc-100 text-[#7C8796] flex items-center justify-center shadow-sm group-hover:text-[#6E5F8E] group-hover:border-zinc-300 transition-colors shrink-0">
                                           <Icon className="w-4 h-4" />
                                         </div>
                                         <div className="text-right flex-1 min-w-0 break-words w-full">
                                            <div className="font-black text-sm text-zinc-800 truncate mb-0.5">{s.label}</div>
                                            <p className="text-[11px] leading-relaxed text-zinc-500 font-medium line-clamp-2 w-full">{s.desc}</p>
                                         </div>
                                       </button>
                                   );
                                })}
                             </div>
                          </div>
                          )}
                       </div>
                    </div>
                  </>
                )}
              {hasSearched && (
                <KnowledgeSignature
                  language={language}
                  query={query}
                  kind="مسار فهم"
                  onLink={() => handleTabChange('knowledgegraph')}
                />
              )}
              </motion.div>
            )}
            
            {/* Mobile simplified results */}
            {(isThinking || hasSearched)  && (
                 <motion.div 
                    id="mobile-results"
                    key="mobile-suggestions"
                    className="md:hidden border-t px-4 py-6 space-y-6 max-h-[60vh] overflow-y-auto bg-white"
                 >
                    <div className="flex justify-center mb-2">
                      {/* Mobile: provide a simple restart option instead of returning to home */}
                      <button type="button" onClick={clearSearch} className="px-6 py-2 bg-zinc-100 hover:bg-zinc-200 text-[#465568] rounded-full font-bold text-sm transition-all">
                          {language === 'ar' ? 'سؤال جديد' : 'New question'}
                      </button>
                    </div>
                    {isThinking ? (
                        <div className="py-12 flex flex-col items-center justify-center gap-6">
                           <div className="relative w-full max-w-sm h-20 flex flex-col items-center justify-center overflow-hidden gap-4">
                               <AIHeartbeat className="opacity-50" />
                               <AnimatePresence mode="popLayout">
                                  <motion.p
                                     key={loadingPhraseIndex}
                                     initial={{ y: 20, opacity: 0, filter: 'blur(4px)' }}
                                     animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
                                     exit={{ y: -20, opacity: 0, filter: 'blur(4px)' }}
                                     transition={{ duration: 0.4 }}
                                     className="text-[#182231] font-black text-lg text-center w-full"
                                  >
                                     {language === 'ar' ? loadingPhrasesAr[loadingPhraseIndex] : loadingPhrasesEn[loadingPhraseIndex]}
                                  </motion.p>
                               </AnimatePresence>
                            </div>
                           
                           <div className="text-center space-y-3 px-4">
                                <AnimatePresence mode="wait">
                                    {smartResponse  && (
                                        <motion.div
                                            initial={{ opacity: 0, scale: 0.95 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            className="p-4 bg-[#EEF4F1] border border-[#A8C3BD]/25 rounded-2xl mb-2"
                                        >
                                            <p className="text-[#34524B] font-bold text-xs leading-relaxed">
                                                {smartResponse}
                                            </p>
                                        </motion.div>
                                    )}

                                    <motion.div
                                        key={insightIndex}
                                        initial={{ opacity: 0, y: 5 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -5 }}
                                        className="min-h-[50px] flex items-center justify-center"
                                    >
                                <p className="text-[#7C8796] font-bold italic text-sm leading-relaxed px-6">
                                            "{dynamicInsights[insightIndex]}"
                                        </p>
                                    </motion.div>
                                </AnimatePresence>
                           </div>
                        </div>
                    ) : (
                      <div className="space-y-8">
                        <div className="rounded-[26px] border border-[#8E7AAE]/14 bg-[#FAF9F6]/90 p-4 shadow-[0_14px_42px_rgba(24,34,49,0.05)]" dir={language === 'ar' ? 'rtl' : 'ltr'}>
                          <div className="flex items-start gap-3">
                            <div className="h-11 w-11 rounded-2xl bg-white border border-[#DED6EA] flex items-center justify-center shrink-0" style={{ color: journeyProfile.accent }}>
                              {(() => { const Icon = journeyProfile.icon; return <Icon className="w-5 h-5" />; })()}
                            </div>
                            <div className="text-right">
                              <p className="text-[10px] font-black tracking-widest" style={{ color: journeyProfile.accent }}>{language === 'ar' ? 'تبيان فهمك' : 'Tebyan understood'}</p>
                              <h3 className="mt-1 text-xl font-black text-[#182231]">{language === 'ar' ? journeyProfile.title.ar : journeyProfile.title.en}</h3>
                              <p className="mt-1 text-xs font-bold leading-relaxed text-[#64788D]">{language === 'ar' ? journeyProfile.promise.ar : journeyProfile.promise.en}</p>
                            </div>
                          </div>
                        </div>

                        {/* Mobile Primary */}
                        {primarySuggestion  && (
                          <div className="space-y-3">
                             <span className="font-black text-[10px] text-[#7C8796] uppercase tracking-widest px-2">{language === 'ar' ? 'الباب الأول' : 'FIRST DOOR'}</span>
                             <button 
                               type="button"
                               onClick={() => handlePathSelect(primarySuggestion.id, query)}
                               className="tebyan-primary-route-card w-full flex items-center justify-between p-6 bg-white text-[#182231] rounded-[32px] shadow-[0_18px_52px_rgba(24,34,49,0.08)] border border-[#DED6EA] active:scale-95 transition-all"
                             >
                                <div className="flex items-center gap-4">
                                   <div className="w-12 h-12 rounded-2xl bg-[#F4F0F8] border border-[#DED6EA] text-[#6E5F8E] flex items-center justify-center">
                                      {(() => { const Icon = journeyProfile.icon; return <Icon className="w-6 h-6" />; })()}
                                   </div>
                                   <div className="text-right">
                                      <div className="font-black text-lg tracking-tight">{language === 'ar' ? journeyProfile.firstDoor.ar : journeyProfile.firstDoor.en}</div>
                                      <div className="text-[11px] leading-[1.6] text-[#64788D] font-semibold">{language === 'ar' ? 'بدون زحمة أدوات' : 'No tool clutter'}</div>
                                   </div>
                                </div>
                                <ArrowLeft className={cn("w-6 h-6", language === 'ar' ? "" : "rotate-180")} />
                             </button>
                          </div>
                        )}

                        {/* Mobile Secondary */}
                        {(secondarySuggestions.length > 0 || alternativeSuggestions.length > 0) && (
                          <div className="rounded-[24px] md:rounded-[28px] border border-zinc-100 bg-zinc-50 p-4 space-y-3">
                            <div className="flex items-center justify-between gap-3">
                              <div className="text-right">
                                <div className="font-black text-sm text-zinc-900">{language === 'ar' ? 'باب ثاني إذا تبي تتعمق' : 'A second doorway if needed'}</div>
                              </div>
                              <button type="button" onClick={() => setShowExpertPaths(v => !v)} className="shrink-0 px-4 py-2 rounded-full bg-white border border-zinc-100 text-zinc-800 font-black text-[11px] shadow-sm active:scale-95 transition-all">
                                {showExpertPaths ? (language === 'ar' ? 'إخفاء' : 'Hide') : (language === 'ar' ? 'زد العمق' : 'Go deeper')}
                              </button>
                            </div>
                          </div>
                        )}

                        {showExpertPaths && secondarySuggestions.length > 0  && (
                          <div className="space-y-3">
                             <span className="font-black text-[10px] text-[#7C8796] uppercase tracking-widest px-2">{language === 'ar' ? 'أبعاد داعمة' : 'SUPPORTING'}</span>
                             <div className="grid grid-cols-1 gap-2">
                                {secondarySuggestions.map(s => {
                                  const Icon = s.icon;
                                  return (
                                    <button 
                                      key={`mob-sec-${s.id}`}
                                      type="button"
                                      onClick={() => handlePathSelect(s.id, query)}
                                      className="w-full flex items-center justify-between p-4 bg-zinc-50 rounded-[24px] border border-zinc-100 active:scale-95 transition-all"
                                    >
                                       <div className="flex items-center gap-3">
                                          <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-[#7C8796] shadow-sm">
                                             <Icon className="w-5 h-5" />
                                          </div>
                                          <div className="text-right">
                                             <div className="font-bold text-sm text-zinc-900">{s.label}</div>
                                             <p className="text-[11px] leading-[1.6] text-zinc-500 font-bold mt-1 line-clamp-1">{s.desc}</p>
                                          </div>
                                       </div>
                                       <ArrowLeft className={cn("w-4 h-4 text-[#6E5F8E]", language === 'ar' ? "" : "rotate-180")} />
                                    </button>
                                  );
                                })}
                             </div>
                          </div>
                        )}

                        <div className="h-px bg-zinc-100 mx-4" />

                        {/* Mobile Alternative Paths */}
                        {showExpertPaths && alternativeSuggestions.length > 0  && (
                           <div className="space-y-3">
                              <span className="font-black text-[10px] text-[#7C8796] uppercase tracking-widest px-2">{language === 'ar' ? 'أبواب إضافية' : 'MORE DOORS'}</span>
                              <div className="grid grid-cols-2 gap-2">
                                 {alternativeSuggestions.map((s: any) => {
                                    const Icon = s.icon;
                                     return (
                                      <div 
                                         key={`mob-rest-${s.id}`} 
                                         onClick={() => handlePathSelect(s.id, query)} 
                                         className="flex flex-col items-start gap-4 p-5 bg-white rounded-[24px] border border-zinc-100/80 hover:border-zinc-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] active:scale-95 transition-all group cursor-pointer"
                                      >
                                         <div className="w-10 h-10 rounded-[14px] bg-zinc-50 border border-zinc-100 text-[#7C8796] group-hover:bg-zinc-900 group-hover:border-zinc-800 group-hover:text-white transition-all flex items-center justify-center shrink-0">
                                            <Icon className="w-4 h-4" />
                                         </div>
                                         <div className="text-right">
                                            <div className="font-black text-[13px] text-zinc-900 mb-1">{s.label}</div>
                                            <p className="text-[11px] leading-relaxed text-zinc-500 font-medium line-clamp-2">{s.desc}</p>
                                         </div>
                                      </div>
                                    );
                                 })}
                              </div>
                           </div>
                        )}

                        {/* NEW: DEEP COGNITIVE ANALYSIS MOBILE */}
                        <div className="px-1">
                        </div>
                      </div>
                    )}
                 </motion.div>
            )}
          </AnimatePresence>
        </form>

        {/* Simple entry layer: one question first, tools stay available on demand */}
        {!hasSearched && !isThinking && (
          <div className="mt-4 md:mt-6 w-full max-w-3xl mx-auto flex flex-col items-center gap-3 md:gap-4" dir={language === 'ar' ? 'rtl' : 'ltr'}>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => { setShowInspiration(v => !v); setShowDirectTools(false); }}
                className="inline-flex items-center justify-center rounded-full border border-[#C9BEDF]/40 bg-white/70 px-3 py-1.5 text-[11px] md:text-xs font-black text-[#7C8796] hover:text-zinc-900 transition-colors shadow-sm"
              >
                {showInspiration ? (language === 'ar' ? 'إخفاء الإلهام' : 'Hide inspiration') : (language === 'ar' ? 'أحتاج مثالاً' : 'Show examples')}
              </button>
            </div>

            <AnimatePresence>
              {showDirectTools && (
                <motion.div
                  initial={{ opacity: 0, y: 8, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: 'auto' }}
                  exit={{ opacity: 0, y: 8, height: 0 }}
                  className="w-full overflow-hidden"
                >
                  <div className="mt-2 rounded-[28px] border border-[#DED6EA]/55 bg-white/76 p-3 md:p-4 shadow-[0_18px_55px_rgba(24,34,49,0.06)] backdrop-blur-xl">
                    <div className="mb-3 flex items-center justify-between gap-3 px-1">
                      <div className="text-right">
                        <p className="text-sm font-black text-[#182231]">{language === 'ar' ? 'الوصول المباشر' : 'Direct access'}</p>
                        <p className="text-[11px] font-bold text-[#7C8796]">{language === 'ar' ? 'لمن يعرف الأداة التي يريدها' : 'For users who already know the tool they want'}</p>
                      </div>
                      <button type="button" onClick={() => setShowDirectTools(false)} className="h-8 w-8 rounded-full border border-zinc-100 bg-zinc-50 text-zinc-500 flex items-center justify-center active:scale-95">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                      {[...(tabs || []).filter((t: any) => !t.hidden && t.id !== 'discover'), { id: 'ripple', label: language === 'ar' ? 'نسيج الأفكار' : 'Idea Fabric', icon: Waves, tooltip: language === 'ar' ? 'شاهد كيف تتفرع فكرتك وتؤثر' : 'See how your idea branches and influences' }].map((tool: any) => {
                        const Icon = tool.icon || Sparkles;
                        return (
                          <button
                            key={tool.id}
                            type="button"
                            onClick={() => { setShowDirectTools(false); handleTabChange(tool.id); }}
                            className="group flex min-h-[88px] flex-col items-center justify-center gap-2 rounded-2xl border border-zinc-100 bg-[#FAF9F6]/80 px-2 py-3 text-center transition-all hover:-translate-y-0.5 hover:border-[#8E7AAE]/25 hover:bg-white active:scale-95"
                            title={tool.tooltip}
                          >
                            <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[#DED6EA]/70 bg-white text-[#6E5F8E] shadow-sm group-hover:scale-105 transition-transform">
                              <Icon className="h-5 w-5" />
                            </span>
                            <span className="text-[11px] md:text-xs font-black leading-tight text-[#465568] line-clamp-2">{tool.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {!searchValue.trim() && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full rounded-[24px] border border-[#8E7AAE]/12 bg-white/68 p-3 md:p-4 shadow-[0_14px_45px_rgba(24,34,49,0.05)] backdrop-blur-xl"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex items-center gap-3 text-right">
                    <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#F4F0F8] text-[#6E5F8E] border border-[#DED6EA] shrink-0">
                      <Compass className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="text-[10px] font-black tracking-[0.22em] uppercase text-[#8E7AAE]">{language === 'ar' ? 'باب اليوم' : 'Today’s doorway'}</p>
                      <h3 className="text-sm md:text-base font-black text-[#182231]">{language === 'ar' ? dailyDiscovery.ar : dailyDiscovery.en}</h3>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const nextValue = language === 'ar' ? dailyDiscovery.queryAr : dailyDiscovery.queryEn;
                      setSearchValue(nextValue);
                      latestInputRef.current = nextValue;
                      setQuery(nextValue);
                      setSmartSuggestion('');
                      handleSubmit(undefined, nextValue);
                    }}
                    className="shrink-0 rounded-2xl bg-[#182231] px-5 py-3 text-xs md:text-sm font-black text-white shadow-[0_14px_30px_rgba(24,34,49,0.18)] transition-all hover:bg-black active:scale-[0.98]"
                  >
                    {language === 'ar' ? 'ادخل' : 'Enter'}
                  </button>
                </div>
              </motion.div>
            )}
          </div>
        )}

        {/* Dynamic Suggestion Chips - hidden until requested */}
        {showInspiration && !hasSearched && !isThinking && (
          <div className="mt-4 flex overflow-x-auto pb-3 gap-2 snap-x snap-mandatory no-scrollbar w-full max-w-full px-1">
              {proactiveInsights.dynamicSuggests.map((chip, idx) => (
                      <button
                          key={idx}
                          onClick={() => {
                              const val = language === 'ar' ? chip.ar : chip.en;
                              setSearchValue(val);
                              latestInputRef.current = val;
                              setQuery(val);
                              handleSubmit(undefined, val);
                              setIsFocused(true);
                          }}
                          className={cn(
                              "px-3.5 md:px-5 py-2 md:py-2.5 rounded-full border border-zinc-200 transition-all active:scale-95 shadow-sm whitespace-nowrap snap-center shrink-0 cursor-pointer overflow-hidden group relative",
                              "bg-white text-zinc-500 hover:border-mood-primary hover:text-[#6E5F8E]",
                              mood ? getMoodTypography(mood) : "font-bold text-xs md:text-sm"
                          )}
                      >
                          <span className="relative z-10">{language === 'ar' ? chip.ar : chip.en}</span>
                          {mood === 'revolutionary' && (
                            <motion.div 
                              initial={{ x: '-100%' }}
                              animate={{ x: '100%' }}
                              transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                              className="absolute inset-0 bg-gradient-to-r from-transparent via-mood-primary/10 to-transparent skew-x-[-20deg]"
                            />
                          )}
                      </button>
              ))}
          </div>
        )}
      </div>
      </div>

      {!hasSearched && (showInspiration || isHome) && (
        <>
          {/* Ephemeral Wisdom Feature (FOMO) */}
          {showInspiration && <div className="mt-8">
             <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={{ y: -1 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="bg-[#FAF9F6]/88 backdrop-blur-xl border border-[#8E7AAE]/15 rounded-[20px] p-3 md:p-3.5 flex flex-col md:flex-row items-center justify-between gap-3 shadow-[0_12px_40px_rgba(24,34,49,0.06)] relative overflow-hidden group hover:shadow-[0_18px_50px_rgba(142,122,174,0.10)]"
             >
                <div className="absolute top-0 right-0 w-64 h-64 bg-[#8FA9C7]/10 rounded-full blur-[80px] pointer-events-none transition-transform duration-1000 group-hover:scale-110" />
                <div className="flex items-center gap-5 z-10 w-full md:w-auto">
                    <div className="w-10 h-10 rounded-[14px] bg-[#8E7AAE]/10 text-[#6E5F8E] border border-[#8E7AAE]/15 flex items-center justify-center shrink-0 shadow-inner">
                        <Sparkles className="w-5 h-5 animate-pulse opacity-70 group-hover:opacity-100 transition-opacity" strokeWidth={1.5} />
                    </div>
                    <div className="text-right">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-sm font-serif italic text-[#7C8796]">
                                {language === 'ar' ? 'رسالة سريعة الزوال' : 'Ephemeral Wisdom'}
                            </span>
                        </div>
                        <p className="text-sm font-serif text-[#182231]/90 leading-relaxed max-w-xl">
                            {language === 'ar' ? currentWisdom.ar : currentWisdom.en}
                        </p>
                    </div>
                </div>
                <div className="flex flex-col items-end shrink-0 z-10 w-full md:w-auto mt-4 md:mt-0">
                    <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-2">{language === 'ar' ? 'تختفي بعد' : 'Disappears in'}</span>
                    <div className="text-lg md:text-xl font-mono font-black text-[#6E5F8E] tracking-tight bg-white/70 backdrop-blur-md px-3 py-1.5 rounded-xl border border-[#8E7AAE]/12 shadow-inner">
                        {String(ephemeralTime.m).padStart(2, '0')}:{String(ephemeralTime.s).padStart(2, '0')}
                    </div>
                </div>
             </motion.div>
          </div>}



          {/* Daily Challenge & Insights Section */}
          <div className="emotion-hide mt-5 md:mt-6 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
        <motion.div
           initial={{ opacity: 0, x: 20 }}
           whileInView={{ opacity: 1, x: 0 }}
           viewport={{ once: true }}
           whileHover={{ y: -1 }}
           transition={{ type: "spring", stiffness: 300, damping: 20 }}
           className="bg-[#FAF9F6]/90 backdrop-blur-xl rounded-[20px] md:rounded-[24px] p-3.5 md:p-4 text-[#182231] relative overflow-hidden group border border-[#8E7AAE]/15 shadow-[0_14px_42px_rgba(24,34,49,0.06)] hover:shadow-[0_18px_52px_rgba(142,122,174,0.10)]"
        >
            <div className="relative z-10">
                <div className="flex items-center gap-2 px-4 py-2 bg-[#8E7AAE]/10 rounded-full w-fit mb-3 backdrop-blur-md border border-[#8E7AAE]/15 text-[#6E5F8E]">
                    <Gamepad2 className="w-4 h-4 md:w-5 md:h-5 opacity-80" />
                    <span className="text-xs leading-none uppercase font-black tracking-widest">{language === 'ar' ? 'تحدي اليوم' : 'DAILY CHALLENGE'}</span>
                </div>
                <h3 className="text-lg md:text-xl font-serif mb-2 md:mb-3 leading-tight tracking-tight">
                    {language === 'ar' ? currentChallenge.titleAr : currentChallenge.titleEn}
                </h3>
                <p className="text-[#7C8796] text-xs md:text-sm mb-4 md:mb-5 leading-relaxed font-medium">
                    {language === 'ar' ? 'تحدَّ نفسك في المحاكي اليوم' : 'Challenge yourself in the simulator today'}
                </p>
                <button 
                    onClick={() => onPathSelect(currentChallenge.path as any, currentChallenge.query)}
                    className="w-full py-2.5 md:py-3 bg-[#8E7AAE]/10 backdrop-blur-md text-[#6E5F8E] rounded-2xl md:rounded-[20px] font-black text-sm md:text-base hover:shadow-[0_10px_30px_rgba(255,255,255,0.2)] hover:-translate-y-0.5 transition-all active:scale-95 border border-[#8E7AAE]/15"
                >
                    {language === 'ar' ? 'ابدأ التحدي' : 'Start Challenge'}
                </button>
            </div>
            {/* Abstract background element */}
            <div className="absolute -bottom-16 -right-16 w-64 h-64 bg-[#8FA9C7]/14 rounded-full blur-[60px] group-hover:scale-110 transition-transform duration-1000 pointer-events-none" />
        </motion.div>

        <motion.div
           initial={{ opacity: 0, x: -20 }}
           whileInView={{ opacity: 1, x: 0 }}
           viewport={{ once: true }}
           whileHover={{ y: -1 }}
           transition={{ type: "spring", stiffness: 300, damping: 20 }}
           className="bg-[#FAF9F6]/90 backdrop-blur-xl rounded-[20px] md:rounded-[24px] p-3.5 md:p-4 border border-[#8FA9C7]/15 flex flex-col justify-between shadow-[0_14px_42px_rgba(24,34,49,0.05)] hover:shadow-[0_18px_52px_rgba(143,169,199,0.10)] transition-all duration-500"
        >
            <div>
                <div className="flex items-center gap-2 px-4 py-2 bg-[#8FA9C7]/10 text-[#64788D] rounded-full w-fit mb-4 md:mb-5 border border-[#8FA9C7]/15 backdrop-blur-md">
                    <BrainCircuit className="w-4 h-4 md:w-5 md:h-5 opacity-80" />
                    <span className="text-xs leading-none uppercase font-black tracking-widest">{language === 'ar' ? 'رؤية المنصة' : 'PLATFORM INSIGHT'}</span>
                </div>
                <h3 className="text-base md:text-lg font-serif text-[#182231] mb-3 tracking-tight leading-tight">
                    {language === 'ar' ? currentInsight.titleAr : currentInsight.titleEn}
                </h3>
                <div className="space-y-3">
                    {currentInsight.items.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2.5 md:p-3 bg-white/55 rounded-2xl border border-zinc-100/30 hover:bg-zinc-50 transition-colors backdrop-blur-sm">
                            <span className="text-sm md:text-base font-bold text-[#465568]">{language === 'ar' ? item.labelAr : item.labelEn}</span>
                            <div className="h-1.5 md:h-2 w-20 md:w-32 bg-[#D9DEE5]/55 rounded-full overflow-hidden shadow-inner flex shrink-0">
                                 <motion.div 
                                    className={`h-full ${item.color} rounded-full`} 
                                    initial={{ width: 0 }}
                                    whileInView={{ width: item.pct }}
                                    transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
                                 />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            <p className="mt-4 md:mt-5 text-[10px] md:text-[11px] text-[#7C8796] font-bold uppercase tracking-widest text-center border-t border-[#8FA9C7]/15 pt-4">
                {language === 'ar' ? 'تحليل 2000 حالة' : 'Based on 2000 cases'}
            </p>
        </motion.div>
      </div>

      {/* Signature Gate: Idea Fabric — keep it special and remove duplicate Knowledge Graph from dashboard */}
      <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="emotion-hide mt-8 md:mt-10 mb-14"
      >
          <motion.button
              type="button"
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.995 }}
              className="w-full p-5 sm:p-6 md:p-8 tebyan-fabric-hero-card rounded-[28px] md:rounded-[42px] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-5 md:gap-10 transition-all duration-500 group cursor-pointer relative overflow-hidden text-right"
              onClick={() => handleTabChange('ripple')}
          >
              <div className="absolute -top-20 -right-20 w-72 h-72 bg-[#D8CEE9]/34 rounded-full blur-[72px] group-hover:scale-125 transition-transform duration-700 pointer-events-none" />
              <div className="absolute -bottom-20 -left-20 w-72 h-72 bg-[#DCEAF4]/38 rounded-full blur-[72px] group-hover:scale-125 transition-transform duration-700 pointer-events-none" />
              <div className="absolute inset-0 pointer-events-none opacity-70">
                {[...Array(14)].map((_, i) => (
                  <motion.span
                    key={`fabric-shadow-${i}`}
                    animate={{ y: [0, i % 2 ? 4 : -4, 0], opacity: [0.25, 0.72, 0.25] }}
                    transition={{ duration: 4.6 + (i % 3), repeat: Infinity, ease: 'easeInOut', delay: i * 0.14 }}
                    className="absolute h-1.5 w-1.5 rounded-full bg-[#8E7AAE]/45 shadow-[0_0_16px_rgba(142,122,174,0.28)]"
                    style={{ right: `${8 + (i * 7) % 82}%`, top: `${18 + (i * 11) % 66}%` }}
                  />
                ))}
                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 900 260" preserveAspectRatio="none" aria-hidden>
                  <path d="M70 82 C 200 35, 300 185, 440 105 S 620 45, 830 168" fill="none" stroke="rgba(142,122,174,0.15)" strokeWidth="2" strokeDasharray="8 13" />
                  <path d="M95 185 C 250 120, 345 220, 500 145 S 650 84, 840 72" fill="none" stroke="rgba(143,169,199,0.16)" strokeWidth="2" strokeDasharray="5 14" />
                </svg>
              </div>
              <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center gap-5 md:gap-7 justify-end flex-1">
                  <div>
                      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/70 border border-[#8E7AAE]/18 text-[#6E5F8E] text-[10px] md:text-xs font-black tracking-widest uppercase mb-4 shadow-sm">
                          <Sparkles className="w-4 h-4" />
                          {language === 'ar' ? 'التجربة المميزة' : 'SIGNATURE EXPERIENCE'}
                      </div>
                      <h3 className="text-[1.7rem] sm:text-3xl md:text-4xl font-black text-[#182231] mb-3 tracking-tight leading-[1.12]">
                          {language === 'ar' ? 'نسيج الأفكار' : 'Idea Fabric'}
                      </h3>
                      <p className="text-[#566276] font-bold text-sm md:text-base leading-relaxed max-w-2xl">
                          {language === 'ar' ? 'شاهد كيف تنمو فكرتك وتتفرع وتؤثر في أفكار أخرى كأنها كائن حي.' : 'Watch your idea grow, branch, and influence other ideas like a living system.'}
                      </p>
                  </div>
                  <div className="tebyan-fabric-orb w-20 h-20 md:w-24 md:h-24 rounded-[28px] bg-white flex items-center justify-center text-[#6E5F8E] border border-[#8E7AAE]/18 shadow-lg transform group-hover:rotate-1 group-hover:scale-[1.02] transition-transform shrink-0">
                      <Waves className="w-10 h-10 md:w-12 md:h-12 opacity-90" />
                  </div>
              </div>
              <div className="relative z-10 flex md:flex-col items-center justify-between md:justify-center gap-3 md:min-w-[150px] bg-white/78 border border-[#8E7AAE]/14 rounded-[24px] md:rounded-[28px] p-4 md:p-5 shadow-sm backdrop-blur-xl">
                  <span className="text-[11px] md:text-xs text-[#7C8796] font-black uppercase tracking-widest">
                      {language === 'ar' ? 'ابدأ الرحلة' : 'Start journey'}
                  </span>
                  <ArrowLeft className={cn("w-5 h-5 text-[#6E5F8E]", language === 'ar' ? "group-hover:-translate-x-1" : "rotate-180 group-hover:translate-x-1", "transition-transform")} />
              </div>
          </motion.button>
      </motion.div>
        </>
      )}
      {/* Gravity of Intent Demonstration */}

    </div>
  );
};
