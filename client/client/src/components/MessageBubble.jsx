import React, { useState } from 'react';

export default function MessageBubble({
  msg,
  prevMsg,
  nextMsg,
  currentUser,
  currentUserAvatar,
  peerAvatar,
  currentUserId,
  currentSocketId,
  onReaction,
  onReply,
  onEdit,
  onDelete,
  onViewAttachment
}) {
  const [showReactionMenu, setShowReactionMenu] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [showLongPressMenu, setShowLongPressMenu] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [showReactionDetails, setShowReactionDetails] = useState(false);
  const [selectedReactionEmoji, setSelectedReactionEmoji] = useState('');
  const longPressTimer = React.useRef(null);
  const touchStart = React.useRef(null);
  const touchMoved = React.useRef(false);
  const isMe = msg.senderId && currentUserId
    ? msg.senderId === currentUserId
    : msg.senderSocketId
      ? msg.senderSocketId === currentSocketId
      : msg.sender === currentUser;

  const isSameSender = (first, second) => first && second && (
    first.senderId && second.senderId
      ? first.senderId === second.senderId
      : first.sender === second.sender
  );
  const isSameSenderAsPrev = isSameSender(prevMsg, msg);
  const isSameSenderAsNext = isSameSender(msg, nextMsg);

  // Instagram consecutive bubble border-radius grouping
  let borderRadius = '18px';
  if (isMe) {
    if (isSameSenderAsPrev && isSameSenderAsNext) borderRadius = '18px 4px 4px 18px';
    else if (isSameSenderAsPrev) borderRadius = '18px 4px 18px 18px';
    else if (isSameSenderAsNext) borderRadius = '18px 18px 4px 18px';
  } else {
    if (isSameSenderAsPrev && isSameSenderAsNext) borderRadius = '4px 18px 18px 4px';
    else if (isSameSenderAsPrev) borderRadius = '4px 18px 18px 18px';
    else if (isSameSenderAsNext) borderRadius = '18px 18px 18px 4px';
  }

  const showTimestamp = !isSameSenderAsNext;

  const attachment = msg.attachment;
  const isImageAttachment = attachment?.kind === 'photo'
    || (attachment?.type || '').startsWith('image/');
  const isVoiceAttachment = attachment?.kind === 'voice'
    || (attachment?.type || '').startsWith('audio/');
  const reactionGroups = Object.entries(msg.reactions || {})
    .filter(([, users]) => Array.isArray(users) && users.length)
    .sort(([, first], [, second]) => second.length - first.length);
  const topReactionGroups = reactionGroups.slice(0, 3);
  const downloadAttachment = () => {
    if (!attachment?.dataUrl) return;
    const link = document.createElement('a');
    link.href = attachment.dataUrl;
    link.download = attachment.name || 'P2P attachment';
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const openAttachment = () => {
    if (!attachment?.dataUrl) return;
    onViewAttachment?.(attachment);
  };

  const startLongPress = () => {
    if (msg.sender === 'System') return;
    longPressTimer.current = setTimeout(() => setShowLongPressMenu(true), 500);
  };
  const cancelLongPress = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  };

  const handleTouchStart = event => {
    const touch = event.touches[0];
    touchStart.current = { x: touch.clientX, y: touch.clientY };
    touchMoved.current = false;
    startLongPress();
  };

  const handleTouchMove = event => {
    if (!touchStart.current) return;
    const touch = event.touches[0];
    const dx = touch.clientX - touchStart.current.x;
    const dy = touch.clientY - touchStart.current.y;
    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
      touchMoved.current = true;
      cancelLongPress();
    }
  };

  const handleTouchEnd = event => {
    cancelLongPress();
    if (!touchMoved.current || !touchStart.current) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - touchStart.current.x;
    const dy = touch.clientY - touchStart.current.y;
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy)) {
      onReply?.(msg);
      if (navigator.vibrate) navigator.vibrate(20);
    }
    touchStart.current = null;
  };

  return (
    <div
      className="p2p-message-bubble"
      style={{ 
        alignSelf: isMe ? 'flex-end' : 'flex-start', 
        maxWidth: '65%', 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: isMe ? 'flex-end' : 'flex-start',
        marginTop: isSameSenderAsPrev ? '2px' : '10px',
        position: 'relative'
      }}
      onContextMenu={event => {
        event.preventDefault();
        if (msg.sender !== 'System') setShowActionMenu(true);
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
      onTouchCancel={cancelLongPress}
    >
      {!isSameSenderAsPrev && <span style={{ fontSize: '10px', color: '#737373', marginBottom: '3px', padding: '0 4px' }}>{msg.sender}</span>}
      
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', flexDirection: isMe ? 'row-reverse' : 'row' }}>

        {!isMe && (
          <div style={{
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            overflow: 'hidden',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#262626',
            color: '#a8a8a8',
            fontSize: '11px',
            fontWeight: '600',
            marginBottom: '2px'
          }}>
            {msg.senderAvatar || peerAvatar
              ? <img
                  src={msg.senderAvatar || peerAvatar}
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              : (msg.sender?.[0] || '👤')}
          </div>
        )}
        
        {/* Hover Action Bar */}
        {msg.sender !== 'System' && (
          <button
            type="button"
            className="action-bar p2p-desktop-message-action"
            onClick={() => setShowActionMenu(previous => !previous)}
            aria-label="Message options"
            style={{
              display: 'none',
              position: 'absolute',
              top: '50%',
              [isMe ? 'left' : 'right']: 'calc(100% + 8px)',
              transform: 'translateY(-50%)',
              width: '32px',
              height: '32px',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid #333',
              borderRadius: '50%',
              backgroundColor: '#1a1a1a',
              color: '#a8a8a8',
              cursor: 'pointer',
              fontSize: '16px',
              zIndex: 20
            }}
            title="Reply, react, edit or delete"
          >
            ⋮
          </button>
        )}

        {/* Bubble */}
        <div 
          className={`p2p-message-content ${isMe ? 'p2p-own-message' : 'p2p-incoming-message'}`}
          onDoubleClick={() => msg.sender !== 'System' && onReaction?.(msg.id, '❤️')}
          style={{ 
            background: isMe ? 'linear-gradient(135deg, #3797F0 0%, #833AB4 100%)' : '#262626', 
            color: '#ffffff', 
            padding: '10px 16px', 
            borderRadius: borderRadius, 
            fontSize: '14px', 
            lineHeight: '1.4',
            wordBreak: 'break-word',
            position: 'relative',
            cursor: 'pointer',
            userSelect: 'none'
          }}
        >
          {msg.replyTo && (
            <div style={{ backgroundColor: 'rgba(0, 0, 0, 0.25)', borderLeft: '3px solid #3797F0', padding: '6px 10px', borderRadius: '6px', marginBottom: '6px', fontSize: '12px', color: '#d4d4d4' }}>
              <div style={{ fontWeight: '600', color: '#ffffff', fontSize: '11px' }}>{msg.replyTo.sender}</div>
              <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{msg.replyTo.text}</div>
            </div>
          )}

          {msg.text && <div>{msg.text}</div>}
          {attachment && (
            <div style={{ marginTop: msg.text ? '8px' : 0, maxWidth: '280px' }}>
              {isImageAttachment && attachment.dataUrl && (
                <button
                  type="button"
                  onClick={openAttachment}
                  title={`Open ${attachment.name || 'image'}`}
                  style={{ display: 'block', width: '100%', maxWidth: '280px', border: 0, padding: 0, background: 'transparent', cursor: 'pointer' }}
                >
                  <img
                    src={attachment.dataUrl}
                    alt={attachment.name || 'Shared image'}
                    style={{ display: 'block', width: '100%', maxHeight: '260px', objectFit: 'cover', borderRadius: '10px' }}
                  />
                </button>
              )}
              {isVoiceAttachment && attachment.dataUrl && (
                <audio
                  controls
                  preload="metadata"
                  src={attachment.dataUrl}
                  style={{ display: 'block', width: 'min(260px, 65vw)', height: '36px' }}
                  onClick={event => event.stopPropagation()}
                />
              )}
              {attachment && !isImageAttachment && !isVoiceAttachment && (
                <button
                  type="button"
                  onClick={openAttachment}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid rgba(255,255,255,0.18)', borderRadius: '10px', backgroundColor: 'rgba(0,0,0,0.18)', color: '#fff', padding: '10px', cursor: 'pointer', textAlign: 'left' }}
                >
                  <span style={{ fontSize: '20px' }}>📄</span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', maxWidth: '210px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: '600' }}>{attachment.name}</span>
                    <span style={{ display: 'block', fontSize: '10px', opacity: 0.75 }}>Tap to open</span>
                  </span>
                </button>
              )}
            </div>
          )}
          {attachment && (
            <div style={{ position: 'relative', marginTop: '6px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                aria-label="Attachment options"
                onClick={event => { event.stopPropagation(); setShowAttachmentMenu(previous => !previous); }}
                style={{ border: 0, background: 'transparent', color: '#d4d4d4', cursor: 'pointer', fontSize: '16px', padding: '2px 6px' }}
              >
                ⋮
              </button>
              {showAttachmentMenu && (
                <div
                  style={{ position: 'absolute', right: 0, bottom: '24px', minWidth: '150px', border: '1px solid #333', borderRadius: '10px', backgroundColor: '#1a1a1a', boxShadow: '0 10px 25px rgba(0,0,0,0.65)', padding: '6px', zIndex: 30 }}
                  onClick={event => event.stopPropagation()}
                >
                  <button type="button" onClick={() => { openAttachment(); setShowAttachmentMenu(false); }} style={{ width: '100%', border: 0, borderRadius: '6px', background: 'transparent', color: '#fff', padding: '8px 10px', textAlign: 'left', cursor: 'pointer', fontSize: '12px' }}>Open</button>
                  <button type="button" onClick={() => { downloadAttachment(); setShowAttachmentMenu(false); }} style={{ width: '100%', border: 0, borderRadius: '6px', background: 'transparent', color: '#fff', padding: '8px 10px', textAlign: 'left', cursor: 'pointer', fontSize: '12px' }}>Download</button>
                </div>
              )}
            </div>
          )}
          {msg.edited && <span style={{ marginLeft: '6px', fontSize: '10px', color: '#d4d4d4', opacity: 0.75 }}>(edited)</span>}

          {(topReactionGroups.length > 0 || msg.reaction) && (
            <button
              type="button"
              onClick={event => {
                event.stopPropagation();
                setSelectedReactionEmoji('');
                setShowReactionDetails(true);
              }}
              title="View all reactions"
              style={{ position: 'absolute', bottom: '-10px', right: isMe ? '8px' : 'auto', left: isMe ? 'auto' : '8px', display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: '#1a1a1a', border: '1px solid #262626', borderRadius: '14px', padding: '3px 8px', fontSize: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.5)', cursor: 'pointer', color: '#fff' }}
            >
              {topReactionGroups.length
                ? topReactionGroups.map(([emoji]) => <span key={emoji}>{emoji}</span>)
                : <span>{msg.reaction}</span>}
              {reactionGroups.reduce((total, [, users]) => total + users.length, 0) > 1 && (
                <span style={{ color: '#d4d4d4', fontSize: '10px' }}>
                  {reactionGroups.reduce((total, [, users]) => total + users.length, 0)}
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Quick Reaction Pill Menu */}
      {showReactionMenu && (
        <div style={{ display: 'flex', gap: '8px', backgroundColor: '#1a1a1a', border: '1px solid #262626', borderRadius: '24px', padding: '6px 12px', marginTop: '6px', zIndex: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.6)' }}>
          {['❤️', '😂', '😮', '😢', '🙏', '👍'].map(emoji => (
            <button type="button" key={emoji} onClick={() => { onReaction?.(msg.id, emoji); setShowReactionMenu(false); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', padding: 0 }} title={emoji}>{emoji}</button>
          ))}
        </div>
      )}

      {(showActionMenu || showLongPressMenu) && (
        <div
          className="p2p-message-action-menu"
          style={{ position: 'fixed', left: '50%', bottom: showLongPressMenu ? '32px' : 'auto', top: showActionMenu && !showLongPressMenu ? '50%' : 'auto', transform: 'translate(-50%, -50%)', width: 'min(340px, calc(100vw - 32px))', display: 'flex', flexDirection: 'column', backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '16px', padding: '8px', zIndex: 7100, boxShadow: '0 18px 45px rgba(0,0,0,0.75)' }}
        >
          {(showActionMenu || showLongPressMenu) && (
            <div style={{ display: 'flex', justifyContent: 'space-around', padding: '8px 4px 12px', borderBottom: '1px solid #333', marginBottom: '4px' }}>
              {['❤️', '😂', '😮', '😢', '🙏', '👍'].map(emoji => (
                <button type="button" key={emoji} onClick={() => { onReaction?.(msg.id, emoji); setShowActionMenu(false); setShowLongPressMenu(false); }} style={{ border: 0, background: 'transparent', fontSize: '20px', cursor: 'pointer', padding: '4px' }}>{emoji}</button>
              ))}
            </div>
          )}
          {onReply && <button type="button" onClick={() => { onReply(msg); setShowActionMenu(false); setShowLongPressMenu(false); }} style={{ border: 0, background: 'transparent', color: '#f5f5f5', textAlign: 'left', padding: '11px 12px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>↩ Reply</button>}
          {isMe && onEdit && <button type="button" onClick={() => { onEdit(msg); setShowActionMenu(false); setShowLongPressMenu(false); }} style={{ border: 0, background: 'transparent', color: '#f5f5f5', textAlign: 'left', padding: '11px 12px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>✎ Edit</button>}
          {onDelete && msg.id && <button type="button" onClick={() => { onDelete(msg); setShowActionMenu(false); setShowLongPressMenu(false); }} style={{ border: 0, background: 'transparent', color: '#ef4444', textAlign: 'left', padding: '11px 12px', cursor: 'pointer', fontSize: '13px', fontWeight: '700' }}>🗑 Delete</button>}
        </div>
      )}

      {showReactionDetails && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Message reactions"
          onClick={() => setShowReactionDetails(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 7200, backgroundColor: 'rgba(0,0,0,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
        >
          <div
            onClick={event => event.stopPropagation()}
            style={{ width: 'min(380px, calc(100vw - 40px))', maxHeight: '70vh', overflowY: 'auto', backgroundColor: '#121212', border: '1px solid #333', borderRadius: '18px', padding: '18px' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <h3 style={{ margin: 0, color: '#f5f5f5', fontSize: '16px' }}>Reactions</h3>
              <button type="button" onClick={() => setShowReactionDetails(false)} aria-label="Close reactions" style={{ border: 0, background: 'transparent', color: '#a8a8a8', cursor: 'pointer', fontSize: '18px' }}>✕</button>
            </div>
            {reactionGroups.length ? reactionGroups.map(([emoji, users]) => (
              <div key={emoji} style={{ marginBottom: '12px' }}>
                <div style={{ color: '#f5f5f5', fontSize: '15px', fontWeight: '700', marginBottom: '6px' }}>
                  {emoji} <span style={{ color: '#a8a8a8', fontSize: '11px' }}>{users.length}</span>
                </div>
                {users.map(user => (
                  <div key={user.userId} style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '7px 8px', borderRadius: '10px', backgroundColor: '#1a1a1a', marginTop: '5px' }}>
                    <div style={{ width: '30px', height: '30px', borderRadius: '50%', overflow: 'hidden', backgroundColor: '#262626', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d4d4d4', fontSize: '11px' }}>
                      {user.avatar ? <img src={user.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (user.username?.[0] || '👤')}
                    </div>
                    <span style={{ color: '#f5f5f5', fontSize: '12px', fontWeight: '600' }}>{user.username}</span>
                  </div>
                ))}
              </div>
            )) : (
              <div style={{ color: '#a8a8a8', fontSize: '12px', textAlign: 'center', padding: '18px 0' }}>No reactions yet.</div>
            )}
          </div>
        </div>
      )}

      {showTimestamp && (
        <span style={{ fontSize: '10px', color: '#737373', marginTop: (topReactionGroups.length || msg.reaction) ? '12px' : '3px', padding: '0 4px' }}>
          {msg.time}
          {isMe && msg.seen && (
            <span style={{ marginLeft: '6px', color: '#3797F0', fontStyle: 'italic' }}>
              Seen{msg.seenTime ? ` at ${msg.seenTime}` : ''}
            </span>
          )}
        </span>
      )}
    </div>
  );
}