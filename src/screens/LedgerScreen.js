import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, StyleSheet, Alert, FlatList, Platform } from 'react-native';
import { Text, TextInput, Button, Divider, Card, IconButton, SegmentedButtons, Portal, Dialog } from 'react-native-paper';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { saveLedgerEntry, getAllLedgerEntries, deleteLedgerEntry } from '../services/db';
import LoadingOverlay from '../components/LoadingOverlay';
import { TouchableOpacity } from 'react-native';
import { parseDateToTime, getEffectiveDate } from '../utils/dateUtils';

const LedgerGroupItem = ({ item, handleDelete, handleDeleteGroup, getMethodColor }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card style={styles.entryCard}>
      <Card.Content>
        <View style={styles.entryHeader}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setExpanded(!expanded)}>
            <Text style={styles.entryParticulars}>{item.particulars}</Text>
            <Text style={styles.lastActivity}>Last Activity: {item.lastDate}</Text>
          </TouchableOpacity>
          <IconButton 
            icon="trash-can-outline" 
            size={20} 
            iconColor="#E41E3F" 
            onPress={() => handleDeleteGroup(item.particulars)} 
            style={{ margin: 0 }}
          />
          <TouchableOpacity onPress={() => setExpanded(!expanded)} style={{ justifyContent: 'center' }}>
            <MaterialCommunityIcons 
              name={expanded ? "chevron-up" : "chevron-down"} 
              size={24} 
              color="#65676B" 
            />
          </TouchableOpacity>
        </View>

          <Divider style={styles.entryDivider} />

          <View style={styles.amountRow}>
            <View style={styles.amountBox}>
              <Text style={styles.amountLabel}>Total Amount</Text>
              <Text style={styles.amountValue}>₹{item.totalDebit.toFixed(2)}</Text>
            </View>
            <View style={styles.amountBox}>
              <Text style={styles.amountLabel}>Total Paid</Text>
              <Text style={[styles.amountValue, { color: '#42b72a' }]}>₹{item.totalCredit.toFixed(2)}</Text>
            </View>
            <View style={styles.amountBox}>
              <Text style={styles.amountLabel}>Net Balance</Text>
              <Text style={[styles.amountValue, { color: item.totalBalance > 0 ? '#E41E3F' : '#1877F2' }]}>₹{item.totalBalance.toFixed(2)}</Text>
            </View>
          </View>

          {expanded && (
            <View style={styles.detailsContainer}>
              <Divider style={styles.entryDivider} />
              <Text style={styles.detailsTitle}>Recent History</Text>
              {[...item.entries].sort((a, b) => {
                const dateA = getEffectiveDate(a);
                const dateB = getEffectiveDate(b);
                const timeA = parseDateToTime(dateA);
                const timeB = parseDateToTime(dateB);
                if (timeB !== timeA) {
                  return timeB - timeA;
                }
                const createdA = parseDateToTime(a.createdAt);
                const createdB = parseDateToTime(b.createdAt);
                if (createdB !== createdA) {
                  return createdB - createdA;
                }
                const idA = String(a.id || '');
                const idB = String(b.id || '');
                return idB.localeCompare(idA);
              }).map((detail, idx) => (
                <View key={detail.id || idx} style={styles.detailRow}>
                  <View style={styles.detailInfo}>
                    <Text style={styles.detailDate}>{getEffectiveDate(detail)} - <Text style={{color: getMethodColor(detail.method), fontWeight: 'bold'}}>{detail.method}</Text></Text>
                    <View style={{flexDirection: 'row', flexWrap: 'wrap'}}>
                      {detail.chequeNo ? <Text style={styles.chequeText}>Chq: {detail.chequeNo} </Text> : null}
                      {detail.invoiceNo ? <Text style={styles.invoiceText}>Inv: {detail.invoiceNo} </Text> : null}
                    </View>
                  </View>
                  <View style={styles.detailAmounts}>
                    <Text style={styles.detailDebit}>+₹{detail.debit.toFixed(2)}</Text>
                    <Text style={styles.detailCredit}>-₹{detail.credit.toFixed(2)}</Text>
                  </View>
                  <IconButton 
                    icon="trash-can-outline" 
                    size={18} 
                    iconColor="#E41E3F" 
                    onPress={() => handleDelete(detail.id)} 
                    style={{ margin: 0 }}
                  />
                </View>
              ))}
            </View>
          )}
      </Card.Content>
    </Card>
  );
};

export default function LedgerScreen() {
  const insets = useSafeAreaInsets();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Loading...');

  const [entryType, setEntryType] = useState('bill');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [particulars, setParticulars] = useState('');
  
  // Custom Dialog State
  const [confirmDialogVisible, setConfirmDialogVisible] = useState(false);
  const [confirmDialogConfig, setConfirmDialogConfig] = useState({ title: '', message: '', onConfirm: null });

  const [method, setMethod] = useState('Cash');
  const [chequeNo, setChequeNo] = useState('');
  const [debit, setDebit] = useState('');
  const [credit, setCredit] = useState('');
  const [invoiceNo, setInvoiceNo] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');
  
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showInvoiceDatePicker, setShowInvoiceDatePicker] = useState(false);

  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchEntries();
  }, []);

  const fetchEntries = useCallback(async () => {
    setLoadingMessage('Fetching entries...');
    setLoading(true);
    const data = await getAllLedgerEntries();
    setEntries(data);
    setLoading(false);
  }, []);

  const onDateChange = (event, selectedDate) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      const year = selectedDate.getFullYear();
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const day = String(selectedDate.getDate()).padStart(2, '0');
      setDate(`${year}-${month}-${day}`);
    }
  };

  const onInvoiceDateChange = (event, selectedDate) => {
    setShowInvoiceDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      const year = selectedDate.getFullYear();
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const day = String(selectedDate.getDate()).padStart(2, '0');
      setInvoiceDate(`${year}-${month}-${day}`);
    }
  };

  const handleSave = useCallback(async () => {
    if (!particulars) {
      Alert.alert('Error', 'Please fill in Particulars.');
      return;
    }

    const isBill = entryType === 'bill';

    const d = isBill ? (parseFloat(debit) || 0) : 0;
    const c = !isBill ? (parseFloat(credit) || 0) : 0;
    const b = d - c;

    const entry = {
      date,
      particulars: particulars.trim(),
      method: isBill ? 'Bill' : method,
      chequeNo: (!isBill && method === 'Cheque') ? chequeNo : '',
      debit: d,
      credit: c,
      balance: b,
      invoiceNo,
      invoiceDate
    };

    setLoadingMessage('Saving entry...');
    setIsSaving(true);
    const result = await saveLedgerEntry(entry);
    setIsSaving(false);

    if (result) {
      setParticulars('');
      setChequeNo('');
      setDebit('');
      setCredit('');
      setInvoiceNo('');
      setInvoiceDate('');
      fetchEntries();
      Alert.alert('Success', 'Ledger entry saved successfully.');
    } else {
      Alert.alert('Error', 'Failed to save ledger entry.');
    }
  }, [particulars, debit, credit, date, method, chequeNo, fetchEntries, invoiceNo, invoiceDate, entryType]);

  const confirmAction = (title, message, onConfirm) => {
    setConfirmDialogConfig({ title, message, onConfirm });
    setConfirmDialogVisible(true);
  };

  const handleDelete = useCallback((id) => {
    confirmAction(
      'Delete Entry',
      'Are you sure you want to delete this entry?',
      async () => {
        if (!id) {
          Alert.alert('Error', 'Cannot delete: Entry ID is missing. Please refresh and try again.');
          return;
        }
        setLoadingMessage('Deleting entry...');
        setLoading(true);
        const success = await deleteLedgerEntry(id);
        setLoading(false);
        if (success) {
          setEntries(prev => prev.filter(e => e.id !== id));
          Alert.alert('Deleted', 'Entry deleted successfully.');
        } else {
          Alert.alert('Error', 'Failed to delete the entry. Check your connection.');
        }
      }
    );
  }, []);

  const handleDeleteGroup = useCallback((particulars) => {
    confirmAction(
      'Delete Group',
      `Are you sure you want to delete ALL entries for "${particulars}"?`,
      async () => {
        setLoadingMessage('Deleting entries...');
        setLoading(true);
        const groupEntries = entries.filter(e => (e.particulars || '').trim() === (particulars || '').trim());
        const promises = groupEntries
          .filter(e => !!e.id)
          .map(e => deleteLedgerEntry(e.id));
        
        if (promises.length === 0) {
          Alert.alert('Warning', 'No entries with valid IDs found to delete.');
          setLoading(false);
          return;
        }

        const results = await Promise.all(promises);
        setLoading(false);
        if (results.every(res => res === true)) {
          setEntries(prev => prev.filter(e => (e.particulars || '').trim() !== (particulars || '').trim()));
          Alert.alert('Deleted', `All entries for "${particulars}" deleted.`);
        } else {
          Alert.alert('Error', 'Failed to delete some entries.');
        }
      }
    );
  }, [entries]);

  const handleClearAll = useCallback(() => {
    confirmAction(
      'Clear All Entries',
      'This will permanently delete ALL ledger entries. This action cannot be undone!',
      async () => {
        setLoadingMessage('Clearing all entries...');
        setLoading(true);
        try {
          const promises = entries.map(entry => deleteLedgerEntry(entry.id));
          await Promise.all(promises);
          setEntries([]);
          Alert.alert('Success', 'All ledger entries cleared.');
        } catch (e) {
          Alert.alert('Error', 'Some entries could not be deleted.');
          fetchEntries();
        } finally {
          setLoading(false);
        }
      }
    );
  }, [entries, fetchEntries]);

  const totals = useMemo(() => {
    const totalDebit = entries.reduce((sum, entry) => sum + (entry.debit || 0), 0);
    const totalCredit = entries.reduce((sum, entry) => sum + (entry.credit || 0), 0);
    const totalBalance = totalDebit - totalCredit;
    return { totalDebit, totalCredit, totalBalance };
  }, [entries]);

  const particularsSuggestions = useMemo(() => {
    if (!particulars.trim()) return [];
    const uniqueNames = [...new Set(entries.map(e => e.particulars))].filter(Boolean);
    return uniqueNames.filter(name => 
      name.toLowerCase().includes(particulars.toLowerCase()) && 
      name.toLowerCase() !== particulars.toLowerCase()
    ).slice(0, 5); 
  }, [particulars, entries]);

  const groupedEntries = useMemo(() => {
    const groups = {};
    entries.forEach(entry => {
      const name = entry.particulars || 'Unknown';
      const effDate = getEffectiveDate(entry);
      const effTime = parseDateToTime(effDate);
      if (!groups[name]) {
        groups[name] = {
          particulars: name,
          totalDebit: 0,
          totalCredit: 0,
          totalBalance: 0,
          lastDate: effDate,
          lastDateTime: effTime,
          entries: []
        };
      }
      groups[name].totalDebit += (entry.debit || 0);
      groups[name].totalCredit += (entry.credit || 0);
      groups[name].totalBalance += (entry.balance || 0);
      groups[name].entries.push(entry);
      if (effTime > groups[name].lastDateTime) {
        groups[name].lastDateTime = effTime;
        groups[name].lastDate = effDate;
      }
    });
    return Object.values(groups).sort((a, b) => b.lastDateTime - a.lastDateTime);
  }, [entries]);

  const getMethodColor = (m) => {
    switch (m) {
      case 'Cash': return '#42b72a';
      case 'UPI': return '#1877F2';
      case 'NEFT': return '#FF9F00';
      case 'Cheque': return '#65676B';
      case 'Bill': return '#E41E3F';
      default: return '#65676B';
    }
  };

  const renderItem = useCallback(({ item }) => (
    <LedgerGroupItem 
      item={item} 
      handleDelete={handleDelete} 
      handleDeleteGroup={handleDeleteGroup}
      getMethodColor={getMethodColor} 
    />
  ), [handleDelete, handleDeleteGroup]);

  const ListHeader = useMemo(() => (
    <View>
      <Card style={styles.formCard}>
        <Card.Title title="New Bank/Ledger Entry" titleStyle={styles.cardTitle} />
        <Card.Content>
          <SegmentedButtons
            value={entryType}
            onValueChange={setEntryType}
            buttons={[
              { value: 'bill', label: 'Bill Entry' },
              { value: 'payment', label: 'Payment' },
            ]}
            style={styles.segmented}
          />

          <TouchableOpacity onPress={() => setShowDatePicker(true)}>
            <View style={{ pointerEvents: 'none' }}>
              <TextInput
                label="Date"
                value={date}
                mode="outlined"
                style={styles.input}
                activeOutlineColor="#1877F2"
                editable={false}
                right={<TextInput.Icon icon="calendar" />}
              />
            </View>
          </TouchableOpacity>
          {showDatePicker && (
            <DateTimePicker
              value={new Date(date)}
              mode="date"
              display="default"
              onChange={onDateChange}
            />
          )}
          <TextInput
            label="Particulars (Client Name)"
            value={particulars}
            onChangeText={setParticulars}
            mode="outlined"
            style={styles.input}
            activeOutlineColor="#1877F2"
          />
          {particularsSuggestions.length > 0 && (
            <View style={styles.suggestionsContainer}>
              {particularsSuggestions.map((suggestion, index) => (
                <TouchableOpacity 
                  key={index} 
                  style={styles.suggestionItem} 
                  onPress={() => setParticulars(suggestion)}
                >
                  <MaterialCommunityIcons name="history" size={16} color="#65676B" style={{marginRight: 8}} />
                  <Text style={styles.suggestionText}>{suggestion}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {entryType === 'payment' && (
            <>
              <Text style={styles.label}>Payment Method</Text>
              <SegmentedButtons
                value={method}
                onValueChange={setMethod}
                buttons={[
                  { value: 'Cash', label: 'Cash' },
                  { value: 'UPI', label: 'UPI' },
                  { value: 'NEFT', label: 'NEFT' },
                  { value: 'Cheque', label: 'Cheque' },
                ]}
                style={styles.segmented}
              />

              {method === 'Cheque' && (
                <TextInput
                  label="Cheque Number (Optional)"
                  value={chequeNo}
                  onChangeText={setChequeNo}
                  mode="outlined"
                  style={styles.input}
                  activeOutlineColor="#1877F2"
                />
              )}
            </>
          )}

          {entryType === 'bill' && (
            <View style={styles.row}>
              <TextInput
                label="Invoice No"
                value={invoiceNo}
                onChangeText={setInvoiceNo}
                mode="outlined"
                style={[styles.input, { flex: 1, marginRight: 5 }]}
                activeOutlineColor="#1877F2"
              />
              <View style={{ flex: 1, marginLeft: 5 }}>
                <TouchableOpacity onPress={() => setShowInvoiceDatePicker(true)}>
                  <View style={{ pointerEvents: 'none' }}>
                    <TextInput
                      label="Invoice Date"
                      value={invoiceDate}
                      mode="outlined"
                      style={styles.input}
                      activeOutlineColor="#1877F2"
                      placeholder="Select Date"
                      editable={false}
                      right={<TextInput.Icon icon="calendar" />}
                    />
                  </View>
                </TouchableOpacity>
                {showInvoiceDatePicker && (
                  <DateTimePicker
                    value={invoiceDate ? new Date(invoiceDate) : new Date()}
                    mode="date"
                    display="default"
                    onChange={onInvoiceDateChange}
                  />
                )}
              </View>
            </View>
          )}

          {entryType === 'bill' ? (
            <TextInput
              label="Total"
              value={debit}
              onChangeText={setDebit}
              mode="outlined"
              keyboardType="numeric"
              style={styles.input}
              activeOutlineColor="#1877F2"
            />
          ) : (
            <TextInput
              label="Paid"
              value={credit}
              onChangeText={setCredit}
              mode="outlined"
              keyboardType="numeric"
              style={styles.input}
              activeOutlineColor="#1877F2"
            />
          )}

          <Button
            mode="contained"
            onPress={handleSave}
            loading={isSaving}
            disabled={isSaving}
            style={styles.saveButton}
            buttonColor="#1877F2"
          >
            Save Entry
          </Button>
        </Card.Content>
      </Card>

      {entries.length > 0 && (
        <Card style={styles.summaryCard}>
          <Card.Content>
            <Text style={styles.cardTitle}>Overall Ledger Summary</Text>
            <Divider style={styles.entryDivider} />
            <View style={styles.amountRow}>
              <View style={styles.amountBox}>
                <Text style={styles.amountLabel}>Total Amount</Text>
                <Text style={styles.amountValue}>₹{totals.totalDebit.toFixed(2)}</Text>
              </View>
              <View style={styles.amountBox}>
                <Text style={styles.amountLabel}>Paid Amount</Text>
                <Text style={[styles.amountValue, { color: '#42b72a' }]}>₹{totals.totalCredit.toFixed(2)}</Text>
              </View>
              <View style={styles.amountBox}>
                <Text style={styles.amountLabel}>Total Balance</Text>
                <Text style={[styles.amountValue, { color: totals.totalBalance > 0 ? '#E41E3F' : '#1877F2' }]}>₹{totals.totalBalance.toFixed(2)}</Text>
              </View>
            </View>
          </Card.Content>
        </Card>
      )}

      <View style={styles.listHeader}>
        <Text style={styles.listTitle}>Recent Entries</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {entries.length > 0 && (
            <IconButton icon="delete-sweep" iconColor="#E41E3F" onPress={handleClearAll} />
          )}
          <IconButton icon="refresh" onPress={fetchEntries} />
        </View>
      </View>
    </View>
  ), [date, particulars, method, chequeNo, debit, credit, handleSave, isSaving, entries.length, totals, handleClearAll, fetchEntries, invoiceNo, invoiceDate, showDatePicker, showInvoiceDatePicker, entryType, particularsSuggestions]);

  return (
    <View style={styles.container}>
      <LoadingOverlay visible={loading || isSaving} message={loadingMessage} />
      <FlatList
        data={groupedEntries}
        renderItem={renderItem}
        keyExtractor={(item) => item.particulars}
        ListHeaderComponent={ListHeader}
        contentContainerStyle={[styles.content, { paddingBottom: 110 + insets.bottom }]}
        ListEmptyComponent={!loading && (
          <View style={styles.emptyView}>
            <MaterialCommunityIcons name="book-open-variant" size={48} color="#CCD0D5" />
            <Text style={styles.emptyText}>No ledger entries yet.</Text>
          </View>
        )}
      />
      
      <Portal>
        <Dialog visible={confirmDialogVisible} onDismiss={() => setConfirmDialogVisible(false)} style={{ backgroundColor: '#fff', borderRadius: 8 }}>
          <Dialog.Title style={{ color: '#050505', fontSize: 20, fontWeight: 'bold' }}>{confirmDialogConfig.title}</Dialog.Title>
          <Dialog.Content>
            <Text style={{ color: '#65676B', fontSize: 16 }}>{confirmDialogConfig.message}</Text>
          </Dialog.Content>
          <Dialog.Actions style={{ paddingHorizontal: 20, paddingBottom: 15 }}>
            <Button mode="text" onPress={() => setConfirmDialogVisible(false)} textColor="#65676B">Cancel</Button>
            <Button 
              mode="contained" 
              onPress={() => {
                setConfirmDialogVisible(false);
                if (confirmDialogConfig.onConfirm) confirmDialogConfig.onConfirm();
              }} 
              buttonColor="#E41E3F" 
              style={{ borderRadius: 6, marginLeft: 10 }}
            >
              Confirm
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F2F5' },
  content: { padding: 10 },
  formCard: { backgroundColor: '#fff', borderRadius: 8, elevation: 2, marginBottom: 20 },
  cardTitle: { fontWeight: 'bold' },
  input: { marginBottom: 12, backgroundColor: '#fff' },
  label: { fontSize: 14, color: '#65676B', marginBottom: 8, marginLeft: 4 },
  segmented: { marginBottom: 15 },
  row: { flexDirection: 'row' },
  saveButton: { borderRadius: 8, marginTop: 5, paddingVertical: 4 },
  listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, paddingHorizontal: 5 },
  listTitle: { fontSize: 18, fontWeight: 'bold', color: '#050505' },
  entryCard: { backgroundColor: '#fff', borderRadius: 8, marginBottom: 12, elevation: 1 },
  entryHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  entryDate: { fontSize: 12, color: '#65676B', flex: 1 },
  methodBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, color: '#fff', fontSize: 10, fontWeight: 'bold', overflow: 'hidden' },
  entryParticulars: { fontSize: 16, fontWeight: 'bold', color: '#050505', marginBottom: 2 },
  chequeText: { fontSize: 12, color: '#65676B', marginBottom: 4 },
  entryDivider: { marginVertical: 10, backgroundColor: '#F0F2F5' },
  amountRow: { flexDirection: 'row', justifyContent: 'space-between' },
  amountBox: { alignItems: 'center', flex: 1 },
  amountLabel: { fontSize: 10, color: '#65676B', marginBottom: 2 },
  amountValue: { fontSize: 14, fontWeight: 'bold', color: '#050505' },
  summaryCard: { backgroundColor: '#fff', borderRadius: 8, elevation: 2, marginBottom: 20, borderLeftWidth: 4, borderLeftColor: '#1877F2' },
  emptyView: { alignItems: 'center', marginTop: 40 },
  emptyText: { color: '#65676B', marginTop: 10 },
  lastActivity: { fontSize: 12, color: '#65676B', marginTop: 2 },
  detailsContainer: { marginTop: 5 },
  detailsTitle: { fontSize: 14, fontWeight: 'bold', color: '#050505', marginBottom: 10 },
  detailRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F0F2F5' },
  detailInfo: { flex: 1 },
  detailDate: { fontSize: 12, color: '#050505' },
  detailAmounts: { alignItems: 'flex-end', marginRight: 10 },
  detailDebit: { fontSize: 13, color: '#E41E3F', fontWeight: 'bold' },
  detailCredit: { fontSize: 13, color: '#42b72a', fontWeight: 'bold' },
  invoiceText: { fontSize: 11, color: '#1877F2', marginTop: 2, fontStyle: 'italic' },
  suggestionsContainer: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E4E6EB',
    borderRadius: 8,
    marginTop: -8,
    marginBottom: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F2F5',
  },
  suggestionText: {
    fontSize: 14,
    color: '#050505',
  },
});
