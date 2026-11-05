import React, { useState } from 'react';
import Login from './pages/Login';
import Signup from './pages/Signup';

function App() {
  const [isLogin, setIsLogin] = useState(true);

  return (
    <div>
      {isLogin ? (
        <Login switchToSignup={() => setIsLogin(false)} />
      ) : (
        <Signup switchToLogin={() => setIsLogin(true)} />
      )}
    </div>
  );
}

export default App;