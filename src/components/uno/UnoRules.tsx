import React from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, BookOpen } from 'lucide-react';

interface UnoRulesProps {
  onBack: () => void;
}

export default function UnoRules({ onBack }: UnoRulesProps) {
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
            <div className="w-16 h-16 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center">
              <BookOpen size={32} />
            </div>
            <h1 className="text-4xl md:text-5xl font-display font-bold tracking-tight uppercase">Uno Rules</h1>
          </div>
          <p className="text-ink/60 font-mono mb-8">THE OFFICIAL RULEBOOK</p>

          <div className="prose prose-lg dark:prose-invert max-w-none space-y-8 opacity-80">
            <section>
              <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                <span className="text-red-500">1.</span> THE OBJECTIVE
              </h2>
              <p>
                The goal of Uno is to be the first player to score 500 points. Points are scored by getting rid of all the cards in your hand before your opponents. You score points for cards left in your opponents' hands.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                <span className="text-red-500">2.</span> THE SETUP
              </h2>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Players:</strong> 2 to 10 players.</li>
                <li><strong>The Deck:</strong> 108 cards (Numbers 0-9 in 4 colors, plus Action and Wild cards).</li>
                <li><strong>Deal:</strong> Each player receives 7 cards.</li>
                <li><strong>Starting Play:</strong> The top card of the deck is turned over to begin a discard pile.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                <span className="text-red-500">3.</span> GAMEPLAY
              </h2>
              <p>
                On your turn, you must match a card from your hand to the card on the top of the discard pile, either by number, color, or symbol.
              </p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li><strong>Matching:</strong> If the top card is a Red 7, you must play any Red card or any color 7.</li>
                <li><strong>Drawing:</strong> If you don't have a match, you must draw a card from the deck. If that card can be played, you may play it immediately.</li>
                <li><strong>Wild Cards:</strong> Wild cards can be played on any card and allow you to choose the next color.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                <span className="text-red-500">4.</span> ACTION CARDS
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div className="bg-ink/5 p-4 rounded-xl border border-ink/10">
                  <h3 className="font-bold text-red-500 mb-2">SKIP</h3>
                  <p className="text-sm">The next player in sequence misses a turn.</p>
                </div>
                <div className="bg-ink/5 p-4 rounded-xl border border-ink/10">
                  <h3 className="font-bold text-blue-500 mb-2">REVERSE</h3>
                  <p className="text-sm">Reverses the direction of play (Clockwise to Counter-clockwise and vice versa).</p>
                </div>
                <div className="bg-ink/5 p-4 rounded-xl border border-ink/10">
                  <h3 className="font-bold text-green-500 mb-2">DRAW TWO</h3>
                  <p className="text-sm">The next player draws 2 cards and misses their turn.</p>
                </div>
                <div className="bg-ink/5 p-4 rounded-xl border border-ink/10">
                  <h3 className="font-bold text-yellow-500 mb-2">WILD DRAW FOUR</h3>
                  <p className="text-sm">Allows you to choose the color AND the next player draws 4 cards and misses their turn.</p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                <span className="text-red-500">5.</span> CALLING "UNO"
              </h2>
              <p className="bg-red-500/10 p-4 border-l-4 border-red-500 italic">
                When you have only one card left in your hand, you must shout "UNO".
              </p>
              <p className="mt-4">
                If you are caught not saying "UNO" before the next player begins their turn, you must draw 2 cards as a penalty.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                <span className="text-red-500">6.</span> SCORING
              </h2>
              <p>When a player gets rid of all their cards, they receive points for cards left in opponents' hands:</p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>All number cards (0-9): Face Value</li>
                <li>Draw Two, Skip, Reverse: 20 Points</li>
                <li>Wild, Wild Draw Four: 50 Points</li>
              </ul>
            </section>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
