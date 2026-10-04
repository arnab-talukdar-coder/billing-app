import React, { useState } from 'react';
import { View, StyleSheet, Alert, Image, Text, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { TextInput, Button } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Registered users: phone -> { password, role }
// role 'admin'  => all tabs visible
// role 'staff'  => Reports (Revenue) tab hidden
const REGISTERED_USERS = {
  '7003420428': { password: '1234', role: 'admin' },
  '7278006260': { password: '11199', role: 'admin' },
  '7439002589': { password: '12345', role: 'staff' },
  '9051732527': { password: '2026', role: 'staff' },
  '9123351850': { password: '2026', role: 'staff' },
  '8240185094': { password: '5094', role: 'admin' }, // owner
};

export default function LoginScreen({ navigation }) {
  const [phone, setPhone] = useState('');
  const [pin, setPin]     = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    const trimmedPhone = phone.trim();
    const user = REGISTERED_USERS[trimmedPhone];

    if (!user) {
      Alert.alert('Error', 'Phone number not registered. Please use a registered number.');
      return;
    }

    if (pin !== user.password) {
      Alert.alert('Error', 'Invalid PIN. Please try again.');
      return;
    }

    setLoading(true);
    
    try {
      await AsyncStorage.setItem('userRole', user.role);
      await AsyncStorage.setItem('userPhone', trimmedPhone);
    } catch (e) {
      console.error('Failed to save login state', e);
    }
    
    // Navigate and pass the user role so downstream screens can adapt
    navigation.replace('MainApp', { userRole: user.role, userPhone: trimmedPhone });
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.container}>
          <View style={styles.card}>
            <View style={styles.headerContainer}>
              <Image
                source={require('../../assets/logo.png')}
                style={styles.logoImage}
                resizeMode="cover"
              />
              <Text style={styles.bengaliName}>মন মানে না</Text>
              <Text style={styles.shopName}>Mon Mane Na</Text>
              <Text style={styles.tagline}>Restaurant & Café Billing</Text>
            </View>

            <TextInput
              label="Registered Phone Number"
              mode="outlined"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
              style={styles.input}
              outlineColor="#ddd"
              activeOutlineColor="#D84315"
              left={<TextInput.Icon icon="phone" color="#D84315" />}
              maxLength={10}
            />

            <TextInput
              label="Password (PIN)"
              mode="outlined"
              keyboardType="numeric"
              secureTextEntry
              value={pin}
              onChangeText={setPin}
              style={styles.input}
              outlineColor="#ddd"
              activeOutlineColor="#D84315"
              left={<TextInput.Icon icon="lock" color="#D84315" />}
            />

            <Button
              mode="contained"
              onPress={handleLogin}
              style={styles.button}
              contentStyle={styles.buttonContent}
              labelStyle={styles.buttonLabel}
              loading={loading}
              disabled={loading}
              icon="silverware-fork-knife"
            >
              Enter Restaurant POS
            </Button>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
  },
  container: {
    flex: 1,
    backgroundColor: '#F9F6F0',
    justifyContent: 'center',
    padding: 20,
    minHeight: '100%',
  },
  card: {
    backgroundColor: '#FFFFFF',
    padding: 26,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 5,
    alignItems: 'center',
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoImage: {
    width: 96,
    height: 96,
    borderRadius: 48,
    marginBottom: 14,
    borderWidth: 2,
    borderColor: '#FFCCBC',
  },
  bengaliName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#D84315',
    marginBottom: 2,
    textAlign: 'center',
  },
  shopName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#2C3E50',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  tagline: {
    fontSize: 13,
    color: '#7F8C8D',
    marginTop: 4,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  input: {
    width: '100%',
    marginBottom: 14,
    backgroundColor: '#fff',
  },
  button: {
    width: '100%',
    borderRadius: 8,
    backgroundColor: '#D84315',
    marginTop: 10,
  },
  buttonContent: {
    height: 52,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: 'bold',
  },
});
