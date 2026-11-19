import React, { useRef, useEffect } from 'react';
import MessageBubble from './MessageBubble';

export default function ChatWindow({ activePeer, messages, currentUser, currentSocketId, messageInput, setMessageInput, onSendMessage, replyingTo, setReplyingTo, onReaction, isConnected }) {
    const messagesEndRef = useRef(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#000000', borderRight: '1px solid #262626' }}>

            {/* Header with P2P Connection Status */}
            <div style={{ height: '70px', borderBottom: '1px solid #262626', padding: '0 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#121212' }}>
                <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '600', color: '#f5f5f5' }}>{activePeer.name}</h4>

                {/* P2P Link Status Indicator */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: '600', color: '#a8a8a8' }}>
                    <span style={{
                        width: '10px',
                        height: '10px',
                        borderRadius: '50%',
                        backgroundColor: isConnected ? '#31a24c' : '#f59e0b',
                        boxShadow: isConnected ? '0 0 8px rgba(49,162,76,0.6)' : '0 0 8px rgba(245,158,11,0.6)'
                    }}></span>
                    {isConnected ? 'P2P Connected' : 'Connecting...'}
                </div>
            </div>

            {/* Message Stream */}
            <div style={{ flex: 1, padding: '28px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
       // Inside ChatWindow.jsx, update the messages .map() loop:
                {messages.map((msg, index, arr) => (
                    <MessageBubble
                        key={`${msg.id || 'msg'}-${index}-${msg.time || Date.now()}`}
                        msg={msg}
                        prevMsg={arr[index - 1]}
                        nextMsg={arr[index + 1]}
                        currentUser={currentUser}
                        currentUserAvatar={activePeer?.currentUserAvatar}
                        peerAvatar={activePeer?.avatar}
                        currentSocketId={currentSocketId}
                        onReaction={onReaction}
                        onReply={setReplyingTo}
                    />
                ))}
                <div ref={messagesEndRef} />
            </div>

            {/* Quote Reply Banner */}
            {replyingTo && (
                <div style={{ padding: '10px 24px', backgroundColor: '#121212', borderTop: '1px solid #262626', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '12px', color: '#a8a8a8', borderLeft: '3px solid #3797F0', paddingLeft: '10px' }}>
                        Replying to <strong style={{ color: '#f5f5f5' }}>{replyingTo.sender}</strong>: {replyingTo.text}
                    </div>
                    <button onClick={() => setReplyingTo(null)} style={{ background: 'none', border: 'none', color: '#a8a8a8', cursor: 'pointer', fontSize: '16px' }} title="Cancel Reply">✕</button>
                </div>
            )}

            {/* Input Bar */}
            <div style={{ padding: '20px 28px', borderTop: '1px solid #262626', backgroundColor: '#121212' }}>
                <form onSubmit={onSendMessage} style={{ display: 'flex', alignItems: 'center', backgroundColor: '#262626', borderRadius: '24px', padding: '4px 8px 4px 16px' }}>
                    <input
                        type="text"
                        value={messageInput}
                        onChange={(e) => setMessageInput(e.target.value)}
                        placeholder="Message..."
                        style={{ flex: 1, backgroundColor: 'transparent', border: 'none', padding: '10px 0', fontSize: '14px', outline: 'none', color: '#f5f5f5' }}
                    />
                    <button type="submit" style={{ background: 'none', border: 'none', color: '#0095f6', fontWeight: '600', fontSize: '14px', cursor: 'pointer', padding: '8px 16px' }}>
                        {messageInput.trim() ? 'Send' : '🎤'}
                    </button>
                </form>
            </div>

        </div>
    );
}