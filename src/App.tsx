import ChatWidget from './components/ChatWidget';

const WIDGET_ID = import.meta.env.VITE_WIDGET_ID || '';

export default function App() {
  if (!WIDGET_ID) {
    return (
      <div className="flex items-center justify-center w-full h-screen bg-gray-50">
        <div className="max-w-md p-8 text-center bg-white shadow-lg rounded-2xl">
          <h1 className="mb-4 text-2xl font-bold text-gray-900">PrimePath Chatbot</h1>
          <p className="mb-4 text-gray-600">
            Widget ID is not configured. Please set <code className="px-2 py-1 text-sm bg-gray-100 rounded">VITE_WIDGET_ID</code> in your <code className="px-2 py-1 text-sm bg-gray-100 rounded">.env</code> file.
          </p>
          <div className="p-4 text-left rounded-lg bg-gray-50">
            <p className="mb-2 text-xs font-semibold text-gray-500">Example .env:</p>
            <code className="text-sm text-gray-700">
              VITE_API_BASE_URL=http://localhost:3000/api<br />
              VITE_WIDGET_ID=your-widget-id-here
            </code>
          </div>
          <p className="mt-4 text-sm text-gray-500">
            You can find your Widget ID in your CRM under<br />
            <strong>Connect Hub → Website Integration</strong>
          </p>
        </div>
      </div>
    );
  }

  return <ChatWidget widgetId={WIDGET_ID} fullPage />;
}
