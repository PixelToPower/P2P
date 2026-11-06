import React, { useState } from 'react';
import axios from 'axios';

export default function Signup({ switchToLogin }) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSignup = async (e) => {
    e.preventDefault();
    try {
      await axios.post('http://localhost:5001/api/auth/signup', {
        username,
        email,
        password,
      });
      setSuccess('Account created successfully! Redirecting to login...');
      setTimeout(() => {
        switchToLogin();
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.message || 'Signup failed');
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden grid grid-cols-1 md:grid-cols-2">
        
        {/* Left Side: Visual Banner for Signup */}
        <div className="hidden md:flex flex-col justify-center items-center p-12 text-center bg-gradient-to-br from-[#1b4332] to-[#081c15] text-white relative overflow-hidden">
          <div className="absolute inset-0 bg-black/20"></div>
          
          <div className="relative z-10 max-w-xs space-y-4">
            <h2 className="text-3xl font-bold tracking-tight">Welcome Back!</h2>
            <p className="text-xs text-gray-300 leading-relaxed">
              Already have an account? Sign in to continue your journey with us.
            </p>
            <button
              onClick={switchToLogin}
              className="mt-4 border-2 border-white/80 hover:bg-white hover:text-gray-900 text-white font-medium px-8 py-2.5 rounded-full text-xs tracking-wider uppercase transition"
            >
              Sign In
            </button>
          </div>
        </div>

        {/* Right Side: Form Container */}
        <div className="p-8 sm:p-12 flex flex-col justify-center">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900 tracking-tight">Create Account</h2>
            <p className="text-xs text-gray-400 mt-2">Register with your email</p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-xl text-xs mb-4 text-center">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 text-green-600 p-3 rounded-xl text-xs mb-4 text-center">
              {success}
            </div>
          )}

          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username"
                required
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 text-sm focus:outline-none focus:border-teal-700 transition placeholder-gray-400 text-gray-800"
              />
            </div>

            <div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email Address"
                required
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 text-sm focus:outline-none focus:border-teal-700 transition placeholder-gray-400 text-gray-800"
              />
            </div>

            <div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                required
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 text-sm focus:outline-none focus:border-teal-700 transition placeholder-gray-400 text-gray-800"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-[#1b4332] hover:bg-[#081c15] text-white font-medium py-3.5 rounded-full transition shadow-lg shadow-teal-900/10 text-sm tracking-wide mt-2"
            >
              Sign Up
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}