# AMIC Forms Monorepo

هذا المستودع يحتوي على نسختين:

- `modern-app/`: النسخة الأساسية الحالية (React + Vite + Supabase)
- `legacy-forms/`: نسخة HTML/JS القديمة محفوظة للرجوع أو النقل التدريجي

## الاتجاه المعتمد

التطوير الجديد يكون على `modern-app`.

## المتطلبات

- Node.js 20+
- حساب Supabase جاهز

## إعداد البيئة (modern-app)

انسخ الملف:

- `modern-app/.env.example`

إلى:

- `modern-app/.env`

ثم عدّل القيم:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_ADMIN_EMAIL`

## التشغيل المحلي

من داخل `modern-app`:

```bash
npm install
npm run dev
```

## البناء للإنتاج

من داخل `modern-app`:

```bash
npm run build
```

مخرجات البناء تكون داخل:

- `modern-app/dist`

## إعداد قاعدة البيانات (Supabase)

نفّذ ملفات الـ migrations بالترتيب من داخل:

- `modern-app/supabase/migrations`

أو عبر SQL Editor في Supabase بنفس الترتيب الزمني.

تمت إضافة Migration تشديد الصلاحيات:

- `20260520123000_harden_rls_roles_and_storage.sql`

## نشر الإنتاج على VPS (Hostinger)

### 1) بناء التطبيق محليًا

```bash
cd modern-app
npm install
npm run build
```

### 2) رفع ملفات `dist`

ارفع كل محتوى `modern-app/dist` إلى مسار الموقع على VPS (مثال: `/var/www/amic-forms`).

### 3) إعداد Nginx (SPA)

تأكد أن إعداد الموقع يدعم React Router:

```nginx
location / {
  try_files $uri $uri/ /index.html;
}
```

### 4) إعادة تحميل Nginx

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## تحقق ما بعد النشر

1. الصفحة الرئيسية تعمل
2. تسجيل دخول الإدارة يعمل
3. مستخدم `staff` لا يستطيع دخول صفحات إدارة القوالب
4. مستخدم `admin`/`super_admin` يستطيع إدارة القوالب
5. إرسال النماذج العامة يعمل من مستخدم غير مسجل

## ملاحظات أمنية

- لا ترفع `.env` إلى GitHub
- إدارة الصلاحيات تتم عبر `user_roles` في Supabase
- الوصول الإداري الآن محمي في الواجهة + RLS
