import { Screen } from '../App';
import { Home, MessageSquare, Clock, Settings, User, HelpCircle } from 'lucide-react';

interface SidebarNavProps {
  currentScreen: Screen;
  onScreenChange: (screen: Screen) => void;
}

const navTabs: { id: Screen; icon: any }[] = [
  { id: 'Chat', icon: Home },
  { id: 'Paths', icon: MessageSquare },
  { id: 'History', icon: Clock },
];

function SidebarNav({ currentScreen, onScreenChange }: SidebarNavProps) {
  return (
    <nav className="flex flex-col items-center justify-between h-full py-6 w-[60px] border-l border-[#262626] bg-[#171717]">

      {/* Top Section */}
      <div className="flex flex-col items-center gap-6">
        {/* Logo or Home equivalent if any, but design shows icons starting immediately or after a gap */}

        {/* Main Navigation */}
        <div className="flex flex-col gap-4">
          {navTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onScreenChange(tab.id)}
              className={`flex items-center justify-center w-10 h-10 rounded-full transition-all ${currentScreen === tab.id
                ? 'bg-[#22d3ee] text-[#171717] shadow-[0_0_10px_rgba(34,211,238,0.3)]'
                : 'text-gray-500 hover:text-gray-300'
                }`}
              title={tab.id}
            >
              <tab.icon size={18} strokeWidth={currentScreen === tab.id ? 2.5 : 2} />
            </button>
          ))}
        </div>
      </div>

      {/* Bottom Section */}
      <div className="flex flex-col items-center gap-6 mb-2">
        <button
          onClick={() => onScreenChange('Settings')}
          className={`flex items-center justify-center w-10 h-10 rounded-full transition-all ${currentScreen === 'Settings'
            ? 'bg-[#22d3ee] text-[#171717] shadow-[0_0_10px_rgba(34,211,238,0.3)]'
            : 'text-gray-500 hover:text-gray-300'
            }`}
          title="Settings"
        >
          <Settings size={18} strokeWidth={currentScreen === 'Settings' ? 2.5 : 2} />
        </button>

        <button
          onClick={() => onScreenChange('Support')}
          className={`flex items-center justify-center w-10 h-10 rounded-full transition-all ${currentScreen === 'Support'
            ? 'bg-[#22d3ee] text-[#171717] shadow-[0_0_10px_rgba(34,211,238,0.3)]'
            : 'text-gray-500 hover:text-gray-300'
            }`}
          title="Support"
        >
          <HelpCircle size={18} strokeWidth={currentScreen === 'Support' ? 2.5 : 2} />
        </button>

        <button
          onClick={() => onScreenChange('Profile')}
          className={`flex items-center justify-center w-10 h-10 rounded-full transition-all ${currentScreen === 'Profile'
            ? 'bg-[#22d3ee] text-[#171717] shadow-[0_0_10px_rgba(34,211,238,0.3)]'
            : 'text-gray-500 hover:text-gray-300'
            }`}
          title="Profile"
        >
          <User size={18} strokeWidth={currentScreen === 'Profile' ? 2.5 : 2} />
        </button>
      </div>
    </nav>
  );
}

export default SidebarNav;