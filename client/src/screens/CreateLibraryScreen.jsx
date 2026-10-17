import React, { useState } from 'react';
import { librariesApi } from '../api/libraries.api';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '../context/NavigationContext';
import { useToast } from '../context/ToastContext';
import { Button } from '../components/common/Button';
import { Library, Building, MapPin, Sliders, ShieldCheck, ArrowLeft } from 'lucide-react';

export function CreateLibraryScreen() {
  const { user, refreshUser } = useAuth();
  const { navigate } = useNavigation();
  const { showToast } = useToast();

  const [formData, setFormData] = useState({
    name: '',
    society_locality: user?.societyLocality || '',
    city: user?.city || '',
    description: '',
    max_borrow_days: 14,
    handover_window_hours: 48,
    max_books_per_member: 3,
    max_renewals: 1,
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.society_locality.trim() || !formData.city.trim()) {
      setError('Library Name, Society/Locality, and City are required.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await librariesApi.create(formData);
      showToast('Library created successfully! You are the Primary Librarian.', 'success');
      await refreshUser();
      navigate(`/library/${res.library.id}`);
    } catch (err) {
      setError(err.message || 'Failed to create library.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-4 px-4">
      <button
        onClick={() => navigate('/')}
        className="inline-flex items-center gap-1.5 text-xs font-bold text-muted hover:text-forest transition-colors mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Libraries
      </button>

      <div className="bg-[#FDFBF7] rounded-3xl border border-[#DDCFC0] p-6 sm:p-8 shadow-card space-y-6">
        <div>
          <div className="inline-flex w-12 h-12 rounded-2xl bg-sage-tint text-forest items-center justify-center mb-3 border border-sage-border/60">
            <Library className="w-6 h-6" />
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-charcoal tracking-tight">
            Found a Community Virtual Library
          </h1>
          <p className="text-xs text-muted mt-1 leading-relaxed">
            Establish a shared catalogue for your apartment complex, housing society, or neighborhood.
          </p>
        </div>

        <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-sage-tint border border-sage-border text-forest text-xs">
          <ShieldCheck className="w-5 h-5 text-forest shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            As the founder, you will be appointed as the <strong>Primary Librarian</strong>, granting
            you full authority to configure borrow periods, approve members, appoint co-librarians, and
            moderate the collection.
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
              Library Name *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Palm Meadows Community Library"
              className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-[#DDCFC0] focus:outline-none focus:ring-2 focus:ring-forest bg-white text-charcoal"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-charcoal mb-1">
                Society or Locality *
              </label>
              <div className="relative">
                <Building className="w-4 h-4 absolute left-3 top-3 text-muted" />
                <input
                  type="text"
                  required
                  value={formData.society_locality}
                  onChange={(e) =>
                    setFormData({ ...formData, society_locality: e.target.value })
                  }
                  placeholder="e.g. Palm Meadows, Bellandur"
                  className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl border border-[#DDCFC0] focus:outline-none focus:ring-2 focus:ring-forest bg-white text-charcoal"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-charcoal mb-1">
                City *
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 absolute left-3 top-3 text-muted" />
                <input
                  type="text"
                  required
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  placeholder="e.g. Bengaluru"
                  className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl border border-[#DDCFC0] focus:outline-none focus:ring-2 focus:ring-forest bg-white text-charcoal"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-charcoal mb-1">
              Welcome Description <span className="text-muted font-normal">(Optional)</span>
            </label>
            <textarea
              rows={2}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Share a welcoming note for your neighbors..."
              className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-[#DDCFC0] focus:outline-none focus:ring-2 focus:ring-forest bg-white text-charcoal"
            />
          </div>

          {/* Configurable Library Rules */}
          <div className="pt-2 border-t border-[#E7D7C1] space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-charcoal uppercase tracking-wider">
              <Sliders className="w-4 h-4 text-forest" />
              Initial Borrowing Rules
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-charcoal mb-1">
                  Borrow (Days)
                </label>
                <input
                  type="number"
                  min="1"
                  max="90"
                  required
                  value={formData.max_borrow_days}
                  onChange={(e) =>
                    setFormData({ ...formData, max_borrow_days: parseInt(e.target.value) || 14 })
                  }
                  className="w-full px-3 py-2 text-xs rounded-xl border border-[#DDCFC0] focus:outline-none focus:ring-2 focus:ring-forest bg-white text-charcoal font-semibold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-charcoal mb-1">
                  Handover (Hours)
                </label>
                <input
                  type="number"
                  min="1"
                  max="168"
                  required
                  value={formData.handover_window_hours}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      handover_window_hours: parseInt(e.target.value) || 48,
                    })
                  }
                  className="w-full px-3 py-2 text-xs rounded-xl border border-[#DDCFC0] focus:outline-none focus:ring-2 focus:ring-forest bg-white text-charcoal font-semibold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-charcoal mb-1">
                  Book Limit
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  required
                  value={formData.max_books_per_member}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      max_books_per_member: parseInt(e.target.value) || 3,
                    })
                  }
                  className="w-full px-3 py-2 text-xs rounded-xl border border-[#DDCFC0] focus:outline-none focus:ring-2 focus:ring-forest bg-white text-charcoal font-semibold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-charcoal mb-1">
                  Max Renewals
                </label>
                <input
                  type="number"
                  min="0"
                  max="5"
                  required
                  value={formData.max_renewals}
                  onChange={(e) =>
                    setFormData({ ...formData, max_renewals: parseInt(e.target.value) || 0 })
                  }
                  className="w-full px-3 py-2 text-xs rounded-xl border border-[#DDCFC0] focus:outline-none focus:ring-2 focus:ring-forest bg-white text-charcoal font-semibold"
                />
              </div>
            </div>
          </div>

          <div className="pt-2">
            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={submitting}
              className="w-full font-bold"
            >
              Create Community Library
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
