-- BooksBuddy Initial Schema Migration
-- Migration: 001_initial_schema.sql

-- 1. USERS
CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    phone VARCHAR(30) NOT NULL,
    society_locality VARCHAR(255) NOT NULL,
    flat_house_number VARCHAR(100) NOT NULL,
    city VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 2. SERVER-MANAGED SESSIONS
CREATE TABLE IF NOT EXISTS sessions (
    id VARCHAR(64) PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    last_accessed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- 3. LIBRARIES
CREATE TABLE IF NOT EXISTS libraries (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    slug VARCHAR(200) UNIQUE NOT NULL,
    society_locality VARCHAR(255) NOT NULL,
    city VARCHAR(100) NOT NULL,
    description TEXT,
    invite_code VARCHAR(32) UNIQUE,
    is_verified BOOLEAN DEFAULT FALSE NOT NULL,
    max_borrow_days INTEGER NOT NULL DEFAULT 14 CHECK (max_borrow_days > 0),
    handover_window_hours INTEGER NOT NULL DEFAULT 48 CHECK (handover_window_hours > 0),
    max_books_per_member INTEGER NOT NULL DEFAULT 3 CHECK (max_books_per_member > 0),
    max_renewals INTEGER NOT NULL DEFAULT 1 CHECK (max_renewals >= 0),
    created_by BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_libraries_locality ON libraries(city, society_locality);

-- 4. LIBRARY MEMBERSHIPS
CREATE TABLE IF NOT EXISTS library_members (
    id BIGSERIAL PRIMARY KEY,
    library_id BIGINT NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('PRIMARY_LIBRARIAN', 'LIBRARIAN', 'MEMBER')),
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED')),
    approved_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT uq_library_user UNIQUE (library_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_lib_members_user ON library_members(user_id, status);
CREATE INDEX IF NOT EXISTS idx_lib_members_pending ON library_members(library_id) WHERE status = 'PENDING';

-- 5. BOOKS (Virtual Community Collection)
CREATE TABLE IF NOT EXISTS books (
    id BIGSERIAL PRIMARY KEY,
    library_id BIGINT NOT NULL REFERENCES libraries(id) ON DELETE RESTRICT,
    isbn VARCHAR(20),
    title VARCHAR(300) NOT NULL,
    author VARCHAR(255) NOT NULL,
    cover_image_url TEXT,
    genre VARCHAR(100),
    description TEXT,
    original_donor_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    current_custodian_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    status VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'RESERVED', 'BORROWED', 'REMOVED')),
    removal_reason TEXT,
    removed_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_books_library_status ON books(library_id, status);
CREATE INDEX IF NOT EXISTS idx_books_custodian ON books(current_custodian_id);
CREATE INDEX IF NOT EXISTS idx_books_search ON books USING gin(to_tsvector('english', title || ' ' || author));

-- 6. BORROW REQUESTS & DETERMINISTIC FIFO QUEUE
CREATE TABLE IF NOT EXISTS borrow_requests (
    id BIGSERIAL PRIMARY KEY,
    book_id BIGINT NOT NULL REFERENCES books(id) ON DELETE RESTRICT,
    borrower_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    status VARCHAR(30) NOT NULL DEFAULT 'QUEUED' 
        CHECK (status IN (
            'QUEUED',
            'CUSTODIAN_APPROVAL_PENDING',
            'HANDOVER_PENDING',
            'ACTIVE',
            'COMPLETED',
            'CANCELLED',
            'DECLINED',
            'EXPIRED',
            'FAILED'
        )),
    borrow_started_at TIMESTAMPTZ,
    due_date TIMESTAMPTZ,
    renewals_used INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_borrow_queue_fifo ON borrow_requests(book_id, created_at ASC, id ASC) WHERE status = 'QUEUED';

CREATE UNIQUE INDEX IF NOT EXISTS uq_single_active_or_pending_borrow 
ON borrow_requests(book_id) 
WHERE status IN ('CUSTODIAN_APPROVAL_PENDING', 'HANDOVER_PENDING', 'ACTIVE');

CREATE UNIQUE INDEX IF NOT EXISTS uq_user_active_or_queued_request 
ON borrow_requests(book_id, borrower_id) 
WHERE status IN ('QUEUED', 'CUSTODIAN_APPROVAL_PENDING', 'HANDOVER_PENDING', 'ACTIVE');

-- 7. HANDOVER SESSIONS
CREATE TABLE IF NOT EXISTS handover_sessions (
    id BIGSERIAL PRIMARY KEY,
    borrow_request_id BIGINT NOT NULL REFERENCES borrow_requests(id) ON DELETE CASCADE,
    book_id BIGINT NOT NULL REFERENCES books(id) ON DELETE RESTRICT,
    giver_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    receiver_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    pin_hash VARCHAR(255) NOT NULL,
    attempts_left SMALLINT NOT NULL DEFAULT 3 CHECK (attempts_left >= 0),
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'VERIFIED', 'FAILED', 'EXPIRED', 'CANCELLED')),
    giver_condition_rating VARCHAR(20) CHECK (giver_condition_rating IN ('NEW', 'GOOD', 'FAIR', 'DAMAGED')),
    giver_confirmed_at TIMESTAMPTZ,
    giver_condition_notes TEXT,
    receiver_condition_rating VARCHAR(20) CHECK (receiver_condition_rating IN ('NEW', 'GOOD', 'FAIR', 'DAMAGED')),
    receiver_confirmed_at TIMESTAMPTZ,
    receiver_condition_notes TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_single_pending_handover_session 
ON handover_sessions(book_id) 
WHERE status = 'PENDING';

-- 8. AUDIT TRAIL: CUSTODY HISTORY
CREATE TABLE IF NOT EXISTS custody_history (
    id BIGSERIAL PRIMARY KEY,
    book_id BIGINT NOT NULL REFERENCES books(id) ON DELETE RESTRICT,
    handover_session_id BIGINT REFERENCES handover_sessions(id) ON DELETE SET NULL,
    from_user_id BIGINT REFERENCES users(id) ON DELETE RESTRICT,
    to_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    giver_condition_rating VARCHAR(20),
    receiver_condition_rating VARCHAR(20),
    transferred_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_custody_history_book ON custody_history(book_id, transferred_at DESC);

-- 9. REAL-TIME CHAT MESSAGES
CREATE TABLE IF NOT EXISTS chat_messages (
    id BIGSERIAL PRIMARY KEY,
    borrow_request_id BIGINT NOT NULL REFERENCES borrow_requests(id) ON DELETE CASCADE,
    sender_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    message_text TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_request ON chat_messages(borrow_request_id, created_at ASC);

-- 10. BOOK DEMAND WISHLIST
CREATE TABLE IF NOT EXISTS book_demands (
    id BIGSERIAL PRIMARY KEY,
    library_id BIGINT NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
    suggested_by BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    title VARCHAR(300) NOT NULL,
    author VARCHAR(255) NOT NULL,
    isbn VARCHAR(20),
    status VARCHAR(25) NOT NULL DEFAULT 'REQUESTED' CHECK (status IN ('REQUESTED', 'APPROVED_FOR_PURCHASE', 'PURCHASED', 'DECLINED')),
    upvotes_count INTEGER NOT NULL DEFAULT 1 CHECK (upvotes_count >= 0),
    librarian_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 11. BOOK DEMAND VOTES
CREATE TABLE IF NOT EXISTS book_demand_votes (
    demand_id BIGINT NOT NULL REFERENCES book_demands(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    PRIMARY KEY (demand_id, user_id)
);

-- 12. FINANCIAL CONTRIBUTIONS LEDGER
CREATE TABLE IF NOT EXISTS contributions_ledger (
    id BIGSERIAL PRIMARY KEY,
    library_id BIGINT NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
    user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    type VARCHAR(10) NOT NULL CHECK (type IN ('DONATION', 'EXPENSE')),
    amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
    description TEXT NOT NULL,
    recorded_by BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    recorded_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_contributions_library ON contributions_ledger(library_id, recorded_at DESC);

-- 13. COMMUNITY NOTICES
CREATE TABLE IF NOT EXISTS community_notices (
    id BIGSERIAL PRIMARY KEY,
    library_id BIGINT NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
    author_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(50) NOT NULL,
    contact_info VARCHAR(255) NOT NULL,
    image_url TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    is_removed BOOLEAN NOT NULL DEFAULT FALSE,
    removed_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notices_active ON community_notices(library_id, expires_at) WHERE is_removed = FALSE;
