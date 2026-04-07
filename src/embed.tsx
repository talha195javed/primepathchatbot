/**
 * Embeddable Chat Widget Entry Point
 * 
 * Usage: Add this to any website:
 * <script src="https://your-deployed-url.com/embed.js" data-widget-id="YOUR_WIDGET_ID" defer></script>
 * 
 * This script will create a floating chat widget on the page.
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import ChatWidget from './components/ChatWidget';
import './index.css';

(function () {
  // Find the script tag to get widget ID
  const script = document.currentScript as HTMLScriptElement | null;
  const widgetId = script?.getAttribute('data-widget-id') || '';

  if (!widgetId) {
    console.error('[PrimePathChatbot] Missing data-widget-id attribute on script tag');
    return;
  }

  // Create container
  const container = document.createElement('div');
  container.id = 'primepath-chatbot-widget-root';
  document.body.appendChild(container);

  // Mount React widget
  const root = ReactDOM.createRoot(container);
  root.render(
    <React.StrictMode>
      <ChatWidget widgetId={widgetId} fullPage={false} />
    </React.StrictMode>
  );
})();
