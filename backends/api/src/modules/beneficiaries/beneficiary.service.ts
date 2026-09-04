/** Phase 1 boundary for beneficiary management. Persistent beneficiary workflows are introduced in Phase 6. */
export interface Beneficiary {
  id: string;
  customerId: string;
  name: string;
  accountNumber: string;
  bankCode?: string;
  status: "pending" | "active" | "disabled";
}

export interface BeneficiaryService {
  list(customerId: string): Promise<Beneficiary[]>;
}
