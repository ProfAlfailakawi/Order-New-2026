// أدوات المطوّر (مثل زر محاكاة الدفع) تعمل في بناء التطوير فقط.
// في بناء الإنتاج تعيد false دائماً مهما كان الرابط، فلا يصل إليها زائر ولا التطبيق.
export const isDevToolsEnabled = (search: string, isDevBuild: boolean): boolean => {
  if (!isDevBuild) return false;
  const params = new URLSearchParams(search);
  return params.get('dev') === 'true' || params.get('2dev') === 'true';
};
