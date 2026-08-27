import sqlite3 from "sqlite3";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { hashPassword } from "./utils/security.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dbPath = join(__dirname, "database.sqlite");

// Open database connection
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Error opening SQLite database:", err.message);
  } else {
    console.log("Connected to SQLite database at:", dbPath);
    initDatabase();
  }
});

// Promisify SQLite methods for async/await usage
export const query = {
  all: (sql, params = []) => {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  },
  get: (sql, params = []) => {
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  },
  run: (sql, params = []) => {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  },
  beginTransaction: () => {
    return new Promise((resolve, reject) => {
      db.run("BEGIN IMMEDIATE TRANSACTION", (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  },
  commit: () => {
    return new Promise((resolve, reject) => {
      db.run("COMMIT", (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  },
  rollback: () => {
    return new Promise((resolve, reject) => {
      db.run("ROLLBACK", (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
};

function initDatabase() {
  db.serialize(() => {
    // Enable foreign keys
    db.run("PRAGMA foreign_keys = ON");

    // 1. Create Users Table
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE,
        password TEXT,
        role TEXT,
        name TEXT,
        farmName TEXT,
        countryCode TEXT DEFAULT 'IN',
        countryName TEXT DEFAULT 'India',
        region TEXT,
        district TEXT,
        city TEXT,
        postalCode TEXT,
        address TEXT,
        lat REAL,
        lng REAL,
        currency TEXT DEFAULT 'INR',
        securityQuestion TEXT,
        securityAnswer TEXT,
        verificationStatus TEXT DEFAULT 'Pending',
        about TEXT,
        rating REAL DEFAULT 5.0,
        completedOrders INTEGER DEFAULT 0,
        createdAt TEXT
      )
    `);

    // 2. Create Products Table
    db.run(`
      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        name TEXT,
        category TEXT,
        grade TEXT,
        price REAL,
        currency TEXT DEFAULT 'INR',
        unit TEXT,
        stock INTEGER,
        farmerId TEXT,
        countryCode TEXT DEFAULT 'IN',
        region TEXT,
        district TEXT,
        city TEXT,
        lat REAL,
        lng REAL,
        description TEXT,
        imageUrl TEXT,
        moq INTEGER DEFAULT 10,
        tierPrices TEXT,
        organic INTEGER DEFAULT 0,
        harvestDate TEXT,
        createdAt TEXT,
        FOREIGN KEY(farmerId) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // 3. Create Orders Table
    db.run(`
      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        vendorId TEXT,
        vendorName TEXT,
        deliveryCountry TEXT DEFAULT 'India',
        deliveryRegion TEXT,
        deliveryDistrict TEXT,
        deliveryCity TEXT,
        deliveryPostalCode TEXT,
        deliveryAddress TEXT,
        paymentMethod TEXT,
        totalAmount REAL,
        currency TEXT DEFAULT 'INR',
        status TEXT DEFAULT 'Pending',
        createdAt TEXT,
        FOREIGN KEY(vendorId) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    // Safe column additions for existing sqlite database files
    const alterColumns = [
      "ALTER TABLE users ADD COLUMN countryCode TEXT DEFAULT 'IN'",
      "ALTER TABLE users ADD COLUMN countryName TEXT DEFAULT 'India'",
      "ALTER TABLE users ADD COLUMN region TEXT",
      "ALTER TABLE users ADD COLUMN district TEXT",
      "ALTER TABLE users ADD COLUMN city TEXT",
      "ALTER TABLE users ADD COLUMN postalCode TEXT",
      "ALTER TABLE users ADD COLUMN address TEXT",
      "ALTER TABLE users ADD COLUMN lat REAL",
      "ALTER TABLE users ADD COLUMN lng REAL",
      "ALTER TABLE users ADD COLUMN currency TEXT DEFAULT 'INR'",
      "ALTER TABLE users ADD COLUMN securityQuestion TEXT",
      "ALTER TABLE users ADD COLUMN securityAnswer TEXT",
      "ALTER TABLE users ADD COLUMN verificationStatus TEXT DEFAULT 'Pending'",
      "ALTER TABLE users ADD COLUMN about TEXT",
      "ALTER TABLE users ADD COLUMN rating REAL DEFAULT 5.0",
      "ALTER TABLE users ADD COLUMN completedOrders INTEGER DEFAULT 0",
      "ALTER TABLE products ADD COLUMN currency TEXT DEFAULT 'INR'",
      "ALTER TABLE products ADD COLUMN countryCode TEXT DEFAULT 'IN'",
      "ALTER TABLE products ADD COLUMN region TEXT",
      "ALTER TABLE products ADD COLUMN district TEXT",
      "ALTER TABLE products ADD COLUMN city TEXT",
      "ALTER TABLE products ADD COLUMN lat REAL",
      "ALTER TABLE products ADD COLUMN lng REAL",
      "ALTER TABLE products ADD COLUMN grade TEXT",
      "ALTER TABLE products ADD COLUMN description TEXT",
      "ALTER TABLE products ADD COLUMN imageUrl TEXT",
      "ALTER TABLE products ADD COLUMN moq INTEGER DEFAULT 10",
      "ALTER TABLE products ADD COLUMN tierPrices TEXT",
      "ALTER TABLE products ADD COLUMN organic INTEGER DEFAULT 0",
      "ALTER TABLE products ADD COLUMN harvestDate TEXT",
      "ALTER TABLE orders ADD COLUMN deliveryCountry TEXT DEFAULT 'India'",
      "ALTER TABLE orders ADD COLUMN deliveryRegion TEXT",
      "ALTER TABLE orders ADD COLUMN deliveryDistrict TEXT",
      "ALTER TABLE orders ADD COLUMN deliveryCity TEXT",
      "ALTER TABLE orders ADD COLUMN deliveryPostalCode TEXT",
      "ALTER TABLE orders ADD COLUMN currency TEXT DEFAULT 'INR'",
      "ALTER TABLE orders ADD COLUMN deliveryDistanceKm REAL",
      "ALTER TABLE orders ADD COLUMN deliveryEtaMinutes INTEGER",
      "ALTER TABLE orders ADD COLUMN deliveryCharge REAL DEFAULT 0",
      "ALTER TABLE orders ADD COLUMN paymentStatus TEXT DEFAULT 'PENDING_PAYMENT'",
      "ALTER TABLE orders ADD COLUMN paymentId TEXT",
      "ALTER TABLE orders ADD COLUMN subtotal REAL"
    ];

    alterColumns.forEach(sql => {
      db.run(sql, () => { /* Ignore errors if column already exists */ });
    });

    // 4. Create Order Items Table
    db.run(`
      CREATE TABLE IF NOT EXISTS order_items (
        id TEXT PRIMARY KEY,
        orderId TEXT,
        productId TEXT,
        farmerId TEXT,
        qty INTEGER,
        unitPrice REAL,
        amount REAL,
        FOREIGN KEY(orderId) REFERENCES orders(id) ON DELETE CASCADE,
        FOREIGN KEY(productId) REFERENCES products(id) ON DELETE SET NULL,
        FOREIGN KEY(farmerId) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    // 5. Create Notifications Table
    db.run(`
      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        userId TEXT,
        text TEXT,
        type TEXT,
        read INTEGER DEFAULT 0,
        createdAt TEXT,
        FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // 6. Create Reviews Table
    db.run(`
      CREATE TABLE IF NOT EXISTS reviews (
        id TEXT PRIMARY KEY,
        productId TEXT,
        farmerId TEXT,
        vendorId TEXT,
        vendorName TEXT,
        rating INTEGER,
        comment TEXT,
        verifiedPurchase INTEGER DEFAULT 0,
        status TEXT DEFAULT 'Approved',
        createdAt TEXT,
        FOREIGN KEY(productId) REFERENCES products(id) ON DELETE CASCADE,
        FOREIGN KEY(farmerId) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY(vendorId) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    // 7. Create Saved Searches Table
    db.run(`
      CREATE TABLE IF NOT EXISTS saved_searches (
        id TEXT PRIMARY KEY,
        vendorId TEXT,
        query TEXT,
        filters TEXT,
        createdAt TEXT,
        FOREIGN KEY(vendorId) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // 8. Create AI Conversations Table
    db.run(`
      CREATE TABLE IF NOT EXISTS ai_conversations (
        id TEXT PRIMARY KEY,
        userId TEXT,
        title TEXT,
        createdAt TEXT,
        updatedAt TEXT,
        FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // 9. Create AI Messages Table
    db.run(`
      CREATE TABLE IF NOT EXISTS ai_messages (
        id TEXT PRIMARY KEY,
        conversationId TEXT,
        role TEXT,
        content TEXT,
        toolName TEXT,
        toolResult TEXT,
        createdAt TEXT,
        FOREIGN KEY(conversationId) REFERENCES ai_conversations(id) ON DELETE CASCADE
      )
    `);

    // 10. Create AI Insights Table
    db.run(`
      CREATE TABLE IF NOT EXISTS ai_insights (
        id TEXT PRIMARY KEY,
        userId TEXT,
        type TEXT,
        data TEXT,
        createdAt TEXT,
        FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // 11. Create Real-Time Events Table
    db.run(`
      CREATE TABLE IF NOT EXISTS real_time_events (
        id TEXT PRIMARY KEY,
        userId TEXT,
        event TEXT,
        data TEXT,
        read INTEGER DEFAULT 0,
        createdAt TEXT,
        FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // 12. Create Conversations Table (Farmer ↔ Vendor Chat)
    db.run(`
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        farmerId TEXT,
        vendorId TEXT,
        productId TEXT,
        orderId TEXT,
        createdAt TEXT,
        updatedAt TEXT,
        FOREIGN KEY(farmerId) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY(vendorId) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY(productId) REFERENCES products(id) ON DELETE SET NULL,
        FOREIGN KEY(orderId) REFERENCES orders(id) ON DELETE SET NULL
      )
    `);

    // 13. Create Messages Table
    db.run(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversationId TEXT,
        senderId TEXT,
        message TEXT,
        messageType TEXT DEFAULT 'text',
        isRead INTEGER DEFAULT 0,
        status TEXT DEFAULT 'sent',
        productId TEXT,
        orderId TEXT,
        createdAt TEXT,
        updatedAt TEXT,
        FOREIGN KEY(conversationId) REFERENCES conversations(id) ON DELETE CASCADE,
        FOREIGN KEY(senderId) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY(productId) REFERENCES products(id) ON DELETE SET NULL,
        FOREIGN KEY(orderId) REFERENCES orders(id) ON DELETE SET NULL
      )
    `);

    // 14. Create Blocked Users Table
    db.run(`
      CREATE TABLE IF NOT EXISTS blocked_users (
        id TEXT PRIMARY KEY,
        userId TEXT,
        blockedUserId TEXT,
        createdAt TEXT,
        FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY(blockedUserId) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // 16. Create OTP Verifications Table
    db.run(`
      CREATE TABLE IF NOT EXISTS otp_verifications (
        id TEXT PRIMARY KEY,
        userId TEXT,
        contact TEXT,
        purpose TEXT,
        otpHash TEXT,
        expiresAt TEXT,
        attempts INTEGER DEFAULT 0,
        verifiedAt TEXT,
        createdAt TEXT
      )
    `);

    // 17. Create Payments Table
    db.run(`
      CREATE TABLE IF NOT EXISTS payments (
        id TEXT PRIMARY KEY,
        orderId TEXT,
        userId TEXT,
        gateway TEXT DEFAULT 'razorpay',
        gatewayOrderId TEXT,
        gatewayPaymentId TEXT,
        amount REAL,
        currency TEXT DEFAULT 'INR',
        status TEXT DEFAULT 'created',
        method TEXT,
        createdAt TEXT,
        updatedAt TEXT,
        FOREIGN KEY(orderId) REFERENCES orders(id) ON DELETE CASCADE,
        FOREIGN KEY(userId) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    // 18. Create Delivery Pricing Rules Table
    db.run(`
      CREATE TABLE IF NOT EXISTS delivery_pricing_rules (
        id TEXT PRIMARY KEY,
        minDistanceKm REAL,
        maxDistanceKm REAL,
        baseCharge REAL,
        perKmCharge REAL DEFAULT 0,
        active INTEGER DEFAULT 1,
        createdAt TEXT,
        updatedAt TEXT
      )
    `);

    // Seed upgraded tables sequentially
    setTimeout(seedData, 500);
  });
}

async function migrateExistingPasswords() {
  try {
    const users = await query.all("SELECT id, password FROM users");
    for (const u of users) {
      if (u.password && !u.password.startsWith("pbkdf2:sha512:")) {
        console.log(`Migrating plaintext password for user ${u.id} to secure hash...`);
        const hashedPassword = hashPassword(u.password);
        await query.run("UPDATE users SET password = ? WHERE id = ?", [hashedPassword, u.id]);
      }
    }
  } catch (err) {
    console.error("Error migrating existing passwords:", err);
  }
}

async function seedData() {
  try {
    const row = await query.get("SELECT COUNT(*) as count FROM users");
    if (row && row.count > 0) {
      await migrateExistingPasswords();
      return; // Database already seeded, run migration if needed
    }

    console.log("Seeding initial users for FarmConnect 2.0 with hashed passwords...");
    const users = [
      ["a1", "admin@farmconnect.com", hashPassword("admin123"), "admin", "Platform Admin", null, null, "What is your favorite food?", "apple", "Verified", "FarmConnect Administration Node.", 5.0, 0, "2026-01-01T00:00:00.000Z"],
      ["f1", "farmer@farmconnect.com", hashPassword("farmer123"), "farmer", "Rajesh Kumar", "Green Valley Farms", "Maharashtra", "What is your favorite food?", "apple", "Verified", "Pioneering sustainable farming in Nashik valley. Specializing in organic heirloom tomatoes and leafy greens since 2012.", 4.8, 28, "2026-01-10T08:00:00.000Z"],
      ["f2", "satish@farmconnect.com", hashPassword("farmer123"), "farmer", "Satish Patil", "Patil Agri Estates", "Punjab", "What is your favorite food?", "apple", "Verified", "High-quality durum grains and wheat supplier. Standardized crop processing and storage.", 4.7, 42, "2026-01-15T08:00:00.000Z"],
      ["f3", "kiran@farmconnect.com", hashPassword("farmer123"), "farmer", "Kiran Dev", "Malabar Spices Orchard", "Kerala", "What is your favorite food?", "apple", "Pending", "Direct from Western Ghats. Sun-dried black pepper and cardamom.", 4.5, 5, "2026-03-01T08:00:00.000Z"],
      ["v1", "vendor@farmconnect.com", hashPassword("vendor123"), "vendor", "Ananya's Kitchen", null, "Maharashtra", "What is your favorite food?", "apple", "Verified", "B2B cloud kitchen chain supplying premium hotels and corporate canteens.", 5.0, 0, "2026-01-12T08:00:00.000Z"],
      ["v2", "taj@hotels.com", hashPassword("vendor123"), "vendor", "Taj Residency", null, "Maharashtra", "What is your favorite food?", "apple", "Verified", "Luxury hospitality and fine dining restaurants.", 5.0, 0, "2026-01-20T08:00:00.000Z"]
    ];

    for (const u of users) {
      await query.run(`
        INSERT INTO users (id, email, password, role, name, farmName, region, securityQuestion, securityAnswer, verificationStatus, about, rating, completedOrders, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, u);
    }

    console.log("Seeding products with B2B tier prices and MOQs...");
    const products = [
      ["p1", "Organic Heirloom Tomatoes", "Vegetables", "A", 45.0, "kg", 320, "f1", "Vine-ripened, pesticide-free heirloom tomatoes grown using organic compost. High acidity, perfect for gourmet kitchens.", "", 50, '{"100":42,"500":38}', 1, "2026-08-11T00:00:00.000Z", "2026-08-01T12:00:00.000Z"],
      ["p2", "Red Globe Onions", "Vegetables", "A", 22.0, "kg", 1500, "f1", "Fresh, firm red onions harvested this season, ideal for bulk kitchens. Medium pungency.", "", 100, '{"200":20,"1000":17}', 0, "2026-08-10T00:00:00.000Z", "2026-08-01T12:00:00.000Z"],
      ["p3", "Farm Fresh Spinach", "Vegetables", "B", 18.0, "kg", 150, "f1", "Tender leafy spinach, harvested within 24 hours of delivery. Checked for pesticide residue.", "", 20, '{"50":16}', 1, "2026-08-12T00:00:00.000Z", "2026-08-01T12:00:00.000Z"],
      ["p4", "Golden Durum Wheat", "Grains", "B", 32.0, "kg", 5000, "f2", "High-protein durum wheat, ideal for pasta and bakery use. Dry-ventilated storage.", "", 500, '{"1000":30,"3000":28}', 0, "2026-08-01T00:00:00.000Z", "2026-08-01T12:00:00.000Z"],
      ["p5", "Premium Basmati Rice", "Grains", "A", 110.0, "kg", 2200, "f2", "Aged long-grain basmati rice with rich aroma. Traditional Punjab harvest.", "", 100, '{"500":105,"1000":98}', 0, "2026-07-15T00:00:00.000Z", "2026-08-01T12:00:00.000Z"],
      ["p6", "Whole Tellicherry Pepper", "Spices", "A", 450.0, "kg", 400, "f3", "Sun-dried Tellicherry black pepper, high piperine content and bold aroma.", "", 10, '{"50":430,"100":410}', 1, "2026-08-05T00:00:00.000Z", "2026-08-01T12:00:00.000Z"]
    ];

    for (const p of products) {
      await query.run(`
        INSERT INTO products (id, name, category, grade, price, unit, stock, farmerId, description, imageUrl, moq, tierPrices, organic, harvestDate, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, p);
    }

    console.log("Seeding group orders and order items...");
    await query.run("DELETE FROM order_items");
    await query.run("DELETE FROM orders");

    await query.run(`
      INSERT INTO orders (id, vendorId, vendorName, deliveryAddress, paymentMethod, totalAmount, status, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, ["FC-1002", "v1", "Ananya's Kitchen", "Parel Cloud Hub, Mumbai - 400012", "cod", 5540.0, "Delivered", "2026-07-20T12:00:00.000Z"]);

    await query.run(`
      INSERT INTO orders (id, vendorId, vendorName, deliveryAddress, paymentMethod, totalAmount, status, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, ["FC-1003", "v1", "Ananya's Kitchen", "Parel Cloud Hub, Mumbai - 400012", "upi", 11300.0, "In Transit", "2026-08-10T12:00:00.000Z"]);

    await query.run(`
      INSERT INTO orders (id, vendorId, vendorName, deliveryAddress, paymentMethod, totalAmount, status, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, ["FC-1004", "v2", "Taj Residency", "Colaba Seafront, Mumbai - 400005", "card", 11500.0, "Pending", "2026-08-12T14:30:00.000Z"]);

    const items = [
      ["i1", "FC-1002", "p1", "f1", 120, 42.0, 5040.0],
      ["i2", "FC-1003", "p2", "f1", 500, 20.0, 10000.0],
      ["i3", "FC-1003", "p3", "f1", 50, 16.0, 800.0],
      ["i4", "FC-1004", "p5", "f2", 100, 110.0, 11000.0]
    ];

    for (const item of items) {
      await query.run(`
        INSERT INTO order_items (id, orderId, productId, farmerId, qty, unitPrice, amount)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, item);
    }

    console.log("Seeding verified buyer reviews...");
    await query.run("DELETE FROM reviews");
    const reviews = [
      ["r1", "p1", "f1", "v1", "Ananya's Kitchen", 5, "Excellent acidity and firmness, perfect for our daily tomato concassé. Highly recommended!", 1, "Approved", "2026-07-25T14:00:00.000Z"],
      ["r2", "p2", "f1", "v2", "Taj Residency", 4, "Good medium sizing, minimal moisture content. Will reorder.", 1, "Approved", "2026-07-28T09:30:00.000Z"],
      ["r3", null, "f1", "v1", "Ananya's Kitchen", 5, "Rajesh is highly professional, sends harvest updates via message.", 1, "Approved", "2026-07-26T10:00:00.000Z"]
    ];

    for (const r of reviews) {
      await query.run(`
        INSERT INTO reviews (id, productId, farmerId, vendorId, vendorName, rating, comment, verifiedPurchase, status, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, r);
    }

    console.log("Seeding specific user notifications...");
    await query.run("DELETE FROM notifications");
    const notifications = [
      ["n1", "f1", "New order FC-1002 received from Ananya's Kitchen", "order", 1, "2026-07-20T12:00:00.000Z"],
      ["n2", "f1", "Organic Heirloom Tomatoes stock is running low (320 kg left)", "stock", 0, "2026-08-01T12:00:00.000Z"],
      ["n3", "v1", "Order FC-1002 was marked Delivered", "order", 0, "2026-07-20T12:05:00.000Z"]
    ];

    for (const n of notifications) {
      await query.run(`
        INSERT INTO notifications (id, userId, text, type, read, createdAt)
        VALUES (?, ?, ?, ?, ?, ?)
      `, n);
    }

    console.log("Seeding default delivery pricing rules...");
    const existingRules = await query.all("SELECT COUNT(*) as count FROM delivery_pricing_rules");
    if (existingRules && existingRules[0].count === 0) {
      const now = new Date().toISOString();
      const rules = [
        ["rule_1", 0, 5, 30, 0, 1, now, now],      // 0-5 km: Flat ₹30
        ["rule_2", 5, 15, 50, 2, 1, now, now],     // 5-15 km: Base ₹50 + ₹2/km above 5km
        ["rule_3", 15, 50, 80, 3, 1, now, now],    // 15-50 km: Base ₹80 + ₹3/km above 15km
        ["rule_4", 50, 999999, 150, 4, 1, now, now] // 50+ km: Base ₹150 + ₹4/km above 50km
      ];
      for (const r of rules) {
        await query.run(`
          INSERT INTO delivery_pricing_rules (id, minDistanceKm, maxDistanceKm, baseCharge, perKmCharge, active, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, r);
      }
    } else {
      await query.run("UPDATE delivery_pricing_rules SET maxDistanceKm = 999999 WHERE id = 'rule_4'");
    }

    console.log("Database seeded successfully with initial mock data!");
  } catch (err) {
    console.error("Database seeding error:", err);
  }
}

export default db;
