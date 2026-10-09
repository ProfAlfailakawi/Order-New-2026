import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import { lazy, Suspense, useEffect } from "react";
import { Utensils } from "lucide-react";
import CustomerSite from "./pages/CustomerSite";
import { useOnlineStatus } from "./hooks/useOnlineStatus";
import { OfflineModal } from "./components/OfflineModal";

const OrderPage = lazy(() => import("./pages/OrderPage"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const SplitPayment = lazy(() => import("./pages/SplitPayment"));

function BrandedFallback() {
  return (
    <div
      dir="rtl"
      role="status"
      aria-live="polite"
      aria-label="جاري التحميل"
      className="min-h-screen flex flex-col items-center justify-center gap-5 bg-cream px-6"
    >
      <div className="h-24 w-24 rounded-[26px] bg-white ring-1 ring-cream-edge shadow-[0_16px_44px_rgba(24,51,38,0.14)] flex items-center justify-center overflow-hidden animate-pulse">
        <img
          src="/logo-optimized.png"
          alt="شركة مطبخ التراث الكويتي"
          className="h-full w-full object-contain p-2.5"
        />
      </div>
      <div className="w-full max-w-xs space-y-3" aria-hidden="true">
        <div className="sk-shimmer h-5 w-2/3 mx-auto" />
        <div className="sk-shimmer h-24 w-full rounded-3xl" />
        <div className="grid grid-cols-2 gap-3">
          <div className="sk-shimmer h-28 rounded-3xl" />
          <div className="sk-shimmer h-28 rounded-3xl" />
        </div>
      </div>
    </div>
  );
}

function NotFoundFoodPage() {
  return (
    <div dir="rtl" className="min-h-screen flex items-center justify-center bg-cream p-6">
      <div className="max-w-md w-full bg-white border border-cream-edge rounded-[32px] p-8 text-center shadow-[0_24px_80px_rgba(120,53,15,0.10)]">
        <svg viewBox="0 0 120 120" className="w-28 h-28 mx-auto mb-3" aria-hidden="true">
          <circle cx="60" cy="62" r="46" fill="#fff7e8" stroke="#ead8b5" />
          <path d="M60 18v10" stroke="#b28a41" strokeWidth="3" strokeLinecap="round" />
          <path d="M44 38h32l6 10v34a8 8 0 0 1-8 8H46a8 8 0 0 1-8-8V48z" fill="#0d3a22" />
          <path d="M44 38h32" stroke="#b28a41" strokeWidth="3" />
          <rect x="50" y="52" width="20" height="26" rx="10" fill="#f6d27a" />
          <path d="M60 52v26M50 65h20" stroke="#b28a41" strokeWidth="1.5" />
        </svg>
        <h1 className="text-2xl font-extrabold text-ink mb-2">الصفحة مو موجودة</h1>
        <p className="text-stone-600 font-medium mb-6">بس المنيو موجود وينطرك. ارجع واختار طلبك الطيب.</p>
        <Link to="/" className="inline-flex items-center justify-center gap-2 min-h-12 rounded-2xl bg-brand text-white font-bold px-6 shadow-lg">
          <Utensils className="w-5 h-5" aria-hidden="true" />
          الرجوع للمنيو
        </Link>
      </div>
    </div>
  );
}

export default function App() {
  const isOnline = useOnlineStatus();
  useEffect(() => {
    // Default to RTL for Arabic
    document.documentElement.dir = "rtl";
    document.documentElement.lang = "ar";
  }, []);

  return (
    <Router>
      <div className="min-h-screen font-sans w-full max-w-full overflow-x-clip">
        <OfflineModal isOpen={!isOnline} />
        <Suspense fallback={<BrandedFallback />}>
          <Routes>
            <Route path="/" element={<CustomerSite />} />
            <Route path="/track" element={<OrderPage />} />
            <Route path="/split/:id" element={<SplitPayment />} />
            <Route path="/admin/*" element={<AdminDashboard />} />
            <Route path="*" element={<NotFoundFoodPage />} />
          </Routes>
        </Suspense>
      </div>
    </Router>
  );
}
