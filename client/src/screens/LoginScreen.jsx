import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '../context/NavigationContext';
import { useToast } from '../context/ToastContext';
import { Button } from '../components/common/Button';
import { Logo } from '../components/common/Logo';
import { LogIn, Lock, Mail, ArrowRight } from 'lucide-react';

export function LoginScreen() {
  const { login } = useAuth();
  const { navigate } = useNavigation();
  const { showToast } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please provide your email and password.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await login(email, password);
      showToast('Welcome back to BooksBuddy!', 'success');
      navigate('/');
    } catch (err) {
      setError(err.message || 'Invalid credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-7 bg-[#FDFBF7] p-8 sm:p-10 rounded-3xl border border-[#DDCFC0] shadow-card">
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-1">
            <Logo variant="compact" size="lg" />
          </div>
          <h2 className="font-serif text-2xl font-bold text-charcoal tracking-tight">
            Sign In to BooksBuddy
          </h2>
          <p className="text-xs text-muted max-w-xs mx-auto">
            Access your neighborhood libraries, personal shelf, and active borrowings.
          </p>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-[#FAF0ED] border border-[#E8BDB1] text-[#A8452D] text-xs leading-relaxed animate-in fade-in-0">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-charcoal mb-1">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3 top-3 text-muted" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl border border-[#DDCFC0] focus:outline-none focus:ring-2 focus:ring-forest bg-white text-charcoal"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-charcoal">Password</label>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-3 text-muted" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl border border-[#DDCFC0] focus:outline-none focus:ring-2 focus:ring-forest bg-white text-charcoal"
              />
            </div>
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={loading}
            className="w-full mt-2 font-bold"
            icon={LogIn}
          >
            Sign In
          </Button>
        </form>

        <div className="text-center pt-4 border-t border-[#E7D7C1]">
          <p className="text-xs text-muted">
            Don't have an account yet?{' '}
            <button
              onClick={() => navigate('/register')}
              className="font-bold text-forest hover:underline transition-colors inline-flex items-center gap-1"
            >
              Join your community <ArrowRight className="w-3 h-3" />
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
