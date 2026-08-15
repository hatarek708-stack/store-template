# DEAD_CODE_AUDIT — جرد الكود الميت في store-template

> أُنشئ قبل بدء أعمال التنظيف. كل عنصر موثّق هنا له مصير محدد:
> **محذوف** / **مُستخرَج** / **غير مؤكد** (يُترك مع توثيق السبب).

## 1) ملخّص التنفيذ

| الفئة | عناصر | مصير |
|---|---|---|
| دوال `window.*` مكررة عبر الثلاثة | 4 (`_getStoreId`, `_effectivePrice`, `_shvVerifyOrderPrices`, `saveOrderToFirestore`) | مُستخرَجة لـ `shared/orders.js` |
| دوال cart مكررة (getCart, setCart, addToCart) | 3 | مُستخرَجة لـ `shared/cart.js` (مع توحيد الفروقات) |
| دوال تنسيق مكررة (formatPrice, escapeHTML, discountPercent, paintStars, formatDA, translateBadge, renderStars, highlight, showToast) | 9 | مُستخرَجة لـ `shared/format.js` |
| دوال URL/routing (parseURL, buildURL, navigate, route) | 4 | غير مؤكد — فروقات حقيقية في الميزات |
| دوال HTML rendering (productCardHTML, renderReviewsPanel, buildTrustBadgesHTML, freeShippingBadgeHTML) | 4 | غير مؤكد — تصميم خاص بكل قالب |
| إشارات Firebase قديمة | 1 (`saveOrderToFirestore` — الاسم قديم لكنه يستخدم Supabase) | يُعاد تسميته لـ `saveOrderData` أثناء النقل |
| دوال `window.*` في shared/*.js غير مستخدمة | 3 (`shvCheckConfig`, `shvGetThemeFile`, `shvThemeMap`) | غير مؤكد — قد تُستخدم للـ debugging |
| IDs مكررة في نفس الملف | 2 في black.html (`sizeValue`, `colorName`) | غير مؤكد — في سياقين مختلفين (product page vs checkout) |
| كتل `<script>` معطّلة | 0 | لا يوجد |

## 2) تفاصيل الدوال المكررة عبر الملفات الثلاثة

### 2.1) `_getStoreId` — متطابقة نصياً 100%

```js
// الثلاثة متطابقون (فقط المسافات البادئة تختلف)
window._getStoreId = function () {
  // extracts store id from subdomain or URL path
  ...
};
```

**الفروقات:** صفر (نصياً وموضوعياً).
**المصير:** مُستخرَج لـ `shared/orders.js` (مع `_effectivePrice` و `_shvVerifyOrderPrices` و `saveOrderToFirestore`).

### 2.2) `_effectivePrice` — متطابقة نصياً 100%

```js
window._effectivePrice = function (p) {
  if (!p) return 0;
  var d = Number(p.discountPrice || p.originalPrice);
  if (d > 0 && d < Number(p.price)) return d;
  return Number(p.price) || 0;
};
```

**الفروقات:** صفر.
**المصير:** مُستخرَج لـ `shared/orders.js`.

### 2.3) `_shvVerifyOrderPrices` — متطابقة منطقياً، فروقات شكلية فقط

white.html يحوي تعليقات توضيحية إضافية (`// Product not found — block the order` وغيرها). black/neon لا يحوونها. المنطق الفعلي متطابق 100%.

**الإجراء:** اعتماد نسخة white (الأكثر توثيقاً) كنسخة موحَّدة في `shared/orders.js`.

### 2.4) `saveOrderToFirestore` — متطابقة نصياً 100% + الاسم قديم

الدالة متطابقة حرفياً عبر الثلاثة. **لكن اسمها قديم** — كانت تستخدم Firestore في مرحلة سابقة، الآن تستخدم Supabase فعلياً.

**الإجراء:** يُعاد تسميتها إلى `saveOrderData` أثناء النقل لـ `shared/orders.js`، وتُحدَّث كل نقاط الاستدعاء.

## 3) تفاصيل دوال السلة (cart)

### 3.1) `getCart` — متطابقة منطقياً

- **white:** `function getCart() { try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; } catch(e) { return []; } }`
- **black/neon:** نفس المنطق لكن مع `catch (e)` (مسافة).

**المصير:** مُستخرَج لـ `shared/cart.js`.

### 3.2) `setCart` — فروقات في موقع `updateCartCount`

- **white:** one-liner يستدعي `updateCartCount()` (دالة منفصلة).
- **black/neon:** inline logic بنفس النتيجة (تحديث `cartCount` element مباشرة).

**الإجراء:** اعتماد نسخة white (أنظف) + توفير `updateCartCount` كدالة موحَّدة أيضاً.

### 3.3) `addToCart` — فروقات حقيقية في السلوك

| الميزة | white | black/neon |
|---|---|---|
| fallback لـ size/color لو لم تُمرَّ | ❌ لا | ✅ `p.sizes[0]` / `p.colors[0].name` |
| حساب pixel value | `p.price` | `_effectivePrice(p)` (يدعم الخصومات) |
| اختيار صورة المنتج | `p.images ? p.images[0] : (p.image\|\|'')` دفاعي | `p.images[0]` قد يفشل لو images فارغة |
| i18n key للـ toast | `added_to_cart` | `toast_added` |

**الإجراء:** اعتماد نسخة موحَّدة تأخذ أفضل من الاثنين:
- ✅ fallback لـ size/color (من black/neon)
- ✅ `_effectivePrice` للـ pixel value (من black/neon — أكثر دقة)
- ✅ اختيار صورة دفاعي (من white)
- ✅ دعم مفتاحي i18n معاً عبر fallback: `t('toast_added') || t('added_to_cart')`

### 3.4) `updateCartCount` — موجودة فقط في white

في black/neon، المنطق inline داخل `setCart`. سيُوحَّد كدالة منفصلة في `shared/cart.js`.

## 4) تفاصيل دوال التنسيق

### 4.1) `formatPrice` / `formatDA`

- **white:** `formatPrice` one-liner مباشر
- **black/neon:** `formatPrice` يستدعي `formatDA` (دالة منفصلة بنفس المنطق)

النتيجة النهائية متطابقة. **الإجراء:** توحيد كـ `formatPrice` واحد في `shared/format.js`.

### 4.2) `escapeHTML` — أنماط مختلفة، نفس النتيجة

- **white:** `String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;')...`
- **black/neon:** `String(s).replace(/[&<>"']/g, function(c) { return {...}[c]; })`

كلاهما يحقق نفس الغرض. نسخة black/neon أقصر برمجياً. **الإجراء:** اعتماد نمط black/neon (regex واحد) لكن مع دعم `nullish coalescing` من white.

### 4.3) `discountPercent` — متطابقة منطقياً

- **white:** one-liner
- **black/neon:** multi-line بنفس المنطق

**الإجراء:** توحيد كـ one-liner.

### 4.4) `paintStars` — فروقات في opacity

- **white:** `opacity = '0.5'` للنجوم غير المفعّلة
- **black/neon:** `opacity = '0.4'`

فرق بصري طفيف. **الإجراء:** توحيد على `0.4` (نسخة black/neon) لأنها أحدث وتستخدم في القوالب الأكثر تطوراً.

### 4.5) `showToast`, `formatDA`, `translateBadge`, `renderStars`, `highlight`

كلها متطابقة منطقياً عبر black/neon. white إما لا يحويها أو يستخدم بدائل inline. **الإجراء:** توحيد كنسخ black/neon.

## 5) عناصر "غير مؤكد" — لا تُحذف

### 5.1) دوال `window.shvCheckConfig`, `window.shvGetThemeFile`, `window.shvThemeMap`

معرّفة في `shared/*.js` لكن 0 استدعاءات في القوالب. قد تُستخدم:
- في dev tools للتشخيص (`window.shvThemeMap` للتحقق من خريطة القوالب)
- في اختبارات يدوية مستقبلية

**الإجراء:** تُترك كما هي. ليست مكلفة (3 أسطر لكل واحدة).

### 5.2) `parseURL` و `route` — فروقات حقيقية في الميزات

- **white** يدعم: صفحة `success`, صفحة `policy`, clean URLs `/product/:slug`
- **black/neon** يدعم: `about`/`contact` mapping لـ `support`, nav-link highlighting

هذه فروقات في الميزات (وليست مجرد تكرار). توحيدها قد يكسر ميزة في قالب معين. **الإجراء:** تُترك كما هي حتى يُقرَّر توحيدها كمشروع منفصل.

### 5.3) `productCardHTML`, `renderReviewsPanel`, `buildTrustBadgesHTML`, `freeShippingBadgeHTML`

كل واحدة منها تختلف بشكل جوهري بين القوالب (CSS classes, inline styles, SVG structure, layout). هذه **تصميم خاص بكل قالب** وليست منطقاً مشتركاً. **الإجراء:** تُترك كما هي.

### 5.4) IDs مكررة في black.html

`sizeValue` و `colorName` يظهران مرتين في black.html — مرة في product page ومرة في checkout page. `getElementById` يرجع الأول فقط، لكن الكود يستخدم `innerHTML` string concatenation لإنشاء الـ DOM، فالـ IDs تُستخدم في سياقات منفصلة بصرياً. **الإجراء:** تُترك مع توصية بإضافة prefix (مثل `checkout-sizeValue`) في جولة مستقبلية.

## 6) كود Firebase القديم

الإشارات الوحيدة المتبقية هي:
- `saveOrderToFirestore` (اسم الدالة) — تم تحويلها فعلياً لاستخدام Supabase لكن الاسم لم يُحدَّث.
- تعليقات توثيقية في `shared/store-data.js` تشرح أن `fetchStoreFromFirestore` (الاسم القديم) أُعيدت تسميته لـ `fetchStoreData`.

**الإجراء:** يُعاد تسمية `saveOrderToFirestore` لـ `saveOrderData` أثناء نقلها لـ `shared/orders.js`. التعليقات التوثيقية تُترك لأنها تشرح تاريخ الهجرة.

## 7) عناصر مؤكدة الموت — قائمة الحذف

بعد الفحص، لم أعثر على عناصر مؤكدة الموت 100% يمكن حذفها بأمان تام دون استخراج. كل "مكرر" سيُعالج عبر **الاستخراج** (نقل لـ shared/) وليس الحذف المباشر. هذا أنسب لأن الهدف هو تقليل التكرار مع الحفاظ على الوظائف.

## 8) خطة التنفيذ

1. إنشاء `shared/orders.js` يحوي: `_getStoreId`, `_effectivePrice`, `_shvVerifyOrderPrices`, `saveOrderData` (الاسم الجديد).
2. إنشاء `shared/cart.js` يحوي: `getCart`, `setCart`, `addToCart`, `updateCartCount`.
3. إنشاء `shared/format.js` يحوي: `formatPrice`, `formatDA`, `escapeHTML`, `discountPercent`, `paintStars`, `showToast`, `translateBadge`, `renderStars`, `highlight`.
4. تحديث كل قالب لاستيراد هذه الملفات + حذف النسخ المحلية.
5. تحديث `shared/README.md` بقائمة كل ملفات shared وترتيب التحميل.
