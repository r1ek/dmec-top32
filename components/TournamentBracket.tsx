import React, { useState } from 'react';
import type { BracketData, Match, Participant, ActiveVote } from '../types';
import { AppPhase } from '../constants';

const LiveLinkBar: React.FC<{ sessionId: string }> = ({ sessionId }) => {
  const [copied, setCopied] = useState(false);
  const liveUrl = `${window.location.origin}${window.location.pathname}?live=${sessionId}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(liveUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center gap-2 bg-gray-800 p-3 rounded-lg mb-4 border border-gray-700">
      <span className="text-sm text-gray-400 whitespace-nowrap">Live vaade:</span>
      <code className="text-sm text-blue-300 bg-gray-900 px-2 py-1 rounded flex-grow overflow-x-auto whitespace-nowrap">{liveUrl}</code>
      <button
        onClick={handleCopy}
        className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-3 py-1 rounded transition-colors whitespace-nowrap"
      >
        {copied ? 'Kopeeritud!' : 'Kopeeri'}
      </button>
    </div>
  );
};

// --- Helper Components defined at top-level ---

interface MatchCardProps {
  match: Match;
  onSetWinner: (matchId: number, winner: Participant) => void;
  isReadOnly?: boolean;
  onStartVote?: (matchId: number, p1Name: string, p2Name: string) => void;
  activeVote?: ActiveVote | null;
}

const MatchCard: React.FC<MatchCardProps> = ({ match, onSetWinner, isReadOnly = false, onStartVote, activeVote }) => {
  const { participant1, participant2, winner } = match;

  const hasBothParticipants = participant1 && participant2;
  const isVotingThisMatch = activeVote?.matchId === match.id;

  const handleSelectWinner = (selectedParticipant: Participant) => {
    if (isReadOnly || !hasBothParticipants) return;
    if (!winner) {
      onSetWinner(match.id, selectedParticipant);
    } else if (winner.id !== selectedParticipant.id) {
      onSetWinner(match.id, selectedParticipant);
    }
  };

  const getParticipantClass = (participant: Participant | null, isWinner: boolean) => {
    if (!participant) return 'text-gray-500 italic';
    if (!winner && hasBothParticipants && !isReadOnly) return 'cursor-pointer hover:bg-blue-600';
    if (isWinner && !isReadOnly) return 'font-bold text-green-300 cursor-pointer';
    if (isWinner) return 'font-bold text-green-300';
    if (winner && !isWinner && !isReadOnly) return 'text-gray-500 line-through cursor-pointer hover:bg-red-600/30';
    if (winner && !isWinner) return 'text-gray-500 line-through';
    return '';
  };

  const isP1Winner = winner !== null && winner?.id === participant1?.id;
  const isP2Winner = winner !== null && winner?.id === participant2?.id;

  return (
    <div className="relative">
      <div className={`bg-gray-800 rounded-lg shadow-md w-64 h-24 flex flex-col justify-center border ${isVotingThisMatch ? 'border-purple-500' : 'border-gray-700'}`}>
        <div
          className={`p-2 transition-colors duration-200 rounded-t-lg ${getParticipantClass(participant1, isP1Winner)}`}
          onClick={() => participant1 && handleSelectWinner(participant1)}
        >
          <span className="text-sm text-gray-400 mr-2">{participant1?.seed}</span>
          {participant1?.name || 'Selgumisel'}
        </div>
        <div className="border-t border-gray-600"></div>
        <div
          className={`p-2 transition-colors duration-200 rounded-b-lg ${getParticipantClass(participant2, isP2Winner)}`}
          onClick={() => participant2 && handleSelectWinner(participant2)}
        >
          <span className="text-sm text-gray-400 mr-2">{participant2?.seed}</span>
          {participant2?.name || 'Selgumisel'}
        </div>
      </div>
      {/* Vote button for admin */}
      {onStartVote && hasBothParticipants && !isReadOnly && (
        <button
          onClick={() => onStartVote(match.id, participant1!.name, participant2!.name)}
          className={`absolute -bottom-2 -right-2 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
            isVotingThisMatch
              ? 'bg-purple-600 text-white'
              : 'bg-gray-700 text-gray-400 hover:bg-purple-600 hover:text-white'
          } border border-gray-600`}
          title="Alusta hääletus"
        >
          {isVotingThisMatch ? `${activeVote?.votes.length}/3` : '?'}
        </button>
      )}
    </div>
  );
};


const Connector: React.FC = () => {
  return (
    <div className="w-8 h-full relative" aria-hidden="true">
      {/* Vertical line joining the two parent branches */}
      <div className="absolute top-1/4 right-1/2 w-px h-1/2 bg-gray-600"></div>
      
      {/* Top branch from parent match */}
      <div className="absolute top-1/4 right-1/2 w-1/2 h-px bg-gray-600"></div>

      {/* Bottom branch from parent match */}
      <div className="absolute bottom-1/4 right-1/2 w-1/2 h-px bg-gray-600"></div>

      {/* Line to child match */}
      <div className="absolute top-1/2 right-0 w-1/2 h-px bg-gray-600"></div>
    </div>
  );
};


interface WinnerDisplayProps {
    bracketData: BracketData;
    thirdPlaceMatch: Match | null;
    participants: Participant[];
    onReturnToChampionship: () => void;
}

const WinnerDisplay: React.FC<WinnerDisplayProps> = ({ bracketData, thirdPlaceMatch, participants, onReturnToChampionship }) => {
    const finalMatch = bracketData[bracketData.length - 1]?.[0];
    const winner = finalMatch?.winner;

    const qualificationWinner = participants
        .filter(p => p.score !== null && p.score > 0)
        .sort((a, b) => (b.score as number) - (a.score as number))[0];
    
    if (!winner) return null;

    const runnerUp = finalMatch?.participant1?.id === winner.id ? finalMatch.participant2 : finalMatch?.participant1;
    const thirdPlace = thirdPlaceMatch?.winner;

    return (
        <div className="relative flex flex-col items-center justify-center text-center p-4">
            <div className="relative z-10 w-full">
              <h2 className="text-3xl font-bold text-yellow-400 mb-8 tracking-wider opacity-0 animate-podium-item" style={{ animationDelay: '0s' }}>Võistluse tulemused</h2>
              
              <div className="flex justify-center items-end gap-10 md:gap-16 flex-wrap">
                  {/* Podium */}
                  <div className="flex items-end justify-center gap-4">
                      {runnerUp && (
                          <div className="flex flex-col items-center order-1 sm:order-1 opacity-0 animate-podium-item" style={{ animationDelay: '0.4s' }}>
                              <div className="text-4xl">🥈</div>
                              <div className="font-bold text-xl text-gray-300">{runnerUp.name}</div>
                              <div className="bg-gray-700 w-32 h-24 rounded-t-lg flex items-center justify-center text-2xl font-bold">2. koht</div>
                          </div>
                      )}
                      <div className="flex flex-col items-center order-2 sm:order-2 opacity-0 animate-podium-item" style={{ animationDelay: '0.6s' }}>
                          <div className="text-5xl">🥇</div>
                          <div className="font-bold text-2xl text-yellow-300">{winner.name}</div>
                          <div className="bg-yellow-500 text-gray-900 w-40 h-32 rounded-t-lg flex items-center justify-center text-3xl font-bold">1. koht</div>
                      </div>
                      {thirdPlace && (
                          <div className="flex flex-col items-center order-3 sm:order-3 opacity-0 animate-podium-item" style={{ animationDelay: '0.2s' }}>
                              <div className="text-4xl">🥉</div>
                              <div className="font-bold text-xl" style={{ color: '#CD7F32' }}>{thirdPlace.name}</div>
                              <div className="w-32 h-20 rounded-t-lg flex items-center justify-center text-2xl font-bold" style={{ backgroundColor: '#8C5A2B' }}>3. koht</div>
                          </div>
                      )}
                  </div>
                  
                  {/* Qualification Winner */}
                  {qualificationWinner && (
                    <div className="flex flex-col items-center opacity-0 animate-podium-item" style={{ animationDelay: '0.8s' }}>
                      <div className="text-5xl mb-2">🏆</div>
                      <div className="font-bold text-xl text-yellow-300">{qualificationWinner.name}</div>
                      <div className="text-lg font-semibold text-gray-400 mt-1">Kvalifikatsiooni võitja</div>
                    </div>
                  )}

              </div>
              <button
                  onClick={onReturnToChampionship}
                  className="mt-12 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-8 rounded-lg text-lg transition duration-300 opacity-0 animate-podium-item"
                  style={{ animationDelay: '1.0s' }}
              >
                  Lõpeta võistlus ja vaata edetabelit
              </button>
            </div>
        </div>
    );
};

// --- Main Bracket Component ---

interface TournamentBracketProps {
  bracketData: BracketData;
  thirdPlaceMatch: Match | null;
  onSetWinner: (matchId: number, winner: Participant) => void;
  phase: AppPhase;
  onReturnToChampionship: () => void;
  participants: Participant[];
  isReadOnly?: boolean;
  sessionId?: string | null;
  onStartVote?: (matchId: number, p1Name: string, p2Name: string) => void;
  onCloseVote?: () => void;
  onCastVote?: (vote: 'p1' | 'p2' | 'omt') => void;
  activeVote?: ActiveVote | null;
}

const getRoundName = (numMatches: number) => {
    if (numMatches === 1) return 'Finaal';
    if (numMatches === 2) return 'Poolfinaalid';
    if (numMatches === 4) return 'Veerandfinaalid';
    if (numMatches >= 8) return `1/${numMatches}-finaalid`;
    return `Voor ${numMatches * 2} osalejaga`;
};


const VoteStatusPanel: React.FC<{
    activeVote: ActiveVote;
    onClose: () => void;
    onCastVote?: (vote: 'p1' | 'p2' | 'omt') => void;
}> = ({ activeVote, onClose, onCastVote }) => {
    const { participant1Name, participant2Name, votes } = activeVote;
    const p1Count = votes.filter(v => v === 'p1').length;
    const p2Count = votes.filter(v => v === 'p2').length;
    const omtCount = votes.filter(v => v === 'omt').length;
    const isComplete = votes.length >= 3;

    const getResultText = () => {
        if (p1Count > p2Count && p1Count > omtCount) return `${participant1Name} võitis!`;
        if (p2Count > p1Count && p2Count > omtCount) return `${participant2Name} võitis!`;
        if (omtCount > p1Count && omtCount > p2Count) return 'OMT - veel üks kord!';
        return 'Viik - otsusta ise!';
    };

    return (
        <div className="bg-purple-900/50 border border-purple-500 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-purple-300">Hääletus: {participant1Name} vs {participant2Name}</h3>
                <button onClick={onClose} className="text-gray-400 hover:text-white text-sm px-2 py-1 rounded hover:bg-gray-700">Sulge</button>
            </div>
            {isComplete ? (
                <>
                    <div className="flex gap-4 text-center">
                        <div className={`flex-1 rounded p-2 ${p1Count > 0 ? 'bg-blue-900/50' : 'bg-gray-800'}`}>
                            <div className="text-sm text-gray-400">{participant1Name}</div>
                            <div className="text-2xl font-bold text-blue-300">{p1Count}</div>
                        </div>
                        <div className={`flex-1 rounded p-2 ${omtCount > 0 ? 'bg-yellow-900/50' : 'bg-gray-800'}`}>
                            <div className="text-sm text-gray-400">OMT</div>
                            <div className="text-2xl font-bold text-yellow-300">{omtCount}</div>
                        </div>
                        <div className={`flex-1 rounded p-2 ${p2Count > 0 ? 'bg-red-900/50' : 'bg-gray-800'}`}>
                            <div className="text-sm text-gray-400">{participant2Name}</div>
                            <div className="text-2xl font-bold text-red-300">{p2Count}</div>
                        </div>
                    </div>
                    <div className="mt-2 text-center">
                        <span className="text-lg font-bold text-purple-300">{getResultText()}</span>
                    </div>
                </>
            ) : (
                <div className="mt-2 text-center text-sm text-gray-400">
                    <span>Ootan hääli... {votes.length}/3</span>
                </div>
            )}
            {/* Host can vote too */}
            {onCastVote && !isComplete && (
                <div className="mt-3 flex gap-2">
                    <button onClick={() => onCastVote('p1')} className="flex-1 bg-blue-600/50 hover:bg-blue-600 text-white text-xs py-1.5 rounded transition-colors">{participant1Name}</button>
                    <button onClick={() => onCastVote('omt')} className="flex-1 bg-yellow-600/50 hover:bg-yellow-600 text-white text-xs py-1.5 rounded transition-colors">OMT</button>
                    <button onClick={() => onCastVote('p2')} className="flex-1 bg-red-600/50 hover:bg-red-600 text-white text-xs py-1.5 rounded transition-colors">{participant2Name}</button>
                </div>
            )}
        </div>
    );
};

const TournamentBracket: React.FC<TournamentBracketProps> = ({
    bracketData,
    thirdPlaceMatch,
    onSetWinner,
    phase,
    onReturnToChampionship,
    participants,
    isReadOnly = false,
    sessionId,
    onStartVote,
    onCloseVote,
    onCastVote,
    activeVote,
}) => {
    if (!bracketData || bracketData.length === 0) {
        return <p>Laen tabelit...</p>;
    }

    if (phase === AppPhase.FINISHED) {
        return (
             <div className="relative p-6 bg-gray-800 rounded-xl shadow-2xl overflow-hidden">
                <WinnerDisplay
                    bracketData={bracketData}
                    thirdPlaceMatch={thirdPlaceMatch}
                    onReturnToChampionship={onReturnToChampionship}
                    participants={participants}
                />
            </div>
        )
    }

    const finalRound = bracketData[bracketData.length - 1];

    // Card is h-24 (6rem). We'll give it 1rem vertical spacing. Total slot height = 7rem.
    const MATCH_SLOT_HEIGHT_REM = 7;
    const totalBracketHeightRem = (bracketData[0]?.length ?? 0) * MATCH_SLOT_HEIGHT_REM;

    return (
        <>
            {activeVote && onCloseVote && !isReadOnly && (
                <VoteStatusPanel activeVote={activeVote} onClose={onCloseVote} onCastVote={onCastVote} />
            )}
            <div className="p-4 bg-gray-900/50 rounded-xl overflow-x-auto">
                <div className="flex justify-start items-start">
                    {bracketData.map((round, roundIndex) => {
                        if (roundIndex === bracketData.length - 1) return null;

                        const matchSlotHeight = MATCH_SLOT_HEIGHT_REM * Math.pow(2, roundIndex);
                        const connectorSlotHeight = matchSlotHeight * 2;

                        return (
                            <React.Fragment key={roundIndex}>
                                <div className="flex flex-col px-2">
                                    <div className="h-10 flex items-end justify-center pb-2">
                                        <h3 className="text-center font-bold text-blue-300">
                                        {getRoundName(round.length)}
                                        </h3>
                                    </div>
                                    {round.map((match) => (
                                        <div key={match.id} style={{ height: `${matchSlotHeight}rem` }} className="flex items-center">
                                            <MatchCard match={match} onSetWinner={onSetWinner} isReadOnly={isReadOnly} onStartVote={onStartVote} activeVote={activeVote} />
                                        </div>
                                    ))}
                                </div>
                                <div className="flex flex-col">
                                    <div className="h-10" />
                                    {Array.from({ length: round.length / 2 }).map((_, i) => (
                                        <div key={i} style={{ height: `${connectorSlotHeight}rem` }} className="flex items-center">
                                            <Connector />
                                        </div>
                                    ))}
                                </div>
                            </React.Fragment>
                        );
                    })}

                    {/* Finals Column */}
                    <div className="flex flex-col justify-center items-center px-4" style={{ minHeight: `${totalBracketHeightRem}rem`}}>
                        <div className="h-10 flex items-end justify-center pb-2">
                            <h3 className="text-center font-bold text-yellow-400">Finaalid</h3>
                        </div>
                        {finalRound && finalRound.map((match) => (
                            <MatchCard key={match.id} match={match} onSetWinner={onSetWinner} isReadOnly={isReadOnly} onStartVote={onStartVote} activeVote={activeVote} />
                        ))}

                        {thirdPlaceMatch && (
                            <div className="mt-8">
                                <div className="text-center font-bold mb-4 text-orange-400">3. koha mäng</div>
                                <MatchCard match={thirdPlaceMatch} onSetWinner={onSetWinner} isReadOnly={isReadOnly} onStartVote={onStartVote} activeVote={activeVote} />
                            </div>
                        )}
                    </div>
                </div>
            </div>
            {sessionId && !isReadOnly && <LiveLinkBar sessionId={sessionId} />}
        </>
    );
};

export default TournamentBracket;
