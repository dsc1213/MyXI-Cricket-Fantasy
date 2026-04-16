import { Fragment, useMemo, useState } from 'react'

function isSortablePrimitive(value) {
  return (
    typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
  )
}

function normalizeSortValue(value) {
  if (value == null) return ''
  if (typeof value === 'string') return value.toLowerCase()
  if (typeof value === 'boolean') return value ? 1 : 0
  if (typeof value === 'number') return value
  if (value instanceof Date) return value.getTime()
  return String(value).toLowerCase()
}

function StickyTable({
  columns,
  rows,
  rowKey = (row) => row.id,
  rowClassName = '',
  onRowClick,
  emptyText = 'No rows',
  showEmptyRow = true,
  wrapperClassName = '',
  tableClassName = '',
  isRowExpanded,
  renderExpandedRow,
  expandedRowClassName = '',
}) {
  const [sortState, setSortState] = useState({ key: '', direction: 'asc' })

  const resolveRowClass = (row, index) =>
    typeof rowClassName === 'function' ? rowClassName(row, index) : rowClassName

  const getColumnRawValue = (column, row, index) => {
    if (typeof column.sortValue === 'function') return column.sortValue(row, index)
    return row[column.key]
  }

  const isColumnSortable = (column) => {
    if (column.sortable === false) return false
    if (column.sortable === true) return true
    const sample = rows.find((row) => row != null)
    if (!sample) return false
    return isSortablePrimitive(getColumnRawValue(column, sample, 0))
  }

  const sortedRows = useMemo(() => {
    if (!sortState.key) return rows
    const sortColumn = columns.find((column) => column.key === sortState.key)
    if (!sortColumn) return rows
    const directionFactor = sortState.direction === 'asc' ? 1 : -1
    return [...rows]
      .map((row, index) => ({
        row,
        index,
        value: normalizeSortValue(getColumnRawValue(sortColumn, row, index)),
      }))
      .sort((a, b) => {
        if (a.value === b.value) return a.index - b.index
        return a.value > b.value ? directionFactor : -directionFactor
      })
      .map((item) => item.row)
  }, [columns, rows, sortState])

  const onToggleSort = (column) => {
    if (!isColumnSortable(column)) return
    setSortState((prev) => {
      if (prev.key !== column.key) return { key: column.key, direction: 'asc' }
      return {
        key: column.key,
        direction: prev.direction === 'asc' ? 'desc' : 'asc',
      }
    })
  }

  return (
    <div className={`sticky-table-wrap ${wrapperClassName}`.trim()}>
      <table className={`sticky-table ${tableClassName}`.trim()}>
        <thead>
          <tr>
            {columns.map((column) => {
              const sortable = isColumnSortable(column)
              const isActive = sortState.key === column.key
              const icon = isActive ? (sortState.direction === 'asc' ? '▲' : '▼') : '▲▼'
              const columnStyle =
                column.width != null
                  ? {
                      width: column.width,
                      minWidth: column.width,
                      maxWidth: column.width,
                    }
                  : undefined
              return (
                <th
                  key={column.key}
                  className={column.headerClassName || ''}
                  style={columnStyle}
                >
                  {sortable ? (
                    <button
                      type="button"
                      className={`table-sort-trigger ${isActive ? 'active' : ''}`.trim()}
                      onClick={() => onToggleSort(column)}
                    >
                      <span>{column.label}</span>
                      {!column.hideSortIcon && (
                        <span className="table-sort-icon">{icon}</span>
                      )}
                    </button>
                  ) : (
                    <span>{column.label}</span>
                  )}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {sortedRows.length ? (
            sortedRows.map((row, index) => {
              const key = rowKey(row, index)
              const expanded = Boolean(isRowExpanded?.(row, index))
              return (
                <Fragment key={key}>
                  <tr
                    className={resolveRowClass(row, index)}
                    onClick={onRowClick ? () => onRowClick(row, index) : undefined}
                  >
                    {columns.map((column) => (
                      <td
                        key={`${key}-${column.key}`}
                        className={column.cellClassName || ''}
                        style={
                          column.width != null
                            ? {
                                width: column.width,
                                minWidth: column.width,
                                maxWidth: column.width,
                              }
                            : undefined
                        }
                      >
                        {typeof column.render === 'function'
                          ? column.render(row, index)
                          : row[column.key]}
                      </td>
                    ))}
                  </tr>
                  {expanded && typeof renderExpandedRow === 'function' ? (
                    <tr
                      key={`${key}-expanded`}
                      className={
                        typeof expandedRowClassName === 'function'
                          ? expandedRowClassName(row, index)
                          : expandedRowClassName
                      }
                    >
                      <td colSpan={columns.length}>{renderExpandedRow(row, index)}</td>
                    </tr>
                  ) : null}
                </Fragment>
              )
            })
          ) : showEmptyRow ? (
            <tr>
              <td colSpan={columns.length}>{emptyText}</td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  )
}

export default StickyTable
