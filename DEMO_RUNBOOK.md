# Great Lakes Bank end-to-end demonstration runbook

This runbook is for the configured demonstration environment only. All people, identifiers, balances, documents and transactions are synthetic. Do not enter real customer or identity information.

## Environment

- Customer application: `http://localhost:3002`
- API health: `http://localhost:3001/health/ready`
- Configuration profile: `config/great-lakes-bank-demo/.env.example`
- Required settings: `DEMO_MODE=true`, all listed providers set to `mock`, and `KYC_MAKER_CHECKER_ENABLED=false` for this exact single-officer presentation path.

Start from a clean demonstration database so the activation customer has not already been linked. Start MariaDB and the API first, wait for readiness, and then start the frontend. No database row needs to be edited during the presentation.

## Presentation identities

### Existing FLEXCUBE customer to activate

- Name: Diane Irakoze
- Customer number: `GLB000101835`
- Account number: `10183500202`
- Registered mobile: `+257 68 14 70 33`
- Email created by activation: `diane.irakoze@example.invalid`
- Create this presentation password: `GreatLakesCustomer!2026`
- Create this presentation PIN: `258025`

### Internal transfer recipient

- Name: Chantal Nkurunziza
- Great Lakes Bank account: `10103600101`
- Bank code: `GLBBBI`
- Currency: `BIF`

### Operations credentials

- Operations user: `operations@greatlakesbank.test` / `GreatLakesOps!2026`
- KYC officer: `kyc.officer@greatlakesbank.test` / `GreatLakesKyc!2026`
- Administrator/auditor: `admin@greatlakesbank.test` / the configured `ADMIN_PASSWORD` (`Admin123!` in the local compose profile)

## OTP instructions

The mock SMS provider prints each one-time code in the API process log only when the API is not running in production mode. Look for a line containing `OTP for +257...`. Enter the six-digit value shown there. Codes expire after five minutes and are single-use. Never display the API log to customers, and never configure log-delivered OTPs in production.

## Part 1 — Existing customer activation and KYC

1. Open the customer application and select **I am an existing customer**.
2. Enter customer number `GLB000101835` (account `10183500202` also works) and mobile `+257 68 14 70 33`.
3. Select **Continue securely**. Explain that the Digital Banking API searches the configured core-banking provider; the browser never calls FLEXCUBE.
4. Read the activation OTP from the API log, enter it, and select **Verify code**.
5. Set password `GreatLakesCustomer!2026`, confirm it, set PIN `258025`, and activate banking.
6. Continue into the guided KYC journey. Confirm Diane's personal and registered contact details.
7. Enter a synthetic Burundi address, for example `Avenue de la Paix 18`, `Bujumbura`.
8. Choose **National ID**, use synthetic document number `GLB-DEMO-ID-101835`, and upload a non-sensitive demonstration PDF/JPEG/PNG.
9. Upload a non-sensitive demonstration selfie image. The frontend sends it to protected document storage and requests face enrolment and verification through the backend provider abstraction.
10. Start liveness. The frontend creates the provider session and retrieves its result through the biometric API.
11. Leave fingerprint optional unless it is part of the presentation; if enabled, start the provider-managed fingerprint session.
12. Set occupation to `Agricultural Cooperative Manager` and source of funds to `Salary`.
13. Review the information, accept all three consent declarations, and submit.
14. Confirm the status is **Pending KYC review**.

## Part 2 — KYC operations

15. Open **Bank staff** and sign in as the KYC officer.
16. Confirm the pending-KYC metric increased and open Diane Irakoze from the priority queue.
17. On **Summary**, show the FLEXCUBE customer ID, customer number, verified mobile, address, source of funds and linked account relationship.
18. On **Evidence**, open the identity document and show selfie, face and liveness provider results. The operations view intentionally identifies mock biometric provenance.
19. On **History** and **Audit**, show previous actions and the append-oriented case trail.
20. Enter an approval note such as `Synthetic identity evidence and configured verification results reviewed for presentation.` and select **Approve**.
21. Confirm the case and customer become **Approved/Active**. If maker/checker is enabled in another environment, a different KYC Manager or Administrator must confirm the pending action.

## Part 3 — Customer digital banking

22. Sign out of operations and log in as `diane.irakoze@example.invalid` / `GreatLakesCustomer!2026`.
23. Confirm the dashboard loads Diane's current/savings relationship through the Digital Banking API and configured core-banking provider.
24. Open accounts and inspect the BIF balance and transaction history.
25. Open Payments and add Chantal Nkurunziza as an internal Great Lakes Bank beneficiary using account `10103600101`, bank code `GLBBBI`, and currency `BIF`.
26. Read the beneficiary-change OTP from the API log and verify it when prompted.
27. Start an internal transfer from Diane's BIF savings account to the new beneficiary. Use `BIF 25,000` and reference `GLB DEMO 001`.
28. Review the masked source account, beneficiary, amount, currency and reference; then confirm once.
29. Wait for the backend response. Show the successful transaction reference and status.
30. Return to account history and show the new debit plus the reduced available balance. Re-submitting the same idempotency key returns the original transaction rather than creating a duplicate.

## Part 4 — Operations and audit

31. Sign in as the operations user and search for `Diane Irakoze`, `GLB000101835`, or `FC-CIF-101835`.
32. Open the customer record and show profile, KYC relationship, accounts/balances and the digital transfer record.
33. Sign in as the administrator/auditor, open **Audit log**, and search relevant event types such as `CUSTOMER_ACTIVATION`, `LOGIN_SUCCESS`, `OTP_REQUEST`, `OTP_VERIFICATION`, `kyc.submitted`, `TRANSFER`, and beneficiary events.
34. Correlate the customer, KYC case, beneficiary change and transfer using their entity and correlation identifiers.

## Expected final state

- Diane Irakoze is linked once to `FC-CIF-101835`.
- Digital status is `ACTIVE`; KYC status is `APPROVED`.
- Accounts and current balances are obtained through `CoreBankingProvider`.
- Chantal is an active internal beneficiary.
- The transfer is `SUCCESS`, appears in customer history and operations customer detail, and has an append-oriented audit record.
