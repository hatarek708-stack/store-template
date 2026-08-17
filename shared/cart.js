/**
 * ShopeVelo — Shared Cart Logic (مُستخرَج من 3 ملفات HTML)
 * ────────────────────────────────────────────────────────────────
 * يجمع: getCart, setCart, addToCart, updateCartCount.
 *
 * قبل هذا الملف، كانت هذه الدوال مكررة في white.html, black.html, neon.html
 * مع فروقات حقيقية في السلوك:
 *   - white: لا يوجد fallback لـ size/color، يستخدم p.price للـ pixel،
 *            اختيار صورة دفاعي (p.images ? p.images[0] : (p.image||''))
 *   - black/neon: fallback لـ size/color، يستخدم _effectivePrice للـ pixel،
 *                  اختيار صورة مباشر (p.images[0])
 *
 * النسخة الموحَّدة تأخذ أفضل من الاثنين:
 *   ✅ fallback لـ size/color (من black/neon)
 *   ✅ _effectivePrice للـ pixel value (من black/neon — أكثر دقة مع الخصومات)
 *   ✅ اختيار صورة دفاعي (من white — لا يفشل لو images فارغة)
 *   ✅ دعم مفتاحي i18n معاً (toast_added مع fallback لـ added_to_cart)
 *
 * CART_KEY يختلف لكل قالب (zephyr_cart / noir_cart / neon_cart) — لمنع تداخل
 * سلة المتجر بين القوالب عند المعاينة. كل قالب يضبط window.SHV_CART_KEY قبل
 * استدعاء هذه الدوال، أو يتم استخدام الافتراضي 'shv_cart'.
 *
 * نمط التصميم: IIFE + تصدير على window.
 *
 * الترتيب المطلوب للتحميل:
 *   1) shared/supabase.js
 *   2) shared/store-data.js (يوفّر ShvPixels IIFE)
 *   3) shared/orders.js (يوفّر _effectivePrice)
 *   4) shared/cart.js  (هذا الملف)
 *   5) shared/shipping.js
 *
 * ملاحظة: الدوال تُصدَّر على window، لكن القوالب يمكنها تعريف aliases محلية
 * بدون window. prefix (مثل: var getCart = window.getCart;) للتوافق مع الكود الموجود.
 */

(function () {
  'use strict';

  // CART_KEY افتراضي — يمكن لكل قالب تجاوزه بضبط window.SHV_CART_KEY قبل الاستدعاء
  var DEFAULT_CART_KEY = 'shv_cart';

  function _cartKey() {
    return window.SHV_CART_KEY || DEFAULT_CART_KEY;
  }

  /**
   * قراءة السلة من localStorage.
   * @returns {Array} مصفوفة عناصر السلة (أو [] لو لم توجد/فاسدة)
   */
  window.getCart = function () {
    try {
      var raw = localStorage.getItem(_cartKey());
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  };

  /**
   * حفظ السلة + تحديث عدّاد السلة في الـ header.
   * @param {Array} c - مصفوفة عناصر السلة
   */
  window.setCart = function (c) {
    try {
      localStorage.setItem(_cartKey(), JSON.stringify(c));
    } catch (e) {
      // localStorage قد يفشل في الوضع الخفي أو عند امتلاء المساحة
    }
    window.updateCartCount();
  };

  /**
   * تحديث رقم عدّاد السلة في الـ header.
   * يبحث عن عنصر بـ id="cartCount" ويحدّث نصه بإجمالي الكميات.
   */
  window.updateCartCount = function () {
    var cart = window.getCart();
    var total = 0;
    for (var i = 0; i < cart.length; i++) {
      total += Number(cart[i].qty) || 0;
    }
    var el = document.getElementById('cartCount');
    if (el) el.textContent = total;
  };

  /**
   * إضافة منتج للسلة.
   *
   * @param {object} p - كائن المنتج (id, name, price, image, images, sizes, colors)
   * @param {string} [size] - المقاس المختار (اختياري — يُستخدم fallback لو لم يُمرَّر)
   * @param {string} [color] - اللون المختار (اختياري)
   * @param {number} [qty=1] - الكمية
   */
  window.addToCart = function (p, size, color, qty) {
    if (!p) return;
    qty = Number(qty) || 1;

    // ✅ fallback لـ size/color لو لم تُمرَّر (من black/neon)
    if (!size && p.sizes && p.sizes.length > 0) size = p.sizes[0];
    if (!color && p.colors && p.colors.length > 0) {
      // p.colors قد يكون مصفوفة strings أو {name, hex}
      color = typeof p.colors[0] === 'string' ? p.colors[0] : (p.colors[0].name || p.colors[0].hex || '');
    }

    var cart = window.getCart();
    // البحث عن عنصر موجود بنفس id+size+color لزيادة الكمية
    var existing = null;
    for (var i = 0; i < cart.length; i++) {
      if (cart[i].id === p.id && cart[i].size === size && cart[i].color === color) {
        existing = cart[i];
        break;
      }
    }

    if (existing) {
      existing.qty += qty;
    } else {
      // ✅ اختيار صورة دفاعي (من white) — لا يفشل لو images فارغة
      var image = '';
      if (p.images && p.images.length > 0) image = p.images[0];
      else if (p.image) image = p.image;

      cart.push({
        id: p.id,
        name: p.name,
        price: p.price,
        image: image,
        size: size,
        color: color,
        qty: qty
      });
    }

    window.setCart(cart);

    // ✅ toast مع دعم مفتاحي i18n (toast_added أحدث، added_to_cart للتوافق)
    var toastMsg = (typeof t === 'function')
      ? (t('toast_added') || t('added_to_cart'))
      : 'Added to cart';
    if (typeof window.showToast === 'function') {
      window.showToast(p.name + ' — ' + toastMsg);
    }

    // ✅ Pixel: AddToCart — يستخدم _effectivePrice (من black/neon — أكثر دقة مع الخصومات)
    if (typeof window.ShvPixels === 'object' && window.ShvPixels.track) {
      var pixelValue = (typeof window._effectivePrice === 'function')
        ? window._effectivePrice(p)
        : p.price;
      window.ShvPixels.track('AddToCart', {
        content_ids: [String(p.id)],
        content_name: p.name,
        value: pixelValue,
        currency: 'DZD'
      });
    }
  };

})();
