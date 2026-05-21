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
    // Do NOT redirect on 401 here — window.location.href causes a full page
    // reload which destroys Firebase's in-memory auth state and creates an
    // infinite dashboard ↔ login loop. Each page handles its own auth guard
    // via useEffect + router.replace.
    return Promise.reject(err)
  }
)

export default axiosClient
