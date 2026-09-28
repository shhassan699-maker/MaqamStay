"use client";

import { useId, useState, type Ref } from "react";
import { ChevronDown } from "lucide-react";

type Props = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  suggestions: string[];
  browseSuggestions?: string[];
  autoComplete: string;
  error?: string;
  loading?: boolean;
  helper?: string;
  inputRef?: Ref<HTMLInputElement>;
  onFocus?: () => void;
};

export function LocationAutocomplete({ id, label, value, onChange, onBlur, suggestions, browseSuggestions, autoComplete, error, loading, helper, inputRef, onFocus }: Props) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [browsing, setBrowsing] = useState(false);
  const [active, setActive] = useState(-1);
  const visibleSuggestions = browsing && browseSuggestions ? browseSuggestions : suggestions;
  const show = open;

  function choose(suggestion: string) {
    onChange(suggestion);
    setOpen(false);
    setBrowsing(false);
    setActive(-1);
  }

  return <div className="field location-field">
    <label htmlFor={id}>{label} *</label>
    <div className="location-input-wrap">
    <input
      id={id}
      ref={inputRef}
      value={value}
      onChange={(event) => { onChange(event.target.value); setOpen(true); setBrowsing(false); setActive(-1); }}
      onFocus={() => { setOpen(true); setBrowsing(true); setActive(-1); onFocus?.(); }}
      onBlur={() => { setOpen(false); onBlur(); }}
      onKeyDown={(event) => {
        if (event.key === "Escape") { setOpen(false); setActive(-1); return; }
        if (!show || visibleSuggestions.length === 0) return;
        if (event.key === "ArrowDown") { event.preventDefault(); setActive((current) => Math.min(current + 1, visibleSuggestions.length - 1)); }
        if (event.key === "ArrowUp") { event.preventDefault(); setActive((current) => Math.max(current - 1, 0)); }
        if (event.key === "Enter" && active >= 0) { event.preventDefault(); choose(visibleSuggestions[active]); }
      }}
      autoComplete={autoComplete}
      role="combobox"
      aria-autocomplete="list"
      aria-expanded={show && (visibleSuggestions.length > 0 || loading || !!helper)}
      aria-controls={show && visibleSuggestions.length > 0 ? listId : undefined}
      aria-activedescendant={show && active >= 0 ? `${listId}-${active}` : undefined}
      aria-invalid={!!error}
      aria-describedby={`${id}-hint${error ? ` ${id}-error` : ""}`}
    />
    <ChevronDown className="location-chevron" size={18} aria-hidden="true"/>
    {show && (visibleSuggestions.length > 0 || loading || helper) && <div className="location-popover">
      {loading && <p className="location-status" role="status">Finding cities…</p>}
      {!loading && visibleSuggestions.length > 0 && <ul id={listId} role="listbox" aria-label={`${label} suggestions`}>
        {visibleSuggestions.map((suggestion, index) => <li key={suggestion} id={`${listId}-${index}`} role="option" aria-selected={active === index} className={active === index ? "active" : ""} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(suggestion)}>{suggestion}</li>)}
      </ul>}
      {!loading && visibleSuggestions.length === 0 && helper && <p className="location-status">{helper}</p>}
    </div>}
    </div>
    <small id={`${id}-hint`} className="location-hint">Start typing and choose a suggestion, or enter your own.</small>
    {error && <small id={`${id}-error`} className="location-error" role="alert">{error}</small>}
  </div>;
}
