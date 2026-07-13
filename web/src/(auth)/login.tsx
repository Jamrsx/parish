import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

// Define the error type
interface LoginError {
  message?: string;
  response?: {
    data?: {
      message?: string;
    };
  };
}

// Validation functions - ✅ Updated to accept both email and username
const validateLogin = (login: string): string => {
  if (!login) return 'Email or Username is required';
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  // Accept either valid email or at least 3 characters for username
  if (!emailRegex.test(login) && login.length < 3) {
    return 'Please enter a valid email or username (min 3 characters)';
  }
  return '';
};

const validatePassword = (password: string): string => {
  if (!password) return 'Password is required';
  if (password.length < 6) return 'Password must be at least 6 characters';
  return '';
};

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading, login: loginUser } = useAuth();
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // ✅ Redirect if already authenticated
  useEffect(() => {
    if (!isLoading && isAuthenticated && user) {
      const redirectPath = user.role === 'secretary' ? '/admin/secretary/dashboard' :
                          user.role === 'cashier' ? '/admin/cashier/dashboard' :
                          user.role === 'priest' ? '/priest/PriestHomePage' :
                          '/parishioner/ParishionerHomePage';
      navigate(redirectPath, { replace: true });
    }
  }, [isLoading, isAuthenticated, user, navigate]);

  const handleLoginChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setLogin(value);
    if (value) {
      const errorMsg = validateLogin(value);
      setLoginError(errorMsg);
    } else {
      setLoginError('');
    }
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPassword(value);
    if (value) {
      const errorMsg = validatePassword(value);
      setPasswordError(errorMsg);
    } else {
      setPasswordError('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Validate all fields before submission
    const loginValidation = validateLogin(login);
    const passwordValidation = validatePassword(password);

    if (loginValidation) {
      setLoginError(loginValidation);
      setLoading(false);
      document.getElementById('login')?.focus();
      return;
    }

    if (passwordValidation) {
      setPasswordError(passwordValidation);
      setLoading(false);
      document.getElementById('password')?.focus();
      return;
    }

    try {
      const result = await loginUser(login, password);
      
      if (result.success) {
        navigate(result.redirectPath);
      }
    } catch (err: unknown) {
      const loginError = err as LoginError;
      setError(loginError.message || 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Show loading while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-blue-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // If already authenticated, don't render the login form
  if (isAuthenticated && user) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-blue-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        {/* Card Container */}
        <div className="bg-white rounded-2xl shadow-xl p-8 space-y-8">
          {/* Logo/Icon */}
          <div className="flex justify-center">
            <div className="h-16 w-16 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg transform -rotate-3 hover:rotate-0 transition-transform duration-300">
              <svg
                className="h-8 w-8 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                />
              </svg>
            </div>
          </div>

          {/* Header */}
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900">
              Parish Management
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Welcome back! Please sign in to continue
            </p>
          </div>

          {/* Form */}
          <form className="space-y-6" onSubmit={handleSubmit} noValidate>
            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg animate-shake" role="alert">
                <div className="flex items-center">
                  <svg className="h-5 w-5 text-red-500 mr-3 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm text-red-700">{error}</span>
                </div>
              </div>
            )}

            {/* Input Fields */}
            <div className="space-y-4">
              <div>
                <label htmlFor="login" className="block text-sm font-medium text-gray-700 mb-1">
                  Email or Username
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <input
                    id="login"
                    name="login"
                    type="text"
                    value={login}
                    onChange={handleLoginChange}
                    className={`appearance-none block w-full pl-10 pr-3 py-3 border rounded-xl placeholder-gray-400 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-150 ease-in-out sm:text-sm ${
                      loginError ? 'border-red-500 focus:ring-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Enter your email or username"
                    aria-invalid={!!loginError}
                    aria-describedby={loginError ? 'login-error' : undefined}
                  />
                  {loginError && (
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </div>
                {loginError && (
                  <p id="login-error" className="mt-1 text-sm text-red-600 animate-shake">
                    {loginError}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    value={password}
                    onChange={handlePasswordChange}
                    className={`appearance-none block w-full pl-10 pr-3 py-3 border rounded-xl placeholder-gray-400 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-150 ease-in-out sm:text-sm ${
                      passwordError ? 'border-red-500 focus:ring-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Enter your password"
                    aria-invalid={!!passwordError}
                    aria-describedby={passwordError ? 'password-error' : undefined}
                  />
                  {passwordError && (
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </div>
                {passwordError && (
                  <p id="password-error" className="mt-1 text-sm text-red-600 animate-shake">
                    {passwordError}
                  </p>
                )}
              </div>
            </div>

            {/* Submit Button */}
            <div>
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-xl text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transform transition-all duration-150 hover:scale-[1.02] active:scale-95"
              >
                {loading ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Signing in...
                  </span>
                ) : (
                  <>
                    <span>Sign in</span>
                    <svg className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform duration-150" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Footer */}
          <div className="text-center">
            <p className="text-xs text-gray-500">
              © {new Date().getFullYear()} Parish Management System. All rights reserved.
            </p>
          </div>
        </div>
      </div>

      {/* Custom Animation Styles */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
        .animate-shake {
          animation: shake 0.3s ease-in-out;
        }
      `}</style>
    </div>
  );
};

export default Login;