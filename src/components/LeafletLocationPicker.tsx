import React, { useEffect, useRef, useState } from 'react';
import { Compass, Loader2, MapPin } from 'lucide-react';
import { robustGetCurrentPosition } from '../utils/geolocation';

declare global {
  interface Window { L?: any; __alturathLeafletLoading?: Promise<any>; }
}

const DEFAULT_KUWAIT = { lat: 29.3375, lng: 47.9774 };

const loadLeaflet = () => {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (window.L) return Promise.resolve(window.L);
  if (window.__alturathLeafletLoading) return window.__alturathLeafletLoading;
  window.__alturathLeafletLoading = new Promise((resolve, reject) => {
    if (!document.querySelector('link[data-alturath-leaflet]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      link.setAttribute('data-alturath-leaflet', '1');
      document.head.appendChild(link);
    }
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.async = true;
    script.onload = () => resolve(window.L);
    script.onerror = reject;
    document.body.appendChild(script);
  });
  return window.__alturathLeafletLoading;
};

const normalizeDigits = (value: number) => Number(value.toFixed(6));


const cleanAddressPart = (value: any) => String(value ?? '').trim();

const stripAddressFieldLabel = (value: any, type?: 'block' | 'street' | 'building') => {
  let text = cleanAddressPart(value);
  if (!text) return '';
  const stripOnce = (input: string) => input
    .replace(/^[\s\u200e\u200f]*(?:قطعة|قطعه|ق\.?|block)\s*[:：#\-–—،,]?\s*/i, '')
    .replace(/^[\s\u200e\u200f]*(?:شارع|ش\.?|street|road|طريق)\s*[:：#\-–—،,]?\s*/i, '')
    .replace(/^[\s\u200e\u200f]*(?:منزل|بيت|مبنى|مبني|بناية|عمارة|building|house|home)\s*[:：#\-–—،,]?\s*/i, '')
    .trim();
  let previous = '';
  while (previous !== text) {
    previous = text;
    text = stripOnce(text);
  }
  if (type === 'block') text = text.replace(/^[\s\u200e\u200f]*(?:ق\.?|قطعة|قطعه|block)\s*[:：#\-–—،,]?\s*/i, '').trim();
  if (type === 'street') text = text.replace(/^[\s\u200e\u200f]*(?:ش\.?|شارع|street|road|طريق)\s*[:：#\-–—،,]?\s*/i, '').trim();
  if (type === 'building') text = text.replace(/^[\s\u200e\u200f]*(?:م\.?|منزل|بيت|مبنى|مبني|بناية|عمارة|building|house|home)\s*[:：#\-–—،,]?\s*/i, '').trim();
  return text;
};

const extractBlock = (address: any) => {
  const candidates = [
    address?.quarter,
    address?.neighbourhood,
    address?.suburb,
    address?.residential,
    address?.hamlet,
    address?.road,
  ].map(cleanAddressPart).filter(Boolean);
  for (const part of candidates) {
    const match = part.match(/(?:block|قطعة|قطعه)\s*([0-9٠-٩۰-۹A-Za-zأ-ي-]+)/i);
    if (match?.[1]) return stripAddressFieldLabel(match[1], 'block');
  }
  return '';
};

const normalizeReverseAddress = (payload: any) => {
  const a = payload?.address || {};
  const region = cleanAddressPart(a.suburb || a.neighbourhood || a.quarter || a.city_district || a.town || a.city || a.village || a.state_district || a.state);
  const block = stripAddressFieldLabel(extractBlock(a), 'block');
  const street = stripAddressFieldLabel(a.road || a.pedestrian || a.footway || a.residential, 'street');
  const building = stripAddressFieldLabel(a.house_number || a.house_name || a.building, 'building');
  const extraDetails = cleanAddressPart(payload?.display_name);
  return { region, block, street, building, extraDetails };
};

const LeafletLocationPicker: React.FC<{
  value?: { lat?: number; lng?: number } | null;
  onChange: (location: { lat: number; lng: number; accuracy?: number; source: string }) => void;
  onAddressGuess?: (address: { region?: string; block?: string; street?: string; building?: string; extraDetails?: string }) => void;
}> = ({ value, onChange, onAddressGuess }) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const accuracyRef = useRef<any>(null);
  const reverseSeqRef = useRef(0);
  const reverseAbortRef = useRef<AbortController | null>(null);
  const [status, setStatus] = useState('حرّك الدبوس أو اضغط تحديد موقعي لزيادة دقة التوصيل.');
  const [isResolvingAddress, setIsResolvingAddress] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  const reverseGeocode = async (lat: number, lng: number) => {
    if (!onAddressGuess) return;
    const seq = reverseSeqRef.current + 1;
    reverseSeqRef.current = seq;
    reverseAbortRef.current?.abort();
    const controller = new AbortController();
    reverseAbortRef.current = controller;
    setIsResolvingAddress(true);
    const timeoutId = window.setTimeout(() => controller.abort(), 6500);
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(String(lat))}&lon=${encodeURIComponent(String(lng))}&addressdetails=1&accept-language=ar,en&countrycodes=kw`;
      const res = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error('reverse-geocoding-failed');
      const data = await res.json();
      if (reverseSeqRef.current !== seq) return;
      const patch = normalizeReverseAddress(data);
      if (patch.region || patch.block || patch.street || patch.building || patch.extraDetails) {
        onAddressGuess(patch);
        setStatus('تمت قراءة العنوان من اللوكيشن. راجع الحقول وعدّلها إذا احتجت.');
      } else {
        setStatus('تم تثبيت اللوكيشن، ولم نقدر نستخرج عنواناً كافياً منه. تقدر تكمّل يدوياً.');
      }
    } catch (error: any) {
      if (error?.name !== 'AbortError') setStatus('تم تثبيت اللوكيشن، وتعذر جلب العنوان التلقائي حالياً. الحقول اليدوية متاحة.');
    } finally {
      window.clearTimeout(timeoutId);
      if (reverseSeqRef.current === seq) setIsResolvingAddress(false);
    }
  };

  const setPoint = (lat: number, lng: number, source = 'map', accuracy?: number) => {
    const safe = { lat: normalizeDigits(lat), lng: normalizeDigits(lng), accuracy, source };
    onChange(safe);
    if (markerRef.current) markerRef.current.setLatLng([safe.lat, safe.lng]);
    if (mapRef.current && source === 'gps') mapRef.current.setView([safe.lat, safe.lng], 16);
    setStatus(source === 'gps' ? 'تم تثبيت موقعك من GPS، ونقرأ العنوان تلقائياً الآن.' : 'تم تحديث نقطة التوصيل من الخريطة، ونقرأ العنوان تلقائياً الآن.');
    reverseGeocode(safe.lat, safe.lng);
  };

  useEffect(() => {
    let cancelled = false;
    loadLeaflet().then((L) => {
      if (cancelled || !L || !hostRef.current) return;
      const initial = value?.lat && value?.lng ? { lat: Number(value.lat), lng: Number(value.lng) } : DEFAULT_KUWAIT;
      if (!mapRef.current) {
        mapRef.current = L.map(hostRef.current, { center: [initial.lat, initial.lng], zoom: value?.lat ? 16 : 11, zoomControl: true, scrollWheelZoom: true });
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap contributors' }).addTo(mapRef.current);
        const icon = L.divIcon({ className: 'alturath-delivery-pin', html: '<div style="width:34px;height:34px;border-radius:18px 18px 18px 4px;background:#183326;border:3px solid white;box-shadow:0 14px 30px rgba(24,51,38,.32);transform:rotate(-45deg);display:flex;align-items:center;justify-content:center"><span style="width:10px;height:10px;border-radius:99px;background:#facc15;display:block"></span></div>', iconSize: [34, 34], iconAnchor: [17, 31] });
        markerRef.current = L.marker([initial.lat, initial.lng], { draggable: true, icon, title: 'موقع التوصيل' }).addTo(mapRef.current);
        markerRef.current.on('dragend', () => {
          const p = markerRef.current.getLatLng();
          setPoint(p.lat, p.lng, 'drag');
        });
        mapRef.current.on('click', (event: any) => setPoint(event.latlng.lat, event.latlng.lng, 'map'));
      }
      setTimeout(() => mapRef.current?.invalidateSize(), 120);
    }).catch(() => setStatus('تعذر تحميل الخريطة حالياً، تقدر تكمل بإدخال العنوان اليدوي.'));
    return () => { cancelled = true; reverseAbortRef.current?.abort(); };
  }, []);

  const useCurrentLocation = async () => {
    if (isLocating) return;
    if (!navigator.geolocation) {
      setStatus('المتصفح لا يدعم تحديد الموقع.');
      return;
    }
    if (!window.isSecureContext) {
      setStatus('تحديد الموقع يحتاج فتح الموقع باتصال HTTPS آمن.');
      return;
    }
    setIsLocating(true);
    setStatus('نحدد موقعك الآن...');
    try {
      const position = await robustGetCurrentPosition({
        enableHighAccuracy: true,
        timeout: 18000,
        maximumAge: 60000,
      });
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      const accuracy = Math.round(position.coords.accuracy || 0);
      setPoint(lat, lng, 'gps', accuracy);
      if (mapRef.current) {
        if (accuracyRef.current) accuracyRef.current.remove();
        const L = window.L;
        accuracyRef.current = L?.circle([lat, lng], { radius: accuracy || 35, color: '#16a34a', fillColor: '#22c55e', fillOpacity: 0.08, weight: 1 }).addTo(mapRef.current);
      }
    } catch (error: any) {
      if (Number(error?.code) === 1) {
        setStatus('صلاحية الموقع مقفلة. فعّلها لهذا الموقع من إعدادات سفاري ثم اضغط مرة ثانية.');
      } else if (Number(error?.code) === 3) {
        setStatus('تحديد الموقع أخذ وقتاً أطول من المتوقع. تأكد من الإنترنت وخدمة الموقع ثم جرّب مرة ثانية.');
      } else {
        setStatus('لم نقدر نأخذ موقعك الآن. تقدر تحدده من الخريطة أو تجرّب مرة ثانية.');
      }
    } finally {
      setIsLocating(false);
    }
  };

  return (
    <div className="rounded-[28px] border border-emerald-100 bg-white p-3 shadow-sm space-y-3">
      <div className="flex items-center justify-between gap-3" dir="rtl">
        <div>
          <div className="text-sm font-black text-brand flex items-center gap-2"><MapPin className="w-4 h-4 text-emerald-600" /> نقطة التوصيل الدقيقة</div>
          <p className="text-[11px] text-stone-500 font-bold mt-1">اختياري لكنه يخلي التوصيل أدق من كتابة العنوان فقط.</p>
        </div>
        <button type="button" onClick={useCurrentLocation} disabled={isLocating} className="shrink-0 inline-flex items-center gap-2 rounded-2xl bg-emerald-50 px-3 py-2 text-[11px] font-black text-emerald-700 border border-emerald-100 active:scale-95 transition disabled:cursor-wait disabled:opacity-70">
          {isLocating || isResolvingAddress ? <Loader2 className="w-4 h-4 animate-spin" /> : <Compass className="w-4 h-4" />} {isLocating ? 'جاري التحديد' : 'حدد موقعي'}
        </button>
      </div>
      <div className="relative h-[260px] overflow-hidden rounded-[24px] border border-stone-100 bg-stone-100" dir="ltr">
        <div ref={hostRef} className="absolute inset-0" />
      </div>
      <div className="text-[11px] font-bold text-stone-500 leading-5" dir="rtl">{status}</div>
    </div>
  );
};

export default LeafletLocationPicker;
