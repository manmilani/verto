import {
  useCanvasState,
  useHostTheme,
  H1,
  H2,
  Text,
  Stack,
  Row,
  Grid,
  Divider,
  Spacer,
  Pill,
  Stat,
  Callout,
  Table,
  UsageBar,
  CollapsibleSection,
  Swatch,
  Button,
  Select,
  IconButton,
  computeDAGLayout,
  type PillTone,
  type Color,
} from "cursor/canvas";

/* ------------------------------------------------------------------ */
/* Data model — sourced from epics/*.md + .plans/*.md + codebase audit */
/* ------------------------------------------------------------------ */

type Status = "done" | "partial" | "designed" | "missing";

const STATUS: Record<
  Status,
  { label: string; color: string; tone: PillTone; bar: Color; weight: number }
> = {
  done: { label: "Implemented", color: "#1F8A65E8", tone: "success", bar: "green", weight: 1 },
  partial: { label: "Partial", color: "#F0A040E0", tone: "warning", bar: "orange", weight: 0.5 },
  designed: { label: "Spec'd · not built", color: "#2E79B5E0", tone: "info", bar: "blue", weight: 0.15 },
  missing: { label: "Black box", color: "#C85898E0", tone: "deleted", bar: "pink", weight: 0 },
};

type Step = { name: string; status: Status; note: string };
type Journey = {
  id: string;
  name: string;
  persona: string;
  outcome: string;
  steps: Step[];
};

const JOURNEYS: Journey[] = [
  {
    id: "business-setup",
    name: "Childcare Business Onboarding & Setup",
    persona: "New centre / org → Rustybu",
    outcome:
      "A new (or migrating) childcare business gets fully set up in Rustybu — its service types, programs, classes, rooms, plans and cycles — and hits the ground running, ideally via a low-effort AI-assisted self-serve workflow. Part 1 (the underlying setup structure) flows into Part 2 (the intelligent onboarding layer on top).",
    steps: [
      { name: "① Centre / organisation registration (tenant creation)", status: "done", note: "Part 1 · /register creates a new childcare centre with isolated multi-tenant data." },
      { name: "① Centre profile & licence info", status: "done", note: "Part 1 · School Settings — centre info, country/province, licence number, age groups, enrollment settings." },
      { name: "① Select offered service-types + capacity per type", status: "partial", note: "Part 1 · tenant_service_types + School Settings set per-type licensed capacity; platform service types are jurisdiction-defined. 'Which types this centre offers' selection UX still maturing." },
      { name: "① Define programs (service-type, time-windows, age bounds)", status: "partial", note: "Part 1 · Programs editor exists; design still partial — time_windows and age-range narrowing not fully fleshed out." },
      { name: "① Define classes (program, capacity, room schedule)", status: "partial", note: "Part 1 · Class CRUD with required program_id + room_id; rostering and weekly scheduling need more work." },
      { name: "① Define rooms / spaces & booking calendar", status: "done", note: "Part 1 · rooms table, weekly bookings, double-booking conflict detection." },
      { name: "① Define tuition plans & subsidy config", status: "partial", note: "Part 1 · Tuition plan CRUD + CCFRI amount; design still incomplete — subsidy framework is BC-only and plan modelling has gaps." },
      { name: "① Define meal plans", status: "missing", note: "Part 1 · Nutrition domain not built; /nutrition-plans is 'Coming Soon'." },
      { name: "① Define billing / invoicing cycles", status: "missing", note: "Part 1 · No recurring billing engine or invoicing-cycle configuration." },
      { name: "① Define payroll cycles", status: "missing", note: "Part 1 · Payroll pipeline absent; /payroll is 'Coming Soon'." },
      { name: "① Staff setup, roles & credentials", status: "partial", note: "Part 1 · Staff records + roles done; credential expiry tracking & scheduling restriction missing." },
      { name: "① Auto-applied jurisdiction compliance rules", status: "done", note: "Part 1 · The rules engine auto-resolves the centre's BC rules for its classes/programs with zero per-centre configuration — setup 'just works' for compliance." },
      { name: "② Guided multi-step onboarding wizard", status: "missing", note: "Part 2 · No setup wizard orchestrating steps ①, tracking progress, or sequencing dependencies." },
      { name: "② Public-source business data retrieval (auto-fill)", status: "missing", note: "Part 2 · No lookup/scrape of public sources (centre website, licensing registry) to pre-fill profile, licence and offered service types." },
      { name: "② Bulk data import for existing businesses", status: "missing", note: "Part 2 · No import pipeline to migrate an existing centre's children, parents, staff, rooms, programs, tuition/meal plans and licence data." },
      { name: "② Data export / migration tooling", status: "partial", note: "Part 2 · data_dumps gives a full-state JSONB export; there is no structured import or two-way migration format." },
      { name: "② AI-assisted configuration suggestions", status: "missing", note: "Part 2 · The AI assistant answers ops questions but does not yet propose programs / classes / plans from the business profile during setup." },
      { name: "② Onboarding progress tracker / go-live checklist", status: "missing", note: "Part 2 · No setup-completeness tracking or readiness gating before the centre goes live." },
    ],
  },
  {
    id: "onboarding",
    name: "Family Onboarding & Enrollment",
    persona: "Parent → Director",
    outcome:
      "Turn a prospective family into an enrolled, compliant placement with the least possible friction. Spans public application intake, guardian/child records and documents, staged review and approval, waitlisting, compliance-aware placement, and the transition to an active enrollment on the right tuition plan — one trackable pipeline from first enquiry to first day.",
    steps: [
      { name: "Public application intake (form + public link)", status: "missing", note: "No applications table or public form endpoint. Dynamic form builder (epic 23/29) not started." },
      { name: "Guardian & child records", status: "done", note: "children, guardians, guardian_children junction; multi-parent / multi-child supported." },
      { name: "Document upload & e-signature", status: "missing", note: "No S3 / file-attachment layer anywhere in the system. Blocks every document flow." },
      { name: "Staged review & approval workflow", status: "missing", note: "Status enum has application_received/approved/rejected, but no guided staged-approval workflow UI." },
      { name: "Waitlist entry & intake priority", status: "partial", note: "Owns waitlist intake here; ranking/optimization lives in Capacity Planning. Waitlist UI (table+cards), priority int, sibling/parent columns. Automated priority scoring not built." },
      { name: "Placement suggestion (best class)", status: "designed", note: "lib/placement scorer/optimizer fully designed (glowing-sphinx §3). /placement page is 'Coming Soon'." },
      { name: "Compliance check at enrollment (what-if)", status: "designed", note: "Single-enrollment gate using the shared projection engine (POST /compliance/project) — the same engine Capacity Planning uses for bulk ranking/forecasting. Not yet wired into the enrollment action." },
      { name: "Enroll → active (unified lifecycle)", status: "done", note: "Unified enrollments table; in-place waitlist→active; events_log captures history." },
      { name: "Tuition plan assignment", status: "done", note: "Auto-detect plan by age + program + days/week; parent fee auto-calc." },
      { name: "Parent onboarding confirmation", status: "missing", note: "Guided onboarding step-tracker (epic 29) not built." },
    ],
  },
  {
    id: "compliance",
    name: "Continuous Compliance & Licensing",
    persona: "Director / Licensing",
    outcome:
      "Keep every centre continuously and provably within its jurisdiction's childcare regulations, without ever blocking the user. The engine evaluates ratios, ages, capacity and space requirements against per-jurisdiction rules (with per-centre overrides), surfaces violations as non-blocking warnings, and explains exactly why each rule passed, failed or is unknown. It is the architectural spine the enrollment, waitlist and placement journeys all build on.",
    steps: [
      { name: "Platform service-type & rules DB (BC)", status: "done", note: "8 BC service types + 51 jurisdiction rules seeded; jurisdiction-scoped rows." },
      { name: "CEL rules engine (3-valued logic)", status: "done", note: "Native cel-js dispatch; PASS/FAIL/UNKNOWN; ternary short-circuit fixed." },
      { name: "Config functions & generic display rules", status: "done", note: "Cfg* functions, ancestry-level display matching, isNotNull, memoized resolver (Phases 1-8 complete)." },
      { name: "Subject-constraint extraction", status: "done", note: "Structured age/capacity/ratio bounds extracted + hydrated per subject." },
      { name: "Class ↔ program ↔ service-type linkage", status: "done", note: "Required program_id + room_id on classes; ageGroupLimits removed." },
      { name: "Room usable-area requirement", status: "done", note: "rooms.usable_m2 + RequiredUsableArea() / CfgRoomUsable_m2() functions." },
      { name: "Nightly + event-driven scheduler", status: "partial", note: "scheduler.ts with phase-ordered execution exists; full event-driven trigger coverage still maturing." },
      { name: "Compliance overview page + drill-down", status: "done", note: "/compliance page with filterable per-subject results and report drill-down." },
      { name: "Notification-bell violation alert", status: "partial", note: "Bell is a generic mechanism; replit.md still marks it a placeholder. Compliance roll-up wiring partial." },
      { name: "Per-centre rule override UI (2-agent authoring)", status: "designed", note: "AI description-generation is current scope; full Agent-A/Agent-B override editor is future scope." },
      { name: "Multi-jurisdiction expansion (beyond BC)", status: "designed", note: "Schema supports country/state/city scopes; only Canada–BC is seeded today." },
    ],
  },
  {
    id: "attendance",
    name: "Daily Attendance & Ratio Operations",
    persona: "Educator",
    outcome:
      "Give educators a fast, reliable way to record who is present, and give the centre live visibility into ratios and safety. Spans daily check-in/out, staff-to-class rostering, real-time ratio reflection, secure pickup/drop-off authorization and handoff, and exportable attendance history — ideally working even offline on the floor.",
    steps: [
      { name: "Child & class roster", status: "done", note: "Roster derived from enrollments; class membership lives on the enrollment row." },
      { name: "Check-in / check-out", status: "done", note: "Today's attendance interface; check-in/out endpoints." },
      { name: "Staff ↔ class real roster", status: "partial", note: "Only a classId on staff — not a true schedule. Weakens staff-count compliance accuracy." },
      { name: "Live attendance-driven ratio check", status: "partial", note: "Compliance runs nightly/event-driven; no real-time ratio reflection from live check-ins surfaced to educators." },
      { name: "PIN / QR / parent-assisted check-in", status: "missing", note: "Epic 15 device/PIN/QR capture with location + responsible staff not built." },
      { name: "Pickup / drop-off authorization & handoff", status: "missing", note: "Single home for this use-case (also a child-safety concern). pickup_authorizations table designed (glowing-sphinx) but not built." },
      { name: "Offline mode & sync", status: "missing", note: "No offline entry / SyncQueue / conflict resolution (epics 16, 27)." },
      { name: "Attendance history & export", status: "partial", note: "Records persist; exportable logs not implemented." },
    ],
  },
  {
    id: "placement",
    name: "Capacity Planning & Placement Optimization",
    persona: "Director",
    outcome:
      "Help directors fill classes optimally and plan ahead. For each waitlisted child it ranks the best compliant class using multi-factor, explainable scoring, and it projects compliance forward in time (age-progression and what-if simulations) so the centre can forecast capacity and pre-empt violations before they occur.",
    steps: [
      { name: "Waitlist data (from Family Onboarding)", status: "partial", note: "Consumes the waitlist created in Family Onboarding; this journey owns ranking/optimization. Entries with priority/sibling exist; not yet feeding an optimizer." },
      { name: "Subject constraints (age/capacity bounds)", status: "done", note: "subject_constraints provides fast structured bounds for pre-filtering candidates." },
      { name: "Future projection engine (age-progression / what-if)", status: "designed", note: "POST /compliance/project designed to age children forward and run hypotheticals; not built." },
      { name: "Placement scorer (multi-factor)", status: "designed", note: "lib/placement/scorer.ts designed: compliance/age-fit/capacity/sibling/preference weighting." },
      { name: "Waitlist ranking algorithm", status: "designed", note: "waitlistRanker priority formula designed; no implementation." },
      { name: "Columnar placement UI", status: "missing", note: "/placement page is a 'Coming Soon' placeholder." },
      { name: "Explainable recommendations", status: "designed", note: "Per-criterion explanation strings specified in the design only." },
      { name: "Capacity forecast dashboard", status: "missing", note: "No multi-month occupancy/capacity forecast view." },
    ],
  },
  {
    id: "billing",
    name: "Billing, Subsidy & Payments",
    persona: "Admin / Parent",
    outcome:
      "Get the centre paid accurately and on time. Spans turning tuition plans into recurring invoices, applying government subsidies (CCFRI), collecting payments by card or bank debit, handling failed-payment retries and reconciliation, issuing receipts and late fees, and giving parents a self-serve way to pay.",
    steps: [
      { name: "Tuition plans (rate by program/age/days)", status: "done", note: "~80% — tuition plan CRUD, parent-fee auto-calc, CCFRI amount field." },
      { name: "Invoice generation", status: "partial", note: "Invoice list/detail + CRUD exist; recurring billing engine not built." },
      { name: "CCFRI subsidy estimator", status: "partial", note: "ccfri-estimator-core mirrors the BC gov estimator; full subsidy lifecycle absent." },
      { name: "Subsidy eligibility & reconciliation", status: "missing", note: "Epic 19 (XL): eligibility tracking, gov disbursement reconciliation, reporting — not built." },
      { name: "Payment recording", status: "partial", note: "payments CRUD exists; /payments page is 'Coming Soon'." },
      { name: "Payment gateway (cards / bank debit)", status: "missing", note: "No gateway integration." },
      { name: "Failed-payment retries & reconciliation", status: "missing", note: "No dunning / retry / reconciliation logic." },
      { name: "Receipts & late fees", status: "missing", note: "Not implemented." },
      { name: "Parent self-serve payment portal", status: "missing", note: "No parent-facing payment surface." },
    ],
  },
  {
    id: "staff",
    name: "Staff Management, Scheduling & Payroll",
    persona: "Manager",
    outcome:
      "Run the workforce from schedule to paycheque. Spans shift scheduling against availability and credentials, capturing clock-in/out into auto-generated timesheets, tracking leave types, computing overtime to BC thresholds, routing approvals, and exporting clean data to payroll — while keeping credential validity in view.",
    steps: [
      { name: "Staff records & roles", status: "done", note: "Staff profiles, roles, class assignment, detail pages." },
      { name: "Certifications / credentials store", status: "partial", note: "certifications table exists; expiry tracking, reminders & scheduling restriction (epic 20) missing." },
      { name: "Shift scheduling", status: "partial", note: "shifts table + staff calendar + timesheets page; constraints limited." },
      { name: "Staff availability constraints", status: "missing", note: "No recurring availability table." },
      { name: "Clock-in/out & timesheet auto-gen", status: "partial", note: "actualTimes captured; auto-generation of timesheets from actuals not built." },
      { name: "Leave types (sick / vacation / unpaid)", status: "partial", note: "Only isSickLeave boolean; leaves table designed; /leaves page is 'Coming Soon'." },
      { name: "Overtime calculation (BC thresholds)", status: "missing", note: "No daily/weekly overtime computation." },
      { name: "Manager approval workflow", status: "missing", note: "No timesheet approval pipeline." },
      { name: "Payroll export (CSV/JSON)", status: "missing", note: "/payroll page is 'Coming Soon'; no export." },
    ],
  },
  {
    id: "communication",
    name: "Parent Communication & Engagement",
    persona: "Parent / Educator",
    outcome:
      "Keep families and staff connected and informed. Spans 1:1 and group messaging, announcements, photo/video sharing and daily reports, read receipts and notification preferences across push/SMS/email, plus a consent-driven flow to publish approved moments to the centre's public website gallery.",
    steps: [
      { name: "1:1 messaging & conversations", status: "done", note: "conversations/messages, single MessagingPanel reused in full page + header popup." },
      { name: "Group messaging & announcements", status: "partial", note: "Conversation primitive exists; group/announcement & moderation controls not built out." },
      { name: "Media uploads (photos / videos)", status: "missing", note: "No media storage layer — blocked by the missing file/S3 subsystem." },
      { name: "Daily reports", status: "missing", note: "No structured daily-report feature (epic 14)." },
      { name: "Read receipts", status: "missing", note: "Not implemented." },
      { name: "Delivery channels (push / SMS / email)", status: "missing", note: "Only in-app. Central notification service (epic 22) not built." },
      { name: "Notification preferences & templates", status: "missing", note: "No preference/template system." },
      { name: "Website gallery consent flow", status: "missing", note: "Epic 30 — request parent permission to publish chat media to the centre website. Concept only." },
    ],
  },
  {
    id: "development",
    name: "Child Development & Learning",
    persona: "Educator / Parent",
    outcome:
      "Help educators document each child's growth and share it with families. Spans recording observations and developmental milestones against a curriculum framework, building media-rich child portfolios, and generating learning reports parents can follow over time.",
    steps: [
      { name: "Curriculum framework", status: "missing", note: "/curriculum page is 'Coming Soon'." },
      { name: "Observations & milestones", status: "missing", note: "Epic 17 — no Observation/Milestone entities." },
      { name: "Portfolios & parent reports", status: "missing", note: "Not built." },
      { name: "Media attachments", status: "missing", note: "Blocked by the missing file/S3 subsystem." },
    ],
  },
  {
    id: "health",
    name: "Health, Incident & Safety",
    persona: "Educator / Parent",
    outcome:
      "Keep children safe and parents informed about wellbeing. Spans health profiles (allergies, conditions, medications), a medication-administration log, structured incident reporting for injuries and behavioural events, and instant parent notification — all kept as compliance-ready, auditable records.",
    steps: [
      { name: "Health profile (allergies, meds, conditions)", status: "partial", note: "health_records with allergies/dietary/medications fields exist." },
      { name: "Medication administration log", status: "missing", note: "No MedicationLog entity (epic 18)." },
      { name: "Incident logging (injury / behaviour)", status: "missing", note: "No Incident entity with timestamps + staff notes." },
      { name: "Instant parent notification", status: "missing", note: "Depends on missing multi-channel notification service." },
      { name: "Compliance-ready safety logs", status: "missing", note: "No exportable, audit-ready incident logs." },
    ],
  },
  {
    id: "nutrition",
    name: "Nutrition & Meal Service",
    persona: "Cook / Educator",
    outcome:
      "Plan and serve meals that respect every child's dietary needs. Spans building meal plans and menus, scheduling meals by allergy/preference/weekday, logging what each child actually consumed, and giving kitchen staff a clear daily prep view.",
    steps: [
      { name: "Dietary restrictions per child", status: "partial", note: "dietaryRestrictions[] on healthRecords only." },
      { name: "Meal plans & menus", status: "missing", note: "/nutrition-plans page is 'Coming Soon'; no MealPlan/Menu entities." },
      { name: "Allergy/weekday-aware meal scheduling", status: "missing", note: "Not built (epic 13)." },
      { name: "Consumption logs", status: "missing", note: "No consumption_logs." },
      { name: "Kitchen-facing views", status: "missing", note: "Not built." },
    ],
  },
  {
    id: "inventory",
    name: "Inventory & Resource Tracking",
    persona: "Admin",
    outcome:
      "Make sure the centre never runs out of what it needs. Spans tracking consumables (diapers, food, supplies) and stock levels, firing low-stock alerts, and optionally linking usage to specific rooms or children for accurate, timely replenishment.",
    steps: [
      { name: "Inventory items & stock levels", status: "missing", note: "/inventory page is 'Coming Soon'; 0% of epic 12." },
      { name: "Low-stock alerts", status: "missing", note: "Not built." },
      { name: "Usage linked to children / rooms", status: "missing", note: "Not built." },
    ],
  },
  {
    id: "bi",
    name: "Business Intelligence & Reporting",
    persona: "Owner",
    outcome:
      "Give owners and directors a clear, data-backed picture of how the centre is performing. Spans operational and business dashboards (occupancy, revenue, staffing, compliance), historical point-in-time snapshots and a full audit trail, plus custom reports, exports and forecasting to drive decisions.",
    steps: [
      { name: "Operational dashboard", status: "done", note: "Stats, charts, alerts, activity feed." },
      { name: "Business dashboard (revenue / occupancy)", status: "done", note: "Replaces legacy /reports." },
      { name: "Weekly data dumps / snapshots", status: "done", note: "data_dumps table + weekly cron + manual trigger; pre-computed ageMonths/parentFee/occupancy." },
      { name: "Event log / audit trail", status: "done", note: "Append-only events_log via PL/pgSQL triggers across all domain tables." },
      { name: "Custom reports & exports", status: "missing", note: "/reporting page is 'Coming Soon'." },
      { name: "Forecasting", status: "missing", note: "No forecasting beyond basic dashboards." },
      { name: "Compliance analytics", status: "partial", note: "Compliance results are visible; trend analytics not built." },
    ],
  },
  {
    id: "platform",
    name: "Platform Administration & Multi-tenancy",
    persona: "Platform / Owner",
    outcome:
      "Provide the secure, isolated, multi-tenant foundation every centre runs on. Spans per-tenant data isolation, the role and permission model, branding and custom-domain routing, multi-site/franchise organisation structures, and the integration/API surface — the infrastructure layer the whole product sits on (provider-side business operations live in their own journeys).",
    steps: [
      { name: "Multi-tenant isolation", status: "done", note: "tenantId on all domain tables; per-tenant data isolation." },
      { name: "Auth & role model", status: "partial", note: "JWT + role enum exist; fine-grained RBAC permission enforcement (epic 26) not implemented." },
      { name: "Branding (logo / theme)", status: "partial", note: "Basic logo/colour; AI-driven auto-branding (epic 10) absent." },
      { name: "Custom-domain routing", status: "missing", note: "Not built." },
      { name: "Multi-site / franchise (organizations)", status: "missing", note: "org_id reserved in rules scope; no organizations table or cross-site RBAC (epic 11)." },
      { name: "Integrations / webhooks / OAuth2", status: "partial", note: "REST API + OpenAPI codegen done; webhooks & OAuth2 (epic 25) missing." },
      { name: "Security: PIPEDA, encryption-at-rest", status: "missing", note: "No documented PIPEDA compliance / field encryption layer." },
    ],
  },
  {
    id: "saas-ops",
    name: "Rustybu SaaS Operations & Admin Console",
    persona: "Rustybu staff (provider)",
    outcome:
      "Rustybu — as the SaaS business — manages its paying customers (childcare orgs/centres): a back-office to configure, monitor and troubleshoot tenant accounts, run subscription plans, and bill/collect subscription fees. A distinct provider-facing surface above the tenant app — today almost entirely greenfield.",
    steps: [
      { name: "Internal admin console / back-office surface", status: "missing", note: "No provider-facing application distinct from the tenant app; staff cannot administer customers from anywhere." },
      { name: "Customer (tenant) directory & account management", status: "missing", note: "tenants table exists, but there is no cross-tenant view or super-admin to manage all customer accounts." },
      { name: "Subscription plans & pricing catalogue", status: "partial", note: "tenants.subscriptionPlan field exists; no plan catalogue, pricing, or management around it." },
      { name: "Subscription lifecycle (trial / upgrade / downgrade / cancel / dunning)", status: "missing", note: "No lifecycle state machine, no proration, no churn/dunning handling." },
      { name: "Billing & invoicing customers for subscription fees", status: "missing", note: "Distinct from tenants billing parents — there is no provider-side invoicing of customers at all." },
      { name: "Payment collection from customers (e.g. Stripe Billing)", status: "missing", note: "No merchant/billing integration to collect recurring subscription revenue." },
      { name: "Plan-based feature flags / entitlements", status: "missing", note: "Per-tenant feature flags are designed but unbuilt; no entitlement gating tied to a plan." },
      { name: "Usage metering & plan-limit enforcement", status: "missing", note: "No metering of seats/children/centres or enforcement of plan limits." },
      { name: "Cross-tenant monitoring & ops health dashboards", status: "missing", note: "No provider observability over customer operations, errors, or activity." },
      { name: "Troubleshooting tools (support login / scoped impersonation)", status: "missing", note: "events_log exists per tenant, but there is no safe 'view-as-customer' / impersonation or scoped access tooling." },
      { name: "Tenant provisioning / offboarding & data lifecycle", status: "partial", note: "/register provisions a tenant; no offboarding, suspension, data retention or deletion lifecycle." },
      { name: "Super-admin RBAC for Rustybu staff", status: "missing", note: "Role enum is centre-scoped (owner/director/educator…); no platform-superadmin tier." },
      { name: "Platform revenue analytics (MRR / churn / cohorts)", status: "missing", note: "No SaaS business metrics — distinct from a tenant's own occupancy/revenue dashboards." },
    ],
  },
  {
    id: "customer-support",
    name: "Customer Support & Success",
    persona: "Rustybu support → customer",
    outcome:
      "Rustybu helps its childcare-business customers succeed: contextual help, FAQs, workflow guidance, issue resolution and escalation. The in-product AI assistant is the closest existing piece, but a true support stack is largely missing.",
    steps: [
      { name: "In-product AI assistant (contextual ops help)", status: "done", note: "Sole home for the in-product assistant (moved out of Platform Admin). Built + working: multi-turn tool-calling agent, 11 data tools, 3 providers + built-in, answers data/ops questions and navigates. Not yet a dedicated support/FAQ agent — that is the next step." },
      { name: "Help center / knowledge base / docs", status: "missing", note: "No searchable KB, guides, or policy/how-to content." },
      { name: "AI support agent (FAQs, billing/policy/workflow guidance)", status: "designed", note: "Epic 24 describes conversational support AI (AIContext / QueryLog); the current assistant is data-tools only, not this." },
      { name: "Customer → Rustybu support channel (in-app)", status: "missing", note: "Messaging is tenant-internal (parent↔staff); there is no channel from a customer to Rustybu support." },
      { name: "Support ticketing & case management", status: "missing", note: "No ticket queue, SLAs, or case tracking." },
      { name: "Human escalation & bug reporting", status: "missing", note: "No path to escalate from AI/self-serve to a human, or to file a bug with context." },
      { name: "Status page / incident communication", status: "missing", note: "No uptime/status surface or incident broadcast to customers." },
      { name: "Customer success / onboarding assistance", status: "missing", note: "Human/CS touchpoints that help a customer succeed — distinct from the automated self-serve wizard in Business Onboarding Part 2, which they complement." },
      { name: "Feedback & feature-request capture", status: "missing", note: "No structured channel to collect customer feedback or feature requests." },
      { name: "Support interaction logging & analytics", status: "missing", note: "Epic 24's QueryLog (what customers ask, deflection rate, satisfaction) is not implemented." },
    ],
  },
];

/* Cross-cutting black boxes — systems whose absence blocks many verticals. */
type BlackBox = {
  system: string;
  severity: "Critical" | "High" | "Medium";
  whats: string;
  blocks: string[];
};

const BLACK_BOXES: BlackBox[] = [
  {
    system: "AI-powered self-serve business onboarding & data migration",
    severity: "Critical",
    whats:
      "No setup wizard, no public-source data retrieval to pre-fill a centre's profile, and no bulk import to migrate an existing business's children, parents, staff, rooms, programs and plans. Today a new customer must hand-configure everything — the single biggest barrier to time-to-value.",
    blocks: ["Business onboarding & setup", "Time-to-value for new customers", "Migrating existing centres"],
  },
  {
    system: "Setup-definition depth (plans & cycles)",
    severity: "High",
    whats:
      "The Part-1 setup structure is incomplete: meal plans, billing/invoicing cycles and payroll cycles don't exist, and program / class / tuition-plan modelling still has acknowledged design gaps.",
    blocks: ["Business onboarding & setup", "Billing & payments", "Staff & payroll", "Nutrition"],
  },
  {
    system: "Rustybu SaaS back-office / admin console",
    severity: "Critical",
    whats:
      "There is no provider-facing surface at all to run Rustybu as a business: no cross-tenant customer directory, no monitoring, no troubleshooting/impersonation tooling, and no super-admin role tier above the centre-scoped roles.",
    blocks: ["SaaS operations & admin", "Customer support", "Troubleshooting & ops visibility"],
  },
  {
    system: "Subscription monetization (billing customers)",
    severity: "Critical",
    whats:
      "Only a single tenants.subscriptionPlan field exists. No plan catalogue, lifecycle (trial/upgrade/cancel/dunning), entitlement gating, usage metering, or — critically — any way to invoice and collect subscription fees from customers.",
    blocks: ["SaaS operations & admin", "Rustybu revenue", "Feature gating per plan"],
  },
  {
    system: "Customer support & success stack",
    severity: "High",
    whats:
      "No help center, ticketing, customer→Rustybu support channel, status page, or escalation path. The in-product AI is a data assistant, not the FAQ/policy support agent envisioned in epic 24.",
    blocks: ["Customer support & success", "Onboarding assistance", "Customer retention"],
  },
  {
    system: "File / document storage (S3-style) layer",
    severity: "Critical",
    whats:
      "There is no media or document storage anywhere. Nothing can persist a PDF, photo, video, signed form or portfolio asset.",
    blocks: ["Onboarding docs", "Messaging media", "Learning portfolios", "Incident attachments", "Website gallery"],
  },
  {
    system: "Multi-channel notification delivery",
    severity: "Critical",
    whats:
      "Only an in-app bell exists (and it is still a placeholder). No push / SMS / email transport, no templates, no per-user preferences.",
    blocks: ["Communication", "Billing reminders", "Health/incident alerts", "Compliance alerts", "Credential expiry"],
  },
  {
    system: "Application intake + staged approval workflow",
    severity: "High",
    whats:
      "No applications table, no public submission form, no dynamic form builder, no guided staged approval. Onboarding starts mid-pipeline.",
    blocks: ["Onboarding", "Documents & forms", "Parent onboarding confirmation"],
  },
  {
    system: "Placement & projection engine (lib/placement + /compliance/project)",
    severity: "High",
    whats:
      "Thoroughly designed (scorer, optimizer, waitlist ranker, future-date projection) but entirely unbuilt — the keystone that turns compliance into decisions.",
    blocks: ["Placement optimization", "Compliance-at-enrollment", "Capacity forecasting"],
  },
  {
    system: "Payments & recurring billing engine",
    severity: "High",
    whats:
      "Only invoice/payment CRUD + a CCFRI estimator. No gateway, recurring engine, retries, receipts, late fees or parent payment surface.",
    blocks: ["Billing & payments", "Subsidy reconciliation"],
  },
  {
    system: "Payroll pipeline",
    severity: "High",
    whats:
      "Leave types, availability, timesheet auto-generation, overtime, approvals and payroll export are all missing on top of basic shift CRUD.",
    blocks: ["Staff management & payroll"],
  },
  {
    system: "Mobile / PWA + offline sync",
    severity: "High",
    whats:
      "Responsive web only. No offline data entry, SyncQueue or conflict resolution — critical for educators on the floor and parents on the go.",
    blocks: ["Attendance", "Communication", "Health/incident capture"],
  },
  {
    system: "Subsidy lifecycle beyond the estimator",
    severity: "Medium",
    whats:
      "CCFRI math exists, but eligibility tracking, applying subsidies to invoices, government disbursement reconciliation and reporting do not.",
    blocks: ["Billing & subsidy", "Government reporting"],
  },
  {
    system: "RBAC enforcement + PIPEDA / encryption",
    severity: "High",
    whats:
      "Roles exist but fine-grained permissions are not enforced; no documented PIPEDA stance or encryption-at-rest. A legal/compliance risk at scale.",
    blocks: ["Platform admin", "Every regulated data flow"],
  },
  {
    system: "Multi-site / franchise (organizations) layer",
    severity: "Medium",
    whats:
      "org_id is reserved in the rules-scope hierarchy, but there is no organizations table, cross-site RBAC, or aggregate dashboard.",
    blocks: ["Enterprise/franchise growth", "Centralised compliance rollups"],
  },
  {
    system: "Green-field secondary domains",
    severity: "Medium",
    whats:
      "Learning & Development, Nutrition/Meal planning, and Inventory are effectively 0% — only stub fields and 'Coming Soon' pages.",
    blocks: ["Child development", "Nutrition service", "Inventory tracking"],
  },
];

/* ------------------------------------------------------------------ */
/* Derived metrics                                                     */
/* ------------------------------------------------------------------ */

function completion(j: Journey): number {
  const sum = j.steps.reduce((acc, s) => acc + STATUS[s.status].weight, 0);
  return sum / j.steps.length;
}

function counts(j: Journey): Record<Status, number> {
  const c: Record<Status, number> = { done: 0, partial: 0, designed: 0, missing: 0 };
  j.steps.forEach((s) => (c[s.status] += 1));
  return c;
}

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

function buildTone(n: number): PillTone {
  if (n >= 0.7) return "success";
  if (n >= 0.4) return "warning";
  if (n >= 0.15) return "info";
  return "deleted";
}

function rowToneFor(n: number): "success" | "warning" | "info" | "danger" {
  if (n >= 0.7) return "success";
  if (n >= 0.4) return "warning";
  if (n >= 0.15) return "info";
  return "danger";
}

const TOTAL_STEPS = JOURNEYS.reduce((a, j) => a + j.steps.length, 0);
const OVERALL =
  JOURNEYS.reduce((a, j) => a + j.steps.reduce((b, s) => b + STATUS[s.status].weight, 0), 0) /
  TOTAL_STEPS;

/* ------------------------------------------------------------------ */
/* Small presentational helpers                                        */
/* ------------------------------------------------------------------ */

function LegendDot({ status }: { status: Status }) {
  return (
    <Row gap={6} align="center">
      <div
        style={{
          width: 10,
          height: 10,
          borderRadius: 999,
          background: STATUS[status].color,
          flex: "0 0 auto",
        }}
      />
      <Text size="small" tone="secondary">
        {STATUS[status].label}
      </Text>
    </Row>
  );
}

function PipelineStep({ step, index, last }: { step: Step; index: number; last: boolean }) {
  const t = useHostTheme();
  const meta = STATUS[step.status];
  return (
    <Row gap={12} align="stretch">
      {/* rail with connector line + status node */}
      <div style={{ position: "relative", width: 26, flex: "0 0 auto", display: "flex", justifyContent: "center" }}>
        {!last && (
          <div
            style={{
              position: "absolute",
              top: 18,
              bottom: -14,
              width: 2,
              background: t.stroke.secondary,
            }}
          />
        )}
        <div
          style={{
            position: "relative",
            zIndex: 1,
            marginTop: 8,
            width: 20,
            height: 20,
            borderRadius: 999,
            background: meta.color,
            color: "#0c0c0c",
            fontSize: 11,
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: `2px solid ${t.bg.editor}`,
          }}
        >
          {index + 1}
        </div>
      </div>
      {/* content */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          border: `1px solid ${t.stroke.tertiary}`,
          borderRadius: 8,
          padding: "8px 12px",
          marginBottom: 6,
          background: step.status === "missing" ? t.fill.quaternary : "transparent",
        }}
      >
        <Row gap={8} align="center">
          <Text weight="semibold" style={{ flex: 1, minWidth: 0 }}>
            {step.name}
          </Text>
          <Pill size="sm" tone={meta.tone} active>
            {meta.label}
          </Pill>
        </Row>
        <Text size="small" tone="tertiary" style={{ marginTop: 2 }}>
          {step.note}
        </Text>
      </div>
    </Row>
  );
}

/* ------------------------------------------------------------------ */
/* View 1 — Vertical delivery map (the original presentation)          */
/* ------------------------------------------------------------------ */

function MapView() {
  const t = useHostTheme();
  const [selectedId, setSelectedId] = useCanvasState<string>("selectedJourney", "business-setup");
  const selected = JOURNEYS.find((j) => j.id === selectedId) ?? JOURNEYS[0];

  const sc = counts(selected);
  const scomp = completion(selected);
  const gaps = selected.steps.filter((s) => s.status === "missing" || s.status === "designed");

  const builtJourneys = JOURNEYS.filter((j) => completion(j) >= 0.7).length;
  const blackBoxSteps = JOURNEYS.reduce((a, j) => a + counts(j).missing, 0);

  return (
    <Stack gap={20} style={{ padding: 24, maxWidth: 1180, margin: "0 auto" }}>
      {/* Header */}
      <Stack gap={6}>
        <H1>Rustybu — Vertical Delivery Map</H1>
        <Text tone="secondary">
          Childcare-management SaaS (Vancouver, BC) seen as vertical user journeys. Each journey is realised through a
          stack of subsystems; the colour of every step shows whether it is implemented, partial, only designed, or a
          true black box. Pick a journey to walk its delivery pipeline and see exactly what is missing.
        </Text>
      </Stack>

      {/* Top-level stats */}
      <Grid columns={4} gap={16}>
        <Stat value={String(JOURNEYS.length)} label="Vertical journeys mapped" />
        <Stat value={pct(OVERALL)} label="Weighted build coverage" tone={OVERALL >= 0.5 ? "success" : "warning"} />
        <Stat value={`${builtJourneys}/${JOURNEYS.length}`} label="Journeys ≥70% built" tone="info" />
        <Stat value={String(blackBoxSteps)} label="Black-box steps (unbuilt)" tone="danger" />
      </Grid>

      {/* Legend */}
      <Row gap={20} wrap align="center" style={{ padding: "10px 14px", border: `1px solid ${t.stroke.tertiary}`, borderRadius: 8 }}>
        <Text size="small" weight="semibold" tone="secondary">
          Legend
        </Text>
        <LegendDot status="done" />
        <LegendDot status="partial" />
        <LegendDot status="designed" />
        <LegendDot status="missing" />
        <Spacer />
        <Text size="small" tone="quaternary">
          Source: epics/*.md + .plans + codebase audit · as of Jun 2026
        </Text>
      </Row>

      {/* Journey selector */}
      <Stack gap={8}>
        <H2>Explore a vertical delivery</H2>
        <Row gap={8} wrap>
          {JOURNEYS.map((j) => {
            const c = completion(j);
            return (
              <Pill
                key={j.id}
                active={j.id === selectedId}
                tone={buildTone(c)}
                onClick={() => setSelectedId(j.id)}
                title={`${pct(c)} built`}
              >
                {j.name}
              </Pill>
            );
          })}
        </Row>
      </Stack>

      {/* Selected journey detail */}
      <Stack gap={12} style={{ border: `1px solid ${t.stroke.secondary}`, borderRadius: 10, padding: 18 }}>
        <Row gap={12} align="center" wrap>
          <Stack gap={2} style={{ flex: 1, minWidth: 240 }}>
            <Text weight="bold" style={{ fontSize: 18 }}>
              {selected.name}
            </Text>
            <Text size="small" tone="tertiary">
              {selected.persona}
            </Text>
          </Stack>
          <Stat value={pct(scomp)} label="Journey build" tone={rowToneFor(scomp) === "danger" ? "danger" : rowToneFor(scomp)} />
        </Row>

        <Text italic tone="secondary">
          {selected.outcome}
        </Text>

        <UsageBar
          total={selected.steps.length}
          topLeftLabel="Subsystem build mix"
          topRightLabel={`${sc.done} built · ${sc.partial} partial · ${sc.designed} spec'd · ${sc.missing} black box`}
          segments={[
            { id: "done", value: sc.done, color: STATUS.done.bar },
            { id: "partial", value: sc.partial, color: STATUS.partial.bar },
            { id: "designed", value: sc.designed, color: STATUS.designed.bar },
            { id: "missing", value: sc.missing, color: STATUS.missing.bar },
          ]}
        />

        <Divider />

        <Text size="small" tone="secondary" weight="semibold">
          Delivery pipeline — how this journey is (or would be) realised, top to bottom
        </Text>
        <Stack gap={0}>
          {selected.steps.map((s, i) => (
            <PipelineStep key={s.name} step={s} index={i} last={i === selected.steps.length - 1} />
          ))}
        </Stack>

        {gaps.length > 0 && (
          <Callout
            tone={sc.missing > 0 ? "danger" : "warning"}
            title={`What's missing to fully deliver "${selected.name}" (${gaps.length} of ${selected.steps.length} steps)`}
          >
            <Stack gap={4}>
              {gaps.map((g) => (
                <Text key={g.name} size="small">
                  <Text as="span" weight="semibold">
                    {STATUS[g.status].label}:
                  </Text>{" "}
                  {g.name}
                </Text>
              ))}
            </Stack>
          </Callout>
        )}
      </Stack>

      <Divider />

      {/* Portfolio table */}
      <Stack gap={8}>
        <H2>Full portfolio at a glance</H2>
        <Text size="small" tone="tertiary">
          All vertical deliveries ranked by build coverage. Click a journey to open its pipeline above. Counts are
          subsystem steps per status.
        </Text>
        <Table
          headers={["Vertical delivery", "Primary user", "Build", "Implemented", "Partial", "Spec'd", "Black box"]}
          columnAlign={["left", "left", "right", "right", "right", "right", "right"]}
          rowTone={[...JOURNEYS]
            .sort((a, b) => completion(b) - completion(a))
            .map((j) => rowToneFor(completion(j)))}
          rows={[...JOURNEYS]
            .sort((a, b) => completion(b) - completion(a))
            .map((j) => {
              const c = counts(j);
              return [
                <Pill active={j.id === selectedId} tone={buildTone(completion(j))} onClick={() => setSelectedId(j.id)}>
                  {j.name}
                </Pill>,
                <Text size="small" tone="secondary">
                  {j.persona}
                </Text>,
                <Text weight="semibold">{pct(completion(j))}</Text>,
                String(c.done),
                String(c.partial),
                String(c.designed),
                String(c.missing),
              ];
            })}
        />
      </Stack>

      <Divider />

      {/* Black-box analysis */}
      <Stack gap={8}>
        <H2>The biggest black boxes</H2>
        <Text tone="secondary">
          Cross-cutting subsystems whose absence blocks multiple vertical deliveries at once. These are the highest-leverage
          gaps — building them unlocks several journeys simultaneously. Expand each to see what is missing and which
          journeys it gates.
        </Text>
        <Stack gap={2}>
          {BLACK_BOXES.map((bb) => {
            const tone: PillTone = bb.severity === "Critical" ? "deleted" : bb.severity === "High" ? "warning" : "info";
            const swatch: Color = bb.severity === "Critical" ? "pink" : bb.severity === "High" ? "orange" : "blue";
            return (
              <CollapsibleSection
                key={bb.system}
                title={bb.system}
                count={bb.blocks.length}
                leading={<Swatch color={swatch} />}
                trailing={
                  <Pill size="sm" tone={tone} active>
                    {bb.severity}
                  </Pill>
                }
              >
                <Stack gap={8} style={{ paddingTop: 4, paddingBottom: 8 }}>
                  <Text size="small">{bb.whats}</Text>
                  <Row gap={6} wrap align="center">
                    <Text size="small" tone="tertiary" weight="semibold">
                      Blocks:
                    </Text>
                    {bb.blocks.map((b) => (
                      <Pill key={b} size="sm" tone="neutral">
                        {b}
                      </Pill>
                    ))}
                  </Row>
                </Stack>
              </CollapsibleSection>
            );
          })}
        </Stack>
      </Stack>

      {/* What is solid today */}
      <Callout tone="success" title="What is genuinely solid today">
        The compliance spine is the standout: a generic, multi-jurisdiction CEL rules engine with three-valued logic,
        config functions, ancestry-level display rules and constraint extraction (rules-display epic Phases 1–8 complete).
        Around it sit a working multi-tenant core, unified enrollment lifecycle, trigger-based audit log, weekly data
        dumps, messaging, a tool-calling AI assistant, and a real test framework (Vitest + Testcontainers + Playwright).
        The product is strongest at <Text as="span" weight="semibold">knowing</Text> the rules; it is weakest at
        <Text as="span" weight="semibold"> acting</Text> on them (placement, payments, notifications), at the
        field-facing and green-field domains, and at <Text as="span" weight="semibold">getting customers in the door</Text>
        {" "}— the AI-assisted business onboarding that would drive time-to-value is almost entirely a black box on top of a
        still-incomplete Part-1 setup structure. And the entire <Text as="span" weight="semibold">provider-business plane</Text>
        {" "}— the SaaS admin console, subscription monetization, and customer support stack Rustybu needs to run itself as a
        business — is effectively greenfield.
      </Callout>
    </Stack>
  );
}

/* ================================================================== */
/* View 2 — Necessary Conditions Network (dependency graph)            */
/* ================================================================== */
/*
 * The same product, re-expressed as work-items (subsystems / pipeline
 * steps) and the *necessary conditions* between them. An arrow A → B
 * means "A must be done before B can be fully built" — so the set of all
 * in-arrows into a node is the complete set of prerequisites for it.
 * Shared subsystems appear exactly once, which is what makes leverage and
 * sequencing visible.
 */

type GNode = {
  id: string;
  label: string;
  desc: string;
  status: Status;
  verts: string[]; // journeys this node is a necessary condition for
  deps: string[]; // necessary-condition nodes that must be done first
};

const NODES: GNode[] = [
  /* ---- Cross-cutting foundations & platform ---- */
  { id: "tenancy", label: "Multi-tenant isolation", desc: "tenantId on every domain table; per-tenant data isolation.", status: "done", verts: ["platform"], deps: [] },
  { id: "auth", label: "Auth & session (JWT)", desc: "JWT auth + role enum. Fine-grained enforcement is separate (rbac).", status: "partial", verts: ["platform"], deps: [] },
  { id: "rbac", label: "RBAC permission enforcement", desc: "Fine-grained permission checks per role (epic 26).", status: "missing", verts: ["platform"], deps: ["auth"] },
  { id: "security", label: "PIPEDA / encryption-at-rest", desc: "Documented privacy stance + field encryption.", status: "missing", verts: ["platform"], deps: ["tenancy"] },
  { id: "eventslog", label: "Event log / audit trail", desc: "Append-only events_log via PL/pgSQL triggers.", status: "done", verts: ["bi"], deps: ["tenancy"] },
  { id: "filestore", label: "File / document storage (S3)", desc: "Persist PDFs, photos, video, signed forms, portfolio assets.", status: "missing", verts: ["onboarding", "communication", "development", "health"], deps: ["tenancy"] },
  { id: "notif", label: "Multi-channel notifications", desc: "Push / SMS / email transport + delivery.", status: "missing", verts: ["communication", "health"], deps: ["tenancy"] },
  { id: "paygateway", label: "Payment gateway", desc: "Card / bank-debit merchant integration (e.g. Stripe).", status: "missing", verts: ["billing"], deps: ["tenancy"] },
  { id: "mobile", label: "Mobile / PWA + offline shell", desc: "Offline-capable client foundation with sync queue.", status: "missing", verts: ["attendance"], deps: ["auth"] },
  { id: "aiassist", label: "In-product AI assistant", desc: "Multi-turn tool-calling agent over tenant data.", status: "done", verts: ["customer-support"], deps: ["tenancy"] },
  { id: "branding", label: "Branding (logo / theme)", desc: "Per-tenant logo & colours; AI auto-branding absent.", status: "partial", verts: ["platform"], deps: ["tenancy"] },
  { id: "customdomain", label: "Custom-domain routing", desc: "Per-tenant custom domains.", status: "missing", verts: ["platform"], deps: ["tenancy"] },
  { id: "integrations", label: "Integrations / webhooks / OAuth2", desc: "REST+OpenAPI done; webhooks & OAuth2 missing.", status: "partial", verts: ["platform"], deps: ["auth"] },
  { id: "multisite", label: "Multi-site / franchise (orgs)", desc: "organizations table + cross-site RBAC.", status: "missing", verts: ["platform"], deps: ["tenancy", "rbac"] },

  /* ---- Core records ---- */
  { id: "childrecords", label: "Child & guardian records", desc: "children, guardians, guardian_children junction.", status: "done", verts: ["onboarding"], deps: ["tenancy"] },
  { id: "staffrecords", label: "Staff records & roles", desc: "Staff profiles, roles, detail pages.", status: "done", verts: ["staff"], deps: ["tenancy"] },

  /* ---- Service configuration / setup structure ---- */
  { id: "servicetypes", label: "Service-type & rules DB", desc: "8 BC service types + 51 jurisdiction rules seeded.", status: "done", verts: ["compliance"], deps: ["tenancy"] },
  { id: "rooms", label: "Rooms / spaces & bookings", desc: "rooms table, weekly bookings, conflict detection.", status: "done", verts: ["compliance"], deps: ["tenancy"] },
  { id: "programs", label: "Programs (windows, ages)", desc: "Programs editor; time-windows/age-narrowing partial.", status: "partial", verts: ["compliance"], deps: ["servicetypes"] },
  { id: "classes", label: "Classes (program, capacity, room)", desc: "Class CRUD; rostering & weekly schedule need work.", status: "partial", verts: ["compliance", "attendance"], deps: ["programs", "rooms"] },
  { id: "tuitionplans", label: "Tuition plans & subsidy config", desc: "Plan CRUD + CCFRI amount; modelling has gaps.", status: "partial", verts: ["billing"], deps: ["programs"] },

  /* ---- Compliance spine ---- */
  { id: "celengine", label: "CEL rules engine (3-valued)", desc: "Native cel-js dispatch; PASS/FAIL/UNKNOWN.", status: "done", verts: ["compliance"], deps: ["servicetypes", "classes", "childrecords", "staffrecords"] },
  { id: "subjectconstraints", label: "Subject-constraint extraction", desc: "Structured age/capacity/ratio bounds per subject.", status: "done", verts: ["compliance", "placement"], deps: ["celengine"] },
  { id: "complianceui", label: "Compliance overview & display rules", desc: "Per-subject results, drill-down, ancestry display rules.", status: "done", verts: ["compliance"], deps: ["celengine"] },
  { id: "compliancesched", label: "Compliance scheduler", desc: "Nightly + event-driven evaluation; coverage maturing.", status: "partial", verts: ["compliance"], deps: ["celengine"] },
  { id: "ruleoverride", label: "Per-centre rule override UI", desc: "2-agent authoring/override editor (future scope).", status: "designed", verts: ["compliance"], deps: ["celengine", "complianceui"] },
  { id: "multijuris", label: "Multi-jurisdiction expansion", desc: "Schema supports scopes; only BC seeded today.", status: "designed", verts: ["compliance"], deps: ["servicetypes", "celengine"] },
  { id: "projection", label: "Projection engine (what-if / age)", desc: "POST /compliance/project: age forward + hypotheticals.", status: "designed", verts: ["onboarding", "placement"], deps: ["celengine", "subjectconstraints"] },

  /* ---- Family onboarding & enrollment ---- */
  { id: "enrolllifecycle", label: "Enrollment lifecycle (unified)", desc: "Unified enrollments; in-place waitlist→active; history.", status: "done", verts: ["onboarding"], deps: ["childrecords", "classes"] },
  { id: "tuitionassign", label: "Tuition plan assignment", desc: "Auto-detect plan by age+program+days; fee auto-calc.", status: "done", verts: ["onboarding"], deps: ["enrolllifecycle", "tuitionplans"] },
  { id: "formbuilder", label: "Dynamic form builder & e-sign", desc: "Configurable forms + e-signature (epic 23/29).", status: "missing", verts: ["onboarding"], deps: ["filestore"] },
  { id: "appintake", label: "Public application intake", desc: "applications table + public submission form/link.", status: "missing", verts: ["onboarding"], deps: ["formbuilder", "childrecords"] },
  { id: "approval", label: "Staged review & approval", desc: "Guided staged-approval workflow UI.", status: "missing", verts: ["onboarding"], deps: ["appintake"] },
  { id: "waitlistintake", label: "Waitlist entry & intake priority", desc: "Waitlist UI + priority/sibling columns (owns intake).", status: "partial", verts: ["onboarding"], deps: ["enrolllifecycle"] },
  { id: "enrollgate", label: "Compliance check at enrollment", desc: "Single-enrollment what-if gate via projection engine.", status: "designed", verts: ["onboarding"], deps: ["projection", "enrolllifecycle"] },
  { id: "parentonboard", label: "Parent onboarding confirmation", desc: "Guided onboarding step-tracker (epic 29).", status: "missing", verts: ["onboarding"], deps: ["approval", "enrolllifecycle", "notif"] },

  /* ---- Capacity planning & placement ---- */
  { id: "scorer", label: "Placement scorer (multi-factor)", desc: "compliance/age-fit/capacity/sibling/preference weighting.", status: "designed", verts: ["placement"], deps: ["projection", "subjectconstraints"] },
  { id: "waitlistrank", label: "Waitlist ranking algorithm", desc: "Priority formula over waitlist intake (designed).", status: "designed", verts: ["placement"], deps: ["waitlistintake", "scorer"] },
  { id: "placementui", label: "Placement UI + explanations", desc: "Columnar placement board + per-criterion reasons.", status: "missing", verts: ["placement"], deps: ["scorer", "waitlistrank"] },
  { id: "capforecast", label: "Capacity forecast dashboard", desc: "Multi-month occupancy/capacity projection view.", status: "missing", verts: ["placement"], deps: ["projection"] },

  /* ---- Daily attendance & ratio ops ---- */
  { id: "checkinout", label: "Check-in / check-out", desc: "Today's attendance interface; check-in/out endpoints.", status: "done", verts: ["attendance"], deps: ["childrecords", "classes"] },
  { id: "staffroster", label: "Staff ↔ class real roster", desc: "True staff schedule (not just classId) for ratio accuracy.", status: "partial", verts: ["attendance", "staff"], deps: ["staffrecords", "classes"] },
  { id: "liveratio", label: "Live attendance-driven ratio", desc: "Real-time ratio reflection from live check-ins.", status: "partial", verts: ["attendance"], deps: ["checkinout", "celengine", "staffroster"] },
  { id: "pinqr", label: "PIN / QR / parent-assisted check-in", desc: "Device/PIN/QR capture w/ location + staff (epic 15).", status: "missing", verts: ["attendance"], deps: ["checkinout"] },
  { id: "pickup", label: "Pickup / drop-off authorization", desc: "pickup_authorizations + handoff (child-safety).", status: "missing", verts: ["attendance"], deps: ["childrecords", "checkinout"] },
  { id: "offlineattendance", label: "Offline attendance & sync", desc: "Offline entry / SyncQueue / conflict resolution.", status: "missing", verts: ["attendance"], deps: ["mobile", "checkinout"] },
  { id: "attexport", label: "Attendance history & export", desc: "Records persist; exportable logs not built.", status: "partial", verts: ["attendance"], deps: ["checkinout"] },

  /* ---- Billing, subsidy & payments ---- */
  { id: "invoicegen", label: "Invoice / recurring engine", desc: "Invoice CRUD exists; recurring engine not built.", status: "partial", verts: ["billing"], deps: ["tuitionplans", "enrolllifecycle"] },
  { id: "billingcycles", label: "Billing / invoicing cycle config", desc: "Define invoicing cycles (setup structure).", status: "missing", verts: ["billing"], deps: ["invoicegen"] },
  { id: "ccfri", label: "CCFRI subsidy estimator", desc: "Mirrors BC gov estimator; lifecycle absent.", status: "partial", verts: ["billing"], deps: ["tuitionplans"] },
  { id: "subsidylifecycle", label: "Subsidy eligibility & reconciliation", desc: "Eligibility tracking + gov disbursement (epic 19).", status: "missing", verts: ["billing"], deps: ["ccfri", "invoicegen"] },
  { id: "paymentrec", label: "Payment recording", desc: "payments CRUD; /payments is 'Coming Soon'.", status: "partial", verts: ["billing"], deps: ["invoicegen"] },
  { id: "payretry", label: "Failed-payment retries / dunning", desc: "Retry + reconciliation logic.", status: "missing", verts: ["billing"], deps: ["paygateway", "paymentrec"] },
  { id: "receiptsfees", label: "Receipts & late fees", desc: "Receipts + late-fee assessment.", status: "missing", verts: ["billing"], deps: ["invoicegen", "paymentrec"] },
  { id: "parentpay", label: "Parent self-serve payment portal", desc: "Parent-facing pay surface.", status: "missing", verts: ["billing"], deps: ["paygateway", "invoicegen"] },

  /* ---- Staff scheduling & payroll ---- */
  { id: "credentials", label: "Credentials store + expiry", desc: "certifications exist; expiry/reminders missing (epic 20).", status: "partial", verts: ["staff"], deps: ["staffrecords", "notif"] },
  { id: "shifts", label: "Shift scheduling", desc: "shifts table + staff calendar; constraints limited.", status: "partial", verts: ["staff"], deps: ["staffrecords"] },
  { id: "availability", label: "Staff availability constraints", desc: "Recurring availability table.", status: "missing", verts: ["staff"], deps: ["shifts"] },
  { id: "timesheets", label: "Clock-in/out & timesheet auto-gen", desc: "actualTimes captured; auto-gen not built.", status: "partial", verts: ["staff"], deps: ["shifts"] },
  { id: "leaves", label: "Leave types (sick / vacation)", desc: "isSickLeave bool only; leaves table designed.", status: "partial", verts: ["staff"], deps: ["staffrecords"] },
  { id: "overtime", label: "Overtime calculation (BC)", desc: "Daily/weekly overtime thresholds.", status: "missing", verts: ["staff"], deps: ["timesheets"] },
  { id: "tsapproval", label: "Timesheet approval workflow", desc: "Manager approval pipeline.", status: "missing", verts: ["staff"], deps: ["timesheets"] },
  { id: "payrollexport", label: "Payroll export", desc: "CSV/JSON payroll export from approved data.", status: "missing", verts: ["staff"], deps: ["timesheets", "overtime", "leaves", "tsapproval"] },
  { id: "payrollcycles", label: "Payroll cycle config", desc: "Define payroll cycles (setup structure).", status: "missing", verts: ["staff"], deps: ["staffrecords"] },

  /* ---- Parent communication ---- */
  { id: "messaging", label: "1:1 messaging", desc: "conversations/messages; reused panel.", status: "done", verts: ["communication"], deps: ["childrecords", "staffrecords"] },
  { id: "groupmsg", label: "Group messaging & announcements", desc: "Group/announcement + moderation controls.", status: "partial", verts: ["communication"], deps: ["messaging"] },
  { id: "media", label: "Media uploads (photos / video)", desc: "Media sharing — blocked by missing file storage.", status: "missing", verts: ["communication"], deps: ["filestore", "messaging"] },
  { id: "dailyreports", label: "Daily reports", desc: "Structured daily-report feature (epic 14).", status: "missing", verts: ["communication"], deps: ["messaging"] },
  { id: "readreceipts", label: "Read receipts", desc: "Message read tracking.", status: "missing", verts: ["communication"], deps: ["messaging"] },
  { id: "notifprefs", label: "Notification preferences & templates", desc: "Per-user prefs + templates (epic 22).", status: "missing", verts: ["communication"], deps: ["notif"] },
  { id: "gallery", label: "Website gallery consent flow", desc: "Consent to publish chat media to site (epic 30).", status: "missing", verts: ["communication"], deps: ["media"] },

  /* ---- Child development & learning ---- */
  { id: "curriculum", label: "Curriculum framework", desc: "/curriculum is 'Coming Soon'.", status: "missing", verts: ["development"], deps: ["childrecords"] },
  { id: "observations", label: "Observations & milestones", desc: "Observation/Milestone entities (epic 17).", status: "missing", verts: ["development"], deps: ["curriculum"] },
  { id: "portfolios", label: "Portfolios & parent reports", desc: "Media-rich child portfolios + reports.", status: "missing", verts: ["development"], deps: ["observations", "filestore"] },

  /* ---- Health, incident & safety ---- */
  { id: "healthprofile", label: "Health profile", desc: "health_records: allergies/dietary/medications.", status: "partial", verts: ["health"], deps: ["childrecords"] },
  { id: "medlog", label: "Medication administration log", desc: "MedicationLog entity (epic 18).", status: "missing", verts: ["health"], deps: ["healthprofile"] },
  { id: "incidents", label: "Incident logging", desc: "Incident entity w/ timestamps + staff notes.", status: "missing", verts: ["health"], deps: ["childrecords"] },
  { id: "instantnotify", label: "Instant parent notification", desc: "Real-time incident alerts to parents.", status: "missing", verts: ["health"], deps: ["notif", "incidents"] },
  { id: "safetylogs", label: "Compliance-ready safety logs", desc: "Exportable, audit-ready incident logs.", status: "missing", verts: ["health"], deps: ["incidents", "medlog"] },

  /* ---- Nutrition & meal service ---- */
  { id: "dietary", label: "Dietary restrictions per child", desc: "dietaryRestrictions[] on healthRecords.", status: "partial", verts: ["nutrition"], deps: ["healthprofile"] },
  { id: "mealplans", label: "Meal plans & menus", desc: "/nutrition-plans 'Coming Soon'; no entities.", status: "missing", verts: ["nutrition"], deps: ["childrecords"] },
  { id: "mealsched", label: "Allergy/weekday meal scheduling", desc: "Schedule meals by allergy/preference/day (epic 13).", status: "missing", verts: ["nutrition"], deps: ["mealplans", "dietary"] },
  { id: "consumption", label: "Consumption logs", desc: "Log what each child consumed.", status: "missing", verts: ["nutrition"], deps: ["mealsched"] },
  { id: "kitchenview", label: "Kitchen-facing views", desc: "Daily prep view for kitchen staff.", status: "missing", verts: ["nutrition"], deps: ["mealsched"] },

  /* ---- Inventory & resource tracking ---- */
  { id: "inventoryitems", label: "Inventory items & stock", desc: "/inventory 'Coming Soon'; 0% of epic 12.", status: "missing", verts: ["inventory"], deps: ["tenancy"] },
  { id: "lowstock", label: "Low-stock alerts", desc: "Threshold alerts on stock levels.", status: "missing", verts: ["inventory"], deps: ["inventoryitems", "notif"] },
  { id: "usagelink", label: "Usage linked to rooms / children", desc: "Attribute consumption to rooms/children.", status: "missing", verts: ["inventory"], deps: ["inventoryitems", "childrecords", "rooms"] },

  /* ---- Business intelligence & reporting ---- */
  { id: "datadumps", label: "Weekly data dumps / snapshots", desc: "data_dumps table + weekly cron + manual trigger.", status: "done", verts: ["bi"], deps: ["tenancy"] },
  { id: "opsdash", label: "Operational dashboard", desc: "Stats, charts, alerts, activity feed.", status: "done", verts: ["bi"], deps: ["enrolllifecycle", "checkinout"] },
  { id: "bizdash", label: "Business dashboard", desc: "Revenue / occupancy; replaces legacy /reports.", status: "done", verts: ["bi"], deps: ["invoicegen", "enrolllifecycle"] },
  { id: "customreports", label: "Custom reports & exports", desc: "/reporting is 'Coming Soon'.", status: "missing", verts: ["bi"], deps: ["datadumps"] },
  { id: "forecasting", label: "Forecasting", desc: "Beyond basic dashboards.", status: "missing", verts: ["bi"], deps: ["datadumps", "bizdash"] },
  { id: "complianceanalytics", label: "Compliance analytics", desc: "Trend analytics over compliance results.", status: "partial", verts: ["bi"], deps: ["complianceui", "datadumps"] },

  /* ---- Childcare business onboarding & setup ---- */
  { id: "registration", label: "Centre registration (tenant)", desc: "/register creates an isolated tenant.", status: "done", verts: ["business-setup"], deps: ["tenancy"] },
  { id: "centreprofile", label: "Centre profile & licence", desc: "School Settings: licence, province, age groups.", status: "done", verts: ["business-setup"], deps: ["registration"] },
  { id: "servicetypeselect", label: "Select offered service-types", desc: "tenant_service_types + per-type capacity; UX maturing.", status: "partial", verts: ["business-setup"], deps: ["servicetypes", "centreprofile"] },
  { id: "autorules", label: "Auto-applied jurisdiction rules", desc: "Rules auto-resolve for the centre with no config.", status: "done", verts: ["business-setup"], deps: ["celengine", "servicetypeselect"] },
  { id: "staffsetup", label: "Staff setup, roles & credentials", desc: "Staff+roles done; credential tracking missing.", status: "partial", verts: ["business-setup"], deps: ["staffrecords", "credentials"] },
  { id: "wizard", label: "Guided onboarding wizard", desc: "Orchestrates setup steps, sequences dependencies.", status: "missing", verts: ["business-setup"], deps: ["registration", "servicetypeselect", "programs", "classes", "tuitionplans"] },
  { id: "publicdata", label: "Public-source data retrieval", desc: "Auto-fill profile/licence/types from public sources.", status: "missing", verts: ["business-setup"], deps: ["wizard"] },
  { id: "bulkimport", label: "Bulk data import (migration)", desc: "Migrate existing children/staff/rooms/programs/plans.", status: "missing", verts: ["business-setup"], deps: ["wizard", "childrecords", "staffrecords", "programs", "classes"] },
  { id: "exportmigrate", label: "Data export / migration tooling", desc: "data_dumps export; no structured 2-way import.", status: "partial", verts: ["business-setup"], deps: ["datadumps"] },
  { id: "aiconfig", label: "AI-assisted config suggestions", desc: "Propose programs/classes/plans from profile.", status: "missing", verts: ["business-setup"], deps: ["aiassist", "wizard"] },
  { id: "golive", label: "Onboarding tracker / go-live", desc: "Setup-completeness tracking + readiness gating.", status: "missing", verts: ["business-setup"], deps: ["wizard"] },

  /* ---- Rustybu SaaS operations & admin console ---- */
  { id: "adminconsole", label: "Internal admin console", desc: "Provider-facing back-office surface.", status: "missing", verts: ["saas-ops"], deps: ["auth"] },
  { id: "tenantdir", label: "Customer (tenant) directory", desc: "Cross-tenant account view & management.", status: "missing", verts: ["saas-ops"], deps: ["adminconsole"] },
  { id: "subplans", label: "Subscription plans & pricing", desc: "subscriptionPlan field only; no catalogue.", status: "partial", verts: ["saas-ops"], deps: ["adminconsole"] },
  { id: "sublifecycle", label: "Subscription lifecycle", desc: "Trial/upgrade/downgrade/cancel/dunning state machine.", status: "missing", verts: ["saas-ops"], deps: ["subplans"] },
  { id: "subbilling", label: "Bill customers for subscription", desc: "Provider-side invoicing of customers.", status: "missing", verts: ["saas-ops"], deps: ["subplans", "paygateway"] },
  { id: "subpaycollect", label: "Collect subscription payments", desc: "Recurring revenue collection (Stripe Billing).", status: "missing", verts: ["saas-ops"], deps: ["subbilling", "paygateway"] },
  { id: "entitlements", label: "Plan-based feature flags", desc: "Entitlement gating tied to plan.", status: "missing", verts: ["saas-ops"], deps: ["subplans"] },
  { id: "metering", label: "Usage metering & plan limits", desc: "Meter seats/children/centres + enforce limits.", status: "missing", verts: ["saas-ops"], deps: ["tenantdir"] },
  { id: "opsmonitor", label: "Cross-tenant monitoring", desc: "Provider observability over customer ops/errors.", status: "missing", verts: ["saas-ops"], deps: ["adminconsole", "eventslog"] },
  { id: "troubleshoot", label: "Troubleshooting / impersonation", desc: "Safe scoped 'view-as-customer' tooling.", status: "missing", verts: ["saas-ops"], deps: ["adminconsole", "rbac"] },
  { id: "provisioning", label: "Tenant provisioning / offboarding", desc: "/register provisions; no offboarding lifecycle.", status: "partial", verts: ["saas-ops"], deps: ["tenantdir"] },
  { id: "superadmin", label: "Super-admin RBAC for staff", desc: "Platform-superadmin tier above centre roles.", status: "missing", verts: ["saas-ops"], deps: ["rbac"] },
  { id: "revanalytics", label: "Platform revenue analytics", desc: "MRR / churn / cohorts for the SaaS business.", status: "missing", verts: ["saas-ops"], deps: ["subbilling"] },

  /* ---- Customer support & success ---- */
  { id: "kb", label: "Help center / knowledge base", desc: "Searchable KB, guides, policy/how-to content.", status: "missing", verts: ["customer-support"], deps: ["tenancy"] },
  { id: "supportagent", label: "AI support agent (FAQs/policy)", desc: "Conversational support AI (epic 24), not data-tools.", status: "designed", verts: ["customer-support"], deps: ["kb", "aiassist"] },
  { id: "supportchannel", label: "Customer → Rustybu support channel", desc: "In-app channel from customer to Rustybu support.", status: "missing", verts: ["customer-support"], deps: ["adminconsole"] },
  { id: "ticketing", label: "Support ticketing & case mgmt", desc: "Ticket queue, SLAs, case tracking.", status: "missing", verts: ["customer-support"], deps: ["supportchannel"] },
  { id: "escalation", label: "Human escalation & bug reporting", desc: "Escalate from AI/self-serve; file bugs w/ context.", status: "missing", verts: ["customer-support"], deps: ["ticketing"] },
  { id: "statuspage", label: "Status page / incident comms", desc: "Uptime/status surface + incident broadcast.", status: "missing", verts: ["customer-support"], deps: ["opsmonitor"] },
  { id: "success", label: "Customer success / onboarding assist", desc: "Human CS touchpoints (complements self-serve wizard).", status: "missing", verts: ["customer-support"], deps: ["tenantdir"] },
  { id: "feedback", label: "Feedback & feature-request capture", desc: "Structured customer feedback channel.", status: "missing", verts: ["customer-support"], deps: ["supportchannel"] },
  { id: "supportanalytics", label: "Support logging & analytics", desc: "QueryLog: questions, deflection, satisfaction.", status: "missing", verts: ["customer-support"], deps: ["ticketing", "supportagent"] },
];

/* ---- graph derivations ---- */

const NODE_BY_ID: Record<string, GNode> = Object.fromEntries(NODES.map((n) => [n.id, n]));
const JNAME: Record<string, string> = Object.fromEntries(JOURNEYS.map((j) => [j.id, j.name]));

/* reverse adjacency: who depends on me */
const DEPENDENTS: Record<string, string[]> = (() => {
  const m: Record<string, string[]> = {};
  NODES.forEach((n) => (m[n.id] = []));
  NODES.forEach((n) => n.deps.forEach((d) => m[d]?.push(n.id)));
  return m;
})();

/* dangling references — should be empty; surfaced as a model-integrity check */
const DANGLING: string[] = NODES.flatMap((n) => n.deps.filter((d) => !NODE_BY_ID[d]).map((d) => `${n.id} → ${d}`));

const isDone = (id: string) => NODE_BY_ID[id]?.status === "done";

function isReady(n: GNode): boolean {
  return n.status !== "done" && n.deps.every((d) => isDone(d));
}

/* transitive downstream count — how many nodes ultimately depend on me */
const DOWNSTREAM: Record<string, number> = (() => {
  const memo: Record<string, number> = {};
  const visitCount = (id: string): number => {
    if (memo[id] != null) return memo[id];
    memo[id] = 0; // guard against cycles
    const seen = new Set<string>();
    const stack = [...DEPENDENTS[id]];
    while (stack.length) {
      const cur = stack.pop()!;
      if (seen.has(cur)) continue;
      seen.add(cur);
      DEPENDENTS[cur].forEach((x) => stack.push(x));
    }
    memo[id] = seen.size;
    return memo[id];
  };
  NODES.forEach((n) => visitCount(n.id));
  return memo;
})();

/* full necessary-condition closure for a vertical (seeds + all transitive deps) */
function closureFor(vert: string): Set<string> {
  const visited = new Set<string>();
  const stack = NODES.filter((n) => n.verts.includes(vert)).map((n) => n.id);
  while (stack.length) {
    const id = stack.pop()!;
    if (visited.has(id)) continue;
    visited.add(id);
    NODE_BY_ID[id]?.deps.forEach((d) => stack.push(d));
  }
  return visited;
}

const NODE_W = 200;
const NODE_H = 60;

const GRAPH_LAYOUT = computeDAGLayout({
  nodes: NODES.map((n) => ({ id: n.id })),
  edges: NODES.flatMap((n) => n.deps.filter((d) => NODE_BY_ID[d]).map((d) => ({ from: d, to: n.id }))),
  direction: "horizontal",
  nodeWidth: NODE_W,
  nodeHeight: NODE_H,
  rankGap: 90,
  nodeGap: 16,
  padding: 28,
});

const POS: Record<string, { x: number; y: number; rank: number }> = Object.fromEntries(
  GRAPH_LAYOUT.nodes.map((n) => [n.id, { x: n.x, y: n.y, rank: n.rank }]),
);

const READY_NODES = NODES.filter(isReady).sort((a, b) => DOWNSTREAM[b.id] - DOWNSTREAM[a.id]);
const DONE_COUNT = NODES.filter((n) => n.status === "done").length;

/* Transient (non-persisted) pan/zoom bookkeeping for the graph viewport. */
let __gViewport: HTMLDivElement | null = null;
let __gContent: HTMLDivElement | null = null;
let __gWheel: ((ev: WheelEvent) => void) | null = null;
let __gDrag: { sx: number; sy: number; bx: number; by: number } | null = null;

function GraphView() {
  const t = useHostTheme();
  const [vSel, setVSel] = useCanvasState<string>("graphVertical", "all");
  const [focusNode, setFocusNode] = useCanvasState<string>("graphFocus", "");
  /* ordered list of journey ids = custom market-demand priority (P1 first). */
  const [priorities, setPriorities] = useCanvasState<string[]>("journeyPriorities", []);

  const addPriority = (id: string) => {
    if (id && !priorities.includes(id)) setPriorities([...priorities, id]);
  };
  const removePriority = (id: string) => setPriorities(priorities.filter((p) => p !== id));
  const movePriority = (id: string, dir: -1 | 1) => {
    const i = priorities.indexOf(id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= priorities.length) return;
    const next = [...priorities];
    [next[i], next[j]] = [next[j], next[i]];
    setPriorities(next);
  };
  /*
   * Priority inheritance: prioritising a journey lifts EVERY work-item in its
   * necessary-condition closure — its direct deliverables and, recursively,
   * everything they depend on. A node inherits the best (highest) priority of
   * any prioritised journey whose closure contains it.
   */
  const prioClosures = priorities.map((jid) => ({ jid, set: closureFor(jid) }));
  const hasPriorities = prioClosures.length > 0;

  const liftedOf = (id: string): { rank: number; jid: string } => {
    for (let i = 0; i < prioClosures.length; i++) {
      if (prioClosures[i].set.has(id)) return { rank: i, jid: prioClosures[i].jid };
    }
    return { rank: Infinity, jid: "" };
  };

  /* Path from a work-item up its dependents to the journey it was lifted by: A → B → … → Journey. */
  const pathToJourney = (startId: string, jid: string): string => {
    if (!jid) return "Independent ready-to-start item (not tied to a prioritised journey)";
    const set = prioClosures.find((p) => p.jid === jid)?.set ?? new Set<string>();
    if (NODE_BY_ID[startId].verts.includes(jid)) return `${NODE_BY_ID[startId].label} → ${JNAME[jid]}`;
    const prev: Record<string, string> = {};
    const seen = new Set<string>([startId]);
    const q = [startId];
    let target = "";
    while (q.length) {
      const cur = q.shift()!;
      if (cur !== startId && NODE_BY_ID[cur].verts.includes(jid)) {
        target = cur;
        break;
      }
      for (const dep of DEPENDENTS[cur]) {
        if (!set.has(dep) || seen.has(dep)) continue;
        seen.add(dep);
        prev[dep] = cur;
        q.push(dep);
      }
    }
    if (!target) return `${NODE_BY_ID[startId].label} → ${JNAME[jid]}`;
    const chain: string[] = [];
    let c: string | undefined = target;
    while (c !== undefined) {
      chain.unshift(c);
      if (c === startId) break;
      c = prev[c];
    }
    return chain.map((id) => NODE_BY_ID[id].label).join(" → ") + " → " + JNAME[jid];
  };

  const closure = vSel === "all" ? null : closureFor(vSel);
  const focus = focusNode && NODE_BY_ID[focusNode] ? focusNode : "";
  const focusSet = focus
    ? new Set<string>([focus, ...NODE_BY_ID[focus].deps, ...DEPENDENTS[focus]])
    : null;
  const focused = focus ? NODE_BY_ID[focus] : null;

  const isLit = (id: string): boolean => {
    if (focusSet) return focusSet.has(id);
    if (closure) return closure.has(id);
    return true;
  };

  const edgeState = (from: string, to: string): "hi" | "on" | "dim" => {
    if (focusSet) return from === focus || to === focus ? "hi" : "dim";
    if (closure) return closure.has(from) && closure.has(to) ? "on" : "dim";
    return "on";
  };

  /* per-vertical readiness (point 3): necessary-condition closure completion */
  const vertProgress = JOURNEYS.map((j) => {
    const c = closureFor(j.id);
    const ids = [...c];
    const done = ids.filter((id) => isDone(id)).length;
    return { id: j.id, name: j.name, total: ids.length, done, remaining: ids.length - done };
  }).sort((a, b) => a.done / a.total - b.done / b.total);

  /* No priorities → today's behaviour: ready work-items ranked by leverage. */
  const readyByLeverage = NODES.filter(isReady).sort((a, b) => DOWNSTREAM[b.id] - DOWNSTREAM[a.id]);

  /*
   * Priorities set → a delivery execution order: a priority-weighted topological
   * sort of every NOT-done work-item in the prioritised journeys' closures
   * (prerequisites scheduled before the items that need them), so following the
   * list top-to-bottom delivers the prioritised journeys as fast as possible.
   * Other currently-ready items are appended at the end by leverage.
   */
  const buildExecutionOrder = (): GNode[] => {
    const lifted = NODES.filter((n) => n.status !== "done" && liftedOf(n.id).rank !== Infinity);
    const inScope = new Set(lifted.map((n) => n.id));
    const indeg: Record<string, number> = {};
    const rankOf: Record<string, number> = {};
    lifted.forEach((n) => {
      indeg[n.id] = n.deps.filter((d) => inScope.has(d)).length;
      rankOf[n.id] = liftedOf(n.id).rank;
    });
    const pick = (ids: string[]): string => {
      let best = ids[0];
      for (const id of ids) {
        if (rankOf[id] !== rankOf[best]) {
          if (rankOf[id] < rankOf[best]) best = id;
          continue;
        }
        if (DOWNSTREAM[id] !== DOWNSTREAM[best]) {
          if (DOWNSTREAM[id] > DOWNSTREAM[best]) best = id;
          continue;
        }
        if (id < best) best = id;
      }
      return best;
    };
    const avail = lifted.filter((n) => indeg[n.id] === 0).map((n) => n.id);
    const order: GNode[] = [];
    while (avail.length) {
      const id = pick(avail);
      avail.splice(avail.indexOf(id), 1);
      order.push(NODE_BY_ID[id]);
      DEPENDENTS[id].forEach((dep) => {
        if (!inScope.has(dep)) return;
        indeg[dep] -= 1;
        if (indeg[dep] === 0) avail.push(dep);
      });
    }
    const extra = readyByLeverage.filter((n) => liftedOf(n.id).rank === Infinity);
    return [...order, ...extra];
  };

  const executionOrder = hasPriorities ? buildExecutionOrder() : [];
  const liftedCount = NODES.filter((n) => n.status !== "done" && liftedOf(n.id).rank !== Infinity).length;

  /* ---- pan + zoom for the graph viewport ---- */
  const [vt, setVt] = useCanvasState<{ x: number; y: number; z: number }>("graphView3d", { x: 0, y: 0, z: 1 });
  const Z_MIN = 0.3;
  const Z_MAX = 2.5;
  const clampZ = (z: number) => Math.min(Z_MAX, Math.max(Z_MIN, z));
  const zoomAt = (cx: number, cy: number, factor: number) => {
    setVt((prev) => {
      const z = clampZ(prev.z * factor);
      if (z === prev.z) return prev;
      return { x: cx - ((cx - prev.x) / prev.z) * z, y: cy - ((cy - prev.y) / prev.z) * z, z };
    });
  };
  const zoomCenter = (factor: number) => {
    const el = __gViewport;
    zoomAt(el ? el.clientWidth / 2 : 400, el ? el.clientHeight / 2 : 360, factor);
  };
  const resetView = () => setVt({ x: 0, y: 0, z: 1 });

  /* re-bind a non-passive wheel listener each render so it captures the current transform */
  const attachViewport = (el: HTMLDivElement | null) => {
    if (__gViewport && __gWheel) __gViewport.removeEventListener("wheel", __gWheel);
    __gViewport = el;
    if (el) {
      __gWheel = (ev: WheelEvent) => {
        if (!ev.ctrlKey) return;
        ev.preventDefault();
        const rect = el.getBoundingClientRect();
        zoomAt(ev.clientX - rect.left, ev.clientY - rect.top, ev.deltaY < 0 ? 1.12 : 1 / 1.12);
      };
      el.addEventListener("wheel", __gWheel, { passive: false });
    }
  };
  const onContentMouseDown = (e: { target: EventTarget; currentTarget: EventTarget; clientX: number; clientY: number; preventDefault: () => void }) => {
    if (e.target !== e.currentTarget) return; // only pan from empty background, not nodes
    e.preventDefault();
    __gDrag = { sx: e.clientX, sy: e.clientY, bx: vt.x, by: vt.y };
    if (__gViewport) __gViewport.style.cursor = "grabbing";
  };
  const onViewportMouseMove = (e: { clientX: number; clientY: number }) => {
    if (!__gDrag || !__gContent) return;
    const nx = __gDrag.bx + (e.clientX - __gDrag.sx);
    const ny = __gDrag.by + (e.clientY - __gDrag.sy);
    __gContent.style.transform = `translate(${nx}px, ${ny}px) scale(${vt.z})`;
  };
  const endDrag = (e: { clientX: number; clientY: number }) => {
    if (!__gDrag) return;
    const nx = __gDrag.bx + (e.clientX - __gDrag.sx);
    const ny = __gDrag.by + (e.clientY - __gDrag.sy);
    __gDrag = null;
    if (__gViewport) __gViewport.style.cursor = "grab";
    setVt({ x: nx, y: ny, z: vt.z });
  };

  return (
    <Stack gap={20} style={{ padding: 24, maxWidth: 1320, margin: "0 auto" }}>
      <Stack gap={6}>
        <H1>Rustybu — Necessary Conditions Network</H1>
        <Text tone="secondary">
          The same vertical journeys, re-expressed as a dependency graph of implementable work-items. An arrow{" "}
          <Text as="span" weight="semibold">A → B</Text> means "A is a necessary condition for B" — so every node's
          in-arrows are its complete prerequisite set, and a node is only truly unblocked once all of them are{" "}
          <Text as="span" weight="semibold">Implemented</Text>. Shared subsystems appear once, so leverage and
          implementation order are visible at a glance. Read left → right as build order.
        </Text>
      </Stack>

      <Grid columns={4} gap={16}>
        <Stat value={String(NODES.length)} label="Work-items (nodes)" />
        <Stat value={`${DONE_COUNT}/${NODES.length}`} label="Implemented" tone="success" />
        <Stat value={String(READY_NODES.length)} label="Ready to start now" tone="info" />
        <Stat value={String(GRAPH_LAYOUT.edges.length)} label="Dependency edges" />
      </Grid>

      {/* Controls + legend */}
      <Row gap={16} wrap align="center" style={{ padding: "10px 14px", border: `1px solid ${t.stroke.tertiary}`, borderRadius: 8 }}>
        <Row gap={8} align="center">
          <Text size="small" weight="semibold" tone="secondary">
            Highlight journey
          </Text>
          <Select
            value={vSel}
            onChange={(v) => setVSel(v)}
            options={[{ value: "all", label: "All journeys" }, ...JOURNEYS.map((j) => ({ value: j.id, label: j.name }))]}
          />
        </Row>
        <Spacer />
        <Row gap={14} wrap align="center">
          <LegendDot status="done" />
          <LegendDot status="partial" />
          <LegendDot status="designed" />
          <LegendDot status="missing" />
          <Row gap={6} align="center">
            <div style={{ width: 12, height: 12, borderRadius: 4, border: `2px solid ${t.accent.primary}`, flex: "0 0 auto" }} />
            <Text size="small" tone="secondary">
              Ready to start
            </Text>
          </Row>
        </Row>
      </Row>

      {(focused || vSel !== "all") && (
        <Row gap={10} wrap align="center">
          {focused && (
            <Text size="small" tone="secondary">
              Focused on <Text as="span" weight="semibold">{focused.label}</Text> — showing its prerequisites and dependents.
            </Text>
          )}
          {!focused && vSel !== "all" && (
            <Text size="small" tone="secondary">
              Highlighting the necessary-condition closure for <Text as="span" weight="semibold">{JNAME[vSel]}</Text>.
            </Text>
          )}
          {focused && (
            <Button variant="ghost" onClick={() => setFocusNode("")}>
              Clear focus
            </Button>
          )}
        </Row>
      )}

      {/* The graph — pan by dragging empty space, zoom with Ctrl + mouse-wheel */}
      <div
        ref={attachViewport}
        onMouseMove={onViewportMouseMove}
        onMouseUp={endDrag}
        onMouseLeave={endDrag}
        style={{
          position: "relative",
          border: `1px solid ${t.stroke.secondary}`,
          borderRadius: 10,
          overflow: "hidden",
          height: 720,
          background: t.bg.editor,
          cursor: "grab",
          userSelect: "none",
        }}
      >
        {/* zoom toolbar (fixed overlay, not affected by pan/zoom) */}
        <Row
          gap={4}
          align="center"
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            zIndex: 10,
            padding: 4,
            borderRadius: 8,
            border: `1px solid ${t.stroke.tertiary}`,
            background: t.bg.elevated,
          }}
        >
          <IconButton title="Zoom out" size="sm" onClick={() => zoomCenter(1 / 1.2)}>
            −
          </IconButton>
          <Text size="small" tone="secondary" style={{ minWidth: 42, textAlign: "center" }}>
            {Math.round(vt.z * 100)}%
          </Text>
          <IconButton title="Zoom in" size="sm" onClick={() => zoomCenter(1.2)}>
            +
          </IconButton>
          <Button variant="ghost" onClick={resetView}>
            Reset
          </Button>
        </Row>

        <div
          ref={(el) => {
            __gContent = el;
          }}
          onMouseDown={onContentMouseDown}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: GRAPH_LAYOUT.width,
            height: GRAPH_LAYOUT.height,
            transform: `translate(${vt.x}px, ${vt.y}px) scale(${vt.z})`,
            transformOrigin: "0 0",
          }}
        >
          {/* rank bands (build-order layers) */}
          <svg
            width={GRAPH_LAYOUT.width}
            height={GRAPH_LAYOUT.height}
            style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
          >
            <defs>
              <marker id="ncn-arrow" markerWidth="9" markerHeight="9" refX="7.5" refY="3" orient="auto" markerUnits="userSpaceOnUse">
                <path d="M0,0 L7,3 L0,6 Z" fill={t.stroke.secondary} />
              </marker>
              <marker id="ncn-arrow-hi" markerWidth="11" markerHeight="11" refX="8.5" refY="3.5" orient="auto" markerUnits="userSpaceOnUse">
                <path d="M0,0 L8,3.5 L0,7 Z" fill={t.accent.primary} />
              </marker>
            </defs>
            {GRAPH_LAYOUT.ranks.map((r, i) => (
              <rect
                key={r.rank}
                x={r.x}
                y={0}
                width={r.width}
                height={GRAPH_LAYOUT.height}
                fill={i % 2 === 0 ? t.fill.quaternary : "transparent"}
                opacity={0.5}
              />
            ))}
            {/* edges */}
            {GRAPH_LAYOUT.edges.map((e, i) => {
              const st = edgeState(e.from, e.to);
              const dx = Math.max(34, (e.targetX - e.sourceX) / 2);
              const d = `M ${e.sourceX} ${e.sourceY} C ${e.sourceX + dx} ${e.sourceY} ${e.targetX - dx} ${e.targetY} ${e.targetX} ${e.targetY}`;
              return (
                <path
                  key={i}
                  d={d}
                  fill="none"
                  stroke={st === "hi" ? t.accent.primary : t.stroke.secondary}
                  strokeWidth={st === "hi" ? 2 : 1}
                  strokeDasharray={e.isBackEdge ? "4 4" : undefined}
                  opacity={st === "hi" ? 0.95 : st === "on" ? (closure ? 0.6 : 0.28) : 0.06}
                  markerEnd={st === "hi" ? "url(#ncn-arrow-hi)" : "url(#ncn-arrow)"}
                />
              );
            })}
          </svg>

          {/* nodes */}
          {NODES.map((n) => {
            const p = POS[n.id];
            if (!p) return null;
            const lit = isLit(n.id);
            const ready = isReady(n);
            const meta = STATUS[n.status];
            const isFocus = n.id === focus;
            const down = DOWNSTREAM[n.id];
            const tip = [
              n.label,
              `${meta.label} · unlocks ${down} downstream · ${DEPENDENTS[n.id].length} direct dependents`,
              n.desc,
              `Needs: ${n.deps.length ? n.deps.map((d) => NODE_BY_ID[d]?.label).join(", ") : "— (foundational)"}`,
              `Serves: ${n.verts.map((v) => JNAME[v]).join(", ")}`,
            ].join("\n");
            return (
              <div
                key={n.id}
                title={tip}
                onClick={() => setFocusNode(isFocus ? "" : n.id)}
                style={{
                  position: "absolute",
                  left: p.x,
                  top: p.y,
                  width: NODE_W,
                  height: NODE_H,
                  boxSizing: "border-box",
                  display: "flex",
                  cursor: "pointer",
                  opacity: lit ? 1 : 0.16,
                  border: `${ready || isFocus ? 2 : 1}px solid ${ready || isFocus ? t.accent.primary : t.stroke.secondary}`,
                  borderRadius: 8,
                  background: t.bg.elevated,
                  overflow: "hidden",
                }}
              >
                <div style={{ width: 5, background: meta.color, flex: "0 0 auto" }} />
                <div style={{ flex: 1, minWidth: 0, padding: "6px 8px", display: "flex", flexDirection: "column", justifyContent: "center", gap: 2 }}>
                  <Text size="small" weight="semibold" style={{ lineHeight: 1.15, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                    {n.label}
                  </Text>
                  <Row gap={6} align="center">
                    <Text size="small" tone="quaternary" style={{ fontSize: 10 }}>
                      {meta.label}
                    </Text>
                    {down > 0 && (
                      <Text size="small" tone="tertiary" style={{ fontSize: 10 }}>
                        · unlocks {down}
                      </Text>
                    )}
                    {ready && (
                      <Text size="small" weight="semibold" style={{ fontSize: 10, color: t.accent.primary }}>
                        · ready
                      </Text>
                    )}
                  </Row>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Text size="small" tone="quaternary">
        Tip: drag empty space to pan, Ctrl + mouse-wheel to zoom (or use the toolbar), and Reset to recenter. Hover a
        node for its full prerequisites/dependents; click any node to focus its neighbourhood. Use the journey selector
        to light up everything one vertical delivery needs.
        {DANGLING.length > 0 ? ` · ⚠ ${DANGLING.length} dangling dependency reference(s).` : " · Model integrity: all dependencies resolve."}
      </Text>

      {/* Focused-node detail */}
      {focused && (
        <Stack gap={10} style={{ border: `1px solid ${t.accent.primary}`, borderRadius: 10, padding: 16 }}>
          <Row gap={10} align="center" wrap>
            <Swatch color={STATUS[focused.status].bar} />
            <Text weight="bold" style={{ fontSize: 17, flex: 1, minWidth: 200 }}>
              {focused.label}
            </Text>
            <Pill size="sm" tone={STATUS[focused.status].tone} active>
              {STATUS[focused.status].label}
            </Pill>
            <Pill size="sm" tone={isReady(focused) ? "success" : "neutral"}>
              {isReady(focused) ? "Ready to start" : focused.status === "done" ? "Done" : "Blocked"}
            </Pill>
          </Row>
          <Text tone="secondary">{focused.desc}</Text>
          <Grid columns={2} gap={16}>
            <Stack gap={6}>
              <Text size="small" weight="semibold" tone="tertiary">
                Necessary conditions (must be done first)
              </Text>
              {focused.deps.length === 0 ? (
                <Text size="small" tone="quaternary">
                  None — foundational work-item.
                </Text>
              ) : (
                <Row gap={6} wrap>
                  {focused.deps.map((d) => (
                    <Pill key={d} size="sm" tone={isDone(d) ? "success" : "deleted"} onClick={() => setFocusNode(d)}>
                      {NODE_BY_ID[d]?.label}
                    </Pill>
                  ))}
                </Row>
              )}
            </Stack>
            <Stack gap={6}>
              <Text size="small" weight="semibold" tone="tertiary">
                Unblocks directly ({DEPENDENTS[focused.id].length})
              </Text>
              {DEPENDENTS[focused.id].length === 0 ? (
                <Text size="small" tone="quaternary">
                  Nothing depends on this — it's a delivery leaf.
                </Text>
              ) : (
                <Row gap={6} wrap>
                  {DEPENDENTS[focused.id].map((d) => (
                    <Pill key={d} size="sm" tone="neutral" onClick={() => setFocusNode(d)}>
                      {NODE_BY_ID[d]?.label}
                    </Pill>
                  ))}
                </Row>
              )}
            </Stack>
          </Grid>
          <Row gap={6} wrap align="center">
            <Text size="small" tone="tertiary" weight="semibold">
              Serves:
            </Text>
            {focused.verts.map((v) => (
              <Pill key={v} size="sm" tone="info" onClick={() => setVSel(v)}>
                {JNAME[v]}
              </Pill>
            ))}
          </Row>
        </Stack>
      )}

      <Divider />

      {/* Custom journey priorities (market demand) */}
      <Stack gap={10} style={{ border: `1px solid ${t.stroke.secondary}`, borderRadius: 10, padding: 16 }}>
        <Row gap={10} align="center" wrap>
          <Stack gap={2} style={{ flex: 1, minWidth: 240 }}>
            <Text weight="bold" style={{ fontSize: 16 }}>
              Custom journey priorities (market demand)
            </Text>
            <Text size="small" tone="tertiary">
              Rank only the journeys that matter most to customers. Each prioritised journey lifts its entire dependency
              chain — its deliverables and everything they transitively need — and the list below turns into a build
              execution order that delivers those journeys fastest. Unlisted journeys stay at the same baseline.
            </Text>
          </Stack>
          {priorities.length > 0 && (
            <Button variant="ghost" onClick={() => setPriorities([])}>
              Clear all
            </Button>
          )}
        </Row>

        {priorities.length === 0 ? (
          <Text size="small" tone="quaternary">
            No custom priorities set — every journey is weighted equally, so the table below ranks purely by leverage.
          </Text>
        ) : (
          <Stack gap={6}>
            {priorities.map((id, i) => (
              <Row key={id} gap={8} align="center" style={{ padding: "6px 10px", border: `1px solid ${t.stroke.tertiary}`, borderRadius: 8 }}>
                <Pill size="sm" tone="warning" active>
                  P{i + 1}
                </Pill>
                <Text weight="semibold" style={{ flex: 1, minWidth: 0 }}>
                  {JNAME[id]}
                </Text>
                <IconButton title="Move up" size="sm" disabled={i === 0} onClick={() => movePriority(id, -1)}>
                  ▲
                </IconButton>
                <IconButton title="Move down" size="sm" disabled={i === priorities.length - 1} onClick={() => movePriority(id, 1)}>
                  ▼
                </IconButton>
                <IconButton title="Remove from priorities" size="sm" onClick={() => removePriority(id)}>
                  ✕
                </IconButton>
              </Row>
            ))}
          </Stack>
        )}

        {priorities.length < JOURNEYS.length && (
          <Row gap={8} align="center">
            <Text size="small" tone="secondary" weight="semibold">
              Add journey
            </Text>
            <Select
              value=""
              onChange={addPriority}
              placeholder="Pick a journey to prioritize…"
              options={JOURNEYS.filter((j) => !priorities.includes(j.id)).map((j) => ({ value: j.id, label: j.name }))}
            />
          </Row>
        )}
      </Stack>

      {!hasPriorities ? (
        /* No priorities → ready-to-start, ranked purely by leverage (point 1 + 2). */
        <Stack gap={8}>
          <H2>Ready to start now — ranked by leverage</H2>
          <Text size="small" tone="tertiary">
            Work-items whose every necessary condition is already <Text as="span" weight="semibold">Implemented</Text>,
            so work can begin immediately. Ranked by how many other work-items they ultimately unlock (transitive
            downstream count). Add a journey above to turn this into a delivery execution order. Click a row to focus it
            in the graph.
          </Text>
          <Table
            headers={["Work-item", "Current status", "Unlocks (downstream)", "Direct dependents", "Serves"]}
            columnAlign={["left", "left", "right", "right", "left"]}
            rowTone={readyByLeverage.map((n) => rowToneFor(STATUS[n.status].weight))}
            rows={readyByLeverage.map((n) => [
              <Pill tone={buildTone(STATUS[n.status].weight)} active={n.id === focus} onClick={() => setFocusNode(n.id)}>
                {n.label}
              </Pill>,
              <Text size="small" tone="secondary">
                {STATUS[n.status].label}
              </Text>,
              <Text weight="semibold">{String(DOWNSTREAM[n.id])}</Text>,
              String(DEPENDENTS[n.id].length),
              <Text size="small" tone="tertiary">
                {n.verts.map((v) => JNAME[v]).join(", ")}
              </Text>,
            ])}
          />
        </Stack>
      ) : (
        /* Priorities set → full delivery execution order (incl. currently-blocked items). */
        <Stack gap={8}>
          <H2>Implementation order — to deliver your prioritised journeys fastest</H2>
          <Text size="small" tone="tertiary">
            Every not-yet-built work-item your prioritised journeys depend on ({liftedCount} in total), in an order where
            each item's prerequisites come before it. Build top-to-bottom and each journey is delivered as early as its
            priority allows. The <Text as="span" weight="semibold">Priority</Text> column shows which prioritised journey
            (and tier) lifted each item — directly or through the dependency chain; hover a work-item to see its path to
            that journey. Other currently-ready items follow at the end.
          </Text>
          <Table
            headers={["#", "Priority", "Work-item", "Ready now", "Status", "Unlocks", "Serves"]}
            columnAlign={["right", "left", "left", "left", "left", "right", "left"]}
            rowTone={executionOrder.map((n) => rowToneFor(STATUS[n.status].weight))}
            rows={executionOrder.map((n, i) => {
              const lift = liftedOf(n.id);
              const ready = isReady(n);
              return [
                <Text weight="semibold" tone="secondary">
                  {i + 1}
                </Text>,
                lift.rank === Infinity ? (
                  <Text size="small" tone="quaternary">
                    —
                  </Text>
                ) : (
                  <Pill size="sm" tone="warning" active title={`Lifted by ${JNAME[lift.jid]} (P${lift.rank + 1})`}>
                    P{lift.rank + 1}
                  </Pill>
                ),
                <Pill tone={buildTone(STATUS[n.status].weight)} active={n.id === focus} onClick={() => setFocusNode(n.id)} title={pathToJourney(n.id, lift.jid)}>
                  {n.label}
                </Pill>,
                ready ? (
                  <Pill size="sm" tone="success" active>
                    Ready
                  </Pill>
                ) : (
                  <Pill size="sm" tone="neutral">
                    Blocked
                  </Pill>
                ),
                <Text size="small" tone="secondary">
                  {STATUS[n.status].label}
                </Text>,
                <Text weight="semibold">{String(DOWNSTREAM[n.id])}</Text>,
                <Text size="small" tone="tertiary">
                  {n.verts.map((v) => JNAME[v]).join(", ")}
                </Text>,
              ];
            })}
          />
        </Stack>
      )}

      <Divider />

      {/* Per-vertical necessary-condition completion (point 3) */}
      <Stack gap={8}>
        <H2>How complete is each vertical delivery?</H2>
        <Text size="small" tone="tertiary">
          For every journey, this is its full necessary-condition closure — all work-items it transitively depends on,
          including shared foundations. A journey is only fully delivered when every node in its closure is Implemented.
          Sorted by completion, so the least-ready (most constrained) verticals are at the top.
        </Text>
        <Table
          headers={["Vertical delivery", "Necessary nodes", "Implemented", "Remaining", "Closure complete"]}
          columnAlign={["left", "right", "right", "right", "right"]}
          rowTone={vertProgress.map((v) => rowToneFor(v.done / v.total))}
          rows={vertProgress.map((v) => {
            const pr = priorities.indexOf(v.id);
            return [
            <Row gap={6} align="center">
              {pr >= 0 && (
                <Pill size="sm" tone="warning" active>
                  P{pr + 1}
                </Pill>
              )}
              <Pill tone={buildTone(v.done / v.total)} active={v.id === vSel} onClick={() => setVSel(v.id)}>
                {v.name}
              </Pill>
            </Row>,
            String(v.total),
            String(v.done),
            String(v.remaining),
            <Text weight="semibold">{pct(v.done / v.total)}</Text>,
            ];
          })}
        />
      </Stack>

      <Callout tone="info" title="How to use this for sequencing (Theory of Constraints)">
        Start from the <Text as="span" weight="semibold">Ready to start</Text> list and pick the highest-leverage items
        first — they unblock the most downstream work per unit effort (e.g. file storage, notifications, a payment
        gateway, the projection engine). Then re-check readiness: completing a node flips its dependents to ready,
        cascading the next wave. To finish a specific journey, switch the selector to it and drive its closure to 100% —
        the highlighted black-box nodes are exactly what remains.
      </Callout>
    </Stack>
  );
}

/* ------------------------------------------------------------------ */
/* Top-level app — view toggle between the two presentations          */
/* ------------------------------------------------------------------ */

export default function RustybuDeliveryCanvas() {
  const t = useHostTheme();
  const [view, setView] = useCanvasState<"map" | "graph">("view", "map");
  return (
    <Stack gap={0}>
      <Row
        gap={8}
        align="center"
        style={{
          padding: "12px 24px",
          borderBottom: `1px solid ${t.stroke.tertiary}`,
          position: "sticky",
          top: 0,
          zIndex: 5,
          background: t.bg.editor,
        }}
      >
        <Text size="small" weight="semibold" tone="secondary">
          View
        </Text>
        <Pill active={view === "map"} tone="info" onClick={() => setView("map")}>
          Delivery map
        </Pill>
        <Pill active={view === "graph"} tone="info" onClick={() => setView("graph")}>
          Dependency graph (NCN)
        </Pill>
        <Spacer />
        <Text size="small" tone="quaternary">
          Same data · two lenses
        </Text>
      </Row>
      {view === "map" ? <MapView /> : <GraphView />}
    </Stack>
  );
}
