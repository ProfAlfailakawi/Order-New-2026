import React, { useEffect, useRef } from 'react';

declare global {
  interface Window { L?: any; __alturathLeafletLoading?: Promise<any>; }
}

type Marker = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  count?: number;
  value?: number;
  subtitle?: string;
  color?: string;
  radiusMeters?: number;
  size?: number;
  active?: boolean;
  html?: string;
};

const KUWAIT_CENTER = { lat: 29.25, lng: 47.9 };

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

const buildIcon = (L: any, marker: Marker) => {
  const color = marker.color || '#10b981';
  const size = marker.size || (marker.active ? 34 : 26);
  const label = marker.count !== undefined ? marker.count : marker.value !== undefined ? marker.value : '';
  return L.divIcon({
    className: 'alturath-leaflet-marker',
    html: marker.html || `<div style="width:${size}px;height:${size}px;border-radius:999px;background:${color};border:3px solid white;box-shadow:0 10px 28px rgba(15,23,42,.32),0 0 0 ${marker.active ? 8 : 4}px ${color}26;display:flex;align-items:center;justify-content:center;color:white;font-weight:900;font-size:10px;">${label || ''}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
};

const LeafletKuwaitMap: React.FC<{
  markers: Marker[];
  center?: { lat: number; lng: number };
  zoom?: number;
  heightClassName?: string;
  dark?: boolean;
  onMarkerClick?: (marker: Marker) => void;
  showRange?: boolean;
  attributionPrefix?: string;
}> = ({ markers, center = KUWAIT_CENTER, zoom = 10, heightClassName = 'h-[560px]', dark = false, onMarkerClick, showRange = false, attributionPrefix }) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const layerRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    loadLeaflet().then((L) => {
      if (cancelled || !L || !hostRef.current) return;
      if (!mapRef.current) {
        mapRef.current = L.map(hostRef.current, {
          center: [center.lat, center.lng],
          zoom,
          zoomControl: true,
          scrollWheelZoom: true,
          attributionControl: true,
        });
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: attributionPrefix || '© OpenStreetMap contributors',
        }).addTo(mapRef.current);
        mapRef.current.createPane('alturath-glow');
        mapRef.current.getPane('alturath-glow').style.zIndex = 420;
      } else {
        mapRef.current.setView([center.lat, center.lng], zoom, { animate: true });
      }
      if (!layerRef.current) layerRef.current = L.layerGroup().addTo(mapRef.current);
      layerRef.current.clearLayers();
      const bounds: any[] = [];
      markers.forEach((marker) => {
        if (!Number.isFinite(marker.lat) || !Number.isFinite(marker.lng)) return;
        const point = [marker.lat, marker.lng];
        bounds.push(point);
        if (showRange && marker.radiusMeters) {
          L.circle(point, {
            pane: 'alturath-glow',
            radius: marker.radiusMeters,
            color: marker.color || '#10b981',
            fillColor: marker.color || '#10b981',
            fillOpacity: marker.active ? 0.16 : 0.08,
            weight: marker.active ? 2 : 1,
          }).addTo(layerRef.current);
        }
        const m = L.marker(point, { icon: buildIcon(L, marker), title: marker.name }).addTo(layerRef.current);
        const valueLine = marker.value !== undefined ? `<div style="color:#d97706;font-weight:900;margin-top:2px">${Number(marker.value || 0).toFixed(2)} د.ك</div>` : '';
        m.bindTooltip(`<div dir="rtl" style="text-align:right;font-family:system-ui;font-weight:800">${marker.name}${marker.subtitle ? `<div style="color:#64748b;font-size:11px;margin-top:2px">${marker.subtitle}</div>` : ''}${valueLine}</div>`, { direction: 'top', offset: [0, -16], opacity: 0.96 });
        if (onMarkerClick) m.on('click', () => onMarkerClick(marker));
      });
      if (bounds.length > 1) mapRef.current.fitBounds(bounds, { padding: [42, 42], maxZoom: zoom + 2 });
      setTimeout(() => mapRef.current?.invalidateSize(), 80);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [markers, center.lat, center.lng, zoom, showRange, onMarkerClick, attributionPrefix]);

  return (
    <div className={`relative overflow-hidden rounded-[2rem] border ${dark ? 'border-white/10 bg-slate-900' : 'border-slate-200 bg-slate-100'} shadow-inner ${heightClassName}`} dir="ltr">
      <div ref={hostRef} className="absolute inset-0 z-0" />
      <div className="pointer-events-none absolute inset-0 z-[500] bg-[radial-gradient(circle_at_center,rgba(234,179,8,0.10)_0%,transparent_52%,rgba(15,23,42,0.10)_100%)]" />
      <div className="pointer-events-none absolute top-3 right-3 z-[520] rounded-full bg-white/90 px-3 py-1 text-[10px] font-black text-slate-700 shadow border border-white/80" dir="rtl">خريطة تفاعلية دقيقة</div>
    </div>
  );
};

export default LeafletKuwaitMap;
