# Great Lakes Bank demo profile

This profile runs the existing application in demo mode; it does not create or maintain a fork.

1. Copy `.env.example` in this directory to `.env` and replace every secret and password.
2. Copy the `NEXT_PUBLIC_*` values to the application's root `.env.local` before building the frontend.
3. Supply the remaining values to the API process or container environment.
4. Start the API and frontend using the existing project commands.

`DEMO_MODE=true` enables synthetic Great Lakes Bank seed records and the presenter overview. Provider values set to `mock` keep external calls local. Mock provenance is retained in integration records, audit data, API logs, and authorised administration views. Customer banking pages use bank-facing language and do not expose adapter or test-fixture terminology.

This profile is for demonstrations only. It must not process real customers, identity evidence, credentials, biometrics, accounts, or payments. Set `DEMO_MODE=false`, configure approved providers, rotate all secrets, and complete the security and operational readiness work before any real banking deployment.
