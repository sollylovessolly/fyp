
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';

function Profile() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState({ username: '', bio: '', avatar_url: '' });
  const [savedRoutesCount, setSavedRoutesCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [file, setFile] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editProfile, setEditProfile] = useState({ username: '', bio: '' });
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUserAndProfile = async () => {
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError) throw new Error(`Auth error: ${userError.message}`);
        if (!user) {
          navigate('/login');
          return;
        }
        setUser(user);
        console.log('Fetching profile for user:', user.id);
        const [{ data: profileData, error: profileError }, { data: routesData, error: routesError }] = await Promise.all([
          supabase.from('profiles').select('username, bio, avatar_url').eq('id', user.id).single(),
          supabase.from('saved_routes').select('id').eq('user_id', user.id),
        ]);
        if (profileError && profileError.code !== 'PGRST116') throw new Error(`Profile fetch error: ${profileError.message}`);
        if (routesError) throw new Error(`Routes fetch error: ${routesError.message}`);
        const defaultProfile = { username: user.email.split('@')[0], bio: '', avatar_url: '' };
        setProfile(profileData || defaultProfile);
        setEditProfile(profileData || defaultProfile);
        setSavedRoutesCount(routesData?.length || 0);
        console.log('Profile fetched:', profileData || defaultProfile);
      } catch (err) {
        setError(err.message || 'Failed to load profile');
        console.error('Profile load error:', err.message, err);
      } finally {
        setLoading(false);
      }
    };
    fetchUserAndProfile();
  }, [navigate]);

  const handleUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      let avatarUrl = profile.avatar_url;
      if (file) {
        if (!file.type.startsWith('image/')) {
          throw new Error('Please upload an image file');
        }
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}.${fileExt}`;
        console.log('Uploading avatar:', { fileName, fileType: file.type });
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(fileName, file, { upsert: true });
        if (uploadError) throw new Error(`Avatar upload error: ${uploadError.message}`);
        const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
        avatarUrl = data.publicUrl;
        console.log('Avatar URL:', avatarUrl);
      }
      const updates = {
        username: editProfile.username,
        bio: editProfile.bio,
        avatar_url: avatarUrl,
      };
      console.log('Updating profile:', updates);
      const { error: upsertError } = await supabase
        .from('profiles')
        .upsert({ id: user.id, ...updates }, { onConflict: 'id' })
        .eq('id', user.id);
      if (upsertError) throw new Error(`Profile update error: ${upsertError.message}`);
      setProfile({ ...profile, ...updates });
      setShowEditModal(false);
      alert('Profile updated!');
      console.log('Profile updated successfully');
    } catch (err) {
      setError(err.message || 'Failed to update profile');
      console.error('Profile update error:', err.message, err);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      navigate('/login');
    } catch (err) {
      setError(err.message || 'Failed to sign out');
    }
  };

  if (loading) return <div className="text-center mt-12 text-gray-600">Loading...</div>;

  return (
    <div className="w-full max-w-md mx-auto mt-12">
      {error && <p className="text-red-500 mb-6 text-center">{error}</p>}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex flex-col items-center">
          {profile.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt="Avatar"
              className="w-24 h-24 rounded-full object-cover border-2 border-yellow-500"
            />
          ) : (
            <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center text-2xl font-bold text-gray-600">
              {profile.username.charAt(0).toUpperCase()}
            </div>
          )}
          <h2 className="text-2xl font-bold text-gray-800 mt-4">{profile.username}</h2>
          <p className="text-gray-600 text-sm mt-1">{user?.email}</p>
          <p className="text-gray-600 text-center mt-2">{profile.bio || 'No bio yet'}</p>
          <div className="flex justify-center space-x-6 mt-4">
            <div className="text-center">
              <p className="text-lg font-semibold text-gray-800">{savedRoutesCount}</p>
              <p className="text-sm text-gray-500">Saved Routes</p>
            </div>
          </div>
          <button
            onClick={() => setShowEditModal(true)}
            className="mt-6 px-4 py-2 bg-yellow-500 text-gray-800 rounded-lg hover:bg-yellow-600 transition"
          >
            Edit Profile
          </button>
        </div>
      </div>
      <button
        onClick={handleSignOut}
        className="w-full mt-6 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
      >
        Sign Out
      </button>

      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-800">Edit Profile</h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-gray-600 hover:text-gray-800"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleUpdate}>
              <div className="mb-4">
                <label className="block text-gray-700 font-medium mb-2">Username</label>
                <input
                  type="text"
                  value={editProfile.username}
                  onChange={(e) => setEditProfile({ ...editProfile, username: e.target.value })}
                  className="w-full p-3 border rounded-lg text-gray-800 focus:ring-2 focus:ring-yellow-500 transition"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-gray-700 font-medium mb-2">Bio</label>
                <textarea
                  value={editProfile.bio || ''}
                  onChange={(e) => setEditProfile({ ...editProfile, bio: e.target.value })}
                  className="w-full p-3 border rounded-lg text-gray-800 focus:ring-2 focus:ring-yellow-500 transition"
                  rows="4"
                />
              </div>
              <div className="mb-4">
                <label className="block text-gray-700 font-medium mb-2">Avatar</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setFile(e.target.files[0])}
                  className="w-full p-3 border rounded-lg text-gray-800"
                />
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-yellow-500 text-gray-800 rounded-lg hover:bg-yellow-600 transition disabled:opacity-50"
                  disabled={loading}
                >
                  {loading ? 'Updating...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Profile;