import React, { useState, useMemo, useEffect } from 'react';
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import type { ActiveVote, ChampionshipStanding, Participant } from '../types';
import { AppPhase } from '../constants';
import TournamentBracket from './TournamentBracket';

type ConnectionStatus = 'connecting' | 'live' | 'error';

const VotingOverlay: React.FC<{ activeVote: ActiveVote; sessionId: string }> = ({ activeVote, sessionId }) => {
    const castVote = useMutation(api.sessions.castVote);
    const [hasVoted, setHasVoted] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const votedKey = `voted-${activeVote.voteId}`;

    useEffect(() => {
        if (sessionStorage.getItem(votedKey)) {
            setHasVoted(true);
        }
    }, [votedKey]);

    const handleVote = async (vote: 'p1' | 'p2' | 'omt') => {
        if (submitting || hasVoted) return;
        setSubmitting(true);
        try {
            await castVote({ sessionId, voteId: activeVote.voteId, vote });
            sessionStorage.setItem(votedKey, 'true');
            setHasVoted(true);
        } catch (e) {
            console.error("Vote failed:", e);
        } finally {
            setSubmitting(false);
        }
    };

    const { participant1Name, participant2Name, votes } = activeVote;
    const totalVotes = votes.length;
    const isComplete = totalVotes >= 3;

    if (isComplete) {
        const p1Count = votes.filter(v => v === 'p1').length;
        const p2Count = votes.filter(v => v === 'p2').length;
        const omtCount = votes.filter(v => v === 'omt').length;

        let resultText = 'Viik!';
        let resultColor = 'text-yellow-300';
        if (p1Count > p2Count && p1Count > omtCount) { resultText = `${participant1Name} võitis!`; resultColor = 'text-blue-300'; }
        else if (p2Count > p1Count && p2Count > omtCount) { resultText = `${participant2Name} võitis!`; resultColor = 'text-red-300'; }
        else if (omtCount > p1Count && omtCount > p2Count) { resultText = 'OMT - veel üks kord!'; resultColor = 'text-yellow-300'; }

        return (
            <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
                <div className="bg-gray-800 rounded-xl p-6 max-w-sm w-full text-center border border-purple-500 shadow-2xl">
                    <h3 className="text-lg font-bold text-purple-300 mb-4">Hääletus lõppenud!</h3>
                    <div className="flex gap-3 mb-4">
                        <div className="flex-1 bg-blue-900/40 rounded-lg p-3">
                            <div className="text-sm text-gray-400">{participant1Name}</div>
                            <div className="text-3xl font-bold text-blue-300">{p1Count}</div>
                        </div>
                        <div className="flex-1 bg-yellow-900/40 rounded-lg p-3">
                            <div className="text-sm text-gray-400">OMT</div>
                            <div className="text-3xl font-bold text-yellow-300">{omtCount}</div>
                        </div>
                        <div className="flex-1 bg-red-900/40 rounded-lg p-3">
                            <div className="text-sm text-gray-400">{participant2Name}</div>
                            <div className="text-3xl font-bold text-red-300">{p2Count}</div>
                        </div>
                    </div>
                    <div className={`text-xl font-bold ${resultColor}`}>{resultText}</div>
                </div>
            </div>
        );
    }

    if (hasVoted) {
        return (
            <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
                <div className="bg-gray-800 rounded-xl p-6 max-w-sm w-full text-center border border-purple-500 shadow-2xl">
                    <h3 className="text-lg font-bold text-purple-300 mb-2">Hääl antud!</h3>
                    <p className="text-gray-400">Ootan teisi hindajaid... {totalVotes}/3</p>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
            <div className="bg-gray-800 rounded-xl p-6 max-w-md w-full border border-purple-500 shadow-2xl">
                <h3 className="text-lg font-bold text-purple-300 text-center mb-2">Kohtunike hääletus</h3>
                <p className="text-gray-400 text-center text-sm mb-6">{participant1Name} vs {participant2Name}</p>
                <div className="flex flex-col gap-3">
                    <button
                        onClick={() => handleVote('p1')}
                        disabled={submitting}
                        className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-bold py-4 px-6 rounded-lg text-lg transition-colors"
                    >
                        {participant1Name}
                    </button>
                    <button
                        onClick={() => handleVote('omt')}
                        disabled={submitting}
                        className="bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 text-white font-bold py-4 px-6 rounded-lg text-lg transition-colors"
                    >
                        OMT (veel üks kord)
                    </button>
                    <button
                        onClick={() => handleVote('p2')}
                        disabled={submitting}
                        className="bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white font-bold py-4 px-6 rounded-lg text-lg transition-colors"
                    >
                        {participant2Name}
                    </button>
                </div>
                <p className="text-gray-500 text-xs text-center mt-4">Hääled: {totalVotes}/3</p>
            </div>
        </div>
    );
};

const LiveQualificationResults: React.FC<{ participants: Participant[], defaultCollapsed?: boolean }> = ({ participants, defaultCollapsed = false }) => {
    const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
    const sortedParticipants = useMemo(() =>
        [...participants]
        .filter(p => p.score !== null)
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0)),
     [participants]);

    return (
        <div className="max-w-4xl mx-auto bg-gray-800 rounded-lg shadow-xl overflow-hidden">
             <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="w-full p-6 flex items-center justify-between hover:bg-gray-700/50 transition-colors"
             >
                <h2 className="text-2xl font-bold text-blue-300">Kvalifikatsiooni tulemused</h2>
                <span className={`text-gray-400 transition-transform ${isCollapsed ? '' : 'rotate-180'}`}>
                    ▼
                </span>
             </button>
             {!isCollapsed && (
                <div className="px-6 pb-6 space-y-2 max-h-96 overflow-y-auto">
                    {sortedParticipants.length === 0 ? (
                        <p className="text-center text-gray-500 py-8">Kvalifikatsioon pole veel alanud või tulemusi pole sisestatud.</p>
                    ) : (
                        sortedParticipants.map((p, index) => (
                            <div key={p.id} className="flex items-center justify-between gap-4 p-3 rounded-md bg-gray-700">
                                <div className="flex items-center gap-4">
                                    <span className="font-bold text-lg w-8 text-center">{index + 1}.</span>
                                    <span className="font-semibold text-lg">{p.name}</span>
                                </div>
                                <span className="font-bold text-xl text-yellow-400">{p.score}</span>
                            </div>
                        ))
                    )}
                </div>
             )}
        </div>
    );
};

const LiveStandingsTable: React.FC<{ standings: ChampionshipStanding[], competitionsHeld: number }> = ({ standings, competitionsHeld }) => {
    const getTotalPoints = (p: ChampionshipStanding) => p.pointsPerCompetition.reduce((sum, pts) => sum + pts, 0);
    const sortedStandings = [...standings].sort((a, b) => getTotalPoints(b) - getTotalPoints(a));

    return (
        <div className="max-w-7xl mx-auto bg-gray-800 p-6 rounded-lg shadow-xl">
            <h2 className="text-2xl font-bold text-yellow-300 mb-4">Hooaja edetabel</h2>
             <div className="overflow-x-auto">
                {sortedStandings.length > 0 ? (
                    <table className="w-full min-w-max">
                        <thead className="bg-gray-700/50">
                            <tr>
                                <th className="p-3 text-left text-sm font-semibold text-gray-400 tracking-wider w-16">Koht</th>
                                <th className="p-3 text-left text-sm font-semibold text-gray-400 tracking-wider">Nimi</th>
                                {Array.from({ length: competitionsHeld }, (_, i) => (
                                    <th key={i} className="p-3 text-center text-sm font-semibold text-gray-400 tracking-wider w-24">Etapp {i + 1}</th>
                                ))}
                                <th className="p-3 text-center text-sm font-semibold text-yellow-300 tracking-wider w-24">Kokku</th>
                            </tr>
                        </thead>
                         <tbody>
                            {sortedStandings.map((p, index) => (
                                <tr key={p.id} className="border-b border-gray-700">
                                    <td className="p-3 font-bold text-center">{index + 1}.</td>
                                    <td className="p-3 font-semibold">{p.name}</td>
                                    {Array.from({ length: competitionsHeld }, (_, i) => (
                                        <td key={i} className="p-3 text-center text-gray-400">{p.pointsPerCompetition[i] ?? 0}</td>
                                    ))}
                                    <td className="p-3 text-center font-bold text-yellow-400">{getTotalPoints(p)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <p className="text-center text-gray-400 py-4">Edetabel on tühi.</p>
                )}
            </div>
        </div>
    );
};


const LiveStatusIndicator: React.FC<{ status: ConnectionStatus }> = ({ status }) => {
  const statusConfig = {
    connecting: { text: 'Ühendan...', color: 'bg-yellow-500', pulse: true },
    live: { text: 'Live', color: 'bg-green-500', pulse: true },
    error: { text: 'Viga', color: 'bg-red-500', pulse: false },
  };
  const config = statusConfig[status];

  return (
    <div className="fixed top-4 right-4 flex items-center gap-2 bg-gray-800/80 backdrop-blur-sm text-white px-3 py-1 rounded-full text-sm font-semibold border border-gray-600">
      <span className={`w-3 h-3 rounded-full ${config.color} ${config.pulse ? 'animate-pulse' : ''}`}></span>
      <span>{config.text}</span>
    </div>
  );
};


const LiveResultsView: React.FC<{ sessionId: string }> = ({ sessionId }) => {
    // This ONE line replaces all SSE/fetch/reconnection logic from ntfy.sh!
    // Convex handles real-time subscriptions, reconnection, and state sync automatically.
    const session = useQuery(api.sessions.getSession, { sessionId });

    const [showEasterEgg, setShowEasterEgg] = useState(false);
    const [easterEggPosition, setEasterEggPosition] = useState({ x: 50, y: 50 });

    // Derive connection status from query state
    const connectionStatus: ConnectionStatus = session === undefined ? 'connecting' : 'live';

    // Easter egg trigger on session updates
    const lastUpdateRef = React.useRef<number | null>(null);
    React.useEffect(() => {
        if (session?.updatedAt && lastUpdateRef.current !== null && lastUpdateRef.current !== session.updatedAt) {
            // New update received - show easter egg
            setEasterEggPosition({
                x: Math.random() * 80 + 10,
                y: Math.random() * 80 + 10,
            });
            setShowEasterEgg(true);
            setTimeout(() => setShowEasterEgg(false), 2500);
        }
        if (session?.updatedAt) {
            lastUpdateRef.current = session.updatedAt;
        }
    }, [session?.updatedAt]);

    const renderContent = () => {
        if (!session) {
            return (
                <div className="text-center py-20 max-w-2xl mx-auto">
                    <div className="mb-6">
                        <style>{`
                            @keyframes leks-spin {
                                from { transform: rotate(0deg) scale(1); }
                                50% { transform: rotate(180deg) scale(1.1); }
                                to { transform: rotate(360deg) scale(1); }
                            }
                            .leks-loading {
                                animation: leks-spin 6s linear infinite;
                            }
                        `}</style>
                        <img
                            src="/leks.png"
                            alt="Loading..."
                            className="mx-auto h-24 w-24 leks-loading rounded-full"
                        />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-300 mb-3">Ootan andmeid...</h2>
                    <div className="bg-gray-800/50 rounded-lg p-6 text-left space-y-3">
                        <p className="text-gray-400">
                            {connectionStatus === 'live'
                                ? '✓ Ühendus aktiivne. Ootan esimest uuendust...'
                                : connectionStatus === 'connecting'
                                ? '⟳ Ühendan serveriga...'
                                : '⚠ Ühendus katkes. Proovin uuesti...'}
                        </p>
                        <p className="text-gray-500 text-sm">
                            Kui administraator on võistluse alustanud, näed tulemusi koheselt.
                            Kui midagi ei ilmu, veendu, et oled õigel lehel või proovi lehte värskendada.
                        </p>
                    </div>
                </div>
            );
        }

        const { phase, competitionParticipants, bracket, thirdPlaceMatch, standings, competitionsHeld } = session;

        const showBracket = phase === AppPhase.BRACKET || phase === AppPhase.FINISHED;

        return (
            <div className="space-y-8">
                { showBracket &&
                    <TournamentBracket
                        participants={competitionParticipants}
                        bracketData={bracket}
                        thirdPlaceMatch={thirdPlaceMatch}
                        onSetWinner={() => {}} // Read-only, so no-op
                        phase={phase as any}
                        onReturnToChampionship={() => {}} // Not applicable
                        isReadOnly={true}
                    />
                }
                { (phase === AppPhase.QUALIFICATION || showBracket) &&
                    <LiveQualificationResults
                        participants={competitionParticipants}
                        defaultCollapsed={showBracket}
                    />
                }
                { (phase === AppPhase.CHAMPIONSHIP_VIEW || phase === AppPhase.FINISHED) &&
                    <LiveStandingsTable standings={standings} competitionsHeld={competitionsHeld} />
                }
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900 text-gray-200 font-sans p-4 sm:p-6 lg:p-8">
            <LiveStatusIndicator status={connectionStatus} />

            {/* Judge voting overlay */}
            {session?.activeVote && (
                <VotingOverlay activeVote={session.activeVote as ActiveVote} sessionId={sessionId} />
            )}

            {/* Easter egg: floating leks appears on updates */}
            {showEasterEgg && (
                <div
                    style={{
                        position: 'fixed',
                        left: `${easterEggPosition.x}%`,
                        top: `${easterEggPosition.y}%`,
                        transform: 'translate(-50%, -50%)',
                        zIndex: 9999,
                        pointerEvents: 'none',
                    }}
                >
                    <style>{`
                        @keyframes leks-float {
                            0% { transform: rotate(0deg) scale(0); opacity: 0; }
                            20% { transform: rotate(90deg) scale(1.3); opacity: 1; }
                            50% { transform: rotate(180deg) scale(1.1); opacity: 1; }
                            80% { transform: rotate(270deg) scale(1.2); opacity: 0.8; }
                            100% { transform: rotate(360deg) scale(0); opacity: 0; }
                        }
                        .leks-easter-egg {
                            animation: leks-float 4s ease-out forwards;
                            box-shadow: 0 0 30px rgba(255, 255, 0, 0.8);
                            border-radius: 50%;
                        }
                    `}</style>
                    <img
                        src="/leks.png"
                        alt=""
                        className="h-32 w-32 leks-easter-egg"
                    />
                </div>
            )}

             <header className="text-center mb-8">
                <h1 className="text-4xl sm:text-5xl font-bold text-white tracking-tight">
                    Salajase pleistaühingu DMEC - Tulemused
                </h1>
            </header>
            <main>
                {renderContent()}
            </main>
        </div>
    );
};

export default LiveResultsView;
