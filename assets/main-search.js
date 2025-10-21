class MainSearch extends SearchForm {
  constructor() {
    super();
    this.allSearchInputs = document.querySelectorAll('input[type="search"]');
    this.setupEventListeners();
  }

  setupEventListeners() {
    let allSearchForms = [];
    this.allSearchInputs.forEach((input) => allSearchForms.push(input.form));
    this.input.addEventListener('focus', this.onInputFocus.bind(this));
    if (allSearchForms.length < 2) return;
    allSearchForms.forEach((form) => form.addEventListener('reset', this.onFormReset.bind(this)));
    this.allSearchInputs.forEach((input) => input.addEventListener('input', this.onInput.bind(this)));
  }

  onFormReset(event) {
    super.onFormReset(event);
    if (super.shouldResetForm()) {
      this.keepInSync('', this.input);
    }
  }

  onInput(event) {
    const target = event.target;
    this.keepInSync(target.value, target);
  }

  onInputFocus() {
    const isSmallScreen = window.innerWidth < 750;
    if (isSmallScreen) {
      this.scrollIntoView({ behavior: 'smooth' });
    }
  }

  keepInSync(value, target) {
    this.allSearchInputs.forEach((input) => {
      if (input !== target) {
        input.value = value;
      }
    });
  }
}

/* ========= Dual Search (single pooled fetch → split) ========= */

(function() {
  const STOREFRONT_API_URL = `${window.Shopify?.routes?.root || '/'}api/2024-07/graphql.json`;
  const STOREFRONT_TOKEN   = '37d38b7fd18be490695493aaede02ac7';

  // Map sort_by param to Storefront sort keys
  function mapSort(url) {
    const sort = new URL(url).searchParams.get('sort_by') || 'relevance';
    switch (sort) {
      case 'price-ascending':    return { sortKey: 'PRICE',       reverse: false };
      case 'price-descending':   return { sortKey: 'PRICE',       reverse: true  };
      case 'created-descending': return { sortKey: 'CREATED_AT',  reverse: true  };
      case 'created-ascending':  return { sortKey: 'CREATED_AT',  reverse: false };
      case 'best-selling':       return { sortKey: 'BEST_SELLING',reverse: false };
      default:                   return { sortKey: 'RELEVANCE',   reverse: false };
    }
  }

  // Only pass the search term to Storefront search; facet later on the client.
  function buildQueryStringFromUrl(url) {
    const p = new URL(url).searchParams;
    const q = (p.get('q') || '').trim();
    return q ? q : '*';
  }


 /* --- keep your existing helpers here (mapSort, buildQueryStringFromUrl, etc.) --- */

// BASE (no metafields)
const SEARCH_GQL_BASE = `
  query SearchProducts($query: String!, $first: Int!, $sortKey: ProductSortKeys, $reverse: Boolean, $after: String) {
    products(first: $first, query: $query, sortKey: $sortKey, reverse: $reverse, after: $after) {
      edges {
        cursor
        node {
          id handle title vendor
          productType
          availableForSale
          tags
          collections(first: 240) { nodes { id handle } }
          featuredImage { url altText width height }
          priceRange { minVariantPrice { amount currencyCode } }
          variants(first: 240) {
            edges {
              node {
                sku title
                selectedOptions { name value }
              }
            }
          }
        }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;


// WITH metafields (note HasMetafieldsIdentifier! non-null lists)
const SEARCH_GQL_WITH_MF = `
  query SearchProductsWithMf(
    $query: String!,
    $first: Int!,
    $sortKey: ProductSortKeys,
    $reverse: Boolean,
    $after: String,
    $productMfIds: [HasMetafieldsIdentifier!]!,
    $variantMfIds: [HasMetafieldsIdentifier!]!
  ) {
    products(first: $first, query: $query, sortKey: $sortKey, reverse: $reverse, after: $after) {
      edges {
        cursor
        node {
          id handle title vendor
          productType
          availableForSale
          tags
          collections(first: 240) { nodes { id handle } }
          featuredImage { url altText width height }
          priceRange { minVariantPrice { amount currencyCode } }

          metafields(identifiers: $productMfIds) { namespace key value }

          variants(first: 240) {
            edges {
              node {
                sku title
                selectedOptions { name value }
                metafields(identifiers: $variantMfIds) { namespace key value }
              }
            }
          }
        }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;






/* --- ⬇️ Place the metafield helpers RIGHT HERE, after SEARCH_GQL --- */

const norm = (s) => String(s ?? '').trim().toLowerCase();

/**
 * Split a metafield value into normalized tokens:
 * - handles JSON array (["Black","Bronze"])
 * - handles common separators: comma, pipe, semicolon, slash
 * - also splits words so "Matte Black" yields ["matte","black"]
 */
function mfTokens(mfValue) {
  const v = String(mfValue ?? '');
  const toks = [];

  // JSON array?
  if (/^\s*\[/.test(v)) {
    try {
      const arr = JSON.parse(v);
      if (Array.isArray(arr)) {
        arr.forEach(x => toks.push(norm(x)));
        return toks.filter(Boolean);
      }
    } catch {}
  }

  // split on common list separators
  const parts = /[,\|;\/]/.test(v) ? v.split(/[,\|;\/]/) : [v];
  parts.forEach(p => {
    // split into words too
    String(p).split(/\s+/).forEach(w => toks.push(norm(w)));
  });

  return toks.filter(Boolean);
}

/**
 * Strict equality (token-level): expected must exactly equal one token in value.
 */
function mfStrictMatch(mfValue, expected) {
  const want = norm(expected);
  const toks = mfTokens(mfValue);
  return toks.includes(want);
}

/**
 * Relaxed contains: expected must be a substring of the normalized raw value,
 * OR any token must be a substring of expected (to catch "Matte Black" vs "Black").
 */
function mfLooseMatch(mfValue, expected) {
  const raw = norm(mfValue);
  const want = norm(expected);
  if (raw.includes(want)) return true;

  // token-wise contains either way
  const toks = mfTokens(mfValue);
  if (toks.some(t => want.includes(t))) return true;

  return false;
}

function nodeHasProductMf(product, ns, key, val, loose = false) {
  const list = product.metafields || [];
  return list.some(mf => {
    if (!mf || !mf.namespace || !mf.key) return false;
    if (mf.namespace !== ns || mf.key !== key) return false;
    return loose ? mfLooseMatch(mf.value, val) : mfStrictMatch(mf.value, val);
  });
}

function nodeHasVariantMf(product, ns, key, val, loose = false) {
  const vEdges = product.variants?.edges || [];
  return vEdges.some(ve => {
    const mfs = ve?.node?.metafields || [];
    return mfs.some(mf => {
      if (!mf || !mf.namespace || !mf.key) return false;
      if (mf.namespace !== ns || mf.key !== key) return false;
      return loose ? mfLooseMatch(mf.value, val) : mfStrictMatch(mf.value, val);
    });
  });
}


function mfMatches(mfValue, expected) {
  const v = String(mfValue ?? '');
  const want = norm(expected);

  // JSON array?
  if (/^\s*\[/.test(v)) {
    try {
      const arr = JSON.parse(v);
      if (Array.isArray(arr) && arr.some(x => norm(x) === want)) return true;
    } catch {}
  }

  // common separators
  if (/[,\|;\/]/.test(v)) {
    return v.split(/[,\|;\/]/).map(norm).some(x => x === want);
  }

  // scalar
  return norm(v) === want;
}


// If you haven’t added this yet (Step 1), include it above these helpers:
function parseMetafieldFiltersFromUrl(url) {
  const p = new URL(url).searchParams;
  const out = [];
  for (const [key, val] of p.entries()) {
    let m = key.match(/^filter\.p\.m\.([^.]+)\.([^.]+)$/);
    if (m && val) { out.push({ scope: 'product', namespace: m[1], key: m[2], value: val }); continue; }
    m = key.match(/^filter\.v\.m\.([^.]+)\.([^.]+)$/);
    if (m && val) { out.push({ scope: 'variant', namespace: m[1], key: m[2], value: val }); }
  }
  return out;
}


// ⬇️ These three are the “Step 3” helpers you asked about
function hasProductMf(product, ns, key, val) {
  const list = product.metafields || [];
  return list.some(mf => mf?.namespace === ns && mf.key === key && mfMatches(mf.value, val));
}

function hasVariantMf(product, ns, key, val) {
  const vEdges = product.variants?.edges || [];
  return vEdges.some(ve => {
    const mfs = ve.node.metafields || [];
    return mfs.some(mf => mf?.namespace === ns && mf.key === key && mfMatches(mf.value, val));
  });
}

/**
 * Tolerant metafield filter:
 *  - First pass: strict (token-equality) on product OR variant.
 *  - If result is empty BUT coverage shows (ns,key) exists on items, run a second "loose contains" pass.
 *  - If coverage for a requested (ns,key) is zero (nobody has that metafield), skip that filter entirely.
 */
function filterByMetafieldsTolerant(edges, mfFilters) {
  if (!mfFilters.length) return edges;

  // coverage map: "ns::key" -> { hasProduct: bool, hasVariant: bool }
  const coverage = new Map();
  edges.forEach(ed => {
    const n = ed.node;

    // product-level metafields may contain nulls per identifier
    (n.metafields || []).forEach(mf => {
      if (!mf || !mf.namespace || !mf.key) return;
      const sig = `${mf.namespace}::${mf.key}`;
      const cur = coverage.get(sig) || { hasProduct: false, hasVariant: false };
      cur.hasProduct = true;
      coverage.set(sig, cur);
    });

    // variant-level metafields may also contain nulls
    (n.variants?.edges || []).forEach(ve => {
      const mfs = ve?.node?.metafields || [];
      mfs.forEach(mf => {
        if (!mf || !mf.namespace || !mf.key) return;
        const sig = `${mf.namespace}::${mf.key}`;
        const cur = coverage.get(sig) || { hasProduct: false, hasVariant: false };
        cur.hasVariant = true;
        coverage.set(sig, cur);
      });
    });
  });


  // Which filters actually have coverage?
  const activeFilters = mfFilters.filter(f => {
    const sig = `${f.namespace}::${f.key}`;
    const cov = coverage.get(sig);
    return cov && (cov.hasProduct || cov.hasVariant);
  });

  // If none of the requested (ns,key) pairs exist on any candidate, skip metafield filtering entirely.
  if (!activeFilters.length) {
    console.warn('[dual-search] metafield: no coverage for any requested filters; skipping mf pass');
    return edges;
  }

  // PASS 1: strict (exact token equality)
  let strictOut = edges.filter(ed => {
    const n = ed.node;
    return activeFilters.every(f => {
      const onP = nodeHasProductMf(n, f.namespace, f.key, f.value, /*loose*/ false);
      const onV = nodeHasVariantMf(n, f.namespace, f.key, f.value, /*loose*/ false);
      return onP || onV;
    });
  });

  if (strictOut.length) {
    return strictOut;
  }

  // PASS 2: relaxed contains
  let looseOut = edges.filter(ed => {
    const n = ed.node;
    return activeFilters.every(f => {
      const onP = nodeHasProductMf(n, f.namespace, f.key, f.value, /*loose*/ true);
      const onV = nodeHasVariantMf(n, f.namespace, f.key, f.value, /*loose*/ true);
      return onP || onV;
    });
  });

  return looseOut;
}

function filterByMetafields(edges, mfFilters) {
  if (!mfFilters.length) return edges;

  return edges.filter(e => {
    const p = e.node;
    // every filter must match on product OR any variant
    return mfFilters.every(f => {
      const onProduct = hasProductMf(p, f.namespace, f.key, f.value);
      const onVariant = hasVariantMf(p, f.namespace, f.key, f.value);
      return onProduct || onVariant;
    });
  });
}


/* --- below this, keep your gqlFetch, fetchPooledResults, splitExactSimilar, cardHTML, etc. --- */

/* In renderDualSearch(), use them like:
 const mfFilters = parseMetafieldFiltersFromUrl(url);
 const filtered  = filterByMetafields(edges, mfFilters);
 const { exact, similar } = splitExactSimilar(filtered, qParam);
*/

async function gqlFetch(queryDoc, variables) {
  const url = `${window.Shopify?.routes?.root || '/'}api/2024-07/graphql.json`;
  const payload = JSON.stringify({ query: queryDoc, variables });

  return new Promise((resolve, reject) => {
    try {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url, true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.setRequestHeader('X-Shopify-Storefront-Access-Token', STOREFRONT_TOKEN);
      xhr.timeout = 15000;

      xhr.onreadystatechange = () => {
        if (xhr.readyState !== 4) return;
        let json = {};
        try { json = JSON.parse(xhr.responseText || '{}'); } catch (e) {
          console.error('[dual-search] invalid JSON', xhr.responseText);
          reject(new Error('Invalid JSON from Storefront API'));
          return;
        }
        if (xhr.status !== 200 || json.errors) {
          console.error('[dual-search] Storefront error', xhr.status, json.errors || json);
          reject(new Error((json.errors && json.errors[0]?.message) || `HTTP ${xhr.status}`));
        } else {
          const products = json.data.products;
          console.log('[dual-search] gql ok: edges', products?.edges?.length || 0);
          resolve(products);
        }
      };

      xhr.ontimeout = () => reject(new Error('Storefront API timeout'));
      xhr.onerror   = () => reject(new Error('Network error to Storefront API'));
      xhr.send(payload);
    } catch (e) {
      reject(e);
    }
  });
}




async function fetchPooledResults({ queryDoc, vars, pages = 2 }) {
  let edges = [];
  let after = null;
  for (let i = 0; i < pages; i++) {
    const data = await gqlFetch(queryDoc, { ...vars, after });
    edges = edges.concat(data.edges);
    if (!data.pageInfo.hasNextPage) break;
    after = data.pageInfo.endCursor;
  }
  return edges;
}


  // --- Helpers to normalize strings for fair comparisons ---
function normalizeTitle(s) {
  return (s || '').toLowerCase().trim().replace(/\s+/g, ' ');
}

function normalizeSku(s) {
  return (s || '').toLowerCase().replace(/[\s\-_]/g, '').trim();
}

// Extract a handle from raw user input:
// - accepts a plain handle: "artafex-4-complete-kits"
// - accepts a full URL: "https://store.com/products/artafex-4-complete-kits?..."
// - accepts spaced words: "artafex 4 complete kits" -> "artafex-4-complete-kits"
function normalizeHandleFromQuery(q) {
  const raw = String(q || '').trim().toLowerCase();

  if (!raw) return '';

  // If it's a URL, grab the last non-empty path segment
  try {
    if (/^https?:\/\//i.test(raw)) {
      const u = new URL(raw);
      const segs = u.pathname.split('/').filter(Boolean);
      return (segs.pop() || '').toLowerCase();
    }
  } catch (_) { /* fall through */ }

  // If user typed "products/handle" or "/products/handle"
  const m = raw.match(/(?:^|\/)products\/([^\/?#]+)/);
  if (m && m[1]) return m[1].toLowerCase();

  // Otherwise, assume a free-form string: treat spaces like hyphens
  return raw.replace(/\s+/g, '-');
}

// --- EXACT vs SIMILAR splitter (title OR SKU OR HANDLE *exact* match) ---
function splitExactSimilar(edges, qRaw) {
  const qTitle   = normalizeTitle(qRaw);
  const qSku     = normalizeSku(qRaw);
  const qHandle  = normalizeHandleFromQuery(qRaw); // new

  const exact = [];
  const similar = [];

  edges.forEach(({ node }) => {
    const titleMatch  = qTitle && normalizeTitle(node.title) === qTitle;
    const handleMatch = qHandle && String(node.handle || '').toLowerCase() === qHandle;

    const skuEdges = node.variants?.edges || [];
    const skuMatch = qSku && skuEdges.some(e => normalizeSku(e.node.sku) === qSku);

    if ((qRaw && (titleMatch || skuMatch || handleMatch))) {
      exact.push(node);
    } else {
      similar.push(node);
    }
  });

  return { exact, similar };
}

// === Helper to get the placeholder <img> HTML from the Liquid template ===
function getPlaceholderImgHTML() {
  // 1) Try the hidden <template> provided by Liquid (best: already has the right URL)
  const tpl = document.getElementById('tpl-product-placeholder');
  if (tpl && tpl.content) {
    const img = tpl.content.querySelector('img');
    if (img) return img.outerHTML; // returns <img ...> with the real asset_url
  }

  // 2) Try a global/data fallback if you set one elsewhere
  const fromData = document.getElementById('DualSearchContainer')?.dataset.placeholder;
  const fromGlobal = window.PRODUCT_PLACEHOLDER_URL;

  // 3) Final hardcoded fallback (ensure this path exists if used)
  const url = fromData || fromGlobal || '/placeholder-image-shopify.webp';
  return `<img src="${url}" alt="Product placeholder" loading="lazy">`;
}

function cardHTML(p) {
  const hasImg = p.featuredImage && p.featuredImage.url;

  const imgHtml = hasImg
    ? `<img src="${p.featuredImage.url}&width=600" sizes="(min-width: 1240px) 277px, (min-width: 990px) calc((100vw - 130px) / 4), (min-width: 750px) calc((100vw - 120px) / 3), calc((100vw - 35px) / 2)" alt="${(p.featuredImage.altText || p.title || '').replace(/"/g, '&quot;')}" loading="lazy">`
    : getPlaceholderImgHTML(); // 🔁 uses your Liquid-provided placeholder

  return `
    <li class="grid__item scroll-trigger">
      <a class="card-product" href="/products/${p.handle}">
        <div class="card-product__media">${imgHtml}</div>
        <div class="card-product__content">
          <h3 class="font-neue-roman">${p.title}</h3>
          <div class="product-sku font-neue-roman">SKU: ${p.variants.edges[0].node.sku}</div>
          <div class="price font-neue-roman"
            data-price-url="/products/${p.handle}?view=card-price">
              <!-- skeleton while loading -->
              <span class="price-skeleton">Loading price…</span>
          </div>
        </div>
      </a>
    </li>
  `;
}



  // Hide any product that has one of these tags (lowercased)
  const HIDDEN_TAGS = new Set(['no_search']);

  function filterOutHiddenTagProducts(edges) {
    let dropped = 0;
    const out = edges.filter(ed => {
      const node = ed?.node || {};
      const tags = (node.tags || []).map(t => String(t || '').toLowerCase());
      const hide = tags.some(t => HIDDEN_TAGS.has(t));
      if (hide) dropped++;
      return !hide;
    });
    return out;
  }

  function ensureList(id) {
    const sec = document.getElementById(id);
    if (!sec) return null;
    let ul = sec.querySelector('ul');
    if (!ul) {
      sec.innerHTML = `<ul class="grid product-grid grid--2-col-tablet-down grid--4-col-desktop"></ul>`;
      ul = sec.querySelector('ul');
    }
    return ul;
  }

  document.addEventListener('DOMContentLoaded', renderDualSearch);
  window.addEventListener('load', renderDualSearch);
  window.addEventListener('popstate', renderDualSearch);
  document.addEventListener('facets:changed', renderDualSearch);

  // make pushState/replaceState trigger a rerender (S&D updates URL)
  (function(history){
    const ps=history.pushState, rs=history.replaceState;
    history.pushState=function(s,t,u){ const r=ps.apply(this,arguments); window.dispatchEvent(new Event('locationchange')); return r; };
    history.replaceState=function(s,t,u){ const r=rs.apply(this,arguments); window.dispatchEvent(new Event('locationchange')); return r; };
  })(window.history);
  window.addEventListener('locationchange', () => window.renderDualSearch && window.renderDualSearch());

  // optional for manual debugging
  window.renderDualSearch = renderDualSearch;


// Parse metafield filters like:
function parseMetafieldFiltersFromUrl(url) {
  const p = new URL(url).searchParams;
  const out = [];

  for (const [key, val] of p.entries()) {
    let m = key.match(/^filter\.p\.m\.([^.]+)\.([^.]+)$/);
    if (m && val) {
      out.push({ scope: 'product', namespace: m[1], key: m[2], value: val });
      continue;
    }
    m = key.match(/^filter\.v\.m\.([^.]+)\.([^.]+)$/);
    if (m && val) {
      out.push({ scope: 'variant', namespace: m[1], key: m[2], value: val });
    }
  }

  return out;
}

function filterByStandardFacets(edges, urlStr) {
  const p = new URL(urlStr).searchParams;

  // --- selected values from URL ---
  const vendors = p.getAll('filter.p.vendor').map(v => v.toLowerCase());
  const types   = p.getAll('filter.p.product_type').map(t => t.toLowerCase());
  const tagsSel = p.getAll('filter.p.tag').map(t => t.toLowerCase());

  const collIds = [
    ...p.getAll('filter.p.collection_id'),
    ...p.getAll('filter.p.collection_id[]')
  ].filter(Boolean).map(String);

  const availSelected = ['filter.v.availability','filter.v.available','filter.v.in_stock']
    .some(k => p.get(k) === '1');

  const minCents = p.get('filter.v.price.gte');
  const maxCents = p.get('filter.v.price.lte');
  const minAmt = minCents != null ? Number(minCents) / 100 : null;
  const maxAmt = maxCents != null ? Number(maxCents) / 100 : null;

  const optionMap = new Map(); // name -> [values]
  for (const [key, val] of p.entries()) {
    const m = key.match(/^filter\.v\.option\.(.+)$/);
    if (m && val) {
      const name = decodeURIComponent(m[1]).toLowerCase();
      const list = optionMap.get(name) || [];
      list.push(val.toLowerCase());
      optionMap.set(name, list);
    }
  }

  // --- instrumentation counters ---
  const drop = {
    vendor: 0, type: 0, avail: 0, price: 0, tags: 0, colls: 0, options: 0
  };
  const had = {
    vendors: !!vendors.length,
    types:   !!types.length,
    tags:    !!tagsSel.length,
    colls:   !!collIds.length,
    avail:   availSelected,
    price:   (minAmt != null || maxAmt != null),
    options: optionMap.size > 0
  };

  // helper
  const lowerArr = (arr) => (arr || []).map(s => String(s || '').toLowerCase());

  const out = edges.filter(edge => {
    const n = edge.node;

    if (had.vendors) {
      const v = (n.vendor || '').toLowerCase();
      if (!vendors.includes(v)) { drop.vendor++; return false; }
    }

    if (had.types) {
      const t = (n.productType || '').toLowerCase();
      if (!types.includes(t)) { drop.type++; return false; }
    }

    if (had.avail) {
      if (n.availableForSale !== true) { drop.avail++; return false; }
    }

    if (had.price) {
      const amt = Number(n.priceRange?.minVariantPrice?.amount);
      if (!isFinite(amt)) { /* RELAX: can’t evaluate → don’t drop */ }
      else {
        if (minAmt != null && amt < minAmt) { drop.price++; return false; }
        if (maxAmt != null && amt > maxAmt) { drop.price++; return false; }
      }
    }

    if (had.tags) {
      const nodeTags = lowerArr(n.tags);
      if (nodeTags.length) {
        const ok = tagsSel.every(t => nodeTags.includes(t));
        if (!ok) { drop.tags++; return false; }
      }
      // RELAX: no tags on node → don’t drop
    }

    if (had.colls) {
      const nodeColls = n.collections?.nodes || [];
      if (nodeColls.length) {
        const nodeIds = nodeColls.map(c => (c.id || '').split('/').pop());
        const ok = collIds.every(id => nodeIds.includes(String(id)));
        if (!ok) { drop.colls++; return false; }
      }
      // RELAX: no collections on node → don’t drop
    }

    if (had.options) {
      const vEdges = n.variants?.edges || [];
      const selectedOptions = vEdges.flatMap(ve =>
        (ve.node.selectedOptions || []).map(o => ({
          name: (o.name || '').toLowerCase(),
          value: (o.value || '').toLowerCase()
        }))
      );
      if (selectedOptions.length) {
        for (const [optName, wantedValues] of optionMap.entries()) {
          const hasAny = selectedOptions.some(o => o.name === optName && wantedValues.includes(o.value));
          if (!hasAny) { drop.options++; return false; }
        }
      }
      // RELAX: no selectedOptions on node → don’t drop
    }

    return true;
  });

  // EXTRA: if we somehow filtered everything but edges>0, return edges instead of empty (fail-safe UX)
  if (!out.length && edges.length) {
    console.warn('[dual-search] all candidates dropped by standard facets; returning unfiltered list as fallback');
    return edges;
  }

  return out;
}

function collectMfValues(edges, ns, key) {
  const out = { product: [], variant: [] };
  edges.forEach(ed => {
    const n = ed.node;
    (n.metafields || []).forEach(mf => {
      if (mf?.namespace === ns && mf.key === key) out.product.push(mf.value);
    });
    (n.variants?.edges || []).forEach(ve => {
      (ve.node.metafields || []).forEach(mf => {
        if (mf?.namespace === ns && mf.key === key) out.variant.push(mf.value);
      });
    });
  });
  return out;
}

function inspectMetafieldCoverage(edges, mfFilters) {
  if (!mfFilters.length) return;
  const uniq = new Set(mfFilters.map(f => `${f.namespace}:${f.key}`));
  uniq.forEach(sig => {
    const [ns, key] = sig.split(':');
    const cov = collectMfValues(edges, ns, key);
    // console.log('[dual-search] mf coverage', {
    //   namespace: ns,
    //   key,
    //   productCount: cov.product.length,
    //   variantCount: cov.variant.length,
    //   sample: { product: cov.product.slice(0,3), variant: cov.variant.slice(0,3) }
    // });
  });
}

// ===== Similar pagination helpers (ADD THESE) =====
const SIM_PAGE_PARAM = 'sim_page';
const SIM_PER_PAGE   = 24;

function getSimPage(urlStr) {
  const p = new URL(urlStr).searchParams;
  const raw = parseInt(p.get(SIM_PAGE_PARAM) || '1', 10);
  return Math.max(1, isNaN(raw) ? 1 : raw);
}

function setSimPageInUrl(urlStr, page) {
  const u = new URL(urlStr, location.origin);
  if (page <= 1) u.searchParams.delete(SIM_PAGE_PARAM);
  else u.searchParams.set(SIM_PAGE_PARAM, String(page));
  return u.toString();
}

function renderSimPagination(container, totalItems, perPage, currentPage) {
  const totalPages = Math.max(1, Math.ceil(totalItems / perPage));
  if (currentPage > totalPages) currentPage = totalPages;

  // No controls needed if single page
  if (totalPages <= 1) {
    container.innerHTML = '';
    return;
  }

  // Build a compact page list (1 … window … last)
  const makeLink = (page, label = page, isCurrent = false, rel = '') => {
    const href = setSimPageInUrl(location.href, page);
    const cls  = 'pagination__item' + (isCurrent ? ' pagination__item--current' : '');
    const r    = rel ? ` rel="${rel}"` : '';
    return `<a href="${href}" class="${cls}" data-page="${page}"${r}>${label}</a>`;
  };

  const windowSize = 5; // centered window of numbered pages
  let start = Math.max(1, currentPage - Math.floor(windowSize/2));
  let end   = Math.min(totalPages, start + windowSize - 1);
  if (end - start + 1 < windowSize) start = Math.max(1, end - windowSize + 1);

  let html = '<div class="pagination__list">';

  // Prev
  if (currentPage > 1) {
    html += makeLink(currentPage - 1, '<svg aria-hidden="true" focusable="false" class="icon icon-caret prev-svg" viewBox="0 0 10 6"><path fill-rule="evenodd" clip-rule="evenodd" d="M9.354.646a.5.5 0 00-.708 0L5 4.293 1.354.646a.5.5 0 00-.708.708l4 4a.5.5 0 00.708 0l4-4a.5.5 0 000-.708z" fill="currentColor"></path></svg>', false, 'prev');
  }

  // First + leading ellipsis
  if (start > 1) {
    html += makeLink(1, '1', currentPage === 1);
    if (start > 2) html += `<span class="pagination__dots">…</span>`;
  }

  // Window
  for (let p = start; p <= end; p++) {
    html += makeLink(p, String(p), p === currentPage);
  }

  // Trailing ellipsis + Last
  if (end < totalPages) {
    if (end < totalPages - 1) html += `<span class="pagination__dots">…</span>`;
    html += makeLink(totalPages, String(totalPages), currentPage === totalPages);
  }

  // Next
  if (currentPage < totalPages) {
    html += makeLink(currentPage + 1, '<svg aria-hidden="true" focusable="false" class="icon icon-caret next-svg" viewBox="0 0 10 6"><path fill-rule="evenodd" clip-rule="evenodd" d="M9.354.646a.5.5 0 00-.708 0L5 4.293 1.354.646a.5.5 0 00-.708.708l4 4a.5.5 0 00.708 0l4-4a.5.5 0 000-.708z" fill="currentColor"></path></svg>', false, 'next');
  }

  html += '</div>';
  container.innerHTML = html;
}

// One-time delegate for clicks (avoid multiple bindings)
(function attachSimilarPaginationClickHandler(){
  let bound = false;
  document.addEventListener('DOMContentLoaded', () => {
    if (bound) return;
    bound = true;
    document.body.addEventListener('click', (ev) => {
      const a = ev.target.closest('#SimilarPagination a[data-page]');
      if (!a) return;
      ev.preventDefault();
      const nextUrl = a.getAttribute('href');
      history.pushState({ searchParams: new URL(nextUrl).search.slice(1) }, '', nextUrl);
      // trigger your existing rerender hooks
      window.dispatchEvent(new Event('locationchange'));
      document.dispatchEvent(new CustomEvent('facets:changed'));
    });
  });
})();

function cleanTitleText(s='') {
  return String(s).replace(/[\n\r]+/g,' ').replace(/\s+/g,' ').trim();
}

function updatePageTitle(rawTerm, exactCount, similarCount) {
  const term  = cleanTitleText(rawTerm);
  const total = (exactCount || 0) + (similarCount || 0);

  // Try to preserve your site suffix (e.g., “ | Shop Name” or “ – Shop Name”)
  const cur    = document.title;
  const suffix = (() => {
    const dash = cur.match(/\s[–-]\s(.+)$/);  // " – Shop Name" or " - Shop Name"
    if (dash) return ` – ${dash[1]}`;
    const pipe = cur.match(/\s\|\s(.+)$/);    // " | Shop Name"
    if (pipe) return ` | ${pipe[1]}`;
    return '';
  })();

  let title;
  if (total > 0) {
    const resultsWord = total === 1 ? 'result' : 'results';
    title = term ? `${term} — ${total} ${resultsWord}` : `Search — ${total} ${resultsWord}`;
  } else {
    title = term ? `No results for ${term}` : `No results`;
  }

  document.title = title + suffix;

  // Optional: keep OG title in sync
  const og = document.querySelector('meta[property="og:title"]');
  if (og) og.setAttribute('content', document.title);
}

function escapeHtml(s = '') {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function displaySearchTerm(raw) {
  const clean = escapeHtml((raw || '').trim());
  return clean ? `‘${clean}’` : 'your query';
}

async function hydrateCardPrices() {
  const els = document.querySelectorAll('.price[data-price-url]:not([data-loaded])');
  await Promise.all(Array.from(els).map(async (el) => {
    const url = el.getAttribute('data-price-url');
    try {
      const res = await fetch(url, { credentials: 'same-origin' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      el.innerHTML = html;              // HTML comes from product.card-price.liquid
      el.setAttribute('data-loaded', '1');
    } catch (e) {
      // optional fallback
      el.innerHTML = '';
    }
  }));
}

function setSectionTitleVisibility(sectionEl, visible, opts = {}) {
  const { fallbackId } = opts;

  // 1) title inside the section?
  let title = sectionEl?.querySelector('.search-results-section__title');

  // 2) try an explicit fallback id (if you add IDs in Liquid)
  if (!title && fallbackId) {
    title = document.getElementById(fallbackId);
  }

  // 3) try a sibling just before/after the section
  if (!title && sectionEl) {
    const prev = sectionEl.previousElementSibling;
    const next = sectionEl.nextElementSibling;
    if (prev?.classList?.contains('search-results-section__title')) title = prev;
    if (!title && next?.classList?.contains('search-results-section__title')) title = next;
  }

  // 4) last-ditch: if section is ExactMatches/SimilarMatches, try a global title tagged for it
  if (!title && sectionEl?.id) {
    title = document.querySelector(`.search-results-section__title[data-for="${sectionEl.id}"]`);
  }

  if (!title) return; // nothing to hide/show

  title.style.display = visible ? '' : 'none';
}


async function renderDualSearch() {
  console.log('[dual-search] start', location.search);

  const host = document.getElementById('DualSearchContainer') || document.body;

  // ensure each section has a UL we can write into
  const ensureList = (id) => {
    const wrap = document.getElementById(id);
    if (!wrap) return null;
    let ul = wrap.querySelector('ul');
    if (!ul) {
      wrap.innerHTML = `<ul class="grid product-grid grid--2-col-tablet-down grid--4-col-desktop"></ul>`;
      ul = wrap.querySelector('ul');
    }
    return ul;
  };

  try {
    // targets + loading state
    const exactWrap   = document.getElementById('ExactMatches');
    const similarWrap = document.getElementById('SimilarMatches');
    const exactUL     = ensureList('ExactMatches');
    const similarUL   = ensureList('SimilarMatches');
    if (!exactUL || !similarUL) {
      console.warn('[dual-search] containers missing; abort');
      return;
    }
    exactWrap?.classList.add('loading');
    similarWrap?.classList.add('loading');

    // build Storefront search (term only; we facet client-side)
    const url      = new URL(location.href);
    const qParam   = (url.searchParams.get('q') || '').trim();
    const queryStr = buildQueryStringFromUrl(url);   // returns q or "*"
    const { sortKey, reverse } = mapSort(url);

    // --- Metafield filters from URL ----------------------------------------
    const mfFilters = parseMetafieldFiltersFromUrl(url);

    // Build a UNION of identifiers: request on both product AND variant
    const uniq = new Set(mfFilters.map(f => `${f.namespace}::${f.key}`));
    const productMfIds = [];
    const variantMfIds = [];
    uniq.forEach(sig => {
      const [namespace, key] = sig.split('::');
      productMfIds.push({ namespace, key });
      variantMfIds.push({ namespace, key });
    });

    // always use WITH_MF; pass [] if none (variables are non-null lists)
    const queryDoc = SEARCH_GQL_WITH_MF;
    const vars = {
      query: queryStr,
      first: 240,
      sortKey,
      reverse,
      productMfIds,
      variantMfIds
    };

    // ----------------- FETCH (this is where to place the block) -------------
    const edges = await fetchPooledResults({ queryDoc, vars, pages: 2 });
   
    // ⛔️ Drop anything with hidden tags (e.g., no_search)
    const visible = filterOutHiddenTagProducts(edges);

    // A) Standard S&D facets (vendor/type/price/options/tags/collections)
    const std = filterByStandardFacets(visible, location.href);

    // 🧪 Log what metafields we actually fetched (diagnostic)
    inspectMetafieldCoverage(std, mfFilters);

    // B) Metafield facets (product OR variant) with "no-coverage" fail-safe
    const filtered = filterByMetafieldsTolerant(std, mfFilters);
    
    // C) Split exact vs similar (title === q OR any variant.sku === q)
    const { exact, similar } = splitExactSimilar(filtered, qParam);
    
    /* --- PAGINATE SIMILAR (24 per page) --- */
    const simPage = getSimPage(location.href);
    const totalSimilar = similar.length;
    const totalPages = Math.max(1, Math.ceil(totalSimilar / SIM_PER_PAGE));
    const safePage = Math.min(simPage, totalPages);
    const startIdx = (safePage - 1) * SIM_PER_PAGE;
    const pageItems = similar.slice(startIdx, startIdx + SIM_PER_PAGE);

    const hasExact   = exact.length > 0;
    const hasSimilar = totalSimilar > 0;

    /* --- Render Exact --- */
    exactUL.innerHTML = hasExact
    ? exact.map(cardHTML).join('')
    : hasSimilar
      ? `<li><p>No exact match found for ${displaySearchTerm(qParam)}. Showing similar products instead.</p></li>`
      : `<li><p>No results found for ${displaySearchTerm(qParam)}.</p></li>`;

    /* --- Render Similar (paged) --- */
    similarUL.innerHTML = hasSimilar
    ? pageItems.map(cardHTML).join('')
    : ``;

    setSectionTitleVisibility(exactWrap,   hasExact,   { fallbackId: 'ExactSectionTitle' });
    setSectionTitleVisibility(similarWrap, hasSimilar, { fallbackId: 'SimilarSectionTitle' });

    updatePageTitle(qParam, exact.length, totalSimilar);

    /* --- Render Similar pagination --- */
    const simPag = document.getElementById('SimilarPagination');
    if (simPag) renderSimPagination(simPag, totalSimilar, SIM_PER_PAGE, safePage);

    // counts
    const exCount = document.getElementById('ExactCount');
    const siCount = document.getElementById('SimilarCount');
    if (exCount) exCount.textContent = `(${exact.length})`;
    if (siCount) siCount.textContent = `(${totalSimilar})`;

    // Hydrate server-calculated (tier/B2B) prices so they match PDP
    await hydrateCardPrices();

    // done
    exactWrap?.classList.remove('loading');
    similarWrap?.classList.remove('loading');
  } catch (e) {
    console.error('[dual-search] render failed', e);
    const msg = String(e).replace(/</g, '&lt;');
    (document.getElementById('DualSearchContainer') || host)
      .insertAdjacentHTML('beforeend', `<p style="color:#c00;margin-top:1rem">Search fetch failed: ${msg}</p>`);
    document.getElementById('ExactMatches')?.classList.remove('loading');
    document.getElementById('SimilarMatches')?.classList.remove('loading');
  }
}




  // Run on page load, on back/forward, and after facets repaint
  document.addEventListener('DOMContentLoaded', renderDualSearch);
  window.addEventListener('load', renderDualSearch);
  window.addEventListener('popstate', renderDualSearch);
  document.addEventListener('facets:changed', renderDualSearch);

  // expose for manual debug
  window.renderDualSearch = renderDualSearch;
})();


customElements.define('main-search', MainSearch);
