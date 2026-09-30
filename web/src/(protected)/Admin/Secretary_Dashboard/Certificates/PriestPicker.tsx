import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ChevronDown, PenLine, Search, X } from 'lucide-react';
import type { User } from '../../../../../library/AuthStorage';
import { priestInitials } from './certificateFormat';

interface PriestPickerProps {
  id: string;
  priests: User[];
  value: string;
  onChange: (name: string, priest: User | null) => void;
  displayName: (priest: User) => string;
  placeholder?: string;
  error?: string;
  defaultPriestId?: string | null;
  selectedPriestId?: string | null;
  autoOpen?: boolean;
  onDismiss?: () => void;
}

const Highlight: React.FC<{ text: string; query: string }> = ({ text, query }) => {
  const q = query.trim();
  const index = q ? text.toLowerCase().indexOf(q.toLowerCase()) : -1;
  if (index < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, index)}
      <mark className="rounded bg-yellow-100 px-0.5 text-inherit">{text.slice(index, index + q.length)}</mark>
      {text.slice(index + q.length)}
    </>
  );
};

type Option = { kind: 'priest'; priest: User; label: string } | { kind: 'custom'; label: string };

const PriestPicker: React.FC<PriestPickerProps> = ({
  id,
  priests,
  value,
  onChange,
  displayName,
  placeholder = 'Search or type a priest’s name',
  error,
  defaultPriestId,
  selectedPriestId,
  autoOpen = false,
  onDismiss,
}) => {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(autoOpen);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (autoOpen) inputRef.current?.focus();
  }, [autoOpen]);

  const options: Option[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list: Option[] = priests
      .map((p) => ({ kind: 'priest' as const, priest: p, label: displayName(p) }))
      .filter((o) => !q || o.label.toLowerCase().includes(q) || o.priest.full_name.toLowerCase().includes(q));
    const exact = list.some((o) => o.label.toLowerCase() === q);
    if (q && !exact) list.push({ kind: 'custom', label: query.trim() });
    return list;
  }, [priests, query, displayName]);

  const close = () => {
    setOpen(false);
    setQuery('');
    onDismiss?.();
  };

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) close();
    };
    document.addEventListener('mousedown', onPointer);
    return () => document.removeEventListener('mousedown', onPointer);
  });

  const choose = (option: Option) => {
    if (option.kind === 'priest') {
      console.log('[Certificates] Priest picked', { id, priest: option.priest.user_id, name: option.label });
      onChange(option.label, option.priest);
    } else {
      console.log('[Certificates] Custom priest name used', { id, name: option.label });
      onChange(option.label, null);
    }
    setOpen(false);
    setQuery('');
  };

  const openList = () => {
    if (!open) {
      setOpen(true);
      setActive(0);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) openList();
      else setActive((i) => Math.min(options.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      if (open && options[active]) {
        e.preventDefault();
        choose(options[active]);
      }
    } else if (e.key === 'Escape') {
      if (open) {
        e.preventDefault();
        e.stopPropagation();
        close();
      }
    } else if (e.key === 'Tab') {
      if (open) close();
    }
  };

  const activeOptionId = open && options[active] ? `${listId}-opt-${active}` : undefined;

  return (
    <div ref={rootRef} className="relative">
      <div
        className={`flex items-center gap-2 rounded-lg border bg-white px-3 transition-shadow focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent ${
          error ? 'border-red-400 bg-red-50/40' : 'border-slate-200'
        }`}
      >
        {open ? (
          <Search size={16} className="shrink-0 text-slate-400" aria-hidden />
        ) : value ? (
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[10px] font-semibold text-blue-700" aria-hidden>
            {priestInitials(value)}
          </span>
        ) : (
          <Search size={16} className="shrink-0 text-slate-400" aria-hidden />
        )}
        <input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeOptionId}
          autoComplete="off"
          maxLength={150}
          className="min-w-0 flex-1 bg-transparent py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400"
          value={open ? query : value}
          placeholder={open && value ? value : placeholder}
          onFocus={openList}
          onClick={openList}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            if (!open) setOpen(true);
          }}
          onKeyDown={onKeyDown}
        />
        {value && !open && (
          <button
            type="button"
            onClick={() => {
              onChange('', null);
              inputRef.current?.focus();
            }}
            aria-label="Clear priest"
            className="shrink-0 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={14} aria-hidden />
          </button>
        )}
        <button
          type="button"
          tabIndex={-1}
          onClick={() => (open ? close() : (inputRef.current?.focus(), openList()))}
          aria-label={open ? 'Close list' : 'Open list'}
          className="shrink-0 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        >
          <ChevronDown size={16} className={`transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
        </button>
      </div>

      {open && (
        <div className="absolute left-0 right-0 z-30 mt-1 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
          <ul id={listId} role="listbox" className="max-h-64 overflow-y-auto py-1">
            {options.length === 0 ? (
              <li className="px-3 py-6 text-center text-sm text-slate-500">
                {priests.length === 0 ? 'No priests in the system yet. Type a name.' : 'Type a name to search.'}
              </li>
            ) : (
              options.map((option, index) => {
                const isActive = index === active;
                if (option.kind === 'custom') {
                  return (
                    <li
                      key="custom"
                      id={`${listId}-opt-${index}`}
                      role="option"
                      aria-selected={isActive}
                      onMouseEnter={() => setActive(index)}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => choose(option)}
                      className={`mx-1 flex cursor-pointer items-center gap-3 rounded-md border-t border-slate-100 px-3 py-2.5 text-sm ${
                        isActive ? 'bg-blue-50 text-blue-800' : 'text-slate-700'
                      }`}
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500" aria-hidden>
                        <PenLine size={14} />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate">
                          Use “<span className="font-semibold">{option.label}</span>”
                        </span>
                        <span className="block text-xs text-slate-500">For a priest who is not in the system</span>
                      </span>
                    </li>
                  );
                }
                const p = option.priest;
                const isSelected = selectedPriestId ? String(p.user_id) === selectedPriestId : option.label === value;
                const isDefault = defaultPriestId === String(p.user_id);
                return (
                  <li
                    key={p.user_id}
                    id={`${listId}-opt-${index}`}
                    role="option"
                    aria-selected={isActive}
                    onMouseEnter={() => setActive(index)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => choose(option)}
                    className={`mx-1 flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm ${
                      isActive ? 'bg-blue-50' : ''
                    }`}
                  >
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                        isSelected ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-700'
                      }`}
                      aria-hidden
                    >
                      {priestInitials(p.full_name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate ${isSelected ? 'font-semibold text-blue-800' : 'font-medium text-slate-900'}`}>
                        <Highlight text={option.label} query={query} />
                      </span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
                        <span
                          className={`rounded-full px-1.5 py-px text-[10px] font-medium ${
                            p.is_available === false ? 'bg-slate-100 text-slate-500' : 'bg-emerald-50 text-emerald-700'
                          }`}
                        >
                          {p.is_available === false ? 'Unavailable' : 'Available'}
                        </span>
                        {isDefault && (
                          <span className="rounded-full bg-blue-50 px-1.5 py-px text-[10px] font-medium text-blue-700">Default</span>
                        )}
                        {isSelected && <span className="text-[10px] text-blue-700">Selected</span>}
                      </span>
                    </span>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

export default PriestPicker;
