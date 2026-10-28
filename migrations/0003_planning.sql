CREATE TABLE budgets (
 id TEXT PRIMARY KEY NOT NULL, owner_id TEXT NOT NULL REFERENCES users(id),
 month TEXT NOT NULL, category TEXT NOT NULL,
 amount_cents INTEGER NOT NULL CHECK(amount_cents BETWEEN 1 AND 100000000),
 UNIQUE(owner_id,month,category)
);
CREATE INDEX budgets_owner_month ON budgets(owner_id,month);
CREATE TABLE plans (
 id TEXT PRIMARY KEY NOT NULL, owner_id TEXT NOT NULL REFERENCES users(id),
 kind TEXT NOT NULL CHECK(kind IN ('bill','income')), title TEXT NOT NULL,
 amount_cents INTEGER NOT NULL CHECK(amount_cents BETWEEN 1 AND 100000000),
 due_date TEXT NOT NULL, category TEXT NOT NULL, recurring INTEGER NOT NULL DEFAULT 0,
 paid_entry_id TEXT,
 UNIQUE(owner_id,kind,title,due_date)
);
CREATE INDEX plans_owner_date ON plans(owner_id,due_date);
CREATE TABLE goals (
 id TEXT PRIMARY KEY NOT NULL, owner_id TEXT NOT NULL REFERENCES users(id),
 name TEXT NOT NULL, target_cents INTEGER NOT NULL CHECK(target_cents BETWEEN 1 AND 100000000),
 UNIQUE(owner_id,id)
);
CREATE TABLE allocations (
 id TEXT PRIMARY KEY NOT NULL, owner_id TEXT NOT NULL REFERENCES users(id),
 goal_id TEXT NOT NULL, amount_cents INTEGER NOT NULL CHECK(amount_cents BETWEEN 1 AND 100000000),
 date TEXT NOT NULL,
 FOREIGN KEY(owner_id,goal_id) REFERENCES goals(owner_id,id) ON DELETE CASCADE
);
CREATE INDEX allocations_owner_goal ON allocations(owner_id,goal_id);
