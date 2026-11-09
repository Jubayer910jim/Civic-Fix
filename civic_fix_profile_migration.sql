-- Run this once in phpMyAdmin with civic_fix selected.
-- Adds the fields required by the citizen profile page.
ALTER TABLE users
    ADD COLUMN city VARCHAR(120) NULL AFTER phone,
    ADD COLUMN profile_image VARCHAR(500) NULL AFTER city;
