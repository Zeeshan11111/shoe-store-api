// OpenAPI spec served at /api-docs

const ok = (schema = {}) => ({
  200: {
    description: '{ data, error } envelope',
    content: {
      'application/json': {
        schema: {
          type: 'object',
          properties: { data: schema, error: { type: 'string', nullable: true } },
        },
      },
    },
  },
})

const json = (schema, example) => ({
  required: true,
  content: { 'application/json': { schema, ...(example ? { example } : {}) } },
})

const ref = (name) => ({ $ref: `#/components/schemas/${name}` })
const arrayOf = (name) => ({ type: 'array', items: ref(name) })
const pathParam = (name) => ({ name, in: 'path', required: true, schema: { type: 'string' } })
const queryParam = (name, extra = {}) => ({ name, in: 'query', schema: { type: 'string', ...extra } })

const userAuth = [{ userCookie: [] }]
const adminAuth = [{ adminCookie: [] }]

module.exports = {
  openapi: '3.0.3',
  info: {
    title: 'Shoe Store API',
    version: '1.0.0',
    description:
      'Every response is `{ data, error }`. Auth uses httpOnly cookies — log in via `/api/auth/login` or `/api/admin-auth/login` from this page and the browser sends the cookie automatically.',
  },
  servers: [{ url: '/' }],
  components: {
    securitySchemes: {
      userCookie: { type: 'apiKey', in: 'cookie', name: 'stryde_session' },
      adminCookie: { type: 'apiKey', in: 'cookie', name: 'stryde_admin_session' },
    },
    schemas: {
      Colorway: {
        type: 'object',
        properties: { sole: { type: 'string' }, upper: { type: 'string' }, accent: { type: 'string' } },
      },
      Product: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          brand: { type: 'string' },
          category: { type: 'string' },
          gender: { type: 'string' },
          price: { type: 'number' },
          originalPrice: { type: 'number', nullable: true },
          rating: { type: 'number' },
          reviews: { type: 'integer' },
          isNew: { type: 'boolean' },
          stock: { type: 'integer' },
          description: { type: 'string' },
          colorway: ref('Colorway'),
          colors: { type: 'array', items: {} },
          sizes: { type: 'array', items: {} },
        },
      },
      CartItem: {
        type: 'object',
        properties: {
          key: { type: 'string' },
          id: { type: 'string', description: 'Product id' },
          name: { type: 'string' },
          brand: { type: 'string' },
          price: { type: 'number' },
          size: { type: 'string' },
          qty: { type: 'integer' },
          colorway: ref('Colorway'),
          colorName: { type: 'string' },
        },
      },
      Banner: {
        type: 'object',
        properties: {
          eyebrow: { type: 'string' },
          heading: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 2 },
          description: { type: 'string' },
          colorway: ref('Colorway'),
        },
      },
      Settings: {
        type: 'object',
        properties: {
          paymentMethods: {
            type: 'object',
            properties: {
              jazzcash: { type: 'object', properties: { enabled: { type: 'boolean' }, label: { type: 'string' } } },
              easypaisa: { type: 'object', properties: { enabled: { type: 'boolean' }, label: { type: 'string' } } },
              card: { type: 'object', properties: { enabled: { type: 'boolean' }, label: { type: 'string' } } },
            },
          },
          whatsapp: { type: 'object', properties: { enabled: { type: 'boolean' }, number: { type: 'string' } } },
        },
      },
      Credentials: {
        type: 'object',
        required: ['email', 'password'],
        properties: { email: { type: 'string' }, password: { type: 'string' } },
      },
      Admin: {
        type: 'object',
        properties: {
          email: { type: 'string' },
          role: { type: 'string', enum: ['super', 'admin'] },
          permissions: { type: 'array', items: ref('Permission') },
        },
      },
      Permission: { type: 'string', enum: ['dashboard', 'orders', 'products', 'banners', 'users'] },
    },
  },
  paths: {
    '/api/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Register a customer',
        requestBody: json({
          type: 'object',
          required: ['name', 'email', 'password'],
          properties: { name: { type: 'string' }, email: { type: 'string' }, password: { type: 'string' }, phone: { type: 'string' } },
        }),
        responses: ok(),
      },
    },
    '/api/auth/login': {
      post: { tags: ['Auth'], summary: 'Customer login (sets cookie)', requestBody: json(ref('Credentials')), responses: ok() },
    },
    '/api/auth/logout': { post: { tags: ['Auth'], summary: 'Customer logout', responses: ok({ type: 'boolean' }) } },
    '/api/auth/me': { get: { tags: ['Auth'], summary: 'Current customer', responses: ok() } },

    '/api/admin-auth/login': {
      post: { tags: ['Admin auth'], summary: 'Admin login (sets cookie)', requestBody: json(ref('Credentials')), responses: ok(ref('Admin')) },
    },
    '/api/admin-auth/logout': { post: { tags: ['Admin auth'], summary: 'Admin logout', responses: ok({ type: 'boolean' }) } },
    '/api/admin-auth/me': { get: { tags: ['Admin auth'], summary: 'Current admin', responses: ok(ref('Admin')) } },
    '/api/admin-auth/admins': {
      get: { tags: ['Admin auth'], summary: 'List admins (super admin)', security: adminAuth, responses: ok(arrayOf('Admin')) },
      post: {
        tags: ['Admin auth'],
        summary: 'Create admin (super admin)',
        security: adminAuth,
        requestBody: json({
          type: 'object',
          required: ['email', 'password', 'permissions'],
          properties: { email: { type: 'string' }, password: { type: 'string' }, permissions: { type: 'array', items: ref('Permission') } },
        }),
        responses: ok({ type: 'boolean' }),
      },
    },
    '/api/admin-auth/admins/{email}': {
      patch: {
        tags: ['Admin auth'],
        summary: 'Update admin permissions (super admin)',
        security: adminAuth,
        parameters: [pathParam('email')],
        requestBody: json({ type: 'object', properties: { permissions: { type: 'array', items: ref('Permission') } } }),
        responses: ok({ type: 'boolean' }),
      },
      delete: {
        tags: ['Admin auth'],
        summary: 'Delete admin (super admin)',
        security: adminAuth,
        parameters: [pathParam('email')],
        responses: ok({ type: 'boolean' }),
      },
    },

    '/api/products': {
      get: {
        tags: ['Products'],
        summary: 'List products (filtered)',
        parameters: [
          queryParam('category', { default: 'All' }),
          queryParam('gender', { default: 'All' }),
          queryParam('search'),
          queryParam('sort', { enum: ['featured', 'price-asc', 'price-desc', 'rating', 'newest'], default: 'featured' }),
        ],
        responses: ok(arrayOf('Product')),
      },
      post: { tags: ['Products'], summary: 'Create or update product (upsert by id)', requestBody: json(ref('Product')), responses: ok(ref('Product')) },
    },
    '/api/products/all': { get: { tags: ['Products'], summary: 'All products (admin)', responses: ok(arrayOf('Product')) } },
    '/api/products/{id}': {
      get: { tags: ['Products'], summary: 'Get product', parameters: [pathParam('id')], responses: ok(ref('Product')) },
      delete: { tags: ['Products'], summary: 'Delete product', parameters: [pathParam('id')], responses: ok({ type: 'boolean' }) },
    },

    '/api/cart': {
      get: { tags: ['Cart'], summary: 'Current user cart', security: userAuth, responses: ok(arrayOf('CartItem')) },
      post: {
        tags: ['Cart'],
        summary: 'Add/update item, or bulk-merge with { items: [...] }',
        security: userAuth,
        requestBody: json({
          oneOf: [ref('CartItem'), { type: 'object', properties: { items: arrayOf('CartItem') } }],
        }),
        responses: ok(),
      },
      delete: { tags: ['Cart'], summary: 'Clear cart', security: userAuth, responses: ok() },
    },
    '/api/cart/{key}': {
      delete: { tags: ['Cart'], summary: 'Remove one cart item', security: userAuth, parameters: [pathParam('key')], responses: ok() },
    },

    '/api/wishlist': {
      get: { tags: ['Wishlist'], summary: 'Wishlisted product ids', security: userAuth, responses: ok({ type: 'array', items: { type: 'string' } }) },
      post: {
        tags: ['Wishlist'],
        summary: 'Toggle { productId } or bulk-merge { ids: [...] }',
        security: userAuth,
        requestBody: json({
          type: 'object',
          properties: { productId: { type: 'string' }, ids: { type: 'array', items: { type: 'string' } } },
        }),
        responses: ok({ type: 'array', items: { type: 'string' } }),
      },
    },

    '/api/orders': {
      get: { tags: ['Orders'], summary: 'All orders (admin)', responses: ok() },
      post: {
        tags: ['Orders'],
        summary: 'Place an order (~8% simulated payment decline)',
        requestBody: json({
          type: 'object',
          required: ['items'],
          properties: {
            items: arrayOf('CartItem'),
            customer: { type: 'object', properties: { name: { type: 'string' }, email: { type: 'string' } } },
            shippingAddress: { type: 'object' },
            paymentMethod: { type: 'string', enum: ['jazzcash', 'easypaisa', 'card'] },
          },
        }),
        responses: ok(),
      },
    },
    '/api/orders/track': {
      get: {
        tags: ['Orders'],
        summary: 'Track an order',
        parameters: [queryParam('orderId', { example: 'ORD-123456' }), queryParam('email')],
        responses: ok(),
      },
    },
    '/api/orders/{orderId}/status': {
      patch: {
        tags: ['Orders'],
        summary: 'Update order status',
        parameters: [pathParam('orderId')],
        requestBody: json({ type: 'object', properties: { status: { type: 'string', enum: ['Pending', 'Confirmed', 'Delivered'] } } }),
        responses: ok(),
      },
    },

    '/api/banners': {
      get: { tags: ['Banners'], summary: 'Hero banners', responses: ok(arrayOf('Banner')) },
      put: { tags: ['Banners'], summary: 'Replace all banners', requestBody: json(arrayOf('Banner')), responses: ok(arrayOf('Banner')) },
    },
    '/api/settings': {
      get: { tags: ['Settings'], summary: 'Store settings', responses: ok(ref('Settings')) },
      put: { tags: ['Settings'], summary: 'Update settings', requestBody: json(ref('Settings')), responses: ok(ref('Settings')) },
    },
    '/api/dashboard': { get: { tags: ['Dashboard'], summary: 'Admin stats + sales chart', responses: ok() } },
    '/api/users': { get: { tags: ['Users'], summary: 'Registered customers (admin)', responses: ok() } },
  },
}
