export function getLocalizedProductName(product, language) {
  const translations = product?.translations || [];
  const match = translations.find((item) => item.languageCode === language && item.displayName);
  return match?.displayName || product?.name || '';
}

export function getLocalizedProductDescription(product, language) {
  const translations = product?.translations || [];
  const match = translations.find((item) => item.languageCode === language && item.description);
  return match?.description || product?.description || '';
}
