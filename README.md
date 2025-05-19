# Build an AI Agent for Your Storefront

A Shopify template app that lets you embed an AI-powered chat widget on your storefront. Shoppers can search for products, ask about policies or shipping, and complete purchases—all without leaving the conversation. Under the hood it speaks the [Model Context Protocol](https://modelcontextprotocol.io/) (MCP) to tap into Shopify’s APIs.

### Overview
- **What it is**: A drop-in chat widget + backend that turns any storefront into an AI shopping assistant.  
- **Key features**:  
  - Natural-language product discovery  
  - Store policy & FAQ lookup  
  - Create carts, add or remove items, and initiate checkout
  - Track orders and initiate returns

## Developer Docs
- Everything from installation to deep dives lives on https://shopify.dev/docs/apps/build/storefront-mcp.
- Clone this repo and follow the instructions on the dev docs.

## Examples
- `hi` > will return a LLM based response. Note that you can customize the LLM call with your own prompt.
- `can you search for snowboards` > will use the `search_shop_catalog` MCP tool.
- `add The Videographer Snowboard to my cart` > will use the `update_cart` MCP tool and offer a checkout URL.
- `update my cart to make that 2 items please` > will use the `update_cart` MCP tool.
- `can you tell me what is in my cart` > will use the `get_cart` MCP tool.
- `what languages is your store available in?` > will use the `search_shop_policies_and_faqs` MCP tool.
- `I'd like to checkout` > will call checkout from one of the above MCP cart tools.
- `Show me my recent orders` > will use the `get_most_recent_order_status` MCP tool.
- `Can you give me more details about order Id 1` > will use the `get_order_status` MCP tool.

## Architecture

### Components
This app consists of two main components:

1. **Backend**: A Remix app server that handles communication with Claude, processes chat messages, and acts as an MCP Client.
2. **Chat UI**: A Shopify theme extension that provides the customer-facing chat interface.

When you start the app, it will:
- Start Remix in development mode.
- Tunnel your local server so Shopify can reach it.
- Provide a preview URL to install the app on your development store.

For direct testing, point your test suite at the `/chat` endpoint (GET or POST for streaming).

### MCP Tools Integration
- The backend already initializes all Shopify MCP tools—see [`app/mcp-client.js`](./app/mcp-client.js).
- These tools let your LLM invoke product search, cart actions, order lookups, etc.
- More in our [dev docs](https://shopify.dev/docs/apps/build/storefront-mcp).

### Tech Stack
- **Framework**: [Remix](https://remix.run/)
- **AI**: [Claude by Anthropic](https://www.anthropic.com/claude)
- **Shopify Integration**: [@shopify/shopify-app-remix](https://www.npmjs.com/package/@shopify/shopify-app-remix)
- **Database**: SQLite (via Prisma) for session storage

## Customizations
This repo can be customized. You can: 
- Edit the prompt
- Change the chat widget UI
- Swap out the LLM

You can learn how from our [dev docs](https://shopify.dev/docs/apps/build/storefront-mcp).

## Deployment
Follow standard Shopify app deployment procedures as outlined in the [Shopify documentation](https://shopify.dev/docs/apps/deployment/web).

## Contributing
Please follow the standard Shopify contribution guidelines when making changes to this project.

# Remove when dev docs go live

# Build an AI Agent for Your Storefront

This template Shopify app installs directly on your storefront and embeds an AI-powered chat widget that engages visitors in real time. Shoppers can naturally search for products, ask about your store’s policies or shipping, and complete purchases without ever leaving the conversation. Under the hood, it leverages the [Model Context Protocol](https://modelcontextprotocol.io/) to tap into Shopify’s APIs for accurate, actionable responses.

### MCP Capabilities

- **Product Discovery**: Natural-language search with personalized product recommendations.
- **Store Information**: Answer questions about policies, shipping, returns, and FAQs.
- **Cart Management**: Create carts, add or remove items, and complete checkout.
- **Order Management**: Track order status and process returns.

### App Features
- **AI-Powered Chat**: Embedded chat bubble for real-time shopping assistance; swap in your preferred LLM.
- **Built-In MCP Client**: Ready to call Shopify’s MCP tools (e.g. search, cart, order); easily add more servers.
- **Persistent Context**: Remembers past messages to keep conversations coherent.
- **Custom Chat UI**: A theme extension you can style to match your store.
- **Streaming Responses**: Streams messages for a natural chat feel.

### Prerequisites
1. **Code Editor**: For editing project files (e.g., [Cursor](https://www.cursor.com/en/downloads), [VS Code](https://code.visualstudio.com/download)).
2. **Node.js**: v18.20 or higher. Download from [nodejs.org](https://nodejs.org/) and install.
3. **Shopify Partner Account**: Sign up at [shopify.com/partners](https://www.shopify.com/partners).
4. **Shopify Development Store**: Create a dev store for testing - see the [Development stores guide](https://shopify.dev/docs/api/development-stores). Make sure to add some sample products.
5. **Anthropic API Key**: Generate a key in the [Anthropic Console](https://console.anthropic.com/) and store it securely. This template uses Claude, but you can swap in any LLM by updating the code.
6. **Shopify CLI**: v3.79.0 or higher. Installation instructions can be found in the [dev docs](https://shopify.dev/docs/api/shopify-cli)
7. *_Register your app on the new Shopify Developer Platform to enable Customer Accounts (steps TBD)._*


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
   <br>Rename the `.env.example` file to `.env` and make sure it has your Claude API key:
   ```
   CLAUDE_API_KEY=your_claude_api_key
   ```

### Create your app

4. Install the latest shopify cli (vv3.79.0 or higher)
   ```shell
   npm install -g @shopify/cli@latest
   ```

5. Start the development server.
    <br> If prompted, choose the organization this is for in your terminal.
   ```shell
   shopify app dev --use-localhost --reset
   ```

6. Select Yes to create this project as a new app.
   ```shell
   ?  Create this project as a new app on Shopify?
   >  (y) Yes, create it as a new app
   ```

7. Hit enter to accept the default name `shop-chat-agent`. All references in the code use this name.
   ```shell
   ?  App name:
   >  shop-chat-agent
   ```

8. If prompted, keep the configuration file name blank.
   ```shell
   ?  Configuration file name:
   ✔  (empty)
   ```

9. If prompted, select no and overwrite your existing configutation file.
   ```shell
   ?  Configuration file shopify.app.toml already exists. Do you want to choose a different configuration name?
   ✔  No, overwrite my existing configuration file
   ```

10. If prompted, select the store you would like to use - note it **must** be a development store (see [Prerequisites](#prerequisites)).
   ```shell
   ?  Which store would you like to use to view your project?
   ✔  your-store
   ```

11. Type in your store password. You can get it from the URL that is in your terminal.
   ```shell
   ? Incorrect store password (
     https://your-store.myshopify.com/admin/online_store/preferences ). Please
      try again:
   >  *****█________
   ```

   At this stage, you will see `Preview URL: https://your-store.myshopify.com/...` in your terminal. You can now proceed to the next step. If you get an error, restart from step 4.

12. Use mkcert to generate a certifacte for you localhost
   ```shell
   ?  --use-localhost requires a certificate for `localhost`. Generate it now?
   >  Yes, use mkcert to generate it
   ```

13. Select yes to automatically update your app's URL.
   ```shell
   Have Shopify automatically update your app's URL in order to create a preview experience?
   > Yes, automatically update
   ```

### Run your app

14. Follow the  `Preview URL: https://your-store.myshopify.com/...` in your terminal to open your store in your browser.

15. You will now be in the browser and on your store's Admin portal. Install the app.

16. On your Admin portal, navigate to Online Store > Themes
- Click Customize button<br>
- Click App embeds icon in the sidebar<br>
- Enable the toggle<br>
- Click Save

### Configure Customer Account Authentication
Customer account features (order history, account details, customer-specific queries) require additional authentication steps. Follow these instructions to enable authenticated customer accounts:

**Use a development store**

You must use a development store created through the [Shopify Partners dashboard](https://dev.shopify.com/). Only development stores support localhost redirect URIs for testing.

**Protected Customer Data**

Apps that use the Customer Account MCP server must comply with Shopify’s [protected customer data requirements](https://shopify.dev/docs/apps/launch/protected-customer-data). Specifically, your app needs "Level 2" protected customer data permissions.

To request these permissions:
* Log in to your Shopify Partners dashboard.
* Navigate to Apps and select your app under the Developer Dashboard apps tab.
* Click API access requests.
* Click Request access under the Protected customer data section.
* Provide a clear reason for requesting each data field (name, email, phone, address).

**Update your app's TOML file**
```toml
# Add Customer Account MCP configurations
     [access_scopes]
     scopes = "customer_read_customers, customer_read_orders, customer_read_store_credit_accounts, customer_read_store_credit_account_transactions"

     [mcp.customer_authentication]
     redirect_uris = [
       "https://your-app-domain.com/callback"
     ]
```
Replace your-app-domain.com with your actual app domain. Localhost URIs aren't allowed in this file. However, when using a development store, you can test authentication with localhost URIs without registering them here.

This configuration enables your app to:
- Define OAuth 2.0 callback URLs for authentication requests.
- Specify required API client scopes merchants must accept during app installation.

**How authentication works in your app**

When a customer requests their account details or order history, your agent will:
- Identify available tools from the MCP customer account domain.
- Detect if the customer needs to authenticate and initiate OAuth flow.
- Retrieve the customer account domain via a storefront GraphQL request.
- Construct an OAuth 2.0 authorize URL using your OAuth discovery endpoint, App ID, and registered redirect URI.
- Guide customers through authentication by providing an authorization link.
- Handle OAuth 2.0 callback requests and exchange authorization codes for access tokens.
- Retrieve and display the requested customer information.


## Examples to try
- `hi` > will return a LLM based response. Note that you can customize the LLM call with your own prompt.
- `can you search for snowboards` > will use the `search_shop_catalog` MCP tool.
- `add The Videographer Snowboard to my cart` > will use the `add_cart_items` MCP tool and offer a checkout URL.
- `update my cart to make that 2 items please` > will use the `update_cart_items` MCP tool.
- `can you tell me what is in my cart` > will use the `get_cart_contents` MCP tool.
- `what languages is your store available in?` > will use the `search_shop_policies_and_faqs` MCP tool.
- `I'd like to checkout` > will call checkout from one of the above MCP cart tools.

Try these examples once customer account authentication is setup:
- `Show me my recent orders` > will use the `get_most_recent_order_status` MCP tool.
- `Can you give me more details about order Id 1` > will use the `get_order_status` MCP tool.

## Architecture

### Components
This app consists of two main components:

1. **Backend**: A Remix app server that handles communication with Claude, processes chat messages, and acts as an MCP Client.
2. **Chat UI**: A Shopify theme extension that provides the customer-facing chat interface.

When you start the app, it will:
- Start Remix in development mode.
- Tunnel your local server so Shopify can reach it.
- Provide a preview URL to install the app on your development store.

For direct testing, point your test suite at the `/chat` endpoint (GET or POST for streaming).

### MCP Tools Integration
- The backend already initializes all Shopify MCP tools—see [`app/mcp-client.js`](./app/mcp-client.js).
- These tools let your LLM invoke product search, cart actions, order lookups, etc.
- More in the [Shopify Agent Platform docs](https://shopify.dev).

### Tech Stack
- **Framework**: [Remix](https://remix.run/)
- **AI**: [Claude by Anthropic](https://www.anthropic.com/claude)
- **Shopify Integration**: [@shopify/shopify-app-remix](https://www.npmjs.com/package/@shopify/shopify-app-remix)
- **Database**: SQLite (via Prisma) for session storage

## Customizations

### Editing the prompt
- Modify [`app/prompts/prompts.json`](./app/prompts/prompts.json) to align the agent’s tone and brand voice.
- This repo includes 2 prompts, a standard assistant and an enthusiastic assistant. By default, it uses the standard assistant.
- To switch to a different prompt, go to your admin portal, navigate to Online Store > themes. Click Customize button, and then select app embeds icon in the sidebar. Click on your app extension, you should see a dropdown selector for system prompt where you can choose between standard and enthusiastic assistant.


### Changing the UI
- Use the extension folder: `extensions/chat-bubble/`
- The UI streams from `/chat` and renders on your storefront.
- You can tweak CSS, JS, and icons under `extensions/chat-bubble/assets/`.

### Swapping out the LLM
By default this template uses Anthropic’s Claude. To switch to another provider, follow one of these patterns:

- OpenAI Models
  - Option 1: Use OpenAI's Agent SDK which supports MCP tools. You can find detailed documentation and instructions for integration [here](https://openai.github.io/openai-agents-python/mcp/).
  - Option 2: Alternatively, you can create a bridge to translate your model calls into MCP tool invocations. This approach requires some custom development but offers flexibility if you need it.
- Gemini Models: Replace the Anthropic client with the Gemini SDK. You can find detailed documentation and code samples [here](https://ai.google.dev/gemini-api/docs/function-calling?example=meeting#use_model_context_protocol_mcp).
- Other Models: If you would like to use other LLMs that don't yet support MCP, similar to Option 2 for OpenAI, you will need to write a custom adapter to map tool calls to the MCP endpoints.

## Deployment
Follow standard Shopify app deployment procedures as outlined in the [Shopify documentation](https://shopify.dev/docs/apps/deployment/web).


## Contributing
Please follow the standard Shopify contribution guidelines when making changes to this project.
