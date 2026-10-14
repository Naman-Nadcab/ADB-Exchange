-- Wallet-identity foundation (STEP 2).
-- Login credentials only. Does not create custodial wallets, deposit addresses,
-- sessions, or Forex accounts. Idempotent. Safe to re-run.
-- Applied by apps/backend/src/database/migrate.ts (appended statements).
-- Do not backfill from wallets, user_master_keys, hot_wallets, or cold_wallets.

-- Existing emails stay as stored. NULL is allowed for a later wallet-native user.
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;

-- Case-insensitive uniqueness for real emails. Multiple NULLs stay allowed.
-- users_email_key (UNIQUE (email)) is left in place: PostgreSQL unique indexes
-- already treat NULL as distinct, so it does not block multiple NULL emails.
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower_unique
  ON users (lower(email))
  WHERE email IS NOT NULL;

CREATE TABLE IF NOT EXISTS user_wallets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  namespace VARCHAR(16) NOT NULL,
  chain_reference TEXT NOT NULL,
  address TEXT NOT NULL,
  normalized_address TEXT NOT NULL,
  caip10 TEXT NOT NULL,
  wallet_type VARCHAR(16) NOT NULL,
  provider TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  verified_at TIMESTAMP WITH TIME ZONE,
  linked_at TIMESTAMP WITH TIME ZONE,
  last_used_at TIMESTAMP WITH TIME ZONE,
  status VARCHAR(16) NOT NULL DEFAULT 'active',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT user_wallets_namespace_check CHECK (namespace IN ('eip155', 'solana')),
  CONSTRAINT user_wallets_wallet_type_check CHECK (wallet_type IN ('eoa', 'contract')),
  CONSTRAINT user_wallets_status_check CHECK (status IN ('active', 'disabled', 'compromised')),
  CONSTRAINT user_wallets_chain_reference_nonempty CHECK (length(btrim(chain_reference)) > 0),
  CONSTRAINT user_wallets_address_nonempty CHECK (length(btrim(address)) > 0),
  CONSTRAINT user_wallets_normalized_nonempty CHECK (length(btrim(normalized_address)) > 0),
  CONSTRAINT user_wallets_caip10_nonempty CHECK (length(btrim(caip10)) > 0),
  CONSTRAINT user_wallets_evm_normalized_lowercase CHECK (
    namespace <> 'eip155' OR normalized_address = lower(normalized_address)
  ),
  CONSTRAINT user_wallets_metadata_no_secrets CHECK (
    NOT (metadata ?| ARRAY[
      'private_key', 'privateKey', 'seed', 'seed_phrase', 'mnemonic',
      'wallet_password', 'password', 'kms_secret', 'access_token', 'refresh_token', 'signature'
    ])
  )
);

-- One login credential per EVM address across chains, and per Solana address.
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_wallets_namespace_normalized_address
  ON user_wallets (namespace, normalized_address);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_wallets_caip10
  ON user_wallets (caip10);

-- One active primary login wallet per user. Disabled and compromised rows may remain.
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_wallets_one_active_primary
  ON user_wallets (user_id)
  WHERE is_primary IS TRUE AND status = 'active';

CREATE INDEX IF NOT EXISTS idx_user_wallets_user_id
  ON user_wallets (user_id);

-- Later login can order a user's active credentials by last use without a full scan.
CREATE INDEX IF NOT EXISTS idx_user_wallets_user_last_used
  ON user_wallets (user_id, last_used_at DESC NULLS LAST)
  WHERE status = 'active';

DROP TRIGGER IF EXISTS update_user_wallets_updated_at ON user_wallets;
CREATE TRIGGER update_user_wallets_updated_at
  BEFORE UPDATE ON user_wallets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE user_wallets IS
  'Login wallet credentials for users.id. Not deposit addresses, not hot/cold custody, not Forex accounts. metadata must not store keys, seeds, passwords, tokens, or reusable signatures.';

CREATE TABLE IF NOT EXISTS wallet_auth_challenges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nonce TEXT NOT NULL,
  namespace VARCHAR(16) NOT NULL,
  chain_reference TEXT NOT NULL,
  normalized_address TEXT NOT NULL,
  domain TEXT NOT NULL,
  message TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  consumed_at TIMESTAMP WITH TIME ZONE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT wallet_auth_challenges_namespace_check CHECK (namespace IN ('eip155', 'solana')),
  CONSTRAINT wallet_auth_challenges_nonce_nonempty CHECK (length(btrim(nonce)) > 0),
  CONSTRAINT wallet_auth_challenges_chain_reference_nonempty CHECK (length(btrim(chain_reference)) > 0),
  CONSTRAINT wallet_auth_challenges_address_nonempty CHECK (length(btrim(normalized_address)) > 0),
  CONSTRAINT wallet_auth_challenges_domain_nonempty CHECK (length(btrim(domain)) > 0),
  CONSTRAINT wallet_auth_challenges_message_nonempty CHECK (length(btrim(message)) > 0),
  CONSTRAINT wallet_auth_challenges_nonce_key UNIQUE (nonce)
);

-- Open challenges for an address. Consumed rows stay for audit but are not the lookup path.
CREATE INDEX IF NOT EXISTS idx_wallet_auth_challenges_open_address
  ON wallet_auth_challenges (namespace, normalized_address)
  WHERE consumed_at IS NULL;

-- Expiry sweep of unused and used challenges.
CREATE INDEX IF NOT EXISTS idx_wallet_auth_challenges_expires_at
  ON wallet_auth_challenges (expires_at);

-- Authenticated link challenges only. First-login rows have NULL user_id.
CREATE INDEX IF NOT EXISTS idx_wallet_auth_challenges_user_id
  ON wallet_auth_challenges (user_id)
  WHERE user_id IS NOT NULL;

COMMENT ON TABLE wallet_auth_challenges IS
  'Single-use SIWE/SIWS challenges. nonce is unique. consumed_at NULL means unused. Not a session and not a bearer token.';
