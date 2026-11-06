import React, { useState } from 'react';
import Auth from './components/Auth';
import Chat from './components/Chat';

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));

  if (!token) {
    return <Auth setToken={setToken} />;
  }

  return <Chat />;
}