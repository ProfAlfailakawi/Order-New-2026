import React from 'react';
import { Sparkles, Route, Scale, GraduationCap, Lightbulb, BrainCircuit } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useSmartSearch } from '../../hooks/useSmartSearch';

type IntentPath = 'qawlfasl' | 'oracle' | 'decisionroom' | 'creativelab' | 'strategicarena' | 'concepts' | 'simulation_roleplay';

interface SmartIntentEngineProps {
  language: 'ar' | 'en';
  value: string;
  onApply: (nextValue: string) => void;
  onSubmit?: (nextValue: string) => void;
  onQawlFasl?: (nextValue: string) => void;
  onOpenPath?: (path: IntentPath, nextValue: string) => void;
  compact?: boolean;
  className?: string;
}

const getIntentProfile = (raw: string, language: 'ar' | 'en') => {
  const q = raw.toLowerCase();
  const has = (...words: string[]) => words.some(w => q.includes(w));

  if (has('مدرس', 'مدرسة', 'تعليم', 'تربية', 'مراهق', 'طالب', 'طالبة', 'school', 'education', 'teen', 'student')) {
    return {
      icon: GraduationCap,
      path: 'qawlfasl' as IntentPath,
      title: language === 'ar' ? 'تحليل تربوي' : 'Educational analysis',
      hint: language === 'ar' ? 'الأفضل تحويلها لسؤال تربوي واضح ثم فتح قول فصل.' : 'Best handled as a clear educational question, then Qawl Fasl.',
      action: language === 'ar' ? 'افتح تحليل تربوي' : 'Open education analysis',
      refinedPrefix: language === 'ar' ? 'كيف أتعامل تربوياً مع موقف: ' : 'How should I handle this educationally: ',
    };
  }

  if (has('قرار', 'اختار', 'أختار', 'حيرة', 'محتار', 'مخاطر', 'decision', 'choose', 'risk')) {
    return {
      icon: Scale,
      path: 'decisionroom' as IntentPath,
      title: language === 'ar' ? 'مسار قرار' : 'Decision path',
      hint: language === 'ar' ? 'الموقف يحتاج حسم وموازنة مخاطر.' : 'This needs judgment and risk balancing.',
      action: language === 'ar' ? 'افتح غرفة القرار' : 'Open decision room',
      refinedPrefix: language === 'ar' ? 'ما القرار الأنسب في هذا الموقف: ' : 'What is the best decision in this situation: ',
    };
  }

  if (has('فكرة', 'ابتكار', 'مشروع', 'تصميم', 'إبداع', 'idea', 'creative', 'project', 'design')) {
    return {
      icon: Lightbulb,
      path: 'creativelab' as IntentPath,
      title: language === 'ar' ? 'مختبر إبداعي' : 'Creative lab',
      hint: language === 'ar' ? 'الفكرة تحتاج توليد بدائل وتحويلها لمسار.' : 'The idea needs alternatives and a path forward.',
      action: language === 'ar' ? 'افتح المختبر الإبداعي' : 'Open creative lab',
      refinedPrefix: language === 'ar' ? 'كيف أطور هذه الفكرة وأحولها إلى شيء عملي: ' : 'How can I develop this idea into something practical: ',
    };
  }

  if (has('استراتيجية', 'تحليل', 'منافس', 'سوق', 'نمو', 'strategy', 'market', 'competitor', 'growth')) {
    return {
      icon: BrainCircuit,
      path: 'strategicarena' as IntentPath,
      title: language === 'ar' ? 'تحليل استراتيجي' : 'Strategic analysis',
      hint: language === 'ar' ? 'الموضوع يحتاج تفكيك قوى وفرص ومخاطر.' : 'This needs forces, opportunities, and risks.',
      action: language === 'ar' ? 'افتح التحليل الاستراتيجي' : 'Open strategic analysis',
      refinedPrefix: language === 'ar' ? 'حلل استراتيجياً هذا الموقف: ' : 'Analyze this strategically: ',
    };
  }

  if (has('غضب', 'صراخ', 'توتر', 'خلاف', 'شجار', 'angry', 'conflict', 'fight')) {
    return {
      icon: Route,
      path: 'simulation_roleplay' as IntentPath,
      title: language === 'ar' ? 'محاكاة موقف' : 'Situation simulation',
      hint: language === 'ar' ? 'الأفضل تجربة حوار وتمثيل ردود الفعل.' : 'Best handled through dialogue simulation.',
      action: language === 'ar' ? 'افتح المحاكاة' : 'Open simulation',
      refinedPrefix: language === 'ar' ? 'كيف أتصرف بهدوء وذكاء في هذا الموقف: ' : 'How can I respond calmly and intelligently to: ',
    };
  }

  return {
    icon: Sparkles,
    path: 'oracle' as IntentPath,
    title: language === 'ar' ? 'فهم ذكي' : 'Smart understanding',
    hint: language === 'ar' ? 'ابدأ بصياغة أوضح، ثم اختر المسار.' : 'Start with a clearer wording, then pick a path.',
    action: language === 'ar' ? 'افتح الفهم الذكي' : 'Open smart understanding',
    refinedPrefix: language === 'ar' ? 'أريد فهماً واضحاً لهذا الموضوع: ' : 'I want a clear understanding of this topic: ',
  };
};

const buildFallbackRefinement = (value: string, language: 'ar' | 'en') => {
  const text = value.trim();
  if (!text) return '';
  const profile = getIntentProfile(text, language);
  if (text.endsWith('؟') || text.endsWith('?')) return text;
  return `${profile.refinedPrefix}${text}`;
};

export const SmartIntentEngine: React.FC<SmartIntentEngineProps> = ({
  language,
  value,
  onApply,
  onSubmit,
  onQawlFasl,
  onOpenPath,
  compact = false,
  className,
}) => {
  const trimmed = value.trim();
  const { smartSuggestion, isSuggestionLoading } = useSmartSearch(trimmed, 5);
  const profile = React.useMemo(() => getIntentProfile(trimmed, language), [trimmed, language]);
  const refined = (smartSuggestion && !smartSuggestion.includes('الصيانة')) ? smartSuggestion : buildFallbackRefinement(trimmed, language);
  const Icon = profile.icon;

  if (trimmed.length < 3) return null;

  return (
    <div className={cn(
      'smart-intent-engine rounded-[22px] md:rounded-[24px] border border-[#8E7AAE]/15 bg-[#FAF9F6]/90 backdrop-blur-xl shadow-[0_18px_55px_rgba(24,34,49,0.06)]',
      compact ? 'p-2.5 md:p-3 space-y-2.5 md:space-y-3' : 'p-3 md:p-5 space-y-3 md:space-y-4',
      className
    )} dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-2xl bg-[#8E7AAE]/12 text-[#6E5F8E] border border-[#8E7AAE]/20 flex items-center justify-center shrink-0 shadow-lg">
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0 text-right">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="text-[10px] font-black tracking-widest uppercase text-zinc-400">
              {language === 'ar' ? 'محرك النوايا' : 'Intent engine'}
            </span>
            {isSuggestionLoading && <span className="text-[10px] font-bold text-zinc-300">{language === 'ar' ? 'يصيغ...' : 'refining...'}</span>}
          </div>
          <h4 className="text-sm md:text-base font-black text-[#182231]">{profile.title}</h4>
          <p className="text-xs md:text-sm text-[#7C8796] font-bold leading-relaxed mt-1">{profile.hint}</p>
        </div>
      </div>

      {refined && refined !== trimmed && (
        <button
          type="button"
          onClick={() => onApply(refined)}
          className="w-full text-right p-3 rounded-2xl bg-[#F7F5F2] hover:bg-[#F1EEF4] border border-[#8E7AAE]/12 transition-colors"
        >
          <div className="text-[10px] font-black text-zinc-400 mb-1">{language === 'ar' ? 'صياغة أفضل' : 'Better wording'}</div>
          <div className="text-sm font-black text-[#182231] leading-relaxed">{refined}</div>
        </button>
      )}

      <div className="flex flex-wrap gap-2 items-center">
        <button
          type="button"
          onClick={() => onApply(language === 'ar' ? `اشرح لي ببساطة: ${trimmed}` : `Explain simply: ${trimmed}`)}
          className="px-4 py-2 rounded-full bg-white/90 border border-[#8FA9C7]/25 text-[#465568] text-xs font-black active:scale-95 transition-all"
        >
          {language === 'ar' ? 'بسّطها' : 'Simplify'}
        </button>
        {onSubmit && (
          <button
            type="button"
            onClick={() => onSubmit(refined || trimmed)}
            className="smart-intent-start flex-1 min-w-[150px] justify-center px-7 py-3.5 rounded-full bg-[#6E5F8E] text-white border border-[#6E5F8E] text-sm md:text-base font-black active:scale-95 transition-all shadow-[0_14px_34px_rgba(110,95,142,0.30)] ring-2 ring-[#6E5F8E]/10"
          >
            {language === 'ar' ? 'ابدأ الآن' : 'Start now'}
          </button>
        )}
      </div>
    </div>
  );
};
