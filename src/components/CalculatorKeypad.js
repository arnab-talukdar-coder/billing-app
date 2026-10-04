import React from 'react';
import { View, StyleSheet, TouchableOpacity, useWindowDimensions } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const CalculatorKeypad = ({ onKeyPress, onBackspace, onClear }) => {
  const { width, height } = useWindowDimensions();
  // Tablet detection: check if the smallest screen dimension is at least 600dp
  const isTablet = Math.min(width, height) >= 600;

  const keyHeight = isTablet ? 72 : 38;
  const keyTextSize = isTablet ? 30 : 20;
  const operatorTextSize = isTablet ? 32 : 22;
  const backspaceIconSize = isTablet ? 34 : 24;

  const keys = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['0', '+', '-'],
    ['%', 'C', '⌫']
  ];

  const handlePress = (key) => {
    if (key === 'C') {
      onClear();
    } else if (key === '⌫') {
      onBackspace();
    } else {
      onKeyPress(key);
    }
  };

  return (
    <View style={styles.container}>
      {keys.map((row, rowIndex) => (
        <View key={rowIndex} style={[styles.row, { marginBottom: isTablet ? 12 : 6 }]}>
          {row.map((key) => (
            <TouchableOpacity
              key={key}
              style={[
                styles.key,
                { height: keyHeight },
                (key === '+' || key === '-' || key === '%') && styles.operatorKey,
                key === 'C' && styles.clearKey,
                key === '⌫' && styles.backspaceKey
              ]}
              onPress={() => handlePress(key)}
            >
              {key === '⌫' ? (
                <MaterialCommunityIcons name="backspace-outline" size={backspaceIconSize} color="#E41E3F" />
              ) : (
                <Text
                  style={[
                    styles.keyText,
                    (key === '+' || key === '-' || key === '%') && styles.operatorText,
                    key === 'C' && styles.clearText,
                    { fontSize: (key === '+' || key === '-' || key === '%') ? operatorTextSize : keyTextSize }
                  ]}
                >
                  {key}
                </Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 8,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    marginTop: 10,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  key: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 4,
    borderRadius: 8,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
  operatorKey: {
    backgroundColor: '#E7F3FF',
  },
  clearKey: {
    backgroundColor: '#FFF0F0',
  },
  backspaceKey: {
    backgroundColor: '#FFF0F0',
  },
  keyText: {
    fontWeight: '600',
    color: '#050505',
  },
  operatorText: {
    color: '#1877F2',
  },
  clearText: {
    color: '#E41E3F',
  },
});

export default CalculatorKeypad;
