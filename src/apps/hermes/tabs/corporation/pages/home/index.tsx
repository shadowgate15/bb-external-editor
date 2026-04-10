import Button from '@mui/material/Button'
import Grid from '@mui/material/Grid'
import React from 'react'

import { CorpMenu } from './components/corp-menu'

export interface HomeProps {
  onConfig: () => void
}

export function Home({ onConfig }: HomeProps) {
  return (
    <Grid container spacing={1}>
      <Grid display="flex" size="grow" justifyContent="right">
        <Button onClick={onConfig} size="small">
          Config
        </Button>
        <CorpMenu />
      </Grid>
    </Grid>
  )
}
