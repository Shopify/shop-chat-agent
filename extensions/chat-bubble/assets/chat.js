/**
 * Shop AI Chat - Client-side implementation
 *
 * This module handles the chat interface for the Shopify AI Chat application.
 * It manages the UI interactions, API communication, and message rendering.
 */
(function () {
  "use strict";

  /**
   * Application namespace to prevent global scope pollution
   */
  const ShopAIChat = {
    /**
     * UI-related elements and functionality
     */
    UI: {
      elements: {},
      isMobile: false,

      /**
       * Initialize UI elements and event listeners
       * @param {HTMLElement} container - The main container element
       */
      init: function (container) {
        if (!container) return;

        // Cache DOM elements
        this.elements = {
          container: container,
          chatBubble: container.querySelector(".shop-ai-chat-bubble"),
          chatWindow: container.querySelector(".shop-ai-chat-window"),
          closeButton: container.querySelector(".shop-ai-chat-close"),
          chatInput: container.querySelector(".shop-ai-chat-input input"),
          sendButton: container.querySelector(".shop-ai-chat-send"),
          messagesContainer: container.querySelector(".shop-ai-chat-messages"),
        };

        // Detect mobile device
        this.isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

        // Set up event listeners
        this.setupEventListeners();

        // Fix for iOS Safari viewport height issues
        if (this.isMobile) {
          this.setupMobileViewport();
        }

        // Add this line to set up the options toggle
        this.setupChatBubbleOptions(container);
      },

      /**
       * Set up all event listeners for UI interactions
       */
      setupEventListeners: function () {
        const {
          chatBubble,
          closeButton,
          chatInput,
          sendButton,
          messagesContainer,
        } = this.elements;

        // Toggle chat window visibility
        chatBubble.addEventListener("click", () => this.toggleChatWindow());

        // Close chat window
        closeButton.addEventListener("click", () => this.closeChatWindow());

        // Send message when pressing Enter in input
        chatInput.addEventListener("keypress", (e) => {
          if (e.key === "Enter" && chatInput.value.trim() !== "") {
            ShopAIChat.Message.send(chatInput, messagesContainer);

            // On mobile, handle keyboard
            if (this.isMobile) {
              chatInput.blur();
              setTimeout(() => chatInput.focus(), 300);
            }
          }
        });

        // Send message when clicking send button
        sendButton.addEventListener("click", () => {
          if (chatInput.value.trim() !== "") {
            ShopAIChat.Message.send(chatInput, messagesContainer);

            // On mobile, focus input after sending
            if (this.isMobile) {
              setTimeout(() => chatInput.focus(), 300);
            }
          }
        });

        // Handle window resize to adjust scrolling
        window.addEventListener("resize", () => this.scrollToBottom());

        // Add global click handler for auth links
        document.addEventListener("click", function (event) {
          if (
            event.target &&
            event.target.classList.contains("shop-auth-trigger")
          ) {
            event.preventDefault();
            if (window.shopAuthUrl) {
              ShopAIChat.Auth.openAuthPopup(window.shopAuthUrl);
            }
          }
        });
      },

      /**
       * Setup mobile-specific viewport adjustments
       */
      setupMobileViewport: function () {
        let isTicking = false;
        const setViewportHeight = () => {
          document.documentElement.style.setProperty(
            "--viewport-height",
            `${window.innerHeight}px`,
          );
          isTicking = false;
        };
        window.addEventListener("resize", () => {
          if (!isTicking) {
            window.requestAnimationFrame(setViewportHeight);
            isTicking = true;
          }
        });
        setViewportHeight();
      },

      /**
       * Toggle chat window visibility
       */
      toggleChatWindow: function () {
        const { chatWindow, chatInput } = this.elements;

        chatWindow.classList.toggle("active");

        if (chatWindow.classList.contains("active")) {
          // On mobile, prevent body scrolling and delay focus
          if (this.isMobile) {
            document.body.classList.add("shop-ai-chat-open");
            setTimeout(() => chatInput.focus(), 500);
          } else {
            chatInput.focus();
          }
          // Always scroll messages to bottom when opening
          this.scrollToBottom();
        } else {
          // Remove body class when closing
          document.body.classList.remove("shop-ai-chat-open");
        }
      },

      /**
       * Close chat window
       */
      closeChatWindow: function () {
        const { chatWindow, chatInput } = this.elements;

        chatWindow.classList.remove("active");

        // On mobile, blur input to hide keyboard and enable body scrolling
        if (this.isMobile) {
          chatInput.blur();
          document.body.classList.remove("shop-ai-chat-open");
        }
      },

      /**
       * Scroll messages container to bottom
       */
      scrollToBottom: function () {
        const { messagesContainer } = this.elements;
        // Use requestAnimationFrame and prevent layout thrashing
        // by setting scrollTop to a large value instead of reading scrollHeight
        window.requestAnimationFrame(() => {
          if (messagesContainer) {
            messagesContainer.scrollTop = 9999999;
          }
        });
      },

      /**
       * Show typing indicator in the chat
       */
      showTypingIndicator: function () {
        const { messagesContainer } = this.elements;

        const typingIndicator = document.createElement("div");
        typingIndicator.classList.add("shop-ai-typing-indicator");
        typingIndicator.innerHTML = "<span></span><span></span><span></span>";
        messagesContainer.appendChild(typingIndicator);
        this.scrollToBottom();
      },

      /**
       * Remove typing indicator from the chat
       */
      removeTypingIndicator: function () {
        const { messagesContainer } = this.elements;

        const typingIndicator = messagesContainer.querySelector(
          ".shop-ai-typing-indicator",
        );
        if (typingIndicator) {
          typingIndicator.remove();
        }
      },

      /**
       * Briefly shows a floating confirmation toast over the chat window.
       * Used for actions (like adding to cart from a product card) that
       * don't otherwise produce any visible assistant message.
       * @param {string} message - Text to display
       */
      showCartToast: function (message) {
        const { chatWindow } = this.elements;
        if (!chatWindow) return;

        const toast = document.createElement("div");
        toast.classList.add("shop-ai-cart-toast");
        toast.textContent = message;
        chatWindow.appendChild(toast);

        requestAnimationFrame(() => toast.classList.add("visible"));

        setTimeout(() => {
          toast.classList.remove("visible");
          setTimeout(() => toast.remove(), 300);
        }, 2200);
      },

      /**
       * Display product results in the chat
       * @param {Array} products - Array of product data objects
       */
      displayProductResults: function (products) {
        const { messagesContainer } = this.elements;

        // Create a wrapper for the product section
        const productSection = document.createElement("div");
        productSection.classList.add("shop-ai-product-section");
        messagesContainer.appendChild(productSection);

        // Add a header for the product results
        const header = document.createElement("div");
        header.classList.add("shop-ai-product-header");
        const headerText =
          window.shopChatConfig?.i18n?.topProducts || "Top Matching Products";
        header.innerHTML = `<h4>${headerText}</h4>`;
        productSection.appendChild(header);

        // Create the product grid container
        const productsContainer = document.createElement("div");
        productsContainer.classList.add("shop-ai-product-grid");
        productSection.appendChild(productsContainer);

        if (!products || !Array.isArray(products) || products.length === 0) {
          const noProductsMessage = document.createElement("p");
          const noProductsText =
            window.shopChatConfig?.i18n?.noProducts || "No products found";
          noProductsMessage.textContent = noProductsText;
          noProductsMessage.style.padding = "10px";
          productsContainer.appendChild(noProductsMessage);
        } else {
          products.forEach((product) => {
            const productCard = ShopAIChat.Product.createCard(product);
            productsContainer.appendChild(productCard);
          });
        }

        this.scrollToBottom();
      },

      /**
       * Setup chat bubble options toggle
       * @param {HTMLElement} container - The main container element
       */
      setupChatBubbleOptions: function (container) {
        const mainBubble = container.querySelector(".shop-chat-main-bubble");
        const aiTrigger = container.querySelector(".shop-ai-chat-bubble");

        if (mainBubble) {
          mainBubble.addEventListener("click", (e) => {
            e.stopPropagation(); // Prevent event bubbling
            if (this.elements.chatWindow.classList.contains("active")) { container.classList.remove("open"); this.closeChatWindow(); } else container.classList.toggle("open");
          });
        }

        if (aiTrigger) {
          aiTrigger.addEventListener("click", (e) => {
            e.stopPropagation(); // Prevent event bubbling
            container.classList.remove("open");
          });
        }

        // Close options when clicking outside
        document.addEventListener("click", (e) => {
          if (container.classList.contains("open")) {
            // Check if click is outside the chat interface
            if (!container.contains(e.target)) {
              container.classList.remove("open");
            }
          }
        });

        // Close options on Escape key
        document.addEventListener("keydown", (e) => {
          if (e.key === "Escape") {
            container.classList.remove("open");
            this.closeChatWindow();
          }
        });
      },
    },

    /**
     * Message handling and display functionality
     */
    Message: {
      /**
       * Send a message to the API
       * @param {HTMLInputElement} chatInput - The input element
       * @param {HTMLElement} messagesContainer - The messages container
       */
      send: async function (chatInput, messagesContainer) {
        const userMessage = chatInput.value.trim();
        const conversationId = sessionStorage.getItem("shopAiConversationId");

        this.add(userMessage, "user", messagesContainer);

        chatInput.value = "";

        ShopAIChat.UI.showTypingIndicator();

        try {
          ShopAIChat.API.streamResponse(
            userMessage,
            conversationId,
            messagesContainer,
          );
        } catch (error) {
          console.error("Error communicating with Claude API:", error);
          ShopAIChat.UI.removeTypingIndicator();
          this.add(
            window.shopChatConfig?.i18n?.errorGeneric ||
              "Sorry, I couldn't process your request. Please try again later.",
            "assistant",
            messagesContainer,
          );
        }
      },

      /**
       * Add a message to the chat
       * @param {string} text - Message content
       * @param {string} sender - Message sender ('user' or 'assistant')
       * @param {HTMLElement} messagesContainer - The messages container
       * @returns {HTMLElement} The created message element
       */
      add: function (text, sender, messagesContainer) {
        const messageElement = document.createElement("div");
        messageElement.classList.add("shop-ai-message", sender);

        if (sender === "assistant") {
          messageElement.dataset.rawText = text;
          ShopAIChat.Formatting.formatMessageContent(messageElement);
        } else {
          messageElement.textContent = text;
        }

        messagesContainer.appendChild(messageElement);
        ShopAIChat.UI.scrollToBottom();

        return messageElement;
      },

      /**
       * Add a tool use message to the chat with expandable arguments
       * @param {string} toolMessage - Tool use message content
       * @param {HTMLElement} messagesContainer - The messages container
       */
      addToolUse: function (toolMessage, messagesContainer) {
        // Parse the tool message to extract tool name and arguments
        const match = toolMessage.match(
          /Calling tool: (\w+) with arguments: (.+)/,
        );
        if (!match) {
          // Fallback for unexpected format
          const toolUseElement = document.createElement("div");
          toolUseElement.classList.add("shop-ai-message", "tool-use");
          toolUseElement.textContent = toolMessage;
          messagesContainer.appendChild(toolUseElement);
          ShopAIChat.UI.scrollToBottom();
          return;
        }

        const toolName = match[1];
        const argsString = match[2];

        // Create the main tool use element
        const toolUseElement = document.createElement("div");
        toolUseElement.classList.add("shop-ai-message", "tool-use");

        // Create the header (always visible)
        const headerElement = document.createElement("div");
        headerElement.classList.add("shop-ai-tool-header");

        const toolText = document.createElement("span");
        toolText.classList.add("shop-ai-tool-text");
        toolText.textContent = `Calling tool: ${toolName}`;

        const toggleElement = document.createElement("span");
        toggleElement.classList.add("shop-ai-tool-toggle");
        toggleElement.textContent = "[+]";

        headerElement.appendChild(toolText);
        headerElement.appendChild(toggleElement);

        // Create the arguments section (initially hidden)
        const argsElement = document.createElement("div");
        argsElement.classList.add("shop-ai-tool-args");

        try {
          // Try to format JSON arguments nicely
          const parsedArgs = JSON.parse(argsString);
          argsElement.textContent = JSON.stringify(parsedArgs, null, 2);
        } catch (e) {
          // If not valid JSON, just show as-is
          argsElement.textContent = argsString;
        }

        // Add click handler to toggle arguments visibility
        headerElement.addEventListener("click", function () {
          const isExpanded = argsElement.classList.contains("expanded");
          if (isExpanded) {
            argsElement.classList.remove("expanded");
            toggleElement.textContent = "[+]";
          } else {
            argsElement.classList.add("expanded");
            toggleElement.textContent = "[-]";
          }
        });

        // Assemble the complete element
        toolUseElement.appendChild(headerElement);
        toolUseElement.appendChild(argsElement);

        messagesContainer.appendChild(toolUseElement);
        ShopAIChat.UI.scrollToBottom();
      },
    },

    /**
     * Text formatting and markdown handling
     */
    Formatting: {
      /**
       * Format message content with markdown and links
       * @param {HTMLElement} element - The element to format
       */
      formatMessageContent: function (element) {
        if (!element || !element.dataset.rawText) return;

        const rawText = element.dataset.rawText;

        // Process the text with various Markdown features
        let processedText = rawText;

        // Process Markdown links
        const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
        processedText = processedText.replace(
          markdownLinkRegex,
          (match, text, url) => {
            // Check if it's an auth URL
            if (
              url.includes("shopify.com/authentication") &&
              (url.includes("oauth/authorize") ||
                url.includes("authentication"))
            ) {
              // Store the auth URL in a global variable for later use - this avoids issues with onclick handlers
              window.shopAuthUrl = url;
              // Just return normal link that will be handled by the document click handler
              return (
                '<a href="#auth" class="shop-auth-trigger">' + text + "</a>"
              );
            }
            // If it's a checkout link, replace the text
            else if (url.includes("/cart") || url.includes("checkout")) {
              const checkoutText =
                window.shopChatConfig?.i18n?.checkoutLink ||
                "Click here to proceed to checkout";
              return (
                '<a href="' +
                url +
                '" target="_blank" rel="noopener noreferrer">' +
                checkoutText +
                "</a>"
              );
            } else {
              // For normal links, preserve the original text
              return (
                '<a href="' +
                url +
                '" target="_blank" rel="noopener noreferrer">' +
                text +
                "</a>"
              );
            }
          },
        );

        // Convert text to HTML with proper list handling
        processedText = this.convertMarkdownToHtml(processedText);

        // Apply the formatted HTML
        element.innerHTML = processedText;
      },

      /**
       * Convert Markdown text to HTML with list support
       * @param {string} text - Markdown text to convert
       * @returns {string} HTML content
       */
      convertMarkdownToHtml: function (text) {
        text = text.replace(/(\*\*|__)(.*?)\1/g, "<strong>$2</strong>");
        const lines = text.split("\n");
        let currentList = null;
        let listItems = [];
        let htmlContent = "";
        let startNumber = 1;

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const unorderedMatch = line.match(/^\s*([-*])\s+(.*)/);
          const orderedMatch = line.match(/^\s*(\d+)[\.)]\s+(.*)/);

          if (unorderedMatch) {
            if (currentList !== "ul") {
              if (currentList === "ol") {
                htmlContent +=
                  `<ol start="${startNumber}">` + listItems.join("") + "</ol>";
                listItems = [];
              }
              currentList = "ul";
            }
            listItems.push("<li>" + unorderedMatch[2] + "</li>");
          } else if (orderedMatch) {
            if (currentList !== "ol") {
              if (currentList === "ul") {
                htmlContent += "<ul>" + listItems.join("") + "</ul>";
                listItems = [];
              }
              currentList = "ol";
              startNumber = parseInt(orderedMatch[1], 10);
            }
            listItems.push("<li>" + orderedMatch[2] + "</li>");
          } else {
            if (currentList) {
              htmlContent +=
                currentList === "ul"
                  ? "<ul>" + listItems.join("") + "</ul>"
                  : `<ol start="${startNumber}">` +
                    listItems.join("") +
                    "</ol>";
              listItems = [];
              currentList = null;
            }

            if (line.trim() === "") {
              htmlContent += "<br>";
            } else {
              htmlContent += "<p>" + line + "</p>";
            }
          }
        }

        if (currentList) {
          htmlContent +=
            currentList === "ul"
              ? "<ul>" + listItems.join("") + "</ul>"
              : `<ol start="${startNumber}">` + listItems.join("") + "</ol>";
        }

        htmlContent = htmlContent.replace(/<\/p><p>/g, "</p>\n<p>");
        return htmlContent;
      },
    },

    /**
     * API communication and data handling
     */
    API: {
      /**
       * Stream a response from the API
       * @param {string} userMessage - User's message text
       * @param {string} conversationId - Conversation ID for context
       * @param {HTMLElement} messagesContainer - The messages container
       */
      streamResponse: async function (
        userMessage,
        conversationId,
        messagesContainer,
      ) {
        let currentMessageElement = null;

        try {
          const promptType =
            window.shopChatConfig?.promptType || "standardAssistant";
          const requestBody = JSON.stringify({
            message: userMessage,
            conversation_id: conversationId,
            prompt_type: promptType,
          });

          const streamUrl =
            window.shopChatConfig?.apiUrl ||
            (location.hostname === "localhost"
              ? "https://localhost:3458/chat"
              : "https://shop-chat-agent-lively-fog-4926.fly.dev/chat");

          // Fix: Define shopId from config or fallback
          const shopId = window.shopChatConfig?.shopId || "";

          // Fix: Use streamUrl as base for historyUrl
          const historyUrl = streamUrl;
          const fullHistoryUrl = `${historyUrl}?history=true&conversation_id=${encodeURIComponent(conversationId)}`;
          console.log("Fetching history from:", fullHistoryUrl);

          const response = await fetch(streamUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "text/event-stream",
              "X-Shopify-Shop-Id": shopId,
            },
            body: requestBody,
          });
          console.log("response", JSON.stringify(response, null, 2));

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";

          // Create initial message element
          let messageElement = document.createElement("div");
          messageElement.classList.add("shop-ai-message", "assistant");
          messageElement.textContent = "";
          messageElement.dataset.rawText = "";
          messagesContainer.appendChild(messageElement);
          currentMessageElement = messageElement;

          // Process the stream
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                try {
                  const data = JSON.parse(line.slice(6));
                  this.handleStreamEvent(
                    data,
                    currentMessageElement,
                    messagesContainer,
                    userMessage,
                    (newElement) => {
                      currentMessageElement = newElement;
                    },
                  );
                } catch (e) {
                  console.error("Error parsing event data:", e, line);
                }
              }
            }
          }
        } catch (error) {
          console.error("Error in streaming:", error);
          ShopAIChat.UI.removeTypingIndicator();
          ShopAIChat.Message.add(
            window.shopChatConfig?.i18n?.errorGeneric ||
              "Sorry, I couldn't process your request. Please try again later.",
            "assistant",
            messagesContainer,
          );
        }
      },

      /**
       * Handle stream events from the API
       * @param {Object} data - Event data
       * @param {HTMLElement} currentMessageElement - Current message element being updated
       * @param {HTMLElement} messagesContainer - The messages container
       * @param {string} userMessage - The original user message
       * @param {Function} updateCurrentElement - Callback to update the current element reference
       */
      handleStreamEvent: function (
        data,
        currentMessageElement,
        messagesContainer,
        userMessage,
        updateCurrentElement,
      ) {
        switch (data.type) {
          case "id":
            if (data.conversation_id) {
              sessionStorage.setItem(
                "shopAiConversationId",
                data.conversation_id,
              );
            }
            break;

          case "chunk":
            ShopAIChat.UI.removeTypingIndicator();
            currentMessageElement.dataset.rawText += data.chunk;
            currentMessageElement.textContent =
              currentMessageElement.dataset.rawText;
            ShopAIChat.UI.scrollToBottom();
            break;

          case "message_complete":
            ShopAIChat.UI.removeTypingIndicator();
            ShopAIChat.Formatting.formatMessageContent(currentMessageElement);
            ShopAIChat.UI.scrollToBottom();
            break;

          case "end_turn":
            ShopAIChat.UI.removeTypingIndicator();
            break;

          case "error":
            console.error("Stream error:", data.error);
            ShopAIChat.UI.removeTypingIndicator();
            currentMessageElement.textContent =
              window.shopChatConfig?.i18n?.errorGeneric ||
              "Sorry, I couldn't process your request. Please try again later.";
            break;

          case "rate_limit_exceeded":
            console.error("Rate limit exceeded:", data.error);
            ShopAIChat.UI.removeTypingIndicator();
            currentMessageElement.textContent =
              window.shopChatConfig?.i18n?.errorBusy ||
              "Sorry, our servers are currently busy. Please try again later.";
            break;

          case "auth_required":
            // Save the last user message for resuming after authentication
            sessionStorage.setItem("shopAiLastMessage", userMessage || "");
            break;

          case "product_results":
            ShopAIChat.UI.displayProductResults(data.products);
            break;

          case "cart_add":
            ShopAIChat.Cart.handleCartAdd(data.actions, messagesContainer);
            break;

          case "tool_use":
            if (data.tool_use_message) {
              ShopAIChat.Message.addToolUse(
                data.tool_use_message,
                messagesContainer,
              );
            }
            break;

          case "new_message":
            ShopAIChat.Formatting.formatMessageContent(currentMessageElement);
            ShopAIChat.UI.showTypingIndicator();

            // Create new message element for the next response
            const newMessageElement = document.createElement("div");
            newMessageElement.classList.add("shop-ai-message", "assistant");
            newMessageElement.textContent = "";
            newMessageElement.dataset.rawText = "";
            messagesContainer.appendChild(newMessageElement);

            // Update the current element reference
            updateCurrentElement(newMessageElement);
            break;

          case "content_block_complete":
            ShopAIChat.UI.showTypingIndicator();
            break;
        }
      },

      /**
       * Fetch chat history from the server
       * @param {string} conversationId - Conversation ID
       * @param {HTMLElement} messagesContainer - The messages container
       */
      fetchChatHistory: async function (conversationId, messagesContainer) {
        try {
          // Show a loading message
          const loadingMessage = document.createElement("div");
          loadingMessage.classList.add("shop-ai-message", "assistant");
          loadingMessage.textContent = "Loading conversation history...";
          messagesContainer.appendChild(loadingMessage);

          // Fetch history from the server
          const historyUrl =
            window.shopChatConfig?.apiUrl ||
            (location.hostname === "localhost"
              ? "https://localhost:3458/chat"
              : "https://shop-chat-agent-lively-fog-4926.fly.dev/chat");
          const fullHistoryUrl = `${historyUrl}?history=true&conversation_id=${encodeURIComponent(conversationId)}`;
          console.log("Fetching history from:", fullHistoryUrl);

          const response = await fetch(fullHistoryUrl, {
            method: "GET",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
            },
            mode: "cors",
          });

          if (!response.ok) {
            console.error(
              "History fetch failed:",
              response.status,
              response.statusText,
            );
            throw new Error("Failed to fetch chat history: " + response.status);
          }

          const data = await response.json();

          // Remove loading message
          messagesContainer.removeChild(loadingMessage);

          // No messages, show welcome message
          if (!data.messages || data.messages.length === 0) {
            const welcomeMessage =
              window.shopChatConfig?.welcomeMessage ||
              "👋 Hi there! How can I help you today?";
            ShopAIChat.Message.add(
              welcomeMessage,
              "assistant",
              messagesContainer,
            );
            return;
          }

          // Add messages to the UI - filter out tool results
          data.messages.forEach((message) => {
            try {
              const messageContents = JSON.parse(message.content);
              for (const contentBlock of messageContents) {
                if (contentBlock.type === "text") {
                  ShopAIChat.Message.add(
                    contentBlock.text,
                    message.role,
                    messagesContainer,
                  );
                }
              }
            } catch (e) {
              ShopAIChat.Message.add(
                message.content,
                message.role,
                messagesContainer,
              );
            }
          });

          // Scroll to bottom
          ShopAIChat.UI.scrollToBottom();
        } catch (error) {
          console.error("Error fetching chat history:", error);

          // Remove loading message if it exists
          const loadingMessage = messagesContainer.querySelector(
            ".shop-ai-message.assistant",
          );
          if (
            loadingMessage &&
            loadingMessage.textContent === "Loading conversation history..."
          ) {
            messagesContainer.removeChild(loadingMessage);
          }

          // Show error and welcome message
          const welcomeMessage =
            window.shopChatConfig?.welcomeMessage ||
            "👋 Hi there! How can I help you today?";
          ShopAIChat.Message.add(
            welcomeMessage,
            "assistant",
            messagesContainer,
          );

          // Clear the conversation ID since we couldn't fetch this conversation
          sessionStorage.removeItem("shopAiConversationId");
        }
      },
    },

    /**
     * Writes chat-driven add-to-cart actions to the shopper's real storefront
     * cart via Shopify's AJAX Cart API, then refreshes the visible cart icon.
     * The backend never writes to Shopify's cart directly — see add_to_cart
     * local tool — so this is the only place the real cart is mutated.
     */
    Cart: {
      /**
       * @param {Array<{variant_id: string, quantity: number}>} actions
       * @param {HTMLElement} messagesContainer
       */
      handleCartAdd: async function (actions, messagesContainer) {
        if (!Array.isArray(actions) || actions.length === 0) return;

        const root = window.Shopify?.routes?.root || "/";
        const items = actions.map((action) => ({
          // variant_id may arrive as a plain numeric id (from the backend's
          // add_to_cart tool) or as a GID like
          // "gid://shopify/ProductVariant/123" (from a product card, which
          // gets it straight from search_catalog). Shopify GIDs encode the
          // same numeric id as their trailing path segment, so this is safe
          // for either shape.
          id: Number(String(action.variant_id).split("/").pop()),
          quantity: action.quantity || 1,
        }));

        try {
          const response = await fetch(root + "cart/add.js", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify({ items }),
          });

          const result = await response.json();

          if (!response.ok) {
            console.error("Failed to add item to cart:", result);
            ShopAIChat.Message.add(
              result.description ||
                window.shopChatConfig?.i18n?.cartAddError ||
                "Не вдалося додати товар у кошик. Спробуйте ще раз.",
              "assistant",
              messagesContainer,
            );
            return;
          }

          await this.refreshCartIcon();
          ShopAIChat.UI.showCartToast(
            window.shopChatConfig?.i18n?.cartAddSuccess || "Додано в кошик!",
          );
        } catch (error) {
          console.error("Error adding to real cart:", error);
        }
      },

      /**
       * Refreshes the theme's cart icon badge and cart drawer contents via
       * Shopify's Section Rendering API, mirroring how Dawn's own add-to-cart
       * flow keeps them in sync. Only swaps text/inner content of known
       * pieces (not whole elements) so it doesn't disturb this store's
       * customized header/drawer markup or detach Dawn's <cart-drawer>
       * custom element instance. Falls back to a best-effort /cart.js-based
       * badge update if section rendering doesn't return usable markup.
       */
      refreshCartIcon: async function () {
        const root = window.Shopify?.routes?.root || "/";

        try {
          const response = await fetch(
            root + "?sections=cart-icon-bubble,cart-drawer",
          );
          if (response.ok) {
            const data = await response.json();
            const badgeUpdated = this.applyCartIconBadge(data["cart-icon-bubble"]);
            const drawerUpdated = this.applyCartDrawer(data["cart-drawer"]);
            if (badgeUpdated || drawerUpdated) return;
          }
        } catch (error) {
          console.error("Cart section refresh failed, falling back:", error);
        }

        try {
          const cart = await (await fetch(root + "cart.js")).json();
          document
            .querySelectorAll(
              ".header-cart__badge, .cart-count-bubble, [data-cart-count], .cart-count",
            )
            .forEach((el) => {
              el.textContent = cart.item_count;
            });
        } catch (error) {
          console.error("Fallback cart count refresh failed:", error);
        }
      },

      /**
       * @param {string} html - Rendered cart-icon-bubble section markup
       * @returns {boolean} Whether the live badge was updated
       */
      applyCartIconBadge: function (html) {
        if (!html) return false;
        const temp = document.createElement("div");
        temp.innerHTML = html;
        const newBadge = temp.querySelector(".header-cart__badge");
        const liveBadges = document.querySelectorAll(".header-cart__badge");
        if (!newBadge || liveBadges.length === 0) return false;
        liveBadges.forEach((el) => {
          el.textContent = newBadge.textContent;
        });
        return true;
      },

      /**
       * Syncs Dawn's <cart-drawer> the same way its own cart.js does: swap
       * .drawer__inner's content and toggle the is-empty class on the outer
       * custom element, leaving the element instance itself in place.
       * @param {string} html - Rendered cart-drawer section markup
       * @returns {boolean} Whether the live drawer was updated
       */
      applyCartDrawer: function (html) {
        if (!html) return false;
        const temp = document.createElement("div");
        temp.innerHTML = html;

        const sourceDrawer = temp.querySelector("cart-drawer");
        const sourceInner = sourceDrawer?.querySelector(".drawer__inner");
        const targetDrawer = document.querySelector("cart-drawer");
        const targetInner = targetDrawer?.querySelector(".drawer__inner");

        if (!sourceDrawer || !sourceInner || !targetDrawer || !targetInner) {
          return false;
        }

        targetDrawer.classList.toggle(
          "is-empty",
          sourceDrawer.classList.contains("is-empty"),
        );
        targetInner.innerHTML = sourceInner.innerHTML;
        return true;
      },
    },

    /**
     * Authentication-related functionality
     */
    Auth: {
      /**
       * Opens an authentication popup window
       * @param {string|HTMLElement} authUrlOrElement - The auth URL or link element that was clicked
       */
      openAuthPopup: function (authUrlOrElement) {
        let authUrl;
        if (typeof authUrlOrElement === "string") {
          // If a string URL was passed directly
          authUrl = authUrlOrElement;
        } else {
          // If an element was passed
          authUrl = authUrlOrElement.getAttribute("data-auth-url");
          if (!authUrl) {
            console.error("No auth URL found in element");
            return;
          }
        }

        // Open the popup window centered in the screen
        const width = 600;
        const height = 700;
        const left = (window.innerWidth - width) / 2 + window.screenX;
        const top = (window.innerHeight - height) / 2 + window.screenY;

        const popup = window.open(
          authUrl,
          "ShopifyAuth",
          `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`,
        );

        // Focus the popup window
        if (popup) {
          popup.focus();
        } else {
          // If popup was blocked, show a message
          alert(
            "Please allow popups for this site to authenticate with Shopify.",
          );
        }

        // Start polling for token availability
        const conversationId = sessionStorage.getItem("shopAiConversationId");
        if (conversationId) {
          const messagesContainer = document.querySelector(
            ".shop-ai-chat-messages",
          );

          // Add a message to indicate authentication is in progress
          ShopAIChat.Message.add(
            "Authentication in progress. Please complete the process in the popup window.",
            "assistant",
            messagesContainer,
          );

          this.startTokenPolling(conversationId, messagesContainer);
        }
      },

      /**
       * Start polling for token availability
       * @param {string} conversationId - Conversation ID
       * @param {HTMLElement} messagesContainer - The messages container
       */
      startTokenPolling: function (conversationId, messagesContainer) {
        if (!conversationId) return;

        console.log("Starting token polling for conversation:", conversationId);
        const pollingId = "polling_" + Date.now();
        sessionStorage.setItem("shopAiTokenPollingId", pollingId);

        let attemptCount = 0;
        const maxAttempts = 30;

        const poll = async () => {
          if (sessionStorage.getItem("shopAiTokenPollingId") !== pollingId) {
            console.log(
              "Another polling session has started, stopping this one",
            );
            return;
          }

          if (attemptCount >= maxAttempts) {
            console.log("Max polling attempts reached, stopping");
            return;
          }

          attemptCount++;

          try {
            const tokenUrl =
              "https://localhost:3458/auth/token-status?conversation_id=" +
              encodeURIComponent(conversationId);
            const response = await fetch(tokenUrl);

            if (!response.ok) {
              throw new Error("Token status check failed: " + response.status);
            }

            const data = await response.json();

            if (data.status === "authorized") {
              console.log("Token available, resuming conversation");
              const message = sessionStorage.getItem("shopAiLastMessage");

              if (message) {
                sessionStorage.removeItem("shopAiLastMessage");
                setTimeout(() => {
                  ShopAIChat.Message.add(
                    "Authorization successful! I'm now continuing with your request.",
                    "assistant",
                    messagesContainer,
                  );
                  ShopAIChat.API.streamResponse(
                    message,
                    conversationId,
                    messagesContainer,
                  );
                  ShopAIChat.UI.showTypingIndicator();
                }, 500);
              }

              sessionStorage.removeItem("shopAiTokenPollingId");
              return;
            }

            console.log("Token not available yet, polling again in 10s");
            setTimeout(poll, 10000);
          } catch (error) {
            console.error("Error polling for token status:", error);
            setTimeout(poll, 10000);
          }
        };

        setTimeout(poll, 2000);
      },
    },

    /**
     * Product-related functionality
     */
    Product: {
      /**
       * Create a product card element
       * @param {Object} product - Product data
       * @returns {HTMLElement} Product card element
       */
      createCard: function (product) {
        const card = document.createElement("div");
        card.classList.add("shop-ai-product-card");

        // Create image container
        const imageContainer = document.createElement("div");
        imageContainer.classList.add("shop-ai-product-image");

        // Add product image or placeholder
        const image = document.createElement("img");
        image.src =
          product.image_url ||
          "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_large.png";
        image.alt = product.title;
        image.onerror = function () {
          // If image fails to load, use a fallback placeholder
          this.src =
            "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_large.png";
        };
        imageContainer.appendChild(image);
        card.appendChild(imageContainer);

        // Add product info
        const info = document.createElement("div");
        info.classList.add("shop-ai-product-info");

        // Add product title
        const title = document.createElement("h3");
        title.classList.add("shop-ai-product-title");
        title.textContent = product.title;

        // If product has a URL, make the title a link
        if (product.url) {
          const titleLink = document.createElement("a");
          titleLink.href = product.url;
          titleLink.target = "_blank";
          titleLink.textContent = product.title;
          title.textContent = "";
          title.appendChild(titleLink);
        }

        info.appendChild(title);

        // Add product price
        const price = document.createElement("p");
        price.classList.add("shop-ai-product-price");
        price.textContent = product.price;
        info.appendChild(price);

        // Add add-to-cart button
        const button = document.createElement("button");
        button.classList.add("shop-ai-add-to-cart");
        button.textContent =
          window.shopChatConfig?.i18n?.addToCart || "Додати в корзину";
        button.dataset.productId = product.id;

        // Add click handler for the button
        button.addEventListener("click", function () {
          if (product.variant_id) {
            // Write directly to the real storefront cart, no LLM round-trip needed
            ShopAIChat.Cart.handleCartAdd(
              [{ variant_id: product.variant_id, quantity: 1 }],
              ShopAIChat.UI.elements.messagesContainer,
            );
            return;
          }

          // Fallback: no variant id resolved, let the assistant handle it
          const input = document.querySelector(".shop-ai-chat-input input");
          if (input) {
            input.value = `Add ${product.title} to my cart`;
            const sendButton = document.querySelector(".shop-ai-chat-send");
            if (sendButton) {
              sendButton.click();
            }
          }
        });

        info.appendChild(button);
        card.appendChild(info);

        return card;
      },
    },

    /**
     * Initialize the chat application
     */
    init: function () {
      // Initialize UI
      const container = document.querySelector(".shop-chat-interface");
      if (!container) return;

      this.UI.init(container);

      // Check for existing conversation
      const conversationId = sessionStorage.getItem("shopAiConversationId");

      if (conversationId) {
        // Fetch conversation history
        this.API.fetchChatHistory(
          conversationId,
          this.UI.elements.messagesContainer,
        );
      } else {
        // No previous conversation, show welcome message
        const welcomeMessage =
          window.shopChatConfig?.welcomeMessage ||
          "👋 Привіт! Чим можу тобі допомогти сьогодні?";
        this.Message.add(
          welcomeMessage,
          "assistant",
          this.UI.elements.messagesContainer,
        );
      }
    },
  };

  // Initialize the application when DOM is ready
  document.addEventListener("DOMContentLoaded", function () {
    ShopAIChat.init();
  });
})();
