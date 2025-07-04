import React, { useRef, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import GV_SideBar from '@/components/views/GV_SideBar'; // Assuming GV_SideBar is the actual sidebar component

interface GV_SideBar_MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const GV_SideBar_MobileDrawer: React.FC<GV_SideBar_MobileDrawerProps> = ({ isOpen, onClose }) => {
  const sidebarRef = useRef(null);

  if (!isOpen) {
    return null; // Don't render anything if not open, ensures no flicker before transition
  }

  return (
    <>
      <Transition appear show={isOpen} as={Fragment}>
        <Dialog as="div" className="relative z-40" onClose={onClose} initialFocus={sidebarRef}>
          <Transition.Child
            as={Fragment}
            enter="transition-opacity ease-linear duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="transition-opacity ease-linear duration-300"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            {/* Backdrop for mobile drawer - dims the content behind it */}
            <div className="fixed inset-0 bg-black bg-opacity-75" aria-hidden="true" />
          </Transition.Child>

          <div className="fixed inset-0 flex">
            <Transition.Child
              as={Fragment}
              enter="transition ease-in-out duration-300 transform"
              enterFrom="-translate-x-full"
              enterTo="translate-x-0"
              leave="transition ease-in-out duration-300 transform"
              leaveFrom="translate-x-0"
              leaveTo="-translate-x-full"
            >
              {/* Drawer panel */}
              <Dialog.Panel
                ref={sidebarRef}
                className="relative flex w-full max-w-xs flex-1 flex-col bg-white focus:outline-none overflow-y-auto"
              >
                {/* Close button for accessibility on mobile */}
                <div className="absolute top-0 right-0 pt-4 pr-4">
                  <button
                    type="button"
                    className="-m-2 p-2 rounded-md inline-flex items-center justify-center text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500"
                    onClick={onClose}
                    aria-label="Close sidebar"
                  >
                    <span className="sr-only">Close sidebar</span>
                    {/* Heroicon name: x */}
                    <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* GV_SideBar content */}
                <GV_SideBar onFilterClick={onClose} onManageCategoriesClick={onClose} />
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition>
    </>
  );
};

export default GV_SideBar_MobileDrawer;