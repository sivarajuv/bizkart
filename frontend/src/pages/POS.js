import React, { useEffect, useMemo, useState } from 'react';
import { customerAPI, orderAPI, productAPI } from '../services/api';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { buildCreditMessage, openSmsShare, openWhatsAppShare } from '../utils/customerSharing';
import { getLocalizedProductName } from '../utils/products';

function PaymentModal({ total, onClose, onSuccess, upiQrImage, shopName }) {
  const { items, dispatch } = useCart();
  const [method, setMethod] = useState('CASH');
  const [customers, setCustomers] = useState([]);
  const [customer, setCustomer] = useState({ name: '', phone: '' });
  const [amountPaid, setAmountPaid] = useState('');
  const [upiTxn, setUpiTxn] = useState('');
  const [cardLast4, setCardLast4] = useState('');
  const [cardType, setCardType] = useState('VISA');
  const [loading, setLoading] = useState(false);
  const fmt = (value) => `₹${Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  useEffect(() => {
    customerAPI.getAll().then((response) => setCustomers(response.data.slice(0, 50))).catch(() => {});
  }, []);

  useEffect(() => {
    if (method === 'CREDIT' && amountPaid === '') {
      setAmountPaid('0');
    }
    if (method !== 'CREDIT') {
      setAmountPaid(String(total));
    }
  }, [method, total]);

  const balanceDue = Math.max(total - Number(amountPaid || 0), 0);
  const filteredCustomers = customers.filter((item) => {
    const needle = `${customer.name} ${customer.phone}`.trim().toLowerCase();
    if (!needle) return false;
    return item.name?.toLowerCase().includes(needle) || item.phone?.includes(customer.phone);
  }).slice(0, 5);

  const handlePay = async () => {
    setLoading(true);
    try {
      const payload = {
        customerName: customer.name || 'Walk-in Customer',
        customerPhone: customer.phone,
        paymentMethod: method,
        amountPaid: method === 'CREDIT' ? Number(amountPaid || 0) : total,
        upiTransactionId: method === 'UPI' ? upiTxn : null,
        cardLast4: method === 'CARD' ? cardLast4 : null,
        cardType: method === 'CARD' ? cardType : null,
        items: items.map((item) => ({ productId: item.product.id, quantity: item.quantity })),
      };
      const response = await orderAPI.create(payload);
      dispatch({ type: 'CLEAR' });
      onSuccess(response.data);
    } catch (error) {
      alert(error.response?.data?.error || 'Payment failed');
    }
    setLoading(false);
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h2 className="modal-title">Complete Sale</h2>
        <div className="payment-summary">
          <div className="payment-summary-row"><span>Items</span><span>{items.reduce((sum, item) => sum + item.quantity, 0)}</span></div>
          <div className="payment-summary-row total"><span>Bill Amount</span><span>{fmt(total)}</span></div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Customer Name</label>
            <input className="form-input" value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} placeholder="Walk-in or ledger customer" />
          </div>
          <div className="form-group">
            <label className="form-label">Mobile Number</label>
            <input className="form-input" value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} placeholder="Required for credit sales" />
          </div>
        </div>

        {filteredCustomers.length > 0 && (
          <div className="card" style={{ padding: 12, marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Existing customers</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {filteredCustomers.map((item) => (
                <button key={item.id} className="btn btn-secondary btn-sm" onClick={() => setCustomer({ name: item.name, phone: item.phone || '' })}>
                  {item.name} {item.outstandingBalance > 0 ? `• Due ₹${Number(item.outstandingBalance).toLocaleString('en-IN')}` : ''}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="payment-methods">
          {['CASH', 'CARD', 'UPI', 'CREDIT'].map((item) => (
            <div key={item} className={`payment-method-btn ${method === item ? 'selected' : ''}`} onClick={() => setMethod(item)}>
              <div className="payment-method-label">{item}</div>
            </div>
          ))}
        </div>

        {method === 'UPI' && (
          <div className="card" style={{ padding: 16, marginBottom: 16 }}>
            {upiQrImage && (
              <div style={{ textAlign: 'center', marginBottom: 16 }}>
                <img src={upiQrImage} alt={`${shopName || 'Store'} UPI QR`} style={{ width: 220, maxWidth: '100%', borderRadius: 12, border: '1px solid var(--border)' }} />
                <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>Ask the customer to scan this QR and then capture the UPI reference below.</div>
              </div>
            )}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">UPI Transaction ID</label>
              <input className="form-input" value={upiTxn} onChange={(e) => setUpiTxn(e.target.value)} placeholder="Enter UPI reference number" />
            </div>
          </div>
        )}

        {method === 'CARD' && (
          <div className="form-row">
            <div className="form-group"><label className="form-label">Card Type</label><select className="form-select" value={cardType} onChange={(e) => setCardType(e.target.value)}><option>VISA</option><option>MASTERCARD</option><option>RUPAY</option></select></div>
            <div className="form-group"><label className="form-label">Last 4 Digits</label><input className="form-input" value={cardLast4} onChange={(e) => setCardLast4(e.target.value.replace(/\D/g, ''))} maxLength={4} /></div>
          </div>
        )}

        {method === 'CREDIT' && (
          <div className="card" style={{ padding: 16, marginBottom: 16 }}>
            <div className="form-group">
              <label className="form-label">Amount Received Now</label>
              <input className="form-input" type="number" min="0" max={total} step="0.01" value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} />
            </div>
            <div className="payment-summary">
              <div className="payment-summary-row"><span>Collected Now</span><span>{fmt(amountPaid || 0)}</span></div>
              <div className="payment-summary-row total"><span>Ledger Due</span><span>{fmt(balanceDue)}</span></div>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</button>
          <button className="btn btn-primary" onClick={handlePay} disabled={loading} style={{ flex: 2 }}>{loading ? 'Processing...' : method === 'CREDIT' ? 'Save Credit Sale' : `Pay ${fmt(total)}`}</button>
        </div>
      </div>
    </div>
  );
}

export default function POS() {
  const { user } = useAuth();
  const { language, t } = useLanguage();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [showPayment, setShowPayment] = useState(false);
  const [successOrder, setSuccessOrder] = useState(null);
  const { items, total, count, dispatch } = useCart();

  useEffect(() => {
    productAPI.getAll().then((response) => setProducts(response.data));
    productAPI.getCategories().then((response) => setCategories(response.data));
  }, []);

  const filtered = useMemo(() => products.filter((product) => {
    const name = getLocalizedProductName(product, language).toLowerCase();
    const matchCategory = activeCategory === 'All' || product.category === activeCategory;
    const matchSearch = !search || name.includes(search.toLowerCase()) || product.sku?.toLowerCase().includes(search.toLowerCase());
    return matchCategory && matchSearch && product.active;
  }), [products, activeCategory, search, language]);

  const addToCart = (product) => {
    if (product.stock <= 0) return;
    dispatch({ type: 'ADD_ITEM', product });
  };

  const fmt = (value) => `₹${Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  const creditMessage = successOrder?.balanceDue > 0 ? buildCreditMessage({
    customerName: successOrder.customerName,
    shopName: user?.shop?.name,
    orderNumber: successOrder.orderNumber,
    totalAmount: successOrder.totalAmount,
    amountPaid: successOrder.amountPaid,
    balanceDue: successOrder.balanceDue,
    paymentMethod: successOrder.paymentMethod,
  }) : '';

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">{t('pointOfSale')}</h1>
        <p className="page-subtitle">Counter billing with customer mobile, credit tracking, and multilingual product names</p>
      </div>

      <div className="pos-layout">
        <div className="products-grid">
          <div className="products-search-bar">
            <div className="search-input-wrap">
              <span className="search-icon">🔍</span>
              <input className="search-input" placeholder={t('searchProducts')} value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="category-tabs">
              <button className={`cat-tab ${activeCategory === 'All' ? 'active' : ''}`} onClick={() => setActiveCategory('All')}>All</button>
              {categories.map((category) => <button key={category} className={`cat-tab ${activeCategory === category ? 'active' : ''}`} onClick={() => setActiveCategory(category)}>{category}</button>)}
            </div>
          </div>

          <div className="product-cards">
            {filtered.map((product) => (
              <div key={product.id} className={`product-card ${product.stock <= 0 ? 'out-of-stock' : ''}`} onClick={() => addToCart(product)}>
                <div className="product-card-name">{getLocalizedProductName(product, language)}</div>
                <div className="product-card-price">{fmt(product.price)}</div>
                <div className="product-card-unit">{product.packSize || product.unit}</div>
                <div className="product-card-stock">{product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="cart-panel">
          <div className="cart-header">
            <span className="cart-title">Cart</span>
            <span className="cart-count">{count} items</span>
          </div>
          <div className="cart-items">
            {items.length === 0 ? (
              <div className="cart-empty"><span style={{ fontSize: 48 }}>🛒</span><span>Cart is empty</span></div>
            ) : items.map((item) => (
              <div key={item.product.id} className="cart-item">
                <div className="cart-item-info">
                  <div className="cart-item-name">{getLocalizedProductName(item.product, language)}</div>
                  <div className="cart-item-price">{fmt(item.product.price)} / {item.product.unit}</div>
                </div>
                <div className="qty-controls">
                  <button className="qty-btn" onClick={() => dispatch({ type: 'UPDATE_QTY', productId: item.product.id, quantity: item.quantity - 1 })}>-</button>
                  <span className="qty-num">{item.quantity}</span>
                  <button className="qty-btn" onClick={() => dispatch({ type: 'UPDATE_QTY', productId: item.product.id, quantity: item.quantity + 1 })}>+</button>
                </div>
                <div className="cart-item-subtotal">{fmt(item.product.price * item.quantity)}</div>
              </div>
            ))}
          </div>
          <div className="cart-footer">
            <div className="cart-total-row">
              <span className="cart-total-label">Total</span>
              <span className="cart-total-value">{fmt(total)}</span>
            </div>
            {items.length > 0 && <button className="btn btn-secondary btn-sm" style={{ marginBottom: 10, width: '100%' }} onClick={() => dispatch({ type: 'CLEAR' })}>Clear Cart</button>}
            <button className="btn btn-primary btn-lg w-full" disabled={!items.length} onClick={() => setShowPayment(true)}>Proceed to Checkout</button>
          </div>
        </div>
      </div>

      {showPayment && <PaymentModal total={total} onClose={() => setShowPayment(false)} onSuccess={(order) => { setShowPayment(false); setSuccessOrder(order); }} upiQrImage={user?.shop?.upiQrImage} shopName={user?.shop?.name} />}
      {successOrder && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="success-screen">
              <div className="success-icon">✅</div>
              <div className="success-title">{successOrder.balanceDue > 0 ? 'Credit Sale Saved' : 'Payment Successful'}</div>
              <div className="success-order">{successOrder.orderNumber}</div>
              {successOrder.balanceDue > 0 && <div style={{ color: 'var(--text-muted)', marginBottom: 16 }}>Outstanding: {fmt(successOrder.balanceDue)}</div>}
              {successOrder.balanceDue > 0 && (
                <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => openWhatsAppShare(successOrder.customerPhone, creditMessage)} disabled={!successOrder.customerPhone}>Share on WhatsApp</button>
                  <button className="btn btn-secondary btn-sm" onClick={() => openSmsShare(successOrder.customerPhone, creditMessage)} disabled={!successOrder.customerPhone}>Share by SMS</button>
                </div>
              )}
              <button className="btn btn-primary btn-lg w-full" onClick={() => setSuccessOrder(null)}>New Transaction</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
