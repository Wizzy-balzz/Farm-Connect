import mysql from "mysql2/promise";
import dotenv from "dotenv";
import { hashPassword } from "./utils/security.js";

import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, ".env") });
dotenv.config(); // fallback

const dbHost = process.env.DB_HOST || "127.0.0.1";
const dbPort = parseInt(process.env.DB_PORT || "3306", 10);
const dbUser = process.env.DB_USER || "root";
const dbPassword = process.env.DB_PASSWORD || "";
const dbName = process.env.DB_NAME || "farmconnect";

// Ensure target MySQL database exists before initializing pool
async function ensureDatabaseExists() {
  try {
    const rootConn = await mysql.createConnection({
      host: dbHost,
      port: dbPort,
      user: dbUser,
      password: dbPassword
    });
    await rootConn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await rootConn.end();
  } catch (err) {
    if (err.code !== "ECONNREFUSED") {
      console.warn("Warning ensuring MySQL database existence:", err.message);
    }
  }
}

await ensureDatabaseExists();

// Create MySQL connection pool optimized for production & serverless (Vercel) environments
export const pool = mysql.createPool({
  host: dbHost,
  port: dbPort,
  user: dbUser,
  password: dbPassword,
  database: dbName,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true
});

// Database connection health state tracking
let isDbConnected = false;
let dbConnectionError = null;
let hasLoggedDbConnWarning = false;

export function getDatabaseStatus() {
  return {
    connected: isDbConnected,
    host: dbHost,
    port: dbPort,
    database: dbName,
    user: dbUser,
    error: dbConnectionError ? (dbConnectionError.message || String(dbConnectionError)) : null
  };
}

function handleDbError(err) {
  if (err.code === "ECONNREFUSED" || err.code === "PROTOCOL_CONNECTION_LOST" || err.code === "ETIMEDOUT") {
    isDbConnected = false;
    dbConnectionError = err;
    const dbErr = new Error(`MySQL Database unreachable at ${dbHost}:${dbPort}. Please ensure MySQL service is running.`);
    dbErr.code = "DATABASE_UNAVAILABLE";
    dbErr.originalCode = err.code;
    throw dbErr;
  }
  throw err;
}

export const query = {
  all: async (sql, params = [], conn = null) => {
    try {
      const client = conn || pool;
      const [rows] = await client.query(sql, params);
      isDbConnected = true;
      return rows;
    } catch (err) {
      handleDbError(err);
    }
  },
  get: async (sql, params = [], conn = null) => {
    try {
      const client = conn || pool;
      const [rows] = await client.query(sql, params);
      isDbConnected = true;
      return rows[0] || null;
    } catch (err) {
      handleDbError(err);
    }
  },
  run: async (sql, params = [], conn = null) => {
    try {
      const client = conn || pool;
      const [result] = await client.query(sql, params);
      isDbConnected = true;
      return {
        lastID: result.insertId || null,
        changes: result.affectedRows || 0
      };
    } catch (err) {
      handleDbError(err);
    }
  },
  beginTransaction: async () => {
    try {
      const conn = await pool.getConnection();
      await conn.beginTransaction();
      isDbConnected = true;
      return conn;
    } catch (err) {
      handleDbError(err);
    }
  },
  commit: async (conn) => {
    if (conn) {
      try {
        await conn.commit();
      } finally {
        conn.release();
      }
    }
  },
  rollback: async (conn) => {
    if (conn) {
      try {
        await conn.rollback();
      } catch (err) {
        /* Ignore rollback errors if already rolled back */
      } finally {
        conn.release();
      }
    }
  }
};

// Auto-initialize MySQL schema & tables
export async function initDatabase() {
  try {
    // 1. Users Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(100) PRIMARY KEY,
        email VARCHAR(255) UNIQUE,
        google_id VARCHAR(255) UNIQUE,
        password VARCHAR(255) NULL,
        role VARCHAR(50),
        name VARCHAR(255),
        mobile VARCHAR(20),
        farmName VARCHAR(255),
        farmSize VARCHAR(50),
        farmingExperience VARCHAR(50),
        cropsGrown TEXT,
        primaryCrop VARCHAR(100),
        expectedQuantity VARCHAR(100),
        businessName VARCHAR(255),
        businessType VARCHAR(100),
        gstin VARCHAR(50),
        procurementCategories TEXT,
        procurementQuantity VARCHAR(100),
        countryCode VARCHAR(10) DEFAULT 'IN',
        countryName VARCHAR(100) DEFAULT 'India',
        region VARCHAR(100),
        district VARCHAR(100),
        city VARCHAR(100),
        postalCode VARCHAR(20),
        address TEXT,
        lat DECIMAL(10, 7),
        lng DECIMAL(10, 7),
        currency VARCHAR(10) DEFAULT 'INR',
        securityQuestion TEXT,
        securityAnswer TEXT,
        verificationStatus VARCHAR(50) DEFAULT 'Pending',
        email_verified TINYINT(1) DEFAULT 0,
        mobile_verified TINYINT(1) DEFAULT 0,
        account_status VARCHAR(50) DEFAULT 'ACTIVE',
        terms_accepted TINYINT(1) DEFAULT 1,
        terms_accepted_at VARCHAR(100),
        about TEXT,
        rating DECIMAL(3, 2) DEFAULT 5.00,
        completedOrders INT DEFAULT 0,
        createdAt VARCHAR(100)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Safe Alter Table column additions for existing installations
    const userAlterColumns = [
      "ALTER TABLE users ADD COLUMN mobile VARCHAR(20)",
      "ALTER TABLE users ADD COLUMN farmSize VARCHAR(50)",
      "ALTER TABLE users ADD COLUMN farmingExperience VARCHAR(50)",
      "ALTER TABLE users ADD COLUMN cropsGrown TEXT",
      "ALTER TABLE users ADD COLUMN primaryCrop VARCHAR(100)",
      "ALTER TABLE users ADD COLUMN expectedQuantity VARCHAR(100)",
      "ALTER TABLE users ADD COLUMN businessName VARCHAR(255)",
      "ALTER TABLE users ADD COLUMN businessType VARCHAR(100)",
      "ALTER TABLE users ADD COLUMN gstin VARCHAR(50)",
      "ALTER TABLE users ADD COLUMN procurementCategories TEXT",
      "ALTER TABLE users ADD COLUMN procurementQuantity VARCHAR(100)",
      "ALTER TABLE users ADD COLUMN email_verified TINYINT(1) DEFAULT 0",
      "ALTER TABLE users ADD COLUMN mobile_verified TINYINT(1) DEFAULT 0",
      "ALTER TABLE users ADD COLUMN account_status VARCHAR(50) DEFAULT 'ACTIVE'",
      "ALTER TABLE users ADD COLUMN terms_accepted TINYINT(1) DEFAULT 1",
      "ALTER TABLE users ADD COLUMN terms_accepted_at VARCHAR(100)",
      "ALTER TABLE users ADD COLUMN google_id VARCHAR(255) NULL UNIQUE",
      "ALTER TABLE users MODIFY COLUMN password VARCHAR(255) NULL"
    ];

    for (const sql of userAlterColumns) {
      try {
        await pool.query(sql);
      } catch (e) {
        /* Ignore error if column already exists */
      }
    }

    // 2. Products Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS products (
        id VARCHAR(100) PRIMARY KEY,
        name VARCHAR(255),
        category VARCHAR(100),
        grade VARCHAR(50),
        price DECIMAL(10, 2),
        currency VARCHAR(10) DEFAULT 'INR',
        unit VARCHAR(50),
        stock INT DEFAULT 0,
        farmerId VARCHAR(100),
        countryCode VARCHAR(10) DEFAULT 'IN',
        region VARCHAR(100),
        district VARCHAR(100),
        city VARCHAR(100),
        lat DECIMAL(10, 7),
        lng DECIMAL(10, 7),
        description TEXT,
        imageUrl TEXT,
        moq INT DEFAULT 10,
        tierPrices TEXT,
        organic TINYINT(1) DEFAULT 0,
        harvestDate VARCHAR(100),
        createdAt VARCHAR(100),
        FOREIGN KEY (farmerId) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 2b. Product Translations Table (Multilingual Dynamic Marketplace)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS product_translations (
        id VARCHAR(100) PRIMARY KEY,
        product_id VARCHAR(100) NOT NULL,
        language_code VARCHAR(10) NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        created_at VARCHAR(100),
        updated_at VARCHAR(100),
        UNIQUE KEY uk_prod_lang (product_id, language_code),
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 3. Orders Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id VARCHAR(100) PRIMARY KEY,
        vendorId VARCHAR(100),
        vendorName VARCHAR(255),
        deliveryCountry VARCHAR(100) DEFAULT 'India',
        deliveryRegion VARCHAR(100),
        deliveryDistrict VARCHAR(100),
        deliveryCity VARCHAR(100),
        deliveryPostalCode VARCHAR(20),
        deliveryAddress TEXT,
        deliveryLat DECIMAL(10, 7) DEFAULT NULL,
        deliveryLng DECIMAL(10, 7) DEFAULT NULL,
        paymentMethod VARCHAR(50),
        totalAmount DECIMAL(12, 2),
        subtotal DECIMAL(12, 2),
        deliveryCharge DECIMAL(10, 2) DEFAULT 0.00,
        deliveryDistanceKm DECIMAL(8, 2),
        deliveryEtaMinutes INT,
        paymentStatus VARCHAR(50) DEFAULT 'PENDING_PAYMENT',
        paymentId VARCHAR(100),
        currency VARCHAR(10) DEFAULT 'INR',
        status VARCHAR(50) DEFAULT 'Pending',
        createdAt VARCHAR(100),
        FOREIGN KEY (vendorId) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Safe Alter Table for deliveryLat and deliveryLng
    try {
      await pool.query("ALTER TABLE orders ADD COLUMN deliveryLat DECIMAL(10, 7) DEFAULT NULL");
    } catch {}
    try {
      await pool.query("ALTER TABLE orders ADD COLUMN deliveryLng DECIMAL(10, 7) DEFAULT NULL");
    } catch {}

    // 3b. Order Tracking Events Table (Phase 13 OpenStreetMap Tracking)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS order_tracking_events (
        id VARCHAR(100) PRIMARY KEY,
        order_id VARCHAR(100) NOT NULL,
        status VARCHAR(50) NOT NULL,
        location VARCHAR(255) NOT NULL,
        latitude DECIMAL(10, 7) DEFAULT NULL,
        longitude DECIMAL(10, 7) DEFAULT NULL,
        description TEXT,
        timestamp VARCHAR(100) NOT NULL,
        updated_by VARCHAR(100) NOT NULL,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 4. Order Items Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id VARCHAR(100) PRIMARY KEY,
        orderId VARCHAR(100),
        productId VARCHAR(100),
        farmerId VARCHAR(100),
        qty INT,
        unitPrice DECIMAL(10, 2),
        amount DECIMAL(12, 2),
        FOREIGN KEY (orderId) REFERENCES orders(id) ON DELETE CASCADE,
        FOREIGN KEY (productId) REFERENCES products(id) ON DELETE SET NULL,
        FOREIGN KEY (farmerId) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 5. Notifications Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id VARCHAR(100) PRIMARY KEY,
        userId VARCHAR(100),
        text TEXT,
        type VARCHAR(50),
        \`read\` TINYINT(1) DEFAULT 0,
        createdAt VARCHAR(100),
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 6. Reviews Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS reviews (
        id VARCHAR(100) PRIMARY KEY,
        productId VARCHAR(100),
        farmerId VARCHAR(100),
        vendorId VARCHAR(100),
        vendorName VARCHAR(255),
        rating INT,
        comment TEXT,
        verifiedPurchase TINYINT(1) DEFAULT 0,
        status VARCHAR(50) DEFAULT 'Approved',
        createdAt VARCHAR(100),
        FOREIGN KEY (productId) REFERENCES products(id) ON DELETE CASCADE,
        FOREIGN KEY (farmerId) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (vendorId) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 7. Saved Searches Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS saved_searches (
        id VARCHAR(100) PRIMARY KEY,
        vendorId VARCHAR(100),
        query TEXT,
        filters TEXT,
        createdAt VARCHAR(100),
        FOREIGN KEY (vendorId) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 8. AI Conversations Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ai_conversations (
        id VARCHAR(100) PRIMARY KEY,
        userId VARCHAR(100),
        title VARCHAR(255),
        createdAt VARCHAR(100),
        updatedAt VARCHAR(100),
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 9. AI Messages Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ai_messages (
        id VARCHAR(100) PRIMARY KEY,
        conversationId VARCHAR(100),
        role VARCHAR(50),
        content TEXT,
        toolName VARCHAR(100),
        toolResult LONGTEXT,
        createdAt VARCHAR(100),
        FOREIGN KEY (conversationId) REFERENCES ai_conversations(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 10. AI Insights Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ai_insights (
        id VARCHAR(100) PRIMARY KEY,
        userId VARCHAR(100),
        type VARCHAR(50),
        data TEXT,
        createdAt VARCHAR(100),
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 10b. AI Proactive Insights Table (Phase 7)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ai_proactive_insights (
        id VARCHAR(100) PRIMARY KEY,
        userId VARCHAR(100) NOT NULL,
        type VARCHAR(50) NOT NULL,
        severity VARCHAR(20) NOT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        facts TEXT NOT NULL,
        reasoning TEXT NOT NULL,
        metadata TEXT,
        status VARCHAR(20) DEFAULT 'active',
        createdAt VARCHAR(100) NOT NULL,
        expiresAt VARCHAR(100),
        readAt VARCHAR(100),
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
        KEY idx_proactive_user (userId),
        KEY idx_proactive_type_user (userId, type)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 10c. AI Image Analyses Table (Phase 8)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ai_image_analyses (
        id VARCHAR(100) PRIMARY KEY,
        userId VARCHAR(100) NOT NULL,
        conversationId VARCHAR(100),
        cropContext TEXT,
        analysisResult LONGTEXT NOT NULL,
        language VARCHAR(20) DEFAULT 'en',
        confidence VARCHAR(20) DEFAULT 'medium',
        createdAt VARCHAR(100) NOT NULL,
        expiresAt VARCHAR(100),
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
        KEY idx_image_user (userId),
        KEY idx_image_conv (conversationId)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    try {
      await pool.query(`ALTER TABLE ai_image_analyses ADD COLUMN cropContext TEXT;`);
    } catch {
      /* Column already exists */
    }

    // 11. Real-Time Events Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS real_time_events (
        id VARCHAR(100) PRIMARY KEY,
        userId VARCHAR(100),
        event VARCHAR(100),
        data TEXT,
        \`read\` TINYINT(1) DEFAULT 0,
        createdAt VARCHAR(100),
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 12. Conversations Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS conversations (
        id VARCHAR(100) PRIMARY KEY,
        farmerId VARCHAR(100),
        vendorId VARCHAR(100),
        productId VARCHAR(100),
        orderId VARCHAR(100),
        createdAt VARCHAR(100),
        updatedAt VARCHAR(100),
        FOREIGN KEY (farmerId) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (vendorId) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (productId) REFERENCES products(id) ON DELETE SET NULL,
        FOREIGN KEY (orderId) REFERENCES orders(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 13. Messages Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id VARCHAR(100) PRIMARY KEY,
        conversationId VARCHAR(100),
        senderId VARCHAR(100),
        message TEXT,
        messageType VARCHAR(50) DEFAULT 'text',
        isRead TINYINT(1) DEFAULT 0,
        status VARCHAR(50) DEFAULT 'sent',
        productId VARCHAR(100),
        orderId VARCHAR(100),
        createdAt VARCHAR(100),
        updatedAt VARCHAR(100),
        FOREIGN KEY (conversationId) REFERENCES conversations(id) ON DELETE CASCADE,
        FOREIGN KEY (senderId) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (productId) REFERENCES products(id) ON DELETE SET NULL,
        FOREIGN KEY (orderId) REFERENCES orders(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 14. Blocked Users Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS blocked_users (
        id VARCHAR(100) PRIMARY KEY,
        userId VARCHAR(100),
        blockedUserId VARCHAR(100),
        createdAt VARCHAR(100),
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (blockedUserId) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 15. Message Reports Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS message_reports (
        id VARCHAR(100) PRIMARY KEY,
        conversationId VARCHAR(100),
        reportedBy VARCHAR(100),
        reason TEXT,
        status VARCHAR(50) DEFAULT 'pending',
        createdAt VARCHAR(100),
        FOREIGN KEY (conversationId) REFERENCES conversations(id) ON DELETE CASCADE,
        FOREIGN KEY (reportedBy) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 16. OTP Verifications Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS otp_verifications (
        id VARCHAR(100) PRIMARY KEY,
        userId VARCHAR(100),
        contact VARCHAR(255),
        purpose VARCHAR(50),
        otpHash VARCHAR(255),
        expiresAt VARCHAR(100),
        attempts INT DEFAULT 0,
        verifiedAt VARCHAR(100),
        createdAt VARCHAR(100)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 17. Payments Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id VARCHAR(100) PRIMARY KEY,
        orderId VARCHAR(100),
        userId VARCHAR(100),
        gateway VARCHAR(50) DEFAULT 'razorpay',
        gatewayOrderId VARCHAR(100),
        gatewayPaymentId VARCHAR(100),
        amount DECIMAL(12, 2),
        currency VARCHAR(10) DEFAULT 'INR',
        status VARCHAR(50) DEFAULT 'created',
        method VARCHAR(50),
        createdAt VARCHAR(100),
        updatedAt VARCHAR(100),
        FOREIGN KEY (orderId) REFERENCES orders(id) ON DELETE CASCADE,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 18. Delivery Pricing Rules Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS delivery_pricing_rules (
        id VARCHAR(100) PRIMARY KEY,
        minDistanceKm DECIMAL(10, 2),
        maxDistanceKm DECIMAL(10, 2),
        baseCharge DECIMAL(10, 2),
        perKmCharge DECIMAL(10, 2) DEFAULT 0.00,
        active TINYINT(1) DEFAULT 1,
        createdAt VARCHAR(100),
        updatedAt VARCHAR(100)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 19. AI Pending Actions Table (Phase 6 Human Confirmation)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ai_pending_actions (
        id VARCHAR(100) PRIMARY KEY,
        userId VARCHAR(100) NOT NULL,
        conversationId VARCHAR(100),
        actionId VARCHAR(100) NOT NULL,
        parametersJson LONGTEXT NOT NULL,
        parametersHash VARCHAR(64) NOT NULL,
        status VARCHAR(50) DEFAULT 'PENDING',
        confirmationTokenHash VARCHAR(64) NOT NULL,
        expectedStateJson LONGTEXT,
        expiresAt BIGINT NOT NULL,
        createdAt VARCHAR(100) NOT NULL,
        confirmedAt VARCHAR(100),
        cancelledAt VARCHAR(100),
        failureReason TEXT,
        resultJson LONGTEXT,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 20. AI Action Audit Table (Phase 6 Auditing)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ai_action_audit (
        id VARCHAR(100) PRIMARY KEY,
        userId VARCHAR(100) NOT NULL,
        role VARCHAR(50) NOT NULL,
        actionId VARCHAR(100) NOT NULL,
        conversationId VARCHAR(100),
        status VARCHAR(50) NOT NULL,
        parametersSummary TEXT,
        resultSummary TEXT,
        failureReason TEXT,
        createdAt VARCHAR(100) NOT NULL,
        completedAt VARCHAR(100),
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 21. AI User Memory Table (Phase 11 Personal AI Memory)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ai_user_memory (
        id VARCHAR(100) PRIMARY KEY,
        userId VARCHAR(100) NOT NULL,
        memoryType VARCHAR(50) NOT NULL,
        \`key\` VARCHAR(100) NOT NULL,
        \`value\` TEXT NOT NULL,
        confidence VARCHAR(20) DEFAULT 'high',
        source VARCHAR(50) DEFAULT 'user_explicit',
        createdAt VARCHAR(100) NOT NULL,
        updatedAt VARCHAR(100) NOT NULL,
        expiresAt VARCHAR(100),
        isActive TINYINT(1) DEFAULT 1,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 22. AI Farming Goals Table (Phase 11 Goal Tracking)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ai_farming_goals (
        id VARCHAR(100) PRIMARY KEY,
        userId VARCHAR(100) NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        category VARCHAR(50) NOT NULL DEFAULT 'production',
        targetValue DECIMAL(12, 2) DEFAULT 0.00,
        currentValue DECIMAL(12, 2) DEFAULT 0.00,
        unit VARCHAR(50) DEFAULT 'kg',
        deadline VARCHAR(100),
        status VARCHAR(50) DEFAULT 'active',
        priority VARCHAR(50) DEFAULT 'medium',
        createdAt VARCHAR(100) NOT NULL,
        updatedAt VARCHAR(100) NOT NULL,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 23. AI Follow-ups Table (Phase 11 Task & Reminder System)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ai_followups (
        id VARCHAR(100) PRIMARY KEY,
        userId VARCHAR(100) NOT NULL,
        type VARCHAR(50) NOT NULL DEFAULT 'custom',
        title VARCHAR(255) NOT NULL,
        description TEXT,
        triggerAt VARCHAR(100),
        status VARCHAR(50) DEFAULT 'pending',
        relatedEntityType VARCHAR(50),
        relatedEntityId VARCHAR(100),
        createdAt VARCHAR(100) NOT NULL,
        completedAt VARCHAR(100),
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 24. Farm Parcels Table (GIS Phase 1 User-Demarcated Farm Boundaries)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS farm_parcels (
        id VARCHAR(100) PRIMARY KEY,
        user_id VARCHAR(100) NOT NULL,
        name VARCHAR(255) NOT NULL,
        geometry_geojson LONGTEXT NOT NULL,
        area_acres DECIMAL(10, 2) DEFAULT 0.00,
        area_hectares DECIMAL(10, 2) DEFAULT 0.00,
        centroid_lat DECIMAL(10, 7),
        centroid_lng DECIMAL(10, 7),
        source VARCHAR(50) DEFAULT 'USER_DRAWN',
        cadastral_status VARCHAR(50) DEFAULT 'NON_CADASTRAL',
        document_reference VARCHAR(255) DEFAULT NULL,
        created_at VARCHAR(100) NOT NULL,
        updated_at VARCHAR(100) NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 26. Crop Value-Added Products Table (Value Addition Module)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS crop_value_added_products (
        id VARCHAR(100) PRIMARY KEY,
        crop_name VARCHAR(100) NOT NULL,
        product_name VARCHAR(255) NOT NULL,
        category VARCHAR(100),
        description TEXT,
        value_addition_multiplier DECIMAL(5, 2) DEFAULT 1.00,
        created_at VARCHAR(100) NOT NULL,
        updated_at VARCHAR(100) NOT NULL,
        UNIQUE KEY uk_crop_product (crop_name, product_name),
        KEY idx_vap_crop (crop_name),
        KEY idx_vap_product (product_name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 27. Processing Guides Table (Value Addition Module)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS processing_guides (
        id VARCHAR(100) PRIMARY KEY,
        value_added_product_id VARCHAR(100) NOT NULL,
        title VARCHAR(255) NOT NULL,
        processing_method VARCHAR(100) NOT NULL,
        difficulty_level VARCHAR(50) DEFAULT 'Intermediate',
        expected_yield_percentage DECIMAL(5, 2) DEFAULT NULL,
        processing_time_hours DECIMAL(6, 2) DEFAULT NULL,
        summary TEXT,
        source_reference TEXT,
        created_at VARCHAR(100) NOT NULL,
        updated_at VARCHAR(100) NOT NULL,
        FOREIGN KEY (value_added_product_id) REFERENCES crop_value_added_products(id) ON DELETE CASCADE,
        KEY idx_pg_vap (value_added_product_id),
        KEY idx_pg_method (processing_method)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 28. Processing Stages Table (Value Addition Module)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS processing_stages (
        id VARCHAR(100) PRIMARY KEY,
        guide_id VARCHAR(100) NOT NULL,
        stage_number INT NOT NULL,
        stage_name VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        duration_minutes INT DEFAULT NULL,
        temperature_celsius DECIMAL(5, 2) DEFAULT NULL,
        critical_control_points TEXT,
        created_at VARCHAR(100) NOT NULL,
        FOREIGN KEY (guide_id) REFERENCES processing_guides(id) ON DELETE CASCADE,
        UNIQUE KEY uk_guide_stage (guide_id, stage_number),
        KEY idx_ps_guide (guide_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 29. Processing Equipment Table (Value Addition Module)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS processing_equipment (
        id VARCHAR(100) PRIMARY KEY,
        guide_id VARCHAR(100) NOT NULL,
        equipment_name VARCHAR(255) NOT NULL,
        equipment_type VARCHAR(100) DEFAULT NULL,
        processing_method VARCHAR(100) DEFAULT NULL,
        applicable_crops TEXT DEFAULT NULL,
        applicable_products TEXT DEFAULT NULL,
        purpose TEXT DEFAULT NULL,
        capacity_info VARCHAR(255) DEFAULT NULL,
        operational_description TEXT DEFAULT NULL,
        maintenance_considerations TEXT DEFAULT NULL,
        source_reference TEXT DEFAULT NULL,
        specification TEXT,
        is_mandatory TINYINT(1) DEFAULT 1,
        estimated_cost_min DECIMAL(12, 2) DEFAULT NULL,
        estimated_cost_max DECIMAL(12, 2) DEFAULT NULL,
        created_at VARCHAR(100) NOT NULL,
        FOREIGN KEY (guide_id) REFERENCES processing_guides(id) ON DELETE CASCADE,
        KEY idx_pe_guide (guide_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 30. Processing Packaging & Storage Table (Value Addition Module)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS processing_packaging_storage (
        id VARCHAR(100) PRIMARY KEY,
        guide_id VARCHAR(100) NOT NULL,
        packaging_type VARCHAR(100) NOT NULL,
        material_specification TEXT,
        suitable_packaging_material TEXT,
        packaging_considerations TEXT,
        labelling_considerations TEXT,
        storage_conditions TEXT,
        moisture_considerations TEXT,
        temperature_considerations TEXT,
        storage_temperature_min_c DECIMAL(5, 2) DEFAULT NULL,
        storage_temperature_max_c DECIMAL(5, 2) DEFAULT NULL,
        humidity_percentage_max DECIMAL(5, 2) DEFAULT NULL,
        shelf_life_days INT DEFAULT NULL,
        shelf_life_info VARCHAR(255) DEFAULT NULL,
        storage_instructions TEXT,
        storage_precautions TEXT,
        source_reference TEXT,
        created_at VARCHAR(100) NOT NULL,
        FOREIGN KEY (guide_id) REFERENCES processing_guides(id) ON DELETE CASCADE,
        KEY idx_pps_guide (guide_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 31. Processing Market & Commercial Info Table (Value Addition Module)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS processing_market_info (
        id VARCHAR(100) PRIMARY KEY,
        guide_id VARCHAR(100) NOT NULL,
        target_market VARCHAR(255) DEFAULT NULL,
        commercial_uses TEXT,
        demand_level VARCHAR(50) DEFAULT 'Moderate',
        quality_standards TEXT,
        govt_schemes_info TEXT,
        created_at VARCHAR(100) NOT NULL,
        FOREIGN KEY (guide_id) REFERENCES processing_guides(id) ON DELETE CASCADE,
        KEY idx_pmi_guide (guide_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 32. Farmer Processing Projects Table (Value Addition Module)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS farmer_processing_projects (
        id VARCHAR(100) PRIMARY KEY,
        farmer_id VARCHAR(100) NOT NULL,
        value_added_product_id VARCHAR(100) DEFAULT NULL,
        project_name VARCHAR(255) NOT NULL,
        crop_name VARCHAR(100) NOT NULL,
        raw_quantity DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
        raw_unit VARCHAR(50) DEFAULT 'kg',
        raw_unit_price DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
        raw_material_cost DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
        processing_cost DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
        labour_cost DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
        packaging_cost DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
        transport_cost DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
        other_costs DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
        total_cost DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
        expected_processed_qty DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
        processed_unit VARCHAR(50) DEFAULT 'kg',
        expected_selling_price DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
        projected_revenue DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
        projected_profit DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
        roi_percentage DECIMAL(8, 2) NOT NULL DEFAULT 0.00,
        status VARCHAR(50) DEFAULT 'SAVED',
        notes TEXT DEFAULT NULL,
        created_at VARCHAR(100) NOT NULL,
        updated_at VARCHAR(100) NOT NULL,
        FOREIGN KEY (farmer_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (value_added_product_id) REFERENCES crop_value_added_products(id) ON DELETE SET NULL,
        KEY idx_fpp_farmer (farmer_id),
        KEY idx_fpp_product (value_added_product_id),
        KEY idx_fpp_status (farmer_id, status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 33. Government Schemes Table (Value Addition & Agri-Support)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS government_schemes (
        id VARCHAR(100) PRIMARY KEY,
        scheme_name VARCHAR(255) NOT NULL,
        short_code VARCHAR(50) NOT NULL UNIQUE,
        authority VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        eligibility_info TEXT NOT NULL,
        benefits_info TEXT NOT NULL,
        official_source_url VARCHAR(500) NOT NULL,
        last_updated_date VARCHAR(100) NOT NULL,
        created_at VARCHAR(100) NOT NULL,
        KEY idx_gs_code (short_code)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 34. Crop Product Scheme Mappings Table (Value Addition Module)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS crop_product_scheme_mappings (
        id VARCHAR(100) PRIMARY KEY,
        value_added_product_id VARCHAR(100) NOT NULL,
        scheme_id VARCHAR(100) NOT NULL,
        relevance_notes TEXT DEFAULT NULL,
        created_at VARCHAR(100) NOT NULL,
        FOREIGN KEY (value_added_product_id) REFERENCES crop_value_added_products(id) ON DELETE CASCADE,
        FOREIGN KEY (scheme_id) REFERENCES government_schemes(id) ON DELETE CASCADE,
        UNIQUE KEY uk_vap_scheme (value_added_product_id, scheme_id),
        KEY idx_cpsm_vap (value_added_product_id),
        KEY idx_cpsm_scheme (scheme_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Safe Alter Table column addition on products for optional Value-Added Product relationship
    try {
      await pool.query(`ALTER TABLE products ADD COLUMN value_added_product_id VARCHAR(100) NULL;`);
    } catch (e) {
      /* Column may already exist */
    }
    try {
      await pool.query(`ALTER TABLE products ADD CONSTRAINT fk_products_value_added FOREIGN KEY (value_added_product_id) REFERENCES crop_value_added_products(id) ON DELETE SET NULL;`);
    } catch (e) {
      /* Constraint may already exist */
    }
    try {
      await pool.query(`ALTER TABLE processing_guides ADD COLUMN source_reference TEXT;`);
    } catch (e) {
      /* Column may already exist */
    }
    const eqColumns = [
      "ALTER TABLE processing_equipment ADD COLUMN processing_method VARCHAR(100)",
      "ALTER TABLE processing_equipment ADD COLUMN applicable_crops TEXT",
      "ALTER TABLE processing_equipment ADD COLUMN applicable_products TEXT",
      "ALTER TABLE processing_equipment ADD COLUMN purpose TEXT",
      "ALTER TABLE processing_equipment ADD COLUMN capacity_info VARCHAR(255)",
      "ALTER TABLE processing_equipment ADD COLUMN operational_description TEXT",
      "ALTER TABLE processing_equipment ADD COLUMN maintenance_considerations TEXT",
      "ALTER TABLE processing_equipment ADD COLUMN source_reference TEXT"
    ];
    for (const sql of eqColumns) {
      try {
        await pool.query(sql);
      } catch (e) {
        /* Column may already exist */
      }
    }

    const pkgColumns = [
      "ALTER TABLE processing_packaging_storage ADD COLUMN suitable_packaging_material TEXT",
      "ALTER TABLE processing_packaging_storage ADD COLUMN packaging_considerations TEXT",
      "ALTER TABLE processing_packaging_storage ADD COLUMN labelling_considerations TEXT",
      "ALTER TABLE processing_packaging_storage ADD COLUMN storage_conditions TEXT",
      "ALTER TABLE processing_packaging_storage ADD COLUMN moisture_considerations TEXT",
      "ALTER TABLE processing_packaging_storage ADD COLUMN temperature_considerations TEXT",
      "ALTER TABLE processing_packaging_storage ADD COLUMN shelf_life_info VARCHAR(255)",
      "ALTER TABLE processing_packaging_storage ADD COLUMN storage_precautions TEXT",
      "ALTER TABLE processing_packaging_storage ADD COLUMN source_reference TEXT"
    ];
    for (const sql of pkgColumns) {
      try {
        await pool.query(sql);
      } catch (e) {
        /* Column may already exist */
      }
    }

    // Safe Creation of Performance Indexes
    const indexes = [
      "CREATE INDEX idx_users_email ON users(email)",
      "CREATE INDEX idx_users_role ON users(role)",
      "CREATE INDEX idx_ai_user_memory_user ON ai_user_memory(userId)",
      "CREATE INDEX idx_ai_user_memory_type ON ai_user_memory(userId, memoryType)",
      "CREATE INDEX idx_ai_farming_goals_user ON ai_farming_goals(userId)",
      "CREATE INDEX idx_ai_farming_goals_status ON ai_farming_goals(userId, status)",
      "CREATE INDEX idx_ai_followups_user ON ai_followups(userId)",
      "CREATE INDEX idx_ai_followups_status ON ai_followups(userId, status)",
      "CREATE INDEX idx_products_farmerId ON products(farmerId)",
      "CREATE INDEX idx_products_category ON products(category)",
      "CREATE INDEX idx_orders_vendorId ON orders(vendorId)",
      "CREATE INDEX idx_orders_status ON orders(status)",
      "CREATE INDEX idx_orders_createdAt ON orders(createdAt)",
      "CREATE INDEX idx_order_items_orderId ON order_items(orderId)",
      "CREATE INDEX idx_order_items_farmerId ON order_items(farmerId)",
      "CREATE INDEX idx_notifications_userId ON notifications(userId)",
      "CREATE INDEX idx_reviews_productId ON reviews(productId)",
      "CREATE INDEX idx_reviews_farmerId ON reviews(farmerId)",
      "CREATE INDEX idx_conversations_participants ON conversations(farmerId, vendorId)",
      "CREATE INDEX idx_messages_conversationId ON messages(conversationId)",
      "CREATE INDEX idx_payments_orderId ON payments(orderId)",
      "CREATE INDEX idx_payments_gatewayPaymentId ON payments(gatewayPaymentId)",
      "CREATE INDEX idx_payments_gatewayOrderId ON payments(gatewayOrderId)",
      "CREATE INDEX idx_order_tracking_order ON order_tracking_events(order_id)",
      "CREATE INDEX idx_order_tracking_time ON order_tracking_events(timestamp)",
      "CREATE INDEX idx_farm_parcels_user ON farm_parcels(user_id)",
      "CREATE INDEX idx_vap_crop ON crop_value_added_products(crop_name)",
      "CREATE INDEX idx_vap_product ON crop_value_added_products(product_name)",
      "CREATE INDEX idx_pg_vap ON processing_guides(value_added_product_id)",
      "CREATE INDEX idx_pg_method ON processing_guides(processing_method)",
      "CREATE INDEX idx_ps_guide ON processing_stages(guide_id)",
      "CREATE INDEX idx_pe_guide ON processing_equipment(guide_id)",
      "CREATE INDEX idx_pps_guide ON processing_packaging_storage(guide_id)",
      "CREATE INDEX idx_pmi_guide ON processing_market_info(guide_id)",
      "CREATE INDEX idx_products_value_added ON products(value_added_product_id)",
      "CREATE INDEX idx_fpp_farmer ON farmer_processing_projects(farmer_id)",
      "CREATE INDEX idx_fpp_product ON farmer_processing_projects(value_added_product_id)",
      "CREATE INDEX idx_fpp_status ON farmer_processing_projects(farmer_id, status)",
      "CREATE INDEX idx_gs_code ON government_schemes(short_code)",
      "CREATE INDEX idx_cpsm_vap ON crop_product_scheme_mappings(value_added_product_id)",
      "CREATE INDEX idx_cpsm_scheme ON crop_product_scheme_mappings(scheme_id)"
    ];

    for (const sql of indexes) {
      try {
        await pool.query(sql);
      } catch (e) {
        /* Index may already exist */
      }
    }

    // Migration: Ensure seeded farmers have actual geographic coordinates if currently NULL
    try {
      await pool.query(`UPDATE users SET lat = 19.9975, lng = 73.7898, city = 'Nashik', district = 'Nashik' WHERE id = 'f1' AND (lat IS NULL OR lat = 0)`);
      await pool.query(`UPDATE users SET lat = 30.9010, lng = 75.8573, city = 'Ludhiana', district = 'Ludhiana' WHERE id = 'f2' AND (lat IS NULL OR lat = 0)`);
      await pool.query(`UPDATE users SET lat = 11.6854, lng = 76.1320, city = 'Wayanad', district = 'Wayanad' WHERE id = 'f3' AND (lat IS NULL OR lat = 0)`);

      // Ensure products have lat/lng from their farmer if product lat is NULL
      await pool.query(`
        UPDATE products p
        JOIN users u ON p.farmerId = u.id
        SET p.lat = u.lat, p.lng = u.lng,
            p.city = COALESCE(p.city, u.city),
            p.district = COALESCE(p.district, u.district),
            p.region = COALESCE(p.region, u.region)
        WHERE p.lat IS NULL AND u.lat IS NOT NULL
      `);
    } catch (e) {
      console.warn("Coordinate migration warning:", e?.message);
    }

    await seedData();
    await seedGovernmentSchemes();
    await ensureProductTranslations();
  } catch (err) {
    console.error("Error initializing MySQL schema:", err);
  }
}

async function migrateExistingPasswords() {
  try {
    const users = await query.all("SELECT id, password FROM users");
    for (const u of users) {
      if (u.password && !u.password.startsWith("pbkdf2:sha512:")) {
        console.log(`Migrating password for user ${u.id} to secure hash...`);
        const hashedPassword = hashPassword(u.password);
        await query.run("UPDATE users SET password = ? WHERE id = ?", [hashedPassword, u.id]);
      }
    }
  } catch (err) {
    console.error("Error migrating passwords:", err);
  }
}

async function seedData() {
  try {
    const row = await query.get("SELECT COUNT(*) as count FROM users");
    if (row && row.count > 0) {
      await migrateExistingPasswords();
      return;
    }

    console.log("Seeding initial users for FarmConnect 2.0 with hashed passwords into MySQL...");
    const users = [
      ["a1", "admin@farmconnect.com", hashPassword("admin123"), "admin", "Platform Admin", null, "IN", "India", null, null, null, null, null, null, null, "INR", "What is your favorite food?", "apple", "Verified", "FarmConnect Administration Node.", 5.0, 0, "2026-01-01T00:00:00.000Z"],
      ["f1", "farmer@farmconnect.com", hashPassword("farmer123"), "farmer", "Rajesh Kumar", "Green Valley Farms", "IN", "India", "Maharashtra", null, null, null, null, null, null, "INR", "What is your favorite food?", "apple", "Verified", "Pioneering sustainable farming in Nashik valley. Specializing in organic heirloom tomatoes and leafy greens since 2012.", 4.8, 28, "2026-01-10T08:00:00.000Z"],
      ["f2", "satish@farmconnect.com", hashPassword("farmer123"), "farmer", "Satish Patil", "Patil Agri Estates", "IN", "India", "Punjab", null, null, null, null, null, null, "INR", "What is your favorite food?", "apple", "Verified", "High-quality durum grains and wheat supplier. Standardized crop processing and storage.", 4.7, 42, "2026-01-15T08:00:00.000Z"],
      ["f3", "kiran@farmconnect.com", hashPassword("farmer123"), "farmer", "Kiran Dev", "Malabar Spices Orchard", "IN", "India", "Kerala", null, null, null, null, null, null, "INR", "What is your favorite food?", "apple", "Pending", "Direct from Western Ghats. Sun-dried black pepper and cardamom.", 4.5, 5, "2026-03-01T08:00:00.000Z"],
      ["v1", "vendor@farmconnect.com", hashPassword("vendor123"), "vendor", "Ananya's Kitchen", null, "IN", "India", "Maharashtra", null, null, null, null, null, null, "INR", "What is your favorite food?", "apple", "Verified", "B2B cloud kitchen chain supplying premium hotels and corporate canteens.", 5.0, 0, "2026-01-12T08:00:00.000Z"],
      ["v2", "taj@hotels.com", hashPassword("vendor123"), "vendor", "Taj Residency", null, "IN", "India", "Maharashtra", null, null, null, null, null, null, "INR", "What is your favorite food?", "apple", "Verified", "Luxury hospitality and fine dining restaurants.", 5.0, 0, "2026-01-20T08:00:00.000Z"]
    ];

    for (const u of users) {
      await query.run(`
        INSERT IGNORE INTO users (id, email, password, role, name, farmName, countryCode, countryName, region, district, city, postalCode, address, lat, lng, currency, securityQuestion, securityAnswer, verificationStatus, about, rating, completedOrders, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, u);
    }

    console.log("Seeding products with B2B tier prices and MOQs...");
    const products = [
      ["p1", "Organic Heirloom Tomatoes", "Vegetables", "A", 45.0, "INR", "kg", 320, "f1", "IN", null, null, null, null, null, "Vine-ripened, pesticide-free heirloom tomatoes grown using organic compost. High acidity, perfect for gourmet kitchens.", "", 50, '{"100":42,"500":38}', 1, "2026-08-11T00:00:00.000Z", "2026-08-01T12:00:00.000Z"],
      ["p2", "Red Globe Onions", "Vegetables", "A", 22.0, "INR", "kg", 1500, "f1", "IN", null, null, null, null, null, "Fresh, firm red onions harvested this season, ideal for bulk kitchens. Medium pungency.", "", 100, '{"200":20,"1000":17}', 0, "2026-08-10T00:00:00.000Z", "2026-08-01T12:00:00.000Z"],
      ["p3", "Farm Fresh Spinach", "Vegetables", "B", 18.0, "INR", "kg", 150, "f1", "IN", null, null, null, null, null, "Tender leafy spinach, harvested within 24 hours of delivery. Checked for pesticide residue.", "", 20, '{"50":16}', 1, "2026-08-12T00:00:00.000Z", "2026-08-01T12:00:00.000Z"],
      ["p4", "Golden Durum Wheat", "Grains", "B", 32.0, "INR", "kg", 5000, "f2", "IN", null, null, null, null, null, "High-protein durum wheat, ideal for pasta and bakery use. Dry-ventilated storage.", "", 500, '{"1000":30,"3000":28}', 0, "2026-08-01T00:00:00.000Z", "2026-08-01T12:00:00.000Z"],
      ["p5", "Premium Basmati Rice", "Grains", "A", 110.0, "INR", "kg", 2200, "f2", "IN", null, null, null, null, null, "Aged long-grain basmati rice with rich aroma. Traditional Punjab harvest.", "", 100, '{"500":105,"1000":98}', 0, "2026-07-15T00:00:00.000Z", "2026-08-01T12:00:00.000Z"],
      ["p6", "Whole Tellicherry Pepper", "Spices", "A", 450.0, "INR", "kg", 400, "f3", "IN", null, null, null, null, null, "Sun-dried Tellicherry black pepper, high piperine content and bold aroma.", "", 10, '{"50":430,"100":410}', 1, "2026-08-05T00:00:00.000Z", "2026-08-01T12:00:00.000Z"]
    ];

    for (const p of products) {
      await query.run(`
        INSERT IGNORE INTO products (id, name, category, grade, price, currency, unit, stock, farmerId, countryCode, region, district, city, lat, lng, description, imageUrl, moq, tierPrices, organic, harvestDate, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        INSERT INTO notifications (id, userId, text, type, \`read\`, createdAt)
        VALUES (?, ?, ?, ?, ?, ?)
      `, n);
    }

    console.log("Seeding default delivery pricing rules...");
    const existingRules = await query.all("SELECT COUNT(*) as count FROM delivery_pricing_rules");
    if (existingRules && existingRules[0].count === 0) {
      const now = new Date().toISOString();
      const rules = [
        ["rule_1", 0, 5, 30, 0, 1, now, now],
        ["rule_2", 5, 15, 50, 2, 1, now, now],
        ["rule_3", 15, 50, 80, 3, 1, now, now],
        ["rule_4", 50, 999999, 150, 4, 1, now, now]
      ];
      for (const r of rules) {
        await query.run(`
          INSERT INTO delivery_pricing_rules (id, minDistanceKm, maxDistanceKm, baseCharge, perKmCharge, active, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, r);
      }
    }
  } catch (err) {
    console.error("Error seeding initial data:", err);
  }
}

export async function seedGovernmentSchemes() {
  try {
    const existingCount = await query.get("SELECT COUNT(*) as count FROM government_schemes");
    if (existingCount && existingCount.count > 0) {
      const mappingCount = await query.get("SELECT COUNT(*) as count FROM crop_product_scheme_mappings");
      if (mappingCount && mappingCount.count > 0) {
        return;
      }
    }

    console.log("Seeding official Government Schemes & Crop Product Mappings...");
    const now = new Date().toISOString();

    const schemes = [
      {
        id: "gs_pmfme",
        short_code: "PMFME",
        scheme_name: "PM Formalisation of Micro Food Processing Enterprises (PMFME) Scheme",
        authority: "Ministry of Food Processing Industries (MoFPI), Govt. of India",
        description: "Credit-linked financial, technical, and business support for micro food processing enterprises, individual farmers, FPOs, and SHGs to upgrade or set up food processing units.",
        eligibility_info: "Individual micro-entrepreneurs, Farmer Producer Organizations (FPOs), Self Help Groups (SHGs), and Cooperatives engaged in food processing. Existing micro-units or new individual/group processing ventures are eligible. Subject to official verification by State Nodal Agencies.",
        benefits_info: "35% credit-linked capital subsidy up to ₹10 Lakhs per unit. Seed capital of ₹40,000 per SHG member for working capital & small tools. Grant for common infrastructure & branding.",
        official_source_url: "https://pmfme.mofpi.gov.in",
        last_updated_date: "2026-03-01"
      },
      {
        id: "gs_pmegp",
        short_code: "PMEGP",
        scheme_name: "Prime Minister's Employment Generation Programme (PMEGP)",
        authority: "Khadi and Village Industries Commission (KVIC) & Ministry of MSME",
        description: "Credit-linked subsidy program aimed at generating self-employment opportunities through establishment of micro-enterprises in non-farm sectors including rural agro-processing.",
        eligibility_info: "Any individual above 18 years of age. For project costs above ₹10 Lakhs in manufacturing/processing, VIII std pass required. FPOs, SHGs, and Registered Societies are eligible. Subject to DIC/KVIC committee approval.",
        benefits_info: "Margin money subsidy ranging from 15% to 35% of project cost (up to ₹50 Lakhs for manufacturing/processing units). Lower beneficiary contribution (5% for special categories, 10% for general).",
        official_source_url: "https://www.kviconline.gov.in/pmegpeportal/pmegphome/index.jsp",
        last_updated_date: "2026-02-15"
      },
      {
        id: "gs_nmeo",
        short_code: "NMEO",
        scheme_name: "National Mission on Edible Oils (NMEO)",
        authority: "Department of Agriculture & Farmers Welfare (MoA&FW), Govt. of India",
        description: "Mission focused on boosting domestic oilseed production and processing capacity for groundnut, mustard, soybean, sesame, sunflower, and rice bran oil extraction.",
        eligibility_info: "Oilseed growers, registered FPOs, primary processors, and oil extraction cooperatives. Subject to State Department of Agriculture norms.",
        benefits_info: "Financial assistance for mini oil mills, expeller machinery, seed storage infrastructure, and seed hub development subsidies up to 40-50% for collective entities.",
        official_source_url: "https://nmeo.dac.gov.in",
        last_updated_date: "2026-01-20"
      },
      {
        id: "gs_cdb",
        short_code: "CDB",
        scheme_name: "Technology Mission on Coconut & Post-Harvest Processing Support",
        authority: "Coconut Development Board (Ministry of Agriculture & Farmers Welfare)",
        description: "Support for establishment of modern coconut processing units, copra dryers, virgin coconut oil (VCO) units, coconut flour, activated carbon, and neera processing.",
        eligibility_info: "Coconut farmers, processing cooperatives, FPOs, and private entrepreneurs setting up coconut value-addition units. Subject to CDB technical project appraisal.",
        benefits_info: "Capital subsidy up to 25% of project cost (max ₹50 Lakhs for individuals, up to 50% for cooperatives/FPOs). Assistance for market promotion and organic certification.",
        official_source_url: "https://www.coconutboard.gov.in",
        last_updated_date: "2026-02-28"
      },
      {
        id: "gs_spices",
        short_code: "SPICES_BOARD",
        scheme_name: "Spices Board Export Development & Post-Harvest Quality Support Scheme",
        authority: "Spices Board India, Ministry of Commerce & Industry, Govt. of India",
        description: "Financial support for post-harvest clean-up, spice blanching, grinding, packaging, quality testing, and setting up spice processing facilities for export and domestic markets.",
        eligibility_info: "Registered spice growers, spice processing units, and exporter-farmers. Unit must meet Spices Board registration standards.",
        benefits_info: "Grant up to 33.33% to 50% for post-harvest machinery (spice pulverizers, dryers, vacuum sealers, moisture meters). Subsidy for food safety certifications (HACCP/ISO).",
        official_source_url: "https://www.indianspices.com",
        last_updated_date: "2026-03-05"
      },
      {
        id: "gs_millets",
        short_code: "NUTRIMILLETS",
        scheme_name: "National Mission on Millets & Nutrihub Startup Assistance",
        authority: "ICAR-Indian Institute of Millets Research (IIMR) & Ministry of Agriculture",
        description: "Targeted incentives for millet (Shree Anna) processing, value-added food product development (millet flour, flakes, bakery items, RTE snacks), and millet entrepreneurship.",
        eligibility_info: "Millet growers, FPOs, food startups, and processors working with sorghum, pearl millet, finger millet, and small millets. Subject to Nutrihub screening.",
        benefits_info: "Incubation support, seed funding grant up to ₹25 Lakhs for innovative millet processing startups, primary processing machinery subsidy, and branding support.",
        official_source_url: "https://millets.res.in",
        last_updated_date: "2026-03-10"
      },
      {
        id: "gs_apeda",
        short_code: "APEDA",
        scheme_name: "APEDA Financial Assistance Scheme for Agriculture Export Infrastructure",
        authority: "Agricultural & Processed Food Products Export Development Authority (APEDA)",
        description: "Support for establishing pack-houses, cold chain facilities, quality testing laboratories, and specialized export packaging for high-value agricultural & processed products.",
        eligibility_info: "APEDA registered exporters, grower-exporters, FPOs, and processing units exporting fresh and processed agricultural goods. Subject to APEDA evaluation.",
        benefits_info: "Financial assistance up to 40-50% of capital cost for pack-house equipment, sorting/grading lines, cold storage, and export packaging standardization.",
        official_source_url: "https://apeda.gov.in",
        last_updated_date: "2026-02-10"
      },
      {
        id: "gs_trifed",
        short_code: "VDVK",
        scheme_name: "Pradhan Mantri Van Dhan Vikas Yojana (PMVDVY)",
        authority: "TRIFED, Ministry of Tribal Affairs, Govt. of India",
        description: "Livelihood scheme for tribal gatherers and small farmers focusing on value addition, primary processing, packaging, and marketing of Minor Forest Produce and tribal agri-products.",
        eligibility_info: "Members of Van Dhan Vikas Kendras (VDVKs), tribal farmer groups, forest dwellers, and SHGs. Subject to State Nodal Agency enrollment.",
        benefits_info: "100% central grant for establishing processing centers, supply of equipment kits, skill training, and integration with Tribes India market network.",
        official_source_url: "https://trifed.tribal.gov.in",
        last_updated_date: "2026-01-15"
      }
    ];

    for (const s of schemes) {
      await query.run(
        `INSERT INTO government_schemes 
         (id, scheme_name, short_code, authority, description, eligibility_info, benefits_info, official_source_url, last_updated_date, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           scheme_name = VALUES(scheme_name),
           authority = VALUES(authority),
           description = VALUES(description),
           eligibility_info = VALUES(eligibility_info),
           benefits_info = VALUES(benefits_info),
           official_source_url = VALUES(official_source_url),
           last_updated_date = VALUES(last_updated_date)`,
        [s.id, s.scheme_name, s.short_code, s.authority, s.description, s.eligibility_info, s.benefits_info, s.official_source_url, s.last_updated_date, now]
      );
    }

    const products = await query.all("SELECT id, crop_name, product_name, category FROM crop_value_added_products");

    for (const p of products) {
      const cropLower = (p.crop_name || "").toLowerCase();
      const nameLower = (p.product_name || "").toLowerCase();

      const mappedSchemes = [];

      mappedSchemes.push({ schemeId: "gs_pmfme", notes: `Eligible for PMFME 35% credit-linked capital subsidy for setting up micro ${p.product_name} processing unit.` });
      mappedSchemes.push({ schemeId: "gs_pmegp", notes: `Eligible for KVIC PMEGP margin money subsidy (15-35%) for rural micro-enterprise development.` });

      if (cropLower.includes("millet") || cropLower.includes("ragi") || cropLower.includes("bajra") || cropLower.includes("sorghum") || cropLower.includes("jowar")) {
        mappedSchemes.push({ schemeId: "gs_millets", notes: `Directly supported under National Millet Mission (Shree Anna) & Nutrihub incubation grant for millet processing.` });
      }

      if (cropLower.includes("groundnut") || cropLower.includes("mustard") || nameLower.includes("oil")) {
        mappedSchemes.push({ schemeId: "gs_nmeo", notes: `Supported under National Mission on Edible Oils (NMEO) for mini oil mill & expeller unit installation.` });
      }

      if (cropLower.includes("coconut")) {
        mappedSchemes.push({ schemeId: "gs_cdb", notes: `Eligible for Coconut Development Board (CDB) Technology Mission grant up to 25-50% for coconut processing units.` });
      }

      if (cropLower.includes("pepper") || cropLower.includes("turmeric") || cropLower.includes("ginger") || cropLower.includes("garlic") || cropLower.includes("chilli") || cropLower.includes("cardamom") || cropLower.includes("coriander")) {
        mappedSchemes.push({ schemeId: "gs_spices", notes: `Supported under Spices Board post-harvest quality enhancement & spice processing subsidy.` });
      }

      if (cropLower.includes("mango") || cropLower.includes("tomato") || cropLower.includes("pepper") || cropLower.includes("cardamom")) {
        mappedSchemes.push({ schemeId: "gs_apeda", notes: `Eligible for APEDA financial assistance for export-quality packaging, grading, and cold chain infrastructure.` });
      }

      for (const ms of mappedSchemes) {
        const mappingId = `cpsm_${p.id}_${ms.schemeId}`;
        await query.run(
          `INSERT INTO crop_product_scheme_mappings (id, value_added_product_id, scheme_id, relevance_notes, created_at)
           VALUES (?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE relevance_notes = VALUES(relevance_notes)`,
          [mappingId, p.id, ms.schemeId, ms.notes, now]
        );
      }
    }
    console.log("Seeding of Government Schemes & Product Mappings completed successfully.");
    await ensurePhaseBTables();
  } catch (err) {
    console.error("Error seeding Government Schemes:", err.message);
  }
}

export async function ensurePhaseBTables() {
  try {
    console.log("Ensuring Phase B (Farming Guide, Diary, Economics, Planner) database tables...");

    await pool.query(`
      CREATE TABLE IF NOT EXISTS crops (
        id VARCHAR(100) PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        scientific_name VARCHAR(150),
        category VARCHAR(100),
        suitable_regions TEXT,
        seasons TEXT,
        duration_days INT,
        soil_requirements TEXT,
        soil_texture TEXT,
        ph_min DECIMAL(4, 2),
        ph_max DECIMAL(4, 2),
        drainage TEXT,
        climate TEXT,
        temperature_min_c DECIMAL(4, 1),
        temperature_max_c DECIMAL(4, 1),
        rainfall_min_mm INT,
        rainfall_max_mm INT,
        humidity TEXT,
        sunlight TEXT,
        land_preparation TEXT,
        source VARCHAR(255) DEFAULT 'Authoritative Agricultural Extension (ICAR/TNAU/KVK)',
        last_verified VARCHAR(100),
        created_at VARCHAR(100),
        KEY idx_crops_category (category),
        KEY idx_crops_name (name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS crop_growth_stages (
        id VARCHAR(100) PRIMARY KEY,
        crop_id VARCHAR(100) NOT NULL,
        stage_order INT NOT NULL,
        stage_name VARCHAR(100) NOT NULL,
        duration_days INT,
        start_day INT,
        end_day INT,
        farmer_activity TEXT,
        irrigation_consideration TEXT,
        nutrient_consideration TEXT,
        pest_monitoring TEXT,
        notes TEXT,
        created_at VARCHAR(100),
        FOREIGN KEY (crop_id) REFERENCES crops(id) ON DELETE CASCADE,
        UNIQUE KEY uk_crop_stage (crop_id, stage_order),
        KEY idx_cgs_crop (crop_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS crop_rotation_rules (
        id VARCHAR(100) PRIMARY KEY,
        previous_crop_name VARCHAR(100) NOT NULL,
        suggested_crop_name VARCHAR(100) NOT NULL,
        compatibility_level VARCHAR(50) DEFAULT 'SUGGESTED',
        reasons TEXT,
        benefits TEXT,
        crops_to_avoid TEXT,
        field_preparation TEXT,
        gap_months INT,
        created_at VARCHAR(100),
        KEY idx_crr_prev (previous_crop_name),
        KEY idx_crr_sug (suggested_crop_name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS crop_seed_sowing_guides (
        id VARCHAR(100) PRIMARY KEY,
        crop_id VARCHAR(100) NOT NULL,
        seed_rate_per_acre VARCHAR(100),
        seed_selection TEXT,
        seed_quality TEXT,
        seed_treatment TEXT,
        sowing_method TEXT,
        sowing_period VARCHAR(150),
        spacing VARCHAR(100),
        depth_cm DECIMAL(4, 1),
        nursery_transplanting TEXT,
        created_at VARCHAR(100),
        FOREIGN KEY (crop_id) REFERENCES crops(id) ON DELETE CASCADE,
        KEY idx_cssg_crop (crop_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS crop_irrigation_guides (
        id VARCHAR(100) PRIMARY KEY,
        crop_id VARCHAR(100) NOT NULL,
        water_requirement_mm VARCHAR(100),
        method VARCHAR(100),
        critical_stages TEXT,
        water_stress_signs TEXT,
        overwatering_signs TEXT,
        rainfall_considerations TEXT,
        drip_sprinkler_suitability TEXT,
        created_at VARCHAR(100),
        FOREIGN KEY (crop_id) REFERENCES crops(id) ON DELETE CASCADE,
        KEY idx_cig_crop (crop_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS crop_nutrient_guides (
        id VARCHAR(100) PRIMARY KEY,
        crop_id VARCHAR(100) NOT NULL,
        n_recommendation_kg_per_acre VARCHAR(100),
        p_recommendation_kg_per_acre VARCHAR(100),
        k_recommendation_kg_per_acre VARCHAR(100),
        micronutrients TEXT,
        deficiency_symptoms TEXT,
        growth_stage_timing TEXT,
        soil_test_importance TEXT,
        management_notes TEXT,
        created_at VARCHAR(100),
        FOREIGN KEY (crop_id) REFERENCES crops(id) ON DELETE CASCADE,
        KEY idx_cng_crop (crop_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS crop_pest_diseases (
        id VARCHAR(100) PRIMARY KEY,
        crop_id VARCHAR(100) NOT NULL,
        name VARCHAR(255) NOT NULL,
        type VARCHAR(50) DEFAULT 'Pest',
        symptoms TEXT,
        affected_part VARCHAR(150),
        favoring_conditions TEXT,
        prevention TEXT,
        integrated_management TEXT,
        expert_help_indication TEXT,
        source VARCHAR(255) DEFAULT 'Authoritative Agricultural Extension (ICAR/TNAU/KVK)',
        created_at VARCHAR(100),
        FOREIGN KEY (crop_id) REFERENCES crops(id) ON DELETE CASCADE,
        KEY idx_cpd_crop (crop_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS crop_harvest_post_harvest (
        id VARCHAR(100) PRIMARY KEY,
        crop_id VARCHAR(100) NOT NULL,
        maturity_indicators TEXT,
        timing TEXT,
        harvest_method TEXT,
        handling TEXT,
        quality_indicators TEXT,
        cleaning TEXT,
        sorting_grading TEXT,
        drying TEXT,
        storage TEXT,
        packaging TEXT,
        transportation TEXT,
        quality_preservation TEXT,
        created_at VARCHAR(100),
        FOREIGN KEY (crop_id) REFERENCES crops(id) ON DELETE CASCADE,
        KEY idx_chph_crop (crop_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS farmer_farm_diary (
        id VARCHAR(100) PRIMARY KEY,
        farmer_id VARCHAR(100) NOT NULL,
        crop_name VARCHAR(100) NOT NULL,
        area_acres DECIMAL(10, 2) NOT NULL DEFAULT 1.00,
        sowing_date VARCHAR(100),
        location VARCHAR(255),
        seed_info TEXT,
        irrigation_activity TEXT,
        nutrient_activity TEXT,
        pest_observation TEXT,
        notes TEXT,
        expenses DECIMAL(12, 2) DEFAULT 0.00,
        harvest_qty DECIMAL(12, 2) DEFAULT 0.00,
        selling_price DECIMAL(12, 2) DEFAULT 0.00,
        created_at VARCHAR(100) NOT NULL,
        updated_at VARCHAR(100) NOT NULL,
        FOREIGN KEY (farmer_id) REFERENCES users(id) ON DELETE CASCADE,
        KEY idx_ffd_farmer (farmer_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS farmer_farm_economics (
        id VARCHAR(100) PRIMARY KEY,
        farmer_id VARCHAR(100) NOT NULL,
        crop_name VARCHAR(100) NOT NULL,
        area_acres DECIMAL(10, 2) NOT NULL DEFAULT 1.00,
        seed_cost DECIMAL(12, 2) DEFAULT 0.00,
        fertilizer_cost DECIMAL(12, 2) DEFAULT 0.00,
        labour_cost DECIMAL(12, 2) DEFAULT 0.00,
        irrigation_cost DECIMAL(12, 2) DEFAULT 0.00,
        pest_cost DECIMAL(12, 2) DEFAULT 0.00,
        transport_cost DECIMAL(12, 2) DEFAULT 0.00,
        other_cost DECIMAL(12, 2) DEFAULT 0.00,
        total_cost DECIMAL(12, 2) DEFAULT 0.00,
        expected_yield_qty DECIMAL(12, 2) DEFAULT 0.00,
        expected_yield_unit VARCHAR(50) DEFAULT 'kg',
        expected_selling_price DECIMAL(12, 2) DEFAULT 0.00,
        expected_revenue DECIMAL(12, 2) DEFAULT 0.00,
        estimated_profit DECIMAL(12, 2) DEFAULT 0.00,
        profit_per_acre DECIMAL(12, 2) DEFAULT 0.00,
        notes TEXT,
        created_at VARCHAR(100) NOT NULL,
        updated_at VARCHAR(100) NOT NULL,
        FOREIGN KEY (farmer_id) REFERENCES users(id) ON DELETE CASCADE,
        KEY idx_ffe_farmer (farmer_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    console.log("Phase B database tables ensured successfully.");
  } catch (err) {
    console.error("Error ensuring Phase B tables:", err.message);
  }
}

export async function ensureProductTranslations() {
  try {
    // Seed Multilingual Product Translations
    console.log("Seeding multilingual product translations...");
    const allExistingProds = await query.all("SELECT id, name FROM products");
    const translationTemplates = [
      {
        matchKeyword: "Tomato",
        translations: {
          ta: { name: "பாரம்பரிய நாட்டு தக்காளி", description: "இயற்கை உரம் கொண்டு விளைவிக்கப்பட்ட சுவையான நாட்டுத் தக்காளி. சமையல் மற்றும் உணவக பயன்பாட்டிற்கு மிகச் சிறந்தது." },
          hi: { name: "जैविक देशी टमाटर", description: "जैविक खाद से उगाए गए प्राकृतिक लाल टमाटर। होटलों और थोक रसोई के लिए सर्वोत्तम गुणवत्ता।" },
          te: { name: "సేంద్రీయ నాటు టమోటాలు", description: "సేంద్రీయ పద్ధతిలో పండించిన తాజా నాటు టమోటాలు. రెస్టారెంట్లు మరియు గృహ అవసరాలకు శ్రేష్టమైనవి." },
          ml: { name: "ജൈവ നാടൻ തക്കാളി", description: "കീടനാശിനി പ്രയോഗമില്ലാതെ വിളവെടുത്ത നാടൻ തക്കാളി. മികച്ച ഗുണനിലവാരം." }
        }
      },
      {
        matchKeyword: "Pepper",
        translations: {
          ta: { name: "தலச்சேரி முழு கருப்பு மிளகு", description: "சூரிய ஒளியில் உலர்த்தப்பட்ட உயர் ரக தலச்சேரி மிளகு. அடர்ந்த நறுமணம் மற்றும் காரத்தன்மை கொண்டது." },
          hi: { name: "साबुत तेल्लीचेरी काली मिर्च", description: "धूप में सुखाई गई प्रीमियम तेल्लीचेरी काली मिर्च। उच्च पिपेरिन और तीव्र सुगंध।" },
          te: { name: "మొత్తం తెల్లిచ్చేరి నల్ల మిరియాలు", description: "సహజ ఎండలో ఎండబెట్టిన మేలైన తెల్లిచ్చేరి మిరియాలు. ఘాటైన సువాసన మరియు నాణ్యత." },
          ml: { name: "തലശ്ശേരി കുരുമുളക്", description: "പ്രകൃതിദത്തമായി ഉണക്കിയെടുത്ത ഒന്നാം തരം തലശ്ശേരി കുരുമുളക്. തീവ്രമായ സുഗന്ധവും എരിവും." }
        }
      },
      {
        matchKeyword: "Spinach",
        translations: {
          ta: { name: "பண்ணை புதிய பசலைக்கீரை", description: "அறுவடை செய்யப்பட்ட 24 மணி நேரத்திற்குள் விநியோகிக்கப்படும் புதிய பசுமையான பசலைக்கீரை." },
          hi: { name: "खेत का ताज़ा पालक", description: "ताज़ा तोड़ा गया हरा पत्तेदार पालक। बिना किसी रासायनिक अवशेष के स्वच्छ और पौष्टिक।" },
          te: { name: "తోట తాజా పాలకూర", description: "కోసిన 24 గంటల్లోనే సరఫరా చేయబడే తాజా ఆకుకూర. రసాయన రహితం." },
          ml: { name: "ഫാം ഫ്രഷ് ചീര", description: "തോട്ടത്തിൽ നിന്ന് നേരിട്ട് ശേഖരിച്ച പച്ചക്കറികൾ. 24 മണിക്കൂറിനുള്ളിൽ ഡെലിവറി." }
        }
      },
      {
        matchKeyword: "Rice",
        translations: {
          ta: { name: "பிரீமியம் பாசுமதி அரிசி", description: "நீண்ட பாரம்பரிய மணம் கொண்ட பழமையான பாசுமதி அரிசி. பிரியாணி மற்றும் சிறப்பு உணவுகளுக்கு ஏற்றது." },
          hi: { name: "प्रीमियम बासमती चावल", description: "पारंपरिक पंजाब का सुगंधित बासमती चावल। लंबे दाने और उत्कृष्ट स्वाद।" },
          te: { name: "ప్రీమియం బాస్మతి బియ్యం", description: "సువాసన భరితమైన పొడవైన గింజల బాస్మతి బియ్యం. సంప్రదాయ పద్ధతిలో నిల్వ చేసినది." },
          ml: { name: "പ്രീമിയം ബസുമതി അരി", description: "നല്ല സുഗന്ധമുള്ള നീളമുള്ള ബസുമതി അരി. പരമ്പരാഗതമായി പക്വതയാർന്നത്." }
        }
      },
      {
        matchKeyword: "Mango",
        translations: {
          ta: { name: "ஏற்றுமதி ரக அல்போன்சா மாம்பழங்கள்", description: "ரத்னகிரி தோட்டங்களில் இருந்து அறுவடை செய்யப்பட்ட இனிப்பான, தரம் பிரிக்கப்பட்ட மாம்பழங்கள்." },
          hi: { name: "निर्यात गुणवत्ता अल्फांसो आम", description: "रत्नागिरी के बागानों से चुने हुए मीठे और सुगंधित अल्फांसो आम।" },
          te: { name: "ఎగుమతి నాణ్యత అల్ఫోన్సో మామిడిపండ్లు", description: "రత్నగిరి తోటల నుండి సేకరించిన అత్యుత్తమ అల్ఫోన్సో మామిడిపండ్లు." },
          ml: { name: "കയറ്റുമതി ആൽഫോൻസോ മാങ്ങകൾ", description: "രത്നഗിരി തോട്ടങ്ങളിൽ നിന്നുള്ള മികച്ച ആൽഫോൻസോ മാമ്പഴം." }
        }
      },
      {
        matchKeyword: "Onion",
        translations: {
          ta: { name: "சிவப்பு உருண்டை வெங்காயம்", description: "மொத்த சமையலறை பயன்பாட்டிற்கு ஏற்ற நடுத்தர காரம் கொண்ட புதிய சிவப்பு வெங்காயம்." },
          hi: { name: "लाल गोल प्याज", description: "थोक रसोई के लिए उपयुक्त ताज़ा और टिकाऊ लाल प्याज।" },
          te: { name: "ఎర్ర గుండ్రని ఉల్లిపాయలు", description: "హోల్‌సేల్ మార్కెట్ కోసం తాజా నాణ్యమైన ఎర్ర ఉల్లిపాయలు." },
          ml: { name: "ചുവന്ന ഉള്ളി", description: "ഗുണനിലവാരമുള്ള പുതിയ ചുവന്ന ഉള്ളി. മൊത്ത വ്യാപാരത്തിന് അനുയോജ്യം." }
        }
      },
      {
        matchKeyword: "Wheat",
        translations: {
          ta: { name: "தங்க துரம் கோதுமை", description: "பாஸ்தா மற்றும் பேக்கரி பயன்பாட்டிற்கு உகந்த உயர் புரதச்சத்து கொண்ட துரம் கோதுமை." },
          hi: { name: "सुनहरा ड्यूरम गेहूं", description: "उच्च प्रोटीन वाला ड्यूरम गेहूं, बेकरी और पास्ता के लिए उत्कृष्ट।" },
          te: { name: "బంగారు డ్యూరం గోధుమలు", description: "అధిక ప్రోటీన్ కలిగిన డ్యూరం గోధుమలు." },
          ml: { name: "ഗോൾഡൻ ഡ്യൂറം ഗോതമ്പ്", description: "ഉയർന്ന പ്രോട്ടീൻ അടങ്ങിയ ഡ്യൂറം ഗോതമ്പ്." }
        }
      }
    ];

    const nowIso = new Date().toISOString();
    for (const prod of (allExistingProds || [])) {
      for (const tpl of translationTemplates) {
        if (prod.name && prod.name.toLowerCase().includes(tpl.matchKeyword.toLowerCase())) {
          for (const [langCode, tData] of Object.entries(tpl.translations)) {
            const transId = `pt_${prod.id}_${langCode}`;
            await query.run(`
              INSERT INTO product_translations (id, product_id, language_code, name, description, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?)
              ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description), updated_at = VALUES(updated_at)
            `, [transId, prod.id, langCode, tData.name, tData.description, nowIso, nowIso]);
          }
        }
      }
    }

    isDbConnected = true;
    dbConnectionError = null;
    hasLoggedDbConnWarning = false;
    console.log(`Connected & initialized MySQL database "${dbName}" at ${dbHost}:${dbPort} successfully!`);
  } catch (err) {
    isDbConnected = false;
    dbConnectionError = err;
    if (err.code === "ECONNREFUSED" || err.originalCode === "ECONNREFUSED") {
      if (!hasLoggedDbConnWarning) {
        hasLoggedDbConnWarning = true;
        console.warn(`\n[MYSQL NOTICE] MySQL service unreachable at ${dbHost}:${dbPort} (ECONNREFUSED).`);
        console.warn(`To enable persistent database storage, start MySQL (XAMPP / Windows service). Background auto-reconnect is active.\n`);
      }
    } else {
      console.error("Database initialization error:", err.message || err);
    }
    // Schedule silent auto-retry in 10 seconds without flooding console
    setTimeout(() => {
      if (!isDbConnected) {
        initDatabase().catch(() => {});
      }
    }, 10000);
  }
}

// Trigger initial async schema creation
export const dbInitPromise = initDatabase().catch(() => {});

export default pool;
