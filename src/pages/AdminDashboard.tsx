import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { MagneticButton } from "../components/MagneticButton";
import { 
  LayoutDashboard, 
  FileText, 
  ShoppingCart, 
  TrendingUp, 
  CheckCircle2, 
  MessageCircle, 
  ExternalLink,
  Search,
  Bell,
  Filter,
  CreditCard,
  ChevronLeft,
  MapPin,
  Edit2,
  Save,
  X,
  Settings as SettingsIcon,
  Users,
  PieChart,
  AlertTriangle
} from "lucide-react";
import { Order, Analytics, Region } from "../types";
import { db } from "../lib/firebase";
import { collection, onSnapshot, doc, updateDoc, getDoc, query, orderBy } from "../lib/fakestore";
import { format } from "date-fns";
import { enUS } from "date-fns/locale";

import { DEFAULT_GLOBAL_LOGO } from "../constants";
import { calculateItemsTotal, getDisplayTotal, normalizeDigits } from "../utils";

export default function AdminDashboard() {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<"dashboard" | "orders" | "invoices" | "customers" | "zones" | "settings">("dashboard");
  const [orders, setOrders] = useState<Order[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [zones, setZones] = useState<Region[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [editingZoneId, setEditingZoneId] = useState<string | null>(null);
  const [editZoneName, setEditZoneName] = useState("");
  const [editZonePrice, setEditZonePrice] = useState<number>(0);
  const [showAddZone, setShowAddZone] = useState(false);
  const [newZoneName, setNewZoneName] = useState("");
  const [newZonePrice, setNewZonePrice] = useState<number>(0);
  const [customers, setCustomers] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>({});
  const [selectedRegionFilter, setSelectedRegionFilter] = useState<string>("");
  const [showOrderFilters, setShowOrderFilters] = useState(false);
  
  const [promocodes, setPromocodes] = useState<any[]>([]);
  const [newPromoCode, setNewPromoCode] = useState("");
  const [newPromoType, setNewPromoType] = useState<"percentage" | "flat">("percentage");
  const [newPromoValue, setNewPromoValue] = useState<number>(0);
  const [isAddingPromo, setIsAddingPromo] = useState(false);


  const cleanPhone = (phone: any) => {
    if (!phone) return "";
    let cleaned = String(phone).replace(/\D/g, "");
    cleaned = cleaned.replace(/^0+/, "");
    if (cleaned.startsWith("965") && cleaned.length > 8) {
        cleaned = cleaned.slice(3);
    }
    if (cleaned.length >= 8) {
        return cleaned.slice(-8);
    }
    return cleaned;
  };

  const getCustomerPoints = (phone?: string) => {
    if (!phone) return 0;
    const cleanQuery = cleanPhone(phone);
    const totalPoints = invoices.filter(inv => {
      const invPhone = cleanPhone(inv.customerPhone || inv.phone || "");
      return invPhone === cleanQuery;
    }).reduce((sum, inv) => sum + (Number(inv.total) || 0), 0);
    return Math.floor(totalPoints);
  };

  useEffect(() => {
    // Read EVERYTHING from a single shared_company_data document per user request
    const unsub = onSnapshot(doc(db, "appData", "shared_company_data"), (snapshot) => {
       if (snapshot.exists()) {
           const data = snapshot.data();
           
           const products = [...(data.products || []), ...(data.supplierCopies || [])];
           
           const populateItems = (items: any[]) => {
               if (!items) return [];
               return items.map((item: any) => {
                   const prod = products.find((p: any) => p.id === item.productId || p.id === item.id);
                   return {
                       ...item,
                       productName: item.productName || item.name || (prod ? prod.name : "منتج"),
                       name: item.name || item.productName || (prod ? prod.name : "منتج"),
                       price: item.price !== undefined ? item.price : (item.priceAtTime !== undefined ? item.priceAtTime : (prod ? prod.price : 0)),
                       preparationInstructions: item.preparationInstructions || (prod ? prod.preparationInstructions : undefined)
                   };
               });
           };

           // Orders
           let ordersData = [...(data.orders || [])];
           ordersData.sort((a: any, b: any) => {
           const dateA = (a.createdAt || a.date) ? new Date(a.createdAt || a.date).getTime() : 0;
              const dateB = (b.createdAt || b.date) ? new Date(b.createdAt || b.date).getTime() : 0;
              return dateB - dateA;
           });
           const populatedOrders = ordersData.map((order: any) => {
               const mappedOrder = { ...order, items: populateItems(order.items) };
               
               let resolvedAddress = mappedOrder.address;
               if (!resolvedAddress || resolvedAddress === "غير محدد" || resolvedAddress === "") {
                   if (mappedOrder.deliveryInfo && mappedOrder.deliveryInfo.zoneName) {
                       resolvedAddress = mappedOrder.deliveryInfo.zoneName;
                   }
               }
               
               if (mappedOrder.customerId && (!mappedOrder.customerName || !mappedOrder.customerPhone || !resolvedAddress || resolvedAddress === "غير محدد" || resolvedAddress === "")) {
                    const c = (data.customers || []).find((cust: any) => cust.id === mappedOrder.customerId);
                    if (c) {
                        return { 
                           ...mappedOrder, 
                           customerName: mappedOrder.customerName || c.name || c.customerName, 
                           customerPhone: mappedOrder.customerPhone || c.phone || c.customerPhone,
                           address: resolvedAddress && resolvedAddress !== "غير محدد" && resolvedAddress !== "" ? resolvedAddress : (typeof c.address === 'object' ? c.address?.region : c.address) 
                        };
                    }
               }
               return { ...mappedOrder, address: typeof resolvedAddress === 'object' ? resolvedAddress?.region : resolvedAddress };
           });
           setOrders(populatedOrders);
           
           // Customers
           setCustomers(data.customers || []);
           
           // Invoices
           const rawInvoices = data.invoices || [];
           const populatedInvoices = rawInvoices.map((inv: any) => {
               const mappedInv = { ...inv, items: populateItems(inv.items) };
               
               let resolvedAddress = mappedInv.address;
               if (!resolvedAddress || resolvedAddress === "غير محدد" || resolvedAddress === "") {
                   if (mappedInv.deliveryInfo && mappedInv.deliveryInfo.zoneName) {
                       resolvedAddress = mappedInv.deliveryInfo.zoneName;
                   }
               }

               if (mappedInv.customerId && (!mappedInv.customerName || !mappedInv.customerPhone || !resolvedAddress || resolvedAddress === "غير محدد" || resolvedAddress === "")) {
                    const c = (data.customers || []).find((cust: any) => cust.id === mappedInv.customerId);
                    if (c) {
                        return { 
                           ...mappedInv, 
                           customerName: mappedInv.customerName || c.name || c.customerName, 
                           customerPhone: mappedInv.customerPhone || c.phone || c.customerPhone,
                           address: resolvedAddress && resolvedAddress !== "غير محدد" && resolvedAddress !== "" ? resolvedAddress : (typeof c.address === 'object' ? c.address?.region : c.address) 
                        };
                    }
               }
               return { ...mappedInv, address: typeof resolvedAddress === 'object' ? resolvedAddress?.region : resolvedAddress };
           });
           setInvoices(populatedInvoices);
           
           // Analytics 
           // Derive analytics locally since we don't fetch it explicitly anymore, or read it if available
           setAnalytics(data.analytics || {
               totalRevenue: (data.invoices || []).reduce((sum: number, inv: any) => sum + (inv.total || 0), 0),
               completedCount: (data.invoices || []).length
           });
           
           // Zones
           setZones(data.zones || []);

           // Settings
           setSettings(data.settings || {});
            setPromocodes(data.promocodes || []);
       }
    });

    return () => {
      unsub();
    };
  }, []);

  const totalOrdersCount = orders.filter(o => o.status && o.status.startsWith("تم الدفع")).length;

  const filteredOrders = orders.filter(o => {
    const matchesSearch = !searchTerm ? true : (
      (o.id || "").toLowerCase().includes(searchTerm.toLowerCase()) || 
      (o.customerPhone || "").includes(searchTerm) || 
      (o.customerName || "").toLowerCase().includes(searchTerm.toLowerCase()) || 
      (o.address?.region || "").toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    const matchesRegion = !selectedRegionFilter ? true : (o.address?.region === selectedRegionFilter);
    
    return matchesSearch && matchesRegion;
  });

  const filteredInvoices = [...invoices].filter(i => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (i.invoiceId || "").toLowerCase().includes(term) || 
           (i.customerPhone || "").includes(term) || 
           (i.customerName || "").toLowerCase().includes(term);
  }).sort((a: any, b: any) => {
      const dateA = a.completedAt ? new Date(a.completedAt).getTime() : ((a.createdAt || a.date) ? new Date(a.createdAt || a.date).getTime() : 0);
      const dateB = b.completedAt ? new Date(b.completedAt).getTime() : ((b.createdAt || b.date) ? new Date(b.createdAt || b.date).getTime() : 0);
      return dateB - dateA;
  });

  const checkAdminVisibility = (o: Order) => {
      // Don't show completed/cancelled ones here
      return o.status === "جديد" || o.status === "تم الدفع وجاري التوصيل" || o.status === "فشل في عملية الدفع" || o.status === "قيد تجميع القطية";
  };
  const filteredNewOrders = filteredOrders.filter(checkAdminVisibility);

  const handleFreeDelivery = async (order: Order) => {
    if (order.deliveryFee === 0 && order.isFreeDelivery) return;
    try {
      // Let the centralized backend handle this
      await fetch(`/api/admin/orders/${order.id}/free-delivery`, { method: "PATCH" });

      const newItemsTotal = calculateItemsTotal(order.items || []);
      
      // Update local selectedOrder if open
      setSelectedOrder(prev => prev && prev.id === order.id ? { ...prev, deliveryFee: 0, isFreeDelivery: true, deliveryType: 'free', total: newItemsTotal } : prev);
    } catch (error) {
      console.error("Error updating free delivery:", error);
    }
  };

  const handleMarkAsPaid = async (id: string) => {
    try {
      // Let the centralized backend handle this to move it into invoices array
      await fetch(`/api/admin/orders/${id}/pay`, { method: "PATCH" });
      
      setSelectedOrder(null);
    } catch (err) {
      console.error("Failed to mark as paid:", err);
    }
  };

  const contactCustomer = async (order: Order) => {
    // 1. Get raw phone reference from order
    let phoneToUse = order.customerPhone;

    // 2. Look up in customers (if possible)
    const d = await getDoc(doc(db, "appData", "shared_company_data"));
    const appData = d.data() || {};
    const customers = appData.customers || [];
    
    // Find customer to get the latest phone if phoneToUse is matching a registered phone
    const customer = customers.find((c: any) => cleanPhone(c.phone) === cleanPhone(phoneToUse) || cleanPhone(c.customerPhone) === cleanPhone(phoneToUse));
    
    // Final number
    const finalPhone = customer?.phone || customer?.customerPhone || phoneToUse;

    // 3. Clean and Validate
    const cleaned = cleanPhone(finalPhone);

    // Strict rule
    const isInvalid = !cleaned || cleaned === "00000000" || cleaned.length < 8;

    console.log("DEBUG WA:", {
        orderId: order.id,
        customerName: order.customerName,
        rawPhone: finalPhone,
        formattedPhone: cleaned,
        isInvalid: isInvalid,
        sourcePath: "AdminDashboard.tsx - contactCustomer"
    });

    if (isInvalid) {
        alert("رقم العميل غير موجود أو غير صالح");
        return;
    }

    const formattedForWhatsApp = `+965${cleaned}`;

    const addressDetails = order.address ? `\n\n📍 العنوان:\nالمنطقة: ${order.address.region}\nقطعة: ${order.address.block}\nشارع: ${order.address.street}\nمنزل: ${order.address.building}` : "";
    const message = encodeURIComponent(`مرحباً ${order.customerName}، بخصوص طلبك رقم ${order.id}...${addressDetails}`);
    window.open(`https://wa.me/${formattedForWhatsApp}?text=${message}`, "_blank");
  };

  return (
    <div className="flex h-screen bg-[#fafaf9] text-brand" dir="rtl">
      {/* Sidebar */}
      <aside className="w-72 bg-white border-l border-stone-100 flex flex-col p-8 space-y-12 shadow-sm z-50">
        <div className="flex items-center gap-4 px-2 group">
          <div className="w-12 h-12 flex items-center justify-center p-1.5 transition-transform group-hover:rotate-6 shadow-sm overflow-hidden bg-white border border-stone-100 rounded-2xl shrink-0">
            <img 
              referrerPolicy="no-referrer"
              src={DEFAULT_GLOBAL_LOGO} 
              onError={(e) => { 
                  if (e.currentTarget.src.includes(DEFAULT_GLOBAL_LOGO)) {
                     e.currentTarget.onerror = null;
                  } else {
                     e.currentTarget.src = DEFAULT_GLOBAL_LOGO; 
                  }
              }}
              alt="Logo" 
              className="max-w-full max-h-full object-contain" 
            />
          </div>
          <div>
            <h2 className="font-extrabold text-xl tracking-tight leading-none text-brand">فخامة</h2>
            <p className="text-[10px] text-stone-400 font-bold tracking-widest uppercase mt-1">نظام الإدارة</p>
          </div>
        </div>

        <nav className="flex-grow space-y-3">
          <NavItem 
            active={activeTab === "dashboard"} 
            onClick={() => setActiveTab("dashboard")}
            icon={<LayoutDashboard className="w-5 h-5" />}
            label="لوحة القيادة"
          />
          <NavItem 
            active={activeTab === "orders"} 
            onClick={() => setActiveTab("orders")}
            icon={<ShoppingCart className="w-5 h-5" />}
            label="قائمة الفواتير"
            badge={totalOrdersCount > 0 ? totalOrdersCount : undefined}
          />
          <NavItem 
            active={activeTab === "invoices"} 
            onClick={() => setActiveTab("invoices")}
            icon={<FileText className="w-5 h-5" />}
            label="أرشيف المبيعات"
          />
          <NavItem 
            active={activeTab === "customers"} 
            onClick={() => setActiveTab("customers")}
            icon={<Users className="w-5 h-5" />}
            label="العملاء"
          />
          <NavItem 
            active={activeTab === "zones"} 
            onClick={() => setActiveTab("zones")}
            icon={<MapPin className="w-5 h-5" />}
            label="إدارة المناطق"
          />
          <NavItem 
            active={activeTab === "settings"} 
            onClick={() => setActiveTab("settings")}
            icon={<SettingsIcon className="w-5 h-5" />}
            label="إعدادات المتجر"
          />
        </nav>

        <div className="pt-8 border-t border-stone-50 space-y-6">
          <div className="p-5 bg-stone-50/50 border border-stone-100 rounded-[24px]">
            <p className="text-[9px] text-stone-400 font-extrabold uppercase tracking-[0.2em] mb-3">حالة النظام</p>
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
              <p className="text-xs text-brand font-bold tracking-tight">متصل وآمن</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-grow overflow-y-auto flex flex-col no-scrollbar bg-[#fafaf9]">
        {/* Topbar */}
        <header className="bg-white/80 backdrop-blur-xl border-b border-stone-100 p-8 flex justify-between items-center sticky top-0 z-40 shadow-sm">
          <div className="flex items-center gap-4 bg-stone-50 px-6 py-4 rounded-[20px] w-[400px] border border-stone-100 focus-within:border-accent/40 focus-within:bg-white transition-all group">
            <Search className="w-4 h-4 text-stone-300 group-focus-within:text-accent" />
            <input 
              type="text" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="البحث برقم الهاتف، العميل أو الفاتورة..." 
              className="bg-transparent border-none outline-none text-sm w-full text-brand placeholder:text-stone-300 font-medium font-sans" 
            />
          </div>
          <div className="flex items-center gap-8">
            <button className="relative p-4 bg-white border border-stone-100 rounded-2xl hover:bg-stone-50 transition-all shadow-sm active:scale-95 group">
              <Bell className="w-6 h-6 text-stone-400 group-hover:text-brand" />
              {totalOrdersCount > 0 && <span className="absolute top-4 right-4 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white shadow-md" />}
            </button>
            <div className="w-px h-10 bg-stone-100" />
            <div className="flex items-center gap-5 group cursor-pointer">
              <div className="text-right">
                <p className="text-sm font-extrabold text-brand">د. أحمد الفيلكاوي</p>
                <p className="text-[10px] text-accent font-extrabold tracking-[0.2em] uppercase mt-1">مدير النظام</p>
              </div>
              <div className="w-14 h-14 bg-white rounded-2xl border-2 border-stone-100 p-1.5 shadow-sm group-hover:border-accent/30 transition-all">
                <div className="w-full h-full rounded-xl gold-gradient shadow-inner" />
              </div>
            </div>
          </div>
        </header>

        <div className="p-12 space-y-12">
          {activeTab === "dashboard" && (
            <div className="space-y-12 animate-in fade-in duration-700">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-5xl font-extrabold text-brand leading-none">الإحصائيات المتقدمة</h1>
                  <p className="text-stone-400 text-sm mt-4 font-medium uppercase tracking-[0.3em]">تحليل العمليات الفورية</p>
                </div>
                <div className="px-6 py-3 bg-white border border-stone-100 rounded-[20px] text-xs font-extrabold text-stone-500 shadow-sm">
                  {format(new Date(), "EEEE, do MMMM", { locale: enUS })}
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-10">
                <StatCard 
                  title="الدخل التراكمي" 
                  value={`${analytics?.totalRevenue || 0} د.ك`} 
                  trend="+24.8%" 
                  icon={<TrendingUp className="w-8 h-8 text-accent" />}
                  color="accent"
                />
                <StatCard 
                  title="فواتير جديدة" 
                  value={totalOrdersCount.toString()} 
                  trend={totalOrdersCount > 0 ? "متفاعل حالياً" : "لا يوجد جديد"} 
                  icon={<ShoppingCart className="w-8 h-8 text-red-500" />}
                  isNew={totalOrdersCount > 0}
                  color="red"
                />
                <StatCard 
                  title="فواتير مدفوعة" 
                  value={analytics?.completedCount.toString() || "0"} 
                  trend="أداء مثالي" 
                  icon={<CheckCircle2 className="w-8 h-8 text-green-500" />}
                  color="green"
                />
              </div>

              <div className="bg-white rounded-[48px] border border-stone-100 shadow-xl overflow-hidden pb-6">
                <div className="p-10 border-b border-stone-50 flex justify-between items-center bg-stone-50/20">
                  <h3 className="text-xl font-extrabold flex items-center gap-5 text-brand">
                    <div className="p-3 bg-accent/10 rounded-2xl">
                      <FileText className="w-6 h-6 text-accent" />
                    </div>
                    أحدث التدفقات الواردة
                  </h3>
                  <MagneticButton onClick={() => setActiveTab("orders")} className="px-8 py-3 gold-gradient text-white rounded-2xl text-xs font-extrabold uppercase shadow-md shadow-accent/20 active:scale-95 transition-all">مراجعة الكل</MagneticButton>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-right text-[10px] text-stone-400 font-extrabold uppercase tracking-[0.3em] border-b border-stone-50">
                        <th className="p-10">ID</th>
                        <th className="p-10">العميل</th>
                        <th className="p-10">المنطقة</th>
                        <th className="p-10">المبلغ</th>
                        <th className="p-10">الحالة</th>
                        <th className="p-10 text-center">المعاينة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-50">
                      {filteredOrders.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-20 text-center text-stone-400 font-medium italic">
                            لم يتم العثور على أي طلبات تطابق بحثك...
                          </td>
                        </tr>
                      ) : (
                        filteredOrders.slice(0, 5).map(order => (
                          <tr key={order.id} className="group hover:bg-stone-50/50 transition-all duration-500">
                            <td className="p-10 font-mono text-[10px] text-stone-300 group-hover:text-brand">#{order.id.toUpperCase()}</td>
                            <td className="p-10">
                              <p className="font-extrabold text-brand text-lg">
                                {order.customerName}
                                {getCustomerPoints(order.customerPhone) > 0 && (
                                  <span className="inline-block mr-3 px-2.5 py-0.5 bg-accent/10 text-accent text-xs font-bold rounded-lg border border-accent/20 align-middle shadow-sm">⭐ {getCustomerPoints(order.customerPhone)} نقطة</span>
                                )}
                              </p>
                              <p className="text-xs text-stone-400 mt-1 font-medium italic">{order.customerPhone}</p>
                            </td>
                            <td className="p-10 text-brand font-bold text-sm">
                              {order.address?.region || "—"}
                            </td>
                            <td className="p-10 text-2xl font-light text-brand italic">{getDisplayTotal(order).toFixed(3)} <span className="text-xs text-accent">د.ك</span></td>
                            <td className="p-10">
                                <span className={`px-4 py-1.5 rounded-xl text-[9px] font-extrabold uppercase tracking-widest inline-block border ${
                                  order.status === "جديد" || order.status === "بانتظار الدفع" ? "bg-amber-50 text-amber-600 border-amber-100" :
                                  order.status === "قيد تجميع القطية" ? "bg-purple-50 text-purple-600 border-purple-100" :
                                  order.status?.startsWith("تم الدفع") ? "bg-green-50 text-green-600 border-green-100" :
                                  order.status === "فشل في عملية الدفع" || order.status?.includes("ملغي") ? "bg-red-50 text-red-500 border-red-100" :
                                  "bg-stone-50 text-stone-600 border-stone-100"
                                }`}>
                                {order.status}
                              </span>
                            </td>
                            <td className="p-10 text-center">
                              <button onClick={() => setSelectedOrder(order)} className="p-4 bg-stone-50 border border-stone-100 rounded-2xl text-stone-400 hover:bg-brand hover:text-white transition-all shadow-sm active:scale-95">
                                <ExternalLink className="w-5 h-5" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === "orders" && (
            <div className="animate-in slide-in-from-right-6 duration-700 space-y-12">
               <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-5xl font-extrabold text-brand leading-none">قائمة الفواتير</h1>
                  <p className="text-stone-400 text-sm mt-4 font-medium uppercase tracking-[0.3em]">إدارة الطلبات الحالية والجديدة</p>
                </div>
                <div className="relative">
                  <button 
                    onClick={() => setShowOrderFilters(!showOrderFilters)}
                    className={`flex items-center gap-3 px-8 py-4 bg-white border rounded-2xl text-[10px] font-extrabold uppercase transition-all shadow-sm ${selectedRegionFilter ? "text-accent border-accent/20" : "text-stone-400 border-stone-100 hover:text-brand"}`}
                  >
                    <Filter className="w-4 h-4" /> {selectedRegionFilter || "تصفية حسب المنطقة"}
                  </button>
                  
                  <AnimatePresence>
                    {showOrderFilters && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="absolute left-0 top-full mt-2 w-64 bg-white border border-stone-100 rounded-2xl shadow-xl z-[60] overflow-hidden"
                      >
                        <div className="p-4 border-b border-stone-50 bg-stone-50/50 text-[10px] font-extrabold text-stone-400 uppercase tracking-widest">اختر المنطقة</div>
                        <div className="max-h-64 overflow-y-auto no-scrollbar">
                          <button 
                            onClick={() => { setSelectedRegionFilter(""); setShowOrderFilters(false); }}
                            className={`w-full text-right p-4 text-xs font-bold hover:bg-stone-50 transition-colors ${!selectedRegionFilter ? "text-accent bg-accent/5" : "text-brand"}`}
                          >
                            عرض الكل
                          </button>
                          {zones.map(z => (
                            <button 
                              key={z.id}
                              onClick={() => { setSelectedRegionFilter(z.name); setShowOrderFilters(false); }}
                              className={`w-full text-right p-4 text-xs font-bold hover:bg-stone-50 transition-colors border-t border-stone-50 ${selectedRegionFilter === z.name ? "text-accent bg-accent/5" : "text-brand"}`}
                            >
                              {z.name}
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-10">
                {filteredNewOrders.length === 0 ? (
                  <div className="col-span-full p-20 bg-white rounded-[48px] border border-stone-100 text-center">
                    <div className="w-20 h-20 bg-stone-50 rounded-full flex items-center justify-center mx-auto mb-6">
                      <ShoppingCart className="w-10 h-10 text-stone-200" />
                    </div>
                    <h3 className="text-2xl font-extrabold text-brand mb-2">لا توجد طلبات جديدة</h3>
                    <p className="text-stone-400 font-medium">كل شيء تحت السيطرة حالياً</p>
                  </div>
                ) : (
                  filteredNewOrders.map(order => (
                    <motion.div 
                      layoutId={order.id}
                      key={order.id} 
                      className="bg-white p-10 rounded-[48px] border border-stone-100 shadow-sm hover:shadow-xl hover:-translate-y-2 transition-all cursor-pointer group relative overflow-hidden"
                      onClick={() => setSelectedOrder(order)}
                    >
                    {order.source === "customer_website" && (
                      <div className="absolute top-6 left-6 flex items-center gap-2">
                        <span className="w-2 h-2 bg-accent rounded-full animate-pulse shadow-md shadow-accent/50" />
                        <span className="text-[8px] font-extrabold uppercase text-accent tracking-widest bg-accent/5 px-2 py-1 rounded-lg">طلب من الموقع</span>
                      </div>
                    )}
                    
                    <div className="absolute top-6 right-6">
                       <span className={`px-3 py-1.5 rounded-lg text-[9px] font-extrabold uppercase tracking-widest border shadow-sm ${
                         order.status === "جديد" || order.status === "بانتظار الدفع" ? "bg-amber-50 text-amber-600 border-amber-100" :
                         order.status === "قيد تجميع القطية" ? "bg-purple-50 text-purple-600 border-purple-100" :
                         order.status?.startsWith("تم الدفع") ? "bg-green-50 text-green-600 border-green-100" :
                         order.status === "فشل في عملية الدفع" || order.status?.includes("ملغي") ? "bg-red-50 text-red-500 border-red-100" :
                         "bg-stone-50 text-stone-600 border-stone-100"
                       }`}>
                          {order.status}
                       </span>
                    </div>
                    
                    <div className="mb-10 mt-6 text-right">
                      <p className="text-[10px] text-stone-300 font-bold uppercase tracking-[0.2em] mb-3">Invoice #{order.id}</p>
                      <h4 className="text-3xl font-extrabold text-brand group-hover:text-accent transition-colors leading-none block">
                        {order.customerName}
                        {getCustomerPoints(order.customerPhone) > 0 && (
                           <span className="inline-block mr-3 px-3 py-1 bg-accent/10 text-accent text-sm font-bold rounded-xl border border-accent/20 align-middle shadow-sm">⭐ {getCustomerPoints(order.customerPhone)} نقطة</span>
                        )}
                      </h4>
                      <p className="text-sm text-stone-400 mt-3 font-medium italic" dir="ltr">{order.customerPhone}</p>
                      <div className="mt-4 flex items-center justify-end gap-3 text-stone-400 text-sm">
                         <span className="font-bold">{order.address?.region || "—"}</span>
                         <span className="w-1 h-1 bg-stone-200 rounded-full" />
                         <span>{format(new Date(order.createdAt || order.date || Date.now()), "HH:mm")}</span>
                      </div>
                    </div>

                    <div className="space-y-4 mb-10 border-t border-b border-stone-50 py-8">
                      {(order.items || []).map((item: any, idx: number) => (
                        <div key={idx} className="flex flex-col gap-1">
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-bold text-brand">{item.name || item.productName} <span className="text-stone-300 mx-1">×</span> {item.quantity || 1}</span>
                            <span className="text-stone-400 italic">{((item.price || 0) * (item.quantity || 1)).toFixed(2)} د.ك</span>
                          </div>
                          {item.preparationInstructions && (
                            <div className="text-[9px] text-red-500 font-bold text-right flex items-center justify-end gap-1">
                               <span>{item.preparationInstructions}</span> <AlertTriangle className="w-3 h-3" />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="flex justify-between items-center pt-2">
                       <div className="text-3xl font-extrabold text-brand italic">{getDisplayTotal(order).toFixed(3)} <span className="text-sm text-accent not-italic">د.ك</span></div>
                       <button 
                        onClick={(e) => { e.stopPropagation(); contactCustomer(order); }}
                        className="w-14 h-14 bg-green-50 text-green-500 rounded-2xl flex items-center justify-center hover:bg-green-500 hover:text-white transition-all shadow-sm"
                       >
                        <MessageCircle className="w-6 h-6" />
                       </button>
                    </div>
                  </motion.div>
                )))}
              </div>
            </div>
          )}

          {activeTab === "invoices" && (
            <div className="space-y-12 animate-in slide-in-from-top-6 duration-700">
               <div className="flex items-center justify-between">
                 <div>
                  <h1 className="text-5xl font-extrabold text-brand leading-none">أرشيف المبيعات</h1>
                  <p className="text-stone-400 text-sm mt-4 font-medium uppercase tracking-[0.3em]">السجل المالي الكامل للمتجر</p>
                </div>
                <MagneticButton className="flex items-center gap-4 px-10 py-5 gold-gradient text-white rounded-[24px] text-xs font-extrabold shadow-xl shadow-accent/20 active:scale-95 uppercase tracking-widest">
                  <CreditCard className="w-5 h-5" /> تصدير السجل الضريبي
                </MagneticButton>
              </div>

              <div className="bg-white rounded-[48px] border border-stone-100 shadow-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-right text-[10px] text-stone-400 font-extrabold uppercase tracking-[0.3em] border-b border-stone-50 bg-stone-50/30">
                        <th className="p-10">المرجع المالي</th>
                        <th className="p-10">العميل</th>
                        <th className="p-10">التاريخ</th>
                        <th className="p-10">المبلغ</th>
                        <th className="p-10">الحالة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-50">
                      {filteredInvoices.map(invoice => (
                        <tr key={invoice.invoiceId} className="hover:bg-stone-50/30 transition-all duration-300">
                          <td className="p-10 font-mono text-[10px] text-accent font-extrabold tracking-widest flex items-center gap-2">
                             {invoice.invoiceId}
                             <button
                               onClick={(e) => {
                                  e.stopPropagation();
                                  const url = `${window.location.origin}/track?order_id=${invoice.invoiceId}`;
                                  window.open(`https://wa.me/?text=${encodeURIComponent(`رابط متابعة طلباتك:\n${url}`)}`, '_blank');
                               }}
                               className="p-2 rounded-xl bg-stone-50 hover:bg-[#25D366] hover:text-white transition-colors text-stone-400 inline-flex"
                               title="مشاركة رابط التتبع عبر الواتساب"
                             >
                                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.878-.788-1.46-1.761-1.633-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
                                </svg>
                             </button>
                          </td>
                          <td className="p-10">
                            <p className="font-extrabold text-brand text-lg">
                              {invoice.customerName}
                              {getCustomerPoints(invoice.customerPhone) > 0 && (
                                <span className="inline-block mr-3 px-2.5 py-0.5 bg-accent/10 text-accent text-xs font-bold rounded-lg border border-accent/20 align-middle shadow-sm">⭐ {getCustomerPoints(invoice.customerPhone)} نقطة</span>
                              )}
                            </p>
                            <p className="text-xs text-stone-400 mt-1 font-medium">{invoice.customerPhone}</p>
                          </td>
                          <td className="p-10 text-sm text-stone-500 font-bold">
                            {format(new Date(invoice.completedAt || invoice.createdAt || invoice.date || 0), "PPP", { locale: enUS })}
                          </td>
                          <td className="p-10 text-2xl font-light text-brand italic">{getDisplayTotal(invoice).toFixed(3)} <span className="text-xs text-accent">د.ك</span></td>
                          <td className="p-10">
                            <div className="flex items-center gap-3 text-green-600 font-extrabold text-[10px] uppercase tracking-widest">
                              <div className="w-4 h-4 rounded-full bg-green-50 flex items-center justify-center">
                                <CheckCircle2 className="w-3 h-3" />
                              </div>
                              تمت التسوية
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === "settings" && (
            <div className="space-y-8 animate-in slide-in-from-bottom-6 duration-700">
               <div>
                  <h1 className="text-4xl font-extrabold text-brand leading-none">إعدادات المتجر</h1>
                  <p className="text-stone-400 text-sm mt-3 font-medium uppercase tracking-[0.3em]">التحكم بحالة المتجر وأوقات العمل</p>
               </div>
               
               <div className="bg-white rounded-[40px] border border-stone-100 shadow-sm p-10 space-y-8">
                  <div className="flex items-center justify-between p-6 bg-stone-50 rounded-[32px] border border-stone-100">
                    <div>
                      <h3 className="text-lg font-extrabold text-brand mb-1">إغلاق المتجر يدوياً</h3>
                      <p className="text-stone-400 text-xs font-medium">تفعيل هذا الخيار سيغلق المتجر فوراً.</p>
                    </div>
                    <button 
                      onClick={async () => {
                         const newValue = !settings.storeStatus?.manualClose;
                         try {
                           await fetch("/api/admin/settings/storeStatus", {
                             method: "PATCH",
                             headers: { "Content-Type": "application/json" },
                             body: JSON.stringify({...settings.storeStatus, manualClose: newValue})
                           });
                           setSettings({...settings, storeStatus: {...settings.storeStatus, manualClose: newValue}});
                         } catch (e) {
                           console.error(e);
                         }
                      }}
                      className={`w-16 h-8 rounded-full relative transition-all duration-500 ${settings?.storeStatus?.manualClose ? 'bg-red-500' : 'bg-stone-200'}`}
                    >
                      <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all duration-500 shadow-md ${settings?.storeStatus?.manualClose ? 'right-9' : 'right-1'}`} />
                    </button>
                  </div>
                  
                  <div className="space-y-3">
                    <label className="text-[10px] font-extrabold text-stone-400 uppercase tracking-widest px-2">رسالة الإغلاق</label>
                    <textarea 
                        value={settings.storeStatus?.closeMessage || "عذراً، المتجر مغلق حالياً."}
                        onBlur={async (e) => {
                          try {
                           await fetch("/api/admin/settings/storeStatus", {
                             method: "PATCH",
                             headers: { "Content-Type": "application/json" },
                             body: JSON.stringify({...settings.storeStatus, closeMessage: e.target.value})
                           });
                          } catch (e) {
                           console.error(e);
                          }
                        }}
                        onChange={(e) => {
                          const newStatus = {...settings.storeStatus, closeMessage: e.target.value};
                          setSettings({...settings, storeStatus: newStatus});
                        }}
                        className="w-full p-6 bg-stone-50 border border-stone-100 rounded-2xl font-extrabold text-brand"
                    />
                  </div>
               </div>
            </div>
          )}

          {activeTab === "customers" && (
            <div className="space-y-12 animate-in slide-in-from-bottom-6 duration-700">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-5xl font-extrabold text-brand leading-none">قائمة العملاء</h1>
                  <p className="text-stone-400 mt-4 font-bold text-lg">إدارة وتتبع عملائك ونقاطهم</p>
                </div>
                <div className="bg-brand/5 text-brand px-6 py-3 rounded-2xl font-extrabold">
                  إجمالي العملاء: {customers.length}
                </div>
              </div>

              <div className="bg-white rounded-[48px] border border-stone-100 shadow-xl overflow-hidden">
                <div className="p-8 border-b border-stone-50 bg-stone-50/30 flex justify-between items-center">
                  <h2 className="text-xl font-extrabold text-brand">بيانات العملاء</h2>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-right text-[10px] text-stone-400 font-extrabold uppercase tracking-[0.3em] border-b border-stone-50 bg-stone-50/30">
                        <th className="p-8">رقم الهاتف</th>
                        <th className="p-8">الاسم</th>
                        <th className="p-8 text-center">النقاط (د.ك المدفوعة)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-50">
                      {customers.filter(c => !searchTerm || c.phone?.includes(searchTerm) || c.name?.includes(searchTerm)).map((customer, idx) => (
                        <tr key={customer.id || idx} className="hover:bg-stone-50/50 transition-all">
                          <td className="p-8">
                            <span className="font-bold text-brand bg-stone-50 px-4 py-2 rounded-xl text-sm font-mono tracking-wider">{customer.phone}</span>
                          </td>
                          <td className="p-8">
                            <span className="font-bold text-stone-600">
                                {customer.name || customer.customerName || "غير محدد"}
                            </span>
                          </td>
                          <td className="p-8 text-center">
                            <div className="inline-flex items-center gap-2 bg-green-50 px-4 py-2 rounded-xl">
                                <span className="font-extrabold text-green-600 text-lg">{customer.totalSpent || 0}</span>
                                <span className="text-[10px] text-green-500 font-bold uppercase tracking-widest">نقطة</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {customers.length === 0 && (
                        <tr>
                          <td colSpan={3} className="p-16 text-center text-stone-300">
                            لا يوجد عملاء مسجلين
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === "zones" && (
            <div className="space-y-12 animate-in slide-in-from-bottom-6 duration-700">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-5xl font-extrabold text-brand leading-none">إدارة المناطق والتوصيل</h1>
                  <p className="text-stone-400 text-sm mt-4 font-medium uppercase tracking-[0.3em]">تعديل مسميات وأسعار التوصيل والإعدادات العامة</p>
                </div>
                <button 
                  onClick={() => setShowAddZone(true)}
                  className="flex items-center gap-3 px-8 py-4 gold-gradient text-white rounded-2xl text-xs font-extrabold uppercase shadow-md shadow-accent/20 active:scale-95 transition-all"
                >
                  <MapPin className="w-4 h-4" /> إضافة منطقة جديدة
                </button>
              </div>

              <AnimatePresence>
                {showAddZone && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden bg-white rounded-[40px] border-2 border-accent/20 shadow-xl p-10 space-y-8"
                  >
                    <div className="flex items-center justify-between">
                       <h3 className="text-2xl font-extrabold text-brand">إضافة منطقة توصيل جديدة</h3>
                       <button onClick={() => setShowAddZone(false)} className="p-2 text-stone-300 hover:text-red-500 transition-colors"><X className="w-6 h-6" /></button>
                    </div>
                    <div className="grid grid-cols-2 gap-8">
                       <div className="space-y-3">
                          <label className="text-[10px] font-extrabold text-stone-400 uppercase tracking-widest px-2">اسم المنطقة</label>
                          <input 
                            type="text"
                            placeholder="مثال: حولي، جابر الأحمد..."
                            value={newZoneName}
                            onChange={(e) => setNewZoneName(e.target.value)}
                            className="w-full p-4 bg-stone-50 border border-stone-100 rounded-2xl font-bold text-brand focus:border-accent outline-none"
                          />
                       </div>
                       <div className="space-y-3">
                          <label className="text-[10px] font-extrabold text-stone-400 uppercase tracking-widest px-2">سعر التوصيل (د.ك)</label>
                          <input 
                            type="text"
                            inputMode="decimal"
                            placeholder="1.500"
                            value={newZonePrice}
                            onChange={(e) => setNewZonePrice(Number(normalizeDigits(e.target.value).replace(/[^0-9.]/g, '')))}
                            className="w-full p-4 bg-stone-50 border border-stone-100 rounded-2xl font-bold text-brand focus:border-accent outline-none"
                          />
                       </div>
                    </div>
                    <div className="flex justify-end gap-4 pt-4">
                       <button 
                        onClick={async () => {
                          if (!newZoneName) return alert("يرجى إدخال اسم المنطقة");
                          try {
                            const res = await fetch("/api/admin/zones", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ name: newZoneName, finalPrice: newZonePrice })
                            });
                            if (res.ok) {
                              setShowAddZone(false);
                              setNewZoneName("");
                              setNewZonePrice(0);
                            }
                          } catch (err) {
                            console.error(err);
                          }
                        }}
                        className="px-12 py-4 gold-gradient text-white rounded-2xl font-extrabold text-sm shadow-xl shadow-accent/20 active:scale-95 transition-all"
                       >
                         حفظ المنطقة
                       </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Global Settings Section */}
              <div className="bg-white rounded-[48px] border border-stone-100 shadow-xl p-10 space-y-8">
                <div className="flex items-center justify-between p-6 bg-stone-50 rounded-[32px] border border-stone-100 shadow-sm">
                  <div>
                    <h3 className="text-xl font-extrabold text-brand mb-1">توصيل مجاني لجميع المناطق</h3>
                    <p className="text-stone-400 text-xs font-medium">تفعيل هذا الخيار سيجعل رسوم التوصيل 0 لجميع الطلبات.</p>
                  </div>
                  <button 
                    onClick={async () => {
                       const newValue = !settings.isFreeDelivery;
                       try {
                         const docRef = doc(db, "appData", "shared_company_data");
                         await updateDoc(docRef, {
                            "settings.isFreeDelivery": newValue
                         });
                       } catch (e) {
                         console.error(e);
                       }
                    }}
                    className={`w-16 h-8 rounded-full relative transition-all duration-500 ${settings.isFreeDelivery ? 'bg-green-500' : 'bg-stone-200'}`}
                  >
                    <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all duration-500 shadow-md ${settings.isFreeDelivery ? 'right-9' : 'right-1'}`} />
                  </button>
                </div>

                <div className="flex items-center justify-between p-6 bg-stone-50 rounded-[32px] border border-stone-100 shadow-sm">
                   <div>
                    <h3 className="text-xl font-extrabold text-brand mb-1">الحد الأدنى للتوصيل المجاني</h3>
                    <p className="text-stone-400 text-xs font-medium">سيتم إلغاء رسوم التوصيل إذا تجاوز إجمالي الطلب هذا المبلغ.</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <input 
                      type="text"
                      inputMode="decimal"
                      className="w-24 p-3 bg-white border border-stone-100 rounded-2xl text-center font-extrabold text-brand text-sm"
                      value={settings.freeDeliveryThreshold || 0}
                      onChange={async (e) => {
                         const val = Number(normalizeDigits(e.target.value).replace(/[^0-9.]/g, ''));
                         try {
                           const docRef = doc(db, "appData", "shared_company_data");
                           await updateDoc(docRef, {
                              "settings.freeDeliveryThreshold": val
                           });
                         } catch (err) {
                           console.error(err);
                         }
                      }}
                    />
                    <span className="text-[10px] font-extrabold text-stone-400 uppercase tracking-widest">د.ك</span>
                  </div>
                </div>

                <div className="flex items-center justify-between p-8 bg-accent/5 rounded-[40px] border-2 border-accent/10 shadow-inner group transition-all hover:border-accent/30">
                   <div className="flex items-center gap-6">
                    <div className="p-4 bg-accent/10 rounded-2xl group-hover:scale-110 transition-transform">
                      <MessageCircle className="w-8 h-8 text-accent" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-extrabold text-brand mb-1">رقم استقبال طلبات الواتساب</h3>
                      <p className="text-stone-400 text-xs font-medium">أدخل الرقم المكون من 8 أرقام (مثال: 92225308). سيقوم النظام بإضافة المفتاح الدولي تلقائياً.</p>
                      {(!settings.companyPhone && settings.restaurantNumbers?.[0]) && (
                        <p className="text-accent text-[10px] font-bold mt-2 flex items-center gap-2">
                          <span className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse" />
                          يتم حالياً استخدام الرقم الاحتياطي: {settings.restaurantNumbers[0]}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-300 font-bold text-xs">965+</span>
                      <input 
                        type="text"
                        className="w-56 pl-14 p-4 bg-white border-2 border-stone-100 rounded-2xl text-center font-extrabold text-brand text-lg focus:border-accent focus:ring-4 focus:ring-accent/5 outline-none transition-all"
                        value={settings.companyPhone || ""}
                        placeholder="XXXXXXXX"
                        maxLength={8}
                        onChange={async (e) => {
                           const val = normalizeDigits(e.target.value).replace(/\D/g, "").slice(0, 8);
                           try {
                             const docRef = doc(db, "appData", "shared_company_data");
                             await updateDoc(docRef, {
                                "settings.companyPhone": val
                             });
                           } catch (err) {
                             console.error(err);
                           }
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-[48px] border border-stone-100 shadow-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-right text-[10px] text-stone-400 font-extrabold uppercase tracking-[0.3em] border-b border-stone-50 bg-stone-50/30">
                        <th className="p-10">المنطقة</th>
                        <th className="p-10">سعر التوصيل</th>
                        <th className="p-10">الحالة</th>
                        <th className="p-10 text-center">الإجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-50">
                      {zones.map(zone => (
                        <tr key={zone.id} className="hover:bg-stone-50/30 transition-all duration-300">
                          <td className="p-10">
                            {editingZoneId === zone.id ? (
                              <input 
                                type="text"
                                value={editZoneName}
                                onChange={(e) => setEditZoneName(e.target.value)}
                                className="p-3 bg-white border border-accent rounded-xl text-brand font-extrabold w-full"
                              />
                            ) : (
                              <p className="font-extrabold text-brand text-lg">{zone.name}</p>
                            )}
                          </td>
                          <td className="p-10 text-xl font-light text-brand italic">
                            {editingZoneId === zone.id ? (
                                <input 
                                    type="text"
                                    inputMode="decimal"
                                    value={editZonePrice}
                                    onChange={(e) => setEditZonePrice(Number(normalizeDigits(e.target.value).replace(/[^0-9.]/g, '')))}
                                    className="p-3 bg-white border border-accent rounded-xl text-brand font-extrabold w-24"
                                />
                            ) : (
                                <>
                                    {(zone.finalPrice ?? zone.deliveryPrice ?? zone.cost ?? zone.deliveryFee ?? zone.price ?? 0)} <span className="text-xs text-accent">د.ك</span>
                                </>
                            )}
                          </td>
                          <td className="p-10">
                            <span className="px-4 py-1.5 rounded-xl text-[9px] font-extrabold uppercase tracking-widest inline-block border bg-green-50 text-green-600 border-green-100">
                              نشط
                            </span>
                          </td>
                          <td className="p-10 text-center">
                            {editingZoneId === zone.id ? (
                              <div className="flex items-center justify-center gap-2">
                                <button 
                                  onClick={async () => {
                                    try {
                                      const res = await fetch(`/api/admin/zones/${zone.id}`, {
                                        method: "PATCH",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({ 
                                            name: editZoneName,
                                            finalPrice: editZonePrice
                                        })
                                      });
                                      if (res.ok) {
                                        setZones(zones.map(z => z.id === zone.id ? { ...z, name: editZoneName, finalPrice: editZonePrice, cost: editZonePrice } : z));
                                        setEditingZoneId(null);
                                      }
                                    } catch (err) {
                                      console.error(err);
                                    }
                                  }}
                                  className="p-3 bg-green-500 text-white rounded-xl shadow-md shadow-green-500/20 active:scale-95"
                                >
                                  <Save className="w-5 h-5" />
                                </button>
                                <button 
                                  onClick={() => setEditingZoneId(null)}
                                  className="p-3 bg-stone-100 text-stone-400 rounded-xl active:scale-95"
                                >
                                  <X className="w-5 h-5" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-center gap-2">
                                <button 
                                  onClick={() => {
                                    setEditingZoneId(zone.id);
                                    setEditZoneName(zone.name);
                                    setEditZonePrice(zone.finalPrice ?? zone.deliveryPrice ?? zone.cost ?? zone.deliveryFee ?? zone.price ?? 0);
                                  }}
                                  className="p-4 bg-stone-50 border border-stone-100 rounded-2xl text-stone-400 hover:bg-brand hover:text-white transition-all shadow-sm active:scale-95"
                                >
                                  <Edit2 className="w-5 h-5" />
                                </button>
                                <button 
                                  onClick={async () => {
                                    if (!confirm("هل أنت متأكد من حذف هذه المنطقة؟")) return;
                                    try {
                                      const res = await fetch(`/api/admin/zones/${zone.id}`, { method: "DELETE" });
                                      if (!res.ok) throw new Error("Failed to delete");
                                    } catch (err) {
                                      console.error(err);
                                      alert("فشل الحذف");
                                    }
                                  }}
                                  className="p-4 bg-red-50 border border-red-100 rounded-2xl text-red-400 hover:bg-red-500 hover:text-white transition-all shadow-sm active:scale-95"
                                >
                                  <X className="w-5 h-5" />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Promo Codes Management */}
              <div className="bg-white rounded-[48px] border border-stone-100 shadow-xl overflow-hidden mt-8">
                <div className="p-10 border-b border-stone-50 bg-stone-50/10">
                  <h3 className="text-xl font-extrabold text-brand">إدارة كوبونات الخصم</h3>
                  <p className="text-stone-400 text-xs mt-1">أضف وتحكم في رموز الخصم للعملاء</p>
                </div>
                
                <div className="p-10 border-b border-stone-50 bg-white">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-extrabold text-stone-400 uppercase tracking-widest px-1">كود الخصم</label>
                      <input 
                        type="text"
                        placeholder="SUMMER20"
                        className="w-full p-4 bg-stone-50 border border-stone-100 rounded-2xl text-brand font-extrabold"
                        value={newPromoCode}
                        onChange={e => setNewPromoCode(normalizeDigits(e.target.value).toUpperCase())}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-extrabold text-stone-400 uppercase tracking-widest px-1">النوع</label>
                      <select 
                        className="w-full p-4 bg-stone-50 border border-stone-100 rounded-2xl text-brand font-extrabold appearance-none"
                        value={newPromoType}
                        onChange={e => setNewPromoType(e.target.value as any)}
                      >
                        <option value="percentage">نسبة مئوية (%)</option>
                        <option value="flat">مبلغ ثابت (د.ك)</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-extrabold text-stone-400 uppercase tracking-widest px-1">القيمة</label>
                      <input 
                        type="text"
                        inputMode="decimal"
                        placeholder="0.000"
                        className="w-full p-4 bg-stone-50 border border-stone-100 rounded-2xl text-brand font-extrabold"
                        value={newPromoValue}
                        onChange={e => setNewPromoValue(Number(normalizeDigits(e.target.value).replace(/[^0-9.]/g, '')))}
                      />
                    </div>
                    <button 
                      onClick={async () => {
                        if (!newPromoCode || newPromoValue <= 0) return;
                        setIsAddingPromo(true);
                        try {
                          const res = await fetch("/api/admin/promocodes", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              code: newPromoCode,
                              type: newPromoType,
                              value: newPromoValue,
                              isActive: true
                            })
                          });
                          if (res.ok) {
                            setNewPromoCode("");
                            setNewPromoValue(0);
                          }
                        } finally {
                          setIsAddingPromo(false);
                        }
                      }}
                      disabled={isAddingPromo || !newPromoCode || newPromoValue <= 0}
                      className="p-4 bg-brand text-white rounded-2xl font-extrabold text-xs uppercase tracking-widest shadow-md shadow-brand/20 active:scale-95 disabled:opacity-50"
                    >
                      {isAddingPromo ? "جاري الإضافة..." : "إضافة كوبون"}
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-right text-[10px] text-stone-400 font-extrabold uppercase tracking-[0.3em] border-b border-stone-50 bg-stone-50/30">
                        <th className="p-8">الكود</th>
                        <th className="p-8">النوع</th>
                        <th className="p-8">القيمة</th>
                        <th className="p-8 text-center">الإجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-50">
                      {promocodes.map((promo: any) => (
                        <tr key={promo.code} className="hover:bg-stone-50/50 transition-all">
                          <td className="p-8">
                            <span className="font-extrabold text-brand">{promo.code}</span>
                          </td>
                          <td className="p-8">
                            <span className="text-xs font-bold text-stone-500">
                              {promo.type === 'percentage' ? "نسبة مئوية" : "مبلغ ثابت"}
                            </span>
                          </td>
                          <td className="p-8">
                            <span className="font-extrabold text-brand">
                              {promo.type === 'percentage' ? `${promo.value}%` : `${promo.value.toFixed(3)} د.ك`}
                            </span>
                          </td>
                          <td className="p-8 text-center">
                            <button 
                              onClick={async () => {
                                if (!confirm("هل أنت متأكد من حذف هذا الكوبون؟")) return;
                                await fetch(`/api/admin/promocodes/${promo.code}`, { method: "DELETE" });
                              }}
                              className="p-3 bg-red-50 border border-red-100 rounded-xl text-red-400 hover:bg-red-500 hover:text-white transition-all active:scale-95"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {promocodes.length === 0 && (
                        <tr>
                          <td colSpan={4} className="p-10 text-center text-stone-300 italic text-sm">
                            لا يوجد كوبونات فعالة حالياً
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      <AnimatePresence>
        {selectedOrder && (
          <OrderDetailModal 
            order={selectedOrder} 
            onClose={() => setSelectedOrder(null)} 
            onContact={() => contactCustomer(selectedOrder)}
            onPay={() => handleMarkAsPaid(selectedOrder.id)}
            onFreeDelivery={() => handleFreeDelivery(selectedOrder)}
            getCustomerPoints={getCustomerPoints}
          />
        )}
      </AnimatePresence>
      {/* Version Label */}
      <div className="text-center py-4 opacity-20 pointer-events-none select-none text-[7px] font-light text-stone-300">
        Version 2.5.0.Release
      </div>
    </div>
  );
}

function NavItem({ active, onClick, icon, label, badge }: any) {
  return (
    <button onClick={onClick} className={`w-full flex items-center justify-between p-5 rounded-2xl transition-all relative group overflow-hidden ${active ? "bg-brand text-white shadow-md shadow-brand/20 shadow-xl" : "text-stone-400 hover:text-brand hover:bg-stone-50"}`}>
      <div className="flex items-center gap-5 relative z-10">
        <span className={`${active ? "text-white" : "text-stone-300 group-hover:text-brand"}`}>{icon}</span>
        <span className="text-xs font-extrabold uppercase tracking-[0.2em]">{label}</span>
      </div>
      {badge && <span className="bg-red-500 text-white text-[10px] font-extrabold w-6 h-6 flex items-center justify-center rounded-lg shadow-md shadow-red-500/20 relative z-10 animate-bounce">{badge}</span>}
    </button>
  );
}

function StatCard({ title, value, trend, icon, isNew, color }: any) {
  return (
    <div className={`p-8 rounded-[40px] border bg-white shadow-sm transition-all relative overflow-hidden group hover:shadow-xl hover:-translate-y-1 duration-500 ${isNew ? "border-red-100 ring-4 ring-red-500/5 shadow-red-500/5" : "border-stone-100"}`}>
      <div className="absolute top-0 right-0 w-32 h-32 bg-stone-50 rounded-full translate-x-10 -translate-y-10 group-hover:bg-accent/5 transition-colors" />
      <div className="flex justify-between items-start mb-8 relative z-10">
        <div className={`p-5 bg-stone-50 rounded-3xl border border-stone-100 shadow-sm group-hover:rotate-6 transition-all ${isNew ? 'ring-2 ring-red-500/20 bg-red-50' : ''}`}>{icon}</div>
        <span className={`text-[10px] font-extrabold px-4 py-2 rounded-xl uppercase tracking-widest ${color === 'accent' ? "bg-accent/10 text-accent border border-accent/20" : color === 'red' ? "bg-red-50 text-red-500 border border-red-100" : "bg-green-50 text-green-600 border border-green-100"}`}>{trend}</span>
      </div>
      <p className="text-stone-400 text-[10px] font-extrabold uppercase tracking-[0.3em] mb-3 relative z-10">{title}</p>
      <h3 className="text-4xl font-extrabold text-brand italic relative z-10 tracking-tight leading-none">{value}</h3>
    </div>
  );
}

function OrderDetailModal({ order, onClose, onContact, onPay, onFreeDelivery, getCustomerPoints }: { order: Order, onClose: () => void, onContact: () => void, onPay: () => void, onFreeDelivery?: () => void, getCustomerPoints: (phone?: string) => number }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-brand/40 backdrop-blur-md p-8" onClick={onClose}>
      <motion.div initial={{ scale: 0.95, opacity: 0, y: 30 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 30 }} className="bg-white w-full max-w-4xl rounded-[48px] shadow-xl overflow-hidden flex flex-col border border-stone-100" onClick={e => e.stopPropagation()}>
        <div className="p-10 border-b border-stone-50 flex items-center justify-between bg-stone-50/30">
          <div className="flex items-center gap-6">
            <button onClick={onClose} className="p-4 bg-white border border-stone-100 rounded-2xl hover:bg-brand hover:text-white transition-all shadow-sm"><ChevronLeft className="w-6 h-6" /></button>
            <div>
              <p className="text-[10px] text-stone-400 font-bold uppercase tracking-[0.3em] mb-1">Invoice Details</p>
              <h3 className="font-extrabold text-2xl text-brand">تفاصيل الفاتورة #{order.id.toUpperCase()}</h3>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {order.source === "customer_website" && <span className="bg-accent/10 text-accent px-4 py-2 rounded-xl text-[10px] font-extrabold uppercase tracking-widest border border-accent/20 animate-pulse">جديد من الموقع</span>}
            <span className={`px-5 py-2 rounded-xl text-[10px] font-extrabold uppercase tracking-widest border ${
              order.status === "جديد" || order.status === "بانتظار الدفع" ? "bg-amber-50 text-amber-600 border-amber-100" :
              order.status === "قيد تجميع القطية" ? "bg-purple-50 text-purple-600 border-purple-100" :
              order.status?.startsWith("تم الدفع") ? "bg-green-50 text-green-600 border-green-100" :
              order.status === "فشل في عملية الدفع" || order.status?.includes("ملغي") ? "bg-red-50 text-red-500 border-red-100" :
              "bg-stone-50 text-stone-600 border-stone-100"
            }`}>{order.status}</span>
          </div>
        </div>
        <div className="p-12 flex-grow overflow-y-auto space-y-12 no-scrollbar">
          <section className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div className="space-y-8 text-right">
              <div>
                <label className="text-[10px] font-extrabold text-stone-400 uppercase tracking-[0.2em] block mb-3">بيانات العميل</label>
                <h4 className="text-3xl font-extrabold text-brand flex items-center justify-end flex-wrap gap-4">
                   {getCustomerPoints(order.customerPhone) > 0 && (
                     <span className="inline-block px-3 py-1 bg-accent/10 text-accent text-sm font-bold rounded-xl border border-accent/20 align-middle shadow-sm">⭐ {getCustomerPoints(order.customerPhone)} نقطة</span>
                   )}
                   {order.customerName}
                </h4>
                <p className="text-accent text-xl font-light italic mt-1">{order.customerPhone}</p>
              </div>
              <div className="p-8 bg-stone-50 rounded-[32px] border border-stone-100 space-y-5">
                <label className="text-[10px] font-extrabold text-stone-400 uppercase tracking-[0.2em] flex items-center gap-2 justify-end">📍 عنوان التوصيل</label>
                <div className="space-y-2 text-brand">
                  <div className="text-xl font-extrabold">{order.address.region} - قطعة {order.address.block}</div>
                  <div className="text-stone-500 font-bold">شارع {order.address.street} {order.address.avenue && ` - جادة ${order.address.avenue}`} - منزل {order.address.building}</div>
                  {(order.address.floor || order.address.apartment) && <div className="text-stone-500 font-bold">{order.address.floor && `الدور ${order.address.floor}`} {order.address.apartment && ` - شقة ${order.address.apartment}`}</div>}
                  {order.address.deliveryNotes && <div className="mt-6 p-5 bg-white rounded-2xl text-[11px] text-stone-400 italic border-r-4 border-accent font-medium leading-relaxed">📝 {order.address.deliveryNotes}</div>}
                </div>
              </div>
            </div>
            <div className="space-y-8">
              <div className="text-right"><label className="text-[10px] font-extrabold text-stone-400 uppercase tracking-[0.2em] block mb-3">التوقيت</label><h4 className="text-xl font-extrabold text-brand">{format(new Date(order.createdAt || order.date || Date.now()), "PPP p", { locale: enUS })}</h4><p className="text-stone-400 font-extrabold uppercase text-[10px] mt-2 tracking-widest italic">المصدر: {order.source === "customer_website" ? "الموقع الإلكتروني" : "نظام الإدارة"}</p></div>
              
              <div className="p-8 border-2 border-stone-100 rounded-[40px] space-y-6">
                 <div className="flex justify-between items-center text-xs font-bold text-stone-400 uppercase tracking-widest">
                   <div className="flex items-center gap-3">
                     {order.deliveryFee > 0 && !order.isFreeDelivery && (order as any).deliveryType !== 'free' && onFreeDelivery && (
                       <button onClick={onFreeDelivery} className="px-3 py-1 bg-brand text-white rounded-lg text-[10px] hover:bg-accent hover:-translate-y-0.5 transition-all outline-none">توصيل مجاني</button>
                     )}
                     <span className="italic">{(order as any).deliveryType === 'free' || order.deliveryFee === 0 || order.isFreeDelivery ? "توصيل مجاني" : order.deliveryFee.toFixed(3) + " د.ك"}</span>
                   </div>
                   <span>رسوم التوصيل</span>
                 </div>
                 <div className="flex justify-between items-center text-xs font-bold text-stone-400 uppercase tracking-widest pt-4 border-t border-stone-50">
                    {/* If free, total already equals itemsTotal */}
                    <span className="italic">{calculateItemsTotal(order.items).toFixed(3)} د.ك</span>
                    <span>مجموع المنتجات</span>
                 </div>
                 <div className="pt-4 border-t border-stone-100 flex flex-col items-center">
                    <p className="text-[10px] text-stone-400 font-extrabold uppercase tracking-widest mb-3">Gross Total</p>
                    <div className="text-6xl font-extrabold text-brand italic tracking-tighter">{getDisplayTotal(order).toFixed(3)} <span className="text-xl text-accent not-italic">د.ك</span></div>
                     {((order as any).discountAmount > 0 || (order as any).discount > 0) && (
                       <p className="text-xs font-bold text-red-500 mt-2">
                         الخصم {(order as any).promoCode && `(${(order as any).promoCode})`}: -{((order as any).discountAmount || (order as any).discount).toFixed(3)} د.ك
                       </p>
                     )}
                 </div>
              </div>
            </div>
          </section>

          {(order as any).splitPayments && (order as any).splitType === "traditional" && (
            <section className="mt-8">
              <label className="text-[10px] font-extrabold text-stone-400 uppercase tracking-[0.2em] block mb-4 px-2 text-right">المشاركين بالقطية</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(order as any).splitPayments.map((p: any, idx: number) => (
                  <div key={idx} className="bg-stone-50 p-4 rounded-2xl border border-stone-100 flex justify-between items-center">
                    <div className="flex flex-col items-start gap-1">
                       <span className="text-xl font-extrabold text-brand italic">{Number(p.amount).toFixed(3)} د.ك</span>
                       <span className={`text-[10px] font-bold px-2 py-1 rounded-lg uppercase ${p.status === 'paid' ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'}`}>{p.status === 'paid' ? 'تم الدفع' : 'بانتظار الدفع'}</span>
                    </div>
                    <div className="flex flex-col gap-1 text-right">
                       <span className="font-bold text-brand">{p.name || p.phone}</span>
                       <span className="text-xs text-stone-500">{p.phone}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {(order as any).splitParticipants && (order as any).splitType === "roulette" && (
             <section className="mt-8">
               <label className="text-[10px] font-extrabold text-stone-400 uppercase tracking-[0.2em] block mb-4 px-2 text-right">روليت الحظ</label>
               <div className="bg-fuchsia-50 p-6 rounded-[32px] border border-fuchsia-100 text-center flex flex-col items-center justify-center">
                  {(order as any).rouletteLoser ? (
                     <>
                        <p className="text-fuchsia-800 font-bold mb-4">الخاسر اللي طاحت براسه القطية:</p>
                        <div className="text-4xl font-extrabold text-fuchsia-600 mb-2">{(order as any).rouletteLoser}</div>
                        <p className="text-sm font-bold text-fuchsia-500 mt-2">القيمة: {getDisplayTotal(order).toFixed(3)} د.ك</p>
                     </>
                  ) : (
                     <div className="text-xl font-bold text-fuchsia-400">بانتظار اللعب والدفع...</div>
                  )}
                  
                  <div className="mt-6 w-full text-right">
                     <p className="text-xs font-bold text-fuchsia-800/60 mb-2">المشاركون في الروليت:</p>
                     <div className="flex flex-wrap gap-2 justify-end">
                        {(order as any).splitParticipants.map((p: any, idx: number) => (
                           <span key={idx} className="bg-fuchsia-100 text-fuchsia-700 px-3 py-1 rounded-lg text-xs font-bold border border-fuchsia-200">
                              {p.name} {p.phone && `(${p.phone})`}
                           </span>
                        ))}
                     </div>
                  </div>
               </div>
             </section>
          )}

          <section>
            <label className="text-[10px] font-extrabold text-stone-400 uppercase tracking-[0.2em] block mb-8 px-2 text-right">مكونات الطلب</label>
            <div className="grid grid-cols-1 gap-5">
              {(order as any).notes || (order as any).generalNotes ? (
                 <div className="bg-orange-50/50 p-6 rounded-[32px] border border-orange-100 flex gap-4 text-orange-800 text-sm mb-4">
                    <MessageCircle className="w-5 h-5 shrink-0" />
                    <div>
                      <p className="font-bold text-xs uppercase tracking-widest mb-1 opacity-70">ملاحظات عامة</p>
                      <p>{(order as any).notes || (order as any).generalNotes}</p>
                    </div>
                 </div>
              ) : null}

              {(order.items || []).map((item: any, idx: number) => (
                <div key={idx} className={`bg-white p-6 rounded-[32px] flex justify-between items-center border shadow-sm transition-all group ${item.preparationInstructions ? 'border-red-200 bg-red-50/10' : 'border-stone-100'}`}>
                  <div className="flex-grow text-right">
                    <div className="flex items-center gap-6 justify-end">
                      <div>
                        <h5 className="font-extrabold text-xl text-brand flex items-center justify-end gap-2">
                           {item.name || item.productName}
                           {item.preparationInstructions && <AlertTriangle className="w-5 h-5 text-red-500 animate-pulse" />}
                        </h5>
                        <div className="mt-2 flex flex-wrap gap-2 justify-end">
                          {item.selectedOption && <span className="text-[9px] font-extrabold uppercase bg-stone-50 text-stone-400 px-3 py-1 rounded-lg border border-stone-100">{item.selectedOption}</span>}
                          {(item.selectedExtras || []).map((e: any, eIdx: number) => (<span key={eIdx} className="text-[9px] font-extrabold uppercase bg-accent/5 text-accent px-3 py-1 rounded-lg border border-accent/10">+{e.name}</span>))}
                        </div>
                      </div>
                      <div className="w-14 h-14 rounded-2xl bg-stone-50 flex items-center justify-center font-extrabold text-accent text-xl border border-stone-100">{item.quantity}</div>
                    </div>
                    {item.preparationInstructions && (
                      <div className="mt-4 p-3 bg-red-50 rounded-2xl text-[11px] text-red-600 font-bold border border-red-100 flex items-center justify-end gap-2 text-right">
                        <span>{item.preparationInstructions}</span>
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                      </div>
                    )}
                    {(item.itemNotes || item.note) && <div className="mt-3 p-5 bg-stone-50/50 rounded-2xl text-[11px] text-stone-400 italic border-r-2 border-stone-100 font-medium leading-relaxed">"{(item.itemNotes || item.note)}"</div>}
                  </div>
                  <div className="text-left text-2xl font-light text-brand italic shrink-0 mr-8">{((item.price || 0) * (item.quantity || 1)).toFixed(2)} <span className="text-xs text-stone-400">د.ك</span></div>
                </div>
              ))}
            </div>
          </section>
        </div>
        {(order.status === "جديد" || order.status?.startsWith("تم الدفع") || order.status === "فشل في عملية الدفع" || order.status === "قيد تجميع القطية") && (
          <div className="p-10 bg-stone-50/50 border-t border-stone-100 flex flex-col gap-6">
            <div className="grid grid-cols-2 gap-8">
              <a href={`https://wa.me/${order.customerPhone?.replace(/\D/g, "")?.length === 8 ? "965" + order.customerPhone.replace(/\D/g, "") : order.customerPhone?.replace(/\D/g, "")}?text=${encodeURIComponent(`مرحباً ${order.customerName}، بخصوص طلبك رقم ${order.id}...${order.address ? `\n\n📍 العنوان:\nالمنطقة: ${order.address.region}\nقطعة: ${order.address.block}\nشارع: ${order.address.street}\nمنزل: ${order.address.building}` : ""}\n\nرابط مشاركة القطية: ${window.location.origin}/split/${order.id}`)}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-4 bg-white border border-stone-100 text-green-500 p-6 rounded-[32px] font-extrabold uppercase tracking-widest text-xs hover:bg-green-500 hover:text-white transition-all shadow-sm active:scale-95 group"><MessageCircle className="w-7 h-7 group-hover:animate-bounce" />تواصل عبر واتساب</a>
              {(order.status === "جديد" || order.status?.startsWith("تم الدفع")) ? (
                <MagneticButton onClick={onPay} className="flex items-center justify-center gap-4 gold-gradient text-white p-6 rounded-[32px] font-extrabold uppercase tracking-widest text-xs shadow-xl shadow-accent/20 hover:scale-[1.02] transition-all active:scale-95 group"><CheckCircle2 className="w-7 h-7" />تأكيد استلام المبلغ 💰</MagneticButton>
              ) : (
                <button disabled className="flex items-center justify-center gap-4 bg-stone-200 text-stone-400 p-6 rounded-[32px] font-extrabold uppercase tracking-widest text-xs shadow-sm cursor-not-allowed group">
                  <X className="w-7 h-7 opacity-50" /> يجب إتمام الدفع أولاً
                </button>
              )}
            </div>
            {order.status === "قيد تجميع القطية" && (
                <div className="bg-purple-50 border border-purple-100 rounded-xl p-6 mb-4">
                  <h4 className="font-bold text-purple-600 mb-2 text-sm flex items-center gap-2">
                    <PieChart className="w-4 h-4"/> 
                    حالة تجميع القطية
                  </h4>
                  <div className="flex gap-2 mb-2 bg-white rounded-lg p-3">
                     <span className="font-bold text-xs">رابط المشاركة:</span>
                     <span className="text-xs text-stone-500 font-mono select-all truncate">{window.location.origin}/split/{order.id}</span>
                  </div>
                  <div className="space-y-2 mt-4">
                    {order.splitPayments?.map((p, i) => (
                      <div key={i} className="flex justify-between items-center text-sm border-b border-purple-100 pb-2">
                        <span>{p.name}</span>
                        <div className="flex gap-4 items-center">
                           <span className="font-bold">{p.amount.toFixed(3)} د.ك</span>
                           <span className={`text-[10px] px-2 py-1 rounded-md ${p.status === 'paid' ? 'bg-green-100 text-green-700' : p.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{p.status === 'paid' ? 'تم الدفع' : p.status === 'failed' ? 'فشل' : 'بانتظار الدفع'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
            )}
            {!order.status?.startsWith("تم الدفع") && order.status !== "جديد" && (
                <div className="text-center p-4 rounded-xl bg-red-50 text-red-600 font-bold border border-red-100 text-[10px] tracking-widest uppercase">
                  لا يمكن تحويل الطلب إلى فاتورة قبل تأكيد الدفع الإلكتروني
                </div>
            )}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
