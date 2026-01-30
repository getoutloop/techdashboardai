import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Ticket,
  Kanban,
  BookOpen,
  MessageSquare,
  FileText,
  Upload,
  Shield,
  Activity,
  Settings,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from './AuthProvider'

interface SidebarProps {
  isCollapsed: boolean
  onToggle: () => void
}

interface NavItem {
  name: string
  href: string
  icon: React.ElementType
  adminOnly?: boolean
}

const mainNavItems: NavItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Tickets', href: '/tickets', icon: Ticket },
  { name: 'Kanban', href: '/kanban', icon: Kanban },
  { name: 'Knowledge Base', href: '/knowledge-base', icon: BookOpen },
  { name: 'AI Chat', href: '/chat', icon: MessageSquare },
]

const adminNavItems: NavItem[] = [
  { name: 'Documents', href: '/admin/documents', icon: FileText, adminOnly: true },
  { name: 'Upload Docs', href: '/admin/documents/upload', icon: Upload, adminOnly: true },
  { name: 'AI Guardrails', href: '/admin/guardrails', icon: Shield, adminOnly: true },
  { name: 'AI Monitoring', href: '/admin/ai-monitoring', icon: Activity, adminOnly: true },
]

export function Sidebar({ isCollapsed, onToggle }: SidebarProps) {
  const { isAdmin } = useAuth()

  const NavItem = ({ item }: { item: NavItem }) => (
    <NavLink
      to={item.href}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
          isActive
            ? 'bg-primary-100 text-primary-700'
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        )
      }
    >
      <item.icon className="h-5 w-5 flex-shrink-0" />
      {!isCollapsed && <span>{item.name}</span>}
    </NavLink>
  )

  return (
    <aside
      className={cn(
        'fixed left-0 top-16 bottom-0 bg-white border-r border-gray-200 transition-all duration-300 z-40',
        isCollapsed ? 'w-16' : 'w-64'
      )}
    >
      <div className="flex flex-col h-full">
        {/* Toggle button */}
        <button
          onClick={onToggle}
          className="absolute -right-3 top-6 bg-white border border-gray-200 rounded-full p-1.5 shadow-sm hover:bg-gray-50"
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4 text-gray-600" />
          ) : (
            <ChevronLeft className="h-4 w-4 text-gray-600" />
          )}
        </button>

        {/* Main navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {!isCollapsed && (
            <p className="px-3 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Main
            </p>
          )}
          {mainNavItems.map((item) => (
            <NavItem key={item.href} item={item} />
          ))}

          {/* Admin section */}
          {isAdmin && (
            <>
              {!isCollapsed && (
                <p className="px-3 mt-6 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Admin
                </p>
              )}
              {isCollapsed && <div className="border-t border-gray-200 my-4" />}
              {adminNavItems.map((item) => (
                <NavItem key={item.href} item={item} />
              ))}
            </>
          )}
        </nav>

        {/* Bottom section */}
        <div className="px-3 py-4 border-t border-gray-200">
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary-100 text-primary-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              )
            }
          >
            <Settings className="h-5 w-5 flex-shrink-0" />
            {!isCollapsed && <span>Settings</span>}
          </NavLink>
        </div>
      </div>
    </aside>
  )
}
