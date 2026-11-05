import React, { useState } from 'react';
import axios from 'axios';

export default function Signup({ switchToLogin }) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    try {
      // Send username along with email and password
      const response = await axios.post('http://localhost:5001/api/auth/signup', {
        username,
        email,
        password,
      });

      setSuccessMsg('Account created successfully! You can now log in.');
      setUsername('');
      setEmail('');
      setPassword('');
    } catch (err) {
      setError(err.response?.data?.error || 'Server error during signup.');
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#0f172a', color: '#fff', fontFamily: 'sans-serif' }}>
      <form onSubmit={handleSignup} style={{ background: '#1e293b', padding: '2rem', borderRadius: '12px', width: '320px', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
        <h2 style={{ marginBottom: '1.5rem', textAlign: 'center' }}>💬 P2P Chat Signup</h2>

        {error && <p style={{ color: '#f87171', fontSize: '0.9rem', marginBottom: '1rem' }}>{error}</p>}
        {successMsg && <p style={{ color: '#4ade80', fontSize: '0.9rem', marginBottom: '1rem' }}>{successMsg}</p>}

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.5rem' }}>Username</label>
          <input 
            type="text" 
            value={username} 
            onChange={(e) => setUsername(e.target.value)} 
            required
            style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #475569', background: '#0f172a', color: '#fff' }}
          />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.5rem' }}>Email</label>
          <input 
            type="email" 
            value={email} 
            onChange={(e) => setEmail(e.target.value)} 
            required
            style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #475569', background: '#0f172a', color: '#fff' }}
          />
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.5rem' }}>Password</label>
          <input 
            type="password" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
            required
            style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #475569', background: '#0f172a', color: '#fff' }}
          />
        </div>

        <button type="submit" style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: 'none', background: '#10b981', color: '#fff', fontWeight: 'bold', cursor: 'pointer', marginBottom: '1rem' }}>
          Sign Up
        </button>

        {switchToLogin && (
          <p style={{ textAlign: 'center', fontSize: '0.85rem', color: '#94a3b8' }}>
            Already have an account? <span onClick={switchToLogin} style={{ color: '#3b82f6', cursor: 'pointer', textDecoration: 'underline' }}>Log In</span>
          </p>
        )}
      </form>
    </div>
  );
}