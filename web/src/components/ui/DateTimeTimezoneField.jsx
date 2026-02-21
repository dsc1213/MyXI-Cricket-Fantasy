import SelectField from './SelectField.jsx'

const TIMEZONE_OPTIONS = [
  { value: 'UTC', label: 'UTC' },
  { value: 'Asia/Kolkata', label: 'Asia/Kolkata' },
  { value: 'Australia/Sydney', label: 'Australia/Sydney' },
  { value: 'Europe/London', label: 'Europe/London' },
  { value: 'America/New_York', label: 'America/New_York' },
]

function DateTimeTimezoneField({ value = '', timezone = 'UTC', onChange }) {
  return (
    <div className="datetime-timezone-field">
      <input
        type="datetime-local"
        value={value}
        onChange={(event) =>
          onChange?.({
            value: event.target.value,
            timezone,
          })
        }
      />
      <SelectField
        value={timezone}
        onChange={(event) =>
          onChange?.({
            value,
            timezone: event.target.value,
          })
        }
        options={TIMEZONE_OPTIONS}
      />
    </div>
  )
}

export default DateTimeTimezoneField
