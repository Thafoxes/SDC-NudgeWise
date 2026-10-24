-- NudgeWise Phase 0: clean XAMPP MariaDB schema.
-- New empty database only: no legacy data import, no sample rows.
-- Compatible design target: current XAMPP MariaDB (10.x/11.x) / MySQL 8 with InnoDB.
-- Run in phpMyAdmin after selecting the empty `nudgewise_db` database.
-- The SQL creates tables, indexes and foreign keys only; it does not connect the Node app.
-- Application must create UUIDs, populate stage rows, validate status values and enforce auth.
-- Store timestamps in UTC using a UTC DB session; do not store secrets or file bytes here.

CREATE DATABASE IF NOT EXISTS `nudgewise_db` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `nudgewise_db`;

SET NAMES utf8mb4;

-- 01. businesses: Seller/business configuration; one workspace now, separate businesses later.
CREATE TABLE IF NOT EXISTS `businesses` (
  `id` CHAR(36) NOT NULL,
  `name` VARCHAR(160) NOT NULL,
  `display_name` VARCHAR(160) NULL,
  `registration_number` VARCHAR(80) NULL,
  `email` VARCHAR(254) NULL,
  `phone` VARCHAR(40) NULL,
  `address` TEXT NULL,
  `currency` CHAR(3) NOT NULL DEFAULT 'MYR',
  `timezone` VARCHAR(64) NOT NULL DEFAULT 'Asia/Kuala_Lumpur',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 02. users: Seller/staff profile; approval actor, not a completed authentication system.
CREATE TABLE IF NOT EXISTS `users` (
  `id` CHAR(36) NOT NULL,
  `business_id` CHAR(36) NOT NULL,
  `name` VARCHAR(160) NOT NULL,
  `email` VARCHAR(254) NOT NULL,
  `role` VARCHAR(20) NOT NULL DEFAULT 'staff',
  `password_hash` VARCHAR(255) NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_02_scope` (`business_id`, `id`),
  UNIQUE KEY `uq_02_01` (`business_id`, `email`),
  CONSTRAINT `fk_02_biz` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 03. customers: Buyer directory; one buyer may have many orders and invoices.
CREATE TABLE IF NOT EXISTS `customers` (
  `id` CHAR(36) NOT NULL,
  `business_id` CHAR(36) NOT NULL,
  `name` VARCHAR(180) NOT NULL,
  `contact_person` VARCHAR(160) NULL,
  `phone` VARCHAR(40) NULL,
  `email` VARCHAR(254) NULL,
  `billing_email` VARCHAR(254) NULL,
  `address` TEXT NULL,
  `preferred_language` CHAR(2) NOT NULL DEFAULT 'en',
  `notes` TEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_03_scope` (`business_id`, `id`),
  KEY `ix_03_01` (`business_id`, `name`),
  KEY `ix_03_02` (`business_id`, `phone`),
  CONSTRAINT `fk_03_biz` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 04. purchase_orders: Main PO/Order listing and Details page record. Supports seller draft PO, buyer-issued PO, and initial order request.
CREATE TABLE IF NOT EXISTS `purchase_orders` (
  `id` CHAR(36) NOT NULL,
  `business_id` CHAR(36) NOT NULL,
  `customer_id` CHAR(36) NOT NULL,
  `order_reference` VARCHAR(50) NOT NULL,
  `po_number` VARCHAR(80) NULL,
  `source_mode` VARCHAR(25) NOT NULL DEFAULT 'manual',
  `document_kind` VARCHAR(25) NOT NULL DEFAULT 'order_request',
  `status` VARCHAR(30) NOT NULL DEFAULT 'draft',
  `buyer_approval_status` VARCHAR(30) NOT NULL DEFAULT 'not_requested',
  `order_date` DATE NULL,
  `requested_delivery_date` DATE NULL,
  `currency` CHAR(3) NOT NULL DEFAULT 'MYR',
  `document_total` DECIMAL(15,2) NULL,
  `buyer_details_snapshot` LONGTEXT NULL,
  `supplier_details_snapshot` LONGTEXT NULL,
  `delivery_address` TEXT NULL,
  `delivery_contact` VARCHAR(160) NULL,
  `payment_terms_text` TEXT NULL,
  `delivery_terms_text` TEXT NULL,
  `requested_by` VARCHAR(160) NULL,
  `document_approved_by_text` VARCHAR(160) NULL,
  `department` VARCHAR(120) NULL,
  `notes` TEXT NULL,
  `seller_approved_by` CHAR(36) NULL,
  `seller_approved_at` DATETIME NULL,
  `override_reason` TEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_04_scope` (`business_id`, `id`),
  UNIQUE KEY `uq_04_01` (`business_id`, `order_reference`),
  UNIQUE KEY `uq_04_02` (`business_id`, `customer_id`, `po_number`),
  KEY `ix_04_01` (`business_id`, `customer_id`, `created_at`),
  KEY `ix_04_02` (`business_id`, `status`),
  CONSTRAINT `fk_04_biz` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT `fk_04_01` FOREIGN KEY (`business_id`, `customer_id`) REFERENCES `customers` (`business_id`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT `fk_04_02` FOREIGN KEY (`business_id`, `seller_approved_by`) REFERENCES `users` (`business_id`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 05. purchase_order_items: Editable extracted/manual PO item table; preserves rows and order.
CREATE TABLE IF NOT EXISTS `purchase_order_items` (
  `id` CHAR(36) NOT NULL,
  `business_id` CHAR(36) NOT NULL,
  `purchase_order_id` CHAR(36) NOT NULL,
  `line_no` INT UNSIGNED NOT NULL,
  `item_name` VARCHAR(255) NOT NULL,
  `item_code` VARCHAR(100) NULL,
  `quantity` DECIMAL(12,3) NULL,
  `unit` VARCHAR(40) NULL,
  `unit_price` DECIMAL(15,2) NULL,
  `discount_amount` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `line_total` DECIMAL(15,2) NULL,
  `review_status` VARCHAR(20) NOT NULL DEFAULT 'pending',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_05_scope` (`business_id`, `id`),
  UNIQUE KEY `uq_05_01` (`business_id`, `purchase_order_id`, `line_no`),
  CONSTRAINT `fk_05_biz` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT `fk_05_01` FOREIGN KEY (`business_id`, `purchase_order_id`) REFERENCES `purchase_orders` (`business_id`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 06. order_requirements: Confirmed rules for billing: required PO, acceptance, delivery, and payment-due basis.
CREATE TABLE IF NOT EXISTS `order_requirements` (
  `id` CHAR(36) NOT NULL,
  `business_id` CHAR(36) NOT NULL,
  `purchase_order_id` CHAR(36) NOT NULL,
  `po_required` TINYINT(1) NOT NULL DEFAULT 0,
  `delivery_proof_required` TINYINT(1) NOT NULL DEFAULT 0,
  `acceptance_required` TINYINT(1) NOT NULL DEFAULT 0,
  `due_trigger` VARCHAR(40) NOT NULL DEFAULT 'other',
  `net_days` SMALLINT UNSIGNED NULL,
  `fixed_due_date` DATE NULL,
  `deposit_percent` DECIMAL(5,2) NULL,
  `agreed_terms_text` TEXT NULL,
  `source_description` TEXT NULL,
  `confirmation_status` VARCHAR(20) NOT NULL DEFAULT 'unconfirmed',
  `confirmed_by` CHAR(36) NULL,
  `confirmed_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_06_scope` (`business_id`, `id`),
  UNIQUE KEY `uq_06_01` (`business_id`, `purchase_order_id`),
  CONSTRAINT `fk_06_biz` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT `fk_06_01` FOREIGN KEY (`business_id`, `purchase_order_id`) REFERENCES `purchase_orders` (`business_id`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT `fk_06_02` FOREIGN KEY (`business_id`, `confirmed_by`) REFERENCES `users` (`business_id`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 07. quotations: Seller-created priced offer, its PDF status, and buyer response.
CREATE TABLE IF NOT EXISTS `quotations` (
  `id` CHAR(36) NOT NULL,
  `business_id` CHAR(36) NOT NULL,
  `purchase_order_id` CHAR(36) NOT NULL,
  `customer_id` CHAR(36) NOT NULL,
  `quotation_number` VARCHAR(80) NOT NULL,
  `revision_no` SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  `issue_date` DATE NULL,
  `valid_until` DATE NULL,
  `currency` CHAR(3) NOT NULL DEFAULT 'MYR',
  `subtotal` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `discount_total` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `tax_total` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `total_amount` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `payment_terms` TEXT NULL,
  `delivery_terms` TEXT NULL,
  `status` VARCHAR(30) NOT NULL DEFAULT 'draft',
  `buyer_response_at` DATETIME NULL,
  `buyer_response_source` VARCHAR(40) NULL,
  `buyer_response_confirmed_by` CHAR(36) NULL,
  `approved_by` CHAR(36) NULL,
  `approved_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_07_scope` (`business_id`, `id`),
  UNIQUE KEY `uq_07_01` (`business_id`, `quotation_number`),
  KEY `ix_07_01` (`business_id`, `purchase_order_id`, `status`),
  CONSTRAINT `fk_07_biz` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT `fk_07_01` FOREIGN KEY (`business_id`, `purchase_order_id`) REFERENCES `purchase_orders` (`business_id`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT `fk_07_02` FOREIGN KEY (`business_id`, `customer_id`) REFERENCES `customers` (`business_id`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT `fk_07_03` FOREIGN KEY (`business_id`, `buyer_response_confirmed_by`) REFERENCES `users` (`business_id`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT `fk_07_04` FOREIGN KEY (`business_id`, `approved_by`) REFERENCES `users` (`business_id`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 08. quotation_items: Snapshot of what was quoted, including seller-confirmed prices.
CREATE TABLE IF NOT EXISTS `quotation_items` (
  `id` CHAR(36) NOT NULL,
  `business_id` CHAR(36) NOT NULL,
  `quotation_id` CHAR(36) NOT NULL,
  `line_no` INT UNSIGNED NOT NULL,
  `item_name` VARCHAR(255) NOT NULL,
  `item_code` VARCHAR(100) NULL,
  `quantity` DECIMAL(12,3) NOT NULL,
  `unit` VARCHAR(40) NULL,
  `unit_price` DECIMAL(15,2) NOT NULL,
  `discount_amount` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `line_total` DECIMAL(15,2) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_08_scope` (`business_id`, `id`),
  UNIQUE KEY `uq_08_01` (`business_id`, `quotation_id`, `line_no`),
  CONSTRAINT `fk_08_biz` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT `fk_08_01` FOREIGN KEY (`business_id`, `quotation_id`) REFERENCES `quotations` (`business_id`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 09. invoices: Issued/draft bills with agreed due dates and existing reminder/dispute holds.
CREATE TABLE IF NOT EXISTS `invoices` (
  `id` CHAR(36) NOT NULL,
  `business_id` CHAR(36) NOT NULL,
  `purchase_order_id` CHAR(36) NULL,
  `quotation_id` CHAR(36) NULL,
  `customer_id` CHAR(36) NOT NULL,
  `invoice_number` VARCHAR(80) NOT NULL,
  `issue_date` DATE NULL,
  `submitted_at` DATETIME NULL,
  `confirmed_received_at` DATETIME NULL,
  `due_date` DATE NULL,
  `currency` CHAR(3) NOT NULL DEFAULT 'MYR',
  `subtotal` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `discount_total` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `tax_total` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `invoice_amount` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `document_status` VARCHAR(20) NOT NULL DEFAULT 'draft',
  `dispute_active` TINYINT(1) NOT NULL DEFAULT 0,
  `settlement_required` TINYINT(1) NOT NULL DEFAULT 0,
  `verification_hold` TINYINT(1) NOT NULL DEFAULT 0,
  `notes` TEXT NULL,
  `approved_by` CHAR(36) NULL,
  `approved_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_09_scope` (`business_id`, `id`),
  UNIQUE KEY `uq_09_01` (`business_id`, `invoice_number`),
  KEY `ix_09_01` (`business_id`, `customer_id`, `due_date`),
  KEY `ix_09_02` (`business_id`, `purchase_order_id`, `document_status`),
  CONSTRAINT `fk_09_biz` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT `fk_09_01` FOREIGN KEY (`business_id`, `purchase_order_id`) REFERENCES `purchase_orders` (`business_id`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT `fk_09_02` FOREIGN KEY (`business_id`, `quotation_id`) REFERENCES `quotations` (`business_id`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT `fk_09_03` FOREIGN KEY (`business_id`, `customer_id`) REFERENCES `customers` (`business_id`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT `fk_09_04` FOREIGN KEY (`business_id`, `approved_by`) REFERENCES `users` (`business_id`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. invoice_items: Snapshot of items/services billed on an invoice.
CREATE TABLE IF NOT EXISTS `invoice_items` (
  `id` CHAR(36) NOT NULL,
  `business_id` CHAR(36) NOT NULL,
  `invoice_id` CHAR(36) NOT NULL,
  `line_no` INT UNSIGNED NOT NULL,
  `item_name` VARCHAR(255) NOT NULL,
  `item_code` VARCHAR(100) NULL,
  `quantity` DECIMAL(12,3) NOT NULL,
  `unit` VARCHAR(40) NULL,
  `unit_price` DECIMAL(15,2) NOT NULL,
  `discount_amount` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `line_total` DECIMAL(15,2) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_10_scope` (`business_id`, `id`),
  UNIQUE KEY `uq_10_01` (`business_id`, `invoice_id`, `line_no`),
  CONSTRAINT `fk_10_biz` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT `fk_10_01` FOREIGN KEY (`business_id`, `invoice_id`) REFERENCES `invoices` (`business_id`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. deliveries: Delivery order/evidence status, quantities, and buyer acceptance; optional for deposit billing.
CREATE TABLE IF NOT EXISTS `deliveries` (
  `id` CHAR(36) NOT NULL,
  `business_id` CHAR(36) NOT NULL,
  `purchase_order_id` CHAR(36) NOT NULL,
  `customer_id` CHAR(36) NOT NULL,
  `delivery_reference` VARCHAR(80) NULL,
  `delivery_date` DATE NULL,
  `status` VARCHAR(25) NOT NULL DEFAULT 'planned',
  `acceptance_status` VARCHAR(25) NOT NULL DEFAULT 'unknown',
  `accepted_at` DATETIME NULL,
  `accepted_by_name` VARCHAR(160) NULL,
  `confirmed_by` CHAR(36) NULL,
  `notes` TEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_11_scope` (`business_id`, `id`),
  KEY `ix_11_01` (`business_id`, `purchase_order_id`, `delivery_date`),
  CONSTRAINT `fk_11_biz` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT `fk_11_01` FOREIGN KEY (`business_id`, `purchase_order_id`) REFERENCES `purchase_orders` (`business_id`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT `fk_11_02` FOREIGN KEY (`business_id`, `customer_id`) REFERENCES `customers` (`business_id`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT `fk_11_03` FOREIGN KEY (`business_id`, `confirmed_by`) REFERENCES `users` (`business_id`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 12. delivery_items: Accepted/delivered quantity by line, for PO versus delivery versus invoice checks.
CREATE TABLE IF NOT EXISTS `delivery_items` (
  `id` CHAR(36) NOT NULL,
  `business_id` CHAR(36) NOT NULL,
  `delivery_id` CHAR(36) NOT NULL,
  `purchase_order_item_id` CHAR(36) NULL,
  `line_no` INT UNSIGNED NOT NULL,
  `item_name` VARCHAR(255) NOT NULL,
  `quantity_delivered` DECIMAL(12,3) NOT NULL,
  `quantity_accepted` DECIMAL(12,3) NULL,
  `unit` VARCHAR(40) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_12_scope` (`business_id`, `id`),
  UNIQUE KEY `uq_12_01` (`business_id`, `delivery_id`, `line_no`),
  CONSTRAINT `fk_12_biz` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT `fk_12_01` FOREIGN KEY (`business_id`, `delivery_id`) REFERENCES `deliveries` (`business_id`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT `fk_12_02` FOREIGN KEY (`business_id`, `purchase_order_item_id`) REFERENCES `purchase_order_items` (`business_id`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 13. payments: Seller-verified payment entries; partial payments are separate rows.
CREATE TABLE IF NOT EXISTS `payments` (
  `id` CHAR(36) NOT NULL,
  `business_id` CHAR(36) NOT NULL,
  `invoice_id` CHAR(36) NOT NULL,
  `amount` DECIMAL(15,2) NOT NULL,
  `payment_date` DATE NOT NULL,
  `method` VARCHAR(40) NULL,
  `reference` VARCHAR(120) NULL,
  `verification_status` VARCHAR(20) NOT NULL DEFAULT 'recorded',
  `verified_by` CHAR(36) NOT NULL,
  `verified_at` DATETIME NOT NULL,
  `notes` TEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_13_scope` (`business_id`, `id`),
  KEY `ix_13_01` (`business_id`, `invoice_id`, `payment_date`),
  CONSTRAINT `fk_13_biz` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT `fk_13_01` FOREIGN KEY (`business_id`, `invoice_id`) REFERENCES `invoices` (`business_id`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT `fk_13_02` FOREIGN KEY (`business_id`, `verified_by`) REFERENCES `users` (`business_id`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 14. payment_claims: Unverified transfer screenshots or buyer statements; never count as received cash automatically.
CREATE TABLE IF NOT EXISTS `payment_claims` (
  `id` CHAR(36) NOT NULL,
  `business_id` CHAR(36) NOT NULL,
  `invoice_id` CHAR(36) NULL,
  `customer_id` CHAR(36) NULL,
  `claimed_amount` DECIMAL(15,2) NULL,
  `claimed_date` DATE NULL,
  `reference` VARCHAR(120) NULL,
  `status` VARCHAR(25) NOT NULL DEFAULT 'pending_verification',
  `verified_payment_id` CHAR(36) NULL,
  `reviewed_by` CHAR(36) NULL,
  `reviewed_at` DATETIME NULL,
  `review_note` TEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_14_scope` (`business_id`, `id`),
  KEY `ix_14_01` (`business_id`, `status`, `created_at`),
  CONSTRAINT `fk_14_biz` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT `fk_14_01` FOREIGN KEY (`business_id`, `invoice_id`) REFERENCES `invoices` (`business_id`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT `fk_14_02` FOREIGN KEY (`business_id`, `customer_id`) REFERENCES `customers` (`business_id`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT `fk_14_03` FOREIGN KEY (`business_id`, `verified_payment_id`) REFERENCES `payments` (`business_id`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT `fk_14_04` FOREIGN KEY (`business_id`, `reviewed_by`) REFERENCES `users` (`business_id`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 15. receipts: Seller-issued acknowledgments of verified payment; NOT raw buyer bank screenshots.
CREATE TABLE IF NOT EXISTS `receipts` (
  `id` CHAR(36) NOT NULL,
  `business_id` CHAR(36) NOT NULL,
  `payment_id` CHAR(36) NOT NULL,
  `receipt_number` VARCHAR(80) NOT NULL,
  `issued_at` DATETIME NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'draft',
  `issued_by` CHAR(36) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_15_scope` (`business_id`, `id`),
  UNIQUE KEY `uq_15_01` (`business_id`, `receipt_number`),
  UNIQUE KEY `uq_15_02` (`business_id`, `payment_id`),
  CONSTRAINT `fk_15_biz` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT `fk_15_01` FOREIGN KEY (`business_id`, `payment_id`) REFERENCES `payments` (`business_id`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT `fk_15_02` FOREIGN KEY (`business_id`, `issued_by`) REFERENCES `users` (`business_id`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 16. order_stages: PO Details progress-bar states; steps may be skipped or performed out of default order.
CREATE TABLE IF NOT EXISTS `order_stages` (
  `id` CHAR(36) NOT NULL,
  `business_id` CHAR(36) NOT NULL,
  `purchase_order_id` CHAR(36) NOT NULL,
  `stage_code` VARCHAR(30) NOT NULL,
  `stage_status` VARCHAR(25) NOT NULL DEFAULT 'not_started',
  `completed_at` DATETIME NULL,
  `confirmed_by` CHAR(36) NULL,
  `summary` VARCHAR(500) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_16_scope` (`business_id`, `id`),
  UNIQUE KEY `uq_16_01` (`business_id`, `purchase_order_id`, `stage_code`),
  CONSTRAINT `fk_16_biz` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT `fk_16_01` FOREIGN KEY (`business_id`, `purchase_order_id`) REFERENCES `purchase_orders` (`business_id`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT `fk_16_02` FOREIGN KEY (`business_id`, `confirmed_by`) REFERENCES `users` (`business_id`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 17. payment_promises: Promise-to-pay amount/date with seller confirmation, missed promise checks, and optional evidence.
CREATE TABLE IF NOT EXISTS `payment_promises` (
  `id` CHAR(36) NOT NULL,
  `business_id` CHAR(36) NOT NULL,
  `purchase_order_id` CHAR(36) NULL,
  `invoice_id` CHAR(36) NULL,
  `customer_id` CHAR(36) NOT NULL,
  `promised_amount` DECIMAL(15,2) NULL,
  `promised_date` DATE NOT NULL,
  `status` VARCHAR(25) NOT NULL DEFAULT 'proposed',
  `promise_source` VARCHAR(30) NOT NULL DEFAULT 'manual',
  `confirmed_by` CHAR(36) NULL,
  `confirmed_at` DATETIME NULL,
  `notes` TEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_17_scope` (`business_id`, `id`),
  KEY `ix_17_01` (`business_id`, `promised_date`, `status`),
  CONSTRAINT `fk_17_biz` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT `fk_17_01` FOREIGN KEY (`business_id`, `purchase_order_id`) REFERENCES `purchase_orders` (`business_id`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT `fk_17_02` FOREIGN KEY (`business_id`, `invoice_id`) REFERENCES `invoices` (`business_id`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT `fk_17_03` FOREIGN KEY (`business_id`, `customer_id`) REFERENCES `customers` (`business_id`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT `fk_17_04` FOREIGN KEY (`business_id`, `confirmed_by`) REFERENCES `users` (`business_id`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 18. dispute_cases: Structured buyer dispute (quantity, price, delivery, quality) and human resolution.
CREATE TABLE IF NOT EXISTS `dispute_cases` (
  `id` CHAR(36) NOT NULL,
  `business_id` CHAR(36) NOT NULL,
  `purchase_order_id` CHAR(36) NULL,
  `invoice_id` CHAR(36) NULL,
  `customer_id` CHAR(36) NOT NULL,
  `reason_code` VARCHAR(35) NOT NULL,
  `disputed_amount` DECIMAL(15,2) NULL,
  `description` TEXT NULL,
  `status` VARCHAR(25) NOT NULL DEFAULT 'open',
  `owner_user_id` CHAR(36) NULL,
  `resolution` TEXT NULL,
  `resolved_by` CHAR(36) NULL,
  `resolved_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_18_scope` (`business_id`, `id`),
  KEY `ix_18_01` (`business_id`, `status`, `created_at`),
  CONSTRAINT `fk_18_biz` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT `fk_18_01` FOREIGN KEY (`business_id`, `purchase_order_id`) REFERENCES `purchase_orders` (`business_id`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT `fk_18_02` FOREIGN KEY (`business_id`, `invoice_id`) REFERENCES `invoices` (`business_id`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT `fk_18_03` FOREIGN KEY (`business_id`, `customer_id`) REFERENCES `customers` (`business_id`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT `fk_18_04` FOREIGN KEY (`business_id`, `owner_user_id`) REFERENCES `users` (`business_id`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT `fk_18_05` FOREIGN KEY (`business_id`, `resolved_by`) REFERENCES `users` (`business_id`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 19. credits: Credit notes or approved account credits that reduce an invoice only after issuance.
CREATE TABLE IF NOT EXISTS `credits` (
  `id` CHAR(36) NOT NULL,
  `business_id` CHAR(36) NOT NULL,
  `invoice_id` CHAR(36) NOT NULL,
  `credit_number` VARCHAR(80) NULL,
  `amount` DECIMAL(15,2) NOT NULL,
  `reason` TEXT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'draft',
  `issued_at` DATETIME NULL,
  `approved_by` CHAR(36) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_19_scope` (`business_id`, `id`),
  UNIQUE KEY `uq_19_01` (`business_id`, `credit_number`),
  KEY `ix_19_01` (`business_id`, `invoice_id`, `status`),
  CONSTRAINT `fk_19_biz` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT `fk_19_01` FOREIGN KEY (`business_id`, `invoice_id`) REFERENCES `invoices` (`business_id`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT `fk_19_02` FOREIGN KEY (`business_id`, `approved_by`) REFERENCES `users` (`business_id`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 20. payment_blockers: Missing-document, mismatch, dispute, or verification tasks with owner/next action.
CREATE TABLE IF NOT EXISTS `payment_blockers` (
  `id` CHAR(36) NOT NULL,
  `business_id` CHAR(36) NOT NULL,
  `purchase_order_id` CHAR(36) NULL,
  `invoice_id` CHAR(36) NULL,
  `blocker_code` VARCHAR(45) NOT NULL,
  `description` TEXT NOT NULL,
  `next_action` TEXT NULL,
  `owner_user_id` CHAR(36) NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'open',
  `source_type` VARCHAR(25) NOT NULL DEFAULT 'rule',
  `resolved_by` CHAR(36) NULL,
  `resolved_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_20_scope` (`business_id`, `id`),
  KEY `ix_20_01` (`business_id`, `purchase_order_id`, `status`),
  KEY `ix_20_02` (`business_id`, `invoice_id`, `status`),
  CONSTRAINT `fk_20_biz` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT `fk_20_01` FOREIGN KEY (`business_id`, `purchase_order_id`) REFERENCES `purchase_orders` (`business_id`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT `fk_20_02` FOREIGN KEY (`business_id`, `invoice_id`) REFERENCES `invoices` (`business_id`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT `fk_20_03` FOREIGN KEY (`business_id`, `owner_user_id`) REFERENCES `users` (`business_id`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT `fk_20_04` FOREIGN KEY (`business_id`, `resolved_by`) REFERENCES `users` (`business_id`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 21. follow_up_actions: Reminder/document-request drafts and seller approval safeguards.
CREATE TABLE IF NOT EXISTS `follow_up_actions` (
  `id` CHAR(36) NOT NULL,
  `business_id` CHAR(36) NOT NULL,
  `purchase_order_id` CHAR(36) NULL,
  `invoice_id` CHAR(36) NULL,
  `customer_id` CHAR(36) NOT NULL,
  `kind` VARCHAR(30) NOT NULL,
  `checkpoint` SMALLINT UNSIGNED NULL,
  `reason` TEXT NULL,
  `message` LONGTEXT NOT NULL,
  `message_version` INT UNSIGNED NOT NULL DEFAULT 1,
  `approval_state` VARCHAR(20) NOT NULL DEFAULT 'pending',
  `approved_by` CHAR(36) NULL,
  `approved_at` DATETIME NULL,
  `approved_message_hash` CHAR(64) NULL,
  `send_state` VARCHAR(20) NOT NULL DEFAULT 'not_sent',
  `recipient_email` VARCHAR(254) NULL,
  `sent_at` DATETIME NULL,
  `delivery_status` VARCHAR(40) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_21_scope` (`business_id`, `id`),
  KEY `ix_21_01` (`business_id`, `approval_state`, `send_state`),
  KEY `ix_21_02` (`business_id`, `invoice_id`, `checkpoint`),
  CONSTRAINT `fk_21_biz` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT `fk_21_01` FOREIGN KEY (`business_id`, `purchase_order_id`) REFERENCES `purchase_orders` (`business_id`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT `fk_21_02` FOREIGN KEY (`business_id`, `invoice_id`) REFERENCES `invoices` (`business_id`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT `fk_21_03` FOREIGN KEY (`business_id`, `customer_id`) REFERENCES `customers` (`business_id`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT `fk_21_04` FOREIGN KEY (`business_id`, `approved_by`) REFERENCES `users` (`business_id`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 22. email_messages: Outbound and inbound email records; buyer need not open a NudgeWise account.
CREATE TABLE IF NOT EXISTS `email_messages` (
  `id` CHAR(36) NOT NULL,
  `business_id` CHAR(36) NOT NULL,
  `purchase_order_id` CHAR(36) NULL,
  `quotation_id` CHAR(36) NULL,
  `invoice_id` CHAR(36) NULL,
  `customer_id` CHAR(36) NULL,
  `follow_up_action_id` CHAR(36) NULL,
  `direction` VARCHAR(10) NOT NULL,
  `from_email` VARCHAR(254) NOT NULL,
  `to_email` VARCHAR(254) NOT NULL,
  `reply_to_email` VARCHAR(254) NULL,
  `subject` VARCHAR(500) NULL,
  `body_text` LONGTEXT NULL,
  `provider` VARCHAR(40) NULL,
  `provider_message_id` VARCHAR(191) NULL,
  `rfc_message_id` VARCHAR(255) NULL,
  `in_reply_to` VARCHAR(255) NULL,
  `status` VARCHAR(25) NOT NULL,
  `received_or_sent_at` DATETIME NULL,
  `review_status` VARCHAR(20) NOT NULL DEFAULT 'unreviewed',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_22_scope` (`business_id`, `id`),
  UNIQUE KEY `uq_22_01` (`business_id`, `provider`, `provider_message_id`),
  KEY `ix_22_01` (`business_id`, `purchase_order_id`, `created_at`),
  KEY `ix_22_02` (`business_id`, `invoice_id`, `created_at`),
  CONSTRAINT `fk_22_biz` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT `fk_22_01` FOREIGN KEY (`business_id`, `purchase_order_id`) REFERENCES `purchase_orders` (`business_id`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT `fk_22_02` FOREIGN KEY (`business_id`, `quotation_id`) REFERENCES `quotations` (`business_id`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT `fk_22_03` FOREIGN KEY (`business_id`, `invoice_id`) REFERENCES `invoices` (`business_id`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT `fk_22_04` FOREIGN KEY (`business_id`, `customer_id`) REFERENCES `customers` (`business_id`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT `fk_22_05` FOREIGN KEY (`business_id`, `follow_up_action_id`) REFERENCES `follow_up_actions` (`business_id`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 23. customer_responses: Buyer replies with AI suggested category and human review status.
CREATE TABLE IF NOT EXISTS `customer_responses` (
  `id` CHAR(36) NOT NULL,
  `business_id` CHAR(36) NOT NULL,
  `purchase_order_id` CHAR(36) NULL,
  `invoice_id` CHAR(36) NULL,
  `customer_id` CHAR(36) NULL,
  `email_message_id` CHAR(36) NULL,
  `follow_up_action_id` CHAR(36) NULL,
  `message` LONGTEXT NOT NULL,
  `ai_category` VARCHAR(60) NULL,
  `ai_confidence` DECIMAL(5,4) NULL,
  `ai_suggested_action` TEXT NULL,
  `ai_proposed_date` DATE NULL,
  `ai_promised_amount` DECIMAL(15,2) NULL,
  `review_status` VARCHAR(20) NOT NULL DEFAULT 'pending',
  `reviewed_by` CHAR(36) NULL,
  `reviewed_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_23_scope` (`business_id`, `id`),
  KEY `ix_23_01` (`business_id`, `review_status`, `created_at`),
  CONSTRAINT `fk_23_biz` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT `fk_23_01` FOREIGN KEY (`business_id`, `purchase_order_id`) REFERENCES `purchase_orders` (`business_id`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT `fk_23_02` FOREIGN KEY (`business_id`, `invoice_id`) REFERENCES `invoices` (`business_id`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT `fk_23_03` FOREIGN KEY (`business_id`, `customer_id`) REFERENCES `customers` (`business_id`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT `fk_23_04` FOREIGN KEY (`business_id`, `email_message_id`) REFERENCES `email_messages` (`business_id`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT `fk_23_05` FOREIGN KEY (`business_id`, `follow_up_action_id`) REFERENCES `follow_up_actions` (`business_id`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT `fk_23_06` FOREIGN KEY (`business_id`, `reviewed_by`) REFERENCES `users` (`business_id`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 24. documents: Private-file metadata for existing POs, screenshot chat proof, quotations, invoices, delivery proof and promises.
CREATE TABLE IF NOT EXISTS `documents` (
  `id` CHAR(36) NOT NULL,
  `business_id` CHAR(36) NOT NULL,
  `purchase_order_id` CHAR(36) NULL,
  `quotation_id` CHAR(36) NULL,
  `invoice_id` CHAR(36) NULL,
  `payment_id` CHAR(36) NULL,
  `delivery_id` CHAR(36) NULL,
  `payment_claim_id` CHAR(36) NULL,
  `payment_promise_id` CHAR(36) NULL,
  `dispute_id` CHAR(36) NULL,
  `customer_id` CHAR(36) NULL,
  `email_message_id` CHAR(36) NULL,
  `document_type` VARCHAR(45) NOT NULL,
  `source` VARCHAR(20) NOT NULL DEFAULT 'upload',
  `original_filename` VARCHAR(255) NOT NULL,
  `mime_type` VARCHAR(100) NOT NULL,
  `file_size_bytes` BIGINT UNSIGNED NOT NULL,
  `sha256` CHAR(64) NOT NULL,
  `storage_key` VARCHAR(255) NOT NULL,
  `uploaded_by` CHAR(36) NULL,
  `uploaded_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_24_scope` (`business_id`, `id`),
  UNIQUE KEY `uq_24_01` (`business_id`, `storage_key`),
  KEY `ix_24_01` (`business_id`, `purchase_order_id`, `document_type`),
  KEY `ix_24_02` (`business_id`, `sha256`),
  CONSTRAINT `fk_24_biz` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT `fk_24_01` FOREIGN KEY (`business_id`, `purchase_order_id`) REFERENCES `purchase_orders` (`business_id`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT `fk_24_02` FOREIGN KEY (`business_id`, `quotation_id`) REFERENCES `quotations` (`business_id`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT `fk_24_03` FOREIGN KEY (`business_id`, `invoice_id`) REFERENCES `invoices` (`business_id`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT `fk_24_04` FOREIGN KEY (`business_id`, `payment_id`) REFERENCES `payments` (`business_id`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT `fk_24_05` FOREIGN KEY (`business_id`, `delivery_id`) REFERENCES `deliveries` (`business_id`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT `fk_24_06` FOREIGN KEY (`business_id`, `payment_claim_id`) REFERENCES `payment_claims` (`business_id`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT `fk_24_07` FOREIGN KEY (`business_id`, `payment_promise_id`) REFERENCES `payment_promises` (`business_id`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT `fk_24_08` FOREIGN KEY (`business_id`, `dispute_id`) REFERENCES `dispute_cases` (`business_id`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT `fk_24_09` FOREIGN KEY (`business_id`, `customer_id`) REFERENCES `customers` (`business_id`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT `fk_24_10` FOREIGN KEY (`business_id`, `email_message_id`) REFERENCES `email_messages` (`business_id`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT `fk_24_11` FOREIGN KEY (`business_id`, `uploaded_by`) REFERENCES `users` (`business_id`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 25. document_extractions: OCR and AI proposed values; originals stay intact; human reviews before writing business facts.
CREATE TABLE IF NOT EXISTS `document_extractions` (
  `id` CHAR(36) NOT NULL,
  `business_id` CHAR(36) NOT NULL,
  `document_id` CHAR(36) NOT NULL,
  `extraction_kind` VARCHAR(45) NOT NULL,
  `ocr_text` MEDIUMTEXT NULL,
  `proposed_fields_json` LONGTEXT NOT NULL,
  `confirmed_fields_json` LONGTEXT NULL,
  `model_name` VARCHAR(160) NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'pending',
  `error_message` TEXT NULL,
  `reviewed_by` CHAR(36) NULL,
  `reviewed_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_25_scope` (`business_id`, `id`),
  KEY `ix_25_01` (`business_id`, `document_id`, `created_at`),
  CONSTRAINT `fk_25_biz` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT `fk_25_01` FOREIGN KEY (`business_id`, `document_id`) REFERENCES `documents` (`business_id`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT `fk_25_02` FOREIGN KEY (`business_id`, `reviewed_by`) REFERENCES `users` (`business_id`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 26. activity_events: Immutable-ish timeline of order, invoice, payment, documents and approvals.
CREATE TABLE IF NOT EXISTS `activity_events` (
  `id` CHAR(36) NOT NULL,
  `business_id` CHAR(36) NOT NULL,
  `purchase_order_id` CHAR(36) NULL,
  `invoice_id` CHAR(36) NULL,
  `customer_id` CHAR(36) NULL,
  `event_type` VARCHAR(70) NOT NULL,
  `actor_user_id` CHAR(36) NULL,
  `actor_label` VARCHAR(160) NULL,
  `actor_role` VARCHAR(30) NULL,
  `description` TEXT NULL,
  `metadata_json` LONGTEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_26_scope` (`business_id`, `id`),
  KEY `ix_26_01` (`business_id`, `purchase_order_id`, `created_at`),
  KEY `ix_26_02` (`business_id`, `invoice_id`, `created_at`),
  CONSTRAINT `fk_26_biz` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT `fk_26_01` FOREIGN KEY (`business_id`, `purchase_order_id`) REFERENCES `purchase_orders` (`business_id`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT `fk_26_02` FOREIGN KEY (`business_id`, `invoice_id`) REFERENCES `invoices` (`business_id`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT `fk_26_03` FOREIGN KEY (`business_id`, `customer_id`) REFERENCES `customers` (`business_id`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT `fk_26_04` FOREIGN KEY (`business_id`, `actor_user_id`) REFERENCES `users` (`business_id`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 27. notifications: Action Center unread alerts and navigational links.
CREATE TABLE IF NOT EXISTS `notifications` (
  `id` CHAR(36) NOT NULL,
  `business_id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NULL,
  `title` VARCHAR(200) NOT NULL,
  `body` TEXT NULL,
  `kind` VARCHAR(40) NOT NULL,
  `link` VARCHAR(255) NULL,
  `is_read` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_27_scope` (`business_id`, `id`),
  KEY `ix_27_01` (`business_id`, `is_read`, `created_at`),
  CONSTRAINT `fk_27_biz` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT `fk_27_01` FOREIGN KEY (`business_id`, `user_id`) REFERENCES `users` (`business_id`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 28. ai_conversations: Existing assistant chat history per business/user; no authority to approve.
CREATE TABLE IF NOT EXISTS `ai_conversations` (
  `id` CHAR(36) NOT NULL,
  `business_id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NULL,
  `role` VARCHAR(15) NOT NULL,
  `content` LONGTEXT NOT NULL,
  `source_refs_json` LONGTEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_28_scope` (`business_id`, `id`),
  KEY `ix_28_01` (`business_id`, `created_at`),
  CONSTRAINT `fk_28_biz` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT `fk_28_01` FOREIGN KEY (`business_id`, `user_id`) REFERENCES `users` (`business_id`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 29. background_jobs: Durable OCR/email webhook processing and retry/idempotency bookkeeping.
CREATE TABLE IF NOT EXISTS `background_jobs` (
  `id` CHAR(36) NOT NULL,
  `business_id` CHAR(36) NOT NULL,
  `job_type` VARCHAR(45) NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'pending',
  `payload_json` LONGTEXT NULL,
  `idempotency_key` VARCHAR(191) NULL,
  `attempt_count` INT UNSIGNED NOT NULL DEFAULT 0,
  `next_attempt_at` DATETIME NULL,
  `locked_at` DATETIME NULL,
  `result_json` LONGTEXT NULL,
  `last_error` TEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_29_scope` (`business_id`, `id`),
  UNIQUE KEY `uq_29_01` (`business_id`, `idempotency_key`),
  KEY `ix_29_01` (`business_id`, `status`, `next_attempt_at`),
  CONSTRAINT `fk_29_biz` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Quick read-only check in phpMyAdmin:
-- SHOW TABLES;
-- SELECT TABLE_NAME, COUNT(*) FROM information_schema.COLUMNS
-- WHERE TABLE_SCHEMA='nudgewise_db' GROUP BY TABLE_NAME ORDER BY TABLE_NAME;
