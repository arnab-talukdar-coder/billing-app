import { BLEPrinter } from "react-native-thermal-receipt-printer";
import { Platform, PermissionsAndroid, Alert } from "react-native";

class ThermalPrinter {
  constructor() {
    this.currentPrinter = null;
  }

  /**
   * Request Bluetooth permissions for Android 12+
   */
  async requestPermissions() {
    if (Platform.OS === 'android') {
      if (Platform.Version >= 31) {
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ]);
        return (
          granted[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] === PermissionsAndroid.RESULTS.GRANTED &&
          granted[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] === PermissionsAndroid.RESULTS.GRANTED
        );
      } else {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      }
    }
    return true;
  }

  /**
   * Scan for Bluetooth devices
   */
  async scan() {
    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        Alert.alert("Permission Denied", "Bluetooth permissions are required to scan for printers.");
        return [];
      }

      await BLEPrinter.init();
      const devices = await BLEPrinter.getDeviceList();
      console.log("Scanned devices:", devices);
      return devices;
    } catch (error) {
      console.error("Scan error:", error);
      return [];
    }
  }

  /**
   * Connect to a specific printer
   */
  async connect(device) {
    try {
      await BLEPrinter.init(); // Ensure initialized before connecting
      await BLEPrinter.connectPrinter(device.inner_mac_address || device.address);
      this.currentPrinter = device;
      return true;
    } catch (error) {
      console.error("Connection error:", error);
      Alert.alert("Connection Failed", "Could not connect to the printer.");
      return false;
    }
  }

  /**
   * Print the bill as text (the "writings")
   */
  async printBill(bill) {
    try {
      if (!this.currentPrinter) {
        Alert.alert("Not Connected", "Please connect to a printer first.");
        return;
      }

      const {
        billNo,
        date,
        customerName,
        phone,
        items,
        totalOriginalMrp,
        totalItemDiscounts,
        subtotalAfterItemDiscounts,
        discountType,
        discountValue,
        overallDiscountAmount,
        gstAmount,
        finalAmount,
        totalBaseMrp
      } = bill;

      const safeOriginalMrp = parseFloat(totalOriginalMrp !== undefined ? totalOriginalMrp : (totalBaseMrp || 0));
      const safeItemDiscounts = parseFloat(totalItemDiscounts || 0);
      const safeSubtotal = parseFloat(subtotalAfterItemDiscounts !== undefined ? subtotalAfterItemDiscounts : (totalBaseMrp || 0));
      const safeOverallDiscount = parseFloat(overallDiscountAmount || 0);
      const safeGst = parseFloat(gstAmount || 0);
      const safeFinalAmount = parseFloat(finalAmount || 0);

      // Build the entire receipt as one string to avoid "cuts" and extra gaps between commands
      let receiptText = "";

      // Header
      receiptText += "<C><D>MON MANE NA</D></C>\n";
      receiptText += "<C>Restaurant & Cafe</C>\n";
      receiptText += "<C>Phone: 8240185094</C>\n";
      if (bill.isTableSlip) {
        receiptText += "<C><B>*** TABLE ORDER SLIP (" + (bill.tableNo || 'N/A') + ") ***</B></C>\n";
      }
      receiptText += "<C>Bill #" + billNo + "</C>\n";
      receiptText += "<C>Date: " + date + (bill.time ? "  " + bill.time : "") + "</C>\n";
      if (bill.orderType) receiptText += "Order: " + bill.orderType + (bill.tableNo && bill.tableNo !== 'N/A' ? " (Table " + bill.tableNo + ")" : "") + "\n";
      if (bill.paymentMode) receiptText += "Payment: " + bill.paymentMode + "\n";
      receiptText += "\n";

      if (customerName && customerName !== 'Guest') receiptText += "Customer: " + customerName + "\n";
      if (phone) receiptText += "Phone: " + phone + "\n";

      receiptText += "------------------------------------------\n";
      receiptText += "SN Item             Price  Qty       Total\n";
      receiptText += "------------------------------------------\n";

      const activeItems = items.filter(item => item.status !== 'Replaced');

      activeItems.forEach((item, index) => {
        const sn = (index + 1).toString().padEnd(3);
        const name = (item.name || "").substring(0, 12).padEnd(13);
        const itemQty = parseInt(item.quantity, 10) || 1;
        const itemMrp = parseFloat(item.mrp || item.price) || 0;
        const itemTotal = itemMrp * itemQty;

        const mrpStr = itemMrp.toFixed(2).padStart(6);
        const qtyStr = itemQty.toString().padStart(4);
        const totStr = itemTotal.toFixed(2).padStart(11);

        receiptText += `${sn}${name} ${mrpStr} ${qtyStr} ${totStr}\n`;
      });

      receiptText += "------------------------------------------\n";

      const subtotalStr = safeSubtotal.toFixed(2).padStart(12);
      receiptText += `Subtotal:`.padEnd(30) + `${subtotalStr}\n`;

      if (safeOverallDiscount > 0) {
        const overallDiscStr = safeOverallDiscount.toFixed(2).padStart(12);
        receiptText += `Overall Discount:`.padEnd(30) + `-${overallDiscStr}\n`;
      }

      receiptText += "<B>------------------------------------------</B>\n";
      receiptText += `<C><D>TOTAL: Rs. ${safeFinalAmount.toFixed(2)}</D></C>\n`;
      receiptText += "------------------------------------------\n";

      receiptText += "<C>Thank you for dining with us!</C>\n";
      receiptText += "<C>Please visit us again!</C>\n";
      receiptText += "\n\n\n\n"; // Feed paper for tearing

      // Single print call is faster and prevents the printer from auto-cutting after each line
      await BLEPrinter.printText(receiptText);

    } catch (error) {
      console.error("Print error:", error);
      Alert.alert("Print Error", "Failed to print the bill.");
    }
  }
}

export default new ThermalPrinter();
