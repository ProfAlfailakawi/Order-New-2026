// Hidden diagnostics for the iPhone Duo widget corner. Loaded ONLY when the address has ?duo-debug=1
// (see main.tsx). It draws the reserved rectangle and a small panel with the numbers the owner needs
// to confirm the fix on the device, in Safari and in the installed (Capacitor) app. Presentation only.
export function installDuoDebug(): void {
  const doc = document;
  const root = doc.documentElement;
  const frame = doc.createElement('div');
  frame.setAttribute('data-duo-debug', 'frame');
  frame.style.cssText =
    'position:fixed;top:0;right:0;pointer-events:none;z-index:2147483646;box-sizing:border-box;' +
    'border:2px solid rgba(220,0,0,.9);background:rgba(220,0,0,.10);' +
    'width:var(--duo-widget-w);height:var(--duo-widget-h);';
  const panel = doc.createElement('pre');
  panel.setAttribute('data-duo-debug', 'panel');
  panel.setAttribute('dir', 'ltr');
  panel.style.cssText =
    'position:fixed;left:6px;bottom:6px;max-width:calc(100vw - var(--duo-keep) - 14px);margin:0;padding:8px 10px;' +
    'font:11px/1.45 ui-monospace,Menlo,monospace;color:#fff;background:rgba(0,0,0,.82);border-radius:10px;' +
    'white-space:pre-wrap;z-index:2147483647;pointer-events:none;';
  const probe = doc.createElement('div');
  probe.style.cssText =
    'position:fixed;visibility:hidden;pointer-events:none;' +
    'padding-top:env(safe-area-inset-top);padding-right:env(safe-area-inset-right);' +
    'padding-bottom:env(safe-area-inset-bottom);padding-left:env(safe-area-inset-left);';
  // Live calibration on the device: ?duo-debug=1&duo-w=110&duo-h=270 overrides the two tokens (this page only).
  const q = new URLSearchParams(window.location.search);
  const num = (k: string) => { const v = Number(q.get(k)); return Number.isFinite(v) && v > 0 && v < 1000 ? v : null; };
  const ow = num('duo-w');
  const oh = num('duo-h');
  if (ow) root.style.setProperty('--duo-widget-w', ow + 'px');
  if (oh) root.style.setProperty('--duo-widget-h', oh + 'px');
  const render = () => {
    const cs = getComputedStyle(root);
    const pcs = getComputedStyle(probe);
    const vv = window.visualViewport;
    const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string } }).Capacitor;
    const native = !!cap?.isNativePlatform?.();
    const ua = navigator.userAgent;
    const standalone = (navigator as unknown as { standalone?: boolean }).standalone;
    const wide = parseFloat(cs.getPropertyValue('--duo-widget-w')) || 0;
    // the panel itself stays clear of the corner: bottom-left, narrower than the free width

    panel.textContent = [
      `zone active: ${wide > 0 ? 'YES' : 'NO'}`,
      `--duo-widget-w ${cs.getPropertyValue('--duo-widget-w').trim()}  gap ${cs.getPropertyValue('--duo-widget-gap').trim()}`,
      `--duo-widget-h ${cs.getPropertyValue('--duo-widget-h').trim()} = ${Math.round(frame.getBoundingClientRect().height)}px`,
      `safe-area t/r/b/l: ${pcs.paddingTop} ${pcs.paddingRight} ${pcs.paddingBottom} ${pcs.paddingLeft}`,
      `inner ${window.innerWidth}x${window.innerHeight}  visual ${vv ? Math.round(vv.width) + 'x' + Math.round(vv.height) : 'n/a'}`,
      `dir: ${root.dir || doc.body.dir || getComputedStyle(doc.body).direction}  lang: ${root.lang}`,
      `standalone: navigator=${String(standalone)}  display-mode=${matchMedia('(display-mode: standalone)').matches}`,
      `Capacitor: ${native ? 'native ' + (cap?.getPlatform?.() ?? '?') : 'no (browser)'}`,
      `override: duo-w=${ow ?? '-'} duo-h=${oh ?? '-'}`,
      `UA Safari/ token: ${/Safari\//.test(ua) ? 'yes (Safari)' : 'no (WKWebView or app)'}`,
      'send a screenshot with the red frame; raise duo-w / duo-h until it covers the capsule',
    ].join('\n');
  };
  doc.body.append(frame, probe, panel);
  render();
  window.addEventListener('resize', render);
  window.visualViewport?.addEventListener('resize', render);
}
