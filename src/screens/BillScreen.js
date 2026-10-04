import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  View, 
  ScrollView, 
  StyleSheet, 
  Alert, 
  Platform, 
  TouchableOpacity, 
  FlatList 
} from 'react-native';
import { 
  Text, 
  TextInput, 
  Button, 
  Divider, 
  Portal, 
  Dialog, 
  IconButton, 
  Chip, 
  Card, 
  Searchbar, 
  Badge,
  Snackbar
} from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import ViewShot from 'react-native-view-shot';
import { 
  getMenuItems, 
  saveBill, 
  getNextBillNo, 
  peekNextBillNo, 
  MENU_CATEGORIES,
  DEFAULT_MENU_ITEMS,
  DEFAULT_TABLES,
  getRestaurantTables,
  addRestaurantTable,
  updateRestaurantTable,
  deleteRestaurantTable,
  getActiveTableOrders,
  saveActiveTableOrder,
  clearActiveTableOrder
} from '../services/db';
import thermalPrinter from '../utils/thermalPrinter';
import { generateHtmlReceipt } from '../utils/printTemplate';
import { getThermalPrintOptions } from '../utils/printConfig';
import ReceiptTemplate from '../components/ReceiptTemplate';
import LoadingOverlay from '../components/LoadingOverlay';

export default function BillScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  
  // Bill State
  const [billNo, setBillNo] = useState('MMN0001');
  const getTodayDateString = () => {
    const today = new Date();
    return `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
  };
  const [date, setDate] = useState(getTodayDateString());
  const [orderType, setOrderType] = useState('Dine-In'); // Dine-In, Takeaway, Delivery
  const [tableNo, setTableNo] = useState('T-1');
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');

  // Table Management & Active Orders State
  const [tables, setTables] = useState(DEFAULT_TABLES);
  const [activeTableOrders, setActiveTableOrders] = useState({});
  const [tableModalVisible, setTableModalVisible] = useState(false);
  const [newTableText, setNewTableText] = useState('');
  const [editTableModalVisible, setEditTableModalVisible] = useState(false);
  const [selectedTableForEdit, setSelectedTableForEdit] = useState('');
  const [editTableInput, setEditTableInput] = useState('');

  // Table Search & Filter States
  const [tableSearchQuery, setTableSearchQuery] = useState('');
  const [tableFilter, setTableFilter] = useState('all'); // 'all', 'occupied', 'free'
  const [tableSearchVisible, setTableSearchVisible] = useState(false);

  // Table Order Edit & Free Dialogs
  const [freeTableDialogVisible, setFreeTableDialogVisible] = useState(false);
  const [tableToFree, setTableToFree] = useState(null);
  const [deleteTableDialogVisible, setDeleteTableDialogVisible] = useState(false);
  const [tableToDelete, setTableToDelete] = useState(null);
  const [editOrderModalVisible, setEditOrderModalVisible] = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMsg, setSnackbarMsg] = useState('');

  const showToast = (msg) => {
    setSnackbarMsg(msg);
    setSnackbarVisible(true);
  };

  // Menu items initialized with defaults so it NEVER gets stuck loading
  const [menuItems, setMenuItems] = useState(DEFAULT_MENU_ITEMS);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Cart / Order Items: [{ id, name, price, quantity, total }]
  const [cartItems, setCartItems] = useState([]);

  // Discount & Payment
  const [discountType, setDiscountType] = useState('flat'); // 'flat' or 'percent'
  const [discountValue, setDiscountValue] = useState('0');
  const [paymentMode, setPaymentMode] = useState('Cash'); // Cash, UPI, Card

  // Modals & Loaders
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Processing...');
  const [qtyDialogVisible, setQtyDialogVisible] = useState(false);
  const [selectedCartItem, setSelectedCartItem] = useState(null);
  const [customQtyInput, setCustomQtyInput] = useState('1');

  // Printer State
  const [printers, setPrinters] = useState([]);
  const [isScanning, setIsScanning] = useState(false);
  const [printerModalVisible, setPrinterModalVisible] = useState(false);
  const [connectedPrinter, setConnectedPrinter] = useState(null);

  const viewShotRef = useRef();

  // Initial Load
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const items = await getMenuItems();
      if (items && items.length > 0) setMenuItems(items);

      const nextNo = await peekNextBillNo();
      if (nextNo) setBillNo(nextNo);

      const tbls = await getRestaurantTables();
      if (tbls && tbls.length > 0) setTables(tbls);

      const active = await getActiveTableOrders();
      setActiveTableOrders(active || {});
    } catch (e) {
      console.warn('loadData error:', e);
    }
  };

  // Reload data whenever screen is focused
  useEffect(() => {
    const unsubscribe = navigation?.addListener?.('focus', () => {
      loadData();
    });
    return unsubscribe;
  }, [navigation]);

  // Handle Table Selection -> Automatically load order if active
  const handleSelectTable = (tbl) => {
    setTableNo(tbl);
    const existingOrder = activeTableOrders[tbl];
    if (existingOrder && existingOrder.items && existingOrder.items.length > 0) {
      setCartItems(existingOrder.items);
      if (existingOrder.customerName && existingOrder.customerName !== 'Guest') {
        setCustomerName(existingOrder.customerName);
      } else {
        setCustomerName('');
      }
      if (existingOrder.phone) setPhone(existingOrder.phone);
      if (existingOrder.discountValue) setDiscountValue(existingOrder.discountValue);
      if (existingOrder.discountType) setDiscountType(existingOrder.discountType);
    } else {
      // Empty table
      setCartItems([]);
    }
  };

  // Filtered dishes
  const filteredDishes = useMemo(() => {
    return menuItems.filter(item => {
      const matchesCat = selectedCategory === 'All' || item.category === selectedCategory;
      const matchesSearch = !searchQuery.trim() || 
        (item.name && item.name.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesCat && matchesSearch;
    });
  }, [menuItems, selectedCategory, searchQuery]);

  // Count of occupied tables
  const occupiedTableCount = useMemo(() => {
    return Object.keys(activeTableOrders).filter(k => activeTableOrders[k]?.items?.length > 0).length;
  }, [activeTableOrders]);

  // Filtered & searched tables
  const filteredTables = useMemo(() => {
    return tables.filter(tbl => {
      const hasOrder = !!activeTableOrders[tbl] && activeTableOrders[tbl].items?.length > 0;
      if (tableFilter === 'occupied' && !hasOrder) return false;
      if (tableFilter === 'free' && hasOrder) return false;
      if (tableSearchQuery.trim()) {
        const q = tableSearchQuery.trim().toLowerCase();
        const matchName = tbl.toLowerCase().includes(q);
        const guest = (activeTableOrders[tbl]?.customerName || '').toLowerCase();
        const matchGuest = guest.includes(q);
        return matchName || matchGuest;
      }
      return true;
    });
  }, [tables, tableFilter, tableSearchQuery, activeTableOrders]);

  // Add or increment item in cart
  const handleSelectMenuItem = (item) => {
    if (item.isAvailable === false) {
      Alert.alert('Item Unavailable', `"${item.name}" is currently marked out of stock.`);
      return;
    }

    const price = parseFloat(item.price) || 0;
    setCartItems(prev => {
      const existingIndex = prev.findIndex(ci => ci.id === item.id || ci.name.toLowerCase() === item.name.toLowerCase());
      if (existingIndex >= 0) {
        const updated = [...prev];
        const current = updated[existingIndex];
        const newQty = current.quantity + 1;
        updated[existingIndex] = {
          ...current,
          quantity: newQty,
          total: price * newQty
        };
        return updated;
      } else {
        return [
          ...prev,
          {
            id: item.id,
            name: item.name,
            category: item.category,
            price: price,
            quantity: 1,
            total: price
          }
        ];
      }
    });
  };

  // Adjust quantity
  const handleUpdateQty = (itemId, delta) => {
    setCartItems(prev => {
      return prev.map(item => {
        if (item.id === itemId) {
          const newQty = item.quantity + delta;
          if (newQty <= 0) return null;
          return {
            ...item,
            quantity: newQty,
            total: item.price * newQty
          };
        }
        return item;
      }).filter(Boolean);
    });
  };

  const handleOpenQtyDialog = (item) => {
    setSelectedCartItem(item);
    setCustomQtyInput(String(item.quantity));
    setQtyDialogVisible(true);
  };

  const handleSaveCustomQty = () => {
    const qty = parseInt(customQtyInput, 10);
    if (isNaN(qty) || qty <= 0) {
      Alert.alert('Invalid Quantity', 'Please enter a valid quantity greater than 0.');
      return;
    }
    if (selectedCartItem) {
      setCartItems(prev => prev.map(item => {
        if (item.id === selectedCartItem.id) {
          return {
            ...item,
            quantity: qty,
            total: item.price * qty
          };
        }
        return item;
      }));
    }
    setQtyDialogVisible(false);
  };

  const handleRemoveItem = (itemId) => {
    setCartItems(prev => prev.filter(i => i.id !== itemId));
  };

  // Financial calculations
  const totals = useMemo(() => {
    const subtotal = cartItems.reduce((sum, i) => sum + (i.total || 0), 0);
    const totalUnits = cartItems.reduce((sum, i) => sum + (i.quantity || 0), 0);

    const discountNum = parseFloat(discountValue) || 0;
    let discountAmount = 0;
    if (discountType === 'flat') {
      discountAmount = Math.min(subtotal, discountNum);
    } else {
      discountAmount = (subtotal * Math.min(100, discountNum)) / 100;
    }

    const finalAmount = Math.max(0, subtotal - discountAmount);

    return {
      subtotal,
      totalUnits,
      discountAmount,
      finalAmount
    };
  }, [cartItems, discountType, discountValue]);

  // Printer routines
  const handleScanPrinters = async () => {
    setLoadingMessage('Scanning for Bluetooth printers...');
    setIsScanning(true);
    try {
      const devices = await thermalPrinter.scan();
      setPrinters(devices || []);
      setPrinterModalVisible(true);
    } catch (e) {
      Alert.alert('Error', 'Failed to scan Bluetooth devices.');
    } finally {
      setIsScanning(false);
    }
  };

  const handleConnectPrinter = async (device) => {
    setLoadingMessage(`Connecting to ${device.device_name || 'Printer'}...`);
    setLoading(true);
    try {
      const success = await thermalPrinter.connect(device);
      if (success) {
        setConnectedPrinter(device);
        setPrinterModalVisible(false);
        Alert.alert('Connected', `Successfully connected to ${device.device_name || 'Printer'}`);
      }
    } catch (e) {
      Alert.alert('Connection Failed', 'Could not connect to printer.');
    } finally {
      setLoading(false);
    }
  };

  const clearForm = async () => {
    setCartItems([]);
    setCustomerName('');
    setPhone('');
    setDiscountValue('0');
    setOrderType('Dine-In');
    const nextNo = await peekNextBillNo();
    setBillNo(nextNo);
  };

  // Waiter action: Save / Update order on Table
  const handleSaveToTable = async (keepCart = true) => {
    if (cartItems.length === 0) {
      if (activeTableOrders[tableNo]) {
        handlePromptFreeTable(tableNo);
      } else {
        Alert.alert('No Items', `Please select dishes to save to ${tableNo}.`);
      }
      return;
    }

    const isUpdating = !!activeTableOrders[tableNo];
    const existingOrder = activeTableOrders[tableNo] || {};

    const orderData = {
      items: cartItems,
      subtotal: totals.subtotal,
      total: totals.finalAmount,
      customerName: customerName.trim() || existingOrder.customerName || 'Guest',
      phone: phone.trim() || existingOrder.phone || '',
      discountType,
      discountValue,
      savedAt: existingOrder.savedAt || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      updatedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      date
    };

    await saveActiveTableOrder(tableNo, orderData);
    const updated = await getActiveTableOrders();
    setActiveTableOrders(updated);

    if (editOrderModalVisible) {
      setEditOrderModalVisible(false);
    }

    if (!keepCart) {
      setCartItems([]);
    }

    showToast(`Table ${tableNo} order ${isUpdating ? 'updated' : 'saved'} successfully! (Total: ₹${totals.finalAmount.toFixed(2)})`);
  };

  // Prompt to free running order from table (cross-platform with web modal support)
  const handlePromptFreeTable = (tbl) => {
    setTableToFree(tbl);
    setFreeTableDialogVisible(true);
  };

  const handleConfirmFreeTable = async () => {
    if (!tableToFree) return;
    const tbl = tableToFree;
    setFreeTableDialogVisible(false);
    setLoadingMessage(`Freeing Table ${tbl}...`);
    setLoading(true);
    try {
      const updated = await clearActiveTableOrder(tbl);
      setActiveTableOrders(updated || {});
      if (tableNo === tbl) {
        setCartItems([]);
      }
      if (editOrderModalVisible) {
        setEditOrderModalVisible(false);
      }
      showToast(`Table ${tbl} has been freed!`);
    } catch (e) {
      console.warn('Error clearing table:', e);
    } finally {
      setLoading(false);
    }
  };

  // Table Management Handlers
  const handleAddTable = async () => {
    const trimmed = newTableText.trim();
    if (!trimmed) return;
    if (tables.includes(trimmed)) {
      Alert.alert('Already Exists', `Table "${trimmed}" already exists.`);
      return;
    }
    const updated = await addRestaurantTable(trimmed);
    setTables(updated);
    setNewTableText('');
    showToast(`Table "${trimmed}" added.`);
  };

  const handleStartEditTable = (tbl) => {
    setSelectedTableForEdit(tbl);
    setEditTableInput(tbl);
    setEditTableModalVisible(true);
  };

  const handleSaveEditTable = async () => {
    const trimmed = editTableInput.trim();
    if (!trimmed) return;
    const updated = await updateRestaurantTable(selectedTableForEdit, trimmed);
    setTables(updated);
    if (tableNo === selectedTableForEdit) setTableNo(trimmed);
    setEditTableModalVisible(false);
    const active = await getActiveTableOrders();
    setActiveTableOrders(active);
    showToast(`Table renamed to "${trimmed}".`);
  };

  const handlePromptDeleteTable = (tbl) => {
    setTableToDelete(tbl);
    setDeleteTableDialogVisible(true);
  };

  const handleConfirmDeleteTable = async () => {
    if (!tableToDelete) return;
    const tbl = tableToDelete;
    setDeleteTableDialogVisible(false);
    try {
      const updated = await deleteRestaurantTable(tbl);
      setTables(updated);
      const active = await getActiveTableOrders();
      setActiveTableOrders(active);
      if (tableNo === tbl) {
        setTableNo(updated[0] || 'T-1');
        setCartItems([]);
      }
      showToast(`Table "${tbl}" deleted.`);
    } catch (e) {
      console.warn('Error deleting table:', e);
    }
  };

  // Helper to execute thermal or browser print
  const executePrintReceipt = async (receiptData) => {
    if (connectedPrinter) {
      setLoadingMessage('Printing to Bluetooth printer...');
      await Promise.race([
        thermalPrinter.printBill(receiptData),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Printer Timeout')), 15000))
      ]);
    } else {
      setLoadingMessage('Preparing print receipt...');
      const html = generateHtmlReceipt(receiptData);
      if (Platform.OS === 'web') {
        const iframe = document.createElement('iframe');
        iframe.style.position = 'absolute';
        iframe.style.left = '-1000px';
        document.body.appendChild(iframe);
        iframe.contentDocument.write(html);
        iframe.contentDocument.close();
        setTimeout(() => {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
          setTimeout(() => {
            if (document.body.contains(iframe)) document.body.removeChild(iframe);
          }, 1000);
        }, 50);
      } else {
        await Print.printAsync({ html, ...getThermalPrintOptions(receiptData.items?.length || 1) });
      }
    }
  };

  // Print Table Order Slip / Pre-Bill without settling or clearing the table
  const handlePrintTableSlip = async (tbl = tableNo) => {
    const existing = activeTableOrders[tbl] || {};
    const itemsToPrint = (tableNo === tbl && cartItems.length > 0) ? cartItems : (existing.items || []);
    if (itemsToPrint.length === 0) {
      Alert.alert('No Items', `Table ${tbl} has no dishes to print.`);
      return;
    }

    const subtotal = itemsToPrint.reduce((sum, i) => sum + (i.total || (i.price * i.quantity)), 0);
    const discountNum = parseFloat(discountValue) || 0;
    let discountAmount = 0;
    if (discountType === 'flat') {
      discountAmount = Math.min(subtotal, discountNum);
    } else {
      discountAmount = (subtotal * Math.min(100, discountNum)) / 100;
    }
    const finalAmount = Math.max(0, subtotal - discountAmount);

    const slipData = {
      billNo: `TBL-${tbl}`,
      isTableSlip: true,
      date,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      orderType: 'Dine-In',
      tableNo: tbl,
      customerName: customerName.trim() || existing.customerName || 'Guest',
      phone: phone.trim() || existing.phone || '',
      items: itemsToPrint.map(item => ({
        name: item.name,
        category: item.category || 'General',
        mrp: item.price,
        quantity: item.quantity,
        amount: item.total || (item.price * item.quantity)
      })),
      totalOriginalMrp: subtotal,
      totalBaseMrp: subtotal,
      totalItemDiscounts: 0,
      subtotalAfterItemDiscounts: subtotal,
      discountType,
      discountValue,
      overallDiscountAmount: discountAmount,
      gstAmount: 0,
      finalAmount,
      paymentMode: 'Pending / Due',
      createdAt: new Date().toISOString()
    };

    setLoading(true);
    try {
      await executePrintReceipt(slipData);
      showToast(`Printed order slip for Table ${tbl}!`);
    } catch (e) {
      console.warn('Print error:', e);
      Alert.alert('Print Notice', 'Print action cancelled or completed.');
    } finally {
      setLoading(false);
    }
  };

  // Generate & Print / Settle Order
  const handleSettleOrder = async (shouldPrint = true) => {
    if (cartItems.length === 0) {
      Alert.alert('Empty Order', 'Please select at least one menu item to create a bill.');
      return;
    }

    setLoadingMessage('Settling order...');
    setLoading(true);

    try {
      const nextBillNo = await getNextBillNo();
      const orderData = {
        billNo: nextBillNo,
        date,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        orderType,
        tableNo: orderType === 'Dine-In' ? tableNo : 'N/A',
        customerName: customerName.trim() || 'Guest',
        phone: phone.trim() || '',
        items: cartItems.map(item => ({
          name: item.name,
          category: item.category || 'General',
          mrp: item.price,
          quantity: item.quantity,
          amount: item.total
        })),
        totalOriginalMrp: totals.subtotal,
        totalBaseMrp: totals.subtotal,
        totalItemDiscounts: 0,
        subtotalAfterItemDiscounts: totals.subtotal,
        discountType,
        discountValue,
        overallDiscountAmount: totals.discountAmount,
        gstAmount: 0,
        finalAmount: totals.finalAmount,
        paymentMode,
        createdAt: new Date().toISOString()
      };

      const saved = await saveBill(orderData);
      if (!saved) {
        Alert.alert('Save Notice', 'Order processed locally.');
      }

      // Automatically free the table when bill is settled!
      if (orderType === 'Dine-In') {
        await clearActiveTableOrder(tableNo);
        const updated = await getActiveTableOrders();
        setActiveTableOrders(updated);
      }

      setBillNo(nextBillNo);

      if (shouldPrint) {
        await executePrintReceipt(orderData);
      }

      await clearForm();
      Alert.alert(
        'Order Completed', 
        `Bill ${nextBillNo} settled successfully! Total: ₹${totals.finalAmount.toFixed(2)}${orderType === 'Dine-In' ? ` • Table ${tableNo} is now vacant.` : ''}`
      );
    } catch (e) {
      console.error(e);
      Alert.alert('Print Notice', 'Bill saved successfully. (Print failed or was cancelled)');
      await clearForm();
    } finally {
      setLoading(false);
    }
  };

  const isCurrentTableOccupied = orderType === 'Dine-In' && !!activeTableOrders[tableNo];

  return (
    <View style={styles.container}>
      <LoadingOverlay visible={loading || isScanning} message={loadingMessage} />

      {/* Hidden viewshot receipt */}
      <View style={{ position: 'absolute', top: -10000, left: -10000 }}>
        <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 1 }}>
          <ReceiptTemplate 
            billDetails={{
              billNo,
              date,
              customerName: customerName || 'Guest',
              phone,
              items: cartItems.map(i => ({ name: i.name, mrp: i.price, quantity: i.quantity })),
              totalOriginalMrp: totals.subtotal,
              totalItemDiscounts: 0,
              subtotalAfterItemDiscounts: totals.subtotal,
              discountType,
              discountValue,
              overallDiscountAmount: totals.discountAmount,
              gstAmount: 0,
              finalAmount: totals.finalAmount,
              tableNo,
              orderType
            }}
          />
        </ViewShot>
      </View>

      <ScrollView 
        style={styles.mainScroll} 
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 110 + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Top Order Information Card */}
        <Card style={styles.card}>
          <Card.Content style={styles.cardContent}>
            <View style={styles.billHeaderRow}>
              <View>
                <Text style={styles.billNoText}>Bill No: <Text style={styles.boldText}>{billNo}</Text></Text>
                <Text style={styles.dateText}>Date: {date}</Text>
              </View>
              <TouchableOpacity 
                style={[styles.printerStatusChip, connectedPrinter ? styles.printerConnected : styles.printerDisconnected]}
                onPress={handleScanPrinters}
              >
                <MaterialCommunityIcons 
                  name={connectedPrinter ? "printer-check" : "printer-alert"} 
                  size={16} 
                  color={connectedPrinter ? "#2E7D32" : "#D84315"} 
                />
                <Text style={[styles.printerStatusText, connectedPrinter ? styles.printerTextConn : styles.printerTextDisc]}>
                  {connectedPrinter ? (connectedPrinter.device_name || 'Printer') : 'Connect Printer'}
                </Text>
              </TouchableOpacity>
            </View>

            <Divider style={styles.divider} />

            {/* Order Type & Table */}
            <View style={styles.orderTypeRow}>
              {['Dine-In', 'Takeaway', 'Delivery'].map(type => (
                <Chip
                  key={type}
                  selected={orderType === type}
                  onPress={() => setOrderType(type)}
                  style={[styles.orderTypeChip, orderType === type && styles.orderTypeChipSelected]}
                  textStyle={[styles.orderTypeText, orderType === type && styles.orderTypeTextSelected]}
                  icon={type === 'Dine-In' ? 'table-chair' : type === 'Takeaway' ? 'shopping-outline' : 'bike'}
                >
                  {type}
                </Chip>
              ))}
            </View>

            {/* Dine-In Tables Selector */}
            {orderType === 'Dine-In' && (
              <View style={styles.tableSection}>
                <View style={styles.tableHeaderRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.inputLabel}>Select Table:</Text>
                    {/* Quick filter pills */}
                    <View style={styles.tableFilterPills}>
                      <TouchableOpacity
                        style={[styles.tableFilterPill, tableFilter === 'all' && styles.tableFilterPillActive]}
                        onPress={() => setTableFilter('all')}
                      >
                        <Text style={[styles.tableFilterPillText, tableFilter === 'all' && styles.tableFilterPillTextActive]}>
                          All ({tables.length})
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.tableFilterPill, tableFilter === 'occupied' && styles.tableFilterPillOccupiedActive]}
                        onPress={() => setTableFilter('occupied')}
                      >
                        <Text style={[styles.tableFilterPillText, tableFilter === 'occupied' && styles.tableFilterPillOccupiedTextActive]}>
                          Occupied ({occupiedTableCount})
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.tableFilterPill, tableFilter === 'free' && styles.tableFilterPillActive]}
                        onPress={() => setTableFilter('free')}
                      >
                        <Text style={[styles.tableFilterPillText, tableFilter === 'free' && styles.tableFilterPillTextActive]}>
                          Free ({tables.length - occupiedTableCount})
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <TouchableOpacity 
                      style={[styles.tableSearchToggleBtn, (tableSearchVisible || tableSearchQuery.length > 0) && styles.tableSearchToggleBtnActive]} 
                      onPress={() => setTableSearchVisible(prev => !prev)}
                    >
                      <MaterialCommunityIcons name="magnify" size={14} color={(tableSearchVisible || tableSearchQuery.length > 0) ? "#D84315" : "#666"} />
                      <Text style={[styles.tableSearchToggleText, (tableSearchVisible || tableSearchQuery.length > 0) && { color: '#D84315', fontWeight: 'bold' }]}>
                        {tableSearchQuery ? tableSearchQuery : 'Search'}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={styles.manageTablesBtn} 
                      onPress={() => setTableModalVisible(true)}
                    >
                      <MaterialCommunityIcons name="cog-outline" size={14} color="#D84315" />
                      <Text style={styles.manageTablesText}>Manage</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Table Search Input Bar */}
                {(tableSearchVisible || tableSearchQuery.length > 0) && (
                  <View style={styles.tableSearchInputRow}>
                    <Searchbar
                      placeholder="Search table (e.g. T-2, VIP, guest)..."
                      onChangeText={setTableSearchQuery}
                      value={tableSearchQuery}
                      style={styles.tableSearchBar}
                      inputStyle={styles.tableSearchInput}
                      iconColor="#D84315"
                      autoFocus
                    />
                  </View>
                )}

                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tableQuickScroll}>
                  {filteredTables.length === 0 ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6, gap: 8 }}>
                      <Text style={{ fontSize: 12, color: '#7F8C8D' }}>
                        No tables match "{tableSearchQuery || tableFilter}".
                      </Text>
                      <TouchableOpacity onPress={() => { setTableSearchQuery(''); setTableFilter('all'); }}>
                        <Text style={{ fontSize: 12, color: '#D84315', fontWeight: 'bold' }}>Show All</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    filteredTables.map(tbl => {
                      const hasOrder = !!activeTableOrders[tbl];
                      const orderAmt = hasOrder ? activeTableOrders[tbl].total : null;
                      const isSelected = tableNo === tbl;
                      return (
                        <TouchableOpacity
                          key={tbl}
                          style={[
                            styles.tablePill,
                            isSelected && styles.tablePillSelected,
                            hasOrder && !isSelected && styles.tablePillOccupied
                          ]}
                          onPress={() => handleSelectTable(tbl)}
                        >
                          {hasOrder && (
                            <MaterialCommunityIcons 
                              name="food" 
                              size={12} 
                              color={isSelected ? "#FFF" : "#D84315"} 
                              style={{ marginRight: 3 }} 
                            />
                          )}
                          <Text style={[
                            styles.tablePillText, 
                            isSelected && styles.tablePillTextSelected,
                            hasOrder && !isSelected && styles.tablePillTextOccupied
                          ]}>
                            {tbl}{hasOrder ? ` (₹${orderAmt.toFixed(0)})` : ''}
                          </Text>
                        </TouchableOpacity>
                      );
                    })
                  )}
                </ScrollView>

                {/* Active Table Status Banner */}
                {isCurrentTableOccupied && (
                  <>
                    <View style={styles.activeTableBanner}>
                      <View style={{ width: '100%' }}>
                        <Text style={styles.activeTableBannerTitle}>
                          🛎️ Active Order on {tableNo}
                        </Text>
                        <Text style={styles.activeTableBannerSub}>
                          {activeTableOrders[tableNo]?.items?.length || 0} dishes • ₹{activeTableOrders[tableNo]?.total?.toFixed(2)} • Saved at {activeTableOrders[tableNo]?.savedAt || 'earlier'}
                        </Text>
                      </View>
                      <View style={styles.bannerActions}>
                        <TouchableOpacity 
                          onPress={() => setEditOrderModalVisible(true)}
                          style={styles.editOrderBannerBtn}
                        >
                          <MaterialCommunityIcons name="pencil-outline" size={14} color="#FFF" />
                          <Text style={styles.editOrderBannerBtnText}>Edit</Text>
                        </TouchableOpacity>

                        <TouchableOpacity 
                          onPress={() => handlePrintTableSlip(tableNo)}
                          style={styles.printSlipBannerBtn}
                        >
                          <MaterialCommunityIcons name="printer-outline" size={14} color="#2E7D32" />
                          <Text style={styles.printSlipBannerBtnText}>Print</Text>
                        </TouchableOpacity>

                        <TouchableOpacity 
                          onPress={() => handlePromptFreeTable(tableNo)}
                          style={styles.clearTableBtn}
                        >
                          <MaterialCommunityIcons name="table-off" size={14} color="#E53935" />
                          <Text style={styles.clearTableBtnText}>Free</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                    <View style={styles.editingTableNotice}>
                      <MaterialCommunityIcons name="information-outline" size={14} color="#D84315" />
                      <Text style={styles.editingTableNoticeText}>
                        Editing {tableNo}: Tap dishes below to add to this order.
                      </Text>
                    </View>
                  </>
                )}
              </View>
            )}
          </Card.Content>
        </Card>

        {/* Menu Section - Fast Dish Selection */}
        <Card style={styles.card}>
          <Card.Content style={styles.cardContent}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.iconTitle}>
                <MaterialCommunityIcons name="silverware-fork-knife" size={20} color="#D84315" />
                <Text style={styles.sectionTitle}>Select Menu Dishes</Text>
              </View>
              <Text style={styles.priceNotice}>Prices are fixed from Menu</Text>
            </View>

            {/* Search Bar */}
            <Searchbar
              placeholder="Search dishes (e.g. Biryani, Pizza, Momo)..."
              onChangeText={setSearchQuery}
              value={searchQuery}
              style={styles.searchbar}
              inputStyle={styles.searchInput}
              iconColor="#D84315"
            />

            {/* Categories */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
              {MENU_CATEGORIES.map(cat => (
                <Chip
                  key={cat}
                  selected={selectedCategory === cat}
                  onPress={() => setSelectedCategory(cat)}
                  style={[styles.catChip, selectedCategory === cat && styles.catChipSelected]}
                  textStyle={[styles.catChipText, selectedCategory === cat && styles.catChipTextSelected]}
                >
                  {cat}
                </Chip>
              ))}
            </ScrollView>

            {/* Dish Pills / Items Grid */}
            <View style={styles.dishesGrid}>
              {filteredDishes.map(dish => {
                const inCartItem = cartItems.find(i => i.id === dish.id || i.name === dish.name);
                const isOutOfStock = dish.isAvailable === false;
                return (
                  <TouchableOpacity
                    key={dish.id}
                    style={[
                      styles.dishCard,
                      inCartItem && styles.dishCardInCart,
                      isOutOfStock && styles.dishCardDisabled
                    ]}
                    onPress={() => handleSelectMenuItem(dish)}
                    activeOpacity={0.7}
                    disabled={isOutOfStock}
                  >
                    <View style={styles.dishTop}>
                      <Text style={[styles.dishName, isOutOfStock && styles.textStrikethrough]} numberOfLines={2}>
                        {dish.name}
                      </Text>
                      {inCartItem && (
                        <Badge size={20} style={styles.cartBadge}>
                          {inCartItem.quantity}
                        </Badge>
                      )}
                    </View>
                    <View style={styles.dishBottom}>
                      <Text style={styles.dishCategory}>{dish.category || 'Main'}</Text>
                      <Text style={styles.dishPrice}>
                        {isOutOfStock ? 'Sold Out' : `₹${parseFloat(dish.price || 0).toFixed(0)}`}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Card.Content>
        </Card>

        {/* Current Order Summary / Cart */}
        <Card style={[styles.card, styles.orderCard]}>
          <Card.Content style={styles.cardContent}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.iconTitle}>
                <MaterialCommunityIcons name="cart-outline" size={22} color="#D84315" />
                <Text style={styles.sectionTitle}>
                  {orderType === 'Dine-In' ? `Table ${tableNo} Order` : 'Order Items'}
                </Text>
                {isCurrentTableOccupied && (
                  <Badge style={{ backgroundColor: '#FFCCBC', color: '#D84315', marginLeft: 6 }}>
                    Active Order
                  </Badge>
                )}
              </View>
              {cartItems.length > 0 && (
                <TouchableOpacity onPress={() => setCartItems([])}>
                  <Text style={styles.clearOrderText}>Clear Items</Text>
                </TouchableOpacity>
              )}
            </View>

            {cartItems.length === 0 ? (
              <View style={styles.emptyCart}>
                <MaterialCommunityIcons name="food-off-outline" size={40} color="#BDC3C7" />
                <Text style={styles.emptyCartText}>No dishes selected yet.</Text>
                <Text style={styles.emptyCartSub}>Tap any dish above to add it to the bill.</Text>
              </View>
            ) : (
              <View style={styles.cartList}>
                {cartItems.map((item, idx) => (
                  <View key={item.id || idx} style={styles.cartItemRow}>
                    <View style={styles.cartItemDetails}>
                      <Text style={styles.cartItemName}>{item.name}</Text>
                      <Text style={styles.cartItemRate}>₹{item.price.toFixed(2)} each</Text>
                    </View>

                    {/* Quantity Stepper */}
                    <View style={styles.stepperRow}>
                      <TouchableOpacity 
                        style={styles.stepperBtn} 
                        onPress={() => handleUpdateQty(item.id, -1)}
                      >
                        <MaterialCommunityIcons name="minus" size={16} color="#D84315" />
                      </TouchableOpacity>

                      <TouchableOpacity 
                        style={styles.qtyBox}
                        onPress={() => handleOpenQtyDialog(item)}
                      >
                        <Text style={styles.qtyText}>{item.quantity}</Text>
                      </TouchableOpacity>

                      <TouchableOpacity 
                        style={styles.stepperBtn} 
                        onPress={() => handleUpdateQty(item.id, 1)}
                      >
                        <MaterialCommunityIcons name="plus" size={16} color="#D84315" />
                      </TouchableOpacity>
                    </View>

                    {/* Item Total */}
                    <Text style={styles.cartItemTotal}>₹{item.total.toFixed(2)}</Text>

                    {/* Remove button */}
                    <IconButton
                      icon="close-circle-outline"
                      size={18}
                      iconColor="#E53935"
                      onPress={() => handleRemoveItem(item.id)}
                      style={styles.removeBtn}
                    />
                  </View>
                ))}
              </View>
            )}

            <Divider style={styles.divider} />

            {/* Discount & Payment Controls */}
            <View style={styles.discountRow}>
              <Text style={styles.discountLabel}>Discount:</Text>
              <View style={styles.discountTypeGroup}>
                <TouchableOpacity
                  style={[styles.typeBtn, discountType === 'flat' && styles.typeBtnActive]}
                  onPress={() => setDiscountType('flat')}
                >
                  <Text style={[styles.typeBtnText, discountType === 'flat' && styles.typeBtnTextActive]}>₹ Flat</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.typeBtn, discountType === 'percent' && styles.typeBtnActive]}
                  onPress={() => setDiscountType('percent')}
                >
                  <Text style={[styles.typeBtnText, discountType === 'percent' && styles.typeBtnTextActive]}>% Off</Text>
                </TouchableOpacity>
              </View>
              <TextInput
                mode="outlined"
                keyboardType="decimal-pad"
                value={discountValue}
                onChangeText={setDiscountValue}
                style={styles.discountInput}
                outlineColor="#ddd"
                activeOutlineColor="#D84315"
                dense
              />
            </View>

            {/* Payment Mode Selector */}
            <View style={styles.paymentModeRow}>
              <Text style={styles.paymentLabel}>Payment Mode:</Text>
              <View style={styles.paymentPills}>
                {['Cash', 'UPI', 'Card'].map(mode => (
                  <TouchableOpacity
                    key={mode}
                    style={[styles.paymentPill, paymentMode === mode && styles.paymentPillActive]}
                    onPress={() => setPaymentMode(mode)}
                  >
                    <Text style={[styles.paymentPillText, paymentMode === mode && styles.paymentPillTextActive]}>
                      {mode}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Bill Summary Box */}
            <View style={styles.billSummaryBox}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Total Items:</Text>
                <Text style={styles.summaryVal}>{cartItems.length} ({totals.totalUnits} items)</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Subtotal:</Text>
                <Text style={styles.summaryVal}>₹{totals.subtotal.toFixed(2)}</Text>
              </View>
              {totals.discountAmount > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, { color: '#2E7D32' }]}>Discount:</Text>
                  <Text style={[styles.summaryVal, { color: '#2E7D32' }]}>-₹{totals.discountAmount.toFixed(2)}</Text>
                </View>
              )}
              <Divider style={{ marginVertical: 6 }} />
              <View style={styles.grandTotalRow}>
                <Text style={styles.grandTotalLabel}>Grand Total:</Text>
                <Text style={styles.grandTotalVal}>₹{totals.finalAmount.toFixed(2)}</Text>
              </View>
            </View>

            {/* Settle & Waiter Actions */}
            <View style={styles.actionButtonsRow}>
              {/* If Dine-In: Waiter "Save to Table" Button */}
              {orderType === 'Dine-In' && (
                <Button
                  mode={isCurrentTableOccupied ? "contained" : "contained-tonal"}
                  icon={isCurrentTableOccupied ? "content-save-edit" : "tray-arrow-down"}
                  onPress={() => handleSaveToTable(true)}
                  style={[styles.holdTableBtn, isCurrentTableOccupied && { backgroundColor: '#D84315' }]}
                  contentStyle={styles.btnContent}
                  textColor={isCurrentTableOccupied ? "#FFF" : "#D84315"}
                  disabled={cartItems.length === 0}
                >
                  {isCurrentTableOccupied ? `Update ${tableNo}` : "Save to Table"}
                </Button>
              )}

              {/* If Dine-In & Occupied: Print Table Slip / Pre-Bill without settling */}
              {orderType === 'Dine-In' && isCurrentTableOccupied && (
                <Button
                  mode="outlined"
                  icon="printer-outline"
                  onPress={() => handlePrintTableSlip(tableNo)}
                  style={[styles.holdTableBtn, { borderColor: '#2E7D32' }]}
                  contentStyle={styles.btnContent}
                  textColor="#2E7D32"
                  disabled={cartItems.length === 0}
                >
                  Print Slip
                </Button>
              )}

              {/* Print & Settle Button */}
              <Button
                mode="contained"
                icon="printer-check"
                onPress={() => handleSettleOrder(true)}
                style={styles.printBtn}
                contentStyle={styles.btnContent}
                labelStyle={styles.btnLabel}
                buttonColor="#D84315"
                disabled={cartItems.length === 0}
              >
                Print & Settle
              </Button>

              {/* Save Only Button */}
              <Button
                mode="outlined"
                icon="content-save-outline"
                onPress={() => handleSettleOrder(false)}
                style={styles.saveOnlyBtn}
                contentStyle={styles.btnContent}
                textColor="#D84315"
                disabled={cartItems.length === 0}
              >
                Save
              </Button>
            </View>
          </Card.Content>
        </Card>
      </ScrollView>

      {/* Direct Quantity Input Dialog */}
      <Portal>
        <Dialog visible={qtyDialogVisible} onDismiss={() => setQtyDialogVisible(false)} style={styles.dialog}>
          <Dialog.Title style={styles.dialogTitle}>
            Enter Quantity for {selectedCartItem?.name}
          </Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Quantity"
              mode="outlined"
              keyboardType="number-pad"
              value={customQtyInput}
              onChangeText={setCustomQtyInput}
              autoFocus
              outlineColor="#ddd"
              activeOutlineColor="#D84315"
              style={{ backgroundColor: '#fff' }}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setQtyDialogVisible(false)} textColor="#7F8C8D">Cancel</Button>
            <Button onPress={handleSaveCustomQty} buttonColor="#D84315" mode="contained">Update</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Table Management Modal (Add, Edit, Delete Tables) */}
      <Portal>
        <Dialog 
          visible={tableModalVisible} 
          onDismiss={() => setTableModalVisible(false)} 
          style={styles.dialog}
        >
          <Dialog.Title style={styles.dialogTitle}>Manage Restaurant Tables</Dialog.Title>
          <Dialog.Content>
            {/* Add Table Input */}
            <View style={styles.addTableInputRow}>
              <TextInput
                label="New Table Name"
                placeholder="e.g. T-9, VIP-1, Rooftop"
                value={newTableText}
                onChangeText={setNewTableText}
                mode="outlined"
                outlineColor="#ddd"
                activeOutlineColor="#D84315"
                style={styles.addTableInput}
                dense
              />
              <Button 
                mode="contained" 
                buttonColor="#D84315" 
                onPress={handleAddTable}
                style={styles.addTableBtn}
              >
                Add
              </Button>
            </View>

            <Divider style={{ marginVertical: 10 }} />
            <Text style={styles.tableListHeading}>Current Tables ({tables.length}):</Text>

            <ScrollView style={{ maxHeight: 250 }}>
              {tables.map(tbl => {
                const isOccupied = !!activeTableOrders[tbl];
                return (
                  <View key={tbl} style={styles.tableManageRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                      <MaterialCommunityIcons 
                        name={isOccupied ? "table-furniture" : "table-chair"} 
                        size={20} 
                        color={isOccupied ? "#D84315" : "#2C3E50"} 
                      />
                      <Text style={[styles.tableNameText, isOccupied && { color: '#D84315', fontWeight: 'bold' }]}>
                        {tbl}
                      </Text>
                      {isOccupied && (
                        <Badge style={{ backgroundColor: '#FFCCBC', color: '#D84315', marginLeft: 8 }}>
                          Occupied
                        </Badge>
                      )}
                    </View>
                    <IconButton
                      icon="pencil"
                      size={18}
                      iconColor="#2C3E50"
                      onPress={() => handleStartEditTable(tbl)}
                    />
                    <IconButton
                      icon="trash-can-outline"
                      size={18}
                      iconColor="#E53935"
                      onPress={() => handlePromptDeleteTable(tbl)}
                    />
                  </View>
                );
              })}
            </ScrollView>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setTableModalVisible(false)} textColor="#D84315">Done</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Edit Table Name Modal */}
      <Portal>
        <Dialog visible={editTableModalVisible} onDismiss={() => setEditTableModalVisible(false)} style={styles.dialog}>
          <Dialog.Title style={styles.dialogTitle}>Rename Table</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Table Name"
              value={editTableInput}
              onChangeText={setEditTableInput}
              mode="outlined"
              outlineColor="#ddd"
              activeOutlineColor="#D84315"
              style={{ backgroundColor: '#fff' }}
              autoFocus
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setEditTableModalVisible(false)} textColor="#7F8C8D">Cancel</Button>
            <Button onPress={handleSaveEditTable} buttonColor="#D84315" mode="contained">Save</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Bluetooth Printer Modal */}
      <Portal>
        <Dialog visible={printerModalVisible} onDismiss={() => setPrinterModalVisible(false)} style={styles.dialog}>
          <Dialog.Title style={styles.dialogTitle}>Available Bluetooth Printers</Dialog.Title>
          <Dialog.Content>
            {printers.length === 0 ? (
              <Text style={{ textAlign: 'center', color: '#7F8C8D', padding: 10 }}>
                No paired Bluetooth printers found. Make sure Bluetooth is ON and the thermal printer is paired in phone settings.
              </Text>
            ) : (
              printers.map((dev, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.printerItem}
                  onPress={() => handleConnectPrinter(dev)}
                >
                  <MaterialCommunityIcons name="printer" size={24} color="#D84315" />
                  <View style={{ marginLeft: 12, flex: 1 }}>
                    <Text style={{ fontWeight: 'bold', fontSize: 16 }}>{dev.device_name || 'Thermal Printer'}</Text>
                    <Text style={{ color: '#7F8C8D', fontSize: 12 }}>{dev.inner_mac_address}</Text>
                  </View>
                  <Button mode="contained" buttonColor="#D84315" compact>Connect</Button>
                </TouchableOpacity>
              ))
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={handleScanPrinters} textColor="#D84315">Rescan</Button>
            <Button onPress={() => setPrinterModalVisible(false)} textColor="#7F8C8D">Close</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Edit Active Table Order Modal */}
      <Portal>
        <Dialog 
          visible={editOrderModalVisible} 
          onDismiss={() => setEditOrderModalVisible(false)}
          style={[styles.dialog, { maxHeight: '90%' }]}
        >
          <Dialog.Title style={styles.dialogTitle}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <MaterialCommunityIcons name="table-chair" size={22} color="#D84315" style={{ marginRight: 6 }} />
                <Text style={{ fontSize: 17, fontWeight: 'bold', color: '#2C3E50' }}>Table {tableNo} Dishes</Text>
              </View>
              <Badge style={{ backgroundColor: '#D84315', color: '#FFF' }}>
                {cartItems.length} {cartItems.length === 1 ? 'item' : 'items'}
              </Badge>
            </View>
          </Dialog.Title>
          <Dialog.ScrollArea style={{ maxHeight: 320, paddingHorizontal: 0 }}>
            <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 8 }}>
              {cartItems.length === 0 ? (
                <View style={{ alignItems: 'center', paddingVertical: 24 }}>
                  <MaterialCommunityIcons name="food-off-outline" size={40} color="#BDC3C7" />
                  <Text style={{ color: '#7F8C8D', marginTop: 8, fontSize: 14 }}>No dishes in Table {tableNo} order.</Text>
                  <Text style={{ color: '#95A5A6', fontSize: 12, marginTop: 4 }}>Tap "Add Dishes" below to select from menu.</Text>
                </View>
              ) : (
                cartItems.map((item, idx) => (
                  <View key={item.id || idx} style={styles.modalCartItemRow}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={styles.modalCartItemName} numberOfLines={1}>{item.name}</Text>
                      <Text style={styles.modalCartItemRate}>₹{item.price.toFixed(2)} each</Text>
                    </View>
                    
                    {/* Stepper */}
                    <View style={styles.modalStepperRow}>
                      <TouchableOpacity 
                        style={styles.modalStepperBtn}
                        onPress={() => handleUpdateQty(item.id, -1)}
                      >
                        <MaterialCommunityIcons name="minus" size={14} color="#D84315" />
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={styles.modalQtyBox}
                        onPress={() => handleOpenQtyDialog(item)}
                      >
                        <Text style={styles.modalQtyText}>{item.quantity}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={styles.modalStepperBtn}
                        onPress={() => handleUpdateQty(item.id, 1)}
                      >
                        <MaterialCommunityIcons name="plus" size={14} color="#D84315" />
                      </TouchableOpacity>
                    </View>

                    {/* Total */}
                    <Text style={styles.modalItemTotal}>₹{(item.total || item.price * item.quantity).toFixed(0)}</Text>

                    {/* Delete item button */}
                    <IconButton 
                      icon="trash-can-outline"
                      size={18}
                      iconColor="#E53935"
                      onPress={() => handleRemoveItem(item.id)}
                      style={{ margin: 0, marginLeft: 2 }}
                    />
                  </View>
                ))
              )}
            </ScrollView>
          </Dialog.ScrollArea>

          <View style={styles.modalSummaryRow}>
            <Text style={styles.modalSummaryLabel}>Order Total:</Text>
            <Text style={styles.modalSummaryAmount}>₹{totals.finalAmount.toFixed(2)}</Text>
          </View>

          <Dialog.Actions style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 10 }}>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <Button 
                mode="outlined" 
                icon="plus" 
                textColor="#D84315"
                style={{ borderColor: '#D84315' }}
                onPress={() => setEditOrderModalVisible(false)}
              >
                Add Dishes
              </Button>
              <Button 
                mode="outlined" 
                icon="printer" 
                textColor="#2E7D32"
                style={{ borderColor: '#2E7D32' }}
                onPress={() => handlePrintTableSlip(tableNo)}
                disabled={cartItems.length === 0}
              >
                Print Slip
              </Button>
            </View>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <Button 
                textColor="#7F8C8D" 
                onPress={() => setEditOrderModalVisible(false)}
              >
                Close
              </Button>
              <Button 
                mode="contained" 
                buttonColor="#D84315"
                icon="content-save-check"
                onPress={() => handleSaveToTable(true)}
              >
                Update Order
              </Button>
            </View>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Free Table Confirmation Dialog */}
      <Portal>
        <Dialog 
          visible={freeTableDialogVisible} 
          onDismiss={() => setFreeTableDialogVisible(false)} 
          style={styles.dialog}
        >
          <Dialog.Title style={styles.dialogTitle}>
            Free Table {tableToFree}?
          </Dialog.Title>
          <Dialog.Content>
            <Text style={styles.dialogDesc}>
              Are you sure you want to clear the active order for Table {tableToFree}?
              {activeTableOrders[tableToFree] 
                ? `\n\nThis will remove ${activeTableOrders[tableToFree].items?.length || 0} dishes (Total: ₹${activeTableOrders[tableToFree].total?.toFixed(2)}) and make Table ${tableToFree} available for new guests.` 
                : ''}
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setFreeTableDialogVisible(false)} textColor="#7F8C8D">
              Cancel
            </Button>
            <Button 
              onPress={handleConfirmFreeTable} 
              buttonColor="#E53935" 
              mode="contained"
              icon="table-off"
            >
              Free Table
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Delete Table Confirmation Dialog */}
      <Portal>
        <Dialog 
          visible={deleteTableDialogVisible} 
          onDismiss={() => setDeleteTableDialogVisible(false)} 
          style={styles.dialog}
        >
          <Dialog.Title style={styles.dialogTitle}>
            Delete Table {tableToDelete}?
          </Dialog.Title>
          <Dialog.Content>
            <Text style={styles.dialogDesc}>
              Are you sure you want to permanently delete table "{tableToDelete}"?
              {activeTableOrders[tableToDelete] ? '\n\nNote: This table currently has an active order that will also be removed.' : ''}
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDeleteTableDialogVisible(false)} textColor="#7F8C8D">
              Cancel
            </Button>
            <Button 
              onPress={handleConfirmDeleteTable} 
              buttonColor="#E53935" 
              mode="contained"
              icon="trash-can-outline"
            >
              Delete
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Toast Notification */}
      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={2500}
        style={{ backgroundColor: '#2C3E50', marginBottom: insets.bottom + 10 }}
        action={{
          label: 'OK',
          textColor: '#FFAB91',
          onPress: () => setSnackbarVisible(false)
        }}
      >
        {snackbarMsg}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9F6F0',
  },
  mainScroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 12,
    gap: 12,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    elevation: 2,
  },
  cardContent: {
    padding: 14,
  },
  billHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  billNoText: {
    fontSize: 16,
    color: '#2C3E50',
  },
  boldText: {
    fontWeight: 'bold',
    color: '#D84315',
  },
  dateText: {
    fontSize: 12,
    color: '#7F8C8D',
    marginTop: 2,
  },
  printerStatusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 16,
    gap: 5,
  },
  printerConnected: {
    backgroundColor: '#E8F5E9',
    borderColor: '#A5D6A7',
    borderWidth: 1,
  },
  printerDisconnected: {
    backgroundColor: '#FBE9E7',
    borderColor: '#FFCCBC',
    borderWidth: 1,
  },
  printerStatusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  printerTextConn: {
    color: '#2E7D32',
  },
  printerTextDisc: {
    color: '#D84315',
  },
  divider: {
    marginVertical: 12,
  },
  orderTypeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  orderTypeChip: {
    backgroundColor: '#F1EFEA',
    borderColor: '#E0DAD0',
    borderWidth: 1,
  },
  orderTypeChipSelected: {
    backgroundColor: '#D84315',
  },
  orderTypeText: {
    fontSize: 12,
    color: '#4A4A4A',
  },
  orderTypeTextSelected: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  tableSection: {
    marginTop: 10,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    flexWrap: 'wrap',
    gap: 6,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#555',
  },
  tableFilterPills: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tableFilterPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: '#F1EFEA',
  },
  tableFilterPillActive: {
    backgroundColor: '#2C3E50',
  },
  tableFilterPillOccupiedActive: {
    backgroundColor: '#D84315',
  },
  tableFilterPillText: {
    fontSize: 11,
    color: '#666',
    fontWeight: '600',
  },
  tableFilterPillTextActive: {
    color: '#FFF',
    fontWeight: 'bold',
  },
  tableFilterPillOccupiedTextActive: {
    color: '#FFF',
    fontWeight: 'bold',
  },
  tableSearchToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#F1EFEA',
    gap: 3,
  },
  tableSearchToggleBtnActive: {
    backgroundColor: '#FBE9E7',
    borderColor: '#D84315',
    borderWidth: 1,
  },
  tableSearchToggleText: {
    fontSize: 11,
    color: '#666',
  },
  tableSearchInputRow: {
    marginBottom: 8,
  },
  tableSearchBar: {
    backgroundColor: '#F9F6F0',
    borderRadius: 8,
    height: 38,
    elevation: 0,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  tableSearchInput: {
    minHeight: 38,
    fontSize: 13,
  },
  manageTablesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  manageTablesText: {
    fontSize: 12,
    color: '#D84315',
    fontWeight: '600',
  },
  tableQuickScroll: {
    flexDirection: 'row',
  },
  tablePill: {
    backgroundColor: '#F1EFEA',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#DDD',
    flexDirection: 'row',
    alignItems: 'center',
  },
  tablePillSelected: {
    backgroundColor: '#D84315',
    borderColor: '#D84315',
  },
  tablePillOccupied: {
    backgroundColor: '#FFF3E0',
    borderColor: '#FFB74D',
    borderWidth: 1.5,
  },
  tablePillText: {
    fontSize: 12,
    color: '#555',
    fontWeight: '500',
  },
  tablePillTextSelected: {
    color: '#FFF',
    fontWeight: 'bold',
  },
  tablePillTextOccupied: {
    color: '#E65100',
    fontWeight: 'bold',
  },
  activeTableBanner: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    backgroundColor: '#FBE9E7',
    borderLeftWidth: 4,
    borderLeftColor: '#D84315',
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
    gap: 10,
  },
  activeTableBannerTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#D84315',
  },
  activeTableBannerSub: {
    fontSize: 11,
    color: '#555',
    marginTop: 2,
  },
  bannerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  editOrderBannerBtn: {
    backgroundColor: '#D84315',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  editOrderBannerBtnText: {
    fontSize: 11,
    color: '#FFF',
    fontWeight: 'bold',
  },
  printSlipBannerBtn: {
    backgroundColor: '#E8F5E9',
    borderColor: '#2E7D32',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  printSlipBannerBtnText: {
    fontSize: 11,
    color: '#2E7D32',
    fontWeight: 'bold',
  },
  clearTableBtn: {
    backgroundColor: '#FFF',
    borderColor: '#E53935',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  clearTableBtnText: {
    fontSize: 11,
    color: '#E53935',
    fontWeight: 'bold',
  },
  editingTableNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    marginTop: 6,
    gap: 6,
  },
  editingTableNoticeText: {
    fontSize: 11,
    color: '#E65100',
    fontWeight: '500',
    flex: 1,
  },
  modalCartItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  modalCartItemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2C3E50',
  },
  modalCartItemRate: {
    fontSize: 12,
    color: '#7F8C8D',
    marginTop: 2,
  },
  modalStepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 6,
    overflow: 'hidden',
    marginRight: 8,
  },
  modalStepperBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#F9F6F0',
  },
  modalQtyBox: {
    minWidth: 26,
    paddingHorizontal: 4,
    alignItems: 'center',
  },
  modalQtyText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  modalItemTotal: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#2C3E50',
    minWidth: 42,
    textAlign: 'right',
  },
  modalSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#F9F6F0',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  modalSummaryLabel: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  modalSummaryAmount: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#D84315',
  },
  dialogDesc: {
    fontSize: 14,
    color: '#4A5568',
    lineHeight: 20,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  iconTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  priceNotice: {
    fontSize: 11,
    color: '#27AE60',
    fontWeight: '600',
  },
  searchbar: {
    backgroundColor: '#F1EFEA',
    borderRadius: 10,
    height: 44,
    elevation: 0,
    marginBottom: 10,
  },
  searchInput: {
    minHeight: 44,
    fontSize: 14,
  },
  categoryScroll: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  catChip: {
    marginRight: 6,
    backgroundColor: '#F1EFEA',
  },
  catChipSelected: {
    backgroundColor: '#D84315',
  },
  catChipText: {
    fontSize: 12,
    color: '#555',
  },
  catChipTextSelected: {
    color: '#FFF',
    fontWeight: 'bold',
  },
  dishesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dishCard: {
    width: '48%',
    backgroundColor: '#FAFAF8',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E8E4DC',
    justifyContent: 'space-between',
    minHeight: 74,
  },
  dishCardInCart: {
    borderColor: '#D84315',
    backgroundColor: '#FFF8F6',
    borderWidth: 1.5,
  },
  dishCardDisabled: {
    opacity: 0.5,
    backgroundColor: '#EEEEEE',
  },
  dishTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  dishName: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#2C3E50',
    flex: 1,
  },
  textStrikethrough: {
    textDecorationLine: 'line-through',
    color: '#9E9E9E',
  },
  cartBadge: {
    backgroundColor: '#D84315',
    marginLeft: 4,
  },
  dishBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 6,
  },
  dishCategory: {
    fontSize: 10,
    color: '#7F8C8D',
  },
  dishPrice: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#D84315',
  },
  orderCard: {
    borderTopWidth: 3,
    borderTopColor: '#D84315',
  },
  clearOrderText: {
    fontSize: 12,
    color: '#E53935',
    fontWeight: '600',
  },
  emptyCart: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  emptyCartText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#7F8C8D',
    marginTop: 6,
  },
  emptyCartSub: {
    fontSize: 12,
    color: '#95A5A6',
    marginTop: 2,
  },
  cartList: {
    gap: 8,
  },
  cartItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0EBE3',
  },
  cartItemDetails: {
    flex: 1.2,
  },
  cartItemName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  cartItemRate: {
    fontSize: 11,
    color: '#7F8C8D',
    marginTop: 1,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginHorizontal: 6,
  },
  stepperBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#FBE9E7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyBox: {
    minWidth: 28,
    height: 28,
    paddingHorizontal: 4,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D84315',
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#D84315',
  },
  cartItemTotal: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2C3E50',
    minWidth: 75,
    textAlign: 'right',
  },
  removeBtn: {
    margin: 0,
    padding: 0,
  },
  discountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  discountLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#555',
    width: 70,
  },
  discountTypeGroup: {
    flexDirection: 'row',
    marginRight: 8,
  },
  typeBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#DDD',
    backgroundColor: '#F5F5F5',
  },
  typeBtnActive: {
    backgroundColor: '#D84315',
    borderColor: '#D84315',
  },
  typeBtnText: {
    fontSize: 11,
    color: '#555',
  },
  typeBtnTextActive: {
    color: '#FFF',
    fontWeight: 'bold',
  },
  discountInput: {
    width: 80,
    height: 36,
    backgroundColor: '#FFF',
  },
  paymentModeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
  },
  paymentLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#555',
    width: 100,
  },
  paymentPills: {
    flexDirection: 'row',
    gap: 6,
  },
  paymentPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#F1EFEA',
    borderWidth: 1,
    borderColor: '#DDD',
  },
  paymentPillActive: {
    backgroundColor: '#2E7D32',
    borderColor: '#2E7D32',
  },
  paymentPillText: {
    fontSize: 12,
    color: '#555',
  },
  paymentPillTextActive: {
    color: '#FFF',
    fontWeight: 'bold',
  },
  billSummaryBox: {
    backgroundColor: '#FBF9F6',
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#EAE5DB',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 13,
    color: '#555',
  },
  summaryVal: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2C3E50',
  },
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  grandTotalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  grandTotalVal: {
    fontSize: 20,
    fontWeight: '900',
    color: '#D84315',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  holdTableBtn: {
    flexGrow: 1,
    minWidth: 130,
    borderRadius: 8,
    borderColor: '#D84315',
    backgroundColor: '#FBE9E7',
  },
  printBtn: {
    flexGrow: 1,
    minWidth: 130,
    borderRadius: 8,
  },
  saveOnlyBtn: {
    flexGrow: 1,
    minWidth: 130,
    borderRadius: 8,
    borderColor: '#D84315',
  },
  btnContent: {
    height: 48,
  },
  btnLabel: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  dialog: {
    backgroundColor: '#FFF',
    borderRadius: 14,
  },
  dialogTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  addTableInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addTableInput: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  addTableBtn: {
    borderRadius: 6,
    height: 44,
    justifyContent: 'center',
  },
  tableListHeading: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#555',
    marginBottom: 6,
  },
  tableManageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  tableNameText: {
    fontSize: 15,
    marginLeft: 10,
    color: '#2C3E50',
  },
  printerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
});
