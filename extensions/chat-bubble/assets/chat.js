document.addEventListener('DOMContentLoaded', function() {
    const shopAiChatContainer = document.querySelector('.shop-ai-chat-container');
    if (!shopAiChatContainer) return;

    const chatBubble = shopAiChatContainer.querySelector('.shop-ai-chat-bubble');
    const chatWindow = shopAiChatContainer.querySelector('.shop-ai-chat-window');
    const closeButton = shopAiChatContainer.querySelector('.shop-ai-chat-close');
    const chatInput = shopAiChatContainer.querySelector('.shop-ai-chat-input input');
    const sendButton = shopAiChatContainer.querySelector('.shop-ai-chat-send');
    const messagesContainer = shopAiChatContainer.querySelector('.shop-ai-chat-messages');

    // Toggle chat window visibility
    chatBubble.addEventListener('click', function() {
      chatWindow.classList.toggle('active');
      if (chatWindow.classList.contains('active')) {
        chatInput.focus();
      }
    });

    // Close chat window
    closeButton.addEventListener('click', function() {
      chatWindow.classList.remove('active');
    });

    // Send message when pressing Enter in input
    chatInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter' && chatInput.value.trim() !== '') {
        sendMessage();
      }
    });

    // Send message when clicking send button
    sendButton.addEventListener('click', function() {
      if (chatInput.value.trim() !== '') {
        sendMessage();
      }
    });

    // Store conversation ID in sessionStorage
    let conversationId = sessionStorage.getItem('shopAiConversationId');

    async function sendMessage() {
      const userMessage = chatInput.value.trim();

      // Add user message to chat
      addMessage(userMessage, 'user');

      // Clear input
      chatInput.value = '';

      // Show typing indicator
      showTypingIndicator();

      try {
        streamResponse(userMessage);
      } catch (error) {
        console.error('Error communicating with Claude API:', error);
        removeTypingIndicator();
        addMessage("Sorry, I couldn't process your request at the moment. Please try again later.", 'assistant');
      }
    }

    // Track the current message element
    let currentMessageElement = null;

    // Helper function to format message content
    function formatMessageContent(element) {
      if (!element || !element.dataset.rawText) return;

      const rawText = element.dataset.rawText;

      // Simple markdown link regex
      const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;

      // Replace markdown links with HTML links
      const processedText = rawText.replace(markdownLinkRegex, function(match, text, url) {
        // If it's a checkout link, replace the text
        if (url.includes('/cart') || url.includes('checkout')) {
          return '<a href="' + url + '" target="_blank" rel="noopener noreferrer">click here to proceed to checkout</a>';
        } else {
          // For normal links, preserve the original text
          return '<a href="' + url + '" target="_blank" rel="noopener noreferrer">' + text + '</a>';
        }
      });

      // Apply the formatted HTML
      element.innerHTML = processedText;
    }

    // Stream the response from the API
    async function streamResponse(userMessage) {
      try {
        // Prepare the request body
        const requestBody = JSON.stringify({
          message: userMessage,
          conversation_id: conversationId
        });

        // Set up event source for streaming
        // TODO: Make this dynamic, maybe via app proxy?
        const streamUrl = `/apps/chat/chat`;

        const response = await fetch(streamUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'text/event-stream',
          },
          body: requestBody
        });

        // Read the stream
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        let buffer = '';
        // Create message element for the assistant's response
        let messageElement = document.createElement('div');
        messageElement.classList.add('shop-ai-message', 'assistant');
        messageElement.textContent = '';
        messageElement.dataset.rawText = '';

        // Add empty message element that will be populated during streaming
        removeTypingIndicator();
        messagesContainer.appendChild(messageElement);

        // Set as current message
        currentMessageElement = messageElement;

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Process line by line (SSE format)
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || ''; // Keep the last incomplete line in the buffer

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));

                if (data.type === 'id' && data.conversation_id) {
                  // Save conversation ID
                  conversationId = data.conversation_id;
                  sessionStorage.setItem('shopAiConversationId', conversationId);
                }
                else if (data.type === 'chunk') {
                  console.log('chunk', data.chunk);

                  // Store raw text in data attribute
                  messageElement.dataset.rawText += data.chunk;

                  // Show plain text during streaming
                  messageElement.textContent = messageElement.dataset.rawText;

                  // Scroll to bottom as new content arrives
                  messagesContainer.scrollTop = messagesContainer.scrollHeight;
                }
                else if (data.type === 'done') {
                  // Format the message when it's complete
                  formatMessageContent(currentMessageElement);

                  // Scroll to ensure visibility after formatting
                  messagesContainer.scrollTop = messagesContainer.scrollHeight;
                }
                else if (data.type === 'error') {
                  // Handle error
                  console.error('Stream error:', data.error);
                  messageElement.textContent = "Sorry, I couldn't process your request. Please try again later.";
                }
                else if (data.type === 'new_message') {
                  // Format the previous message if needed
                  formatMessageContent(currentMessageElement);

                  // Add a new message element
                  messageElement = document.createElement('div');
                  messageElement.classList.add('shop-ai-message', 'assistant');
                  messageElement.textContent = '';
                  messageElement.dataset.rawText = '';
                  messagesContainer.appendChild(messageElement);

                  // Update current message reference
                  currentMessageElement = messageElement;
                }
              } catch (e) {
                console.error('Error parsing event data:', e, line);
              }
            }
          }
        }
      } catch (error) {
        console.error('Error in streaming:', error);
        removeTypingIndicator();
        addMessage("Sorry, I couldn't process your request. Please try again later.", 'assistant');
      }
    }

    function addMessage(text, sender) {
      const messageElement = document.createElement('div');
      messageElement.classList.add('shop-ai-message', sender);

      // For user messages, just use plain text
      // For assistant messages, we'd format them too (though currently only used for error messages)
      if (sender === 'assistant') {
        messageElement.dataset.rawText = text;
        formatMessageContent(messageElement);
      } else {
        messageElement.textContent = text;
      }

      messagesContainer.appendChild(messageElement);

      // Scroll to bottom
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    function showTypingIndicator() {
      const typingIndicator = document.createElement('div');
      typingIndicator.classList.add('shop-ai-typing-indicator');
      typingIndicator.innerHTML = '<span></span><span></span><span></span>';
      messagesContainer.appendChild(typingIndicator);

      // Scroll to bottom
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    function removeTypingIndicator() {
      const typingIndicator = messagesContainer.querySelector('.shop-ai-typing-indicator');
      if (typingIndicator) {
        typingIndicator.remove();
      }
    }

    // Get welcome message from block settings or use default
    let welcomeMessage = "👋 Hi there! How can I help you today?";
    const blockElement = document.querySelector('[data-shopify-editor-block]');
    if (blockElement && blockElement.dataset.welcomeMessage) {
      welcomeMessage = blockElement.dataset.welcomeMessage;
    }

    // Add the welcome message
    addMessage(welcomeMessage, 'assistant');
  });
