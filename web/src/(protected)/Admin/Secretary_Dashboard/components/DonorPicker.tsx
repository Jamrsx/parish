import React, { useEffect, useId, useState } from "react";
import { Loader2, Search, UserCheck, UserRound, X } from "lucide-react";
import { usersAPI, type User } from "../../../../../library/api";

export interface DonorValue {
  /** Registered parishioner account, or null for a typed name / anonymous. */
  userId: number | null;
  name: string;
  detail?: string | null;
}

interface DonorPickerProps {
  value: DonorValue;
  onChange: (value: DonorValue) => void;
  disabled?: boolean;
}

const MIN_SEARCH = 2;
const SEARCH_DEBOUNCE_MS = 300;

const displayName = (u: User) =>
  (u.full_name || [u.first_name, u.middle_name, u.last_name].filter(Boolean).join(" ")).replace(/\s+/g, " ").trim();

const displayDetail = (u: User) => u.email || u.contact_number || u.username || null;

type Option = { kind: "user"; user: User } | { kind: "typed"; name: string };

const DonorPicker: React.FC<DonorPickerProps> = ({ value, onChange, disabled }) => {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [results, setResults] = useState<{ query: string; users: User[]; error: boolean }>({
    query: "",
    users: [],
    error: false,
  });

  const query = value.userId ? "" : value.name.trim();
  const searchable = query.length >= MIN_SEARCH;

  useEffect(() => {
    if (!searchable) return;
    let cancelled = false;
    const handle = setTimeout(() => {
      console.log("[DonorPicker] Searching parishioners:", query);
      usersAPI
        .searchParishioners(query)
        .then((res) => {
          if (cancelled) return;
          const data = res.data?.data as unknown;
          const list: User[] = Array.isArray(data)
            ? (data as User[])
            : ((data as { data?: User[] } | undefined)?.data ?? []);
          console.log("[DonorPicker] Matches:", list.length);
          setResults({ query, users: list, error: false });
        })
        .catch((err) => {
          if (cancelled) return;
          console.error("[DonorPicker] Search failed:", err);
          setResults({ query, users: [], error: true });
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [query, searchable]);

  const loading = searchable && results.query !== query;
  const matches = searchable && results.query === query ? results.users : [];
  const options: Option[] = [
    ...matches.map((user) => ({ kind: "user" as const, user })),
    ...(query ? [{ kind: "typed" as const, name: query }] : []),
  ];
  const activeIndex = Math.min(highlight, Math.max(options.length - 1, 0));
  const showList = open && !value.userId && query.length > 0;

  const pick = (option: Option) => {
    if (option.kind === "user") {
      const picked = { userId: option.user.user_id, name: displayName(option.user), detail: displayDetail(option.user) };
      console.log("[DonorPicker] Picked registered parishioner:", picked);
      onChange(picked);
    } else {
      console.log("[DonorPicker] Using typed name (not registered):", option.name);
      onChange({ userId: null, name: option.name, detail: null });
    }
    setOpen(false);
  };

  const clear = () => {
    console.log("[DonorPicker] Cleared donor (Anonymous)");
    onChange({ userId: null, name: "", detail: null });
    setHighlight(0);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showList || options.length === 0) {
      if (e.key === "ArrowDown" && query) setOpen(true);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((activeIndex + 1) % options.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((activeIndex - 1 + options.length) % options.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      pick(options[activeIndex]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  if (value.userId) {
    return (
      <div className="mt-1 flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
        <UserCheck size={18} className="shrink-0 text-emerald-600" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900">{value.name}</p>
          <p className="truncate text-xs text-emerald-700">
            Registered parishioner{value.detail ? ` · ${value.detail}` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={clear}
          disabled={disabled}
          aria-label="Remove selected parishioner"
          className="rounded-md p-1.5 text-slate-500 hover:bg-white hover:text-slate-700 disabled:opacity-50"
        >
          <X size={16} />
        </button>
      </div>
    );
  }

  const unlinkedMatches = !open && matches.length > 0 && query.length > 0;

  return (
    <div className="relative mt-1">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            role="combobox"
            aria-expanded={showList}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={showList && options.length ? `${listId}-${activeIndex}` : undefined}
            value={value.name}
            disabled={disabled}
            onChange={(e) => {
              onChange({ userId: null, name: e.target.value, detail: null });
              setHighlight(0);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setOpen(false)}
            onKeyDown={onKeyDown}
            placeholder="Search a registered parishioner or type a name"
            className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {loading && (
            <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-slate-400" />
          )}
        </div>
        {value.name && (
          <button
            type="button"
            onClick={clear}
            disabled={disabled}
            className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            Anonymous
          </button>
        )}
      </div>

      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
        >
          {!searchable && (
            <li className="px-3 py-2 text-xs text-slate-500">Type at least {MIN_SEARCH} letters to search accounts.</li>
          )}
          {searchable && loading && <li className="px-3 py-2 text-xs text-slate-500">Searching parishioners…</li>}
          {searchable && !loading && results.error && (
            <li className="px-3 py-2 text-xs text-red-600">Could not search accounts. You can still use the typed name.</li>
          )}
          {searchable && !loading && !results.error && matches.length === 0 && (
            <li className="px-3 py-2 text-xs text-slate-500">No registered parishioner matches “{query}”.</li>
          )}
          {options.map((option, i) => {
            const active = i === activeIndex;
            return (
              <li
                key={option.kind === "user" ? `u-${option.user.user_id}` : "typed"}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={active}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(option);
                }}
                onMouseEnter={() => setHighlight(i)}
                className={`flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm ${
                  active ? "bg-blue-50" : ""
                } ${option.kind === "typed" ? "border-t border-slate-100" : ""}`}
              >
                {option.kind === "user" ? (
                  <>
                    <UserCheck size={16} className="shrink-0 text-emerald-600" aria-hidden />
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-slate-900">{displayName(option.user)}</span>
                      {displayDetail(option.user) && (
                        <span className="block truncate text-xs text-slate-500">{displayDetail(option.user)}</span>
                      )}
                    </span>
                  </>
                ) : (
                  <>
                    <UserRound size={16} className="shrink-0 text-slate-400" aria-hidden />
                    <span className="truncate text-slate-700">
                      Use “{option.name}” <span className="text-slate-400">(not registered)</span>
                    </span>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <p className={`mt-1 text-xs ${unlinkedMatches ? "text-amber-700" : "text-slate-500"}`}>
        {unlinkedMatches
          ? `${matches.length} registered parishioner${matches.length === 1 ? "" : "s"} match this name. Pick one from the list to link the donation, or keep the typed name.`
          : value.name.trim()
            ? "Saved as typed (not linked to an account)."
            : "Leave blank to record as Anonymous."}
      </p>
    </div>
  );
};

export default DonorPicker;
