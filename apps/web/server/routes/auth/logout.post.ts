import { defineEventHandler, sendRedirect, setResponseHeader } from 'h3'
import { clearSiteSession } from '../../utils/site-auth'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  clearSiteSession(event)
  return sendRedirect(event, '/login', 303)
})
