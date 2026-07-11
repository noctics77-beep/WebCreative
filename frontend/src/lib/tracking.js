// Analytics tracking helpers for Meta Pixel + Google Analytics 4 (GA4).
// IDs are read from environment variables — never hardcoded.
//   REACT_APP_META_PIXEL_ID       (e.g. "2203703337115796")
//   REACT_APP_GA_MEASUREMENT_ID   (e.g. "G-XXXXXXX")

const META_PIXEL_ID = process.env.REACT_APP_META_PIXEL_ID || "";
const GA_MEASUREMENT_ID = process.env.REACT_APP_GA_MEASUREMENT_ID || "";

let initialized = false;

function loadScript(src, attrs = {}) {
  return new Promise((resolve) => {
    const s = document.createElement("script");
    s.async = true;
    s.src = src;
    Object.entries(attrs).forEach(([k, v]) => s.setAttribute(k, v));
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.head.appendChild(s);
  });
}

function injectMetaPixel(pixelId) {
  if (window.fbq) return;
  /* eslint-disable */
  (function (f, b, e, v, n, t, s) {
    if (f.fbq) return;
    n = f.fbq = function () {
      n.callMethod
        ? n.callMethod.apply(n, arguments)
        : n.queue.push(arguments);
    };
    if (!f._fbq) f._fbq = n;
    n.push = n;
    n.loaded = !0;
    n.version = "2.0";
    n.queue = [];
    t = b.createElement(e);
    t.async = !0;
    t.src = v;
    s = b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t, s);
  })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
  /* eslint-enable */
  window.fbq("init", pixelId);
  window.fbq("track", "PageView");

  // noscript fallback (for crawlers / no-JS UAs)
  const noscript = document.createElement("noscript");
  const img = document.createElement("img");
  img.height = 1;
  img.width = 1;
  img.style.display = "none";
  img.src = `https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1`;
  noscript.appendChild(img);
  document.head.appendChild(noscript);
}

async function injectGA(measurementId) {
  if (window.gtag) return;
  await loadScript(
    `https://www.googletagmanager.com/gtag/js?id=${measurementId}`
  );
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    window.dataLayer.push(arguments);
  };
  window.gtag("js", new Date());
  window.gtag("config", measurementId, { send_page_view: true });
}

export function initTracking() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  if (META_PIXEL_ID) {
    try {
      injectMetaPixel(META_PIXEL_ID);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("[tracking] Meta Pixel init failed", e);
    }
  }
  if (GA_MEASUREMENT_ID) {
    try {
      injectGA(GA_MEASUREMENT_ID);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("[tracking] GA4 init failed", e);
    }
  }
}

export function trackPageView(path) {
  if (typeof window === "undefined") return;
  const pagePath = path || window.location.pathname + window.location.search;
  if (window.fbq) window.fbq("track", "PageView");
  if (window.gtag && GA_MEASUREMENT_ID) {
    window.gtag("event", "page_view", {
      page_path: pagePath,
      page_location: window.location.href,
      page_title: document.title,
    });
  }
  // Internal lightweight tracking (dedup per path per session)
  try {
    const key = `cs_pv_${pagePath}`;
    if (!sessionStorage.getItem(key)) {
      sessionStorage.setItem(key, "1");
      // Extract product slug from /produk/:slug path
      let productSlug = null;
      const m = /^\/produk\/([^/?#]+)/.exec(pagePath);
      if (m) productSlug = decodeURIComponent(m[1]);
      const BE = process.env.REACT_APP_BACKEND_URL;
      if (BE) {
        fetch(`${BE}/api/track/page-view`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: pagePath, product_slug: productSlug }),
        }).catch(() => {});
      }
    }
  } catch (_) {
    /* storage disabled — ignore */
  }
}

export function trackViewContent(product) {
  if (!product || typeof window === "undefined") return;
  const value = Number(
    product.discount_active && product.discount_price
      ? product.discount_price
      : product.original_price || 0
  );
  if (window.fbq) {
    window.fbq("track", "ViewContent", {
      content_ids: [product.id],
      content_name: product.name,
      content_type: "product",
      value,
      currency: "IDR",
    });
  }
  if (window.gtag) {
    window.gtag("event", "view_item", {
      currency: "IDR",
      value,
      items: [
        {
          item_id: product.id,
          item_name: product.name,
          price: value,
          quantity: 1,
        },
      ],
    });
  }
}

export function trackInitiateCheckout({ product, payment_method } = {}) {
  if (!product || typeof window === "undefined") return;
  const value = Number(
    product.discount_active && product.discount_price
      ? product.discount_price
      : product.original_price || 0
  );
  if (window.fbq) {
    window.fbq("track", "InitiateCheckout", {
      content_ids: [product.id],
      content_name: product.name,
      content_type: "product",
      value,
      currency: "IDR",
      num_items: 1,
    });
  }
  if (window.gtag) {
    window.gtag("event", "begin_checkout", {
      currency: "IDR",
      value,
      payment_type: payment_method,
      items: [
        {
          item_id: product.id,
          item_name: product.name,
          price: value,
          quantity: 1,
        },
      ],
    });
  }
}

export function trackPurchase(order) {
  if (!order || typeof window === "undefined") return;
  // Prevent duplicate Purchase events per order_code in the same browser
  const key = `cs_tracked_purchase_${order.order_code || order.id || ""}`;
  try {
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
  } catch (_) {
    // ignore storage errors
  }
  const value = Number(
    order.pakasir_total ||
      order.product_price ||
      (order.product && order.product.original_price) ||
      0
  );
  const productId = order.product_id || (order.product && order.product.id);
  const productName =
    order.product_name || (order.product && order.product.name) || "Produk";
  if (window.fbq) {
    window.fbq("track", "Purchase", {
      content_ids: productId ? [productId] : [],
      content_name: productName,
      content_type: "product",
      value,
      currency: "IDR",
    });
  }
  if (window.gtag) {
    window.gtag("event", "purchase", {
      transaction_id: order.order_code || order.id,
      value,
      currency: "IDR",
      items: [
        {
          item_id: productId,
          item_name: productName,
          price: value,
          quantity: 1,
        },
      ],
    });
  }
}

export const TRACKING_CONFIGURED = Boolean(META_PIXEL_ID || GA_MEASUREMENT_ID);
