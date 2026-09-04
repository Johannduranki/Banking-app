# Great Lakes Bank FLEXCUBE integration boundary

`CoreBankingProvider` is the contract used by digital-banking services. `MockFlexcubeAdapter` remains the development provider. `FlexcubeAdapter` is the production anti-corruption boundary selected with `CORE_BANKING_PROVIDER=flexcube`.

No Oracle endpoint, payload field, authentication scheme, or response code is assumed. Until the bank supplies and approves its version-specific contract, every production operation fails explicitly with `FlexcubeIntegrationError` code `NOT_IMPLEMENTED`. It never falls back to mock data.

## Configuration

The deployment secret/configuration system must provide `FLEXCUBE_BASE_URL`, `FLEXCUBE_USERNAME`, `FLEXCUBE_PASSWORD`, `FLEXCUBE_BRANCH`, `FLEXCUBE_SOURCE`, `FLEXCUBE_TIMEOUT`, and `FLEXCUBE_CONNECTION_MODE`. Credentials must be injected from a secret manager, rotated, and never committed. The connection mode is deliberately a string because its allowed values depend on the bank's approved integration channel.

## Information required before implementation

For the integration as a whole, Great Lakes Bank must provide:

- Exact Oracle FLEXCUBE product, module, release and patch level for every environment.
- Approved integration mechanism (for example an API gateway, versioned REST contract, SOAP/WSDL, or another bank-managed adapter), plus OpenAPI/WSDL/XSD and sample messages.
- Development, test, UAT and production network topology: host names, base URLs, DNS, VPN/private-link, firewall allowlists, ports, TLS/mTLS certificates and certificate rotation.
- Authentication protocol, credential/token lifecycle, service-account entitlements, source-system and branch rules. Usernames and passwords alone do not establish an authentication contract.
- Required request headers, correlation/tracing convention, time zones, character encoding, currency decimal rules, pagination, rate limits, maintenance windows and SLA/timeouts.
- Complete business/technical error catalogue and mapping, retryable error list, idempotency guarantees, duplicate detection, reconciliation and operational support procedures.
- Field classification, masking, retention, audit, encryption, data-residency and regulatory requirements, together with representative synthetic test fixtures.

## Operation completion checklist

| Provider operation | Bank specification required |
|---|---|
| `findCustomer` | Service/operation name; permitted search keys; normalization; multiple-match behavior; privacy/enumeration behavior; returned customer fields and statuses. |
| `getCustomer` | Customer identifier semantics; demographic/KYC/status fields; missing/closed customer responses; code mappings. |
| `getCustomerAccounts` | Ownership relationship; account/product/status mappings; joint/signatory rules; pagination; closed/dormant visibility. |
| `getAccount` | Accepted account identifier; account metadata and status contract; authorization/ownership behavior. |
| `getBalance` | Ledger, available, blocked and hold definitions; as-of timestamp; decimal/currency rules; unavailable-balance behavior. |
| `getTransactionHistory` | Date/filter contract; pagination; booking/value dates and time zone; debit/credit, status, reversal, fee and narrative mappings. |
| `getStatement` | Period limits; opening/closing balance rules; pagination or document format; statement identifiers and generated-document handling. |
| `getBeneficiaries` | Beneficiary ownership, types, statuses, masking and pagination; internal/external bank code mappings. |
| `createBeneficiary` | Required fields; validation/name-enquiry; duplicate rules; maker/checker, OTP/cooling-off requirements; idempotency and returned reference. |
| `verifyBeneficiary` | Whether this is read-only status lookup or an active verification; name-match fields, confidence/status codes and charges. |
| `updateBeneficiary` | Mutable fields; re-verification/cooling-off; maker/checker; concurrency/versioning and idempotency rules. |
| `deactivateBeneficiary` | Disable/delete semantics; effective timing; pending-payment behavior; maker/checker and idempotency rules. |
| `initiateTransfer` | Posting service/operation; supported transfer types; validation, limits, fees, FX, value dates; debit authority; idempotency/duplicate rules; synchronous versus asynchronous result; provider reference and status/error mappings. Automatic retries remain disabled until these guarantees are proven. |
| `getTransactionStatus` | Lookup identifier; lifecycle/status transitions; finality, reversal and timeout/unknown handling; reconciliation contract. |

## Architecture extension points

- `FlexcubeDtoMapper`: maps provider-neutral Digital Banking DTOs to/from approved FLEXCUBE DTOs.
- `FlexcubeAuthentication`: isolates the eventual bank-approved authentication/signing mechanism.
- `FlexcubeTransport`: binds the approved protocol and endpoint catalogue.
- `ResilientFlexcubeTransport`: enforces timeouts, correlation IDs, mapped errors and retry policy. Only reads marked `SAFE_READ` may retry; financial and beneficiary writes do not retry automatically.
- `redactFlexcubeData`: removes secrets and masks account identifiers before structured logging. Raw payload logging should remain disabled unless separately approved and field-level masking is verified.

Before go-live, contract tests must run against a bank-controlled non-production environment, followed by failure-mode, idempotency, reconciliation, performance, security and operational-readiness testing.
