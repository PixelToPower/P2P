import React, { useState, useEffect } from 'react';
import axios from 'axios';
import InAppDialog from './InAppDialog';

const testimonials = [
  {
    text: "P2P Live Chatroom makes conversations fast, private, and effortless.",
    author: "Akshat • P2P Community"
  },
  {
    text: "Connect with people, share moments, and keep every conversation in one place.",
    author: "Akshat • P2P Community"
  }
];

const loadSavedProfiles = () => {
  try {
    const savedProfiles = JSON.parse(localStorage.getItem('p2p_saved_profiles') || '[]');
    return Array.isArray(savedProfiles) ? savedProfiles : [];
  } catch (error) {
    console.error(error);
    return [];
  }
};

export default function Auth({ setToken, initialLogin = false }) {
  const [savedProfiles, setSavedProfiles] = useState(loadSavedProfiles);
  const [isLogin, setIsLogin] = useState(initialLogin);
  const [username, setUsername] = useState(() => initialLogin ? savedProfiles[0]?.username || '' : '');
  const [email, setEmail] = useState(() => initialLogin ? savedProfiles[0]?.email || '' : '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Password visibility toggles
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [authDialog, setAuthDialog] = useState(null);
  const [authDialogInput, setAuthDialogInput] = useState('');

  const [sideAnimKey, setSideAnimKey] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [fade, setFade] = useState(true);

  useEffect(() => {
    setSideAnimKey(false);
    const t = setTimeout(() => setSideAnimKey(true), 50);
    return () => clearTimeout(t);
  }, [isLogin]);

  useEffect(() => {
    const timer = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setCurrentIndex(previous => (previous + 1) % testimonials.length);
        setFade(true);
      }, 400);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    localStorage.setItem('p2p_saved_profiles', JSON.stringify(savedProfiles));
  }, [savedProfiles]);

  useEffect(() => {
    if (document.querySelector('script[data-google-identity]')) return;
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.dataset.googleIdentity = 'true';
    document.head.appendChild(script);
  }, []);

  const rememberProfile = (profile) => {
    if (!profile?.email || !profile?.username || !profile?.id) return;
    const updatedProfiles = [
      { id: profile.id, email: profile.email, username: profile.username },
      ...savedProfiles.filter(saved => saved.email.toLowerCase() !== profile.email.toLowerCase())
    ];
    localStorage.setItem('p2p_saved_profiles', JSON.stringify(updatedProfiles));
    setSavedProfiles(updatedProfiles);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!isLogin && password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    try {
      if (isLogin) {
        const response = await axios.post('http://localhost:5001/api/auth/login', {
          email,
          password,
        });
        const user = response.data.user;
        if (!user?.id || !user?.username) throw new Error('Login response did not include account details.');
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('username', user.username);
        localStorage.setItem('user_email', user.email || email);
        rememberProfile(user);
        setToken(response.data.token, user);
      } else {
        const response = await axios.post('http://localhost:5001/api/auth/signup', {
          username,
          email,
          password,
        });
        rememberProfile(response.data.user);
        setEmail(email);
        setSuccess('Account created successfully! Switching to sign in...');
        setTimeout(() => {
          setIsLogin(true);
          setSuccess('');
        }, 1500);
      }
    } catch (err) {
      const message = err.response?.data?.message || err.response?.data?.error || err.message || 'Authentication failed.';
      setError(message);
      if (err.response?.status === 409) {
        setAuthDialog({
          type: 'notice',
          title: 'Account already exists',
          message: 'Please login instead. This email is already registered.',
          confirmLabel: 'Go to login',
          onConfirm: () => {
            setIsLogin(true);
            setPassword('');
            setConfirmPassword('');
            setAuthDialog(null);
          }
        });
      }
    }
  };

  const handleSocialMock = (provider) => {
    if (provider === 'Apple') {
      setAuthDialog({
        type: 'notice',
        title: 'Apple sign-in',
        message: 'Apple OAuth requires your Apple developer credentials before it can be enabled.',
        confirmLabel: 'Got it'
      });
      return;
    }

    if (!window.google?.accounts?.id) {
      setAuthDialog({
        type: 'notice',
        title: 'Google sign-in',
        message: 'Google sign-in is still loading. Please try again in a moment.',
        confirmLabel: 'Got it'
      });
      return;
    }

    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) {
      setAuthDialog({
        type: 'notice',
        title: 'Google sign-in',
        message: 'Google OAuth is not configured. Add VITE_GOOGLE_CLIENT_ID locally; this app never asks for your Gmail password.',
        confirmLabel: 'Got it'
      });
      return;
    }

    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: async credentialResponse => {
        try {
          const response = await axios.post('http://localhost:5001/api/auth/social-login', {
            provider: 'Google',
            credential: credentialResponse.credential
          });
          const user = response.data.user;
          if (!response.data.appPasswordSet) {
            setAuthDialogInput('');
            setAuthDialog({
              type: 'input',
              title: 'Create your P2P passkey',
              message: 'Google verified your account. Create a private P2P passkey of at least 6 characters for app login.',
              inputType: 'password',
              inputPlaceholder: 'Create passkey',
              confirmLabel: 'Create passkey',
              onConfirm: async passkey => {
                try {
                  const passkeyResponse = await axios.post('http://localhost:5001/api/auth/set-app-password', {
                    credential: credentialResponse.credential,
                    password: passkey
                  });
                  localStorage.setItem('token', passkeyResponse.data.token);
                  localStorage.setItem('username', user.username);
                  localStorage.setItem('user_email', user.email);
                  rememberProfile(user);
                  setAuthDialog(null);
                  setToken(response.data.token, user);
                } catch (error) {
                  setAuthDialog({
                    type: 'notice',
                    title: 'Passkey setup failed',
                    message: error.response?.data?.error || 'Unable to create your passkey.',
                    confirmLabel: 'Try again'
                  });
                }
              }
            });
            return;
          }
          setAuthDialogInput('');
          setAuthDialog({
            type: 'input',
            title: 'Enter P2P passkey',
            message: 'Google verified your account. Enter your private P2P passkey to continue.',
            inputType: 'password',
            inputPlaceholder: 'P2P passkey',
            confirmLabel: 'Continue',
            onConfirm: async passkey => {
              try {
                const verification = await axios.post('http://localhost:5001/api/auth/verify-app-password', {
                  credential: credentialResponse.credential,
                  email: user.email,
                  password: passkey
                });
                localStorage.setItem('token', verification.data.token);
                localStorage.setItem('username', user.username);
                localStorage.setItem('user_email', user.email);
                rememberProfile(user);
                setAuthDialog(null);
                setToken(response.data.token, user);
              } catch (error) {
                setAuthDialog({
                  type: 'notice',
                  title: 'Incorrect passkey',
                  message: error.response?.data?.error || 'Unable to verify your P2P passkey.',
                  confirmLabel: 'Login with Google',
                  onConfirm: () => handleForgotPassword()
                });
              }
            }
          });
        } catch (err) {
          setAuthDialog({
            type: 'notice',
            title: 'Google sign-in',
            message: err.response?.data?.error || 'Unable to verify your Google account.',
            confirmLabel: 'Try again'
          });
        }
      }
    });

    const container = document.createElement('div');
    container.id = 'google-signin-container';
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    document.body.appendChild(container);
    window.google.accounts.id.renderButton(container, {
      type: 'standard',
      theme: 'outline',
      size: 'large'
    });
    setTimeout(() => container.remove(), 300);
    window.google.accounts.id.prompt();
  };

  const handleForgotPassword = () => {
    if (window.google?.accounts?.id) {
      const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
      if (clientId) {
        setAuthDialog({
          type: 'notice',
          title: 'Reset P2P passkey',
          message: 'Verify with Google first, then create a new P2P passkey.',
          confirmLabel: 'Continue with Google',
          onConfirm: () => {
            window.google.accounts.id.initialize({
              client_id: clientId,
              callback: async credentialResponse => {
                setAuthDialog({
                  type: 'input',
                  title: 'Create new P2P passkey',
                  message: 'Google verified your identity. Enter a new private P2P passkey.',
                  inputType: 'password',
                  inputPlaceholder: 'New P2P passkey',
                  confirmLabel: 'Reset passkey',
                  onConfirm: async newPassword => {
                    try {
                      const response = await axios.post('http://localhost:5001/api/auth/reset-password', {
                        credential: credentialResponse.credential,
                        password: newPassword
                      });
                      setAuthDialog({
                        type: 'notice',
                        title: 'Passkey reset',
                        message: response.data.message,
                        confirmLabel: 'Done'
                      });
                      setPassword('');
                    } catch (error) {
                      setAuthDialog({
                        type: 'notice',
                        title: 'Reset failed',
                        message: error.response?.data?.error || 'Unable to reset your P2P passkey.',
                        confirmLabel: 'Try again'
                      });
                    }
                  }
                });
              }
            });
            window.google.accounts.id.prompt();
          }
        });
        return;
      }
    }

    setAuthDialog({
      type: 'notice',
      title: 'Google verification required',
      message: 'P2P passkey recovery requires verification through your Google account. Gmail passwords are never requested.',
      confirmLabel: 'Got it'
    });
  };

  return (
    <div className="auth-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'radial-gradient(circle at 18% 18%, rgba(67,56,202,0.22), transparent 28%), radial-gradient(circle at 82% 78%, rgba(236,72,153,0.16), transparent 30%), linear-gradient(135deg, #eef2ff 0%, #f8fafc 48%, #fae8ff 100%)', padding: '20px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      
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
        @keyframes slowDrift {
          0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
          50% { transform: translate3d(18px, -12px, 0) scale(1.04); }
        }
        .animated-orb-1 { animation: floatOrb1 6s ease-in-out infinite; }
        .animated-orb-2 { animation: floatOrb2 8s ease-in-out infinite; }
        .auth-card-hover { transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
        .auth-card-hover:hover { box-shadow: 0 30px 70px -15px rgba(99, 102, 241, 0.35); }
        .signup-anim { animation: fadeInSlideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .login-anim { animation: fadeInSlideLeft 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .auth-visual-orb { animation: slowDrift 9s ease-in-out infinite; }
      `}</style>

      <div className="auth-card auth-card-hover" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', width: '980px', height: '620px', backgroundColor: '#ffffff', borderRadius: '32px', boxShadow: '0 25px 60px -15px rgba(99, 102, 241, 0.25)', overflow: 'hidden', position: 'relative' }}>
        
        {/* Left Side: Form Container */}
        <div style={{ padding: '36px 50px', display: 'flex', flexDirection: 'column', justifyContent: 'center', overflowY: 'auto' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <div style={{ width: '32px', height: '32px', background: 'linear-gradient(135deg, #6366f1 0%, #ec4899 100%)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold', fontSize: '15px', boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)' }}>
              ⚡
            </div>
            <span style={{ fontSize: '16px', fontWeight: 'bold', background: 'linear-gradient(135deg, #4f46e5 0%, #db2777 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '-0.5px' }}>P2P Chat</span>
          </div>

          <div style={{ textAlign: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '26px', fontWeight: '800', color: '#1e1b4b', margin: '0 0 6px' }}>{isLogin ? 'Login' : 'Sign up'}</h2>
            <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>{isLogin ? 'Welcome back' : 'Create a verified P2P account'}</p>
          </div>

          <div style={{ display: 'flex', backgroundColor: '#f1f5f9', borderRadius: '10px', padding: '4px', marginBottom: '14px' }}>
            <button type="button" onClick={() => setIsLogin(true)} style={{ flex: 1, border: 0, borderRadius: '8px', padding: '8px', backgroundColor: isLogin ? '#fff' : 'transparent', color: isLogin ? '#4f46e5' : '#64748b', cursor: 'pointer', fontSize: '12px', fontWeight: '700' }}>Login</button>
            <button type="button" onClick={() => setIsLogin(false)} style={{ flex: 1, border: 0, borderRadius: '8px', padding: '8px', backgroundColor: !isLogin ? '#fff' : 'transparent', color: !isLogin ? '#4f46e5' : '#64748b', cursor: 'pointer', fontSize: '12px', fontWeight: '700' }}>Sign up</button>
          </div>

          {error && (
            <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fee2e2', color: '#dc2626', padding: '8px 10px', borderRadius: '8px', fontSize: '11px', marginBottom: '10px', textAlign: 'center' }}>{error}</div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {!isLogin && (
              <input type="text" value={username} onChange={event => setUsername(event.target.value)} placeholder="Full name" required style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '11px 12px', fontSize: '12px', outline: 'none', color: '#1e293b' }} />
            )}
            <input type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="Email address" required style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '11px 12px', fontSize: '12px', outline: 'none', color: '#1e293b' }} />
            <div style={{ position: 'relative' }}>
              <input type={showPassword ? 'text' : 'password'} value={password} onChange={event => setPassword(event.target.value)} placeholder={isLogin ? 'Password' : 'Create password'} required style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '11px 38px 11px 12px', fontSize: '12px', outline: 'none', color: '#1e293b' }} />
              <button type="button" onClick={() => setShowPassword(previous => !previous)} aria-label={showPassword ? 'Hide password' : 'Show password'} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', border: 0, background: 'transparent', color: '#64748b', cursor: 'pointer', fontSize: '14px', padding: '2px' }}>
                {showPassword ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
            {!isLogin && (
              <div style={{ position: 'relative' }}>
                <input type={showConfirmPassword ? 'text' : 'password'} value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} placeholder="Repeat password" required style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '11px 38px 11px 12px', fontSize: '12px', outline: 'none', color: '#1e293b' }} />
                <button type="button" onClick={() => setShowConfirmPassword(previous => !previous)} aria-label={showConfirmPassword ? 'Hide repeat password' : 'Show repeat password'} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', border: 0, background: 'transparent', color: '#64748b', cursor: 'pointer', fontSize: '14px', padding: '2px' }}>
                  {showConfirmPassword ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
            )}
            {isLogin && (
              <button type="button" onClick={handleForgotPassword} style={{ alignSelf: 'flex-end', border: 0, background: 'transparent', color: '#4f46e5', cursor: 'pointer', fontSize: '11px', padding: 0 }}>Forgot password</button>
            )}
            <button type="submit" style={{ width: '100%', border: 0, borderRadius: '10px', padding: '11px', background: 'linear-gradient(135deg, #4f46e5 0%, #db2777 100%)', color: '#fff', cursor: 'pointer', fontSize: '12px', fontWeight: '800' }}>{isLogin ? 'Login' : 'Sign up'}</button>
          </form>

        </div>

        {/* Right Side: Dynamic Animated Gradient Banner */}
        <div style={{ 
          background: 'linear-gradient(145deg, #111827 0%, #312e81 58%, #831843 100%)',
          display: 'flex', 
          flexDirection: 'column', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          padding: '30px',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div className="auth-visual-orb" style={{ position: 'absolute', top: '-44px', right: '-28px', width: '220px', height: '220px', background: 'radial-gradient(circle at 35% 35%, rgba(129,140,248,0.95), rgba(99,102,241,0.18) 58%, transparent 70%)', borderRadius: '50%', filter: 'blur(14px)', opacity: 0.9 }}></div>
          <div className="auth-visual-orb" style={{ position: 'absolute', bottom: '-54px', left: '-48px', width: '250px', height: '250px', background: 'radial-gradient(circle at 50% 50%, rgba(244,114,182,0.72), rgba(236,72,153,0.12) 60%, transparent 72%)', borderRadius: '50%', filter: 'blur(18px)', opacity: 0.82, animationDelay: '-3s' }}></div>
          <div style={{ position: 'absolute', inset: '18px', border: '1px solid rgba(255,255,255,0.09)', borderRadius: '24px', background: 'linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.01))', backdropFilter: 'blur(3px)' }}></div>

          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', zIndex: 2 }}>
            {sideAnimKey && (
              <div className={!isLogin ? "signup-anim" : "login-anim"} style={{ textAlign: 'center' }}>
                {!isLogin ? (
                  <>
                    <div style={{ width: '84px', height: '84px', margin: '0 auto 18px', borderRadius: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(145deg, rgba(255,255,255,0.18), rgba(255,255,255,0.05))', border: '1px solid rgba(255,255,255,0.18)', boxShadow: '0 18px 40px rgba(0,0,0,0.24)', backdropFilter: 'blur(10px)', fontSize: '38px' }}>✦</div>
                    <h3 style={{ fontSize: '38px', lineHeight: '1.05', fontWeight: '800', color: '#ffffff', letterSpacing: '-1.5px', margin: '0 0 12px 0' }}>
                      Start a<br /><span style={{ color: '#c4b5fd' }}>real connection</span>
                    </h3>
                    <p style={{ maxWidth: '280px', margin: '0 auto', fontSize: '12px', lineHeight: '1.6', color: '#ddd6fe' }}>
                      Private chats, shared moments, and secure peer-to-peer conversations.
                    </p>
                  </>
                ) : (
                  <>
                    <div style={{ width: '84px', height: '84px', margin: '0 auto 18px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(145deg, rgba(255,255,255,0.18), rgba(255,255,255,0.05))', border: '1px solid rgba(255,255,255,0.18)', boxShadow: '0 18px 40px rgba(0,0,0,0.24)', backdropFilter: 'blur(10px)', fontSize: '38px' }}>◉</div>
                    <h3 style={{ fontSize: '38px', lineHeight: '1.05', fontWeight: '800', color: '#ffffff', letterSpacing: '-1.5px', margin: '0 0 12px 0' }}>
                      Welcome<br /><span style={{ color: '#f9a8d4' }}>back</span>
                    </h3>
                    <p style={{ maxWidth: '280px', margin: '0 auto', fontSize: '12px', lineHeight: '1.6', color: '#fce7f3' }}>
                      Pick up where you left off and continue your conversations.
                    </p>
                  </>
                )}
              </div>
            )}
          </div>

          <div
            style={{
              width: '100%',
              backgroundColor: 'rgba(255, 255, 255, 0.15)',
              backdropFilter: 'blur(14px)',
              WebkitBackdropFilter: 'blur(14px)',
              padding: '14px 16px',
              borderRadius: '16px',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              color: '#ffffff',
              opacity: fade ? 1 : 0,
              transform: fade ? 'translateY(0) scale(1)' : 'translateY(8px) scale(0.98)',
              transition: 'opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1), transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
              boxSizing: 'border-box',
              zIndex: 2
            }}
          >
            <p style={{ fontSize: '11px', lineHeight: '1.4', color: '#f8fafc', margin: '0 0 8px 0' }}>
              "{testimonials[currentIndex].text}"
            </p>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '10px', color: '#fdf4ff', fontWeight: '600' }}>{testimonials[currentIndex].author}</span>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button type="button" onClick={() => setCurrentIndex(previous => (previous - 1 + testimonials.length) % testimonials.length)} style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '9px' }}>←</button>
                <button type="button" onClick={() => setCurrentIndex(previous => (previous + 1) % testimonials.length)} style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '9px' }}>→</button>
              </div>
            </div>
          </div>

        </div>

      </div>
      {authDialog && (
        <InAppDialog
          {...authDialog}
          value={authDialogInput}
          onChange={setAuthDialogInput}
          onCancel={() => setAuthDialog(null)}
          onConfirm={authDialog.onConfirm || (() => setAuthDialog(null))}
          variant="light"
        />
      )}
    </div>
  );
}