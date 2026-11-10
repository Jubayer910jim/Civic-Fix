-- Run once in phpMyAdmin with civic_fix selected.
-- Creates public usernames and the direct-message store.
ALTER TABLE users ADD COLUMN username VARCHAR(32) NULL AFTER full_name;
UPDATE users SET username = CONCAT('user', user_id) WHERE username IS NULL OR username = '';
ALTER TABLE users ADD UNIQUE KEY uq_users_username (username);

CREATE TABLE IF NOT EXISTS civic_messages (
    message_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    sender_id INT(10) UNSIGNED NOT NULL,
    recipient_id INT(10) UNSIGNED NOT NULL,
    message_text VARCHAR(2000) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (message_id),
    KEY idx_civic_messages_sender (sender_id, message_id),
    KEY idx_civic_messages_recipient (recipient_id, message_id),
    CONSTRAINT fk_civic_messages_sender FOREIGN KEY (sender_id) REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_civic_messages_recipient FOREIGN KEY (recipient_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
