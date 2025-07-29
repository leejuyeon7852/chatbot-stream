import { useState, useRef, useEffect } from 'react'
import './App.css'

function App() {
  const [messages, setMessages] = useState([])
  const [inputMessage, setInputMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [apiKey, setApiKey] = useState(import.meta.env.VITE_OPENAI_API_KEY || '')
  const [showApiKeyInput, setShowApiKeyInput] = useState(!import.meta.env.VITE_OPENAI_API_KEY)
  const messagesEndRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const sendMessage = async () => {
    const currentApiKey = apiKey.trim() || import.meta.env.VITE_OPENAI_API_KEY
    if (!inputMessage.trim() || !currentApiKey) return

    // 새로운 대화 항목 준비
    const userMessage = { role: 'user', content: inputMessage, id: Date.now() }
    const assistantMessage = { role: 'assistant', content: '', id: Date.now() + 1 }
    const updatedMessages = [...messages, userMessage, assistantMessage]

    // 상태 업데이트
    setMessages(updatedMessages)
    setInputMessage('')
    setIsLoading(true)

    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${currentApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: updatedMessages.slice(0, -1), // assistantMessage 뺀 컨텍스트 전송
          max_tokens: 1000,
          temperature: 0.7,
          stream: true,
        }),
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let assistantText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6)
          if (data === '[DONE]') {
            setIsLoading(false)
            return
          }
          try {
            const parsed = JSON.parse(data)
            const delta = parsed.choices[0]?.delta?.content
            if (delta) {
              assistantText += delta
              setMessages(prev => {
                const copy = [...prev]
                const last = copy[copy.length - 1]
                if (last?.role === 'assistant') {
                  last.content = assistantText
                }
                return copy
              })
            }
          } catch {
            // 파싱 에러 무시
          }
        }
      }
    } catch (err) {
      console.error(err)
      const errorMsg = {
        role: 'assistant',
        content: '⚠️ 오류 발생! API 키 확인 후 다시 시도해 주세요.',
        id: Date.now(),
      }
      setMessages(prev => [...prev.slice(0, -1), errorMsg])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="app">
      <div className="header">
        <h1>🤖 AI 채팅봇</h1>
        {showApiKeyInput ? (
          <div className="api-key-section">
            <input
              type="password"
              placeholder="OpenAI API 키를 입력하세요"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              className="api-key-input"
            />
            <button onClick={() => setShowApiKeyInput(false)} className="hide-api-key-btn">
              숨기기
            </button>
          </div>
        ) : (
          import.meta.env.VITE_OPENAI_API_KEY && (
            <div className="api-key-status">
              <span>✅ 환경 변수에서 API 키 사용 중</span>
              <button onClick={() => setShowApiKeyInput(true)}>변경</button>
            </div>
          )
        )}
      </div>

      <div className="chat-container">
        <div className="messages">
          {messages.length === 0 && (
            <div className="welcome-message">
              <p>안녕하세요! AI 채팅봇입니다. 무엇을 도와드릴까요?</p>
            </div>
          )}
          {messages.map((msg, idx) => (
            <div key={msg.id || idx} className={`message ${msg.role}`}>
              <div className="message-content">{msg.content}</div>
            </div>
          ))}
          {isLoading && (
            <div className="message assistant">
              <div className="message-content">
                <div className="typing-indicator">
                  <span></span><span></span><span></span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="input-section">
          <textarea
            value={inputMessage}
            onChange={e => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="메시지를 입력하세요..."
            disabled={isLoading}
            className="message-input"
          />
          <button
            onClick={sendMessage}
            disabled={
              isLoading ||
              !inputMessage.trim() ||
              (!apiKey.trim() && !import.meta.env.VITE_OPENAI_API_KEY)
            }
            className="send-button"
          >
            전송
          </button>
        </div>
      </div>
    </div>
  )
}

export default App
