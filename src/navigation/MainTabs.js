import React, { useState } from 'react';
import { Alert } from 'react-native';
import { IconButton, Portal, Dialog, Button, Text } from 'react-native-paper';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, CommonActions } from '@react-navigation/native';

import BillScreen from '../screens/BillScreen';
import MenuScreen from '../screens/MenuScreen';
import ReturnsScreen from '../screens/ReturnsScreen';
import ReportsScreen from '../screens/ReportsScreen';

const Tab = createBottomTabNavigator();

export default function MainTabs() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute();

  const userRole = route?.params?.userRole ?? 'admin';
  const userPhone = route?.params?.userPhone ?? '';

  const showReports = userRole === 'admin';

  const [logoutDialogVisible, setLogoutDialogVisible] = useState(false);

  return (
    <>
      <Tab.Navigator
        screenOptions={({ route: tabRoute }) => ({
          tabBarIcon: ({ focused, color, size }) => {
            let iconName;
            if (tabRoute.name === 'POS') {
              iconName = focused ? 'silverware-fork-knife' : 'silverware-fork-knife';
            } else if (tabRoute.name === 'Menu') {
              iconName = focused ? 'book-open-page-variant' : 'book-open-page-variant-outline';
            } else if (tabRoute.name === 'Orders') {
              iconName = focused ? 'receipt-text' : 'receipt-text-outline';
            } else if (tabRoute.name === 'Reports') {
              iconName = focused ? 'chart-bar' : 'chart-bar';
            }
            return <MaterialCommunityIcons name={iconName} size={size} color={color} />;
          },
          tabBarActiveTintColor: '#D84315',
          tabBarInactiveTintColor: '#8E8E93',
          headerStyle: { backgroundColor: '#D84315' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: 'bold' },
          headerRight: () => (
            <IconButton 
              icon="logout" 
              iconColor="#fff" 
              onPress={() => setLogoutDialogVisible(true)} 
            />
          ),
          tabBarStyle: {
            backgroundColor: '#FFFFFF',
            borderTopWidth: 1,
            borderTopColor: '#EAE5DB',
            height: 60 + insets.bottom,
            paddingBottom: Math.max(5, insets.bottom),
            paddingTop: 5,
          },
          tabBarHideOnKeyboard: false,
        })}
      >
        <Tab.Screen 
          name="POS" 
          component={BillScreen} 
          options={{ title: 'মন মানে না POS' }} 
          initialParams={{ userRole, userPhone }}
        />
        <Tab.Screen 
          name="Menu" 
          component={MenuScreen} 
          options={{ title: 'Menu & Prices' }} 
          initialParams={{ userRole, userPhone }}
        />
        <Tab.Screen 
          name="Orders" 
          component={ReturnsScreen} 
          options={{ title: 'Order History' }} 
          initialParams={{ userRole, userPhone }}
        />
        {showReports && (
          <Tab.Screen 
            name="Reports" 
            component={ReportsScreen} 
            options={{ title: 'Sales Analytics' }} 
            initialParams={{ userRole, userPhone }}
          />
        )}
      </Tab.Navigator>

      <Portal>
        <Dialog 
          visible={logoutDialogVisible} 
          onDismiss={() => setLogoutDialogVisible(false)} 
          style={{ backgroundColor: '#fff', borderRadius: 12 }}
        >
          <Dialog.Title style={{ color: '#2C3E50', fontSize: 19, fontWeight: 'bold' }}>
            Logout from POS
          </Dialog.Title>
          <Dialog.Content>
            <Text style={{ color: '#65676B', fontSize: 15 }}>Are you sure you want to log out?</Text>
          </Dialog.Content>
          <Dialog.Actions style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
            <Button mode="text" onPress={() => setLogoutDialogVisible(false)} textColor="#65676B">
              Cancel
            </Button>
            <Button 
              mode="contained" 
              onPress={async () => {
                setLogoutDialogVisible(false);
                try {
                  await AsyncStorage.removeItem('userRole');
                  await AsyncStorage.removeItem('userPhone');
                } catch (e) {
                  console.error('Failed to clear login state', e);
                }
                navigation.dispatch(
                  CommonActions.reset({
                    index: 0,
                    routes: [{ name: 'Login' }],
                  })
                );
              }} 
              buttonColor="#D84315" 
              style={{ borderRadius: 6, marginLeft: 10 }}
            >
              Logout
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </>
  );
}
