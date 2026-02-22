import axios from 'axios'
import { supabase } from './supabase'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

/**
 * Authenticated axios instance.
 * Automatically adds the Supabase JWT Bearer token to all requests.
 */
const apiAxios = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
})

apiAxios.interceptors.request.use(async (config) => {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.access_token) {
      config.headers.Authorization = `Bearer ${session.access_token}`
    }
  } catch {
    // If session retrieval fails, proceed without auth header
  }
  return config
})

export default apiAxios
