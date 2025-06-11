
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';

function Profile() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState({ username: '', bio: '', avatar_url: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [file, setFile] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUserAndProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          navigate('/login');
          return;
        }
        setUser(user);
        const { data, error } = await supabase
          .from('profiles')
          .select('username, bio, avatar_url')
          .eq('id', user.id)
          .single();
        if (error) throw error;
        setProfile(data || { username: '', bio: '', avatar_url: '' });
      } catch (err) {
        setError(err.message);
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
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(fileName, file, { upsert: true });
        if (uploadError) throw uploadError;
        const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
        avatarUrl = data.publicUrl;
      }
      const updates = {
        username: profile.username,
        bio: profile.bio,
        avatar_url: avatarUrl,
      };
      const { error } = await supabase
        .from('profiles')
        .upsert({ id: user.id, ...updates })
        .eq('id', user.id);
      if (error) throw error;
      alert('Profile updated!');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  if (loading) return <div className="text-center mt-10">Loading...</div>;

  return (
    <div className="max-w-md mx-auto bg-white p-8 rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">Your Profile</h2>
      {error && <p className="text-red-500 mb-4 text-center">{error}</p>}
      {user && (
        <div className="mb-6 text-center">
          <p className="text-gray-600">Email: {user.email}</p>
          {profile.avatar_url && (
            <img
              src={profile.avatar_url}
              alt="Avatar"
              className="w-24 h-24 rounded-full mx-auto mt-4 object-cover"
            />
          )}
        </div>
      )}
      <form onSubmit={handleUpdate}>
        <div className="mb-4">
          <label className="block text-gray-700 mb-2">Username</label>
          <input
            type="text"
            value={profile.username}
            onChange={(e) => setProfile({ ...profile, username: e.target.value })}
            className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
        <div className="mb-4">
          <label className="block text-gray-700 mb-2">Bio</label>
          <textarea
            value={profile.bio || ''}
            onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
            className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows="4"
          />
        </div>
        <div className="mb-6">
          <label className="block text-gray-700 mb-2">Avatar</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files[0])}
            className="w-full p-3 border rounded-lg"
          />
        </div>
        <button
          type="submit"
          className="w-full bg-blue-500 text-white p-3 rounded-lg hover:bg-blue-600 transition disabled:opacity-50"
          disabled={loading}
        >
          {loading ? 'Updating...' : 'Update Profile'}
        </button>
      </form>
      <button
        onClick={handleSignOut}
        className="w-full mt-4 bg-red-500 text-white p-3 rounded-lg hover:bg-red-600 transition"
      >
        Sign Out
      </button>
    </div>
  );
}

export default Profile;