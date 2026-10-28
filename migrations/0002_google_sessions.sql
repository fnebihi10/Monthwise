CREATE TABLE oauth_attempts (
 state_hash TEXT PRIMARY KEY NOT NULL,
 browser_hash TEXT NOT NULL,
 verifier TEXT NOT NULL,
 nonce TEXT NOT NULL,
 expires_at INTEGER NOT NULL
);
CREATE INDEX oauth_attempt_expiry ON oauth_attempts(expires_at);
CREATE TABLE sessions (
 token_hash TEXT PRIMARY KEY NOT NULL,
 user_id TEXT NOT NULL REFERENCES users(id),
 email TEXT NOT NULL,
 expires_at INTEGER NOT NULL
);
CREATE INDEX session_expiry ON sessions(expires_at);
CREATE TABLE auth_rate_limits (
 key_hash TEXT NOT NULL,
 window INTEGER NOT NULL,
 count INTEGER NOT NULL,
 PRIMARY KEY(key_hash,window)
);
