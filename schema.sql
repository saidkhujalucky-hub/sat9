CREATE TABLE IF NOT EXISTS documents (collection TEXT NOT NULL, id TEXT NOT NULL, body TEXT NOT NULL, PRIMARY KEY(collection,id));
CREATE INDEX IF NOT EXISTS idx_documents_user ON documents(collection,json_extract(body,'$.userId'));
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON documents(json_extract(body,'$.email')) WHERE collection='users' AND json_extract(body,'$.guest')=0;
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_provider ON documents(json_extract(body,'$.providerId')) WHERE collection='orders' AND json_extract(body,'$.providerId') IS NOT NULL;
