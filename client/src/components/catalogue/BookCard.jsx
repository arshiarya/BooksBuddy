import React from 'react';
import { Book as BookIcon, MapPin } from 'lucide-react';
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
      className="group bg-[#FDFBF7] rounded-3xl border border-[#DDCFC0] hover:border-forest/50 p-3.5 flex flex-col justify-between shadow-xs hover:shadow-card-hover hover:-translate-y-1 transition-all duration-200 cursor-pointer overflow-hidden relative select-none"
    >
      <div className="space-y-3">
        {/* Book Cover Prioritization */}
        <div className="relative aspect-[3/4] w-full rounded-2xl bg-[#F4ECE1] border border-[#E7D7C1] overflow-hidden flex items-center justify-center shadow-xs">
          {book.cover_image_url ? (
            <img
              src={book.cover_image_url}
              alt={book.title}
              loading="lazy"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-muted/60 p-4 text-center">
              <BookIcon className="w-10 h-10 mb-2 text-forest/40 group-hover:scale-110 transition-transform duration-300" />
              <span className="font-serif text-[11px] font-bold text-charcoal line-clamp-2 leading-tight">
                {book.title}
              </span>
            </div>
          )}

          {/* Availability Badge */}
          <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
            <Badge variant={statusVariant} size="sm">
              {book.status}
            </Badge>
          </div>
        </div>

        {/* Book Title & Author */}
        <div>
          <h4 className="font-serif text-sm font-bold text-charcoal group-hover:text-forest transition-colors line-clamp-1">
            {book.title}
          </h4>
          <p className="text-xs text-muted font-medium line-clamp-1 mt-0.5">
            by {book.author}
          </p>
        </div>

        {/* Condition & Genre Chips */}
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          {book.condition && (
            <Badge variant={conditionVariant} size="sm">
              {book.condition}
            </Badge>
          )}
          {book.genre && (
            <span className="text-[10px] font-semibold text-muted bg-[#F2EDE4] px-2 py-0.5 rounded-md border border-[#E7D7C1]">
              {book.genre}
            </span>
          )}
        </div>
      </div>

      {/* Current Holder Location Hint (Privacy-Protected) */}
      <div className="mt-3.5 pt-2.5 border-t border-[#E7D7C1] flex items-center justify-between text-[11px] text-muted">
        <div className="flex items-center gap-1.5 truncate">
          <MapPin className="w-3.5 h-3.5 text-muted/70 shrink-0" />
          <span className="truncate">
            {book.current_custodian_locality || book.custodian_locality || book.library_locality || book.society_locality || 'Community Hub'}
          </span>
        </div>
      </div>
    </div>
  );
}
