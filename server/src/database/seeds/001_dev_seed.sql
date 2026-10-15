-- BooksBuddy Development Seed Data
-- 001_dev_seed.sql

-- Clear existing data safely in reverse dependency order
TRUNCATE TABLE 
    chat_messages,
    custody_history,
    handover_sessions,
    borrow_requests,
    books,
    community_notices,
    contributions_ledger,
    book_demand_votes,
    book_demands,
    library_members,
    libraries,
    sessions,
    users
RESTART IDENTITY CASCADE;

-- 1. USERS (Password for all accounts: Password123!)
INSERT INTO users (id, email, password_hash, full_name, phone, society_locality, flat_house_number, city)
VALUES 
    (1, 'aarav@example.com', '$2b$10$t35NFTHAFnd4qpZ1XODur.KssuQTIcNO/u7Tbm15GOAylbcCMTyZe', 'Aarav Sharma', '+919876543210', 'Greenwood Estate, Bellandur', 'Tower A-402', 'Bengaluru'),
    (2, 'priya@example.com', '$2b$10$t35NFTHAFnd4qpZ1XODur.KssuQTIcNO/u7Tbm15GOAylbcCMTyZe', 'Priya Patel', '+919876543211', 'Greenwood Estate, Bellandur', 'Tower B-105', 'Bengaluru'),
    (3, 'rohan@example.com', '$2b$10$t35NFTHAFnd4qpZ1XODur.KssuQTIcNO/u7Tbm15GOAylbcCMTyZe', 'Rohan Verma', '+919876543212', 'Greenwood Estate, Bellandur', 'Tower C-204', 'Bengaluru'),
    (4, 'ananya@example.com', '$2b$10$t35NFTHAFnd4qpZ1XODur.KssuQTIcNO/u7Tbm15GOAylbcCMTyZe', 'Ananya Iyer', '+919876543213', 'Greenwood Estate, Bellandur', 'Tower A-301', 'Bengaluru');

-- Reset users sequence to next value
SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));

-- 2. LIBRARIES
INSERT INTO libraries (id, name, slug, society_locality, city, description, invite_code, is_verified, max_borrow_days, handover_window_hours, max_books_per_member, max_renewals, created_by)
VALUES (
    1, 
    'Greenwood Community Library', 
    'greenwood-community-library', 
    'Greenwood Estate, Bellandur', 
    'Bengaluru', 
    'A virtual community library for residents of Greenwood Estate to share personal book collections.', 
    'GREENWOOD2026', 
    true, 
    14, 
    48, 
    3, 
    1, 
    1
);

SELECT setval('libraries_id_seq', (SELECT MAX(id) FROM libraries));

-- 3. LIBRARY MEMBERSHIPS
INSERT INTO library_members (library_id, user_id, role, status, approved_by, approved_at)
VALUES 
    (1, 1, 'PRIMARY_LIBRARIAN', 'APPROVED', 1, CURRENT_TIMESTAMP),
    (1, 2, 'LIBRARIAN', 'APPROVED', 1, CURRENT_TIMESTAMP),
    (1, 3, 'MEMBER', 'APPROVED', 1, CURRENT_TIMESTAMP),
    (1, 4, 'MEMBER', 'PENDING', NULL, NULL);

-- 4. DONATED BOOKS (Attributed to Community Collection; Initial Custody with Donor)
INSERT INTO books (id, library_id, isbn, title, author, cover_image_url, genre, description, original_donor_id, current_custodian_id, status)
VALUES 
    (1, 1, '9780061120084', 'To Kill a Mockingbird', 'Harper Lee', 'https://covers.openlibrary.org/b/isbn/9780061120084-L.jpg', 'Fiction', 'The unforgettable novel of a childhood in a sleepy Southern town and the crisis of conscience that rocked it.', 1, 1, 'AVAILABLE'),
    (2, 1, '9780735211292', 'Atomic Habits', 'James Clear', 'https://covers.openlibrary.org/b/isbn/9780735211292-L.jpg', 'Self-Help', 'An easy and proven way to build good habits and break bad ones.', 2, 2, 'AVAILABLE'),
    (3, 1, '9780743273565', 'The Great Gatsby', 'F. Scott Fitzgerald', 'https://covers.openlibrary.org/b/isbn/9780743273565-L.jpg', 'Classic', 'The story of the fabulously wealthy Jay Gatsby and his new love for the beautiful Daisy Buchanan.', 3, 3, 'AVAILABLE');

SELECT setval('books_id_seq', (SELECT MAX(id) FROM books));

-- 5. INITIAL CUSTODY HISTORY (Atomic Audit Trail for Book Donations)
INSERT INTO custody_history (book_id, handover_session_id, from_user_id, to_user_id, giver_condition_rating, receiver_condition_rating)
VALUES 
    (1, NULL, NULL, 1, 'GOOD', 'GOOD'),
    (2, NULL, NULL, 2, 'NEW', 'NEW'),
    (3, NULL, NULL, 3, 'GOOD', 'GOOD');

-- 6. COMMUNITY NOTICE BOARD
INSERT INTO community_notices (library_id, author_id, title, description, category, contact_info, expires_at)
VALUES (
    1, 
    2, 
    'Weekend Painting Classes for Kids', 
    'Fun beginner watercolor and acrylic painting sessions for children aged 6 to 14 every Saturday morning at the Clubhouse.', 
    'Art & Workshops', 
    'Contact Priya: Flat B-105 or via in-app message', 
    CURRENT_TIMESTAMP + INTERVAL '30 days'
);

-- 7. BOOK DEMAND WISHLIST
INSERT INTO book_demands (id, library_id, suggested_by, title, author, isbn, status, upvotes_count, librarian_notes)
VALUES (
    1, 
    1, 
    3, 
    'Thinking, Fast and Slow', 
    'Daniel Kahneman', 
    '9780374533557', 
    'REQUESTED', 
    1, 
    'Popular request; reviewing library funds for purchase.'
);

SELECT setval('book_demands_id_seq', (SELECT MAX(id) FROM book_demands));

INSERT INTO book_demand_votes (demand_id, user_id)
VALUES (1, 3);

-- 8. VOLUNTARY CONTRIBUTIONS & EXPENDITURE LEDGER
INSERT INTO contributions_ledger (library_id, user_id, type, amount, description, recorded_by)
VALUES (
    1, 
    1, 
    'DONATION', 
    1500.00, 
    'Voluntary community fund contribution by primary librarian for new book purchases.', 
    1
);
