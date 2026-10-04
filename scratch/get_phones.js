import { getAllBills } from '../src/services/db.js';

async function getUsersPhones() {
  const bills = await getAllBills();
  console.log(`Found ${bills.length} bills.`);
  const customers = {};

  bills.forEach(bill => {
    if (bill.phone) {
      if (!customers[bill.phone]) {
        customers[bill.phone] = new Set();
      }
      if (bill.customerName) {
        customers[bill.phone].add(bill.customerName);
      }
    }
  });

  const result = Object.keys(customers).map(phone => ({
    phone,
    names: Array.from(customers[phone])
  }));

  console.log(JSON.stringify(result, null, 2));
}

getUsersPhones();
