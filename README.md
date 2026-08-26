# 🖥️ ZipRun Frontend — Dispatch Ops Center

React 18 + Vite + TypeScript web application styled with a **shadcn-inspired White & Light Blue Theme**.

## 🎨 Design System & Highlights

- **Theme:** Clean White & Light Blue enterprise logistics dashboard.
- **Components:**
  - `AgentRoster`: Fleet capacity bars, zone chips, and 1-click status switching.
  - `SuggestionCard`: AI reasoning display, confidence gauge, and 🔴 **Auto Re-plan** badges.
  - `OrderBoard`: 4-column dispatch board with real-time SLA countdown clocks.
  - `SsePanel`: Slide-up streaming reasoning terminal.
  - `ToastContainer`: Non-blocking floating status alerts.
- **Hooks:**
  - `usePolling`: Resilient 5-second polling synchronization.
  - `useSseStream`: Native browser `EventSource` client for real-time LLM token streaming.

## 🚀 Running the Frontend

```bash
# 1. Install dependencies
npm install

# 2. Start development server
npm run dev
```

The application will be accessible at: `http://localhost:5173`.
