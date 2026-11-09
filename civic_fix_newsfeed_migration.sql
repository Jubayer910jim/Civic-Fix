-- Run once in phpMyAdmin with civic_fix selected.
-- Reports without coordinates stay stored but cannot be matched to a nearby radius.
ALTER TABLE reports
    ADD COLUMN latitude DECIMAL(10, 7) NULL AFTER location,
    ADD COLUMN longitude DECIMAL(10, 7) NULL AFTER latitude,
    ADD INDEX idx_reports_location (latitude, longitude);

CREATE TABLE IF NOT EXISTS report_images (
    image_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    report_id INT(10) UNSIGNED NOT NULL,
    image_path VARCHAR(500) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    stored_filename VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_size INT UNSIGNED NOT NULL,
    image_order TINYINT UNSIGNED NOT NULL DEFAULT 1,
    ai_relevance_status VARCHAR(30) NOT NULL DEFAULT 'pending',
    ai_relevance_score DECIMAL(6, 5) NULL,
    ai_detected_content TEXT NULL,
    ai_explanation TEXT NULL,
    ai_analyzed_at DATETIME NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (image_id),
    KEY idx_report_images_report_order (report_id, image_order),
    CONSTRAINT fk_report_images_report FOREIGN KEY (report_id) REFERENCES reports(report_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS report_comments (
    comment_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    report_id INT(10) UNSIGNED NOT NULL,
    user_id INT(10) UNSIGNED NOT NULL,
    comment_text VARCHAR(1000) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (comment_id),
    KEY idx_report_comments_report_created (report_id, created_at),
    KEY idx_report_comments_user (user_id),
    CONSTRAINT fk_report_comments_report FOREIGN KEY (report_id) REFERENCES reports(report_id) ON DELETE CASCADE,
    CONSTRAINT fk_report_comments_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
