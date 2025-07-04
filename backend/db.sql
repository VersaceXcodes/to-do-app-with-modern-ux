CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(255) PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    last_login_at BIGINT,
    last_active_view JSONB
);

CREATE TABLE IF NOT EXISTS categories (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tasks (
    id VARCHAR(255) PRIMARY SKEY,
    user_id VARCHAR(255) NOT NULL,
    category_id VARCHAR(255),
    title VARCHAR(255) NOT NULL,
    description VARCHAR(5000),
    due_date_at BIGINT,
    priority VARCHAR(50) NOT NULL DEFAULT 'medium',
    is_completed BOOLEAN NOT NULL DEFAULT FALSE,
    completed_at BIGINT,
    order_index INTEGER NOT NULL,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);

INSERT INTO users (id, email, password_hash, created_at, updated_at, last_login_at, last_active_view) VALUES
('user_001', 'john.doe@example.com', 'hashed_password_123', 1678886400000, 1678886400000, 1678972800000, '{"filter_type": "category", "filter_value": "Work", "show_completed": false}'),
('user_002', 'jane.smith@example.com', 'hashed_password_456', 1678972800000, 1678972800000, 1679059200000, '{"filter_type": "priority", "filter_value": "high", "show_completed": true}'),
('user_003', 'peter.jones@example.com', 'hashed_password_789', 1679059200000, 1679059200000, NULL, NULL);

INSERT INTO categories (id, user_id, name, created_at, updated_at) VALUES
('cat_001', 'user_001', 'Work', 1678886500000, 1678886500000),
('cat_002', 'user_001', 'Personal', 1678886550000, 1678886550000),
('cat_003', 'user_002', 'Groceries', 1678972900000, 1678972900000),
('cat_004', 'user_002', 'Study', 1678972950000, 1678972950000),
('cat_005', 'user_001', 'Health', 1678900000000, 1678900000000);


INSERT INTO tasks (id, user_id, category_id, title, description, due_date_at, priority, is_completed, completed_at, order_index, created_at, updated_at) VALUES
('task_001', 'user_001', 'cat_001', 'Finish Q1 Report', 'Complete sections 1-3 and send to manager.', 1679155200000, 'high', FALSE, NULL, 0, 1678886600000, 1678886600000),
('task_002', 'user_001', 'cat_002', 'Buy groceries', 'Milk, eggs, bread, vegetables.', 1679241600000, 'medium', FALSE, NULL, 1, 1678886650000, 1678886650000),
('task_003', 'user_001', 'cat_001', 'Schedule team meeting', 'Find a time slot for weekly sync.', NULL, 'low', FALSE, NULL, 2, 1678886700000, 1678886700000),
('task_004', 'user_002', 'cat_003', 'Buy apples', 'Granny Smith.', 1679328000000, 'medium', FALSE, NULL, 0, 1678973000000, 1678973000000),
('task_005', 'user_002', 'cat_004', 'Prepare for history exam', 'Review chapters 1-5.', 1679500800000, 'high', FALSE, NULL, 1, 1678973050000, 1678973050000),
('task_006', 'user_001', 'cat_001', 'Respond to client email', 'Address their concerns about the new feature.', NULL, 'high', FALSE, NULL, 3, 1678900100000, 1678900100000),
('task_007', 'user_001', 'cat_002', 'Call mom', 'Check in and say hello.', NULL, 'low', TRUE, 1679000000000, 4, 1678900150000, 1679000000000),
('task_008', 'user_002', NULL, 'Clean apartment', 'Vacuum, dust, tidy up.', 1679414400000, 'medium', FALSE, NULL, 2, 1678973100000, 1678973100000),
('task_009', 'user_003', NULL, 'Research new technologies', 'Look into AI models for image generation.', NULL, 'high', FALSE, NULL, 0, 1679059300000, 1679059300000),
('task_010', 'user_001', 'cat_005', 'Go for a run', '30 minutes in the park.', NULL, 'low', FALSE, NULL, 5, 1679000500000, 1679000500000),
('task_011', 'user_001', 'cat_001', 'Review PRD v2', 'Check for consistency and completeness.', 1679241600000, 'high', FALSE, NULL, 6, 1679000600000, 1679000600000),
('task_012', 'user_001', 'cat_002', 'Book dental appointment', 'Reschedule last canceled appointment.', 1679328000000, 'medium', FALSE, NULL, 7, 1679000700000, 1679000700000),
('task_013', 'user_002', 'cat_004', 'Write essay outline', 'For the English literature class.', 1679673600000, 'high', FALSE, NULL, 3, 1679100000000, 1679100000000),
('task_014', 'user_002', 'cat_003', 'Pick up dry cleaning', 'Suit and shirts.', NULL, 'low', TRUE, 1679200000000, 4, 1679100100000, 1679200000000),
('task_015', 'user_001', NULL, 'Water plants', 'Don''t forget the herbs!', NULL, 'low', FALSE, NULL, 8, 1679200000000, 1679200000000);