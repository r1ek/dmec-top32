import React, { useState, useEffect } from 'react';
import { useMutation } from "convex/react";
import { api } from "../convex/_generated/api";

interface RegistrationPageProps {
  sessionId: string;
}

const RegistrationPage: React.FC<RegistrationPageProps> = ({ sessionId }) => {
  const [name, setName] = useState('');
  const [isRegistered, setIsRegistered] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const registerParticipant = useMutation(api.sessions.registerParticipant);

  useEffect(() => {
    if (isRegistered) {
      const timer = setTimeout(() => {
        const liveUrl = `${window.location.origin}${window.location.pathname}?live=${sessionId}`;
        window.location.replace(liveUrl);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isRegistered, sessionId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || isSubmitting) {
      return;
    }
    setError('');
    setIsSubmitting(true);

    try {
      await registerParticipant({
        sessionId,
        name: name.trim(),
      });
      setIsRegistered(true);
    } catch (err: any) {
      console.error("Registration failed:", err);
      // Handle specific error messages from Convex
      if (err.message?.includes('juba registreeritud') || err.message?.includes('juba olemas')) {
        setError('See nimi on juba registreeritud. Proovi teist nime.');
      } else if (err.message?.includes('not found')) {
        setError('Võistlust ei leitud. Kontrolli linki ja proovi uuesti.');
      } else {
        setError('Registreerimine ebaõnnestus. Proovi uuesti.');
      }
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-200 font-sans p-4 sm:p-6 lg:p-8 flex items-center justify-center">
      <div className="max-w-md w-full bg-gray-800 p-8 rounded-xl shadow-2xl text-center">
        {isRegistered ? (
          <div>
            <style>{`
              @keyframes leks-success {
                0% { transform: rotate(0deg) scale(0); opacity: 0; }
                30% { transform: rotate(180deg) scale(1.3); opacity: 1; }
                60% { transform: rotate(360deg) scale(1.1); }
                100% { transform: rotate(540deg) scale(1.1); opacity: 1; }
              }
              .leks-success {
                animation: leks-success 2.5s ease-out forwards;
                box-shadow: 0 0 40px rgba(34, 197, 94, 0.8);
              }
            `}</style>
            <img
              src="/leks.png"
              alt="Success"
              className="mx-auto h-24 w-24 leks-success rounded-full"
            />
            <h1 className="text-3xl font-bold text-white mt-4">Edukalt registreeritud!</h1>
            <p className="text-gray-400 mt-2">Sinu nimi on lisatud võistluse nimekirja. Sind suunatakse tulemuste lehele 3 sekundi pärast...</p>
          </div>
        ) : (
          <>
            <h1 className="text-3xl font-bold text-yellow-300 mb-2">Võistlusele registreerimine</h1>
            <p className="text-gray-400 mb-8">Sisesta oma nimi, et osalejate nimekirjaga liituda.</p>
            <form onSubmit={handleSubmit}>
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError('');
                }}
                placeholder="Sinu nimi"
                className="w-full bg-gray-700 text-white placeholder-gray-400 border border-gray-600 rounded-md px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
                aria-label="Participant Name"
                autoFocus
              />
              {error && <p className="text-red-400 mt-2 text-sm">{error}</p>}
              <button
                type="submit"
                disabled={isSubmitting || !name.trim()}
                className="w-full mt-6 bg-green-600 hover:bg-green-700 disabled:bg-gray-500 disabled:cursor-not-allowed text-white font-bold py-3 px-8 rounded-lg text-xl transition duration-300 shadow-lg"
              >
                {isSubmitting ? 'Registreerin...' : 'Registreeri'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default RegistrationPage;
