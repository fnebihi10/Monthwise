ALTER TABLE sessions ADD COLUMN issued_at INTEGER NOT NULL DEFAULT 0;
CREATE INDEX sessions_user ON sessions(user_id);
CREATE TABLE api_rate_limits (
 owner_id TEXT NOT NULL,
 scope TEXT NOT NULL,
 window INTEGER NOT NULL,
 count INTEGER NOT NULL,
 PRIMARY KEY(owner_id,scope,window)
);
CREATE INDEX api_rate_limits_expiry ON api_rate_limits(window);
CREATE INDEX rate_limits_expiry ON rate_limits(window);
CREATE INDEX auth_rate_limits_expiry ON auth_rate_limits(window);
CREATE TABLE ledger_usage (owner_id TEXT PRIMARY KEY NOT NULL REFERENCES users(id), record_count INTEGER NOT NULL DEFAULT 0 CHECK(record_count>=0));
INSERT INTO ledger_usage(owner_id,record_count) SELECT u.id, (SELECT count(*) FROM accounts WHERE owner_id=u.id)+(SELECT count(*) FROM transactions WHERE owner_id=u.id)+(SELECT count(*) FROM transfers WHERE owner_id=u.id)+(SELECT count(*) FROM budgets WHERE owner_id=u.id)+(SELECT count(*) FROM plans WHERE owner_id=u.id)+(SELECT count(*) FROM goals WHERE owner_id=u.id)+(SELECT count(*) FROM allocations WHERE owner_id=u.id) FROM users u;
CREATE TRIGGER accounts_quota BEFORE INSERT ON accounts WHEN COALESCE((SELECT record_count FROM ledger_usage WHERE owner_id=NEW.owner_id),0)>=25000 AND NOT EXISTS(SELECT 1 FROM accounts WHERE id=NEW.id) BEGIN SELECT RAISE(ABORT,'ledger_quota_exceeded'); END;
CREATE TRIGGER accounts_usage_insert AFTER INSERT ON accounts BEGIN INSERT INTO ledger_usage(owner_id,record_count) VALUES(NEW.owner_id,1) ON CONFLICT(owner_id) DO UPDATE SET record_count=record_count+1; END;
CREATE TRIGGER accounts_usage_delete AFTER DELETE ON accounts BEGIN UPDATE ledger_usage SET record_count=record_count-1 WHERE owner_id=OLD.owner_id; END;
CREATE TRIGGER transactions_quota BEFORE INSERT ON transactions WHEN COALESCE((SELECT record_count FROM ledger_usage WHERE owner_id=NEW.owner_id),0)>=25000 AND NOT EXISTS(SELECT 1 FROM transactions WHERE id=NEW.id) BEGIN SELECT RAISE(ABORT,'ledger_quota_exceeded'); END;
CREATE TRIGGER transactions_usage_insert AFTER INSERT ON transactions BEGIN INSERT INTO ledger_usage(owner_id,record_count) VALUES(NEW.owner_id,1) ON CONFLICT(owner_id) DO UPDATE SET record_count=record_count+1; END;
CREATE TRIGGER transactions_usage_delete AFTER DELETE ON transactions BEGIN UPDATE ledger_usage SET record_count=record_count-1 WHERE owner_id=OLD.owner_id; END;
CREATE TRIGGER transfers_quota BEFORE INSERT ON transfers WHEN COALESCE((SELECT record_count FROM ledger_usage WHERE owner_id=NEW.owner_id),0)>=25000 AND NOT EXISTS(SELECT 1 FROM transfers WHERE id=NEW.id) BEGIN SELECT RAISE(ABORT,'ledger_quota_exceeded'); END;
CREATE TRIGGER transfers_usage_insert AFTER INSERT ON transfers BEGIN INSERT INTO ledger_usage(owner_id,record_count) VALUES(NEW.owner_id,1) ON CONFLICT(owner_id) DO UPDATE SET record_count=record_count+1; END;
CREATE TRIGGER transfers_usage_delete AFTER DELETE ON transfers BEGIN UPDATE ledger_usage SET record_count=record_count-1 WHERE owner_id=OLD.owner_id; END;
CREATE TRIGGER budgets_quota BEFORE INSERT ON budgets WHEN COALESCE((SELECT record_count FROM ledger_usage WHERE owner_id=NEW.owner_id),0)>=25000 AND NOT EXISTS(SELECT 1 FROM budgets WHERE id=NEW.id) AND NOT EXISTS(SELECT 1 FROM budgets WHERE owner_id=NEW.owner_id AND month=NEW.month AND category=NEW.category) BEGIN SELECT RAISE(ABORT,'ledger_quota_exceeded'); END;
CREATE TRIGGER budgets_usage_insert AFTER INSERT ON budgets BEGIN INSERT INTO ledger_usage(owner_id,record_count) VALUES(NEW.owner_id,1) ON CONFLICT(owner_id) DO UPDATE SET record_count=record_count+1; END;
CREATE TRIGGER budgets_usage_delete AFTER DELETE ON budgets BEGIN UPDATE ledger_usage SET record_count=record_count-1 WHERE owner_id=OLD.owner_id; END;
CREATE TRIGGER plans_quota BEFORE INSERT ON plans WHEN COALESCE((SELECT record_count FROM ledger_usage WHERE owner_id=NEW.owner_id),0)>=25000 AND NOT EXISTS(SELECT 1 FROM plans WHERE id=NEW.id) AND NOT EXISTS(SELECT 1 FROM plans WHERE owner_id=NEW.owner_id AND kind=NEW.kind AND title=NEW.title AND due_date=NEW.due_date) BEGIN SELECT RAISE(ABORT,'ledger_quota_exceeded'); END;
CREATE TRIGGER plans_usage_insert AFTER INSERT ON plans BEGIN INSERT INTO ledger_usage(owner_id,record_count) VALUES(NEW.owner_id,1) ON CONFLICT(owner_id) DO UPDATE SET record_count=record_count+1; END;
CREATE TRIGGER plans_usage_delete AFTER DELETE ON plans BEGIN UPDATE ledger_usage SET record_count=record_count-1 WHERE owner_id=OLD.owner_id; END;
CREATE TRIGGER goals_quota BEFORE INSERT ON goals WHEN COALESCE((SELECT record_count FROM ledger_usage WHERE owner_id=NEW.owner_id),0)>=25000 AND NOT EXISTS(SELECT 1 FROM goals WHERE id=NEW.id) BEGIN SELECT RAISE(ABORT,'ledger_quota_exceeded'); END;
CREATE TRIGGER goals_usage_insert AFTER INSERT ON goals BEGIN INSERT INTO ledger_usage(owner_id,record_count) VALUES(NEW.owner_id,1) ON CONFLICT(owner_id) DO UPDATE SET record_count=record_count+1; END;
CREATE TRIGGER goals_usage_delete AFTER DELETE ON goals BEGIN UPDATE ledger_usage SET record_count=record_count-1 WHERE owner_id=OLD.owner_id; END;
CREATE TRIGGER allocations_quota BEFORE INSERT ON allocations WHEN COALESCE((SELECT record_count FROM ledger_usage WHERE owner_id=NEW.owner_id),0)>=25000 AND NOT EXISTS(SELECT 1 FROM allocations WHERE id=NEW.id) BEGIN SELECT RAISE(ABORT,'ledger_quota_exceeded'); END;
CREATE TRIGGER allocations_usage_insert AFTER INSERT ON allocations BEGIN INSERT INTO ledger_usage(owner_id,record_count) VALUES(NEW.owner_id,1) ON CONFLICT(owner_id) DO UPDATE SET record_count=record_count+1; END;
CREATE TRIGGER allocations_usage_delete AFTER DELETE ON allocations BEGIN UPDATE ledger_usage SET record_count=record_count-1 WHERE owner_id=OLD.owner_id; END;
