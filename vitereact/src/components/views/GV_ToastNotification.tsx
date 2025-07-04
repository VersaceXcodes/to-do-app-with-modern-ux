import React from 'react';
import { useAppStore } from '@/store/main';
import { Transition } from '@headlessui/react'; // For smooth transitions

// The GV_ToastNotification component displays transient messages.
// It listens to the `current_notification` state from the global Zustand store.
const GV_ToastNotification: React.FC = () => {
  // Select the current notification and the dismiss action from the global store
  const current_notification = useAppStore((state) => state.current_notification);
  const dismiss_notification = useAppStore((state) => state.dismiss_notification);

  // Determine background and text colors based on message type
  const getColors = (type: 'success' | 'error' | 'info' | undefined) => {
    switch (type) {
      case 'success':
        return 'bg-green-500 text-white';
      case 'error':
        return 'bg-red-500 text-white';
      case 'info':
        return 'bg-blue-500 text-white';
      default:
        return 'bg-gray-700 text-white'; // Default for undefined/unknown type
    }
  };

  // Render the toast notification based on the `current_notification` state
  return (
    <Transition
      show={!!current_notification} // Show if current_notification is not null
      as={React.Fragment} // Render as a fragment to apply transition directly to the div
      enter="transition-all ease-out duration-300"
      enterFrom="opacity-0 translate-y-full"
      enterTo="opacity-100 translate-y-0"
      leave="transition-all ease-in duration-200"
      leaveFrom="opacity-100 translate-y-0"
      leaveTo="opacity-0 translate-y-full"
    >
      {current_notification && ( // Only render if there's a notification to show
        <div
          role="alert" // Accessibility role for live regions that convey information directly
          aria-live="assertive" // Indicates that updates to this region are important and should be announced by screen readers
          className={`fixed bottom-4 right-4 p-4 rounded-lg shadow-lg flex items-center justify-between z-50 min-w-[250px] max-w-sm
            ${getColors(current_notification.type)}`}
        >
          <p className="flex-grow text-sm font-medium pr-2">{current_notification.message}</p>
          <button
            onClick={dismiss_notification}
            className="ml-4 p-1 rounded-full hover:bg-opacity-80 focus:outline-none focus:ring-2 focus:ring-opacity-75"
            aria-label="Dismiss notification"
          >
            {/* Simple X icon */}
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
      )}
    </Transition>
  );
};

export default GV_ToastNotification;