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

    async function sendMessage() {
      const userMessage = chatInput.value.trim();
      const conversationId = sessionStorage.getItem('shopAiConversationId');

      // Add user message to chat
      addMessage(userMessage, 'user');

      // Clear input
      chatInput.value = '';

      // Show typing indicator
      showTypingIndicator();

      try {
        streamResponse(userMessage, conversationId);
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

      // Process the text with various Markdown features
      let processedText = rawText;

      // 1. Process Markdown links
      const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
      processedText = processedText.replace(markdownLinkRegex, function(match, text, url) {
        // If it's a checkout link, replace the text
        if (url.includes('/cart') || url.includes('checkout')) {
          return '<a href="' + url + '" target="_blank" rel="noopener noreferrer">click here to proceed to checkout</a>';
        } else {
          // For normal links, preserve the original text
          return '<a href="' + url + '" target="_blank" rel="noopener noreferrer">' + text + '</a>';
        }
      });

      // 2. Process lists - this needs to be done before applying the HTML

      // Convert text to HTML with proper list handling
      processedText = convertMarkdownToHtml(processedText);

      // Apply the formatted HTML
      element.innerHTML = processedText;
    }

    // Function to convert Markdown text to HTML with list support
    function convertMarkdownToHtml(text) {
      // First, handle bold text (**text** or __text__)
      text = text.replace(/(\*\*|__)(.*?)\1/g, '<strong>$2</strong>');

      // First, split the text by newlines to process line by line
      const lines = text.split('\n');
      let currentList = null;  // 'ol' or 'ul' or null
      let listItems = [];
      let htmlContent = '';

      // Process each line
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Check for unordered list item (- item or * item)
        const unorderedMatch = line.match(/^\s*([-*])\s+(.*)/);

        // Check for ordered list item (1. item, 2. item, etc.)
        const orderedMatch = line.match(/^\s*(\d+)[\.)]\s+(.*)/);

        if (unorderedMatch) {
          // Handle unordered list items
          if (currentList !== 'ul') {
            // First finish any current list
            if (currentList === 'ol') {
              htmlContent += '<ol>' + listItems.join('') + '</ol>';
              listItems = [];
            }
            currentList = 'ul';
          }

          // Add item to the current unordered list
          listItems.push('<li>' + unorderedMatch[2] + '</li>');
        }
        else if (orderedMatch) {
          // Handle ordered list items
          if (currentList !== 'ol') {
            // First finish any current list
            if (currentList === 'ul') {
              htmlContent += '<ul>' + listItems.join('') + '</ul>';
              listItems = [];
            }
            currentList = 'ol';
          }

          // Add item to the current ordered list
          listItems.push('<li>' + orderedMatch[2] + '</li>');
        }
        else {
          // Not a list item - finish any current list
          if (currentList) {
            htmlContent += currentList === 'ul'
              ? '<ul>' + listItems.join('') + '</ul>'
              : '<ol>' + listItems.join('') + '</ol>';
            listItems = [];
            currentList = null;
          }

          // Handle paragraph
          if (line.trim() === '') {
            htmlContent += '<br>';
          } else {
            htmlContent += '<p>' + line + '</p>';
          }
        }
      }

      // Close any remaining open list
      if (currentList) {
        htmlContent += currentList === 'ul'
          ? '<ul>' + listItems.join('') + '</ul>'
          : '<ol>' + listItems.join('') + '</ol>';
      }

      // Handle paragraph breaks without using <br> tags
      htmlContent = htmlContent.replace(/<\/p><p>/g, '</p>\n<p>');

      return htmlContent;
    }

    // Stream the response from the API
    async function streamResponse(userMessage, conversationId) {
      try {
        // Get prompt type from window config or use default
        const promptType = window.shopChatConfig?.promptType || "standardAssistant";

        // Prepare the request body
        const requestBody = JSON.stringify({
          message: userMessage,
          conversation_id: conversationId,
          prompt_type: promptType
        });

        // Set up event source for streaming
        // TODO: Make this dynamic, maybe via app proxy?
        const streamUrl = 'https://localhost:3458/chat';

        const response = await fetch(streamUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'text/event-stream'
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
                else if (data.type === 'rate_limit_exceeded') {
                  // Handle error
                  console.error('Rate limit exceeded:', data.error);
                  messageElement.textContent = "Sorry, our servers are currently busy. Please try again later.";
                }
                else if (data.type === 'auth_required') {
                  // Store last message and begin polling for token
                  startTokenPolling(conversationId, userMessage);
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
    
    // Function to poll for token status and automatically resume conversation when available
    async function startTokenPolling(conversationId, lastUserMessage) {
      if (!conversationId) return;
      
      console.log('Starting token polling for conversation:', conversationId);
      
      // Store last message for retry after authorization
      sessionStorage.setItem('shopAiLastMessage', lastUserMessage);
      
      // Create a unique polling ID for this session to avoid multiple polling loops
      const pollingId = 'polling_' + Date.now();
      sessionStorage.setItem('shopAiTokenPollingId', pollingId);
      
      let attemptCount = 0;
      const maxAttempts = 30; // Stop after ~5 minutes (10s * 30)
      
      const poll = async () => {
        // Check if this polling session is still active
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
          // Make request to token status endpoint
          const tokenUrl = 'https://localhost:3458/auth/token-status?conversation_id=' + encodeURIComponent(conversationId);
          const response = await fetch(tokenUrl);
          
          if (!response.ok) {
            throw new Error('Token status check failed: ' + response.status);
          }
          
          const data = await response.json();
          
          // If token is available, resume conversation
          if (data.status === 'authorized') {
            console.log('Token available, resuming conversation');
            
            // Get the stored message
            const message = sessionStorage.getItem('shopAiLastMessage');
            if (message) {
              // Clear stored message to avoid duplicate retries
              sessionStorage.removeItem('shopAiLastMessage');
              
              // Small delay to ensure UI is ready
              setTimeout(() => {
                // Inform user we're resuming
                addMessage("Authorization successful! I'm now continuing with your request.", 'assistant');
                
                // Call streamResponse with the original message
                streamResponse(message, conversationId);
              }, 500);
            }
            
            // Stop polling
            sessionStorage.removeItem('shopAiTokenPollingId');
            return;
          }
          
          // Continue polling if not authorized yet
          console.log('Token not available yet, polling again in 10s');
          setTimeout(poll, 10000); // Poll every 10 seconds
          
        } catch (error) {
          console.error('Error polling for token status:', error);
          // Continue polling despite errors
          setTimeout(poll, 10000);
        }
      };
      
      // Start polling
      setTimeout(poll, 2000); // First poll after 2 seconds
    }

    // Get welcome message from block settings or use default
    const welcomeMessage = window.shopChatConfig?.welcomeMessage || "👋 Hi there! How can I help you today?";

    // Add the welcome message
    addMessage(welcomeMessage, 'assistant');
  });
