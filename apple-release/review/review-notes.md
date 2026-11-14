# ملاحظات المراجعة — التراث

**ملاحظة للمراجع (EN):** Alturath is a native shell around our production service at https://alturathkw.shop. Native features: offline detection and banner with automatic recovery, pull-to-refresh, swipe navigation, resume-last-page, iPad multitasking and Mac (Apple silicon) support.

- حساب التجربة: لا يلزم حساب. التجربة بكوبون مراجعة مجاني (100% على الطلب والتوصيل) يضبطه المالك في الإنتاج عبر متغير البيئة `REVIEW_COUPON_CODE` (8 إلى 40 حرفًا: A-Z وأرقام و - و _؛ غير مضبوط = الميزة مطفأة). الكود نفسه يُكتب في ملاحظات App Store Connect فقط ولا يُحفظ في git. خطوات المراجع: اختيار صنف، «السلة»، تعبئة الاسم والجوال والعنوان، فتح «عندك كوبون؟» وإدخال الكود ثم «تطبيق»، فيصير المجموع 0.000 د.ك ويكتمل الطلب بدون بوابة دفع. الطلب يُعلَّم `isReviewOrder` ويبدأ اسمه بـ «[تجربة مراجعة آبل]» ولا يُرسل إشعار للإدارة. بعد القبول: احذف المتغير.
- حذف الحساب: زر «طلب حذف الحساب» داخل «الديوانية» (يظهر بعد تسجيل الجوال)؛ يسجّل طلبًا معلّقًا في `accountDeletionRequests` ويعالجه المالك خلال 30 يومًا (`GET /api/admin/account-deletion-requests` بصلاحية الأدمن).
- المدفوعات: سلع مادية — بوابات UPayments/MyFatoorah/KNET مسموحة خارج IAP. السعر النهائي يُحسب على الخادم.
- مخاطر المراجعة: عودة بوابة الدفع: النطاقات مضافة إلى allowNavigation.
