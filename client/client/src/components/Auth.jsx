import React, { useState, useEffect } from 'react';
import axios from 'axios';

const testimonials = [
  {
    text: "P2P Live Chatroom transformed the way we connect! Real-time messaging is blazing fast and reliable.",
    author: "Akshat • Full-Stack Developer"
  },
  {
    text: "The UI design is impeccably clean, modern, and smooth. Absolute joy to use across all devices!",
    author: "Koushik • UI/UX Designer"
  }
];

export default function Auth({ setToken }) {
  const [isLogin, setIsLogin] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Password visibility toggles
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [currentIndex, setCurrentIndex] = useState(0);
  const [fade, setFade] = useState(true);
  const [sideAnimKey, setSideAnimKey] = useState(false);

  useEffect(() => {
    setSideAnimKey(false);
    const t = setTimeout(() => setSideAnimKey(true), 50);
    return () => clearTimeout(t);
  }, [isLogin]);

  useEffect(() => {
    const timer = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % testimonials.length);
        setFade(true);
      }, 400);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!isLogin && password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    // --- TEMPORARY MOCK BYPASS FOR INSTANT TESTING ---
    localStorage.setItem('token', 'mock-jwt-token-12345');
    setToken('mock-jwt-token-12345');
    return;
    // -------------------------------------------------

    /* 
    try {
      if (isLogin) {
        const response = await axios.post('http://localhost:5001/api/auth/login', {
          email,
          password,
        });
        localStorage.setItem('token', response.data.token);
        setToken(response.data.token);
      } else {
        await axios.post('http://localhost:5001/api/auth/signup', {
          username,
          email,
          password,
        });
        setSuccess('Account created successfully! Switching to sign in...');
        setTimeout(() => {
          setIsLogin(true);
          setSuccess('');
        }, 1500);
      }
    } catch (err) {
      setError('Authentication failed. Please check your backend connection.');
    }
    */
  };

  const handleSocialMock = (provider) => {
    alert(`${provider} authentication will be integrated with backend OAuth soon!`);
  };

  const handleForgotPassword = () => {
    const userEmail = prompt("Enter your account email to reset password:");
    if (userEmail) {
      alert(`Password reset link sent to ${userEmail}! (Mocked)`);
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'linear-gradient(135deg, #fbcfe8 0%, #e0e7ff 50%, #ccfbf1 100%)', padding: '20px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      
      <style>{`
        @keyframes floatOrb1 {
          0%, 100% { transform: translateY(0px) scale(1); }
          50% { transform: translateY(-15px) scale(1.05); }
        }
        @keyframes floatOrb2 {
          0%, 100% { transform: translateY(0px) scale(1); }
          50% { transform: translateY(15px) scale(1.1); }
        }
        @keyframes fadeInSlideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeInSlideLeft {
          from { opacity: 0; transform: translateX(30px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .animated-orb-1 { animation: floatOrb1 6s ease-in-out infinite; }
        .animated-orb-2 { animation: floatOrb2 8s ease-in-out infinite; }
        .auth-card-hover { transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
        .auth-card-hover:hover { box-shadow: 0 30px 70px -15px rgba(99, 102, 241, 0.35); }
        .signup-anim { animation: fadeInSlideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .login-anim { animation: fadeInSlideLeft 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
      `}</style>

      <div className="auth-card-hover" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', width: '980px', height: '620px', backgroundColor: '#ffffff', borderRadius: '32px', boxShadow: '0 25px 60px -15px rgba(99, 102, 241, 0.25)', overflow: 'hidden', position: 'relative' }}>
        
        {/* Left Side: Form Container */}
        <div style={{ padding: '36px 50px', display: 'flex', flexDirection: 'column', justifyContent: 'center', overflowY: 'auto' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <div style={{ width: '32px', height: '32px', background: 'linear-gradient(135deg, #6366f1 0%, #ec4899 100%)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold', fontSize: '15px', boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)' }}>
              ⚡
            </div>
            <span style={{ fontSize: '16px', fontWeight: 'bold', background: 'linear-gradient(135deg, #4f46e5 0%, #db2777 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '-0.5px' }}>P2P Chat</span>
          </div>

          <div style={{ textAlign: 'center', marginBottom: '12px' }}>
            <h2 style={{ fontSize: '22px', fontWeight: 'bold', color: '#1e1b4b', margin: '0 0 10px 0' }}>
              {isLogin ? 'Welcome Back ✨' : 'Create your account 🚀'}
            </h2>

            <div style={{ display: 'flex', backgroundColor: '#f1f5f9', borderRadius: '50px', padding: '4px', width: '220px', margin: '0 auto 12px auto', border: '1px solid #e2e8f0' }}>
              <button
                type="button"
                onClick={() => { setIsLogin(false); setError(''); setSuccess(''); }}
                style={{ flex: 1, backgroundColor: !isLogin ? '#ffffff' : 'transparent', color: !isLogin ? '#4f46e5' : '#64748b', border: 'none', padding: '6px 0', borderRadius: '50px', fontSize: '11px', fontWeight: '600', cursor: 'pointer', boxShadow: !isLogin ? '0 4px 12px rgba(79, 70, 229, 0.15)' : 'none', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}
              >
                Sign up
              </button>
              <button
                type="button"
                onClick={() => { setIsLogin(true); setError(''); setSuccess(''); }}
                style={{ flex: 1, backgroundColor: isLogin ? '#ffffff' : 'transparent', color: isLogin ? '#4f46e5' : '#64748b', border: 'none', padding: '6px 0', borderRadius: '50px', fontSize: '11px', fontWeight: '600', cursor: 'pointer', boxShadow: isLogin ? '0 4px 12px rgba(79, 70, 229, 0.15)' : 'none', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}
              >
                Log in
              </button>
            </div>
          </div>

          {/* Error Banner - only displays when error is populated */}
          {error && (
            <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fee2e2', color: '#dc2626', padding: '6px 10px', borderRadius: '8px', fontSize: '11px', marginBottom: '10px', textAlign: 'center' }}>
              {error}
            </div>
          )}

          {success && (
            <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #dcfce7', color: '#16a34a', padding: '6px 10px', borderRadius: '8px', fontSize: '11px', marginBottom: '10px', textAlign: 'center' }}>
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            
            {!isLogin && (
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#475569', marginBottom: '2px' }}>Full name</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your name"
                  required={!isLogin}
                  style={{ width: '100%', backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '9px 12px', fontSize: '11px', outline: 'none', color: '#1e293b', boxSizing: 'border-box' }}
                />
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#475569', marginBottom: '2px' }}>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
                style={{ width: '100%', backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '9px 12px', fontSize: '11px', outline: 'none', color: '#1e293b', boxSizing: 'border-box' }}
              />
            </div>

            {/* Password Field with Eye Toggle */}
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#475569', marginBottom: '2px' }}>Password</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  style={{ width: '100%', backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '9px 36px 9px 12px', fontSize: '11px', outline: 'none', color: '#1e293b', boxSizing: 'border-box' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position: 'absolute', right: '10px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', color: '#64748b', padding: 0, display: 'flex', alignItems: 'center' }}
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
            </div>

            {/* Repeat Password Field with Eye Toggle (Signup only) */}
            {!isLogin && (
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#475569', marginBottom: '2px' }}>Repeat password</label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat your password"
                    required={!isLogin}
                    style={{ width: '100%', backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '9px 36px 9px 12px', fontSize: '11px', outline: 'none', color: '#1e293b', boxSizing: 'border-box' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    style={{ position: 'absolute', right: '10px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', color: '#64748b', padding: 0, display: 'flex', alignItems: 'center' }}
                    title={showConfirmPassword ? "Hide password" : "Show password"}
                  >
                    {showConfirmPassword ? '👁️' : '👁️‍🗨️'}
                  </button>
                </div>
              </div>
            )}

            {isLogin && (
              <div style={{ textAlign: 'right', marginTop: '-2px' }}>
                <button type="button" onClick={handleForgotPassword} style={{ background: 'none', border: 'none', fontSize: '11px', color: '#4f46e5', cursor: 'pointer', padding: 0, fontWeight: '600' }}>
                  Forgot password?
                </button>
              </div>
            )}

            <button
              type="submit"
              style={{ width: '100%', background: 'linear-gradient(135deg, #4f46e5 0%, #db2777 100%)', color: '#ffffff', fontWeight: '600', padding: '10px', borderRadius: '10px', border: 'none', cursor: 'pointer', fontSize: '12px', marginTop: '2px', boxShadow: '0 6px 16px rgba(79, 70, 229, 0.35)', transition: 'transform 0.2s, filter 0.2s' }}
              onMouseEnter={(e) => e.target.style.filter = 'brightness(1.1)'}
              onMouseLeave={(e) => e.target.style.filter = 'brightness(1.0)'}
            >
              {isLogin ? 'Login Now' : 'Sign up'}
            </button>
          </form>

          {/* Social Buttons */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
            <button onClick={() => handleSocialMock('Google')} style={{ flex: 1, backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '7px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold', color: '#ea4335', boxShadow: '0 2px 5px rgba(0,0,0,0.04)' }}>
              G
            </button>
            <button onClick={() => handleSocialMock('Apple')} style={{ flex: 1, backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '7px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '13px', color: '#000000', boxShadow: '0 2px 5px rgba(0,0,0,0.04)' }}>
              
            </button>
          </div>
        </div>

        {/* Right Side: Dynamic Animated Gradient Banner */}
        <div style={{ 
          background: 'linear-gradient(135deg, #4f46e5 0%, #9333ea 50%, #db2777 100%)',
          display: 'flex', 
          flexDirection: 'column', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          padding: '30px',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div className="animated-orb-1" style={{ position: 'absolute', top: '-20px', right: '-20px', width: '160px', height: '160px', backgroundColor: 'rgba(255, 255, 255, 0.15)', borderRadius: '50%', filter: 'blur(25px)' }}></div>
          <div className="animated-orb-2" style={{ position: 'absolute', bottom: '-10px', left: '-10px', width: '140px', height: '140px', backgroundColor: 'rgba(236, 72, 153, 0.3)', borderRadius: '50%', filter: 'blur(30px)' }}></div>

          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', zIndex: 2 }}>
            {sideAnimKey && (
              <div className={!isLogin ? "signup-anim" : "login-anim"} style={{ textAlign: 'center' }}>
                {!isLogin ? (
                  <>
                    <div style={{ fontSize: '50px', marginBottom: '10px', filter: 'drop-shadow(0 6px 15px rgba(0,0,0,0.25))' }}>🚀✨</div>
                    <h3 style={{ fontSize: '20px', fontWeight: '800', color: '#ffffff', letterSpacing: '0.5px', margin: '0 0 6px 0', textShadow: '0 2px 6px rgba(0,0,0,0.3)' }}>
                      Get ready to talk
                    </h3>
                    <p style={{ fontSize: '12px', color: '#e0e7ff', margin: 0, fontWeight: '500' }}>
                      Join the ultimate peer-to-peer live experience
                    </p>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: '50px', marginBottom: '10px', filter: 'drop-shadow(0 6px 15px rgba(0,0,0,0.25))' }}>👋💻</div>
                    <h3 style={{ fontSize: '20px', fontWeight: '800', color: '#ffffff', letterSpacing: '0.5px', margin: '0 0 6px 0', textShadow: '0 2px 6px rgba(0,0,0,0.3)' }}>
                      Welcome back
                    </h3>
                    <p style={{ fontSize: '12px', color: '#e0e7ff', margin: 0, fontWeight: '500' }}>
                      Jump right back into your secure chat rooms
                    </p>
                  </>
                )}
              </div>
            )}
          </div>

          <div style={{ 
            width: '100%',
            backgroundColor: 'rgba(255, 255, 255, 0.15)', 
            backdropFilter: 'blur(14px)', 
            padding: '14px 16px', 
            borderRadius: '16px', 
            border: '1px solid rgba(255, 255, 255, 0.3)', 
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.2)',
            color: '#ffffff',
            opacity: fade ? 1 : 0,
            transform: fade ? 'translateY(0) scale(1)' : 'translateY(8px) scale(0.98)',
            transition: 'opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1), transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
            boxSizing: 'border-box',
            zIndex: 2
          }}>
            <p style={{ fontSize: '11px', lineHeight: '1.4', color: '#f8fafc', margin: '0 0 8px 0' }}>
              "{testimonials[currentIndex].text}"
            </p>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '10px', color: '#fdf4ff', fontWeight: '600' }}>{testimonials[currentIndex].author}</span>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button 
                  type="button"
                  onClick={() => setCurrentIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length)}
                  style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  ←
                </button>
                <button 
                  type="button"
                  onClick={() => setCurrentIndex((prev) => (prev + 1) % testimonials.length)}
                  style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  →
                </button>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}