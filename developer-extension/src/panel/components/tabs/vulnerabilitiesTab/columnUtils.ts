export type VulnerabilitiesListColumn =
  | { type: 'date' }
  | { type: 'type' }
  | { type: 'location' }
  | { type: 'element' }
  | { type: 'field'; path: string }

export const DEFAULT_VULNERABILITIES_COLUMNS: VulnerabilitiesListColumn[] = [{ type: 'date' }, { type: 'type' }, { type: 'location' }, { type: 'element' }]

export function includesColumn(existingColumns: VulnerabilitiesListColumn[], newColumn: VulnerabilitiesListColumn) {
  return existingColumns.some((column) => {
    if (column.type === 'field' && newColumn.type === 'field') {
      return column.path === newColumn.path
    }
    return column.type === newColumn.type
  })
}

export function addColumn(columns: VulnerabilitiesListColumn[], columnToAdd: VulnerabilitiesListColumn) {
  return columns.concat(columnToAdd)
}

export function removeColumn(columns: VulnerabilitiesListColumn[], columnToRemove: VulnerabilitiesListColumn) {
  return columns.filter((column) => columnToRemove !== column)
}

export function moveColumn(columns: VulnerabilitiesListColumn[], columnToMove: VulnerabilitiesListColumn, index: number) {
  const newColumns = removeColumn(columns, columnToMove)
  newColumns.splice(index, 0, columnToMove)
  return newColumns
}

export function getColumnTitle(column: VulnerabilitiesListColumn) {
  return column.type === 'date'
    ? 'Date'
    : column.type === 'location'
      ? 'Location'
      : column.type === 'type'
        ? 'Type'
        : column.type === 'element'
          ? 'Element'
          : column.path
}
