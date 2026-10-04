import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Alert,
  TouchableOpacity,
  Platform
} from 'react-native';
import { Text, Card, Divider, Button, Chip, Badge } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { getAllBills } from '../services/db';
import LoadingOverlay from '../components/LoadingOverlay';

export default function ReportsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  // Time filters: 'day', 'week', 'month', 'all'
  const [timeFilter, setTimeFilter] = useState('day');
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Loading reports...');

  const [stats, setStats] = useState({
    dayRevenue: 0,
    weekRevenue: 0,
    monthRevenue: 0,
    allRevenue: 0,
    dayOrders: 0,
    weekOrders: 0,
    monthOrders: 0,
    allOrders: 0,
    dayDishes: 0,
    weekDishes: 0,
    monthDishes: 0,
    allDishes: 0,
  });

  const [dailyStats, setDailyStats] = useState([]);
  const [dishStats, setDishStats] = useState([]);
  const [categoryStats, setCategoryStats] = useState([]);
  const [paymentStats, setPaymentStats] = useState({ cash: 0, upi: 0, card: 0 });

  const calculateStats = useCallback(async () => {
    setLoadingMessage('Crunching revenue & sales analytics...');
    setLoading(true);
    try {
      const bills = await getAllBills(true);

      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      startOfToday.setHours(0, 0, 0, 0);

      // Last 7 days including today
      const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
      startOfWeek.setHours(0, 0, 0, 0);

      // Start of current month
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      startOfMonth.setHours(0, 0, 0, 0);

      let dayRev = 0, weekRev = 0, monthRev = 0, allRev = 0;
      let dayOrd = 0, weekOrd = 0, monthOrd = 0, allOrd = 0;
      let dayDish = 0, weekDish = 0, monthDish = 0, allDish = 0;

      const dishesMap = {};
      const catMap = {};
      const payMap = { cash: 0, upi: 0, card: 0 };
      const dailyMap = {};

      bills.forEach(bill => {
        // Parse bill date reliably
        let billDate = null;
        if (bill.createdAt) {
          const d = new Date(bill.createdAt);
          if (!isNaN(d.getTime())) billDate = d;
        }
        if (!billDate && bill.date) {
          const parts = bill.date.split('/');
          if (parts.length === 3) {
            const d = parseInt(parts[0], 10);
            const m = parseInt(parts[1], 10) - 1;
            const y = parseInt(parts[2], 10);
            const parsed = new Date(y, m, d);
            if (!isNaN(parsed.getTime())) billDate = parsed;
          }
        }
        if (!billDate) billDate = new Date();

        const amt = parseFloat(bill.finalAmount !== undefined ? bill.finalAmount : (bill.totalAmount || 0));
        const dateKey = bill.date || `${String(billDate.getDate()).padStart(2, '0')}/${String(billDate.getMonth() + 1).padStart(2, '0')}/${billDate.getFullYear()}`;

        // Count dishes
        let billDishesCount = 0;
        if (Array.isArray(bill.items)) {
          bill.items.forEach(i => {
            billDishesCount += (parseInt(i.quantity, 10) || 1);
          });
        }

        // Check periods
        const isToday = billDate >= startOfToday;
        const isThisWeek = billDate >= startOfWeek;
        const isThisMonth = billDate >= startOfMonth;

        allRev += amt;
        allOrd += 1;
        allDish += billDishesCount;

        if (isThisMonth) {
          monthRev += amt;
          monthOrd += 1;
          monthDish += billDishesCount;
        }
        if (isThisWeek) {
          weekRev += amt;
          weekOrd += 1;
          weekDish += billDishesCount;
        }
        if (isToday) {
          dayRev += amt;
          dayOrd += 1;
          dayDish += billDishesCount;
        }

        // Active filter match
        const matchesFilter =
          timeFilter === 'all' ||
          (timeFilter === 'day' && isToday) ||
          (timeFilter === 'week' && isThisWeek) ||
          (timeFilter === 'month' && isThisMonth);

        if (matchesFilter) {
          // Payment mode split
          const pMode = (bill.paymentMode || 'Cash').toLowerCase();
          if (pMode.includes('upi')) payMap.upi += amt;
          else if (pMode.includes('card')) payMap.card += amt;
          else payMap.cash += amt;

          // Daily revenue map
          if (!dailyMap[dateKey]) {
            dailyMap[dateKey] = { date: dateKey, orders: 0, revenue: 0, dishes: 0, rawDate: billDate };
          }
          dailyMap[dateKey].orders += 1;
          dailyMap[dateKey].revenue += amt;
          dailyMap[dateKey].dishes += billDishesCount;

          // Dishes
          if (Array.isArray(bill.items)) {
            bill.items.forEach(item => {
              const qty = parseInt(item.quantity, 10) || 1;
              const price = parseFloat(item.mrp || item.price || 0);
              const lineTotal = price * qty;
              const name = (item.name || 'Other').trim();

              if (!dishesMap[name]) {
                dishesMap[name] = { name, count: 0, revenue: 0, category: item.category || 'General' };
              }
              dishesMap[name].count += qty;
              dishesMap[name].revenue += lineTotal;

              const cat = item.category || 'General';
              if (!catMap[cat]) {
                catMap[cat] = { category: cat, count: 0, revenue: 0 };
              }
              catMap[cat].count += qty;
              catMap[cat].revenue += lineTotal;
            });
          }
        }
      });

      setStats({
        dayRevenue: dayRev,
        weekRevenue: weekRev,
        monthRevenue: monthRev,
        allRevenue: allRev,
        dayOrders: dayOrd,
        weekOrders: weekOrd,
        monthOrders: monthOrd,
        allOrders: allOrd,
        dayDishes: dayDish,
        weekDishes: weekDish,
        monthDishes: monthDish,
        allDishes: allDish,
      });

      const sortedDaily = Object.values(dailyMap).sort((a, b) => {
        return (b.rawDate || 0) - (a.rawDate || 0);
      });
      setDailyStats(sortedDaily);

      const sortedDishes = Object.values(dishesMap).sort((a, b) => b.revenue - a.revenue);
      setDishStats(sortedDishes);

      const sortedCats = Object.values(catMap).sort((a, b) => b.revenue - a.revenue);
      setCategoryStats(sortedCats);

      setPaymentStats(payMap);
    } catch (e) {
      console.error('calculateStats error:', e);
    } finally {
      setLoading(false);
    }
  }, [timeFilter]);

  useEffect(() => {
    calculateStats();
  }, [calculateStats]);

  useEffect(() => {
    const unsubscribe = navigation?.addListener?.('focus', () => {
      calculateStats();
    });
    return unsubscribe;
  }, [navigation, calculateStats]);

  const activeRevenue =
    timeFilter === 'day' ? stats.dayRevenue :
      timeFilter === 'week' ? stats.weekRevenue :
        timeFilter === 'month' ? stats.monthRevenue : stats.allRevenue;

  const activeOrders =
    timeFilter === 'day' ? stats.dayOrders :
      timeFilter === 'week' ? stats.weekOrders :
        timeFilter === 'month' ? stats.monthOrders : stats.allOrders;

  const activeDishes =
    timeFilter === 'day' ? stats.dayDishes :
      timeFilter === 'week' ? stats.weekDishes :
        timeFilter === 'month' ? stats.monthDishes : stats.allDishes;

  const activeAov = activeOrders > 0 ? (activeRevenue / activeOrders) : 0;

  const filterPeriodLabel =
    timeFilter === 'day' ? "Day (Today)" :
      timeFilter === 'week' ? "Week (Last 7 Days)" :
        timeFilter === 'month' ? "Month (This Month)" : "All Time";

  // Generate Styled A4 PDF / Print Document
  const generateReportHtml = () => {
    const totalPay = paymentStats.cash + paymentStats.upi + paymentStats.card;
    const cashPct = totalPay > 0 ? ((paymentStats.cash / totalPay) * 100).toFixed(1) : '0.0';
    const upiPct = totalPay > 0 ? ((paymentStats.upi / totalPay) * 100).toFixed(1) : '0.0';
    const cardPct = totalPay > 0 ? ((paymentStats.card / totalPay) * 100).toFixed(1) : '0.0';

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Mon Mane Na - ${filterPeriodLabel} Revenue Report</title>
          <style>
            @page { margin: 12mm; size: A4 portrait; }
            body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #2C3E50; margin: 0; padding: 12px; }
            .header-table { width: 100%; border-bottom: 3px solid #D84315; padding-bottom: 12px; margin-bottom: 18px; }
            .logo-title { font-size: 26px; font-weight: 900; color: #D84315; margin: 0; }
            .logo-sub { font-size: 13px; color: #7F8C8D; margin-top: 3px; }
            .badge { background: #D84315; color: #FFF; padding: 6px 14px; border-radius: 6px; font-size: 13px; font-weight: bold; text-align: right; display: inline-block; }
            
            .kpi-container { display: flex; justify-content: space-between; gap: 10px; margin-bottom: 20px; }
            .kpi-box { flex: 1; border: 1px solid #EAE5DB; border-radius: 8px; padding: 12px; background: #FAF9F6; text-align: center; }
            .kpi-label { font-size: 11px; text-transform: uppercase; color: #7F8C8D; font-weight: bold; letter-spacing: 0.5px; }
            .kpi-val { font-size: 22px; font-weight: 900; color: #D84315; margin-top: 4px; }
            .kpi-sub { font-size: 11px; color: #95A5A6; margin-top: 2px; }

            .section-title { font-size: 15px; font-weight: bold; color: #2C3E50; border-left: 4px solid #D84315; padding-left: 8px; margin: 20px 0 10px 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 12px; }
            th { background: #F2EFE9; color: #2C3E50; padding: 8px; text-align: left; font-weight: bold; border-bottom: 2px solid #DDD; }
            td { padding: 8px; border-bottom: 1px solid #EEE; }
            tr:nth-child(even) { background-color: #FAFAFA; }

            .pay-bar-container { display: flex; gap: 10px; margin-top: 8px; }
            .pay-pill { flex: 1; padding: 10px; border-radius: 6px; border: 1px solid #DDD; background: #FFF; }
            .footer { margin-top: 28px; border-top: 1px solid #EAE5DB; padding-top: 12px; font-size: 10px; color: #95A5A6; text-align: center; }
          </style>
        </head>
        <body>
          <table class="header-table">
            <tr>
              <td>
                <h1 class="logo-title">মন মানে না</h1>
                <div class="logo-sub">MON MANE NA RESTAURANT POS • SALES & REVENUE REPORT</div>
                <div style="font-size: 11px; color: #888; margin-top: 4px;">Phone: 8240185094 • Naihati</div>
              </td>
              <td style="text-align: right; vertical-align: top;">
                <div class="badge">${filterPeriodLabel}</div>
                <div style="font-size: 11px; color: #7F8C8D; margin-top: 6px;">Date: ${new Date().toLocaleDateString('en-GB')} • ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
              </td>
            </tr>
          </table>

          {/* Revenue KPI Summary */}
          <div class="kpi-container">
            <div class="kpi-box" style="border-top: 4px solid #D84315;">
              <div class="kpi-label">Gross Revenue</div>
              <div class="kpi-val">₹${activeRevenue.toFixed(2)}</div>
              <div class="kpi-sub">${filterPeriodLabel}</div>
            </div>
            <div class="kpi-box" style="border-top: 4px solid #2E7D32;">
              <div class="kpi-label">Orders Settled</div>
              <div class="kpi-val" style="color: #2E7D32;">${activeOrders}</div>
              <div class="kpi-sub">Total bills</div>
            </div>
            <div class="kpi-box" style="border-top: 4px solid #1976D2;">
              <div class="kpi-label">Dishes Sold</div>
              <div class="kpi-val" style="color: #1976D2;">${activeDishes}</div>
              <div class="kpi-sub">Units prepared</div>
            </div>
            <div class="kpi-box" style="border-top: 4px solid #F57C00;">
              <div class="kpi-label">Avg Order Value</div>
              <div class="kpi-val" style="color: #F57C00;">₹${activeAov.toFixed(2)}</div>
              <div class="kpi-sub">AOV per bill</div>
            </div>
          </div>

          {/* Payment Mode Collection */}
          <div class="section-title">Payment Methods Breakdown</div>
          <div class="pay-bar-container">
            <div class="pay-pill" style="border-left: 4px solid #2E7D32;">
              <div style="font-weight: bold; color: #2E7D32;">Cash Collection</div>
              <div style="font-size: 16px; font-weight: 900; margin: 4px 0;">₹${paymentStats.cash.toFixed(2)}</div>
              <div style="font-size: 11px; color: #666;">${cashPct}% of total collections</div>
            </div>
            <div class="pay-pill" style="border-left: 4px solid #1976D2;">
              <div style="font-weight: bold; color: #1976D2;">UPI / QR Collection</div>
              <div style="font-size: 16px; font-weight: 900; margin: 4px 0;">₹${paymentStats.upi.toFixed(2)}</div>
              <div style="font-size: 11px; color: #666;">${upiPct}% of total collections</div>
            </div>
            <div class="pay-pill" style="border-left: 4px solid #E65100;">
              <div style="font-weight: bold; color: #E65100;">Card Collection</div>
              <div style="font-size: 16px; font-weight: 900; margin: 4px 0;">₹${paymentStats.card.toFixed(2)}</div>
              <div style="font-size: 11px; color: #666;">${cardPct}% of total collections</div>
            </div>
          </div>

          ${dailyStats.length > 0 ? `
          <div class="section-title">Daily Revenue Summary</div>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th style="text-align: center;">Bills Count</th>
                <th style="text-align: center;">Dishes Sold</th>
                <th style="text-align: right;">Total Revenue</th>
              </tr>
            </thead>
            <tbody>
              ${dailyStats.map(d => `
                <tr>
                  <td style="font-weight: bold;">${d.date}</td>
                  <td style="text-align: center;">${d.orders}</td>
                  <td style="text-align: center;">${d.dishes}</td>
                  <td style="text-align: right; font-weight: bold; color: #D84315;">₹${d.revenue.toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          ` : ''}

          <div class="section-title">Top Selling Dishes</div>
          <table>
            <thead>
              <tr>
                <th style="width: 8%;">#</th>
                <th style="width: 46%;">Dish Name</th>
                <th style="width: 20%;">Category</th>
                <th style="width: 11%; text-align: center;">Qty</th>
                <th style="width: 15%; text-align: right;">Revenue</th>
              </tr>
            </thead>
            <tbody>
              ${dishStats.slice(0, 15).map((dish, idx) => `
                <tr>
                  <td>#${idx + 1}</td>
                  <td style="font-weight: bold;">${dish.name}</td>
                  <td>${dish.category}</td>
                  <td style="text-align: center;">${dish.count}</td>
                  <td style="text-align: right; font-weight: bold;">₹${dish.revenue.toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="footer">
            <div>Mon Mane Na Restaurant POS System • Confidential Management Report</div>
          </div>
        </body>
      </html>
    `;
  };

  // Export as PDF Option
  const handleExportPdf = async () => {
    setLoadingMessage('Generating PDF Report...');
    setLoading(true);
    try {
      const html = generateReportHtml();

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
        }, 100);
      } else {
        const { uri } = await Print.printToFileAsync({ html });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, {
            UTI: '.pdf',
            mimeType: 'application/pdf',
            dialogTitle: `Export ${filterPeriodLabel} Revenue Report`
          });
        } else {
          await Print.printAsync({ html });
        }
      }
    } catch (e) {
      console.error('Export PDF error:', e);
      Alert.alert('Error', 'Failed to generate PDF report.');
    } finally {
      setLoading(false);
    }
  };

  // Direct Print Option
  const handlePrintReport = async () => {
    const html = generateReportHtml();
    if (Platform.OS === 'web') {
      handleExportPdf();
    } else {
      await Print.printAsync({ html });
    }
  };

  return (
    <View style={styles.container}>
      <LoadingOverlay visible={loading} message={loadingMessage} />

      {/* Time Filters Header */}
      <View style={styles.filterHeader}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
          {[
            { id: 'day', label: 'Day', icon: 'calendar-today' },
            { id: 'week', label: 'Week', icon: 'calendar-week' },
            { id: 'month', label: 'Month', icon: 'calendar-month' },
            { id: 'all', label: 'All Time', icon: 'calendar-range' },
          ].map(f => (
            <Chip
              key={f.id}
              selected={timeFilter === f.id}
              onPress={() => setTimeFilter(f.id)}
              style={[styles.filterChip, timeFilter === f.id && styles.filterChipSelected]}
              textStyle={[styles.filterChipText, timeFilter === f.id && styles.filterChipTextSelected]}
              icon={f.icon}
            >
              {f.label}
            </Chip>
          ))}
        </ScrollView>

        {/* Action Buttons: Export PDF & Print */}
        <View style={styles.headerActionBtns}>
          <TouchableOpacity onPress={handleExportPdf} style={styles.exportPdfBtn}>
            <MaterialCommunityIcons name="file-pdf-box" size={17} color="#FFF" />
            <Text style={styles.exportPdfBtnText}>Export PDF</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={handlePrintReport} style={styles.printReportBtn}>
            <MaterialCommunityIcons name="printer" size={16} color="#D84315" />
            <Text style={styles.printReportText}>Print</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.mainScroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 80 + insets.bottom }]}
      >
        {/* Main Revenue Card */}
        <Card style={styles.heroCard}>
          <Card.Content style={styles.heroContent}>
            <View style={styles.heroBadgeRow}>
              <Badge style={{ backgroundColor: 'rgba(255,255,255,0.25)', color: '#FFF', fontWeight: 'bold' }}>
                {filterPeriodLabel.toUpperCase()}
              </Badge>
            </View>
            <Text style={styles.heroSubtitle}>TOTAL REVENUE</Text>
            <Text style={styles.heroAmount}>₹{activeRevenue.toFixed(2)}</Text>

            <Divider style={styles.heroDivider} />

            <View style={styles.heroStatsRow}>
              <View style={styles.heroStat}>
                <MaterialCommunityIcons name="receipt" size={18} color="#FFF" />
                <Text style={styles.heroStatNum}>{activeOrders}</Text>
                <Text style={styles.heroStatLabel}>Orders</Text>
              </View>
              <View style={styles.statSeparator} />
              <View style={styles.heroStat}>
                <MaterialCommunityIcons name="food" size={18} color="#FFF" />
                <Text style={styles.heroStatNum}>{activeDishes}</Text>
                <Text style={styles.heroStatLabel}>Dishes Sold</Text>
              </View>
              <View style={styles.statSeparator} />
              <View style={styles.heroStat}>
                <MaterialCommunityIcons name="calculator" size={18} color="#FFF" />
                <Text style={styles.heroStatNum}>₹{activeAov.toFixed(0)}</Text>
                <Text style={styles.heroStatLabel}>Avg / Order</Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Payment Breakdown Card */}
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.cardSectionTitle}>Payment Methods Breakdown</Text>
            <View style={styles.payGrid}>
              <View style={[styles.payCard, { borderLeftColor: '#2E7D32' }]}>
                <Text style={styles.payLabel}>Cash</Text>
                <Text style={styles.payAmount}>₹{paymentStats.cash.toFixed(2)}</Text>
                <Text style={styles.paySub}>
                  {activeRevenue > 0 ? `${((paymentStats.cash / activeRevenue) * 100).toFixed(0)}%` : '0%'}
                </Text>
              </View>
              <View style={[styles.payCard, { borderLeftColor: '#1976D2' }]}>
                <Text style={styles.payLabel}>UPI / QR</Text>
                <Text style={styles.payAmount}>₹{paymentStats.upi.toFixed(2)}</Text>
                <Text style={styles.paySub}>
                  {activeRevenue > 0 ? `${((paymentStats.upi / activeRevenue) * 100).toFixed(0)}%` : '0%'}
                </Text>
              </View>
              <View style={[styles.payCard, { borderLeftColor: '#E65100' }]}>
                <Text style={styles.payLabel}>Card</Text>
                <Text style={styles.payAmount}>₹{paymentStats.card.toFixed(2)}</Text>
                <Text style={styles.paySub}>
                  {activeRevenue > 0 ? `${((paymentStats.card / activeRevenue) * 100).toFixed(0)}%` : '0%'}
                </Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Daily Breakdown (Visible when Week, Month, or All is chosen) */}
        {timeFilter !== 'day' && dailyStats.length > 0 && (
          <Card style={styles.card}>
            <Card.Content>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.cardSectionTitle}>Daily Revenue History</Text>
                <Badge style={{ backgroundColor: '#FBE9E7', color: '#D84315' }}>
                  {dailyStats.length} days
                </Badge>
              </View>
              {dailyStats.map(item => (
                <View key={item.date} style={styles.dailyRow}>
                  <View>
                    <Text style={styles.dailyDate}>{item.date}</Text>
                    <Text style={styles.dailySub}>{item.orders} orders • {item.dishes} dishes</Text>
                  </View>
                  <Text style={styles.dailyRevenue}>₹{item.revenue.toFixed(2)}</Text>
                </View>
              ))}
            </Card.Content>
          </Card>
        )}

        {/* Top Selling Dishes */}
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.cardSectionTitle}>Top Selling Dishes</Text>
              <Badge style={{ backgroundColor: '#FBE9E7', color: '#D84315' }}>
                {dishStats.length} items
              </Badge>
            </View>
            {dishStats.length === 0 ? (
              <Text style={styles.emptyText}>No sales recorded for this period.</Text>
            ) : (
              dishStats.slice(0, 10).map((dish, index) => (
                <View key={dish.name} style={styles.dishRow}>
                  <View style={styles.dishRank}>
                    <Text style={styles.rankNum}>#{index + 1}</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.dishRowName}>{dish.name}</Text>
                    <Text style={styles.dishRowCat}>{dish.category}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.dishRowCount}>{dish.count} sold</Text>
                    <Text style={styles.dishRowRevenue}>₹{dish.revenue.toFixed(2)}</Text>
                  </View>
                </View>
              ))
            )}
          </Card.Content>
        </Card>

        {/* Category Breakdown */}
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.cardSectionTitle}>Category Breakdown</Text>
            {categoryStats.length === 0 ? (
              <Text style={styles.emptyText}>No category data.</Text>
            ) : (
              categoryStats.map(cat => (
                <View key={cat.category} style={styles.catRow}>
                  <View>
                    <Text style={styles.catName}>{cat.category}</Text>
                    <Text style={styles.catItems}>{cat.count} items sold</Text>
                  </View>
                  <Text style={styles.catAmount}>₹{cat.revenue.toFixed(2)}</Text>
                </View>
              ))
            )}
          </Card.Content>
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9F6F0',
  },
  filterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EAE5DB',
    gap: 8,
    flexWrap: 'wrap',
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  filterChip: {
    backgroundColor: '#F1EFEA',
    height: 32,
  },
  filterChipSelected: {
    backgroundColor: '#D84315',
  },
  filterChipText: {
    fontSize: 12,
    color: '#555',
    lineHeight: 14,
  },
  filterChipTextSelected: {
    color: '#FFF',
    fontWeight: 'bold',
  },
  headerActionBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  exportPdfBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#D84315',
    borderRadius: 8,
  },
  exportPdfBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFF',
  },
  printReportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: '#FBE9E7',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFCCBC',
  },
  printReportText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#D84315',
  },
  mainScroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 12,
    gap: 12,
  },
  heroCard: {
    backgroundColor: '#D84315',
    borderRadius: 14,
    elevation: 3,
  },
  heroContent: {
    padding: 16,
    alignItems: 'center',
  },
  heroBadgeRow: {
    marginBottom: 6,
  },
  heroSubtitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#FFCCBC',
    letterSpacing: 1,
  },
  heroAmount: {
    fontSize: 34,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: 2,
  },
  heroDivider: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    width: '100%',
    marginVertical: 12,
  },
  heroStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  heroStat: {
    alignItems: 'center',
    flex: 1,
  },
  heroStatNum: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFF',
    marginTop: 2,
  },
  heroStatLabel: {
    fontSize: 11,
    color: '#FFCCBC',
  },
  statSeparator: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    height: '80%',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    elevation: 2,
  },
  cardSectionTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginBottom: 10,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  payGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  payCard: {
    flex: 1,
    backgroundColor: '#FAF9F6',
    borderLeftWidth: 3.5,
    borderRadius: 6,
    padding: 8,
  },
  payLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#7F8C8D',
  },
  payAmount: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginTop: 2,
  },
  paySub: {
    fontSize: 10,
    color: '#95A5A6',
    marginTop: 2,
  },
  dailyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  dailyDate: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  dailySub: {
    fontSize: 11,
    color: '#7F8C8D',
    marginTop: 2,
  },
  dailyRevenue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#D84315',
  },
  dishRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  dishRank: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FBE9E7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rankNum: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#D84315',
  },
  dishRowName: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  dishRowCat: {
    fontSize: 11,
    color: '#7F8C8D',
  },
  dishRowCount: {
    fontSize: 12,
    color: '#555',
  },
  dishRowRevenue: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#D84315',
  },
  catRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  catName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2C3E50',
  },
  catItems: {
    fontSize: 11,
    color: '#7F8C8D',
  },
  catAmount: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  emptyText: {
    fontSize: 13,
    color: '#95A5A6',
    textAlign: 'center',
    paddingVertical: 12,
  },
});
