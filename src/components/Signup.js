
import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';

function Signup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSignup = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { data: { user }, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });
      if (signUpError) throw new Error(`Auth error: ${signUpError.message}`);
      if (!user) throw new Error('No user returned from signup');
      console.log('User signed up:', user.id);
      const { error: profileError } = await supabase.from('profiles').upsert([
        {
          id: user.id,
          username: username || email.split('@')[0],
          bio: '',
          avatar_url: '',
        },
      ], { onConflict: 'id' });
      if (profileError) throw new Error(`Profile error: ${profileError.message}`);
      console.log('Profile upserted for user:', user.id);
      alert('Signup successful! Please check your email to verify your account.');
      navigate('/login');
    } catch (err) {
      setError(err.message || 'Failed to sign up');
      console.error('Signup error:', err.message, err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto bg-white p-8 rounded-lg shadow-lg mt-12">
      <h2 className="text-3xl font-bold text-gray-800 mb-8 text-center">Sign Up</h2>
      {error && <p className="text-red-500 mb-6 text-center">{error}</p>}
      <form onSubmit={handleSignup}>
        <div className="mb-6">
          <label className="block text-gray-700 font-medium mb-2">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-3 border rounded-lg text-gray-800 focus:ring-2 focus:ring-yellow-500 transition"
            required
          />
        </div>
        <div className="mb-6">
          <label className="block text-gray-700 font-medium mb-2">Username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full p-3 border rounded-lg text-gray-800 focus:ring-2 focus:ring-yellow-500 transition"
            required
          />
        </div>
        <div className="mb-8">
          <label className="block text-gray-700 font-medium mb-2">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-3 border rounded-lg text-gray-800 focus:ring-2 focus:ring-yellow-500 transition"
            required
          />
        </div>
        <button
          type="submit"
          className="w-full bg-yellow-500 text-gray-800 p-3 rounded-lg hover:bg-yellow-600 transition disabled:opacity-50"
          disabled={loading}
        >
          {loading ? 'Signing up...' : 'Sign Up'}
        </button>
      </form>
      <p className="mt-6 text-center text-gray-600">
        Already have an account? <a href="/login" className="text-yellow-500 hover:underline">Login</a>
      </p>
    </div>
  );
}

export default Signup;