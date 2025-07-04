import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMediaQuery } from 'react-responsive';
import { useAppStore } from '@/store/main';
import { User, MessageResponse, ErrorResponse } from '@schema'; // Assuming User, MessageResponse, ErrorResponse types are available from @schema or equivalents defined in main.tsx
import { ChevronDownIcon, Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline'; // Assuming Heroicons are available

// Props interface for GV_HeaderBar
interface GV_HeaderBarProps {
  toggleMobileDrawer: () => void; // Function to toggle the mobile sidebar drawer
}

const GV_HeaderBar: React.FC<GV_HeaderBarProps> = ({ toggleMobileDrawer }) => {
  const navigate = useNavigate();
  const auth_token = useAppStore((state) => state.auth_token);
  const current_user = useAppStore((state) => state.current_user); // Can be null if auth_token is null
  const logout_user = useAppStore((state) => state.logout_user);

  // Local state for user account menu dropdown visibility
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  // Determine if on mobile for responsive rendering (e.g., hamburger icon)
  // This value is also implicitly used by App.tsx/AuthenticatedLayout
  // to decide whether to render GV_Sidebar or GV_Sidebar_MobileDrawer.
  // Here, it ensures the hamburger icon button is only visible on small screens.
  const isDesktopOrTablet = useMediaQuery({ minWidth: 768 }); // Tailwind's 'md' breakpoint

  // Action: handleAppTitleLogoClick
  const handleAppTitleLogoClick = () => {
    if (auth_token) {
      navigate('/tasks');
    } else {
      navigate('/login');
    }
  };

  // Action: handleLoginClick
  const handleLoginClick = () => {
    navigate('/login');
  };

  // Action: handleSignUpClick
  const handleSignUpClick = () => {
    navigate('/register');
  };

  // Action: handleLogoutClick
  const handleLogoutClick = async () => {
    setIsUserMenuOpen(false); // Close the dropdown menu
    await logout_user(); // Call the global logout action
    navigate('/login'); // Redirect to login page after logout
  };

  // Action: handleMobileMenuToggle (from PRD)
  // This function is passed via props from App.tsx/AuthenticatedLayout
  // It simply calls the prop to trigger the parent's state change for the drawer.
  const handleMobileMenuToggle = () => {
    toggleMobileDrawer();
  };

  // Conditionally render the user menu or auth buttons
  const renderAuthSection = () => {
    if (auth_token && current_user) {
      return (
        <div className="relative">
          <button
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className="flex items-center space-x-2 text-gray-700 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500 rounded-md p-1 transition-colors duration-200"
            aria-expanded={isUserMenuOpen ? 'true' : 'false'}
            aria-haspopup="true"
          >
            <div className="h-8 w-8 rounded-full bg-purple-200 flex items-center justify-center text-purple-700 font-semibold text-sm">
              {current_user.email.charAt(0).toUpperCase()}
            </div>
            <span className="hidden sm:inline text-sm font-medium">{current_user.email}</span>
            <ChevronDownIcon className={`h-4 w-4 transform transition-transform duration-200 ${isUserMenuOpen ? 'rotate-180' : 'rotate-0'}`} />
          </button>

          {isUserMenuOpen && (
            <div
              className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-50 overflow-hidden"
              role="menu"
              aria-orientation="vertical"
              aria-labelledby="user-menu-button"
            >
              {/* <Link
                to="/profile" // Placeholder for future profile page
                className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                onClick={() => setIsUserMenuOpen(false)}
                role="menuitem"
              >
                My Account
              </Link> */}
              <button
                onClick={handleLogoutClick}
                className="flex items-center w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                role="menuitem"
              >
                <span className="mr-2">🚪</span>Logout
              </button>
            </div>
          )}
        </div>
      );
    } else {
      return (
        <div className="space-x-4">
          <button
            onClick={handleLoginClick}
            className="px-4 py-2 text-sm font-medium text-purple-600 hover:text-purple-800 transition-colors duration-200 rounded-md"
          >
            Login
          </button>
          <button
            onClick={handleSignUpClick}
            className="px-4 py-2 text-sm font-medium bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors duration-200 shadow-sm"
          >
            Sign Up
          </button>
        </div>
      );
    }
  };

  return (
    <>
      <header className="sticky top-0 z-40 w-full bg-white shadow-sm border-b border-gray-100">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          {/* Mobile menu toggle (Hamburger) - visible only on small screens */}
          {!isDesktopOrTablet && (
            <button
              onClick={handleMobileMenuToggle}
              className="p-2 rounded-md text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-colors duration-200 mr-2"
              aria-label="Toggle mobile menu"
            >
              <Bars3Icon className="h-6 w-6" />
            </button>
          )}

          {/* App Title/Logo */}
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 cursor-pointer" onClick={handleAppTitleLogoClick}>
            <span className="text-purple-600">NexGen</span> TaskPad
          </h1>

          {/* Spacer to push content to ends, especially useful on mobile when hamburger is visible */}
          <div className="flex-grow"></div>

          {/* Authentication/User Menu Section */}
          {renderAuthSection()}
        </div>
      </header>
    </>
  );
};

export default GV_HeaderBar;