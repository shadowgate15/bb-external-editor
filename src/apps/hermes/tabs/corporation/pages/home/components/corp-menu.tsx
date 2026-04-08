import MoreVert from '@mui/icons-material/MoreVert'
import IconButton from '@mui/material/IconButton'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import React from 'react'

import { useCorpClient } from '../../../hooks/use-corp-client'

export function CorpMenu() {
  const corpClient = useCorpClient()

  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null)
  const open = React.useMemo(() => Boolean(anchorEl), [anchorEl])
  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget)
  }
  const handleClose = () => {
    setAnchorEl(null)
  }

  return (
    <>
      <IconButton
        id="corp-menu-button"
        aria-controls={open ? 'corp-menu' : undefined}
        aria-haspopup="true"
        aria-expanded={open ? 'true' : undefined}
        onClick={handleClick}
      >
        <MoreVert />
      </IconButton>

      <Menu
        id="corp-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        slotProps={{
          list: {
            'aria-labelledby': 'corp-menu-button',
          },
        }}
      >
        <MenuItem
          onClick={() => {
            corpClient.send('clearBoostMaterials')

            handleClose()
          }}
        >
          Clear Boost Materials
        </MenuItem>
      </Menu>
    </>
  )
}
