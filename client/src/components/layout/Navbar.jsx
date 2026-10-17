import React, { useState } from 'react';
import { Compass, BookMarked, Plus, LogIn, LogOut, Menu, X, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNavigation } from '../../context/NavigationContext';
import { Button } from '../common/Button';
import { Logo } from '../common/Logo';

export function Navbar() {
  const { user, logout } = useAuth();
  const { currentPath, navigate } = useNavigation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const isPlatformAdmin = Boolean(user && (user.isPlatformAdmin || user.role === 'PLATFORM_ADMIN'));

  const navLinks = [
    { name: 'Explore Libraries', path: '/', icon: Compass },
    ...(user
      ? [
          { name: 'My Shelf & Requests', path: '/my-books', icon: BookMarked },
          ...(isPlatformAdmin
            ? [{ name: 'Platform Admin', path: '/admin', icon: ShieldCheck }]
            : []),
        ]
      : []),
  ];

  return (
    <header className="sticky top-0 z-40 bg-[#FDFBF7]/95 backdrop-blur-md border-b border-[#DDCFC0] shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-18">
          {/* BooksBuddy Brand Identity Logo */}
          <Logo
            variant="full"
            size="md"
            onClick={() => navigate('/')}
            className="py-1"
          />

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1.5" aria-label="Main Navigation">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = currentPath === link.path;
              return (
                <button
                  key={link.path}
                  onClick={() => navigate(link.path)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all duration-150 ${
                    isActive
                      ? 'bg-[#1B4332] text-[#FAF7F2] shadow-xs'
                      : 'text-charcoal hover:text-forest hover:bg-[#F2EDE4]'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {link.name}
                </button>
              );
            })}
          </nav>

          {/* Desktop User Controls / Auth */}
          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-3">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => navigate('/library/new')}
                  icon={Plus}
                  className="font-semibold"
                >
                  New Library
                </Button>

                <div className="h-6 w-px bg-[#DDCFC0]" />

                {/* User Pill */}
                <div className="flex items-center gap-2.5 pl-1">
                  <div className="w-8 h-8 rounded-full bg-forest text-ivory flex items-center justify-center font-serif font-bold text-xs shadow-xs border border-forest/30">
                    {user.fullName ? user.fullName.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-bold text-charcoal leading-tight">
                      {user.fullName}
                    </p>
                    <p className="text-[10px] text-muted font-medium truncate max-w-[140px]">
                      {user.societyLocality || user.city || user.email}
                    </p>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLogout}
                  icon={LogOut}
                  title="Sign out"
                  className="text-muted hover:text-rose-700 hover:bg-rose-50"
                >
                  Logout
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/login')}
                  icon={LogIn}
                  className="font-semibold"
                >
                  Sign In
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => navigate('/register')}
                  className="font-semibold"
                >
                  Join BooksBuddy
                </Button>
              </div>
            )}
          </div>

          {/* Mobile Hamburger Menu Toggle */}
          <div className="flex md:hidden items-center gap-2">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-xl text-charcoal hover:bg-[#F2EDE4] transition-colors"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-[#DDCFC0] bg-[#FDFBF7] px-4 pt-3 pb-6 space-y-4 animate-in slide-in-from-top-2">
          <nav className="flex flex-col gap-1.5" aria-label="Mobile Navigation">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = currentPath === link.path;
              return (
                <button
                  key={link.path}
                  onClick={() => {
                    navigate(link.path);
                    setMobileMenuOpen(false);
                  }}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-bold ${
                    isActive
                      ? 'bg-[#1B4332] text-[#FAF7F2]'
                      : 'text-charcoal hover:bg-[#F2EDE4]'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {link.name}
                </button>
              );
            })}
            {user && (
              <button
                onClick={() => {
                  navigate('/library/new');
                  setMobileMenuOpen(false);
                }}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-bold text-charcoal hover:bg-[#F2EDE4]"
              >
                <Plus className="w-4 h-4 text-forest" />
                Create a Library
              </button>
            )}
          </nav>

          <div className="pt-3 border-t border-[#E7D7C1]">
            {user ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3 px-3">
                  <div className="w-9 h-9 rounded-full bg-forest text-ivory flex items-center justify-center font-serif font-bold text-sm">
                    {user.fullName ? user.fullName.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-charcoal">{user.fullName}</p>
                    <p className="text-xs text-muted">{user.email}</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLogout}
                  icon={LogOut}
                  title="Sign out"
                  className="w-full justify-center text-rose-700 border-rose-200 hover:bg-rose-50"
                >
                  Sign Out
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => {
                    navigate('/login');
                    setMobileMenuOpen(false);
                  }}
                  icon={LogIn}
                  className="w-full justify-center"
                >
                  Sign In
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => {
                    navigate('/register');
                    setMobileMenuOpen(false);
                  }}
                  className="w-full justify-center"
                >
                  Join BooksBuddy
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
