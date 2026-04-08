import Button from './Button.jsx'

function JsonTextareaField({
  label,
  value,
  onChange,
  rows = 12,
  placeholder = '',
  textareaClassName = 'dashboard-json-textarea',
  wrapperClassName = '',
  onClear = null,
  clearDisabled = false,
  readOnly = false,
}) {
  return (
    <label className={wrapperClassName || undefined}>
      {label}
      <textarea
        className={textareaClassName}
        rows={rows}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        readOnly={readOnly}
      />
      {typeof onClear === 'function' && (
        <span className="json-textarea-actions">
          <Button
            type="button"
            variant="ghost"
            size="small"
            onClick={onClear}
            disabled={clearDisabled}
          >
            Clear
          </Button>
        </span>
      )}
    </label>
  )
}

export default JsonTextareaField
