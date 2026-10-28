CREATE TABLE ledger_versions (
 owner_id TEXT PRIMARY KEY NOT NULL REFERENCES users(id),
 version INTEGER NOT NULL DEFAULT 0
);
INSERT INTO ledger_versions(owner_id,version) SELECT id,1 FROM users;
CREATE INDEX transactions_owner_id ON transactions(owner_id,id);
CREATE INDEX transactions_owner_account ON transactions(owner_id,account_id);
CREATE INDEX transfers_owner_id ON transfers(owner_id,id);
CREATE INDEX transfers_owner_source ON transfers(owner_id,source_account_id);
CREATE INDEX transfers_owner_destination ON transfers(owner_id,destination_account_id);
CREATE TRIGGER accounts_version_insert AFTER INSERT ON accounts BEGIN INSERT INTO ledger_versions(owner_id,version) VALUES(NEW.owner_id,1) ON CONFLICT(owner_id) DO UPDATE SET version=version+1; END;
CREATE TRIGGER accounts_version_update AFTER UPDATE ON accounts BEGIN INSERT INTO ledger_versions(owner_id,version) VALUES(NEW.owner_id,1) ON CONFLICT(owner_id) DO UPDATE SET version=version+1; END;
CREATE TRIGGER accounts_version_delete AFTER DELETE ON accounts BEGIN INSERT INTO ledger_versions(owner_id,version) VALUES(OLD.owner_id,1) ON CONFLICT(owner_id) DO UPDATE SET version=version+1; END;
CREATE TRIGGER transactions_version_insert AFTER INSERT ON transactions BEGIN INSERT INTO ledger_versions(owner_id,version) VALUES(NEW.owner_id,1) ON CONFLICT(owner_id) DO UPDATE SET version=version+1; END;
CREATE TRIGGER transactions_version_update AFTER UPDATE ON transactions BEGIN INSERT INTO ledger_versions(owner_id,version) VALUES(NEW.owner_id,1) ON CONFLICT(owner_id) DO UPDATE SET version=version+1; END;
CREATE TRIGGER transactions_version_delete AFTER DELETE ON transactions BEGIN INSERT INTO ledger_versions(owner_id,version) VALUES(OLD.owner_id,1) ON CONFLICT(owner_id) DO UPDATE SET version=version+1; END;
CREATE TRIGGER transfers_version_insert AFTER INSERT ON transfers BEGIN INSERT INTO ledger_versions(owner_id,version) VALUES(NEW.owner_id,1) ON CONFLICT(owner_id) DO UPDATE SET version=version+1; END;
CREATE TRIGGER transfers_version_update AFTER UPDATE ON transfers BEGIN INSERT INTO ledger_versions(owner_id,version) VALUES(NEW.owner_id,1) ON CONFLICT(owner_id) DO UPDATE SET version=version+1; END;
CREATE TRIGGER transfers_version_delete AFTER DELETE ON transfers BEGIN INSERT INTO ledger_versions(owner_id,version) VALUES(OLD.owner_id,1) ON CONFLICT(owner_id) DO UPDATE SET version=version+1; END;
CREATE TRIGGER budgets_version_insert AFTER INSERT ON budgets BEGIN INSERT INTO ledger_versions(owner_id,version) VALUES(NEW.owner_id,1) ON CONFLICT(owner_id) DO UPDATE SET version=version+1; END;
CREATE TRIGGER budgets_version_update AFTER UPDATE ON budgets BEGIN INSERT INTO ledger_versions(owner_id,version) VALUES(NEW.owner_id,1) ON CONFLICT(owner_id) DO UPDATE SET version=version+1; END;
CREATE TRIGGER budgets_version_delete AFTER DELETE ON budgets BEGIN INSERT INTO ledger_versions(owner_id,version) VALUES(OLD.owner_id,1) ON CONFLICT(owner_id) DO UPDATE SET version=version+1; END;
CREATE TRIGGER plans_version_insert AFTER INSERT ON plans BEGIN INSERT INTO ledger_versions(owner_id,version) VALUES(NEW.owner_id,1) ON CONFLICT(owner_id) DO UPDATE SET version=version+1; END;
CREATE TRIGGER plans_version_update AFTER UPDATE ON plans BEGIN INSERT INTO ledger_versions(owner_id,version) VALUES(NEW.owner_id,1) ON CONFLICT(owner_id) DO UPDATE SET version=version+1; END;
CREATE TRIGGER plans_version_delete AFTER DELETE ON plans BEGIN INSERT INTO ledger_versions(owner_id,version) VALUES(OLD.owner_id,1) ON CONFLICT(owner_id) DO UPDATE SET version=version+1; END;
CREATE TRIGGER goals_version_insert AFTER INSERT ON goals BEGIN INSERT INTO ledger_versions(owner_id,version) VALUES(NEW.owner_id,1) ON CONFLICT(owner_id) DO UPDATE SET version=version+1; END;
CREATE TRIGGER goals_version_update AFTER UPDATE ON goals BEGIN INSERT INTO ledger_versions(owner_id,version) VALUES(NEW.owner_id,1) ON CONFLICT(owner_id) DO UPDATE SET version=version+1; END;
CREATE TRIGGER goals_version_delete AFTER DELETE ON goals BEGIN INSERT INTO ledger_versions(owner_id,version) VALUES(OLD.owner_id,1) ON CONFLICT(owner_id) DO UPDATE SET version=version+1; END;
CREATE TRIGGER allocations_version_insert AFTER INSERT ON allocations BEGIN INSERT INTO ledger_versions(owner_id,version) VALUES(NEW.owner_id,1) ON CONFLICT(owner_id) DO UPDATE SET version=version+1; END;
CREATE TRIGGER allocations_version_update AFTER UPDATE ON allocations BEGIN INSERT INTO ledger_versions(owner_id,version) VALUES(NEW.owner_id,1) ON CONFLICT(owner_id) DO UPDATE SET version=version+1; END;
CREATE TRIGGER allocations_version_delete AFTER DELETE ON allocations BEGIN INSERT INTO ledger_versions(owner_id,version) VALUES(OLD.owner_id,1) ON CONFLICT(owner_id) DO UPDATE SET version=version+1; END;
