const bcrypt = require('bcryptjs');
const db = require('./db');

function getDateOffset(daysOffset) {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  return d.toISOString().split('T')[0];
}

function seedDatabase() {
  console.log('Seeding Egg Trade database...');

  // Clear existing data to allow fresh seed
  db.exec(`
    DELETE FROM credit_ledger;
    DELETE FROM orders;
    DELETE FROM daily_prices;
    DELETE FROM users;
  `);

  const ownerSalt = bcrypt.genSaltSync(10);
  const ownerHash = bcrypt.hashSync('owner123', ownerSalt);

  const userSalt = bcrypt.genSaltSync(10);
  const userHash = bcrypt.hashSync('user123', userSalt);

  // 1. Seed Owner
  const insertUser = db.prepare(`
    INSERT INTO users (name, phone, email, address, password_hash, role)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const ownerInfo = insertUser.run(
    'Rajesh Sharma (Owner)',
    '9999999999',
    'owner@eggtrade.com',
    'Egg Trade Wholesale Hub, Shop 10-12, APMC Market',
    ownerHash,
    'owner'
  );
  const ownerId = ownerInfo.lastInsertRowid;

  // 2. Seed Customers
  const customer1 = insertUser.run(
    'Sri Krishna Bakery',
    '9876543211',
    'krishna.bakery@example.com',
    '12 MG Road, Market Area',
    userHash,
    'user'
  );

  const customer2 = insertUser.run(
    'Anand Supermarket',
    '9876543212',
    'anand.store@example.com',
    'Shop 4, Commercial Complex, Main Bazaar',
    userHash,
    'user'
  );

  const customer3 = insertUser.run(
    'Hotel Annapurna',
    '9876543213',
    'annapurna.hotel@example.com',
    'Opp. City Bus Stand, Highway Junction',
    userHash,
    'user'
  );

  const customer4 = insertUser.run(
    'Ramesh Dhabha',
    '9876543214',
    'ramesh.dhabha@example.com',
    'Highway Bypass, Sector 5',
    userHash,
    'user'
  );

  const c1Id = customer1.lastInsertRowid;
  const c2Id = customer2.lastInsertRowid;
  const c3Id = customer3.lastInsertRowid;
  const c4Id = customer4.lastInsertRowid;

  // 3. Seed Daily Prices (today and past 4 days)
  const insertPrice = db.prepare(`
    INSERT INTO daily_prices (date, price_per_tray)
    VALUES (?, ?)
  `);

  const dayMinus4 = getDateOffset(-4);
  const dayMinus3 = getDateOffset(-3);
  const dayMinus2 = getDateOffset(-2);
  const dayMinus1 = getDateOffset(-1);
  const today = getDateOffset(0);

  insertPrice.run(dayMinus4, 195.00);
  insertPrice.run(dayMinus3, 198.00);
  insertPrice.run(dayMinus2, 202.00);
  insertPrice.run(dayMinus1, 205.00);
  insertPrice.run(today, 210.00);

  // 4. Seed Past Orders and Credit Ledger
  const insertOrder = db.prepare(`
    INSERT INTO orders (
      user_id, order_date, delivery_date, trays, price_per_tray,
      total_amount, payment_mode, payment_status, order_status, notes, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertLedger = db.prepare(`
    INSERT INTO credit_ledger (user_id, order_id, amount, type, notes, date)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  // --- Customer 1 (Sri Krishna Bakery) ---
  // Past Order 1: 3 days ago, 50 trays @ 198 = ₹9,900 (Credit, Delivered)
  const o1 = insertOrder.run(c1Id, dayMinus3, dayMinus3, 50, 198.00, 9900.00, 'credit', 'pending', 'delivered', 'Regular morning bulk delivery', 'user');
  insertLedger.run(c1Id, o1.lastInsertRowid, 9900.00, 'credit_added', `Credit for Order #${o1.lastInsertRowid} (50 trays)`, dayMinus3);

  // Partial payment settlement yesterday: ₹5,000 paid via UPI/Cash
  insertLedger.run(c1Id, null, 5000.00, 'credit_settled', 'Bank Transfer / Cash payment received', dayMinus1);

  // Past Order 2: Yesterday, 40 trays @ 205 = ₹8,200 (Credit, Delivered)
  const o2 = insertOrder.run(c1Id, dayMinus1, dayMinus1, 40, 205.00, 8200.00, 'credit', 'pending', 'delivered', 'Special cake batch egg requirement', 'user');
  insertLedger.run(c1Id, o2.lastInsertRowid, 8200.00, 'credit_added', `Credit for Order #${o2.lastInsertRowid} (40 trays)`, dayMinus1);

  // Today Order: 45 trays @ 210 = ₹9,450 (Credit, Pending delivery)
  const o3 = insertOrder.run(c1Id, today, today, 45, 210.00, 9450.00, 'credit', 'pending', 'pending', 'Morning dispatch please deliver before 10 AM', 'user');
  insertLedger.run(c1Id, o3.lastInsertRowid, 9450.00, 'credit_added', `Credit for Order #${o3.lastInsertRowid} (45 trays)`, today);

  // --- Customer 2 (Anand Supermarket) ---
  // Past Order 1: 4 days ago, 80 trays @ 195 = ₹15,600 (Cash on Delivery, Paid, Delivered)
  insertOrder.run(c2Id, dayMinus4, dayMinus4, 80, 195.00, 15600.00, 'cash', 'paid', 'delivered', 'Weekend stock replenishment', 'user');

  // Past Order 2: 2 days ago, 60 trays @ 202 = ₹12,120 (Credit, Delivered)
  const o4 = insertOrder.run(c2Id, dayMinus2, dayMinus2, 60, 202.00, 12120.00, 'credit', 'pending', 'delivered', 'Mid-week stock', 'user');
  insertLedger.run(c2Id, o4.lastInsertRowid, 12120.00, 'credit_added', `Credit for Order #${o4.lastInsertRowid} (60 trays)`, dayMinus2);

  // Today Order: 70 trays @ 210 = ₹14,700 (Credit, Confirmed)
  const o5 = insertOrder.run(c2Id, today, today, 70, 210.00, 14700.00, 'credit', 'pending', 'confirmed', 'Daily grocery retail trays', 'owner');
  insertLedger.run(c2Id, o5.lastInsertRowid, 14700.00, 'credit_added', `Credit for Order #${o5.lastInsertRowid} (70 trays)`, today);

  // --- Customer 3 (Hotel Annapurna) ---
  // Past Order 1: 3 days ago, 30 trays @ 198 = ₹5,940 (Cash, Paid, Delivered)
  insertOrder.run(c3Id, dayMinus3, dayMinus3, 30, 198.00, 5940.00, 'cash', 'paid', 'delivered', 'Breakfast buffet usage', 'user');

  // Past Order 2: Yesterday, 35 trays @ 205 = ₹7,175 (Credit, Delivered)
  const o6 = insertOrder.run(c3Id, dayMinus1, dayMinus1, 35, 205.00, 7175.00, 'credit', 'pending', 'delivered', 'Kitchen order', 'user');
  insertLedger.run(c3Id, o6.lastInsertRowid, 7175.00, 'credit_added', `Credit for Order #${o6.lastInsertRowid} (35 trays)`, dayMinus1);

  // Today Order: 40 trays @ 210 = ₹8,400 (Cash on Delivery, Out for delivery)
  insertOrder.run(c3Id, today, today, 40, 210.00, 8400.00, 'cash', 'pending', 'out_for_delivery', 'Hand over to head chef', 'user');

  // --- Customer 4 (Ramesh Dhabha) ---
  // Past Order: 2 days ago, 25 trays @ 202 = ₹5,050 (Cash, Paid, Delivered)
  insertOrder.run(c4Id, dayMinus2, dayMinus2, 25, 202.00, 5050.00, 'cash', 'paid', 'delivered', 'Curry eggs supply', 'user');

  // Today Order: 30 trays @ 210 = ₹6,300 (Cash on Delivery, Delivered, Paid)
  insertOrder.run(c4Id, today, today, 30, 210.00, 6300.00, 'cash', 'paid', 'delivered', 'Early morning counter delivery - Cash Paid', 'owner');

  console.log('Seeding completed successfully!');
  console.log('Owner Account: 9999999999 / owner123');
  console.log('Sample Customers: 9876543211, 9876543212, 9876543213, 9876543214 / user123');
}

seedDatabase();

module.exports = seedDatabase;
