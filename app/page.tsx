"use client";
import { FormEvent, useState } from "react";
import "./home.css";
import "./admin.css";
import "./admin-management.css";
import "./project-billing.css";
import "./modal.css";
import "./estimate.css";
import { saveDisplayedReceipt } from "./pdf";
type Work = "Boundary Wall" | "House Construction" | "Custom Work";
type View =
  | "start"
  | "estimate"
  | "role"
  | "admin-login"
  | "admin-work"
  | "admin"
  | "new-bill"
  | "customer"
  | "receipt";
type Bill = {
  id?: number;
  billNumber: string;
  customerName: string;
  customerMobile: string;
  workType: string;
  workLocation: string;
  workArea?: string;
  description?: string;
  quantity: number;
  rate: number;
  moramQty: number;
  serviceFee: number;
  total: number;
  amountPaid: number;
  balance: number;
  paymentMode: string;
  billType?: string;
  projectRef?: string;
  previousPaid?: number;
  currentReceived?: number;
  createdAt: string;
};
type AdminAccount = { mobile: string; maskedMobile: string; active: boolean; createdAt: string; lastLoginAt: number; isCurrent: boolean };
const money = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(n || 0);
async function readApi(response: Response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      "The server returned an invalid page. Please refresh the website and try again.",
    );
  }
}
export default function Home() {
  const [view, setView] = useState<View>("start"),
    [work, setWork] = useState<Work>("Boundary Wall"),
    [admin, setAdmin] = useState(""),
    [bills, setBills] = useState<Bill[]>([]),
    [active, setActive] = useState<Bill | null>(null),
    [baseBill, setBaseBill] = useState<Bill | null>(null),
    [pendingDelete, setPendingDelete] = useState<Bill | null>(null),
    [customerBills, setCustomerBills] = useState<Bill[]>([]),
    [status, setStatus] = useState(""),
    [adminAuthenticated, setAdminAuthenticated] = useState(false),
    [adminPin, setAdminPin] = useState(""),
    [adminRole, setAdminRole] = useState(""),
    [adminAccounts, setAdminAccounts] = useState<AdminAccount[]>([]),
    [activeAdmins, setActiveAdmins] = useState(0),
    [adminResetCode, setAdminResetCode] = useState(""),
    [passwordTarget, setPasswordTarget] = useState(""),
    [assignedPassword, setAssignedPassword] = useState(""),
    [authMode, setAuthMode] = useState<"login" | "setup" | "recover" | "invite">("login"),
    [setupCode, setSetupCode] = useState(""),
    [recoveryCode, setRecoveryCode] = useState(""),
    [newPin, setNewPin] = useState(""),
    [page, setPage] = useState(1),
    [pages, setPages] = useState(1),
    [totalBills, setTotalBills] = useState(0),
    [workFilter, setWorkFilter] = useState(""),
    [billSearch, setBillSearch] = useState(""),
    [newAdminMobile, setNewAdminMobile] = useState(""),
    [inviteCode, setInviteCode] = useState(""),
    [menuOpen, setMenuOpen] = useState(false),
    [busy, setBusy] = useState(false);
  const go = (v: View) => {
    setStatus("");
    setMenuOpen(false);
    setView(v);
    window.scrollTo({ top: 0 });
  };
  const loadBills = async (requestedPage = 1, filter = workFilter, search = billSearch) => {
    const params = new URLSearchParams({ admin: "1", page: String(requestedPage) });
    if (filter) params.set("workType", filter);
    if (search.trim()) params.set("search", search.trim());
    const r = await fetch(`/api/bills?${params}`), d = await readApi(r);
    if (!r.ok) throw Error(d.error);
    setBills(d.bills); setPage(d.page); setPages(d.pages); setTotalBills(d.total);
  };
  const loadAdmin = async () => {
    setBusy(true);
    setStatus("");
    try {
      const payload: Record<string, string> = { action: authMode === "invite" ? "acceptInvite" : authMode, mobile: admin };
      if (authMode === "login") payload.password = adminPin;
      if (authMode === "setup") { payload.password = newPin; payload.setupCode = setupCode; }
      if (authMode === "recover") { payload.newPassword = newPin; payload.recoveryCode = recoveryCode; }
      if (authMode === "invite") { payload.password = newPin; payload.inviteCode = setupCode; }
      const r = await fetch("/api/admin/auth", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) }), d = await readApi(r);
      if (!r.ok) throw Error(d.error);
      if (d.recoveryCode) setRecoveryCode(d.recoveryCode);
      setAdminRole(d.role || "");
      await loadBills(1, "", "");
      setAdminAuthenticated(true);
      go("admin-work");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Access failed.");
    } finally {
      setBusy(false);
    }
  };
  const loadAdmins = async () => {
    const r = await fetch("/api/admin/auth", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "adminList" }) }), d = await readApi(r);
    if (!r.ok) throw Error(d.error);
    setAdminAccounts(d.admins); setActiveAdmins(d.activeRecently);
  };
  const manageAdmin = async (action: "removeAdmin" | "resetAdmin", mobile: string) => {
    setBusy(true); setStatus(""); setAdminResetCode("");
    try {
      const r = await fetch("/api/admin/auth", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, mobile }) }), d = await readApi(r);
      if (!r.ok) throw Error(d.error);
      if (d.resetCode) { setAdminResetCode(d.resetCode); setStatus("Temporary password-reset code created. Share it privately."); }
      else setStatus("Administrator access removed.");
      await loadAdmins();
    } catch (e) { setStatus(e instanceof Error ? e.message : "Administrator could not be updated."); }
    finally { setBusy(false); }
  };
  const assignAdminPassword = async () => {
    if (!passwordTarget) return;
    setBusy(true); setStatus("");
    try {
      const r = await fetch("/api/admin/auth", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "setAdminPassword", mobile: passwordTarget, newPassword: assignedPassword }) }), d = await readApi(r);
      if (!r.ok) throw Error(d.error);
      setAssignedPassword(""); setPasswordTarget(""); setStatus("The administrator password was updated successfully.");
    } catch (e) { setStatus(e instanceof Error ? e.message : "Password could not be updated."); }
    finally { setBusy(false); }
  };
  const create = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setStatus("");
    try {
      const body = Object.fromEntries(new FormData(e.currentTarget));
      const requestKey =
        e.currentTarget.dataset.requestKey || crypto.randomUUID();
      e.currentTarget.dataset.requestKey = requestKey;
      const r = await fetch("/api/bills", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            ...body,
            requestKey,
            workType:
              work === "Custom Work"
                ? String(body.customWorkType || "Custom Work")
                : work,
          }),
        }),
        d = await readApi(r);
      if (!r.ok) throw Error(d.error);
      setActive(d.bill);
      setBills((current) => [d.bill, ...current]);
      go("receipt");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Bill could not be saved.");
    } finally {
      setBusy(false);
    }
  };
  const removeBill = async () => {
    if (!pendingDelete) return;
    setBusy(true);
    setStatus("");
    try {
      const r = await fetch(
          `/api/bills?billNumber=${pendingDelete.billNumber}`,
          { method: "DELETE" },
        ),
        d = await readApi(r);
      if (!r.ok) throw Error(d.error);
      setBills((current) =>
        current.filter((item) => item.billNumber !== pendingDelete.billNumber),
      );
      setPendingDelete(null);
      setStatus("Bill deleted successfully.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Bill could not be deleted.");
    } finally {
      setBusy(false);
    }
  };
  const inviteAdmin = async () => {
    setBusy(true); setStatus(""); setInviteCode("");
    try {
      const r = await fetch("/api/admin/auth", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "invite", mobile: newAdminMobile }) }), d = await readApi(r);
      if (!r.ok) throw Error(d.error);
      setInviteCode(d.inviteCode); setStatus("Invitation created. Share this one-time code privately; it expires in 24 hours.");
    } catch (e) { setStatus(e instanceof Error ? e.message : "Invitation could not be created."); }
    finally { setBusy(false); }
  };
  const find = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setCustomerBills([]);
    setStatus("");
    const form = new FormData(e.currentTarget);
    const lookup = String(form.get("lookup") || "").replace(/\D/g, "");
    try {
      const query = new URLSearchParams({ lookup });
      const r = await fetch(`/api/bills?${query}`),
        d = await readApi(r);
      if (!r.ok) throw Error(d.error);
      setCustomerBills(d.bills);
      if (!d.bills.length)
        setStatus("No saved bill was found for that number.");
    } catch (e) {
      setStatus(
        e instanceof Error ? e.message : "Bills could not be retrieved.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <main>
      <header className="topbar">
        <button className="brand" onClick={() => go("start")}>
          <svg className="brandMark" viewBox="0 0 42 42" aria-hidden="true">
            <path d="M6 20.5 21 7l15 13.5v15H26V25H16v10.5H6z" />
            <path d="M13 18h16M21 7v8" />
          </svg>
          <span className="brandWords">
            <span>H SPIRE <i>C</i></span>
          </span>
        </button>
        <button className="menuToggle" aria-label="Open navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>
          <span /><span /><span />
        </button>
        <nav className={menuOpen ? "navOpen" : ""}>
          <button onClick={() => go("start")}>Home</button>
          <button
            onClick={() => {
              go("start");
              setTimeout(
                () =>
                  document
                    .getElementById("about")
                    ?.scrollIntoView({ behavior: "smooth" }),
                50,
              );
            }}
          >
            About
          </button>
          <button
            onClick={() => {
              go("start");
              setTimeout(
                () =>
                  document
                    .getElementById("services")
                    ?.scrollIntoView({ behavior: "smooth" }),
                50,
              );
            }}
          >
            Construction
          </button>
          <button onClick={() => go("customer")}>Get Bill</button>
          <button onClick={() => go("admin-login")}>Admin</button>
        </nav>
      </header>
      {view === "start" && (
        <HomePage
          choose={(w) => {
            setWork(w);
            go("estimate");
          }}
          getBill={() => go("customer")}
          admin={() => go("admin-login")}
        />
      )}
      {view === "estimate" && <Estimate work={work} back={() => go("start")} />}
      {view === "role" && (
        <Screen
          back={() => go("start")}
          eyebrow="H SPIRE C · BILL ACCESS"
          title="Choose how you want to continue"
          intro="Customers can retrieve an existing bill directly. Authorised admins can create and manage project bills."
        >
          <div className="choiceGrid">
            <Choice
              n="C"
              title="Get My Bill"
              text="Enter a 6-digit bill number or customer mobile number to retrieve saved bills."
              action="View My Bill"
              featured
              onClick={() => go("customer")}
            />
            <Choice
              n="A"
              title="Admin Portal"
              text="Authorised access to create bills, record payments and manage saved projects."
              action="Continue as Admin"
              onClick={() => go("admin-login")}
            />
          </div>
        </Screen>
      )}
      {view === "admin-login" && (
        <Screen
          back={() => go("start")}
          eyebrow="ADMIN ACCESS"
          title="Administrator access"
          intro=""
        >
          <div className="formCard compact">
            <div className="authTabs">
              <button className={authMode === "login" ? "active" : "secondary"} onClick={() => setAuthMode("login")}>Login</button>
              <button className={authMode === "setup" ? "active" : "secondary"} onClick={() => setAuthMode("setup")}>Sign Up</button>
            </div>
            <label>
              Authorised mobile
              <input
                value={admin}
                onChange={(e) =>
                  setAdmin(e.target.value.replace(/\D/g, "").slice(0, 10))
                }
                inputMode="numeric"
                placeholder="XXXXXXXXXX"
              />
            </label>
            {authMode === "login" && <label>Password<input value={adminPin} onChange={(e) => setAdminPin(e.target.value.slice(0, 72))} type="password" autoComplete="current-password" placeholder="Enter your password" /></label>}
            {authMode === "setup" && <label>Setup code<input value={setupCode} onChange={(e) => setSetupCode(e.target.value.toUpperCase())} placeholder="Enter setup code" /></label>}
            {authMode === "invite" && <label>One-time invitation code<input value={setupCode} onChange={(e) => setSetupCode(e.target.value.toUpperCase())} placeholder="Invitation code" /></label>}
            {authMode === "recover" && <label>Recovery code<input value={recoveryCode} onChange={(e) => setRecoveryCode(e.target.value.toUpperCase())} placeholder="Saved recovery code" /></label>}
            {authMode !== "login" && <label>{authMode === "recover" ? "New password" : "Choose password"}<input value={newPin} onChange={(e) => setNewPin(e.target.value.slice(0, 72))} type="password" autoComplete="new-password" placeholder="8+ characters with letters and numbers" /></label>}
            <button disabled={busy || admin.length !== 10} onClick={loadAdmin}>
              {busy ? "Checking…" : authMode === "login" ? "Secure Login" : authMode === "recover" ? "Reset Password" : "Create Password & Continue"}
            </button>
            <div className="authLinks">
              <button className={authMode === "recover" ? "active" : ""} onClick={() => setAuthMode("recover")}>Forgot Password?</button>
              <button className={authMode === "invite" ? "active" : ""} onClick={() => setAuthMode("invite")}>Accept Invite</button>
            </div>
            <p className="status">{status}</p>
          </div>
        </Screen>
      )}
      {view === "admin-work" && (
        <Screen
          back={() => go("start")}
          eyebrow="ADMIN PANEL"
          title="Choose construction work"
          intro="Start a new project bill or open the saved-bills dashboard."
        >
          {recoveryCode && adminAuthenticated && (
            <div className="recoveryNotice"><b>Save your new recovery code now</b><strong>{recoveryCode}</strong><p>It is shown only after password setup or reset. Keep it private.</p></div>
          )}
          <div className="choiceGrid">
            <Choice
              n="01"
              title="Boundary Wall"
              text="Create a progress or final bill for boundary-wall work."
              action="Continue"
              onClick={() => {
                setWork("Boundary Wall");
                setBaseBill(null);
                go("new-bill");
              }}
            />
            <Choice
              n="02"
              title="House Construction"
              text="Create a progress or final bill using a house package."
              action="Continue"
              featured
              onClick={() => {
                setWork("House Construction");
                setBaseBill(null);
                go("new-bill");
              }}
            />
            <Choice
              n="03"
              title="Custom Payment Receipt"
              text="Create a flexible receipt for plumbing, electrical, repair, labour or another service."
              action="Create Custom Receipt"
              onClick={() => {
                setWork("Custom Work");
                setBaseBill(null);
                go("new-bill");
              }}
            />
          </div>
          <button className="dashboardLink" onClick={() => go("admin")}>
            View Saved Bills & Payment History →
          </button>
          {adminRole === "head" && <button className="dashboardLink secondary" onClick={async () => { try { await loadAdmins(); go("admin"); setTimeout(() => document.getElementById("adminManagement")?.scrollIntoView({ behavior: "smooth" }), 80); } catch (e) { setStatus(e instanceof Error ? e.message : "Admin list could not be loaded."); } }}>
            Manage Authorised Administrators →
          </button>}
        </Screen>
      )}
      {view === "admin" && (
        <Screen
          back={() => go("admin-work")}
          eyebrow="ADMIN DASHBOARD"
          title="Project bills and payments"
          intro={`${totalBills} matching bill${totalBills === 1 ? "" : "s"} saved in the prototype database. Showing up to 15 per page.`}
        >
          <div className="dashboardHead">
            <div>
              <span>Total saved bills</span>
              <strong>{totalBills}</strong>
            </div>
            <button onClick={() => go("admin-work")}>+ New Project Bill</button>
          </div>
          <div className="billFilters">
            <input value={billSearch} onChange={(e) => setBillSearch(e.target.value)} placeholder="Search bill, customer, mobile or project" />
            <select value={workFilter} onChange={(e) => setWorkFilter(e.target.value)}>
              <option value="">All work types</option><option value="Boundary Wall">Boundary Wall</option><option value="House Construction">House Construction</option><option value="Custom">Custom Work</option>
            </select>
            <button disabled={busy} onClick={async () => { setBusy(true); try { await loadBills(1); } catch (e) { setStatus(e instanceof Error ? e.message : "Search failed."); } finally { setBusy(false); } }}>Apply Filter</button>
          </div>
          <p className="status">{status}</p>
          <BillList
            bills={bills}
            open={(b) => {
              setActive(b);
              go("receipt");
            }}
            continuePayment={(b) => {
              setBaseBill(b);
              setWork(
                b.workType.includes("House")
                  ? "House Construction"
                  : b.workType.includes("Boundary")
                    ? "Boundary Wall"
                    : "Custom Work",
              );
              go("new-bill");
            }}
            remove={setPendingDelete}
            empty="No bills have been generated yet."
          />
          <div className="pagination">
            <button className="secondary" disabled={page <= 1 || busy} onClick={() => loadBills(page - 1)}>← Previous</button>
            <span>Page <b>{page}</b> of <b>{pages}</b></span>
            <button className="secondary" disabled={page >= pages || busy} onClick={() => loadBills(page + 1)}>Next →</button>
          </div>
          {adminRole === "head" && <section className="adminInvite" id="adminManagement">
            <p className="eyebrow">ADMIN MANAGEMENT</p><h3>Add another administrator</h3>
            <p>Invite, reset or remove authorised administrators. Existing passwords remain encrypted and cannot be viewed; use Set Password to securely replace one.</p>
            <div><input value={newAdminMobile} onChange={(e) => setNewAdminMobile(e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="New admin mobile" inputMode="numeric" /><button disabled={busy || newAdminMobile.length !== 10} onClick={inviteAdmin}>Create Invite</button></div>
            {inviteCode && <output><span>One-time invitation code</span><strong>{inviteCode}</strong><small>Expires in 24 hours. Share privately.</small></output>}
            <button className="secondary adminRefresh" disabled={busy} onClick={async () => { setBusy(true); try { await loadAdmins(); } catch (e) { setStatus(e instanceof Error ? e.message : "Admin list could not be loaded."); } finally { setBusy(false); } }}>View Authorised Admins</button>
            {adminAccounts.length > 0 && <div className="adminStats"><b>{adminAccounts.filter((a) => a.active).length} authorised</b><span>{activeAdmins} active in the last 30 minutes</span></div>}
            {adminAccounts.map((account) => <article className="adminAccount" key={account.mobile}>
              <div><strong>{account.maskedMobile}</strong><small>{account.active ? "Access active" : "Access removed"}{account.lastLoginAt ? ` · Last login ${new Date(account.lastLoginAt).toLocaleString("en-IN")}` : ""}</small></div>
              {!account.isCurrent && <span><button className="secondary" disabled={busy} onClick={() => { setPasswordTarget(account.mobile); setAssignedPassword(""); }}>Set Password</button><button className="secondary" disabled={busy} onClick={() => manageAdmin("resetAdmin", account.mobile)}>Recovery Code</button><button className="danger" disabled={busy || !account.active} onClick={() => manageAdmin("removeAdmin", account.mobile)}>Remove</button></span>}
            </article>)}
            {passwordTarget && <div className="passwordAssign"><label>New password for selected administrator<input type="password" value={assignedPassword} onChange={(e) => setAssignedPassword(e.target.value.slice(0,72))} placeholder="8+ characters with letters and numbers" /></label><button disabled={busy || assignedPassword.length < 8} onClick={assignAdminPassword}>Save New Password</button><button className="secondary" onClick={() => { setPasswordTarget(""); setAssignedPassword(""); }}>Cancel</button></div>}
            {adminResetCode && <output><span>Temporary password-reset code</span><strong>{adminResetCode}</strong><small>The administrator uses Forgot Password. This code is replaced after use.</small></output>}
          </section>}
          {pendingDelete && (
            <div className="modalBackdrop">
              <section
                className="deleteModal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="deleteTitle"
              >
                <p className="eyebrow">CONFIRM DELETION</p>
                <h2 id="deleteTitle">
                  Delete bill #{pendingDelete.billNumber}?
                </h2>
                <p>
                  This permanently removes <b>{pendingDelete.customerName}</b>
                  &apos;s bill from the admin and consumer portals. The Google
                  Sheet record will remain.
                </p>
                <div>
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() => setPendingDelete(null)}
                  >
                    Cancel
                  </button>
                  <button
                    className="danger"
                    disabled={busy}
                    onClick={removeBill}
                  >
                    {busy ? "Deleting…" : "Yes, Delete Bill"}
                  </button>
                </div>
              </section>
            </div>
          )}
        </Screen>
      )}
      {view === "new-bill" && (
        <Screen
          back={() => go(baseBill ? "admin" : "admin-work")}
          eyebrow={`${work.toUpperCase()} · PROJECT BILL`}
          title={
            baseBill
              ? "Add another payment bill"
              : "Create a customer project bill"
          }
          intro="Every saved payment is linked to the customer mobile number and synced to the administrative record."
        >
          <BillForm
            work={work}
            busy={busy}
            status={status}
            submit={create}
            baseBill={baseBill}
          />
        </Screen>
      )}
      {view === "customer" && (
        <Screen
          back={() => go("start")}
          eyebrow="CONSUMER PANEL"
          title="Find your saved bill"
          intro="Enter either the 6-digit bill number or the 10-digit mobile number saved with your bill."
        >
          <form className="formCard compact" onSubmit={find}>
            <label>
              Bill number or customer mobile number
              <input
                name="lookup"
                inputMode="numeric"
                pattern="([0-9]{6}|[0-9]{10})"
                maxLength={10}
                minLength={6}
                placeholder="Enter 6-digit bill number or 10-digit mobile"
                autoComplete="off"
                required
              />
            </label>
            <button disabled={busy}>
              {busy ? "Searching…" : "Find My Bill"}
            </button>
            <p className="status">{status}</p>
          </form>
          <BillList
            bills={customerBills}
            open={(b) => {
              setActive(b);
              go("receipt");
            }}
            empty=""
          />
        </Screen>
      )}
      {view === "receipt" && active && (
        <Receipt
          bill={active}
          back={() => go(adminAuthenticated ? "admin" : "start")}
        />
      )}
    </main>
  );
}
function HomePage({
  choose,
  getBill,
  admin,
}: {
  choose: (w: Work) => void;
  getBill: () => void;
  admin: () => void;
}) {
  const [notice, setNotice] = useState(false);
  return (
    <div className="homePage">
      <section className="heroSection">
        <div className="heroCopy">
          <div className="heroBadge">
            <span /> CONSTRUCTION PLANNING, SIMPLIFIED
          </div>
          <h1><span className="heroLineOne">Build with <em>clarity</em></span><br /><span className="heroLineTwo">from the <em>first estimate.</em></span></h1>
          <p className="desktopIntro">Accurate quantities. Fair rates. Complete transparency —<br />for a smoother, smarter construction journey.</p>
          <p className="mobileIntro">Get accurate quantities and material costs for your home, before you build.</p>
          <div className="heroActions">
            <button
              onClick={() =>
                document
                  .getElementById("services")
                  ?.scrollIntoView({ behavior: "smooth" })
              }
            >
              Start a Free Estimate <span aria-hidden="true">→</span>
            </button>
            <button className="secondary" onClick={getBill}>
              Get My Bill →
            </button>
          </div>
          <button className="adminTextLink" onClick={admin}>
            Authorised admin? Open Admin Portal
          </button>
          <div className="heroProof">
            <span>
              <b>01</b> Calculate openly
            </span>
            <span>
              <b>02</b> Review clearly
            </span>
            <span>
              <b>03</b> Track payments
            </span>
          </div>
        </div>
        <div
          className="heroVisual"
        >
          <picture className="heroPhoto">
            <source
              media="(max-width: 600px)"
              srcSet="/assets/hero-construction-mobile-v2.webp"
              type="image/webp"
            />
            <img
              src="/assets/hero-construction-expanded-v5.webp"
              alt="A home construction site at sunset, with an architectural sketch, brick stacks and building materials."
              width={1774}
              height={887}
              fetchPriority="high"
              decoding="async"
            />
          </picture>
          <div className="estimateFormula" aria-label="Work plus materials multiplied by rate equals estimate">
            <span>WORK</span><i>+</i><span>MATERIALS</span><i>×</i><span>RATE</span><i>=</i><strong>ESTIMATE</strong>
          </div>
        </div>
        <div className="heroServiceRail" aria-label="Construction services">
          <button onClick={() => choose("Boundary Wall")}>
            <span className="serviceIcon wallIcon" aria-hidden="true" />
            <span><b>Boundary Wall</b><small className="desktopServiceText">Quantity • Rate • Payment</small><small className="mobileServiceText">Clear quantity and rate estimate</small></span>
            <i aria-hidden="true">›</i>
          </button>
          <button onClick={() => choose("House Construction")}>
            <span className="serviceIcon houseIcon" aria-hidden="true" />
            <span><b>House Construction</b><small className="desktopServiceText">Safe • Smart • Premium</small><small className="mobileServiceText">Safe, Smart and Premium packages</small></span>
            <i aria-hidden="true">›</i>
          </button>
          <button onClick={() => choose("Custom Work")}>
            <span className="serviceIcon customIcon" aria-hidden="true">✦</span>
            <span><b>Custom Works</b><small className="desktopServiceText">Flexible scope • Receipt</small><small className="mobileServiceText">Flexible scope and payment receipt</small></span>
            <i aria-hidden="true">›</i>
          </button>
        </div>
      </section>
      <section className="trustBar" aria-label="Service highlights">
        <div>
          <b>Open estimator</b>
          <span>No login required</span>
        </div>
        <div>
          <b>Clear breakdown</b>
          <span>Work, fees and balance</span>
        </div>
        <div>
          <b>Saved billing</b>
          <span>Customer-linked records</span>
        </div>
        <div>
          <b>PDF ready</b>
          <span>Download or print</span>
        </div>
      </section>
      <section id="about" className="contentSection">
        <div className="sectionIntro">
          <p className="eyebrow">ABOUT US</p>
          <h2>A clearer way to begin construction work.</h2>
          <p>
            H Spire C brings the estimate, payment trail and final construction
            bill into one straightforward customer journey.
          </p>
        </div>
        <div className="aboutGrid">
          <article>
            <span>01</span>
            <b>Estimate before deciding</b>
            <p>
              Explore expected quantities, rates and service fees before
              discussing the final scope.
            </p>
          </article>
          <article>
            <span>02</span>
            <b>Record every payment</b>
            <p>
              Progress payments and balances remain connected to the
              customer&apos;s project reference.
            </p>
          </article>
          <article>
            <span>03</span>
            <b>Share professional documents</b>
            <p>
              Generate clean estimates and final bills that are ready to
              download, print and share.
            </p>
          </article>
        </div>
      </section>
      <section id="services" className="contentSection">
        <div className="sectionIntro">
          <p className="eyebrow">CONSTRUCTION SERVICES</p>
          <h2>Choose the work. See the numbers.</h2>
          <p>Every public estimator remains available without admin access.</p>
        </div>
        <div className="serviceGrid">
          <article>
            <span>01</span>
            <h3>Boundary Wall</h3>
            <p>
              Estimate laterite stone or brick boundary-wall work, payments, and
              balance.
            </p>
            <div className="serviceMeta">
              <i>Public estimator</i>
              <i>Material-based</i>
            </div>
            <button onClick={() => choose("Boundary Wall")}>
              Estimate Boundary Wall
            </button>
          </article>
          <article className="featured">
            <span>02</span>
            <h3>House Construction</h3>
            <p>
              Prepare a basic material and payment estimate for residential
              construction work.
            </p>
            <div className="serviceMeta">
              <i>Safe ₹1,699/sq ft</i>
              <i>Smart ₹1,899/sq ft</i>
            </div>
            <button onClick={() => choose("House Construction")}>
              Estimate House Work
            </button>
          </article>
          <article>
            <span>03</span>
            <h3>Other Construction</h3>
            <p>
              Use the flexible estimator for brick masonry, repair work,
              extensions, or another project.
            </p>
            <div className="serviceMeta">
              <i>Custom scope</i>
              <i>Manual review</i>
            </div>
            <button onClick={() => setNotice(true)}>
              Request Custom Quote
            </button>
            {notice && (
              <small className="notice">
                <b>Thank you for your response.</b> We are working to make
                custom estimates available online. Please contact H Spire C for
                a personalised quotation.
              </small>
            )}
          </article>
        </div>
      </section>
      <section className="processSection">
        <div className="sectionIntro">
          <p className="eyebrow">HOW IT WORKS</p>
          <h2>One simple path from enquiry to receipt.</h2>
        </div>
        <div className="processLine">
          <article>
            <span>1</span>
            <div>
              <b>Choose the work</b>
              <p>Boundary wall, house construction or a custom requirement.</p>
            </div>
          </article>
          <article>
            <span>2</span>
            <div>
              <b>Review the estimate</b>
              <p>See the approximate work amount and service fee clearly.</p>
            </div>
          </article>
          <article>
            <span>3</span>
            <div>
              <b>Save the project bill</b>
              <p>Admin saves customer details and payment records securely.</p>
            </div>
          </article>
          <article>
            <span>4</span>
            <div>
              <b>Retrieve and download</b>
              <p>
                Customers use a bill number or mobile number to access saved
                bills.
              </p>
            </div>
          </article>
        </div>
      </section>
      <section className="finalCta">
        <div>
          <p className="eyebrow">READY TO BEGIN?</p>
          <h2>Start with a number you can understand.</h2>
          <p>
            Use the estimator freely, or retrieve an existing bill in one simple
            step.
          </p>
        </div>
        <div className="heroActions">
          <button onClick={() => choose("Boundary Wall")}>
            Create Estimate
          </button>
          <button className="secondary" onClick={getBill}>
            Get My Bill
          </button>
        </div>
      </section>
      <footer className="homeFooter">
        <b>H SPIRE C</b>
        <span>Your construction, our responsibility.</span>
        <small>Prototype 2 · optimized concept</small>
      </footer>
    </div>
  );
}
function Screen(p: {
  eyebrow: string;
  title: string;
  intro: string;
  back?: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="screen">
      {p.back && (
        <button className="back" onClick={p.back}>
          ← Back
        </button>
      )}
      <p className="eyebrow">{p.eyebrow}</p>
      <h1>{p.title}</h1>
      {p.intro && <p className="intro">{p.intro}</p>}
      {p.children}
    </section>
  );
}
function Choice(p: {
  n: string;
  title: string;
  text: string;
  action: string;
  featured?: boolean;
  onClick: () => void;
}) {
  return (
    <article className={p.featured ? "choice featured" : "choice"}>
      <span>{p.n}</span>
      <h2>{p.title}</h2>
      <p>{p.text}</p>
      <button onClick={p.onClick}>{p.action} →</button>
    </article>
  );
}
function Estimate({ work, back }: { work: Work; back: () => void }) {
  const [q, setQ] = useState(0),
    [rate, setRate] = useState(work === "Boundary Wall" ? 145 : 1699),
    [moram, setMoram] = useState(0);
  const workCost = q * rate,
    moramCost = moram * 4000,
    total = workCost + moramCost + 499;
  return (
    <Screen
      back={back}
      eyebrow={work.toUpperCase() + " · PUBLIC ESTIMATOR"}
      title="Quick construction estimate"
      intro="This simple calculator is open to everyone and provides an approximate project cost. It does not create or save a bill."
    >
      <div className="formCard">
        <div className="formGrid">
          <label>
            {work === "Boundary Wall"
              ? "Estimated stones / bricks"
              : "Construction area (sq. ft.)"}
            <input
              type="number"
              min="0"
              step=".01"
              value={q || ""}
              onChange={(e) => setQ(+e.target.value)}
            />
          </label>
          <label>
            {work === "Boundary Wall"
              ? "Rate per stone / brick"
              : "Construction package"}
            {work === "Boundary Wall" ? (
              <select value={rate} onChange={(e) => setRate(+e.target.value)}>
                {[145, 144, 143, 142, 141, 140].map((x) => (
                  <option key={x} value={x}>
                    ₹{x}
                  </option>
                ))}
              </select>
            ) : (
              <select value={rate} onChange={(e) => setRate(+e.target.value)}>
                <option value="1699">Safe — ₹1,699/sq. ft.</option>
                <option value="1899">Smart — ₹1,899/sq. ft.</option>
                <option value="2099">Premium — ₹2,099/sq. ft.</option>
              </select>
            )}
          </label>
          <label>
            Moram vehicles (₹4,000 each)
            <input
              type="number"
              min="0"
              step="1"
              value={moram || ""}
              onChange={(e) => setMoram(+e.target.value)}
            />
          </label>
        </div>
        <div className="estimateSummary">
          <div>
            <span>Construction cost</span>
            <b>{money(workCost)}</b>
          </div>
          <div>
            <span>Moram charge</span>
            <b>{money(moramCost)}</b>
          </div>
          <div>
            <span>Service fee</span>
            <b>{money(499)}</b>
          </div>
          <small>
            Approximate total: <strong>{money(total)}</strong>
          </small>
        </div>
      </div>
    </Screen>
  );
}
function BillForm({
  work,
  busy,
  status,
  submit,
  baseBill,
}: {
  work: Work;
  busy: boolean;
  status: string;
  submit: (e: FormEvent<HTMLFormElement>) => void;
  baseBill: Bill | null;
}) {
  const previous = baseBill?.amountPaid || 0;
  return (
    <form className="formCard" onSubmit={submit}>
      <input
        type="hidden"
        name="projectRef"
        value={baseBill?.projectRef || ""}
      />
      <input type="hidden" name="previousPaid" value={previous} />
      <fieldset>
        <legend>Customer and project</legend>
        <div className="formGrid">
          <label>
            Customer name
            <input
              name="customerName"
              defaultValue={baseBill?.customerName || ""}
              required
            />
          </label>
          <label>
            Customer mobile
            <input
              name="customerMobile"
              inputMode="numeric"
              pattern="[0-9]{10}"
              maxLength={10}
              defaultValue={baseBill?.customerMobile || ""}
              required
            />
          </label>
          <label className="wide">
            Work location / address
            <input
              name="workLocation"
              defaultValue={baseBill?.workLocation || ""}
              required
            />
          </label>
          {baseBill && (
            <label>
              Project reference
              <input
                value={baseBill.projectRef || "Existing project"}
                readOnly
              />
            </label>
          )}
        </div>
      </fieldset>
      <fieldset>
        <legend>Work and payment stage</legend>
        <div className="formGrid">
          <label>
            Bill stage
            <select name="billType">
              <option value="Progress Bill">
                {baseBill ? "Additional Payment Bill" : "Progress Payment Bill"}
              </option>
              <option value="Final Bill">Final Bill</option>
            </select>
          </label>
          {work === "Custom Work" && (
            <label className="wide">
              Work or service name
              <input
                name="customWorkType"
                defaultValue={
                  baseBill &&
                  !baseBill.workType.includes("Boundary") &&
                  !baseBill.workType.includes("House")
                    ? baseBill.workType
                    : ""
                }
                placeholder="Example: Electrical work"
                required
              />
            </label>
          )}
          <label>
            {work === "Custom Work"
              ? "Quantity / area / units"
              : "Quantity / built-up area"}
            <input
              name="quantity"
              type="number"
              min=".01"
              step=".01"
              defaultValue={baseBill?.quantity || ""}
              required
            />
          </label>
          <label>
            {work === "House Construction" ? "Package / rate" : "Rate per unit"}
            {work === "House Construction" ? (
              <select name="rate" defaultValue={baseBill?.rate || 1699}>
                <option value="1699">Safe — ₹1,699</option>
                <option value="1899">Smart — ₹1,899</option>
                <option value="2099">Premium — ₹2,099</option>
              </select>
            ) : work === "Boundary Wall" ? (
              <select name="rate" defaultValue={baseBill?.rate || 145}>
                {[145, 144, 143, 142, 141, 140].map((x) => (
                  <option key={x} value={x}>
                    ₹{x}
                  </option>
                ))}
              </select>
            ) : (
              <input
                name="rate"
                type="number"
                min=".01"
                step=".01"
                defaultValue={baseBill?.rate || ""}
                placeholder="Rate per unit"
                required
              />
            )}
          </label>
          {work === "Custom Work" ? (
            <input type="hidden" name="moramQty" value="0" />
          ) : (
            <label>
              Moram vehicles
              <input
                name="moramQty"
                type="number"
                min="0"
                defaultValue={baseBill?.moramQty || 0}
              />
            </label>
          )}
          {baseBill && (
            <label>
              Total previously received
              <input value={money(previous)} readOnly />
            </label>
          )}
          <label>
            {baseBill ? "New amount received" : "Amount received"}
            <input
              name="currentReceived"
              type="number"
              min="0"
              step=".01"
              defaultValue="0"
              required
            />
          </label>
          <label>
            Payment mode
            <select
              name="paymentMode"
              defaultValue={baseBill?.paymentMode || "UPI"}
            >
              <option>UPI</option>
              <option>Cash</option>
              <option>Bank Transfer</option>
              <option>Cheque</option>
            </select>
          </label>
        </div>
        <p className="hint">
          {work === "Custom Work"
            ? "Receipt total = quantity × rate + ₹499 service fee."
            : "Project total = quantity × rate + Moram × ₹4,000 + ₹499 service fee."}{" "}
          Each saved payment creates a separate customer-visible bill.
        </p>
      </fieldset>
      <button disabled={busy}>
        {busy
          ? "Saving bill…"
          : baseBill
            ? "Save Next Payment Bill"
            : "Generate & Save Bill"}
      </button>
      <p className="status">{status}</p>
    </form>
  );
}
function BillList({
  bills,
  open,
  remove,
  continuePayment,
  empty,
}: {
  bills: Bill[];
  open: (b: Bill) => void;
  remove?: (b: Bill) => void;
  continuePayment?: (b: Bill) => void;
  empty: string;
}) {
  if (!bills.length) return empty ? <p className="empty">{empty}</p> : null;
  return (
    <div className="billList">
      {bills.map((b) => (
        <div className="billRow" key={b.billNumber}>
          <button className="billOpen" onClick={() => open(b)}>
            <span>
              <b>
                {b.billType || "Final Bill"} · #{b.billNumber}
              </b>
              <small>
                {b.customerName} · {b.customerMobile}
                <br />
                {b.projectRef && `Project ${b.projectRef}`}
              </small>
            </span>
            <span>
              <b>{money(b.amountPaid)}</b>
              <small>Received · Balance {money(b.balance)}</small>
            </span>
          </button>
          {(remove || continuePayment) && (
            <div className="billActions">
              {continuePayment && b.balance > 0 && (
                <button
                  className="continueBill"
                  onClick={() => continuePayment(b)}
                >
                  Add Payment
                </button>
              )}
              {remove && (
                <button
                  className="deleteBill"
                  onClick={() => remove(b)}
                  aria-label={`Delete bill ${b.billNumber}`}
                >
                  Delete
                </button>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
function Receipt({
  bill,
  back,
  documentType = "bill",
}: {
  bill: Bill;
  back: () => void;
  documentType?: "bill" | "estimate";
}) {
  const isEstimate = documentType === "estimate";
  const previous = bill.previousPaid || 0;
  const current = bill.currentReceived || (!previous ? bill.amountPaid : 0);
  const [pdfBusy, setPdfBusy] = useState(false);
  const savePdf = async () => {
    if (pdfBusy) return;
    setPdfBusy(true);
    try {
      await saveDisplayedReceipt(bill.billNumber);
    } catch {
      window.alert("PDF could not be saved. Please refresh and try again.");
    } finally {
      setPdfBusy(false);
    }
  };
  return (
    <section className="receiptWrap">
      <div className="receiptActions">
        <button className="ghost" onClick={back}>
          ← Back
        </button>
        <div className="receiptActionButtons">
          <button className="secondary" onClick={() => window.print()}>
            Print
          </button>
          <button disabled={pdfBusy} onClick={savePdf}>
            {pdfBusy ? "Preparing PDF…" : "Save PDF"}
          </button>
        </div>
      </div>
      <p className="savedNotice">Saved securely in the bill database.</p>
      <article className="paper">
        <div className="receiptHeader">
          <div>
            <p>
              H SPIRE <b>C</b>
            </p>
            <small>CONSTRUCTION & PROJECT SERVICES</small>
          </div>
          <span>
            {isEstimate
              ? "CUSTOMER ESTIMATE"
              : (bill.billType || "FINAL BILL").toUpperCase()}
          </span>
        </div>
        <div className="receiptMeta">
          <div>
            <small>{isEstimate ? "ESTIMATE NUMBER" : "BILL NUMBER"}</small>
            <strong>{bill.billNumber}</strong>
          </div>
          {!isEstimate && bill.projectRef && (
            <div>
              <small>PROJECT REFERENCE</small>
              <strong>{bill.projectRef}</strong>
            </div>
          )}
          <div>
            <small>{isEstimate ? "ESTIMATE DATE" : "GENERATED"}</small>
            <strong>
              {new Date(bill.createdAt).toLocaleDateString("en-IN")}
            </strong>
          </div>
        </div>
        <h2>{isEstimate ? "Construction Estimate" : "Payment Receipt"}</h2>
        <p className="ack">
          {isEstimate
            ? "This estimate presents the expected construction cost for the work stated below."
            : "This payment receipt acknowledges the amount received toward the construction work stated below."}
        </p>
        <dl className="details">
          <div>
            <dt>Customer</dt>
            <dd>{bill.customerName}</dd>
          </div>
          {!isEstimate && (
            <div>
              <dt>Mobile</dt>
              <dd>{bill.customerMobile}</dd>
            </div>
          )}
          <div>
            <dt>Work</dt>
            <dd>{bill.workType}</dd>
          </div>
          <div>
            <dt>Location</dt>
            <dd>{bill.workLocation}</dd>
          </div>
          {bill.workArea && (
            <div>
              <dt>Work area</dt>
              <dd>{bill.workArea}</dd>
            </div>
          )}
          {bill.description && (
            <div>
              <dt>Description</dt>
              <dd>{bill.description}</dd>
            </div>
          )}
          <div>
            <dt>Quantity / area</dt>
            <dd>{bill.quantity}</dd>
          </div>
          <div>
            <dt>Rate</dt>
            <dd>{money(bill.rate)}</dd>
          </div>
          <div>
            <dt>Moram vehicles</dt>
            <dd>{bill.moramQty}</dd>
          </div>
          <div>
            <dt>Service fee</dt>
            <dd>{money(bill.serviceFee)}</dd>
          </div>
          <div>
            <dt>Payment mode</dt>
            <dd>{bill.paymentMode}</dd>
          </div>
        </dl>
        <div className="totals">
          <div>
            <span>{isEstimate ? "Estimated total" : "Project total"}</span>
            <b>{money(bill.total)}</b>
          </div>
          {!isEstimate && previous > 0 && (
            <div>
              <span>Previously received</span>
              <b>{money(previous)}</b>
            </div>
          )}
          {!isEstimate && (
            <div>
              <span>This payment</span>
              <b>{money(current)}</b>
            </div>
          )}
          <div>
            <span>Total received</span>
            <b>{money(bill.amountPaid)}</b>
          </div>
          <div className="balanceRow">
            <span>Remaining balance</span>
            <b>{money(bill.balance)}</b>
          </div>
        </div>
        <div className="signature">
          <span>Authorised Signature</span>
          <b>H Spire C</b>
        </div>
      </article>
      <Terms work={bill.workType} documentType={documentType} />
    </section>
  );
}
function Terms({
  work,
  documentType = "bill",
}: {
  work: string;
  documentType?: "bill" | "estimate";
}) {
  return (
    <article className="paper terms">
      <p className="eyebrow">H SPIRE C · {work.toUpperCase()}</p>
      <h2>Terms & Conditions</h2>
      <ol>
        <li>
          <b>Work timeline.</b> Boundary wall work is normally completed within
          15 working days; house construction follows the agreed plan. Weather,
          natural calamities, blocked access, power disruption or government
          restrictions may extend the schedule.
        </li>
        <li>
          <b>Payment schedule.</b> A 65% advance is required before materials
          and work start. The remaining 35% must be paid by work completion,
          before final handover.
        </li>
        <li>
          <b>Payment delay.</b> If the client cannot pay at completion, the
          client must give H Spire C a written request explaining the delay. An
          approved delay can be for a maximum of 15 calendar days.
        </li>
        <li>
          <b>Non-payment.</b> If payment is not completed within the approved
          time, H Spire C may take necessary action, including dismantling or
          removal of supplied brickwork/materials. Labour, transport, breakage
          and related expenses will be adjusted from the 65% advance already
          paid, and any money left after those expenses will be returned to the
          client.
        </li>
        <li>
          <b>Workmanship.</b> Later design changes, height additions or
          structural alterations are separate work and may carry nominal
          charges.
        </li>
        <li>
          <b>Liability.</b> H Spire C is not responsible for damage from natural
          calamities, vehicle impact, third-party interference or vandalism.
        </li>
      </ol>
      <p className="digital">
        This digitally generated{" "}
        {documentType === "estimate" ? "estimate" : "bill"} does not require the
        client’s physical signature.
      </p>
      <p className="digital">
        Main website:{" "}
        <a
          href="https://h-spire-c-receipt.mdaweshhussen8249.chatgpt.site/"
          target="_blank"
          rel="noreferrer"
        >
          H Spire C
        </a>
      </p>
    </article>
  );
}
