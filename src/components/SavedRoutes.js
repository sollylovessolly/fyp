import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';

function SavedRoutes() {
  const [user, setUser] = useState(null);
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUserAndRoutes = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          navigate('/login');
          return;
        }
        setUser(user);
        const { data, error } = await supabase
          .from('saved_routes')
          .select('id, start_name, end_name, start_addr, end_addr, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
        if (error) throw error;
        setRoutes(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchUserAndRoutes();
  }, [navigate]);

  const handleNavigate = (start, end) => {
    navigate(`/map?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`);
  };

  if (loading) return <div className="text-center mt-6">Loading...</div>;

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-100 to-gray-100 flex flex-col items-center p-6">
      <div className="w-full max-w-lg">
        <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">Saved Routes</h2>
        {error && <p className="text-red-500 mb-4 text-center">{error}</p>}
        {routes.length === 0 ? (
          <p className="text-gray-600 text-center">No saved routes yet.</p>
        ) : (
          <ul className="space-y-4">
            {routes.map(route => (
              <li key={route.id} className="bg-white p-4 rounded-lg shadow-md">
                <p className="text-gray-600">
                  <strong>{route.start_name}</strong> to <strong>{route.end_name}</strong>
                </p>
                <p className="text-sm text-gray-500">Saved: {new Date(route.created_at).toLocaleString()}</p>
                <button
                  onClick={() => handleNavigate(route.start_addr, route.end_addr)}
                  className="mt-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
                >
                  View on Map
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default SavedRoutes;