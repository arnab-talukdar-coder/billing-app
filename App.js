import React, { useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Provider as PaperProvider, MD3LightTheme } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import LoginScreen from './src/screens/LoginScreen';
import MainTabs from './src/navigation/MainTabs';

const Stack = createNativeStackNavigator();

// Restaurant theme colors for Paper
const theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#D84315',
    secondary: '#E65100',
    background: '#F9F6F0',
    surface: '#FFFFFF',
  },
};

export default function App() {
  const [initialRoute, setInitialRoute] = useState(null);
  const [authData, setAuthData] = useState(null);

  React.useEffect(() => {
    async function checkLogin() {
      try {
        const role = await AsyncStorage.getItem('userRole');
        const phone = await AsyncStorage.getItem('userPhone');
        if (role && phone) {
          setAuthData({ role, phone });
          setInitialRoute('MainApp');
        } else {
          setInitialRoute('Login');
        }
      } catch (e) {
        setInitialRoute('Login');
      }
    }
    checkLogin();
  }, []);

  if (!initialRoute) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9F6F0' }}>
        <ActivityIndicator size="large" color="#D84315" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <PaperProvider theme={theme}>
        <NavigationContainer>
          <Stack.Navigator 
            initialRouteName={initialRoute}
            screenOptions={{ headerShown: false }}
          >
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen 
              name="MainApp" 
              component={MainTabs} 
              initialParams={authData ? { userRole: authData.role, userPhone: authData.phone } : undefined}
            />
          </Stack.Navigator>
        </NavigationContainer>
      </PaperProvider>
    </SafeAreaProvider>
  );
}
