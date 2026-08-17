/**
 * ShopeVelo — Shared Shipping Logic (مُستخرَج من 3 ملفات HTML)
 * ────────────────────────────────────────────────────────────────
 * جدول الـ 58 ولاية الجزائرية + حساب أسعار الشحن.
 *
 * قبل هذا الملف، كان جدول WILAYA_NAME_TO_ID + DEFAULT_WILAYA_PRICES + calcShipping
 * مكررًا حرفيًا في black.html, neon.html, white.html (3×~50 سطر = 150 سطر مكرر).
 * أي تحديث لأسعار الشحن الافتراضية كان يتطلب تعديل 3 ملفات يدويًا.
 *
 * الآن: مصدر واحد. كل قالب يستورد هذا الملف ويستدعي calcShipping().
 *
 * ملاحظة: formatShippingInfoHTML لم تُستخرَج لأنها تعتمد على currentLang
 * و formatPrice التي تختلف بين القوالب. كل قالب يُعرِّف نسخته الخاصة.
 */

(function () {
  'use strict';

  // خريطة أسماء الولايات (إنجليزي) → ID رقمي
  // ملاحظة: الأسماء بالإنجليزية لأنها تأتي من Supabase store.shipping[].nameEn
  var WILAYA_NAME_TO_ID = {
    'Adrar': 1, 'Chlef': 2, 'Laghouat': 3, 'Oum El Bouaghi': 4, 'Batna': 5, 'Béjaïa': 6, 'Biskra': 7, 'Béchar': 8,
    'Blida': 9, 'Bouira': 10, 'Tamanrasset': 11, 'Tébessa': 12, 'Tlemcen': 13, 'Tiaret': 14, 'Tizi Ouzou': 15,
    'Alger': 16, 'Djelfa': 17, 'Jijel': 18, 'Sétif': 19, 'Saïda': 20, 'Skikda': 21, 'Sidi Bel Abbès': 22, 'Annaba': 23,
    'Guelma': 24, 'Constantine': 25, 'Médéa': 26, 'Mostaganem': 27, "M'Sila": 28, 'Mascara': 29, 'Ouargla': 30,
    'Oran': 31, 'El Bayadh': 32, 'Illizi': 33, 'Bordj Bou Arréridj': 34, 'Boumerdès': 35, 'El Tarf': 36,
    'Tindouf': 37, 'Tissemsilt': 38, 'El Oued': 39, 'Khenchela': 40, 'Souk Ahras': 41, 'Tipaza': 42, 'Mila': 43,
    "Aïn Defla": 44, 'Naâma': 45, "Aïn Témouchent": 46, 'Ghardaïa': 47, 'Relizane': 48,
    'Timimoun': 49, 'Bordj Badji Mokhtar': 50, 'Ouled Djellal': 51, 'Béni Abbès': 52, 'In Salah': 53,
    'In Guezzam': 54, 'Touggourt': 55, 'Djanet': 56, "El M'Ghair": 57, 'El Meniaa': 58
  };

  // أسعار الشحن الافتراضية (home delivery) لكل ولاية — بالدينار الجزائري
  // تُستخدم فقط لو المتجر لم يُعرِّف أسعاره المخصصة في storeData.shipping
  var DEFAULT_WILAYA_PRICES = {
    1: 900, 2: 650, 3: 700, 4: 500, 5: 600, 6: 600, 7: 650, 8: 850, 9: 400, 10: 500,
    11: 1200, 12: 650, 13: 650, 14: 600, 15: 550, 16: 350, 17: 650, 18: 600, 19: 600, 20: 650,
    21: 600, 22: 650, 23: 600, 24: 620, 25: 580, 26: 500, 27: 600, 28: 650, 29: 620, 30: 800,
    31: 550, 32: 750, 33: 1300, 34: 580, 35: 420, 36: 620, 37: 1400, 38: 600, 39: 750, 40: 650,
    41: 620, 42: 430, 43: 580, 44: 520, 45: 800, 46: 620, 47: 780, 48: 600, 49: 950, 50: 1500,
    51: 700, 52: 900, 53: 1200, 54: 1300, 55: 780, 56: 1300, 57: 800, 58: 950
  };

  /**
   * حساب سعر الشحن لولاية معينة
   * @param {string} wilaya - اسم الولاية (إنجليزي)
   * @param {number} subtotal - إجمالي الطلب (غير مستخدم حاليًا، للامتثال مستقبلاً)
   * @param {object} storeData - بيانات المتجر (تحوي shipping[] لو مُخصَّصة)
   * @param {string} deliveryType - 'home' أو 'office'
   * @returns {number} سعر الشحن بالدينار (0 لو الولاية غير معروفة)
   */
  function calcShipping(wilaya, subtotal, storeData, deliveryType) {
    var wilayaId = wilaya ? WILAYA_NAME_TO_ID[wilaya] : null;
    if (!wilayaId) return 0; // لا ولاية مُحدَّدة — لا يمكن الحساب

    var isOffice = (deliveryType === 'office');

    // 1. أسعار مُخصَّصة من المتجر (storeData.shipping[])
    if (storeData && storeData.shipping && Array.isArray(storeData.shipping) && storeData.shipping.length > 0) {
      for (var i = 0; i < storeData.shipping.length; i++) {
        if (Number(storeData.shipping[i].id) === wilayaId) {
          var price = isOffice
            ? (Number(storeData.shipping[i].office) || Number(storeData.shipping[i].home) || 0)
            : (Number(storeData.shipping[i].home) || 0);
          return price;
        }
      }
    }

    // 2. fallback: DEFAULT_WILAYA_PRICES (home). office = home × 0.75
    var homePrice = DEFAULT_WILAYA_PRICES[wilayaId] || 0;
    return isOffice ? Math.round(homePrice * 0.75) : homePrice;
  }

  /**
   * هل المتجر عرَّف أسعار شحن مخصصة؟
   * @param {object} storeData
   * @returns {boolean}
   */
  function _hasShippingConfig(storeData) {
    return !!(storeData && storeData.shipping && Array.isArray(storeData.shipping) && storeData.shipping.length > 0);
  }

  // ✨ تصدير للاستخدام العام
  window.WILAYA_NAME_TO_ID = WILAYA_NAME_TO_ID;
  window.DEFAULT_WILAYA_PRICES = DEFAULT_WILAYA_PRICES;
  window.calcShipping = calcShipping;
  window._hasShippingConfig = _hasShippingConfig;
})();
