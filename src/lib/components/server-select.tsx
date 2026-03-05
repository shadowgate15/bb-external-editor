import InputLabel from '@mui/material/InputLabel'
import MenuItem from '@mui/material/MenuItem'
import Select, { SelectProps } from '@mui/material/Select'
import React from 'react'

export type ServerSelectProps = SelectProps<string> & {
  servers: string[]
}

export function ServerSelect({ servers, value, onChange, ...selectProps }: ServerSelectProps) {
  const id = React.useId()

  return (
    <>
      <InputLabel id={`server-select-label-${id}`}>Server</InputLabel>
      <Select labelId={`server-select-label-${id}`} id={`server-select-${id}`} value={value} {...selectProps}>
        {servers.map((server) => (
          <MenuItem key={server} value={server}>
            {server}
          </MenuItem>
        ))}
      </Select>
    </>
  )
}
