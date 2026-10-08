-- ============================================================
-- FarmConnect 2.0 - Complete MySQL Database Schema & Seed Data
-- Database Name: farmconnect
-- Default Host: 127.0.0.1:3306
-- ============================================================

CREATE DATABASE IF NOT EXISTS `farmconnect` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `farmconnect`;

-- 1. Users Table
CREATE TABLE IF NOT EXISTS `users` (
  `id` VARCHAR(100) PRIMARY KEY,
  `email` VARCHAR(255) UNIQUE,
  `google_id` VARCHAR(255) UNIQUE,
  `password` VARCHAR(255) NULL,
  `role` VARCHAR(50),
  `name` VARCHAR(255),
  `mobile` VARCHAR(20),
  `farmName` VARCHAR(255),
  `farmSize` VARCHAR(50),
  `farmingExperience` VARCHAR(50),
  `cropsGrown` TEXT,
  `primaryCrop` VARCHAR(100),
  `expectedQuantity` VARCHAR(100),
  `businessName` VARCHAR(255),
  `businessType` VARCHAR(100),
  `gstin` VARCHAR(50),
  `procurementCategories` TEXT,
  `procurementQuantity` VARCHAR(100),
  `countryCode` VARCHAR(10) DEFAULT 'IN',
  `countryName` VARCHAR(100) DEFAULT 'India',
  `region` VARCHAR(100),
  `district` VARCHAR(100),
  `city` VARCHAR(100),
  `postalCode` VARCHAR(20),
  `address` TEXT,
  `lat` DECIMAL(10, 7),
  `lng` DECIMAL(10, 7),
  `currency` VARCHAR(10) DEFAULT 'INR',
  `securityQuestion` TEXT,
  `securityAnswer` TEXT,
  `verificationStatus` VARCHAR(50) DEFAULT 'Pending',
  `email_verified` TINYINT(1) DEFAULT 0,
  `mobile_verified` TINYINT(1) DEFAULT 0,
  `account_status` VARCHAR(50) DEFAULT 'ACTIVE',
  `terms_accepted` TINYINT(1) DEFAULT 1,
  `terms_accepted_at` VARCHAR(100),
  `about` TEXT,
  `rating` DECIMAL(3, 2) DEFAULT 5.00,
  `completedOrders` INT DEFAULT 0,
  `createdAt` VARCHAR(100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Products Table
CREATE TABLE IF NOT EXISTS `products` (
  `id` VARCHAR(100) PRIMARY KEY,
  `name` VARCHAR(255),
  `category` VARCHAR(100),
  `grade` VARCHAR(50),
  `price` DECIMAL(10, 2),
  `currency` VARCHAR(10) DEFAULT 'INR',
  `unit` VARCHAR(50),
  `stock` INT DEFAULT 0,
  `farmerId` VARCHAR(100),
  `countryCode` VARCHAR(10) DEFAULT 'IN',
  `region` VARCHAR(100),
  `district` VARCHAR(100),
  `city` VARCHAR(100),
  `lat` DECIMAL(10, 7),
  `lng` DECIMAL(10, 7),
  `description` TEXT,
  `imageUrl` TEXT,
  `moq` INT DEFAULT 10,
  `tierPrices` TEXT,
  `organic` TINYINT(1) DEFAULT 0,
  `harvestDate` VARCHAR(100),
  `createdAt` VARCHAR(100),
  FOREIGN KEY (`farmerId`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2b. Product Translations Table (Multilingual Dynamic Marketplace)
CREATE TABLE IF NOT EXISTS `product_translations` (
  `id` VARCHAR(100) PRIMARY KEY,
  `product_id` VARCHAR(100) NOT NULL,
  `language_code` VARCHAR(10) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `description` TEXT,
  `created_at` VARCHAR(100),
  `updated_at` VARCHAR(100),
  UNIQUE KEY `uk_prod_lang` (`product_id`, `language_code`),
  FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Orders Table
CREATE TABLE IF NOT EXISTS `orders` (
  `id` VARCHAR(100) PRIMARY KEY,
  `vendorId` VARCHAR(100),
  `vendorName` VARCHAR(255),
  `deliveryCountry` VARCHAR(100) DEFAULT 'India',
  `deliveryRegion` VARCHAR(100),
  `deliveryDistrict` VARCHAR(100),
  `deliveryCity` VARCHAR(100),
  `deliveryPostalCode` VARCHAR(20),
  `deliveryAddress` TEXT,
  `deliveryLat` DECIMAL(10, 7) DEFAULT NULL,
  `deliveryLng` DECIMAL(10, 7) DEFAULT NULL,
  `paymentMethod` VARCHAR(50),
  `totalAmount` DECIMAL(12, 2),
  `subtotal` DECIMAL(12, 2),
  `deliveryCharge` DECIMAL(10, 2) DEFAULT 0.00,
  `deliveryDistanceKm` DECIMAL(8, 2),
  `deliveryEtaMinutes` INT,
  `paymentStatus` VARCHAR(50) DEFAULT 'PENDING_PAYMENT',
  `paymentId` VARCHAR(100),
  `currency` VARCHAR(10) DEFAULT 'INR',
  `status` VARCHAR(50) DEFAULT 'Pending',
  `createdAt` VARCHAR(100),
  FOREIGN KEY (`vendorId`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Order Items Table
CREATE TABLE IF NOT EXISTS `order_items` (
  `id` VARCHAR(100) PRIMARY KEY,
  `orderId` VARCHAR(100),
  `productId` VARCHAR(100),
  `farmerId` VARCHAR(100),
  `qty` INT,
  `unitPrice` DECIMAL(10, 2),
  `amount` DECIMAL(12, 2),
  FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`farmerId`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. Notifications Table
CREATE TABLE IF NOT EXISTS `notifications` (
  `id` VARCHAR(100) PRIMARY KEY,
  `userId` VARCHAR(100),
  `text` TEXT,
  `type` VARCHAR(50),
  `read` TINYINT(1) DEFAULT 0,
  `createdAt` VARCHAR(100),
  FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6. Reviews Table
CREATE TABLE IF NOT EXISTS `reviews` (
  `id` VARCHAR(100) PRIMARY KEY,
  `productId` VARCHAR(100),
  `farmerId` VARCHAR(100),
  `vendorId` VARCHAR(100),
  `vendorName` VARCHAR(255),
  `rating` INT,
  `comment` TEXT,
  `verifiedPurchase` TINYINT(1) DEFAULT 0,
  `status` VARCHAR(50) DEFAULT 'Approved',
  `createdAt` VARCHAR(100),
  FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`farmerId`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`vendorId`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 7. Saved Searches Table
CREATE TABLE IF NOT EXISTS `saved_searches` (
  `id` VARCHAR(100) PRIMARY KEY,
  `vendorId` VARCHAR(100),
  `query` TEXT,
  `filters` TEXT,
  `createdAt` VARCHAR(100),
  FOREIGN KEY (`vendorId`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 8. AI Conversations Table
CREATE TABLE IF NOT EXISTS `ai_conversations` (
  `id` VARCHAR(100) PRIMARY KEY,
  `userId` VARCHAR(100),
  `title` VARCHAR(255),
  `createdAt` VARCHAR(100),
  `updatedAt` VARCHAR(100),
  FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 9. AI Messages Table
CREATE TABLE IF NOT EXISTS `ai_messages` (
  `id` VARCHAR(100) PRIMARY KEY,
  `conversationId` VARCHAR(100),
  `role` VARCHAR(50),
  `content` TEXT,
  `toolName` VARCHAR(100),
  `toolResult` LONGTEXT,
  `createdAt` VARCHAR(100),
  FOREIGN KEY (`conversationId`) REFERENCES `ai_conversations`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 10. AI Insights Table
CREATE TABLE IF NOT EXISTS `ai_insights` (
  `id` VARCHAR(100) PRIMARY KEY,
  `userId` VARCHAR(100),
  `type` VARCHAR(50),
  `data` TEXT,
  `createdAt` VARCHAR(100),
  FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 10b. AI Proactive Insights Table (Phase 7)
CREATE TABLE IF NOT EXISTS `ai_proactive_insights` (
  `id` VARCHAR(100) PRIMARY KEY,
  `userId` VARCHAR(100) NOT NULL,
  `type` VARCHAR(50) NOT NULL,
  `severity` VARCHAR(20) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `message` TEXT NOT NULL,
  `facts` TEXT NOT NULL,
  `reasoning` TEXT NOT NULL,
  `metadata` TEXT,
  `status` VARCHAR(20) DEFAULT 'active',
  `createdAt` VARCHAR(100) NOT NULL,
  `expiresAt` VARCHAR(100),
  `readAt` VARCHAR(100),
  FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  KEY `idx_proactive_user` (`userId`),
  KEY `idx_proactive_type_user` (`userId`, `type`),
  KEY `idx_proactive_status_user` (`userId`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 10c. AI Image Analyses Table (Phase 8)
CREATE TABLE IF NOT EXISTS `ai_image_analyses` (
  `id` VARCHAR(100) PRIMARY KEY,
  `userId` VARCHAR(100) NOT NULL,
  `conversationId` VARCHAR(100),
  `crop` VARCHAR(100),
  `analysisResult` TEXT NOT NULL,
  `language` VARCHAR(20) DEFAULT 'en',
  `confidence` VARCHAR(20) DEFAULT 'medium',
  `createdAt` VARCHAR(100) NOT NULL,
  `expiresAt` VARCHAR(100),
  FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  KEY `idx_image_user` (`userId`),
  KEY `idx_image_conv` (`conversationId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 11. Real-Time Events Table
CREATE TABLE IF NOT EXISTS `real_time_events` (
  `id` VARCHAR(100) PRIMARY KEY,
  `userId` VARCHAR(100),
  `event` VARCHAR(100),
  `data` TEXT,
  `read` TINYINT(1) DEFAULT 0,
  `createdAt` VARCHAR(100),
  FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 12. Conversations Table
CREATE TABLE IF NOT EXISTS `conversations` (
  `id` VARCHAR(100) PRIMARY KEY,
  `farmerId` VARCHAR(100),
  `vendorId` VARCHAR(100),
  `productId` VARCHAR(100),
  `orderId` VARCHAR(100),
  `createdAt` VARCHAR(100),
  `updatedAt` VARCHAR(100),
  FOREIGN KEY (`farmerId`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`vendorId`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 13. Messages Table
CREATE TABLE IF NOT EXISTS `messages` (
  `id` VARCHAR(100) PRIMARY KEY,
  `conversationId` VARCHAR(100),
  `senderId` VARCHAR(100),
  `message` TEXT,
  `messageType` VARCHAR(50) DEFAULT 'text',
  `isRead` TINYINT(1) DEFAULT 0,
  `status` VARCHAR(50) DEFAULT 'sent',
  `productId` VARCHAR(100),
  `orderId` VARCHAR(100),
  `createdAt` VARCHAR(100),
  `updatedAt` VARCHAR(100),
  FOREIGN KEY (`conversationId`) REFERENCES `conversations`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`senderId`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 14. Blocked Users Table
CREATE TABLE IF NOT EXISTS `blocked_users` (
  `id` VARCHAR(100) PRIMARY KEY,
  `userId` VARCHAR(100),
  `blockedUserId` VARCHAR(100),
  `createdAt` VARCHAR(100),
  FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`blockedUserId`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 15. Message Reports Table
CREATE TABLE IF NOT EXISTS `message_reports` (
  `id` VARCHAR(100) PRIMARY KEY,
  `conversationId` VARCHAR(100),
  `reportedBy` VARCHAR(100),
  `reason` TEXT,
  `status` VARCHAR(50) DEFAULT 'pending',
  `createdAt` VARCHAR(100),
  FOREIGN KEY (`conversationId`) REFERENCES `conversations`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`reportedBy`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 16. OTP Verifications Table
CREATE TABLE IF NOT EXISTS `otp_verifications` (
  `id` VARCHAR(100) PRIMARY KEY,
  `userId` VARCHAR(100),
  `contact` VARCHAR(255),
  `purpose` VARCHAR(50),
  `otpHash` VARCHAR(255),
  `expiresAt` VARCHAR(100),
  `attempts` INT DEFAULT 0,
  `verifiedAt` VARCHAR(100),
  `createdAt` VARCHAR(100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 17. Payments Table
CREATE TABLE IF NOT EXISTS `payments` (
  `id` VARCHAR(100) PRIMARY KEY,
  `orderId` VARCHAR(100),
  `userId` VARCHAR(100),
  `gateway` VARCHAR(50) DEFAULT 'razorpay',
  `gatewayOrderId` VARCHAR(100),
  `gatewayPaymentId` VARCHAR(100),
  `amount` DECIMAL(12, 2),
  `currency` VARCHAR(10) DEFAULT 'INR',
  `status` VARCHAR(50) DEFAULT 'created',
  `method` VARCHAR(50),
  `createdAt` VARCHAR(100),
  `updatedAt` VARCHAR(100),
  FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE SET NULL,
  KEY `idx_payments_orderId` (`orderId`),
  KEY `idx_payments_gatewayPaymentId` (`gatewayPaymentId`),
  KEY `idx_payments_gatewayOrderId` (`gatewayOrderId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 18. Delivery Pricing Rules Table
CREATE TABLE IF NOT EXISTS `delivery_pricing_rules` (
  `id` VARCHAR(100) PRIMARY KEY,
  `minDistanceKm` DECIMAL(10, 2),
  `maxDistanceKm` DECIMAL(10, 2),
  `baseCharge` DECIMAL(10, 2),
  `perKmCharge` DECIMAL(10, 2) DEFAULT 0.00,
  `active` TINYINT(1) DEFAULT 1,
  `createdAt` VARCHAR(100),
  `updatedAt` VARCHAR(100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Default Delivery Pricing Rules
INSERT IGNORE INTO `delivery_pricing_rules` (`id`, `minDistanceKm`, `maxDistanceKm`, `baseCharge`, `perKmCharge`, `active`, `createdAt`, `updatedAt`) VALUES
('rule_1', 0, 5, 30.00, 0.00, 1, NOW(), NOW()),
('rule_2', 5, 15, 50.00, 2.00, 1, NOW(), NOW()),
('rule_3', 15, 50, 80.00, 3.00, 1, NOW(), NOW()),
('rule_4', 50, 999999, 150.00, 4.00, 1, NOW(), NOW());

-- 19. AI Pending Actions Table (Phase 6 Human Confirmation)
CREATE TABLE IF NOT EXISTS `ai_pending_actions` (
  `id` VARCHAR(100) PRIMARY KEY,
  `userId` VARCHAR(100) NOT NULL,
  `conversationId` VARCHAR(100),
  `actionId` VARCHAR(100) NOT NULL,
  `parametersJson` LONGTEXT NOT NULL,
  `parametersHash` VARCHAR(64) NOT NULL,
  `status` VARCHAR(50) DEFAULT 'PENDING',
  `confirmationTokenHash` VARCHAR(64) NOT NULL,
  `expectedStateJson` LONGTEXT,
  `expiresAt` BIGINT NOT NULL,
  `createdAt` VARCHAR(100) NOT NULL,
  `confirmedAt` VARCHAR(100),
  `cancelledAt` VARCHAR(100),
  `failureReason` TEXT,
  `resultJson` LONGTEXT,
  FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 20. AI Action Audit Table (Phase 6 Auditing)
CREATE TABLE IF NOT EXISTS `ai_action_audit` (
  `id` VARCHAR(100) PRIMARY KEY,
  `userId` VARCHAR(100) NOT NULL,
  `role` VARCHAR(50) NOT NULL,
  `actionId` VARCHAR(100) NOT NULL,
  `conversationId` VARCHAR(100),
  `status` VARCHAR(50) NOT NULL,
  `parametersSummary` TEXT,
  `resultSummary` TEXT,
  `failureReason` TEXT,
  `createdAt` VARCHAR(100) NOT NULL,
  `completedAt` VARCHAR(100),
  FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 21. AI User Memory Table (Phase 11 Personal AI Memory)
CREATE TABLE IF NOT EXISTS `ai_user_memory` (
  `id` VARCHAR(100) PRIMARY KEY,
  `userId` VARCHAR(100) NOT NULL,
  `memoryType` VARCHAR(50) NOT NULL,
  `key` VARCHAR(100) NOT NULL,
  `value` TEXT NOT NULL,
  `confidence` VARCHAR(20) DEFAULT 'high',
  `source` VARCHAR(50) DEFAULT 'user_explicit',
  `createdAt` VARCHAR(100) NOT NULL,
  `updatedAt` VARCHAR(100) NOT NULL,
  `expiresAt` VARCHAR(100),
  `isActive` TINYINT(1) DEFAULT 1,
  FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  KEY `idx_ai_user_memory_user` (`userId`),
  KEY `idx_ai_user_memory_type` (`userId`, `memoryType`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 22. AI Farming Goals Table (Phase 11 Goal Tracking)
CREATE TABLE IF NOT EXISTS `ai_farming_goals` (
  `id` VARCHAR(100) PRIMARY KEY,
  `userId` VARCHAR(100) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `description` TEXT,
  `category` VARCHAR(50) NOT NULL DEFAULT 'production',
  `targetValue` DECIMAL(12, 2) DEFAULT 0.00,
  `currentValue` DECIMAL(12, 2) DEFAULT 0.00,
  `unit` VARCHAR(50) DEFAULT 'kg',
  `deadline` VARCHAR(100),
  `status` VARCHAR(50) DEFAULT 'active',
  `priority` VARCHAR(50) DEFAULT 'medium',
  `createdAt` VARCHAR(100) NOT NULL,
  `updatedAt` VARCHAR(100) NOT NULL,
  FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  KEY `idx_ai_farming_goals_user` (`userId`),
  KEY `idx_ai_farming_goals_status` (`userId`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 23. AI Follow-ups Table (Phase 11 Task & Reminder System)
CREATE TABLE IF NOT EXISTS `ai_followups` (
  `id` VARCHAR(100) PRIMARY KEY,
  `userId` VARCHAR(100) NOT NULL,
  `type` VARCHAR(50) NOT NULL DEFAULT 'custom',
  `title` VARCHAR(255) NOT NULL,
  `description` TEXT,
  `triggerAt` VARCHAR(100),
  `status` VARCHAR(50) DEFAULT 'pending',
  `relatedEntityType` VARCHAR(50),
  `relatedEntityId` VARCHAR(100),
  `createdAt` VARCHAR(100) NOT NULL,
  `completedAt` VARCHAR(100),
  FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  KEY `idx_ai_followups_user` (`userId`),
  KEY `idx_ai_followups_status` (`userId`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 24. Order Tracking Events Table (Phase 13 OpenStreetMap Tracking)
CREATE TABLE IF NOT EXISTS `order_tracking_events` (
  `id` VARCHAR(100) PRIMARY KEY,
  `order_id` VARCHAR(100) NOT NULL,
  `status` VARCHAR(50) NOT NULL,
  `location` VARCHAR(255) NOT NULL,
  `latitude` DECIMAL(10, 7) DEFAULT NULL,
  `longitude` DECIMAL(10, 7) DEFAULT NULL,
  `description` TEXT,
  `timestamp` VARCHAR(100) NOT NULL,
  `updated_by` VARCHAR(100) NOT NULL,
  FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE,
  KEY `idx_order_tracking_order` (`order_id`),
  KEY `idx_order_tracking_time` (`timestamp`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 25. Farm Parcels Table (GIS Phase 1 User-Demarcated Farm Boundaries)
CREATE TABLE IF NOT EXISTS `farm_parcels` (
  `id` VARCHAR(100) PRIMARY KEY,
  `user_id` VARCHAR(100) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `geometry_geojson` LONGTEXT NOT NULL,
  `area_acres` DECIMAL(10, 2) DEFAULT 0.00,
  `area_hectares` DECIMAL(10, 2) DEFAULT 0.00,
  `centroid_lat` DECIMAL(10, 7),
  `centroid_lng` DECIMAL(10, 7),
  `source` VARCHAR(50) DEFAULT 'USER_DRAWN',
  `cadastral_status` VARCHAR(50) DEFAULT 'NON_CADASTRAL',
  `document_reference` VARCHAR(255) DEFAULT NULL,
  `created_at` VARCHAR(100) NOT NULL,
  `updated_at` VARCHAR(100) NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  KEY `idx_farm_parcels_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 26. Crop Value-Added Products Table (Value Addition Module)
CREATE TABLE IF NOT EXISTS `crop_value_added_products` (
  `id` VARCHAR(100) PRIMARY KEY,
  `crop_name` VARCHAR(100) NOT NULL,
  `product_name` VARCHAR(255) NOT NULL,
  `category` VARCHAR(100),
  `description` TEXT,
  `value_addition_multiplier` DECIMAL(5, 2) DEFAULT 1.00,
  `created_at` VARCHAR(100) NOT NULL,
  `updated_at` VARCHAR(100) NOT NULL,
  UNIQUE KEY `uk_crop_product` (`crop_name`, `product_name`),
  KEY `idx_vap_crop` (`crop_name`),
  KEY `idx_vap_product` (`product_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 27. Processing Guides Table (Value Addition Module)
CREATE TABLE IF NOT EXISTS `processing_guides` (
  `id` VARCHAR(100) PRIMARY KEY,
  `value_added_product_id` VARCHAR(100) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `processing_method` VARCHAR(100) NOT NULL,
  `difficulty_level` VARCHAR(50) DEFAULT 'Intermediate',
  `expected_yield_percentage` DECIMAL(5, 2) DEFAULT NULL,
  `processing_time_hours` DECIMAL(6, 2) DEFAULT NULL,
  `summary` TEXT,
  `source_reference` TEXT,
  `created_at` VARCHAR(100) NOT NULL,
  `updated_at` VARCHAR(100) NOT NULL,
  FOREIGN KEY (`value_added_product_id`) REFERENCES `crop_value_added_products`(`id`) ON DELETE CASCADE,
  KEY `idx_pg_vap` (`value_added_product_id`),
  KEY `idx_pg_method` (`processing_method`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 28. Processing Stages Table (Value Addition Module)
CREATE TABLE IF NOT EXISTS `processing_stages` (
  `id` VARCHAR(100) PRIMARY KEY,
  `guide_id` VARCHAR(100) NOT NULL,
  `stage_number` INT NOT NULL,
  `stage_name` VARCHAR(255) NOT NULL,
  `description` TEXT NOT NULL,
  `duration_minutes` INT DEFAULT NULL,
  `temperature_celsius` DECIMAL(5, 2) DEFAULT NULL,
  `critical_control_points` TEXT,
  `created_at` VARCHAR(100) NOT NULL,
  FOREIGN KEY (`guide_id`) REFERENCES `processing_guides`(`id`) ON DELETE CASCADE,
  UNIQUE KEY `uk_guide_stage` (`guide_id`, `stage_number`),
  KEY `idx_ps_guide` (`guide_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 29. Processing Equipment Table (Value Addition Module)
CREATE TABLE IF NOT EXISTS `processing_equipment` (
  `id` VARCHAR(100) PRIMARY KEY,
  `guide_id` VARCHAR(100) NOT NULL,
  `equipment_name` VARCHAR(255) NOT NULL,
  `equipment_type` VARCHAR(100) DEFAULT NULL,
  `processing_method` VARCHAR(100) DEFAULT NULL,
  `applicable_crops` TEXT DEFAULT NULL,
  `applicable_products` TEXT DEFAULT NULL,
  `purpose` TEXT DEFAULT NULL,
  `capacity_info` VARCHAR(255) DEFAULT NULL,
  `operational_description` TEXT DEFAULT NULL,
  `maintenance_considerations` TEXT DEFAULT NULL,
  `source_reference` TEXT DEFAULT NULL,
  `specification` TEXT,
  `is_mandatory` TINYINT(1) DEFAULT 1,
  `estimated_cost_min` DECIMAL(12, 2) DEFAULT NULL,
  `estimated_cost_max` DECIMAL(12, 2) DEFAULT NULL,
  `created_at` VARCHAR(100) NOT NULL,
  FOREIGN KEY (`guide_id`) REFERENCES `processing_guides`(`id`) ON DELETE CASCADE,
  KEY `idx_pe_guide` (`guide_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 30. Processing Packaging & Storage Table (Value Addition Module)
CREATE TABLE IF NOT EXISTS `processing_packaging_storage` (
  `id` VARCHAR(100) PRIMARY KEY,
  `guide_id` VARCHAR(100) NOT NULL,
  `packaging_type` VARCHAR(100) NOT NULL,
  `material_specification` TEXT,
  `suitable_packaging_material` TEXT,
  `packaging_considerations` TEXT,
  `labelling_considerations` TEXT,
  `storage_conditions` TEXT,
  `moisture_considerations` TEXT,
  `temperature_considerations` TEXT,
  `storage_temperature_min_c` DECIMAL(5, 2) DEFAULT NULL,
  `storage_temperature_max_c` DECIMAL(5, 2) DEFAULT NULL,
  `humidity_percentage_max` DECIMAL(5, 2) DEFAULT NULL,
  `shelf_life_days` INT DEFAULT NULL,
  `shelf_life_info` VARCHAR(255) DEFAULT NULL,
  `storage_instructions` TEXT,
  `storage_precautions` TEXT,
  `source_reference` TEXT,
  `created_at` VARCHAR(100) NOT NULL,
  FOREIGN KEY (`guide_id`) REFERENCES `processing_guides`(`id`) ON DELETE CASCADE,
  KEY `idx_pps_guide` (`guide_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 31. Processing Market & Commercial Info Table (Value Addition Module)
CREATE TABLE IF NOT EXISTS `processing_market_info` (
  `id` VARCHAR(100) PRIMARY KEY,
  `guide_id` VARCHAR(100) NOT NULL,
  `target_market` VARCHAR(255) DEFAULT NULL,
  `commercial_uses` TEXT,
  `demand_level` VARCHAR(50) DEFAULT 'Moderate',
  `quality_standards` TEXT,
  `govt_schemes_info` TEXT,
  `created_at` VARCHAR(100) NOT NULL,
  FOREIGN KEY (`guide_id`) REFERENCES `processing_guides`(`id`) ON DELETE CASCADE,
  KEY `idx_pmi_guide` (`guide_id`)
-- 32. Farmer Processing Projects Table (Value Addition Module)
CREATE TABLE IF NOT EXISTS `farmer_processing_projects` (
  `id` VARCHAR(100) PRIMARY KEY,
  `farmer_id` VARCHAR(100) NOT NULL,
  `value_added_product_id` VARCHAR(100) DEFAULT NULL,
  `project_name` VARCHAR(255) NOT NULL,
  `crop_name` VARCHAR(100) NOT NULL,
  `raw_quantity` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `raw_unit` VARCHAR(50) DEFAULT 'kg',
  `raw_unit_price` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `raw_material_cost` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `processing_cost` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `labour_cost` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `packaging_cost` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `transport_cost` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `other_costs` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `total_cost` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `expected_processed_qty` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `processed_unit` VARCHAR(50) DEFAULT 'kg',
  `expected_selling_price` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `projected_revenue` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `projected_profit` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `roi_percentage` DECIMAL(8, 2) NOT NULL DEFAULT 0.00,
  `status` VARCHAR(50) DEFAULT 'SAVED',
  `notes` TEXT DEFAULT NULL,
  `created_at` VARCHAR(100) NOT NULL,
  `updated_at` VARCHAR(100) NOT NULL,
  FOREIGN KEY (`farmer_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`value_added_product_id`) REFERENCES `crop_value_added_products`(`id`) ON DELETE SET NULL,
  KEY `idx_fpp_farmer` (`farmer_id`),
  KEY `idx_fpp_product` (`value_added_product_id`),
-- 33. Government Schemes Table (Value Addition & Agri-Support)
CREATE TABLE IF NOT EXISTS `government_schemes` (
  `id` VARCHAR(100) PRIMARY KEY,
  `scheme_name` VARCHAR(255) NOT NULL,
  `short_code` VARCHAR(50) NOT NULL UNIQUE,
  `authority` VARCHAR(255) NOT NULL,
  `description` TEXT NOT NULL,
  `eligibility_info` TEXT NOT NULL,
  `benefits_info` TEXT NOT NULL,
  `official_source_url` VARCHAR(500) NOT NULL,
  `last_updated_date` VARCHAR(100) NOT NULL,
  `created_at` VARCHAR(100) NOT NULL,
  KEY `idx_gs_code` (`short_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 34. Crop Product Scheme Mappings Table (Value Addition Module)
CREATE TABLE IF NOT EXISTS `crop_product_scheme_mappings` (
  `id` VARCHAR(100) PRIMARY KEY,
  `value_added_product_id` VARCHAR(100) NOT NULL,
  `scheme_id` VARCHAR(100) NOT NULL,
  `relevance_notes` TEXT DEFAULT NULL,
  `created_at` VARCHAR(100) NOT NULL,
  FOREIGN KEY (`value_added_product_id`) REFERENCES `crop_value_added_products`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`scheme_id`) REFERENCES `government_schemes`(`id`) ON DELETE CASCADE,
  UNIQUE KEY `uk_vap_scheme` (`value_added_product_id`, `scheme_id`),
  KEY `idx_cpsm_vap` (`value_added_product_id`),
  KEY `idx_cpsm_scheme` (`scheme_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;





