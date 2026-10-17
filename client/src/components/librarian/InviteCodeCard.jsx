import React, { useState, useEffect } from 'react';
import { librariesApi } from '../../api/libraries.api';
import { useToast } from '../../context/ToastContext';
import { Button } from '../common/Button';
import { Key, Copy, RefreshCw, Check } from 'lucide-react';

export function InviteCodeCard({ libraryId, initialInviteCode, inviteCode: propInviteCode, onCodeRegenerated }) {
  const { showToast } = useToast();
  const effectiveCode = initialInviteCode || propInviteCode || '';
  const [inviteCode, setInviteCode] = useState(effectiveCode);
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    const code = initialInviteCode || propInviteCode;
    if (code) {
      setInviteCode(code);
    }
  }, [initialInviteCode, propInviteCode]);

  const handleCopy = () => {
    if (!inviteCode) return;
    navigator.clipboard.writeText(inviteCode);
    setCopied(true);
    showToast('Invitation code copied to clipboard!', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRegenerate = async () => {
    if (!window.confirm('Regenerating will invalidate the previous invitation code. Proceed?')) {
      return;
    }

    setRegenerating(true);
    try {
      const res = await librariesApi.regenerateInviteCode(libraryId);
      const newCode = res.library?.invite_code || res.invite_code;
      setInviteCode(newCode);
      showToast('New invitation code generated!', 'success');
      onCodeRegenerated?.(newCode);
    } catch (err) {
      showToast(err.message || 'Failed to regenerate invite code.', 'error');
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <div className="bg-white/90 backdrop-blur-xs p-6 rounded-2xl border border-beige-300 shadow-warm space-y-4 max-w-md">
      <div className="flex items-center justify-between">
        <h4 className="font-serif text-base font-bold text-forest flex items-center gap-2">
          <Key className="w-4 h-4 text-gold-600" />
          Library Private Invite Code
        </h4>
      </div>

      <p className="text-xs text-charcoal-muted leading-relaxed">
        Share this secret code with neighborhood residents so they can apply to join this library.
        Only librarians can see this code.
      </p>

      <div className="flex items-center gap-2">
        <div className="flex-1 font-mono text-base font-bold text-forest bg-ivory/80 border border-beige-300 px-4 py-2.5 rounded-xl tracking-wider select-all shadow-inner">
          {inviteCode || '••••••••'}
        </div>

        <button
          onClick={handleCopy}
          className="p-2.5 rounded-xl border border-beige-300 bg-white hover:bg-ivory text-charcoal-muted hover:text-forest transition-colors"
          title="Copy invite code"
          aria-label="Copy invite code"
        >
          {copied ? <Check className="w-5 h-5 text-forest" /> : <Copy className="w-5 h-5" />}
        </button>

        <Button
          variant="outline"
          size="sm"
          onClick={handleRegenerate}
          loading={regenerating}
          icon={RefreshCw}
          title="Regenerate invite code"
        >
          New
        </Button>
      </div>
    </div>
  );
}
