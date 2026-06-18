import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import { lazy, Suspense, useEffect } from "react";
import CustomerSite from "./pages/CustomerSite";
import SplitPayment from "./pages/SplitPayment";

const OrderPage = lazy(() => import("./pages/OrderPage"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));

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
  useEffect(() => {
    // Default to RTL for Arabic
    document.documentElement.dir = "rtl";
    document.documentElement.lang = "ar";
  }, []);

  return (
    <Router>
      <div className="min-h-screen font-sans w-full max-w-full overflow-x-hidden">
        <Suspense fallback={<div dir="rtl" className="min-h-screen flex items-center justify-center bg-[#fff8ef] text-[#183326] font-bold">جاري التحميل...</div>}>
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
