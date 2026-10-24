-- --------------------------------------------------------
-- Host:                         127.0.0.1
-- Server version:               8.4.3 - MySQL Community Server - GPL
-- Server OS:                    Win64
-- HeidiSQL Version:             12.8.0.6908
-- --------------------------------------------------------

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET NAMES utf8 */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;


-- Dumping database structure for nudgewise_db
DROP DATABASE IF EXISTS `nudgewise_db`;
CREATE DATABASE IF NOT EXISTS `nudgewise_db` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci */ /*!80016 DEFAULT ENCRYPTION='N' */;
USE `nudgewise_db`;

-- Dumping structure for table nudgewise_db.activity_events
DROP TABLE IF EXISTS `activity_events`;
CREATE TABLE IF NOT EXISTS `activity_events` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `business_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `purchase_order_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `invoice_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `customer_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `event_type` varchar(70) COLLATE utf8mb4_unicode_ci NOT NULL,
  `actor_user_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `actor_label` varchar(160) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `actor_role` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `metadata_json` longtext COLLATE utf8mb4_unicode_ci,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_26_scope` (`business_id`,`id`),
  KEY `ix_26_01` (`business_id`,`purchase_order_id`,`created_at`),
  KEY `ix_26_02` (`business_id`,`invoice_id`,`created_at`),
  KEY `fk_26_03` (`business_id`,`customer_id`),
  KEY `fk_26_04` (`business_id`,`actor_user_id`),
  CONSTRAINT `fk_26_01` FOREIGN KEY (`business_id`, `purchase_order_id`) REFERENCES `purchase_orders` (`business_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_26_02` FOREIGN KEY (`business_id`, `invoice_id`) REFERENCES `invoices` (`business_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_26_03` FOREIGN KEY (`business_id`, `customer_id`) REFERENCES `customers` (`business_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_26_04` FOREIGN KEY (`business_id`, `actor_user_id`) REFERENCES `users` (`business_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_26_biz` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Data exporting was unselected.

-- Dumping structure for table nudgewise_db.ai_conversations
DROP TABLE IF EXISTS `ai_conversations`;
CREATE TABLE IF NOT EXISTS `ai_conversations` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `business_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `role` varchar(15) COLLATE utf8mb4_unicode_ci NOT NULL,
  `content` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `source_refs_json` longtext COLLATE utf8mb4_unicode_ci,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_28_scope` (`business_id`,`id`),
  KEY `ix_28_01` (`business_id`,`created_at`),
  KEY `fk_28_01` (`business_id`,`user_id`),
  CONSTRAINT `fk_28_01` FOREIGN KEY (`business_id`, `user_id`) REFERENCES `users` (`business_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_28_biz` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Data exporting was unselected.

-- Dumping structure for table nudgewise_db.background_jobs
DROP TABLE IF EXISTS `background_jobs`;
CREATE TABLE IF NOT EXISTS `background_jobs` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `business_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `job_type` varchar(45) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `payload_json` longtext COLLATE utf8mb4_unicode_ci,
  `idempotency_key` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `attempt_count` int unsigned NOT NULL DEFAULT '0',
  `next_attempt_at` datetime DEFAULT NULL,
  `locked_at` datetime DEFAULT NULL,
  `result_json` longtext COLLATE utf8mb4_unicode_ci,
  `last_error` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_29_scope` (`business_id`,`id`),
  UNIQUE KEY `uq_29_01` (`business_id`,`idempotency_key`),
  KEY `ix_29_01` (`business_id`,`status`,`next_attempt_at`),
  CONSTRAINT `fk_29_biz` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Data exporting was unselected.

-- Dumping structure for table nudgewise_db.businesses
DROP TABLE IF EXISTS `businesses`;
CREATE TABLE IF NOT EXISTS `businesses` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL,
  `display_name` varchar(160) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `registration_number` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(254) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `phone` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `address` text COLLATE utf8mb4_unicode_ci,
  `currency` char(3) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'MYR',
  `timezone` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Asia/Kuala_Lumpur',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Data exporting was unselected.

-- Dumping structure for table nudgewise_db.credits
DROP TABLE IF EXISTS `credits`;
CREATE TABLE IF NOT EXISTS `credits` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `business_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `invoice_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `credit_number` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `amount` decimal(15,2) NOT NULL,
  `reason` text COLLATE utf8mb4_unicode_ci,
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'draft',
  `issued_at` datetime DEFAULT NULL,
  `approved_by` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_19_scope` (`business_id`,`id`),
  UNIQUE KEY `uq_19_01` (`business_id`,`credit_number`),
  KEY `ix_19_01` (`business_id`,`invoice_id`,`status`),
  KEY `fk_19_02` (`business_id`,`approved_by`),
  CONSTRAINT `fk_19_01` FOREIGN KEY (`business_id`, `invoice_id`) REFERENCES `invoices` (`business_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_19_02` FOREIGN KEY (`business_id`, `approved_by`) REFERENCES `users` (`business_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_19_biz` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Data exporting was unselected.

-- Dumping structure for table nudgewise_db.customers
DROP TABLE IF EXISTS `customers`;
CREATE TABLE IF NOT EXISTS `customers` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `business_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(180) COLLATE utf8mb4_unicode_ci NOT NULL,
  `contact_person` varchar(160) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `phone` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(254) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `billing_email` varchar(254) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `address` text COLLATE utf8mb4_unicode_ci,
  `preferred_language` char(2) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'en',
  `notes` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_03_scope` (`business_id`,`id`),
  KEY `ix_03_01` (`business_id`,`name`),
  KEY `ix_03_02` (`business_id`,`phone`),
  CONSTRAINT `fk_03_biz` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Data exporting was unselected.

-- Dumping structure for table nudgewise_db.customer_responses
DROP TABLE IF EXISTS `customer_responses`;
CREATE TABLE IF NOT EXISTS `customer_responses` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `business_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `purchase_order_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `invoice_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `customer_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email_message_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `follow_up_action_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `message` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `ai_category` varchar(60) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ai_confidence` decimal(5,4) DEFAULT NULL,
  `ai_suggested_action` text COLLATE utf8mb4_unicode_ci,
  `ai_proposed_date` date DEFAULT NULL,
  `ai_promised_amount` decimal(15,2) DEFAULT NULL,
  `review_status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `reviewed_by` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `reviewed_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_23_scope` (`business_id`,`id`),
  KEY `ix_23_01` (`business_id`,`review_status`,`created_at`),
  KEY `fk_23_01` (`business_id`,`purchase_order_id`),
  KEY `fk_23_02` (`business_id`,`invoice_id`),
  KEY `fk_23_03` (`business_id`,`customer_id`),
  KEY `fk_23_04` (`business_id`,`email_message_id`),
  KEY `fk_23_05` (`business_id`,`follow_up_action_id`),
  KEY `fk_23_06` (`business_id`,`reviewed_by`),
  CONSTRAINT `fk_23_01` FOREIGN KEY (`business_id`, `purchase_order_id`) REFERENCES `purchase_orders` (`business_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_23_02` FOREIGN KEY (`business_id`, `invoice_id`) REFERENCES `invoices` (`business_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_23_03` FOREIGN KEY (`business_id`, `customer_id`) REFERENCES `customers` (`business_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_23_04` FOREIGN KEY (`business_id`, `email_message_id`) REFERENCES `email_messages` (`business_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_23_05` FOREIGN KEY (`business_id`, `follow_up_action_id`) REFERENCES `follow_up_actions` (`business_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_23_06` FOREIGN KEY (`business_id`, `reviewed_by`) REFERENCES `users` (`business_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_23_biz` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Data exporting was unselected.

-- Dumping structure for table nudgewise_db.deliveries
DROP TABLE IF EXISTS `deliveries`;
CREATE TABLE IF NOT EXISTS `deliveries` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `business_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `purchase_order_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `customer_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `delivery_reference` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `delivery_date` date DEFAULT NULL,
  `status` varchar(25) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'planned',
  `acceptance_status` varchar(25) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'unknown',
  `accepted_at` datetime DEFAULT NULL,
  `accepted_by_name` varchar(160) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `confirmed_by` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_11_scope` (`business_id`,`id`),
  KEY `ix_11_01` (`business_id`,`purchase_order_id`,`delivery_date`),
  KEY `fk_11_02` (`business_id`,`customer_id`),
  KEY `fk_11_03` (`business_id`,`confirmed_by`),
  CONSTRAINT `fk_11_01` FOREIGN KEY (`business_id`, `purchase_order_id`) REFERENCES `purchase_orders` (`business_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_11_02` FOREIGN KEY (`business_id`, `customer_id`) REFERENCES `customers` (`business_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_11_03` FOREIGN KEY (`business_id`, `confirmed_by`) REFERENCES `users` (`business_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_11_biz` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Data exporting was unselected.

-- Dumping structure for table nudgewise_db.delivery_items
DROP TABLE IF EXISTS `delivery_items`;
CREATE TABLE IF NOT EXISTS `delivery_items` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `business_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `delivery_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `purchase_order_item_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `line_no` int unsigned NOT NULL,
  `item_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `quantity_delivered` decimal(12,3) NOT NULL,
  `quantity_accepted` decimal(12,3) DEFAULT NULL,
  `unit` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_12_scope` (`business_id`,`id`),
  UNIQUE KEY `uq_12_01` (`business_id`,`delivery_id`,`line_no`),
  KEY `fk_12_02` (`business_id`,`purchase_order_item_id`),
  CONSTRAINT `fk_12_01` FOREIGN KEY (`business_id`, `delivery_id`) REFERENCES `deliveries` (`business_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_12_02` FOREIGN KEY (`business_id`, `purchase_order_item_id`) REFERENCES `purchase_order_items` (`business_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_12_biz` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Data exporting was unselected.

-- Dumping structure for table nudgewise_db.dispute_cases
DROP TABLE IF EXISTS `dispute_cases`;
CREATE TABLE IF NOT EXISTS `dispute_cases` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `business_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `purchase_order_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `invoice_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `customer_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `reason_code` varchar(35) COLLATE utf8mb4_unicode_ci NOT NULL,
  `disputed_amount` decimal(15,2) DEFAULT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `status` varchar(25) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'open',
  `owner_user_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `resolution` text COLLATE utf8mb4_unicode_ci,
  `resolved_by` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `resolved_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_18_scope` (`business_id`,`id`),
  KEY `ix_18_01` (`business_id`,`status`,`created_at`),
  KEY `fk_18_01` (`business_id`,`purchase_order_id`),
  KEY `fk_18_02` (`business_id`,`invoice_id`),
  KEY `fk_18_03` (`business_id`,`customer_id`),
  KEY `fk_18_04` (`business_id`,`owner_user_id`),
  KEY `fk_18_05` (`business_id`,`resolved_by`),
  CONSTRAINT `fk_18_01` FOREIGN KEY (`business_id`, `purchase_order_id`) REFERENCES `purchase_orders` (`business_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_18_02` FOREIGN KEY (`business_id`, `invoice_id`) REFERENCES `invoices` (`business_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_18_03` FOREIGN KEY (`business_id`, `customer_id`) REFERENCES `customers` (`business_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_18_04` FOREIGN KEY (`business_id`, `owner_user_id`) REFERENCES `users` (`business_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_18_05` FOREIGN KEY (`business_id`, `resolved_by`) REFERENCES `users` (`business_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_18_biz` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Data exporting was unselected.

-- Dumping structure for table nudgewise_db.documents
DROP TABLE IF EXISTS `documents`;
CREATE TABLE IF NOT EXISTS `documents` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `business_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `purchase_order_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `quotation_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `invoice_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `payment_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `delivery_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `payment_claim_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `payment_promise_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `dispute_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `customer_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email_message_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `document_type` varchar(45) COLLATE utf8mb4_unicode_ci NOT NULL,
  `source` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'upload',
  `original_filename` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `mime_type` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `file_size_bytes` bigint unsigned NOT NULL,
  `sha256` char(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `storage_key` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `uploaded_by` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `uploaded_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_24_scope` (`business_id`,`id`),
  UNIQUE KEY `uq_24_01` (`business_id`,`storage_key`),
  KEY `ix_24_01` (`business_id`,`purchase_order_id`,`document_type`),
  KEY `ix_24_02` (`business_id`,`sha256`),
  KEY `fk_24_02` (`business_id`,`quotation_id`),
  KEY `fk_24_03` (`business_id`,`invoice_id`),
  KEY `fk_24_04` (`business_id`,`payment_id`),
  KEY `fk_24_05` (`business_id`,`delivery_id`),
  KEY `fk_24_06` (`business_id`,`payment_claim_id`),
  KEY `fk_24_07` (`business_id`,`payment_promise_id`),
  KEY `fk_24_08` (`business_id`,`dispute_id`),
  KEY `fk_24_09` (`business_id`,`customer_id`),
  KEY `fk_24_10` (`business_id`,`email_message_id`),
  KEY `fk_24_11` (`business_id`,`uploaded_by`),
  CONSTRAINT `fk_24_01` FOREIGN KEY (`business_id`, `purchase_order_id`) REFERENCES `purchase_orders` (`business_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_24_02` FOREIGN KEY (`business_id`, `quotation_id`) REFERENCES `quotations` (`business_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_24_03` FOREIGN KEY (`business_id`, `invoice_id`) REFERENCES `invoices` (`business_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_24_04` FOREIGN KEY (`business_id`, `payment_id`) REFERENCES `payments` (`business_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_24_05` FOREIGN KEY (`business_id`, `delivery_id`) REFERENCES `deliveries` (`business_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_24_06` FOREIGN KEY (`business_id`, `payment_claim_id`) REFERENCES `payment_claims` (`business_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_24_07` FOREIGN KEY (`business_id`, `payment_promise_id`) REFERENCES `payment_promises` (`business_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_24_08` FOREIGN KEY (`business_id`, `dispute_id`) REFERENCES `dispute_cases` (`business_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_24_09` FOREIGN KEY (`business_id`, `customer_id`) REFERENCES `customers` (`business_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_24_10` FOREIGN KEY (`business_id`, `email_message_id`) REFERENCES `email_messages` (`business_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_24_11` FOREIGN KEY (`business_id`, `uploaded_by`) REFERENCES `users` (`business_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_24_biz` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Data exporting was unselected.

-- Dumping structure for table nudgewise_db.document_extractions
DROP TABLE IF EXISTS `document_extractions`;
CREATE TABLE IF NOT EXISTS `document_extractions` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `business_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `document_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `extraction_kind` varchar(45) COLLATE utf8mb4_unicode_ci NOT NULL,
  `ocr_text` mediumtext COLLATE utf8mb4_unicode_ci,
  `proposed_fields_json` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `confirmed_fields_json` longtext COLLATE utf8mb4_unicode_ci,
  `model_name` varchar(160) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `error_message` text COLLATE utf8mb4_unicode_ci,
  `reviewed_by` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `reviewed_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_25_scope` (`business_id`,`id`),
  KEY `ix_25_01` (`business_id`,`document_id`,`created_at`),
  KEY `fk_25_02` (`business_id`,`reviewed_by`),
  CONSTRAINT `fk_25_01` FOREIGN KEY (`business_id`, `document_id`) REFERENCES `documents` (`business_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_25_02` FOREIGN KEY (`business_id`, `reviewed_by`) REFERENCES `users` (`business_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_25_biz` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Data exporting was unselected.

-- Dumping structure for table nudgewise_db.email_messages
DROP TABLE IF EXISTS `email_messages`;
CREATE TABLE IF NOT EXISTS `email_messages` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `business_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `purchase_order_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `quotation_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `invoice_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `customer_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `follow_up_action_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `direction` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL,
  `from_email` varchar(254) COLLATE utf8mb4_unicode_ci NOT NULL,
  `to_email` varchar(254) COLLATE utf8mb4_unicode_ci NOT NULL,
  `reply_to_email` varchar(254) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `subject` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `body_text` longtext COLLATE utf8mb4_unicode_ci,
  `provider` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `provider_message_id` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `rfc_message_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `in_reply_to` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` varchar(25) COLLATE utf8mb4_unicode_ci NOT NULL,
  `received_or_sent_at` datetime DEFAULT NULL,
  `review_status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'unreviewed',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_22_scope` (`business_id`,`id`),
  UNIQUE KEY `uq_22_01` (`business_id`,`provider`,`provider_message_id`),
  KEY `ix_22_01` (`business_id`,`purchase_order_id`,`created_at`),
  KEY `ix_22_02` (`business_id`,`invoice_id`,`created_at`),
  KEY `fk_22_02` (`business_id`,`quotation_id`),
  KEY `fk_22_04` (`business_id`,`customer_id`),
  KEY `fk_22_05` (`business_id`,`follow_up_action_id`),
  CONSTRAINT `fk_22_01` FOREIGN KEY (`business_id`, `purchase_order_id`) REFERENCES `purchase_orders` (`business_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_22_02` FOREIGN KEY (`business_id`, `quotation_id`) REFERENCES `quotations` (`business_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_22_03` FOREIGN KEY (`business_id`, `invoice_id`) REFERENCES `invoices` (`business_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_22_04` FOREIGN KEY (`business_id`, `customer_id`) REFERENCES `customers` (`business_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_22_05` FOREIGN KEY (`business_id`, `follow_up_action_id`) REFERENCES `follow_up_actions` (`business_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_22_biz` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Data exporting was unselected.

-- Dumping structure for table nudgewise_db.follow_up_actions
DROP TABLE IF EXISTS `follow_up_actions`;
CREATE TABLE IF NOT EXISTS `follow_up_actions` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `business_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `purchase_order_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `invoice_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `customer_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `kind` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `checkpoint` smallint unsigned DEFAULT NULL,
  `reason` text COLLATE utf8mb4_unicode_ci,
  `message` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `message_version` int unsigned NOT NULL DEFAULT '1',
  `approval_state` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `approved_by` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  `approved_message_hash` char(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `send_state` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'not_sent',
  `recipient_email` varchar(254) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sent_at` datetime DEFAULT NULL,
  `delivery_status` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_21_scope` (`business_id`,`id`),
  KEY `ix_21_01` (`business_id`,`approval_state`,`send_state`),
  KEY `ix_21_02` (`business_id`,`invoice_id`,`checkpoint`),
  KEY `fk_21_01` (`business_id`,`purchase_order_id`),
  KEY `fk_21_03` (`business_id`,`customer_id`),
  KEY `fk_21_04` (`business_id`,`approved_by`),
  CONSTRAINT `fk_21_01` FOREIGN KEY (`business_id`, `purchase_order_id`) REFERENCES `purchase_orders` (`business_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_21_02` FOREIGN KEY (`business_id`, `invoice_id`) REFERENCES `invoices` (`business_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_21_03` FOREIGN KEY (`business_id`, `customer_id`) REFERENCES `customers` (`business_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_21_04` FOREIGN KEY (`business_id`, `approved_by`) REFERENCES `users` (`business_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_21_biz` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Data exporting was unselected.

-- Dumping structure for table nudgewise_db.invoices
DROP TABLE IF EXISTS `invoices`;
CREATE TABLE IF NOT EXISTS `invoices` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `business_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `purchase_order_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `quotation_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `customer_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `invoice_number` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `issue_date` date DEFAULT NULL,
  `submitted_at` datetime DEFAULT NULL,
  `confirmed_received_at` datetime DEFAULT NULL,
  `due_date` date DEFAULT NULL,
  `currency` char(3) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'MYR',
  `subtotal` decimal(15,2) NOT NULL DEFAULT '0.00',
  `discount_total` decimal(15,2) NOT NULL DEFAULT '0.00',
  `tax_total` decimal(15,2) NOT NULL DEFAULT '0.00',
  `invoice_amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `document_status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'draft',
  `dispute_active` tinyint(1) NOT NULL DEFAULT '0',
  `settlement_required` tinyint(1) NOT NULL DEFAULT '0',
  `verification_hold` tinyint(1) NOT NULL DEFAULT '0',
  `notes` text COLLATE utf8mb4_unicode_ci,
  `approved_by` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_09_scope` (`business_id`,`id`),
  UNIQUE KEY `uq_09_01` (`business_id`,`invoice_number`),
  KEY `ix_09_01` (`business_id`,`customer_id`,`due_date`),
  KEY `ix_09_02` (`business_id`,`purchase_order_id`,`document_status`),
  KEY `fk_09_02` (`business_id`,`quotation_id`),
  KEY `fk_09_04` (`business_id`,`approved_by`),
  CONSTRAINT `fk_09_01` FOREIGN KEY (`business_id`, `purchase_order_id`) REFERENCES `purchase_orders` (`business_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_09_02` FOREIGN KEY (`business_id`, `quotation_id`) REFERENCES `quotations` (`business_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_09_03` FOREIGN KEY (`business_id`, `customer_id`) REFERENCES `customers` (`business_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_09_04` FOREIGN KEY (`business_id`, `approved_by`) REFERENCES `users` (`business_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_09_biz` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Data exporting was unselected.

-- Dumping structure for table nudgewise_db.invoice_items
DROP TABLE IF EXISTS `invoice_items`;
CREATE TABLE IF NOT EXISTS `invoice_items` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `business_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `invoice_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `line_no` int unsigned NOT NULL,
  `item_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `item_code` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `quantity` decimal(12,3) NOT NULL,
  `unit` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `unit_price` decimal(15,2) NOT NULL,
  `discount_amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `line_total` decimal(15,2) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_10_scope` (`business_id`,`id`),
  UNIQUE KEY `uq_10_01` (`business_id`,`invoice_id`,`line_no`),
  CONSTRAINT `fk_10_01` FOREIGN KEY (`business_id`, `invoice_id`) REFERENCES `invoices` (`business_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_10_biz` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Data exporting was unselected.

-- Dumping structure for table nudgewise_db.notifications
DROP TABLE IF EXISTS `notifications`;
CREATE TABLE IF NOT EXISTS `notifications` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `business_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `title` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `body` text COLLATE utf8mb4_unicode_ci,
  `kind` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `link` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_read` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_27_scope` (`business_id`,`id`),
  KEY `ix_27_01` (`business_id`,`is_read`,`created_at`),
  KEY `fk_27_01` (`business_id`,`user_id`),
  CONSTRAINT `fk_27_01` FOREIGN KEY (`business_id`, `user_id`) REFERENCES `users` (`business_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_27_biz` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Data exporting was unselected.

-- Dumping structure for table nudgewise_db.order_requirements
DROP TABLE IF EXISTS `order_requirements`;
CREATE TABLE IF NOT EXISTS `order_requirements` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `business_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `purchase_order_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `po_required` tinyint(1) NOT NULL DEFAULT '0',
  `delivery_proof_required` tinyint(1) NOT NULL DEFAULT '0',
  `acceptance_required` tinyint(1) NOT NULL DEFAULT '0',
  `due_trigger` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'other',
  `net_days` smallint unsigned DEFAULT NULL,
  `fixed_due_date` date DEFAULT NULL,
  `deposit_percent` decimal(5,2) DEFAULT NULL,
  `agreed_terms_text` text COLLATE utf8mb4_unicode_ci,
  `source_description` text COLLATE utf8mb4_unicode_ci,
  `confirmation_status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'unconfirmed',
  `confirmed_by` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `confirmed_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_06_scope` (`business_id`,`id`),
  UNIQUE KEY `uq_06_01` (`business_id`,`purchase_order_id`),
  KEY `fk_06_02` (`business_id`,`confirmed_by`),
  CONSTRAINT `fk_06_01` FOREIGN KEY (`business_id`, `purchase_order_id`) REFERENCES `purchase_orders` (`business_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_06_02` FOREIGN KEY (`business_id`, `confirmed_by`) REFERENCES `users` (`business_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_06_biz` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Data exporting was unselected.

-- Dumping structure for table nudgewise_db.order_stages
DROP TABLE IF EXISTS `order_stages`;
CREATE TABLE IF NOT EXISTS `order_stages` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `business_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `purchase_order_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `stage_code` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `stage_status` varchar(25) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'not_started',
  `completed_at` datetime DEFAULT NULL,
  `confirmed_by` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `summary` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_16_scope` (`business_id`,`id`),
  UNIQUE KEY `uq_16_01` (`business_id`,`purchase_order_id`,`stage_code`),
  KEY `fk_16_02` (`business_id`,`confirmed_by`),
  CONSTRAINT `fk_16_01` FOREIGN KEY (`business_id`, `purchase_order_id`) REFERENCES `purchase_orders` (`business_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_16_02` FOREIGN KEY (`business_id`, `confirmed_by`) REFERENCES `users` (`business_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_16_biz` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Data exporting was unselected.

-- Dumping structure for table nudgewise_db.payments
DROP TABLE IF EXISTS `payments`;
CREATE TABLE IF NOT EXISTS `payments` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `business_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `invoice_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `amount` decimal(15,2) NOT NULL,
  `payment_date` date NOT NULL,
  `method` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `reference` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `verification_status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'recorded',
  `verified_by` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `verified_at` datetime NOT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_13_scope` (`business_id`,`id`),
  KEY `ix_13_01` (`business_id`,`invoice_id`,`payment_date`),
  KEY `fk_13_02` (`business_id`,`verified_by`),
  CONSTRAINT `fk_13_01` FOREIGN KEY (`business_id`, `invoice_id`) REFERENCES `invoices` (`business_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_13_02` FOREIGN KEY (`business_id`, `verified_by`) REFERENCES `users` (`business_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_13_biz` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Data exporting was unselected.

-- Dumping structure for table nudgewise_db.payment_blockers
DROP TABLE IF EXISTS `payment_blockers`;
CREATE TABLE IF NOT EXISTS `payment_blockers` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `business_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `purchase_order_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `invoice_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `blocker_code` varchar(45) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `next_action` text COLLATE utf8mb4_unicode_ci,
  `owner_user_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'open',
  `source_type` varchar(25) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'rule',
  `resolved_by` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `resolved_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_20_scope` (`business_id`,`id`),
  KEY `ix_20_01` (`business_id`,`purchase_order_id`,`status`),
  KEY `ix_20_02` (`business_id`,`invoice_id`,`status`),
  KEY `fk_20_03` (`business_id`,`owner_user_id`),
  KEY `fk_20_04` (`business_id`,`resolved_by`),
  CONSTRAINT `fk_20_01` FOREIGN KEY (`business_id`, `purchase_order_id`) REFERENCES `purchase_orders` (`business_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_20_02` FOREIGN KEY (`business_id`, `invoice_id`) REFERENCES `invoices` (`business_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_20_03` FOREIGN KEY (`business_id`, `owner_user_id`) REFERENCES `users` (`business_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_20_04` FOREIGN KEY (`business_id`, `resolved_by`) REFERENCES `users` (`business_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_20_biz` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Data exporting was unselected.

-- Dumping structure for table nudgewise_db.payment_claims
DROP TABLE IF EXISTS `payment_claims`;
CREATE TABLE IF NOT EXISTS `payment_claims` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `business_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `invoice_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `customer_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `claimed_amount` decimal(15,2) DEFAULT NULL,
  `claimed_date` date DEFAULT NULL,
  `reference` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` varchar(25) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending_verification',
  `verified_payment_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `reviewed_by` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `reviewed_at` datetime DEFAULT NULL,
  `review_note` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_14_scope` (`business_id`,`id`),
  KEY `ix_14_01` (`business_id`,`status`,`created_at`),
  KEY `fk_14_01` (`business_id`,`invoice_id`),
  KEY `fk_14_02` (`business_id`,`customer_id`),
  KEY `fk_14_03` (`business_id`,`verified_payment_id`),
  KEY `fk_14_04` (`business_id`,`reviewed_by`),
  CONSTRAINT `fk_14_01` FOREIGN KEY (`business_id`, `invoice_id`) REFERENCES `invoices` (`business_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_14_02` FOREIGN KEY (`business_id`, `customer_id`) REFERENCES `customers` (`business_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_14_03` FOREIGN KEY (`business_id`, `verified_payment_id`) REFERENCES `payments` (`business_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_14_04` FOREIGN KEY (`business_id`, `reviewed_by`) REFERENCES `users` (`business_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_14_biz` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Data exporting was unselected.

-- Dumping structure for table nudgewise_db.payment_promises
DROP TABLE IF EXISTS `payment_promises`;
CREATE TABLE IF NOT EXISTS `payment_promises` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `business_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `purchase_order_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `invoice_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `customer_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `promised_amount` decimal(15,2) DEFAULT NULL,
  `promised_date` date NOT NULL,
  `status` varchar(25) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'proposed',
  `promise_source` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'manual',
  `confirmed_by` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `confirmed_at` datetime DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_17_scope` (`business_id`,`id`),
  KEY `ix_17_01` (`business_id`,`promised_date`,`status`),
  KEY `fk_17_01` (`business_id`,`purchase_order_id`),
  KEY `fk_17_02` (`business_id`,`invoice_id`),
  KEY `fk_17_03` (`business_id`,`customer_id`),
  KEY `fk_17_04` (`business_id`,`confirmed_by`),
  CONSTRAINT `fk_17_01` FOREIGN KEY (`business_id`, `purchase_order_id`) REFERENCES `purchase_orders` (`business_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_17_02` FOREIGN KEY (`business_id`, `invoice_id`) REFERENCES `invoices` (`business_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_17_03` FOREIGN KEY (`business_id`, `customer_id`) REFERENCES `customers` (`business_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_17_04` FOREIGN KEY (`business_id`, `confirmed_by`) REFERENCES `users` (`business_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_17_biz` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Data exporting was unselected.

-- Dumping structure for table nudgewise_db.purchase_orders
DROP TABLE IF EXISTS `purchase_orders`;
CREATE TABLE IF NOT EXISTS `purchase_orders` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `business_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `customer_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `order_reference` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `po_number` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `source_mode` varchar(25) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'manual',
  `document_kind` varchar(25) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'order_request',
  `status` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'draft',
  `buyer_approval_status` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'not_requested',
  `order_date` date DEFAULT NULL,
  `requested_delivery_date` date DEFAULT NULL,
  `currency` char(3) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'MYR',
  `document_total` decimal(15,2) DEFAULT NULL,
  `buyer_details_snapshot` longtext COLLATE utf8mb4_unicode_ci,
  `supplier_details_snapshot` longtext COLLATE utf8mb4_unicode_ci,
  `delivery_address` text COLLATE utf8mb4_unicode_ci,
  `delivery_contact` varchar(160) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `payment_terms_text` text COLLATE utf8mb4_unicode_ci,
  `delivery_terms_text` text COLLATE utf8mb4_unicode_ci,
  `requested_by` varchar(160) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `document_approved_by_text` varchar(160) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `department` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `seller_approved_by` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `seller_approved_at` datetime DEFAULT NULL,
  `override_reason` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_04_scope` (`business_id`,`id`),
  UNIQUE KEY `uq_04_01` (`business_id`,`order_reference`),
  UNIQUE KEY `uq_04_02` (`business_id`,`customer_id`,`po_number`),
  KEY `ix_04_01` (`business_id`,`customer_id`,`created_at`),
  KEY `ix_04_02` (`business_id`,`status`),
  KEY `fk_04_02` (`business_id`,`seller_approved_by`),
  CONSTRAINT `fk_04_01` FOREIGN KEY (`business_id`, `customer_id`) REFERENCES `customers` (`business_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_04_02` FOREIGN KEY (`business_id`, `seller_approved_by`) REFERENCES `users` (`business_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_04_biz` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Data exporting was unselected.

-- Dumping structure for table nudgewise_db.purchase_order_items
DROP TABLE IF EXISTS `purchase_order_items`;
CREATE TABLE IF NOT EXISTS `purchase_order_items` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `business_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `purchase_order_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `line_no` int unsigned NOT NULL,
  `item_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `item_code` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `quantity` decimal(12,3) DEFAULT NULL,
  `unit` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `unit_price` decimal(15,2) DEFAULT NULL,
  `discount_amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `line_total` decimal(15,2) DEFAULT NULL,
  `review_status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_05_scope` (`business_id`,`id`),
  UNIQUE KEY `uq_05_01` (`business_id`,`purchase_order_id`,`line_no`),
  CONSTRAINT `fk_05_01` FOREIGN KEY (`business_id`, `purchase_order_id`) REFERENCES `purchase_orders` (`business_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_05_biz` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Data exporting was unselected.

-- Dumping structure for table nudgewise_db.quotations
DROP TABLE IF EXISTS `quotations`;
CREATE TABLE IF NOT EXISTS `quotations` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `business_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `purchase_order_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `customer_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `quotation_number` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `revision_no` smallint unsigned NOT NULL DEFAULT '1',
  `issue_date` date DEFAULT NULL,
  `valid_until` date DEFAULT NULL,
  `currency` char(3) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'MYR',
  `subtotal` decimal(15,2) NOT NULL DEFAULT '0.00',
  `discount_total` decimal(15,2) NOT NULL DEFAULT '0.00',
  `tax_total` decimal(15,2) NOT NULL DEFAULT '0.00',
  `total_amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `payment_terms` text COLLATE utf8mb4_unicode_ci,
  `delivery_terms` text COLLATE utf8mb4_unicode_ci,
  `status` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'draft',
  `buyer_response_at` datetime DEFAULT NULL,
  `buyer_response_source` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `buyer_response_confirmed_by` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `approved_by` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_07_scope` (`business_id`,`id`),
  UNIQUE KEY `uq_07_01` (`business_id`,`quotation_number`),
  KEY `ix_07_01` (`business_id`,`purchase_order_id`,`status`),
  KEY `fk_07_02` (`business_id`,`customer_id`),
  KEY `fk_07_03` (`business_id`,`buyer_response_confirmed_by`),
  KEY `fk_07_04` (`business_id`,`approved_by`),
  CONSTRAINT `fk_07_01` FOREIGN KEY (`business_id`, `purchase_order_id`) REFERENCES `purchase_orders` (`business_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_07_02` FOREIGN KEY (`business_id`, `customer_id`) REFERENCES `customers` (`business_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_07_03` FOREIGN KEY (`business_id`, `buyer_response_confirmed_by`) REFERENCES `users` (`business_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_07_04` FOREIGN KEY (`business_id`, `approved_by`) REFERENCES `users` (`business_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_07_biz` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Data exporting was unselected.

-- Dumping structure for table nudgewise_db.quotation_items
DROP TABLE IF EXISTS `quotation_items`;
CREATE TABLE IF NOT EXISTS `quotation_items` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `business_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `quotation_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `line_no` int unsigned NOT NULL,
  `item_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `item_code` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `quantity` decimal(12,3) NOT NULL,
  `unit` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `unit_price` decimal(15,2) NOT NULL,
  `discount_amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `line_total` decimal(15,2) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_08_scope` (`business_id`,`id`),
  UNIQUE KEY `uq_08_01` (`business_id`,`quotation_id`,`line_no`),
  CONSTRAINT `fk_08_01` FOREIGN KEY (`business_id`, `quotation_id`) REFERENCES `quotations` (`business_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_08_biz` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Data exporting was unselected.

-- Dumping structure for table nudgewise_db.receipts
DROP TABLE IF EXISTS `receipts`;
CREATE TABLE IF NOT EXISTS `receipts` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `business_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `payment_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `receipt_number` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `issued_at` datetime DEFAULT NULL,
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'draft',
  `issued_by` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_15_scope` (`business_id`,`id`),
  UNIQUE KEY `uq_15_01` (`business_id`,`receipt_number`),
  UNIQUE KEY `uq_15_02` (`business_id`,`payment_id`),
  KEY `fk_15_02` (`business_id`,`issued_by`),
  CONSTRAINT `fk_15_01` FOREIGN KEY (`business_id`, `payment_id`) REFERENCES `payments` (`business_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_15_02` FOREIGN KEY (`business_id`, `issued_by`) REFERENCES `users` (`business_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_15_biz` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Data exporting was unselected.

-- Dumping structure for table nudgewise_db.users
DROP TABLE IF EXISTS `users`;
CREATE TABLE IF NOT EXISTS `users` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `business_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(254) COLLATE utf8mb4_unicode_ci NOT NULL,
  `role` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'staff',
  `password_hash` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_02_scope` (`business_id`,`id`),
  UNIQUE KEY `uq_02_01` (`business_id`,`email`),
  CONSTRAINT `fk_02_biz` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Data exporting was unselected.

/*!40103 SET TIME_ZONE=IFNULL(@OLD_TIME_ZONE, 'system') */;
/*!40101 SET SQL_MODE=IFNULL(@OLD_SQL_MODE, '') */;
/*!40014 SET FOREIGN_KEY_CHECKS=IFNULL(@OLD_FOREIGN_KEY_CHECKS, 1) */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40111 SET SQL_NOTES=IFNULL(@OLD_SQL_NOTES, 1) */;
