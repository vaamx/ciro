# Threads Tab Development Tasks

This document tracks the development tasks for building the "Threads Tab" feature, starting with the Intelligent Query Router.

## Phase 1: Intelligent Query Router

---

### Task 1: Implement Query Preprocessing in QueryRouterService
- **Status:** TODO
- **Priority:** High
- **Description:** Implement the `preprocess` method in `QueryRouterService` (`server/src/services/code-execution/query-router.service.ts`). This includes trimming the query string, converting to lowercase, and optionally integrating the `fast-text-detection` library for typo cleanup, controlled by an environment variable (`ROUTER_SPELLCHECK`).
- **Acceptance Criteria:**
    - `preprocess` method correctly trims and lowercases input strings.
    - Spellcheck functionality is present and can be enabled/disabled via `ROUTER_SPELLCHECK`.
    - Basic unit tests for the `preprocess` method are created.
- **Files:** `server/src/services/code-execution/query-router.service.ts`
- **Notes:** Install `fast-text-detection` if spellcheck is implemented.

---

### Task 2: Implement Heuristic Analysis in QueryAnalysisService
- **Status:** TODO
- **Priority:** High
- **Description:** Create and implement the `QueryAnalysisService` (likely in `server/src/services/analysis/query-analysis.service.ts`). This service will contain the `runHeuristics` method, which takes a preprocessed query string and returns a `HeuristicFlags` object. Refine keyword lists and scoring logic (e.g., weighted keywords if desired, normalized scores).
- **Acceptance Criteria:**
    - `QueryAnalysisService` is created and injectable.
    - `runHeuristics` method correctly identifies analytical/retrieval keywords, mentions of data/code, and visualization requests.
    - `HeuristicFlags` interface is defined with `analyticalScore` and `retrievalScore` (potentially normalized).
    - Unit tests for `runHeuristics` cover various query types and keyword combinations.
- **Files:** `server/src/services/analysis/query-analysis.service.ts`, `server/src/services/code-execution/query-router.service.ts` (for HeuristicFlags interface if shared or to import from analysis service)
- **Dependencies:** (Potentially) Task 1 (for preprocessed query input)

---

### Task 3: Integrate QueryAnalysisService into QueryRouterService
- **Status:** TODO
- **Priority:** High
- **Description:** Modify `QueryRouterService` to inject and use `QueryAnalysisService` to get heuristic flags instead of having the `runHeuristics` logic directly within it.
- **Acceptance Criteria:**
    - `QueryRouterService` successfully calls `QueryAnalysisService.runHeuristics`.
    - Heuristic flags are correctly passed to subsequent steps in the router.
- **Files:** `server/src/services/code-execution/query-router.service.ts`, `server/src/services/analysis/query-analysis.service.ts`, relevant module files for DI.
- **Dependencies:** Task 2

---

### Task 4: Implement LLM Classification Step in QueryRouterService
- **Status:** TODO
- **Priority:** High
- **Description:** Implement the `llmClassify` method in `QueryRouterService`. This includes building the prompt with the query and heuristic flags (as per the refined prompt structure), making the API call to OpenAI, parsing the JSON response, and handling potential errors.
- **Acceptance Criteria:**
    - `llmClassify` correctly constructs the prompt.
    - OpenAI API call is made using the configured model (`ROUTER_MODEL`).
    - JSON response is parsed into classification and confidence.
    - Error handling for API call failures or JSON parsing errors is implemented.
- **Files:** `server/src/services/code-execution/query-router.service.ts`
- **Dependencies:** Task 3 (needs heuristic flags)

---

### Task 5: Implement Decision Combination Logic in QueryRouterService
- **Status:** TODO
- **Priority:** High
- **Description:** Implement the `combine` method in `QueryRouterService` to merge heuristic signals and LLM classification results into a final `RouterDecision`. Use environment variables for confidence thresholds (`ROUTER_CONF_HIGH`, `ROUTER_CONF_MID`).
- **Acceptance Criteria:**
    - `combine` method correctly implements the decision logic as per the refined pseudocode.
    - Confidence thresholds are read from environment variables.
    - Edge cases and fallback logic are handled appropriately.
    - Unit tests for `combine` method cover various heuristic/LLM result combinations.
- **Files:** `server/src/services/code-execution/query-router.service.ts`
- **Dependencies:** Task 3, Task 4

---

### Task 6: Implement Logging for QueryRouterService
- **Status:** TODO
- **Priority:** Medium
- **Description:** Implement the `persistLog` method in `QueryRouterService`. This includes logging the query, heuristic flags, LLM result, and final decision using the NestJS logger. Plan for future integration with a persistent logging solution (e.g., Prisma table `router_logs`).
- **Acceptance Criteria:**
    - All relevant routing information is logged for each query.
    - Log output is structured and informative.
    - A TODO comment or placeholder is added for future Prisma integration.
- **Files:** `server/src/services/code-execution/query-router.service.ts`
- **Dependencies:** Task 5

---

### Task 7: Configure Query Router Environment Variables
- **Status:** TODO
- **Priority:** High
- **Description:** Ensure all necessary environment variables for `QueryRouterService` (OPENAI_API_KEY, ROUTER_MODEL, ROUTER_CONF_HIGH, ROUTER_CONF_MID, ROUTER_SPELLCHECK) are documented and configurable (e.g., in an `.env.example` file and loaded correctly by NestJS).
- **Acceptance Criteria:**
    - All specified .env variables are used by the service.
    - An `.env.example` file includes these variables.
- **Files:** `server/src/services/code-execution/query-router.service.ts`, `.env.example`, relevant NestJS configuration files.

---

### Task 8: Unit Test QueryRouterService Core Methods
- **Status:** TODO
- **Priority:** High
- **Description:** Create Jest unit tests for the `QueryRouterService`, focusing on `runHeuristics` (if it remains in this service, otherwise test `QueryAnalysisService.runHeuristics`) and `combine` methods. Mock LLM calls to avoid actual API requests during tests.
- **Acceptance Criteria:**
    - Core logic of heuristic generation (if applicable) and decision combination is well-tested.
    - LLM interactions are mocked.
    - Tests cover a range of query types and decision paths.
- **Files:** `server/src/services/code-execution/query-router.service.spec.ts` (and potentially `query-analysis.service.spec.ts`)
- **Dependencies:** Task 2, Task 5

---

### Task 9: Create Prisma Schema for `router_logs`
- **Status:** TODO
- **Priority:** Medium
- **Description:** Design and add a Prisma schema for a `router_logs` table to persistently store query routing information (query text, heuristic flags, LLM classification, LLM confidence, final decision, timestamp). Generate the migration.
- **Acceptance Criteria:**
    - Prisma schema for `router_logs` is defined.
    - Migration file is generated successfully.
- **Files:** `prisma/schema.prisma`
- **Dependencies:** (Conceptual) Task 6

---

### Task 10: Integrate `router_logs` Table with QueryRouterService
- **Status:** TODO
- **Priority:** Medium
- **Description:** Update the `persistLog` method in `QueryRouterService` to save routing logs to the `router_logs` table using Prisma Client.
- **Acceptance Criteria:**
    - Routing logs are successfully written to the database.
    - Error handling for database operations is included.
- **Files:** `server/src/services/code-execution/query-router.service.ts`, Prisma module/service.
- **Dependencies:** Task 6, Task 9

--- 