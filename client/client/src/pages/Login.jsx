import React, { useState } from 'react';
import axios from 'axios';

export default function Login({ switchToSignup, setToken }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post('http://localhost:5001/api/auth/login', {
        email,
        password,
      });
      localStorage.setItem('token', response.data.token);
      setToken(response.data.token);
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', backgroundColor: '#f0f2f5', padding: '20px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', width: '960px', minHeight: '580px', backgroundColor: '#ffffff', borderRadius: '32px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15)', overflow: 'hidden' }}>
        
        {/* Left Side: Form Container */}
        <div style={{ padding: '50px 60px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <h2 style={{ fontSize: '30px', fontWeight: 'bold', color: '#111827', margin: '0 0 16px 0' }}>Sign In</h2>
            
            {/* Google Icon Button */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', fontWeight: 'bold', color: '#ea4335', cursor: 'pointer', backgroundColor: '#fff', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                G
              </div>
            </div>

            <p style={{ fontSize: '12px', color: '#9ca3af', margin: 0 }}>Or use your account</p>
          </div>

          {error && (
            <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fee2e2', color: '#dc2626', padding: '10px', borderRadius: '10px', fontSize: '12px', marginBottom: '16px', textAlign: 'center' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email Address"
              required
              style={{ width: '100%', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '14px 18px', fontSize: '13px', outline: 'none', color: '#1f2937', boxSizing: 'border-box' }}
            />

            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              required
              style={{ width: '100%', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '14px 18px', fontSize: '13px', outline: 'none', color: '#1f2937', boxSizing: 'border-box' }}
            />

            <div style={{ textAlign: 'center', marginTop: '2px' }}>
              <a href="#" style={{ fontSize: '12px', color: '#9ca3af', textDecoration: 'none' }}>Forgot your password?</a>
            </div>

            <button
              type="submit"
              style={{ width: '100%', backgroundColor: '#1b4332', color: '#ffffff', fontWeight: '500', padding: '14px', borderRadius: '50px', border: 'none', cursor: 'pointer', fontSize: '14px', marginTop: '6px', boxShadow: '0 4px 12px rgba(27, 67, 50, 0.25)', transition: 'background 0.2s' }}
            >
              Sign In
            </button>
          </form>
        </div>

        {/* Right Side: Blurred Artistic Photo Banner with Dark Teal Tint */}
        <div style={{ 
          backgroundImage: `linear-gradient(rgba(15, 38, 28, 0.75), rgba(15, 38, 28, 0.85)), url('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1000&auto=format&fit=crop')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          display: 'flex', 
          flexDirection: 'column', 
          justifyContent: 'center', 
          alignItems: 'center', 
          padding: '50px', 
          textAlign: 'center', 
          color: '#ffffff',
          backdropFilter: 'blur(8px)'
        }}>
          <div style={{ maxWidth: '280px' }}>
            <h2 style={{ fontSize: '32px', fontWeight: 'bold', margin: '0 0 16px 0' }}>Hey There!</h2>
            <p style={{ fontSize: '13px', color: '#cbd5e1', lineHeight: '1.6', margin: '0 0 28px 0' }}>
              Create your account now and step into an amazing journey.
            </p>
            <button
              onClick={switchToSignup}
              style={{ border: '2px solid rgba(255, 255, 255, 0.9)', backgroundColor: 'transparent', color: '#ffffff', fontWeight: '500', padding: '12px 36px', borderRadius: '50px', cursor: 'pointer', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', transition: 'all 0.2s' }}
            >
              Sign Up
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}