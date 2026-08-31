"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type Tx = { id: number; merchant: string; category: string; amount: number; createdAt: string; direction: "in" | "out" };
type LinkedAccount = { id: number; type: "Mobile money" | "Bank account" | "Savings & investment" | "Digital wallet"; provider: string; name: string; identifier: string; balance: number };
type BankData = { balance: number; savings: number; cardFrozen: boolean; transactions: Tx[]; linkedAccounts: LinkedAccount[] };
type Customer = { name:string; email:string; phone?:string; address?:string; city?:string; postalCode?:string; occupation?:string; kycStatus?:string };
type QRRequest = { code:string; merchant:string; amount:number; reference:string; createdAt:string; status:"unpaid"|"paid" };
type Props = { user: Customer | null; onSignOut?: () => void; onUpdateUser?: (changes:Partial<Customer>) => void };

const initialData: BankData = {
  balance: 32480.5,
  savings: 14500,
  cardFrozen: false,
  linkedAccounts: [],
  transactions: [
    { id: 7, merchant: "Woolworths Food", category: "Shopping", amount: 846.2, direction: "out", createdAt: "2026-08-01T10:30:00Z" },
    { id: 6, merchant: "Salary deposit", category: "Income", amount: 28500, direction: "in", createdAt: "2026-07-31T08:00:00Z" },
    { id: 5, merchant: "Uber", category: "Transport", amount: 184.5, direction: "out", createdAt: "2026-07-30T18:45:00Z" },
    { id: 4, merchant: "The Test Kitchen", category: "Dining", amount: 1240, direction: "out", createdAt: "2026-07-29T20:15:00Z" },
    { id: 3, merchant: "Eskom", category: "Utilities", amount: 2185.75, direction: "out", createdAt: "2026-07-28T09:20:00Z" },
    { id: 2, merchant: "Checkers Sixty60", category: "Shopping", amount: 632.4, direction: "out", createdAt: "2026-07-26T14:15:00Z" },
    { id: 1, merchant: "MyCiTi", category: "Transport", amount: 220, direction: "out", createdAt: "2026-07-24T07:10:00Z" },
  ],
};

const storageKey = "duranki-local-banking-v1";

const icons: Record<string, string> = { Shopping: "◈", Income: "↙", Transport: "↗", Dining: "◇", Utilities: "⌁", Transfer: "⇄" };
const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
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
  const [modal, setModal] = useState<"transfer" | "pay" | "account" | "qr-scan" | "qr-create" | "qr-review" | null>(null);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [dailyThought, setDailyThought] = useState(bankingThoughts[0]);
  const [qrRequest, setQrRequest] = useState<QRRequest | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const today = new Date();
    const start = new Date(today.getFullYear(), 0, 0);
    const dayOfYear = Math.floor((today.getTime() - start.getTime()) / 86400000);
    setDailyThought(bankingThoughts[dayOfYear % bankingThoughts.length]);
    try {
      const saved = window.localStorage.getItem(storageKey);
      const parsed = saved ? JSON.parse(saved) : initialData;
      setData({ ...initialData, ...parsed, linkedAccounts: parsed.linkedAccounts || [] });
    } catch {
      setData(initialData);
    }
    setLoading(false);
  }, []);

  useEffect(()=>{
    if(!modal?.startsWith("qr-"))return;
    setView(modal === "qr-create" ? "Merchant QR" : modal === "qr-review" ? "QR Review" : "Scan QR");
    setModal(null);
  },[modal]);

  function persist(next: BankData) {
    setData(next);
    window.localStorage.setItem(storageKey, JSON.stringify(next));
  }

  const spent = useMemo(() => data?.transactions.filter(t => t.direction === "out").reduce((a, t) => a + Math.abs(t.amount), 0) ?? 0, [data]);
  const linkedTotal = useMemo(() => data?.linkedAccounts.reduce((sum, account) => sum + account.balance, 0) ?? 0, [data]);

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const amount = Number(form.get("amount"));
    const recipient = String(form.get("recipient") || "");
    if (!data || !recipient.trim() || !Number.isFinite(amount) || amount <= 0) return setNotice("Enter a valid recipient and amount.");
    if (amount > data.balance) return setNotice("There are not enough available funds for this payment.");
    const next: BankData = {
      ...data,
      balance: data.balance - amount,
      transactions: [{ id: Date.now(), merchant: modal === "pay" ? recipient : `Transfer to ${recipient}`, category: modal === "pay" ? "Utilities" : "Transfer", amount, direction: "out", createdAt: new Date().toISOString() }, ...data.transactions],
    };
    persist(next); setModal(null); setNotice(`${modal === "pay" ? "Payment" : "Transfer"} completed successfully.`);
    setTimeout(() => setNotice(""), 3500);
  }

  function freezeCard() {
    if (data) persist({ ...data, cardFrozen: !data.cardFrozen });
  }

  function addAccount(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const balance = Number(form.get("balance") || 0);
    const provider = String(form.get("provider") || "").trim();
    const name = String(form.get("name") || "").trim();
    const identifier = String(form.get("identifier") || "").trim();
    const type = String(form.get("type")) as LinkedAccount["type"];
    if (!data || !provider || !name || !identifier || !Number.isFinite(balance) || balance < 0) return setNotice("Complete all account details with a valid balance.");
    const account: LinkedAccount = { id: Date.now(), type, provider, name, identifier, balance };
    persist({ ...data, linkedAccounts: [...data.linkedAccounts, account] });
    setModal(null); setNotice(`${provider} account added successfully.`); setTimeout(() => setNotice(""), 3500);
  }

  function removeAccount(id: number) {
    if (!data) return;
    persist({ ...data, linkedAccounts: data.linkedAccounts.filter(account => account.id !== id) });
    setNotice("Linked account removed."); setTimeout(() => setNotice(""), 3000);
  }

  function saveProfile(e:FormEvent<HTMLFormElement>){
    e.preventDefault(); const form=new FormData(e.currentTarget);
    const name=String(form.get("name")||"").trim(), email=String(form.get("email")||"").trim();
    if(!name||!email)return setNotice("Name and email are required.");
    onUpdateUser?.({name,email,phone:String(form.get("phone")||"").trim(),address:String(form.get("address")||"").trim(),city:String(form.get("city")||"").trim(),postalCode:String(form.get("postalCode")||"").trim(),occupation:String(form.get("occupation")||"").trim()});
    setNotice("Profile updated successfully."); setTimeout(()=>setNotice(""),3500);
  }

  function createQrRequest(e:FormEvent<HTMLFormElement>){
    e.preventDefault(); const form=new FormData(e.currentTarget);
    const merchant=String(form.get("merchant")||"").trim(), amount=Number(form.get("amount")), reference=String(form.get("reference")||"").trim();
    if(!merchant||!Number.isFinite(amount)||amount<=0)return setNotice("Enter a merchant name and valid amount.");
    const request:QRRequest={code:`DQ-${Math.random().toString(36).slice(2,8).toUpperCase()}`,merchant,amount,reference:reference||"Merchant purchase",createdAt:new Date().toISOString(),status:"unpaid"};
    setQrRequest(request); window.localStorage.setItem("duranki-qr-request-v1",JSON.stringify(request));
  }

  function stopCamera(){
    const stream=videoRef.current?.srcObject as MediaStream|null; stream?.getTracks().forEach(track=>track.stop()); setCameraActive(false);
  }

  function readQrRequest(code?:string){
    try{const raw=window.localStorage.getItem("duranki-qr-request-v1"); const request=raw?JSON.parse(raw) as QRRequest:null;
      if(!request||request.status==="paid"||(code&&request.code.toUpperCase()!==code.trim().toUpperCase()))return setNotice("No unpaid Duranki QR request was found.");
      stopCamera(); setQrRequest(request); setModal("qr-review"); setNotice("");
    }catch{setNotice("This QR payment request could not be read.");}
  }

  async function startCamera(){
    setNotice("");
    try{const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:"environment"}}); setCameraActive(true); setTimeout(()=>{if(videoRef.current){videoRef.current.srcObject=stream; videoRef.current.play();}},0);}
    catch{setNotice("Camera access is unavailable. Enter the payment code instead.");}
  }

  function confirmQrPayment(){
    if(!data||!qrRequest)return; if(qrRequest.amount>data.balance)return setNotice("There are not enough available funds for this payment.");
    const next={...data,balance:data.balance-qrRequest.amount,transactions:[{id:Date.now(),merchant:qrRequest.merchant,category:"Shopping",amount:qrRequest.amount,direction:"out" as const,createdAt:new Date().toISOString()},...data.transactions]};
    const paid={...qrRequest,status:"paid" as const}; persist(next); setQrRequest(paid); window.localStorage.setItem("duranki-qr-request-v1",JSON.stringify(paid)); setModal(null); setView("Payments"); setNotice(`Payment of ${money(paid.amount)} to ${paid.merchant} completed.`); setTimeout(()=>setNotice(""),4500);
  }

  const qrCells=useMemo(()=>{const seed=(qrRequest?.code||"DURANKI").split("").reduce((a,c)=>a+c.charCodeAt(0),0);return Array.from({length:225},(_,i)=>((i*17+seed*13+(i%15)*7)%23)<11);},[qrRequest?.code]);

  return <main className="shell">
    <aside className="sidebar">
      <div className="brand"><img src="/duranki-logo.png" alt="Duranki" /></div>
      <nav aria-label="Main navigation">
        {["Home", "Accounts", "Payments", "Cards", "Insights"].map((item, i) => <button key={item} onClick={() => setView(item)} className={view === item ? "active" : ""}><span>{["⌂","▣","⇄","▰","◔"][i]}</span>{item}</button>)}
      </nav>
      <div className="side-bottom"><button onClick={() => setView("Support")}><span>?</span>Help & support</button><button onClick={onSignOut}><span>↪</span>Sign out</button></div>
    </aside>

    <section className="content">
      <header className="app-header"><div><p className="eyebrow">{view === "Home" ? "Sunday, 2 August" : "Duranki digital banking"}</p><h1>{view === "Home" ? `Good morning, ${user?.name?.trim() || "Johan Durand"}.` : view}</h1></div>{view === "Home" && <div className="daily-thought"><span>THOUGHT OF THE DAY</span><p>“{dailyThought}”</p></div>}<div className="header-actions"><button className="icon-btn" aria-label="Notifications">♢<i /></button><button className="avatar profile-avatar" aria-label={`Edit ${user?.name || "Duranki user"} profile`} onClick={()=>setView("Profile")}>{initials(user?.name)}</button></div></header>

      <div className="demo-banner"><span>{user?.kycStatus === "pending" ? "KYC PENDING" : "DEMO"}</span> {user?.kycStatus === "pending" ? "Your profile was submitted and is awaiting verification. You can explore the prototype while we review it." : "This is a product prototype. No real money is held or moved."}</div>
      {notice && <div className="toast" role="status">✓ {notice}</div>}

      {loading ? <div className="loading">Securing your dashboard…</div> : data && <>
        {view === "Home" && <>
          <section className="hero-grid">
            <article className="balance-card">
              <div className="balance-top"><div><p>Total across all accounts</p><h2>{money(data.balance + data.savings + linkedTotal)}</h2><span className="delta">↑ 4.8% this month</span></div><button aria-label="More account options">•••</button></div>
              <div className="account-row"><div><span>EVERYDAY ACCOUNT</span><strong>•••• 4821</strong></div><b>{money(data.balance)}</b></div>
              <div className="balance-actions"><button onClick={() => setModal("transfer")}><span>↗</span>Send money</button><button onClick={() => setModal("pay")}><span>⌁</span>Pay a bill</button><button onClick={() => setModal("account")}><span>＋</span>Add account</button><button onClick={() => setView("Accounts")}><span>•••</span>More</button></div>
            </article>
            <article className="card-visual"><div className="card-head"><img src="/duranki-logo.png" alt="Duranki" /><b>VISA</b></div><div className="chip">▦</div><p>•••• &nbsp;•••• &nbsp;•••• &nbsp;4821</p><div className="card-foot"><span><small>CARD HOLDER</small>{user?.name || "JOHAN DURAND"}</span><span><small>EXPIRES</small>08/29</span></div></article>
          </section>

          <section className="lower-grid">
            <article className="panel transactions"><div className="panel-head"><div><p className="eyebrow">Activity</p><h3>Recent transactions</h3></div><button onClick={() => setView("Accounts")}>View all →</button></div>{data.transactions.slice(0,5).map(t => <div className="transaction" key={t.id}><div className="merchant-icon">{icons[t.category] || "•"}</div><div className="tx-name"><strong>{t.merchant}</strong><span>{new Date(t.createdAt).toLocaleDateString("en-ZA", { day:"numeric", month:"short" })} · {t.category}</span></div><b className={t.direction === "in" ? "positive" : ""}>{t.direction === "in" ? "+" : "−"}{money(Math.abs(t.amount))}</b></div>)}</article>
            <div className="right-stack">
              <article className="panel spend"><div className="panel-head"><div><p className="eyebrow">July</p><h3>Monthly spending</h3></div><button>•••</button></div><div className="spend-total"><div className="donut"><span>68%</span></div><div><p>Spent this month</p><h3>{money(spent)}</h3><span>of $24,000 budget</span></div></div><div className="progress"><i style={{width:`${Math.min(100, spent/240)}%`}} /></div></article>
              <article className="panel savings"><div className="savings-copy"><div className="plant">♧</div><div><p className="eyebrow">Savings goal</p><h3>Cape Town getaway</h3><span>{money(data.savings)} of $20,000</span></div></div><b>{Math.round(data.savings/200)}%</b></article>
            </div>
          </section>
        </>}

        {view === "Accounts" && <><section className="accounts-summary"><div><p className="eyebrow">Portfolio balance</p><h2>{money(data.balance + data.savings + linkedTotal)}</h2><span>Across {2 + data.linkedAccounts.length} accounts</span></div><button className="submit" onClick={() => setModal("account")}>＋ Add an account</button></section><section className="account-cards"><article className="linked-account primary-account"><div className="account-type-icon">D</div><div><p>Duranki everyday</p><strong>Everyday account</strong><span>•••• 4821 · Available</span></div><b>{money(data.balance)}</b></article><article className="linked-account"><div className="account-type-icon">S</div><div><p>Duranki savings</p><strong>Cape Town getaway</strong><span>Savings account</span></div><b>{money(data.savings)}</b></article>{data.linkedAccounts.map(account=><article className="linked-account" key={account.id}><div className="account-type-icon">{account.type === "Mobile money" ? "M" : account.type === "Bank account" ? "B" : account.type === "Digital wallet" ? "W" : "I"}</div><div><p>{account.provider}</p><strong>{account.name}</strong><span>{account.type} · •••• {account.identifier.slice(-4)}</span></div><b>{money(account.balance)}</b><button className="unlink" aria-label={`Remove ${account.name}`} onClick={()=>removeAccount(account.id)}>×</button></article>)}</section>{data.linkedAccounts.length===0&&<div className="empty-accounts"><span>＋</span><div><h3>Bring your accounts together</h3><p>Add mobile money, another bank account, a wallet or an investment to see one combined view.</p></div><button onClick={()=>setModal("account")}>Add your first account</button></div>}<section className="panel account-transactions"><div className="panel-head"><h3>Duranki transactions</h3><button>Download CSV</button></div>{data.transactions.map(t => <div className="transaction" key={t.id}><div className="merchant-icon">{icons[t.category] || "•"}</div><div className="tx-name"><strong>{t.merchant}</strong><span>{new Date(t.createdAt).toLocaleDateString("en-ZA")} · {t.category}</span></div><b className={t.direction === "in" ? "positive" : ""}>{t.direction === "in" ? "+" : "−"}{money(Math.abs(t.amount))}</b></div>)}</section></>}

        {view === "Payments" && <><section className="qr-pay-hero"><div><p className="eyebrow">PAY IN PERSON</p><h2>Scan. Review. Pay.</h2><p>Scan a merchant&apos;s Duranki QR, check the amount and approve only when you are ready.</p><div><button onClick={()=>setModal("qr-scan")}><span>▦</span> Scan to pay</button><button className="merchant-qr-button" onClick={()=>{setQrRequest(null);setModal("qr-create")}}>Create merchant QR</button></div></div><div className="qr-shield">▦<small>Protected by<br/>Duranki Secure</small></div></section><section className="page-grid"><article className="panel feature-panel"><p className="eyebrow">Move money securely</p><h2>Payments hub</h2><p>Send to a beneficiary or settle your monthly accounts in seconds.</p><div className="big-actions"><button onClick={() => setModal("transfer")}>↗ Send money</button><button onClick={() => setModal("pay")}>⌁ Pay a bill</button></div></article><article className="panel beneficiaries"><div className="panel-head"><h3>Saved beneficiaries</h3><button>＋ Add new</button></div>{[["NM","Nandi Mokoena","FNB · 6214"],["ES","Eskom","Municipal services"],["MM","Mpho Molefe","Standard Bank · 8092"]].map(x => <button key={x[1]} onClick={() => setModal("transfer")}><span>{x[0]}</span><strong>{x[1]}<small>{x[2]}</small></strong><b>→</b></button>)}</article></section></>}

        {view === "Cards" && <section className="page-grid"><article className="card-visual large"><div className="card-head"><img src="/duranki-logo.png" alt="Duranki" /><b>VISA</b></div><div className="chip">▦</div><p>•••• &nbsp;•••• &nbsp;•••• &nbsp;4821</p><div className="card-foot"><span><small>CARD HOLDER</small>{user?.name || "JOHAN DURAND"}</span><span><small>EXPIRES</small>08/29</span></div></article><article className="panel card-settings"><h3>Card controls</h3><button onClick={freezeCard}><span className={data.cardFrozen ? "toggle on" : "toggle"}><i /></span><strong>{data.cardFrozen ? "Card frozen" : "Freeze card"}<small>{data.cardFrozen ? "Transactions are blocked" : "Temporarily stop transactions"}</small></strong></button><button><span className="setting-icon">◎</span><strong>Spending limits<small>$18,000 monthly</small></strong><b>→</b></button><button><span className="setting-icon">◉</span><strong>Online payments<small>Enabled</small></strong><b>→</b></button></article></section>}

        {view === "Insights" && <section className="page-grid"><article className="panel feature-panel"><p className="eyebrow">Smart insights</p><h2>You spent 12% less this month.</h2><p>Your biggest saving came from dining. Keep it up and you could add $3,240 to savings by December.</p><div className="bar-chart">{[42,64,48,78,56,88,68].map((h,i)=><i key={i} style={{height:`${h}%`}} />)}</div></article><article className="panel"><h3>Spending by category</h3>{[["Shopping",35],["Utilities",27],["Dining",21],["Transport",17]].map(x=><div className="category" key={x[0]}><span>{x[0]}</span><div><i style={{width:`${x[1]}%`}} /></div><b>{x[1]}%</b></div>)}</article></section>}

        {view === "Support" && <section className="page-grid"><article className="panel feature-panel"><p className="eyebrow">We’re here to help</p><h2>How can we help?</h2><p>Search our help centre or start a secure conversation with the Duranki support team.</p><div className="support-search">⌕ <input aria-label="Search help" placeholder="Search for a topic" /></div></article><article className="panel"><h3>Popular topics</h3>{["I don’t recognise a transaction","My card is lost or stolen","Change my transfer limit","Update personal details"].map(x=><button className="topic" key={x}>{x}<b>→</b></button>)}</article></section>}

        {view === "Profile" && <section className="profile-page"><article className="profile-summary"><div className="profile-large-avatar">{initials(user?.name)}</div><h2>{user?.name}</h2><p>{user?.email}</p><span>✓ KYC approved</span></article><article className="panel profile-form-panel"><div className="panel-head"><div><p className="eyebrow">Personal information</p><h3>Edit your profile</h3></div></div><form className="profile-form" onSubmit={saveProfile}><label>Full name and surname<input name="name" defaultValue={user?.name||""} required/></label><div><label>Email address<input name="email" type="email" defaultValue={user?.email||""} required/></label><label>Mobile number<input name="phone" type="tel" defaultValue={user?.phone||""}/></label></div><label>Residential address<input name="address" defaultValue={user?.address||""}/></label><div><label>City<input name="city" defaultValue={user?.city||""}/></label><label>Postal code<input name="postalCode" defaultValue={user?.postalCode||""}/></label></div><label>Occupation<input name="occupation" defaultValue={user?.occupation||""}/></label><button className="submit">Save profile changes</button><small>Changes are saved privately on this device in the prototype.</small></form></article></section>}
        {view === "Merchant QR" && <section className="qr-workspace panel"><p className="eyebrow">MERCHANT MODE</p><h2>Create a payment QR</h2>{!qrRequest?<><p>Enter the customer&apos;s total. A one-time payment request will be created.</p><form onSubmit={createQrRequest}><label>Merchant name<input name="merchant" required placeholder="e.g. Duranki Coffee"/></label><label>Total due (USD)<input name="amount" type="number" min="0.01" step="0.01" required placeholder="0.00"/></label><label>Order reference<input name="reference" placeholder="e.g. Order 1042"/></label><button className="submit">Generate payment QR</button></form></>:<div className="generated-qr"><div className="qr-grid" aria-label="Demo merchant payment QR">{qrCells.map((on,i)=><i className={on?"on":""} key={i}/>)}</div><h3>{money(qrRequest.amount)}</h3><p>{qrRequest.merchant} · {qrRequest.reference}</p><code>{qrRequest.code}</code><small>Keep this open for the customer to scan. In this local demo, the code can also be entered manually.</small></div>}</section>}

        {view === "Scan QR" && <section className="qr-workspace panel"><p className="eyebrow">QR PAYMENT</p><h2>Scan to pay</h2><p>Point your camera at the merchant&apos;s QR code.</p><div className={`camera-frame ${cameraActive?"active":""}`}><video ref={videoRef} muted playsInline/><span>▦</span></div>{!cameraActive?<button className="submit qr-camera-btn" onClick={startCamera}>Open camera</button>:<button className="submit qr-camera-btn" onClick={()=>readQrRequest()}>Detect merchant QR</button>}<div className="code-divider"><span>or enter the payment code</span></div><form onSubmit={e=>{e.preventDefault();readQrRequest(String(new FormData(e.currentTarget).get("code")||""))}}><label>Payment code<input name="code" placeholder="DQ-XXXXXX" required/></label>{notice&&<p className="form-error">{notice}</p>}<button className="secondary-submit">Continue</button></form></section>}

        {view === "QR Review" && qrRequest && <section className="qr-workspace panel qr-review"><div className="review-merchant-icon">D</div><p className="eyebrow">CONFIRM QR PAYMENT</p><h2>{money(qrRequest.amount)}</h2><h3>{qrRequest.merchant}</h3><dl><div><dt>Reference</dt><dd>{qrRequest.reference}</dd></div><div><dt>From</dt><dd>Everyday account · 4821</dd></div><div><dt>Available after payment</dt><dd>{money((data?.balance||0)-qrRequest.amount)}</dd></div></dl><div className="qr-warning">Only approve if the merchant and total are correct.</div>{notice&&<p className="form-error">{notice}</p>}<button className="submit" onClick={confirmQrPayment}>Accept and pay {money(qrRequest.amount)}</button><button className="decline-payment" onClick={()=>setView("Payments")}>Cancel payment</button></section>}
      </>}
    </section>

    {modal && <div className="modal-backdrop" onMouseDown={() => setModal(null)}><div className="modal" onMouseDown={e=>e.stopPropagation()}><button className="close" onClick={()=>setModal(null)}>×</button>{modal === "account" ? <><p className="eyebrow">Connected finances</p><h2>Add an account</h2><p>Bring another account into your Duranki overview. No external login is required in this local prototype.</p><form onSubmit={addAccount}><label>Account type<select name="type" required defaultValue="Mobile money"><option>Mobile money</option><option>Bank account</option><option>Savings & investment</option><option>Digital wallet</option></select></label><label>Provider<input name="provider" required placeholder="e.g. mobile wallet or external bank" /></label><label>Account name<input name="name" required placeholder="e.g. My mobile wallet" /></label><label>Mobile or account number<input name="identifier" required placeholder="Account identifier" /></label><label>Current balance (USD)<input name="balance" required type="number" min="0" step="0.01" placeholder="0.00" /></label>{notice && <p className="form-error">{notice}</p>}<button className="submit">Add account</button><small>Saved privately on this device. Live balance syncing requires a provider connection.</small></form></> : <><p className="eyebrow">Secure payment</p><h2>{modal === "pay" ? "Pay a bill" : "Send money"}</h2><p>{modal === "pay" ? "Choose a provider and enter the payment amount." : "Transfer instantly to a saved or new beneficiary."}</p><form onSubmit={submit}><label>{modal === "pay" ? "Provider" : "Recipient"}<input name="recipient" required placeholder={modal === "pay" ? "e.g. Utility provider" : "Name or account number"} /></label><label>Amount (USD)<input name="amount" required type="number" min="1" max={data?.balance || 0} step="0.01" placeholder="0.00" /></label><label>Reference<input name="reference" placeholder="Optional reference" /></label>{notice && <p className="form-error">{notice}</p>}<button className="submit">Review & confirm</button><small>Protected by Duranki Secure. Demo transactions only.</small></form></>}</div></div>}
  </main>;
}
