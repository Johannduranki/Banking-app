export interface ComplianceProvider {
  screenCustomer(input: { customerId:string; fullName:string; dateOfBirth?:string; nationality?:string }): Promise<{
    reference: string;
    sanctions: "clear" | "possible_match" | "match";
    pep: "clear" | "possible_match" | "match";
  }>;
}
