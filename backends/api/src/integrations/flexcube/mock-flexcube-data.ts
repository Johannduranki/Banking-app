import type { CoreBankingAccount,CoreBankingBalance,CoreBankingBeneficiary,CoreBankingCustomer,CoreBankingTransaction } from "./core-banking-provider.js";

type AccountSeed={suffix:string;type:"CURRENT"|"SAVINGS"|"TERM_DEPOSIT";currency:"BIF"|"USD";balance:number};
type CustomerSeed={id:string;number:string;nationalId:string;firstName:string;middleName?:string;lastName:string;dateOfBirth:string;mobile:string;email:string;branch:string;accounts:AccountSeed[]};

const customerSeeds:CustomerSeed[]=[
  {id:"FC-CIF-100284",number:"GLB000100284",nationalId:"MOCK-BI-19910418-284",firstName:"Aline",middleName:"Nadine",lastName:"Niyonkuru",dateOfBirth:"1991-04-18",mobile:"+257 79 45 12 80",email:"aline.niyonkuru@example.invalid",branch:"BUJ001",accounts:[{suffix:"00101",type:"CURRENT",currency:"BIF",balance:861750000},{suffix:"00202",type:"SAVINGS",currency:"USD",balance:428750}]},
  {id:"FC-CIF-100719",number:"GLB000100719",nationalId:"MOCK-BI-19871106-719",firstName:"Emmanuel",lastName:"Ndayishimiye",dateOfBirth:"1987-11-06",mobile:"+257 71 20 63 44",email:"emmanuel.ndayishimiye@example.invalid",branch:"NGZ001",accounts:[{suffix:"00101",type:"SAVINGS",currency:"BIF",balance:321800000},{suffix:"00303",type:"TERM_DEPOSIT",currency:"BIF",balance:1200000000}]},
  {id:"FC-CIF-101036",number:"GLB000101036",nationalId:"MOCK-BI-19930622-036",firstName:"Chantal",lastName:"Nkurunziza",dateOfBirth:"1993-06-22",mobile:"+257 76 31 08 52",email:"chantal.nkurunziza@example.invalid",branch:"BUJ002",accounts:[{suffix:"00101",type:"CURRENT",currency:"BIF",balance:148650000},{suffix:"00202",type:"SAVINGS",currency:"BIF",balance:775000000}]},
  {id:"FC-CIF-101442",number:"GLB000101442",nationalId:"MOCK-BI-19791203-442",firstName:"Jean-Claude",lastName:"Barakamfitiye",dateOfBirth:"1979-12-03",mobile:"+257 75 62 19 07",email:"jean.barakamfitiye@example.invalid",branch:"GIT001",accounts:[{suffix:"00101",type:"CURRENT",currency:"BIF",balance:2450400000},{suffix:"00202",type:"SAVINGS",currency:"USD",balance:1895400},{suffix:"00303",type:"TERM_DEPOSIT",currency:"USD",balance:5000000}]},
  {id:"FC-CIF-101835",number:"GLB000101835",nationalId:"MOCK-BI-19950715-835",firstName:"Diane",lastName:"Irakoze",dateOfBirth:"1995-07-15",mobile:"+257 68 14 70 33",email:"diane.irakoze@example.invalid",branch:"BUJ001",accounts:[{suffix:"00202",type:"SAVINGS",currency:"BIF",balance:96250000}]},
  {id:"FC-CIF-102106",number:"GLB000102106",nationalId:"MOCK-BI-19880227-106",firstName:"Patrick",lastName:"Nahimana",dateOfBirth:"1988-02-27",mobile:"+257 79 02 46 18",email:"patrick.nahimana@example.invalid",branch:"RUM001",accounts:[{suffix:"00101",type:"CURRENT",currency:"BIF",balance:536900000},{suffix:"00303",type:"TERM_DEPOSIT",currency:"BIF",balance:2500000000}]},
  {id:"FC-CIF-102574",number:"GLB000102574",nationalId:"MOCK-BI-19901009-574",firstName:"Claudine",middleName:"Ariane",lastName:"Nsengiyumva",dateOfBirth:"1990-10-09",mobile:"+257 71 83 05 62",email:"claudine.nsengiyumva@example.invalid",branch:"BUJ003",accounts:[{suffix:"00101",type:"CURRENT",currency:"BIF",balance:410300000},{suffix:"00202",type:"SAVINGS",currency:"USD",balance:672800}]},
  {id:"FC-CIF-102908",number:"GLB000102908",nationalId:"MOCK-BI-19850531-908",firstName:"Fabrice",lastName:"Bizimana",dateOfBirth:"1985-05-31",mobile:"+257 76 27 91 40",email:"fabrice.bizimana@example.invalid",branch:"KAY001",accounts:[{suffix:"00202",type:"SAVINGS",currency:"BIF",balance:284750000},{suffix:"00303",type:"TERM_DEPOSIT",currency:"BIF",balance:900000000}]},
  {id:"FC-CIF-103311",number:"GLB000103311",nationalId:"MOCK-BI-19981120-311",firstName:"Sandrine",lastName:"Uwimana",dateOfBirth:"1998-11-20",mobile:"+257 69 40 17 85",email:"sandrine.uwimana@example.invalid",branch:"BUJ002",accounts:[{suffix:"00101",type:"CURRENT",currency:"BIF",balance:73200000},{suffix:"00202",type:"SAVINGS",currency:"BIF",balance:209400000}]},
  {id:"FC-CIF-103786",number:"GLB000103786",nationalId:"MOCK-BI-19760812-786",firstName:"Déogratias",lastName:"Ntakarutimana",dateOfBirth:"1976-08-12",mobile:"+257 72 55 38 11",email:"deogratias.ntakarutimana@example.invalid",branch:"BUJ001",accounts:[{suffix:"00101",type:"CURRENT",currency:"BIF",balance:3805600000},{suffix:"00202",type:"SAVINGS",currency:"USD",balance:12450000},{suffix:"00303",type:"TERM_DEPOSIT",currency:"BIF",balance:5000000000}]},
];

const productNames={CURRENT:"Current Account",SAVINGS:"Savings Account",TERM_DEPOSIT:"Fixed / Term Deposit"} as const;

export function createMockFlexcubeData(){
  const customers:CoreBankingCustomer[]=customerSeeds.map((seed,index)=>({id:seed.id,customerNumber:seed.number,nationalId:seed.nationalId,firstName:seed.firstName,middleName:seed.middleName,lastName:seed.lastName,dateOfBirth:seed.dateOfBirth,nationality:"Burundian",mobileNumber:seed.mobile,email:seed.email,status:"ACTIVE",kycStatus:index===4||index===8?"REVIEW_REQUIRED":"CURRENT"}));
  const accounts:CoreBankingAccount[]=[],balances:Record<string,CoreBankingBalance>={},transactions:CoreBankingTransaction[]=[];
  customerSeeds.forEach((customer,customerIndex)=>customer.accounts.forEach((seed,accountIndex)=>{
    const id=`FC-ACC-${customer.number.slice(-6)}-${seed.suffix}`,accountNumber=`${customer.number.slice(-6)}${seed.suffix}`;
    accounts.push({id,customerId:customer.id,accountNumber,accountName:`${productNames[seed.type]} ${seed.currency}`,accountType:seed.type,productCode:`${seed.type==='TERM_DEPOSIT'?'TD':seed.type==='CURRENT'?'CA':'SA'}-${seed.currency}`,productName:productNames[seed.type],currency:seed.currency,status:"ACTIVE",branchCode:customer.branch});
    balances[id]={accountId:id,ledger:{amountMinor:seed.balance+((accountIndex+1)*250000),currency:seed.currency},available:{amountMinor:seed.balance,currency:seed.currency},asOf:"2026-09-03T08:30:00Z"};
    const base=(customerIndex+1)*100000+(accountIndex+1)*1000,currency=seed.currency;
    transactions.push(
      {id:`FC-TXN-${base+1}`,accountId:id,bookingDate:"2026-09-02",valueDate:"2026-09-02",description:seed.type==="TERM_DEPOSIT"?"Term deposit placement":"Account funding",reference:`GLB-FUND-${base+1}`,type:"CREDIT",amount:{amountMinor:currency==="BIF"?235000000:125000,currency},status:"COMPLETED"},
      {id:`FC-TXN-${base+2}`,accountId:id,bookingDate:"2026-08-29",valueDate:"2026-08-29",description:seed.type==="TERM_DEPOSIT"?"Accrued interest":"REGIDESO payment",reference:`GLB-PAY-${base+2}`,type:seed.type==="TERM_DEPOSIT"?"CREDIT":"DEBIT",amount:{amountMinor:currency==="BIF"?18750000:24500,currency},status:"COMPLETED"},
      {id:`FC-TXN-${base+3}`,accountId:id,bookingDate:"2026-08-24",valueDate:"2026-08-24",description:seed.type==="CURRENT"?"Merchant purchase":"Savings contribution",reference:`GLB-TRX-${base+3}`,type:seed.type==="CURRENT"?"DEBIT":"CREDIT",amount:{amountMinor:currency==="BIF"?42000000:50000,currency},status:"COMPLETED"},
    );
  }));
  const beneficiaries:CoreBankingBeneficiary[]=[{id:"FC-BEN-501",customerId:"FC-CIF-100284",name:"Bujumbura Water Services",bankCode:"GLBBBI",bankName:"Great Lakes Bank",accountNumber:"10090077101",currency:"BIF",status:"ACTIVE"}];
  return{customers,accounts,balances,transactions,beneficiaries};
}
