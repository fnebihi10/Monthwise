PRAGMA foreign_keys = ON;
CREATE TABLE users (
 id TEXT PRIMARY KEY NOT NULL,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE accounts (
 id TEXT PRIMARY KEY NOT NULL,
 owner_id TEXT NOT NULL REFERENCES users(id),
 name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 60),
 kind TEXT NOT NULL CHECK(kind IN ('cash','bank','savings')),
 currency TEXT NOT NULL DEFAULT 'EUR' CHECK(currency='EUR'),
 opening_balance_cents INTEGER NOT NULL DEFAULT 0 CHECK(abs(opening_balance_cents)<=100000000),
 UNIQUE(owner_id,id)
);
CREATE INDEX accounts_owner ON accounts(owner_id);
CREATE TABLE transactions (
 id TEXT PRIMARY KEY NOT NULL,
 owner_id TEXT NOT NULL REFERENCES users(id),
 account_id TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('income','expense')),
 amount_cents INTEGER NOT NULL CHECK(amount_cents BETWEEN 1 AND 100000000),
 date TEXT NOT NULL CHECK(length(date)=10),
 merchant TEXT NOT NULL CHECK(length(merchant) BETWEEN 1 AND 100),
 category TEXT NOT NULL,
 note TEXT NOT NULL DEFAULT '' CHECK(length(note)<=250),
 revision INTEGER NOT NULL DEFAULT 1,
 FOREIGN KEY(owner_id,account_id) REFERENCES accounts(owner_id,id)
);
CREATE INDEX transactions_owner_date ON transactions(owner_id,date);
CREATE TABLE transfers (
 id TEXT PRIMARY KEY NOT NULL,
 owner_id TEXT NOT NULL REFERENCES users(id),
 source_account_id TEXT NOT NULL,
 destination_account_id TEXT NOT NULL,
 amount_cents INTEGER NOT NULL CHECK(amount_cents BETWEEN 1 AND 100000000),
 date TEXT NOT NULL CHECK(length(date)=10),
 note TEXT NOT NULL DEFAULT '' CHECK(length(note)<=250),
 CHECK(source_account_id<>destination_account_id),
 FOREIGN KEY(owner_id,source_account_id) REFERENCES accounts(owner_id,id),
 FOREIGN KEY(owner_id,destination_account_id) REFERENCES accounts(owner_id,id)
);
CREATE INDEX transfers_owner_date ON transfers(owner_id,date);
CREATE TABLE rate_limits (
 owner_id TEXT NOT NULL,
 window INTEGER NOT NULL,
 count INTEGER NOT NULL,
 PRIMARY KEY(owner_id,window)
);
