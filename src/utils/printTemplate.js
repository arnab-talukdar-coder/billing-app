export const generateHtmlReceipt = (billDetails) => {
  const {
    billNo,
    date,
    time = '',
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

  // Generate rows for items
  let itemsHtml = '';
  items.forEach((item, index) => {
    const quantity = parseInt(item.quantity, 10) || 1;
    const itemRate = parseFloat(item.mrp || item.price || 0);
    const itemTotal = itemRate * quantity;
    itemsHtml += `
      <tr>
        <td style="padding: 4px 1px; border-bottom: 1px dashed #DDD;">${index + 1}</td>
        <td style="padding: 4px 1px; border-bottom: 1px dashed #DDD; font-weight: 600;">${item.name}</td>
        <td style="padding: 4px 1px; border-bottom: 1px dashed #DDD; text-align: right;">₹${itemRate.toFixed(2)}</td>
        <td style="padding: 4px 1px; border-bottom: 1px dashed #DDD; text-align: center; font-weight: bold;">${quantity}</td>
        <td style="padding: 4px 1px; border-bottom: 1px dashed #DDD; text-align: right; font-weight: 600;">₹${itemTotal.toFixed(2)}</td>
      </tr>
    `;
  });

  const discountText = discountType === 'flat' ? `₹${discountValue}` : `${discountValue}%`;

  return `
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <style>
          @page { margin: 0; }
          html, body { width: 100%; margin: 0; padding: 0; }
          body {
            font-family: 'Helvetica Neue', Arial, sans-serif;
            font-size: 11pt;
            color: #000;
            width: 72mm;
            padding: 2.5mm;
            margin: 0 auto;
            box-sizing: border-box;
          }
          .text-center { text-align: center; }
          .header { font-size: 20pt; font-weight: bold; color: #D84315; margin-bottom: 2px; }
          .shop-name { font-size: 13pt; font-weight: 800; letter-spacing: 0.5px; margin-bottom: 2px; }
          .sub-header { font-size: 9pt; color: #444; margin-bottom: 4px; }
          .row { display: flex; justify-content: space-between; margin-bottom: 3px; font-size: 10pt; }
          .table-container { width: 100%; table-layout: fixed; margin-top: 6px; border-collapse: collapse; font-size: 10.5pt; }
          .total-section { margin-top: 8px; border-top: 2px dashed #000; padding-top: 6px; }
          .bold { font-weight: bold; }
          .footer { margin-top: 14px; border-top: 1px dashed #999; padding-top: 8px; font-size: 9pt; text-align: center; }
          .footer-title { font-weight: bold; font-size: 10.5pt; color: #D84315; }
        </style>
      </head>
      <body>
        <div class="text-center">
          <div class="shop-name">MON MANE NA RESTAURANT & CAFÉ</div>
          <div class="sub-header">Food & Dining Experience | Phone: 8240185094</div>
          ${billDetails.isTableSlip ? `
          <div style="margin-top: 4px; padding: 3px 6px; border: 1.5px dashed #000; font-size: 11pt; font-weight: 800; letter-spacing: 0.5px;">
            *** TABLE ORDER SLIP (${tableNo}) ***
          </div>
          ` : ''}
        </div>
        
        <div style="border-top: 1px solid #000; margin: 6px 0;"></div>
        
        <div class="row">
          <span>Bill No: <span class="bold">${billNo}</span></span>
          <span>Date: ${date} ${time}</span>
        </div>
        <div class="row">
          <span>Order: <span class="bold">${orderType}</span></span>
          ${orderType === 'Dine-In' && tableNo !== 'N/A' ? `<span>Table: <span class="bold">${tableNo}</span></span>` : ''}
          <span>Pay: ${paymentMode}</span>
        </div>
        ${customerName && customerName !== 'Guest' ? `
        <div class="row">
          <span>Customer: ${customerName} ${phone ? `(${phone})` : ''}</span>
        </div>
        ` : ''}

        <table class="table-container">
          <colgroup>
            <col style="width: 10%;" />
            <col style="width: 38%;" />
            <col style="width: 20%;" />
            <col style="width: 12%;" />
            <col style="width: 20%;" />
          </colgroup>
          <tr style="border-bottom: 1.5px solid #000;">
            <th style="padding: 3px 1px; text-align: left;">#</th>
            <th style="padding: 3px 1px; text-align: left;">Item</th>
            <th style="padding: 3px 1px; text-align: right;">Rate</th>
            <th style="padding: 3px 1px; text-align: center;">Qty</th>
            <th style="padding: 3px 1px; text-align: right;">Total</th>
          </tr>
          ${itemsHtml}
        </table>

        <div class="total-section">
          <div class="row">
            <span>Subtotal:</span>
            <span>₹${safeSubtotal.toFixed(2)}</span>
          </div>
          ${safeOverallDiscount > 0 ? `
          <div class="row">
            <span>Discount (${discountText}):</span>
            <span>-₹${safeOverallDiscount.toFixed(2)}</span>
          </div>
          ` : ''}
          <div class="row" style="font-size: 13pt; font-weight: bold; margin-top: 4px; border-top: 1.5px solid #000; padding-top: 5px;">
            <span>Grand Total:</span>
            <span>₹${safeFinalAmount.toFixed(2)}</span>
          </div>
        </div>
        
        <div class="footer">
          <div class="footer-title">Thank you for dining with us!</div>
          <div>Please visit us again!</div>
          <div style="margin-top: 3px; font-size: 8.5pt;">We take bookings for birthdays and all occasions.</div>
        </div>
      </body>
    </html>
  `;
};

export const generateReportHtml = (stats, dishStats = []) => {
  const currentDate = new Date().toLocaleString();
  return `
    <html>
      <head>
        <style>
          body { font-family: sans-serif; padding: 20px; color: #2C3E50; }
          h1 { color: #D84315; margin-bottom: 2px; }
          h2 { color: #555; margin-top: 0; font-size: 16px; }
          .metric-card { border: 1px solid #DDD; border-radius: 8px; padding: 12px; margin-bottom: 15px; }
          .total { font-size: 24px; font-weight: bold; color: #D84315; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; }
          th, td { border: 1px solid #DDD; padding: 8px; text-align: left; }
          th { background-color: #F8F4EE; font-weight: bold; }
        </style>
      </head>
      <body>
        <h1>Mon Mane Na</h1>
        <h2>Sales & Analytics Report - Generated: ${currentDate}</h2>
        <div class="metric-card">
          <div>Report generated for restaurant operations.</div>
        </div>
      </body>
    </html>
  `;
};
