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
    <div className="max-w-2xl mx-auto py-6 px-4">
      <button
        onClick={() => navigate('/')}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Libraries
      </button>

      <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm space-y-6">
        <div>
          <div className="inline-flex w-12 h-12 rounded-2xl bg-brand-50 text-brand-700 items-center justify-center mb-3">
            <Library className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            Found a Community Virtual Library
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Establish a shared catalogue for your apartment complex, housing society, or neighborhood.
          </p>
        </div>

        <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-brand-50/70 border border-brand-200 text-brand-900 text-xs">
          <ShieldCheck className="w-5 h-5 text-brand-600 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            As the founder, you will be appointed as the <strong>Primary Librarian</strong>, granting
            you full authority to configure loan periods, approve members, appoint co-librarians, and
            moderate the collection.
          </p>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs leading-relaxed animate-in fade-in-0">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              1. Basic Information
            </h3>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Library Name *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Palm Meadows Community Library"
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-slate-50/50"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Society / Locality *
                </label>
                <div className="relative">
                  <Building className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={formData.society_locality}
                    onChange={(e) => setFormData({ ...formData, society_locality: e.target.value })}
                    placeholder="e.g. Palm Meadows"
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-slate-50/50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  City *
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder="e.g. Bengaluru"
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-slate-50/50"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Library Description
              </label>
              <textarea
                rows={2}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Share a welcoming note or focus of this library..."
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-slate-50/50"
              />
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-slate-100">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Sliders className="w-4 h-4 text-brand-600" />
              2. Initial Borrowing & Queue Rules
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Max Borrow Duration (Days) *
                </label>
                <input
                  type="number"
                  min="1"
                  max="90"
                  required
                  value={formData.max_borrow_days}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      max_borrow_days: parseInt(e.target.value, 10) || 1,
                    })
                  }
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-slate-50/50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Handover Window (Hours) *
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
                      handover_window_hours: parseInt(e.target.value, 10) || 1,
                    })
                  }
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-slate-50/50"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Max Books Per Member *
                </label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  required
                  value={formData.max_books_per_member}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      max_books_per_member: parseInt(e.target.value, 10) || 1,
                    })
                  }
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-slate-50/50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Max Allowed Renewals *
                </label>
                <input
                  type="number"
                  min="0"
                  max="5"
                  required
                  value={formData.max_renewals}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      max_renewals: parseInt(e.target.value, 10) || 0,
                    })
                  }
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-slate-50/50"
                />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
            <Button
              variant="outline"
              size="md"
              onClick={() => navigate('/')}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              loading={submitting}
            >
              Found Library
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
