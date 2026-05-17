import { Sidebar } from '@/components/layout/Sidebar'
import { BrainPanel } from '@/components/layout/BrainPanel'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-[#080C18]">
      <Sidebar />
      <main className="flex-1 overflow-y-auto text-white">
        {children}
      </main>
      <BrainPanel />
    </div>
  )
}
