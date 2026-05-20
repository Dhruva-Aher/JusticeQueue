// Axios instance with Firebase token interceptor and 401 redirect
import axios from 'axios'
import { getFirebaseAuth } from './firebase.js'

const axiosClient = axios.create({ baseURL: '' })

axiosClient.interceptors.request.use(async (config) => {
  const firebaseAuth = getFirebaseAuth()
  const user = firebaseAuth?.currentUser
  if (user) {
    const token = await user.getIdToken()
    config.headers['Authorization'] = `Bearer ${token}`
  }
  return config
})

axiosClient.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default axiosClient
