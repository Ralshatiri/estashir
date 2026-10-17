# العمل الجماعي على استشير

## إعداد نسخة محلية

بعد clone، اتبعي README لتثبيت مكتبات الواجهة وبيئة Python.
أنشئي frontend/.env وbackend/agents/estashir/.env من قوالب .env.example.
احصلي على القيم المطلوبة عبر قناة خاصة؛ لا تضعي المفاتيح في commits أو Pull Requests.
كل جهاز ينشئ node_modules و.venv محليًا؛ لا تنسخيهما بين الأجهزة.

## تنفيذ تغيير

ابدئي من main محدث، وفرع خاص بالمهمة:

```powershell
git switch main
git pull --ff-only
git switch -c feature/describe-your-change
```

قسّمي المهام بوضوح: الواجهة في frontend، والخلفية والوكيل في backend.
اتفقا على تغييرات API وأحداث WebSocket قبل تعديل طرفي الاتصال.
لا تعملا على الفرع نفسه بالتزامن.

## التحقق والمراجعة

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
cd backend
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
```

راجعي git diff وgit status، ثم احفظي التغيير وارفعي فرعك:

```powershell
git add frontend/src/path-to-changed-file
git commit -m "Describe the change"
git push -u origin feature/describe-your-change
```

استبدلي المسار باسم الملف الذي عدلته. افتحي Pull Request إلى main واطلبي
مراجعة زميلتك. وضحي ما تغير وكيف اختبرتِه، ثم ادمجا بعد المراجعة.

## إعدادات الاختبار

صف demo_state الحالي مشترك. استخدام مشروع Supabase نفسه قد يجعل اختباراتكما
تغيّر بيانات بعض؛ استخدما مشروعي تجربة مستقلين أو نسّقا الاختبار مؤقتًا.
لا تضعي بيانات مرضى حقيقية أو تسجيلات شخصية ضمن المستودع أو الاختبارات.
