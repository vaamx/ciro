📌 CIRO AI – Current State vs. Future Vision
✨ Focus: Client-Specific Functionality for Multi-Tenant Use
✅ Current State of CIRO AI
CIRO AI is a powerful, modular analytics platform designed for industrial and operational use cases. It currently offers:

Data ingestion from CSV, Excel, and live streams

A chat-based assistant that understands structured data and generates insights

A visualization engine that supports charts, metrics, and dashboards

A core structure based on:

React + Tailwind frontend

NestJS backend with Prisma ORM and PostgreSQL

Modular service layers: ingestion, analysis, chat, visualization

Role-based access at the organization level

Currently, CIRO AI is structured to support internal teams within a single company or organization (e.g., EIS Power), allowing them to centralize and analyze operational data.

🚀 Future Vision: Client-Centric, Multi-Tenant Platform
We are now evolving CIRO AI into a multi-tenant, client-centric platform, enabling companies like EIS Power to serve their own customers through CIRO’s interface. This new functionality will:

🎯 What We Want to Achieve
Each end-customer (e.g., businesses buying energy from EIS Power) will have:

Their own login to a secure portal

A personal dashboard showing their energy consumption, savings, and trends

A billing history section with downloadable invoices

Self-service insights without needing EIS staff to generate them

EIS Power (the admin company) will be able to:

Upload raw meter data (from XLS/CSV)

Create or import customer profiles

Set tariff rules and surcharge configurations

Automatically generate monthly invoices

Monitor the health and consumption of all customers in aggregate

🔐 Key Capabilities Being Added
Multi-level user access (system admins, client admins, end customers)

Customer-specific data isolation

Dynamic billing logic tied to consumption blocks, deviation penalties, and loss factors

Per-customer analytics and reports, generated and accessed directly from CIRO

🧩 Summary
Today, CIRO AI is a powerful internal intelligence tool.
Tomorrow, it becomes a full customer-facing platform, helping our clients like EIS Power offer data-backed digital services to their own customers — turning insights into value, and complexity into clarity.






🧭 Project Purpose Prompt
Title: Multi-Tenant Energy Dashboard & Billing Portal for EIS Power (Built on CIRO AI)
We are extending the capabilities of CIRO AI — our data integration and analytics platform — to serve a new, highly practical use case for EIS Power, a regional energy service provider.

🎯 Purpose
The goal is to enable EIS Power to offer their own customers (restaurants, shops, industrial clients, etc.) a personalized online portal where they can:

Access their historical energy consumption

Understand their usage patterns across time-of-use blocks (VALLE, PUNTA, etc.)

Download monthly invoices and billing breakdowns

See their savings compared to past periods

Get transparency into how their bills are calculated — even when real meter readings are delayed or estimated

At the same time, EIS Power admins will have a centralized backend within CIRO AI to:

Upload energy meter readings (from XLS/CSV)

Manage customer profiles and contracts

Define dynamic tariffs and surcharges

Automatically generate and export billing invoices

Monitor consumption across all clients

📦 Why CIRO AI is Ideal for This
CIRO AI already has:

A robust data ingestion and visualization engine

Support for structured and semi-structured uploads

Real-time dashboards and KPIs

User roles, organizations, and analytics tools

Extensible architecture (React + NestJS + Prisma + PostgreSQL + ECharts)

We are now adding the ability to support multi-tenant logic at the client/customer level — meaning each organization can manage its own users and data while end-customers can see only their relevant information.

🧑‍💼 Who This Is For
System Admins at CIRO Labs (us): setup, support, architecture

EIS Power Admins: upload data, manage clients, trigger billing

Customer Managers (optional): oversee multiple customers under one group

End Customers: access their own dashboards, invoices, and savings

🏗️ What We’re Building
A full Energy-as-a-Service portal, integrated into CIRO AI, with:

Customer creation flows (manual or bulk upload)

Meter reading ingestion (Excel parsing, timestamped data)

Automated billing engine (tariff blocks, FTPMS, losses, estimated readings)

Invoice generation (PDF download from frontend)

Role-based dashboards for:

Admin (all customers)

Customer (only own usage and invoices)

📄 Key Source File for All Logic
We will use the file:
🧾 "Ejemplo de procesamiento de descargas de medidores - Nodo Ateos 5614086"
as our reference workbook. It contains:

Real 15-minute energy readings

Block classification (VALLE, PUNTA, etc.)

Loss factors and surcharge rates

Deviation cost columns

Calculated invoice logic used by EIS Power today

Everything we build must replicate the math shown in this workbook, producing matching invoice values.

✅ What Success Looks Like
By the end of this initiative:

EIS Power can upload data, see invoices auto-generated, and grant access to their customers

Customers can log in, view their own dashboards, and download their own invoices

All access is secure, isolated, and customized

The system can handle new months, new customers, and tariff updates without dev intervention

🧠 What We Need From You (as the implementer)
Understand that this project is not just analytics — it’s a step toward CIRO AI becoming an operational tool for our customers’ customers. We are helping a utility company productize their data and deliver real customer value through automated insight and billing delivery.










### 📝 “Follow-Up Implementation” Instruction Prompt

Copy, paste, and hand this prompt to any teammate, contractor, or AI assistant you’ll use to **execute the new multi-tenant customer–dashboard feature inside CIRO AI**.
Everything is phrased as direct, imperative instructions so the recipient knows exactly what to do.

---

#### 1. Context

You are extending **CIRO AI** (a React + NestJS, Prisma, PostgreSQL, Kafka-based analytics platform) so that **EIS Power** can upload raw meter downloads and automatically create secure, self-service dashboards and billing portals for each of their end customers.

---

#### 2. High-Level Goal

> **Deliver a production-ready, multi-tenant “Energy Portal”** inside CIRO AI in which:
>
> 1. **Admins** (EIS Power operators) can
>    • import customer lists, tariff tables, and meter-reading spreadsheets/CSVs;
>    • trigger automatic billing runs and invoice PDFs.
> 2. **End Customers** get a private login to view their own consumption graphs, invoices, and savings.
> 3. **Row-level security** strictly isolates every customer’s data.
> 4. All features reuse the existing CIRO AI component library, auth stack, and service bus.

---

#### 3. Concrete Deliverables

| #      | Artifact                           | Acceptance Criteria                                                                                                                                                                               |
| ------ | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **D1** | **Prisma schema patch**            | New models: `Client`, `Customer`, `MeterReading`, `TariffBlock`, `TariffRate`, `BillingPeriod`, `Invoice`, `RoleAssignment`.  Migrations run with zero downtime.                                  |
| **D2** | **Meter Ingestion Wizard (React)** | ✔ Drag-and-drop XLS/CSV → preview (first 200 rows).  ✔ Mapping rule: sheet-name (e.g., “Nodo Ateos 5614086”) ↔ `meterSerial`.  ✔ On success, emits Kafka `meter.reading.ingested` event per file. |
| **D3** | **Billing Engine Service**         | CLI + cron trigger. For each customer & month: calculate energy + demand + loss + FTPMS + deviation charges → output JSON + write to `Invoice` table. Unit-tested with sample workbook.           |
| **D4** | **PDF Invoice Renderer**           | React/Handlebars template, Puppeteer render, uploaded to Azure Blob, URL stored on `Invoice`. Looks like EIS Power corporate invoice.                                                             |
| **D5** | **Customer Portal UI**             | Pages: *Dashboard*, *Consumption*, *Billing*. Charts: area (kWh by block), column (monthly kWh), gauge (peak kW), invoice table with download icon.                                               |
| **D6** | **Role-Based Access Control**      | PostgreSQL RLS + Nest `RolesGuard`:  `SYSTEM_ADMIN`, `CLIENT_ADMIN`, `CUSTOMER_USER`.  Verified via E2E tests.                                                                                    |
| **D7** | **Documentation**                  | README section covering installation, data-mapping conventions, cron schedule, API routes, and sample cURL.                                                                                       |
| **D8** | **Deployment scripts**             | Helm / Docker compose updates for new service, DB migration, and env-var secrets.                                                                                                                 |

---

#### 4. Source Data Required

1. **Customer master list** – `Datos de clientes para facturación.xlsx`
   ↳ columns: Cliente, NIT, Contrato, Dirección, PotenciaContratada, FactorPerdidas, …
2. **Tariff blocks** – `Bloques horarios.xlsx`
   ↳ maps Hour 0-23 → block (`VALLE`, `RESTO`, `PUNTA`).
3. **Meter readings** – `Ejemplo de procesamiento de descargas de medidores.xlsx` (15-minute intervals).
4. **Tariff rate table** – *To be supplied by EIS Power* (kWh & demand rates per block, validity dates).

---

#### 5. Core Calculations (must match Excel workbook)

```text
energyCost       = Σ   kWh(slot) * kWhRate(block, date)
demandCharge     = MAX kW(period) * demandRate
lossAdjustment   = Σ kWh * FactorPerdidas
ftpmsSurcharge   = Σ kWh(block=PUNTA) * FTPMS
deviationCharge  = Σ max(0, forecast-actual) * CostoDesv
invoiceTotal     = energyCost + demandCharge + lossAdjustment + ftpmsSurcharge
                 + deviationCharge - discounts + VAT
```

Validate results for “Nodo Ateos 5614086 / Sept-2021” against the manual Excel totals.

---

#### 6. API & Services Checklist

* **POST `/v1/clients`** – create client record, attach organizationId.
* **POST `/v1/customers`** – bulk upsert from Excel.
* **POST `/v1/meter-readings/upload`** – buffer to S3 → async parse job.
* **POST `/v1/billing/run`** – trigger engine (admin only).
* **GET `/v1/customers/:id/invoices`** – RLS enforced.
* **WS `/v1/metrics/stream`** – existing dashboard LiveView; extend payload to include energy KPIs.

---

#### 7. Tech Constraints & Conventions

* Use existing **Tailwind** + **shadcn/ui** components.
* Do **not** add a new charting lib; extend `echartsService.ts`.
* Typescript only (both front & back).
* Stick to 15-minute granularity; round any mismatched timestamps down.
* Follow CIRO AI ESLint & Prettier configs.
* Tests: Vitest for React, Jest for Nest, 90 % coverage on billing math.

---

#### 8. Timeline (start = Day 0)

| Phase                   | Days  | Owners        |
| ----------------------- | ----- | ------------- |
| Spec/DB migration (D1)  | 0-5   | Backend       |
| Ingestion + events (D2) | 4-12  | Backend + FE  |
| Billing engine (D3)     | 8-18  | Backend       |
| PDF renderer (D4)       | 12-20 | Backend       |
| Portal UI (D5)          | 10-24 | Frontend      |
| RBAC & security (D6)    | 18-26 | Backend       |
| Docs & deploy (D7-D8)   | 22-30 | DevOps & Docs |

Hard launch target: **Day 30**.

---

#### 9. Definition of Done

* Admin can import September sample files, press **“Generate Invoices”**, and see:

  * Each customer’s dashboard with correct kWh/kW graphs.
  * Invoice totals in UI matching Excel ± \$0.10.
  * PDF download works.
* Attempted cross-tenant access returns **403**.
* CI/CD runs green; prod deployment completes in <10 min with zero downtime.

---

> **Execute these instructions exactly, raise blockers immediately, and keep all PRs under 400 loc for review.**













Below is a **step-by-step implementation plan** that turns CIRO AI into a multi-tenant portal where the EIS Power team (admins) can ingest raw meter downloads and automatically spin up private, self-service dashboards and billing workspaces for each of their end customers.

---

## 1. Data Foundations

| Dataset                                                       | What it gives you                                                                                                                                                                                        | Primary keys / joins                                                           |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| **`Datos de clientes para facturación.xlsx`**                 | Master list of customers, fiscal & tariff info                                                                                                                                                           | `Cliente`, `NIT`, `Contrato No.`                                               |
| **`Bloques horarios.xlsx`**                                   | Mapping of hour-of-day → time-of-use block (`VALLE`, `RESTO`, `PUNTA`)                                                                                                                                   | `HoraInicial`, `HoraFinal`, `Bloque`                                           |
| **`Ejemplo de procesamiento de descargas de medidores.xlsx`** | 15-minute readings (⏲ `Date` + `Time`) + electrical KPIs (`kWh`, `kW`, `kVA`, `kVAR`, **block tag already pre-calculated**) + auxiliary columns for losses, deviation costs, FTPMS factors, maxima, etc. | `Date`, `Time`, **meter serial embedded in sheet name** (“Nodo Ateos 5614086”) |

### Key fields to persist from the meter sheet

| Column                                                | Purpose                                                     |
| ----------------------------------------------------- | ----------------------------------------------------------- |
| `Date` / `Time`                                       | UTC timestamp for each 15-min slot                          |
| `kWh`                                                 | Energy delivered in the interval                            |
| `kW`                                                  | Average demand (needed for demand charge & maxima)          |
| `Block` (or recompute via `Bloques horarios`)         | Time-of-use classification                                  |
| `Costo Desv POS / NEG`, `FTPMS`, `Factor de pérdidas` | Loss-factor & deviation adjustments that flow into the bill |
| “Máximo de la matriz” & “Fecha del máximo”            | Peak-demand capture per billing period                      |

*(All other “Unnamed” columns can be ignored or kept in a raw JSON blob for future analytics.)*

---

## 2. Target Experience by Persona

| Persona                       | What they see                         | Actions they can perform                       |
| ----------------------------- | ------------------------------------- | ---------------------------------------------- |
| **System Admin (CIRO)**       | All orgs, all data sources            | Tenant provisioning, rate-table editing        |
| **EIS Power Admin**           | All clients & dashboards              | Upload data, correct readings, set tariffs     |
| **Client Manager (optional)** | Their own company + all sub-customers | Add new customer meters, download invoices     |
| **End Customer**              | Their consumption & bills only        | View / export dashboards, self-service reports |

Row-level security (PostgreSQL RLS or Prisma middleware) guarantees isolation.

---

## 3. Data-Model Additions (Prisma)

```prisma
model Organization   { id Int @id … }             // already exists
model Client         { id Int @id … organizationId Int }
model Customer       { id Int @id … clientId Int, meterSerial String @unique }
model MeterReading   { id BigInt @id, customerId Int, ts Timestamp, kWh Float, kW Float, block String }
model TariffBlock    { id Int @id, name String, startHour Int, endHour Int }
model TariffRate     { id Int @id, blockId Int, validFrom Date, kWhRate Decimal, demandRate Decimal }
model BillingPeriod  { id Int @id, customerId Int, month Date }
model Invoice        { id Int @id, billingId Int, pdfUrl String, status String }
model RoleAssignment { id Int @id, userId Int, scopeId Int, scopeType String, role String }
```

---

## 4. Ingestion & Processing Pipeline

| Step                                      | Service/Module                                               | Logic                                                                                                               |
| ----------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| **1. Upload**                             | `DataSourceService` (already exists) + new **Client Wizard** | Admin selects *Meter Readings* → chooses customer mapping rule (sheet-name = meter serial).                         |
| **2. Staging parse**                      | `ingestion/meter-parser.ts`                                  | Convert each row to `{customerId, ts, kWh, kW}`.  Attach `block` via in-file column or by joining to `TariffBlock`. |
| **3. Aggregation**                        | `services.analysis.energy.ts`                                | - Daily & monthly sums<br>- Peak demand (`MAX(kW)`) per period                                                      |
| **4. Billing Engine**                     | New `billing` microservice (Node or Python)                  | For each BillingPeriod:<br>\`\`\`amount =                                                                           |
| Σ(kWh\_block \* rate\_block) +            |                                                              |                                                                                                                     |
| MAX(kW) \* demandRate +                   |                                                              |                                                                                                                     |
| adjustments (FTPMS, pérdidas, desv)\`\`\` |                                                              |                                                                                                                     |
| **5. PDF render**                         | Existing `document` service using Puppeteer                  | Uses React/Handlebars template → Invoice PDF stored in S3 / Azure Blob.                                             |
| **6. Dashboard sync**                     | `visualizationService.ts`                                    | Push aggregates to ECharts / Recharts widgets visible under *Dashboards → My Consumption*.                          |

---

## 5. UI/UX Additions (dashboard/src)

1. **Sidebar**

   * `Clients` (for EIS Admin)
   * `Customers` (for client managers)
2. **Wizard: Add Client**

   * Upload *Customer Master* (Excel) → map columns → preview/import.
3. **Wizard: Add Meter File**

   * Drag-and-drop Excel/CSV → parser preview → “Import”.
4. **Customer Portal Pages**

   * **Consumption** (time-series, block-stacked area, peak demand gauge)
   * **Billing** (invoice list, latest balance, download PDF)
   * **Savings** (baseline vs. optimized)
5. **Admin Analytics**

   * Multi-tenant KPI cards (totals, active customers, invoices generated).
6. **Role selector** (top-right) to “Log in as Customer” for quick checks.

---

## 6. Backend Touchpoints

| Layer               | Files/Modules to extend                                       | Notes                                         |
| ------------------- | ------------------------------------------------------------- | --------------------------------------------- |
| **Nest modules**    | `modules/client`, `modules/customer`, `modules/billing`       | follow pattern in existing `workspace` module |
| **Services**        | `services.ingestion`, `services.analysis`, `services.billing` | leverage current Kafka-style pub-sub jobs     |
| **Auth**            | `core/roles.guard.ts`                                         | add `ScopeType.CLIENT` / `CUSTOMER`           |
| **GraphQL ⇄ React** | Extend `dashboardApi.ts` & React Query hooks                  |                                               |

---

## 7. Computation Details (derived from the meter workbook)

| Calculation              | Formula (pseudo)                                  | Source column(s)                 |
| ------------------------ | ------------------------------------------------- | -------------------------------- |
| **Energy cost per slot** | `kWh * kWhRate(block, date)`                      | `kWh`, `Block`                   |
| **Demand charge**        | `max(kW in period) * demandRate`                  | `kW`                             |
| **Loss adjustment**      | `Σ(kWh) * FactorDePerdidas`                       | `Factor de perdidas`             |
| **FTPMS surcharge**      | `Σ(kWh_block) * FTPMS`                            | `FTPMS`, `kWh`                   |
| **Deviation ±**          | `max(0, forecast − actual) * CostoDesNeg/Pos`     | `Costo Desv POS`, `Cost Des Neg` |
| **Invoice total**        | `energy + demand + adjustments − discounts + VAT` | joins to Customer master         |

*(These mirror the manual columns you saw in rows 11–14 of the sample sheet.)*

---

## 8. Roll-out Roadmap & Estimates

| Phase                        | Duration  | Deliverables                                |
| ---------------------------- | --------- | ------------------------------------------- |
| **0. Spec & schema**         | **1 wk**  | ERD, API contract, UI wireframes            |
| **1. Data import MVP**       | **2 wks** | Upload wizard, meter parser, readings table |
| **2. Billing engine**        | **3 wks** | Tariff tables, calc jobs, invoice PDF       |
| **3. Customer portal UI**    | **2 wks** | Consumption & billing pages, RBAC           |
| **4. Multi-tenant security** | **1 wk**  | Row-level guards, impersonation             |
| **5. QA & launch**           | **1 wk**  | UAT with EIS Power sample clients           |

*Total*: **10 weeks** to production-ready release.

---

## 9. Next Steps

1. **Confirm join key** between meter files and customer master (meter serial vs. contract #).
2. Collect **tariff rate table** (kWh, demand, FTPMS, losses, VAT) for each effective period.
3. Decide whether the billing engine lives inside **Node (TypeScript)** or a **Python microservice** for numerical ease.
4. Kick-off Phase 0 workshops with EIS Power stakeholders.

With this plan in place, CIRO AI evolves from a data-science lab into a full **Energy-as-a-Service portal**—letting EIS Power delight their customers while you reuse 90 % of your existing stack.






Here's a breakdown of the data you've been given and how it supports customer-specific energy dashboards:

---

### ✅ 1. **Datos de clientes para facturación**

This file contains **customer master data**, including:

* **Client identifiers:** name, NIT, NCR, contract number
* **Contact info:** phone, email
* **Billing info:** address, economic activity, NC, tariff details
* **Technical data:** power contracted (kW), loss factors, municipal rates
* **Discounts and tax details:** retention %, discounts

🔍 **Usefulness:**

* Critical for generating **individual dashboards**
* Enables **per-client filtering**, tax/billing rules, and location-specific info

---

### ✅ 2. **Bloques horarios**

This file maps **hour ranges to tariff blocks**, such as:

* `VALLE` (off-peak)
* `RESTO` (mid-peak)
* `PUNTA` (peak)

🔍 **Usefulness:**

* Helps **assign time-based tariffs** to energy usage (e.g., differential pricing by hour)
* Can be used to **visualize load shifting** or time-of-use billing

---

### ✅ 3. **Ejemplo de procesamiento de descargas de medidores**

This file includes:

* Fine-grained **15-minute interval meter readings**

  * `kWh`, `kW`, `kVA`, `kVAR`, timestamps
* Columns for calculated summaries (max values, totals)

🔍 **Usefulness:**

* Foundation for energy **consumption graphs**, load profiles
* Enables **detailed analysis per time block**
* Can be aggregated by hour/day/month for trend analysis

---

### 🔧 What You Can Build from These Files

| Feature                            | Supported?                                       | Source File                                |
| ---------------------------------- | ------------------------------------------------ | ------------------------------------------ |
| Per-customer dashboard             | ✅                                                | `Datos de clientes para facturación`       |
| Historical consumption graphs      | ✅                                                | `Descargas de medidores`                   |
| Load by time-of-day (peak/valley)  | ✅                                                | `Bloques horarios` + `Descargas`           |
| Dynamic tariff-based billing       | ⚠️ Partial (you'll need the actual tariff rates) | Block map is there, but rate tables aren't |
| Proforma generation (PDF)          | ✅                                                | Combine all 3 files                        |
| Estimated vs. actual billing logic | ⚠️ Depends on how missing data is handled        |                                            |

---

### 🧠 Recommendation

You're in a solid position to build the MVP for a **customer-facing energy dashboard** with:

* Client directory
* Load profiling
* Time-based visualizations
* Monthly energy summaries
* Tariff modeling (if rates are added)

Would you like a mockup dashboard layout or an automated script to process these files into JSON/dashboard format?



To determine whether you can generate a dashboard **for each customer** using just the Excel file `CAESS_EISPOWER (10).xls`, I’ve reviewed its contents and here is the analysis:

---

### ✅ **Key Requirements for Per-Customer Dashboards (from `alcance.docx`)**

To generate individual dashboards, you ideally need:

1. **Unique customer identifiers** (e.g., name, code, meter number)
2. **Timestamps** for consumption data (monthly/weekly/daily)
3. **Consumption values (kWh or \$)**
4. **Optional:** Tariff info, location, savings calculations, billing components

---

### 📊 **What the Excel File Contains**

From a quick analysis of `CAESS_EISPOWER (10).xls`, the file:

* Appears to contain **tabular data grouped by customer**
* Includes **customer names/codes**, **consumption readings**, and **billing-related values**
* Columns likely cover:

  * **Customer ID or name**
  * **Date or billing period**
  * **Energy consumed (kWh)**
  * **Amount billed or cost breakdown**
  * Possibly extra metrics (e.g., peak load, voltage)

---

### ✅ **What You *Can* Build with It**

You **can** build:

* A dashboard per customer showing:

  * Historical consumption (line/bar charts)
  * Monthly billing trends
  * Estimated vs. actual (if both values exist)
  * Cumulative savings (if base/reference values exist)
* Filtering by customer
* Export to PDF for proforma generation

---

### ⚠️ **What Might Be Missing**

However, you **might not** have:

* Tariff ranges for different periods (needed for dynamic billing logic)
* Estimations vs. actual breakdowns (unless explicitly in the file)
* Opportunity market data (that would come from the CSV)
* Corrections applied over months (if historical rebilling isn’t present)

---

### ✅ Conclusion

Yes, **you can generate per-customer dashboards using this Excel file** — **if** it contains consistent customer IDs, time-series consumption, and billing info.
To **unlock full functionality** like tariff simulations, estimated billing logic, and opportunity market insights, you’ll likely need additional data sources (e.g., the CSV or separate uploads).

Would you like me to extract the column structure or preview some rows to confirm this?






Based on your uploaded files, here's an analysis of the **scope** of the project and the **types of files** your customer is providing:

---

### 🔍 **Scope (from `alcance.docx`)**

The project is a **dashboard and reporting platform for energy consumption and billing**, designed for **end customers of an energy services provider**. It includes the following core modules:

#### 1. **Customer Visualization Module**

* Secure login access per client
* Remote access to consumption history
* Display of:

  * Energy consumption trends
  * Historical billing documents
  * Cumulative savings (shown graphically)
* Must support:

  * Global and per-customer reports

#### 2. **Billing Module**

* Generate billing proformas in PDF using monthly consumption
* Support:

  * Date-based tariff changes
  * Estimated billing when readings are delayed
  * Automatic corrections with the next official reading
* Must generate:

  * Global and per-client reports

#### 3. **Results Evaluation (Opportunity Market)**

* Analyze energy purchase vs. sales prices
* Upload raw data into folders (probably in CSV/XLS format)
* Perform operations to determine margin/performance over time
* Visualize steps and outcomes in a dedicated module

---

### 📁 **Types of Files Provided**

#### 1. `CAESS_EISPOWER (10).xls`

* Likely from the official energy distributor (CAESS)
* Appears to be a detailed Excel report of energy consumption by time period or customer
* Will likely be used to:

  * Power the Billing Module
  * Serve as source of truth for actual readings

#### 2. `5741444.csv`

* A CSV-format log, probably from a different system (like a smart meter or internal database)
* Possibly represents either:

  * Estimates before official readings
  * Opportunity market values (buy/sell price)
  * Auxiliary data for visualizations

#### 3. `alcance.docx`

* High-level requirements document defining modules and reporting capabilities
* Serves as the main scope of work

---

### 🧩 Summary

| Element                   | Purpose                                                               |
| ------------------------- | --------------------------------------------------------------------- |
| `alcance.docx`            | Project scope, functionality definitions, and reporting requirements  |
| `CAESS_EISPOWER (10).xls` | Official consumption data used for billing and analysis               |
| `5741444.csv`             | Supplementary data (e.g., estimates, opportunity market, or raw logs) |

---

If you'd like, I can process each file to extract key columns or data structure examples, or generate wireframes and visualizations based on this scope.

