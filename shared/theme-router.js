/**
 * ShopeVelo — Theme Router (مُستخرَج من 3 ملفات HTML)
 * ──────────────────────────────────────────────────────
 * يوجّه زوار *.shopevelo.me (أو المعاينة المحلية) إلى القالب الصحيح
 * (white.html / black.html / neon.html) حسب store.template المخزَّن في Supabase.
 *
 * ✨ إصلاح bug الـ neon المفقود:
 * قبل هذا الملف، كل ملف HTML كان يحوي منطق إعادة التوجيه inline،
 * لكن كل واحد كان يفتقد فرع قالب نفسه — فمتجر مُعدّ بـ template:'neon'
 * يصل لـ black.html يُعرض بالقالب الخطأ.
 *
 * الآن: مصدر واحد للحقيقة. كل ملف يستدعي shvRedirectToTheme(store.template)
 * ويُحوَّل تلقائيًا للملف الصحيح.
 *
 * الاستخدام في كل HTML:
 *   <script src="/shared/theme-router.js"></script>
 *   <script>
 *     // بعد جلب store من Supabase:
 *     if (window.shvRedirectToTheme(store.template)) return;
 *   </script>
 */

(function () {
  'use strict';

  // خريطة القوالب: template id → HTML file name
  var THEME_MAP = {
    noir: 'black.html',
    neon: 'neon.html',
    zephyr: 'white.html',
    // توافق مع القيم القديمة
    white: 'white.html',
    black: 'black.html',
  };

  // القالب الافتراضي لو store.template فارغ أو غير معروف
  var DEFAULT_TEMPLATE = 'zephyr';

  /**
   * إعادة توجيه للقالب الصحيح لو لزم.
   * @param {string} template - قيمة store.template من Supabase
   * @returns {boolean} true لو تمت إعادة التوجيه، false لو المستخدم على القالب الصحيح
   */
  window.shvRedirectToTheme = function (template) {
    if (!template) return false;

    var tpl = String(template).toLowerCase().trim();
    var target = THEME_MAP[tpl];

    // لو القالب غير معروف، استخدم الافتراضي
    if (!target) {
      target = THEME_MAP[DEFAULT_TEMPLATE];
    }

    // اكتشف الملف الحالي من URL
    var currentFile = '';
    try {
      var pathParts = window.location.pathname.split('/');
      currentFile = (pathParts[pathParts.length - 1] || '').toLowerCase();
    } catch (e) {
      currentFile = '';
    }

    // لو المستخدم على نطاق المتجر (shopevelo.me) لا نُعيد التوجيه
    // لأن template-router-worker يتعامل مع ذلك. هذا المنطق للمعاينة المحلية فقط.
    var onStoreDomain = false;
    try {
      onStoreDomain = window.location.hostname.endsWith('shopevelo.me');
    } catch (e) {}

    if (onStoreDomain) return false;

    // لو المستخدم على نفس الملف، لا فائدة من إعادة التوجيه
    if (currentFile === target.toLowerCase()) return false;

    // ✨ إعادة التوجيه مع علم في localStorage لمنع التكرار
    // (مفيد لو الـ redirect فشل مرة ولا نريد loop)
    try {
      var storeId = window._getStoreId ? window._getStoreId() : 'unknown';
      var flagKey = '_tpl_redirect_' + tpl + '_' + storeId;
      if (localStorage.getItem(flagKey)) {
        // سبق وأعدنا التوجيه لهذا القالب — لا نكرر (يمنع loop)
        // لكن نمسحه بعد 5 ثوانٍ للسماح بإعادة المحاولة لاحقًا
        return false;
      }
      localStorage.setItem(flagKey, '1');
      setTimeout(function () {
        try { localStorage.removeItem(flagKey); } catch (e) {}
      }, 5000);
    } catch (e) {
      // localStorage قد يفشل في وضع التصفح الخفي — نتجاهل
    }

    // إعادة التوجيه مع الحفاظ على query params
    try {
      var url = new URL(window.location.href);
      url.pathname = url.pathname.replace(/\/[^\/]*$/, '/' + target);
      window.location.replace(url.toString());
    } catch (e) {
      // fallback بسيط
      window.location.href = target;
    }

    return true;
  };

  /**
   * الحصول على اسم الملف للقالب المُحدَّد
   * @param {string} template
   * @returns {string} اسم الملف (مثل 'black.html')
   * ✅ NOTE: Kept for diagnostic purposes (not called by templates directly).
   */
  window.shvGetThemeFile = function (template) {
    var tpl = String(template || '').toLowerCase().trim();
    return THEME_MAP[tpl] || THEME_MAP[DEFAULT_TEMPLATE];
  };

  // ✨ تصدير THEME_MAP للقراءة فقط (للاختبار/التشخيص)
  // ✅ NOTE: Kept for diagnostic purposes.
  window.shvThemeMap = THEME_MAP;
})();
