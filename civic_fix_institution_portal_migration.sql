-- Run once with civic_fix selected in phpMyAdmin.
-- The seed command creates the three fixed institution accounts, hashes their
-- generated passwords, and links each account to its institution row.

ALTER TABLE users
    MODIFY role VARCHAR(32) NOT NULL DEFAULT 'citizen';

CREATE TABLE IF NOT EXISTS institutions (
    institution_id INT(10) UNSIGNED NOT NULL AUTO_INCREMENT,
    institution_name VARCHAR(150) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (institution_id),
    UNIQUE KEY uq_institutions_name (institution_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS institution_user_accounts (
    user_id INT(10) UNSIGNED NOT NULL,
    institution_id INT(10) UNSIGNED NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id),
    KEY idx_institution_user_accounts_institution (institution_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- This migration is safe to rerun if the institution portal tables already exist.
-- Then run: npm run seed:institutions
