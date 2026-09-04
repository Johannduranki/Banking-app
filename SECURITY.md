# Great Lakes Bank Digital Banking Security

## Status and scope

This repository has received an application-level security hardening pass. These controls reduce known risks; they do **not** make the platform production secure, certify regulatory compliance, or replace independent architecture review and penetration testing. Mock core-banking, OTP and biometric providers are development facilities and are not evidence of production-grade integration security.

## Implemented controls

### Identity, authentication and sessions

- Passwords and transaction PINs are stored only as bcrypt hashes with cost 12.
- New passwords require 12–128 characters with upper-case, lower-case, numeric and special characters. PINs require 6–12 non-repeating, non-sequential digits.
- Login performs a dummy bcrypt comparison for unknown and locked accounts to reduce timing differences. Login errors do not disclose whether an account exists or is locked.
- Failed-login counters and configurable temporary account lockout are enforced in MariaDB.
- OTP codes are generated with a cryptographic random generator, stored as keyed HMACs, expire, have attempt limits, are one-time use and are compared in constant time.
- OTP request responses are shaped consistently to reduce customer enumeration.
- Access JWTs have issuer, audience, type, unique ID and short configurable expiry. Revoked token IDs are checked on authenticated requests.
- Refresh tokens are high-entropy random values, stored only as SHA-256 hashes, rotated on use and revocable. Logout revokes refresh and access credentials where available.
- Browser credentials use `HttpOnly`, `SameSite=Strict`, scoped paths and `Priority=High`; `Secure` is mandatory when `NODE_ENV=production`.
- Registered devices are associated with the authenticated user and device fingerprints are hashed.
- Demo users are not automatically seeded when the API runs in production mode.

### Request and API controls

- Zod schemas validate request bodies, query parameters and important identifiers, lengths, enums, numeric bounds and dates.
- Browser mutation requests require the configured exact Origin and the non-simple `X-CSRF-Protection: 1` header. Bearer-based non-browser clients are not required to send browser Origin headers.
- CORS permits only the configured frontend origin, credentials, explicit methods and explicit request headers.
- A configurable global API rate limit and tighter authentication/activation limits provide baseline abuse resistance.
- Request bodies have a configurable maximum size; JSON parsing is restricted to `application/json`.
- Request/correlation IDs accept only a constrained character set and length; otherwise the server generates a UUID.
- Helmet supplies defensive headers. API responses use a restrictive CSP, deny framing and MIME sniffing, and sensitive responses are marked `no-store`.
- React renders untrusted text through normal escaped JSX. The application does not use `dangerouslySetInnerHTML`.
- Error responses hide unexpected server details. Server error logging is structured and redacts credential, token, OTP and account-related fields; production logs suppress exception messages.

### Authorization and data isolation

- Authentication is required for customer, banking, transfer, beneficiary, biometric, KYC and operations resources.
- Role middleware separates CUSTOMER, OPERATIONS_USER, KYC_OFFICER, KYC_MANAGER, ADMIN and AUDITOR permissions.
- Customer accounts, balances, statements, transactions, notifications, devices, beneficiaries and transfers are resolved from the authenticated customer ID. The frontend cannot choose a FLEXCUBE customer ID.
- Biometric and customer KYC APIs are restricted to CUSTOMER identities. KYC evidence viewing and review actions require designated KYC or ADMIN roles.
- Operations integration status is ADMIN-only; audit search is AUDITOR/ADMIN-only.
- Maker/checker restrictions are enforced for configured KYC decisions.

### Banking, persistence and audit

- Database calls use parameter binding. Dynamic SQL fragments are built only from server-controlled allowlists.
- Transfers validate source-account ownership, currency, limits and destination rules server-side.
- Secure transfers and legacy payments use customer-scoped idempotency keys backed by unique database constraints. QR requests use transactional row locking and a one-way unpaid-to-paid state.
- Financial updates use database transactions and row locks where concurrent balance changes are possible.
- Security and operational events are written to append-oriented audit records with actor, role, customer, entity, IP/device and correlation fields when available. Database triggers reject audit update/delete operations.
- FLEXCUBE logging masks account identifiers and secrets, and financial writes do not retry automatically.

### Upload and document controls

- KYC uploads have a configurable maximum size (10 MiB by default).
- Only PDF, JPEG and PNG declarations are accepted, and server-side magic-byte checks verify the actual file type.
- Selfies must be image content. Original filenames are reduced to a basename, sanitized and length-limited.
- Object keys are generated server-side and local storage prevents path traversal.
- Document bytes are held outside the primary MariaDB schema. Staff document responses use `nosniff`, a sandboxed CSP and sanitized download filenames.

### Secrets and configuration

- Secrets come from environment/deployment configuration and are not returned by health endpoints.
- Production startup rejects known placeholder secrets and requires independent JWT/access-token and OTP secrets.
- Sample environment files contain placeholders only. Production values must be supplied through an approved secret-management service.

## Unresolved risks

- The real FLEXCUBE contract, connectivity, authentication, authorization model, message signing, reconciliation and bank-network controls are not yet available. The production adapter remains explicitly unimplemented.
- SMS, email, push, face, liveness, fingerprint and object-storage production providers are not integrated. Mock provider output must never be treated as verification.
- Access tokens are returned in response bodies for mobile/API clients. Web code currently relies on HttpOnly cookies, but a formal channel-specific token handling design is still required.
- Refresh-token reuse detection currently revokes the rotated session but does not revoke the complete token family or all user sessions.
- Account lockout and rate limiting use application/database state and process-local limiter state; clustered deployments require a shared rate-limit store and distributed abuse controls.
- CSRF protection is based on exact Origin plus a required custom header. A cryptographic synchronizer/double-submit token may be required by the final web architecture and threat model.
- Local object storage does not provide malware scanning, content disarm and reconstruction, encrypted object storage, immutable retention or quarantining.
- Document magic-byte checks identify common file signatures but do not prove that files are safe or structurally valid.
- No WAF, bot mitigation, DDoS service, API gateway policy, service mesh, HSM/KMS, SIEM integration, PAM, network segmentation or certificate lifecycle is implemented in this repository.
- Audit append-only triggers do not provide external immutability, cryptographic chaining, WORM retention or protection from a privileged database administrator.
- No formal privacy retention/deletion workflow, consent-version ledger, data subject request workflow or regulatory data classification has been approved.
- Dependency vulnerability status can change after this review. Software composition analysis and signed build provenance are not yet enforced in CI.
- Legacy local account/payment functions remain alongside provider-backed banking orchestration and require a product decision before production deployment.

## Controls required before production

- Complete a Great Lakes Bank threat model, data-flow review, security architecture approval and regulatory gap assessment.
- Replace all mocks with approved providers and validate mutually authenticated private connectivity to bank systems.
- Use an approved secret manager and KMS/HSM, enforce rotation, least privilege, separation of duties and break-glass monitoring.
- Terminate TLS with current policy, enable HSTS at the edge, deploy WAF/DDoS/bot controls, and configure trusted proxies and source allowlists.
- Add a shared rate-limit store, risk-based authentication, MFA/step-up policy, compromised-password checking, session/token-family compromise response and device revocation UI.
- Add antivirus/malware scanning, quarantine, encrypted object storage, signed access, retention policy and authorization tests for every KYC object.
- Establish database encryption, backup encryption, tested restoration, replication/failover, restricted database roles and privileged activity monitoring.
- Export audit/security events to an independently controlled SIEM/WORM store with alerting, clock synchronization, retention and incident-response runbooks.
- Add SAST, DAST, SCA, secret scanning, IaC/container scanning, SBOM generation, signed artifacts and protected deployment approvals to CI/CD.
- Define transaction fraud monitoring, sanctions/AML integrations, limits governance, reconciliation, reversal, timeout/unknown-state and disaster-recovery procedures.
- Remove or formally approve all legacy/demo-only paths and fixtures from production artifacts.

## Penetration testing requirements

Before any production or pilot use with real customer data or money, engage an independent banking-experienced penetration-testing team. Testing must cover:

- Web, mobile API and operations portal authentication, MFA/OTP, reset, activation, session fixation, token theft/replay/revocation and device workflows.
- Horizontal and vertical authorization, IDOR/BOLA, customer-to-customer isolation, staff privilege escalation and maker/checker bypass.
- Injection, stored/reflected/DOM XSS, CSRF, CORS, SSRF, request smuggling, mass assignment, parameter pollution and unsafe error handling.
- File upload polyglots, parser exploits, malware, decompression/resource exhaustion, path traversal and unauthorized evidence access.
- Transfer/beneficiary concurrency, replay, idempotency, limit bypass, race conditions, rounding/currency abuse and provider timeout/unknown-state handling.
- FLEXCUBE and third-party trust boundaries, mutual TLS, credentials/signing, response tampering, retries, reconciliation and sensitive-log leakage.
- Infrastructure, cloud/server configuration, containers, database, object storage, network segmentation, TLS and administrative access.
- Business-logic abuse using realistic chained attack scenarios.

All critical and high findings must be remediated and independently retested. Medium findings require documented risk acceptance or remediation plans approved by Great Lakes Bank security. Penetration testing must recur after material authentication, payment, FLEXCUBE, biometric or infrastructure changes and at least annually.

## Reporting vulnerabilities

Do not include customer data, credentials, tokens or exploit payloads in ordinary tickets or email. Great Lakes Bank must define and publish an approved private vulnerability-reporting channel, severity model, response SLA and coordinated-disclosure process before external access is enabled.
