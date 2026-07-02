import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { LANGUAGES, getLanguageLabel, useLanguage } from '../context/LanguageContext';
import { productAPI, shopAPI } from '../services/api';
import { getLocalizedProductDescription, getLocalizedProductName } from '../utils/products';

const TRANSLATION_LANGUAGES = LANGUAGES.filter((item) => item.code !== 'en');
const EMPTY_TRANSLATIONS = TRANSLATION_LANGUAGES.reduce((acc, item) => {
  acc[item.code] = { displayName: '', description: '' };
  return acc;
}, {});

const EMPTY_FORM = {
  shopId: '',
  name: '',
  sku: '',
  category: '',
  brand: '',
  barcode: '',
  packSize: '',
  price: '',
  mrp: '',
  purchasePrice: '',
  stock: '',
  minStockLevel: '',
  unit: 'kg',
  description: '',
  active: true,
  featured: false,
  taxable: true,
  gstRate: '',
  hsnCode: '',
  translations: EMPTY_TRANSLATIONS,
};

const CATEGORY_SUGGESTIONS = ['Grains & Staples', 'Pulses & Lentils', 'Oils & Ghee', 'Vegetables', 'Fruits', 'Dairy & Eggs', 'Spices', 'Beverages', 'Snacks', 'Bakery', 'Home & Personal Care', 'Construction Materials', 'Steel', 'Cement', 'Hardware', 'POS Essentials'];
const UNITS = ['kg', 'g', 'litre', 'ml', 'piece', 'dozen', 'packet', 'bag', 'bottle', 'box', 'cup', 'tray', 'loaf', 'ton', 'bundle', 'sheet', 'rod'];

function ProductModal({ product, shops, onClose, onSave, currentShopId, isAdmin, categories }) {
  const { t } = useLanguage();
  const [selectedTranslationLanguage, setSelectedTranslationLanguage] = useState(TRANSLATION_LANGUAGES[0]?.code || 'hi');
  const translationState = TRANSLATION_LANGUAGES.reduce((acc, item) => {
    const match = product?.translations?.find((entry) => entry.languageCode === item.code);
    acc[item.code] = { displayName: match?.displayName || '', description: match?.description || '' };
    return acc;
  }, {});

  const initialForm = product ? {
    ...EMPTY_FORM,
    ...product,
    shopId: product.shop?.id || currentShopId,
    translations: translationState,
  } : {
    ...EMPTY_FORM,
    shopId: currentShopId,
    translations: EMPTY_TRANSLATIONS,
  };

  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);

  const buildPayload = () => ({
    shopId: Number(form.shopId),
    name: (form.name || '').trim(),
    sku: (form.sku || '').trim(),
    category: (form.category || '').trim(),
    brand: (form.brand || '').trim(),
    barcode: (form.barcode || '').trim(),
    packSize: (form.packSize || '').trim(),
    price: Number(form.price),
    mrp: form.mrp ? Number(form.mrp) : null,
    purchasePrice: form.purchasePrice ? Number(form.purchasePrice) : null,
    stock: Number(form.stock),
    minStockLevel: form.minStockLevel ? Number(form.minStockLevel) : 0,
    unit: form.unit,
    description: (form.description || '').trim(),
    active: form.active,
    featured: form.featured,
    taxable: form.taxable,
    gstRate: form.gstRate === '' ? null : Number(form.gstRate),
    hsnCode: (form.hsnCode || '').trim(),
    translations: TRANSLATION_LANGUAGES
      .filter((item) => form.translations[item.code].displayName || form.translations[item.code].description)
      .map((item) => ({ languageCode: item.code, ...form.translations[item.code] })),
  });

  const handleSubmit = async () => {
    if (!form.name || !form.category || !form.price || form.stock === '' || !form.sku || !form.shopId) {
      alert('Please fill all required product fields');
      return;
    }

    setSaving(true);
    try {
      if (product?.id) {
        await productAPI.update(product.id, buildPayload());
      } else {
        await productAPI.create(buildPayload());
      }
      onSave();
      onClose();
    } catch (error) {
      alert(error.response?.data?.error || 'Unable to save product');
    }
    setSaving(false);
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 820 }}>
        <h2 className="modal-title">{product?.id ? 'Edit Product' : t('addProduct')}</h2>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">{t('shop')} *</label>
            <select className="form-select" value={form.shopId} onChange={(e) => setForm({ ...form, shopId: e.target.value })} disabled={!isAdmin}>
              {shops.map((shop) => <option key={shop.id} value={shop.id}>{shop.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">SKU *</label>
            <input className="form-input" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Product Name *</label>
            <input className="form-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">{t('category')} *</label>
            <input className="form-input" list="category-suggestions" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Ex: Kirana, Cement, TMT Steel" />
            <datalist id="category-suggestions">
              {[...new Set([...categories, ...CATEGORY_SUGGESTIONS])].map((category) => <option key={category} value={category} />)}
            </datalist>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Brand</label>
            <input className="form-input" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Barcode</label>
            <input className="form-input" value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Pack Size</label>
            <input className="form-input" value={form.packSize} onChange={(e) => setForm({ ...form, packSize: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">{t('unit')}</label>
            <select className="form-select" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
              {UNITS.map((unit) => <option key={unit}>{unit}</option>)}
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">{t('price')} *</label>
            <input className="form-input" type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">MRP</label>
            <input className="form-input" type="number" step="0.01" value={form.mrp} onChange={(e) => setForm({ ...form, mrp: e.target.value })} />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Purchase Price</label>
            <input className="form-input" type="number" step="0.01" value={form.purchasePrice} onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">{t('stock')} *</label>
            <input className="form-input" type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Min Stock Level</label>
            <input className="form-input" type="number" value={form.minStockLevel} onChange={(e) => setForm({ ...form, minStockLevel: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <input className="form-input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">GST Slab</label>
            <select className="form-select" value={form.gstRate} onChange={(e) => setForm({ ...form, gstRate: e.target.value })}>
              <option value="">Not Set</option>
              {[0, 5, 12, 18, 28].map((rate) => <option key={rate} value={rate}>{rate}%</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">HSN Code</label>
            <input className="form-input" value={form.hsnCode} onChange={(e) => setForm({ ...form, hsnCode: e.target.value })} placeholder="Optional HSN code" />
          </div>
        </div>

        <div className="card" style={{ padding: 16, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
            <div style={{ fontWeight: 700 }}>Regional language names</div>
            <select className="form-select" style={{ width: 220 }} value={selectedTranslationLanguage} onChange={(e) => setSelectedTranslationLanguage(e.target.value)}>
              {TRANSLATION_LANGUAGES.map((language) => <option key={language.code} value={language.code}>{getLanguageLabel(language.code)}</option>)}
            </select>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">{getLanguageLabel(selectedTranslationLanguage)} Name</label>
              <input className="form-input" value={form.translations[selectedTranslationLanguage].displayName} onChange={(e) => setForm({ ...form, translations: { ...form.translations, [selectedTranslationLanguage]: { ...form.translations[selectedTranslationLanguage], displayName: e.target.value } } })} />
            </div>
            <div className="form-group">
              <label className="form-label">{getLanguageLabel(selectedTranslationLanguage)} Description</label>
              <input className="form-input" value={form.translations[selectedTranslationLanguage].description} onChange={(e) => setForm({ ...form, translations: { ...form.translations, [selectedTranslationLanguage]: { ...form.translations[selectedTranslationLanguage], description: e.target.value } } })} />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 16, marginBottom: 18 }}>
          <label><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Active</label>
          <label><input type="checkbox" checked={form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} /> Featured</label>
          <label><input type="checkbox" checked={form.taxable} onChange={(e) => setForm({ ...form, taxable: e.target.checked })} /> Taxable</label>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={saving} style={{ flex: 2 }}>
            {saving ? 'Saving...' : 'Save Product'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Products() {
  const { user, isSuperAdmin, canManageCatalog } = useAuth();
  const { language, t } = useLanguage();
  const [products, setProducts] = useState([]);
  const [shops, setShops] = useState([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [categories, setCategories] = useState([]);
  const [editProduct, setEditProduct] = useState(null);
  const [showAdd, setShowAdd] = useState(false);

  const load = async () => {
    const [productsRes, categoriesRes] = await Promise.all([productAPI.getAll(), productAPI.getCategories()]);
    setProducts(productsRes.data);
    setCategories(categoriesRes.data);
    if (isSuperAdmin()) {
      const shopsRes = await shopAPI.getAll();
      setShops(shopsRes.data);
    } else if (user?.shop) {
      setShops([user.shop]);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => products.filter((product) => {
    const localizedName = getLocalizedProductName(product, language).toLowerCase();
    const matchCategory = categoryFilter === 'All' || product.category === categoryFilter;
    const matchSearch = !search || localizedName.includes(search.toLowerCase()) || product.sku?.toLowerCase().includes(search.toLowerCase());
    return matchCategory && matchSearch;
  }), [products, categoryFilter, search, language]);

  const handleDelete = async (id, name) => {
    if (window.confirm(`Delete "${name}"?`)) {
      await productAPI.delete(id);
      load();
    }
  };

  const fmt = (value) => `₹${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">{t('products')}</h1>
        <p className="page-subtitle">{t('configurableCatalog')}</p>
      </div>

      <div className="products-page-layout">
        <div className="products-toolbar">
          <input className="search-input form-input" placeholder={t('searchProducts')} value={search} onChange={(e) => setSearch(e.target.value)} style={{ maxWidth: 320 }} />
          <select className="form-select" style={{ width: 'auto' }} value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option>All</option>
            {categories.map((category) => <option key={category}>{category}</option>)}
          </select>
          {canManageCatalog() && <button className="btn btn-primary" onClick={() => setShowAdd(true)}>{t('addProduct')}</button>}
          <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: 13 }}>{filtered.length} products</span>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Product</th>
                {isSuperAdmin() && <th>{t('shop')}</th>}
                <th>SKU</th>
                <th>{t('category')}</th>
                <th>GST</th>
                <th>HSN</th>
                <th>{t('price')}</th>
                <th>MRP</th>
                <th>Cost</th>
                <th>{t('stock')}</th>
                <th>Status</th>
                {canManageCatalog() && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((product) => (
                <tr key={product.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{getLocalizedProductName(product, language)}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{getLocalizedProductDescription(product, language)}</div>
                  </td>
                  {isSuperAdmin() && <td>{product.shop?.name}</td>}
                  <td style={{ fontFamily: 'monospace' }}>{product.sku}</td>
                  <td><span className="badge badge-gray">{product.category}</span></td>
                  <td>{product.gstRate != null ? `${product.gstRate}%` : '—'}</td>
                  <td style={{ fontFamily: 'monospace' }}>{product.hsnCode || '—'}</td>
                  <td style={{ fontWeight: 700, color: 'var(--primary)' }}>{fmt(product.price)}</td>
                  <td>{fmt(product.mrp)}</td>
                  <td>{fmt(product.purchasePrice)}</td>
                  <td>{product.stock} / min {product.minStockLevel}</td>
                  <td>
                    {!product.active ? <span className="badge badge-danger">Inactive</span> :
                      product.stock === 0 ? <span className="badge badge-danger">Out of Stock</span> :
                        product.stock <= product.minStockLevel ? <span className="badge badge-warning">Low Stock</span> :
                          <span className="badge badge-success">Healthy</span>}
                  </td>
                  {canManageCatalog() && (
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => setEditProduct(product)}>Edit</button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(product.id, product.name)}>Delete</button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {(showAdd || editProduct) && (
        <ProductModal
          product={editProduct}
          shops={shops}
          categories={categories}
          currentShopId={user?.shop?.id}
          isAdmin={isSuperAdmin()}
          onClose={() => {
            setShowAdd(false);
            setEditProduct(null);
          }}
          onSave={load}
        />
      )}
    </div>
  );
}
