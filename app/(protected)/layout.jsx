// Protected layout — sidebar + main content area for all authenticated pages
import Sidebar from '../../components/Sidebar.jsx'

export default function ProtectedLayout({ children }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <div style={{ flex: 1, minWidth: 0, overflow: 'auto' }}>
        {children}
      </div>
    </div>
  )
}
