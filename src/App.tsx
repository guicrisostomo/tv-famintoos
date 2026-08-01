import { useState } from 'react'
import { AdminShell } from './components/AdminShell'
import { TvPlayer } from './components/TvPlayer'
import './App.css'

function getRoute() {
  const parts = window.location.pathname.split('/').filter(Boolean)
  if (parts[0] === 'tv') {
    return { type: 'tv' as const, companyId: parts[1] ?? '', displayId: parts[2] ?? '' }
  }
  return { type: 'admin' as const }
}

export default function App() {
  const [route] = useState(getRoute)

  if (route.type === 'tv') {
    return <TvPlayer companyId={route.companyId} displayId={route.displayId} />
  }

  return <AdminShell />
}
