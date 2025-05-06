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
        sendMessage(chatInput, messagesContainer);
      }
    });

    // Send message when clicking send button
    sendButton.addEventListener('click', function() {
      if (chatInput.value.trim() !== '') {
        sendMessage(chatInput, messagesContainer);
      }
    });

    // Get welcome message from block settings or use default
    const welcomeMessage = window.shopChatConfig?.welcomeMessage || "👋 Hi there! How can I help you today?";

    // Add the welcome message
    addMessage(welcomeMessage, 'assistant', messagesContainer);
});

// Helper function to send a message
async function sendMessage(chatInput, messagesContainer) {
  const userMessage = chatInput.value.trim();
  const conversationId = sessionStorage.getItem('shopAiConversationId');

  // Add user message to chat
  addMessage(userMessage, 'user', messagesContainer);

  // Clear input
  chatInput.value = '';

  // Show typing indicator
  showTypingIndicator(messagesContainer);

  try {
    streamResponse(userMessage, conversationId, messagesContainer, chatInput);
  } catch (error) {
    console.error('Error communicating with Claude API:', error);
    removeTypingIndicator(messagesContainer);
    addMessage("Sorry, I couldn't process your request at the moment. Please try again later.", 'assistant', messagesContainer);
  }
}

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

  // Convert text to HTML with proper list handling
  processedText = convertMarkdownToHtml(processedText);

  // Apply the formatted HTML
  element.innerHTML = processedText;
}

// Function to convert Markdown text to HTML with list support
function convertMarkdownToHtml(text) {
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

// Stream the response from the API
async function streamResponse(userMessage, conversationId, messagesContainer, chatInput) {
  let currentMessageElement = null;
  try {
    const promptType = window.shopChatConfig?.promptType || "standardAssistant";
    const requestBody = JSON.stringify({
      message: userMessage,
      conversation_id: conversationId,
      prompt_type: promptType
    });
    const streamUrl = 'https://localhost:3458/chat';
    const response = await fetch(streamUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream'
      },
      body: requestBody
    });
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let messageElement = document.createElement('div');
    messageElement.classList.add('shop-ai-message', 'assistant');
    messageElement.textContent = '';
    messageElement.dataset.rawText = '';
    removeTypingIndicator(messagesContainer);
    messagesContainer.appendChild(messageElement);
    currentMessageElement = messageElement;
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
            if (data.type === 'id' && data.conversation_id) {
              conversationId = data.conversation_id;
              sessionStorage.setItem('shopAiConversationId', conversationId);
            } else if (data.type === 'chunk') {
              messageElement.dataset.rawText += data.chunk;
              messageElement.textContent = messageElement.dataset.rawText;
              messagesContainer.scrollTop = messagesContainer.scrollHeight;
            } else if (data.type === 'done') {
              formatMessageContent(currentMessageElement);
              messagesContainer.scrollTop = messagesContainer.scrollHeight;
            } else if (data.type === 'error') {
              console.error('Stream error:', data.error);
              messageElement.textContent = "Sorry, I couldn't process your request. Please try again later.";
            } else if (data.type === 'rate_limit_exceeded') {
              console.error('Rate limit exceeded:', data.error);
              messageElement.textContent = "Sorry, our servers are currently busy. Please try again later.";
            } else if (data.type === 'auth_required') {
              startTokenPolling(conversationId, userMessage, messagesContainer, chatInput);
            } else if (data.type === 'product_results') {
              console.log("Received product results:", data.products);

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

              if (!data.products || !Array.isArray(data.products) || data.products.length === 0) {
                const noProductsMessage = document.createElement('p');
                noProductsMessage.textContent = "No products found";
                noProductsMessage.style.padding = "10px";
                productsContainer.appendChild(noProductsMessage);
              } else {
                data.products.forEach(product => {
                  console.log("Creating product card for:", product);
                  const productCard = createProductCard(product);
                  productsContainer.appendChild(productCard);
                });
              }
              messagesContainer.scrollTop = messagesContainer.scrollHeight;
            } else if (data.type === 'new_message') {
              formatMessageContent(currentMessageElement);
              messageElement = document.createElement('div');
              messageElement.classList.add('shop-ai-message', 'assistant');
              messageElement.textContent = '';
              messageElement.dataset.rawText = '';
              messagesContainer.appendChild(messageElement);
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
    removeTypingIndicator(messagesContainer);
    addMessage("Sorry, I couldn't process your request. Please try again later.", 'assistant', messagesContainer);
  }
}

function addMessage(text, sender, messagesContainer) {
  const messageElement = document.createElement('div');
  messageElement.classList.add('shop-ai-message', sender);
  if (sender === 'assistant') {
    messageElement.dataset.rawText = text;
    formatMessageContent(messageElement);
  } else {
    messageElement.textContent = text;
  }
  messagesContainer.appendChild(messageElement);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function showTypingIndicator(messagesContainer) {
  const typingIndicator = document.createElement('div');
  typingIndicator.classList.add('shop-ai-typing-indicator');
  typingIndicator.innerHTML = '<span></span><span></span><span></span>';
  messagesContainer.appendChild(typingIndicator);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function removeTypingIndicator(messagesContainer) {
  const typingIndicator = messagesContainer.querySelector('.shop-ai-typing-indicator');
  if (typingIndicator) {
    typingIndicator.remove();
  }
}

async function startTokenPolling(conversationId, lastUserMessage, messagesContainer, chatInput) {
  if (!conversationId) return;
  console.log('Starting token polling for conversation:', conversationId);
  sessionStorage.setItem('shopAiLastMessage', lastUserMessage);
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
      const tokenUrl = 'https://localhost:3458/auth/token-status?conversation_id=' + encodeURIComponent(conversationId);
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
            addMessage("Authorization successful! I'm now continuing with your request.", 'assistant', messagesContainer);
            streamResponse(message, conversationId, messagesContainer, chatInput);
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

// Helper function to create product cards
function createProductCard(product) {
  console.log("Creating card for product:", product);

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
