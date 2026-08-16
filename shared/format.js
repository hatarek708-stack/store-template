/**
 * ShopeVelo — Shared Format & UI Helpers (مُستخرَج من 3 ملفات HTML)
 * ────────────────────────────────────────────────────────────────
 * يجمع دوال التنسيق و الـ UI الصغيرة المتكررة عبر القوالب:
 *   - formatPrice / formatDA — تنسيق الأسعار بالدينار الجزائري
 *   - escapeHTML — تجاوز HTML entities لمنع XSS
 *   - discountPercent — حساب نسبة الخصم
 *   - showToast — إظهار رسالة toast
 *   - translateBadge — ترجمة بادجات المنتجات (Best Seller, New Arrival, Thrift Pick)
 *   - highlight — إبراز نص البحث في نتائج البحث
 *   - renderStars — رسم نجوم التقييم بصيغة SVG
 *
 * قبل هذا الملف، كانت هذه الدوال مكررة في white.html, black.html, neon.html
 * بأنماط مختلفة (white one-liners، black/neon multi-line) لكن بنفس المنطق الفعلي.
 *
 * الفروقات التي وُحِّدت:
 *   - escapeHTML: white يستخدم chain of .replace()، black/neon يستخدم regex واحد +
 *     lookup table. اعتمدنا نمط black/neon (أقصر) لكن مع دعم nullish (s ?? '')
 *     من white.
 *   - showToast: white بدون timer cleanup، black/neon clearTimeout للـ timer
 *     السابق. اعتمدنا نسخة black/neon (تمنع تراكم الـ timers).
 *   - paintStars: متروكة محلية لأنها تعتمد على سياق _wireReviewForm (starInput،
 *     selectedRating) — لا يمكن نقلها بسهولة.
 *
 * نمط التصميم: IIFE + تصدير على window.
 *
 * الترتيب المطلوب للتحميل:
 *   1) shared/supabase.js
 *   2) shared/store-data.js
 *   3) shared/orders.js
 *   4) shared/cart.js
 *   5) shared/shipping.js
 *   6) shared/format.js  (هذا الملف)
 *
 * ملاحظة: الدوال تعتمد على وجود `t()` (i18n translator) و `currentLang` كـ globals
 * يوفّرها كل قالب في script الخاص به. هذا مقبول لأن `t` و `currentLang` يختلفان
 * بين القوالب (كل قالب له قاموس i18n خاص).
 */

(function () {
  'use strict';

  /**
   * تنسيق رقم بفاصل آلاف (en-US) + لاحقة العملة (دج / DA) حسب اللغة الحالية.
   * @param {number|string} n - الرقم
   * @returns {string}
   */
  window.formatDA = function (n) {
    var numStr = Number(n).toLocaleString('en-US');
    // currentLang يجب أن يكون متاحاً كـ global من كل قالب
    var lang = (typeof currentLang !== 'undefined') ? currentLang : 'ar';
    return lang === 'ar' ? (numStr + ' دج') : (numStr + ' DA');
  };

  // Alias: formatPrice = formatDA (للتوافق مع الكود الموجود)
  window.formatPrice = window.formatDA;

  /**
   * تجاوز HTML entities لمنع XSS.
   * يدعم nullish input (يُرجع '' للقيم null/undefined).
   * @param {string} s
   * @returns {string}
   */
  window.escapeHTML = function (s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  /**
   * ✅ FIX C-08: Safe image src — validates URL scheme + escapes HTML.
   * Prevents XSS via <img src="x" onerror="..."> attacks.
   *
   * Accepts: http://, https://, data:image/* (for user-uploaded base64).
   * Rejects: javascript:, vbscript:, file:, and anything else.
   * Returns: escaped URL string, or '' if invalid.
   */
  window.safeImageSrc = function (url) {
    if (typeof url !== 'string') return '';
    var trimmed = url.trim();
    if (!trimmed) return '';
    // Only allow http(s) and data:image/* (for base64 thumbnails)
    if (/^https?:\/\//i.test(trimmed) || /^data:image\//i.test(trimmed)) {
      if (trimmed.length <= 10000) {
        return window.escapeHTML(trimmed);
      }
    }
    return '';
  };

  /**
   * ✅ FIX C-08b: Safe URL for href — prevents javascript: URI injection.
   * Use this on any <a href="..."> where the URL comes from store/user data.
   *
   * Accepts: http://, https://, protocol-relative //, mailto:, tel:.
   * Rejects: javascript:, vbscript:, and anything else.
   * Returns: the URL if safe, otherwise '#'.
   */
  window.safeUrl = function (url) {
    if (typeof url !== 'string') return '#';
    var trimmed = url.trim();
    if (!trimmed) return '#';
    if (/^https?:\/\//i.test(trimmed)) return trimmed.slice(0, 2048);
    if (trimmed.charAt(0) === '/' && trimmed.charAt(1) === '/') return trimmed.slice(0, 2048);
    if (/^mailto:/i.test(trimmed)) return trimmed.slice(0, 256);
    if (/^tel:/i.test(trimmed)) return trimmed.slice(0, 30);
    return '#';
  };

  /**
   * حساب نسبة الخصم بين السعر الأصلي والسعر بعد الخصم.
   * @param {number} price - السعر الحالي
   * @param {number} original - السعر الأصلي
   * @returns {number} نسبة مئوية (0 لو لا يوجد خصم)
   */
  window.discountPercent = function (price, original) {
    if (!original || original <= price) return 0;
    return Math.round(((original - price) / original) * 100);
  };

  /**
   * إظهار رسالة toast في الـ header.
   * تستخدم عنصرين: #toast (الحاوية) و #toastMsg (النص).
   * لو #toastMsg غير موجود، تستخدم textContent على #toast مباشرة (توافق مع white).
   * @param {string} msg
   */
  window.showToast = function (msg) {
    var toast = document.getElementById('toast');
    if (!toast) return;

    var msgEl = document.getElementById('toastMsg');
    if (msgEl) {
      msgEl.textContent = msg;
    } else {
      toast.textContent = msg;
    }

    toast.classList.add('show');
    // clearTimeout للـ timer السابق — يمنع تراكم الـ timers لو استُدعيت showToast
    // بسرعة عدة مرات (من black/neon)
    if (window.__toastTimer) {
      clearTimeout(window.__toastTimer);
    }
    window.__toastTimer = setTimeout(function () {
      toast.classList.remove('show');
    }, 2500);
  };

  /**
   * ترجمة بادجات المنتجات حسب اللغة الحالية.
   * @param {string} badge - 'Best Seller' / 'New Arrival' / 'Thrift Pick'
   * @returns {string} الترجمة أو القيمة الأصلية لو لم تُوجد
   */
  window.translateBadge = function (badge) {
    if (!badge) return '';
    // t() يجب أن تكون متاحة كـ global من كل قالب
    if (typeof t !== 'function') return badge;
    var map = {
      'Best Seller': t('best_seller'),
      'New Arrival': t('new_arrival'),
      'Thrift Pick': t('thrift_pick')
    };
    return map[badge] || badge;
  };

  /**
   * إبراز نص البحث في نتائج البحث بـ <mark>.
   * @param {string} text - النص الأصلي
   * @param {string} q - استعلام البحث
   * @returns {string} HTML مع <mark> حول التطابقات
   */
  window.highlight = function (text, q) {
    if (!q) return window.escapeHTML(text);
    var safe = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return window.escapeHTML(text).replace(new RegExp('(' + safe + ')', 'gi'), '<mark class="neon-mark">$1</mark>');
  };

  /**
   * رسم نجوم التقييم بصيغة SVG (5 نجوم: full / half / empty).
   * @param {number} rating - التقييم (0-5)
   * @returns {string} HTML string
   */
  window.renderStars = function (rating) {
    var full = Math.floor(rating);
    var hasHalf = rating - full >= 0.25 && rating - full < 0.75;
    var empty = 5 - full - (hasHalf ? 1 : 0);
    var html = '';
    var starPath = '<svg fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>';
    for (var i = 0; i < full; i++) html += starPath;
    if (hasHalf) {
      html += '<svg class="empty" fill="currentColor" viewBox="0 0 24 24"><defs><linearGradient id="halfGrad"><stop offset="50%" stop-color="currentColor"/><stop offset="50%" stop-color="#d1d5db"/></linearGradient></defs><path fill="url(#halfGrad)" d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>';
    }
    for (var j = 0; j < empty; j++) {
      html += '<svg class="empty" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>';
    }
    return html;
  };

  /**
   * ✅ FIX C-09: Cloudflare Turnstile integration for checkout.
   *
   * The Turnstile token is stored in `window._checkoutTurnstileToken` and
   * automatically included by `shared/orders.js → saveOrderData()` in the
   * POST /order payload. The Worker validates it server-side.
   *
   * Templates register `data-callback="onCheckoutTurnstileSuccess"` on the
   * widget div — this global is called by Turnstile when the user solves
   * the challenge. The place-order button is disabled until a token exists.
   */
  window._checkoutTurnstileToken = '';
  window.onCheckoutTurnstileSuccess = function (token) {
    window._checkoutTurnstileToken = token || '';
    // Enable the place-order button once the user has solved the challenge
    var btn = document.getElementById('placeOrderBtn');
    if (btn) btn.disabled = false;
  };

  /**
   * Reset the Turnstile widget — call this after a failed order so the user
   * can re-solve the challenge (tokens are single-use).
   */
  window.resetCheckoutTurnstile = function () {
    window._checkoutTurnstileToken = '';
    var btn = document.getElementById('placeOrderBtn');
    if (btn) btn.disabled = true;
    if (window.turnstile && typeof window.turnstile.reset === 'function') {
      try { window.turnstile.reset('#checkout-turnstile-widget'); } catch (e) { /* noop */ }
    }
  };

})();
