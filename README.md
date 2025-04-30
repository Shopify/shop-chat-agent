# Build an AI Agent for Your Storefront

This template Shopify app installs directly on your storefront and embeds an AI-powered chat widget that engages visitors in real time. Shoppers can naturally search for products, ask about your store’s policies or shipping, and complete purchases without ever leaving the conversation. Under the hood, it leverages the [Model Context Protocol](https://modelcontextprotocol.io/) to tap into Shopify’s APIs for accurate, actionable responses.

### MCP Capabilities

- **Product Discovery**: Natural-language search with personalized product recommendations.
- **Store Information**: Answer questions about policies, shipping, returns, FAQs
- **Cart Management**: Create carts, add or remove items, and complete checkout.
- **Order Management**: Track order status and process returns

### App Features
- **AI-Powered Chat**: Embedded chat bubble for real-time shopping assistance; swap in your preferred LLM.  
- **Built-In MCP Client**: Ready to call Shopify’s MCP tools (e.g. search, cart, order); easily add more servers.  
- **Persistent Context**: Remembers past messages to keep conversations coherent.  
- **Custom Chat UI**: A theme extension you can style to match your store.  
- **Streaming Responses**: Streams messages for a natural chat feel.

### Prerequisites
1. **Code Editor**: Use your preferred editor (e.g., [Cursor](https://www.cursor.com/en/downloads), [VS Code](https://code.visualstudio.com/download)) for editing project files.  
2. **Node.js**: v18.20 or higher. Download from [nodejs.org](https://nodejs.org/) and install.  
3. **Shopify Partner Account**: Sign up at [shopify.com/partners](https://www.shopify.com/partners).  
4. **Shopify Development Store**: Create a dev store for testing - see the [Development stores guide](https://shopify.dev/docs/api/development-stores). Make sure to add some sample products.  
5. **Anthropic API Key**: Generate a key in the [Anthropic Console](https://console.anthropic.com/) and store it securely. This template uses Claude, but you can swap in any LLM by updating the code.  
6. *_Register your app on the new Shopify Developer Platform to enable Customer Accounts (steps TBD)._*


## Getting Started

### Installation

1. Clone the repository.
   ```shell
   git clone https://github.com/Shopify/shop-chat-agent.git
   cd shop-chat-agent
   ```

2. Install dependencies.
   ```shell
   npm install
   ```

3. Set up environment variables.
   <br>Create a `.env` file with the following:
   ```
   CLAUDE_API_KEY=your_claude_api_key
   ```

### Create the app

4. Start the development server.
    <br> If prompted, choose the organization this is for in your Terminal.
   ```shell
   shopify app dev --reset
   ```

6. Select Yes to create this project as a new app.
   ```shell
   ?  Create this project as a new app on Shopify?
   >  (y) Yes, create it as a new app
   ```

4. Hit enter to accept the default name `shop-chat-agent`. All references in code use this name.
   ```shell
   ?  App name:
   >  shop-chat-agent
   ```

4. If prompted, select the store you would like to use - note it **must** be a development store (see [Prerequisites](#prerequisites)).
   ```shell
   ?  Which store would you like to use to view your project?
   ✔  your-store
   ```

4. Type in your store password. You can get it from the URL that is in your Terminal.
   ```shell
   ? Incorrect store password ( 
     https://your-store.myshopify.com/admin/online_store/preferences ). Please
      try again:
   >  *****█________
   ```

5. At this stage, you will see `Preview URL: https://your-store.myshopify.com/...` in your Terminal. You can now proceed to the next step. If you get an error, restart from step 4.


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
