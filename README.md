# Cloudflare AI Chat Agent Template

[![[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/zhiwen95/thinkstep-ai-tutor)]](https://deploy.workers.cloudflare.com)

A production-ready full-stack AI chat application built on Cloudflare Workers using the new Agents SDK. Features multi-session conversations powered by Durable Objects, tool calling (web search, weather, MCP tools), streaming responses, and a modern React UI.

## ✨ Key Features

- **AI-Powered Chat Agents**: Persistent conversations using Cloudflare Durable Objects (Agents) for stateful sessions.
- **Multi-Session Management**: Create, list, update, and delete chat sessions with automatic title generation.
- **Tool Calling**: Built-in tools for web search (SerpAPI), weather, and extensible MCP (Model Context Protocol) integration.
- **Streaming Responses**: Real-time message streaming with Cloudflare AI Gateway (OpenAI-compatible).
- **Modern UI**: React 18 with Vite, Tailwind CSS, shadcn/ui components, Tanstack Query, and dark mode support.
- **Session Persistence**: Automatic activity tracking and listing via central AppController Durable Object.
- **Developer-Friendly**: Type-safe TypeScript, Hono routing, error handling, and hot-reload dev server.
- **Cloud-Native**: Zero-config deployment to Cloudflare Workers with SPA asset handling.

## 🛠️ Technology Stack

- **Backend**: Cloudflare Workers, Hono, Agents SDK, OpenAI SDK, Durable Objects
- **Frontend**: React 18, Vite, Tailwind CSS, shadcn/ui, Tanstack React Query, React Router
- **AI**: Cloudflare AI Gateway (Gemini models), SerpAPI, MCP SDK
- **Tools**: Bun (package manager), Wrangler CLI, TypeScript
- **UI/UX**: Lucide icons, Framer Motion, Sonner toasts, Sidebar layout

## 🚀 Quick Start

### Prerequisites

- [Bun](https://bun.sh) installed
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install/) (`npm i -g wrangler`)
- Cloudflare account and API token
- Cloudflare AI Gateway setup (for `@vars` in `wrangler.jsonc`)

### Installation

1. Clone or download the project
2. Install dependencies:
   ```
   bun install
   ```
3. Configure environment variables in `wrangler.jsonc`:
   ```json
   "vars": {
     "CF_AI_BASE_URL": "https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/openai",
     "CF_AI_API_KEY": "{your_ai_gateway_token}",
     "SERPAPI_KEY": "{your_serpapi_key}",
     "OPENROUTER_API_KEY": "{optional_openrouter_key}"
   }
   ```
4. Generate Worker types:
   ```
   bun run cf-typegen
   ```

### Development

- Start dev server (frontend + worker proxy):
  ```
  bun dev
  ```
- Open [http://localhost:3000](http://localhost:3000)
- Edit `src/pages/HomePage.tsx` for custom UI or extend Worker routes in `worker/userRoutes.ts`

### Production Build

```
bun run build
```

## 📱 Usage

- **New Chat**: POST `/api/sessions` (auto-generates session ID and title)
- **Chat Messages**: POST/GET `/api/chat/{sessionId}/chat` and `/messages`
- **List Sessions**: GET `/api/sessions`
- **Model Switch**: POST `/api/chat/{sessionId}/model`
- **Sessions API**: Full CRUD via `/api/sessions/*`

Example frontend integration uses `src/lib/chat.ts` service.

## ☁️ Deployment

1. Login to Cloudflare:
   ```
   wrangler login
   ```
2. Deploy:
   ```
   bun run deploy
   ```
3. Your app is live! SPA assets are automatically served.

[![[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/zhiwen95/thinkstep-ai-tutor)]](https://deploy.workers.cloudflare.com)

**Note**: Update Durable Object bindings/migrations in `wrangler.jsonc` if customizing classes.

## 🔧 Customization

- **Extend Tools**: Add to `worker/tools.ts` and `worker/mcp-client.ts`
- **Custom Routes**: `worker/userRoutes.ts`
- **AI Models**: Switch via UI or API (supports Gemini via AI Gateway)
- **UI Components**: Full shadcn/ui library available
- **Sessions**: Extend `worker/app-controller.ts`

## 🤝 Contributing

1. Fork the repo
2. `bun install`
3. Make changes
4. `bun run lint`
5. Submit PR

## 📄 License

MIT License. See [LICENSE](LICENSE) for details.