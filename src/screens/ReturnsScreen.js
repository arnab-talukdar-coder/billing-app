import React, { useState, useEffect, useCallback } from 'react';
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
  Searchbar 
} from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import { searchBill, getRecentBills, deleteBill } from '../services/db';
import { generateHtmlReceipt } from '../utils/printTemplate';
import { getThermalPrintOptions } from '../utils/printConfig';
import thermalPrinter from '../utils/thermalPrinter';
import LoadingOverlay from '../components/LoadingOverlay';

export default function ReturnsScreen({ navigation, route }) {
  const userRole = route?.params?.userRole ?? 'admin';
  const insets = useSafeAreaInsets();

  const [searchQuery, setSearchQuery] = useState('');
  const [recentBills, setRecentBills] = useState([]);
  const [selectedBill, setSelectedBill] = useState(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Loading orders...');

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const bills = await getRecentBills(30);
      setRecentBills(bills);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Reload orders when focused
  useEffect(() => {
    const unsubscribe = navigation?.addListener?.('focus', () => {
      fetchOrders();
    });
    return unsubscribe;
  }, [navigation, fetchOrders]);

  const handleSearch = async () => {
    const query = searchQuery.trim();
    if (!query) {
      fetchOrders();
      return;
    }

    setLoadingMessage('Searching for order...');
    setLoading(true);
    try {
      const found = await searchBill(query);
      if (found) {
        setSelectedBill(found);
        setDetailModalVisible(true);
      } else {
        Alert.alert('Not Found', `No order found with Bill Number "${query}".`);
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to search order.');
    } finally {
      setLoading(false);
    }
  };

  const handlePrintReceipt = async (bill) => {
    setLoadingMessage('Reprinting receipt...');
    setLoading(true);
    try {
      const isConnected = await thermalPrinter.isConnected?.();
      if (isConnected) {
        await thermalPrinter.printBill(bill);
      } else {
        const html = generateHtmlReceipt(bill);
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
          await Print.printAsync({ html, ...getThermalPrintOptions(bill.items?.length || 1) });
        }
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Print Error', 'Could not print receipt.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteOrder = (bill) => {
    const doDelete = async () => {
      setLoadingMessage('Deleting bill...');
      setLoading(true);
      try {
        const success = await deleteBill(bill.billNo || bill.id);
        if (success) {
          setDetailModalVisible(false);
          await fetchOrders();
          Alert.alert('Deleted', 'Bill deleted successfully.');
        } else {
          Alert.alert('Error', 'Failed to delete bill.');
        }
      } catch (e) {
        Alert.alert('Error', 'Error deleting bill.');
      } finally {
        setLoading(false);
      }
    };

    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(`Are you sure you want to permanently delete Bill "${bill.billNo || bill.id}"? This cannot be undone.`)) {
        doDelete();
      }
      return;
    }

    Alert.alert(
      'Cancel / Void Bill',
      `Are you sure you want to permanently delete Bill "${bill.billNo || bill.id}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: doDelete
        }
      ]
    );
  };

  const renderOrderCard = ({ item }) => {
    const itemCount = item.items?.length || 0;
    const orderTotal = item.finalAmount !== undefined ? item.finalAmount : item.totalAmount || 0;

    return (
      <Card 
        style={styles.orderCard}
        onPress={() => {
          setSelectedBill(item);
          setDetailModalVisible(true);
        }}
      >
        <Card.Content style={styles.cardContent}>
          <View style={styles.topRow}>
            <View>
              <Text style={styles.billNo}>{item.billNo || item.id}</Text>
              <Text style={styles.orderTime}>{item.date} {item.time ? `• ${item.time}` : ''}</Text>
            </View>
            <View style={styles.rightHeader}>
              <Text style={styles.amountText}>₹{parseFloat(orderTotal).toFixed(2)}</Text>
              <Chip style={styles.orderTypeChip} textStyle={styles.orderTypeText}>
                {item.orderType || 'Dine-In'}{item.tableNo && item.tableNo !== 'N/A' ? ` (${item.tableNo})` : ''}
              </Chip>
            </View>
          </View>

          <Divider style={styles.cardDivider} />

          <View style={styles.summaryRow}>
            <Text style={styles.itemsSummary} numberOfLines={1}>
              {item.items?.map(i => `${i.name} (x${i.quantity})`).join(', ') || 'No item details'}
            </Text>
            <View style={styles.paymentBadge}>
              <MaterialCommunityIcons 
                name={item.paymentMode === 'UPI' ? 'qrcode-scan' : item.paymentMode === 'Card' ? 'credit-card' : 'cash'} 
                size={14} 
                color="#555" 
              />
              <Text style={styles.paymentModeText}>{item.paymentMode || 'Cash'}</Text>
            </View>
          </View>
        </Card.Content>
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      <LoadingOverlay visible={loading} message={loadingMessage} />

      {/* Search Header */}
      <View style={styles.headerArea}>
        <Searchbar
          placeholder="Search Bill No (e.g. MMN0001)..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={handleSearch}
          style={styles.searchbar}
          inputStyle={styles.searchInput}
          iconColor="#D84315"
        />
      </View>

      <FlatList
        data={recentBills}
        keyExtractor={item => item.id || item.billNo}
        renderItem={renderOrderCard}
        contentContainerStyle={[styles.listContainer, { paddingBottom: 80 + insets.bottom }]}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <Text style={styles.listTitle}>Recent Orders ({recentBills.length})</Text>
            <TouchableOpacity onPress={fetchOrders}>
              <MaterialCommunityIcons name="refresh" size={22} color="#D84315" />
            </TouchableOpacity>
          </View>
        }
        ListEmptyComponent={
          !loading && (
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="receipt" size={54} color="#BDC3C7" />
              <Text style={styles.emptyTitle}>No past orders yet</Text>
              <Text style={styles.emptySubtitle}>Bills created in the POS will appear here.</Text>
            </View>
          )
        }
      />

      {/* Bill Details Modal */}
      <Portal>
        <Dialog 
          visible={detailModalVisible} 
          onDismiss={() => setDetailModalVisible(false)}
          style={styles.dialog}
        >
          {selectedBill ? (
            <View>
              <Dialog.Title style={styles.dialogTitle}>
                Bill Details: {selectedBill.billNo || selectedBill.id}
              </Dialog.Title>
              <Dialog.ScrollArea style={{ maxHeight: 400, paddingHorizontal: 0 }}>
                <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 10 }}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Date & Time:</Text>
                    <Text style={styles.detailValue}>{selectedBill.date} {selectedBill.time || ''}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Order Type:</Text>
                    <Text style={styles.detailValue}>
                      {selectedBill.orderType || 'Dine-In'} {selectedBill.tableNo && selectedBill.tableNo !== 'N/A' ? `(${selectedBill.tableNo})` : ''}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Payment Mode:</Text>
                    <Text style={styles.detailValue}>{selectedBill.paymentMode || 'Cash'}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Customer:</Text>
                    <Text style={styles.detailValue}>{selectedBill.customerName || 'Guest'}</Text>
                  </View>

                  <Divider style={{ marginVertical: 10 }} />
                  <Text style={styles.itemsTitle}>Items Ordered:</Text>

                  {selectedBill.items?.map((item, idx) => (
                    <View key={idx} style={styles.billItemRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.billItemName}>{item.name}</Text>
                        <Text style={styles.billItemSub}>₹{parseFloat(item.mrp || item.price || 0).toFixed(2)} x {item.quantity}</Text>
                      </View>
                      <Text style={styles.billItemTotal}>
                        ₹{(parseFloat(item.mrp || item.price || 0) * (item.quantity || 1)).toFixed(2)}
                      </Text>
                    </View>
                  ))}

                  <Divider style={{ marginVertical: 10 }} />

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Subtotal:</Text>
                    <Text style={styles.detailValue}>₹{parseFloat(selectedBill.totalOriginalMrp || selectedBill.subtotalAfterItemDiscounts || selectedBill.finalAmount || 0).toFixed(2)}</Text>
                  </View>
                  {selectedBill.overallDiscountAmount > 0 && (
                    <View style={styles.detailRow}>
                      <Text style={[styles.detailLabel, { color: '#2E7D32' }]}>Discount:</Text>
                      <Text style={[styles.detailValue, { color: '#2E7D32' }]}>-₹{parseFloat(selectedBill.overallDiscountAmount).toFixed(2)}</Text>
                    </View>
                  )}
                  <View style={[styles.detailRow, { marginTop: 6 }]}>
                    <Text style={[styles.detailLabel, { fontWeight: 'bold', fontSize: 16 }]}>Total Paid:</Text>
                    <Text style={[styles.detailValue, { fontWeight: 'bold', fontSize: 18, color: '#D84315' }]}>
                      ₹{parseFloat(selectedBill.finalAmount || 0).toFixed(2)}
                    </Text>
                  </View>
                </ScrollView>
              </Dialog.ScrollArea>

              <Dialog.Actions style={styles.dialogActions}>
                {userRole === 'admin' && (
                  <Button 
                    mode="text" 
                    textColor="#E53935" 
                    onPress={() => handleDeleteOrder(selectedBill)}
                  >
                    Delete
                  </Button>
                )}
                <Button 
                  mode="outlined" 
                  textColor="#D84315" 
                  style={{ borderColor: '#D84315' }}
                  onPress={() => handlePrintReceipt(selectedBill)}
                  icon="printer"
                >
                  Reprint
                </Button>
                <Button 
                  mode="contained" 
                  buttonColor="#D84315" 
                  onPress={() => setDetailModalVisible(false)}
                >
                  Close
                </Button>
              </Dialog.Actions>
            </View>
          ) : null}
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9F6F0',
  },
  headerArea: {
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EAE5DB',
  },
  searchbar: {
    backgroundColor: '#F1EFEA',
    borderRadius: 10,
    height: 46,
    elevation: 0,
  },
  searchInput: {
    minHeight: 46,
    fontSize: 14,
  },
  listContainer: {
    padding: 12,
    gap: 10,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  listTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  orderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    elevation: 2,
    borderLeftWidth: 4,
    borderLeftColor: '#D84315',
  },
  cardContent: {
    padding: 12,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  billNo: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  orderTime: {
    fontSize: 12,
    color: '#7F8C8D',
    marginTop: 2,
  },
  rightHeader: {
    alignItems: 'flex-end',
  },
  amountText: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#D84315',
  },
  orderTypeChip: {
    backgroundColor: '#F1EFEA',
    height: 24,
    marginTop: 4,
  },
  orderTypeText: {
    fontSize: 10,
    color: '#555',
    lineHeight: 12,
  },
  cardDivider: {
    marginVertical: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemsSummary: {
    fontSize: 12,
    color: '#555',
    flex: 1,
    marginRight: 10,
  },
  paymentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1EFEA',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  paymentModeText: {
    fontSize: 11,
    color: '#555',
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#7F8C8D',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#95A5A6',
    marginTop: 4,
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
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  detailLabel: {
    fontSize: 13,
    color: '#7F8C8D',
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2C3E50',
  },
  itemsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginBottom: 8,
  },
  billItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  billItemName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2C3E50',
  },
  billItemSub: {
    fontSize: 11,
    color: '#7F8C8D',
  },
  billItemTotal: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  dialogActions: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
});
