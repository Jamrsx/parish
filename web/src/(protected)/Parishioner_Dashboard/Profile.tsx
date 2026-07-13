import { useState, useEffect } from 'react';
import type { ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import Navigation from './Navigation';
import { authAPI } from '../../../library/api';

interface ProfileData {
  first_name: string;
  last_name: string;
  middle_name: string;
  contact_number: string;
  address: string;
  email: string;
  user_id?: number;
}

const ParishionerProfile = () => {
  const navigate = useNavigate();
  const { logout, user, updateUser, isAuthenticated, isLoading } = useAuth();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [showErrorMessage, setShowErrorMessage] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [profileData, setProfileData] = useState<ProfileData>({
    first_name: '',
    last_name: '',
    middle_name: '',
    contact_number: '',
    address: '',
    email: '',
  });

  const loadUserData = () => {
    setIsLoadingProfile(true);
    
    try {
      // Get user from authStorage via the user from context
      if (user) {
        setProfileData({
          first_name: user.first_name || '',
          last_name: user.last_name || '',
          middle_name: user.middle_name || '',
          contact_number: user.contact_number || '',
          address: user.address || '',
          email: user.email || '',
          user_id: user.user_id || 0,
        });
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
    
    setIsLoadingProfile(false);
  };

  // Load data on component mount
  useEffect(() => {
    loadUserData();
  }, [user]);

  if (isLoading || isLoadingProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    navigate('/login');
    return null;
  }

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout failed:', error);
      setErrorMessage('Failed to logout. Please try again.');
      setShowErrorMessage(true);
      setTimeout(() => setShowErrorMessage(false), 3000);
    }
  };

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      const response = await authAPI.updateProfile({
        first_name: profileData.first_name,
        last_name: profileData.last_name,
        middle_name: profileData.middle_name,
        contact_number: profileData.contact_number,
        address: profileData.address,
      });

      if (response.data.success) {
        // Update the user data in context
        updateUser({
          first_name: profileData.first_name,
          last_name: profileData.last_name,
          middle_name: profileData.middle_name,
          contact_number: profileData.contact_number,
          address: profileData.address,
        });
        
        setShowSuccessMessage(true);
        setIsEditing(false);
        setTimeout(() => setShowSuccessMessage(false), 3000);
      } else {
        throw new Error(response.data.message || 'Failed to update profile');
      }
    } catch (error: unknown) {
      console.error('Failed to save profile:', error);
      const apiError = error as any;
      setErrorMessage(
        apiError.response?.data?.message ||
          'Failed to update profile. Please try again.'
      );
      setShowErrorMessage(true);
      setTimeout(() => setShowErrorMessage(false), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleInputChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setProfileData({
      ...profileData,
      [e.target.name]: e.target.value,
    });
  };

  const getFullName = () => {
    const { first_name, middle_name, last_name } = profileData;
    const fullName = `${first_name} ${
      middle_name ? middle_name + ' ' : ''
    }${last_name}`;
    return fullName.trim() || 'Parishioner';
  };

  const getInitials = () => {
    const first = profileData.first_name?.charAt(0) || '';
    const last = profileData.last_name?.charAt(0) || '';
    return (first + last).toUpperCase() || 'P';
  };

  // If no data is loaded, show a message
  if (!profileData.first_name && !profileData.last_name) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <Navigation />
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">No Profile Data Found</h2>
            <p className="text-gray-600 mb-4">
              We couldn't load your profile data. Please try refreshing the page.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition"
            >
              Refresh Page
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <Navigation />

      {showSuccessMessage && (
        <div className="fixed top-20 right-4 z-50 animate-slide-in">
          <div className="bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Profile updated successfully!
          </div>
        </div>
      )}

      {showErrorMessage && (
        <div className="fixed top-20 right-4 z-50 animate-slide-in">
          <div className="bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            {errorMessage}
          </div>
        </div>
      )}

      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-gradient-to-br from-blue-900/50 to-purple-900/50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 max-w-md mx-4 animate-fade-in shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-800">Confirm Logout</h3>
            </div>
            <p className="text-gray-600 mb-6">Are you sure you want to logout from your account?</p>
            <div className="flex gap-3">
              <button
                onClick={handleLogout}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition transform hover:scale-105"
              >
                Yes, Logout
              </button>
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-lg transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Profile Header */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden mb-8 transform transition-all hover:shadow-2xl">
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-12 relative">
            <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2">
              <div className="bg-white rounded-full p-2 shadow-lg">
                <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                  <span className="text-4xl text-white font-bold">{getInitials()}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-16 pb-6 text-center">
            <h1 className="text-2xl font-bold text-gray-800">{getFullName()}</h1>
            <p className="text-gray-500 mt-1">Parishioner Member</p>
            <div className="flex justify-center gap-3 mt-4 flex-wrap">
              {!isEditing ? (
                <button
                  onClick={() => setIsEditing(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition transform hover:scale-105 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                  Edit Profile
                </button>
              ) : (
                <>
                  <button
                    onClick={handleSaveProfile}
                    disabled={isSaving}
                    className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg transition transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isSaving ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Saving...
                      </>
                    ) : (
                      'Save Changes'
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setIsEditing(false);
                      loadUserData();
                    }}
                    className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-6 py-2 rounded-lg transition"
                  >
                    Cancel
                  </button>
                </>
              )}
              <button
                onClick={() => setShowLogoutConfirm(true)}
                className="bg-red-100 hover:bg-red-200 text-red-700 px-6 py-2 rounded-lg transition flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Logout
              </button>
            </div>
          </div>
        </div>

        {/* Profile Information Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Personal Information */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Personal Information
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">First Name</label>
                {isEditing ? (
                  <input
                    type="text"
                    name="first_name"
                    value={profileData.first_name}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                ) : (
                  <p className="text-gray-800 font-medium">{profileData.first_name || 'Not provided'}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Last Name</label>
                {isEditing ? (
                  <input
                    type="text"
                    name="last_name"
                    value={profileData.last_name}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                ) : (
                  <p className="text-gray-800 font-medium">{profileData.last_name || 'Not provided'}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Middle Name</label>
                {isEditing ? (
                  <input
                    type="text"
                    name="middle_name"
                    value={profileData.middle_name || ''}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                ) : (
                  <p className="text-gray-800">{profileData.middle_name || 'Not provided'}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Email Address</label>
                <p className="text-gray-800">{profileData.email || 'Not provided'}</p>
              </div>
            </div>
          </div>

          {/* Contact & Address Information */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              Contact & Address
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Contact Number</label>
                {isEditing ? (
                  <input
                    type="tel"
                    name="contact_number"
                    value={profileData.contact_number}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                ) : (
                  <p className="text-gray-800">{profileData.contact_number || 'Not provided'}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Address</label>
                {isEditing ? (
                  <textarea
                    name="address"
                    value={profileData.address}
                    onChange={handleInputChange}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                ) : (
                  <p className="text-gray-800 whitespace-pre-line">{profileData.address || 'Not provided'}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes slide-in {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes fade-in {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-slide-in { animation: slide-in 0.3s ease-out; }
        .animate-fade-in { animation: fade-in 0.2s ease-out; }
      `}</style>
    </div>
  );
};

export default ParishionerProfile;