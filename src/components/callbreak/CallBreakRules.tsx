import React from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Spade } from 'lucide-react';

interface CallBreakRulesProps {
  onBack: () => void;
}

export default function CallBreakRules({ onBack }: CallBreakRulesProps) {
  return (
    <div className="min-h-screen bg-bg text-ink p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={onBack}
          className="mb-8 flex items-center gap-2 text-sm font-mono font-bold uppercase tracking-widest opacity-60 hover:opacity-100 transition-opacity"
        >
          <ArrowLeft size={16} />
          <span>Back to Games</span>
        </button>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-bg border-2 border-ink/10 rounded-3xl p-8 md:p-12"
        >
          <div className="flex items-center gap-4 mb-8">
            <div className="w-16 h-16 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
              <Spade size={32} />
            </div>
            <h1 className="text-4xl md:text-5xl font-display font-bold tracking-tight uppercase">Call Break</h1>
          </div>
          <p className="text-ink/60 font-mono mb-8">THE OFFICIAL RULEBOOK</p>

          <div className="prose prose-lg dark:prose-invert max-w-none space-y-8 opacity-80">
            <section>
              <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                <span className="text-blue-500">1.</span> THE OBJECTIVE
              </h2>
              <p>
                The goal of Call Break is to accurately "Call" (bid) the number of tricks you can win in a round and then win at least that many. It is a game of individual skill played over a set number of rounds (usually 5, or 3 as per your app).
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                <span className="text-blue-500">2.</span> THE SETUP
              </h2>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Players:</strong> Exactly 4 (Every player for themselves).</li>
                <li><strong>The Deck:</strong> Standard 52-card deck (No Jokers).</li>
                <li><strong>Deal:</strong> Each player receives 13 cards.</li>
                <li><strong>Trump Suit:</strong> Spades are the permanent trump suit. They always beat any card of another suit.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                <span className="text-blue-500">3.</span> THE BIDDING (THE "CALL")
              </h2>
              <p>
                After looking at their cards, each player must make a "Call."
              </p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li><strong>Minimum Bid:</strong> 1 trick.</li>
                <li><strong>Maximum Bid:</strong> 13 tricks.</li>
                <li><strong>The Goal:</strong> You must win at least the number of tricks you bid to get a positive score.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                <span className="text-blue-500">4.</span> GAMEPLAY OBLIGATIONS (STRICT RULES)
              </h2>
              <p>
                Call Break has stricter "forced play" rules than other card games. You must follow these three rules:
              </p>
              <ul className="list-disc pl-6 space-y-4 mt-4">
                <li>
                  <strong>FOLLOW SUIT:</strong> You must play a card of the same suit as the lead card if you have one.
                </li>
                <li>
                  <strong>MUST WIN (THE OVER-TRUMP):</strong> If you have a card of the lead suit that is higher than the current winning card on the table, you must play it. You cannot "throw away" a low card if you have a winning one.
                </li>
                <li>
                  <strong>TRUMPING:</strong> If you are "void" (don't have) the lead suit:
                  <ul className="list-disc pl-6 mt-2 space-y-1">
                    <li>You must play a Spade (Trump) if you have one.</li>
                    <li>If a Spade has already been played, you must play a higher Spade if possible.</li>
                    <li>If you have no cards of the lead suit and no Spades, you may play any card.</li>
                  </ul>
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                <span className="text-blue-500">5.</span> SCORING RULES
              </h2>
              <p>
                The score is calculated at the end of every round using a decimal system.
              </p>
              
              <div className="mt-4 space-y-4">
                <div>
                  <h3 className="font-bold text-xl">A. SUCCESSFUL CALL (Meeting/Exceeding Bid)</h3>
                  <p>If you win the number of tricks you bid (or more):</p>
                  <ul className="list-disc pl-6 space-y-1 mt-2">
                    <li>You get points equal to your bid.</li>
                    <li>Each extra trick (overtrick) adds 0.1 points.</li>
                    <li className="font-mono text-sm mt-2 bg-ink/5 p-2 rounded inline-block">Example: Bid 3, Win 3 = 3.0 Points.</li>
                    <li className="font-mono text-sm bg-ink/5 p-2 rounded inline-block ml-2">Example: Bid 3, Win 5 = 3.2 Points.</li>
                  </ul>
                </div>

                <div className="mt-6">
                  <h3 className="font-bold text-xl">B. FAILED CALL (THE "BREAK")</h3>
                  <p>If you win fewer tricks than you bid:</p>
                  <ul className="list-disc pl-6 space-y-1 mt-2">
                    <li>You receive a negative score equal to your bid.</li>
                    <li className="font-mono text-sm mt-2 bg-ink/5 p-2 rounded inline-block">Example: Bid 4, Win 3 = -4.0 Points.</li>
                  </ul>
                </div>

                <div className="mt-6">
                  <h3 className="font-bold text-xl">C. THE WINNER</h3>
                  <p>
                    After the final round (Round 3 or 5), all scores are added up. The player with the highest total points is the winner.
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                <span className="text-blue-500">6.</span> PRO TIPS FOR WINNING
              </h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  <strong>Count the Spades:</strong> Since everyone must trump if they are out of a suit, keep track of how many Spades have been played so you know when your high cards in other suits are "safe."
                </li>
                <li>
                  <strong>Force the Break:</strong> If an opponent bid high (like a 5 or 6), try to "steal" a trick they need by playing a higher card than them early.
                </li>
                <li>
                  <strong>Watch the Lead:</strong> The person who wins the trick leads the next one. Use this to lead suits you are strong in.
                </li>
              </ul>
            </section>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
