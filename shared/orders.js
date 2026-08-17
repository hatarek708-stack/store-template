/**
 * ShopeVelo — Shared Orders Logic (مُستخرَج من 3 ملفات HTML)
 * ────────────────────────────────────────────────────────────────
 * يجمع: _getStoreId, _effectivePrice, _shvVerifyOrderPrices, saveOrderData.
 *
 * قبل هذا الملف، كانت هذه الدوال الأربع مكررة حرفياً (أو شبه حرفياً) في
 * white.html, black.html, neon.html — حوالي 100 سطر × 3 = 300 سطر مكرر.
 *
 * الاسم القديم saveOrderToFirestore كان مضلِّاً (الدالة تستخدم Supabase عبر Worker،
 * وليس Firestore). أُعيدت التسمية إلى saveOrderData في هذه الجولة.
 *
 * نمط التصميم: IIFE + تصدير على window — بنفس نمط shared/store-data.js.
 *
 * الترتيب المطلوب للتحميل:
 *   1) shared/supabase.js  (يضع window.SHV_CONFIG)
 *   2) shared/store-data.js  (يعتمد على window.supabase — يُستدعى lazy)
 *   3) shared/orders.js  (هذا الملف — يعتمد على window.supabase و window.SHV_CONFIG)
 *   4) shared/shipping.js  (يوفّر window.calcShipping)
 *
 * ملاحظة هامة: هذا الملف يستخدم window.supabase و window.SHV_CONFIG.SHV_WORKER_URL.
 * كل قالب يجب أن يضبط window.supabase = supabase; بعد إنشاء supabase client
 * في <script type="module"> الخاص به.
 */

(function () {
  'use strict';

  /**
   * استخراج store ID من hostname أو URL params.
   * مثال: my-store.shopevelo.me → "my-store"
   * مثال: ?store=my-store → "my-store"
   * @returns {string}
   */
  window._getStoreId = function () {
    var h = window.location.hostname.toLowerCase();
    var parts = h.split('.');
    if (parts.length >= 3 && parts[parts.length - 2] === 'shopevelo' && parts[parts.length - 1] === 'me') {
      return parts.slice(0, parts.length - 2).join('-');
    }
    var p = new URLSearchParams(window.location.search);
    return (p.get('store') || p.get('id') || '');
  };

  /**
   * حساب السعر الفعلي للمنتج (بعد الخصم لو موجود).
   * @param {object} p - كائن المنتج
   * @returns {number}
   */
  window._effectivePrice = function (p) {
    if (!p) return 0;
    var d = Number(p.discountPrice || p.originalPrice);
    if (d > 0 && d < Number(p.price)) return d;
    return Number(p.price) || 0;
  };

  /**
   * حفظ طلب جديد عبر Cloudflare Worker (الذي يكتبه في Supabase).
   *
   * الاسم القديم saveOrderToFirestore كان مضلِّلاً — الدالة لا تتصل بـ Firestore
   * مباشرة، بل ترسل POST لـ /order endpoint على الـ Worker. أُعيدت التسمية.
   *
   * @param {object} payload - بيانات الطلب
   * @returns {Promise<string>} order ID
   */
  window.saveOrderData = async function (payload) {
    var storeId = (window._storeData && window._storeData.id) || window._getStoreId();
    var workerUrl = (window.SHV_CONFIG && window.SHV_CONFIG.SHV_WORKER_URL);
    if (!workerUrl) throw new Error('SHV_WORKER_URL not configured');

    // ✅ FIX C-09: Forward Turnstile token to the Worker for server-side verification.
    // The Worker validates this token against Cloudflare's siteverify endpoint
    // using the SECRET key (which never leaves the Worker). If the token is missing
    // or invalid, the Worker rejects the order with HTTP 403.
    //
    // Supports both checkout-cart flow and direct-order flow:
    //   - Checkout cart: token stored in window._checkoutTurnstileToken
    //   - Direct order:  token stored in window._directTurnstileToken
    var turnstileToken = payload.turnstile_token || payload.turnstileToken
      || window._directTurnstileToken
      || window._checkoutTurnstileToken
      || '';
    if (!turnstileToken) {
      throw new Error('يرجى إكمال التحقق من الحماية (Turnstile)');
    }
    // Clear the used token (tokens are single-use)
    if (payload.turnstile_token || payload.turnstileToken) {
      // caller passed it explicitly — don't clear global state
    } else if (window._directTurnstileToken) {
      window._directTurnstileToken = '';
    } else if (window._checkoutTurnstileToken) {
      window._checkoutTurnstileToken = '';
    }

    var res = await fetch(workerUrl + '/order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        store_id: storeId,
        name: payload.name || payload.customer?.name || '',
        phone: payload.phone || payload.customer?.phone || '',
        wilaya: payload.wilaya || payload.customer?.wilaya || null,
        commune: payload.commune || payload.customer?.commune || null,
        neighborhood: payload.neighborhood || payload.customer?.neighborhood || null,
        delivery_type: payload.deliveryType || payload.delivery_type || null,
        note: payload.note || null,
        product: payload.product || null,
        items: payload.items || payload.products || null,
        products: payload.products || payload.items || [],
        customer: payload.customer || {},
        pricing: payload.pricing || {},
        subtotal: payload.subtotal ?? payload.pricing?.subtotal ?? null,
        shipping_cost: payload.shippingCost ?? payload.pricing?.shipping_fee ?? null,
        total: payload.total ?? payload.pricing?.total ?? null,
        try_two_sizes: payload.try_two_sizes === true,
        tts_backup_size: payload.tts_backup_size || null,
        turnstile_token: turnstileToken,  // ✅ required by Worker
      }),
    });
    var data = await res.json();
    if (!res.ok || !data.id) throw new Error(data.error || 'Order failed (' + res.status + ')');
    return data.id;
  };

  /**
   * 🔒 SECURITY: Server-side price verification.
   *
   * يُعيد جلب كل منتج من Supabase للحصول على السعر الحقيقي/discount/free_shipping،
   * يُقارنه مع unit_price المُرسَل من العميل، ويُستبدل بقيمة الخادم عند أي اختلاف.
   * يمنع تلاعب الأسعار والطلبات الوهمية.
   *
   * كما يُعيد حساب الشحن: 0 لو كل المنتجات free_shipping=true، وإلا فالسعر العادي حسب الولاية.
   *
   * @param {object} payload - حمولة الطلب (تُعدَّل في مكانه)
   * @param {string} storeId - معرّف المتجر
   * @param {string} wilayaName - اسم الولاية
   * @param {string} deliveryType - 'home' أو 'office'
   * @returns {Promise<object>} payload بعد التعديل
   */
  window._shvVerifyOrderPrices = async function (payload, storeId, wilayaName, deliveryType) {
    if (!payload || !Array.isArray(payload.items) || payload.items.length === 0) return payload;

    // window.supabase يجب أن يكون مضبوطاً من <script type="module"> في القالب
    var supabase = window.supabase;
    if (!supabase) {
      console.error('[orders.js] window.supabase not available — skipping verification');
      return payload;
    }

    var verifiedItems = [];
    for (var i = 0; i < payload.items.length; i++) {
      var item = payload.items[i];
      var productId = item && item.id ? String(item.id) : '';
      if (!productId) { verifiedItems.push(item); continue; }

      var result = await supabase.from('products')
        .select('price,discount_price,free_shipping')
        .eq('store_id', storeId)
        .eq('id', productId)
        .maybeSingle();
      var prodRow = result && result.data ? result.data : null;
      var prodErr = result && result.error ? result.error : null;

      if (prodErr || !prodRow) {
        // Product not found — block the order
        throw new Error('Product not found: ' + productId);
      }

      var realPrice = (typeof window._effectivePrice === 'function')
        ? window._effectivePrice({ price: Number(prodRow.price) || 0, discountPrice: prodRow.discount_price != null ? Number(prodRow.discount_price) : null })
        : (prodRow.discount_price != null && Number(prodRow.discount_price) > 0 ? Number(prodRow.discount_price) : Number(prodRow.price) || 0);

      var clientPrice = Number(item.unit_price) || 0;
      if (Math.abs(realPrice - clientPrice) > 1) {
        // Price mismatch — override with server price
        console.warn('Price mismatch detected for product ' + productId, { client: clientPrice, server: realPrice });
        item.unit_price = realPrice;
        item.line_total = realPrice * (Number(item.qty) || 1);
      }
      item.free_shipping = prodRow.free_shipping === true;
      verifiedItems.push(item);
    }

    payload.items = verifiedItems;

    // Recompute subtotal
    var verifiedSubtotal = verifiedItems.reduce(function (s, i) {
      return s + (Number(i.line_total) || (Number(i.unit_price) * Number(i.qty)));
    }, 0);
    if (!payload.pricing) payload.pricing = {};
    payload.pricing.subtotal = verifiedSubtotal;
    payload.subtotal = verifiedSubtotal;

    // Recompute shipping: 0 if ALL items have free_shipping=true
    var allFreeShipping = verifiedItems.every(function (i) { return i.free_shipping === true; });
    var shipping = 0;
    if (!allFreeShipping) {
      shipping = (typeof window.calcShipping === 'function')
        ? window.calcShipping(wilayaName || '', verifiedSubtotal, window._storeData, deliveryType)
        : 0;
    }
    payload.pricing.shipping_fee = shipping;
    payload.shippingCost = shipping;
    payload.pricing.total = verifiedSubtotal + shipping;
    payload.total = verifiedSubtotal + shipping;

    return payload;
  };

})();
