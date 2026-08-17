/**
 * ShopeVelo — Shared Store Data Logic (مُستخرَج من 3 ملفات HTML)
 * ────────────────────────────────────────────────────────────────
 * يجمع: fetchStoreData + subscribeToStoreProducts + كل دوال
 * المراجعات/التقييم/الأمان المساعدة + ShvPixels IIFE.
 *
 * قبل هذا الملف، كان fetchStoreFromFirestore (الاسم القديم المضلِّل — الدالة
 * تستعلم من Supabase فعلياً وليس Firestore) مكرراً في black.html, neon.html,
 * white.html بأحجام متفاوتة (173KB vs 340KB) مع اختلافات حقيقية في الحقول
 * المُستجلَبة ومعالجتها. راجع P1_FETCH_DIFF_REPORT.md لتفاصيل الفروقات قبل الدمج.
 *
 * الآن: مصدر واحد. كل قالب يستورد هذا الملف ويستدعي window.fetchStoreData().
 *
 * الدالة الموحَّدة تأخذ **اتحاد** كل الحقول الموجودة في أي قالب، فلا تُفقَد
 * أي ميزة كانت موجودة في قالب واحد فقط.
 *
 * نمط التصميم: IIFE + تصدير على window — بنفس نمط shared/shipping.js و shared/supabase.js.
 *
 * الترتيب المطلوب للتحميل في القالب:
 *   1) shared/supabase.js  (يضع window.SHV_CONFIG + ينشئ window.supabase)
 *   2) shared/store-data.js  (هذا الملف — يعتمد على window.supabase)
 *   3) shared/shipping.js
 *   4) shared/theme-router.js
 *   5) منطق القالب الخاص
 */

(function () {
  'use strict';

  // ===== Reviews / rating helpers (متطابقة عبر القوالب الثلاثة — منقولة كما هي) =====

  /**
   * جلب كل مراجعات المتجر (من جدول product_reviews) كخريطة productId → array
   * @param {string} storeId
   * @returns {Promise<Object<string, Array>>}
   */
  window._shvFetchAllReviewsMap = async function (storeId) {
    if (!storeId) return {};
    try {
      var { data: rows } = await supabase.from('product_reviews')
        .select('product_id, customer_name, rating, comment, created_at')
        .eq('store_id', storeId)
        .order('created_at', { ascending: false })
        .limit(500);
      var map = {};
      (rows || []).forEach(function (r) {
        var pid = String(r.product_id);
        if (!map[pid]) map[pid] = [];
        map[pid].push({
          name: r.customer_name || 'Anonymous',
          rating: Number(r.rating) || 0,
          comment: r.comment || '',
          date: r.created_at ? String(r.created_at).split('T')[0] : ''
        });
      });
      return map;
    } catch (e) {
      return {};
    }
  };

  // متوسط التقييم من المراجعات الحقيقية فقط (بدون افتراضات وهمية)
  window._shvProductRating = function (p) {
    if (!p) return 0;
    var rd = Array.isArray(p.reviews_data) ? p.reviews_data : (Array.isArray(p.reviewsData) ? p.reviewsData : []);
    if (rd.length === 0) return 0;
    var sum = 0, n = 0;
    for (var i = 0; i < rd.length; i++) {
      var v = Number(rd[i].rating);
      if (v > 0 && v <= 5) { sum += v; n++; }
    }
    if (n === 0) return 0;
    return Math.round((sum / n) * 10) / 10;
  };

  // عدد المراجعات الحقيقية فقط
  window._shvProductReviewCount = function (p) {
    if (!p) return 0;
    var rd = Array.isArray(p.reviews_data) ? p.reviews_data : (Array.isArray(p.reviewsData) ? p.reviewsData : []);
    return rd.length;
  };

  // إرسال مراجعة عميل إلى الـ worker (يُدرجها في product_reviews)
  window._shvSubmitProductReview = async function (storeId, productId, customerName, rating, comment) {
    var workerUrl = (window.SHV_CONFIG && window.SHV_CONFIG.SHV_WORKER_URL) || window._SHV_WORKER_URL;
    var res = await fetch(workerUrl + '/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        store_id: storeId,
        product_id: String(productId),
        customer_name: customerName,
        rating: rating,
        comment: comment
      })
    });
    var data;
    try { data = await res.json(); } catch (e) { data = {}; }
    if (!res.ok) {
      var errMsg = (data && data.error) || 'Failed to submit review';
      throw new Error(errMsg);
    }
    return data;
  };

  // إعادة جلب مراجعات منتج واحد من Supabase بعد إرسال مراجعة (لتحديث الـ Reviews tab)
  window._shvRefreshProductReviews = async function (storeId, productId) {
    try {
      const { data: reviewRows } = await supabase.from('product_reviews')
        .select('customer_name, rating, comment, created_at')
        .eq('store_id', storeId)
        .eq('product_id', String(productId))
        .order('created_at', { ascending: false })
        .limit(50);
      var mapped = (Array.isArray(reviewRows) ? reviewRows : []).map(function (r) {
        return {
          name: r.customer_name || 'Anonymous',
          rating: Number(r.rating) || 0,
          comment: r.comment || '',
          date: r.created_at ? String(r.created_at).split('T')[0] : ''
        };
      });
      return mapped;
    } catch (e) {
      return null;
    }
  };

  // ===== Security utils =====
  window._shvCheckRateLimit = function () {
    var last = parseInt(localStorage.getItem('shv_last_submit_ts') || '0', 10);
    var diff = Date.now() - last;
    if (diff < 45000) return Math.ceil((45000 - diff) / 1000);
    return 0;
  };
  window._shvStampSubmit = function () { localStorage.setItem('shv_last_submit_ts', String(Date.now())); };
  window._SHV_PAGE_LOAD_TS = Date.now();
  window._SHV_FIRST_FOCUS_TS = null; // يُضبط عند أول focus على حقل — لاكتشاف الإرسال الفوري الآلي (بوت)
  window._shvIsRepeatedDigitsPhone = function (phone) {
    // رفض أرقام واضحة التزييف مثل 0555555555, 0666666666, 0777777777
    if (!phone) return false;
    var s = String(phone).replace(/\D/g, '');
    if (s.length < 4) return false;
    var tail = s.substring(2); // تخطّي 05/06/07
    if (!tail.length) return false;
    var first = tail.charAt(0);
    for (var i = 1; i < tail.length; i++) { if (tail.charAt(i) !== first) return false; }
    return true;
  };

  // ===== ShvPixels (CAPI + browser pixels) =====
  // IIFE متطابق عبر القوالب الثلاثة — منقول كما هو مع توحيد تسمية المتغيرات الداخلية
  //
  // 🔒 PRIVACY: لا تُرسَل أي بيانات PII (email/phone) عبر هذا المسار.
  //    فقط: event name, value, currency, content_ids, content_name, num_items.
  //    الـ Worker يحصل على CAPI tokens من store_finance (server-side) — لا تصل للمتصفح.
  //    client_ip + client_user_agent يُرسِلهم الـ Worker إلى FB/TT (مشتقّة من الـ request).
  //
  // 🔧 EVENTS WHITELIST: كل منصة لها قائمة أحداث مختارة من صاحب المتجر
  //    (في PixelsTab). نقوم بقراءتها من storeData ونفرضها قبل إطلاق أي حدث.
  //    لو لم تُضبط القائمة، نستخدم الافتراضية (DEFAULT_EVENTS).
  window.ShvPixels = (function () {
    var inited = false, ids = {};

    // الأحداث الافتراضية لو لم يُحدّد المستخدم قائمة مخصصة
    var DEFAULT_EVENTS = ['PageView', 'ViewContent', 'AddToCart', 'InitiateCheckout', 'Purchase'];

    function _genEventId() { return Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 9); }
    function loadScript(src) { var s = document.createElement('script'); s.async = true; s.src = src; document.head.appendChild(s); }
    function initFacebook(id) { if (!id || window.fbq) return; !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js'); window.fbq('init', id); }
    function initTikTok(id) { if (!id || window.ttq) return; !function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"];ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{};ttq._i[e]=[];ttq._i[e]._u=i;ttq._t=ttq._t||{};ttq._t[e]=+new Date;ttq._o=ttq._o||{};ttq._o[e]=n||{};var o=d.createElement("script");o.type="text/javascript";o.async=!0;o.src=i+"?sdkid="+e+"&lib="+t;var a=d.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};ttq.load(id);ttq.page()}(window,document,'ttq'); }
    function initSnapchat(id) { if (!id || window.snaptr) return; (function(e,t,n){if(e.snaptr)return;var a=e.snaptr=function(){a.handleRequest?a.handleRequest.apply(a,arguments):a.queue.push(arguments)};a.queue=[];var s='script';var r=t.createElement(s);r.async=true;r.src=n;var u=t.getElementsByTagName(s)[0];u.parentNode.insertBefore(r,u)})(window,document,'https://sc-static.net/scevent.min.js'); window.snaptr('init', id); }
    function initGoogle(id) { if (!id || window.gtag) return; window.dataLayer=window.dataLayer||[]; window.gtag=function(){window.dataLayer.push(arguments)}; loadScript('https://www.googletagmanager.com/gtag/js?id='+id); window.gtag('js',new Date()); window.gtag('config',id); }

    /**
     * تحقق هل الحدث مُفعَّل لمنصة معيّنة (حسب قائمة الأحداث المختارة من المستخدم).
     * @param {string} platformKey - مفتاح المنصة (facebookPixelId, tiktokPixelId, snapPixelId)
     * @param {string} event - اسم الحدث (PageView, ViewContent, ...)
     * @returns {boolean}
     */
    function _isEventEnabled(platformKey, event) {
      // GA4 و GTM لا يدعمان قائمة أحداث مخصصة (supportsEvents = false) — نسمح دائماً
      if (platformKey === 'googleAnalyticsId' || platformKey === 'gtmId') return true;
      // اقرأ القائمة من ids.eventsMap (أُنشئت في init)
      var evList = ids.eventsMap && ids.eventsMap[platformKey];
      if (!evList || !Array.isArray(evList) || evList.length === 0) {
        // لو لم تُضبط، استخدم الافتراضية
        evList = DEFAULT_EVENTS;
      }
      return evList.indexOf(event) !== -1;
    }

    /**
     * إرسال الحدث إلى CAPI Worker (server-side Conversions API).
     *
     * 🔒 الـ Worker هو الذي يحمل CAPI tokens من store_finance — لا تُمرَّر
     *    tokens من المتصفح أبداً. فقط نبعت له: store_id, event_name, event_id,
     *    params (value/currency/content_ids/content_name/num_items), page_url.
     *
     * 🔁 deduplication: نفس event_id يُستخدم في browser pixel و CAPI —
     *    هذا يتيح لـ FB/TT دمج الحدثين (browser + server) كحدث واحد.
     *
     * 🔥 fire-and-forget: sendBeacon / fetch keepalive — لا ننتظر الرد.
     */
    function _sendServerEvent(event, params, eventId) {
      // capiWorkerUrl هو الـ base URL للـ Worker (بدون /capi/event).
      // نُلحق المسار يدوياً — متوافق مع الـ worker المنشور.
      var baseUrl = ids.capiWorkerUrl;
      if (!baseUrl) return; // CAPI غير مفعّل — صمت
      // نزّل trailing slash ثم أضف /capi/event
      var workerUrl = baseUrl.replace(/\/+$/, '') + '/capi/event';

      // فقط لو يوجد pixel ID لـ FB أو TikTok أو Snap أو GA4
      var hasFb = !!ids.fb, hasTt = !!ids.tiktok, hasSnap = !!ids.snap, hasGa4 = !!ids.ga;
      if (!hasFb && !hasTt && !hasSnap && !hasGa4) return;

      var body = {
        store_id: ids.storeId,
        event: event,
        event_id: eventId,
        page_url: window.location.href,
        // params يحتوي فقط على: value, currency, content_ids, content_name, num_items
        // لا نرسل أي PII من المتصفح. الـ Worker يضيف client_ip + user_agent من request.
        params: {
          value: params.value,
          currency: params.currency || 'DZD',
          content_ids: params.content_ids,
          content_name: params.content_name,
          num_items: params.num_items
        },
        // pixel IDs — الـ Worker يتحقق منها ضد DB (anti-spoofing)
        fb_pixel_id: hasFb ? ids.fb : undefined,
        tt_pixel_id: hasTt ? ids.tiktok : undefined
      };
      try {
        var blob = new Blob([JSON.stringify(body)], { type: 'application/json' });
        if (navigator.sendBeacon) {
          var ok = navigator.sendBeacon(workerUrl, blob);
          // sendBeacon may return false if queue is full — fallback to fetch keepalive
          if (!ok) {
            fetch(workerUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
              keepalive: true
            }).catch(function () {});
          }
        } else {
          fetch(workerUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            keepalive: true
          }).catch(function () {});
        }
      } catch (e) {
        // fire-and-forget — لا نريد أن نكسر تجربة المستخدم لو فشل الإرسال
        if (window.console && console.debug) console.debug('[ShvPixels] CAPI send failed:', e && e.message);
      }
    }
    function init(store) {
      if (inited || !store) return;
      ids = {
        fb: store.facebookPixelId || '',
        tiktok: store.tiktokPixelId || '',
        snap: store.snapPixelId || '',
        ga: store.googleAnalyticsId || '',
        capiWorkerUrl: store.capiWorkerUrl || '',
        storeId: window._getStoreId() || '',
        // 🔧 قائمة الأحداث المختارة لكل منصة (من PixelsTab → storeData)
        eventsMap: {
          facebookPixelId:  store.facebookPixelId_events  || DEFAULT_EVENTS,
          tiktokPixelId:    store.tiktokPixelId_events    || DEFAULT_EVENTS,
          snapPixelId:      store.snapPixelId_events      || DEFAULT_EVENTS,
          // GA4 و GTM لا تدعمان قائمة مخصصة
        },
        // 🔧 enabled flags لكل منصة — لو معطّلة لا نُطلِق أي حدث
        enabled: {
          facebookPixelId:  store.facebookPixelId_enabled  !== false,
          tiktokPixelId:    store.tiktokPixelId_enabled    !== false,
          snapPixelId:      store.snapPixelId_enabled      !== false,
          googleAnalyticsId: store.googleAnalyticsId_enabled !== false,
        }
      };
      if (!ids.fb && !ids.tiktok && !ids.snap && !ids.ga) return;
      // 🔒 احترم enabled flags — لو معطّلة لا تُحمِّل سكريبت المنصة أصلاً
      if (ids.enabled.facebookPixelId && ids.fb)  initFacebook(ids.fb);
      if (ids.enabled.tiktokPixelId    && ids.tiktok) initTikTok(ids.tiktok);
      if (ids.enabled.snapPixelId      && ids.snap)   initSnapchat(ids.snap);
      if (ids.enabled.googleAnalyticsId && ids.ga)    initGoogle(ids.ga);
      inited = true;
    }
    function track(event, params) {
      params = params || {};
      var eventId = _genEventId();

      // 🔒 احترم enabled flag — لو كل المنصات معطّلة، لا تفعل شيئاً
      var fbOn  = ids.enabled.facebookPixelId  && _isEventEnabled('facebookPixelId', event);
      var ttOn  = ids.enabled.tiktokPixelId    && _isEventEnabled('tiktokPixelId', event);
      var snapOn = ids.enabled.snapPixelId     && _isEventEnabled('snapPixelId', event);
      var gaOn  = ids.enabled.googleAnalyticsId;

      if (!fbOn && !ttOn && !snapOn && !gaOn) return; // كل المنصات معطّلة أو الحدث غير مفعّل

      try { if (fbOn && window.fbq && ids.fb) window.fbq('track', event, params, { eventID: eventId }); } catch (e) {}
      try { if (ttOn && window.ttq && ids.tiktok) {
        var ttMap = { PageView:'PageView', ViewContent:'ViewContent', AddToCart:'AddToCart', InitiateCheckout:'InitiateCheckout', Purchase:'CompletePayment' };
        window.ttq.track(ttMap[event] || event, { value: params.value, currency: params.currency || 'DZD', content_id: params.content_ids ? params.content_ids[0] : undefined, content_name: params.content_name, event_id: eventId });
      } } catch (e) {}
      try { if (snapOn && window.snaptr && ids.snap) {
        var scMap = { PageView:'PAGE_VIEW', ViewContent:'VIEW_CONTENT', AddToCart:'ADD_CART', InitiateCheckout:'START_CHECKOUT', Purchase:'PURCHASE' };
        window.snaptr('track', scMap[event] || event, { price: params.value, currency: params.currency || 'DZD', item_ids: params.content_ids });
      } } catch (e) {}
      try { if (gaOn && window.gtag && ids.ga) {
        var gaMap = { PageView:'page_view', ViewContent:'view_item', AddToCart:'add_to_cart', InitiateCheckout:'begin_checkout', Purchase:'purchase' };
        window.gtag('event', gaMap[event] || event, { value: params.value, currency: params.currency || 'DZD', items: params.content_ids });
      } } catch (e) {}

      // CAPI beacon — يُرسَل دائماً لو أي منصة نشطة (الـ Worker يقرر لمن يُرسل)
      _sendServerEvent(event, params, eventId);
    }
    return { init: init, track: track };
  })();

  // ===== تحويلات المنتجات (موحَّدة — اتحاد كل الحقول من القوالب الثلاثة) =====

  /**
   * تحويل مصفوفة الألوان الخام من DB إلى { name, hex }.
   * النسخة الأشمل من black/neon — تدعم c.hex / c.color / c.value / c.label.
   */
  function _normalizeColors(colors) {
    return (colors || []).map(function (c) {
      if (typeof c === 'string') return { name: c, hex: c };
      if (typeof c === 'object' && c !== null) {
        var hex = c.hex || c.color || c.value || '';
        var nm = c.name || c.label || hex || 'Color';
        return { name: nm, hex: hex };
      }
      return { name: String(c), hex: String(c) };
    });
  }

  /** تحويل مصفوفة المقاسات الخام إلى نصوص */
  function _normalizeSizes(sizes) {
    return (sizes || []).map(function (s) {
      return typeof s === 'string' ? s : (s.name || String(s));
    });
  }

  /**
   * بناء كائن منتج موحَّد من صف DB خام.
   * يستخدم **اتحاد** كل الحقول الموجودة في أي من القوالب الثلاثة.
   */
  function _mapProduct(p, reviewsMap) {
    var adminReviews = Array.isArray(p.reviews_data) ? p.reviews_data : [];
    var customerReviews = (reviewsMap && reviewsMap[p.id]) || [];
    // الدمج: مراجعات العملاء أولاً (الأحدث) ثم مراجعات الإدارة
    var mergedReviews = customerReviews.concat(adminReviews);
    var pWithReviews = Object.assign({}, p, { reviews_data: mergedReviews, reviewsData: mergedReviews });

    var hasDiscount = p.discount_price != null && Number(p.discount_price) > 0;

    return {
      id: p.id,
      name: p.name,
      price: Number(p.price) || 0,
      discountPrice: p.discount_price != null ? Number(p.discount_price) : null,
      originalPrice: hasDiscount ? Number(p.price) : null,

      // حقول كانت موجودة في black/neon فقط — أُضيفت للجميع
      quantity: Number(p.quantity) || 1,
      shortDesc: p.description || '',

      emoji: p.emoji || '🛍️',
      category: p.category || '',
      desc: p.description || '',

      image: p.image || '',
      images: p.images || [],
      detailImages: p.detail_images || [], // black/neon فقط سابقاً

      sizes: _normalizeSizes(p.sizes),
      colors: _normalizeColors(p.colors),

      slug: p.slug || '',
      shippingReturns: p.shipping_returns || '',
      reviewsText: p.reviews_text || '',
      reviewsData: mergedReviews,

      details: Array.isArray(p.details) ? p.details : [],

      // حقول شائعة للعرض — إعداد افتراضي موحَّد
      badge: hasDiscount ? 'Sale' : '',
      isNew: false,
      materials: '',
      sizeFit: '',
      shipping: '',

      freeShipping: p.free_shipping === true,
      ttsEnabled: p.tts_enabled === true,
      ttsFee: Number(p.tts_fee) || 0,

      rating: window._shvProductRating(pWithReviews),
      reviews: window._shvProductReviewCount(pWithReviews),
    };
  }

  // ===== الدالة الرئيسية الموحَّدة =====

  /**
   * جلب بيانات المتجر + منتجاته من Supabase مع cache محلي.
   *
   * الاسم القديم كان fetchStoreFromFirestore — مضلِّل تماماً (الدالة تستعلم Supabase،
   * والاسم بقي من ما قبل الهجرة من Firestore). أُعيدت التسمية إلى fetchStoreData.
   *
   * @param {string} storeId
   * @returns {Promise<{ store: object|null, products: Array }>}
   */
  window.fetchStoreData = async function (storeId) {
    if (!storeId || typeof storeId !== 'string' || storeId.trim() === '') return { store: null, products: [] };
    var cleanStoreId = storeId.trim();
    var cacheKey = 'shv_store_' + cleanStoreId;

    var storeData = null;
    var remoteVer = '0';

    // 1) جلب صف المتجر
    // ✅ FIX: Use explicit column list instead of '*' to avoid permission errors.
    // After applying migration_security_fixes_p0.sql, anon role has column-level
    // GRANTs on stores — phone and owner_id are NOT granted. Using SELECT *
    // would try to read those protected columns and return "permission denied".
    //
    // We list ALL columns that may exist (some are added by pending migrations).
    // Supabase REST API will only return columns that actually exist in the table,
    // and will only fail if a requested column is protected (PII) — not if it's missing.
    // So this list is safe to use even if some migrations haven't been applied yet.
    //
    // Note: 'shipping' column is intentionally NOT in this list because the
    // migration marks it as protected (it shouldn't be — but we work around it
    // by fetching it separately for the owner).
    var storeColumns = [
      'id', 'name', 'template', 'theme', 'page_title', 'page_subtitle',
      'bg_color', 'card_color', 'text_color', 'accent_color',
      'facebook_pixel_id', 'instagram_pixel_id',
      'tiktok_pixel_id', 'snap_pixel_id', 'google_analytics_id', 'gtm_id', 'capi_worker_url',
      'created_at', 'updated_at',
      'facebook_pixel_id_2', 'facebook_pixel_id_3',
      'tiktok_pixel_id_2', 'tiktok_pixel_id_3',
      'snap_pixel_id_2', 'snap_pixel_id_3',
      'store_slug',
      'tts_enabled', 'tts_default_fee'
    ].join(', ');
    var storeRowResult = await supabase.from('stores').select(storeColumns).eq('id', cleanStoreId).maybeSingle();
    var storeRow = storeRowResult && storeRowResult.data ? storeRowResult.data : null;

    // Parse hero settings from page_subtitle JSON (e.g. {heroTitle1, heroTitle2, heroKicker, heroBtn})
    var heroSettings = {};
    try {
      if (storeRow && storeRow.page_subtitle && typeof storeRow.page_subtitle === 'string' && storeRow.page_subtitle.trim().startsWith('{')) {
        heroSettings = JSON.parse(storeRow.page_subtitle);
      } else if (storeRow && storeRow.page_subtitle && typeof storeRow.page_subtitle === 'object') {
        heroSettings = storeRow.page_subtitle;
      }
    } catch (e) {}

    if (storeRow) {
      // ✨ اتحاد كل الحقول الموجودة في أي قالب — لا حذف لأي ميزة
      storeData = {
        id: storeRow.id,
        name: storeRow.name,
        title: storeRow.title || storeRow.page_title || '',
        template: storeRow.template,
        theme: storeRow.theme,

        // حقول عامة
        pageTitle: storeRow.page_title || '',
        pageSubtitle: storeRow.page_subtitle,
        heroDesc: storeRow.hero_desc || '',

        // إعدادات hero من JSON داخل page_subtitle — الافتراضيات النصية الثابتة
        // (التي كانت تختلف بين القوالب: 'THRIFTED.' vs 'Discover Your') تُزال من هنا.
        // كل قالب يضع افتراضياته الخاصة عند العرض إن لم تُوجَد قيمة في DB.
        heroTitle1: heroSettings.heroTitle1 || '',
        heroTitle2: heroSettings.heroTitle2 || '',
        heroKicker: heroSettings.heroKicker || '',
        heroBtn: heroSettings.heroBtn || '',

        coverImage: storeRow.cover_image || null,
        hideTrustIcons: storeRow.hide_trust_icons || {},
        trustIconsText: storeRow.trust_icons_text || {},

        shipping: storeRow.shipping || [],
        shippingProvider: storeRow.shipping_provider, // black/neon فقط سابقاً

        // ألوان مخصصة للمتجر — black/neon فقط سابقاً
        bgColor: storeRow.bg_color,
        cardColor: storeRow.card_color,
        accentColor: storeRow.accent_color,
        textColor: storeRow.text_color,

        categories: storeRow.categories || [],

        // روابط اجتماعية
        tiktok: storeRow.tiktok,
        instagram: storeRow.instagram,
        facebook: storeRow.facebook,

        // Pixels / Analytics
        facebookPixelId: storeRow.facebook_pixel_id,
        tiktokPixelId: storeRow.tiktok_pixel_id,
        snapPixelId: storeRow.snap_pixel_id,
        googleAnalyticsId: storeRow.google_analytics_id,
        gtmId: storeRow.gtm_id, // black/neon فقط سابقاً
        capiWorkerUrl: storeRow.capi_worker_url,
        // 🔧 Pixel extensions — enabled flags + events whitelist + lastFired
        // تُقرأ من store-data.js وتُمرَّر إلى ShvPixels.init()
        facebookPixelId_enabled:  storeRow.facebook_pixel_id_enabled  !== false,
        tiktokPixelId_enabled:    storeRow.tiktok_pixel_id_enabled    !== false,
        snapPixelId_enabled:      storeRow.snap_pixel_id_enabled      !== false,
        googleAnalyticsId_enabled: storeRow.google_analytics_id_enabled !== false,
        facebookPixelId_events:   storeRow.facebook_pixel_id_events,
        tiktokPixelId_events:     storeRow.tiktok_pixel_id_events,
        snapPixelId_events:       storeRow.snap_pixel_id_events,

        // Try Two Sizes (TTS)
        ttsEnabled: storeRow.tts_enabled === true,
        ttsDefaultFee: Number(storeRow.tts_default_fee) || 0,
        ttsMinPrice: Number(storeRow.tts_min_price) || 0,

        updatedAt: storeRow.updated_at ? { seconds: Math.floor(new Date(storeRow.updated_at).getTime() / 1000) } : null,
      };

      remoteVer = storeData.updatedAt ? String(storeData.updatedAt.seconds || 0) : '0';
    }

    window._storeData = storeData;

    // 2) محاولة قراءة cache (نمط black: يشمل store + products + version)
    try {
      var cached = localStorage.getItem(cacheKey);
      if (cached) {
        var parsed = JSON.parse(cached);
        if (parsed.version === remoteVer && Array.isArray(parsed.products)) {
          // أعد storeData من cache إن وُجدت (لم تُحفظ في الكاش القديم في white/neon)
          return { store: parsed.store || storeData, products: parsed.products };
        }
      }
    } catch (e) {}

    // 3) جلب المنتجات + المراجعات
    var productsResult = await supabase.from('products').select('*').eq('store_id', cleanStoreId).limit(50);
    var productRows = productsResult && productsResult.data ? productsResult.data : [];

    var reviewsMap = await window._shvFetchAllReviewsMap(cleanStoreId);
    var products = (productRows || []).map(function (p) { return _mapProduct(p, reviewsMap); });

    // 4) حفظ cache (نمط black: يشمل storeData أيضاً — أكثر فائدة)
    try {
      localStorage.setItem(cacheKey, JSON.stringify({ store: storeData, products: products, version: remoteVer }));
    } catch (e) {}

    return { store: storeData, products: products };
  };

  // ===== اشتراك Realtime للمنتجات =====

  /**
   * الاشتراك في تغييرات جدول products + product_reviews للمتجر.
   * @param {string} storeId
   * @param {(products: Array) => void} onUpdate
   * @returns {() => void} دالة إلغاء الاشتراك
   */
  window.subscribeToStoreProducts = function (storeId, onUpdate) {
    if (!storeId || typeof onUpdate !== 'function') return function () {};

    function _refreshAndEmit() {
      return (async function () {
        var result = await supabase.from('products').select('*').eq('store_id', storeId).limit(50);
        var rows = result && result.data ? result.data : [];
        var reviewsMap = await window._shvFetchAllReviewsMap(storeId);
        var products = rows.map(function (p) { return _mapProduct(p, reviewsMap); });
        onUpdate(products);
      })();
    }

    var channel = supabase.channel('products_' + storeId)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'products', filter: 'store_id=eq.' + storeId },
        function () { _refreshAndEmit(); })
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'product_reviews', filter: 'store_id=eq.' + storeId },
        function () { _refreshAndEmit(); })
      .subscribe();

    return function () { try { supabase.removeChannel(channel); } catch (e) {} };
  };

})();
