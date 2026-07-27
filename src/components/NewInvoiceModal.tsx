import React, { useState } from "react";
import { motion } from "motion/react";
import { X, Phone, User, Landmark, MapPin, Hash, Home, Layers, DollarSign, AlertCircle } from "lucide-react";
import { Region } from "../types";
import { heritageMotion } from "../lib/heritageMotion";
import { normalizeDigits } from "../utils";

export function NewInvoiceModal({ 
  isOpen, 
  onClose, 
  zones 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  zones: Region[];
}) {
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [total, setTotal] = useState("");
  const [region, setRegion] = useState("");
  const [block, setBlock] = useState("");
  const [street, setStreet] = useState("");
  const [avenue, setAvenue] = useState("");
  const [building, setBuilding] = useState("");
  const [floor, setFloor] = useState("");
  const [apartment, setApartment] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showInvoiceHint, setShowInvoiceHint] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!navigator.onLine) {
      alert("يتعذر التعديل دون اتصال ⚠️ البرنامج يعمل حالياً بوضع القراءة فقط.");
      return;
    }
    setIsLoading(true);
    try {
      const orderData = {
        customerName: name,
        customerPhone: phone,
        address: {
          region,
          block,
          street,
          avenue,
          building,
          floor,
          apartment
        },
        items: [{ id: "custom-invoice", name: "فاتورة طلب خاص", price: Number(total), quantity: 1, type: "custom" }],
        deliveryFee: 0,
        total: Number(total),
        regionId: zones.find(z => z.name === region)?.id || null,
        status: "جديد",
        paymentStatus: "pending",
        source: "admin_dashboard"
      };

      const response = await fetch((import.meta.env.VITE_API_BASE_URL || "") + "/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderData)
      });

      if (!response.ok) throw new Error("ما قدرنا ننشئ الفاتورة");
      
      onClose();
    } catch (error) {
      console.error(error);
      alert("تعطل إنشاء الفاتورة. جرّب مرة ثانية.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="customer-sheet-backdrop fixed inset-0 z-[100] flex items-center justify-center bg-brand/40 backdrop-blur-sm p-4"
      dir="rtl"
    >
      <motion.div
        {...heritageMotion.customerSheet}
        className="customer-motion-sheet bg-[#fafaf9] rounded-[32px] w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
      >
        <div className="new-invoice-soft-head p-6 border-b border-stone-100 flex justify-between items-center bg-white shrink-0 relative">
          <button
            type="button"
            className="new-invoice-attention-trigger"
            onClick={() => setShowInvoiceHint((v) => !v)}
            onMouseEnter={() => setShowInvoiceHint(true)}
            onMouseLeave={() => setShowInvoiceHint(false)}
            onFocus={() => setShowInvoiceHint(true)}
            onBlur={() => setShowInvoiceHint(false)}
            aria-label="ملاحظة الفاتورة"
          >
            <AlertCircle className="w-4 h-4" />
          </button>
          <div className={`new-invoice-touch-tip ${showInvoiceHint ? "is-visible" : ""}`} role="status">
            <strong>فاتورة طلب خاص</strong>
            <span>اكتب المبلغ والبيانات، ثم أنشئ الرابط للعميل.</span>
          </div>
          <h2 className="text-2xl font-black text-brand tracking-tight">فاتورة جديدة</h2>
          <button onClick={onClose} className="p-2 hover:bg-stone-50 rounded-full transition-colors">
            <X className="w-6 h-6 text-stone-400" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto no-scrollbar flex-grow">
          <form id="new-invoice-form" onSubmit={handleSubmit} className="space-y-6">
            
            {/* Amount */}
            <div className="space-y-2">
               <label className="text-xs font-bold text-stone-500 flex items-center gap-1.5"><DollarSign className="w-4 h-4 text-accent" /> قيمة الفاتورة (د.ك)</label>
               <input
                 type="text"
                 required
                 value={total}
                 onChange={(e) => setTotal(normalizeDigits(e.target.value).replace(/[^0-9.]/g, ""))}
                 className="w-full px-5 py-4 border-2 border-stone-100 rounded-xl focus:border-accent outline-none text-xl font-bold bg-white"
                 placeholder="مثال: 15.500"
               />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-stone-500 flex items-center gap-1.5"><User className="w-4 h-4" /> اسم العميل</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-5 py-4 border-2 border-stone-100 rounded-xl focus:border-accent outline-none font-bold bg-white"
                  placeholder="الاسم"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-stone-500 flex items-center gap-1.5"><Phone className="w-4 h-4" /> رقم التلفون</label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => {
                    const val = normalizeDigits(e.target.value).replace(/\D/g, "");
                    if (val.length <= 8) setPhone(val);
                  }}
                  className="w-full px-5 py-4 border-2 border-stone-100 rounded-xl focus:border-accent outline-none font-bold tracking-widest text-left bg-white"
                  placeholder="8 أرقام"
                  dir="ltr"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-stone-500 flex items-center gap-1.5"><MapPin className="w-4 h-4" /> المنطقة</label>
              <select
                required
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="w-full px-5 py-4 border-2 border-stone-100 rounded-xl focus:border-accent outline-none font-bold bg-white"
              >
                <option value="">اختر المنطقة...</option>
                {zones.map(z => <option key={z.id} value={z.name}>{z.name}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-stone-500 flex items-center gap-1.5"><Landmark className="w-4 h-4" /> القطعة</label>
                <input required type="text" value={block} onChange={(e) => setBlock(normalizeDigits(e.target.value))} className="w-full px-4 py-3 border-2 border-stone-100 rounded-xl focus:border-accent outline-none bg-white font-bold" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-stone-500 flex items-center gap-1.5"><MapPin className="w-4 h-4" /> الشارع</label>
                <input required type="text" value={street} onChange={(e) => setStreet(normalizeDigits(e.target.value))} className="w-full px-4 py-3 border-2 border-stone-100 rounded-xl focus:border-accent outline-none bg-white font-bold" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-stone-500 flex items-center gap-1.5"><Hash className="w-4 h-4" /> الجادة <span className="font-normal opacity-50">(اختياري)</span></label>
                <input type="text" value={avenue} onChange={(e) => setAvenue(normalizeDigits(e.target.value))} className="w-full px-4 py-3 border-2 border-stone-100 rounded-xl focus:border-accent outline-none bg-white font-bold" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-stone-500 flex items-center gap-1.5"><Home className="w-4 h-4" /> المنزل</label>
                <input required type="text" value={building} onChange={(e) => setBuilding(normalizeDigits(e.target.value))} className="w-full px-4 py-3 border-2 border-stone-100 rounded-xl focus:border-accent outline-none bg-white font-bold" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-stone-500 flex items-center gap-1.5"><Layers className="w-4 h-4" /> الدور <span className="font-normal opacity-50">(اختياري)</span></label>
                <input type="text" value={floor} onChange={(e) => setFloor(normalizeDigits(e.target.value))} className="w-full px-4 py-3 border-2 border-stone-100 rounded-xl focus:border-accent outline-none bg-white font-bold" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-stone-500 flex items-center gap-1.5"><Hash className="w-4 h-4" /> الشقة <span className="font-normal opacity-50">(اختياري)</span></label>
                <input type="text" value={apartment} onChange={(e) => setApartment(normalizeDigits(e.target.value))} className="w-full px-4 py-3 border-2 border-stone-100 rounded-xl focus:border-accent outline-none bg-white font-bold" />
              </div>
            </div>

          </form>
        </div>

        <div className="p-6 border-t border-stone-100 bg-stone-50 shrink-0">
          <button 
            disabled={isLoading || !phone || !name || !total || !region || !block || !street || !building}
            type="submit" 
            form="new-invoice-form"
            className="w-full py-4 bg-brand text-white font-bold rounded-2xl hover:bg-brand/90 transition-all shadow-md active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading ? "نجهز الفاتورة..." : "إنشاء فاتورة جديدة"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
