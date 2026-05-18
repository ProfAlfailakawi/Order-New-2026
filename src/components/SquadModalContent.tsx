import React from "react";
import { motion } from "motion/react";
import { User, Landmark, Crown, Users, LogIn } from "lucide-react";
import { cn } from "../utils";

interface SquadTier {
   id: string;
   name: string;
   minPoints: number;
   benefit: string;
   icon: string;
   bg: string;
   color: string;
}

interface SquadModalContentProps {
   activeSquadTab: string;
   squadInfo: any;
   SQUAD_TIERS: SquadTier[];
   getSquadTier: (points: number) => SquadTier;
   topSquads: any[];
   customerPhone: string;
   customerName: string;
   customerPoints: number;
   LOYALTY_TIERS: any[];
   getLoyaltyTier: (p: number) => any;
   guestName: string;
   setGuestName: (v: string) => void;
   guestPhone: string;
   setGuestPhone: (v: string) => void;
   loginPhone: string;
   setLoginPhone: (v: string) => void;
   isJoiningSquad: boolean;
   setIsJoiningSquad: (v: boolean) => void;
   isCreatingSquad: boolean;
   setIsCreatingSquad: (v: boolean) => void;
   isSubmittingSquad: boolean;
   setIsSubmittingSquad: (v: boolean) => void;
   newSquadName: string;
   setNewSquadName: (v: string) => void;
   setActiveSquadId: (v: string | null) => void;
   setCustomerPhone: (v: string) => void;
   setCustomerName: (v: string) => void;
   normalizeDigits: (s: string) => string;
   formatPoints: (n: number) => string;
   handleCreateSquad: () => void;
   handleJoinSquad: (id: string) => void;
}

export const SquadModalContent: React.FC<SquadModalContentProps> = ({
   activeSquadTab,
   squadInfo,
   SQUAD_TIERS,
   getSquadTier,
   topSquads,
   customerPhone,
   customerName,
   customerPoints,
   LOYALTY_TIERS,
   getLoyaltyTier,
   guestName,
   setGuestName,
   guestPhone,
   setGuestPhone,
   loginPhone,
   setLoginPhone,
   isJoiningSquad,
   setIsJoiningSquad,
   isCreatingSquad,
   setIsCreatingSquad,
   isSubmittingSquad,
   setIsSubmittingSquad,
   newSquadName,
   setNewSquadName,
   setActiveSquadId,
   setCustomerPhone,
   setCustomerName,
   normalizeDigits,
   formatPoints,
   handleCreateSquad,
   handleJoinSquad
}) => {
   return (
      <div className="flex flex-col gap-6" id="squad-content-container">
         {activeSquadTab === "overview" && (
            <div className="flex flex-col gap-6 animate-in fade-in duration-500">
               {/* Personal Loyalty Tier - Moved from main screen */}
               {customerPhone && (
                  <div className="flex flex-col gap-2">
                      <h4 className="text-xs font-black text-stone-400 uppercase tracking-widest text-right mb-1">بروتوكول الولاء الشخصي</h4>
                      {(() => {
                          const tier = getLoyaltyTier(customerPoints);
                          return (
                              <div className={cn("p-4 rounded-2xl border-2 flex items-center justify-between", tier.bg, tier.color === 'text-sky-600' ? 'border-sky-100' : tier.color === 'text-yellow-600' ? 'border-yellow-100' : 'border-stone-100')}>
                                  <div className="flex items-center gap-3">
                                      <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-xl">{tier.icon}</div>
                                      <div className="flex flex-col text-right">
                                          <span className="text-sm font-black text-brand">مستوى {tier.name}</span>
                                          <span className="text-[10px] font-bold text-stone-500">رصيدك: {customerPoints} {formatPoints(customerPoints)}</span>
                                      </div>
                                  </div>
                                  <div className="text-[10px] font-black text-stone-400 opacity-60">حسابك الشخصي</div>
                              </div>
                          );
                      })()}
                  </div>
               )}

               {isCreatingSquad && (
                  <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col gap-4 p-6 bg-white rounded-3xl border-2 border-stone-100 shadow-xl">
                     <div className="flex flex-col text-right">
                        <h4 className="font-black text-lg text-brand mb-1">تأسيس ديوانية يديدة ✨</h4>
                        <p className="text-xs font-bold text-stone-500 mb-4">اجمع ربعك ونافسوا الدواوين الثانية!</p>
                     </div>
                     <div className="space-y-4">
                        <div className="flex flex-col gap-1 text-right">
                           <label className="text-[10px] font-black text-stone-400 mr-2">اسم الديوانية</label>
                           <input 
                              type="text" 
                              value={newSquadName} 
                              onChange={(e) => setNewSquadName(e.target.value)} 
                              placeholder="مثال: ديوانية الفزعة"
                              className="w-full bg-stone-50 border-2 border-stone-100 rounded-2xl px-4 py-3 text-sm font-bold text-brand focus:border-accent focus:outline-none transition-all text-right"
                           />
                        </div>
                        <div className="flex flex-col gap-1 text-right">
                           <label className="text-[10px] font-black text-stone-400 mr-2">اسمك بالعربي</label>
                           <input 
                              type="text" 
                              value={guestName} 
                              onChange={(e) => setGuestName(e.target.value)} 
                              placeholder="عشان ربعك يعرفونك"
                              className="w-full bg-stone-50 border-2 border-stone-100 rounded-2xl px-4 py-3 text-sm font-bold text-brand focus:border-accent focus:outline-none transition-all text-right"
                           />
                        </div>
                        <div className="flex flex-col gap-1 text-right">
                           <label className="text-[10px] font-black text-stone-400 mr-2">رقم تلفونك</label>
                           <input 
                              type="tel" 
                              value={guestPhone} 
                              onChange={(e) => setGuestPhone(normalizeDigits(e.target.value))} 
                              placeholder="٨ أرقام"
                              maxLength={8}
                              className="w-full bg-stone-50 border-2 border-stone-100 rounded-2xl px-4 py-3 text-sm font-bold text-brand focus:border-accent focus:outline-none transition-all text-right"
                           />
                        </div>
                        <div className="flex gap-2 pt-2">
                           <button 
                              onClick={() => setIsCreatingSquad(false)}
                              className="flex-1 bg-stone-100 text-stone-500 font-black text-xs py-4 rounded-xl active:scale-95 transition-all"
                           >
                              إلغاء
                           </button>
                           <button 
                              onClick={handleCreateSquad}
                              disabled={isSubmittingSquad}
                              className="flex-[2] bg-brand text-white font-black text-xs py-4 rounded-xl shadow-lg shadow-brand/20 active:scale-95 transition-all disabled:opacity-50"
                           >
                              {isSubmittingSquad ? "جاري التأسيس..." : "أسس الحين 🚀"}
                           </button>
                        </div>
                     </div>
                  </motion.div>
               )}

               {squadInfo ? (() => {
                  const currentSquadTier = getSquadTier(squadInfo.totalOrders || 0);
                  const nextSquadTierIndex = SQUAD_TIERS.findIndex(t => t.id === currentSquadTier.id) + 1;
                  const nextSquadTier = nextSquadTierIndex < SQUAD_TIERS.length ? SQUAD_TIERS[nextSquadTierIndex] : null;

                  let progressPercent = 100;
                  if (nextSquadTier) {
                     const range = nextSquadTier.minPoints - currentSquadTier.minPoints;
                     const currentProgress = (squadInfo.totalOrders || 0) - currentSquadTier.minPoints;
                     progressPercent = Math.min(100, Math.max(0, (currentProgress / range) * 100));
                  }

                  return (
                     <div key="overview-content" className="flex flex-col gap-6">
                        <div className={cn("rounded-[32px] p-6 border-2 shadow-sm relative overflow-hidden transition-all duration-500", currentSquadTier.bg, currentSquadTier.id === 'diamond' ? 'border-sky-200' : currentSquadTier.id === 'gold' ? 'border-yellow-200' : currentSquadTier.id === 'silver' ? 'border-stone-200' : 'border-amber-100')}>
                           <div className="flex items-center gap-4 mb-6 relative z-10">
                              <div className="w-16 h-16 rounded-2xl bg-white shadow-sm flex items-center justify-center text-3xl shrink-0">{currentSquadTier.icon}</div>
                              <div className="flex flex-col text-right">
                                 <h4 className="font-black text-xl text-brand mb-1 flex items-center gap-2">
                                    ديوانية {squadInfo.name}
                                    {currentSquadTier.id === 'diamond' && <Crown className="w-5 h-5 text-sky-500 fill-current" />}
                                 </h4>
                                 <p className={cn("text-xs font-black uppercase tracking-widest", currentSquadTier.color)}>مستوى {currentSquadTier.name}</p>
                              </div>
                           </div>
                           <div className="relative z-10 w-full mb-6">
                              {nextSquadTier ? (
                                 <div className="space-y-3">
                                    <div className="flex justify-between items-end px-0.5">
                                       <div className="text-right text-[10px] font-black text-brand flex flex-col gap-0.5">
                                          <span className="opacity-60 font-bold">رصيد ديوانيتكم:</span>
                                          <span>{squadInfo.totalOrders || 0} نقطة</span>
                                       </div>
                                       <div className="text-left text-[10px] font-black text-brand flex flex-col items-start gap-0.5">
                                          <span className="opacity-60 font-bold">باقي لكم:</span>
                                          <span className="text-accent underline font-black">{nextSquadTier.minPoints - (squadInfo.totalOrders || 0)} نقطة</span>
                                       </div>
                                    </div>
                                    <div className="h-4 bg-white/80 rounded-full overflow-hidden border border-stone-100/50 p-0.5 shadow-inner">
                                       <motion.div initial={{ width: 0 }} animate={{ width: `${progressPercent}%` }} transition={{ duration: 1.5, ease: "easeOut" }}
                                          className={cn("h-full rounded-full relative overflow-hidden", currentSquadTier.id === "gold" ? "bg-yellow-500" : currentSquadTier.id === "diamond" ? "bg-sky-500" : currentSquadTier.id === "silver" ? "bg-stone-500" : "bg-amber-500")}
                                       >
                                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
                                       </motion.div>
                                    </div>
                                 </div>
                              ) : (
                                 <div className="p-4 bg-sky-500/10 rounded-2xl border border-sky-200/50 flex items-center gap-3">
                                    <div className="bg-sky-500 p-2 rounded-lg text-white"><Crown className="w-5 h-5" /></div>
                                    <div className="text-right">
                                       <h4 className="font-black text-sm text-sky-700">لقادة الديوانية!</h4>
                                       <p className="text-[10px] font-bold text-sky-600/80">أنتم أسياد المكان، رصيدكم {squadInfo.totalOrders || 0} نقطة!</p>
                                    </div>
                                 </div>
                              )}
                           </div>
                           <div className="p-4 bg-white/60 backdrop-blur-md rounded-2xl text-[11px] font-black text-brand border border-white/40 shadow-sm leading-relaxed mb-4 text-right">
                              {currentSquadTier.benefit}
                           </div>
                           <p className="text-[10px] font-bold text-stone-400 text-center">كل ١ دينار = ١ نقطة لجميع أعضاء الديوانية.</p>
                        </div>

                        <div className="flex flex-col gap-3">
                           <h4 className="font-black text-brand text-lg flex items-center gap-2 text-right">
                              <User className="w-5 h-5 text-accent" /> ترتيب الأعضاء
                           </h4>
                           <div className="bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden flex flex-col">
                              {squadInfo.membersList?.sort((a:any, b:any) => (b.orderCount || 0) - (a.orderCount || 0)).map((mem: any, idx: number) => (
                                 <div key={idx} className={cn("flex items-center justify-between p-4 border-b border-stone-50 last:border-0", mem.phone === squadInfo.memberData?.phone ? "bg-accent/5 font-bold" : "")}>
                                    <div className="flex items-center gap-3">
                                       <div className="w-8 h-8 rounded-full bg-stone-50 flex items-center justify-center font-black text-stone-400 text-sm shrink-0">{idx === 0 ? "👑" : idx + 1}</div>
                                       <span className={cn("text-sm", mem.phone === squadInfo.memberData?.phone ? "text-brand font-black" : "text-stone-700 font-bold")}>{mem.name || "عضو"} {mem.phone === squadInfo.memberData?.phone && "(أنت)"}</span>
                                    </div>
                                    <div className="bg-stone-50 px-3 py-1 rounded-full text-xs font-bold text-stone-600 border border-stone-100 font-mono">{mem.orderCount || 0}</div>
                                 </div>
                              ))}
                           </div>
                        </div>

                        <button onClick={() => {
                           const link = `https://${window.location.host}/?squadId=${squadInfo.id}`;
                           if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(link).then(() => alert("تم نسخ الرابط!"));
                           else prompt("رابط الدعوة:", link);
                        }} className="w-full bg-brand text-white font-black text-sm py-4 rounded-xl shadow-lg active:scale-95 transition-all">نسخ رابط دعوة ربعك 🔗</button>
                     </div>
                  );
               })() : (
                  <div className="bg-orange-50 rounded-2xl p-6 border border-orange-100 shadow-sm flex flex-col items-center justify-center text-center">
                     <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center text-orange-500 mb-4 shadow-inner"><Users className="w-8 h-8" /></div>
                     <h4 className="font-black text-lg text-brand mb-2">مو مسجل بأي ديوانية! 🧐</h4>
                     <p className="text-sm font-bold text-stone-600 mb-6 px-4">ادخل من رابط دعوة ربعك أو أسس ديوانية يديدة الحين!</p>
                     <button onClick={() => setIsCreatingSquad(true)} className="w-full bg-brand text-white font-black text-sm py-4 rounded-xl shadow-md active:scale-95">تأسيس ديوانية ربعك ✨</button>
                  </div>
               )}
            </div>
         )}

         {activeSquadTab === "leaderboard" && (
            <div className="flex flex-col gap-6 animate-in fade-in duration-500">
               <h4 className="font-black text-brand text-lg flex items-center gap-2 text-right"><Landmark className="w-5 h-5 text-accent" /> لوحة صدارة الدواوين</h4>
               <div className="bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden flex flex-col">
                  {topSquads?.map((sq: any, idx: number) => {
                     const sqTier = getSquadTier(sq.totalOrders || 0);
                     return (
                        <div key={idx} className={cn("flex items-center justify-between p-4 border-b border-stone-50 last:border-0", sq.id === squadInfo?.id ? "bg-accent/5 font-bold" : "")}>
                           <div className="flex items-center gap-3">
                              <div className={cn("w-8 h-8 rounded-full flex items-center justify-center font-black text-sm shrink-0", idx === 0 ? "bg-yellow-100 text-yellow-700" : "bg-stone-50 text-stone-400")}>{idx + 1}</div>
                              <div className="flex flex-col text-right">
                                 <span className="text-sm font-black text-stone-700">{sq.name}</span>
                                 <span className="text-[10px] text-stone-400 font-bold">{sqTier.name}</span>
                              </div>
                           </div>
                           <div className="text-sm font-black text-accent font-mono">{sq.totalOrders || 0}</div>
                        </div>
                     );
                  })}
               </div>
            </div>
         )}

         {activeSquadTab === "tiers" && (
            <div className="flex flex-col gap-4 animate-in fade-in duration-500 text-right">
               {SQUAD_TIERS.map((tier) => (
                  <div key={tier.id} className={cn("p-5 rounded-2xl border-2 transition-all relative overflow-hidden", tier.bg, squadInfo && getSquadTier(squadInfo.totalOrders || 0).id === tier.id ? "border-brand" : "border-stone-100")}>
                     <div className="flex items-center gap-4 relative z-10">
                        <div className="w-12 h-12 rounded-xl bg-white shadow-sm flex items-center justify-center text-2xl shrink-0">{tier.icon}</div>
                        <div className="flex flex-col flex-1">
                           <div className="flex items-center justify-between"><h5 className={cn("font-black text-lg", tier.color)}>{tier.name}</h5><span className="text-[10px] font-bold opacity-60 tracking-tighter">{tier.minPoints}+ نقطة</span></div>
                           <p className="text-[11px] font-black text-stone-600 mt-1">{tier.benefit}</p>
                        </div>
                     </div>
                  </div>
               ))}
            </div>
         )}
      </div>
   );
};
