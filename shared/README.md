# ShopeVelo — Shared Modules

ملفات JavaScript مشتركة بين كل قوالب المتجر (black.html, neon.html, white.html).

## الملفات

### `theme-router.js`
إعادة توجيه المستخدم للقالب الصحيح حسب `store.template` المخزَّن في Supabase.

**الدوال المُصدَّرة:**
- `window.shvRedirectToTheme(template)` — يُعيد التوجيه لو لزم (يُرجع `true` لو تم، `false` لو لا)
- `window.shvGetThemeFile(template)` — يُرجع اسم الملف للقالب المُحدَّد
- `window.shvThemeMap` — خريطة القوالب للقراءة فقط

**يصلح:** bug الـ neon المفقود — كل ملف كان يفتقد فرع قالب نفسه في منطق الإعادة التوجيه.

### `shipping.js`
جدول الـ 58 ولاية الجزائرية + حساب أسعار الشحن.

**المتغيرات المُصدَّرة:**
- `window.WILAYA_NAME_TO_ID` — خريطة اسم الولاية (إنجليزي) → ID رقمي
- `window.DEFAULT_WILAYA_PRICES` — أسعار الشحن الافتراضية لكل ولاية (home delivery)
- `window.calcShipping(wilaya, subtotal, storeData, deliveryType)` — حساب سعر الشحن
- `window._hasShippingConfig(storeData)` — هل المتجر عرَّف أسعار مخصصة؟

**المنطق:**
1. لو `storeData.shipping[]` موجودة، استخدم أسعار المتجر المخصصة
2. وإلا، استخدم `DEFAULT_WILAYA_PRICES` (office = home × 0.75)

### `supabase.js`
تكوين Supabase + Cloudflare Worker الموحَّد.

**المُصدَّر:**
- `window.SHV_CONFIG` — كائن يحوي:
  - `SUPABASE_URL`
  - `SUPABASE_PUBLISHABLE_KEY`
  - `SHV_WORKER_URL`
  - `STORES_TABLE`, `PRODUCTS_TABLE`, `ORDERS_TABLE`
  - `DEFAULT_PRODUCTS_LIMIT`
  - `NOTIFICATIONS_POLL_INTERVAL`
  - `STORE_CACHE_TTL`
- `window.shvCheckConfig()` — تحقق من اكتمال التكوين

## الاستخدام في HTML

كل قالب يُحمِّل الملفات الثلاثة في `<head>` قبل الـ main script:

```html
<head>
  ...
  <script src="/shared/theme-router.js"></script>
  <script src="/shared/shipping.js"></script>
  <script src="/shared/supabase.js"></script>
</head>
```

ثم في الـ main script:
```js
// إعادة توجيه القالب
const { store } = await window.fetchStoreFromFirestore(storeId);
if (window.shvRedirectToTheme(store.template || store.theme || '')) return;

// حساب الشحن
const shipping = window.calcShipping(wilaya, subtotal, storeData, 'home');

// قراءة التكوين
const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } = window.SHV_CONFIG;
```

## الصيانة

عند تحديث أي من:
- أسعار الشحن الافتراضية → عدّل `shared/shipping.js` فقط
- Supabase project → عدّل `shared/supabase.js` فقط
- خريطة القوالب → عدّل `shared/theme-router.js` فقط

بدلًا من تعديل 3 ملفات HTML يدويًا.

## ملاحظة

الـ inline definitions ما زالت موجودة في كل HTML (داخل `<script>` closures).
الـ shared modules تُحمَّل أولاً وتُعيِّن `window.*` قبل الـ inline code.
هذا يضمن أن shared module هو المصدر الموحد، حتى لو الـ inline code يُعيد تعريف نفس الدوال.
