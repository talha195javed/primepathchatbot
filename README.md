# PrimePath Chatbot - Frontend

AI chatbot frontend widget. Deploy on your own website as a full-page chat or embeddable floating widget.

## Prerequisites

- **PrimePath Chatbot Backend** running (see `../primepath-chatbot-backend/`)
- **Widget ID** from the seed script output

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Edit the `.env` file:

```env
VITE_API_BASE_URL=http://localhost:3000/api    # Your PrimePath backend URL
VITE_WIDGET_ID=your-widget-id-here             # Widget ID from seed script
```

### 3. Run locally

```bash
npm run dev
```

## Deployment Options

### Option A: Deploy as Full-Page Chatbot

```bash
npm run build
```

Outputs to `dist/`. Deploy to **Netlify, Vercel, or any static hosting**.

### Option B: Embed on Any Website

```bash
npm run build:embed
```

Outputs `dist-embed/embed.js`. Add to any website:

```html
<script src="https://your-domain.com/embed.js" data-widget-id="YOUR_WIDGET_ID" defer></script>
```

## Project Structure

```
primepath-chatbot/
├── src/
│   ├── components/
│   │   └── ChatWidget.tsx    # Main chat widget (full-page + floating mode)
│   ├── services/
│   │   ├── api.ts            # API calls (widget config, threads, messages)
│   │   └── socket.ts         # Socket.IO real-time messaging
│   ├── App.tsx               # Full-page app entry
│   ├── embed.tsx             # Embeddable widget entry
│   ├── main.tsx              # React entry point
│   └── index.css             # Tailwind + custom styles
├── .env                      # Environment config
├── vite.config.ts            # Main Vite config
└── vite.embed.config.ts      # Embed build config
```

## How It Works

1. Widget loads config from PrimePath backend (`/api/agent/get-widget`)
2. Creates a customer thread (`/api/customer/create-customer-thread`)
3. Messages sent via REST API (`/api/chat/chat-web`)
4. Bot responses arrive in real-time via Socket.IO
5. AI processing happens on the PrimePath backend (DeepSeek + RAG)

## Features

- Real-time messaging via Socket.IO
- Customizable colors & theme (from backend settings)
- Typing indicator while bot generates response
- Chat history persisted in localStorage
- New chat / reset functionality
- Responsive design
- Dark & light theme support
- Deployable as full-page app OR embeddable widget
