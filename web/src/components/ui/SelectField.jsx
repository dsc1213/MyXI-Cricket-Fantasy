function SelectField({ value, onChange, options, children, className = '', ...rest }) {
  const normalized = (options || []).map((option) =>
    typeof option === 'string' ? { value: option, label: option } : option,
  )

  return (
    <select value={value} onChange={onChange} className={className} {...rest}>
      {children ||
        normalized.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
    </select>
  )
}

export default SelectField
