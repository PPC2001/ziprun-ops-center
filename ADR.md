# Architecture Decision Records (ADR)
# Project: ZipRun AI Reassignment Engine

This document records the key architectural decisions made during the design and implementation of the **ZipRun AI Reassignment Engine**. Each record follows the standard format: **Context → Options Considered → Decision → Tradeoffs Accepted**.

---

## ADR-1: Where Does Routing Logic Live?

### Context
In a dispatch system, routing orders to delivery agents involves evaluating agent availability, current workload, geographic zones, and capacity constraints. As features grow (such as adding AI strategies, zone affinity, or SLA escalation), routing logic can easily become entangled with HTTP request handling, persistence transactions, or domain entities, leading to bloated classes and rigid coupling.

### Options Considered
1. **Controller Layer**: Placing recommendation logic inside `OrderController` or `AgentController`.  
   *Assessment*: High coupling between HTTP transport and business rules; impossible to reuse from the asynchronous agentic event listener.
2. **Rich Domain Model (`Order` entity)**: Having `order.recommendAgent(List<Agent> roster)`.  
   *Assessment*: Domain entities should express core state and invariants, not orchestrate external I/O (like HTTP calls to LLMs or database queries).
3. **Dedicated Strategy Layer (Application Service)**: Defining a distinct `com.zycus.reassignment.routing.RoutingStrategy` contract behind the service layer.

### Decision
**Chose Option 3 (Dedicated Strategy Layer)**.  
Routing algorithms are encapsulated in distinct Strategy beans (`AiRoutingStrategy`, `RuleBasedRoutingStrategy`) that implement a uniform `RoutingStrategy` interface. The `OrderService` and `ReplanService` act as application service orchestrators: they fetch data, invoke the active routing strategy, and persist results, while domain entities (`Order`, `Agent`, `ReassignmentSuggestion`) guard their own state transitions.

### Tradeoffs Accepted
- Introduces additional interfaces and DTOs (`RoutingContext`, `RoutingRecommendation`).
- Requires passing state snapshots (`List<Agent>`, `Order`) into the strategy rather than letting the strategy query the database directly. This is an intentional design boundary that makes unit testing routing algorithms straightforward without database mocks.

---

## ADR-2: How Does Runtime Strategy Switching Work?

### Context
The system supports multiple dispatch strategies — currently **Rule-Based (least active orders)** and **AI-Powered (LLM evaluation)**, with a planned **Zone-Affinity** strategy in Sprint 2. The active strategy must be switchable at runtime via configuration (`routing.strategy` in `application.properties` or environment variables) without code modification or application restarts. Furthermore, the same strategy contract is invoked from two different execution contexts: an synchronous HTTP endpoint (`POST /api/orders/{id}/suggest`) and an asynchronous event listener in the agentic loop.

### Options Considered
1. **Spring `@Qualifier` with conditional bean injection**:  
   *Assessment*: Static at container startup; switching requires restarting the application context.
2. **Manual `switch` statement inside a Factory class**:  
   *Assessment*: Requires modifying the factory class every time a new strategy is implemented, violating the Open/Closed Principle.
3. **Auto-wired `Map<String, RoutingStrategy>` Bean Map**:  
   *Assessment*: Spring automatically collects all beans implementing `RoutingStrategy` into a Map keyed by bean name (`"ai"`, `"rule-based"`). The active bean is selected dynamically at invocation time based on the `routing.strategy` property.

### Decision
**Chose Option 3 (Auto-wired Bean Map)**.  
Spring injects `Map<String, RoutingStrategy>` into `OrderService` and `ReplanService`. When a suggestion is requested, the system resolves `strategies.get(activeStrategyName)`. If the configured strategy name is unrecognized, it logs a warning and defaults to `"rule-based"`.

### Tradeoffs Accepted
- Relies on Spring bean naming conventions matching configuration property values (`@Service("ai")` matches `routing.strategy=ai`).
- Missing compile-time verification if an invalid strategy name is provided in configuration (mitigated by a defensive fallback to `"rule-based"`).
- Adding `ZoneAffinityStrategy` in Sprint 2 requires only writing a class with `@Service("zone-affinity")` without modifying any existing service code.

---

## ADR-3: How Does the System Stay Resilient When the LLM Is Unavailable?

### Context
External LLM APIs are inherently non-deterministic and prone to failures: network timeouts, HTTP 429 rate limits, malformed or non-JSON responses, empty API keys, and hallucinated identifiers (e.g. recommending an `agentId` that does not exist in the database or recommending an offline driver). In an automated agentic loop, a failed AI call must never cause a silent drop or leave stranded orders unprocessed.

### Options Considered
1. **Fail-Fast (Throw Exception to Client / Caller)**:  
   *Assessment*: Halts the re-planning loop, leaving stranded orders in limbo and degrading user experience.
2. **Blocking Retry with Exponential Backoff**:  
   *Assessment*: Adds significant latency to async workers; if quotas are exhausted or credentials are invalid, retries merely delay inevitable failure.
3. **5-Mode Resilient Fallback Chain with Output Sanitization & Hallucination Guard**:  
   *Assessment*: Intercept all failure paths, sanitize output, validate against the live agent roster, and immediately fall back to the deterministic rule-based strategy with transparent annotations.

### Decision
**Chose Option 3 (5-Mode Resilient Fallback Chain)**.  
[`AiRoutingStrategy`](file:///C:/Users/Pratik/Desktop/Projects/Zycus/backend/src/main/java/com/zycus/reassignment/routing/AiRoutingStrategy.java) implements a robust multi-layered safety net:
1. **Missing API Key Guard**: If `llm.api-key` is empty (and not using local Ollama), immediately invokes `RuleBasedRoutingStrategy`.
2. **Transport & Quota Guard**: HTTP 4xx/5xx errors and timeouts (>15s) are caught and logged.
3. **Markdown Codeblock Sanitization**: Automatically strips ` ```json ` fences and parses raw JSON into `LlmResponse`.
4. **Hallucination Verification**: Verifies that the LLM-returned `recommendedAgentId` matches a real agent in the current available roster (`status == AVAILABLE`). If hallucinated, it rejects the response and falls back.
5. **Annotated Fallback Rationale**: When falling back, the suggestion reasoning is tagged with `[AI unavailable — rule-based fallback]` so ops personnel have full visibility.

### Tradeoffs Accepted
- Fallback suggestions will use the simpler least-busy heuristic rather than deep situational analysis during LLM outages.
- Requires maintaining the rule-based strategy as a permanent dependency of the AI strategy.

---

## ADR-4: How Is the Agentic Loop Triggered and Kept Off the Request Path?

### Context
When a delivery agent calls in sick or goes `OFFLINE`, an ops coordinator or webhook sends `PATCH /api/agents/{id}/status` with `{"status": "OFFLINE"}`. Re-planning potentially dozens of affected deliveries requires finding stranded orders, constructing prompts, calling the LLM, and persisting suggestions. If done synchronously, the HTTP request would block for several seconds, risking client timeouts and connection pool exhaustion.

### Options Considered
1. **Synchronous Execution inside `AgentService.updateStatus()`**:  
   *Assessment*: Blocks the caller for 2–10 seconds while LLM calls execute sequentially; fails HTTP response if AI call errors.
2. **Scheduled Cron Poller (Periodic Polling of Offline Agents)**:  
   *Assessment*: Not truly event-driven; introduces lag (e.g. 1-minute delay before detection) and incurs unnecessary database polling overhead.
3. **Domain Event Publication (`AgentOfflineEvent`) with `@TransactionalEventListener(AFTER_COMMIT)` and `@Async("replanExecutor")`**:  
   *Assessment*: Decouples the database transaction from background processing; HTTP request commits and returns in < 15ms.

### Decision
**Chose Option 3 (Event-Driven Async Decoupling)**.  
- `AgentService.updateStatus()` updates the agent record to `OFFLINE` within its transaction and publishes [`AgentOfflineEvent`](file:///C:/Users/Pratik/Desktop/Projects/Zycus/backend/src/main/java/com/zycus/reassignment/domain/event/AgentOfflineEvent.java) via Spring's `ApplicationEventPublisher`.
- [`ReplanService`](file:///C:/Users/Pratik/Desktop/Projects/Zycus/backend/src/main/java/com/zycus/reassignment/service/ReplanService.java) listens with `@TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)`. This guarantees that the agent's offline status is persisted in the database before the background worker queries for available replacement agents.
- The re-planning execution is annotated with `@Async("replanExecutor")`, running on a dedicated thread pool defined in [`AsyncConfig.java`](file:///C:/Users/Pratik/Desktop/Projects/Zycus/backend/src/main/java/com/zycus/reassignment/config/AsyncConfig.java).
- **Idempotency**: Before generating a suggestion, `ReplanService` checks `suggestionRepository.existsByOrderIdAndTriggerReasonAndStatus(order.getId(), TriggerReason.AGENT_OFFLINE, SuggestionStatus.PENDING)` to prevent duplicate suggestions if repeated events fire.

### Tradeoffs Accepted
- Error handling in background threads cannot communicate back to the HTTP client (handled by creating persisted `ReassignmentSuggestion` records and emitting logger warnings).
- Requires careful transaction management (the async method starts its own transactional boundary for saving suggestions).

---

## ADR-5: What Did We Design to Extend, and What Did We Deliberately Leave for Later?

### Part 1: Extension Seams Designed for Sprints 2 & 3
1. **Zone & Capacity Extension Seam (Sprint 2)**:  
   - [`Agent`](file:///C:/Users/Pratik/Desktop/Projects/Zycus/backend/src/main/java/com/zycus/reassignment/domain/entity/Agent.java) includes nullable fields `currentZone` and `maxCapacity`.
   - [`Order`](file:///C:/Users/Pratik/Desktop/Projects/Zycus/backend/src/main/java/com/zycus/reassignment/domain/entity/Order.java) includes `pickupZone`, `dropoffZone`, and enum `WeightClass` (`LIGHT`, `HEAVY`).
   - Adding `ZoneAffinityStrategy` in Sprint 2 requires zero database schema migrations — only implementing `RoutingStrategy` and registering `@Service("zone-affinity")`.
2. **Proactive SLA-Breach Trigger Seam (Sprint 3)**:  
   - [`Order`](file:///C:/Users/Pratik/Desktop/Projects/Zycus/backend/src/main/java/com/zycus/reassignment/domain/entity/Order.java) has an indexed `slaDeadline` timestamp.
   - The [`TriggerReason`](file:///C:/Users/Pratik/Desktop/Projects/Zycus/backend/src/main/java/com/zycus/reassignment/domain/enums/TriggerReason.java) enum is decoupled from agent status; a Sprint 3 scheduled monitor can publish an `SlaApproachingBreachEvent` that invokes `ReplanService` with `TriggerReason.SLA_BREACH_RISK` without altering the routing engine.

### Part 2: Deliberate Exclusions & Prioritization Rationale
1. **Automated Order Auto-Assignment (Without Ops Checkpoint)**:  
   *Decision*: Kept human-in-the-loop approval (`PENDING → ACCEPTED | REJECTED`) mandatory.  
   *Rationale*: In last-mile delivery, physical reassignment has real-world courier impact. The system acts as an *advisor* rather than an unsupervised actuator. Auto-assignment was deliberately deferred until confidence thresholds (>0.95) and SLA urgency rules are validated in production.
2. **Complex Multi-Hop Route Optimization**:  
   *Decision*: Focused on single-order replacement recommendations with situational awareness rather than full TSP (Traveling Salesperson Problem) multi-stop route re-generation.  
   *Rationale*: In emergency re-planning, speed of recovery and low latency take precedence over solving NP-hard route permutations.
3. **Dedicated WebSocket Channel (Used 5s Polling + SSE Stream instead)**:  
   *Decision*: Used resilient HTTP REST polling (5s) for dashboard sync and Server-Sent Events (SSE) for AI token streaming rather than bidirectional WebSockets.  
   *Rationale*: Unidirectional SSE and polling are simpler, stateless, proxy-friendly, and avoid stateful connection leaks on server restarts.
