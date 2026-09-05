import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import { lazy, Suspense, useEffect } from "react";
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
      className="min-h-screen flex flex-col items-center justify-center gap-5 bg-[#fff7e8] px-6"
    >
      <div className="h-24 w-24 rounded-[26px] bg-white ring-1 ring-[#eadcbb] shadow-[0_16px_44px_rgba(24,51,38,0.14)] flex items-center justify-center overflow-hidden animate-pulse">
        <img
          src="/logo-optimized.png"
          alt="شركة مطبخ التراث الكويتي"
          className="h-full w-full object-contain p-2.5"
        />
      </div>
      <div className="h-1.5 w-36 overflow-hidden rounded-full bg-[#ead8b5]">
        <div className="h-full w-1/2 rounded-full bg-gradient-to-l from-[#0f3d2e] via-[#d7a642] to-[#ba3f31] animate-[loaderSlide_1.2s_ease-in-out_infinite]" />
      </div>
      <style>{`@keyframes loaderSlide{0%{transform:translateX(-120%)}100%{transform:translateX(240%)}}`}</style>
    </div>
  );
}

function NotFoundFoodPage() {
  return (
    <div dir="rtl" className="min-h-screen flex items-center justify-center bg-[#fff8ef] p-6">
      <div className="max-w-md w-full bg-white border border-amber-100 rounded-[32px] p-8 text-center shadow-[0_24px_80px_rgba(120,53,15,0.10)]">
        <div className="w-16 h-16 mx-auto mb-5 rounded-3xl bg-amber-50 flex items-center justify-center text-3xl">🍽️</div>
        <h1 className="text-2xl font-black text-[#183326] mb-2">الصفحة مو موجودة</h1>
        <p className="text-stone-500 font-bold mb-6">بس المنيو موجود وينطرك. ارجع واختار طلبك الطيب.</p>
        <Link to="/" className="inline-flex items-center justify-center rounded-2xl bg-[#183326] text-white font-[#ffffff] px-6 py-3 shadow-lg">الرجوع للمنيو</Link>
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
      <div className="min-h-screen font-sans w-full max-w-full overflow-x-hidden">
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
