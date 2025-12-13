/**
 * Shop AI Chat - Client-side implementation
 *
 * This module handles the chat interface for the Shopify AI Chat application.
 * It manages the UI interactions, API communication, and message rendering.
 */
(function() {
  'use strict';

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
      init: function(container) {
        if (!container) return;

        // Cache DOM elements
        this.elements = {
          container: container,
          chatBubble: container.querySelector('.shop-ai-chat-bubble'),
          chatWindow: container.querySelector('.shop-ai-chat-window'),
          closeButton: container.querySelector('.shop-ai-chat-close'),
          chatInput: container.querySelector('.shop-ai-chat-input input'),
          sendButton: container.querySelector('.shop-ai-chat-send'),
          messagesContainer: container.querySelector('.shop-ai-chat-messages'),
          userButton: container.querySelector('.shop-ai-user-btn'),
          settingsButton: container.querySelector('.shop-ai-settings-btn')
        };

        // Detect mobile device
        this.isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

        // Set up event listeners
        this.setupEventListeners();

        // Fix for iOS Safari viewport height issues
        if (this.isMobile) {
          this.setupMobileViewport();
        }
      },

      /**
       * Set up all event listeners for UI interactions
       */
      setupEventListeners: function() {
        const { chatBubble, closeButton, chatInput, sendButton, messagesContainer, userButton, settingsButton } = this.elements;

        // Toggle chat window visibility
        chatBubble.addEventListener('click', () => this.toggleChatWindow());

        // Close chat window
        closeButton.addEventListener('click', () => this.closeChatWindow());

        // User button - login/logout
        if (userButton) {
          userButton.addEventListener('click', () => {
            if (ShopAIChat.User.isLoggedIn()) {
              // Show user menu
              this.showUserMenu();
            } else {
              ShopAIChat.User.showAuthModal('login');
            }
          });
        }

        // Settings button
        if (settingsButton) {
          settingsButton.addEventListener('click', () => {
            ShopAIChat.Settings.showPanel();
          });
        }

        // Send message when pressing Enter in input
        chatInput.addEventListener('keypress', (e) => {
          if (e.key === 'Enter' && chatInput.value.trim() !== '') {
            ShopAIChat.Message.send(chatInput, messagesContainer);

            // On mobile, handle keyboard
            if (this.isMobile) {
              chatInput.blur();
              setTimeout(() => chatInput.focus(), 300);
            }
          }
        });

        // Send message when clicking send button
        sendButton.addEventListener('click', () => {
          if (chatInput.value.trim() !== '') {
            ShopAIChat.Message.send(chatInput, messagesContainer);

            // On mobile, focus input after sending
            if (this.isMobile) {
              setTimeout(() => chatInput.focus(), 300);
            }
          }
        });

        // Handle window resize to adjust scrolling
        window.addEventListener('resize', () => this.scrollToBottom());

        // Add global click handler for auth links
        document.addEventListener('click', function(event) {
          if (event.target && event.target.classList.contains('shop-auth-trigger')) {
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
      setupMobileViewport: function() {
        const setViewportHeight = () => {
          document.documentElement.style.setProperty('--viewport-height', `${window.innerHeight}px`);
        };
        window.addEventListener('resize', setViewportHeight);
        setViewportHeight();
      },

      /**
       * Toggle chat window visibility
       */
      toggleChatWindow: function() {
        const { chatWindow, chatInput } = this.elements;

        chatWindow.classList.toggle('active');

        if (chatWindow.classList.contains('active')) {
          // On mobile, prevent body scrolling and delay focus
          if (this.isMobile) {
            document.body.classList.add('shop-ai-chat-open');
            setTimeout(() => chatInput.focus(), 500);
          } else {
            chatInput.focus();
          }
          // Always scroll messages to bottom when opening
          this.scrollToBottom();
        } else {
          // Remove body class when closing
          document.body.classList.remove('shop-ai-chat-open');
        }
      },

      /**
       * Close chat window
       */
      closeChatWindow: function() {
        const { chatWindow, chatInput } = this.elements;

        chatWindow.classList.remove('active');

        // On mobile, blur input to hide keyboard and enable body scrolling
        if (this.isMobile) {
          chatInput.blur();
          document.body.classList.remove('shop-ai-chat-open');
        }
      },

      /**
       * Scroll messages container to bottom
       */
      scrollToBottom: function() {
        const { messagesContainer } = this.elements;
        setTimeout(() => {
          messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }, 100);
      },

      /**
       * Show typing indicator in the chat
       */
      showTypingIndicator: function() {
        const { messagesContainer } = this.elements;

        const typingIndicator = document.createElement('div');
        typingIndicator.classList.add('shop-ai-typing-indicator');
        typingIndicator.innerHTML = '<span></span><span></span><span></span>';
        messagesContainer.appendChild(typingIndicator);
        this.scrollToBottom();
      },

      /**
       * Remove typing indicator from the chat
       */
      removeTypingIndicator: function() {
        const { messagesContainer } = this.elements;

        const typingIndicator = messagesContainer.querySelector('.shop-ai-typing-indicator');
        if (typingIndicator) {
          typingIndicator.remove();
        }
      },

      /**
       * Update user button appearance based on login state
       */
      updateUserButton: function() {
        const { userButton } = this.elements;
        if (!userButton) return;

        if (ShopAIChat.User.isLoggedIn()) {
          userButton.classList.add('logged-in');
          userButton.title = ShopAIChat.User.username;
        } else {
          userButton.classList.remove('logged-in');
          userButton.title = '登录';
        }
      },

      /**
       * Show user menu (for logged in users)
       */
      showUserMenu: function() {
        // Remove existing menu if any
        const existingMenu = document.querySelector('.shop-ai-user-menu');
        if (existingMenu) {
          existingMenu.remove();
          return;
        }

        const { userButton } = this.elements;
        const rect = userButton.getBoundingClientRect();

        const menu = document.createElement('div');
        menu.classList.add('shop-ai-user-menu');
        menu.innerHTML = `
          <div class="shop-ai-user-info">
            <span class="shop-ai-user-name">${ShopAIChat.User.username}</span>
          </div>
          <div class="shop-ai-user-menu-item" data-action="settings">提示词设置</div>
          <div class="shop-ai-user-menu-item" data-action="logout">退出登录</div>
        `;

        menu.style.position = 'fixed';
        menu.style.top = (rect.bottom + 5) + 'px';
        menu.style.right = (window.innerWidth - rect.right) + 'px';

        document.body.appendChild(menu);

        // Event handlers
        menu.querySelectorAll('.shop-ai-user-menu-item').forEach(item => {
          item.addEventListener('click', () => {
            const action = item.dataset.action;
            if (action === 'settings') {
              ShopAIChat.Settings.showPanel();
            } else if (action === 'logout') {
              ShopAIChat.User.logout();
              const messagesContainer = ShopAIChat.UI.elements.messagesContainer;
              ShopAIChat.Message.add('您已退出登录', 'assistant', messagesContainer);
            }
            menu.remove();
          });
        });

        // Close menu when clicking outside
        setTimeout(() => {
          document.addEventListener('click', function closeMenu(e) {
            if (!menu.contains(e.target) && e.target !== userButton) {
              menu.remove();
              document.removeEventListener('click', closeMenu);
            }
          });
        }, 0);
      },

      /**
       * Display product results in the chat
       * @param {Array} products - Array of product data objects
       */
      displayProductResults: function(products) {
        const { messagesContainer } = this.elements;

        // Create a wrapper for the product section
        const productSection = document.createElement('div');
        productSection.classList.add('shop-ai-product-section');
        messagesContainer.appendChild(productSection);

        // Add a header for the product results
        const header = document.createElement('div');
        header.classList.add('shop-ai-product-header');
        header.innerHTML = '<h4>Top Matching Products</h4>';
        productSection.appendChild(header);

        // Create the product grid container
        const productsContainer = document.createElement('div');
        productsContainer.classList.add('shop-ai-product-grid');
        productSection.appendChild(productsContainer);

        if (!products || !Array.isArray(products) || products.length === 0) {
          const noProductsMessage = document.createElement('p');
          noProductsMessage.textContent = "No products found";
          noProductsMessage.style.padding = "10px";
          productsContainer.appendChild(noProductsMessage);
        } else {
          products.forEach(product => {
            const productCard = ShopAIChat.Product.createCard(product);
            productsContainer.appendChild(productCard);
          });
        }

        this.scrollToBottom();
      }
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
      send: async function(chatInput, messagesContainer) {
        const userMessage = chatInput.value.trim();
        const conversationId = sessionStorage.getItem('shopAiConversationId');

        // Add user message to chat
        this.add(userMessage, 'user', messagesContainer);

        // Clear input
        chatInput.value = '';

        // Show typing indicator
        ShopAIChat.UI.showTypingIndicator();

        try {
          ShopAIChat.API.streamResponse(userMessage, conversationId, messagesContainer);
        } catch (error) {
          console.error('Error communicating with Claude API:', error);
          ShopAIChat.UI.removeTypingIndicator();
          this.add("Sorry, I couldn't process your request at the moment. Please try again later.", 'assistant', messagesContainer);
        }
      },

      /**
       * Add a message to the chat
       * @param {string} text - Message content
       * @param {string} sender - Message sender ('user' or 'assistant')
       * @param {HTMLElement} messagesContainer - The messages container
       * @returns {HTMLElement} The created message element
       */
      add: function(text, sender, messagesContainer) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('shop-ai-message', sender);

        if (sender === 'assistant') {
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
      addToolUse: function(toolMessage, messagesContainer) {
        // Parse the tool message to extract tool name and arguments
        const match = toolMessage.match(/Calling tool: (\w+) with arguments: (.+)/);
        if (!match) {
          // Fallback for unexpected format
          const toolUseElement = document.createElement('div');
          toolUseElement.classList.add('shop-ai-message', 'tool-use');
          toolUseElement.textContent = toolMessage;
          messagesContainer.appendChild(toolUseElement);
          ShopAIChat.UI.scrollToBottom();
          return;
        }

        const toolName = match[1];
        const argsString = match[2];

        // Create the main tool use element
        const toolUseElement = document.createElement('div');
        toolUseElement.classList.add('shop-ai-message', 'tool-use');

        // Create the header (always visible)
        const headerElement = document.createElement('div');
        headerElement.classList.add('shop-ai-tool-header');

        const toolText = document.createElement('span');
        toolText.classList.add('shop-ai-tool-text');
        toolText.textContent = `Calling tool: ${toolName}`;

        const toggleElement = document.createElement('span');
        toggleElement.classList.add('shop-ai-tool-toggle');
        toggleElement.textContent = '[+]';

        headerElement.appendChild(toolText);
        headerElement.appendChild(toggleElement);

        // Create the arguments section (initially hidden)
        const argsElement = document.createElement('div');
        argsElement.classList.add('shop-ai-tool-args');

        try {
          // Try to format JSON arguments nicely
          const parsedArgs = JSON.parse(argsString);
          argsElement.textContent = JSON.stringify(parsedArgs, null, 2);
        } catch (e) {
          // If not valid JSON, just show as-is
          argsElement.textContent = argsString;
        }

        // Add click handler to toggle arguments visibility
        headerElement.addEventListener('click', function() {
          const isExpanded = argsElement.classList.contains('expanded');
          if (isExpanded) {
            argsElement.classList.remove('expanded');
            toggleElement.textContent = '[+]';
          } else {
            argsElement.classList.add('expanded');
            toggleElement.textContent = '[-]';
          }
        });

        // Assemble the complete element
        toolUseElement.appendChild(headerElement);
        toolUseElement.appendChild(argsElement);

        messagesContainer.appendChild(toolUseElement);
        ShopAIChat.UI.scrollToBottom();
      }
    },

    /**
     * Text formatting and markdown handling
     */
    Formatting: {
      /**
       * Format message content with markdown and links
       * @param {HTMLElement} element - The element to format
       */
      formatMessageContent: function(element) {
        if (!element || !element.dataset.rawText) return;

        const rawText = element.dataset.rawText;

        // Process the text with various Markdown features
        let processedText = rawText;

        // Process Markdown links
        const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
        processedText = processedText.replace(markdownLinkRegex, (match, text, url) => {
          // Check if it's an auth URL
          if (url.includes('shopify.com/authentication') &&
             (url.includes('oauth/authorize') || url.includes('authentication'))) {
            // Store the auth URL in a global variable for later use - this avoids issues with onclick handlers
            window.shopAuthUrl = url;
            // Just return normal link that will be handled by the document click handler
            return '<a href="#auth" class="shop-auth-trigger">' + text + '</a>';
          }
          // If it's a checkout link, replace the text
          else if (url.includes('/cart') || url.includes('checkout')) {
            return '<a href="' + url + '" target="_blank" rel="noopener noreferrer">click here to proceed to checkout</a>';
          } else {
            // For normal links, preserve the original text
            return '<a href="' + url + '" target="_blank" rel="noopener noreferrer">' + text + '</a>';
          }
        });

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
      convertMarkdownToHtml: function(text) {
        text = text.replace(/(\*\*|__)(.*?)\1/g, '<strong>$2</strong>');
        const lines = text.split('\n');
        let currentList = null;
        let listItems = [];
        let htmlContent = '';
        let startNumber = 1;

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const unorderedMatch = line.match(/^\s*([-*])\s+(.*)/);
          const orderedMatch = line.match(/^\s*(\d+)[\.)]\s+(.*)/);

          if (unorderedMatch) {
            if (currentList !== 'ul') {
              if (currentList === 'ol') {
                htmlContent += `<ol start="${startNumber}">` + listItems.join('') + '</ol>';
                listItems = [];
              }
              currentList = 'ul';
            }
            listItems.push('<li>' + unorderedMatch[2] + '</li>');
          } else if (orderedMatch) {
            if (currentList !== 'ol') {
              if (currentList === 'ul') {
                htmlContent += '<ul>' + listItems.join('') + '</ul>';
                listItems = [];
              }
              currentList = 'ol';
              startNumber = parseInt(orderedMatch[1], 10);
            }
            listItems.push('<li>' + orderedMatch[2] + '</li>');
          } else {
            if (currentList) {
              htmlContent += currentList === 'ul'
                ? '<ul>' + listItems.join('') + '</ul>'
                : `<ol start="${startNumber}">` + listItems.join('') + '</ol>';
              listItems = [];
              currentList = null;
            }

            if (line.trim() === '') {
              htmlContent += '<br>';
            } else {
              htmlContent += '<p>' + line + '</p>';
            }
          }
        }

        if (currentList) {
          htmlContent += currentList === 'ul'
            ? '<ul>' + listItems.join('') + '</ul>'
            : `<ol start="${startNumber}">` + listItems.join('') + '</ol>';
        }

        htmlContent = htmlContent.replace(/<\/p><p>/g, '</p>\n<p>');
        return htmlContent;
      }
    },

    /**
     * API communication and data handling
     */
    API: {
      /**
       * Get base URL for API requests.
       * Prefer a configurable value from shopChatConfig, otherwise fall back to localhost.
       * Trailing slashes are removed to simplify path concatenation.
       * @returns {string}
       */
      getApiBaseUrl: function() {
        const configuredBaseUrl = window.shopChatConfig?.apiBaseUrl;
        const baseUrl = configuredBaseUrl && configuredBaseUrl.trim().length > 0
          ? configuredBaseUrl.trim()
          : 'https://localhost:3458';

        // Remove trailing slash if present
        return baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
      },
      /**
       * Stream a response from the API
       * @param {string} userMessage - User's message text
       * @param {string} conversationId - Conversation ID for context
       * @param {HTMLElement} messagesContainer - The messages container
       */
      streamResponse: async function(userMessage, conversationId, messagesContainer) {
        let currentMessageElement = null;

        try {
          const promptType = window.shopChatConfig?.promptType || "standardAssistant";
          const customSystemPrompt = window.shopChatConfig?.customSystemPrompt || "";
          
          // 构建请求体，如果用户已登录则包含 user_id
          const requestData = {
            message: userMessage,
            conversation_id: conversationId,
            prompt_type: promptType,
            system_prompt_override: customSystemPrompt && customSystemPrompt.trim() !== ''
              ? customSystemPrompt
              : undefined
          };

          // 如果用户已登录，添加 user_id（让后端加载用户专属提示词）
          if (ShopAIChat.User.isLoggedIn()) {
            requestData.user_id = ShopAIChat.User.userId;
          }

          const requestBody = JSON.stringify(requestData);

          const streamUrl = this.getApiBaseUrl() + '/chat';
          const shopId = window.shopId;

          const response = await fetch(streamUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'text/event-stream',
              'X-Shopify-Shop-Id': shopId
            },
            body: requestBody
          });

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';

          // Create initial message element
          let messageElement = document.createElement('div');
          messageElement.classList.add('shop-ai-message', 'assistant');
          messageElement.textContent = '';
          messageElement.dataset.rawText = '';
          messagesContainer.appendChild(messageElement);
          currentMessageElement = messageElement;

          // Process the stream
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6));
                  this.handleStreamEvent(data, currentMessageElement, messagesContainer, userMessage,
                    (newElement) => { currentMessageElement = newElement; });
                } catch (e) {
                  console.error('Error parsing event data:', e, line);
                }
              }
            }
          }
        } catch (error) {
          console.error('Error in streaming:', error);
          ShopAIChat.UI.removeTypingIndicator();
          ShopAIChat.Message.add("Sorry, I couldn't process your request. Please try again later.",
            'assistant', messagesContainer);
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
      handleStreamEvent: function(data, currentMessageElement, messagesContainer, userMessage, updateCurrentElement) {
        switch (data.type) {
          case 'id':
            if (data.conversation_id) {
              sessionStorage.setItem('shopAiConversationId', data.conversation_id);
            }
            break;

          case 'chunk':
            ShopAIChat.UI.removeTypingIndicator();
            currentMessageElement.dataset.rawText += data.chunk;
            currentMessageElement.textContent = currentMessageElement.dataset.rawText;
            ShopAIChat.UI.scrollToBottom();
            break;

          case 'message_complete':
            ShopAIChat.UI.removeTypingIndicator();
            ShopAIChat.Formatting.formatMessageContent(currentMessageElement);
            ShopAIChat.UI.scrollToBottom();
            break;

          case 'end_turn':
            ShopAIChat.UI.removeTypingIndicator();
            break;

          case 'error':
            console.error('Stream error:', data.error);
            ShopAIChat.UI.removeTypingIndicator();
            currentMessageElement.textContent = "Sorry, I couldn't process your request. Please try again later.";
            break;

          case 'rate_limit_exceeded':
            console.error('Rate limit exceeded:', data.error);
            ShopAIChat.UI.removeTypingIndicator();
            currentMessageElement.textContent = "Sorry, our servers are currently busy. Please try again later.";
            break;

          case 'auth_required':
            // Save the last user message for resuming after authentication
            sessionStorage.setItem('shopAiLastMessage', userMessage || '');
            break;

          case 'product_results':
            ShopAIChat.UI.displayProductResults(data.products);
            break;

          case 'tool_use':
            if (data.tool_use_message) {
              ShopAIChat.Message.addToolUse(data.tool_use_message, messagesContainer);
            }
            break;

          case 'new_message':
            ShopAIChat.Formatting.formatMessageContent(currentMessageElement);
            ShopAIChat.UI.showTypingIndicator();

            // Create new message element for the next response
            const newMessageElement = document.createElement('div');
            newMessageElement.classList.add('shop-ai-message', 'assistant');
            newMessageElement.textContent = '';
            newMessageElement.dataset.rawText = '';
            messagesContainer.appendChild(newMessageElement);

            // Update the current element reference
            updateCurrentElement(newMessageElement);
            break;

          case 'content_block_complete':
            ShopAIChat.UI.showTypingIndicator();
            break;
        }
      },

      /**
       * Fetch chat history from the server
       * @param {string} conversationId - Conversation ID
       * @param {HTMLElement} messagesContainer - The messages container
       */
      fetchChatHistory: async function(conversationId, messagesContainer) {
        try {
          // Show a loading message
          const loadingMessage = document.createElement('div');
          loadingMessage.classList.add('shop-ai-message', 'assistant');
          loadingMessage.textContent = "Loading conversation history...";
          messagesContainer.appendChild(loadingMessage);

          // Fetch history from the server
          const historyUrl = this.getApiBaseUrl() +
            `/chat?history=true&conversation_id=${encodeURIComponent(conversationId)}`;
          console.log('Fetching history from:', historyUrl);

          const response = await fetch(historyUrl, {
            method: 'GET',
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json'
            },
            mode: 'cors'
          });

          if (!response.ok) {
            console.error('History fetch failed:', response.status, response.statusText);
            throw new Error('Failed to fetch chat history: ' + response.status);
          }

          const data = await response.json();

          // Remove loading message
          messagesContainer.removeChild(loadingMessage);

          // No messages, show welcome message
          if (!data.messages || data.messages.length === 0) {
            const welcomeMessage = window.shopChatConfig?.welcomeMessage || "👋 Hi there! How can I help you today?";
            ShopAIChat.Message.add(welcomeMessage, 'assistant', messagesContainer);
            return;
          }

          // Add messages to the UI - filter out tool results
          data.messages.forEach(message => {
            try {
              const messageContents = JSON.parse(message.content);
              for (const contentBlock of messageContents) {
                if (contentBlock.type === 'text') {
                  ShopAIChat.Message.add(contentBlock.text, message.role, messagesContainer);
                }
              }
            } catch (e) {
              ShopAIChat.Message.add(message.content, message.role, messagesContainer);
            }
          });

          // Scroll to bottom
          ShopAIChat.UI.scrollToBottom();

        } catch (error) {
          console.error('Error fetching chat history:', error);

          // Remove loading message if it exists
          const loadingMessage = messagesContainer.querySelector('.shop-ai-message.assistant');
          if (loadingMessage && loadingMessage.textContent === "Loading conversation history...") {
            messagesContainer.removeChild(loadingMessage);
          }

          // Show error and welcome message
          const welcomeMessage = window.shopChatConfig?.welcomeMessage || "👋 Hi there! How can I help you today?";
          ShopAIChat.Message.add(welcomeMessage, 'assistant', messagesContainer);

          // Clear the conversation ID since we couldn't fetch this conversation
          sessionStorage.removeItem('shopAiConversationId');
        }
      }
    },

    /**
     * Authentication-related functionality
     */
    Auth: {
      /**
       * Opens an authentication popup window
       * @param {string|HTMLElement} authUrlOrElement - The auth URL or link element that was clicked
       */
      openAuthPopup: function(authUrlOrElement) {
        let authUrl;
        if (typeof authUrlOrElement === 'string') {
          // If a string URL was passed directly
          authUrl = authUrlOrElement;
        } else {
          // If an element was passed
          authUrl = authUrlOrElement.getAttribute('data-auth-url');
          if (!authUrl) {
            console.error('No auth URL found in element');
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
          'ShopifyAuth',
          `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
        );

        // Focus the popup window
        if (popup) {
          popup.focus();
        } else {
          // If popup was blocked, show a message
          alert('Please allow popups for this site to authenticate with Shopify.');
        }

        // Start polling for token availability
        const conversationId = sessionStorage.getItem('shopAiConversationId');
        if (conversationId) {
          const messagesContainer = document.querySelector('.shop-ai-chat-messages');

          // Add a message to indicate authentication is in progress
          ShopAIChat.Message.add("Authentication in progress. Please complete the process in the popup window.",
            'assistant', messagesContainer);

          this.startTokenPolling(conversationId, messagesContainer);
        }
      },

      /**
       * Start polling for token availability
       * @param {string} conversationId - Conversation ID
       * @param {HTMLElement} messagesContainer - The messages container
       */
      startTokenPolling: function(conversationId, messagesContainer) {
        if (!conversationId) return;

        console.log('Starting token polling for conversation:', conversationId);
        const pollingId = 'polling_' + Date.now();
        sessionStorage.setItem('shopAiTokenPollingId', pollingId);

        let attemptCount = 0;
        const maxAttempts = 30;

        const poll = async () => {
          if (sessionStorage.getItem('shopAiTokenPollingId') !== pollingId) {
            console.log('Another polling session has started, stopping this one');
            return;
          }

          if (attemptCount >= maxAttempts) {
            console.log('Max polling attempts reached, stopping');
            return;
          }

          attemptCount++;

          try {
            const tokenUrl = ShopAIChat.API.getApiBaseUrl() +
              '/auth/token-status?conversation_id=' + encodeURIComponent(conversationId);
            const response = await fetch(tokenUrl);

            if (!response.ok) {
              throw new Error('Token status check failed: ' + response.status);
            }

            const data = await response.json();

            if (data.status === 'authorized') {
              console.log('Token available, resuming conversation');
              const message = sessionStorage.getItem('shopAiLastMessage');

              if (message) {
                sessionStorage.removeItem('shopAiLastMessage');
                setTimeout(() => {
                  ShopAIChat.Message.add("Authorization successful! I'm now continuing with your request.",
                    'assistant', messagesContainer);
                  ShopAIChat.API.streamResponse(message, conversationId, messagesContainer);
                  ShopAIChat.UI.showTypingIndicator();
                }, 500);
              }

              sessionStorage.removeItem('shopAiTokenPollingId');
              return;
            }

            console.log('Token not available yet, polling again in 10s');
            setTimeout(poll, 10000);
          } catch (error) {
            console.error('Error polling for token status:', error);
            setTimeout(poll, 10000);
          }
        };

        setTimeout(poll, 2000);
      }
    },

    /**
     * User authentication functionality
     * 用户认证模块
     */
    User: {
      userId: null,
      username: null,
      token: null,
      currentPrompt: null,

      /**
       * Initialize user state from localStorage
       */
      init: function() {
        this.userId = localStorage.getItem('shopChatUserId');
        this.username = localStorage.getItem('shopChatUsername');
        this.token = localStorage.getItem('shopChatToken');
        this.currentPrompt = localStorage.getItem('shopChatCurrentPrompt');
      },

      /**
       * Check if user is logged in
       */
      isLoggedIn: function() {
        return !!(this.userId && this.token);
      },

      /**
       * Get authorization header
       */
      getAuthHeader: function() {
        return this.token ? { 'Authorization': 'Bearer ' + this.token } : {};
      },

      /**
       * Register a new user
       */
      register: async function(username, password) {
        const shopId = window.shopId;
        const apiBaseUrl = ShopAIChat.API.getApiBaseUrl();

        const response = await fetch(apiBaseUrl + '/api/chat-auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'register',
            username,
            password,
            shopId: String(shopId)
          })
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || '注册失败');
        }

        this.saveUserData(data);
        return data;
      },

      /**
       * Login an existing user
       */
      login: async function(username, password) {
        const shopId = window.shopId;
        const apiBaseUrl = ShopAIChat.API.getApiBaseUrl();

        const response = await fetch(apiBaseUrl + '/api/chat-auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'login',
            username,
            password,
            shopId: String(shopId)
          })
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || '登录失败');
        }

        this.saveUserData(data);
        return data;
      },

      /**
       * Save user data to localStorage
       */
      saveUserData: function(data) {
        this.userId = data.userId;
        this.username = data.username;
        this.token = data.token;
        this.currentPrompt = data.currentPrompt || null;

        localStorage.setItem('shopChatUserId', data.userId);
        localStorage.setItem('shopChatUsername', data.username);
        localStorage.setItem('shopChatToken', data.token);
        if (data.currentPrompt) {
          localStorage.setItem('shopChatCurrentPrompt', data.currentPrompt);
        }
      },

      /**
       * Logout the current user
       */
      logout: function() {
        this.userId = null;
        this.username = null;
        this.token = null;
        this.currentPrompt = null;

        localStorage.removeItem('shopChatUserId');
        localStorage.removeItem('shopChatUsername');
        localStorage.removeItem('shopChatToken');
        localStorage.removeItem('shopChatCurrentPrompt');

        // Update UI
        ShopAIChat.UI.updateUserButton();
      },

      /**
       * Show login/register modal
       */
      showAuthModal: function(mode = 'login') {
        // Remove existing modal if any
        const existingModal = document.querySelector('.shop-ai-auth-modal');
        if (existingModal) existingModal.remove();

        const modal = document.createElement('div');
        modal.classList.add('shop-ai-auth-modal');
        modal.innerHTML = `
          <div class="shop-ai-auth-content">
            <div class="shop-ai-auth-header">
              <h3>${mode === 'login' ? '登录' : '注册'}</h3>
              <button class="shop-ai-auth-close">&times;</button>
            </div>
            <form class="shop-ai-auth-form">
              <div class="shop-ai-auth-field">
                <label>用户名</label>
                <input type="text" name="username" required minlength="2" maxlength="50" placeholder="请输入用户名">
              </div>
              <div class="shop-ai-auth-field">
                <label>密码</label>
                <input type="password" name="password" required minlength="4" placeholder="请输入密码">
              </div>
              <div class="shop-ai-auth-error" style="display: none;"></div>
              <button type="submit" class="shop-ai-auth-submit">
                ${mode === 'login' ? '登录' : '注册'}
              </button>
            </form>
            <div class="shop-ai-auth-switch">
              ${mode === 'login' 
                ? '还没有账户？<a href="#" data-mode="register">立即注册</a>' 
                : '已有账户？<a href="#" data-mode="login">立即登录</a>'}
            </div>
          </div>
        `;

        document.body.appendChild(modal);

        // Event handlers
        const closeBtn = modal.querySelector('.shop-ai-auth-close');
        const form = modal.querySelector('.shop-ai-auth-form');
        const switchLink = modal.querySelector('.shop-ai-auth-switch a');
        const errorDiv = modal.querySelector('.shop-ai-auth-error');

        closeBtn.addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (e) => {
          if (e.target === modal) modal.remove();
        });

        switchLink.addEventListener('click', (e) => {
          e.preventDefault();
          modal.remove();
          this.showAuthModal(e.target.dataset.mode);
        });

        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          const username = form.username.value.trim();
          const password = form.password.value;

          try {
            errorDiv.style.display = 'none';
            const submitBtn = form.querySelector('.shop-ai-auth-submit');
            submitBtn.disabled = true;
            submitBtn.textContent = '处理中...';

            if (mode === 'login') {
              await this.login(username, password);
            } else {
              await this.register(username, password);
            }

            modal.remove();
            ShopAIChat.UI.updateUserButton();
            
            // Show success message
            const messagesContainer = ShopAIChat.UI.elements.messagesContainer;
            ShopAIChat.Message.add(`${mode === 'login' ? '登录' : '注册'}成功！欢迎 ${this.username}`, 'assistant', messagesContainer);
          } catch (error) {
            errorDiv.textContent = error.message;
            errorDiv.style.display = 'block';
            const submitBtn = form.querySelector('.shop-ai-auth-submit');
            submitBtn.disabled = false;
            submitBtn.textContent = mode === 'login' ? '登录' : '注册';
          }
        });
      }
    },

    /**
     * Settings panel functionality
     * 设置面板模块
     */
    Settings: {
      /**
       * Show settings panel
       */
      showPanel: function() {
        if (!ShopAIChat.User.isLoggedIn()) {
          ShopAIChat.User.showAuthModal('login');
          return;
        }

        // Remove existing panel if any
        const existingPanel = document.querySelector('.shop-ai-settings-panel');
        if (existingPanel) existingPanel.remove();

        const panel = document.createElement('div');
        panel.classList.add('shop-ai-settings-panel');
        panel.innerHTML = `
          <div class="shop-ai-settings-content">
            <div class="shop-ai-settings-header">
              <h3>提示词设置</h3>
              <button class="shop-ai-settings-close">&times;</button>
            </div>
            <div class="shop-ai-settings-body">
              <div class="shop-ai-settings-tabs">
                <button class="shop-ai-tab active" data-tab="editor">编辑提示词</button>
                <button class="shop-ai-tab" data-tab="history">历史版本</button>
              </div>
              <div class="shop-ai-tab-content active" data-tab="editor">
                <textarea class="shop-ai-prompt-editor" placeholder="输入您的自定义提示词...">${ShopAIChat.User.currentPrompt || ''}</textarea>
                <div class="shop-ai-settings-actions">
                  <button class="shop-ai-save-prompt">保存提示词</button>
                </div>
              </div>
              <div class="shop-ai-tab-content" data-tab="history">
                <div class="shop-ai-history-list">
                  <div class="shop-ai-loading">加载中...</div>
                </div>
              </div>
            </div>
          </div>
        `;

        document.body.appendChild(panel);

        // Event handlers
        const closeBtn = panel.querySelector('.shop-ai-settings-close');
        const tabs = panel.querySelectorAll('.shop-ai-tab');
        const saveBtn = panel.querySelector('.shop-ai-save-prompt');
        const editor = panel.querySelector('.shop-ai-prompt-editor');

        closeBtn.addEventListener('click', () => panel.remove());
        panel.addEventListener('click', (e) => {
          if (e.target === panel) panel.remove();
        });

        tabs.forEach(tab => {
          tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            panel.querySelectorAll('.shop-ai-tab-content').forEach(content => {
              content.classList.remove('active');
              if (content.dataset.tab === tab.dataset.tab) {
                content.classList.add('active');
              }
            });

            if (tab.dataset.tab === 'history') {
              this.loadHistory(panel);
            }
          });
        });

        saveBtn.addEventListener('click', async () => {
          const prompt = editor.value.trim();
          try {
            saveBtn.disabled = true;
            saveBtn.textContent = '保存中...';
            await this.savePrompt(prompt);
            saveBtn.textContent = '保存成功！';
            setTimeout(() => {
              saveBtn.disabled = false;
              saveBtn.textContent = '保存提示词';
            }, 2000);
          } catch (error) {
            alert('保存失败: ' + error.message);
            saveBtn.disabled = false;
            saveBtn.textContent = '保存提示词';
          }
        });
      },

      /**
       * Save prompt to server
       */
      savePrompt: async function(prompt) {
        const apiBaseUrl = ShopAIChat.API.getApiBaseUrl();

        const response = await fetch(apiBaseUrl + '/api/user-prompt', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...ShopAIChat.User.getAuthHeader()
          },
          body: JSON.stringify({
            action: 'update',
            prompt
          })
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || '保存失败');
        }

        // Update local state
        ShopAIChat.User.currentPrompt = data.currentPrompt;
        localStorage.setItem('shopChatCurrentPrompt', data.currentPrompt || '');

        return data;
      },

      /**
       * Load prompt history
       */
      loadHistory: async function(panel) {
        const historyList = panel.querySelector('.shop-ai-history-list');
        const apiBaseUrl = ShopAIChat.API.getApiBaseUrl();

        try {
          const response = await fetch(apiBaseUrl + '/api/user-prompt?action=history', {
            headers: ShopAIChat.User.getAuthHeader()
          });

          const data = await response.json();
          if (!response.ok) {
            throw new Error(data.error || '加载失败');
          }

          if (!data.history || data.history.length === 0) {
            historyList.innerHTML = '<div class="shop-ai-no-history">暂无历史记录</div>';
            return;
          }

          historyList.innerHTML = data.history.map(item => `
            <div class="shop-ai-history-item" data-id="${item.id}">
              <div class="shop-ai-history-meta">
                <span class="shop-ai-history-version">版本 ${item.version}</span>
                <span class="shop-ai-history-date">${new Date(item.createdAt).toLocaleString()}</span>
              </div>
              <div class="shop-ai-history-content">${this.truncateText(item.content, 100)}</div>
              <button class="shop-ai-restore-btn" data-id="${item.id}">恢复此版本</button>
            </div>
          `).join('');

          // Add restore handlers
          historyList.querySelectorAll('.shop-ai-restore-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
              const historyId = e.target.dataset.id;
              try {
                btn.disabled = true;
                btn.textContent = '恢复中...';
                await this.restorePrompt(historyId);
                
                // Update editor
                const editor = panel.querySelector('.shop-ai-prompt-editor');
                editor.value = ShopAIChat.User.currentPrompt || '';
                
                // Switch to editor tab
                panel.querySelector('.shop-ai-tab[data-tab="editor"]').click();
                
                alert('恢复成功！');
              } catch (error) {
                alert('恢复失败: ' + error.message);
                btn.disabled = false;
                btn.textContent = '恢复此版本';
              }
            });
          });
        } catch (error) {
          historyList.innerHTML = '<div class="shop-ai-error">加载失败: ' + error.message + '</div>';
        }
      },

      /**
       * Restore prompt from history
       */
      restorePrompt: async function(historyId) {
        const apiBaseUrl = ShopAIChat.API.getApiBaseUrl();

        const response = await fetch(apiBaseUrl + '/api/user-prompt', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...ShopAIChat.User.getAuthHeader()
          },
          body: JSON.stringify({
            action: 'restore',
            historyId
          })
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || '恢复失败');
        }

        // Update local state
        ShopAIChat.User.currentPrompt = data.currentPrompt;
        localStorage.setItem('shopChatCurrentPrompt', data.currentPrompt || '');

        return data;
      },

      /**
       * Truncate text with ellipsis
       */
      truncateText: function(text, maxLength) {
        if (!text) return '';
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
      }
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
      createCard: function(product) {
        const card = document.createElement('div');
        card.classList.add('shop-ai-product-card');

        // Create image container
        const imageContainer = document.createElement('div');
        imageContainer.classList.add('shop-ai-product-image');

        // Add product image or placeholder
        const image = document.createElement('img');
        image.src = product.image_url || 'https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_large.png';
        image.alt = product.title;
        image.onerror = function() {
          // If image fails to load, use a fallback placeholder
          this.src = 'https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_large.png';
        };
        imageContainer.appendChild(image);
        card.appendChild(imageContainer);

        // Add product info
        const info = document.createElement('div');
        info.classList.add('shop-ai-product-info');

        // Add product title
        const title = document.createElement('h3');
        title.classList.add('shop-ai-product-title');
        title.textContent = product.title;

        // If product has a URL, make the title a link
        if (product.url) {
          const titleLink = document.createElement('a');
          titleLink.href = product.url;
          titleLink.target = '_blank';
          titleLink.textContent = product.title;
          title.textContent = '';
          title.appendChild(titleLink);
        }

        info.appendChild(title);

        // Add product price
        const price = document.createElement('p');
        price.classList.add('shop-ai-product-price');
        price.textContent = product.price;
        info.appendChild(price);

        // Add add-to-cart button
        const button = document.createElement('button');
        button.classList.add('shop-ai-add-to-cart');
        button.textContent = 'Add to Cart';
        button.dataset.productId = product.id;

        // Add click handler for the button
        button.addEventListener('click', function() {
          // Send message to add this product to cart
          const input = document.querySelector('.shop-ai-chat-input input');
          if (input) {
            input.value = `Add ${product.title} to my cart`;
            // Trigger a click on the send button
            const sendButton = document.querySelector('.shop-ai-chat-send');
            if (sendButton) {
              sendButton.click();
            }
          }
        });

        info.appendChild(button);
        card.appendChild(info);

        return card;
      }
    },

    /**
     * Initialize the chat application
     */
    init: function() {
      // Initialize UI
      const container = document.querySelector('.shop-ai-chat-container');
      if (!container) return;

      this.UI.init(container);

      // Initialize User module
      this.User.init();
      this.UI.updateUserButton();

      // Check for existing conversation
      const conversationId = sessionStorage.getItem('shopAiConversationId');

      if (conversationId) {
        // Fetch conversation history
        this.API.fetchChatHistory(conversationId, this.UI.elements.messagesContainer);
      } else {
        // No previous conversation, show welcome message
        const welcomeMessage = window.shopChatConfig?.welcomeMessage || "👋 Hi there! How can I help you today?";
        this.Message.add(welcomeMessage, 'assistant', this.UI.elements.messagesContainer);
      }
    }
  };

  // Initialize the application when DOM is ready
  document.addEventListener('DOMContentLoaded', function() {
    ShopAIChat.init();
  });
})();
