import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { isDevToolsEnabled } from '../lib/devTools';

// زر «Simulate Payment» وتنبيهه لا يصلان إلى الإنتاج: لا في المتصفح ولا داخل التطبيق.
// الزر لا يدفع شيئاً أصلاً؛ هذا الاختبار لا يستدعي أي خدمة دفع.

describe('isDevToolsEnabled', () => {
  it('بناء الإنتاج: false حتى مع ?dev=true أو ?2dev=true (متصفح أو تطبيق)', () => {
    expect(isDevToolsEnabled('dev=true', false)).toBe(false);
    expect(isDevToolsEnabled('?2dev=true&x=1', false)).toBe(false);
    expect(isDevToolsEnabled('', false)).toBe(false);
  });
  it('بناء التطوير: كما كان، يلزم dev=true أو 2dev=true', () => {
    expect(isDevToolsEnabled('dev=true', true)).toBe(true);
    expect(isDevToolsEnabled('2dev=true', true)).toBe(true);
    expect(isDevToolsEnabled('dev=1', true)).toBe(false);
    expect(isDevToolsEnabled('', true)).toBe(false);
  });
});

describe('SplitPayment', () => {
  const src = readFileSync('src/pages/SplitPayment.tsx', 'utf8');
  it('isDev مربوط ببناء التطوير والدفع الحقيقي (handlePay) غير مشروط به', () => {
    expect(src).toContain('isDevToolsEnabled(searchParams.toString(), import.meta.env.DEV)');
    expect(src).not.toMatch(/const isDev =\s*searchParams\.get/);
    expect(src).toMatch(/\{isDev && \(\s*<button[^>]*onClick=\{\(\) => \{\s*alert\("Simulating payment/);
    expect(src).toContain('onClick={handlePay}');
  });
});
