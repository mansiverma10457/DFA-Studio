import {
  BookOpen,
  Braces,
  Code2,
  FileText,
  FolderOpen,
  LayoutDashboard,
  ListChecks,
} from 'lucide-react'

export const navigationItems = [
  { label: 'Dashboard', path: '/', icon: LayoutDashboard },
  { label: 'DFA Designer', path: '/designer', icon: Braces },
  { label: 'Simulator', path: '/simulator', icon: Code2 },
  { label: 'Transition Table', path: '/transition-table', icon: FileText },
  { label: 'String Testing', path: '/string-testing', icon: ListChecks },
  { label: 'Saved Automata', path: '/saved-automata', icon: FolderOpen },
  { label: 'Documentation', path: '/documentation', icon: BookOpen },
]
