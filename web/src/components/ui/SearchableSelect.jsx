import { useEffect, useMemo, useState } from 'react'

function SearchableSelect({
  value = '',
  onChange,
  options = [],
  placeholder = 'Search...',
  disabled = false,
  className = '',
  maxResults = 40,
  debounceMs = 180,
  minQueryLength = 1,
}) {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const normalizedOptions = useMemo(
    () =>
      (options || []).map((option) =>
        typeof option === 'string' ? { value: option, label: option } : option,
      ),
    [options],
  )
  const selectedOption = normalizedOptions.find(
    (option) => String(option.value) === String(value),
  )
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query)
    }, debounceMs)
    return () => window.clearTimeout(timer)
  }, [debounceMs, query])

  const filteredOptions = useMemo(() => {
    const needle = debouncedQuery.trim().toLowerCase()
    if (needle.length < minQueryLength) return []
    const rows = normalizedOptions.filter((option) =>
      `${option.label} ${option.value}`.toLowerCase().includes(needle),
    )
    return rows.slice(0, maxResults)
  }, [debouncedQuery, maxResults, minQueryLength, normalizedOptions])
  const showResults = query.trim().length >= minQueryLength

  return (
    <div className={`searchable-select ${className}`.trim()}>
      <input
        className="create-contest-input searchable-select-input"
        type="search"
        value={query}
        disabled={disabled}
        placeholder={selectedOption?.label || placeholder}
        onChange={(event) => setQuery(event.target.value)}
      />
      {showResults ? (
        <div className="searchable-select-list" role="listbox">
          {filteredOptions.length ? (
            filteredOptions.map((option) => {
              const optionValue = String(option.value)
              const selected = optionValue === String(value)
              return (
                <button
                  key={optionValue}
                  type="button"
                  className={`searchable-select-option ${selected ? 'is-selected' : ''}`.trim()}
                  disabled={disabled}
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    onChange?.(optionValue)
                    setQuery('')
                    setDebouncedQuery('')
                  }}
                >
                  {option.label}
                </button>
              )
            })
          ) : (
            <span className="searchable-select-empty">No users found</span>
          )}
        </div>
      ) : null}
    </div>
  )
}

export default SearchableSelect
