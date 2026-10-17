import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '../context/NavigationContext';
import { useToast } from '../context/ToastContext';
import { Button } from '../components/common/Button';
import { Logo } from '../components/common/Logo';
import { UserPlus, Lock, Mail, User, Phone, MapPin, Building, ShieldCheck, ArrowRight } from 'lucide-react';

export function RegisterScreen() {
  const { register } = useAuth();
  const { navigate } = useNavigation();
  const { showToast } = useToast();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
    phone: '',
    societyLocality: '',
    flatHouseNumber: '',
    city: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await register(formData);
      showToast('Registration successful! Welcome to BooksBuddy.', 'success');
      navigate('/');
    } catch (err) {
      setError(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-lg w-full space-y-6 bg-[#FDFBF7] p-8 sm:p-10 rounded-3xl border border-[#DDCFC0] shadow-card">
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-1">
            <Logo variant="compact" size="lg" />
          </div>
          <h2 className="font-serif text-2xl font-bold text-charcoal tracking-tight">
            Create an Account
          </h2>
          <p className="text-xs text-muted max-w-sm mx-auto">
            Join your community library to donate, borrow, and share books with neighbors.
          </p>
        </div>

        {/* Privacy Assurance Banner */}
        <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-sage-tint border border-sage-border text-forest text-xs">
          <ShieldCheck className="w-4 h-4 text-forest shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong>Address Privacy Guaranteed:</strong> Your flat/house number and phone number are
            strictly protected. They are never visible in search or catalogue listings and are only
            revealed to an approved borrower during an active physical handover.
          </p>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-[#FAF0ED] border border-[#E8BDB1] text-[#A8452D] text-xs leading-relaxed animate-in fade-in-0">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-charcoal mb-1">
                Full Name *
              </label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3 top-3 text-muted" />
                <input
                  type="text"
                  required
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  placeholder="e.g. Maya Sharma"
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-[#DDCFC0] focus:outline-none focus:ring-2 focus:ring-forest bg-white text-charcoal"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-charcoal mb-1">
                Email Address *
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-3 text-muted" />
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="name@example.com"
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-[#DDCFC0] focus:outline-none focus:ring-2 focus:ring-forest bg-white text-charcoal"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-charcoal mb-1">
                Password *
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-3 text-muted" />
                <input
                  type="password"
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-[#DDCFC0] focus:outline-none focus:ring-2 focus:ring-forest bg-white text-charcoal"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-charcoal mb-1">
                Phone Number *
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 absolute left-3 top-3 text-muted" />
                <input
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+91 9876543210"
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-[#DDCFC0] focus:outline-none focus:ring-2 focus:ring-forest bg-white text-charcoal"
                />
              </div>
            </div>
          </div>

          {/* Residence & Locality */}
          <div className="pt-2 border-t border-[#E7D7C1] space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted">
              Community Residency
            </p>

            <div>
              <label className="block text-xs font-bold text-charcoal mb-1">
                Society or Locality *
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 absolute left-3 top-3 text-muted" />
                <input
                  type="text"
                  required
                  value={formData.societyLocality}
                  onChange={(e) => setFormData({ ...formData, societyLocality: e.target.value })}
                  placeholder="e.g. Palm Meadows"
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-[#DDCFC0] focus:outline-none focus:ring-2 focus:ring-forest bg-white text-charcoal"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-charcoal mb-1">
                  Flat or House Number *
                </label>
                <div className="relative">
                  <Building className="w-4 h-4 absolute left-3 top-3 text-muted" />
                  <input
                    type="text"
                    required
                    value={formData.flatHouseNumber}
                    onChange={(e) => setFormData({ ...formData, flatHouseNumber: e.target.value })}
                    placeholder="e.g. Tower B-402"
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-[#DDCFC0] focus:outline-none focus:ring-2 focus:ring-forest bg-white text-charcoal"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-charcoal mb-1">
                  City *
                </label>
                <input
                  type="text"
                  required
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  placeholder="e.g. Bengaluru"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-[#DDCFC0] focus:outline-none focus:ring-2 focus:ring-forest bg-white text-charcoal"
                />
              </div>
            </div>
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={loading}
            className="w-full mt-3 font-bold"
            icon={UserPlus}
          >
            Create BooksBuddy Account
          </Button>
        </form>

        <div className="text-center pt-3 border-t border-[#E7D7C1]">
          <p className="text-xs text-muted">
            Already have an account?{' '}
            <button
              onClick={() => navigate('/login')}
              className="font-bold text-forest hover:underline transition-colors inline-flex items-center gap-1"
            >
              Sign In <ArrowRight className="w-3 h-3" />
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
