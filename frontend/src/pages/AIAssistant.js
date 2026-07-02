import React, { useEffect, useRef, useState } from 'react';
import { aiAPI } from '../services/api';

const QUICK_PROMPTS = [
  {
    icon: 'PP',
    text: 'Pricing Strategy',
    sub: 'Get pricing tips for your products',
    message: 'What pricing strategies should I use for my business to maximize profit while staying competitive?'
  },
  {
    icon: 'IV',
    text: 'Inventory Tips',
    sub: 'Best practices for stock management',
    message: 'Give me 5 best practices for inventory management in a small business.'
  },
  {
    icon: 'SL',
    text: 'Boost Sales',
    sub: 'Ideas to increase revenue',
    message: 'What are effective ways to increase sales in my business?'
  },
  {
    icon: 'CR',
    text: 'Customer Retention',
    sub: 'Keep customers coming back',
    message: 'How can I improve customer loyalty and retention for my business?'
  },
  {
    icon: 'OP',
    text: 'Operations',
    sub: 'Reduce waste and improve efficiency',
    message: 'How can I reduce wastage and improve daily operations in my business?'
  },
  {
    icon: 'DP',
    text: 'Digital Payments',
    sub: 'UPI and card payment tips',
    message: 'What are the benefits of accepting UPI and digital payments in my business?'
  },
];

export default function AIAssistant() {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: "Hello! I'm your AI business assistant powered by Claude. I can help with pricing, inventory, sales, and operations. What would you like to discuss?"
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text) => {
    const msg = text || input.trim();
    if (!msg || loading) {
      return;
    }

    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: msg }]);
    setLoading(true);

    try {
      const res = await aiAPI.chat(msg);
      setMessages((prev) => [...prev, { role: 'assistant', content: res.data.response }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Unable to connect to Claude AI right now. Please try again.' }
      ]);
    }

    setLoading(false);
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">AI Assistant</h1>
        <p className="page-subtitle">Powered by Claude. Ask anything about your business.</p>
      </div>

      <div className="ai-layout">
        <div className="chat-container">
          <div className="chat-messages">
            {messages.map((message, index) => (
              <div key={index} className={`chat-message ${message.role}`}>
                <div className="chat-avatar">{message.role === 'user' ? 'U' : 'AI'}</div>
                <div className="chat-bubble">{message.content}</div>
              </div>
            ))}

            {loading && (
              <div className="chat-message assistant">
                <div className="chat-avatar">AI</div>
                <div className="chat-bubble">
                  <div className="loading-dots"><span /><span /><span /></div>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          <div className="chat-input-area">
            <textarea
              className="chat-input"
              placeholder="Ask about pricing, inventory, sales strategies..."
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  sendMessage();
                }
              }}
              rows={2}
            />
            <button className="btn btn-primary" onClick={() => sendMessage()} disabled={!input.trim() || loading}>
              Send
            </button>
          </div>
        </div>

        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 15, marginBottom: 16 }}>Quick Questions</h3>
            <div className="quick-prompts">
              {QUICK_PROMPTS.map((prompt, index) => (
                <button key={index} className="quick-prompt-btn" onClick={() => sendMessage(prompt.message)}>
                  <span className="quick-prompt-icon">{prompt.icon}</span>
                  <div className="quick-prompt-text">{prompt.text}</div>
                  <div className="quick-prompt-sub">{prompt.sub}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
