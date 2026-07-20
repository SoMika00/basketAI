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
          messagesContainer: container.querySelector('.shop-ai-chat-messages')
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
        const { chatBubble, closeButton, chatInput, sendButton, messagesContainer } = this.elements;

        // Toggle chat window visibility
        chatBubble.addEventListener('click', () => this.toggleChatWindow());

        // Close chat window
        closeButton.addEventListener('click', () => this.closeChatWindow());

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
       * Get or create a shop-specific conversation ID persisted in localStorage
       * @returns {string} The conversation ID
       */
      getConversationId: function() {
        const shopId = window.shopId || 'default';
        const storageKey = `shopAiConversationId_${shopId}`;
        let conversationId = localStorage.getItem(storageKey);

        if (!conversationId) {
          conversationId = Date.now().toString(36) + Math.random().toString(36).substr(2);
          localStorage.setItem(storageKey, conversationId);
        }

        return conversationId;
      },

      /**
       * Clear the persisted conversation ID (for future reset functionality)
       */
      clearConversationId: function() {
        const shopId = window.shopId || 'default';
        const storageKey = `shopAiConversationId_${shopId}`;
        localStorage.removeItem(storageKey);
      },

      /**
       * Send a message to the API
       * @param {HTMLInputElement} chatInput - The input element
       * @param {HTMLElement} messagesContainer - The messages container
       */
      send: async function(chatInput, messagesContainer) {
        const userMessage = chatInput.value.trim();
        const conversationId = this.getConversationId();

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

        toolUseElement.appendChild(headerElement);
        toolUseElement.appendChild(argsElement);
        messagesContainer.appendChild(toolUseElement);
        ShopAIChat.UI.scrollToBottom();
      }
    },

    /**
     * API communication functionality
     */
    API: {
      /**
       * Stream a response from the chat API
       * @param {string} message - The user message
       * @param {string} conversationId - The conversation ID
       * @param {HTMLElement} messagesContainer - The messages container
       */
      streamResponse: function(message, conversationId, messagesContainer) {
        const shopDomain = window.location.origin;
        const shopId = window.shopId;

        // Prepare request headers
        const headers = {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
          'X-Shopify-Shop-Id': shopId
        };

        // Build URL with conversation_id for history if needed, but for chat use body
        fetch(`${shopDomain}/chat`, {
          method: 'POST',
          headers: headers,
          body: JSON.stringify({
            message: message,
            conversation_id: conversationId,
            prompt_type: window.shopChatConfig?.promptType || 'standardAssistant'
          })
        })
        .then(response => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';

          function readStream() {
            reader.read().then(({ done, value }) => {
              if (done) {
                ShopAIChat.UI.removeTypingIndicator();
                return;
              }

              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split('\n\n');
              buffer = lines.pop() || '';

              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  try {
                    const data = JSON.parse(line.substring(6));

                    if (data.type === 'id' && data.conversation_id) {
                      // Server may return ID, ensure we persist it (already done client-side)
                      const shopId = window.shopId || 'default';
                      const storageKey = `shopAiConversationId_${shopId}`;
                      localStorage.setItem(storageKey, data.conversation_id);
                    } else if (data.type === 'chunk') {
                      // Handle streaming chunks - append to last assistant message or create new
                      let lastMessage = messagesContainer.querySelector('.shop-ai-message.assistant:last-child');
                      if (!lastMessage || lastMessage.classList.contains('complete')) {
                        lastMessage = ShopAIChat.Message.add('', 'assistant', messagesContainer);
                      }
                      lastMessage.dataset.rawText = (lastMessage.dataset.rawText || '') + data.chunk;
                      ShopAIChat.Formatting.formatMessageContent(lastMessage);
                      ShopAIChat.UI.scrollToBottom();
                    } else if (data.type === 'message_complete') {
                      // Mark message as complete
                      const lastMessage = messagesContainer.querySelector('.shop-ai-message.assistant:last-child');
                      if (lastMessage) {
                        lastMessage.classList.add('complete');
                      }
                    } else if (data.type === 'tool_use') {
                      ShopAIChat.Message.addToolUse(data.tool_use_message, messagesContainer);
                    } else if (data.type === 'new_message') {
                      // Start a new assistant message for next content
                    } else if (data.type === 'content_block_complete') {
                      // Content block done
                    } else if (data.type === 'end_turn') {
                      // End of turn
                    } else if (data.type === 'product_results') {
                      ShopAIChat.UI.displayProductResults(data.products);
                    } else if (data.type === 'auth_required') {
                      // Handle auth required
                      const authMsg = document.createElement('div');
                      authMsg.classList.add('shop-ai-message', 'assistant');
                      authMsg.innerHTML = 'Authentication required. Please <a href="#" class="shop-auth-trigger">authorize</a> to continue.';
                      messagesContainer.appendChild(authMsg);
                      ShopAIChat.UI.scrollToBottom();
                    } else if (data.error) {
                      ShopAIChat.UI.removeTypingIndicator();
                      ShopAIChat.Message.add(`Error: ${data.error}`, 'assistant', messagesContainer);
                    }
                  } catch (e) {
                    console.error('Error parsing SSE data:', e);
                  }
                }
              }

              readStream();
            }).catch(error => {
              console.error('Stream read error:', error);
              ShopAIChat.UI.removeTypingIndicator();
            });
          }

          readStream();
        })
        .catch(error => {
          console.error('Fetch error:', error);
          ShopAIChat.UI.removeTypingIndicator();
          ShopAIChat.Message.add("Sorry, I couldn't process your request at the moment. Please try again later.", 'assistant', messagesContainer);
        });
      },

      /**
       * Fetch conversation history
       * @param {string} conversationId - The conversation ID
       * @returns {Promise<Array>} Array of messages
       */
      fetchHistory: async function(conversationId) {
        const shopDomain = window.location.origin;
        const shopId = window.shopId;

        try {
          const response = await fetch(`${shopDomain}/chat?history=true&conversation_id=${encodeURIComponent(conversationId)}`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'X-Shopify-Shop-Id': shopId
            }
          });

          if (response.ok) {
            const data = await response.json();
            return data.messages || [];
          }
          return [];
        } catch (error) {
          console.error('Error fetching history:', error);
          return [];
        }
      }
    },

    /**
     * Product card creation
     */
    Product: {
      createCard: function(product) {
        const card = document.createElement('div');
        card.classList.add('shop-ai-product-card');

        const imageHtml = product.image_url
          ? `<img src="${product.image_url}" alt="${product.title}" class="shop-ai-product-image">`
          : '';

        card.innerHTML = `
          <div class="shop-ai-product-content">
            ${imageHtml}
            <div class="shop-ai-product-info">
              <h5 class="shop-ai-product-title">${product.title}</h5>
              <p class="shop-ai-product-price">${product.price}</p>
              <a href="${product.url}" class="shop-ai-product-link" target="_blank">View Product</a>
            </div>
          </div>
        `;

        return card;
      }
    },

    /**
     * Formatting utilities
     */
    Formatting: {
      formatMessageContent: function(messageElement) {
        // Simple markdown-like formatting
        let text = messageElement.dataset.rawText || '';
        // Escape HTML
        text = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        // Bold
        text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        // Links
        text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
        messageElement.innerHTML = text;
      }
    },

    /**
     * Auth handling
     */
    Auth: {
      openAuthPopup: function(url) {
        const popup = window.open(url, 'authPopup', 'width=600,height=700');
        if (popup) {
          const checkInterval = setInterval(() => {
            if (popup.closed) {
              clearInterval(checkInterval);
              // Optionally reload or notify
            }
          }, 500);
        }
      }
    },

    /**
     * Initialize the chat application
     */
    init: function() {
      const container = document.querySelector('.shop-ai-chat-container');
      if (container) {
        this.UI.init(container);
        // Pre-fetch conversation ID to ensure it's generated on load
        this.Message.getConversationId();
      }
    }
  };

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => ShopAIChat.init());
  } else {
    ShopAIChat.init();
  }

  // Expose for debugging
  window.ShopAIChat = ShopAIChat;
})();
