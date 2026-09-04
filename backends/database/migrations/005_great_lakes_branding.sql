-- Rebrand existing display-only banking records without changing identifiers,
-- balances, credentials, customer links, or transaction history.
UPDATE accounts
SET account_name = REPLACE(account_name, 'Duranki', 'Great Lakes')
WHERE account_name LIKE '%Duranki%';

UPDATE accounts
SET provider = 'Great Lakes Bank'
WHERE provider = 'Duranki';
