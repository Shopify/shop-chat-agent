# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- `npm run dev`: Start development server with Shopify CLI hot reloading
- `npm run build`: Build the Remix application for production
- `npm run start`: Start production server (requires prior build)

- `npm run setup`: Initialize database (run Prisma migrations and generate client)
- `npm run lint`: Run ESLint code linting
- `shopify app dev`: Alternative dev command that handles tunneling and preview URLs
- `shopify app deploy`: Deploy the app to Shopify Partners Dashboard

## Database Operations

- `npm run prisma`: Access Prisma CLI for database operations
- `prisma migrate dev`: Create and apply new database migrations
- `prisma generate`: Regenerate Prisma client after schema changes
- `prisma studio`: Open Prisma Studio for database inspection

## Architecture Overview

This is a Shopify app that provides an AI-powered chat widget for storefronts. The app consists of two main components:

### Backend (Remix App)

- **Framework**: Remix with Vite for development and build
- **Database**: SQLite with Prisma ORM for session and conversation storage
- **AI Integration**: Claude API via Anthropic SDK
- **MCP Integration**: Model Context Protocol for accessing Shopify APIs
- **Key Files**:
  - `app/routes/chat.jsx`: Main chat API endpoint with SSE streaming
  - `app/mcp-client.js`: MCP client for Shopify API tool integration
  - `app/services/claude.server.js`: Claude API service wrapper
  - `app/services/streaming.server.js`: Server-sent events streaming utilities

### Frontend Extension (Shopify Theme Extension)

- **Type**: Shopify theme extension for storefront integration
- **Files**:
  - `extensions/chat-bubble/blocks/chat-interface.liquid`: Liquid template
  - `extensions/chat-bubble/assets/chat.js`: Client-side JavaScript
  - `extensions/chat-bubble/assets/chat.css`: Styling

### Database Schema

- **Sessions**: Shopify app session storage
- **Conversations/Messages**: Chat history persistence
- **CustomerTokens**: Customer authentication tokens for MCP
- **CodeVerifier**: OAuth PKCE flow support

## Key Patterns

### MCP Tool Integration

- Tools are dynamically loaded from both storefront and customer MCP endpoints
- `MCPClient` class handles connections to multiple MCP servers
- Tool calls are routed based on tool name to appropriate endpoint
- Authentication is handled transparently for customer-specific tools

### Streaming Architecture

- Chat responses use Server-Sent Events (SSE) for real-time streaming
- `createSseStream` utility manages streaming with proper error handling
- Claude streaming is integrated with tool calling workflow

### Configuration System

- System prompts stored in `app/prompts/prompts.json` with multilingual support
- Theme extension settings allow prompt type selection
- Environment variables for API keys and endpoints

### Error Handling

- MCP client gracefully handles authentication failures
- Tool errors are surfaced to users with actionable messages
- Stream errors are properly propagated to frontend

## Important Implementation Notes

- The app supports both English and Ukrainian system prompts
- Customer authentication uses OAuth 2.0 PKCE flow for security
- Database migrations handle customer tokens and conversation history
- The frontend extension includes IP-based feature gating
- Mobile viewport handling is implemented for better UX

## Testing

No specific test framework is configured. Use `npm run build` and `npm run dev` to verify functionality. The `/chat` endpoint can be tested directly for API integration testing.

Mobile layout/keyboard behaviour can't be judged in desktop DevTools device mode — use the real-Android kit in `tools/mobile-research/README.md`.

## Deployment

The app is configured for deployment with Fly.io (dockerfile included) and uses Litestream for SQLite replication. Standard Shopify app deployment procedures apply.

- **Backend (Remix app):** deployed manually with `fly deploy`; there is no CI deploy.
- **Chat widget (theme app extension):** `shopify app deploy` releases a new app version to the store; merging alone doesn't change the storefront.
