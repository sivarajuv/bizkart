import React, { createContext, useContext, useEffect, useState } from 'react';

const LanguageContext = createContext(null);

export const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'te', label: 'తెలుగు' },
  { code: 'ta', label: 'தமிழ்' },
  { code: 'kn', label: 'ಕನ್ನಡ' },
  { code: 'ml', label: 'മലയാളം' },
  { code: 'mr', label: 'मराठी' },
  { code: 'bn', label: 'বাংলা' },
  { code: 'pa', label: 'ਪੰਜਾਬੀ' },
  { code: 'or', label: 'ଓଡ଼ିଆ' },
];

const STRINGS = {
  en: {
    dashboard: 'Dashboard',
    pointOfSale: 'Point of Sale',
    products: 'Products',
    reports: 'Reports',
    aiAssistant: 'AI Assistant',
    users: 'Users',
    shops: 'Shops',
    onlineOrders: 'Online Orders',
    deliveryBoard: 'Delivery Board',
    loginTitle: 'Welcome back',
    loginSubtitle: 'Sign in to your BizKart account',
    username: 'Username',
    password: 'Password',
    signIn: 'Sign In',
    signOut: 'Sign Out',
    language: 'Language',
    searchProducts: 'Search products...',
    addProduct: 'Add Product',
    addUser: 'Add User',
    addShop: 'Add Business',
    totalOrders: 'Total Orders',
    totalRevenue: 'Total Revenue',
    todayOrders: 'Today Orders',
    todayRevenue: 'Today Revenue',
    category: 'Category',
    stock: 'Stock',
    price: 'Price',
    unit: 'Unit',
    role: 'Role',
    shop: 'Business',
    shopManagement: 'Business Management',
    userManagement: 'User Management',
    inventory: 'Inventory',
    coupons: 'Coupons & Offers',
    analytics: 'Customer Analytics',
    dynamicPricing: 'Dynamic Pricing',
    smsMarketing: 'SMS Marketing',
  },
};

export function getLanguageLabel(code) {
  return LANGUAGES.find((l) => l.code === code)?.label || 'English';
}

export function LanguageProvider({ children, preferredLanguage = 'en' }) {
  const [language, setLanguage] = useState(
    localStorage.getItem('kk_language') || preferredLanguage || 'en'
  );

  useEffect(() => {
    localStorage.setItem('kk_language', language);
  }, [language]);

  const t = (key) => STRINGS[language]?.[key] || STRINGS.en[key] || key;

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, languages: LANGUAGES }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
