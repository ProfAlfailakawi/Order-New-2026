/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import CustomerSite from "./pages/CustomerSite";
import OrderPage from "./pages/OrderPage";
import AdminDashboard from "./pages/AdminDashboard";
import SplitPayment from "./pages/SplitPayment";
import { useEffect } from "react";

export default function App() {
  useEffect(() => {
    // Default to RTL for Arabic
    document.documentElement.dir = "rtl";
    document.documentElement.lang = "ar";
  }, []);

  return (
    <Router>
      <div className="min-h-screen font-sans">
        <Routes>
          <Route path="/" element={<CustomerSite />} />
          <Route path="/track" element={<OrderPage />} />
          <Route path="/split/:id" element={<SplitPayment />} />
          <Route path="/admin/*" element={<AdminDashboard />} />
        </Routes>
      </div>
    </Router>
  );
}

