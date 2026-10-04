import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const ReceiptTemplate = React.forwardRef(({ billDetails }, ref) => {
  if (!billDetails) return null;

  const {
    billNo,
    date,
    time,
    orderType = 'Dine-In',
    tableNo = 'N/A',
    customerName,
    phone,
    items = [],
    totalOriginalMrp,
    subtotalAfterItemDiscounts,
    discountType,
    discountValue,
    overallDiscountAmount,
    finalAmount,
    totalBaseMrp,
    paymentMode = 'Cash'
  } = billDetails;

  const safeSubtotal = parseFloat(subtotalAfterItemDiscounts !== undefined ? subtotalAfterItemDiscounts : (totalOriginalMrp || totalBaseMrp || 0));
  const safeOverallDiscount = parseFloat(overallDiscountAmount || 0);
  const safeFinalAmount = parseFloat(finalAmount || 0);

  const discountText = discountType === 'flat' ? `₹${discountValue}` : `${discountValue}%`;

  return (
    <View ref={ref} style={styles.container} collapsable={false}>
      <View style={styles.content}>
        {/* Restaurant Header */}
        <View style={styles.headerBox}>
          <Text style={styles.restaurantName}>MON MANE NA RESTAURANT & CAFÉ</Text>
          <Text style={styles.subHeader}>Food & Dining Experience</Text>
          <Text style={styles.subHeader}>Contact: 8240185094</Text>
        </View>

        <View style={styles.divider} />

        {/* Order Details */}
        <View style={styles.row}>
          <Text style={styles.text}>Bill No: <Text style={styles.bold}>{billNo}</Text></Text>
          <Text style={styles.text}>Date: {date} {time ? `| ${time}` : ''}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.text}>Order: <Text style={styles.bold}>{orderType}</Text></Text>
          {orderType === 'Dine-In' && tableNo !== 'N/A' && (
            <Text style={styles.text}>Table: <Text style={styles.bold}>{tableNo}</Text></Text>
          )}
          <Text style={styles.text}>Pay: {paymentMode}</Text>
        </View>
        {customerName && customerName !== 'Guest' && (
          <View style={styles.row}>
            <Text style={styles.text}>Customer: {customerName} {phone ? `(${phone})` : ''}</Text>
          </View>
        )}

        {/* Items Table */}
        <View style={styles.tableHeader}>
          <Text style={[styles.cell, styles.bold, { flex: 0.8 }]}>#</Text>
          <Text style={[styles.cell, styles.bold, { flex: 3.2 }]}>Item</Text>
          <Text style={[styles.cell, styles.bold, { flex: 1.8, textAlign: 'right' }]}>Rate</Text>
          <Text style={[styles.cell, styles.bold, { flex: 1.2, textAlign: 'center' }]}>Qty</Text>
          <Text style={[styles.cell, styles.bold, { flex: 2.0, textAlign: 'right' }]}>Total</Text>
        </View>

        {items.map((item, index) => {
          const qty = parseInt(item.quantity, 10) || 1;
          const rate = parseFloat(item.mrp || item.price || 0);
          const total = rate * qty;
          return (
            <View key={index} style={styles.tableRow}>
              <Text style={[styles.cell, { flex: 0.8 }]}>{index + 1}</Text>
              <Text style={[styles.cell, { flex: 3.2 }]} numberOfLines={1}>{item.name}</Text>
              <Text style={[styles.cell, { flex: 1.8, textAlign: 'right' }]}>₹{rate.toFixed(2)}</Text>
              <Text style={[styles.cell, { flex: 1.2, textAlign: 'center' }]}>{qty}</Text>
              <Text style={[styles.cell, { flex: 2.0, textAlign: 'right' }]}>₹{total.toFixed(2)}</Text>
            </View>
          );
        })}

        {/* Totals Box */}
        <View style={styles.totalSection}>
          <View style={styles.row}>
            <Text style={styles.text}>Subtotal:</Text>
            <Text style={styles.text}>₹{safeSubtotal.toFixed(2)}</Text>
          </View>
          {safeOverallDiscount > 0 && (
            <View style={styles.row}>
              <Text style={styles.text}>Discount ({discountText}):</Text>
              <Text style={styles.text}>-₹{safeOverallDiscount.toFixed(2)}</Text>
            </View>
          )}
          <View style={[styles.row, styles.finalAmountRow]}>
            <Text style={styles.finalText}>Net Total:</Text>
            <Text style={styles.finalText}>₹{safeFinalAmount.toFixed(2)}</Text>
          </View>
        </View>

        {/* Restaurant Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerGreeting}>Thank you for dining with us!</Text>
          <Text style={styles.footerSub}>Please visit again!</Text>
          <Text style={[styles.footerSub, { marginTop: 4 }]}>We take bookings for birthdays and all occasions.</Text>
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    width: 576,
    backgroundColor: '#FFFFFF',
    padding: 16,
  },
  content: {
    width: '100%',
  },
  headerBox: {
    alignItems: 'center',
    marginBottom: 8,
  },
  bengaliTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#D84315',
    textAlign: 'center',
  },
  restaurantName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2C3E50',
    letterSpacing: 1,
    textAlign: 'center',
    marginTop: 2,
  },
  subHeader: {
    fontSize: 11,
    color: '#555',
    textAlign: 'center',
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#000',
    marginVertical: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  text: {
    fontSize: 12,
    color: '#000',
  },
  bold: {
    fontWeight: 'bold',
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#000',
    paddingVertical: 5,
    marginTop: 6,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#DDD',
    paddingVertical: 4,
  },
  cell: {
    fontSize: 12,
    color: '#000',
  },
  totalSection: {
    marginTop: 8,
    borderTopWidth: 1.5,
    borderTopColor: '#000',
    paddingTop: 6,
  },
  finalAmountRow: {
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#000',
    paddingTop: 6,
  },
  finalText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
  },
  footer: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#DDD',
    paddingTop: 8,
    alignItems: 'center',
  },
  footerGreeting: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#D84315',
    textAlign: 'center',
  },
  footerSub: {
    fontSize: 10,
    color: '#555',
    textAlign: 'center',
    marginTop: 2,
  },
});

export default ReceiptTemplate;
