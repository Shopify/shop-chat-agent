# Build an AI Agent for Your Storefront

This is a template Shopify app that interacts with a store in real time. It provides an AI-powered chat interface to help customers find products, answer questions about your shop, and complete purchases through natural conversation. The app uses Shopify’s Model Context Protocol endpoints for accurate, actionable responses. Learn more about MCP at [modelcontextprotocol.io](https://modelcontextprotocol.io/).

## MCP Capabilities

- **Product Discovery**: Natural-language search and personalized recommendations
- **Store Information**: Answer questions about policies, shipping, returns, FAQs
- **Cart Management**: Create carts, add/remove items, and complete checkout seamlessly
- **Order Management**: Track order status and process returns

## Features of this template app
- **AI-Powered Chat**: Embedded chat bubble for real-time AI-powered shopping assistance (customize the prompt and/or change the LLM used, we use Claude for this template, for your needs)
- **MCP Cliente**: The app is also an MCP client that is already aware of Shopify's MCP tools (add more MCP servers if you need it)
- **Conversation Memory**: Maintains context throughout customer interactions
- **Custom Chat UI**: Shopify theme extension for seamless store integration (modify the app look and feel for your store)
- **Streaming Responses**: Real-time message streaming for natural conversation flow


## Prerequisites
1. **Code Editor**: Install and use your favorite editor (e.g., [Cursor](https://www.cursor.com/en/downloads), [VSCode](https://code.visualstudio.com/download)) for opening and editing project files.
2. **Node.js**: v18.20 or higher. Download and install from [nodejs.org](https://nodejs.org/).
3. **Shopify Partner Account**: Sign up at [shopify.com/partners](https://www.shopify.com/partners)
4. **Shopify Development Store**: For testing and development. Follow [these nstructions](https://shopify.dev/docs/api/development-stores) to create one. Make sure to select the option to add products to your store.
5. **Anthropic API Key**: Go to the [Anthropic Console](https://console.anthropic.com/), generate a key, and store it securely. This template app uses Anthropic, but if you want to use another LLM, you can, and you'll need to modify the code.

## Getting Started

### Installation

1. Clone the repository:
   ```shell
   git clone https://github.com/Shopify/shop-chat-agent.git
   cd shop-chat-agent
   ```

2. Install dependencies:
   ```shell
   npm install
   ```

3. Set up environment variables:
   - Create a `.env` file with the following:
     ```
     CLAUDE_API_KEY=your_claude_api_key
     ```

### Development

Start the development server:

```shell
shopify app dev --reset
```

1. Say yes, create it as a new app
2. Hit enter to accept the default name - all references are to this name, it should be `shop-chat-agent`
3. Choose a development store - MUST be a development store
4. Add password - Copy the URL in Terminal to get the direct link to access your store's password
5. End state is you will have a Preview URL... at this point we need to make a few more code changes


### Update shopify.app.toml

Add below content to your shopify.app.toml file:

```bash
[app_proxy]
url = "https://example.trycloudflare.com"
subpath = "chat"
prefix = "apps"
```

### Restart you dev server

```shell
shopify app dev
```

### Select yes to automatically update you app url's

```shell
Have Shopify automatically update your app's URL in order to create a preview experience?

> Yes, automatically update
```

### Install The App

Head to the url provided in your shell to install the app on your demo store

### Enable Chat Extension

Enable the chat extension from theme editor (Online store > Themes > Customize > App embeds)

## Add a explicit set of steps on how to do this

## Chat Interface

The chat bubble extension is located in `extensions/chat-bubble/`. It connects to the `/chat` endpoint of the app server to stream messages.

## MCP Tools Integration

The app integrates with Model Control Plane (MCP) tools, which allows the AI to access additional functionality. These tools are initialized in the `app/mcp-client.js` file.

## Examples
- hi, should return a LLM based response
- can you search for snowboards. This should do a shop specific search via MCP
- add <product name> to cart. This should execute the cart MCP and offer to checkout URL
- <Sid will come up with ways to test CA tools>

## Deployment

Follow standard Shopify app deployment procedures as outlined in the [Shopify documentation](https://shopify.dev/docs/apps/deployment/web).

## Architecture

This app consists of two main components:

1. **Backend API**: A Remix app server that handles communication with Claude and processes chat messages
2. **Chat Bubble UI**: A Shopify theme extension that provides the customer-facing chat interface

This will:
- Start Remix in development mode
- Tunnel the local server to make it accessible by Shopify
- Provide a URL to install the app on your development store

### API Endpoints

- `/chat`: Main endpoint for streaming chat messages, supports both GET and POST requests


## Tech Stack

- **Framework**: [Remix](https://remix.run/)
- **AI**: [Claude by Anthropic](https://www.anthropic.com/claude)
- **Shopify Integration**: [@shopify/shopify-app-remix](https://www.npmjs.com/package/@shopify/shopify-app-remix)
- **Database**: SQLite (via Prisma) for session storage

## If you want to use another LLM, here's what you will have to do

## Contributing

Please follow the standard Shopify contribution guidelines when making changes to this project.
