-- Dedicated database for the CMS integration tests (vitest), so a test run
-- never wipes the development data in `tee`.
CREATE DATABASE tee_test OWNER tee;
