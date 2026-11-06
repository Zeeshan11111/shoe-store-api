// Shared by the settings route (admin reads/writes) and the orders route
// (delivery fee, allowed payment methods), so both agree on one shape.

const DEFAULT_CATEGORIES = ['Sneakers', 'Sports', 'Casual', 'Formal', 'Sandals & Chappal', 'Peshawari', 'Khussa', 'School']

const DEFAULT_RETURN_POLICY = [
  'Exchange for a different size or colour within the return window, at our shop or by courier.',
  'Shoes must be unworn, with the original box and tags.',
  'Bring or send your order number with the shoes.',
  'Damaged or wrong item received? Tell us within 48 hours and we will replace it free.',
].join('\n')

function parseJson(text, fallback) {
  try {
    const v = JSON.parse(text)
    return v ?? fallback
  } catch {
    return fallback
  }
}

function serialize(s) {
  const categories = parseJson(s.categories, [])
  return {
    paymentMethods: {
      cod: { enabled: s.codEnabled, label: s.codLabel },
      jazzcash: { enabled: s.jazzcashEnabled, label: s.jazzcashLabel },
      easypaisa: { enabled: s.easypaisaEnabled, label: s.easypaisaLabel },
      card: { enabled: s.cardEnabled, label: s.cardLabel },
    },
    whatsapp: { enabled: s.whatsappEnabled, number: s.whatsappNumber },
    brandStrip: { enabled: s.brandStripEnabled },
    delivery: {
      fee: s.deliveryFee,
      freeAbove: s.freeDeliveryAbove,
      time: s.deliveryTime,
      cities: parseJson(s.deliveryCities, []),
    },
    store: {
      phone: s.storePhone,
      email: s.storeEmail,
      address: s.storeAddress,
      hours: s.storeHours,
      mapUrl: s.storeMapUrl,
    },
    returns: {
      days: s.returnDays,
      saleItems: s.returnSaleItems,
      policy: s.returnPolicy || DEFAULT_RETURN_POLICY,
    },
    originalBadge: { enabled: s.originalBadgeEnabled },
    categories: categories.length ? categories : DEFAULT_CATEGORIES,
  }
}

const money = (v, fallback = 0) => {
  const n = Math.round(Number(v))
  return Number.isFinite(n) && n >= 0 ? n : fallback
}
const text = (v, max = 500) => String(v ?? '').trim().slice(0, max)

// Only fields present in the request are written, so a partial save can
// never blank out another section.
function toRow(input) {
  const row = {}
  const pm = input.paymentMethods
  if (pm) {
    for (const key of ['cod', 'jazzcash', 'easypaisa', 'card']) {
      if (!pm[key]) continue
      row[`${key}Enabled`] = !!pm[key].enabled
      if (pm[key].label) row[`${key}Label`] = text(pm[key].label, 60)
    }
  }
  if (input.whatsapp) {
    row.whatsappEnabled = !!input.whatsapp.enabled
    row.whatsappNumber = text(input.whatsapp.number, 20).replace(/[^\d]/g, '')
  }
  if (input.brandStrip) row.brandStripEnabled = !!input.brandStrip.enabled

  if (input.delivery) {
    const d = input.delivery
    row.deliveryFee = money(d.fee)
    row.freeDeliveryAbove = money(d.freeAbove)
    row.deliveryTime = text(d.time, 60)
    const cities = (Array.isArray(d.cities) ? d.cities : [])
      .map((c) => ({ city: text(c.city, 60), fee: money(c.fee), time: text(c.time, 60) }))
      .filter((c) => c.city)
    row.deliveryCities = JSON.stringify(cities)
  }
  if (input.store) {
    const st = input.store
    row.storePhone = text(st.phone, 40)
    row.storeEmail = text(st.email, 120)
    row.storeAddress = text(st.address, 300)
    row.storeHours = text(st.hours, 120)
    const map = text(st.mapUrl, 500)
    row.storeMapUrl = /^https?:\/\//i.test(map) ? map : ''
  }
  if (input.returns) {
    row.returnDays = Math.min(365, money(input.returns.days, 7))
    row.returnSaleItems = !!input.returns.saleItems
    row.returnPolicy = text(input.returns.policy, 4000)
  }
  if (input.originalBadge) row.originalBadgeEnabled = !!input.originalBadge.enabled
  if (Array.isArray(input.categories)) {
    const seen = new Set()
    const cats = input.categories
      .map((c) => text(c, 40))
      .filter((c) => c && c.toLowerCase() !== 'all' && !seen.has(c.toLowerCase()) && seen.add(c.toLowerCase()))
    row.categories = JSON.stringify(cats)
  }
  return row
}

// Delivery charge for an order: a city-specific rate wins over the default,
// and the free-delivery threshold (if set) applies on top of either.
function deliveryFor(settings, city, subtotal) {
  const d = settings.delivery
  const match = d.cities.find((c) => c.city.toLowerCase() === String(city || '').trim().toLowerCase())
  const baseFee = match ? match.fee : d.fee
  const fee = d.freeAbove > 0 && subtotal >= d.freeAbove ? 0 : baseFee
  return { fee, time: (match && match.time) || d.time }
}

module.exports = { serialize, toRow, deliveryFor }
