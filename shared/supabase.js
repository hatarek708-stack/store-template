/**
 * ShopeVelo — Shared Supabase Config (مُستخرَج من 3 ملفات HTML)
 * ────────────────────────────────────────────────────────────────
 * قيم Supabase + Cloudflare Worker الموحَّدة لكل القوالب.
 *
 * قبل هذا الملف، كان SUPABASE_URL و SUPABASE_PUBLISHABLE_KEY و SHV_WORKER_URL
 * مكررين في 3 ملفات HTML. تغيير أي قيمة (مثلاً عند نقل Supabase project)
 * كان يتطلب تعديل 3 ملفات يدويًا.
 *
 * الآن: مصدر واحد. كل قالب يستورد هذا الملف.
 *
 * ملاحظة: هذا ملف عادي (not ES module) لأنه يُحمَّل قبل الـ module script.
 * القيم تُخزَّن على window.SHV_CONFIG للاستخدام من قبل أي script.
 */

(function () {
  'use strict';

  // ✨ تكوين Supabase — موحَّد لكل القوالب
  // للتبديل لمشروع Supabase آخر، عدّل هنا فقط (لا في 3 ملفات HTML)
  window.SHV_CONFIG = {
    SUPABASE_URL: 'https://tgqkathfzrnkiyxwzkbc.supabase.co',
    SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_MnDIdSEFp9UrLmvC0Y2k4g_Tp74iXHb',
    SHV_WORKER_URL: 'https://ai-proxy-worker.hatarek708.workers.dev',

    // ✅ Cloudflare Turnstile Site Key (public, safe for browser).
    // Used in the checkout page to prevent bot orders.
    // The matching Secret Key is stored only in the Worker (TURNSTILE_SECRET_KEY).
    // Both keys are configured as encrypted Cloudflare secrets:
    //   - VITE_TURNSTILE_SITE_KEY → Pages env var (both projects, secret_text)
    //   - TURNSTILE_SECRET_KEY    → Worker secret (secret_text, never exposed)
    TURNSTILE_SITE_KEY: '0x4AAAAAAESDjRPyoslSm8_i',

    // اسم الجدول الرئيسي للمتاجر
    STORES_TABLE: 'stores',

    // اسم الجدول الرئيسي للمنتجات
    PRODUCTS_TABLE: 'products',

    // اسم الجدول الرئيسي للطلبات
    ORDERS_TABLE: 'orders',

    // عدد المنتجات الافتراضي للمعاينة
    DEFAULT_PRODUCTS_LIMIT: 50,

    // مدة polling الإشعارات (مللي ثانية)
    NOTIFICATIONS_POLL_INTERVAL: 2 * 60 * 1000, // 2 دقيقة

    // مدة cache المتجر في localStorage (مللي ثانية)
    STORE_CACHE_TTL: 5 * 60 * 1000, // 5 دقائق
  };

  // ✨ helper للتحقق من تكوين Supabase
  window.shvCheckConfig = function () {
    var cfg = window.SHV_CONFIG;
    if (!cfg.SUPABASE_URL || !cfg.SUPABASE_PUBLISHABLE_KEY) {
      console.error('[ShopeVelo] ⚠️ SHV_CONFIG missing SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY');
      return false;
    }
    return true;
  };
})();
