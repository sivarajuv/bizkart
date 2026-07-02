export function normalizeIndianPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) {
    return '';
  }
  if (digits.length === 10) {
    return `91${digits}`;
  }
  if (digits.length > 10 && digits.startsWith('91')) {
    return digits;
  }
  return digits;
}

export function openWhatsAppShare(phone, message) {
  const normalizedPhone = normalizeIndianPhone(phone);
  const url = normalizedPhone
    ? `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`
    : `https://wa.me/?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

export function openSmsShare(phone, message) {
  const recipient = String(phone || '').trim();
  const separator = recipient.includes('?') ? '&' : '?';
  window.location.href = `sms:${recipient}${separator}body=${encodeURIComponent(message)}`;
}

export function buildCreditMessage({
  customerName,
  shopName,
  orderNumber,
  totalAmount,
  amountPaid,
  balanceDue,
  paymentMethod,
}) {
  return [
    `Hello ${customerName || 'Customer'},`,
    `${shopName || 'Our store'} payment update`,
    orderNumber ? `Order: ${orderNumber}` : null,
    `Bill amount: ${formatCurrency(totalAmount)}`,
    `Received: ${formatCurrency(amountPaid)}`,
    balanceDue > 0 ? `Balance due: ${formatCurrency(balanceDue)}` : 'No balance due.',
    paymentMethod ? `Payment mode: ${paymentMethod}` : null,
    'Thank you.',
  ].filter(Boolean).join('\n');
}

export function buildCollectionMessage({
  customerName,
  shopName,
  amountCollected,
  remainingBalance,
  paymentMethod,
}) {
  return [
    `Hello ${customerName || 'Customer'},`,
    `${shopName || 'Our store'} payment receipt`,
    `Collected now: ${formatCurrency(amountCollected)}`,
    `Remaining balance: ${formatCurrency(remainingBalance)}`,
    paymentMethod ? `Payment mode: ${paymentMethod}` : null,
    'Thank you.',
  ].filter(Boolean).join('\n');
}

function formatCurrency(value) {
  return `₹${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
