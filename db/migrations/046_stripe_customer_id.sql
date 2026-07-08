-- getOrCreateCustomer previously did a Stripe customers.list({email}) lookup
-- on every call, which is slow and race-prone: two concurrent requests from
-- the same new user (e.g. app opens payment-methods twice on cold start) can
-- both see no existing customer and each create one, leaving the user with
-- duplicate Stripe customers and saved cards that inconsistently appear.
-- Persisting the id makes lookup a single indexed read and creation a
-- one-time event guarded by a unique constraint.
ALTER TABLE users
ADD COLUMN IF NOT EXISTS stripe_customer_id text;

CREATE UNIQUE INDEX IF NOT EXISTS users_stripe_customer_id_idx
ON users (stripe_customer_id)
WHERE stripe_customer_id IS NOT NULL;
