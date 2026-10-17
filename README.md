# استشير

## تشغيل التطبيق المرتبط بـ Google ADK

من مجلد المشروع، افتح طرفيتين.

الطرفية الأولى للخلفية:

```powershell
npm.cmd run dev:backend
```

الطرفية الثانية للواجهة:

```powershell
npm.cmd run dev
```

افتح http://localhost:5173 وابدأ محادثة جديدة. يمرر Vite طلبات /api إلى
http://127.0.0.1:8000. استخدام /api عبر proxy يغني عن CORS في التطوير.
أعد تشغيل Vite إذا كان يعمل قبل تعديل إعداداته.

## الإعداد من الصفر

```powershell
npm.cmd run setup:frontend
python -m venv backend/.venv
.\backend\.venv\Scripts\python.exe -m pip install -r backend/requirements.lock.txt
```

إعدادات Supabase في frontend/.env؛ القالب frontend/.env.example.
مفتاح Gemini في backend/agents/estashir/.env؛ القالب بجواره باسم .env.example.
انسخ القالب فقط إذا لم يوجد ملف إعدادات فعلي، ثم اضبط GOOGLE_API_KEY.
لا تضع مفتاح Gemini في frontend أو متغير يبدأ بـ VITE_.

## المسار الفعلي للرسائل

React -> /api/sessions و /api/chat -> ADK Runner -> Gemini -> أدوات الجلسة
-> رد وبيانات منظمة -> واجهات المريض والطبيب والاستقبال.

المحادثة التفاعلية لم تعد تستخدم الأسئلة المتسلسلة أو تصنيف الكلمات المفتاحية.
السيناريوهات التجريبية الجاهزة لا تزال أمثلة ثابتة وليست محادثات مع النموذج.

## الصوت المباشر

مسار المكالمة: الميكروفون -> WebSocket /api/live -> ADK Runner.run_live()
-> Gemini Live -> صوت PCM عائد للمتصفح.

لا يُستخدم SpeechRecognition أو speechSynthesis. المتصفح يلتقط الصوت ويحوّله
إلى PCM16 أحادي القناة بتردد 16kHz، ثم يشغل الصوت المستلم من النموذج (عادة 24kHz).
النص الظاهر أثناء المكالمة يأتي من تفريغ Gemini Live نفسه، وليس من نموذج المتصفح.
عند المقاطعة يوقف العميل الصوت المجدول. تُطبّق نتيجة التوجيه بعد انتهاء تشغيل الرد.

اسم نموذج الصوت الافتراضي gemini-3.8-live. يمكن تغييره بمتغير
ESTASHIR_LIVE_MODEL في backend/agents/estashir/.env. نموذج المحادثة النصية
يبقى مستقلًا ويُضبط بمتغير ESTASHIR_MODEL. يشتركان في التعليمات والأدوات.

بعد التعديل أعد تشغيل الخلفية والواجهة، ثم اختر المحادثة الصوتية واضغط بدء المكالمة
واسمح بالميكروفون. زر الإنهاء يوقف الميكروفون والصوت ويغلق WebSocket؛ إعادة البدء
تنشئ جلسة جديدة. لا يوجد بديل صوتي تابع للمتصفح عند فشل Gemini.

إعداد proxy في Vite يجب أن يحتوي ws: true، وأن يشير إلى منفذ الخلفية الفعلي.
استخدم localhost أثناء التطوير أو HTTPS عند النشر لدعم إذن الميكروفون.

## الاختبارات

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
cd backend
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
```

اختبارات API تستبدل النموذج الحقيقي وتختبر HTTP وجلسات ADK دون استهلاك Gemini.
اختبار النموذج الحقيقي منفصل ويحتاج المفتاح والاتصال بالإنترنت.

## البنية والحدود الحالية

- frontend/: React + Vite. البناء ينتج frontend/dist.
- backend/server.py: API التطبيق وربطه بـ ADK.
- backend/agents/estashir/: التعريف والتعليمات والأدوات.
- backend/supabase/: قاعدة بيانات العرض ودالة Gemini Live القديمة غير المستخدمة حاليًا.
- docs/agent-development.md: شرح التنفيذ.

الخادم محلي للتطوير، مربوط بـ127.0.0.1. جلسات ADK في الذاكرة وتُفقد عند إعادة
تشغيل الخلفية؛ ابدأ محادثة جديدة بعدها. معرّف الجلسة العشوائي محفوظ في
sessionStorage داخل تبويب المتصفح، ولا يُكتب في Supabase.

بيانات العرض ما زالت تُزامن إلى صف demo_state المشترك في Supabase بواسطة
التطبيق الحالي. هذا ليس فصلًا بين حسابات المرضى أو مصادقة إنتاجية. يلزم تصميم
ملكية البيانات والموافقة والتخزين قبل استخدام بيانات حقيقية أو نشر الخادم.

واجهة adk web لا تزال متاحة لاختبار الوكيل مستقلًا؛ لتشغيل التطبيق استخدم
أمر dev:backend أعلاه. مجلد node_modules القديم في الجذر لم يُحذف؛ إعداد
الواجهة من الصفر يثبت مكتباتها داخل frontend.
