import InputLabel from '@mui/material/InputLabel'
import MenuItem from '@mui/material/MenuItem'
import Select, { SelectProps } from '@mui/material/Select'
import React from 'react'
import { useId } from '../hooks/use-id'

export type ServerSelectProps<T> = SelectProps<T> & {
  servers: string[]
  itemRenderer?: (server: string) => React.ReactNode
}

export function ServerSelect<T>({ servers, value, onChange, itemRenderer, ...selectProps }: ServerSelectProps<T>) {
  const id = useId()

  return (
    <>
      <InputLabel id={`server-select-label-${id}`}>Server</InputLabel>
      <Select
        labelId={`server-select-label-${id}`}
        id={`server-select-${id}`}
        value={value}
        onChange={onChange}
        {...selectProps}
      >
        <MenuItem disabled value="">
          <em>Placeholder</em>
        </MenuItem>
        {servers.map((server) => (
          <MenuItem key={server} value={server}>
            {itemRenderer ? itemRenderer(server) : server}
          </MenuItem>
        ))}
      </Select>
    </>
  )
}
