# Development-only presentation credentials

These credentials are available only when `DEMO_MODE=true` with `CORE_BANKING_PROVIDER=mock`. Do not copy these accounts or passwords into a real banking environment.

## Great Lakes Bank presentation customer

- Email: `aline.niyonkuru@glb.local`
- Password: `GreatLakes!2026`
- FLEXCUBE customer ID: `FC-CIF-100284`
- Customer number: `GLB000100284`

After login, the Digital Banking API resolves this customer's CIF link and obtains BIF/USD account data only through `MockFlexcubeAdapter`. The frontend never imports or reads the mock fixture directly.

## Existing-customer activation presentation

Use this unactivated mock core-banking customer to demonstrate the activation journey:

- Customer number: `GLB000101835`
- Account number: `10183500202`
- Registered mobile: `+257 68 14 70 33`

No password exists before activation. In a local development environment, retrieve the OTP from the API log, verify it in the browser, and then create the customer's password and PIN. Do not use development log delivery in production.

## Development operations administrator

- Email: `admin@greatlakesbank.test`
- Password: `Admin123!`

## Demonstration staff

- KYC officer: `kyc.officer@greatlakesbank.test` / `GreatLakesKyc!2026`
- Operations user: `operations@greatlakesbank.test` / `GreatLakesOps!2026`

Change all development credentials and set `DEMO_MODE=false` before any real banking deployment. Demo seeding is controlled explicitly by `DEMO_MODE`.
