-- Migration 003: Hardening Indexes for Concurrency & Foreign Key Performance
-- Adding indexes on critical foreign keys and query filters to eliminate locking bottlenecks and speed up concurrent lookups

CREATE INDEX IF NOT EXISTS idx_borrow_requests_borrower ON borrow_requests(borrower_id, status);
CREATE INDEX IF NOT EXISTS idx_handover_borrow_request ON handover_sessions(borrow_request_id);
CREATE INDEX IF NOT EXISTS idx_handover_receiver ON handover_sessions(receiver_user_id);
CREATE INDEX IF NOT EXISTS idx_handover_giver ON handover_sessions(giver_user_id);
CREATE INDEX IF NOT EXISTS idx_book_demands_library ON book_demands(library_id, status);
