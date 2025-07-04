import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppStore } from '@/store/main';
import { ForgotPasswordInput } from '@schema'; // Correct import for types from shared schemas
import { z } from 'zod'; // For client-side validation

// Define local Zod schema for email validation in the form
const emailInputSchema = z.object({
  email: z.string().email("Please enter a valid email address."),
});

type ForgotPasswordFormErrors = {
  email?: string;
};

const UV_ForgotPassword: React.FC = () => {
  const [email_input, set_email_input] = useState<string>('');
  const [form_errors, set_form_errors] = useState<ForgotPasswordFormErrors>({});

  // Access global state and actions
  const is_authenticating = useAppStore(state => state.is_authenticating);
  const request_password_reset = useAppStore(state => state.request_password_reset);
  const show_notification = useAppStore(state => state.show_notification); // Though a generic message is usually handled by store for this.

  const handle_email_change = (e: React.ChangeEvent<HTMLInputElement>) => {
    set_email_input(e.target.value);
    // Clear email error when user starts typing again
    if (form_errors.email) {
      set_form_errors((prev) => ({ ...prev, email: undefined }));
    }
  };

  const handle_send_reset_link_submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Client-side validation
    try {
      emailInputSchema.parse({ email: email_input });
      set_form_errors({}); // Clear any previous errors
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors: ForgotPasswordFormErrors = {};
        error.errors.forEach((err) => {
          if (err.path[0] === 'email') {
            errors.email = err.message;
          }
        });
        set_form_errors(errors);
      }
      return; // Stop submission if client-side validation fails
    }

    try {
      const payload: ForgotPasswordInput = { email: email_input };
      await request_password_reset(payload);
      // The store handles the specific generic success message:
      // "If an account with that email exists, a password reset link has been sent."
      set_email_input(''); // Clear the input field on successful submission
    } catch (error) {
      // Errors are generally handled by the Axios interceptor and show_notification in the store.
      // No need for specific notification here, but ensures the form remains usable.
      console.error('Password reset request failed:', error);
    }
  };

  return (
    <>
      <div className="flex min-h-full flex-1 flex-col justify-center px-4 py-8 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <h2 className="mt-6 text-center text-3xl font-bold leading-9 tracking-tight text-gray-900">
            Forgot Password
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Enter your email address to receive a password reset link.
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white px-6 py-8 shadow sm:rounded-lg sm:px-12">
            <form className="space-y-6" onSubmit={handle_send_reset_link_submit}>
              <div>
                <label htmlFor="email" className="block text-sm font-medium leading-6 text-gray-900">
                  Email address
                </label>
                <div className="mt-2">
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email_input}
                    onChange={handle_email_change}
                    className={`block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 ${
                      form_errors.email ? 'border-red-500 ring-red-500' : ''
                    }`}
                    disabled={is_authenticating}
                  />
                  {form_errors.email && (
                    <p className="mt-2 text-sm text-red-600">{form_errors.email}</p>
                  )}
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  className="flex w-full justify-center rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold leading-6 text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                  disabled={is_authenticating}
                >
                  {is_authenticating ? (
                    <svg
                      className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                  ) : (
                    'Send Reset Link'
                  )}
                </button>
              </div>
            </form>

            <p className="mt-8 text-center text-sm text-gray-500">
              <Link to="/login" className="font-semibold leading-6 text-indigo-600 hover:text-indigo-500">
                Back to Log In
              </Link>
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default UV_ForgotPassword;