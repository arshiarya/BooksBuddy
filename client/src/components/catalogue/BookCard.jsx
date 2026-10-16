import React from 'react';
import { Book as BookIcon, MapPin, User, Shield } from 'lucide-react';
import { Badge } from '../common/Badge';

export function BookCard({ book, onClick }) {
  const statusVariant = {
    AVAILABLE: 'success',
    BORROWED: 'warning',
    RESERVED: 'info',
    REMOVED: 'danger',
  }[book.status] || 'neutral';

  const conditionVariant = {
    NEW: 'success',
    GOOD: 'primary',
    FAIR: 'warning',
    DAMAGED: 'danger',
  }[book.condition] || 'neutral';

  return (
    <div
      onClick={onClick}
      className="group bg-white rounded-2xl border border-slate-200/90 hover:border-brand-400 p-4 flex flex-col justify-between shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer overflow-hidden relative"
    >
      <div className="space-y-3">
        {/* Cover Preview & Badges */}
        <div className="relative aspect-[3/4] w-full rounded-xl bg-slate-100 border border-slate-200/60 overflow-hidden flex items-center justify-center">
          {book.cover_image_url ? (
            <img
              src={book.cover_image_url}
              alt={book.title}
              loading="lazy"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-slate-300 p-4 text-center">
              <BookIcon className="w-12 h-12 mb-2 text-slate-400 group-hover:scale-110 transition-transform" />
              <span className="text-[11px] font-semibold text-slate-500 line-clamp-2">
                {book.title}
              </span>
            </div>
          )}

          <div className="absolute top-2.5 right-2.5 flex flex-col gap-1 items-end">
            <Badge variant={statusVariant} size="sm">
              {book.status}
            </Badge>
          </div>
        </div>

        {/* Book Details */}
        <div>
          <h4 className="text-sm font-bold text-slate-900 group-hover:text-brand-600 transition-colors line-clamp-1">
            {book.title}
          </h4>
          <p className="text-xs text-slate-500 font-medium line-clamp-1 mt-0.5">
            by {book.author}
          </p>
        </div>

        {/* Condition & Genre */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          {book.condition && (
            <Badge variant={conditionVariant} size="sm">
              {book.condition}
            </Badge>
          )}
          {book.genre && (
            <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
              {book.genre}
            </span>
          )}
        </div>
      </div>

      {/* Custodian Location Hint (Privacy-Protected: locality/society ONLY, no flat numbers) */}
      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
        <div className="flex items-center gap-1.5 truncate">
          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="truncate">
            {book.custodian_locality || book.society_locality || 'Community Hub'}
          </span>
        </div>
      </div>
    </div>
  );
}
