import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc 
} from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { parseDateToTime, getEffectiveDate } from '../utils/dateUtils';

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyC_8OWjX3Kr5ax0NEHQHYjZsSgQh9XTs1o",
  authDomain: "monmanenaa-naihati.firebaseapp.com",
  projectId: "monmanenaa-naihati",
  storageBucket: "monmanenaa-naihati.firebasestorage.app",
  messagingSenderId: "845223549587",
  appId: "1:845223549587:android:f8c4694697d30f9fc94b66"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Helper to prevent Firestore calls from hanging indefinitely
const withTimeout = (promise, ms = 2500) => {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), ms))
  ]);
};

// Collection constants for Mon Mane Na Restaurant
const MENU_COLLECTION = 'restaurant_menu';
const BILLS_COLLECTION = 'restaurant_bills';
const SETTINGS_COLLECTION = 'restaurant_settings';
const BILL_COUNTER_DOC = 'bill_counter';
const LEDGER_COLLECTION = 'restaurant_ledger';

// AsyncStorage Keys
const STORAGE_MENU_KEY = '@mmn_restaurant_menu_v3';
const STORAGE_BILLS_KEY = '@mmn_restaurant_bills';
const STORAGE_COUNTER_KEY = '@mmn_bill_counter';

// Official Menu Items from Mon Mane Na Restaurant Menu & Updated Pizza List
export const DEFAULT_MENU_ITEMS = [
  // --- PIZZA (VEG) ---
  { id: 'piz-1', name: 'Margherita Pizza', category: 'Pizza', price: 110, isAvailable: true },
  { id: 'piz-2', name: 'Peri Peri Paneer Pizza', category: 'Pizza', price: 129, isAvailable: true },
  { id: 'piz-3', name: 'Corn Cheese Pizza', category: 'Pizza', price: 129, isAvailable: true },
  { id: 'piz-4', name: 'Farmhouse Mushroom Pizza', category: 'Pizza', price: 149, isAvailable: true },
  { id: 'piz-5', name: '4 Topping Pizza', category: 'Pizza', price: 149, isAvailable: true },
  { id: 'piz-6', name: 'Cheese Overload Pizza', category: 'Pizza', price: 129, isAvailable: true },

  // --- PIZZA (NON-VEG) ---
  { id: 'piz-7', name: 'Chicken Tikka Pizza', category: 'Pizza', price: 159, isAvailable: true },
  { id: 'piz-8', name: 'Peri Peri Chicken Pizza', category: 'Pizza', price: 169, isAvailable: true },
  { id: 'piz-9', name: 'Chicken Cheese Pizza', category: 'Pizza', price: 159, isAvailable: true },
  { id: 'piz-10', name: 'Chicken Farmhouse Pizza', category: 'Pizza', price: 169, isAvailable: true },
  { id: 'piz-11', name: 'BBQ Chicken Pizza', category: 'Pizza', price: 169, isAvailable: true },
  { id: 'piz-12', name: 'Corn Chicken Pizza', category: 'Pizza', price: 169, isAvailable: true },
  { id: 'piz-13', name: 'M.M.N Special Supreme Pizza', category: 'Pizza', price: 229, isAvailable: true },

  // --- STARTER ---
  { id: 'str-1', name: 'Chilly Chicken Gravy', category: 'Starter', price: 149, isAvailable: true },
  { id: 'str-2', name: 'Crispy Chicken', category: 'Starter', price: 149, isAvailable: true },
  { id: 'str-3', name: 'Chilly Paneer', category: 'Starter', price: 199, isAvailable: true },
  { id: 'str-4', name: 'Baby Corn', category: 'Starter', price: 129, isAvailable: true },
  { id: 'str-5', name: 'Chilly Mushroom', category: 'Starter', price: 149, isAvailable: true },
  { id: 'str-6', name: 'Chilly Fish', category: 'Starter', price: 149, isAvailable: true },
  { id: 'str-7', name: 'Chilly Prawn', category: 'Starter', price: 199, isAvailable: true },
  { id: 'str-8', name: 'Veg Manchurian', category: 'Starter', price: 129, isAvailable: true },
  { id: 'str-9', name: 'M.M.N Special Garlic Chicken', category: 'Starter', price: 199, isAvailable: true },
  { id: 'str-10', name: 'Chicken Steak', category: 'Starter', price: 149, isAvailable: true },
  { id: 'str-11', name: 'Paneer Steak', category: 'Starter', price: 149, isAvailable: true },
  { id: 'str-12', name: 'Fish Salt & Pepper', category: 'Starter', price: 149, isAvailable: true },

  // --- BURGER ---
  { id: 'bur-1', name: 'Veg Cheese Burger', category: 'Burger', price: 59, isAvailable: true },
  { id: 'bur-2', name: 'Chicken Cheese Burger', category: 'Burger', price: 69, isAvailable: true },
  { id: 'bur-3', name: 'Peri Peri Chicken Burger', category: 'Burger', price: 69, isAvailable: true },
  { id: 'bur-4', name: 'Paneer Burger', category: 'Burger', price: 69, isAvailable: true },

  // --- BIRYANI ---
  { id: 'bir-1', name: 'Aloo Biryani', category: 'Biryani', price: 90, isAvailable: true },
  { id: 'bir-2', name: 'Chicken Biryani', category: 'Biryani', price: 149, isAvailable: true },
  { id: 'bir-3', name: 'Mutton Biryani', category: 'Biryani', price: 220, isAvailable: true },

  // --- SANDWICH ---
  { id: 'snd-1', name: 'Veg Sandwich', category: 'Sandwich', price: 79, isAvailable: true },
  { id: 'snd-2', name: 'Chilly Sandwich', category: 'Sandwich', price: 79, isAvailable: true },
  { id: 'snd-3', name: 'Paneer Sandwich', category: 'Sandwich', price: 99, isAvailable: true },
  { id: 'snd-4', name: 'Corn Sandwich', category: 'Sandwich', price: 99, isAvailable: true },
  { id: 'snd-5', name: 'Chicken Sandwich', category: 'Sandwich', price: 99, isAvailable: true },
  { id: 'snd-6', name: 'Egg Chicken Sandwich', category: 'Sandwich', price: 79, isAvailable: true },
  { id: 'snd-7', name: 'Chicken Tikka Sandwich', category: 'Sandwich', price: 99, isAvailable: true },
  { id: 'snd-8', name: 'M.M.N.S Club Sandwich', category: 'Sandwich', price: 149, isAvailable: true },

  // --- MAGGIE ---
  { id: 'mag-1', name: 'Veg Maggie', category: 'Maggie', price: 40, isAvailable: true },
  { id: 'mag-2', name: 'Chicken Maggie', category: 'Maggie', price: 50, isAvailable: true },
  { id: 'mag-3', name: 'Chicken Cheese Maggie', category: 'Maggie', price: 60, isAvailable: true },
  { id: 'mag-4', name: 'Egg Chicken Maggie', category: 'Maggie', price: 99, isAvailable: true },

  // --- PASTA ---
  { id: 'pas-1', name: 'Veg White Sauce Pasta', category: 'Pasta', price: 89, isAvailable: true },
  { id: 'pas-2', name: 'Veg Red Sauce Pasta', category: 'Pasta', price: 89, isAvailable: true },
  { id: 'pas-3', name: 'Chicken White Sauce Pasta', category: 'Pasta', price: 99, isAvailable: true },
  { id: 'pas-4', name: 'Chicken Red Sauce Pasta', category: 'Pasta', price: 99, isAvailable: true },
  { id: 'pas-5', name: 'Chicken Mixed Sauce Pasta', category: 'Pasta', price: 99, isAvailable: true },

  // --- NOODLES ---
  { id: 'ndl-1', name: 'Veg Noodles', category: 'Noodles', price: 129, isAvailable: true },
  { id: 'ndl-2', name: 'Chicken Hakka Noodles', category: 'Noodles', price: 149, isAvailable: true },
  { id: 'ndl-3', name: 'Chilly Chicken Garlic Noodles', category: 'Noodles', price: 149, isAvailable: true },
  { id: 'ndl-4', name: 'Chicken Schezwan Noodles', category: 'Noodles', price: 149, isAvailable: true },

  // --- MOMO ---
  { id: 'mom-1', name: 'Veg Momo', category: 'Momo', price: 60, isAvailable: true },
  { id: 'mom-2', name: 'Steam Momo', category: 'Momo', price: 70, isAvailable: true },
  { id: 'mom-3', name: 'Pan Fry Momo', category: 'Momo', price: 80, isAvailable: true },
  { id: 'mom-4', name: 'Chicken Fry Momo', category: 'Momo', price: 99, isAvailable: true },
  { id: 'mom-5', name: 'Cheese Pan Fry Momo', category: 'Momo', price: 99, isAvailable: true },

  // --- FRIED ---
  { id: 'frd-1', name: 'Hot Wings', category: 'Fried', price: 149, isAvailable: true },
  { id: 'frd-2', name: 'Chicken Lollipop (5 Pcs)', category: 'Fried', price: 149, isAvailable: true },
  { id: 'frd-3', name: 'Cheese Polo', category: 'Fried', price: 149, isAvailable: true },
  { id: 'frd-4', name: 'Cheese Corn Ball', category: 'Fried', price: 149, isAvailable: true },
  { id: 'frd-5', name: 'Cheese Chicken Ball', category: 'Fried', price: 149, isAvailable: true },
  { id: 'frd-6', name: 'Fish Finger', category: 'Fried', price: 149, isAvailable: true },
  { id: 'frd-7', name: 'Fish Chips', category: 'Fried', price: 129, isAvailable: true },
  { id: 'frd-8', name: 'Chicken Chips', category: 'Fried', price: 129, isAvailable: true },
  { id: 'frd-9', name: 'French Fries', category: 'Fried', price: 129, isAvailable: true },
  { id: 'frd-10', name: 'Golden Prawn Fry', category: 'Fried', price: 150, isAvailable: true },

  // --- RICE ---
  { id: 'ric-1', name: 'Veg Rice', category: 'Rice', price: 129, isAvailable: true },
  { id: 'ric-2', name: 'Egg Chicken Rice', category: 'Rice', price: 149, isAvailable: true },
  { id: 'ric-3', name: 'Mongolian Veg Rice', category: 'Rice', price: 149, isAvailable: true },
  { id: 'ric-4', name: 'Mongolian Chicken Rice', category: 'Rice', price: 169, isAvailable: true },

  // --- SOUP ---
  { id: 'sop-1', name: 'Veg Lemon Coriander Soup', category: 'Soup', price: 129, isAvailable: true },
  { id: 'sop-2', name: 'Veg Manchow Soup', category: 'Soup', price: 129, isAvailable: true },
  { id: 'sop-3', name: 'Veg Hot & Sour Soup', category: 'Soup', price: 129, isAvailable: true },
  { id: 'sop-4', name: 'Cream of Mushroom Soup', category: 'Soup', price: 129, isAvailable: true },
  { id: 'sop-5', name: 'Chicken Lemon Coriander Soup', category: 'Soup', price: 149, isAvailable: true },
  { id: 'sop-6', name: 'Chicken Manchow Soup', category: 'Soup', price: 149, isAvailable: true },
  { id: 'sop-7', name: 'Chicken Hot & Sour Soup', category: 'Soup', price: 149, isAvailable: true },
  { id: 'sop-8', name: 'Non-Veg Cream of Mushroom Soup', category: 'Soup', price: 149, isAvailable: true },

  // --- COMBO ---
  { id: 'cmb-1', name: 'Fry Baby Corn + 2 Campa', category: 'Combo', price: 249, isAvailable: true },
  { id: 'cmb-2', name: 'Margherita Pizza(S) + Chicken Momo + 2 Campa', category: 'Combo', price: 199, isAvailable: true },
  { id: 'cmb-3', name: 'French Fry / Baby Corn + Chicken Lollipop(4pc) + 2 Campa', category: 'Combo', price: 299, isAvailable: true },
  { id: 'cmb-4', name: 'Hot Wings / Rice / Noodles + Chilly Chicken/Fish + 2 Campa', category: 'Combo', price: 499, isAvailable: true },
  { id: 'cmb-5', name: 'White Sauce Pasta + Chicken Pizza/Sandwich/Red Pasta + 2 Campa', category: 'Combo', price: 229, isAvailable: true },
  { id: 'cmb-6', name: 'Chicken Sandwich + Chicken Pizza/Fish Finger/Chips + 2 Campa', category: 'Combo', price: 249, isAvailable: true }
];

export const MENU_CATEGORIES = [
  'All',
  'Pizza',
  'Starter',
  'Burger',
  'Biryani',
  'Sandwich',
  'Rice',
  'Noodles',
  'Momo',
  'Pasta',
  'Fried',
  'Maggie',
  'Soup',
  'Combo'
];

let cachedMenu = [...DEFAULT_MENU_ITEMS];
let cachedBills = [];

export const invalidateCache = () => { cachedBills = null; };
export const invalidateMenuCache = () => {};

/**
 * Fetch all menu items (Local First + Cloud Sync with fast timeout)
 */
export const getMenuItems = async (forceRefresh = false) => {
  // 1. Try to load from AsyncStorage if memory cache empty
  if (!cachedMenu || cachedMenu.length === 0) {
    try {
      const localStr = await AsyncStorage.getItem(STORAGE_MENU_KEY);
      if (localStr) {
        cachedMenu = JSON.parse(localStr);
      } else {
        cachedMenu = [...DEFAULT_MENU_ITEMS];
        AsyncStorage.setItem(STORAGE_MENU_KEY, JSON.stringify(DEFAULT_MENU_ITEMS)).catch(() => {});
      }
    } catch {
      cachedMenu = [...DEFAULT_MENU_ITEMS];
    }
  }

  // 2. Try Firestore in the background with a 2-second timeout
  try {
    const menuCol = collection(db, MENU_COLLECTION);
    const snapshot = await withTimeout(getDocs(menuCol), 2000);

    if (snapshot && !snapshot.empty) {
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      cachedMenu = list;
      AsyncStorage.setItem(STORAGE_MENU_KEY, JSON.stringify(list)).catch(() => {});
      return list;
    }
  } catch (err) {
    // Firestore error or timeout: seamlessly continue with cachedMenu
  }

  return cachedMenu;
};

/**
 * Add a new dish to menu (Updates Local Storage & syncs to Cloud)
 */
export const addMenuItem = async (itemData) => {
  const newItem = {
    id: `dish_${Date.now()}`,
    name: itemData.name.trim(),
    category: itemData.category || 'Main Course',
    price: parseFloat(itemData.price) || 0,
    isAvailable: itemData.isAvailable !== false,
    createdAt: new Date().toISOString()
  };

  // 1. Update memory & local storage immediately
  cachedMenu = [newItem, ...cachedMenu];
  AsyncStorage.setItem(STORAGE_MENU_KEY, JSON.stringify(cachedMenu)).catch(() => {});

  // 2. Sync to Firestore in background with timeout
  try {
    const menuCol = collection(db, MENU_COLLECTION);
    withTimeout(addDoc(menuCol, newItem), 3000).catch(() => {});
  } catch (e) {
    console.warn('Could not sync dish to cloud:', e.message);
  }

  return newItem;
};

/**
 * Update an existing menu item
 */
export const updateMenuItem = async (id, updates) => {
  const cleanUpdates = { ...updates };
  if (cleanUpdates.price !== undefined) cleanUpdates.price = parseFloat(cleanUpdates.price) || 0;
  if (cleanUpdates.name !== undefined) cleanUpdates.name = cleanUpdates.name.trim();

  // 1. Update memory & local storage immediately
  cachedMenu = cachedMenu.map(item => item.id === id ? { ...item, ...cleanUpdates } : item);
  AsyncStorage.setItem(STORAGE_MENU_KEY, JSON.stringify(cachedMenu)).catch(() => {});

  // 2. Sync to Firestore
  try {
    const itemRef = doc(db, MENU_COLLECTION, String(id));
    withTimeout(updateDoc(itemRef, cleanUpdates), 3000).catch(() => {});
  } catch (e) {}

  return true;
};

/**
 * Delete a dish from the menu
 */
export const deleteMenuItem = async (id) => {
  // 1. Remove from memory & local storage
  cachedMenu = cachedMenu.filter(item => item.id !== id);
  AsyncStorage.setItem(STORAGE_MENU_KEY, JSON.stringify(cachedMenu)).catch(() => {});

  // 2. Sync to Firestore
  try {
    const itemRef = doc(db, MENU_COLLECTION, String(id));
    withTimeout(deleteDoc(itemRef), 3000).catch(() => {});
  } catch (e) {}

  return true;
};

/**
 * Fetch all bills (Local First + Cloud Sync)
 */
export const getAllBills = async (forceRefresh = false) => {
  // Load local bills
  let localList = [];
  try {
    const localStr = await AsyncStorage.getItem(STORAGE_BILLS_KEY);
    if (localStr) localList = JSON.parse(localStr);
  } catch (e) {}

  // Sync from Firestore if available
  try {
    const billsCol = collection(db, BILLS_COLLECTION);
    const billSnapshot = await withTimeout(getDocs(billsCol), 2000);
    if (billSnapshot && !billSnapshot.empty) {
      const cloudList = billSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      // Merge unique by billNo/id
      const map = {};
      [...localList, ...cloudList].forEach(b => {
        const key = b.billNo || b.id;
        if (key) map[key] = b;
      });
      const merged = Object.values(map);
      AsyncStorage.setItem(STORAGE_BILLS_KEY, JSON.stringify(merged)).catch(() => {});
      return merged;
    }
  } catch (e) {}

  return localList;
};

export const getRecentBills = async (limitCount = 20) => {
  const allBills = await getAllBills();
  const sorted = [...allBills].sort((a, b) => {
    if (b.createdAt && a.createdAt) {
      return new Date(b.createdAt) - new Date(a.createdAt);
    }
    return (b.billNo || b.id || '').localeCompare(a.billNo || a.id || '');
  });
  return sorted.slice(0, limitCount);
};

export const searchBill = async (billNo) => {
  const bills = await getAllBills();
  const queryStr = String(billNo).toLowerCase().trim();
  return bills.find(b => 
    String(b.billNo || '').toLowerCase() === queryStr ||
    String(b.id || '').toLowerCase() === queryStr
  ) || null;
};

/**
 * Save a new restaurant bill (Local + Cloud)
 */
export const saveBill = async (billData) => {
  const billDocId = String(billData.billNo || `MMN-${Date.now().toString().slice(-6)}`);
  const finalBill = {
    ...billData,
    id: billDocId,
    createdAt: billData.createdAt || new Date().toISOString()
  };

  // 1. Save to AsyncStorage immediately
  try {
    const localStr = await AsyncStorage.getItem(STORAGE_BILLS_KEY);
    const existingBills = localStr ? JSON.parse(localStr) : [];
    const updated = [finalBill, ...existingBills.filter(b => (b.billNo || b.id) !== billDocId)];
    await AsyncStorage.setItem(STORAGE_BILLS_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn('AsyncStorage save bill error:', e);
  }

  // 2. Sync to Firestore in background
  try {
    const billRef = doc(db, BILLS_COLLECTION, billDocId);
    withTimeout(setDoc(billRef, finalBill), 3000).catch(() => {});
  } catch (e) {}

  return true;
};

export const deleteBill = async (id) => {
  try {
    const localStr = await AsyncStorage.getItem(STORAGE_BILLS_KEY);
    if (localStr) {
      const existingBills = JSON.parse(localStr);
      const filtered = existingBills.filter(b => (b.billNo || b.id) !== String(id));
      await AsyncStorage.setItem(STORAGE_BILLS_KEY, JSON.stringify(filtered));
    }
  } catch (e) {}

  try {
    const billRef = doc(db, BILLS_COLLECTION, String(id));
    withTimeout(deleteDoc(billRef), 3000).catch(() => {});
  } catch (e) {}

  return true;
};

/**
 * Sequential bill numbering (Local-First + Cloud fallback)
 */
export const getNextBillNo = async () => {
  let nextNum = 1;
  try {
    const localVal = await AsyncStorage.getItem(STORAGE_COUNTER_KEY);
    if (localVal) {
      nextNum = parseInt(localVal, 10) + 1;
    }
    await AsyncStorage.setItem(STORAGE_COUNTER_KEY, String(nextNum));
  } catch (e) {
    nextNum = Date.now().toString().slice(-4);
  }

  // Sync to Firestore in background
  try {
    const counterRef = doc(db, SETTINGS_COLLECTION, BILL_COUNTER_DOC);
    withTimeout(setDoc(counterRef, { lastNumber: nextNum }, { merge: true }), 2500).catch(() => {});
  } catch (e) {}

  return `MMN${String(nextNum).padStart(4, '0')}`;
};

export const peekNextBillNo = async () => {
  try {
    const localVal = await AsyncStorage.getItem(STORAGE_COUNTER_KEY);
    const nextNum = localVal ? (parseInt(localVal, 10) + 1) : 1;
    return `MMN${String(nextNum).padStart(4, '0')}`;
  } catch (e) {
    return `MMN0001`;
  }
};

export const clearAllData = async () => {
  await AsyncStorage.removeItem(STORAGE_BILLS_KEY);
  await AsyncStorage.setItem(STORAGE_COUNTER_KEY, '0');
  return true;
};

// Table Management & Active Running Orders
const STORAGE_TABLES_KEY = '@mmn_tables_list_v1';
const STORAGE_ACTIVE_TABLES_KEY = '@mmn_active_table_orders';
export const DEFAULT_TABLES = ['T-1', 'T-2', 'T-3', 'T-4', 'T-5', 'T-6', 'T-7', 'T-8'];

let cachedTables = null;
let cachedActiveTableOrders = null;

export const getRestaurantTables = async () => {
  if (cachedTables && cachedTables.length > 0) return cachedTables;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_TABLES_KEY);
    if (raw) {
      cachedTables = JSON.parse(raw);
      return cachedTables;
    }
  } catch (e) {}
  cachedTables = [...DEFAULT_TABLES];
  AsyncStorage.setItem(STORAGE_TABLES_KEY, JSON.stringify(DEFAULT_TABLES)).catch(() => {});
  return cachedTables;
};

export const saveRestaurantTables = async (tablesList) => {
  cachedTables = tablesList;
  await AsyncStorage.setItem(STORAGE_TABLES_KEY, JSON.stringify(tablesList));
  return tablesList;
};

export const addRestaurantTable = async (newTableName) => {
  const tables = await getRestaurantTables();
  const trimmed = newTableName.trim();
  if (!trimmed || tables.includes(trimmed)) return tables;
  const updated = [...tables, trimmed];
  await saveRestaurantTables(updated);
  return updated;
};

export const updateRestaurantTable = async (oldName, newName) => {
  const tables = await getRestaurantTables();
  const trimmed = newName.trim();
  if (!trimmed) return tables;
  const updated = tables.map(t => t === oldName ? trimmed : t);
  await saveRestaurantTables(updated);

  const activeOrders = await getActiveTableOrders();
  if (activeOrders[oldName]) {
    activeOrders[trimmed] = { ...activeOrders[oldName], tableNo: trimmed };
    delete activeOrders[oldName];
    await saveAllActiveTableOrders(activeOrders);
  }
  return updated;
};

export const deleteRestaurantTable = async (tableName) => {
  const tables = await getRestaurantTables();
  const updated = tables.filter(t => t !== tableName);
  await saveRestaurantTables(updated);
  await clearActiveTableOrder(tableName);
  return updated;
};

export const getActiveTableOrders = async () => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_ACTIVE_TABLES_KEY);
    if (raw) {
      cachedActiveTableOrders = JSON.parse(raw);
      return cachedActiveTableOrders;
    }
  } catch (e) {}
  cachedActiveTableOrders = {};
  return {};
};

export const saveAllActiveTableOrders = async (allOrders) => {
  cachedActiveTableOrders = allOrders;
  await AsyncStorage.setItem(STORAGE_ACTIVE_TABLES_KEY, JSON.stringify(allOrders));
  return allOrders;
};

export const saveActiveTableOrder = async (tableNo, orderData) => {
  const active = await getActiveTableOrders();
  active[tableNo] = {
    ...orderData,
    tableNo,
    updatedAt: new Date().toISOString()
  };
  await saveAllActiveTableOrders(active);
  return active;
};

export const clearActiveTableOrder = async (tableNo) => {
  const active = await getActiveTableOrders();
  if (active[tableNo]) {
    delete active[tableNo];
    await saveAllActiveTableOrders(active);
  }
  return active;
};

// Ledger entries
const STORAGE_LEDGER_KEY = '@mmn_restaurant_ledger';

export const saveLedgerEntry = async (entryData) => {
  const newEntry = {
    id: `ledg_${Date.now()}`,
    ...entryData,
    createdAt: new Date().toISOString()
  };
  try {
    const raw = await AsyncStorage.getItem(STORAGE_LEDGER_KEY);
    const list = raw ? JSON.parse(raw) : [];
    const updated = [newEntry, ...list];
    await AsyncStorage.setItem(STORAGE_LEDGER_KEY, JSON.stringify(updated));
  } catch (e) {}

  try {
    const ledgerCol = collection(db, LEDGER_COLLECTION);
    withTimeout(addDoc(ledgerCol, newEntry), 2500).catch(() => {});
  } catch (e) {}

  return newEntry;
};

export const getAllLedgerEntries = async () => {
  let localList = [];
  try {
    const raw = await AsyncStorage.getItem(STORAGE_LEDGER_KEY);
    if (raw) localList = JSON.parse(raw);
  } catch (e) {}

  try {
    const ledgerCol = collection(db, LEDGER_COLLECTION);
    const snap = await withTimeout(getDocs(ledgerCol), 2000);
    if (snap && !snap.empty) {
      const cloudList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const map = {};
      [...localList, ...cloudList].forEach(item => {
        if (item.id) map[item.id] = item;
      });
      const merged = Object.values(map);
      AsyncStorage.setItem(STORAGE_LEDGER_KEY, JSON.stringify(merged)).catch(() => {});
      return merged.sort((a, b) => {
        const dateA = getEffectiveDate(a);
        const dateB = getEffectiveDate(b);
        const timeA = parseDateToTime(dateA);
        const timeB = parseDateToTime(dateB);
        if (timeB !== timeA) return timeB - timeA;
        return parseDateToTime(b.createdAt) - parseDateToTime(a.createdAt);
      });
    }
  } catch (e) {}

  return localList.sort((a, b) => {
    const dateA = getEffectiveDate(a);
    const dateB = getEffectiveDate(b);
    const timeA = parseDateToTime(dateA);
    const timeB = parseDateToTime(dateB);
    if (timeB !== timeA) return timeB - timeA;
    return parseDateToTime(b.createdAt) - parseDateToTime(a.createdAt);
  });
};

export const deleteLedgerEntry = async (id) => {
  const entryId = typeof id === 'string' ? id : (id?.id || String(id));
  try {
    const raw = await AsyncStorage.getItem(STORAGE_LEDGER_KEY);
    if (raw) {
      const list = JSON.parse(raw);
      const filtered = list.filter(item => item.id !== entryId);
      await AsyncStorage.setItem(STORAGE_LEDGER_KEY, JSON.stringify(filtered));
    }
  } catch (e) {}

  try {
    const docRef = doc(db, LEDGER_COLLECTION, entryId);
    withTimeout(deleteDoc(docRef), 2500).catch(() => {});
  } catch (e) {}

  return true;
};

// Aliases
export const getCustomItems = getMenuItems;
export const addCustomItem = async (name) => addMenuItem({ name, price: 0 });
export const deleteCustomItem = deleteMenuItem;
export const updateBillItems = async () => true;

