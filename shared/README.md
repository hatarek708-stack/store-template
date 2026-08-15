# ShopeVelo — Shared Modules

ملفات JavaScript مشتركة بين كل قوالب المتجر (`black.html`, `neon.html`, `white.html`).

كل ملف هنا هو **المصدر الوحيد** للمنطق الذي يستخدمه كل القوالب الثلاثة.
قبل هذه الملفات، كان كل منطق مكرراً حرفياً (أو شبه حرفياً) في الـ 3 ملفات HTML،
مما يجعل أي تحديث يتطلب تعديل 3 نسخ يدوياً.

## الملفات الحالية

| الملف | الوظيفة | السطور |
|---|---|---|
| `theme-router.js` | إعادة توجيه المستخدم للقالب الصحيح حسب `store.template` | 119 |
| `shipping.js` | جدول الـ 58 ولاية + حساب أسعار الشحن | 89 |
| `supabase.js` | تكوين Supabase + Cloudflare Worker URL | 54 |
| `store-data.js` | جلب بيانات المتجر + المنتجات + المراجعات + Pixels | 444 |
| `orders.js` | حفظ الطلبات + التحقق من الأسعار + استخراج store ID | 184 |
| `cart.js` | عمليات السلة: getCart, setCart, addToCart, updateCartCount | 158 |
| `format.js` | دوال تنسيق: formatPrice, escapeHTML, showToast, renderStars, ... | 160 |

## ترتيب التحميل (مهم)

كل قالب يُحمِّل الملفات بالترتيب التالي في `<head>` قبل الـ main script:

```html
<head>
  ...
  <!-- 1) إعادة توجيه القالب (يُحمَّل أولاً لتفادي وميض الصفحة الخطأ) -->
  <script src="/shared/theme-router.js"></script>
  <!-- 2) جدول الولايات + calcShipping -->
  <script src="/shared/shipping.js"></script>
  <!-- 3) تكوين Supabase (يضع window.SHV_CONFIG) -->
  <script src="/shared/supabase.js"></script>
  <!-- 4) جلب بيانات المتجر + المراجعات + Pixels (يعتمد على window.supabase وقت الاستدعاء) -->
  <script src="/shared/store-data.js"></script>
  <!-- 5) منطق الطلبات: _getStoreId, _effectivePrice, saveOrderData, _shvVerifyOrderPrices -->
  <script src="/shared/orders.js"></script>
  <!-- 6) عمليات السلة -->
  <script src="/shared/cart.js"></script>
  <!-- 7) دوال التنسيق: formatPrice, escapeHTML, showToast, renderStars, ... -->
  <script src="/shared/format.js"></script>
</head>
```

بعد تحميل هذه الملفات، كل قالب يُنفِّذ `<script type="module">` خاص به ينشئ
`supabase` client ويضعه على `window.supabase` حتى تستخدمه `shared/orders.js`
و `shared/store-data.js`:

```js
// داخل <script type="module"> في كل قالب:
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, { ... });
window.supabase = supabase;  // ← مهم لـ shared/orders.js و shared/store-data.js
```

## تفاصيل كل ملف

### `theme-router.js`
يوجّه زوار *.shopevelo.me للقالب الصحيح (white/black/neon) حسب `store.template`.

**المُصدَّر:**
- `window.shvRedirectToTheme(template)` — يُعيد التوجيه لو لزم (يُرجع `true` لو تم، `false` لو لا)
- `window.shvGetThemeFile(template)` — اسم الملف للقالب المُحدَّد
- `window.shvThemeMap` — خريطة القوالب للقراءة فقط

### `shipping.js`
جدول الـ 58 ولاية الجزائرية + حساب أسعار الشحن.

**المُصدَّر:**
- `window.WILAYA_NAME_TO_ID` — خريطة اسم الولاية (إنجليزي) → ID رقمي
- `window.DEFAULT_WILAYA_PRICES` — أسعار الشحن الافتراضية لكل ولاية (home delivery)
- `window.calcShipping(wilaya, subtotal, storeData, deliveryType)` — حساب سعر الشحن
- `window._hasShippingConfig(storeData)` — هل المتجر عرَّف أسعار مخصصة؟

### `supabase.js`
تكوين Supabase + Cloudflare Worker الموحَّد.

**المُصدَّر:**
- `window.SHV_CONFIG` — كائن يحوي `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`,
  `SHV_WORKER_URL`, `STORES_TABLE`, `PRODUCTS_TABLE`, `ORDERS_TABLE`,
  `DEFAULT_PRODUCTS_LIMIT`, `NOTIFICATIONS_POLL_INTERVAL`, `STORE_CACHE_TTL`
- `window.shvCheckConfig()` — تحقق من اكتمال التكوين

### `store-data.js`
جلب بيانات المتجر + المنتجات + المراجعات + إدارة Pixels (CAPI).

**المُصدَّر:**
- `window.fetchStoreData(storeId)` — جلب المتجر + المنتجات من Supabase مع cache
- `window.subscribeToStoreProducts(storeId, onUpdate)` — اشتراك Realtime
- `window._shvFetchAllReviewsMap(storeId)` — جلب كل المراجعات كخريطة
- `window._shvProductRating(p)`, `window._shvProductReviewCount(p)` — حساب التقييم
- `window._shvSubmitProductReview(...)`, `window._shvRefreshProductReviews(...)` — مراجعات
- `window._shvCheckRateLimit()`, `window._shvStampSubmit()`, `window._shvIsRepeatedDigitsPhone(...)` — أمان
- `window.ShvPixels` — IIFE لإدارة Facebook/TikTok/Snap/Google pixels + CAPI

**ملاحظة تاريخية:** الدالة كانت تُسمى `fetchStoreFromFirestore` (مرحلة ما قبل
الهجرة لـ Supabase). أُعيدت التسمية لـ `fetchStoreData` في جولة سابقة.

### `orders.js` (جديد في هذه الجولة)
منطق الطلبات + استخراج store ID + حساب السعر الفعلي.

**المُصدَّر:**
- `window._getStoreId()` — استخراج store ID من hostname أو URL params
- `window._effectivePrice(p)` — حساب السعر بعد الخصم
- `window.saveOrderData(payload)` — حفظ طلب عبر Cloudflare Worker
  (الاسم القديم `saveOrderToFirestore` أُعيدت تسميته هنا — الدالة لا تستخدم Firestore)
- `window._shvVerifyOrderPrices(payload, storeId, wilaya, deliveryType)` — التحقق
  من الأسعار من السيرفر لمنع التلاعب

**يعتمد على:** `window.supabase`, `window.SHV_CONFIG.SHV_WORKER_URL`,
`window.calcShipping`, `window._storeData`.

### `cart.js` (جديد في هذه الجولة)
عمليات السلة الموحَّدة.

**المُصدَّر:**
- `window.getCart()` — قراءة السلة من localStorage
- `window.setCart(c)` — حفظ السلة + تحديث العدّاد
- `window.addToCart(p, size, color, qty)` — إضافة منتج للسلة
  - يدعم fallback لـ size/color لو لم تُمرَّر
  - يستخدم `_effectivePrice` للـ pixel value (أدق مع الخصومات)
  - اختيار صورة دفاعي (لا يفشل لو images فارغة)
- `window.updateCartCount()` — تحديث عدّاد السلة في الـ header

**CART_KEY:** كل قالب يضبط `window.SHV_CART_KEY` قبل استخدام هذه الدوال
(zephyr_cart / noir_cart / neon_cart) لمنع تداخل السلة بين القوالب عند المعاينة.

### `format.js` (جديد في هذه الجولة)
دوال تنسيق و UI صغيرة موحَّدة.

**المُصدَّر:**
- `window.formatDA(n)` / `window.formatPrice(n)` — تنسيق السعر بالدينار (دج / DA)
- `window.escapeHTML(s)` — تجاوز HTML entities لمنع XSS
- `window.discountPercent(price, original)` — حساب نسبة الخصم
- `window.showToast(msg)` — إظهار رسالة toast (مع timer cleanup)
- `window.translateBadge(badge)` — ترجمة بادجات المنتجات
- `window.highlight(text, q)` — إبراز نص البحث في نتائج البحث
- `window.renderStars(rating)` — رسم نجوم التقييم SVG

**يعتمد على:** `currentLang` (global من كل قالب) للـ formatDA، و `t()` (global
من كل قالب) للـ translateBadge.

## ما الذي لم يُستخرَج (ويبقى محلياً لكل قالب)

الدوال التالية **مختلفة بشكل جوهري** بين القوالب ولا يمكن توحيدها دون فقدان ميزة:

- `parseURL()` / `route()` — كل قالب يدعم صفحات مختلفة (white: `success`/`policy`،
  black/neon: `about`/`contact` mapping)
- `productCardHTML()` — تصميم البطاقة مختلف لكل قالب (CSS classes, layout)
- `renderReviewsPanel()` — هيكل الـ HTML و الـ SVG مختلف
- `buildTrustBadgesHTML()` / `freeShippingBadgeHTML()` — تصميم خاص بكل قالب
- `paintStars()` — تستخدم سياق `_wireReviewForm` المحلي (starInput, selectedRating)
- كل دوال `render*Page()` — منطق عرض خاص بكل قالب

هذه الدوال تبقى محلية في كل HTML. راجع `DEAD_CODE_AUDIT.md` لتفاصيل القرار.

## الصيانة

عند تحديث أي من:
- أسعار الشحن الافتراضية → عدّل `shared/shipping.js` فقط
- Supabase project → عدّل `shared/supabase.js` فقط
- خريطة القوالب → عدّل `shared/theme-router.js` فقط
- حقول المتجر/المنتجات الجديدة → عدّل `shared/store-data.js` فقط
- منطق الطلبات أو التحقق من الأسعار → عدّل `shared/orders.js` فقط
- منطق السلة → عدّل `shared/cart.js` فقط
- دوال التنسيق → عدّل `shared/format.js` فقط

بدلًا من تعديل 3 ملفات HTML يدويًا.

## انظر أيضاً

- `DEAD_CODE_AUDIT.md` — تقرير جرد الكود الميت + قرارات الاستخراج
- `P1_FETCH_DIFF_REPORT.md` (في download/) — تقرير فروقات `fetchStoreData` قبل الدمج
