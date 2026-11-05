import React, { useState } from 'react';
import axios from 'axios';

export default function Login({ switchToSignup }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    try {
      const response = await axios.post('http://localhost:5001/api/auth/login', {
        email,
        password,
      });

      localStorage.setItem('token', response.data.token);
      setSuccessMsg('Login successful! Token saved.');
      console.log('Logged in user:', response.data.user);
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong during login.');
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#0f172a', color: '#fff', fontFamily: 'sans-serif' }}>
      <form onSubmit={handleLogin} style={{ background: '#1e293b', padding: '2rem', borderRadius: '12px', width: '320px', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
        <h2 style={{ marginBottom: '1.5rem', textAlign: 'center' }}>💬 P2P Chat Login</h2>

        {error && <p style={{ color: '#f87171', fontSize: '0.9rem', marginBottom: '1rem' }}>{error}</p>}
        {successMsg && <p style={{ color: '#4ade80', fontSize: '0.9rem', marginBottom: '1rem' }}>{successMsg}</p>}

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

        <button type="submit" style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: 'none', background: '#3b82f6', color: '#fff', fontWeight: 'bold', cursor: 'pointer', marginBottom: '1rem' }}>
          Log In
        </button>

        {switchToSignup && (
          <p style={{ textAlign: 'center', fontSize: '0.85rem', color: '#94a3b8' }}>
            Don't have an account? <span onClick={switchToSignup} style={{ color: '#3b82f6', cursor: 'pointer', textDecoration: 'underline' }}>Sign Up</span>
          </p>
        )}
      </form>
    </div>
  );
}