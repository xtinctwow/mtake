// src/components/Sidebar.tsx
import { useState } from "react";
import {
  FaBars, FaGift, FaUsers, FaCrown, FaBook, FaShieldAlt, FaHeadset, FaGlobe,
  FaDice, FaFootballBall, FaChevronDown, FaChevronRight, FaComments
} from "react-icons/fa";

const Sidebar = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [showPromotions, setShowPromotions] = useState(false);
  const [showSponsorships, setShowSponsorships] = useState(false);
  const [showLanguages, setShowLanguages] = useState(false);

  const toggleSidebar = () => setCollapsed(!collapsed);

  const navItemBase = "flex items-center space-x-3 px-4 py-2 hover:bg-gray-700 transition-colors rounded";
  const navItemCollapsed = "flex items-center justify-center w-10 h-10 mx-auto hover:bg-gray-700 transition-colors rounded";

  const iconClass = "text-lg";

  const Tooltip = ({ text }: { text: string }) => (
    <span className="absolute left-full top-1/2 -translate-y-1/2 ml-3 whitespace-nowrap bg-white text-black text-xs px-3 py-1 rounded shadow-lg opacity-0 group-hover:opacity-100 z-50 transition-opacity duration-200">
      {text}
    </span>
  );

  return (
    <aside className={`bg-gray-900 text-white h-screen transition-all duration-300 ${collapsed ? "w-20" : "w-64"} p-2`}>
      {/* Header */}
      <div className={`flex items-center ${collapsed ? "justify-center" : "justify-start gap-2"} px-2 mb-6`}>
		  <button onClick={toggleSidebar} className="text-white p-2 hover:bg-gray-700 rounded">
			<FaBars />
		  </button>

		  {!collapsed && (
			<div className="flex gap-2 ml-2">
			  <button className="bg-gray-800 px-4 py-2 rounded hover:bg-gray-700 text-sm text-white">
				Casino
			  </button>
			  <button className="bg-gray-800 px-4 py-2 rounded hover:bg-gray-700 text-sm text-white">
				Sports
			  </button>
			</div>
		  )}
		</div>

      <nav className="space-y-1">
  {/*show ONLY when collapsed */}
  {collapsed && (
    <div className="flex flex-col space-y-2 px-2 mb-4">
      <div className="group relative">
        <button className="flex items-center justify-center w-full bg-gray-800 hover:bg-gray-700 text-sm text-white py-2 rounded">
          <FaDice className="text-lg" />
        </button>
        <Tooltip text="Casino" />
      </div>
      <div className="group relative">
        <button className="flex items-center justify-center w-full bg-gray-800 hover:bg-gray-700 text-sm text-white py-2 rounded">
          <FaFootballBall className="text-lg" />
        </button>
        <Tooltip text="Sports" />
      </div>
    </div>
  )}

        {/* Promotions Dropdown */}
        <div className="group relative">
          <div
            onClick={() => setShowPromotions(!showPromotions)}
            className={`${collapsed ? navItemCollapsed : navItemBase} cursor-pointer`}
          >
            <FaGift className={iconClass} />
            {!collapsed && <span className="flex-1">Promotions</span>}
            {!collapsed && (showPromotions ? <FaChevronDown /> : <FaChevronRight />)}
          </div>
          {collapsed && <Tooltip text="Promotions" />}
          {showPromotions && !collapsed && (
            <div className="ml-8 text-sm space-y-1">
              <div className="hover:text-blue-400 cursor-pointer">🎯 $75k Weekly</div>
              <div className="hover:text-blue-400 cursor-pointer">🏁 $100k Race</div>
              <div className="hover:text-blue-400 cursor-pointer">🎰 Drops & Wins</div>
              <div className="hover:text-blue-400 cursor-pointer">🎁 View All</div>
            </div>
          )}
        </div>

        {/* Static links */}
        {[
          { icon: <FaUsers className={iconClass} />, text: "Affiliate" },
          { icon: <FaCrown className={iconClass} />, text: "VIP Club" },
          { icon: <FaBook className={iconClass} />, text: "Blog" },
          { icon: <FaComments className={iconClass} />, text: "Forum" },
          { icon: <FaShieldAlt className={iconClass} />, text: "Responsible Gambling" },
          { icon: <FaHeadset className={iconClass} />, text: "Live Support" }
        ].map(({ icon, text }, idx) => (
          <div className="group relative" key={idx}>
            <div className={collapsed ? navItemCollapsed : navItemBase} title={collapsed ? text : ""}>
              {icon}
              {!collapsed && <span>{text}</span>}
            </div>
            {collapsed && <Tooltip text={text} />}
          </div>
        ))}

        {/* Sponsorships Dropdown */}
        <div className="group relative">
          <div
            onClick={() => setShowSponsorships(!showSponsorships)}
            className={`${collapsed ? navItemCollapsed : navItemBase} cursor-pointer`}
          >
            <FaDice className={iconClass} />
            {!collapsed && <span className="flex-1">Sponsorships</span>}
            {!collapsed && (showSponsorships ? <FaChevronDown /> : <FaChevronRight />)}
          </div>
          {collapsed && <Tooltip text="Sponsorships" />}
          {showSponsorships && !collapsed && (
            <div className="ml-8 text-sm space-y-1">
              <div className="hover:text-blue-400 cursor-pointer">Team A</div>
              <div className="hover:text-blue-400 cursor-pointer">Team B</div>
            </div>
          )}
        </div>

        {/* Language Dropdown */}
        <div className="group relative">
          <div
            onClick={() => setShowLanguages(!showLanguages)}
            className={`${collapsed ? navItemCollapsed : navItemBase} cursor-pointer`}
          >
            <FaGlobe className={iconClass} />
            {!collapsed && <span className="flex-1">Language: English</span>}
            {!collapsed && (showLanguages ? <FaChevronDown /> : <FaChevronRight />)}
          </div>
          {collapsed && <Tooltip text="Language" />}
          {showLanguages && !collapsed && (
            <div className="ml-8 text-sm space-y-1">
              <div className="hover:text-blue-400 cursor-pointer">English</div>
              <div className="hover:text-blue-400 cursor-pointer">Slovenščina</div>
              <div className="hover:text-blue-400 cursor-pointer">Deutsch</div>
            </div>
          )}
        </div>
      </nav>
    </aside>
  );
};

export default Sidebar;