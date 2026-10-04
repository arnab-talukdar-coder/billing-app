import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  View, 
  ScrollView, 
  StyleSheet, 
  Alert, 
  FlatList, 
  TouchableOpacity, 
  RefreshControl,
  Switch
} from 'react-native';
import { 
  Text, 
  TextInput, 
  Button, 
  Card, 
  Chip, 
  FAB, 
  Portal, 
  Dialog, 
  IconButton, 
  Divider,
  Searchbar 
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { 
  getMenuItems, 
  addMenuItem, 
  updateMenuItem, 
  deleteMenuItem, 
  MENU_CATEGORIES,
  DEFAULT_MENU_ITEMS 
} from '../services/db';
import LoadingOverlay from '../components/LoadingOverlay';

export default function MenuScreen() {
  const insets = useSafeAreaInsets();
  const [menuItems, setMenuItems] = useState(DEFAULT_MENU_ITEMS);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Saving...');
  const [refreshing, setRefreshing] = useState(false);

  // Dialog state
  const [dialogVisible, setDialogVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentItemId, setCurrentItemId] = useState(null);
  const [itemName, setItemName] = useState('');
  const [itemCategory, setItemCategory] = useState('Main Course');
  const [itemPrice, setItemPrice] = useState('');
  const [itemAvailable, setItemAvailable] = useState(true);

  const fetchMenu = useCallback(async (force = false) => {
    try {
      const items = await getMenuItems(force);
      if (items && items.length > 0) setMenuItems(items);
    } catch (e) {
      console.warn('fetchMenu error:', e);
    }
  }, []);

  useEffect(() => {
    fetchMenu(false);
  }, [fetchMenu]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchMenu(true);
    setRefreshing(false);
  }, [fetchMenu]);

  // Filtered dishes
  const filteredItems = useMemo(() => {
    return menuItems.filter(item => {
      const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
      const matchesSearch = !searchQuery.trim() || 
        (item.name && item.name.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesCategory && matchesSearch;
    });
  }, [menuItems, selectedCategory, searchQuery]);

  const openAddDialog = () => {
    setIsEditing(false);
    setCurrentItemId(null);
    setItemName('');
    setItemCategory(selectedCategory !== 'All' ? selectedCategory : 'Main Course');
    setItemPrice('');
    setItemAvailable(true);
    setDialogVisible(true);
  };

  const openEditDialog = (item) => {
    setIsEditing(true);
    setCurrentItemId(item.id);
    setItemName(item.name || '');
    setItemCategory(item.category || 'Main Course');
    setItemPrice(String(item.price ?? ''));
    setItemAvailable(item.isAvailable !== false);
    setDialogVisible(true);
  };

  const handleSaveItem = async () => {
    const trimmedName = itemName.trim();
    if (!trimmedName) {
      Alert.alert('Missing Name', 'Please enter a dish name.');
      return;
    }
    const parsedPrice = parseFloat(itemPrice);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      Alert.alert('Invalid Price', 'Please enter a valid price (e.g. 150).');
      return;
    }

    setDialogVisible(false);
    setLoadingMessage(isEditing ? 'Updating dish...' : 'Adding dish to menu...');
    setLoading(true);

    try {
      if (isEditing) {
        const success = await updateMenuItem(currentItemId, {
          name: trimmedName,
          category: itemCategory,
          price: parsedPrice,
          isAvailable: itemAvailable
        });
        if (success) {
          Alert.alert('Success', `Updated "${trimmedName}" to ₹${parsedPrice.toFixed(2)}`);
        } else {
          Alert.alert('Error', 'Failed to update dish.');
        }
      } else {
        const res = await addMenuItem({
          name: trimmedName,
          category: itemCategory,
          price: parsedPrice,
          isAvailable: itemAvailable
        });
        if (res) {
          Alert.alert('Success', `Added "${trimmedName}" (₹${parsedPrice.toFixed(2)}) to menu.`);
        } else {
          Alert.alert('Error', 'Failed to add dish.');
        }
      }
      await fetchMenu(true);
    } catch (err) {
      Alert.alert('Error', 'An error occurred while saving.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteItem = (item) => {
    const doDelete = async () => {
      setLoadingMessage('Deleting dish...');
      setLoading(true);
      try {
        const success = await deleteMenuItem(item.id);
        if (success) {
          await fetchMenu(true);
        } else {
          Alert.alert('Error', 'Failed to delete dish.');
        }
      } finally {
        setLoading(false);
      }
    };

    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(`Are you sure you want to remove "${item.name}" from the menu?`)) {
        doDelete();
      }
      return;
    }

    Alert.alert(
      'Delete Dish',
      `Are you sure you want to remove "${item.name}" from the menu?`,
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

  const toggleAvailability = async (item) => {
    const newStatus = !(item.isAvailable !== false);
    // Optimistic UI update
    setMenuItems(prev => prev.map(i => i.id === item.id ? { ...i, isAvailable: newStatus } : i));
    await updateMenuItem(item.id, { isAvailable: newStatus });
  };

  const renderItemCard = ({ item }) => {
    const isAvailable = item.isAvailable !== false;
    return (
      <Card style={[styles.card, !isAvailable && styles.cardUnavailable]}>
        <Card.Content style={styles.cardContent}>
          <View style={styles.itemInfo}>
            <View style={styles.nameRow}>
              <Text style={[styles.itemName, !isAvailable && styles.textDisabled]}>
                {item.name}
              </Text>
              {!isAvailable && (
                <Chip style={styles.outOfStockBadge} textStyle={styles.outOfStockText}>
                  Sold Out
                </Chip>
              )}
            </View>
            <Text style={styles.itemCategory}>{item.category || 'Dishes'}</Text>
            <Text style={styles.itemPrice}>₹{parseFloat(item.price || 0).toFixed(2)}</Text>
          </View>

          <View style={styles.actionRow}>
            <View style={styles.switchContainer}>
              <Text style={styles.switchLabel}>{isAvailable ? 'In Stock' : 'Out'}</Text>
              <Switch
                value={isAvailable}
                onValueChange={() => toggleAvailability(item)}
                trackColor={{ false: '#BDC3C7', true: '#FFCCBC' }}
                thumbColor={isAvailable ? '#D84315' : '#7F8C8D'}
              />
            </View>
            <IconButton
              icon="pencil"
              size={20}
              iconColor="#2C3E50"
              onPress={() => openEditDialog(item)}
            />
            <IconButton
              icon="trash-can-outline"
              size={20}
              iconColor="#E53935"
              onPress={() => handleDeleteItem(item)}
            />
          </View>
        </Card.Content>
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header Info */}
      <View style={styles.topHeader}>
        <Searchbar
          placeholder="Search menu dishes..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchbar}
          inputStyle={styles.searchInput}
          iconColor="#D84315"
        />
      </View>

      {/* Categories Scroll */}
      <View style={styles.categoryScrollContainer}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryScroll}
        >
          {MENU_CATEGORIES.map(cat => {
            const isSelected = selectedCategory === cat;
            return (
              <Chip
                key={cat}
                selected={isSelected}
                onPress={() => setSelectedCategory(cat)}
                style={[styles.categoryChip, isSelected && styles.categoryChipSelected]}
                textStyle={[styles.categoryChipText, isSelected && styles.categoryChipTextSelected]}
              >
                {cat}
              </Chip>
            );
          })}
        </ScrollView>
      </View>

      {/* Menu List */}
      <FlatList
        data={filteredItems}
        keyExtractor={item => item.id}
        renderItem={renderItemCard}
        contentContainerStyle={[styles.listContainer, { paddingBottom: 90 + insets.bottom }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#D84315']} />
        }
        ListEmptyComponent={
          !loading && (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="silverware-clean" size={54} color="#BDC3C7" />
              <Text style={styles.emptyTitle}>No dishes found</Text>
              <Text style={styles.emptySubtitle}>Tap "+ Add Dish" to add your first menu item</Text>
            </View>
          )
        }
      />

      {/* Floating Add Dish Button */}
      <FAB
        icon="plus"
        label="Add Dish"
        style={[styles.fab, { bottom: 20 + insets.bottom }]}
        color="#FFFFFF"
        onPress={openAddDialog}
      />

      {/* Add / Edit Dish Modal */}
      <Portal>
        <Dialog visible={dialogVisible} onDismiss={() => setDialogVisible(false)} style={styles.dialog}>
          <Dialog.Title style={styles.dialogTitle}>
            {isEditing ? 'Edit Menu Dish' : 'Add New Menu Dish'}
          </Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Dish Name *"
              mode="outlined"
              value={itemName}
              onChangeText={setItemName}
              placeholder="e.g. Chicken Biryani, Butter Naan"
              style={styles.dialogInput}
              outlineColor="#ddd"
              activeOutlineColor="#D84315"
            />

            <TextInput
              label="Fixed Price (₹) *"
              mode="outlined"
              keyboardType="decimal-pad"
              value={itemPrice}
              onChangeText={setItemPrice}
              placeholder="e.g. 180"
              style={styles.dialogInput}
              outlineColor="#ddd"
              activeOutlineColor="#D84315"
              left={<TextInput.Affix text="₹" />}
            />

            <Text style={styles.categoryPickerTitle}>Category:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dialogCategoryRow}>
              {MENU_CATEGORIES.filter(c => c !== 'All').map(cat => (
                <Chip
                  key={cat}
                  selected={itemCategory === cat}
                  onPress={() => setItemCategory(cat)}
                  style={[styles.dialogChip, itemCategory === cat && styles.dialogChipSelected]}
                  textStyle={itemCategory === cat ? styles.dialogChipTextSelected : null}
                >
                  {cat}
                </Chip>
              ))}
            </ScrollView>

            <View style={styles.dialogSwitchRow}>
              <Text style={styles.dialogSwitchText}>Item Available in Stock:</Text>
              <Switch
                value={itemAvailable}
                onValueChange={setItemAvailable}
                trackColor={{ false: '#BDC3C7', true: '#FFCCBC' }}
                thumbColor={itemAvailable ? '#D84315' : '#7F8C8D'}
              />
            </View>
          </Dialog.Content>

          <Dialog.Actions style={styles.dialogActions}>
            <Button onPress={() => setDialogVisible(false)} textColor="#7F8C8D">
              Cancel
            </Button>
            <Button 
              mode="contained" 
              onPress={handleSaveItem} 
              buttonColor="#D84315"
              style={{ borderRadius: 6, marginLeft: 10 }}
            >
              {isEditing ? 'Save Changes' : 'Add to Menu'}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <LoadingOverlay visible={loading} message={loadingMessage} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9F6F0',
  },
  topHeader: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 6,
    backgroundColor: '#FFFFFF',
  },
  searchbar: {
    backgroundColor: '#F1EFEA',
    borderRadius: 10,
    elevation: 0,
    height: 46,
  },
  searchInput: {
    minHeight: 46,
    fontSize: 15,
  },
  categoryScrollContainer: {
    backgroundColor: '#FFFFFF',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EAE5DB',
  },
  categoryScroll: {
    paddingHorizontal: 12,
    gap: 8,
  },
  categoryChip: {
    backgroundColor: '#F3EFEA',
    borderColor: '#E2DBD2',
    borderWidth: 1,
    borderRadius: 20,
  },
  categoryChipSelected: {
    backgroundColor: '#D84315',
  },
  categoryChipText: {
    color: '#4A4A4A',
    fontSize: 13,
    fontWeight: '500',
  },
  categoryChipTextSelected: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  listContainer: {
    padding: 14,
    gap: 10,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    elevation: 2,
    borderLeftWidth: 4,
    borderLeftColor: '#D84315',
  },
  cardUnavailable: {
    borderLeftColor: '#9E9E9E',
    opacity: 0.75,
  },
  cardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  itemInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  itemName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  textDisabled: {
    color: '#7F8C8D',
    textDecorationLine: 'line-through',
  },
  outOfStockBadge: {
    backgroundColor: '#FFEBEE',
    height: 24,
  },
  outOfStockText: {
    color: '#C62828',
    fontSize: 10,
    lineHeight: 12,
  },
  itemCategory: {
    fontSize: 12,
    color: '#7F8C8D',
    marginTop: 2,
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#D84315',
    marginTop: 4,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  switchContainer: {
    alignItems: 'center',
    marginRight: 4,
  },
  switchLabel: {
    fontSize: 10,
    color: '#7F8C8D',
    marginBottom: 2,
  },
  fab: {
    position: 'absolute',
    right: 18,
    backgroundColor: '#D84315',
    borderRadius: 28,
  },
  emptyState: {
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
    textAlign: 'center',
  },
  dialog: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
  },
  dialogTitle: {
    color: '#2C3E50',
    fontWeight: 'bold',
    fontSize: 19,
  },
  dialogInput: {
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
  },
  categoryPickerTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#555',
    marginBottom: 6,
    marginTop: 4,
  },
  dialogCategoryRow: {
    flexDirection: 'row',
    marginBottom: 14,
  },
  dialogChip: {
    marginRight: 6,
    backgroundColor: '#F1EFEA',
  },
  dialogChipSelected: {
    backgroundColor: '#D84315',
  },
  dialogChipTextSelected: {
    color: '#FFFFFF',
  },
  dialogSwitchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#EEE',
  },
  dialogSwitchText: {
    fontSize: 14,
    color: '#2C3E50',
    fontWeight: '500',
  },
  dialogActions: {
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
});
