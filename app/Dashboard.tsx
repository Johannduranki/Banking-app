"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { api } from "./api";
import TransferJourney from "./TransferJourney";

type MoneyMinor={amountMinor:number;currency:string};
type Tx = { id:string; merchant:string; category:string; amountMinor:number; currency:string; createdAt:string; direction:"in"|"out";status:string;reference:string };
type LinkedAccount = { id:number;type:"Mobile money"|"Bank account"|"Savings & investment"|"Digital wallet";provider:string;name:string;identifier:string;currency:string;balanceMinor:number };
type BankAccount = { id:string;accountName:string;accountType:"CURRENT"|"SAVINGS"|"TERM_DEPOSIT";productName:string;maskedAccountNumber:string;currency:string;branchCode:string;status:string;availableBalance:MoneyMinor|null;ledgerBalance:MoneyMinor|null;balanceAsOf:string|null };
type CoreTransaction={id:string;accountId:string;bookingDate:string;valueDate:string;description:string;reference:string;type:"CREDIT"|"DEBIT";amount:MoneyMinor;status:string};
type AccountResponse={accounts:BankAccount[];totalBalances:MoneyMinor[];paymentAccountId:number|null;cardFrozen:boolean;linkedAccounts:LinkedAccount[]};
type BankingInsights={accountId:string|null;currency:string|null;debitCount:number;totalDebitsMinor:number;categories:{name:string;amountMinor:number;percentage:number}[];trend:{date:string;amountMinor:number}[]};
type BankData = AccountResponse & { transactions:Tx[];insights:BankingInsights };
type Customer = { name:string; email:string; phone?:string; address?:string; city?:string; postalCode?:string; occupation?:string; kycStatus?:string };
type QRRequest = { code:string; merchant:string; amount:number; reference:string; createdAt:string; status:"unpaid"|"paid" };
type Beneficiary={id:string;name:string;bankCode:string;bankName:string;accountNumber:string;currency:string;status:string;channel:"INTERNAL"|"EXTERNAL";verificationReference?:string};
type Props = { user: Customer | null; onSignOut?: () => void; onUpdateUser?: (changes:Partial<Customer>) => void | Promise<void> };

const icons: Record<string, string> = { Shopping: "◈", Income: "↙", Transport: "↗", Dining: "◇", Utilities: "⌁", Transfer: "⇄" };
const money = (value:number,currency="USD") => new Intl.NumberFormat("en-US",{style:"currency",currency,maximumFractionDigits:currency==="BIF"?0:2}).format(value);
const initials = (name?: string) => {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "DU";
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};
const bankingThoughts = [
  "Small deposits today create greater choices tomorrow.",
  "Check your balance, direct your money, own your day.",
  "A quick account review today can prevent a surprise tomorrow.",
  "Every transaction tells a story—make yours intentional.",
  "Save first, spend thoughtfully, and let consistency do the rest.",
  "Your banking app is your daily window into better decisions.",
  "A clear budget gives every dollar a purpose.",
  "Review, plan and move your money with confidence.",
  "Financial progress begins with one informed decision today.",
  "Use your digital tools today to stay in control tomorrow.",
  "Regular check-ins turn financial goals into lasting habits.",
  "Secure banking starts with staying alert and reviewing activity.",
  "Make saving automatic and progress becomes effortless.",
  "Know where your money goes, then guide it where you want it to grow.",
];

export default function Dashboard({ user, onSignOut, onUpdateUser }: Props) {
  const [data, setData] = useState<BankData | null>(null);
  const [view, setView] = useState("Home");
  const [modal, setModal] = useState<"transfer" | "pay" | "account" | "beneficiary" | "qr-scan" | "qr-create" | "qr-review" | null>(null);
  const [beneficiaries,setBeneficiaries]=useState<Beneficiary[]>([]);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [bankError,setBankError]=useState("");
  const [dailyThought, setDailyThought] = useState(bankingThoughts[0]);
  const [qrRequest, setQrRequest] = useState<QRRequest | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  async function loadData(){
    setLoading(true);setBankError("");
    try{const [response,insights]=await Promise.all([api<AccountResponse>("/api/accounts"),api<BankingInsights>("/api/accounts/insights")]);const primary=response.accounts.find(account=>account.accountType==="CURRENT")||response.accounts[0];const source=primary?await api<CoreTransaction[]>(`/api/accounts/${encodeURIComponent(primary.id)}/transactions`):[];const transactions=source.map(transaction=>({id:transaction.id,merchant:transaction.description,category:transaction.type==="CREDIT"?"Income":"Banking",amountMinor:transaction.amount.amountMinor,currency:transaction.amount.currency,direction:transaction.type==="CREDIT"?"in" as const:"out" as const,createdAt:transaction.bookingDate,status:transaction.status,reference:transaction.reference}));setData({...response,transactions,insights});}
    catch(reason){setData(null);setBankError(reason instanceof Error?reason.message:"Banking information could not be loaded.");}
    finally{setLoading(false);}
  }
  async function loadBeneficiaries(){try{setBeneficiaries(await api<Beneficiary[]>("/api/beneficiaries"));}catch{setBeneficiaries([]);}}
  async function beneficiaryStepUp(action:"CREATE"|"UPDATE"|"DEACTIVATE",beneficiaryId?:string){const challenge=await api<{challengeId:string}>("/api/beneficiaries/otp/request",{method:"POST",body:JSON.stringify({action,beneficiaryId})});const code=window.prompt("Enter the six-digit OTP sent to your registered mobile number.");if(!code)throw new Error("OTP verification was cancelled.");return (await api<{stepUpToken:string}>("/api/beneficiaries/otp/verify",{method:"POST",body:JSON.stringify({challengeId:challenge.challengeId,code,action,beneficiaryId})})).stepUpToken;}
  async function addBeneficiary(event:FormEvent<HTMLFormElement>){event.preventDefault();const form=new FormData(event.currentTarget);try{const stepUpToken=await beneficiaryStepUp("CREATE");await api("/api/beneficiaries",{method:"POST",body:JSON.stringify({channel:form.get("channel"),name:form.get("name"),bankCode:form.get("bankCode"),bankName:form.get("bankName"),accountNumber:form.get("accountNumber"),currency:form.get("currency"),stepUpToken})});await loadBeneficiaries();setModal(null);setNotice("Beneficiary created successfully.");}catch(reason){setNotice(reason instanceof Error?reason.message:"Beneficiary could not be created.");}}
  async function verifyBeneficiary(item:Beneficiary){try{await api(`/api/beneficiaries/${encodeURIComponent(item.id)}/verify`,{method:"POST",body:JSON.stringify({channel:item.channel})});await loadBeneficiaries();setNotice(item.channel==="EXTERNAL"?"External-bank verification has been submitted to the future payment-switch workflow.":"Beneficiary verified against Great Lakes Bank.");}catch(reason){setNotice(reason instanceof Error?reason.message:"Beneficiary verification failed.");}}
  async function updateBeneficiary(item:Beneficiary){const name=window.prompt("Beneficiary name",item.name);if(!name)return;try{const stepUpToken=await beneficiaryStepUp("UPDATE",item.id);await api(`/api/beneficiaries/${encodeURIComponent(item.id)}`,{method:"PUT",body:JSON.stringify({channel:item.channel,name,stepUpToken})});await loadBeneficiaries();setNotice("Beneficiary updated. Verification may be required again.");}catch(reason){setNotice(reason instanceof Error?reason.message:"Beneficiary update failed.");}}
  async function deactivateBeneficiary(item:Beneficiary){if(!window.confirm(`Deactivate ${item.name}?`))return;try{const stepUpToken=await beneficiaryStepUp("DEACTIVATE",item.id);await api(`/api/beneficiaries/${encodeURIComponent(item.id)}`,{method:"DELETE",body:JSON.stringify({channel:item.channel,stepUpToken})});await loadBeneficiaries();setNotice("Beneficiary deactivated.");}catch(reason){setNotice(reason instanceof Error?reason.message:"Beneficiary could not be deactivated.");}}
  async function secureTransfer(event:FormEvent<HTMLFormElement>){event.preventDefault();const form=new FormData(event.currentTarget),source=data?.accounts.find(a=>a.id===form.get("sourceAccountId"));if(!source)return setNotice("Select a valid source account.");const intent={type:String(form.get("type")),sourceAccountId:source.id,destinationAccountId:String(form.get("destinationAccountId")||"")||undefined,destinationAccountNumber:String(form.get("destinationAccountNumber")||"")||undefined,amountMinor:Math.round(Number(form.get("amount"))*100),currency:source.currency,reference:String(form.get("reference")||"Digital transfer")};try{const limits=await api<{stepUpThresholdMinor:number}>("/api/transfers/config");let stepUpToken:string|undefined;if(intent.amountMinor>=limits.stepUpThresholdMinor){const challenge=await api<{challengeId:string;stepUpRequired:boolean}>("/api/transfers/otp/request",{method:"POST",body:JSON.stringify(intent)}),code=window.prompt("Enter the OTP sent to your registered mobile number.");if(!code)throw new Error("Transfer authentication was cancelled.");stepUpToken=(await api<{stepUpToken:string}>("/api/transfers/otp/verify",{method:"POST",body:JSON.stringify({challengeId:challenge.challengeId,code,intent})})).stepUpToken;}const result=await api<{id:string;status:string;correlationId:string}>("/api/transfers",{method:"POST",body:JSON.stringify({...intent,idempotencyKey:crypto.randomUUID(),stepUpToken})});setModal(null);setNotice(`Transfer ${result.status.toLowerCase()}. Reference ${result.correlationId}.`);await loadData();}catch(reason){setNotice(reason instanceof Error?reason.message:"Transfer could not be completed.");}}

  useEffect(() => {
    const today = new Date();
    const start = new Date(today.getFullYear(), 0, 0);
    const dayOfYear = Math.floor((today.getTime() - start.getTime()) / 86400000);
    setDailyThought(bankingThoughts[dayOfYear % bankingThoughts.length]);
    void loadData();void loadBeneficiaries();
  }, []);

  useEffect(()=>{
    if(!modal?.startsWith("qr-"))return;
    setView(modal === "qr-create" ? "Merchant QR" : modal === "qr-review" ? "QR Review" : "Scan QR");
    setModal(null);
  },[modal]);

  const primaryAccount=useMemo(()=>data?.accounts.find(account=>account.accountType==="CURRENT")||data?.accounts[0]||null,[data]);
  const savingsAccount=useMemo(()=>data?.accounts.find(account=>account.accountType==="SAVINGS")||null,[data]);
  const primaryBalance=(primaryAccount?.availableBalance?.amountMinor||0)/100,primaryCurrency=primaryAccount?.currency||"BIF";
  const primaryTotal=(data?.totalBalances.find(total=>total.currency===primaryCurrency)?.amountMinor||0)/100;
  const spent = useMemo(() => data?.transactions.filter(t=>t.direction==="out"&&t.currency===primaryCurrency).reduce((sum,t)=>sum+t.amountMinor/100,0)??0,[data,primaryCurrency]);
  const todayLabel=new Intl.DateTimeFormat("en-GB",{weekday:"long",day:"numeric",month:"long"}).format(new Date());

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const amount = Number(form.get("amount"));
    const recipient = String(form.get("recipient") || "");
    if (!data || !recipient.trim() || !Number.isFinite(amount) || amount <= 0) return setNotice("Enter a valid recipient and amount.");
    if(amount>primaryBalance)return setNotice("There are not enough available funds for this payment.");
    if(modal==="pay"&&!data.paymentAccountId)return setNotice("Payments are not enabled for this digital profile.");
    try{if(modal==="transfer"){if(!primaryAccount)throw new Error("No source account is available.");const own=data.accounts.find(account=>account.id===recipient),intent={type:own?"OWN_ACCOUNT":"INTERNAL",sourceAccountId:primaryAccount.id,destinationAccountId:own?.id,destinationAccountNumber:own?undefined:recipient,amountMinor:Math.round(amount*100),currency:primaryAccount.currency,reference:String(form.get("reference")||"Digital transfer")};const limits=await api<{stepUpThresholdMinor:number}>("/api/transfers/config");let stepUpToken:string|undefined;if(intent.amountMinor>=limits.stepUpThresholdMinor){const challenge=await api<{challengeId:string}>("/api/transfers/otp/request",{method:"POST",body:JSON.stringify(intent)}),code=window.prompt("Enter the OTP sent to your registered mobile number.");if(!code)throw new Error("Transfer authentication was cancelled.");stepUpToken=(await api<{stepUpToken:string}>("/api/transfers/otp/verify",{method:"POST",body:JSON.stringify({challengeId:challenge.challengeId,code,intent})})).stepUpToken;}const result=await api<{status:string;correlationId:string}>("/api/transfers",{method:"POST",body:JSON.stringify({...intent,idempotencyKey:crypto.randomUUID(),stepUpToken})});setNotice(`Transfer ${result.status.toLowerCase()}. Reference ${result.correlationId}.`);}else{await api("/api/payments",{method:"POST",headers:{"Idempotency-Key":crypto.randomUUID()},body:JSON.stringify({accountId:data.paymentAccountId,recipient,amountMinor:Math.round(amount*100),reference:String(form.get("reference")||"")})});setNotice("Payment completed successfully.");}await loadData();setModal(null);}catch(reason){return setNotice(reason instanceof Error?reason.message:"The payment could not be completed.");}
    setTimeout(() => setNotice(""), 3500);
  }

  async function freezeCard() {
    if (!data)return; try{await api("/api/cards/freeze",{method:"PATCH",body:JSON.stringify({frozen:!data.cardFrozen})});setData({...data,cardFrozen:!data.cardFrozen});}catch(reason){setNotice(reason instanceof Error?reason.message:"Card status could not be updated.");}
  }

  async function addAccount(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const balance = Number(form.get("balance") || 0);
    const provider = String(form.get("provider") || "").trim();
    const name = String(form.get("name") || "").trim();
    const identifier = String(form.get("identifier") || "").trim();
    const type = String(form.get("type")) as LinkedAccount["type"];
    if (!data || !provider || !name || !identifier || !Number.isFinite(balance) || balance < 0) return setNotice("Complete all account details with a valid balance.");
    try{await api("/api/accounts",{method:"POST",body:JSON.stringify({type,provider,accountName:name,accountNumber:identifier,balanceMinor:Math.round(balance*100)})});await loadData();setModal(null);setNotice(`${provider} account added successfully.`);setTimeout(() => setNotice(""), 3500);}catch(reason){setNotice(reason instanceof Error?reason.message:"The account could not be linked.");}
  }

  async function removeAccount(id: number) {
    if (!data) return;
    try{await api(`/api/accounts/${id}`,{method:"DELETE"});setData({...data,linkedAccounts:data.linkedAccounts.filter(account=>account.id!==id)});setNotice("Linked account removed.");setTimeout(() => setNotice(""), 3000);}catch(reason){setNotice(reason instanceof Error?reason.message:"The account could not be removed.");}
  }

  async function saveProfile(e:FormEvent<HTMLFormElement>){
    e.preventDefault(); const form=new FormData(e.currentTarget);
    const name=String(form.get("name")||"").trim(), email=String(form.get("email")||"").trim();
    if(!name||!email)return setNotice("Name and email are required.");
    await onUpdateUser?.({name,email,phone:String(form.get("phone")||"").trim(),address:String(form.get("address")||"").trim(),city:String(form.get("city")||"").trim(),postalCode:String(form.get("postalCode")||"").trim(),occupation:String(form.get("occupation")||"").trim()});
    setNotice("Profile updated successfully."); setTimeout(()=>setNotice(""),3500);
  }

  async function createQrRequest(e:FormEvent<HTMLFormElement>){
    e.preventDefault(); const form=new FormData(e.currentTarget);
    const merchant=String(form.get("merchant")||"").trim(), amount=Number(form.get("amount")), reference=String(form.get("reference")||"").trim();
    if(!merchant||!Number.isFinite(amount)||amount<=0)return setNotice("Enter a merchant name and valid amount.");
    try{const result=await api<{id:string;merchantName:string;amountMinor:number;reference:string;createdAt:string;status:"unpaid"}>("/api/qr-requests",{method:"POST",body:JSON.stringify({merchantName:merchant,amountMinor:Math.round(amount*100),reference:reference||"Merchant purchase"})});setQrRequest({code:result.id,merchant:result.merchantName,amount:result.amountMinor/100,reference:result.reference,createdAt:result.createdAt,status:result.status});}catch(reason){setNotice(reason instanceof Error?reason.message:"The QR request could not be created.");}
  }

  function stopCamera(){
    const stream=videoRef.current?.srcObject as MediaStream|null; stream?.getTracks().forEach(track=>track.stop()); setCameraActive(false);
  }

  async function readQrRequest(code?:string){
    const requestedCode=(code||qrRequest?.code||"").trim();if(!requestedCode)return setNotice("Enter a Great Lakes Bank QR payment code.");
    try{const result=await api<{id:string;merchantName:string;amountMinor:number;reference:string;status:"unpaid"|"paid";createdAt:string}>(`/api/qr-requests/${encodeURIComponent(requestedCode)}`);if(result.status!=="unpaid")return setNotice("No unpaid Great Lakes Bank QR request was found.");stopCamera();setQrRequest({code:result.id,merchant:result.merchantName,amount:result.amountMinor/100,reference:result.reference,createdAt:result.createdAt,status:result.status});setModal("qr-review");setNotice("");}catch(reason){setNotice(reason instanceof Error?reason.message:"This QR payment request could not be read.");}
  }

  async function startCamera(){
    setNotice("");
    try{const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:"environment"}}); setCameraActive(true); setTimeout(()=>{if(videoRef.current){videoRef.current.srcObject=stream; videoRef.current.play();}},0);}
    catch{setNotice("Camera access is unavailable. Enter the payment code instead.");}
  }

  async function confirmQrPayment(){
    if(!data||!qrRequest)return;if(qrRequest.amount>primaryBalance)return setNotice("There are not enough available funds for this payment.");if(!data.paymentAccountId)return setNotice("Payments are not enabled for this digital profile.");
    try{await api(`/api/qr-requests/${encodeURIComponent(qrRequest.code)}/pay`,{method:"POST",body:JSON.stringify({accountId:data.paymentAccountId})});const paid={...qrRequest,status:"paid" as const};setQrRequest(paid);await loadData();setModal(null);setView("Payments");setNotice(`Payment of ${money(paid.amount,primaryCurrency)} to ${paid.merchant} completed.`);setTimeout(()=>setNotice(""),4500);}catch(reason){setNotice(reason instanceof Error?reason.message:"The QR payment could not be completed.");}
  }

  const qrCells=useMemo(()=>{const seed=(qrRequest?.code||"GREAT LAKES BANK").split("").reduce((a,c)=>a+c.charCodeAt(0),0);return Array.from({length:225},(_,i)=>((i*17+seed*13+(i%15)*7)%23)<11);},[qrRequest?.code]);

  if(modal==="transfer"&&data)return <TransferJourney accounts={data.accounts} beneficiaries={beneficiaries} onClose={()=>setModal(null)} onComplete={loadData}/>;
  return <main className="shell">
    <aside className="sidebar">
      <div className="brand"><img src="/great-lakes-bank-logo.png" alt="Great Lakes Bank" /></div>
      <nav aria-label="Main navigation">
        {["Home", "Accounts", "Payments", "Cards", "Insights"].map((item, i) => <button key={item} onClick={() => setView(item)} className={view === item ? "active" : ""}><span>{["⌂","▣","⇄","▰","◔"][i]}</span>{item}</button>)}
      </nav>
      <div className="side-bottom"><button onClick={() => setView("Support")}><span>?</span>Help & support</button><button onClick={onSignOut}><span>↪</span>Sign out</button></div>
    </aside>

    <section className="content">
      <header className="app-header"><div><p className="eyebrow">{view === "Home" ? todayLabel : "Great Lakes Bank digital banking"}</p><h1>{view === "Home" ? `Good morning, ${user?.name?.trim() || "Customer"}.` : view}</h1></div>{view === "Home" && <div className="daily-thought"><span>THOUGHT OF THE DAY</span><p>“{dailyThought}”</p></div>}<div className="header-actions"><button className="icon-btn" aria-label="Notifications">♢<i /></button><button className="avatar profile-avatar" aria-label={`Edit ${user?.name || "Great Lakes Bank user"} profile`} onClick={()=>setView("Profile")}>{initials(user?.name)}</button></div></header>

      {user?.kycStatus === "PENDING_REVIEW" && <div className="demo-banner"><span>KYC PENDING</span> Your profile was submitted and is awaiting verification.</div>}
      {notice && <div className="toast" role="status">✓ {notice}</div>}

      {loading?<div className="loading">Loading your accounts and balances…</div>:bankError?<section className="banking-state error-state"><span>!</span><h2>We could not load your banking information</h2><p>{bankError}</p><button className="submit" onClick={()=>void loadData()}>Try again</button></section>:data&&<>
        {view === "Home" && <>
          <section className="hero-grid">
            <article className="balance-card">
              <div className="balance-top"><div><p>Total available in {primaryCurrency}</p><h2>{money(primaryTotal,primaryCurrency)}</h2><div className="currency-totals">{data.totalBalances.filter(total=>total.currency!==primaryCurrency).map(total=><span key={total.currency}>{money(total.amountMinor/100,total.currency)}</span>)}</div></div><button aria-label="More account options">•••</button></div>
              {primaryAccount?<div className="account-row"><div><span>{primaryAccount.accountType.replace("_"," ")} ACCOUNT</span><strong>{primaryAccount.maskedAccountNumber}</strong></div><b>{money(primaryBalance,primaryCurrency)}</b></div>:<div className="account-row empty-row"><span>No active bank accounts are available.</span></div>}
              <div className="balance-actions"><button onClick={() => setModal("transfer")}><span>↗</span>Send money</button><button onClick={() => setModal("pay")}><span>⌁</span>Pay a bill</button><button onClick={() => setModal("account")}><span>＋</span>Add account</button><button onClick={() => setView("Accounts")}><span>•••</span>More</button></div>
            </article>
            <article className="card-visual"><div className="card-head"><img src="/great-lakes-bank-logo.png" alt="Great Lakes Bank" /><b>VISA</b></div><div className="chip">▦</div><p>{primaryAccount?.maskedAccountNumber||"No linked account"}</p><div className="card-foot"><span><small>CARD HOLDER</small>{user?.name||"BANK CUSTOMER"}</span><span><small>ACCOUNT</small>{primaryAccount?.currency||"—"}</span></div></article>
          </section>

          <section className="lower-grid">
            <article className="panel transactions"><div className="panel-head"><div><p className="eyebrow">Activity</p><h3>Recent transactions</h3></div><button onClick={() => setView("Accounts")}>View all →</button></div>{data.transactions.length?data.transactions.slice(0,5).map(t=><div className="transaction" key={t.id}><div className="merchant-icon">{icons[t.category]||"•"}</div><div className="tx-name"><strong>{t.merchant}</strong><span>{new Date(t.createdAt).toLocaleDateString("en-ZA",{day:"numeric",month:"short"})} · {t.status}</span></div><b className={t.direction==="in"?"positive":""}>{t.direction==="in"?"+":"−"}{money(t.amountMinor/100,t.currency)}</b></div>):<div className="empty-list"><strong>No recent transactions</strong><span>New account activity will appear here.</span></div>}</article>
            <div className="right-stack">
              <article className="panel spend"><div className="panel-head"><div><p className="eyebrow">Recent activity</p><h3>Debit transactions</h3></div><button>•••</button></div><div className="spend-total"><div className="donut"><span>{data.transactions.filter(t=>t.direction==="out").length}</span></div><div><p>Total debits shown</p><h3>{money(spent,primaryCurrency)}</h3><span>From your primary account history</span></div></div></article>
              {savingsAccount?<article className="panel savings"><div className="savings-copy"><div className="plant">♧</div><div><p className="eyebrow">Savings account</p><h3>{savingsAccount.accountName}</h3><span>{money((savingsAccount.availableBalance?.amountMinor||0)/100,savingsAccount.currency)} available</span></div></div><b>{savingsAccount.currency}</b></article>:<article className="panel savings empty-list"><strong>No savings account</strong><span>Eligible savings products will appear here.</span></article>}
            </div>
          </section>
        </>}

        {view==="Accounts"&&<><section className="accounts-summary"><div><p className="eyebrow">Portfolio balances</p><div className="portfolio-totals">{data.totalBalances.map(total=><h2 key={total.currency}>{money(total.amountMinor/100,total.currency)}</h2>)}</div><span>Across {data.accounts.length} Great Lakes Bank account{data.accounts.length===1?"":"s"}</span></div><button className="submit" onClick={()=>setModal("account")}>＋ Add an account</button></section><section className="account-cards">{data.accounts.map((account,index)=><article className={`linked-account ${index===0?"primary-account":""}`} key={account.id}><div className="account-type-icon">{account.accountType==="CURRENT"?"C":account.accountType==="SAVINGS"?"S":"T"}</div><div><p>{account.productName}</p><strong>{account.accountName}</strong><span>{account.maskedAccountNumber} · {account.currency} · {account.status}</span></div><b>{money((account.availableBalance?.amountMinor||0)/100,account.currency)}</b></article>)}{data.linkedAccounts.map(account=><article className="linked-account" key={account.id}><div className="account-type-icon">{account.type==="Mobile money"?"M":account.type==="Bank account"?"B":account.type==="Digital wallet"?"W":"I"}</div><div><p>{account.provider}</p><strong>{account.name}</strong><span>{account.type} · {account.identifier}</span></div><b>{money(account.balanceMinor/100,account.currency)}</b><button className="unlink" aria-label={`Remove ${account.name}`} onClick={()=>removeAccount(account.id)}>×</button></article>)}</section>{data.accounts.length===0&&<div className="empty-accounts"><span>◎</span><div><h3>No bank accounts available</h3><p>Accounts linked to your banking customer will appear here when available.</p></div><button onClick={()=>void loadData()}>Refresh accounts</button></div>}<section className="panel account-transactions"><div className="panel-head"><h3>{primaryAccount?`${primaryAccount.accountName} transactions`:"Transactions"}</h3></div>{data.transactions.length?data.transactions.map(t=><div className="transaction" key={t.id}><div className="merchant-icon">{icons[t.category]||"•"}</div><div className="tx-name"><strong>{t.merchant}</strong><span>{new Date(t.createdAt).toLocaleDateString("en-ZA")} · {t.reference} · {t.status}</span></div><b className={t.direction==="in"?"positive":""}>{t.direction==="in"?"+":"−"}{money(t.amountMinor/100,t.currency)}</b></div>):<div className="empty-list"><strong>No transactions found</strong><span>Transactions for this account will appear here.</span></div>}</section></>}

        {view === "Payments" && <><section className="qr-pay-hero"><div><p className="eyebrow">PAY IN PERSON</p><h2>Scan. Review. Pay.</h2><p>Scan a merchant&apos;s Great Lakes Bank QR, check the amount and approve only when you are ready.</p><div><button onClick={()=>setModal("qr-scan")}><span>▦</span> Scan to pay</button><button className="merchant-qr-button" onClick={()=>{setQrRequest(null);setModal("qr-create")}}>Create merchant QR</button></div></div><div className="qr-shield">▦<small>Protected by<br/>Great Lakes Bank Secure</small></div></section><section className="page-grid"><article className="panel feature-panel"><p className="eyebrow">Move money securely</p><h2>Payments hub</h2><p>Send to a beneficiary or settle your monthly accounts in seconds.</p><div className="big-actions"><button onClick={() => setModal("transfer")}>↗ Send money</button><button onClick={() => setModal("pay")}>⌁ Pay a bill</button></div></article><article className="panel beneficiaries"><div className="panel-head"><h3>Saved beneficiaries</h3><button onClick={()=>setModal("beneficiary")}>＋ Add new</button></div>{beneficiaries.map(item=><div className="beneficiary-manage" key={item.id}><button onClick={()=>setModal("transfer")}><span>{item.name.split(/\s+/).map(x=>x[0]).slice(0,2).join("")}</span><strong>{item.name}<small>{item.channel==="INTERNAL"?"Great Lakes Bank":item.bankName} · •••• {item.accountNumber.slice(-4)} · {item.status.replaceAll("_"," ")}</small></strong><b>→</b></button><div><button onClick={()=>verifyBeneficiary(item)}>Verify</button><button onClick={()=>updateBeneficiary(item)}>Edit</button><button onClick={()=>deactivateBeneficiary(item)}>Deactivate</button></div></div>)}{!beneficiaries.length&&<div className="empty-list"><strong>No saved beneficiaries</strong><span>Add an internal or external bank beneficiary.</span></div>}</article></section></>}

        {view==="Cards"&&<section className="page-grid"><article className="card-visual large"><div className="card-head"><img src="/great-lakes-bank-logo.png" alt="Great Lakes Bank"/><b>VISA</b></div><div className="chip">▦</div><p>{primaryAccount?.maskedAccountNumber||"No linked account"}</p><div className="card-foot"><span><small>CARD HOLDER</small>{user?.name||"BANK CUSTOMER"}</span><span><small>ACCOUNT CURRENCY</small>{primaryAccount?.currency||"—"}</span></div></article><article className="panel card-settings"><h3>Card controls</h3><button onClick={freezeCard}><span className={data.cardFrozen?"toggle on":"toggle"}><i/></span><strong>{data.cardFrozen?"Card frozen":"Freeze card"}<small>{data.cardFrozen?"Transactions are blocked":"Temporarily stop transactions"}</small></strong></button><button><span className="setting-icon">◎</span><strong>Available balance<small>{money(primaryBalance,primaryCurrency)}</small></strong><b>→</b></button><button><span className="setting-icon">◉</span><strong>Online payments<small>{data.paymentAccountId?"Enabled":"Not enabled"}</small></strong><b>→</b></button></article></section>}

        {view === "Insights" && <section className="page-grid"><article className="panel feature-panel"><p className="eyebrow">Account insights</p><h2>{data.insights.debitCount} debit transaction{data.insights.debitCount===1?"":"s"}</h2><p>{data.insights.currency?`${money(data.insights.totalDebitsMinor/100,data.insights.currency)} in debits from the selected account history.`:"No account activity is available."}</p><div className="bar-chart">{data.insights.trend.map((point,index)=>{const maximum=Math.max(...data.insights.trend.map(item=>item.amountMinor),1);return <i key={`${point.date}-${index}`} title={`${point.date}: ${money(point.amountMinor/100,data.insights.currency||primaryCurrency)}`} style={{height:`${Math.max(8,point.amountMinor/maximum*100)}%`}}/>})}</div></article><article className="panel"><h3>Spending by category</h3>{data.insights.categories.map(category=><div className="category" key={category.name}><span>{category.name}</span><div><i style={{width:`${category.percentage}%`}}/></div><b>{category.percentage}%</b></div>)}{!data.insights.categories.length&&<div className="empty-list"><strong>No spending categories</strong><span>Insights will appear when debit transactions are available.</span></div>}</article></section>}

        {view === "Support" && <section className="page-grid"><article className="panel feature-panel"><p className="eyebrow">We’re here to help</p><h2>How can we help?</h2><p>Search our help centre or start a secure conversation with the Great Lakes Bank support team.</p><div className="support-search">⌕ <input aria-label="Search help" placeholder="Search for a topic" /></div></article><article className="panel"><h3>Popular topics</h3>{["I don’t recognise a transaction","My card is lost or stolen","Change my transfer limit","Update personal details"].map(x=><button className="topic" key={x}>{x}<b>→</b></button>)}</article></section>}

        {view === "Profile" && <section className="profile-page"><article className="profile-summary"><div className="profile-large-avatar">{initials(user?.name)}</div><h2>{user?.name}</h2><p>{user?.email}</p><span>✓ KYC approved</span></article><article className="panel profile-form-panel"><div className="panel-head"><div><p className="eyebrow">Personal information</p><h3>Edit your profile</h3></div></div><form className="profile-form" onSubmit={saveProfile}><label>Full name and surname<input name="name" defaultValue={user?.name||""} required/></label><div><label>Email address<input name="email" type="email" defaultValue={user?.email||""} required/></label><label>Mobile number<input name="phone" type="tel" defaultValue={user?.phone||""}/></label></div><label>Residential address<input name="address" defaultValue={user?.address||""}/></label><div><label>City<input name="city" defaultValue={user?.city||""}/></label><label>Postal code<input name="postalCode" defaultValue={user?.postalCode||""}/></label></div><label>Occupation<input name="occupation" defaultValue={user?.occupation||""}/></label><button className="submit">Save profile changes</button><small>Your changes are protected and saved to your banking profile.</small></form></article></section>}
        {view === "Merchant QR" && <section className="qr-workspace panel"><p className="eyebrow">MERCHANT MODE</p><h2>Create a payment QR</h2>{!qrRequest?<><p>Enter the customer&apos;s total. A one-time payment request will be created.</p><form onSubmit={createQrRequest}><label>Merchant name<input name="merchant" required placeholder="e.g. Great Lakes Bank Coffee"/></label><label>Total due (USD)<input name="amount" type="number" min="0.01" step="0.01" required placeholder="0.00"/></label><label>Order reference<input name="reference" placeholder="e.g. Order 1042"/></label><button className="submit">Generate payment QR</button></form></>:<div className="generated-qr"><div className="qr-grid" aria-label="Demo merchant payment QR">{qrCells.map((on,i)=><i className={on?"on":""} key={i}/>)}</div><h3>{money(qrRequest.amount)}</h3><p>{qrRequest.merchant} · {qrRequest.reference}</p><code>{qrRequest.code}</code><small>Keep this open for the customer to scan. In this local demo, the code can also be entered manually.</small></div>}</section>}

        {view === "Scan QR" && <section className="qr-workspace panel"><p className="eyebrow">QR PAYMENT</p><h2>Scan to pay</h2><p>Point your camera at the merchant&apos;s QR code.</p><div className={`camera-frame ${cameraActive?"active":""}`}><video ref={videoRef} muted playsInline/><span>▦</span></div>{!cameraActive?<button className="submit qr-camera-btn" onClick={startCamera}>Open camera</button>:<button className="submit qr-camera-btn" onClick={()=>readQrRequest()}>Detect merchant QR</button>}<div className="code-divider"><span>or enter the payment code</span></div><form onSubmit={e=>{e.preventDefault();readQrRequest(String(new FormData(e.currentTarget).get("code")||""))}}><label>Payment code<input name="code" placeholder="DQ-XXXXXX" required/></label>{notice&&<p className="form-error">{notice}</p>}<button className="secondary-submit">Continue</button></form></section>}

        {view==="QR Review"&&qrRequest&&<section className="qr-workspace panel qr-review"><div className="review-merchant-icon">G</div><p className="eyebrow">CONFIRM QR PAYMENT</p><h2>{money(qrRequest.amount,primaryCurrency)}</h2><h3>{qrRequest.merchant}</h3><dl><div><dt>Reference</dt><dd>{qrRequest.reference}</dd></div><div><dt>From</dt><dd>{primaryAccount?`${primaryAccount.accountName} · ${primaryAccount.maskedAccountNumber}`:"No account available"}</dd></div><div><dt>Available after payment</dt><dd>{money(primaryBalance-qrRequest.amount,primaryCurrency)}</dd></div></dl><div className="qr-warning">Only approve if the merchant and total are correct.</div>{notice&&<p className="form-error">{notice}</p>}<button className="submit" onClick={confirmQrPayment}>Accept and pay {money(qrRequest.amount,primaryCurrency)}</button><button className="decline-payment" onClick={()=>setView("Payments")}>Cancel payment</button></section>}
      </>}
    </section>

    {modal&&<div className="modal-backdrop" onMouseDown={()=>setModal(null)}><div className="modal" onMouseDown={e=>e.stopPropagation()}><button className="close" onClick={()=>setModal(null)}>×</button>{modal==="account"?<><p className="eyebrow">Connected finances</p><h2>Add an account</h2><p>Bring another account into your Great Lakes Bank overview.</p><form onSubmit={addAccount}><label>Account type<select name="type" required defaultValue="Mobile money"><option>Mobile money</option><option>Bank account</option><option>Savings & investment</option><option>Digital wallet</option></select></label><label>Provider<input name="provider" required/></label><label>Account name<input name="name" required/></label><label>Mobile or account number<input name="identifier" required/></label><label>Current balance (USD)<input name="balance" required type="number" min="0" step="0.01"/></label>{notice&&<p className="form-error">{notice}</p>}<button className="submit">Add account</button></form></>:modal==="beneficiary"?<><p className="eyebrow">OTP-protected change</p><h2>Add beneficiary</h2><p>Internal beneficiaries are sent to core banking. External beneficiaries remain pending until payment-switch verification is connected.</p><form onSubmit={addBeneficiary}><label>Beneficiary type<select name="channel" defaultValue="INTERNAL"><option value="INTERNAL">Great Lakes Bank</option><option value="EXTERNAL">External bank</option></select></label><label>Beneficiary name<input name="name" required/></label><label>Bank name<input name="bankName" required defaultValue="Great Lakes Bank"/></label><label>Bank code<input name="bankCode" required defaultValue="GLBBBI"/></label><label>Account number<input name="accountNumber" required/></label><label>Currency<select name="currency"><option>BIF</option><option>USD</option></select></label>{notice&&<p className="form-error">{notice}</p>}<button className="submit">Verify with OTP and add</button><small>The OTP is sent to your registered mobile number.</small></form></>:<><p className="eyebrow">Secure payment</p><h2>{modal==="pay"?"Pay a bill":"Send money"}</h2><p>{modal==="pay"?"Choose a provider and enter the payment amount.":"Transfer instantly to a saved or new beneficiary."}</p><form onSubmit={submit}><label>{modal==="pay"?"Provider":"Recipient"}<input name="recipient" required placeholder={modal==="pay"?"e.g. Utility provider":"Name or account number"}/></label><label>Amount ({primaryCurrency})<input name="amount" required type="number" min="1" max={primaryBalance} step="0.01" placeholder="0.00"/></label><label>Reference<input name="reference" placeholder="Optional reference"/></label>{notice&&<p className="form-error">{notice}</p>}<button className="submit">Review & confirm</button><small>Protected by Great Lakes Bank Secure.</small></form></>}</div></div>}
  </main>;
}

