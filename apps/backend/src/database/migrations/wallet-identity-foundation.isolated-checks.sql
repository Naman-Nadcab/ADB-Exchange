-- Isolated constraint checks for wallet-identity-foundation.sql.
-- The whole file is one transaction and ends in ROLLBACK.
-- Do not run this against the live exchange database.

BEGIN;

-- Existing non-null email must still be present and unchanged by the migration itself.
-- These inserts are synthetic and are rolled back.

INSERT INTO users (email, referral_code, status)
VALUES (NULL, 'w2a0000001', 'active');
INSERT INTO users (email, referral_code, status)
VALUES (NULL, 'w2a0000002', 'active');

DO $$
BEGIN
  IF (SELECT COUNT(*) FROM users WHERE email IS NULL) < 2 THEN
    RAISE EXCEPTION 'TEST6 FAIL: multiple NULL emails were not stored';
  END IF;
  RAISE NOTICE 'TEST6 PASS multiple NULL emails';
END $$;

DO $$
DECLARE
  u1 uuid;
  u2 uuid;
BEGIN
  SELECT id INTO u1 FROM users WHERE referral_code = 'w2a0000001';
  SELECT id INTO u2 FROM users WHERE referral_code = 'w2a0000002';

  INSERT INTO user_wallets (
    user_id, namespace, chain_reference, address, normalized_address, caip10,
    wallet_type, provider, is_primary, is_verified, status
  ) VALUES (
    u1, 'eip155', '1', '0xAa', '0xaa', 'eip155:1:0xaa',
    'eoa', 'metamask', TRUE, TRUE, 'active'
  );

  BEGIN
    INSERT INTO user_wallets (
      user_id, namespace, chain_reference, address, normalized_address, caip10,
      wallet_type, provider, is_primary, status
    ) VALUES (
      u2, 'eip155', '137', '0xAA', '0xaa', 'eip155:137:0xaa',
      'eoa', 'trust', FALSE, 'active'
    );
    RAISE EXCEPTION 'TEST1 FAIL: same EVM address was accepted for a second user';
  EXCEPTION
    WHEN unique_violation THEN
      RAISE NOTICE 'TEST1 PASS same EVM address rejected';
  END;

  INSERT INTO user_wallets (
    user_id, namespace, chain_reference, address, normalized_address, caip10,
    wallet_type, provider, is_primary, status
  ) VALUES (
    u1, 'solana', 'mainnet', 'SoLanaAddr111', 'SoLanaAddr111', 'solana:mainnet:SoLanaAddr111',
    'eoa', 'phantom', FALSE, 'active'
  );
  RAISE NOTICE 'TEST2 PASS same user two wallets';

  BEGIN
    INSERT INTO user_wallets (
      user_id, namespace, chain_reference, address, normalized_address, caip10,
      wallet_type, is_primary, status
    ) VALUES (
      u1, 'eip155', '1', '0xBb', '0xbb', 'eip155:1:0xbb',
      'eoa', TRUE, 'active'
    );
    RAISE EXCEPTION 'TEST3 FAIL: second active primary was accepted';
  EXCEPTION
    WHEN unique_violation THEN
      RAISE NOTICE 'TEST3 PASS second active primary rejected';
  END;

  INSERT INTO user_wallets (
    user_id, namespace, chain_reference, address, normalized_address, caip10,
    wallet_type, is_primary, status
  ) VALUES (
    u1, 'eip155', '1', '0xCc', '0xcc', 'eip155:1:0xcc',
    'eoa', TRUE, 'disabled'
  );
  RAISE NOTICE 'TEST4 PASS active primary plus disabled historical row';

  BEGIN
    INSERT INTO user_wallets (
      user_id, namespace, chain_reference, address, normalized_address, caip10,
      wallet_type, status
    ) VALUES (
      u2, 'solana', 'mainnet', 'SoLanaAddr111', 'SoLanaAddr111', 'solana:mainnet:SoLanaAddr111',
      'eoa', 'active'
    );
    RAISE EXCEPTION 'TEST5 FAIL: duplicate Solana CAIP-10 was accepted';
  EXCEPTION
    WHEN unique_violation THEN
      RAISE NOTICE 'TEST5 PASS duplicate Solana CAIP-10 rejected';
  END;

  BEGIN
    INSERT INTO user_wallets (
      user_id, namespace, chain_reference, address, normalized_address, caip10,
      wallet_type, status
    ) VALUES (
      u1, 'bitcoin', 'main', 'x', 'x', 'bitcoin:main:x',
      'eoa', 'active'
    );
    RAISE EXCEPTION 'TEST9 FAIL: invalid namespace was accepted';
  EXCEPTION
    WHEN check_violation THEN
      RAISE NOTICE 'TEST9 PASS invalid namespace rejected';
  END;

  BEGIN
    INSERT INTO user_wallets (
      user_id, namespace, chain_reference, address, normalized_address, caip10,
      wallet_type, status
    ) VALUES (
      u1, 'eip155', '1', '0xDd', '0xdd', 'eip155:1:0xdd',
      'eoa', 'deleted'
    );
    RAISE EXCEPTION 'TEST10 FAIL: invalid status was accepted';
  EXCEPTION
    WHEN check_violation THEN
      RAISE NOTICE 'TEST10 PASS invalid status rejected';
  END;

  BEGIN
    INSERT INTO user_wallets (
      user_id, namespace, chain_reference, address, normalized_address, caip10,
      wallet_type, status
    ) VALUES (
      '00000000-0000-0000-0000-000000000099', 'eip155', '1', '0xEe', '0xee', 'eip155:1:0xee',
      'eoa', 'active'
    );
    RAISE EXCEPTION 'TEST11 FAIL: missing user was accepted';
  EXCEPTION
    WHEN foreign_key_violation THEN
      RAISE NOTICE 'TEST11 PASS missing user rejected';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    INSERT INTO users (email, referral_code, status)
    VALUES ('Case.Test@example.com', 'w2a0000003', 'active');
    INSERT INTO users (email, referral_code, status)
    VALUES ('case.test@example.com', 'w2a0000004', 'active');
    RAISE EXCEPTION 'TEST7 FAIL: mixed-case duplicate email was accepted';
  EXCEPTION
    WHEN unique_violation THEN
      RAISE NOTICE 'TEST7 PASS mixed-case email rejected';
  END;
END $$;

DO $$
DECLARE
  u1 uuid;
BEGIN
  SELECT id INTO u1 FROM users WHERE referral_code = 'w2a0000001';
  INSERT INTO wallet_auth_challenges (
    nonce, namespace, chain_reference, normalized_address, domain, message, expires_at, user_id
  ) VALUES (
    'nonce-1', 'eip155', '1', '0xaa', '169.58.39.2', 'exact challenge message',
    CURRENT_TIMESTAMP + INTERVAL '5 minutes', NULL
  );
  RAISE NOTICE 'TEST challenge NULL user_id stored';

  IF (SELECT pg_typeof(message)::text FROM wallet_auth_challenges WHERE nonce = 'nonce-1') <> 'text' THEN
    RAISE EXCEPTION 'TEST message type is not text';
  END IF;
  RAISE NOTICE 'TEST message column is text';

  BEGIN
    INSERT INTO wallet_auth_challenges (
      nonce, namespace, chain_reference, normalized_address, domain, message, expires_at, user_id
    ) VALUES (
      'nonce-1', 'eip155', '1', '0xaa', '169.58.39.2', 'other',
      CURRENT_TIMESTAMP + INTERVAL '5 minutes', u1
    );
    RAISE EXCEPTION 'TEST8 FAIL: duplicate nonce was accepted';
  EXCEPTION
    WHEN unique_violation THEN
      RAISE NOTICE 'TEST8 PASS duplicate nonce rejected';
  END;
END $$;

-- Compromised historical row may remain beside an active primary.
DO $$
DECLARE
  u2 uuid;
BEGIN
  SELECT id INTO u2 FROM users WHERE referral_code = 'w2a0000002';
  INSERT INTO user_wallets (
    user_id, namespace, chain_reference, address, normalized_address, caip10,
    wallet_type, is_primary, status
  ) VALUES (
    u2, 'eip155', '1', '0xFf', '0xff', 'eip155:1:0xff',
    'contract', TRUE, 'compromised'
  );
  INSERT INTO user_wallets (
    user_id, namespace, chain_reference, address, normalized_address, caip10,
    wallet_type, is_primary, status
  ) VALUES (
    u2, 'eip155', '1', '0x11', '0x11', 'eip155:1:0x11',
    'eoa', TRUE, 'active'
  );
  RAISE NOTICE 'TEST compromised historical primary plus new active primary allowed';
END $$;

ROLLBACK;
